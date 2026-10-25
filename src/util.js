// Small helpers shared by the app and its view builders: time, text and the Own-it step names.

export const DAY = 24 * 60 * 60 * 1000;

// "3 days ago", "today", "in 7 days", relative to the (possibly simulated) now.
export const rel = (t, now) => { const d = Math.round((t - now) / DAY); return d === 0 ? 'today' : d < 0 ? `${-d} day${d === -1 ? '' : 's'} ago` : `in ${d} day${d === 1 ? '' : 's'}`; };

export const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hours ago`; };

export const quote = t => String(t).split('\n').map(l => '> ' + l).join('\n');
export const answerText = (m, sep = '\n\n') => [m.intro, m.code, m.outro].filter(Boolean).join(sep);
// Choice picks as text: "question → the option picked".
export const pickedText = (check, picked) => check.questions.map(q => `${q.prompt} → ${(q.options.find(x => x.v === picked[q.id]) || {}).l || '(no answer)'}`).join('\n');
// Owning the whole answer, or a part long enough to count as it.
export const ownsWhole = o => o.code === o.fullCode || o.code.length > 400;
export const isPickCheck = c => !!c && ['choice', 'steps'].includes(c.type);

const STEP_LABELS = { read: 'Read it', assemble: 'Assemble it', write: 'Write it' };

// The try's name follows what you do in it: picking answers isn't writing.
export const stepLabel = (o, step) => step !== 'write' ? STEP_LABELS[step] : (o && o.write && o.write.check ? { choice: 'Answer it', explain: o.write.check.respond ? 'Handle it' : 'Explain it', number: 'Work it out', steps: 'Work it out' }[o.write.check.type] : null) || 'Write it';

// Owning the same thing again is one thing you own, with a history: the latest attempt is the live entry (its
// recall schedule, its card); earlier ones are folded into it as "Earlier" and leave the schedule. They stay in
// the ledger, so calibration still counts every prediction. Idempotent, so it also cleans up saved progress.
export function foldRepeats(ledger) {
  const live = ledger.filter(e => e.kind !== 'gap' && !e.merged);
  const byTitle = {};
  for (const e of live) (byTitle[e.title] ||= []).push(e);
  const fold = {};
  for (const group of Object.values(byTitle)) {
    if (group.length < 2) continue;
    const sorted = group.slice().sort((a, b) => (a.ownedAt || 0) - (b.ownedAt || 0)), latest = sorted[sorted.length - 1];
    const earlier = sorted.slice(0, -1).flatMap(e => [...(e.earlier || []), { predicted: e.predicted, actual: e.actual, n: e.n, at: e.ownedAt }]);
    fold[latest.id] = { earlier: [...(latest.earlier || []), ...earlier].sort((a, b) => a.at - b.at), realWork: sorted.flatMap(e => e.realWork || []), reviews: sorted.flatMap(e => e.reviews || []) };
    for (const e of sorted.slice(0, -1)) fold[e.id] = { merged: true, dueAt: null };
  }
  return Object.keys(fold).length ? ledger.map(e => (fold[e.id] ? { ...e, ...fold[e.id] } : e)) : ledger;
}
