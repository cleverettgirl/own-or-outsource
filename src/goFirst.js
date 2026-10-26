// "You go first": once you've owned something, a later question that needs it doesn't get answered
// straight away. Claude offers you the first try, checks it, then shows its own answer. Or you say
// "just answer this time" (outsourcing, a fine choice), and the ledger notes which you picked.
//
// Each entry is a NEW question that needs what you owned (transfer, not repetition), with its own
// check of the same kinds as the targets: run (SQL), calculated (numbers), chosen (picks).
//   targets   which owned targets make this question come up
//   chip      the home-screen starter that appears once you own one of them
//   question  what "you" ask Claude
//   check     how your first try is scored; answer is what Claude shows after
//   before/after  code written for you around your part (as on the Own-it try)
//
// The question tests only the idea you own (log 112). Anything else it needs is written for you (before/after)
// or left out, so a slip on something you never owned can't count against what you did. One question per idea:
// a question shared by several ideas ends up testing some of them not at all, and others plus extras.

import { has, rowWith } from './targets.js';

export const GO_FIRST = {
  // LEFT vs INNER vs RIGHT: which table's unmatched rows survive. Orders 5 and 6 belong to no customer, so RIGHT
  // (and FULL) show up too, not just INNER.
  sqlJoins: {
    targets: ['joins'],
    chip: 'SQL · every customer and their orders',
    question:
      "Write me a SQL query: every customer with each of their orders. Customers with no orders should still appear (with NULLs); orders whose customer isn't in the customers table shouldn't.",
    lang: 'sql',
    task: 'The SELECT is written for you. Write the FROM and the JOIN.',
    schema:
      'customers(id, name)\norders(id, customer_id, total, status)\nUse the aliases c and o.',
    before: 'SELECT c.name, o.id',
    after: ';',
    placeholder: 'FROM …\n… JOIN … ON …',
    check: {
      type: 'sql',
      expected:
        'SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id',
      items: [
        {
          short: 'Every customer appears, even Dee (no orders)',
          topic: 'which customers appear',
          test: rows => ['Ada', 'Bo', 'Cy', 'Dee'].every(n => has(rows, n)),
        },
        {
          short: 'Orders with no customer are left out (orders 5 and 6)',
          topic: 'which orders appear',
          test: rows => !has(rows, '5') && !has(rows, '6'),
        },
      ],
      diagnoses: [
        {
          sql: 'SELECT c.name, o.id FROM customers c JOIN orders o ON o.customer_id = c.id',
          gap: 'Dee is missing: she has no orders, so an INNER JOIN drops her. LEFT JOIN keeps every row of the table on the left, customers.',
        },
        {
          sql: 'SELECT c.name, o.id FROM customers c RIGHT JOIN orders o ON o.customer_id = c.id',
          gap: 'Dee is missing, and orders 5 and 6 show with no customer: a RIGHT JOIN keeps every order. Customers are on the left, so LEFT JOIN keeps them instead.',
        },
        {
          sql: 'SELECT c.name, o.id FROM customers c FULL JOIN orders o ON o.customer_id = c.id',
          gap: 'Dee is there, but so are orders 5 and 6 with no customer: a FULL JOIN keeps the unmatched rows of both tables. Only the customers should all survive: LEFT JOIN.',
        },
      ],
    },
    answer: {
      intro:
        "Here's mine. Customers go on the left, and LEFT JOIN keeps every one of them, matched or not:",
      code: 'SELECT c.name, o.id\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id;',
      outro:
        'An INNER JOIN would drop Dee. A RIGHT JOIN would keep every order instead, so orders 5 and 6 would show with no customer, and Dee would go.',
    },
  },

  // ON vs WHERE: a different filter from the try (total, not status), so the learner places it, not copies it.
  sqlFilter: {
    targets: ['onwhere'],
    chip: 'SQL · customers and their big orders',
    question:
      'Write me a SQL query: every customer with their orders over 100 only. Customers with no order over 100 should still appear (with NULLs).',
    lang: 'sql',
    task: 'The SELECT is written for you. Write the FROM, the JOIN and the filter.',
    schema:
      'customers(id, name)\norders(id, customer_id, total, status)\nUse the aliases c and o.',
    before: 'SELECT c.name, o.id, o.total',
    after: ';',
    placeholder: 'FROM …\n… JOIN … ON …',
    check: {
      type: 'sql',
      expected:
        'SELECT c.name, o.id, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.total > 100',
      items: [
        {
          short: 'Customers with no order over 100 still appear (Cy, Dee)',
          topic: 'which customers appear',
          test: rows => has(rows, 'Cy') && has(rows, 'Dee'),
        },
        {
          short: 'Only orders over 100 are listed',
          topic: 'which orders are listed',
          test: rows =>
            !has(rows, '90') && !has(rows, '80') && !has(rows, '60'),
        },
      ],
      diagnoses: [
        {
          // The filter in WHERE and an INNER JOIN return the same rows, so what you wrote tells them apart.
          sql: 'SELECT c.name, o.id, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.total > 100',
          gap: 'Cy and Dee are missing. The filter is in WHERE, which runs after the join and throws out their NULL rows. Put it in ON with AND, so it only decides which orders count as a match.',
          byText: [
            {
              re: /^(?![\s\S]*\bleft\b)[\s\S]*\bjoin\b/i,
              gap: 'Cy and Dee are missing: an INNER JOIN drops customers with no match. Keep the filter in ON, and make it a LEFT JOIN.',
            },
          ],
        },
        {
          sql: 'SELECT c.name, o.id, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id',
          gap: "Everyone appears, but Cy's order of 90 is listed too: the over-100 filter is missing. Add it to the ON clause with AND.",
        },
      ],
    },
    answer: {
      intro:
        "Here's mine. The filter goes in ON, so it only decides which orders count as a match, and every customer survives the LEFT JOIN:",
      code: 'SELECT c.name, o.id, o.total\nFROM customers c\nLEFT JOIN orders o\n  ON o.customer_id = c.id AND o.total > 100;',
      outro:
        "In WHERE, the filter would run after the join and throw out Cy's and Dee's NULL rows, so they'd vanish.",
    },
  },

  // The whole query: counting was part of what was owned (Cal shows 0), so all three items are its own.
  sql: {
    targets: ['whole'],
    chip: 'SQL · orders per customer',
    question:
      'Write me a SQL query: the number of orders per customer, including customers with no orders (they should show 0).',
    lang: 'sql',
    schema: 'customers(id, name)\norders(id, customer_id, total, status)',
    placeholder: 'SELECT …',
    check: {
      type: 'sql',
      expected:
        'SELECT c.name, COUNT(o.id) FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.name',
      items: [
        {
          short: 'Every customer appears, even Dee',
          topic: 'who appears',
          test: rows => has(rows, 'Dee'),
        },
        {
          short: 'A customer with no orders counts 0, not 1',
          topic: 'what a customer with no orders counts',
          test: rows => !rows.some(r => r.includes('Dee') && !r.includes('0')),
        },
        {
          short: "Each customer's orders are counted (Ada has 2)",
          topic: "how each customer's orders are counted",
          test: rows =>
            !!rowWith(rows, 'Ada') && rowWith(rows, 'Ada').includes('2'),
        },
      ],
      diagnoses: [
        {
          sql: 'SELECT c.name, COUNT(*) FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.name',
          gap: 'So close: Dee shows 1 instead of 0. The LEFT JOIN gives Dee one row of NULLs, and COUNT(*) counts rows, so it counts that one. Count a column from orders instead, like COUNT(o.id): it skips NULLs.',
        },
        {
          sql: 'SELECT c.name, COUNT(o.id) FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.name',
          gap: 'Dee is missing: she has no orders, so a plain JOIN drops her. LEFT JOIN keeps every customer.',
        },
      ],
    },
    answer: {
      intro:
        "Here's mine. Start from customers so everyone appears, LEFT JOIN their orders, and count a column from orders:",
      code: 'SELECT c.name, COUNT(o.id) AS orders\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;',
      outro:
        'COUNT(o.id) rather than COUNT(*): a customer with no orders still gets one row of NULLs from the LEFT JOIN, and COUNT(*) would count it as 1.',
    },
  },

  // The Rule of Five: all three picks are about why the range catches the median and what breaks it.
  book: {
    targets: ['rule'],
    chip: 'Stats · 6 timed checkouts',
    question:
      'I timed 6 random checkout transactions at our store. How likely is it that the median checkout time for all customers is between my fastest and slowest one?',
    lang: 'statistics',
    prose: true,
    // Reasoning picks, not the percentage: the idea is "it only misses if every timing lands on one side", and the
    // classic one-sided slip (98.4%) sits closer to 96.875% than an honest rounding does, so a number can't tell
    // them apart (research §8f, invariant 3; the Rule of Five try and recall made the same change, log 42).
    check: {
      type: 'choice',
      questions: [
        {
          id: 'likely',
          short: 'how likely the range catches it',
          prompt:
            'How likely is it that the median checkout time for all customers is between your fastest and slowest timing?',
          answer: 'v97',
          options: [
            {
              v: 'v97',
              l: 'Very likely, about 97%: it misses only if all 6 land on one side',
            },
            {
              v: 'v100',
              l: 'Certain: a median always sits between the fastest and the slowest',
              gap: "That's true of your 6 timings' own median. The question is about all customers, whose median you can't see, and your 6 could all happen to land on one side of it.",
            },
            {
              v: 'v98',
              l: 'About 98%: it misses only if all 6 are slower than the median',
              gap: 'That counts one way to miss. All 6 could also be faster than the median: two ways, each 1 in 64, so about 97%.',
            },
          ],
        },
        {
          id: 'miss',
          short: 'when the range misses',
          prompt:
            'When would your fastest-to-slowest range miss the true median?',
          answer: 'oneside',
          options: [
            {
              v: 'oneside',
              l: 'Only when all 6 timings land on the same side of it',
            },
            {
              v: 'outlier',
              l: 'Whenever one of the 6 timings is unusually slow',
              gap: 'One slow timing just stretches the range. It misses only when every timing is on the same side of the median.',
            },
            {
              v: 'spread',
              l: 'Whenever the 6 timings are spread far apart',
              gap: 'A wide spread makes the range more likely to catch the median, not less.',
            },
          ],
        },
        {
          id: 'breaks',
          short: 'what breaks the bet',
          prompt: 'Which of these would make your range untrustworthy?',
          answer: 'rush',
          options: [
            { v: 'rush', l: 'You timed all 6 during the lunch rush' },
            {
              v: 'few',
              l: 'You timed only 6 checkouts, not 60',
              gap: "Six is plenty for this bet: the rule is built for tiny samples. What it needs is that they're random.",
            },
            {
              v: 'vary',
              l: 'The 6 times varied a lot from each other',
              gap: "Variation doesn't break it. Timings that aren't random, like all from the lunch rush, do.",
            },
          ],
        },
      ],
    },
    answer: {
      intro: '',
      code: 'About 97% (96.875%, to be exact). It\'s the Rule of Five with one more sample: the range misses the true median only if all 6 timings land on the same side of it, and each side has a (1/2)⁶ = 1/64 chance. Two ways to miss: 2/64 ≈ 3%.\n\nSo your fastest-to-slowest range is a very safe bet for where the typical checkout time sits, from just 6 random timings. The catch is "random": if you timed them all during the lunch rush, the bet is off.',
      outro: '',
    },
  },

  // Sample vs population median: which median is certain, which is only likely.
  bookPopulation: {
    targets: ['population'],
    chip: "Stats · your median or everyone's",
    question:
      'I timed 6 random checkouts at our store, from 1:40 to 6:10. My manager says that means the median checkout time for all our customers is definitely between 1:40 and 6:10. Is that right?',
    lang: 'statistics',
    prose: true,
    check: {
      type: 'choice',
      questions: [
        {
          id: 'yours',
          short: "your 6 timings' median",
          prompt: 'Is the median of your 6 timings between 1:40 and 6:10?',
          answer: 'always',
          options: [
            {
              v: 'always',
              l: "Always: it's one of the middle values of those 6",
            },
            {
              v: 'likely',
              l: 'Very likely, but not always',
              gap: "That's true of all customers' median. Your own 6 timings' median sits between your fastest and slowest by definition.",
            },
            {
              v: 'random',
              l: 'Only if the 6 were picked at random',
              gap: "Randomness matters for all customers' median. Your own 6 timings' median is between your fastest and slowest whichever 6 they are.",
            },
          ],
        },
        {
          id: 'all',
          short: "all customers' median",
          prompt:
            'Is the median checkout time for all your customers between 1:40 and 6:10?',
          answer: 'likely',
          options: [
            { v: 'likely', l: 'Very likely, but not definitely' },
            {
              v: 'always',
              l: 'Definitely: a median always sits between the fastest and the slowest',
              gap: "That's true of your 6 timings' own median, not of all customers'. Your 6 could all happen to land on one side of it.",
            },
            {
              v: 'cant',
              l: "There's no way to tell from just 6",
              gap: '6 random timings say a lot: their range catches the median of all customers most of the time.',
            },
          ],
        },
      ],
    },
    answer: {
      intro: '',
      code: "Not definitely. Your manager's rule is true of your 6 timings' own median: it's one of the middle values, so it's always between your fastest and slowest. The median for all customers is a different number you can't see, and your 6 could all happen to land on one side of it.\n\nIt's a very good bet, though: with 6 random timings, the range misses only if all 6 land on the same side, about 3% of the time. So: very likely between 1:40 and 6:10, not certain.",
      outro: '',
    },
  },

  // Which side an aggregator owns: both picks are about who owns the readers.
  juno: {
    targets: ['ownside'],
    chip: 'Strategy · a top writer wants a bigger cut',
    question:
      "One of our top writers says they'll leave Juno for Substack unless we raise their revenue share. How worried should we be?",
    lang: 'strategy',
    prose: true,
    task: 'Before I answer, how would you reason about it?',
    check: {
      type: 'choice',
      questions: [
        {
          id: 'leave',
          short: 'what happens if they leave',
          prompt:
            'If Juno is working as an aggregator and this writer leaves, most of their readers…',
          answer: 'stay',
          options: [
            { v: 'stay', l: 'Stay on Juno and read someone else' },
            {
              v: 'follow',
              l: 'Follow the writer to Substack',
              gap: "If readers follow, Juno never owned those readers: the writer did. Possible, but then Juno isn't working as an aggregator for them.",
            },
          ],
        },
        {
          id: 'first',
          short: 'what to find out first',
          prompt: 'What is the most useful thing to find out first?',
          answer: 'loyalty',
          options: [
            {
              v: 'loyalty',
              l: "Whether this writer's readers come for them or for Juno",
            },
            {
              v: 'revenue',
              l: 'How much revenue the writer brings in',
              gap: "Useful, but it doesn't say who owns the readers, and that decides how much leverage the writer has.",
            },
            {
              v: 'offer',
              l: 'What Substack is offering them',
              gap: "That's their side of the deal. Your leverage depends on whether their readers would follow them out.",
            },
          ],
        },
      ],
    },
    answer: {
      intro: '',
      code: "Less worried than it feels, if the aggregator model is working. The question that decides it is the one from your prep: if this writer leaves, do their readers follow them out, or stay and read someone else?\n\nIf readers mostly stay, the writer has less leverage than they think, and matching Substack's terms would pay for loyalty Juno already owns. If a big share would follow (they subscribe to the writer, open every post, find them by name), then this writer owns that relationship, and losing them is a real cost.\n\nSo before negotiating, look at how their readers behave: do they arrive through Juno's feeds and recommendations, or by searching for this writer specifically?",
      outro: '',
    },
  },

  // Mechanism vs result: what Juno made cheap, what it owns as a result, and which causes which.
  junoMechanism: {
    targets: ['mechanism'],
    chip: 'Strategy · what gives Juno its hold',
    question:
      "One of our top writers says they'll leave Juno for Substack unless we raise their revenue share. Before we decide: what's actually giving Juno its hold on readers here?",
    lang: 'strategy',
    prose: true,
    task: 'Before I answer, sort out the mechanism from the result.',
    check: {
      type: 'choice',
      questions: [
        {
          id: 'scarce',
          short: 'the scarce thing',
          prompt: 'What scarce thing did Juno make cheap and abundant?',
          answer: 'finding',
          options: [
            {
              v: 'finding',
              l: 'Finding good writing worth reading (it used to take an editor or a magazine you trusted)',
            },
            {
              v: 'tools',
              l: 'Publishing tools for writers',
              gap: 'Publishing was already cheap: anyone could start a blog. What used to need an editor or a magazine you trusted?',
            },
            {
              v: 'readers',
              l: 'Readers for writers',
              gap: 'Readers are what Juno ends up owning: the result. The scarce thing it made cheap is finding good writing you can trust.',
            },
          ],
        },
        {
          id: 'kind',
          short: 'mechanism vs result',
          prompt:
            '"Readers open Juno, not this writer\'s page, and would read someone else if the writer left." This is the…',
          answer: 'result',
          options: [
            { v: 'result', l: 'Result' },
            {
              v: 'mechanism',
              l: 'Mechanism',
              gap: 'Readers staying with Juno is the result: the owned relationship. The mechanism is what made it possible: making good writing easy to find, so no single writer is scarce.',
            },
          ],
        },
        {
          id: 'cause',
          short: 'which causes which',
          prompt: 'Which is true?',
          answer: 'enables',
          options: [
            {
              v: 'enables',
              l: 'Making writers interchangeable to readers is what lets Juno own the readers',
            },
            {
              v: 'reverse',
              l: 'Owning the readers is what lets Juno make writers interchangeable',
              gap: 'The order runs the other way: readers bond with Juno only once any single writer is replaceable to them.',
            },
            {
              v: 'parallel',
              l: 'They are two separate goals',
              gap: "It's not two things in parallel: one enables the other.",
            },
          ],
        },
      ],
    },
    answer: {
      intro: '',
      code: "The mechanism: Juno made finding good writing cheap. Readers don't need to know which writer is worth reading, because Juno's feeds and recommendations do that for them, so any single writer is more replaceable to readers than they look. The result: readers have the relationship with Juno, not with the writer.\n\nSo this writer's leverage depends on whether that mechanism holds for their readers. If they found the writer through Juno and would happily read someone else, the writer has less leverage than they think. If readers seek this writer out by name, the mechanism hasn't worked for them, and losing them is a real cost.",
      outro: '',
    },
  },
};

// Which go-first question an owned target unlocks.
export const goFirstFor = target =>
  Object.keys(GO_FIRST).find(k => GO_FIRST[k].targets.includes(target));
