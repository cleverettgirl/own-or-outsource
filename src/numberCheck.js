// Scores a numeric answer by comparing numbers, not by asking a model: the calculated sibling of
// sqlCheck.js. Same result shape (score, why, worked, gap), so the reveal treats them alike.

const WHY = {
  5: 'Every number matches the answer.',
  3: "You gave a number, but it isn't the one the task asks for.",
  2: "There's no number in it to check yet.",
  1: "There's nothing to check yet.",
};

// "87.5%", "87.5", "0.875" and "7/8" all mean 87.5 when the answer is a percentage.
function parse(text) {
  const out = [];
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(%?)/g)) {
    if (m[1]) { const d = Number(m[2]); if (d) out.push({ v: Number(m[1]) / d * 100, pct: true }); }
    else out.push({ v: Number(m[3]), pct: m[4] === '%' });
  }
  return out;
}
// Prefer numbers marked with %; otherwise take the last ones (working often comes before the answer).
function pick(text, k) {
  const all = parse(text);
  const marked = all.filter(n => n.pct);
  const chosen = (marked.length >= k ? marked : all).slice(-k);
  return chosen.map(n => (!n.pct && n.v > 0 && n.v < 1 ? n.v * 100 : n.v));
}
const fmt = v => `${Math.round(v * 100) / 100}%`;

// check: { expected: [numbers], tolerance, labels?: ['(a)', '(b)'], diagnoses?: [{ answer: [numbers], gap }] }
export function checkNumber(check, attempt) {
  const k = check.expected.length, tol = check.tolerance ?? 0.6;
  // One item per number asked for, so prediction and result count the same things.
  const itemsFor = got => check.expected.map((v, i) => ({ short: check.labels ? `${check.labels[i]} ${fmt(v)}` : 'The number', ok: got[i] != null && Math.abs(got[i] - v) <= tol, owned: false }));
  if (attempt.trim().length < 1) return { score: 1, why: WHY[1], worked: '', gap: 'Write your answer, then check it.', corrections: [], items: itemsFor([]) };
  const got = pick(attempt, k);
  const items = itemsFor(got.length < k ? [] : got);
  if (got.length < k) return { items, score: 2, why: WHY[2], worked: '', gap: k > 1 ? `The task asks for ${k} numbers, ${check.labels.join(' and ')}. Give each as a percentage.` : 'Give your answer as a percentage, like 50%.', corrections: [] };
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  const label = i => (check.labels ? check.labels[i] + ' ' : '');
  const said = got.map((v, i) => label(i) + fmt(v)).join(', ');
  if (near(got, check.expected)) return { items, score: 5, why: WHY[5], worked: `You said ${said}. That's right.`, gap: '', corrections: [] };
  for (const d of check.diagnoses || []) if (near(got, d.answer)) return { items, score: 3, why: WHY[3], worked: `You said ${said}.`, gap: d.gap, corrections: [] };
  const right = got.map((v, i) => Math.abs(v - check.expected[i]) <= tol);
  const held = right.some(Boolean) && k > 1 ? `${right.map((r, i) => r ? check.labels[i] : null).filter(Boolean).join(' and ')} is right. ` : '';
  return { items, score: 3, why: WHY[3], worked: `You said ${said}.`, gap: `${held}The answer is ${check.expected.map((v, i) => label(i) + fmt(v)).join(', ')}. ${check.explain || ''}`.trim(), corrections: [] };
}
