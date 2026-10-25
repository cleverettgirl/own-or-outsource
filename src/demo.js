import { SQL_TARGETS } from './targets.js';
import { JUNO_TARGETS } from './junoTargets.js';
import { REACT_TARGETS } from './reactTargets.js';
import { COLD_START } from './gaps.js';
import { SQL, REACT, JUNO } from './scenarios.js';
import { DAY } from './util.js';

// Spaced recall: owned things come due after 3 days; recalled right → a week, then 3 weeks; missed → tomorrow.
// One item is seeded from the Juno chat, owned "3 days ago", so the loop is visible from the start. It's the mechanism,
// not which side to own: a grader walking Juno owns that, and recalling it first would give the try away. (It was the
// Rule of Five, whose recall felt thin: Christine, "less likely to ask me what the exact percentage chance…")
export function seedLedger() {
  const t = Date.now(), label = JUNO_TARGETS.mechanism.label;
  return [{ id: 'seed-mechanism', example: true, title: label, predicted: 3, actual: 2, n: 3, fixed: null, hints: 0, realWork: [], reviews: [],
    ownedAt: t - 3 * DAY, dueAt: t - 60 * 60 * 1000,
    own: { scenario: JUNO, focus: { label, mode: 'concept', target: 'mechanism' }, lang: 'strategy', code: '', write: { schema: '' } } }];
}
// The ?demo sample: what a few days of real use looks like, built on the real targets so recall, "try a new
// question" and the gap actions all work on it. Times are relative to now, so something is always due.
export function demoState() {
  const t = Date.now(), H = 60 * 60 * 1000;
  const own = (scenario, focus, lang, code = '') => ({ scenario, focus, lang, code, write: { schema: '' } });
  const entry = (id, title, predicted, actual, n, ownedDaysAgo, dueInDays, o, extra = {}) => ({ id, title, predicted, actual, n, fixed: null, hints: 0, realWork: [], reviews: [], ownedAt: t - ownedDaysAgo * DAY, dueAt: t + dueInDays * DAY, own: o, ...extra });
  const cold = { id: 'demo-g1', topic: 'How a two-sided platform solves the cold start', question: 'On day one there are no readers or writers, so what makes the first ones show up?', quote: "I'm not sure, maybe they pay the first writers?", source: 'teach', origin: 'while you were explaining “Which side an aggregator owns” to Sam', from: JUNO_TARGETS.ownside.label, at: t - 2 * DAY, status: 'closed', closedAt: t - 1 * DAY, context: COLD_START.context };
  const open = { id: 'demo-g2', topic: 'When to push back on a team decision, and when to commit', question: "But if you disagree with the plan and you're not the manager, do you still have to go along with it?", quote: "I guess you just say it once and then do it anyway?", source: 'teach', origin: 'while you were explaining “Helping generously without burning out” to Sam', from: 'Helping generously without burning out', at: t - 3 * H, status: 'open', context: '' };
  return {
    ledger: [
      entry('demo-1', JUNO_TARGETS.mechanism.label, 3, 2, 3, 4, -2 * H / DAY, own(JUNO, { label: JUNO_TARGETS.mechanism.label, mode: 'concept', target: 'mechanism' }, 'strategy')),
      entry('demo-2', JUNO_TARGETS.ownside.label, 2, 3, 3, 9, 5, own(JUNO, { label: JUNO_TARGETS.ownside.label, mode: 'concept', target: 'ownside' }, 'strategy'),
        { reviews: [{ at: t - 2 * DAY, right: 3, n: 3 }], realWork: [{ predicted: 1, actual: 2, n: 2 }] }),
      entry('demo-3', SQL_TARGETS.onwhere.label, 1, 1, 2, 1, 2, own(SQL, { label: SQL_TARGETS.onwhere.label, mode: 'concept', target: 'onwhere' }, 'sql'),
        { fixed: 2, realWork: [{ outsourced: true }] }),
      { id: 'gap-demo-g1', kind: 'gap', title: cold.topic, predicted: null, actual: null, fixed: null, hints: 0, realWork: [], reviews: [], ownedAt: t - 1 * DAY, dueAt: t + 2 * DAY,
        gap: { ...cold, check: COLD_START.check }, own: own(null, { label: cold.topic, mode: 'concept' }, 'concept') },
      entry('demo-4', 'Converting both baselines to the same units', 4, 3, 4, 1, 2, own(null, { label: 'Converting both baselines to the same units', mode: 'concept' }, 'text', 'Put both baselines in the same units. Convert B\'s "20 in 100" into "__ in 1,000". Find the extra cases. Compare the two absolute numbers, not the percentages.')),
      entry('demo-5', 'Helping generously without burning out', 3, 1, 3, 0.1, 3, own(null, { label: 'Helping generously without burning out', mode: 'concept' }, 'text', 'Givers who succeed protect their time: they help in ways that have high impact for others and low cost to themselves, and they set boundaries so helping doesn\'t crowd out their own work.')),
    ],
    gaps: [cold, open],
    asked: [{ id: 'demo-a1', msgId: null, quote: 'COUNT(*) counts rows, so it counts that one', question: "why does COUNT(*) count the empty row but COUNT(o.id) doesn't?", scenario: SQL, chatTitle: SQL.title, at: t - 5 * H, label: 'Why COUNT(*) counts the empty row in a LEFT JOIN', checked: false }],
    exits: [{ id: 'demo-x1', title: REACT_TARGETS.timing.label, predicted: 0, n: 3, step: 'asked Claude first', askedFirst: true, stepOf: '', startStep: 'Answer it', scenario: REACT }],
  };
}
