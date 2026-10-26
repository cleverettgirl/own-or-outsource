// Scores a "work it out" try: a calculation done in steps, one number per step, compared with the answer (not
// judged by a model). Each step is one item, so "how many of these N will you get right?" counts steps, and a
// wrong step shows exactly where the working slipped. The sibling of numberCheck.js for generated tries.
//
// check: { type: 'steps', steps: [{ id, label, answer, unit?: '%' | '', how? }] }   entered: { [stepId]: string }

// "1,000", "50%", "0.5" and "1/2" are all read as numbers. With unit '%', 0.5 means 50%.
function read(text, unit) {
  const t = String(text || '')
    .replace(/,/g, '')
    .trim();
  const frac = t.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (frac && Number(frac[2]))
    return (Number(frac[1]) / Number(frac[2])) * (unit === '%' ? 100 : 1);
  const m = t.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const v = Number(m[0]);
  return unit === '%' && !/%/.test(t) && Math.abs(v) <= 1 && v !== 0
    ? v * 100
    : v;
}
// Close enough: within 1% of the answer (rounding), or 0.01 for answers near zero.
const near = (v, a) => Math.abs(v - a) <= Math.max(0.01, Math.abs(a) * 0.01);
const fmt = (v, unit) =>
  `${Math.round(v * 100) / 100}${unit === '%' ? '%' : ''}`;

export function checkSteps(check, entered = {}) {
  const items = check.steps.map(s => {
    const v = read(entered[s.id], s.unit);
    return {
      short: s.label,
      ok: v != null && near(v, s.answer),
      blank: v == null,
      owned: false,
    };
  });
  const right = items.filter(i => i.ok).length,
    n = items.length;
  if (items.every(i => i.blank))
    return {
      score: 1,
      why: '',
      worked: '',
      gap: 'Enter a number for each step, then check.',
      corrections: [],
      items,
    };
  // The first wrong step is the one to look at: later steps usually follow from it.
  const k = items.findIndex(i => !i.ok),
    s = check.steps[k];
  const gap =
    k < 0
      ? ''
      : items[k].blank
        ? `Step ${k + 1} is still empty. ${s.how || ''}`.trim()
        : `Step ${k + 1}: the answer is ${fmt(s.answer, s.unit)}, and you have ${entered[s.id]}. ${s.how || ''}`.trim();
  return {
    score: right === n ? 5 : right ? 3 : 2,
    why: '',
    worked: '',
    gap,
    corrections: [],
    items,
  };
}
