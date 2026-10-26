import { JUNO_TARGETS } from './junoTargets.js';
import { JUNO } from './scenarios.js';
import { DAY } from './util.js';

// Spaced recall: owned things come due after 3 days; recalled right → a week, then 3 weeks; missed → tomorrow.
// One item is seeded from the Juno chat, owned "3 days ago", so the loop is visible from the start. It's the mechanism,
// not which side to own: a grader walking Juno owns that, and recalling it first would give the try away. (It was the
// Rule of Five, whose recall felt thin: Christine, "less likely to ask me what the exact percentage chance…")
export function seedLedger() {
  const t = Date.now(),
    label = JUNO_TARGETS.mechanism.label;
  return [
    {
      id: 'seed-mechanism',
      example: true,
      title: label,
      predicted: 3,
      actual: 2,
      n: 3,
      fixed: null,
      hints: 0,
      realWork: [],
      reviews: [],
      ownedAt: t - 3 * DAY,
      dueAt: t - 60 * 60 * 1000,
      own: {
        scenario: JUNO,
        focus: { label, mode: 'concept', target: 'mechanism' },
        lang: 'strategy',
        code: '',
        write: { schema: '' },
      },
    },
  ];
}
