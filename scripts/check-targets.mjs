// Checks every hand-written target: the expected answer must score 5/5, and each diagnosed mistake
// must be recognised by its own gap. Run: npm run test:targets
import { createServer } from 'vite';
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
    console.log(`${id}.${part}  expected → ${right.score}/5  ${right.worked}`);
    for (const d of c.diagnoses || []) {
      const g = await checkSql(c, strip(d.sql, w.before, w.after), w.before, w.after);
      console.log(`   diagnosis → ${g.score}/5  ${g.gap === d.gap ? 'matched its own gap' : 'MISMATCH: ' + g.gap}`);
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
console.log('--- framework: every target declares its three answers (research §8f)');
const all = { ...(await vite.ssrLoadModule('/src/targets.js')).SQL_TARGETS, ...(await vite.ssrLoadModule('/src/bookTargets.js')).BOOK_TARGETS, ...(await vite.ssrLoadModule('/src/junoTargets.js')).JUNO_TARGETS, ...(await vite.ssrLoadModule('/src/reactTargets.js')).REACT_TARGETS };
for (const [id, t] of Object.entries(all)) {
  const ok = typeof t.producingIsSkill === 'boolean' && typeof t.writtenOrderMatters === 'boolean' && (t.visual === null || ['compare', 'see', 'timeline'].includes(t.visual))
    && (!t.writtenOrderMatters || (t.assemble && t.assemble.lines.length >= 3)) && (t.visual !== 'compare' || t.compare);
  console.log(`${ok ? 'ok      ' : 'MISMATCH'} ${id}: producingIsSkill=${t.producingIsSkill} writtenOrderMatters=${t.writtenOrderMatters} visual=${t.visual}`);
}
await vite.close();
