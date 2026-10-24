// How a try's result is counted and described: items (tally), calibration across what you've predicted, and the
// short explanations shown on the reveal. Pure functions, shared by the app and its views.

// How each kind of try is checked, shown as a tooltip on the reveal's explanation.
export const SCALES = { number: 'Checked by comparing your number with the answer', choice: 'Checked against the answer key; each wrong pick has its own explanation', explain: 'Checked by Claude for each key idea, quoting your own words as evidence', sql: 'Checked by running your query on sample data and testing the rows it returns', steps: 'Checked by comparing each step\'s number with the answer' };


// Rubric meanings for the model grader, so its scores come with a reason too.
export const RUBRIC_WHY = { 5: 'It meets every requirement of the task.', 4: 'It meets every requirement, with a cosmetic issue.', 3: 'It misses at least one requirement of the task.', 2: "It wouldn't run as written.", 1: "It isn't close to the task yet." };

// Prediction and result count the same things: the try's items (questions, key points, requirements, the
// parts of a query's result). A grade without items counts as one item, right only when fully right.
export const tally = g => { const it = g && g.items && g.items.length ? g.items : [{ ok: !!g && g.score >= 5 }]; return { right: it.filter(i => i.ok).length, n: it.length }; };

export const allRight = g => { const t = tally(g); return t.right === t.n; };

// Across every item you've predicted: the share you expected to get right vs the share you got, and the Brier
// score (mean of (expected chance − outcome)², 0 is perfect). A prediction of k of n is a chance of k/n per item.
export function calibration(ledger) {
  const es = ledger.filter(e => e.kind !== 'gap' && e.n);
  const items = es.reduce((a, e) => a + e.n, 0);
  if (!items) return { items: 0, text: '', title: '' };
  const exp = es.reduce((a, e) => a + e.predicted, 0) / items, got = es.reduce((a, e) => a + e.actual, 0) / items;
  const brier = es.reduce((a, e) => { const p = e.predicted / e.n; return a + e.actual * (1 - p) ** 2 + (e.n - e.actual) * p ** 2; }, 0) / items;
  const pc = x => Math.round(x * 100) + '%', d = exp - got;
  const text = `Calibration, across ${items} things you've predicted: you expected to get ${pc(exp)} right and got ${pc(got)}. `
    + (Math.abs(d) < 0.1 ? 'Your predictions track your results.' : d > 0 ? 'Reading feels like knowing; the ledger shows the difference.' : 'You know more than you give yourself credit for.');
  return { items, text, got: Math.round(got * 100), title: `Brier score ${brier.toFixed(2)} (0 is perfect, 0.25 is a coin flip)` };
}

export const correctionNote = cs => cs && cs.length ? `Read ${cs.map(c => `“${c.from}” as “${c.to}”`).join(', ')}. Typos don't count against you.` : '';
