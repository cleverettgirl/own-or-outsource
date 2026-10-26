// Scoring a try: the target's own check (run, calculate, match picks), Claude's grader with deterministic
// clamps, an offline fallback, and the gap judge.
import { ask } from './claude.js';
import { checkSql } from './sqlCheck.js';
import { checkNumber } from './numberCheck.js';
import { checkChoice } from './choiceCheck.js';
import { checkSteps } from './stepsCheck.js';
import { isColdStart, judgeColdStartOffline } from './gaps.js';

// Score an attempt with the target's own check: run it (SQL), calculate it (numbers) or match picks (choice).
export async function runCheck(check, text, before, after, picked) {
  if (check.type === 'number') return checkNumber(check, text);
  if (check.type === 'choice') return checkChoice(check, picked || {});
  if (check.type === 'steps') return checkSteps(check, picked || {});
  return checkSql(check, text, before, after);
}

// Claude couldn't be reached (or its reply was unusable), so nothing was checked. Never scored as wrong: the try
// isn't recorded, and you're asked to check again.
export const COULDNT_CHECK =
  "Claude couldn't be reached to check this, so nothing was scored. Your answer is still here: try checking again in a moment.";
export class CouldNotCheck extends Error {}

// Offline rules, only for the two code starters' own shapes (the SQL revenue query, the React fetch). Anything else
// returns null: rules written for one query or component would mark any other try wrong.
export function fallbackGrade(o, attempt, ref) {
  const a = attempt.toLowerCase();
  let checks;
  const starterSql =
      o.lang === 'sql' &&
      /left\s+join/i.test(ref || '') &&
      /published|paid/i.test(ref || ''),
    starterReact = /useEffect/.test(ref || '') && /fetch/.test(ref || '');
  if (!starterSql && !starterReact) return null;
  if (starterSql)
    checks = [
      [
        /left\s+(outer\s+)?join/,
        'keeps the left table with no matches (LEFT JOIN)',
      ],
      [/on[\s\S]*(published|paid)/, 'filters the status inside the ON clause'],
      [
        /sum\s*\(|count\s*\(|is\s+null/,
        'uses the right aggregate or NULL test',
      ],
      [/group\s+by|is\s+null/, 'groups per row of the left table'],
      [
        /order\s+by[\s\S]*desc|is\s+null/,
        'sorts descending (without DESC you get the smallest first)',
      ],
    ];
  else
    checks = [
      [/usestate/, 'holds the result in state'],
      [/useeffect/, 'runs the fetch in an effect'],
      [/\[\s*slug\s*\]|\[\s*id\s*\]|\[\s*\]/, 'has a dependency array'],
      [/cancelled|ignore|stale|abort/, 'guards against stale responses'],
      [/return\s*\(\)\s*=>/, 'returns a cleanup'],
    ];
  const hit = checks.filter(c => c[0].test(a));
  const miss = checks.filter(c => !c[0].test(a));
  const score =
    attempt.trim().length < 10 ? 1 : Math.max(1, Math.min(5, hit.length));
  return {
    items: checks.map(c => ({
      short: c[1],
      ok: attempt.trim().length >= 10 && c[0].test(a),
    })),
    score,
    worked: hit.length
      ? 'Your version ' + hit.map(c => c[1]).join(', ') + '.'
      : 'A start, but not much of the structure is there yet.',
    gap: miss.length
      ? 'Missing: ' + miss.map(c => c[1]).join(', ') + '.'
      : 'Nothing structural. This holds.',
  };
}
// Shared grader: Claude, requirement checklist with quoted evidence, then deterministic clamps.
// A SQL try that didn't run: Claude checks each of the target's items against the query as written. Offline, or
// if Claude can't be reached, it stays "not checked".
export async function judgeSqlThatDidntRun(o, ran) {
  const items = o.write.check.items || [];
  if (!items.length) return ran;
  try {
    const attempt = [o.write.before, o.write.text, o.write.after]
      .filter(Boolean)
      .join('\n');
    const j = await gradeAttempt(
      o.write.task,
      o.write.check.expected,
      attempt,
      'sql',
      'reveal',
      items.map(i => i.short),
    );
    return {
      ...ran,
      items: items.map((it, k) => ({
        short: it.short,
        owned: !!it.owned,
        ok: !!(j.items[k] && j.items[k].ok),
        judged: true,
      })),
      judgedByClaude: true,
      worked: '',
      score: j.score,
    };
  } catch (e) {
    return ran;
  }
}
// requirements: when the try fixed them up front (so the prediction counted them), the grader checks exactly those.
export async function gradeAttempt(
  task,
  ref,
  attempt,
  lang,
  variant = 'reveal',
  requirements = null,
) {
  const r = await ask('grade', { task, ref, attempt, variant, requirements });
  r.checks = Array.isArray(r.checks) ? r.checks : [];
  r.checks.forEach(c => {
    if (
      !c.quoted_evidence ||
      !String(attempt).includes(String(c.quoted_evidence).trim().slice(0, 12))
    )
      c.met = false;
  });
  const unmet = r.checks.filter(c => !c.met);
  r.score = Math.max(1, Math.min(5, Math.round(Number(r.score) || 1)));
  if (unmet.length) r.score = Math.min(r.score, 3);
  // deterministic SQL guard for "top N" tasks
  if (
    lang === 'sql' &&
    /including .* with none|still (show up|appear)|no paid orders|haven't bought|with 0\b/i.test(
      task,
    ) &&
    !/left\s+(outer\s+)?join/i.test(attempt)
  ) {
    r.score = Math.min(r.score, 3);
    const n =
      'Without a LEFT JOIN, rows with no match on the right side drop out, so the ones the task says to include are missing.';
    unmet.push({ requirement: 'LEFT JOIN', met: false });
    r.gap = n;
    r.note = r.note ? n + ' ' + r.note : n;
  }
  if (
    lang === 'sql' &&
    /\btop\b|most .* first|highest first/i.test(task) &&
    !/\bdesc\b/i.test(attempt)
  ) {
    r.score = Math.min(r.score, 3);
    const n =
      'The task asks for the biggest first but there is no DESC, so this sorts ascending and puts them last.';
    unmet.push({ requirement: 'sort descending', met: false });
    r.gap = n;
    r.note = r.note ? n + ' ' + r.note : n;
  }
  if (unmet.length && (!r.gap || /nothing structural/i.test(r.gap)))
    r.gap = 'Not met: ' + unmet.map(c => c.requirement).join('; ') + '.';
  // One item per requirement. A deterministic guard marks its requirement unmet (it never adds items, so N stays
  // what the prediction counted).
  const guard = (re, req) => {
    if (!unmet.some(u => u.requirement === req)) return;
    const c = r.checks.find(x => re.test(x.requirement));
    if (c) c.met = false;
  };
  guard(/join|appear|includ|every|with (no|none|0)/i, 'LEFT JOIN');
  guard(/sort|order|desc|first/i, 'sort descending');
  r.items =
    requirements && requirements.length
      ? requirements.map((q, i) => ({
          short: q,
          ok: !!(r.checks[i] && r.checks[i].met),
        }))
      : r.checks.map(c => ({ short: c.requirement, ok: !!c.met }));
  return r;
}

export async function judgeGap(g, check, answer) {
  const quoted = q =>
    q &&
    answer.toLowerCase().includes(String(q).toLowerCase().trim().slice(0, 12));
  try {
    if (!check.keyPoints.length) throw new Error('no key points');
    const r = await ask('gapJudge', {
      topic: g.topic,
      question: check.question,
      keyPoints: check.keyPoints,
      answer,
    });
    const points = check.keyPoints.map((p, i) => {
      const x = (r.points || [])[i] || {};
      return {
        point: p,
        ok: !!quoted(x.evidence),
        evidence: quoted(x.evidence) ? String(x.evidence) : '',
      };
    });
    return {
      points,
      closed: points.every(p => p.ok),
      feedback: r.feedback || '',
    };
  } catch (e) {
    if (isColdStart(g)) {
      const r = judgeColdStartOffline(answer);
      const points = r.points.map(p => ({ point: p.point, ok: !!p.evidence }));
      return { points, closed: points.every(p => p.ok), feedback: r.feedback };
    }
    return { points: [], closed: false, failed: true, feedback: COULDNT_CHECK };
  }
}
