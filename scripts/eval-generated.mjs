// Evaluates the generated try: the path every question without a hand-written target takes, so the one scale
// depends on. 20 realistic questions → Claude's answer → what to own (focusOptions) → the try (writeTask), made
// as the app makes it (including its one retry when the length gives the answer away, useOwn.js). Each try is
// reviewed two ways:
//   in code:   for multiple choice, is the right option the longest one? (a giveaway; chance is about 1 in 3)
//   by Claude: a rubric, with a reason for each judgement (does it test the goal, is it a new case, are the wrong
//              options real misconceptions, is the answer given away, does the label match what was highlighted)
// The reviewer sees the try as a learner does before answering: no per-question topic labels, no explanations of
// wrong options, no step hints. Calls Claude directly (the server's key, from .env.local); about $2 in total. Run:
//   node --env-file=.env.local scripts/eval-generated.mjs [output.json]
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'node:fs';
import { TASKS } from '../src/prompts.js';
import { longestIsRight as tellsByLength } from '../src/choiceCheck.js';

const client = new Anthropic();
const MODEL = 'claude-opus-5-5';
const EFFORT = { tutor: 'low', json: 'medium', grade: 'high' };
let cost = 0;
async function call(system, messages, effort, max_tokens = 4000) {
  const r = await client.messages.create({ model: MODEL, max_tokens, output_config: { effort }, system, messages });
  cost += ((r.usage.input_tokens || 0) * 4 + (r.usage.output_tokens || 0) * 20) / 1e6;
  return r.content.filter(b => b.type === 'text').map(b => b.text).join('');
}
// The first complete JSON object in a reply (the app's firstJson): trailing text no longer breaks parsing.
const json = t => { t = String(t); const a = t.indexOf('{'); let d = 0, q = false, e = false; for (let i = a; i < t.length; i++) { const c = t[i]; if (q) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') q = false; continue; } if (c === '"') q = true; else if (c === '{') d++; else if (c === '}' && --d === 0) return JSON.parse(t.slice(a, i + 1)); } throw new Error('unfinished JSON'); };
const task = (name, input) => call(TASKS[name].system, [{ role: 'user', content: TASKS[name].user(input) }], EFFORT[TASKS[name].kind]);

const QUESTIONS = [
  'Why does my Python program with 8 threads counting primes run no faster than with 1 thread?',
  'What is the difference between git rebase and git merge, and when should I use each?',
  'When should I use CSS grid instead of flexbox?',
  'How do Cache-Control max-age and ETag work together for HTTP caching?',
  'How do I get a running total per customer in SQL, ordered by date?',
  'Why does my JavaScript loop with setTimeout print 5 five times instead of 0 to 4?',
  'Why is looking up a key in a hash map O(1) on average but O(n) in the worst case?',
  'When would I choose UDP over TCP?',
  'A test for a disease is 99% accurate and 1 in 1000 people have it. If I test positive, how likely is it that I have it?',
  'Why do React lists need a key prop, and why is the array index a bad key?',
  'Why does changing one line in my Dockerfile make the whole build slow again?',
  'What is the difference between greedy and lazy quantifiers in regex?',
  'How do I handle errors with async/await so one failed request does not crash the others?',
  'When does adding a database index make a query slower?',
  'What is the difference between authenticating with OAuth and with an API key?',
  'What does a p-value of 0.03 actually mean?',
  'What is the difference between unit tests and integration tests, and how many of each should I write?',
  'What does the CAP theorem say, in practice, for choosing a database?',
  'In pandas, when should I use groupby().agg() versus pivot_table()?',
  'Why does compound interest grow so much faster than simple interest over 30 years?',
];

// Is the correct option the strictly longest in its question?
const longestIsRight = q => { const opts = q.options || []; const right = opts.find(o => o.correct); if (!right || opts.length < 2) return null; return opts.every(o => o === right || o.label.length < right.label.length); };

// What a learner sees before answering, plus which answer is right.
const beforeAnswering = p => ({ ...p,
  questions: p.questions && p.questions.map(({ short, ...q }) => ({ ...q, options: (q.options || []).map(({ gap, ...o }) => o) })),
  steps: p.steps && p.steps.map(({ how, ...x }) => x) });
const REVIEW_SYS = 'You review practice questions for a learning product. Be strict and specific. Strict JSON only.';
const review = (q, answer, label, practice) => call(REVIEW_SYS, [{ role: 'user', content: `A learner asked: "${q}"\nThey got this answer:\n${answer.slice(0, 2500)}\n\nThey chose to own: "${label}"\nThe practice generated to check that:\n${JSON.stringify(beforeAnswering(practice), null, 1).slice(0, 4000)}\n\nJudge each, with a one-sentence reason:\n1. testsGoal: does every part test "${label}" itself, not a side detail?\n2. newCase: is it a new case, not the answer's own example?\n3. distractors (multiple choice only, else null): are the wrong options misconceptions a real learner would hold?\n4. givenAway: could someone who doesn't know the idea pick or write the right answer from the wording alone (length, hedging, echoing the question)?\n5. labelMatches: does the label "${label}" describe what the answer actually says?\nReturn ONLY JSON {"testsGoal": boolean, "newCase": boolean, "distractors": boolean|null, "givenAway": boolean, "labelMatches": boolean, "reasons": {"testsGoal": string, "newCase": string, "distractors": string|null, "givenAway": string, "labelMatches": string}}` }], 'high', 6000).then(json);

const rows = [];
await Promise.all(QUESTIONS.map(async (q, i) => {
  try {
    const answer = await call(TASKS.chat.system({ mode: 'answer' }), [{ role: 'user', content: q }], 'low', 2000);
    const focus = json(await task('focusOptions', { lang: 'text', fullCode: answer, code: answer }));
    const label = focus.options[0].label;
    const input = { label, code: answer, fullCode: answer };
    // The app's retry: a choice try with the right option clearly longest in 2+ questions is asked for once more.
    const tells = x => x.format === 'choice' ? tellsByLength(x.questions) : 0;
    let practice = await task('writeTask', input).then(json), retried = false;
    if (tells(practice) >= 2) { retried = true; try { const again = await task('writeTask', input).then(json); if (tells(again) < tells(practice)) practice = again; } catch (e) { /* keep the first */ } }
    rows[i] = { q, label, retried, practice, review: await review(q, answer, label, practice) };
    process.stdout.write('.');
  } catch (e) { rows[i] = { q, error: e.message }; process.stdout.write('x'); }
}));
console.log();

const ok = rows.filter(r => r && !r.error);
const summary = () => {
  const P = ok;
  const choiceQs = P.filter(p => p.practice.format === 'choice').flatMap(p => p.practice.questions || []);
  const longest = choiceQs.map(longestIsRight).filter(v => v != null);
  const rate = k => `${P.filter(p => p.review[k] === true).length}/${P.length}`;
  return {
    formats: ['choice', 'explain', 'code', 'steps', 'respond'].map(f => `${f} ${P.filter(p => p.practice.format === f).length}`).join(', '),
    longestIsRight: `${longest.filter(Boolean).length}/${longest.length} choice questions`,
    testsGoal: rate('testsGoal'), newCase: rate('newCase'), givenAway: rate('givenAway'), labelMatches: rate('labelMatches'),
    retried: `${P.filter(p => p.retried).length}/${P.length}`,
    distractorsReal: `${P.filter(p => p.review.distractors === true).length}/${P.filter(p => p.review.distractors != null).length}`,
  };
};
const result = { when: new Date().toISOString(), n: ok.length, errors: rows.filter(r => r && r.error).length, cost: `$${cost.toFixed(2)}`, ...summary() };
console.log(JSON.stringify(result, null, 2));
const out = process.argv[2] || 'eval-generated.json';
writeFileSync(out, JSON.stringify({ result, rows }, null, 2));
console.log('Details (every try and every reason):', out);
