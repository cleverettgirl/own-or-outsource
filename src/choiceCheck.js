// Scores picked answers against a key, not by asking a model: the "chosen" sibling of sqlCheck.js
// and numberCheck.js, for ideas with no code to run and no number to calculate. Same result shape.
// Each classic wrong pick can carry its own gap, so a wrong answer is explained, not just marked.
// items: one per question, so the prediction ("how many of N will you get right?") and the result count the
// same things. A blank question is not right (it used to slip through as a partial score).

const WHY = {
  5: 'Every pick matches the reasoning the task is testing.',
  3: 'Some picks hold, and at least one shows a gap in the reasoning.',
  2: 'None of the picks match yet.',
  1: "There's nothing picked yet.",
};

// check: { type: 'choice', questions: [{ id, prompt, options: [{ v, l, gap? }], answer }] }
// picked: { [questionId]: optionValue }
export function checkChoice(check, picked) {
  const qs = check.questions;
  const answered = qs.filter(q => picked[q.id] != null);
  const items = qs.map(q => ({ short: q.short || q.prompt, ok: picked[q.id] === q.answer, blank: picked[q.id] == null, owned: !!q.owned }));
  if (!answered.length) return { score: 1, why: WHY[1], worked: '', gap: 'Pick an answer for each question, then check.', corrections: [], items };
  const right = qs.filter(q => picked[q.id] === q.answer);
  const wrong = qs.filter(q => picked[q.id] != null && picked[q.id] !== q.answer);
  const skipped = qs.length - answered.length;
  const score = right.length === qs.length ? 5 : right.length ? 3 : 2;
  const worked = right.length ? `${right.length} of ${qs.length} right: ${right.map(q => q.short).join(', ')}.` : '';
  // The first wrong pick's own explanation is the most useful thing to read next.
  const firstGap = wrong.map(q => q.options.find(o => o.v === picked[q.id]).gap).find(Boolean);
  const gap = [firstGap, skipped ? `${skipped} question${skipped > 1 ? 's' : ''} left blank.` : ''].filter(Boolean).join(' ');
  return { score, why: WHY[score], worked, gap, corrections: [], items };
}
