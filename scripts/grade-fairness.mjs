// Grading-fairness test: runs the app's own Claude grader (gradeAttempt) on known attempts,
// 3 times each, and compares with the score each attempt deserves. For the SQL task it also shows
// what execution (sqlCheck) gives, to inform the execution-vs-Claude-vs-hybrid decision.
// Needs the dev server running (calls go through /api/claude, so cost shows in that terminal).
// Run: node scripts/grade-fairness.mjs
import { createServer } from 'vite';
const app = process.cwd();
globalThis.__SQL_WASM_PATH = app + '/node_modules/sql.js/dist/sql-wasm.wasm';
const realFetch = globalThis.fetch;
globalThis.fetch = (url, opts) =>
  realFetch(
    String(url).startsWith('/') ? 'http://localhost:5173' + url : url,
    opts,
  );
const vite = await createServer({
  root: app,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
const { gradeAttempt } = await vite.ssrLoadModule('/src/grading.js');
const { REACT: R } = await vite.ssrLoadModule('/src/scenarios.js');
const { SQL_TARGETS } = await vite.ssrLoadModule('/src/targets.js');
const { checkSql } = await vite.ssrLoadModule('/src/sqlCheck.js');
const EXTRA = `"worked": one sentence on what you got right, "gap": one sentence naming the specific unmet requirement (or "Nothing structural." only if every check is met), "revealLine": one sentence comparing your 3/5 prediction to the score, curious in tone, never judgmental, no claims about attempts or effort`;

const W = SQL_TARGETS.whole.write;
const sql = (o = {}) =>
  `SELECT ${o.al || 'a'}.name, ${o.noCoalesce ? `SUM(${o.bl || 'b'}.pages)` : `COALESCE(SUM(${o.bl || 'b'}.pages), 0)`} AS pages\nFROM ${o.authors || 'authors'} ${o.al || 'a'}\n${o.join || 'LEFT JOIN'} ${o.books || 'books'} ${o.bl || 'b'} ON ${o.bl || 'b'}.author_id = ${o.al || 'a'}.id${o.where ? '' : `\n  AND ${o.bl || 'b'}.status = 'published'`}\n${o.where ? `WHERE ${o.bl || 'b'}.status = 'published'\n` : ''}GROUP BY ${o.al || 'a'}.name\nORDER BY pages${o.noDesc ? '' : ' DESC'};`;
const react = R.writeRef;
const cases = [
  {
    id: 'sql: correct',
    deserves: 5,
    lang: 'sql',
    task: W.task,
    ref: W.check.expected,
    attempt: sql(),
    check: W.check,
  },
  {
    id: 'sql: typo "bok"',
    deserves: 5,
    lang: 'sql',
    task: W.task,
    ref: W.check.expected,
    attempt: sql({ books: 'bok' }),
    check: W.check,
  },
  {
    id: 'sql: other aliases',
    deserves: 5,
    lang: 'sql',
    task: W.task,
    ref: W.check.expected,
    attempt: sql({ al: 'au', bl: 'bk' }),
    check: W.check,
  },
  {
    id: 'sql: plain JOIN',
    deserves: 3,
    lang: 'sql',
    task: W.task,
    ref: W.check.expected,
    attempt: sql({ join: 'JOIN' }),
    check: W.check,
  },
  {
    id: 'sql: filter in WHERE',
    deserves: 3,
    lang: 'sql',
    task: W.task,
    ref: W.check.expected,
    attempt: sql({ where: true }),
    check: W.check,
  },
  {
    id: 'sql: no COALESCE',
    deserves: 3,
    lang: 'sql',
    task: W.task,
    ref: W.check.expected,
    attempt: sql({ noCoalesce: true }),
    check: W.check,
  },
  {
    id: 'sql: no DESC',
    deserves: 3,
    lang: 'sql',
    task: W.task,
    ref: W.check.expected,
    attempt: sql({ noDesc: true }),
    check: W.check,
  },
  {
    id: 'react: correct',
    deserves: 5,
    lang: 'jsx',
    task: R.writeTask,
    ref: R.writeRef,
    attempt: react,
  },
  {
    id: 'react: no stale guard',
    deserves: 3,
    lang: 'jsx',
    task: R.writeTask,
    ref: R.writeRef,
    attempt: react
      .replace('    const controller = new AbortController();\n', '')
      .replace(', { signal: controller.signal }', '')
      .replace(
        "      .catch(err => { if (err.name !== 'AbortError') throw err; });\n",
        '',
      )
      .replace('    return () => controller.abort();\n', ''),
  },
  {
    id: 'react: deps [] not [slug]',
    deserves: 3,
    lang: 'jsx',
    task: R.writeTask,
    ref: R.writeRef,
    attempt: react.replace('}, [slug]);', '}, []);'),
  },
];

const RUNS = 3;
const rows = [];
for (const c of cases) {
  const scores = await Promise.all(
    Array.from({ length: RUNS }, () =>
      gradeAttempt(c.task, c.ref, c.attempt, c.lang, EXTRA)
        .then(g => g.score)
        .catch(e => 'err:' + e.message.slice(0, 30)),
    ),
  );
  const exec = c.check ? (await checkSql(c.check, c.attempt)).score : '–';
  rows.push({ ...c, scores, exec });
  const fair = scores.every(s => s === c.deserves);
  console.log(
    `${c.id.padEnd(26)} deserves ${c.deserves} · Claude ${scores.join(', ')} · execution ${exec}  ${fair ? 'fair' : '← CHECK'}`,
  );
}
const all = rows.flatMap(r => r.scores.map(s => s === r.deserves));
const consistent = rows.filter(r => new Set(r.scores).size === 1).length;
console.log(
  `\nClaude matched the deserved score in ${all.filter(Boolean).length}/${all.length} gradings; same score on all ${RUNS} runs for ${consistent}/${rows.length} attempts.`,
);
const ex = rows.filter(r => r.exec !== '–');
console.log(
  `Execution matched the deserved score in ${ex.filter(r => r.exec === r.deserves).length}/${ex.length} SQL attempts.`,
);
await vite.close();
