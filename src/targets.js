// Learning targets: the framework every Own-it step reads from.
//
// When the learner picks what they want to own, that choice resolves to one target spec.
// Each step reads its own part of the spec, so no step has to guess what is being learned:
//
//   label     what the learner said they want to own
//   kind      'concept'   choosing between alternatives  → read · compare · write
//             'sequence'  composing parts in order        → read · see · assemble · write
//   explain   Read it: mental model, the one dimension the alternatives differ on, why it fits
//             the learner's own query, a rule of thumb. No results: Compare asks for those.
//   compare   Compare it: the alternatives run on the same data; the learner predicts each first
//   write     Write it: a NEW situation where the target decides the answer. Everything that
//             isn't the target is given (before/after), so the reveal measures only the target.
//   delayed   "3 days later": a second transfer task on the same target
//   check     how an attempt is scored. type 'sql' runs it (see sqlCheck.js); `diagnoses` are
//             the classic wrong answers, recognised by their result rows, each with its own gap.
//
// The SQL starter's targets are written by hand, so they are reliably correct. For anything else
// Claude fills the same fields (see App.jsx: loadConcept, loadCompare, loadWriteTask).

// ---- data: one schema shared by Compare, Write it and the checker -------------------------
// customers/orders: Ada has a paid and a refunded order, Bo one paid, Cy only a refunded one,
// Dee none, and orders 5 and 6 belong to a deleted customer (id 9). Every join differs.
export const CUSTOMERS = [[1, 'Ada'], [2, 'Bo'], [3, 'Cy'], [4, 'Dee']];
export const ORDERS = [[1, 1, 320, 'paid'], [2, 1, 140, 'refunded'], [3, 2, 150, 'paid'], [4, 3, 90, 'refunded'], [5, 9, 80, 'paid'], [6, 9, 60, 'paid']];
// authors/books, for the whole-query task: Cal has only a draft, so he must show up with 0.
export const AUTHORS = [[1, 'Ann'], [2, 'Ben'], [3, 'Cal'], [4, 'Dot']];
export const BOOKS = [[1, 1, 320, 'published'], [2, 1, 180, 'published'], [3, 2, 240, 'published'], [4, 2, 90, 'draft'], [5, 3, 150, 'draft'], [6, 4, 60, 'published']];

const lit = v => typeof v === 'number' ? String(v) : `'${v}'`;
const insert = (table, rows) => `INSERT INTO ${table} VALUES ${rows.map(r => `(${r.map(lit).join(', ')})`).join(', ')};`;
export const SCHEMA_SQL = [
  'CREATE TABLE customers (id INTEGER, name TEXT);',
  'CREATE TABLE orders (id INTEGER, customer_id INTEGER, total INTEGER, status TEXT);',
  'CREATE TABLE authors (id INTEGER, name TEXT);',
  'CREATE TABLE books (id INTEGER, author_id INTEGER, pages INTEGER, status TEXT);',
  insert('customers', CUSTOMERS), insert('orders', ORDERS), insert('authors', AUTHORS), insert('books', BOOKS),
].join('\n');

const SHOP_SCHEMA = 'customers(id, name)\norders(id, customer_id, total, status)   -- status is \'paid\' or \'refunded\'';

// ---- compare: computed in JS so the visual never depends on the SQL engine loading ---------
const NULL = 'NULL';
const HEADERS = ['c.name', 'o.id', 'o.total', 'o.status'];
function join(type, { onExtra = () => true, where = () => true } = {}) {
  const custs = CUSTOMERS.map(([id, name]) => ({ id, name }));
  const ords = ORDERS.map(([id, cid, total, status]) => ({ id, cid, total, status }));
  const match = (c, o) => o.cid === c.id && onExtra(o);
  const rows = [];
  if (type === 'right') {
    for (const o of ords) {
      const cs = custs.filter(c => match(c, o));
      if (cs.length) cs.forEach(c => rows.push({ c, o })); else rows.push({ c: null, o });
    }
  } else {
    for (const c of custs) {
      const os = ords.filter(o => match(c, o));
      if (os.length) os.forEach(o => rows.push({ c, o }));
      else if (type === 'left') rows.push({ c, o: null });
    }
  }
  return rows.filter(r => where(r.o)).map(r => [r.c ? r.c.name : NULL, r.o ? r.o.id : NULL, r.o ? '$' + r.o.total : NULL, r.o ? r.o.status : NULL]);
}
const SOURCE = {
  customers: { headers: ['id', 'name'], rows: CUSTOMERS.map(r => r.map(String)) },
  orders: { headers: ['id', 'customer_id', 'total', 'status'], rows: ORDERS.map(([id, cid, total, status]) => [String(id), String(cid), '$' + total, status]) },
};
const kept = t => ({ t, strong: true }); // emphasised grid cell

// ---- the targets ------------------------------------------------------------------------------
export const SQL_TARGETS = {
  joins: {
    label: 'When to use LEFT vs INNER vs RIGHT JOIN', kind: 'concept',
    // The Own-it framework (research §8f): three answers decide the steps.
    producingIsSkill: true, writtenOrderMatters: false, visual: 'compare',
    explain: {
      model: "A join pairs rows that match. The join type only decides what happens to the rows that don't match.",
      grid: { headers: ['', 'unmatched customers', 'unmatched orders'], rows: [
        ['INNER JOIN', 'dropped', 'dropped'],
        ['LEFT JOIN', kept('kept, with NULLs'), 'dropped'],
        ['RIGHT JOIN', 'dropped', kept('kept, with NULLs')],
      ] },
      inYourCode: "You asked for customers who haven't bought anything to still show up with $0. So customers is the table that must keep every row: it comes first, and the join is LEFT.",
      rule: "Ask which table must keep every row. Put it first and use LEFT JOIN. RIGHT JOIN is the same thing with the tables swapped, which is why it's rarely written.",
    },
    compare: {
      intro: 'Same two tables, three joins. Before each result appears, guess how many rows come back.',
      source: SOURCE,
      cases: [
        { label: 'INNER JOIN', code: 'FROM customers c\nJOIN orders o ON o.customer_id = c.id', headers: HEADERS, rows: join('inner'),
          note: 'Only pairs that match on both sides. Dee has no orders and orders 5 and 6 have no customer, so all three disappear.' },
        { label: 'LEFT JOIN', code: 'FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id', headers: HEADERS, rows: join('left'),
          note: 'Every customer stays, matched or not. Dee comes back with NULLs. The orphan orders are still gone: LEFT only protects the left table.' },
        { label: 'RIGHT JOIN', code: 'FROM customers c\nRIGHT JOIN orders o ON o.customer_id = c.id', headers: HEADERS, rows: join('right'),
          note: 'The mirror image: every order stays, so orders 5 and 6 appear with a NULL customer, and Dee is gone again. Most people write it as a LEFT JOIN with the tables swapped.' },
      ],
    },
    // The transfer: this time ORDERS must keep every row. Copying "customers first" gets it wrong.
    write: {
      task: "Now a new situation: list every order with its customer's name, including orders whose customer was deleted. Write the FROM and JOIN.",
      schema: SHOP_SCHEMA + '\nUse the aliases o and c.',
      before: 'SELECT o.id, o.total, c.name', after: ';', placeholder: 'FROM …\n… JOIN … ON …',
      hints: ['This time, which table has to keep every one of its rows?', 'Put that table right after FROM.', 'Which join keeps every row of the first table, even when nothing matches?'],
      check: { type: 'sql', expected: 'SELECT o.id, o.total, c.name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id', diagnoses: [
        { sql: 'SELECT o.id, o.total, c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id',
          gap: 'You kept every customer, but this time every order has to stay. Orders 5 and 6 (deleted customer) are missing, and Dee shows up with no order. Which table must keep every row here?' },
        { sql: 'SELECT o.id, o.total, c.name FROM orders o JOIN customers c ON c.id = o.customer_id',
          gap: 'Orders 5 and 6 are missing: their customer was deleted, so an inner join has nothing to pair them with and drops them.' },
      ] },
    },
    delayed: {
      task: 'From memory: the names of customers who have never placed an order. Write the FROM and JOIN.',
      schema: SHOP_SCHEMA, before: 'SELECT c.name', after: 'WHERE o.id IS NULL;', placeholder: 'FROM …\n… JOIN … ON …',
      check: { type: 'sql', expected: 'SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL', diagnoses: [
        { sql: 'SELECT c.name FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL',
          gap: "No rows: this join only ever produces customers who have an order, so o.id is never NULL. Start from the table that must keep every row." },
      ] },
    },
  },

  onwhere: {
    label: "Why status = 'paid' goes in ON, not WHERE", kind: 'concept',
    producingIsSkill: true, writtenOrderMatters: false, visual: 'compare',
    explain: {
      model: 'ON decides which rows count as a match. WHERE runs afterwards and filters the joined result, including the NULL rows a LEFT JOIN added.',
      grid: { headers: ['', 'runs', "sees the LEFT JOIN's NULL rows?", "effect of status = 'paid'"], rows: [
        ['in ON', 'during the join', "no, they don't exist yet", kept('unpaid orders stop matching; the customer stays')],
        ['in WHERE', 'after the join', 'yes', "NULL = 'paid' is never true, so customers with no paid order are dropped"],
      ] },
      inYourCode: "You wanted customers with no paid orders to stay in the result at $0. With the filter in ON they stay; in WHERE they'd vanish.",
      rule: 'Filtering the right-hand table of a LEFT JOIN? Put it in ON. In WHERE it quietly turns the LEFT JOIN into an INNER JOIN.',
    },
    compare: {
      intro: 'The same LEFT JOIN with the paid filter in three places. Before each result appears, guess how many rows come back.',
      source: SOURCE,
      cases: [
        { label: 'No filter', code: 'FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id', headers: HEADERS, rows: join('left'),
          note: 'The baseline: every customer, with every order they have, refunded ones included.' },
        { label: "'paid' in ON", code: "FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\n  AND o.status = 'paid'", headers: HEADERS, rows: join('left', { onExtra: o => o.status === 'paid' }),
          note: "The filter decides what counts as a match. Refunded orders stop matching, but Cy and Dee still survive with NULLs because it's a LEFT JOIN." },
        { label: "'paid' in WHERE", code: "FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'", headers: HEADERS, rows: join('left', { where: o => !!o && o.status === 'paid' }),
          note: "WHERE runs after the join, on every row. Cy and Dee's rows have status NULL, and NULL = 'paid' is never true, so they're thrown out. The LEFT JOIN quietly became an INNER JOIN." },
      ],
    },
    // The transfer: a different status, so the learner has to place the filter, not copy it.
    write: {
      task: 'Now a new situation: list every customer with their refunded orders only. Customers with no refunded order should still appear, with NULLs. Write the FROM, JOIN and filter.',
      schema: SHOP_SCHEMA + '\nUse the aliases c and o.',
      before: 'SELECT c.name, o.id, o.total', after: ';', placeholder: 'FROM …\n… JOIN … ON …',
      hints: ['Which customers must survive even though they have no refunded order?', 'Where does a filter go if it should only decide what counts as a match?', 'Add the status check to the ON clause with AND.'],
      check: { type: 'sql', expected: "SELECT c.name, o.id, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'refunded'", diagnoses: [
        { sql: "SELECT c.name, o.id, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.status = 'refunded'",
          gap: 'Bo and Dee are missing. Either the join is INNER, or the refunded filter is in WHERE, which runs after the join and throws out their NULL rows.' },
        { sql: 'SELECT c.name, o.id, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id',
          gap: "Paid orders are in the result too: the refunded-only filter is missing." },
      ] },
    },
    delayed: {
      task: 'From memory: every customer with their paid orders only. Customers with no paid order should still be listed. Write the FROM, JOIN and filter.',
      schema: SHOP_SCHEMA, before: 'SELECT c.name, o.id', after: ';', placeholder: 'FROM …\n… JOIN … ON …',
      check: { type: 'sql', expected: "SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'", diagnoses: [
        { sql: "SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.status = 'paid'",
          gap: "Cy and Dee are missing: with the paid filter in WHERE (or an inner join), their NULL rows are thrown out after the join." },
      ] },
    },
  },

  // The whole query, as a sequence. No explain/compare: it uses the run-through and the puzzle.
  whole: {
    label: "The whole query: each part and why it's in that order", kind: 'sequence',
    // Written order (SELECT first) differs from execution order (FROM first): rebuilding it is the warm-up.
    producingIsSkill: true, writtenOrderMatters: true, visual: 'see',
    // Arrange: the lines of Claude's real answer, plus one decoy that is the classic mistake.
    assemble: { lines: ['SELECT c.id, c.name, COALESCE(SUM(o.total), 0) AS revenue', 'FROM customers c', 'LEFT JOIN orders o ON o.customer_id = c.id', "  AND o.status = 'paid'", 'GROUP BY c.id, c.name', 'ORDER BY revenue DESC;'], distractor: "WHERE o.status = 'paid'", why: "In one line: why does status = 'paid' live in ON rather than WHERE?" },
    write: {
      task: 'Now write a new one from scratch, same shape, different data: total pages per author from published books, most pages first. Authors with no published books should still appear with 0.',
      schema: "authors(id, name)\nbooks(id, author_id, pages, status)   -- status is 'published' or 'draft'",
      before: '', after: '', placeholder: 'SELECT …',
      hints: ['Which table do you start FROM if every author has to appear?', "Where does status = 'published' have to go so authors with no published books survive?", 'An author with no match gets a NULL sum. What turned NULL into 0 in the original?', 'Most pages first: which direction is the sort?'],
      check: { type: 'sql', orderMatters: true, expected: "SELECT a.name, COALESCE(SUM(b.pages), 0) AS pages FROM authors a LEFT JOIN books b ON b.author_id = a.id AND b.status = 'published' GROUP BY a.name ORDER BY pages DESC", diagnoses: [
        { sql: "SELECT a.name, SUM(b.pages) FROM authors a JOIN books b ON b.author_id = a.id AND b.status = 'published' GROUP BY a.name ORDER BY 2 DESC",
          gap: 'Cal is missing. He has no published books, so a plain JOIN (or the published filter in WHERE) drops him.' },
        { sql: "SELECT a.name, SUM(b.pages) AS pages FROM authors a LEFT JOIN books b ON b.author_id = a.id AND b.status = 'published' GROUP BY a.name ORDER BY pages DESC",
          gap: 'Cal shows NULL instead of 0: SUM over no rows is NULL. Wrap it in COALESCE(…, 0).' },
        { sql: 'SELECT a.name, COALESCE(SUM(b.pages), 0) FROM authors a LEFT JOIN books b ON b.author_id = a.id GROUP BY a.name ORDER BY 2 DESC',
          gap: "Draft pages are counted too (Ben's and Cal's drafts). Only published books should count." },
      ] },
    },
    delayed: {
      task: 'From memory: the names of customers who have no paid orders at all.',
      schema: SHOP_SCHEMA, before: '', after: '', placeholder: 'SELECT …',
      check: { type: 'sql', expected: "SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid' WHERE o.id IS NULL", diagnoses: [
        { sql: 'SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL',
          gap: "Only Dee: Cy has an order, but it's refunded. The paid filter belongs in ON, so Cy's refunded order doesn't count as a match." },
      ] },
    },
  },
};

// Which targets fit a selection from the SQL starter, most likely first.
// Hand-written options only when the selection is about one of them; [] otherwise.
export function sqlFocusOptions(selection) {
  const lines = selection.split('\n').filter(l => l.trim()).length;
  const opt = (id, label) => ({ label: label || SQL_TARGETS[id].label, mode: SQL_TARGETS[id].kind, target: id });
  if (lines >= 3) return [opt('whole'), opt('joins'), opt('onwhere')];
  if (/\bjoin\b/i.test(selection)) return [opt('joins'), opt('onwhere'), opt('joins', 'The join syntax itself')];
  if (/paid|status/i.test(selection)) return [opt('onwhere'), opt('joins')];
  // No hand-written target covers this part (e.g. ORDER BY): return nothing, and let the caller
  // generate options about what was actually highlighted rather than offer unrelated ones.
  return [];
}
