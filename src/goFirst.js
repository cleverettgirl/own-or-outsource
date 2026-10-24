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

import { has, rowWith } from './targets.js';

export const GO_FIRST = {
  sql: {
    targets: ['joins', 'onwhere', 'whole'],
    chip: 'SQL · orders per customer',
    question: 'Write me a SQL query: the number of orders per customer, including customers with no orders (they should show 0).',
    lang: 'sql', schema: "customers(id, name)\norders(id, customer_id, total, status)", placeholder: 'SELECT …',
    check: { type: 'sql', expected: 'SELECT c.name, COUNT(o.id) FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.name', items: [
      { short: 'Every customer appears, even Dee', owned: true, test: rows => has(rows, 'Dee') },
      { short: 'A customer with no orders counts 0, not 1', test: rows => !rows.some(r => r.includes('Dee') && !r.includes('0')) },
      { short: "Each customer's orders are counted (Ada has 2)", test: rows => !!rowWith(rows, 'Ada') && rowWith(rows, 'Ada').includes('2') },
    ], diagnoses: [
      { sql: 'SELECT c.name, COUNT(*) FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.name',
        gap: 'So close: Dee shows 1 instead of 0. The LEFT JOIN gives Dee one row of NULLs, and COUNT(*) counts rows, so it counts that one. Count a column from orders instead, like COUNT(o.id): it skips NULLs.' },
      { sql: 'SELECT c.name, COUNT(o.id) FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.name',
        gap: "Dee is missing: she has no orders, so a plain JOIN drops her. That's the LEFT JOIN you've been owning." },
    ] },
    answer: {
      intro: "Here's mine. Start from customers so everyone appears, LEFT JOIN their orders, and count a column from orders:",
      code: 'SELECT c.name, COUNT(o.id) AS orders\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;',
      outro: 'COUNT(o.id) rather than COUNT(*): a customer with no orders still gets one row of NULLs from the LEFT JOIN, and COUNT(*) would count it as 1.',
    },
  },

  book: {
    targets: ['rule', 'population'],
    chip: 'Stats · 6 timed checkouts',
    question: 'I timed 6 random checkout transactions at our store. How likely is it that the median checkout time for all customers is between my fastest and slowest one?',
    lang: 'statistics', prose: true, placeholder: 'Your answer, e.g. 60%. Working is welcome.',
    check: { type: 'number', expected: [96.875], tolerance: 0.2, explain: 'Two ways to miss, each (1/2)⁶ = 1/64: 1 − 2/64 = 96.875%.', diagnoses: [
      { answer: [98.4375], gap: "That counts only one way to miss. All 6 could be slower than the median, or all 6 faster: 1 − 2/64 = 96.875%." },
      { answer: [100], gap: "100% is true for your 6 timings' own median. The question is about all customers, whose median you can't see." },
      { answer: [3.125], gap: "3.125% is the chance your range misses it. The question asks how often it catches it: 100% − 3.125%." },
    ] },
    answer: {
      intro: '',
      code: "About 97% (96.875%, to be exact). It's the Rule of Five with one more sample: the range misses the true median only if all 6 timings land on the same side of it, and each side has a (1/2)⁶ = 1/64 chance. Two ways to miss: 2/64 ≈ 3%.\n\nSo your fastest-to-slowest range is a very safe bet for where the typical checkout time sits, from just 6 random timings. The catch is \"random\": if you timed them all during the lunch rush, the bet is off.",
      outro: '',
    },
  },

  juno: {
    targets: ['ownside', 'mechanism'],
    chip: 'Strategy · a top writer wants a bigger cut',
    question: "One of our top writers says they'll leave Juno for Substack unless we raise their revenue share. How worried should we be?",
    lang: 'strategy', prose: true,
    task: 'Before I answer, how would you reason about it?',
    check: { type: 'choice', questions: [
      { id: 'leave', short: 'what happens if they leave', prompt: 'If Juno is working as an aggregator and this writer leaves, most of their readers…', answer: 'stay', options: [
        { v: 'stay', l: 'Stay on Juno and read someone else' },
        { v: 'follow', l: 'Follow the writer to Substack', gap: "If readers follow, Juno never owned those readers: the writer did. Possible, but then Juno isn't working as an aggregator for them." },
      ] },
      { id: 'first', short: 'what to find out first', prompt: 'What is the most useful thing to find out first?', answer: 'loyalty', options: [
        { v: 'loyalty', l: "Whether this writer's readers come for them or for Juno" },
        { v: 'revenue', l: 'How much revenue the writer brings in', gap: "Useful, but it doesn't say who owns the readers, and that decides how much leverage the writer has." },
        { v: 'offer', l: 'What Substack is offering them', gap: "That's their side of the deal. Your leverage depends on whether their readers would follow them out." },
      ] },
    ] },
    answer: {
      intro: '',
      code: "Less worried than it feels, if the aggregator model is working. The question that decides it is the one from your prep: if this writer leaves, do their readers follow them out, or stay and read someone else?\n\nIf readers mostly stay, the writer has less leverage than they think, and matching Substack's terms would pay for loyalty Juno already owns. If a big share would follow (they subscribe to the writer, open every post, find them by name), then this writer owns that relationship, and losing them is a real cost.\n\nSo before negotiating, look at how their readers behave: do they arrive through Juno's feeds and recommendations, or by searching for this writer specifically?",
      outro: '',
    },
  },
};

// Which go-first question an owned target unlocks.
export const goFirstFor = target => Object.keys(GO_FIRST).find(k => GO_FIRST[k].targets.includes(target));
