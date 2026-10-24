// "On your version": notes on HOW you wrote it, beyond whether it passed, like a code reviewer would leave.
// They never change the score. Each note quotes the part of your attempt it's about.
//   kind 'nice'    good practice worth keeping
//   kind 'improve' something worth changing next time
// Hand-written rules cover common SQL habits; Claude adds notes for anything else (see App.loadNotes).

const RULES = [
  { re: /group\s+by[^;]*?\b\w+\.id\b/i, kind: 'nice',
    text: 'Grouping by id as well as name keeps two people who share a name apart. Safer than grouping by name alone.' },
  { re: /group\s+by\s+\w+\.name\b(?![^;]*\.id\b)/i, kind: 'improve',
    text: "Grouping by name alone would merge two people who share a name into one row. Group by the id too (e.g. GROUP BY a.id, a.name); you don't need to select it." },
  { re: /select\b[^;]*?\b(\w+\.id)\b[^;]*?\bfrom\b/i, kind: 'improve', unlessTask: /\bid\b/i,
    text: "You selected id. You can join and group on a column without selecting it: SELECT only decides which columns show up. Keep it if you want it in the result." },
  { re: /count\s*\(\s*\*\s*\)/i, when: /left\s+join/i, kind: 'improve',
    text: "With a LEFT JOIN, COUNT(*) counts the empty (NULL) row as 1. COUNT of a column from the joined table, like COUNT(o.id), counts 0 for no matches." },
  { re: /order\s+by\s+\d+/i, kind: 'improve',
    text: 'ORDER BY a column number works, but naming the column (or its alias) reads better and survives reordering the SELECT.' },
  { re: /select\s+\*/i, kind: 'improve',
    text: "SELECT * returns every column. Naming the ones you need makes the result clearer and doesn't change when the table does." },
  { re: /coalesce\s*\(/i, kind: 'nice',
    text: 'COALESCE turns the NULL from an empty group into 0, so rows with no matches read as zero rather than blank.' },
];

export function ruleNotes(lang, attempt, task = '') {
  if (lang !== 'sql') return [];
  const out = [];
  for (const r of RULES) {
    const m = attempt.match(r.re);
    if (!m || (r.when && !r.when.test(attempt)) || (r.unlessTask && r.unlessTask.test(task))) continue;
    // A rule can capture just the part worth quoting (e.g. the selected id); otherwise quote the whole match.
    out.push({ kind: r.kind, quote: (m[1] || m[0]).replace(/\s+/g, ' ').trim().slice(0, 60), text: r.text });
  }
  return out;
}

// Claude's notes must quote the attempt; anything that doesn't is dropped rather than shown.
export function keepQuoted(notes, attempt) {
  const flat = attempt.replace(/\s+/g, ' ').toLowerCase();
  return (Array.isArray(notes) ? notes : [])
    .filter(n => n && (n.kind === 'nice' || n.kind === 'improve') && n.text && n.quote && flat.includes(String(n.quote).replace(/\s+/g, ' ').toLowerCase().trim()))
    .map(n => ({ kind: n.kind, quote: String(n.quote).trim().slice(0, 60), text: String(n.text).trim() }));
}
