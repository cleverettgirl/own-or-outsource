// Recognition practice for personal topics (faith, family, attachment, your own feelings): research §13.
// There's no answer key to check you against, so nothing here is scored or counted in calibration.
// Each scenario is about made-up people; every reading carries a note, framed as one way to see it.

// Keeps only scenarios the panel can show: a situation, a question, and 2-3 readings each with a note.
// Exactly one reading is marked as the best fit; if Claude marked none or several, the first marked (or the first) wins.
export function normalizeSpot(r) {
  const scenarios = (r && Array.isArray(r.scenarios) ? r.scenarios : [])
    .map((sc, i) => {
      const options = (Array.isArray(sc && sc.options) ? sc.options : [])
        .filter(o => o && o.label && o.note)
        .slice(0, 3)
        .map((o, j) => ({
          v: j,
          label: String(o.label),
          note: String(o.note),
          fits: !!o.fits,
        }));
      const best = Math.max(
        0,
        options.findIndex(o => o.fits),
      );
      options.forEach((o, j) => {
        o.fits = j === best;
      });
      return {
        id: 's' + i,
        text: String((sc && sc.text) || ''),
        prompt: String((sc && sc.prompt) || "What's going on here?"),
        options,
      };
    })
    .filter(sc => sc.text && sc.options.length >= 2);
  return scenarios.slice(0, 3);
}

// What the chat shows once you're done: practised, never a score.
export function spotSummary(spot, picked, scenarios) {
  const n = scenarios.filter(sc => picked[sc.id] != null).length;
  return `${spot} · practised ${n} scenario${n === 1 ? '' : 's'}, not scored`;
}
