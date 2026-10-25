// Checks every hand-written target: the expected answer must score 5/5 and pass every item, and each diagnosed
// mistake must be recognised by its own gap and fail at least one item. Run: npm run test:targets
import { createServer } from 'vite';

// Any MISMATCH line fails the run, so `npm test` can't pass with one.
const log = console.log;
console.log = (...a) => { if (a.some(x => String(x).includes('MISMATCH'))) process.exitCode = 1; log(...a); };
const app = process.cwd();
globalThis.__SQL_WASM_PATH = app + '/node_modules/sql.js/dist/sql-wasm.wasm';
const vite = await createServer({ root: app, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SQL_TARGETS } = await vite.ssrLoadModule('/src/targets.js');
const { checkSql } = await vite.ssrLoadModule('/src/sqlCheck.js');
// The learner writes only what sits between the scaffold's before and after parts.
const strip = (sql, before, after = '') => { let s = sql.replace(before, '').trim(); const tail = after.replace(/;\s*$/, '').trim(); return tail && s.endsWith(tail) ? s.slice(0, -tail.length).trim() : s; };
for (const [id, t] of Object.entries(SQL_TARGETS)) {
  for (const part of ['write', 'delayed']) {
    const w = t[part]; const c = w.check;
    const right = await checkSql(c, strip(c.expected, w.before, w.after), w.before, w.after);
    const tally = r => `${r.items.filter(i => i.ok).length} of ${r.items.length} items`;
    console.log(`${right.items.every(i => i.ok) && right.items.length >= 2 ? 'ok      ' : 'MISMATCH'} ${id}.${part}  expected → ${right.score}/5, ${tally(right)}`);
    for (const d of c.diagnoses || []) {
      const g = await checkSql(c, strip(d.sql, w.before, w.after), w.before, w.after);
      const own = g.gap === d.gap || (d.byText || []).some(b => b.gap === g.gap);
      const missed = g.items.filter(i => !i.ok).map(i => i.short);
      console.log(`${own && missed.length ? 'ok      ' : 'MISMATCH'}    diagnosis → ${g.score}/5, ${tally(g)} (missed: ${missed.join('; ') || 'none'})${own ? '' : ' · gap: ' + g.gap}`);
    }
  }
}
const syntax = await checkSql(SQL_TARGETS.joins.write.check, 'FROM orders o LEFT JOIN customer c ON', SQL_TARGETS.joins.write.before, ';');
console.log('syntax error →', syntax.score + '/5', syntax.gap);

// Typos are forgiven: near-miss table, column and keyword names are corrected and the query re-run.
console.log('--- typo forgiveness (joins.write)');
const jw = (await vite.ssrLoadModule('/src/targets.js')).SQL_TARGETS.joins.write;
for (const attempt of [
  'FROM orders o LEFT JOIN cusotmres c ON c.id = o.customer_id',
  'FROM orders o LEFT JION customers c ON c.id = o.customer_id',
  'FROM orders o LEFT JOIN customers c ON c.id = o.custmer_id',
  'FROM ordrs o LEFT JOIN cusotmres c ON c.id = o.customer_id',
  'FROM orders o LEFT JOIN people c ON c.id = o.customer_id',
  'FROM orders ord LEFT JOIN customers c ON c.id = ord.customer_id',
]) {
  const g = await checkSql(jw.check, attempt, jw.before, jw.after);
  console.log(`${g.score}/5  ${g.corrections.map(c => c.from + '→' + c.to).join(', ') || '(no corrections)'}  ${g.score < 5 ? g.gap : ''}`);
}
console.log('--- typo forgiveness (whole.write: short names, singulars, misspelled values)');
const ww = (await vite.ssrLoadModule('/src/targets.js')).SQL_TARGETS.whole.write;
const whole = t => `SELECT a.name, COALESCE(SUM(b.pages), 0) AS pages FROM ${t.a || 'authors'} a LEFT JOIN ${t.b || 'books'} b ON b.author_id = a.id AND b.status = '${t.v || 'published'}' GROUP BY a.name ORDER BY pages DESC`;
for (const t of [{ b: 'book' }, { b: 'bok' }, { a: 'author', b: 'book' }, { v: 'publish' }, { v: 'pubished' }, { v: 'draft' }]) {
  const g = await checkSql(ww.check, whole(t));
  console.log(`${g.score}/5  ${g.corrections.map(c => c.from + '→' + c.to).join(', ') || '(no corrections)'}  ${g.score < 5 ? g.gap.slice(0, 80) : ''}`);
}
console.log('--- extra columns and almost-right rows (whole.write)');
for (const q of [
  "SELECT a.id, a.name, SUM(b.pages) AS total_pages FROM authors a LEFT JOIN books b ON b.author_id = a.id AND b.status = 'published' GROUP BY a.id, a.name ORDER BY total_pages DESC",
  "SELECT a.id, a.name, COALESCE(SUM(b.pages), 0) AS total_pages FROM authors a LEFT JOIN books b ON b.author_id = a.id AND b.status = 'published' GROUP BY a.id, a.name ORDER BY total_pages DESC",
  "SELECT a.name, SUM(b.pages) AS total_pages, COUNT(b.id) AS n FROM authors a LEFT JOIN books b ON b.author_id = a.id AND b.status = 'published' GROUP BY a.name ORDER BY total_pages DESC",
]) { const g = await checkSql(ww.check, q); console.log(`${g.score}/5  ${g.worked}  ${g.gap}`); }
console.log('--- the WHERE mistake is named as itself, the inner join as itself (onwhere.write)');
const ow = SQL_TARGETS.onwhere.write;
for (const [q, want] of [["FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.status = 'refunded'", /in WHERE/], ["FROM customers c JOIN orders o ON o.customer_id = c.id AND o.status = 'refunded'", /plain \(inner\) JOIN/]]) {
  const g = await checkSql(ow.check, q, ow.before, ow.after);
  console.log(`${want.test(g.gap) && !/Either/.test(g.gap) ? 'ok      ' : 'MISMATCH'} ${g.gap.slice(0, 90)}…`);
}
console.log('--- syntax slips are named in plain words, and nothing is marked wrong when the query did not run (onwhere.write)');
for (const [q, want] of [
  ["from customers as c\nleft join on o.customer_id = c.id\nand o.status = 'refunded'", /JOIN is missing the table/], // Christine's real try
  ["FROM LEFT JOIN orders o ON o.customer_id = c.id", /FROM is missing its table/],
  ["FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND", /ends in the middle of a condition/],
]) {
  const g = await checkSql(ow.check, q, ow.before, ow.after);
  console.log(`${want.test(g.gap) && g.didntRun && g.items.every(i => i.unchecked && !i.ok) ? 'ok      ' : 'MISMATCH'} ${g.gap.slice(0, 100)}`);
}
console.log('--- go first (SQL): items');
const gf = (await vite.ssrLoadModule('/src/goFirst.js')).GO_FIRST.sql.check;
for (const q of [gf.expected, ...gf.diagnoses.map(d => d.sql)]) { const g = await checkSql(gf, q); console.log(`${g.score}/5  ${g.items.map(i => (i.ok ? '✓ ' : '✗ ') + i.short).join(' · ')}`); }
console.log('--- framework: every target declares whether its written order matters (research §8f)');
const all = { ...(await vite.ssrLoadModule('/src/targets.js')).SQL_TARGETS, ...(await vite.ssrLoadModule('/src/bookTargets.js')).BOOK_TARGETS, ...(await vite.ssrLoadModule('/src/junoTargets.js')).JUNO_TARGETS, ...(await vite.ssrLoadModule('/src/reactTargets.js')).REACT_TARGETS };
for (const [id, t] of Object.entries(all)) {
  const ok = typeof t.writtenOrderMatters === 'boolean' && (!t.writtenOrderMatters || (t.assemble && t.assemble.lines.length >= 3));
  console.log(`${ok ? 'ok      ' : 'MISMATCH'} ${id}: writtenOrderMatters=${t.writtenOrderMatters}`);
}
await vite.close();
