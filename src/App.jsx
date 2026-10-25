// Ported from the Claude Design prototype "Own It or Outsource It.dc.html".
// The logic below is the design's own code, kept close to verbatim; only the Claude calls
// were rewired to /api/claude. render() is the design's template converted to JSX.
import React from 'react';
import { complete } from './claude.js';
import { TASKS } from './prompts.js';
import { css } from './css.js';
import { SQL_TARGETS, sqlFocusOptions } from './targets.js';
import { checkSql } from './sqlCheck.js';
import { BOOK_TARGETS, bookFocusOptions, patterns } from './bookTargets.js';
import { checkNumber } from './numberCheck.js';
import { BOOK_TURNS } from './bookTranscript.js';
import { JUNO_TARGETS, junoFocusOptions } from './junoTargets.js';
import { JUNO_TURNS } from './junoTranscript.js';
import { checkChoice } from './choiceCheck.js';
import { checkSteps } from './stepsCheck.js';
import { GO_FIRST, goFirstFor } from './goFirst.js';
import { ruleNotes, keepQuoted } from './notes.js';
import { SCALES, RUBRIC_WHY, tally, allRight, calibration, correctionNote } from './scoring.js';
import Sidebar from './ui/Sidebar.jsx';
import Chat from './ui/Chat.jsx';
import OwnPanel from './ui/OwnPanel.jsx';
import GoPanel, { GapPanel } from './ui/GoPanel.jsx';
import { isColdStart, COLD_START, judgeColdStartOffline } from './gaps.js';
import { REACT_TURNS } from './reactTranscript.js';

// The leadership starter: a question nobody prepared targets for, so it shows the generated path (spec-leadership-fixes.md).
// It asks about disagreeing and names Roger Martin's question, so the answer reliably includes it, credited to him
// (Claude once credited it to Adam Grant; log 85). That's the person's question, not app logic about leadership.
const LEAD_QUESTION = "I'm not a manager, but I want to grow as a leader on my team. What does leading without a title actually look like day to day, including how to disagree with a plan without just criticizing it? Draw on Brené Brown, Adam Grant, Simon Sinek, or Roger Martin's 'what would have to be true?' where it's relevant.";
// The risk starter: a real health headline (WHO/IARC 2015: 50g of processed meat a day, +18% bowel cancer risk), asked
// the way a person would. Relative vs absolute risk is what the answer has to teach; owning a calculation in it gets a
// generated "work it out" try (log 63).
const RISK_QUESTION = 'I just saw a headline saying that eating 50g of processed meat a day, about two slices of bacon, raises your risk of bowel cancer by 18%. Should I stop eating meat?';
// Names userId, as the recorded component and its walkthrough do (asked with "id", live answers used `id`).
const REACT_LIVE_QUESTION = 'How do I fetch a user by userId in a React component when it mounts, and refetch when userId changes?';
import { REACT_TARGETS } from './reactTargets.js';
import { SQL_TURNS, SQL_QUESTION } from './sqlTranscript.js';


// Every hand-written learning target, by id. Ids are unique across starters.
const TARGETS = { ...SQL_TARGETS, ...BOOK_TARGETS, ...JUNO_TARGETS, ...REACT_TARGETS };

// Score an attempt with the target's own check: run it (SQL), calculate it (numbers) or match picks (choice).
async function runCheck(check, text, before, after, picked) {
  if (check.type === 'number') return checkNumber(check, text);
  if (check.type === 'choice') return checkChoice(check, picked || {});
  if (check.type === 'steps') return checkSteps(check, picked || {});
  return checkSql(check, text, before, after);
}

const DAY = 24 * 60 * 60 * 1000;
// Owning the same thing again is one thing you own, with a history: the latest attempt is the live entry (its
// recall schedule, its card); earlier ones are folded into it as "Earlier" and leave the schedule. They stay in
// the ledger, so calibration still counts every prediction. Idempotent, so it also cleans up saved progress.
function foldRepeats(ledger) {
  const live = ledger.filter(e => e.kind !== 'gap' && !e.merged);
  const byTitle = {};
  for (const e of live) (byTitle[e.title] ||= []).push(e);
  const fold = {};
  for (const group of Object.values(byTitle)) {
    if (group.length < 2) continue;
    const sorted = group.slice().sort((a, b) => (a.ownedAt || 0) - (b.ownedAt || 0)), latest = sorted[sorted.length - 1];
    const earlier = sorted.slice(0, -1).flatMap(e => [...(e.earlier || []), { predicted: e.predicted, actual: e.actual, n: e.n, at: e.ownedAt }]);
    fold[latest.id] = { earlier: [...(latest.earlier || []), ...earlier].sort((a, b) => a.at - b.at), realWork: sorted.flatMap(e => e.realWork || []), reviews: sorted.flatMap(e => e.reviews || []) };
    for (const e of sorted.slice(0, -1)) fold[e.id] = { merged: true, dueAt: null };
  }
  return Object.keys(fold).length ? ledger.map(e => (fold[e.id] ? { ...e, ...fold[e.id] } : e)) : ledger;
}

// "3 days ago", "today", "in 7 days", relative to the (possibly simulated) now.
const rel = (t, now) => { const d = Math.round((t - now) / DAY); return d === 0 ? 'today' : d < 0 ? `${-d} day${d === -1 ? '' : 's'} ago` : `in ${d} day${d === 1 ? '' : 's'}`; };

const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hours ago`; };

// The first complete JSON object or array in a reply. Models sometimes add a sentence, or a second object, after
// the JSON; a greedy match would swallow that and fail to parse (2 of 40 generated tries did, in the eval).
function firstJson(t) {
  const start = t.search(/[{[]/); if (start < 0) throw new Error('no JSON');
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{' || c === '[') depth++; else if ((c === '}' || c === ']') && --depth === 0) return t.slice(start, i + 1);
  }
  throw new Error('unfinished JSON');
}

const STEP_LABELS = { read: 'Read it', see: 'See it', assemble: 'Assemble it', compare: 'Compare it', write: 'Write it' };

// The try's name follows what you do in it: picking answers isn't writing.
const stepLabel = (o, step) => step !== 'write' ? STEP_LABELS[step] : (o && o.write && o.write.check ? { choice: 'Answer it', explain: 'Explain it', number: 'Work it out', steps: 'Work it out' }[o.write.check.type] : null) || 'Write it';

export default class App extends React.Component {
  state = { messages: [], composer: '', own: null, ledger: [], exits: [], sel: null, chatTitle: 'New chat', tipDismissed: false, view: 'chat', timeShift: 0, recall: null, gaps: [], activeGap: null, asked: [] };
  // Simulated "now": the demo can skip ahead in time to bring things due.
  now() { return Date.now() + this.state.timeShift; }
  scrollRef = React.createRef();
  panelRef = React.createRef();
  uid = 0;
  nid() { return ++this.uid; }

  // ---------- saved progress ----------
  // What you own, your gaps, what you asked about, where you stepped away and the demo clock are kept in this
  // browser (localStorage), so someone who comes back days later finds their recalls due. Chats aren't kept.
  // Scenarios are saved by name and the Own-it state is trimmed to what Learnings and recall read.
  static STORE = 'own-it:v1';
  // ?demo in the URL loads a realistic sample state (for recording the demo video), kept under its own key so it
  // never mixes with a real tester's progress.
  isDemo = typeof window !== 'undefined' && /[?&]demo\b/.test(window.location.search);
  storeKey = this.isDemo ? 'own-it:demo:v1' : App.STORE;
  scKey(sc) { return ['SQL', 'REACT', 'BOOK', 'JUNO'].find(k => this[k] === sc) || null; }
  saveProgress() {
    const S = this.state, sc = x => ({ ...x, scenario: this.scKey(x.scenario) });
    const own = o => o && { scenario: this.scKey(o.scenario), focus: o.focus, lang: o.lang, code: String(o.code || '').slice(0, 4000), write: { schema: (o.write && o.write.schema) || '' } };
    const data = { v: 1, uid: this.uid, timeShift: S.timeShift, tipDismissed: S.tipDismissed, gaps: S.gaps, asked: S.asked.map(sc), exits: S.exits.map(sc), ledger: S.ledger.map(e => ({ ...e, own: own(e.own) })) };
    try { window.localStorage.setItem(this.storeKey, JSON.stringify(data)); } catch (e) { /* storage blocked or full: progress just isn't kept */ }
  }
  loadProgress() {
    let d = null;
    try { d = JSON.parse(window.localStorage.getItem(this.storeKey) || 'null'); } catch (e) { d = null; }
    if (!d || d.v !== 1) return null;
    const sc = x => ({ ...x, scenario: x.scenario ? this[x.scenario] : null });
    this.uid = Math.max(this.uid, d.uid || 0);
    return { timeShift: d.timeShift || 0, tipDismissed: !!d.tipDismissed, gaps: d.gaps || [], asked: (d.asked || []).map(sc), exits: (d.exits || []).map(sc), ledger: foldRepeats((d.ledger || []).map(e => ({ ...e, own: sc(e.own) }))) };
  }
  resetDemo = () => {
    if (!window.confirm(this.isDemo ? 'Reset the sample data to how it started?' : 'Clear everything you own, your gaps and recalls, and start the demo fresh?')) return;
    try { window.localStorage.removeItem(this.storeKey); } catch (e) { /* nothing saved */ }
    this.uid = 0;
    this.setState({ messages: [], own: null, ledger: this.seedLedger(), exits: [], gaps: [], asked: [], ...(this.isDemo ? this.demoState() : {}), timeShift: 0, tipDismissed: false, recall: null, activeGap: null, chatTitle: 'New chat', view: 'chat', composer: '' });
  };

  // ---------- scenarios ----------
  SQL = {
    title: 'Revenue per customer, LEFT JOIN',
    question: "Write me a SQL query for revenue per customer from paid orders, highest first. Tables: customers(id, name) and orders(id, customer_id, total, status). Customers who haven't bought anything yet should still show up with $0.",
    intro: "Here's a query that starts from customers, attaches only their paid orders, and totals per customer. Because some customers have no paid orders, it needs a LEFT JOIN, and the paid filter has to live in the ON clause:",
    lang: 'sql',
    code: "SELECT c.name, COALESCE(SUM(o.total), 0) AS revenue\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\n  AND o.status = 'paid'\nGROUP BY c.name\nORDER BY revenue DESC;",
    outro: "A plain JOIN would drop customers with no matching order. Putting status = 'paid' in WHERE instead of ON would drop them too, because the LEFT JOIN's empty rows have status NULL and NULL = 'paid' is never true.",
    annotations: [
      ['SELECT c.name, COALESCE(SUM(o.total), 0) AS revenue', 'Return the name and the summed total. COALESCE turns a NULL sum (no orders) into 0.'],
      ['FROM customers c', 'Start from customers, because every customer must appear in the result.'],
      ['LEFT JOIN orders o ON o.customer_id = c.id', 'Attach each customer\'s orders. LEFT keeps customers even when no order matches.'],
      ["  AND o.status = 'paid'", 'Part of the join condition: only paid orders count as a match. Unpaid ones match nothing, so the customer still survives.'],
      ['GROUP BY c.name', 'Collapse to one row per customer. Customers with no match keep one row of NULLs.'],
      ['ORDER BY revenue DESC;', 'Sort by the alias, biggest first.']
    ],
    bridges: ['A plain JOIN is like filtering customers to the ones that have a match in orders; a LEFT JOIN is like a .map() that attaches matches, or null when there are none.', 'The ON condition decides what counts as a match. WHERE runs afterwards, on the joined rows, like a .filter() that sees the nulls.', 'COALESCE(x, 0) is x ?? 0.'],
    asmWhy: "In one line: why does status = 'paid' live in ON rather than WHERE?",
    distractor: "WHERE o.status = 'paid'",
    schema: "authors(id, name)\nbooks(id, author_id, pages, status)   -- status is 'published' or 'draft'",
    writeRequirements: ['Every author appears, even with no published books', 'An empty total shows 0, not NULL', 'Only published pages count', 'Most pages first'],
    writeTask: 'Now write a new one from scratch, same shape, different data: total pages per author from published books, most pages first. Authors with no published books should still appear with 0.',
    writeRef: "SELECT a.name, COALESCE(SUM(b.pages), 0) AS pages\nFROM authors a\nLEFT JOIN books b ON b.author_id = a.id\n  AND b.status = 'published'\nGROUP BY a.name\nORDER BY pages DESC;",
    delayedTask: 'From memory: the names of customers who have no paid orders at all.',
    delayedRef: "SELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\n  AND o.status = 'paid'\nWHERE o.id IS NULL;"
  };
  REACT = {
    title: 'Fetch a user with useEffect',
    taughtInChat: false, // one answer, not a tutoring chat: low predictions start at the timeline, not the test
    question: 'How do I fetch a user by id in a React component when it mounts, and refetch when the id changes?',
    intro: 'Put the fetch in a useEffect whose dependency array lists id. A cancelled flag stops a slow response from an old id overwriting a newer one:',
    lang: 'jsx',
    code: "function UserCard({ id }) {\n  const [user, setUser] = useState(null);\n  useEffect(() => {\n    let cancelled = false;\n    fetch(`/api/users/${id}`)\n      .then(r => r.json())\n      .then(data => { if (!cancelled) setUser(data); });\n    return () => { cancelled = true; };\n  }, [id]);\n  if (!user) return <p>Loading…</p>;\n  return <h2>{user.name}</h2>;\n}",
    outro: 'The returned function runs before the effect re-runs and on unmount, which is what makes the cancellation work.',
    annotations: [
      ['function UserCard({ id }) {', 'A component that receives the id to load as a prop.'],
      ['  const [user, setUser] = useState(null);', 'State for the loaded user. null means nothing has arrived yet.'],
      ['  useEffect(() => {', 'Side effects (like fetching) go in an effect, not in the render body.'],
      ['    let cancelled = false;', 'A flag local to this run of the effect. Each run gets its own.'],
      ['    fetch(`/api/users/${id}`)', 'Start the request for the current id.'],
      ['      .then(r => r.json())', 'Parse the response body.'],
      ['      .then(data => { if (!cancelled) setUser(data); });', 'Only store the result if this run is still current.'],
      ['    return () => { cancelled = true; };', 'Cleanup. React calls it before the next run and on unmount, flipping the flag.'],
      ['  }, [id]);', 'Dependency array: re-run the effect whenever id changes, and only then.'],
      ['  if (!user) return <p>Loading…</p>;', 'Nothing loaded yet, show a placeholder.'],
      ['  return <h2>{user.name}</h2>;', 'Render the loaded user.'],
      ['}', 'End of component.']
    ],
    seeSteps: [
      { clause: 'mount, id=1', title: 'First render with id = 1', note: 'user is null, so "Loading…" renders. After paint, React runs the effect: cancelled = false, fetch /api/users/1 starts.', rows: null },
      { clause: 'response 1', title: 'Response for id 1 arrives', note: 'cancelled is still false, so setUser(data) runs. Re-render shows the name.', rows: null },
      { clause: 'id → 2', title: 'Parent changes id to 2', note: 'id is in the dependency array, so React first runs the previous cleanup (cancelled = true for run 1), then runs the effect again: a new cancelled = false, fetch /api/users/2 starts.', rows: null },
      { clause: 'id → 3 (fast)', title: 'id changes again to 3 before response 2 arrives', note: 'Cleanup for run 2 flips its cancelled to true. Run 3 starts fetch /api/users/3. Two requests are now in flight.', rows: null },
      { clause: 'response 2 (stale)', title: 'Response for id 2 arrives late', note: 'Its closure sees cancelled = true, so setUser is skipped. The stale user never overwrites the screen.', rows: null },
      { clause: 'vs. no cleanup', contrast: true, title: 'If there were no cleanup and no cancelled flag', note: 'Response 2 would call setUser and the card would briefly show user 2 while the prop says 3. If response 3 arrived first, the screen would end on the wrong user and stay there.', rows: null },
      { clause: 'vs. [] deps', contrast: true, title: 'If the dependency array were [] instead of [id]', note: 'The effect runs once on mount only. Changing id to 2 re-renders, but no new fetch happens, so the card keeps showing user 1 forever.', rows: null },
      { clause: 'response 3', title: 'Response for id 3 arrives', note: 'Run 3 is current, cancelled is false, setUser(data) runs. The screen matches the prop.', rows: null },
      { clause: 'unmount', title: 'Component unmounts', note: 'Cleanup runs one last time. Any response still in flight is ignored, so there is no setState on an unmounted component.', rows: null }
    ],
    bridges: ['The effect is like an event listener you re-attach every time id changes; the cleanup is the removeEventListener.', 'The cancelled flag is the same trick as checking a request id before applying a late AJAX response.', 'The dependency array is the list of things the effect "watches", like a watch() in Vue or a computed input.'],
    asmWhy: 'In one line: why does the cleanup function need to come after the fetch?',
    distractor: '  }, []);',
    schema: "Props: { slug }\nEndpoint: GET /api/posts/:slug → { title, ... }\nAvailable: useState, useEffect, fetch",
    writeRequirements: ['Holds the post in state and shows it', 'Fetches in an effect that re-runs when slug changes', 'Stops an old response from overwriting a newer one', 'Cleans up on unmount'],
    writeTask: 'Now write a new one from scratch, same shape, different data: a PostTitle component that fetches a post by slug on mount, refetches when slug changes, and ignores stale responses.',
    writeRef: "function PostTitle({ slug }) {\n  const [post, setPost] = useState(null);\n  useEffect(() => {\n    const controller = new AbortController();\n    fetch(`/api/posts/${slug}`, { signal: controller.signal })\n      .then(r => r.json())\n      .then(setPost)\n      .catch(err => { if (err.name !== 'AbortError') throw err; });\n    return () => controller.abort();\n  }, [slug]);\n  if (!post) return <p>Loading…</p>;\n  return <h2>{post.title}</h2>;\n}",
    delayedTask: 'From memory: a component that subscribes to window resize on mount and unsubscribes on unmount, storing the width in state.',
    delayedRef: "function Width() {\n  const [w, setW] = useState(window.innerWidth);\n  useEffect(() => {\n    const on = () => setW(window.innerWidth);\n    window.addEventListener('resize', on);\n    return () => window.removeEventListener('resize', on);\n  }, []);\n  return <span>{w}</span>;\n}"
  };
  // A study-buddy chat about a book: Christine's real transcript (bookTranscript.js), replayed.
  BOOK = {
    title: 'How to Measure Anything · Rule of Five',
    prose: true, inYourLabel: 'In your question',
    lang: 'statistics',
    samOpen: "Hey! I've never done statistics. Isn't the median always between the smallest and the biggest number? Why is that a rule?",
    samLines: ["Ok, so there are two medians? Which one can I actually see?", "Wait, why does it matter if all of them land on one side? How would that even happen?", "Ok I think I get it: my numbers always surround their own middle, but the real middle is hidden, and I only miss it if I'm unlucky and all my picks are on one side. Thanks!"],
  };
  // Christine's real meeting-prep chat on aggregation theory (junoTranscript.js); the company renamed to Juno.
  JUNO = {
    title: 'Juno · aggregation theory',
    prose: true, inYourLabel: 'In your question',
    lang: 'strategy',
    samOpen: "Hi! I don't know much about business. If Juno has writers and readers, wouldn't it want both of them to love it? Why pick one?",
    samLines: ["Ohh, so no single writer is a big deal. But if writers know they're replaceable, why would the really good ones stick around on Juno?", "Ooh, a loop! But how does it get started? On day one there are no readers or writers, so what makes the first ones show up?", "Ok, so I think I get it: Juno wants readers loyal to Juno itself, and readers and writers keep pulling each other in. How that loop starts on day one is still a mystery to both of us, though. Thanks!"],
  };
  CUSTOMERS = { 1: 'Ada', 2: 'Bo', 3: 'Cy', 4: 'Dee', 5: 'Eli', 6: 'Fay' };
  ORDERS = [[1,1,320,'paid'],[2,2,150,'paid'],[3,1,260,'paid'],[4,3,90,'refunded'],[5,4,410,'paid'],[6,2,220,'paid'],[7,5,75,'paid'],[8,3,530,'refunded'],[9,4,180,'refunded'],[10,1,140,'paid'],[11,2,200,'paid'],[12,5,60,'paid']];

  // ---------- Claude ----------
  // task names one of the app's prompts (src/prompts.js); the server builds the request from it and the input.
  async ask(task, input) {
    const text = await complete({ task, input });
    if (!TASKS[task].json) return String(text).trim();
    return JSON.parse(firstJson(String(text)));
  }

  // ---------- chat ----------
  // While you own a highlighted part, it stays highlighted in Claude's reply. Finds the text across the rendered
  // nodes (whitespace-insensitive) and marks it with a CSS highlight, so the chat's own markup isn't touched.
  markOwnedText() {
    if (typeof window === 'undefined' || !window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    const o = this.state.own, key = o ? `${o.msgId}|${o.code}` : '';
    if (key === this._marked) return;
    this._marked = key; CSS.highlights.delete('owned'); this._ownedRange = null;
    if (!o || o.code === o.fullCode || o.code.length > 400) return;
    const el = document.querySelector(`[data-msg-id="${o.msgId}"]`); if (!el) return;
    const map = []; let flat = '';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) for (let k = 0; k < n.textContent.length; k++) {
      const ch = /\s/.test(n.textContent[k]) ? ' ' : n.textContent[k];
      if (ch === ' ' && flat.endsWith(' ')) continue;
      flat += ch; map.push([n, k]);
    }
    const want = o.code.replace(/[*`#>]/g, '').replace(/\s+/g, ' ').trim();
    let at = flat.indexOf(want), len = want.length;
    if (at < 0) { const head = want.slice(0, 60); at = flat.indexOf(head); len = head.length; }
    if (at < 0) return;
    const r = document.createRange(), end = map[at + len - 1];
    r.setStart(map[at][0], map[at][1]); r.setEnd(end[0], end[1] + 1);
    CSS.highlights.set('owned', new Highlight(r));
    this._ownedRange = r;
  }
  // Spaced recall: owned things come due after 3 days; recalled right → a week, then 3 weeks; missed → tomorrow.
  // One item is seeded from the Rule of Five chat, owned "3 days ago", so the loop is visible from the start.
  seedLedger() {
    const t = Date.now(), label = BOOK_TARGETS.rule.label;
    return [{ id: 'seed-rule', title: label, predicted: 3, actual: 2, n: 3, fixed: null, hints: 0, realWork: [], reviews: [], seeded: true,
      ownedAt: t - 3 * DAY, dueAt: t - 60 * 60 * 1000,
      own: { scenario: this.BOOK, focus: { label, mode: 'concept', target: 'rule' }, lang: 'statistics', code: '', write: { schema: '' } } }];
  }
  // The ?demo sample: what a few days of real use looks like, built on the real targets so recall, "try a new
  // question" and the gap actions all work on it. Times are relative to now, so something is always due.
  demoState() {
    const t = Date.now(), H = 60 * 60 * 1000;
    const own = (scenario, focus, lang, code = '') => ({ scenario, focus, lang, code, write: { schema: '' } });
    const entry = (id, title, predicted, actual, n, ownedDaysAgo, dueInDays, o, extra = {}) => ({ id, title, predicted, actual, n, fixed: null, hints: 0, realWork: [], reviews: [], ownedAt: t - ownedDaysAgo * DAY, dueAt: t + dueInDays * DAY, own: o, ...extra });
    const cold = { id: 'demo-g1', topic: 'How a two-sided platform solves the cold start', question: 'On day one there are no readers or writers, so what makes the first ones show up?', quote: "I'm not sure, maybe they pay the first writers?", source: 'teach', origin: 'while you were explaining “Which side an aggregator owns” to Sam', from: JUNO_TARGETS.ownside.label, at: t - 2 * DAY, status: 'closed', closedAt: t - 1 * DAY, context: COLD_START.context };
    const open = { id: 'demo-g2', topic: 'When to push back on a team decision, and when to commit', question: "But if you disagree with the plan and you're not the manager, do you still have to go along with it?", quote: "I guess you just say it once and then do it anyway?", source: 'teach', origin: 'while you were explaining “Helping generously without burning out” to Sam', from: 'Helping generously without burning out', at: t - 3 * H, status: 'open', context: '' };
    return {
      ledger: [
        entry('demo-1', BOOK_TARGETS.rule.label, 3, 2, 3, 4, -2 * H / DAY, own(this.BOOK, { label: BOOK_TARGETS.rule.label, mode: 'concept', target: 'rule' }, 'statistics')),
        entry('demo-2', JUNO_TARGETS.ownside.label, 2, 3, 3, 9, 5, own(this.JUNO, { label: JUNO_TARGETS.ownside.label, mode: 'concept', target: 'ownside' }, 'strategy'),
          { reviews: [{ at: t - 2 * DAY, right: 3, n: 3 }], realWork: [{ predicted: 1, actual: 2, n: 2 }] }),
        entry('demo-3', SQL_TARGETS.onwhere.label, 1, 1, 2, 1, 2, own(this.SQL, { label: SQL_TARGETS.onwhere.label, mode: 'concept', target: 'onwhere' }, 'sql'),
          { fixed: 2, realWork: [{ outsourced: true }] }),
        { id: 'gap-demo-g1', kind: 'gap', title: cold.topic, predicted: null, actual: null, fixed: null, hints: 0, realWork: [], reviews: [], ownedAt: t - 1 * DAY, dueAt: t + 2 * DAY,
          gap: { ...cold, check: COLD_START.check }, own: own(null, { label: cold.topic, mode: 'concept' }, 'concept') },
        entry('demo-4', 'Converting both baselines to the same units', 4, 3, 4, 1, 2, own(null, { label: 'Converting both baselines to the same units', mode: 'concept' }, 'text', 'Put both baselines in the same units. Convert B\'s "20 in 100" into "__ in 1,000". Find the extra cases. Compare the two absolute numbers, not the percentages.')),
        entry('demo-5', 'Helping generously without burning out', 3, 1, 3, 0.1, 3, own(null, { label: 'Helping generously without burning out', mode: 'concept' }, 'text', 'Givers who succeed protect their time: they help in ways that have high impact for others and low cost to themselves, and they set boundaries so helping doesn\'t crowd out their own work.')),
      ],
      gaps: [cold, open],
      asked: [{ id: 'demo-a1', msgId: null, quote: 'COUNT(*) counts rows, so it counts that one', question: "why does COUNT(*) count the empty row but COUNT(o.id) doesn't?", scenario: this.SQL, chatTitle: this.SQL.title, at: t - 5 * H, label: 'Why COUNT(*) counts the empty row in a LEFT JOIN', checked: false }],
      exits: [{ id: 'demo-x1', title: REACT_TARGETS.timing.label, predicted: 0, n: 3, step: 'asked Claude first', askedFirst: true, stepOf: '', startStep: 'Answer it', scenario: this.REACT }],
    };
  }
  componentDidMount() {
    const saved = this.loadProgress();
    if (saved) this.setState(saved); else if (this.isDemo) this.setState(this.demoState()); else if (!this.state.ledger.length) this.setState({ ledger: this.seedLedger() });
    this._onDown = e => { if (this.state.sel && !(e.target.closest && e.target.closest('#own-sel'))) this.setState({ sel: null }); };
    this._onSelChange = () => { const s = window.getSelection(); if (this.state.sel && (!s || !s.toString().trim())) this.setState({ sel: null }); };
    document.addEventListener('mousedown', this._onDown);
    document.addEventListener('selectionchange', this._onSelChange);
  }
  componentWillUnmount() { document.removeEventListener('mousedown', this._onDown); document.removeEventListener('selectionchange', this._onSelChange); }
  componentDidUpdate(_, prev) {
    const S = this.state;
    // A newly opened panel starts open, not tucked away (phones).
    const key = st => (st.own ? 'own' + st.own.id : '') + (st.messages.filter(m => ['goFirst', 'goAsk', 'gapCheck'].includes(m.type) && !m.panelClosed && m.phase !== 'offer' && m.phase !== 'answered').map(m => m.id).pop() || '');
    if (S.sheetMin && key(prev) !== key(S) && key(S)) this.setState({ sheetMin: false });
    if (['ledger', 'gaps', 'asked', 'exits', 'timeShift', 'tipDismissed'].some(k => prev[k] !== S[k])) this.saveProgress();
    if (prev.messages !== this.state.messages || (this.state.own && prev.own !== this.state.own && prev.own && prev.own.phase !== this.state.own.phase)) {
      const el = this.scrollRef.current; if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
    this.markOwnedText();
    // The panel starts each phase and step at the top.
    const a = prev.own, b = this.state.own;
    if (b && (!a || a.phase !== b.phase || a.step !== b.step)) { const pn = this.panelRef.current; if (pn) pn.scrollTop = 0; }
  }
  newChat = () => this.setState({ messages: [], own: null, sel: null, chatTitle: 'New chat', composer: '', view: 'chat', activeGap: null });
  // Learnings remembers where you came from, so Back returns there: the chat, with the Own it panel as you left it.
  openLearnings = () => this.setState(s => ({ view: 'learnings', sel: null, justOwned: null, learnFrom: s.view === 'learnings' ? s.learnFrom : s.messages.length || s.own ? 'chat' : null }));
  // From the end of a try: see the thing you just owned on the map and in your cards.
  seeInLearnings = () => this.setState(s => ({ view: 'learnings', sel: null, justOwned: s.own && s.own.id, learnFrom: 'chat' }));
  backFromLearnings = () => this.setState({ view: 'chat', learnFrom: null, justOwned: null });
  // The home starters are prompts, sent live, so you watch Claude answer. SQL and React keep their scenario, so the
  // hand-written targets and the "see it run" walkthroughs still apply: live answers to these prompts match the
  // recorded query and component (sampled 2026-10-24). If the model can't be reached, the recorded answer stands in.
  startLive(text, sc = null, recorded = null) {
    this.setState({ messages: [], own: null, sel: null, chatTitle: 'New chat', composer: '', view: 'chat', activeGap: null, learnFrom: null }, () => this.sendText(text, sc, false, { recorded }));
  }
  startLead = () => this.startLive(LEAD_QUESTION);
  startRisk = () => this.startLive(RISK_QUESTION);
  startSql = () => this.startLive(SQL_QUESTION, this.SQL, SQL_TURNS[0].claude);
  startReact = () => this.startLive(REACT_LIVE_QUESTION, this.REACT, REACT_TURNS[0].claude);
  // Replays a real chat as-is. Every answer can be highlighted or owned whole (the icon under it).
  // turns: [{ user, claude }] pairs, or single { user } / { claude } / { gap } entries.
  replay(sc, turns) {
    const learn = true;
    const flat = turns.flatMap(t => [t.user != null && { user: t.user }, t.gap && { gap: t.gap }, t.claude != null && { claude: t.claude }].filter(Boolean));
    const msgs = flat.map(t => t.user != null ? { id: this.nid(), type: 'user', text: t.user }
      : t.gap ? { id: this.nid(), type: 'gap', text: t.gap }
      : { id: this.nid(), type: 'assistant', learn, intro: '', code: t.claude, lang: sc.lang, outro: '', scenario: sc, plain: true, at: Date.now() });
    this.setState({ messages: msgs, composer: '', chatTitle: sc.title, own: null, sel: null, view: 'chat', activeGap: null });
  }
  startBook = () => this.replay(this.BOOK, BOOK_TURNS);
  startJuno = () => this.replay(this.JUNO, JUNO_TURNS);
  send = () => { const t = this.state.composer.trim(); if (!t) return; this.sendText(t, null, !!this.state.own); };
  composerRef = React.createRef();
  // Own-it finds the gap; the chat explains it. These prefill a follow-up with your attempt and what the check said.
  // The context goes in as a quote (the task, your answer, what the check said); the question is yours to write.
  // Naming what confuses you is part of the learning, so the app doesn't put words in your mouth.
  askAboutIt = () => {
    const o = this.state.own, w = o.write, g = w.grade, c = w.check;
    const attempt = c && c.type === 'choice' ? c.questions.map(q => `${q.prompt} → ${(q.options.find(x => x.v === w.picked[q.id]) || {}).l || '(no answer)'}`).join('\n')
      : c && c.type === 'steps' ? c.steps.map(st => `${st.label}: ${w.picked[st.id] || '(blank)'}`).join('\n') : w.text;
    const q = t => String(t).split('\n').map(l => '> ' + l).join('\n');
    const text = `About my try on “${o.focus ? o.focus.label : 'this'}”:\n${q('Task: ' + w.task)}\n${q('My answer: ' + (attempt || '(nothing yet)'))}${g ? '\n' + q('The check said: ' + (g.gap || g.why || '')) : ''}\n\n`;
    this.setState({ composer: text }, () => { const el = this.composerRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  };
  // No upfront "just the answer / learn this too" toggle: intent is declared by what you choose to own,
  // and confidence by what you predict. Every answer can be owned.
  // starter: a home quick-start prompt. Its answer streams in, so you watch Claude write it.
  sendText(text, scenario, followUp = false, starter = null) {
    const learn = true;
    const m = { id: this.nid(), scenario, question: text, followUp, starter: !!starter, recorded: starter && starter.recorded };
    // A question you bring from a try or a recall ("About my…") is asking, not outsourcing: no go-first offer.
    const firstOfChat = !this.state.messages.length && !this.state.activeGap && !scenario && !m.starter && !/^About (my|this)/.test(text);
    const msgs = this.state.messages.concat([{ id: this.nid(), type: 'user', text }, { id: this.nid(), type: 'thinking' }]);
    this.setState({ messages: msgs, composer: '', chatTitle: this.state.messages.length ? this.state.chatTitle : (scenario ? scenario.title : text.slice(0, 40)) },
      () => (firstOfChat && this.ownedTitles().length ? this.answerOrGoFirst(m, learn) : this.answer(m, learn)));
  }

  // ---------- you go first, when you ask again ----------
  // A new question that needs something you own is the moment you'd normally outsource it. Claude checks that
  // (one small call, run alongside the answer so nothing waits) and, if it does, offers you the first try.
  // Claude's answer is ready behind it either way. Questions about understanding don't trigger this: it only
  // looks at the first question of a new chat.
  ownedTitles() { return [...new Set(this.state.ledger.filter(e => e.kind === 'gap' || e.actual != null).map(e => e.title))].slice(-12); }
  async answerOrGoFirst(m, learn) {
    const owned = this.ownedTitles();
    const replyP = this.fetchReply(m);
    let hit = null;
    try { const r = await this.ask('goFirstMatch', { question: m.question, owned }); hit = r.match >= 1 && r.match <= owned.length ? owned[r.match - 1] : null; } catch (e) { hit = null; }
    if (!hit) return this.showReply(m, learn, await replyP);
    const id = this.nid();
    this.setState(s => ({ messages: s.messages.filter(x => x.type !== 'thinking').concat([{ id, type: 'goAsk', owned: hit, question: m.question, phase: 'offer', text: '', reply: null, note: '', at: Date.now() }]) }));
    replyP.then(reply => this.setGo(id, { reply, m, learn }));
  }
  goAskNote(id, rec) { const g = this.state.messages.find(x => x.id === id); const e = this.state.ledger.slice().reverse().find(x => x.title === g.owned); if (e) this.setState(s => ({ ledger: s.ledger.map(x => x.id === e.id ? { ...x, realWork: (x.realWork || []).concat([rec]) } : x) })); }
  goAskAnswer = id => { this.setGo(id, { phase: 'answered' }); this.goAskNote(id, { outsourced: true }); };
  goAskSubmit = async id => {
    const g = this.state.messages.find(x => x.id === id); if (!g.text.trim() || g.phase !== 'try') return;
    this.setGo(id, { phase: 'checking' }); this.goAskNote(id, { wentFirst: true });
    const reply = g.reply || await new Promise(res => { const t = setInterval(() => { const x = this.state.messages.find(y => y.id === id); if (x && x.reply) { clearInterval(t); res(x.reply); } }, 200); });
    let note = '';
    try { note = await this.ask('goFirstCompare', { question: g.question, attempt: g.text, answer: [reply.intro, reply.code, reply.outro].filter(Boolean).join('\n\n') }); } catch (e) { note = ''; }
    this.setGo(id, { phase: 'done', note });
  };
  // The conversation so far, as API turns: user/assistant alternating, starting with the user, recent turns first
  // when it's long (the server caps input size).
  chatHistory() {
    const turns = [];
    for (const x of this.state.messages) {
      if (x.type === 'user') turns.push({ role: 'user', content: x.text });
      else if (x.type === 'assistant' && (x.code || x.intro)) turns.push({ role: 'assistant', content: [x.intro, x.code, x.outro].filter(Boolean).join('\n\n') });
    }
    const merged = [];
    for (const t of turns) { const last = merged[merged.length - 1]; if (last && last.role === t.role) last.content += '\n\n' + t.content; else merged.push({ ...t }); }
    const out = []; let total = 0;
    for (let i = merged.length - 1; i >= 0; i--) { total += merged[i].content.length; if (total > 8000 && out.length) break; out.unshift(merged[i]); }
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }
  async answer(m, learn) {
    const id = this.nid();
    const reply = await this.fetchReply(m, m.starter ? t => this.streamInto(id, m, learn, t) : null);
    this.showReply(m, learn, reply, id);
  }
  // The answer so far, shown as it streams in (replacing the thinking dots). showReply puts the finished one in its place.
  streamInto(id, m, learn, text) {
    this.setState(s => ({ messages: s.messages.some(x => x.id === id)
      ? s.messages.map(x => (x.id === id ? { ...x, code: text } : x))
      : s.messages.filter(x => x.type !== 'thinking').concat([{ id, type: 'assistant', learn, at: Date.now(), askedId: null, intro: '', code: text, lang: 'text', outro: '', scenario: m.scenario || null, plain: true, streaming: true }]) }));
  }
  async fetchReply(m, onText) {
    let reply;
    const gap = this.state.activeGap ? this.state.gaps.find(g => g.id === this.state.activeGap) : null;
    try {
      const t = String(await complete({ task: 'chat', input: gap ? { gap } : { mode: m.followUp ? 'followUp' : 'answer' }, messages: this.chatHistory().filter(x => x.content), onText })).trim();
      reply = { intro: '', code: t, lang: (t.match(/```(\w+)/) || [])[1] || 'text', outro: '', scenario: m.scenario || null, plain: true };
    } catch (e) {
      // Offline, the cold-start gap still gets a real explanation (hand-written), so the loop can be demoed.
      const first = !this.state.messages.some(x => x.type === 'assistant');
      reply = gap && isColdStart(gap) && first ? { intro: '', code: COLD_START.offlineAnswer, lang: 'text', outro: '', scenario: null, plain: true }
        : m.recorded ? { intro: '', code: m.recorded, lang: m.scenario.lang, outro: "(I couldn't reach the model just now, so this is Claude's saved answer to the same question.)", scenario: m.scenario, plain: true }
        : { intro: "I couldn't reach the model just now. Try again in a moment, or open a past chat in the sidebar.", code: '', lang: '', outro: '', scenario: null };
    }
    return reply;
  }
  showReply(m, learn, reply, id = this.nid()) {
    const followUp = this.canOfferOwn();
    this.setState(s => ({ messages: s.messages.filter(x => x.type !== 'thinking' && x.id !== id).concat([{ id, type: 'assistant', learn, at: Date.now(), askedId: null, ...reply }]) }));
    // Trying to understand something is the moment to offer Own it: Claude judges that from the message.
    if (reply.plain && followUp) this.inferLearning(m.question, reply.code, id);
  }
  canOfferOwn() { return !this.state.activeGap && this.state.messages.filter(x => x.type === 'assistant').length >= 1; }
  // Is this follow-up working to get better at something (why/how, "I'm confused", applying it), not a curious aside or a request?
  // Judged from the latest message only: with earlier questions as context, every follow-up looked like learning (process log 54).
  // Claude decides and names it; keyword matching is only the fallback when Claude can't be reached. It only ever offers.
  async inferLearning(text, answer, msgId) {
    let learning = false, topic = '';
    try {
      const r = await this.ask('inferLearning', { text, answer });
      learning = !!r.learning; topic = r.topic || '';
    } catch (e) { learning = this.isExplainAsk(text); }
    if (!learning) return;
    const a = this.recordAsked(text, msgId, topic);
    this.setGo(msgId, { askedId: a.id });
  }
  // A follow-up that asks Claude to explain (the "Ask Claude" quote, or wording like "how does this work").
  isExplainAsk(text) {
    return /^About this part of your answer:/.test(text) || /\bexplain|how (is|does|do|did) (this|that|it)|why (is|does|do)|what does|what happens|walk me through|(don't|dont|do not) (get|understand)|confus|more detail/i.test(text);
  }
  recordAsked(text, msgId, topic = '') {
    const quote = (text.match(/^> .*$/gm) || []).map(l => l.slice(2)).join('\n');
    const question = text.replace(/^About this part of your answer:\n?/, '').replace(/^> .*\n?/gm, '').trim();
    const first = this.state.messages.find(x => x.type === 'assistant');
    const a = { id: 'a' + this.nid(), msgId, quote, question, scenario: first ? first.scenario : null, chatTitle: this.state.chatTitle, at: this.now(), label: '', checked: false };
    this.setState(s => ({ asked: s.asked.concat([a]) }));
    // Name it as a learning target (a short phrase) for Learnings; the matched hand-written target wins when there is one.
    const t = this.matchTarget(a);
    if (t) this.setAsked(a.id, { label: t.label, focus: t });
    else if (topic) this.setAsked(a.id, { label: topic });
    else this.ask('askedLabel', { quote, question })
      .then(r => this.setAsked(a.id, { label: r.label }))
      .catch(() => this.setAsked(a.id, { label: (question || quote).split(/[.?!\n]/)[0].slice(0, 60) }));
    return a;
  }
  setAsked(id, patch) { this.setState(s => ({ asked: s.asked.map(a => a.id === id ? { ...a, ...patch } : a) })); }
  // A hand-written target that fits what was asked about, if any (same matching as highlights).
  matchTarget(a) {
    const text = `${a.quote}\n${a.question}`, sc = a.scenario;
    const opts = sc === this.SQL ? sqlFocusOptions(text) : sc === this.BOOK ? bookFocusOptions(text) : sc === this.JUNO ? junoFocusOptions(text) : [];
    if (opts.length && !(sc === this.SQL && opts[0].target === 'whole')) return opts[0];
    if (sc === this.REACT && /useEffect|\.abort\(|cleanup|new AbortController|\[userId\]|return \(\) =>|dependency array|rerun|race condition/i.test(text)) return { label: REACT_TARGETS.timing.label, mode: 'sequence', target: 'timing' };
    return null;
  }
  // Own it, from an explanation you asked for (the same action as the icon, another way in). Claude's explanation is the material; no focus question.
  checkLanded = askedId => {
    const a = this.state.asked.find(x => x.id === askedId); if (!a || this.state.own) return;
    const m = this.state.messages.find(x => x.id === a.msgId) || { id: a.msgId, scenario: a.scenario, code: a.quote || a.question, lang: 'text', plain: true };
    const focus = a.focus || { label: a.label || (a.question || a.quote).slice(0, 60), mode: 'concept' };
    this.setAsked(a.id, { checked: true });
    this.setState({ view: 'chat' }, () => this.beginOwn({ ...m, scenario: a.scenario || m.scenario, code: [m.code, a.quote].filter(Boolean).join('\n\n') }, a.quote || a.question, focus, 'landed'));
  };

  copyAnswer(m) { try { navigator.clipboard.writeText([m.intro, m.code, m.outro].filter(Boolean).join('\n\n')); } catch (e) { /* clipboard blocked */ } this.setState({ copied: m.id }); setTimeout(() => this.setState(s => s.copied === m.id ? { copied: null } : null), 1500); }
  speakAnswer(m) {
    const sy = window.speechSynthesis; if (!sy) return;
    if (sy.speaking) { sy.cancel(); return; }
    sy.speak(new SpeechSynthesisUtterance([m.intro, m.code, m.outro].filter(Boolean).join('. ')));
  }

  // ---------- you go first ----------
  // The ledger entry that unlocks a go-first question: the latest thing you owned that it needs.
  ownedFor(key) { return this.state.ledger.slice().reverse().find(e => GO_FIRST[key].targets.includes(e.own.focus && e.own.focus.target)); }
  startGoFirst(key) {
    const g = GO_FIRST[key];
    this.setState({ messages: [{ id: this.nid(), type: 'user', text: g.question }, { id: this.nid(), type: 'goFirst', key, phase: 'offer', prediction: null, text: '', picked: {}, grade: null, at: Date.now() }], chatTitle: g.chip.split(' · ')[1], own: null, sel: null, composer: '', view: 'chat', activeGap: null });
  }
  setGo(id, patch) { this.setState(s => ({ messages: s.messages.map(m => m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m) })); }
  // Record what you did in real work on the ledger entry that unlocked it: went first (with a score) or let Claude answer.
  noteRealWork(key, rec) { const e = this.ownedFor(key); if (!e) return; this.setState(s => ({ ledger: s.ledger.map(x => x.id === e.id ? { ...x, realWork: (x.realWork || []).concat([rec]) } : x) })); }
  goOutsource(m) { this.setGo(m.id, { phase: 'answered' }); this.noteRealWork(m.key, { outsourced: true }); }
  async goCheck(m) {
    const g = GO_FIRST[m.key];
    if (g.check.type === 'choice' ? !Object.keys(m.picked).length : !m.text.trim()) return;
    this.setGo(m.id, { checking: true });
    const r = await runCheck(g.check, m.text, '', '', m.picked);
    this.setGo(m.id, { checking: false, grade: r, phase: 'done' });
    const t = tally(r);
    this.noteRealWork(m.key, { predicted: m.prediction, actual: t.right, n: t.n });
  }

  // ---------- selection ----------
  onCodeMouseUp(m, e) {
    const s = window.getSelection(); const t = s ? s.toString().trim() : '';
    if (!t || !m.learn || this.state.own) { if (this.state.sel) this.setState({ sel: null }); return; }
    this.setState({ sel: { text: t, x: e.clientX, y: e.clientY, msg: m } });
  }
  // Highlight → "Ask Claude": quote it into the chat and ask. Explanation is what the chat already does well.
  askSelection = () => { const s = this.state.sel; if (!s) return; const ws = window.getSelection(); if (ws) ws.removeAllRanges(); this.setState({ sel: null, composer: `About this part of your answer:\n> ${s.text.replace(/\n/g, '\n> ')}\n\n` }, () => { const el = this.composerRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); };
  ownSelection = () => { const s = this.state.sel; if (!s) return; this.setState({ sel: null }); const ws = window.getSelection(); if (ws) ws.removeAllRanges(); this.beginOwn(s.msg, s.text); };
  // Ask about the current step, in context
  stepContext() {
    const o = this.state.own; if (!o) return '';
    let c = `Code being learned (${o.lang}):\n${o.code}\n` + (o.focus ? `What the learner wants to own: ${o.focus.label}\n` : '');
    if (o.phase === 'ladder' && o.step === 'see' && o.see) { const s = o.see[o.seeIdx]; c += `Current step in the run-through: "${s.title}". Explanation shown: ${s.note}`; if (s.rows) c += `\nTable shown (${s.headers.join(', ')}):\n` + s.rows.map(r => r.cells.join(' | ') + (r.dim ? '  [dropped]' : '')).join('\n'); }
    else if (o.phase === 'ladder' && o.step === 'assemble' && o.asm) { const byId = {}; o.asm.pieces.forEach(p => byId[p.id] = p); c += 'Current step: ordering shuffled lines. Their version so far:\n' + (o.asm.seq.map(id => byId[id].text).join('\n') || '(empty)'); }
    else if (o.phase === 'ladder' && o.step === 'write') c += `Current step: writing from scratch. Task: ${o.write.task}\nDraft:\n${o.write.text || '(empty)'}\nDo NOT write the solution for them; explain concepts and nudge.`;
    else if (o.phase === 'ladder' && o.step === 'compare' && o.cmp && o.cmp.cases[o.cmp.idx]) { const k = o.cmp.cases[o.cmp.idx]; c += `Current step: comparing alternatives. Showing "${k.label}":\n${k.code}\n` + (o.cmp.revealed[o.cmp.idx] ? `Result shown: ${k.rows ? k.rows.length + ' rows' : k.answerText || k.outcome}. ${k.note}` : 'Result not revealed yet; do not give it away.'); }
    else c += 'Current phase: ' + o.phase;
    return c;
  }
  askStep = async (text) => {
    const o = this.state.own; const q = (text || '').trim(); if (!o || !q) return;
    const qa = o.qa.concat([{ q, a: '', loading: true }]);
    this.setOwn({ qa, qaInput: '' });
    let a;
    try { a = await this.ask('stepQA', { context: this.stepContext(), question: q }); }
    catch (e) { a = "I can't reach the model right now. Try again in a moment, or move on and come back."; }
    this.setOwn(cur => ({ qa: cur.qa.map((x, i) => i === qa.length - 1 ? { q, a, loading: false } : x) }));
  };
  // focus: pass one when the entry point already says what to own ("Own the whole query"); the focus question is then skipped.
  beginOwn(m, code, focus = null, entry = 'own') {
    const sc = m.scenario;
    const i = this.state.messages.findIndex(x => x.id === m.id);
    const asked = this.state.messages.slice(0, i).reverse().find(x => x.type === 'user');
    const own = { id: this.nid(), msgId: m.id, question: asked ? asked.text : '', concept: null, scenario: sc, lang: m.lang, code, prediction: null, phase: focus ? 'predict' : 'focus', focus, focusOptions: null, focusOther: '', cmp: null, step: 'read', startStep: 'read', visited: {}, see: null, seeIdx: 0, seeLoading: false, bridges: null, asm: null, write: { task: '', ref: '', schema: '', before: '', after: '', placeholder: '', check: null, authoredHints: null, text: '', hints: [], hintLoading: false, grade: null, loading: false, gradeLoading: false, picked: {}, attempts: 0, firstGrade: null }, teach: { msgs: [], input: '', turns: 0, loading: false }, fullCode: m.code, qa: [], qaInput: '', taught: !!m.plain && !(sc && sc.taughtInChat === false), askedFocus: !focus, entry };
    this.setState({ own, tipDismissed: true, messages: this.state.messages.concat([{ id: own.id, type: 'own' }]) }, () => { if (!focus) this.loadFocusOptions(); else this.loadWriteTask(); });
  }

  // ---------- focus: what exactly does the learner want to own? ----------
  // sequence = owning a structure (order matters: read, see, assemble, write)
  // concept  = owning one construct (read, compare against alternatives, write)
  isMultiLine(code) { return code.split('\n').filter(l => l.trim()).length >= 3; }
  async loadFocusOptions() {
    const o = this.state.own;
    const authored = o.scenario === this.SQL ? sqlFocusOptions(o.code) : o.scenario === this.BOOK ? bookFocusOptions(o.code) : o.scenario === this.JUNO ? junoFocusOptions(o.code) : [];
    const TIMING = { label: 'When the cleanup runs, and why it aborts the request', mode: 'sequence', target: 'timing' };
    const reactTiming = o.scenario === this.REACT && /useEffect|\.abort\(|cleanup|new AbortController|\[userId\]|return \(\) =>|dependency array|rerun|race condition/i.test(o.code);
    if (authored.length) { this.setOwn({ focusOptions: authored }); return; }
    // Offline fallback still names what was highlighted (its first words), so it never reads as unrelated.
    const part = o.code.trim().split('\n')[0].replace(/[;,]\s*$/, '').split(/\s+/).slice(0, 4).join(' ');
    const prose = !!(o.scenario && o.scenario.prose);
    const fallback = prose ? [{ label: `What “${o.code.trim().split(/\s+/).slice(0, 6).join(' ')}…” means`, mode: 'concept' }] : [
      { label: `What ${part} does and when to use it`, mode: 'concept' },
      ...(this.isMultiLine(o.code) ? [{ label: "The whole thing: each part and why it's in that order", mode: 'sequence', whole: true }] : []),
      ...(o.scenario === this.SQL ? [{ label: SQL_TARGETS.whole.label, mode: 'sequence', target: 'whole' }] : []),
    ];
    try {
      const r = await this.ask('focusOptions', { lang: o.lang, fullCode: o.fullCode, code: o.code });
      const opts = (r.options || []).filter(x => x && x.label).slice(0, 3).map(x => ({ label: x.label, mode: x.mode === 'sequence' ? 'sequence' : 'concept' }));
      this.setOwn({ focusOptions: reactTiming ? [TIMING].concat(opts.slice(0, 2)) : opts.length ? opts : fallback });
    } catch (e) { this.setOwn({ focusOptions: reactTiming ? [TIMING].concat(fallback.slice(0, 1)) : fallback }); }
  }
  // What "Own the whole …" means: the authored whole-query target on the SQL starter, a structure focus otherwise.
  wholeFocus(m) {
    if (m.scenario === this.SQL) return { label: SQL_TARGETS.whole.label, mode: SQL_TARGETS.whole.kind, target: 'whole' };
    if (m.scenario === this.BOOK) return { label: BOOK_TARGETS.rule.label, mode: BOOK_TARGETS.rule.kind, target: 'rule' };
    // React's lesson is when things run, not writing the component (reactTargets.js), so the whole answer owns that.
    if (m.scenario === this.REACT) return { label: REACT_TARGETS.timing.label, mode: REACT_TARGETS.timing.kind, target: 'timing' };
    if (m.scenario === this.JUNO) return { label: JUNO_TARGETS.ownside.label, mode: JUNO_TARGETS.ownside.kind, target: 'ownside' };
    return { label: "The whole thing: each part and why it's in that order", mode: this.isMultiLine(m.code) ? 'sequence' : 'concept', whole: true };
  }
  changeFocus = () => { this.setOwn({ phase: 'focus', focus: null, askedFocus: true }, () => { if (!this.state.own.focusOptions) this.loadFocusOptions(); }); };
  // The try is prepared as soon as the focus is known, so the prediction can say what you'll be asked to do.
  pickFocus(focus) {
    const changed = !this.state.own.focus || this.state.own.focus.label !== focus.label;
    this.setOwn(cur => ({ focus, phase: 'predict', ...(changed ? { write: { ...cur.write, task: '', ref: '', schema: '', before: '', after: '', placeholder: '', check: null, authoredHints: null, format: null } } : {}) }), () => this.loadWriteTask());
  }
  // The hand-written learning target for this focus, if there is one (see targets.js).
  targetOf(o = this.state.own) { return o && o.focus && o.focus.target ? TARGETS[o.focus.target] || null : null; }
  submitFocusOther = () => {
    const o = this.state.own; const label = o.focusOther.trim(); if (!label) return;
    // Free text on the SQL starter still maps to a hand-written target when it clearly names one.
    const t = o.scenario === this.JUNO ? (/own|both|side|writer|reader|leave|follow/i.test(label) ? 'ownside' : /commoditi|scarce|mechanism|result/i.test(label) ? 'mechanism' : null)
      : o.scenario === this.BOOK ? (/population|sample|obvious|trivial/i.test(label) ? 'population' : /93|five|5|why|work|chance|percent/i.test(label) ? 'rule' : null)
      : o.scenario !== this.SQL ? null : /where|\bon\b|paid|status|filter/i.test(label) ? 'onwhere' : /join|left|right|inner/i.test(label) ? 'joins' : null;
    this.pickFocus({ label, mode: t || !this.isMultiLine(o.code) ? 'concept' : 'sequence', target: t || undefined });
  };
  // The steps for this focus, in order. Assemble needs enough lines for order to mean something.
  // Reading happens in Claude's answer (still visible beside the panel), so there's no separate Read step.
  // Concepts compare alternatives. Sequences watch it run; Assemble only where order is the insight (SQL).
  // Claude's answer is the reading. Own-it is the try: you go straight to a new case. A visual is offered
  // only where there's one worth seeing (and that chat can't easily show); it's optional, never the path.
  // The Own-it framework (research §8f): each target declares three answers, and the steps follow from them.
  //   producingIsSkill    → how the try is checked (in the target's check)
  //   writtenOrderMatters → Arrange as a warm-up (first after a 1–2 prediction, otherwise optional; never scored)
  //   visual              → an optional picture chat can't give ('compare' | 'see' | 'timeline'), or none
  // Generated tries answer the same questions (see loadWriteTask).
  frame(o = this.state.own) {
    const t = this.targetOf(o);
    if (t) return { orderMatters: !!t.writtenOrderMatters, visual: t.visual || null };
    return { orderMatters: !!(o.write && o.write.orderMatters) && o.code.split('\n').filter(l => l.trim()).length >= 3, visual: null };
  }
  // The panel no longer shows visuals (log 83): seeing it another way is a different explanation, and explaining is
  // the chat's job (research §8f). Targets still declare their visual, and the Compare and timeline steps are kept
  // for moving into the chat (§12); nothing in the panel leads to them.
  visualStep() { return null; }
  ladder(o = this.state.own) { const f = this.frame(o), v = this.visualStep(o); return [...(f.orderMatters ? ['assemble'] : []), ...(v ? [v] : []), 'write']; }
  // Leaving a visual goes to the try, or back to the reveal if you've already checked.
  goNext = () => { if (this.state.own.write.grade) return this.setOwn({ phase: 'reveal' }); const L = this.ladder(), i = L.indexOf(this.state.own.step); if (i >= 0 && i < L.length - 1) this.enterStep(L[i + 1]); };
  goVisual = () => { const v = this.visualStep(); if (v) this.enterStep(v); };
  // patch can be an object, or a function of the latest own state (use that after an await,
  // where this.state may not include updates queued before the await yet).
  setOwn(patch, cb) { this.setState(s => ({ own: { ...s.own, ...(typeof patch === 'function' ? patch(s.own) : patch) } }), cb); }
  cancelOwn = () => this.setState({ own: null, messages: this.state.messages.filter(x => x.type !== 'own') });
  // "Back to chat" from anywhere. Nothing predicted yet → nothing to keep. Already checked → same as finishing.
  // Otherwise leave a one-line note in the chat: stopping is a real choice (outsourcing it), not a failure.
  // Exits are kept as their own data (where people back out, after predicting what), outside the calibration math.
  leaveOwn = () => {
    const o = this.state.own;
    if (o.prediction == null) return this.cancelOwn();
    if (o.write && (o.write.grade || o.write.firstGrade)) return this.finishOwn();
    const L = this.ladder(o), at = stepLabel(o, o.step) || 'the start';
    const n = this.plannedItems(o).length;
    const summary = `${o.focus ? o.focus.label : o.lang} · predicted ${o.prediction} of ${n}, stopped at ${at}`;
    const exit = { id: o.id, title: o.focus ? o.focus.label : o.lang, predicted: o.prediction, n, step: at, stepOf: `${L.indexOf(o.step) + 1} of ${L.length}`, startStep: stepLabel(o, o.startStep), scenario: o.scenario };
    this.setState({ own: null, exits: this.state.exits.concat([exit]), messages: this.state.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', doneLabel: 'Outsourced', summary } : m) });
  };
  // "I have no idea" (before predicting) or predicting under half says "not ready yet": that's a moment for
  // explanation, which is the chat's job (the chat explains; the panel checks and reinforces). It goes back to the
  // main chat with the message written for you, asking Claude to explain it another way. It names no format: the chat
  // prompt lists what the chat can show (tables, flip-through views…) and Claude picks what fits the topic, which
  // works for SQL and React and for a people skill like leadership (log 84). Predicting stays in the panel. Someone with no idea doesn't know what to ask
  // yet, so here the app does put words in your mouth (unlike "Ask Claude about this" after a try). It's not
  // counted as a miss: Own it is offered again under the explanation.
  askClaudeFirst = () => {
    const o = this.state.own, n = this.plannedItems(o).length, label = o.focus ? o.focus.label : o.lang;
    const part = o.code !== o.fullCode && o.code.length <= 400 ? o.code : '';
    const ask = "I don't really get this yet. Can you explain it another way, with a concrete example, in whatever form makes it clearest?";
    const text = part ? `About this part of your answer:\n${part.split('\n').map(l => '> ' + l).join('\n')}\n\n${ask}` : `About “${label}”: ${ask}`;
    const exit = { id: o.id, title: label, predicted: o.prediction, n, step: 'asked Claude first', askedFirst: true, stepOf: '', startStep: stepLabel(o, o.startStep), scenario: o.scenario };
    this.setState({ own: null, composer: text, exits: this.state.exits.concat([exit]),
      messages: this.state.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', doneLabel: 'Asked Claude first', summary: o.prediction == null ? label : `${label} · predicted ${o.prediction} of ${n}` } : m) },
      () => { const el = this.composerRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  };
  // What the try will check, known before you try it: the prediction is "how many of these N will you get right?".
  // Only N is shown when you predict; the items themselves would give the answer away.
  plannedItems(o = this.state.own) {
    const w = o.write, c = w.check;
    if (c && c.type === 'choice') return c.questions.map(q => q.short || q.prompt);
    if (c && c.type === 'steps') return c.steps.map(st => st.label);
    if (c && c.type === 'sql') return c.items && c.items.length ? c.items.map(i => i.short) : ['Returns the right rows'];
    if (c && c.type === 'number') return c.expected.map((v, i) => (c.labels ? c.labels[i] : 'The number'));
    if (c && c.type === 'explain') return c.keyPoints.length ? c.keyPoints : ['Explains the idea and applies it'];
    return w.requirements && w.requirements.length ? w.requirements : ['Meets the task'];
  }
  // The same items, named so they can be shown before the try without giving answers away. A code try's requirements
  // are its spec, so they're shown as they are; an explanation's key ideas would be answers, so it shows their
  // neutral topics. null only when there's nothing safe to show, and then only the count is shown.
  plannedTopics(o = this.state.own) {
    const c = o.write.check;
    if (c && c.type === 'explain') return c.topics && c.topics.length === c.keyPoints.length && c.keyPoints.length ? c.topics : null;
    if (!c && o.write.requirements && o.write.requirements.length) return o.write.requirements;
    if (c && c.type === 'choice') return c.questions.map(q => q.short || q.prompt);
    if (c && c.type === 'steps') return c.steps.map(st => st.label);
    if (c && c.type === 'sql' && c.items && c.items.every(i => i.topic)) return c.items.map(i => i.topic);
    if (c && c.type === 'number' && c.labels) return c.labels;
    return null;
  }
  pickPrediction(n) {
    // After a chat that already taught it, everyone starts at the test; the visual stays one click away.
    // Arrange first only when the written order is the insight and you predicted you'd get under half right.
    const low = n / this.plannedItems().length < 0.5;
    const start = this.frame().orderMatters && low ? 'assemble' : 'write';
    this.setOwn({ prediction: n, phase: 'ladder', step: start, startStep: start, refresherOpen: low }, () => this.enterStep(start));
  }
  enterStep(step) {
    const o = this.state.own; const visited = { ...o.visited, [step]: (o.visited[step] || 0) + 1 };
    this.setOwn({ step, visited });
    if (step === 'see') this.loadSee();
    if (step === 'assemble') this.buildAsm();
    if (step === 'compare') { this.loadConcept(); this.loadCompare(); }
    if (step === 'write') this.loadWriteTask();
  }

  // Read it, for a concept focus: mental model, what differs between the alternatives, why it fits here, rule of thumb.
  async loadConcept() {
    const o = this.state.own; if (o.concept || !o.focus || o.focus.mode !== 'concept') return;
    const t = this.targetOf(o);
    if (t && t.explain) { this.setOwn({ concept: t.explain }); return; }
    this.setOwn({ concept: { loading: true } });
    try {
      const r = await this.ask('concept', { label: o.focus.label, question: o.question, lang: o.lang, fullCode: o.fullCode, code: o.code });
      this.setOwn({ concept: { model: r.model, grid: r.grid && Array.isArray(r.grid.rows) ? r.grid : null, inYourCode: r.inYourCode, rule: r.rule } });
    } catch (e) { this.setOwn({ concept: null }); }
  }

  // Compare it: the construct next to its closest alternatives; the learner predicts each result first.
  async loadCompare() {
    const o = this.state.own; if (o.cmp) return;
    const fresh = set => ({ ...set, idx: 0, guesses: {}, revealed: {} });
    const t = this.targetOf(o);
    if (t && t.compare) { this.setOwn({ cmp: fresh(t.compare) }); return; }
    this.setOwn({ cmp: { loading: true, cases: [], idx: 0, guesses: {}, revealed: {} } });
    try {
      const r = await this.ask('compare', { label: o.focus ? o.focus.label : '', lang: o.lang, code: o.code, fullCode: o.fullCode });
      this.setOwn({ cmp: fresh({ intro: r.intro, cases: (r.cases || []).slice(0, 4) }) });
    } catch (e) { this.setOwn({ cmp: fresh({ intro: "I couldn't build a comparison offline. Move on to writing, or ask a question below.", cases: [] }) }); }
  }
  setCmp(patch) { this.setOwn(cur => ({ cmp: { ...cur.cmp, ...(typeof patch === 'function' ? patch(cur.cmp) : patch) } })); }
  // A guess is right when it matches the case's answer: a row count, or a picked value.
  cmpIsRight(k, guess) { return k.rows ? guess === k.rows.length : k.answer != null && guess === k.answer; }
  cmpGuess(i, guess) { this.setCmp(c => ({ guesses: { ...c.guesses, [i]: guess }, revealed: { ...c.revealed, [i]: true } })); }
  goSee = () => this.enterStep('see');
  goAssemble = () => this.enterStep('assemble');
  goWrite = () => (this.state.own.write.grade ? this.setOwn({ phase: 'reveal' }) : this.enterStep('write'));


  // See it
  sqlSteps() {
    const names = Object.keys(this.CUSTOMERS).map(k => this.CUSTOMERS[k]);
    const orders = this.ORDERS.map(r => ({ id: r[0], name: this.CUSTOMERS[r[1]], total: r[2], status: r[3] }));
    // LEFT JOIN with paid in ON: every customer, plus a NULL row when no paid order matches
    const joined = []; names.forEach(n => { const mine = orders.filter(o => o.name === n && o.status === 'paid'); if (mine.length) mine.forEach(o => joined.push({ name: n, id: o.id, total: o.total, status: o.status, isNull: false })); else joined.push({ name: n, id: null, total: null, status: null, isNull: true }); });
    const sums = {}; joined.forEach(r => { if (!r.isNull) sums[r.name] = (sums[r.name] || 0) + r.total; });
    const g = names.map(n => ({ name: n, revenue: sums[n] == null ? null : sums[n] }));
    const sorted = g.map(r => ({ name: r.name, revenue: r.revenue == null ? 0 : r.revenue })).sort((a, b) => b.revenue - a.revenue);
    const HC = ['name'], HJ = ['name', 'order', 'total', 'status'], H2 = ['name', 'revenue'];
    const RJ = (dim) => joined.map(r => ({ cells: [r.name, r.isNull ? 'NULL' : r.id, r.isNull ? 'NULL' : '$' + r.total, r.isNull ? 'NULL' : r.status], dim: dim ? dim(r) : false }));
    return [
      { clause: 'FROM customers', title: 'FROM customers c', note: 'Start from every customer, six rows. Starting here, not from orders, is what makes "include customers with nothing" possible.', headers: HC, rows: names.map(n => ({ cells: [n], dim: false })) },
      { clause: 'LEFT JOIN orders ON …', title: "LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'", note: 'Each customer gets one row per paid order that matches. Cy only has refunded orders and Fay has none, so neither matches anything. LEFT means they stay anyway, with NULL in the order columns.', headers: HJ, rows: RJ() },
      { clause: 'vs. plain JOIN', contrast: true, title: 'If this were a plain JOIN instead', note: 'A plain (inner) JOIN keeps only rows that matched on both sides. Cy and Fay have no match, so they vanish from the result entirely. That is the problem LEFT JOIN fixes: it keeps the left table even when the right side comes up empty.', headers: HJ, rows: RJ(r => r.isNull) },
      { clause: "vs. 'paid' in WHERE", contrast: true, title: "If status = 'paid' were in WHERE instead of ON", note: "WHERE runs after the join, on the rows you see here. Cy and Fay's rows have status NULL, and NULL = 'paid' is not true, so WHERE throws them away. You are back to the plain JOIN result. Putting the filter in ON means it only decides what counts as a match, and a customer with no match still survives.", headers: HJ, rows: RJ(r => r.isNull) },
      { clause: 'GROUP BY', title: 'GROUP BY c.name', note: 'Collapse to one row per customer. SUM over Cy and Fay\'s NULL rows is NULL, not 0.', headers: H2, rows: g.map(r => ({ cells: [r.name, r.revenue == null ? 'NULL' : '$' + r.revenue], dim: false })) },
      { clause: 'SELECT … COALESCE', title: 'SELECT c.name, COALESCE(SUM(o.total), 0) AS revenue', note: 'COALESCE replaces the NULL sums with 0 and names the column revenue, which is why ORDER BY can use it.', headers: H2, rows: g.map(r => ({ cells: [r.name, '$' + (r.revenue == null ? 0 : r.revenue)], dim: false })) },
      { clause: 'ORDER BY', title: 'ORDER BY revenue DESC', note: 'Sort, biggest first. All six customers are present, including the two with $0.', headers: H2, rows: sorted.map(r => ({ cells: [r.name, '$' + r.revenue], dim: false })) }
    ];
  }
  async loadSee() {
    const o = this.state.own; if (o.see) return;
    if (this.frame(o).visual === 'timeline') { this.setOwn({ see: [], timeline: true, seeIdx: 0, seeLoading: false }); return; }
    const isSql = o.lang === 'sql' && o.scenario === this.SQL;
    if (isSql) {
      this.setOwn({ see: this.sqlSteps(), seeIdx: 0, bridges: null, seeLoading: false });
      try { const b = await this.ask('sqlBridges', { code: o.code }); this.setOwn({ bridges: b }); }
      catch (e) { this.setOwn({ bridges: this.SQL.bridges }); }
      return;
    }
    if (o.scenario && o.scenario.seeSteps && o.code === o.fullCode) { this.setOwn({ see: o.scenario.seeSteps.map(s => ({ ...s, headers: null })), bridges: o.scenario.bridges, seeIdx: 0, seeLoading: false }); return; }
    this.setOwn({ seeLoading: true });
    try {
      const r = await this.ask('runSteps', { lang: o.lang, code: o.code });
      this.setOwn({ see: r.steps.map(s => ({ clause: s.clause, title: s.title, note: s.note, headers: null, rows: null })), bridges: r.bridges, seeIdx: 0, seeLoading: false });
    } catch (e) {
      const lines = o.code.split('\n').filter(l => l.trim());
      this.setOwn({ see: lines.map((l, i) => ({ clause: l.trim(), title: 'Step ' + (i + 1), note: l.trim(), headers: null, rows: null })), bridges: [], seeIdx: 0, seeLoading: false });
    }
  }
  seePrev = () => { const o = this.state.own; if (o.seeIdx > 0) this.setOwn({ seeIdx: o.seeIdx - 1 }); };
  seeNext = () => { const o = this.state.own; if (o.seeIdx < o.see.length - 1) this.setOwn({ seeIdx: o.seeIdx + 1 }); };

  // Assemble it
  buildAsm() {
    const o = this.state.own; if (o.asm) return;
    const t = this.targetOf(o), spec = t && t.assemble;
    const lines = spec ? spec.lines : o.code.split('\n').filter(l => l.trim());
    const pieces = lines.map((l, i) => ({ id: 'p' + i, text: l, correct: i }));
    const distractor = spec && spec.distractor ? { id: 'dx', text: spec.distractor, correct: -1 } : null;
    if (distractor) pieces.push(distractor);
    const bank = pieces.map(p => p.id).sort(() => Math.random() - 0.5);
    this.setOwn({ asm: { pieces, bank, seq: [], attempts: 0, mistakes: 0, usedDistractor: false, feedback: '', correct: false, why: '', loading: false, lastWrong: [] } });
  }
  setAsm(patch) { this.setOwn(cur => ({ asm: { ...cur.asm, ...patch } })); }
  asmAdd(id) { const a = this.state.own.asm; this.setAsm({ bank: a.bank.filter(x => x !== id), seq: a.seq.concat([id]), feedback: '', lastWrong: [] }); }
  asmRemove(id) { const a = this.state.own.asm; this.setAsm({ seq: a.seq.filter(x => x !== id), bank: a.bank.concat([id]), feedback: '', lastWrong: [] }); }
  asmMove(id, d) { const a = this.state.own.asm; const i = a.seq.indexOf(id), j = i + d; if (j < 0 || j >= a.seq.length) return; const s = a.seq.slice(); s[i] = a.seq[j]; s[j] = id; this.setAsm({ seq: s, feedback: '', lastWrong: [] }); }
  checkAsm = async () => {
    const o = this.state.own, a = o.asm; const byId = {}; a.pieces.forEach(p => byId[p.id] = p);
    const expected = a.pieces.filter(p => p.correct >= 0).length;
    const usedDx = a.seq.includes('dx');
    const wrong = a.seq.filter((id, i) => byId[id].correct !== i);
    const missing = expected - a.seq.filter(id => byId[id].correct >= 0).length;
    const ok = wrong.length === 0 && missing === 0 && !usedDx;
    const attempts = a.attempts + 1;
    if (ok) { this.setAsm({ attempts, correct: true, feedback: attempts === 1 ? 'Right first time.' : 'That is the order. Now the part that matters: say why.', lastWrong: [] }); return; }
    this.setAsm({ attempts, mistakes: a.mistakes + 1, usedDistractor: a.usedDistractor || usedDx, loading: true, lastWrong: wrong });
    let fb;
    const yours = a.seq.map(id => byId[id].text).join('\n'), correctCode = a.pieces.filter(p => p.correct >= 0).map(p => p.text).join('\n');
    try {
      const wrongLines = wrong.filter(id => id !== 'dx').map(id => byId[id].text.trim());
      fb = await this.ask('asmFeedback', { lang: o.lang, correct: correctCode, yours, distractor: usedDx ? byId.dx.text : '', missing, wrongLines });
    } catch (e) {
      const q = wrong.filter(id => id !== 'dx').map(id => '`' + byId[id].text.trim() + '`');
      fb = usedDx && o.scenario === this.SQL ? "Look back at the run: WHERE runs after the join, and Cy and Fay's rows have status NULL there. What does NULL = 'paid' evaluate to, and what happens to those rows?" : usedDx ? 'One piece in your version contradicts what the code needs to do when the id changes. Which one, and why?' : missing ? 'Some pieces are still in the bank. Which step of the run did they correspond to?' : q.length ? `Look at ${q.slice(0, 2).join(' and ')}. Replay the run in your head: what has to exist before each of these can do its job?` : 'Something is out of order. Replay the run in your head, step by step.';
    }
    this.setAsm({ loading: false, feedback: fb });
  };

  // Write it
  async loadWriteTask() {
    const o = this.state.own; if (o.write.task) return;
    const t = this.targetOf(o), sc = o.scenario;
    if (t && t.write) {
      const w = t.write;
      this.setOwn(cur => ({ write: { ...cur.write, task: w.task, schema: w.schema, before: w.before, after: w.after, placeholder: w.placeholder, check: w.check, ref: w.check.expected, authoredHints: w.hints } }));
      return;
    }
    // The chat's fixed "write a new one" task is only for owning the whole thing. Any other focus, including one about
    // order or timing, gets a try designed for it (writeTask decides whether producing it is the skill, research §8f).
    if (sc && sc.writeTask && (!o.focus || o.focus.whole)) { this.setOwn(cur => ({ write: { ...cur.write, task: sc.writeTask, ref: sc.writeRef, schema: sc.schema, requirements: sc.writeRequirements || null } })); return; }
    this.setOwn(cur => ({ write: { ...cur.write, loading: true } }));
    try {
      const r = await this.ask('writeTask', { label: o.focus ? o.focus.label : '', code: o.code, fullCode: o.fullCode });
      const fmt = ['code', 'choice', 'explain', 'steps'].includes(r.format) ? r.format : 'explain';
      let patch = { task: r.task, schema: String(r.context || '').trim(), format: fmt, loading: false, orderMatters: !!r.orderIsInsight };
      if (fmt === 'code') patch = { ...patch, ref: r.reference || '', requirements: (r.requirements || []).filter(Boolean).slice(0, 4) };
      if (fmt === 'choice') {
        const questions = (r.questions || []).slice(0, 3).map((q, i) => {
          const options = (q.options || []).slice(0, 3).map((x, j) => ({ v: 'o' + j, l: x.label, gap: x.correct ? undefined : x.gap || undefined, correct: !!x.correct }));
          return { id: 'q' + i, short: q.short || q.prompt.slice(0, 60), prompt: q.prompt, answer: (options.find(x => x.correct) || options[0] || {}).v, options };
        }).filter(q => q.options.length >= 2);
        patch = questions.length ? { ...patch, check: { type: 'choice', questions } } : { ...patch, format: 'explain', check: { type: 'explain', question: r.task, keyPoints: [] } };
      }
      if (fmt === 'steps') {
        const steps = (r.steps || []).slice(0, 4).map((x, i) => ({ id: 's' + i, label: String(x.label || ''), answer: Number(x.answer), unit: x.unit === '%' ? '%' : '', how: x.how || '' })).filter(x => x.label && Number.isFinite(x.answer));
        patch = steps.length ? { ...patch, ref: steps.map(x => `${x.label}: ${x.answer}${x.unit}`).join('\n'), check: { type: 'steps', steps } } : { ...patch, format: 'explain', check: { type: 'explain', question: r.task, keyPoints: [] } };
      }
      if (fmt === 'explain') patch = { ...patch, placeholder: 'Explain it in your own words, and apply it to the new case.', check: { type: 'explain', question: r.task, keyPoints: (r.keyPoints || []).slice(0, 3), topics: (r.keyTopics || []).slice(0, 3).map(String) } };
      this.setOwn(cur => ({ write: { ...cur.write, ...patch } }));
    } catch (e) {
      const label = o.focus ? o.focus.label : 'the part you highlighted';
      this.setOwn(cur => ({ write: { ...cur.write, task: `Now a new situation: in your own words, explain ${label}, and give an example of where it matters.`, format: 'explain', placeholder: 'Explain it in your own words, and apply it to the new case.', check: { type: 'explain', question: label, keyPoints: [] }, loading: false } }));
    }
  }
  askHint = async () => {
    const o = this.state.own; if (o.write.hintLoading) return;
    if (o.write.authoredHints) {
      const h = o.write.authoredHints[o.write.hints.length] || 'No more hints. Give it a go: the check will show exactly what comes back.';
      this.setOwn(cur => ({ write: { ...cur.write, hints: cur.write.hints.concat([h]) } }));
      return;
    }
    this.setOwn({ write: { ...o.write, hintLoading: true } });
    let h;
    try { h = await this.ask('hint', { task: o.write.task, ref: o.write.ref, draft: o.write.text, hints: o.write.hints }); }
    catch (e) { h = o.scenario === this.SQL ? ['Which table do you start FROM if every author has to appear?', "Where does status = 'published' have to go so authors with no published books survive?", 'An author with no match gets a NULL sum. What turned NULL into 0 in the original?'][o.write.hints.length] || 'Most pages first: which direction is the sort?' : ['What goes in the dependency array so it refetches when slug changes?', 'What did the original return from the effect, and why?', 'Which state do you need, and what does the component show while it is empty?'][o.write.hints.length] || 'Walk through a slug change: what stops the old response from landing?'; }
    this.setOwn(cur => ({ write: { ...cur.write, hints: cur.write.hints.concat([h]), hintLoading: false } }));
  };
  fallbackGrade(o, attempt, ref) {
    const a = attempt.toLowerCase(); let checks;
    if (o.lang === 'sql') checks = [[/left\s+(outer\s+)?join/, 'keeps the left table with no matches (LEFT JOIN)'], [/on[\s\S]*(published|paid)/, 'filters the status inside the ON clause'], [/sum\s*\(|count\s*\(|is\s+null/, 'uses the right aggregate or NULL test'], [/group\s+by|is\s+null/, 'groups per row of the left table'], [/order\s+by[\s\S]*desc|is\s+null/, 'sorts descending (without DESC you get the smallest first)']];
    else checks = [[/usestate/, 'holds the result in state'], [/useeffect/, 'runs the fetch in an effect'], [/\[\s*slug\s*\]|\[\s*id\s*\]|\[\s*\]/, 'has a dependency array'], [/cancelled|ignore|stale|abort/, 'guards against stale responses'], [/return\s*\(\)\s*=>/, 'returns a cleanup']];
    const hit = checks.filter(c => c[0].test(a)); const miss = checks.filter(c => !c[0].test(a));
    const score = attempt.trim().length < 10 ? 1 : Math.max(1, Math.min(5, hit.length));
    return { items: checks.map(c => ({ short: c[1], ok: attempt.trim().length >= 10 && c[0].test(a) })), score, worked: hit.length ? 'Your version ' + hit.map(c => c[1]).join(', ') + '.' : 'A start, but not much of the structure is there yet.', gap: miss.length ? 'Missing: ' + miss.map(c => c[1]).join(', ') + '.' : 'Nothing structural. This holds.' };
  }
  // Shared grader: Sonnet, requirement checklist with quoted evidence, then deterministic clamps.
  // A SQL try that didn't run: Claude checks each of the target's items against the query as written. Offline, or
  // if Claude can't be reached, it stays "not checked".
  async judgeSqlThatDidntRun(o, ran) {
    const items = o.write.check.items || [];
    if (!items.length) return ran;
    try {
      const attempt = [o.write.before, o.write.text, o.write.after].filter(Boolean).join('\n');
      const j = await this.gradeAttempt(o.write.task, o.write.check.expected, attempt, 'sql', 'reveal', items.map(i => i.short));
      return { ...ran, items: items.map((it, k) => ({ short: it.short, owned: !!it.owned, ok: !!(j.items[k] && j.items[k].ok), judged: true })), judgedByClaude: true, worked: '', score: j.score };
    } catch (e) { return ran; }
  }
  // requirements: when the try fixed them up front (so the prediction counted them), the grader checks exactly those.
  async gradeAttempt(task, ref, attempt, lang, variant = 'reveal', requirements = null) {
    const r = await this.ask('grade', { task, ref, attempt, variant, requirements });
    r.checks = Array.isArray(r.checks) ? r.checks : [];
    r.checks.forEach(c => { if (!c.quoted_evidence || !String(attempt).includes(String(c.quoted_evidence).trim().slice(0, 12))) c.met = false; });
    const unmet = r.checks.filter(c => !c.met);
    r.score = Math.max(1, Math.min(5, Math.round(Number(r.score) || 1)));
    if (unmet.length) r.score = Math.min(r.score, 3);
    // deterministic SQL guard for "top N" tasks
    if (lang === 'sql' && /including .* with none|still (show up|appear)|no paid orders|haven't bought|with 0\b/i.test(task) && !/left\s+(outer\s+)?join/i.test(attempt)) { r.score = Math.min(r.score, 3); const n = 'Without a LEFT JOIN, rows with no match on the right side drop out, so the ones the task says to include are missing.'; unmet.push({ requirement: 'LEFT JOIN', met: false }); r.gap = n; r.note = r.note ? n + ' ' + r.note : n; }
    if (lang === 'sql' && /\btop\b|most .* first|highest first/i.test(task) && !/\bdesc\b/i.test(attempt)) { r.score = Math.min(r.score, 3); const n = 'The task asks for the biggest first but there is no DESC, so this sorts ascending and puts them last.'; unmet.push({ requirement: 'sort descending', met: false }); r.gap = n; r.note = r.note ? n + ' ' + r.note : n; }
    if (unmet.length && (!r.gap || /nothing structural/i.test(r.gap))) r.gap = 'Not met: ' + unmet.map(c => c.requirement).join('; ') + '.';
    // One item per requirement. A deterministic guard marks its requirement unmet (it never adds items, so N stays
    // what the prediction counted).
    const guard = (re, req) => { if (!unmet.some(u => u.requirement === req)) return; const c = r.checks.find(x => re.test(x.requirement)); if (c) c.met = false; };
    guard(/join|appear|includ|every|with (no|none|0)/i, 'LEFT JOIN'); guard(/sort|order|desc|first/i, 'sort descending');
    r.items = requirements && requirements.length
      ? requirements.map((q, i) => ({ short: q, ok: !!(r.checks[i] && r.checks[i].met) }))
      : r.checks.map(c => ({ short: c.requirement, ok: !!c.met }));
    return r;
  }
  submitWrite = async () => {
    const o = this.state.own, isChoice = o.write.check && ['choice', 'steps'].includes(o.write.check.type);
    if ((isChoice ? !Object.values(o.write.picked).some(v => String(v).trim()) : !o.write.text.trim()) || o.write.gradeLoading) return;
    this.setOwn({ write: { ...o.write, gradeLoading: true } });
    let g;
    try {
      if (!o.write.check) throw new Error('no executable check');
      if (o.write.check.type === 'explain') {
        const res = await this.judgeGap({ topic: o.focus ? o.focus.label : '' }, o.write.check, o.write.text);
        const ok = res.points.filter(p => p.ok);
        const items = o.write.check.keyPoints.length ? o.write.check.keyPoints.map((p, i) => ({ short: p, ok: !!(res.points[i] && res.points[i].ok) })) : [{ short: 'Explains the idea and applies it', ok: res.closed }];
        g = { items, score: !res.points.length ? 2 : res.closed ? 5 : ok.length ? 3 : 2, why: res.closed ? 'Your answer has every key idea.' : ok.length ? 'Some of the key ideas are there, not all.' : res.points.length ? "The key ideas aren't there yet." : "This couldn't be checked just now.",
          worked: '', gap: res.feedback, corrections: [] }; // what was covered is the ✓ list itself
      } else
      g = await runCheck(o.write.check, o.write.text, o.write.before, o.write.after, o.write.picked);
      // Hybrid SQL check: if it runs, running it decides (exact, with the row tables). If it doesn't run, one slip
      // shouldn't zero a query whose idea is right, so Claude judges the same items from the query itself, and
      // the reveal says so. The plain-words syntax fix stays as "what to fix".
      if (g.didntRun && o.write.check.type === 'sql') g = await this.judgeSqlThatDidntRun(o, g);
    } catch (_) { try {
      g = await this.gradeAttempt(o.write.task, o.write.ref, o.write.text, o.lang, 'reveal', o.write.requirements);
    } catch (e) { g = this.fallbackGrade(o, o.write.text, o.write.ref); } }
    {
      const { right, n } = tally(g), d = right - o.prediction;
      // The item you came to own leads: missing it matters more than missing a side detail.
      const ownedMiss = (g.items || []).find(i => i.owned && !i.ok && !i.unchecked);
      if (g.judgedByClaude) g.revealLine = `You said ${o.prediction} of ${n}. It didn't run, so Claude judged it from your query: ${right} of ${n} would be right once it runs. Fix what's below and check again to have it run.`;
      else if (g.didntRun) g.revealLine = `You said ${o.prediction} of ${n}. It didn't run, so none of the ${n} could be checked yet: fix what's below and check again. The check counts this try as ${right} of ${n}, since it didn't work on its own.`;
      else g.revealLine = (d === 0 ? `You said ${o.prediction} of ${n}, and got ${right}. Your sense of what you know is accurate here.` : d > 0 ? `You said ${o.prediction} of ${n}, and got ${right}. You own more of this than you thought.` : `You said ${o.prediction} of ${n}, and got ${right}. Reading it felt clearer than doing it turned out to be, which is normal, and now you know exactly where.`)
        + (ownedMiss ? ` The one you missed is the idea you came to own: ${ownedMiss.short.charAt(0).toLowerCase() + ownedMiss.short.slice(1)}.` : '');
    }
    // The first try is what you could do on your own, so it stays the "actual" that the prediction is measured against.
    // A fix is recorded next to it, never instead of it.
    const first = !o.write.firstGrade, attempts = o.write.attempts + 1;
    const t1 = tally(first ? g : o.write.firstGrade);
    const entry = { id: o.id, title: o.focus ? o.focus.label : o.scenario ? o.scenario.title : (o.lang + ' · ' + o.code.split('\n')[0].slice(0, 30)), predicted: o.prediction, actual: t1.right, n: t1.n, judged: !!(first ? g : o.write.firstGrade).judgedByClaude, ownedMissed: (first ? g : o.write.firstGrade).items ? (first ? g : o.write.firstGrade).items.some(i => i.owned && !i.ok) : false, fixed: first ? null : tally(g).right, hints: o.write.hints.length, own: o,
      ownedAt: (this.state.ledger.find(e => e.id === o.id) || {}).ownedAt || this.now(), dueAt: (this.state.ledger.find(e => e.id === o.id) || {}).dueAt || this.now() + 3 * DAY, reviews: (this.state.ledger.find(e => e.id === o.id) || {}).reviews || [] };
    const notes = ruleNotes(o.lang, o.write.text, o.write.task);
    this.setState(s => ({ own: { ...s.own, write: { ...s.own.write, grade: g, gradeLoading: false, attempts, firstGrade: s.own.write.firstGrade || g, notes, notesLoading: true }, phase: 'reveal' }, ledger: foldRepeats(s.ledger.filter(e => e.id !== entry.id).concat([entry])) }), () => this.loadNotes(g, notes));
  };

  // "On your version": Claude adds up to 2 notes on HOW you wrote it, beyond the score (which is already decided).
  async loadNotes(g, have) {
    const o = this.state.own, w = o.write, text = w.text;
    const done = extra => this.setOwn(cur => ({ write: { ...cur.write, notes: (cur.write.notes || []).concat(extra).slice(0, 3), notesLoading: false } }));
    if ((w.check && ['choice', 'steps'].includes(w.check.type)) || text.trim().length < 40) return done([]);
    try {
      const r = await this.ask('notes', { gap: g.gap, task: w.task, lang: o.lang, text, have: have.map(n => n.text), isCode: !(w.check && w.check.type === 'explain') && !(o.scenario && o.scenario.prose) && !!o.write.ref && /[;{}=()]|\bSELECT\b/i.test(o.write.ref) });
      done(keepQuoted(r.notes, text).filter(n => !have.some(h => h.quote.toLowerCase() === n.quote.toLowerCase())).slice(0, 2));
    } catch (e) { done([]); }
  }

  // Back to your own attempt, as you left it, to fix what the check found.
  fixWrite = () => this.setOwn(cur => ({ phase: 'ladder', step: 'write', write: { ...cur.write, lastGap: cur.write.grade && cur.write.grade.gap, grade: null } }));

  // Teach one
  // Is what you're owning code? The replayed chats say so themselves; otherwise it's code only when the try was
  // writing code. A live answer about a health headline or leadership is an idea, so Sam asks about an idea.
  isCodeOwn(o = this.state.own) { return o.scenario ? !o.scenario.prose : o.write.format === 'code'; }
  goTeach = () => { const o = this.state.own; this.setOwn({ phase: 'teach', teach: { ...o.teach, msgs: o.teach.msgs.length ? o.teach.msgs : [{ role: 'sam', text: (o.scenario && o.scenario.samOpen)
    || (this.isCodeOwn(o) ? "Hey! So I've never done this before. Can you tell me what this code is for, like, what problem it solves?" : "Hi! I've never come across this before. What's the main idea, in plain words, and why does it matter?") }] } }); };
  sendTeach = async () => {
    const o = this.state.own; const t = o.teach.input.trim(); if (!t || o.teach.loading) return;
    const msgs = o.teach.msgs.concat([{ role: 'user', text: t }]); const turns = o.teach.turns + 1;
    this.setOwn({ teach: { ...o.teach, msgs, input: '', turns, loading: true } });
    let reply;
    const gap = o.write.grade ? o.write.grade.gap : '';
    try {
      const hist = msgs.map(m => ({ role: m.role === 'sam' ? 'assistant' : 'user', content: m.text }));
      // The API needs the conversation to open with a user turn; Sam speaks first in the UI.
      if (hist[0].role === 'assistant') hist.unshift({ role: 'user', content: '(The learner opens the chat with Sam.)' });
      reply = await complete({ task: 'sam', input: { lang: o.lang, prose: !this.isCodeOwn(o), code: o.code, gap, last: turns >= 3 }, messages: hist });
      reply = String(reply).trim();
    } catch (e) { const sl = o.scenario && o.scenario.samLines; reply = sl ? sl[Math.min(turns, 3) - 1] : turns >= 3 ? "Ok I think I get it: you squash the rows into one per person first, and only then can you ask about the totals. Thanks!" : turns === 1 ? "Hm ok. So the part that filters, does it look at every single row, or at the totals? I don't get when the totals show up." : "Wait so if I wanted only people whose total is big, why can't I just put that in the first filter?"; }
    this.setOwn(cur => ({ teach: { ...cur.teach, msgs: msgs.concat([{ role: 'sam', text: reply }]), loading: false } }), () => { if (turns >= 3) this.debriefTeach(); });
  };
  // The aha of teaching: what you explained clearly, and where you weren't sure (a gap you didn't know you had).
  // Claude reads the conversation and must quote your words; offline, hedges ("not sure", "I guess") mark the gaps.
  debriefTeach = async () => {
    const o = this.state.own, msgs = o.teach.msgs; if (o.teach.debrief || o.teach.debriefLoading) return;
    this.setOwn(cur => ({ teach: { ...cur.teach, debriefLoading: true } }));
    const mine = msgs.filter(m => m.role === 'user').map(m => m.text);
    const samBefore = i => { for (let k = i - 1; k >= 0; k--) if (msgs[k].role === 'sam') return msgs[k].text; return ''; };
    const quoted = (q, list) => q && list.some(t => t.toLowerCase().includes(String(q).toLowerCase().trim().slice(0, 25)));
    let d;
    try {
      const r = await this.ask('debrief', { label: o.focus ? o.focus.label : '', msgs });
      // Hedged but right is underconfidence, the other half of calibration: shown as "unsure, but right", not a gap.
      const unsure = (r.unsure || []).filter(u => quoted(u.quote, mine) && u.topic).slice(0, 2);
      d = { clear: (r.clear || []).filter(c => quoted(c.quote, mine)).slice(0, 2), unsure: unsure.filter(u => !u.right), unsureRight: unsure.filter(u => u.right) };
    } catch (e) {
      const hedge = /not (really |quite )?sure|i guess|i'd guess|i would guess|maybe|no idea|i think|don't know|dont know/i;
      d = { clear: mine.filter(t => !hedge.test(t)).slice(0, 1).map(t => ({ quote: t.length > 90 ? t.slice(0, 90) + '…' : t, text: 'You put the core idea in your own words.' })),
        unsure: msgs.map((m, i) => ({ m, i })).filter(x => x.m.role === 'user' && hedge.test(x.m.text)).slice(0, 2)
          .map(x => ({ quote: x.m.text, question: samBefore(x.i), topic: isColdStart({ topic: '', question: samBefore(x.i) }) ? 'How a two-sided platform solves the cold start' : (samBefore(x.i).replace(/^(oo+h|oh|ok|hm+|wait)[,!. ]+/i, '').split(/[.?!]/).filter(Boolean).pop() || 'The question Sam asked').trim().slice(0, 70) })) };
    }
    this.setOwn(cur => ({ teach: { ...cur.teach, debrief: d, debriefLoading: false } }));
  };
  // ---------- gaps: found (by explaining, or a missed recall) → explored in a chat → closed by a check → kept ----------
  makeGap(u, source, origin) {
    const o = this.state.own;
    return { id: 'g' + this.nid(), topic: u.topic, question: u.question || '', quote: u.quote || '', source, origin,
      from: o && o.focus ? o.focus.label : this.state.chatTitle, at: this.now(), status: 'open', context: isColdStart(u) ? COLD_START.context : (u.context || '') };
  }
  // Same topic twice is one gap.
  saveGap(g) { const have = this.state.gaps.find(x => x.topic === g.topic); if (have) return have; this.setState(s => ({ gaps: s.gaps.concat([g]) })); return g; }
  teachGap(u) { const o = this.state.own; return this.saveGap(this.makeGap(u, 'teach', `while you were explaining “${o && o.focus ? o.focus.label : 'this'}” to Sam`)); }
  // A new chat about just this gap. Claude starts from your guess; the banner keeps the goal in view.
  exploreGap(gapOrId) {
    const g = typeof gapOrId === 'string' ? this.state.gaps.find(x => x.id === gapOrId) : gapOrId;
    if (this.state.own) this.finishOwn();
    const mine = g.origin.replace('you were', 'I was');
    const text = `I want to close a gap: ${g.topic}.\n\nIt came up ${mine}.${g.question ? ` I was asked: “${g.question}”` : ''}${g.quote ? ` My best guess was: “${g.quote}”` : ''}`;
    this.setState(s => ({ gaps: s.gaps.some(x => x.id === g.id) ? s.gaps : s.gaps.concat([g]), view: 'chat', own: null, sel: null, composer: '', activeGap: g.id, chatTitle: g.topic,
      messages: [{ id: this.nid(), type: 'gapBanner', gapId: g.id }, { id: this.nid(), type: 'user', text }, { id: this.nid(), type: 'thinking' }] }), () => this.answer({ question: text }, true));
  }
  // "Check me": one question that asks you to explain and apply the idea; Claude judges it against key points.
  checkMeFromChat = gapId => { this.setState(s => ({ messages: s.messages.concat([{ id: this.nid(), type: 'user', text: "I think I've got it. Check me." }]) }), () => this.startGapCheck(gapId)); };
  async startGapCheck(gapId) {
    const g = this.state.gaps.find(x => x.id === gapId), id = this.nid();
    this.setState(s => ({ messages: s.messages.concat([{ id, type: 'gapCheck', gapId, phase: 'loading', text: '' }]) }));
    let check;
    if (isColdStart(g)) check = COLD_START.check;
    else {
      try { const r = await this.ask('gapCheck', { topic: g.topic, context: g.context }); check = { question: r.question, keyPoints: (r.keyPoints || []).slice(0, 3) }; }
      catch (e) { check = { question: `In your own words, with an example: ${g.topic}?`, keyPoints: [] }; }
    }
    this.setGo(id, { phase: 'ask', check });
  }
  async judgeGap(g, check, answer) {
    const quoted = q => q && answer.toLowerCase().includes(String(q).toLowerCase().trim().slice(0, 12));
    try {
      if (!check.keyPoints.length) throw new Error('no key points');
      const r = await this.ask('gapJudge', { topic: g.topic, question: check.question, keyPoints: check.keyPoints, answer });
      const points = check.keyPoints.map((p, i) => { const x = (r.points || [])[i] || {}; return { point: p, ok: !!quoted(x.evidence) }; });
      return { points, closed: points.every(p => p.ok), feedback: r.feedback || '' };
    } catch (e) {
      if (isColdStart(g)) { const r = judgeColdStartOffline(answer); const points = r.points.map(p => ({ point: p.point, ok: !!p.evidence })); return { points, closed: points.every(p => p.ok), feedback: r.feedback }; }
      return { points: [], closed: false, feedback: "I couldn't check this just now. Try again in a moment." };
    }
  }
  async submitGapCheck(m) {
    if (!m.text.trim() || m.judging) return;
    this.setGo(m.id, { judging: true });
    const g = this.state.gaps.find(x => x.id === m.gapId);
    const result = await this.judgeGap(g, m.check, m.text);
    this.setGo(m.id, { judging: false, phase: 'done', result });
    if (result.closed) this.closeGap(g, m.check);
  }
  // A closed gap becomes something you own: it joins Learnings and comes back for recall in 3 days.
  closeGap(g, check) {
    const now = this.now();
    this.setState(s => ({
      gaps: s.gaps.map(x => x.id === g.id ? { ...x, status: 'closed', closedAt: now } : x),
      ledger: s.ledger.some(e => e.id === 'gap-' + g.id) ? s.ledger : s.ledger.concat([{ id: 'gap-' + g.id, kind: 'gap', title: g.topic, predicted: null, actual: null, fixed: null, hints: 0, realWork: [], reviews: [],
        ownedAt: now, dueAt: now + 3 * DAY, gap: { ...g, check }, own: { scenario: null, focus: { label: g.topic, mode: 'concept' }, lang: 'concept', code: '', write: { schema: '' } } }]),
    }));
  }
  finishOwn = () => {
    const o = this.state.own; const g = o.write.firstGrade || o.write.grade || { score: 0 }, last = o.write.grade;
    const t = tally(g), tl = last ? tally(last) : t;
    const fixed = o.write.attempts > 1 && last && tl.right !== t.right ? `, fixed to ${tl.right} of ${tl.n}` : '';
    const summary = `${o.focus ? o.focus.label : o.scenario ? o.scenario.title : o.lang} · predicted ${o.prediction} of ${t.n}, got ${t.right}${fixed}${o.teach.turns ? ', taught Sam' : ''}`;
    this.setState({ own: null, messages: this.state.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', summary } : m) });
  };


  // ---------- recall: what you owned comes back for an unassisted check ----------
  startRecall(e) {
    if (e.kind === 'gap') return this.startGapRecall(e);
    const sc = e.own.scenario, t = this.targetOf(e.own), td = t && t.delayed;
    const lastRv = e.reviews && e.reviews.length ? e.reviews[e.reviews.length - 1] : null;
    // "Then" is fixed when the recall starts, so the result reads "First try, 3 days ago: 1 of 2 → today: 2 of 2".
    const thenLabel = `${lastRv ? `Last recall, ${rel(lastRv.at, this.now())}: ${lastRv.right} of ${lastRv.n}` : `First try, ${rel(e.ownedAt, this.now())}: ${e.actual} of ${e.n}`}`;
    const last = lastRv ? lastRv.right : e.actual;
    const base = { entryId: e.id, picked: {}, text: '', grade: null, loading: false, lang: e.own.lang, then: last, thenLabel };
    const r = td ? { ...base, task: td.task, ref: td.check.expected, schema: td.schema || '', before: td.before || '', after: td.after || '', placeholder: td.placeholder || '', check: td.check }
      : { ...base, task: sc && sc.delayedTask ? sc.delayedTask : '', ref: sc ? sc.delayedRef || '' : '', schema: '', before: '', after: '', placeholder: '', check: null };
    this.setState({ recall: r });
    if (!r.task) this.ask('recallTask', { title: e.title, code: e.own.code || '' })
      .then(x => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: x.task, ref: x.reference } : s.recall })))
      .catch(() => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: `From memory: explain or redo "${e.title}" without looking back.`, ref: '' } : s.recall })));
  }
  startGapRecall(e) {
    const g = e.gap, base = { entryId: e.id, gapMode: true, picked: {}, text: '', grade: null, loading: false, lang: 'concept', then: null, thenLabel: `Closed ${rel(e.ownedAt, this.now())}`, schema: '', before: '', after: '', placeholder: 'From memory. Explain it and apply it.', check: null };
    const cold = isColdStart(g);
    this.setState({ recall: { ...base, task: cold ? 'From memory, a new situation: a friend is launching a marketplace that connects local tutors with students. Neither side exists yet. What would you tell them to do first, and why?' : '' } });
    if (!cold) this.ask('gapRecall', { topic: g.topic, before: g.check ? g.check.question : '' })
      .then(x => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: x.question } : s.recall })))
      .catch(() => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: `From memory, in your own words and with a new example: ${g.topic}?` } : s.recall })));
  }
  // A question you noticed while recalling: after you've checked (so it never becomes a lookup), quote the recall
  // into a new chat and leave the question to you, the same "Ask Claude about this" as on the reveal. If it's about
  // understanding, it lands under "You asked about", ready to own; the loop starts again from recall.
  askAboutRecall = () => {
    const r = this.state.recall, e = this.state.ledger.find(x => x.id === r.entryId); if (!r || !r.grade) return;
    const answer = r.check && r.check.type === 'choice' ? r.check.questions.map(q => `${q.prompt} → ${(q.options.find(x => x.v === r.picked[q.id]) || {}).l || '(no answer)'}`).join('\n') : r.text;
    const q = t => String(t).split('\n').map(l => '> ' + l).join('\n');
    const text = `About my recall on “${e.title}”:\n${q('Question: ' + r.task)}\n${q('My answer: ' + (answer || '(nothing)'))}${r.grade.note ? '\n' + q('The check said: ' + r.grade.note) : ''}\n\n`;
    this.setState({ recall: null, messages: [], own: null, sel: null, activeGap: null, chatTitle: 'New chat', view: 'chat', composer: text },
      () => { const el = this.composerRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  };
  // The same for the panel's other reveals (go-first and the gap check, log 90): the context goes into this chat's box
  // as a quote, the question is yours, and the panel stays open beside it.
  askAboutPanelTry = id => {
    const m = this.state.messages.find(x => x.id === id); if (!m) return;
    const q = t => String(t).split('\n').map(l => '> ' + l).join('\n');
    const picks = c => c.questions.map(x => `${x.prompt} → ${(x.options.find(o => o.v === m.picked[x.id]) || {}).l || '(no answer)'}`).join('\n');
    let head, question, answer, said;
    if (m.type === 'goFirst') {
      const g = GO_FIRST[m.key], gr = m.grade || {};
      head = 'my go'; question = g.question; answer = g.check.type === 'choice' ? picks(g.check) : m.text;
      said = [gr.gap, (gr.items || []).filter(i => !i.ok).map(i => 'Missed: ' + i.short).join('; ')].filter(Boolean).join(' ');
    } else if (m.type === 'goAsk') { head = 'my go'; question = m.question; answer = m.text; said = m.note; }
    else { const g = this.state.gaps.find(x => x.id === m.gapId) || {}, r = m.result || {}; head = `closing the gap “${g.topic || ''}”`; question = m.check.question; answer = m.text; said = [r.closed ? 'Closed.' : 'Not closed yet.', r.feedback].filter(Boolean).join(' '); }
    this.prefillChat(`About ${head}:\n${q('Question: ' + question)}\n${q('My answer: ' + (answer || '(nothing)'))}${said ? '\n' + q('The check said: ' + said) : ''}\n\n`);
  };
  prefillChat(text) { this.setState({ composer: text, view: 'chat' }, () => { const el = this.composerRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); }
  // A missed recall is a gap: keep it, and explore it in a chat.
  recallGap() {
    const r = this.state.recall, e = this.state.ledger.find(x => x.id === r.entryId);
    const quote = r.check && r.check.type === 'choice' ? '' : r.text;
    return this.saveGap({ ...this.makeGap({ topic: e.title, question: r.task, quote }, 'recall', 'in a recall check, from memory'), from: e.title });
  }
  submitRecall = async () => {
    const r = this.state.recall, isChoice = r.check && r.check.type === 'choice';
    if ((isChoice ? !Object.keys(r.picked).length : !r.text.trim()) || r.loading) return;
    this.setState({ recall: { ...r, loading: true } });
    let g;
    if (r.gapMode) {
      const e = this.state.ledger.find(x => x.id === r.entryId);
      const res = await this.judgeGap(e.gap, e.gap.check || { question: r.task, keyPoints: [] }, r.text);
      g = { score: res.closed ? 5 : 3, items: res.points.length ? res.points.map(p => ({ short: p.point, ok: p.ok })) : [{ short: e.title, ok: res.closed }], note: res.feedback };
    } else try {
      if (!r.check) throw new Error('no executable check');
      const x = await runCheck(r.check, r.text, r.before, r.after, r.picked); g = { score: x.score, items: x.items, note: [x.worked, x.gap, correctionNote(x.corrections)].filter(Boolean).join(' ') };
    } catch (_) {
      try { g = await this.gradeAttempt(r.task, r.ref, r.text, r.lang, 'note'); }
      catch (e) { const f = this.fallbackGrade({ lang: r.lang }, r.text, r.ref); g = { score: f.score, items: f.items, note: f.worked + ' ' + f.gap }; }
    }
    // Spacing: right → wait longer each time (7, then 21, then 60 days); missed → back tomorrow.
    const now = this.now();
    this.setState(s => ({
      recall: { ...s.recall, grade: g, loading: false },
      ledger: s.ledger.map(e => {
        if (e.id !== r.entryId) return e;
        const streak = (() => { let k = 0; for (let i = (e.reviews || []).length - 1; i >= 0 && e.reviews[i].right === e.reviews[i].n; i--) k++; return k; })();
        const t = tally(g), gap = t.right === t.n ? [7, 21, 60][Math.min(streak, 2)] : 1;
        return { ...e, delayed: e.delayed == null ? t.right : e.delayed, reviews: (e.reviews || []).concat([{ at: now, right: t.right, n: t.n }]), dueAt: now + gap * DAY, nextGap: gap };
      }),
    }));
  };
  skipAhead = () => this.setState(s => ({ timeShift: s.timeShift + 3 * DAY }));

  // ---------- learnings page: everything you chose to own, and how it went ----------
  learningsVals() {
    const S = this.state;
    const reopen = sc => sc === this.BOOK ? this.startBook : sc === this.JUNO ? this.startJuno : sc === this.SQL ? this.startSql : null;
    const now = this.now();
    const items = S.ledger.filter(e => !e.merged).reverse().map(e => {
      const key = goFirstFor(e.own.focus && e.own.focus.target);
      const steps = (e.kind === 'gap'
        ? [{ label: 'Gap found', v: e.gap.source === 'recall' ? 'in a recall' : 'teaching Sam', tone: 'mute' }, { label: 'Closed', v: 'checked ✓', tone: 'act' }]
        : (e.earlier || []).map(x => ({ label: `Earlier, ${rel(x.at, now)}`, v: `predicted ${x.predicted}, got ${x.actual} of ${x.n}`, tone: 'mute' }))
          .concat([{ label: 'Predicted', v: `${e.predicted} of ${e.n}`, tone: 'pred' }, { label: 'First try', v: `${e.actual} of ${e.n}${e.judged ? ', judged by Claude' : ''}`, tone: 'act' }]))
        .concat(e.fixed != null && e.fixed !== e.actual ? [{ label: 'Fixed', v: `${e.fixed} of ${e.n}`, tone: 'mute' }] : [])
        .concat((e.reviews || []).map(rv => ({ label: `Recall · ${rel(rv.at, now)}`, v: `${rv.right} of ${rv.n}`, tone: 'act' })))
        .concat((e.realWork || []).map(r => r.outsourced ? { label: 'Real work', v: 'let Claude answer', tone: 'mute' } : r.n ? { label: 'Real work', v: `went first, ${r.actual} of ${r.n}`, tone: 'act' } : { label: 'Real work', v: 'went first', tone: 'act' }))
        .concat(e.dueAt != null && e.dueAt > now ? [{ label: 'Recall', v: rel(e.dueAt, now), tone: 'next' }] : []);
      const due = e.dueAt != null && e.dueAt <= now, r = S.recall && S.recall.entryId === e.id ? S.recall : null;
      // For the map and the card covers: which chat it came from, what kind it is, how soon it comes back.
      return { sc: e.kind === 'gap' ? 'GAP' : this.scKey(e.own.scenario), target: e.own.focus && e.own.focus.target, kind: e.kind, dueAt: e.dueAt, daysToDue: e.dueAt == null ? null : (e.dueAt - now) / DAY,
        firstLine: e.kind === 'gap' ? '' : `predicted ${e.predicted} of ${e.n}, got ${e.actual} of ${e.n} on the first try`,
        id: e.id, title: e.title, from: e.kind === 'gap' ? e.gap.from : e.own.scenario ? e.own.scenario.title : S.chatTitle, steps, due,
        owned: e.ownedAt != null ? `owned ${rel(e.ownedAt, now)}` : '', next: e.dueAt != null && !due ? `next recall ${rel(e.dueAt, now)}` : '',
        onRecall: () => this.startRecall(e), recall: r && r.grade ? { ...r, ...tally(r.grade), full: allRight(r.grade) } : r, then: r ? r.thenLabel : '',
        onNew: key ? () => this.startGoFirst(key) : null, newLabel: key ? GO_FIRST[key].chip : '' };
    });
    const real = S.ledger.flatMap(e => e.realWork || []);
    // Related questions you haven't tried yet: the "go first" questions what you own unlocks, shown dashed on the map.
    const untried = [...new Set(items.map(it => it.onNew && it.newLabel).filter(Boolean))].filter(chip => !S.ledger.some(e => (e.realWork || []).length && goFirstFor(e.own.focus && e.own.focus.target) && GO_FIRST[goFirstFor(e.own.focus && e.own.focus.target)].chip === chip))
      .map(chip => ({ label: chip.split(' · ')[1], parent: items.find(it => it.newLabel === chip).id }));
    const sorted = S.learnSort === 'due' ? items.slice().sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity)) : items;
    return {
      back: S.learnFrom ? this.backFromLearnings : null, backLabel: S.own ? 'Back to your try' : 'Back to the chat', justOwned: S.justOwned || null,
      isDemo: this.isDemo, untried, sorted, sortByDue: S.learnSort === 'due', toggleSort: () => this.setState(s => ({ learnSort: s.learnSort === 'due' ? null : 'due' })),
      recalling: items.find(it => it.recall) || null, nextUp: items.filter(it => !it.due && it.dueAt != null).sort((a, b) => a.dueAt - b.dueAt)[0] || null,
      calPct: (() => { const c = calibration(S.ledger); return c.items ? c.got : null; })(),
      askedAbout: S.asked.filter(a => !a.checked).map(a => ({ ...a, when: rel(a.at, now), onCheck: () => this.checkLanded(a.id) })),
      openGaps: S.gaps.filter(g => g.status === 'open').map(g => ({ ...g, when: rel(g.at, now), onExplore: () => this.exploreGap(g.id) })),
      saveRecallGap: () => this.recallGap(), exploreRecallGap: () => this.exploreGap(this.recallGap()), gapTopics: S.gaps.map(g => g.topic),
      items, empty: !items.length, dueItems: items.filter(it => it.due), laterItems: items.filter(it => !it.due),
      onRecallText: e => this.setState(s => ({ recall: { ...s.recall, text: e.target.value } })), onRecallPick: (id, v) => this.setState(s => ({ recall: { ...s.recall, picked: { ...s.recall.picked, [id]: v } } })),
      askAboutRecall: this.askAboutRecall, resetDemo: this.resetDemo, submitRecall: this.submitRecall, closeRecall: () => this.setState({ recall: null }), skipAhead: this.skipAhead, shifted: S.timeShift > 0, shiftDays: Math.round(S.timeShift / DAY),
      exits: S.exits.map(x => ({ ...x, onReopen: reopen(x.scenario) })),
      stats: [
        { n: S.ledger.filter(e => !e.merged).length, label: 'owned' },
        { n: S.gaps.length, label: 'gaps found by trying' },
        { n: S.gaps.filter(g => g.status === 'closed').length, label: 'gaps closed' },
        { n: real.filter(r => !r.outsourced).length, label: 'times you went first' },
      ],
    };
  }

  // ---------- render ----------
  renderVals() {
    const S = this.state, o = S.own;
    const firstAnswer = S.messages.find(m => m.type === 'assistant' && m.code);
    const openGap = S.activeGap && S.gaps.find(g => g.id === S.activeGap && g.status === 'open');
    const lastAnswer = [...S.messages].reverse().find(m => m.type === 'assistant');
    const checkOpen = S.messages.some(m => m.type === 'gapCheck' && m.phase !== 'done');
    const messages = S.messages.map(m => {
      const v = { ...m, isUser: m.type === 'user', isThinking: m.type === 'thinking', isAssistant: m.type === 'assistant', isOwn: m.type === 'own', isOwnDone: m.type === 'ownDone' };
      if (m.type === 'gapBanner') { const g = S.gaps.find(x => x.id === m.gapId) || {}; Object.assign(v, { isGapBanner: true, gap: g, gapClosed: g.status === 'closed', checking: S.messages.some(x => x.type === 'gapCheck' && x.gapId === m.gapId && x.phase !== 'done'), onCheck: () => this.startGapCheck(m.gapId) }); }
      if (m.type === 'gapCheck') Object.assign(v, { isGapCheck: true, gapTopic: (S.gaps.find(x => x.id === m.gapId) || {}).topic || '', onText: e2 => this.setGo(m.id, { text: e2.target.value }), onSubmit: () => this.submitGapCheck(this.state.messages.find(x => x.id === m.id)), onAgain: () => this.startGapCheck(m.gapId) });
      // Go-first tries happen in the side panel (log 88); the chat keeps the offer and Claude's answer.
      if (m.type === 'goAsk' || m.type === 'goFirst' || m.type === 'gapCheck') Object.assign(v, { inPanel: false, onAskAbout: () => this.askAboutPanelTry(m.id), onClosePanel: () => this.setGo(m.id, { panelClosed: true }), onOpenPanel: () => this.setGo(m.id, { panelClosed: false }) });
      if (m.type === 'goAsk') Object.assign(v, { isGoAsk: true, onFirst: () => this.setGo(m.id, { phase: 'try' }), onAnswer: () => this.goAskAnswer(m.id), onText: e2 => this.setGo(m.id, { text: e2.target.value }), onSubmit: () => this.goAskSubmit(m.id),
        replyText: m.reply ? [m.reply.intro, m.reply.code, m.reply.outro].filter(Boolean).join('\n\n') : '', showReply: m.phase === 'answered' || m.phase === 'done' });
      if (m.type === 'goFirst') {
        const g = GO_FIRST[m.key], e = this.ownedFor(m.key);
        Object.assign(v, { isGo: true, go: g, goOwned: e ? e.title : '', goWas: e ? `you predicted ${e.predicted} of ${e.n} and got ${e.actual}` : '', goN: g.check ? (g.check.type === 'choice' ? g.check.questions.length : g.check.type === 'number' ? g.check.expected.length : (g.check.items || [1]).length) : 1,
          // What the go-first try is checked on, named as topics (as on the predict screen), so "how many" points at something.
          goTopics: g.check.type === 'choice' ? g.check.questions.map(q => q.short || q.prompt) : g.check.type === 'sql' && (g.check.items || []).every(i => i.topic) ? g.check.items.map(i => i.topic) : [],
          goKind: g.check.type === 'choice' ? 'question' : g.check.type === 'sql' ? 'thing it has to get right' : 'answer',
          goFirst: () => this.setGo(m.id, { phase: 'predict' }), goAnswer: () => this.goOutsource(m), goPredict: n => this.setGo(m.id, { prediction: n, phase: 'try' }),
          goText: e2 => this.setGo(m.id, { text: e2.target.value }), goPick: (id, val) => this.setGo(m.id, x => ({ picked: { ...x.picked, [id]: val } })), goCheck: () => this.goCheck(m),
          goResult: m.grade ? (() => { const t = tally(m.grade), said = `You said ${m.prediction} of ${t.n} and got ${t.right}.`; return t.right === m.prediction ? `${said} Spot on.` : t.right > m.prediction ? `${said} You own more than you thought.` : said; })() : '', goItems: m.grade && m.grade.items ? m.grade.items : [] });
      }
      if (v.isAssistant) { v.flash = S.flashMsg === m.id; v.owning = o && o.msgId === m.id ? (o.code === o.fullCode || o.code.length > 400 ? 'whole' : 'part') : null; v.hasIntro = !!m.intro; v.hasOutro = !!m.outro; v.hasCode = !!m.code; v.showOwnHint = m.learn && !!m.code && !m.streaming; v.checkChip = !!openGap && m === lastAnswer && !checkOpen ? () => this.checkMeFromChat(openGap.id) : null;
        const askedItem = m.askedId && S.asked.find(a => a.id === m.askedId);
        v.ownExpanded = !!(askedItem && !askedItem.checked && !o); v.showTip = !S.tipDismissed && !o && m === firstAnswer; v.ownActive = !!o && o.msgId === m.id; v.ownBlocked = !!o && !v.ownActive; v.onCopy = () => this.copyAnswer(m); v.onSpeak = () => this.speakAnswer(m); v.copied = this.state.copied === m.id; v.when = m.at ? ago(m.at) : ''; v.onMouseUp = e => this.onCodeMouseUp(m, e); v.ownAll = () => { if (this.state.own) { if (this.state.own.msgId === m.id) { const pn = this.panelRef.current; if (pn) pn.scrollTop = 0; } return; } this.beginOwn(m, m.code, m.plain ? null : this.wholeFocus(m)); }; // The expanded button owns exactly what you asked about (no focus question): set after the default, which it replaces.
        if (v.ownExpanded) v.ownAll = () => this.checkLanded(askedItem.id); v.ownAllLabel = m.lang === 'email' ? 'Own the whole email' : m.lang === 'sql' ? 'Own the whole query' : m.plain ? 'Own this response' : 'Own the whole thing'; v.isMd = !!m.plain; v.isProse = !v.isMd && (m.lang === 'email' || !!(m.scenario && m.scenario.prose) || !!m.plain); v.isCodeBlock = !v.isMd && !v.isProse; }
      return v;
    });
    // The go-first try shown in the side panel: the latest one that's under way (or just finished) and not closed.
    const goPanel = messages.slice().reverse().find(v => ((v.isGo && ['predict', 'try', 'done'].includes(v.phase)) || (v.isGoAsk && ['try', 'checking', 'done'].includes(v.phase)) || v.isGapCheck) && !v.panelClosed) || null;
    if (goPanel) goPanel.inPanel = true;
    const ledger = S.ledger.map(e => ({ ...e, hasDelayed: e.delayed != null, isDue: e.dueAt != null && e.dueAt <= this.now() }));
    // Calibration across every item you predicted: what share you expected to get right vs what you got.
    // The Brier score (mean squared gap between your expected chance and each item's outcome; 0 is perfect)
    // is in the tooltip for anyone who wants the standard measure.
    const cal = calibration(S.ledger);
    const V = {
      goPanel, hasOwn: !!o, panelRef: this.panelRef, focusPanel: () => { const pn = this.panelRef.current; if (pn) pn.scrollTop = 0; },
      dismissTip: () => this.setState({ tipDismissed: true }),
      openNav: () => this.setState({ navOpen: true }), closeNav: () => this.setState({ navOpen: false }),
      isLearnings: S.view === 'learnings', openLearnings: this.openLearnings, ownedCount: S.ledger.filter(e => !e.merged).length, dueCount: S.ledger.filter(e => e.dueAt != null && e.dueAt <= this.now()).length,
      learn: this.learningsVals(),
      // Seeded chats show up as past chats: you already talked with Claude, now see what stuck.
      chatList: [
        ...(S.messages.length && ![this.BOOK.title, this.JUNO.title].includes(S.chatTitle) ? [{ title: S.chatTitle, active: true, onClick: () => {} }] : []),
        { title: this.BOOK.title, active: S.chatTitle === this.BOOK.title, onClick: this.startBook },
        { title: this.JUNO.title, active: S.chatTitle === this.JUNO.title, onClick: this.startJuno },
      ],
      messages, ledger, ledgerEmpty: !S.ledger.length && !S.exits.length, exits: S.exits, hasExits: !!S.exits.length, chatTitle: S.chatTitle, isEmpty: !S.messages.length, composer: S.composer,
      hasCalibration: cal.items > 0, calibrationText: cal.text, calibrationTitle: cal.title,
      composerBorder: '#D9D4CA', composerPlaceholder: 'Ask Claude anything…',
      onComposer: e => this.setState({ composer: e.target.value }), onComposerKey: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } }, send: this.send, newChat: this.newChat, startLead: this.startLead, startRisk: this.startRisk, startSql: this.startSql, startReact: this.startReact, startBook: this.startBook, startJuno: this.startJuno,
            composerRef: this.composerRef, hasSel: !!S.sel, selX: S.sel ? S.sel.x + 'px' : '0px', selY: S.sel ? S.sel.y + 'px' : '0px', ownSelection: this.ownSelection, askSelection: this.askSelection, scrollRef: this.scrollRef,
    };
    if (!o) return V;
    const L = this.ladder(o);
    // One progress indicator for the whole flow. The visual (Compare / See it) is part of "Try it", not a step of its own.
    const phases = (o.askedFocus ? ['focus'] : []).concat(['predict', 'ladder', 'reveal']);
    const phaseName = { focus: 'What to own', predict: 'Predict', ladder: 'Try it', reveal: 'Reveal' };
    const curPhase = o.phase === 'teach' ? 'reveal' : o.phase;
    const stepper = phases.map(ph => ({ label: phaseName[ph], cur: ph === curPhase, done: phases.indexOf(ph) < phases.indexOf(curPhase) }));
    const phaseLabels = Object.fromEntries(phases.map(ph => [ph, ph === 'ladder' && o.step === 'assemble' ? 'Try it · warming up with the pieces' : ph === 'ladder' && o.step !== 'write' ? 'Try it · seeing it visually' : phaseName[ph]]).concat([['teach', 'Optional · teach Sam']]));
    const goStep = s => () => { if (this.state.own.phase === 'ladder' && this.state.own.step === s) return; this.setOwn({ phase: 'ladder' }, () => this.enterStep(s)); };
    const ladderNav = L.map(s => { const cur = o.step === s && o.phase === 'ladder', done = !!o.visited[s] && !cur; return { label: stepLabel(o, s), onClick: goStep(s), bg: cur ? '#C4613A' : done ? '#F1E3D8' : 'transparent', fg: cur ? '#fff' : done ? '#9E4B2A' : '#716C64' }; });
    const nextOf = s => L[L.indexOf(s) + 1];
    const nextLabel = { see: 'see it run →', assemble: 'assemble it →', compare: 'compare it →', write: 'now write one yourself →' };
    Object.assign(V, {
      ...(() => {
        const whole = o.code === o.fullCode || o.code.length > 400;
        const lead = o.code.replace(/```[\s\S]*?```/g, ' ').replace(/[*`#>]/g, '').replace(/\s+/g, ' ').trim();
        const looksLikeCode = !o.code.includes('```') && /[;{}=()]|^\s*(SELECT|FROM|LEFT|JOIN|WHERE|GROUP|ORDER|AND|const|let|return|function|if|import)\b/m.test(o.code) && !/[a-z]+ [a-z]+ [a-z]+ [a-z]+[.,]/i.test(o.code);
        return { ownWhole: whole, ownLead: (lead.match(/^.*?[.?!](\s|$)/) || [lead])[0].trim().slice(0, 150), ownQuote: looksLikeCode ? '```' + (o.lang || '') + '\n' + o.code + '\n```' : o.code };
      })(),
      ownEntryLabel: 'Own it', ownTitle: o.focus ? o.focus.label : S.chatTitle, ownCode: o.code.replace(/```\w*\n?/g, '').replace(/\*\*|`/g, ''), ownIsProse: !!(o.scenario && o.scenario.prose), conceptInLabel: (o.scenario && o.scenario.inYourLabel) || 'In your query', ownPhaseLabel: phaseLabels[o.phase], stepper, ownShowLadderNav: o.phase === 'ladder' || o.phase === 'reveal', ladderNav,
      phaseFocus: o.phase === 'focus', focusLoading: !o.focusOptions, focusOptions: (o.focusOptions || []).map(f => ({ label: f.label, kind: f.mode === 'sequence' ? 'structure' : 'concept', onPick: () => this.pickFocus(f) })),
      focusOther: o.focusOther, onFocusOther: e => this.setOwn({ focusOther: e.target.value }), onFocusOtherKey: e => { if (e.key === 'Enter') this.submitFocusOther(); }, submitFocusOther: this.submitFocusOther,
      hasFocus: !!o.focus, focusLabel: o.focus ? o.focus.label : '',
      toggleRefresher: () => this.setOwn(cur => ({ refresherOpen: !cur.refresherOpen })), refresherOpen: !!o.refresherOpen,
      rereadChat: () => { if (window.matchMedia && window.matchMedia('(max-width: 760px)').matches) this.setState({ sheetMin: true }); const hl = this._ownedRange && this._ownedRange.startContainer.parentElement; if (hl) { hl.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } const el = document.querySelector(`[data-msg-id="${o.msgId}"]`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); this.setState({ flashMsg: o.msgId }); setTimeout(() => this.setState({ flashMsg: null }), 1600); } },
      goNext: this.goNext, seeNextLabel: 'Got it, ' + nextLabel[nextOf('see')],
      goVisual: this.goVisual, visualAgainLabel: 'See it visually',
      seeIsProse: o.lang === 'email',
      phasePredict: o.phase === 'predict', phaseLadder: o.phase === 'ladder', phaseReveal: o.phase === 'reveal', phaseTeach: o.phase === 'teach',
      cancelOwn: this.cancelOwn, leaveOwn: this.leaveOwn, changeFocus: this.changeFocus,
      // Before you commit to a number: a nudge back to what you're owning, which stays open in the chat beside the panel.
      predictReread: o.code === o.fullCode || o.code.length > 400 ? "Claude's answer" : 'the part you highlighted',
      ...(() => {
        const w = o.write, chk = w.check, label = o.focus ? o.focus.label : 'this';
        if (w.loading || (!w.task && !chk)) return { predictReady: false, predictQuestion: 'Preparing your try…', predictTask: '', predictTopics: [], predictWhat: '', predictOptions: [] };
        // You predict about the try itself: it's shown, with what it will be checked on, so "these" points at something.
        const n = this.plannedItems(o).length, topics = this.plannedTopics(o);
        const thing = chk && chk.type === 'choice' ? 'question' : chk && chk.type === 'steps' ? 'step' : chk && chk.type === 'explain' ? 'key idea' : chk && chk.type === 'sql' ? 'thing' : 'requirement';
        const plural = n === 1 ? thing : thing + 's';
        return { predictReady: true, predictTask: w.task, predictTopics: topics || [],
          predictWhat: chk && chk.type === 'choice' ? `${n} ${plural}, on:` : topics ? `It's checked on ${n} ${plural}:` : chk && chk.type === 'explain' ? `Your answer is checked for ${n} ${plural}.` : `It's checked on ${n} ${plural}.`,
          predictQuestion: n === 1 ? 'Will you get it right on your own?' : `How many of the ${n} will you get right on your own?`,
          predictLow: this.frame(o).orderMatters ? 'Under half? You\'ll start with a quick warm-up.' : '',
          predictOptions: (n === 1 ? [[0, 'Not yet'], [1, 'Yes']] : Array.from({ length: n + 1 }, (_, k) => [k, k === 0 ? 'none' : k === n ? 'all' : ''])).map(([k, l]) => ({ n: k, label: n === 1 ? l : k === 0 ? 'none' : k === n ? 'all' : `of ${n}`, selected: o.predSel === k, onPick: () => this.setOwn({ predSel: k }) })),
          // Pick a number, then lock it in: the choice stays visible and changeable until you start.
          predSel: o.predSel ?? null, lockPrediction: () => { const k = this.state.own.predSel; if (k != null) this.pickPrediction(k); } };
      })(),
      writeRefresher: o.write.grade ? [] : [...(this.frame(o).orderMatters ? [{ label: 'Warm up with the pieces', onClick: goStep('assemble') }] : []), ...(this.visualStep(o) ? [{ label: 'See it visually', onClick: goStep(this.visualStep(o)) }] : [])],
      askAboutIt: this.askAboutIt, revealVisual: this.visualStep(o) ? goStep(this.visualStep(o)) : null,
      stepSee: o.step === 'see', stepAsm: o.step === 'assemble', stepCompare: o.step === 'compare', stepWrite: o.step === 'write',
      hasConcept: !!(o.concept && !o.concept.loading), conceptLoading: !!(o.concept && o.concept.loading),
      conceptModel: o.concept ? o.concept.model || '' : '', conceptInYourCode: o.concept ? o.concept.inYourCode || '' : '', conceptRule: o.concept ? o.concept.rule || '' : '',
      conceptGrid: o.concept && o.concept.grid ? { cols: `minmax(90px,.8fr) ${o.concept.grid.headers.slice(1).map(() => 'minmax(0,1fr)').join(' ')}`, headers: o.concept.grid.headers.map(t => ({ t })), rows: o.concept.grid.rows.map(r => ({ cells: r.map((c, j) => typeof c === 'object' && c ? { t: c.t, strong: !!c.strong, first: j === 0 } : { t: String(c), strong: false, first: j === 0 }) })) } : null,
      readIntro: o.focus && o.focus.mode === 'concept' ? `The idea first, then how it applies to your ${o.scenario && o.scenario.prose ? 'question' : 'query'}.` : "Each line, what it does and why it's there. Read, then move on when it makes sense.",
      goSee: this.goSee, goAssemble: this.goAssemble, goWrite: this.goWrite,
      qa: o.qa.map(x => ({ ...x, hasA: !!x.a })), hasQa: o.qa.length > 0, qaInput: o.qaInput, onQaInput: e => this.setOwn({ qaInput: e.target.value }), onQaKey: e => { if (e.key === 'Enter') this.askStep(this.state.own.qaInput); }, sendQa: () => this.askStep(this.state.own.qaInput),
      composerPlaceholder: 'Reply to Claude…'
    });
    // see
    const see = o.see, idx = o.seeIdx, cur = see ? see[idx] : null;
    const isSqlSee = o.scenario === this.SQL && o.lang === 'sql';
    Object.assign(V, {
            seeIntro: isSqlSee ? 'The query, run on six customers and twelve orders, in the order the database actually runs it. Two side steps show what would go wrong with a plain JOIN, and with the filter in WHERE.' : o.scenario === this.REACT ? 'The component, run through a mount, two quick id changes, and a late response. Two side steps show what breaks without the cleanup, and with an empty dependency array.' : 'The code, run step by step in the order things actually happen.',
      seeLoading: o.seeLoading, seeReady: !!see && !o.timeline, seeTimeline: !!o.timeline,
      seeClauses: see ? see.map((s, i) => ({ text: s.clause, order: s.contrast ? '↳' : see.slice(0, i + 1).filter(x => !x.contrast).length, bg: i === idx ? (s.contrast ? '#8A847A' : '#C4613A') : i < idx ? (s.contrast ? '#EEEAE2' : '#F1E3D8') : '#F4F1EA', fg: i === idx ? '#fff' : i < idx ? (s.contrast ? '#716C64' : '#9E4B2A') : '#8A847A', italic: s.contrast ? 'italic' : 'normal' })) : [],
      seeStepTitle: cur ? cur.title : '', seeStepNote: cur ? cur.note : '', seeHasTable: !!(cur && cur.rows),
      seeIsContrast: !!(cur && cur.contrast), seeStepKicker: cur && cur.contrast ? 'What would go wrong' : 'What happens',
      seeCols: cur && cur.headers ? cur.headers.map(() => 'minmax(0,1fr)').join(' ') : '1fr',
      seeHeaders: cur && cur.headers ? cur.headers.map(t => ({ t })) : [],
      seeRows: cur && cur.rows ? cur.rows.map(r => ({ cells: r.cells.map(t => ({ t: String(t) })), bg: r.dim ? '#FFF1E8' : '#fff', fg: r.dim ? '#B58A74' : '#1F1D1A', deco: r.dim ? 'line-through' : 'none' })) : [],
      seeRowCount: cur && cur.rows ? (cur.rows.filter(r => !r.dim).length + ' rows' + (cur.rows.some(r => r.dim) ? ', ' + cur.rows.filter(r => r.dim).length + (cur.contrast ? ' would be lost' : ' dropped') : '')) : '',
      seePrev: this.seePrev, seeNext: this.seeNext, seeHasNext: !!see && idx < see.length - 1, seeAtEnd: !!see && idx === see.length - 1,
      hasBridges: !!(o.bridges && o.bridges.length), bridges: (o.bridges || []).map(t => ({ t }))
    });
    // compare
    const cm = o.cmp, cmGuessed = cm ? Object.keys(cm.guesses).length : 0, cmRight = cm ? cm.cases.filter((k, i) => this.cmpIsRight(k, cm.guesses[i])).length : 0;
    if (cm) {
      const k = cm.cases[cm.idx], shown = !!(k && cm.revealed[cm.idx]);
      const table = (h, rows) => ({ cols: h.map(() => 'minmax(0,1fr)').join(' '), headers: h.map(t => ({ t })), rows: rows.map(r => ({ cells: r.map(t => ({ t: String(t), dim: t === 'NULL' })) })) });
      const g = cm.guesses[cm.idx];
      Object.assign(V, {
        cmpLoading: !!cm.loading, cmpIntro: cm.intro || '', cmpHasCases: cm.cases.length > 0,
        cmpTabs: cm.cases.map((x, i) => ({ label: x.label, onClick: () => this.setCmp({ idx: i }), bg: i === cm.idx ? '#C4613A' : cm.revealed[i] ? '#F1E3D8' : '#F4F1EA', fg: i === cm.idx ? '#fff' : cm.revealed[i] ? '#9E4B2A' : '#716C64' })),
        cmpHasSource: !!cm.source, cmpSource: cm.source ? [['customers', cm.source.customers], ['orders', cm.source.orders]].map(([name, t]) => ({ name, ...table(t.headers, t.rows) })) : [],
        cmpCode: k ? k.code : '', cmpIsTable: !!(k && k.rows), cmpIsPick: !!(k && k.options), cmpShown: shown, cmpHidden: !!k && !shown,
        cmpPickOptions: k && k.options ? k.options.map(x => ({ l: x.l, onPick: () => this.cmpGuess(cm.idx, x.v) })) : [],
        cmpPatterns: k && k.n && shown ? patterns(k.n) : null,
        cmpPatternLine: k && k.n && shown ? `${patterns(k.n).filter(p => p.miss).length} of ${2 ** k.n} equally likely patterns miss (highlighted): all ↑ above the true median, or all ↓ below.` : '',
        cmpGuessOptions: k && k.rows ? [1, 2, 3, 4, 5, 6, 7].map(n => ({ n, onPick: () => this.cmpGuess(cm.idx, n) })) : [],
        cmpTable: k && k.rows ? table(k.headers, k.rows) : null,
        cmpResultLine: k && k.rows && shown ? (g === k.rows.length ? `You guessed ${g}. Right: ${k.rows.length} rows.` : `You guessed ${g}. It's ${k.rows.length} rows.`)
          : k && k.options && shown ? `You guessed ${k.options.find(x => x.v === g).l.toLowerCase()}. ${g === k.answer ? 'Right: ' : "It's "}${k.answerText}.` : '',
        cmpAsk: k && k.ask ? k.ask : "What's the chance?", cmpDiagram: k && k.diagram && shown ? k.diagram : null,
        cmpOutcome: k && !k.rows ? k.outcome : '', cmpNote: k ? k.note : '',
        cmpGuessText: (cm.textGuess || ''), onCmpGuessText: e => this.setCmp({ textGuess: e.target.value }), cmpRevealText: () => this.setCmp(c => ({ guesses: { ...c.guesses, [c.idx]: c.textGuess || '' }, revealed: { ...c.revealed, [c.idx]: true }, textGuess: '' })),
        cmpHasNextCase: cm.idx < cm.cases.length - 1, cmpNextCase: () => this.setCmp(c => ({ idx: c.idx + 1 })),
        cmpAllSeen: cm.cases.length === 0 || cm.cases.every((x, i) => cm.revealed[i]), cmpNextLabel: o.write.grade ? 'Back to the reveal' : 'Got it, ' + nextLabel[nextOf('compare')],
      });
    }
    // assemble
    const a = o.asm;
    if (a) {
      const byId = {}; a.pieces.forEach(p => byId[p.id] = p);
      Object.assign(V, {
        asmBank: a.bank.map(id => ({ text: byId[id].text, onClick: () => this.asmAdd(id) })), asmBankEmpty: !a.bank.length,
        asmSeq: a.seq.map(id => ({ text: byId[id].text, onClick: () => this.asmRemove(id), up: () => this.asmMove(id, -1), down: () => this.asmMove(id, 1), bg: a.lastWrong.includes(id) ? '#FFF1E8' : '#fff', border: a.lastWrong.includes(id) ? '#C4613A' : '#E3DFD6' })),
        asmFeedback: !!a.feedback, asmFeedbackText: a.feedback, asmNotCorrect: !a.correct, asmCorrect: a.correct, asmLoading: a.loading, checkAsm: this.checkAsm,
        asmWhyPrompt: (this.targetOf(o) && this.targetOf(o).assemble && this.targetOf(o).assemble.why) || 'In one line: what would break if you swapped two of these lines?', asmHasDecoy: !!(a.pieces.some(p => p.id === 'dx')), asmWhy: a.why, onAsmWhy: e => this.setAsm({ why: e.target.value })
      });
    } else Object.assign(V, { asmBank: [], asmSeq: [], asmBankEmpty: false, asmFeedback: false, asmNotCorrect: true, asmCorrect: false, asmLoading: false });
    // write
    const w = o.write;
    Object.assign(V, {
      writeFixing: !!w.firstGrade && !w.grade, writeTry: w.attempts + 1, writeLastGap: w.firstGrade ? (w.lastGap || w.firstGrade.gap || '') : '',
      notReady: o.prediction != null && !w.firstGrade && o.prediction / Math.max(1, this.plannedItems(o).length) < 0.5, askClaudeFirst: this.askClaudeFirst, seeInLearnings: this.seeInLearnings,
      writeIsChoice: !!(w.check && w.check.type === 'choice'), writeIsSteps: !!(w.check && w.check.type === 'steps'), writeSteps: w.check && w.check.steps ? w.check.steps : [], writeQs: w.check && w.check.questions ? w.check.questions : [], writePicked: w.picked,
      onWritePick: (id, v) => this.setOwn(cur => ({ write: { ...cur.write, picked: { ...cur.write.picked, [id]: v } } })),
      writeBefore: w.before, writeAfter: w.after, writePlaceholder: w.placeholder || 'Write it here. Ask for a hint any time; hints are part of learning, not cheating.',
      writeTask: w.task, writeLoading: w.loading, writeSchema: w.schema, hasWriteSchema: !!w.schema, writeText: w.text, onWriteText: e => this.setOwn({ write: { ...this.state.own.write, text: e.target.value } }),
      hasHints: w.hints.length > 0, hints: w.hints.map((t, i) => ({ t, n: i + 1 })), askHint: this.askHint, submitWrite: this.submitWrite,
      writeNotGraded: !w.grade, writeCanDrop: w.hints.length >= 2, gradeLoading: w.gradeLoading || w.hintLoading, gradeLoadingText: w.hintLoading ? 'thinking of a hint…' : 'grading fairly…'
    });
    // reveal
    const g = w.grade || { score: 0, worked: '', gap: '', revealLine: '' };
    const g1 = w.firstGrade || g; // the measurement: your first unassisted try
    const order = L, labels = Object.fromEntries(L.map(s => [s, stepLabel(o, s)]));
    const startI = order.indexOf(o.startStep);
    const t1 = tally(g1), tn = tally(g), N = t1.n;
    const pct = k => (N ? k / N * 100 : 0) + '%';
    const lo = Math.min(o.prediction, t1.right), hi = Math.max(o.prediction, t1.right);
    Object.assign(V, {
      revealHeadline: g1.judgedByClaude ? "It didn't run, so Claude judged it." : g1.didntRun ? "It didn't run yet." : t1.right === o.prediction ? 'Your prediction matched.' : t1.right > o.prediction ? 'You own more than you predicted.' : 'The reading was smoother than the doing.',
      // What was checked, item by item, on your first try. The idea you came to own is marked.
      revealItems: (g1.items || []).map(i => ({ ...i, mark: i.ok ? '✓' : '✗' })), revealOwnedNote: (g1.items || []).some(i => i.owned) ? 'the idea you came to own' : '',
      canFix: !!w.grade && !allRight(g), fixWrite: this.fixWrite,
      revealFixLine: w.attempts > 1 ? `Try ${w.attempts}: ${tn.right} of ${tn.n}${tn.right === tn.n ? ', fixed' : ''}. Your prediction is still measured against your first try (${t1.right} of ${N}), since that's what you could do on your own.` : '',
      revealNodes: order.map((s, i) => {
        const v = o.visited[s] || 0; const skipped = i < startI && !v;
        let detail = skipped ? 'optional, not opened' : s === 'see' ? (v > 1 ? 'watched ' + v + '×' : 'watched it run') : s === 'assemble' ? (a ? (a.attempts === 1 ? 'right first try' : a.attempts + ' tries' + (a.usedDistractor ? ', filter in WHERE' : '')) : '') : s === 'compare' ? (cmGuessed ? cmRight + ' of ' + cmGuessed + ' guesses right' : 'compared') : (t1.right + ' of ' + N + (w.attempts > 1 ? ' → ' + tn.right + ' on try ' + w.attempts : '') + (w.hints.length ? ', ' + w.hints.length + ' hint' + (w.hints.length > 1 ? 's' : '') : ', no hints'));
        return { label: labels[s], detail, above: i === startI ? 'started here · predicted ' + o.prediction : '', mark: skipped ? '' : '✓', dotBg: skipped ? '#F6F4EF' : s === 'write' ? '#2F8F86' : '#C4613A', dotBorder: skipped ? '#D9D4CA' : s === 'write' ? '#2F8F86' : '#C4613A', fg: skipped ? '#B5AFA4' : '#1F1D1A' };
      }),
      revealCols: `repeat(${order.length},1fr)`, predLeft: pct(o.prediction), actLeft: pct(t1.right), gapLeft: pct(lo), gapWidth: (N ? (hi - lo) / N * 100 : 0) + '%', ownPredictionN: o.prediction, actualN: t1.right, revealN: N,
      // The ✓/✗ list already says what held for picked answers; the explanation line is for runs and written answers.
      revealWhy: g.didntRun || (w.check && ['choice', 'steps'].includes(w.check.type) && (g1.items || []).length) ? '' : g.why || RUBRIC_WHY[g.score] || '',
      revealNotes: [...(g.worked && !(w.check && ['choice', 'steps'].includes(w.check.type)) ? [{ kind: 'nice', quote: '', text: g.worked }] : []), ...(w.notes || [])], notesLoading: !!w.notesLoading,
      revealScale: g1.judgedByClaude ? "It didn't run, so Claude judged each item from your query, quoting it as evidence" : w.check && SCALES[w.check.type] ? SCALES[w.check.type] : 'Checked by Claude against each requirement, quoting your attempt as evidence',
      revealCorrection: correctionNote(g.corrections),
      revealTables: g.table ? [['What yours returns', g.table.yours, 'extra', '#FBE9E1'], ['What it should return', g.table.expected, 'missing', '#E2F1EE']].map(([title, t, mark, bg]) => ({
        title, empty: !t.rows.length, cols: t.cols.map(() => 'minmax(0,1fr)').join(' ') || '1fr', headers: t.cols.map(c => ({ t: c })),
        rows: t.rows.map(r => ({ cells: r.cells.map((c, j) => ({ t: c, dim: c === 'NULL', hl: (r.diffs || []).includes(j) ? bg : '' })), bg: r.mark === mark ? bg : '' })),
        legend: [t.rows.some(r => r.mark === mark) ? (mark === 'extra' ? 'highlighted rows: should not be there' : 'highlighted rows: yours is missing them') : '', t.rows.some(r => r.mark === 'near') ? 'highlighted cells: the difference' : '', mark === 'extra' && g.table.dropped && g.table.dropped.length ? `extra columns left out: ${g.table.dropped.join(', ')}` : ''].filter(Boolean).join(' · ') })) : [],
      revealLine: g1.revealLine, hasWorked: !!g.worked, gradeWorked: g.worked, hasGap: !!g.gap, gradeGap: g.gap, finishOwn: this.finishOwn, goTeach: this.goTeach
    });
    // teach
    const t = o.teach;
    Object.assign(V, {
      teachMsgs: t.msgs.map(m => ({ text: m.text, isSam: m.role === 'sam', align: m.role === 'sam' ? 'flex-start' : 'flex-end', bg: m.role === 'sam' ? '#fff' : '#E9E4DA' })),
      teachLoading: t.loading, teachOpen: t.turns < 3 && !t.debrief, teachDebrief: t.debrief || null, teachDebriefLoading: !!t.debriefLoading, wrapTeach: this.debriefTeach, canWrap: t.turns >= 1 && !t.debrief,
      exploreTeachGap: u => this.exploreGap(this.teachGap(u)), saveTeachGap: u => this.teachGap(u), gapTopics: S.gaps.map(g => g.topic), teachInput: t.input, onTeachInput: e => this.setOwn({ teach: { ...this.state.own.teach, input: e.target.value } }), onTeachKey: e => { if (e.key === 'Enter') this.sendTeach(); }, sendTeach: this.sendTeach
    });
    return V;
  }

  render() {
    const V = this.renderVals();
    const panel = V.hasOwn && !V.isLearnings ? <OwnPanel V={V} /> : V.goPanel && !V.isLearnings ? (V.goPanel.isGapCheck ? <GapPanel m={V.goPanel} /> : <GoPanel m={V.goPanel} />) : null;
    return (
      <>
      <div data-role="app" className={(this.state.navOpen ? 'nav-open ' : '') + (panel ? 'with-sheet' : '')} style={css(`display:flex;height:100vh;overflow:hidden`)}>

      <Sidebar V={V} />
      {!!this.state.navOpen && <div className="nav-backdrop mobile-only" onClick={() => this.setState({ navOpen: false })}></div>}

      <Chat V={V} />

      {/* On a phone the panel is a sheet over the chat (mobile.css); on a wide screen the wrapper doesn't exist for layout. */}
      {!!panel && (
        <div className={'sheet' + (this.state.sheetMin ? ' min' : '')}>
          {panel}
          <button className="sheet-toggle mobile-only" data-role="sheet-toggle" onClick={() => this.setState(s => ({ sheetMin: !s.sheetMin }))} aria-label={this.state.sheetMin ? 'Open the panel' : 'Tuck the panel away to read the chat'}>{this.state.sheetMin ? '⌃' : '⌄'}</button>
        </div>
      )}
      </div>
      </>
    );
  }
}
