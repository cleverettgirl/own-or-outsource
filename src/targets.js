// Learning targets: the framework every Own-it step reads from.
//
// When the learner picks what they want to own, that choice resolves to one target spec.
// Each step reads its own part of the spec, so no step has to guess what is being learned:
//
//   label     what the learner said they want to own
//   kind      'concept'   choosing between alternatives  → write
//             'sequence'  composing parts in order        → assemble · write
//   write     Write it: a NEW situation where the target decides the answer. Everything that
//             isn't the target is given (before/after), so the reveal measures only the target.
//   delayed   "3 days later": a second transfer task on the same target
//   check     how an attempt is scored. type 'sql' runs it (see sqlCheck.js); `diagnoses` are
//             the classic wrong answers, recognised by their result rows, each with its own gap.
//
// The SQL starter's targets are written by hand, so they are reliably correct. For anything else
// Claude fills the same fields (see App.jsx: loadWriteTask).

// ---- data: one schema shared by Write it and the checker -------------------------
// customers/orders: Ada has a paid and a refunded order, Bo one paid, Cy only a refunded one,
// Dee none, and orders 5 and 6 belong to a deleted customer (id 9). Every join differs.
const CUSTOMERS = [
  [1, 'Ada'],
  [2, 'Bo'],
  [3, 'Cy'],
  [4, 'Dee'],
];
const ORDERS = [
  [1, 1, 320, 'paid'],
  [2, 1, 140, 'refunded'],
  [3, 2, 150, 'paid'],
  [4, 3, 90, 'refunded'],
  [5, 9, 80, 'paid'],
  [6, 9, 60, 'paid'],
];
// authors/books, for the whole-query task: Cal has only a draft, so he must show up with 0.
const AUTHORS = [
  [1, 'Ann'],
  [2, 'Ben'],
  [3, 'Cal'],
  [4, 'Dot'],
];
const BOOKS = [
  [1, 1, 320, 'published'],
  [2, 1, 180, 'published'],
  [3, 2, 240, 'published'],
  [4, 2, 90, 'draft'],
  [5, 3, 150, 'draft'],
  [6, 4, 60, 'published'],
];

const lit = v => (typeof v === 'number' ? String(v) : `'${v}'`);
const insert = (table, rows) =>
  `INSERT INTO ${table} VALUES ${rows.map(r => `(${r.map(lit).join(', ')})`).join(', ')};`;
export const SCHEMA_SQL = [
  'CREATE TABLE customers (id INTEGER, name TEXT);',
  'CREATE TABLE orders (id INTEGER, customer_id INTEGER, total INTEGER, status TEXT);',
  'CREATE TABLE authors (id INTEGER, name TEXT);',
  'CREATE TABLE books (id INTEGER, author_id INTEGER, pages INTEGER, status TEXT);',
  insert('customers', CUSTOMERS),
  insert('orders', ORDERS),
  insert('authors', AUTHORS),
  insert('books', BOOKS),
].join('\n');

const SHOP_SCHEMA =
  "customers(id, name)\norders(id, customer_id, total, status)   -- status is 'paid' or 'refunded'";

// ---- items: what each SQL try asks for, tested on the rows the learner's query returns ----------------
// Rows are tested by the values in them, so column order and aliases don't matter. owned marks the item that
// is the idea the learner came to own; the reveal leads with it (sqlCheck.js). topic names the item before the try
// without giving it away ("who appears", not "every author appears, even Cal"): the predict screen lists topics.
export const has = (rows, v) => rows.some(r => r.includes(v));
export const rowWith = (rows, v) => rows.find(r => r.includes(v));
const num = r => {
  const c = r.find(x => /^-?\d+(\.\d+)?$/.test(x));
  return c == null ? -Infinity : Number(c);
};
// Sorted biggest first by the row's number (NULL counts as smallest, as SQLite sorts it with DESC).
const descending = rows =>
  rows.every((r, i) => i === 0 || num(rows[i - 1]) >= num(r));

// ---- the targets ------------------------------------------------------------------------------
export const SQL_TARGETS = {
  joins: {
    label: 'When to use LEFT vs INNER vs RIGHT JOIN',
    kind: 'concept',
    writtenOrderMatters: false,
    // The transfer: this time ORDERS must keep every row. Copying "customers first" gets it wrong.
    write: {
      task: "Now a new situation: list every order with its customer's name, including orders whose customer was deleted. Write the FROM and JOIN.",
      schema: SHOP_SCHEMA + '\nUse the aliases o and c.',
      before: 'SELECT o.id, o.total, c.name',
      after: ';',
      placeholder: 'FROM …\n… JOIN … ON …',
      hints: [
        'This time, which table has to keep every one of its rows?',
        'Put that table right after FROM.',
        'Which join keeps every row of the first table, even when nothing matches?',
      ],
      check: {
        type: 'sql',
        expected:
          'SELECT o.id, o.total, c.name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id',
        items: [
          {
            short: 'Every order is listed, even 5 and 6 (customer deleted)',
            topic: 'which orders are listed',
            owned: true,
            test: rows => has(rows, '5') && has(rows, '6'),
          },
          {
            short: 'No rows for customers without an order (no Dee)',
            topic: 'which customers show up',
            test: rows => !has(rows, 'Dee'),
          },
        ],
        diagnoses: [
          {
            sql: 'SELECT o.id, o.total, c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id',
            gap: 'You kept every customer, but this time every order has to stay. Orders 5 and 6 (deleted customer) are missing, and Dee shows up with no order. Which table must keep every row here?',
          },
          {
            sql: 'SELECT o.id, o.total, c.name FROM orders o JOIN customers c ON c.id = o.customer_id',
            gap: 'Orders 5 and 6 are missing: their customer was deleted, so an inner join has nothing to pair them with and drops them.',
          },
        ],
      },
    },
    delayed: {
      task: 'From memory: the names of customers who have never placed an order. Write the FROM and JOIN.',
      schema: SHOP_SCHEMA,
      before: 'SELECT c.name',
      after: 'WHERE o.id IS NULL;',
      placeholder: 'FROM …\n… JOIN … ON …',
      check: {
        type: 'sql',
        expected:
          'SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL',
        items: [
          {
            short: 'Finds Dee, who has never ordered',
            topic: 'who has never ordered',
            owned: true,
            test: rows => has(rows, 'Dee'),
          },
          {
            short: 'Lists no one who has ordered',
            topic: 'who is left out',
            test: rows => rows.length > 0 && rows.every(r => r.includes('Dee')),
          },
        ],
        diagnoses: [
          {
            sql: 'SELECT c.name FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL',
            gap: 'No rows: this join only ever produces customers who have an order, so o.id is never NULL. Start from the table that must keep every row.',
          },
        ],
      },
    },
  },

  onwhere: {
    label: "Why status = 'paid' goes in ON, not WHERE",
    kind: 'concept',
    // The label is tied to this example; a new question that needs it (You go first) names the idea in general.
    idea: 'Filtering in ON vs WHERE with a LEFT JOIN',
    writtenOrderMatters: false,
    // The transfer: a different status, so the learner has to place the filter, not copy it.
    write: {
      task: 'Now a new situation: list every customer with their refunded orders only. Customers with no refunded order should still appear, with NULLs. Write the FROM, JOIN and filter.',
      schema: SHOP_SCHEMA + '\nUse the aliases c and o.',
      before: 'SELECT c.name, o.id, o.total',
      after: ';',
      placeholder: 'FROM …\n… JOIN … ON …',
      hints: [
        'Which customers must survive even though they have no refunded order?',
        'Where does a filter go if it should only decide what counts as a match?',
        'Add the status check to the ON clause with AND.',
      ],
      check: {
        type: 'sql',
        expected:
          "SELECT c.name, o.id, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'refunded'",
        items: [
          {
            short: 'Customers with no refunded order still appear (Bo, Dee)',
            topic: 'which customers appear',
            owned: true,
            test: rows => has(rows, 'Bo') && has(rows, 'Dee'),
          },
          {
            short: 'Only refunded orders are listed',
            topic: 'which orders are listed',
            test: rows => !has(rows, '1') && !has(rows, '3'),
          },
        ],
        diagnoses: [
          {
            sql: "SELECT c.name, o.id, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.status = 'refunded'",
            gap: 'Bo and Dee are missing. Either the join is INNER, or the refunded filter is in WHERE, which runs after the join and throws out their NULL rows.',
            byText: [
              {
                re: /\bwhere\b[^;]*refunded/i,
                gap: "Bo and Dee are missing. The refunded filter is in WHERE, which runs after the join: their rows have status NULL there, NULL = 'refunded' isn't true, so WHERE throws them out. In ON, it would only decide what counts as a match.",
              },
              {
                re: /^(?![\s\S]*\bleft\b)[\s\S]*\bjoin\b/i,
                gap: 'Bo and Dee are missing. A plain (inner) JOIN keeps only customers with a matching refunded order, so they drop out. A LEFT JOIN keeps every customer.',
              },
            ],
          },
          {
            sql: 'SELECT c.name, o.id, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id',
            gap: 'Paid orders are in the result too: the refunded-only filter is missing.',
          },
        ],
      },
    },
    delayed: {
      task: 'From memory: every customer with their paid orders only. Customers with no paid order should still be listed. Write the FROM, JOIN and filter.',
      schema: SHOP_SCHEMA,
      before: 'SELECT c.name, o.id',
      after: ';',
      placeholder: 'FROM …\n… JOIN … ON …',
      check: {
        type: 'sql',
        expected:
          "SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'",
        items: [
          {
            short: 'Customers with no paid order still appear (Cy, Dee)',
            topic: 'which customers appear',
            owned: true,
            test: rows => has(rows, 'Cy') && has(rows, 'Dee'),
          },
          {
            short: 'Only paid orders are listed',
            topic: 'which orders are listed',
            test: rows => !has(rows, '2') && !has(rows, '4'),
          },
        ],
        diagnoses: [
          {
            sql: "SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.status = 'paid'",
            gap: 'Cy and Dee are missing: with the paid filter in WHERE (or an inner join), their NULL rows are thrown out after the join.',
          },
        ],
      },
    },
  },

  // The whole query, as a sequence.
  whole: {
    label: "The whole query: each part and why it's in that order",
    kind: 'sequence',
    // Written order (SELECT first) differs from execution order (FROM first): rebuilding it is the warm-up.
    writtenOrderMatters: true,
    // Arrange: the lines of Claude's real answer, plus one decoy that is the classic mistake.
    assemble: {
      lines: [
        'SELECT c.id, c.name, COALESCE(SUM(o.total), 0) AS revenue',
        'FROM customers c',
        'LEFT JOIN orders o ON o.customer_id = c.id',
        "  AND o.status = 'paid'",
        'GROUP BY c.id, c.name',
        'ORDER BY revenue DESC;',
      ],
      distractor: "WHERE o.status = 'paid'",
      why: "In one line: why does status = 'paid' live in ON rather than WHERE?",
    },
    write: {
      task: 'Now write a new one from scratch, same shape, different data: total pages per author from published books, most pages first. Authors with no published books should still appear with 0.',
      schema:
        "authors(id, name)\nbooks(id, author_id, pages, status)   -- status is 'published' or 'draft'",
      before: '',
      after: '',
      placeholder: 'SELECT …',
      hints: [
        'Which table do you start FROM if every author has to appear?',
        "Where does status = 'published' have to go so authors with no published books survive?",
        'An author with no match gets a NULL sum. What turned NULL into 0 in the original?',
        'Most pages first: which direction is the sort?',
      ],
      check: {
        type: 'sql',
        orderMatters: true,
        expected:
          "SELECT a.name, COALESCE(SUM(b.pages), 0) AS pages FROM authors a LEFT JOIN books b ON b.author_id = a.id AND b.status = 'published' GROUP BY a.name ORDER BY pages DESC",
        items: [
          {
            short: 'Every author appears, even Cal (no published books)',
            topic: 'who appears',
            owned: true,
            test: rows => ['Ann', 'Ben', 'Cal', 'Dot'].every(n => has(rows, n)),
          },
          {
            short: 'An empty total shows 0, not NULL',
            topic: 'what an empty total shows',
            test: rows => !has(rows, 'NULL'),
          },
          {
            short: "Only published pages count (Ben's is 240)",
            topic: 'which pages count',
            test: rows =>
              !!rowWith(rows, 'Ben') && rowWith(rows, 'Ben').includes('240'),
          },
          {
            short: 'Most pages first',
            topic: 'the sort order',
            test: descending,
          },
        ],
        diagnoses: [
          {
            sql: "SELECT a.name, SUM(b.pages) FROM authors a JOIN books b ON b.author_id = a.id AND b.status = 'published' GROUP BY a.name ORDER BY 2 DESC",
            gap: 'Cal is missing. He has no published books, so a plain JOIN (or the published filter in WHERE) drops him.',
          },
          {
            sql: "SELECT a.name, SUM(b.pages) AS pages FROM authors a LEFT JOIN books b ON b.author_id = a.id AND b.status = 'published' GROUP BY a.name ORDER BY pages DESC",
            gap: 'Cal shows NULL instead of 0: SUM over no rows is NULL. Wrap it in COALESCE(…, 0).',
          },
          {
            sql: 'SELECT a.name, COALESCE(SUM(b.pages), 0) FROM authors a LEFT JOIN books b ON b.author_id = a.id GROUP BY a.name ORDER BY 2 DESC',
            gap: "Draft pages are counted too (Ben's and Cal's drafts). Only published books should count.",
          },
        ],
      },
    },
    delayed: {
      task: 'From memory: the names of customers who have no paid orders at all.',
      schema: SHOP_SCHEMA,
      before: '',
      after: '',
      placeholder: 'SELECT …',
      check: {
        type: 'sql',
        expected:
          "SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid' WHERE o.id IS NULL",
        items: [
          {
            short: 'Cy counts as no paid orders (only a refunded one)',
            topic: 'who counts as having no paid orders',
            owned: true,
            test: rows => has(rows, 'Cy'),
          },
          {
            short: 'Dee (no orders at all) is listed',
            topic: 'who has no orders at all',
            test: rows => has(rows, 'Dee'),
          },
        ],
        diagnoses: [
          {
            sql: 'SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL',
            gap: "Only Dee: Cy has an order, but it's refunded. The paid filter belongs in ON, so Cy's refunded order doesn't count as a match.",
          },
        ],
      },
    },
  },
};

// Which targets fit a selection from the SQL starter, most likely first.
// Hand-written options only when the selection is about one of them; [] otherwise.
export function sqlFocusOptions(selection) {
  const lines = selection.split('\n').filter(l => l.trim()).length;
  const opt = (id, label) => ({
    label: label || SQL_TARGETS[id].label,
    mode: SQL_TARGETS[id].kind,
    target: id,
  });
  if (lines >= 3) return [opt('whole'), opt('joins'), opt('onwhere')];
  // Talk of filtering (WHERE, the paid condition) points at ON vs WHERE even when the sentence also says "join".
  if (/paid|status|\bwhere\b/i.test(selection))
    return [opt('onwhere'), opt('joins')];
  if (/\bjoin\b/i.test(selection))
    return [
      opt('joins'),
      opt('onwhere'),
      opt('joins', 'The join syntax itself'),
    ];
  // No hand-written target covers this part (e.g. ORDER BY): return nothing, and let the caller
  // generate options about what was actually highlighted rather than offer unrelated ones.
  return [];
}
