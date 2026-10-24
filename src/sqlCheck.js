// Scores a SQL attempt by running it, not by asking a model. Each check gets a fresh in-memory
// SQLite database (sql.js), so nothing a learner types can affect another check.
import initSqlJs from 'sql.js';
// Browsers get sql.js's browser build (package "exports"), so serve the .wasm that pairs with it.
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { SCHEMA_SQL } from './targets.js';

let sqlPromise;
// globalThis.__SQL_WASM_PATH lets the Node smoke test point at the .wasm file on disk.
const loadSql = () => (sqlPromise ||= initSqlJs({ locateFile: () => globalThis.__SQL_WASM_PATH || wasmUrl }));

// What each score means. Shown on the reveal so a number always comes with its reason.
export const SQL_SCALE = '5 right rows · 3 runs, wrong rows · 2 doesn\'t run · 1 nothing yet';
const WHY = {
  5: 'It runs and returns exactly the rows the task asks for.',
  3: "It runs, but the rows it returns aren't the ones the task asks for.",
  2: "It doesn't run yet, so there are no rows to check.",
  1: "There's nothing to run yet.",
};

function result(db, sql) {
  const results = db.exec(sql);
  const last = results[results.length - 1];
  return { cols: last ? last.columns : [], rows: last ? last.values.map(r => r.map(v => (v === null ? 'NULL' : String(v)))) : [] };
}
// Column names and column order don't matter, values do: each row compares as a sorted bag of values.
const key = row => row.slice().sort().join('\u0001');
const sameBag = (a, b) => a.length === b.length && a.map(key).sort().join('\n') === b.map(key).sort().join('\n');
const sameSeq = (a, b) => a.length === b.length && a.every((r, i) => key(r) === key(b[i]));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---- typo forgiveness: the target is the concept, not the spelling ------------------------
const KEYWORDS = ['SELECT', 'FROM', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'ON', 'AND', 'OR', 'NOT', 'WHERE', 'GROUP', 'BY', 'ORDER', 'HAVING', 'DESC', 'ASC', 'AS', 'IS', 'NULL', 'IN', 'LIKE', 'LIMIT', 'DISTINCT', 'COALESCE', 'SUM', 'COUNT', 'AVG', 'MIN', 'MAX'];
// Edit distance where swapping two neighbouring letters counts as one edit ("cusotmres" → "customers" is 2).
function distance(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
// The nearest known name, if the word is plausibly a slip for it: up to 2 edits ("bok" → "books" is a
// dropped letter plus the plural), or a singular/plural/prefix of it. Ties mean "can't tell", so no guess.
function closest(word, candidates, maxEdits = 2) {
  const w = word.toLowerCase();
  const scored = candidates.map(c => {
    const cl = c.toLowerCase();
    const affix = w.length >= 3 && (cl.startsWith(w) || w.startsWith(cl)) && Math.abs(cl.length - w.length) <= 2;
    return { c, d: affix ? Math.min(1, distance(w, cl)) : distance(w, cl) };
  }).filter(x => x.d <= (w.length <= 2 ? 0 : maxEdits)).sort((a, b) => a.d - b.d);
  if (!scored.length || (scored[1] && scored[1].d === scored[0].d)) return null;
  return scored[0].c.toLowerCase() !== w ? scored[0].c : null;
}
function vocabulary(db) {
  const tables = result(db, "SELECT name FROM sqlite_master WHERE type = 'table'").rows.map(r => r[0]);
  const columns = [...new Set(tables.flatMap(t => result(db, `PRAGMA table_info(${t})`).rows.map(r => r[1])))];
  // Text values in the data ('paid', 'published'…), so a misspelled value in a filter can be recognised too.
  const values = [...new Set(tables.flatMap(t => result(db, `PRAGMA table_info(${t})`).rows.filter(r => /TEXT/i.test(r[2])).flatMap(r => result(db, `SELECT DISTINCT ${r[1]} FROM ${t}`).rows.map(x => x[0]))))].filter(v => v !== 'NULL');
  return { tables, columns, values };
}
// Runs the attempt; on an unknown table/column/keyword that is a near-miss, corrects it and retries.
function runForgiving(db, attempt, before, after) {
  const vocab = vocabulary(db), corrections = [];
  let text = attempt;
  for (const [lit, v] of [...attempt.matchAll(/'([^']*)'/g)].map(m => [m[0], m[1]])) {
    if (vocab.values.includes(v)) continue;
    const fix = closest(v, vocab.values);
    if (fix) { corrections.push({ from: v, to: fix }); text = text.split(lit).join(`'${fix}'`); }
  }
  for (let tries = 0; tries < 4; tries++) {
    try {
      return { res: result(db, [before, text, after].join('\n').replace(/;\s*;\s*$/, ';')), corrections, text };
    } catch (e) {
      const m = e.message;
      let word, fix;
      if ((word = (m.match(/no such table: (?:\w+\.)?(\w+)/) || [])[1])) fix = closest(word, vocab.tables);
      else if ((word = (m.match(/no such column: (?:\w+\.)?(\w+)/) || [])[1])) fix = closest(word, vocab.columns);
      else if ((word = (m.match(/near "(\w+)": syntax error/) || [])[1])) fix = closest(word, KEYWORDS, 1);
      // SQLite often points at the word AFTER a misspelled keyword ("LEFT JION customers c" fails near "c"),
      // so scan for a keyword near-miss. Skip known names, and aliases (the word right after a table name).
      if (!fix && /syntax error/.test(m)) {
        const known = new Set([...vocab.tables, ...vocab.columns, ...KEYWORDS].map(w => w.toLowerCase()));
        const words = text.match(/\w+/g) || [];
        for (let i = 0; i < words.length && !fix; i++) {
          const w = words[i];
          if (w.length < 3 || known.has(w.toLowerCase()) || (i > 0 && vocab.tables.includes(words[i - 1].toLowerCase()))) continue;
          const k = closest(w, KEYWORDS, 1);
          if (k) { word = w; fix = k; }
        }
      }
      if (!fix || !new RegExp(`\\b${word}\\b`, 'i').test(text)) return { error: m, corrections, text };
      corrections.push({ from: word, to: /^[A-Z]+$/.test(fix) && word === word.toLowerCase() ? fix.toLowerCase() : fix });
      text = text.replace(new RegExp(`\\b${word}\\b`, 'gi'), corrections[corrections.length - 1].to);
    }
  }
  return { error: 'Too many unknown names to correct.', corrections, text };
}

// ---- extra columns: returning more than asked (an id, say) isn't wrong, so line yours up with the expected ones ----
// Tries every ordered choice of k of your columns (k = expected columns) and keeps the one where the most
// rows match exactly, then the most cells. Small tables only, so the search is tiny.
function arrangements(n, k) {
  const out = [];
  const go = (pick) => { if (pick.length === k) { out.push(pick); return; } for (let i = 0; i < n; i++) if (!pick.includes(i)) go(pick.concat([i])); };
  go([]);
  return out;
}
function lineUp(got, expected) {
  const k = expected.cols.length, n = got.cols.length;
  if (n <= k || n > 8) return { got, dropped: [] };
  const exp = new Set(expected.rows.map(key));
  let best = null;
  for (const pick of arrangements(n, k)) {
    const rows = got.rows.map(r => pick.map(i => r[i]));
    const whole = rows.filter(r => exp.has(key(r))).length;
    const cells = rows.reduce((t, r, i) => t + (expected.rows[i] ? r.filter((c, j) => c === expected.rows[i][j]).length : 0), 0);
    if (!best || whole > best.whole || (whole === best.whole && cells > best.cells)) best = { pick, rows, whole, cells };
  }
  return { got: { cols: best.pick.map(i => got.cols[i]), rows: best.rows }, dropped: got.cols.filter((_, i) => !best.pick.includes(i)) };
}
// For a row of yours that isn't right, the expected row it's closest to (most equal cells), and which cells differ.
function nearest(row, candidates) {
  let best = null;
  for (const c of candidates) { const same = c.filter((v, j) => v === row[j]).length; if (same && (!best || same > best.same)) best = { row: c, same }; }
  return best && best.same >= row.length - 1 ? { row: best.row, diffs: row.map((v, j) => (v === best.row[j] ? -1 : j)).filter(j => j >= 0) } : null;
}

// What the task asks for, as separate items, each tested on the rows your query returns (column order doesn't
// matter: a row is tested by the values in it). The prediction counts the same items, so "you said 3, you got 2
// of 4" compares like with like, and the item the learner came to own is marked (owned: true).
// check.items: [{ short, owned?, test(rows) }]. Without items, the whole result is one item.
// rows null means the query didn't run: nothing could be checked, which isn't the same as getting it wrong.
function itemsFor(check, rows) {
  const spec = check.items && check.items.length ? check.items : [{ short: 'Returns the right rows', test: () => false }];
  return spec.map(it => ({ short: it.short, owned: !!it.owned, ok: !!rows && !!it.test(rows), unchecked: !rows }));
}

// SQLite's messages ("near "on": syntax error") point at where it gave up, not at the slip. The common slips,
// named in plain words; SQLite's own message is the fallback.
function explainError(message, text) {
  const t = text.replace(/\s+/g, ' ');
  if (/\bjoin\s+on\b/i.test(t)) return 'Your JOIN is missing the table it joins: the table name goes between JOIN and ON, e.g. “LEFT JOIN orders o ON …”.';
  if (/\bfrom\s+(left|right|inner|join|on|where)\b/i.test(t)) return 'FROM is missing its table: write the table name (and alias) right after FROM.';
  if (/\bon\b[^;]*\bwhere\s*(;|$)/i.test(t) || /\b(and|or|where|on)\s*;?\s*$/i.test(t)) return 'The query ends in the middle of a condition: finish the last AND / WHERE / ON.';
  if (/incomplete input/i.test(message)) return 'The query stops before it’s finished. Check the last line.';
  return '';
}

// check: { expected, orderMatters?, items?, diagnoses?: [{ sql, gap, byText?: [{ re, gap }] }] }; before/after wrap the learner's part.
// A diagnosis matches by result rows; byText then picks the wording for HOW they wrote it, when two different
// mistakes give the same rows (an inner join and a filter in WHERE both drop the same customers).
// Returns { score 1–5, why, worked, gap, corrections, table } — same core shape as the model grader,
// plus `table`: the learner's rows next to the expected rows, with the differences marked.
export async function checkSql(check, attempt, before = '', after = '') {
  if (attempt.trim().length < 4) return { score: 1, why: WHY[1], worked: '', gap: 'Write the missing part, then check it.', corrections: [], items: itemsFor(check, null) };
  const SQL = await loadSql();
  const db = new SQL.Database();
  try {
    db.run(SCHEMA_SQL);
    const expected = result(db, check.expected);
    const run = runForgiving(db, attempt, before, after);
    const corrections = run.corrections;
    if (run.error) {
      // The given lines use fixed aliases; renaming a table's alias breaks them with a confusing message.
      const alias = (run.error.match(/no such column: (\w+)\.\w+/) || [])[1];
      const aliasGap = alias && new RegExp(`\\b${alias}\\.`).test(before + after) && !new RegExp(`\\b\\w+\\s+(AS\\s+)?${alias}\\b`, 'i').test(run.text)
        ? `The given lines use the alias “${alias}.”, but no table in your part is called ${alias}. Give that table the alias ${alias}, as the task says, and it will run.` : '';
      const plain = explainError(run.error, run.text);
      return { score: 2, why: WHY[2], worked: '', gap: aliasGap || (plain ? `${plain} (SQLite says: “${run.error}”.)` : `SQLite says: “${run.error}”. Fix that and it will run.`), corrections, items: itemsFor(check, null), didntRun: true };
    }
    const lined = lineUp(run.res, expected), got = lined.got;
    const extraCols = lined.dropped.length ? ` You also returned ${lined.dropped.join(', ')}; extra columns don't affect the score.` : '';

    const exp = new Set(expected.rows.map(key)), have = new Set(got.rows.map(key));
    // Rows that are off by one cell are "almost": mark just that cell, on both sides, instead of the whole row.
    const missingRows = expected.rows.filter(r => !have.has(key(r)));
    const near = got.rows.map(r => (exp.has(key(r)) ? null : nearest(r, missingRows)));
    const nearFor = new Map(near.filter(Boolean).map(x => [x.row, x.diffs]));
    const table = {
      yours: { cols: got.cols, rows: got.rows.map((r, i) => ({ cells: r, mark: exp.has(key(r)) ? '' : near[i] ? 'near' : 'extra', diffs: near[i] ? near[i].diffs : [] })) },
      expected: { cols: expected.cols, rows: expected.rows.map(r => ({ cells: r, mark: have.has(key(r)) ? '' : nearFor.has(r) ? 'near' : 'missing', diffs: nearFor.get(r) || [] })) },
      dropped: lined.dropped,
    };
    const exactly = check.orderMatters ? sameSeq(got.rows, expected.rows) : sameBag(got.rows, expected.rows);
    const items = itemsFor(check, got.rows).map(it => exactly ? { ...it, ok: true } : it);
    const base = { corrections, table, items };
    // "Cal shows NULL where it should be 0": the plainest description of an almost-right row.
    const almost = near.map((x, i) => x && `${got.rows[i].find((v, j) => !x.diffs.includes(j))} shows ${x.diffs.map(j => got.rows[i][j]).join(', ')} where it should be ${x.diffs.map(j => x.row[j]).join(', ')}`).filter(Boolean);
    if (exactly)
      return { ...base, score: 5, why: WHY[5], worked: `It returns exactly the right ${plural(expected.rows.length, 'row')}.${extraCols}`, gap: '' };
    const ran = `It runs and returns ${plural(got.rows.length, 'row')}`;
    const rightRows = got.rows.filter(r => exp.has(key(r))).length;
    const held = `${ran}${rightRows ? `, ${rightRows} of them exactly right` : ''}.${extraCols}`;
    if (check.orderMatters && sameBag(got.rows, expected.rows))
      return { ...base, score: 3, why: 'It runs and returns the right rows, but in the wrong order.', worked: `${ran}, all the right ones.${extraCols}`, gap: 'Check the sort direction.' };
    for (const d of check.diagnoses || [])
      if (sameBag(got.rows, result(db, d.sql).rows)) {
        const said = (d.byText || []).find(b => b.re.test(run.text));
        return { ...base, score: 3, why: WHY[3], worked: held, gap: said ? said.gap : d.gap };
      }
    const missing = expected.rows.filter(r => !have.has(key(r))).length, extra = got.rows.filter(r => !exp.has(key(r))).length;
    const gap = [missing && `${plural(missing, 'expected row')} missing`, extra && `${plural(extra, 'row')} that shouldn't be there`].filter(Boolean).join(' and ');
    const overlap = got.rows.some(r => exp.has(key(r))) || almost.length > 0;
    const gapText = almost.length ? `Almost: ${almost.slice(0, 2).join('; ')}.${almost.length > 2 ? ` (${almost.length - 2} more like that.)` : ''} The highlighted cells below show where.` : `Compared with the expected result: ${gap}. The highlighted rows below show which.`;
    return { ...base, score: overlap ? 3 : 2, why: overlap ? WHY[3] : "It runs, but none of the rows it returns are right.", worked: held, gap: gapText };
  } finally {
    db.close();
  }
}
