// Ported from the Claude Design prototype "Own It or Outsource It.dc.html".
// The logic below is the design's own code, kept close to verbatim; only the Claude calls
// were rewired to /api/claude. render() is the design's template converted to JSX.
import React from 'react';
import { complete } from './claude.js';
import { css } from './css.js';
import { SQL_TARGETS, sqlFocusOptions } from './targets.js';
import { checkSql, SQL_SCALE } from './sqlCheck.js';
import { BOOK_TARGETS, bookFocusOptions, patterns } from './bookTargets.js';
import { checkNumber, NUMBER_SCALE } from './numberCheck.js';
import { BOOK_TURNS } from './bookTranscript.js';
import { JUNO_TARGETS, junoFocusOptions } from './junoTargets.js';
import { JUNO_TURNS } from './junoTranscript.js';
import { checkChoice, CHOICE_SCALE } from './choiceCheck.js';
import { GO_FIRST, goFirstFor } from './goFirst.js';
import { ruleNotes, keepQuoted } from './notes.js';
import EffectTimeline from './EffectTimeline.jsx';
import { gapSystem, checkPrompt, judgePrompt, isColdStart, COLD_START, judgeColdStartOffline } from './gaps.js';
import { REACT_TURNS } from './reactTranscript.js';
import { REACT_TARGETS } from './reactTargets.js';
import { SQL_TURNS } from './sqlTranscript.js';

// Claude's answers as Claude renders them: paragraphs, ## headings, - bullets, `inline code`, fenced code blocks.
const inline = t => t.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/).map((p, i) => p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <b key={i}>{inline(p.slice(2, -2))}</b> : p.startsWith('*') && p.endsWith('*') && p.length > 2 && !p.startsWith('**') ? <i key={i}>{inline(p.slice(1, -1))}</i> : p.startsWith('`') && p.endsWith('`') && p.length > 1 ? <code key={i} style={css(`font-family:'JetBrains Mono',monospace;font-size:.86em;background:#F1EEE8;border-radius:4px;padding:1px 5px`)}>{p.slice(1, -1)}</code> : p);
function Md({ text, small }) {
  const body = small ? 'font-family:Newsreader,serif;font-size:14.5px;line-height:1.55;white-space:pre-wrap' : SERIF;
  const parts = text.split(/```(\w*)\n([\s\S]*?)```/);
  const out = [];
  for (let i = 0; i < parts.length; i += 3) {
    parts[i].split(/\n{2,}/).map(b => b.trim()).filter(Boolean).forEach((b, j) => {
      const key = `${i}-${j}`;
      if (/^#{1,3} /.test(b)) out.push(<div key={key} style={css(`font-family:Newsreader,serif;font-size:${small ? '15.5px' : '18.5px'};font-weight:600;margin-top:4px`)}>{inline(b.replace(/^#{1,3} /, ''))}</div>);
      else if (b.split('\n').every(l => /^\d+\. /.test(l))) out.push(<ol key={key} style={css(`margin:0;padding-left:24px;display:flex;flex-direction:column;gap:6px;font-family:Newsreader,serif;font-size:${small ? '14.5px' : '16.5px'};line-height:1.6`)}>{b.split('\n').map((l, k) => <li key={k}>{inline(l.replace(/^\d+\. /, ''))}</li>)}</ol>);
      else if (b.split('\n').every(l => l.startsWith('- '))) out.push(<ul key={key} style={css(`margin:0;padding-left:22px;display:flex;flex-direction:column;gap:6px;font-family:Newsreader,serif;font-size:${small ? '14.5px' : '16.5px'};line-height:1.6`)}>{b.split('\n').map((l, k) => <li key={k}>{inline(l.slice(2))}</li>)}</ul>);
      else out.push(<div key={key} style={css(body)}>{inline(b)}</div>);
    });
    if (parts[i + 2] != null) out.push(
      <div key={`c${i}`} style={css(`background:#FBFAF7;border:1px solid #E3DFD6;border-radius:10px;overflow:hidden`)}>
        <div style={css(`padding:6px 12px;border-bottom:1px solid #EEEAE2;font-size:11px;color:#8A847A`)}>{parts[i + 1] || 'code'}</div>
        <pre style={css(`margin:0;padding:14px 16px;font-family:'JetBrains Mono',monospace;font-size:${small ? '12px' : '13px'};line-height:1.6;overflow:auto;white-space:pre`)}>{parts[i + 2].replace(/\n$/, '')}</pre>
      </div>);
  }
  return <div style={css(`display:flex;flex-direction:column;gap:12px`)}>{out}</div>;
}

// Every hand-written learning target, by id. Ids are unique across starters.
const TARGETS = { ...SQL_TARGETS, ...BOOK_TARGETS, ...JUNO_TARGETS, ...REACT_TARGETS };
// Score an attempt with the target's own check: run it (SQL), calculate it (numbers) or match picks (choice).
async function runCheck(check, text, before, after, picked) {
  if (check.type === 'number') return checkNumber(check, text);
  if (check.type === 'choice') return checkChoice(check, picked || {});
  return checkSql(check, text, before, after);
}
const SCALES = { number: NUMBER_SCALE, choice: CHOICE_SCALE, explain: '5 every key idea · 3 some · 2 none yet · 1 nothing written' };

// Multiple-choice questions for a "chosen" check. Picks lock once checked.
function ChoiceQuestions({ qs, picked, onPick, locked }) {
  return (
    <div style={css(`display:flex;flex-direction:column;gap:14px`)}>
      {qs.map((q, i) => (
        <div key={q.id} data-role="choice-q" style={css(`display:flex;flex-direction:column;gap:6px`)}>
          <div style={css(`font-size:14px;line-height:1.45`)}><span style={css(`color:#9E4B2A`)}>{i + 1}.</span> {q.prompt}</div>
          {q.options.map(o => {
            const on = picked[q.id] === o.v;
            return <button key={o.v} disabled={locked} onClick={() => onPick(q.id, o.v)} style={css(`text-align:left;border:1px solid ${on ? '#C4613A' : '#E3C9B8'};background:${on ? '#FFF1E8' : '#fff'};color:#1F1D1A;border-radius:9px;padding:8px 12px;font-size:13.5px;line-height:1.4`)} className={locked ? '' : 'hv3'}>{on ? '● ' : '○ '}{o.l}</button>;
          })}
        </div>
      ))}
    </div>
  );
}

// Action-row icons, drawn to sit with Claude's copy / read aloud / retry row.
const ico = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const CopyIcon = () => <svg {...ico}><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5V3.8A1.3 1.3 0 0 0 9.2 2.5H3.8A1.3 1.3 0 0 0 2.5 3.8v5.4a1.3 1.3 0 0 0 1.3 1.3h1.7" /></svg>;
const SpeakIcon = () => <svg {...ico}><path d="M2.5 6v4h2.5l3.5 3V3L5 6z" /><path d="M11 5.8a3 3 0 0 1 0 4.4M12.8 4.2a5.3 5.3 0 0 1 0 7.6" /></svg>;
const RetryIcon = () => <svg {...ico}><path d="M13.2 8A5.2 5.2 0 1 1 11.6 4.2" /><path d="M11.8 1.8v2.6H9.2" /></svg>;
const MicIcon = () => <svg {...ico}><rect x="5.8" y="2" width="4.4" height="7.5" rx="2.2" /><path d="M3.5 7.8a4.5 4.5 0 0 0 9 0M8 12.3V14" /></svg>;
const NAV_ICONS = {
  Search: <svg {...ico}><circle cx="7" cy="7" r="4.3" /><path d="M10.2 10.2 13.5 13.5" /></svg>,
  Projects: <svg {...ico}><rect x="2.5" y="3.5" width="11" height="9" rx="1.5" /><path d="M2.5 6.5h11" /></svg>,
  Artifacts: <svg {...ico}><path d="M8 2.3 13.2 5v6L8 13.7 2.8 11V5z" /><path d="M2.8 5 8 7.8 13.2 5M8 7.8v5.9" /></svg>,
  Customize: <svg {...ico}><path d="M2.5 5h11M2.5 11h11" /><circle cx="6" cy="5" r="1.5" fill="#F3F1EC" /><circle cx="10" cy="11" r="1.5" fill="#F3F1EC" /></svg>,
};
// Placeholder for the Own-it entry point (an open book); the designer will choose the final icon.
const OwnIcon = () => <svg {...ico}><path d="M8 4.2C6.6 3.2 4.6 2.8 2.5 3v9.3c2.1-.2 4.1.2 5.5 1.2 1.4-1 3.4-1.4 5.5-1.2V3c-2.1-.2-4.1.2-5.5 1.2z" /><path d="M8 4.2v9.3" /></svg>;
const DAY = 24 * 60 * 60 * 1000;
// "3 days ago", "today", "in 7 days", relative to the (possibly simulated) now.
const rel = (t, now) => { const d = Math.round((t - now) / DAY); return d === 0 ? 'today' : d < 0 ? `${-d} day${d === -1 ? '' : 's'} ago` : `in ${d} day${d === 1 ? '' : 's'}`; };
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hours ago`; };

// Who holds the relationship: platform owns users (supply is replaceable), or supply and users bond directly.
function OwnDiagram({ d }) {
  const direct = d.owned === 'direct';
  const box = dim => css(`flex:none;padding:7px 12px;border-radius:8px;font-size:13px;border:1px ${dim ? 'dashed #C9C3B8' : 'solid #E3DFD6'};background:${dim ? 'transparent' : '#fff'};color:${dim ? '#8A847A' : '#1F1D1A'}`);
  const line = thick => css(`flex:1;min-width:24px;border-top:${thick ? '4px solid #2F8F86' : '1px dashed #C9C3B8'}`);
  return (
    <div data-role="own-diagram" style={css(`display:flex;flex-direction:column;gap:6px`)}>
      <div style={css(`display:flex;align-items:center;gap:6px`)}>
        <span style={box(false)}>{d.supply}</span><span style={line(direct)}></span>
        <span style={box(direct)}>{d.platform}{direct ? ' (plumbing)' : ''}</span><span style={line(true)}></span>
        <span style={box(false)}>{d.users}</span>
      </div>
      <div style={css(`font-size:12px;color:#8A847A`)}>{direct ? `The thick line is the relationship: ${d.supply.toLowerCase()} and ${d.users.toLowerCase()} are bonded directly, through ${d.platform}.` : `The thick line is the owned relationship: ${d.platform} ↔ ${d.users.toLowerCase()}. ${d.supply} are replaceable (dashed).`}</div>
    </div>
  );
}

// Rubric meanings for the model grader, so its scores come with a reason too.
const RUBRIC_WHY = { 5: 'It meets every requirement of the task.', 4: 'It meets every requirement, with a cosmetic issue.', 3: 'It misses at least one requirement of the task.', 2: "It wouldn't run as written.", 1: "It isn't close to the task yet." };
const RUBRIC_SCALE = "5 every requirement · 4 cosmetic issue · 3 a requirement missed · 2 wouldn't run · 1 not close";
const correctionNote = cs => cs && cs.length ? `Read ${cs.map(c => `“${c.from}” as “${c.to}”`).join(', ')}. Typos don't count against you.` : '';

const SERIF = 'font-family:Newsreader,serif;font-size:16.5px;line-height:1.65;white-space:pre-wrap';
const NAV = 'display:flex;align-items:center;gap:10px;background:none;border:none;border-radius:8px;padding:7px 8px;font-size:14px;color:#1F1D1A;text-align:left;width:100%';
const CHIP = 'background:#FBFAF7;border:1px solid #E3DFD6;border-radius:99px;padding:7px 14px;font-size:13.5px;color:#514C44';
// A generic spark for the greeting (not Anthropic's logo).
const Spark = () => <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <rect key={i} x="14" y="2" width="2.2" height="11" rx="1.1" fill="#D97757" transform={`rotate(${i * 30} 15 15)`} />)}</svg>;
const ACT = 'background:none;border:none;border-radius:7px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:inherit;padding:0';
const STEP_LABELS = { read: 'Read it', see: 'See it', assemble: 'Assemble it', compare: 'Compare it', write: 'Write it' };

function CompareTable({ t }) {
  return (
    <div style={css(`border:1px solid #E3DFD6;border-radius:8px;overflow:hidden;background:#fff`)}>
      <div style={css(`display:grid;grid-template-columns:${t.cols};font-size:11px;font-weight:600;color:#8A847A;padding:5px 10px;border-bottom:1px solid #EEEAE2;gap:8px`)}>
        {t.headers.map((h, i) => <span key={i}>{h.t}</span>)}
      </div>
      {t.rows.map((r, i) => (
        <div key={i} style={css(`display:grid;grid-template-columns:${t.cols};font-family:'JetBrains Mono',monospace;font-size:12px;padding:4px 10px;gap:8px;background:${r.bg || 'transparent'}`)}>
          {r.cells.map((c, j) => <span key={j} style={css(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${c.dim ? '#B58A74' : '#1F1D1A'};${c.hl ? `background:${c.hl};border-radius:4px;margin:-1px -4px;padding:1px 4px;font-weight:600` : ''}`)}>{c.t}</span>)}
        </div>
      ))}
    </div>
  );
}

export default class App extends React.Component {
  state = { messages: [], composer: '', own: null, ledger: [], exits: [], sel: null, chatTitle: 'New chat', delayed: null, tipDismissed: false, view: 'chat', timeShift: 0, recall: null, gaps: [], activeGap: null, asked: [] };
  // Simulated "now": the demo can skip ahead in time to bring things due.
  now() { return Date.now() + this.state.timeShift; }
  scrollRef = React.createRef();
  panelRef = React.createRef();
  uid = 0;
  nid() { return ++this.uid; }

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
  // kind picks the server-side model settings: 'tutor' (fast), 'json' (structured), 'grade' (most thinking).
  async ask(prompt, system, json, kind) {
    const text = await complete({ kind: kind || (json ? 'json' : 'tutor'), system: system || '', messages: [{ role: 'user', content: prompt }] });
    if (!json) return String(text).trim();
    const m = String(text).match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(m[0]);
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
    return [{ id: 'seed-rule', title: label, predicted: 4, actual: 3, fixed: null, delayed: null, hints: 0, realWork: [], reviews: [], seeded: true,
      ownedAt: t - 3 * DAY, dueAt: t - 60 * 60 * 1000,
      own: { scenario: this.BOOK, focus: { label, mode: 'concept', target: 'rule' }, lang: 'statistics', code: '', write: { schema: '' } } }];
  }
  componentDidMount() {
    if (!this.state.ledger.length) this.setState({ ledger: this.seedLedger() });
    this._onDown = e => { if (this.state.sel && !(e.target.closest && e.target.closest('#own-sel'))) this.setState({ sel: null }); };
    this._onSelChange = () => { const s = window.getSelection(); if (this.state.sel && (!s || !s.toString().trim())) this.setState({ sel: null }); };
    document.addEventListener('mousedown', this._onDown);
    document.addEventListener('selectionchange', this._onSelChange);
  }
  componentWillUnmount() { document.removeEventListener('mousedown', this._onDown); document.removeEventListener('selectionchange', this._onSelChange); }
  componentDidUpdate(_, prev) {
    if (prev.messages !== this.state.messages || (this.state.own && prev.own !== this.state.own && prev.own && prev.own.phase !== this.state.own.phase)) {
      const el = this.scrollRef.current; if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
    this.markOwnedText();
    // The panel starts each phase and step at the top.
    const a = prev.own, b = this.state.own;
    if (b && (!a || a.phase !== b.phase || a.step !== b.step)) { const pn = this.panelRef.current; if (pn) pn.scrollTop = 0; }
  }
  newChat = () => this.setState({ messages: [], own: null, sel: null, chatTitle: 'New chat', delayed: null, composer: '', view: 'chat', activeGap: null });
  openLearnings = () => this.setState({ view: 'learnings', sel: null });
  startSql = () => this.replay(this.SQL, SQL_TURNS);
  startReact = () => this.replay(this.REACT, REACT_TURNS);
  // Replays a real chat as-is. Every answer can be highlighted or owned whole (the icon under it).
  // turns: [{ user, claude }] pairs, or single { user } / { claude } / { gap } entries.
  replay(sc, turns) {
    const learn = true;
    const flat = turns.flatMap(t => [t.user != null && { user: t.user }, t.gap && { gap: t.gap }, t.claude != null && { claude: t.claude }].filter(Boolean));
    const msgs = flat.map(t => t.user != null ? { id: this.nid(), type: 'user', text: t.user }
      : t.gap ? { id: this.nid(), type: 'gap', text: t.gap }
      : { id: this.nid(), type: 'assistant', learn, intro: '', code: t.claude, lang: sc.lang, outro: '', scenario: sc, plain: true, at: Date.now() });
    this.setState({ messages: msgs, composer: '', chatTitle: sc.title, own: null, delayed: null, sel: null, view: 'chat', activeGap: null });
  }
  startBook = () => this.replay(this.BOOK, BOOK_TURNS);
  startJuno = () => this.replay(this.JUNO, JUNO_TURNS);
  startSales = () => this.sendText(this.SALES.question, this.SALES);
  send = () => { const t = this.state.composer.trim(); if (!t) return; this.sendText(t, null, !!this.state.own); };
  composerRef = React.createRef();
  // Own-it finds the gap; the chat explains it. These prefill a follow-up with your attempt and what the check said.
  askAboutIt = () => {
    const o = this.state.own, w = o.write, g = w.grade;
    const attempt = w.check && w.check.type === 'choice' ? w.check.questions.map(q => `${q.prompt} → ${(q.options.find(x => x.v === w.picked[q.id]) || {}).l || '(no answer)'}`).join('\n') : w.text;
    const text = g
      ? `I'm practising "${o.focus ? o.focus.label : 'this'}". The task was: ${w.task}\n\nMy attempt:\n${attempt}\n\nThe check says: ${g.gap || g.why}\n\nCan you help me understand what I got wrong? Don't just give me the full answer.`
      : `I'm practising "${o.focus ? o.focus.label : 'this'}". The task is: ${w.task}\n\nWhat I have so far:\n${attempt || '(nothing yet)'}\n\nI'm stuck. Can you give me a nudge without writing it for me?`;
    this.setState({ composer: text }, () => { const el = this.composerRef.current; if (el) { el.focus(); el.style.height = 'auto'; } });
  };
  // No upfront "just the answer / learn this too" toggle: intent is declared by what you choose to own,
  // and confidence by what you predict. Every answer can be owned.
  sendText(text, scenario, followUp = false) {
    const learn = true;
    const m = { id: this.nid(), scenario, question: text, followUp };
    const msgs = this.state.messages.concat([{ id: this.nid(), type: 'user', text }, { id: this.nid(), type: 'thinking' }]);
    this.setState({ messages: msgs, composer: '', chatTitle: this.state.messages.length ? this.state.chatTitle : (scenario ? scenario.title : text.slice(0, 40)) }, () => this.answer(m, learn));
  }
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
    let reply;
    const gap = this.state.activeGap ? this.state.gaps.find(g => g.id === this.state.activeGap) : null;
    const system = gap ? gapSystem(gap) : m.followUp
      ? 'You are Claude, in an ongoing chat with someone who is practising what you showed them. Explain clearly and briefly, in markdown. Help them see why; do not rewrite their whole solution unless they ask.'
      : 'You are Claude. Answer helpfully and concisely for a working professional, in markdown, with code in fenced blocks where useful.';
    try {
      const t = String(await complete({ kind: 'tutor', system, messages: this.chatHistory() })).trim();
      reply = { intro: '', code: t, lang: (t.match(/```(\w+)/) || [])[1] || 'text', outro: '', scenario: m.scenario || null, plain: true };
    } catch (e) {
      // Offline, the cold-start gap still gets a real explanation (hand-written), so the loop can be demoed.
      const first = !this.state.messages.some(x => x.type === 'assistant');
      reply = gap && isColdStart(gap) && first ? { intro: '', code: COLD_START.offlineAnswer, lang: 'text', outro: '', scenario: null, plain: true }
        : { intro: "I couldn't reach the model just now. Try one of the starters, which work offline.", code: '', lang: '', outro: '', scenario: null };
    }
    const id = this.nid(), followUp = this.canOfferOwn();
    this.setState({ messages: this.state.messages.filter(x => x.type !== 'thinking').concat([{ id, type: 'assistant', learn, at: Date.now(), askedId: null, ...reply }]) });
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
      const r = await this.ask(`Someone is chatting with Claude. Their latest message:\n"${text}"\nClaude's reply to it (excerpt):\n${String(answer).slice(0, 800)}\n\nIs this person working to get better at something, not just curious about it? Signs: they ask why or how something works, test their understanding ("so it's..., right?", "what if I..."), say they're confused, or try to apply the idea to a new case. A side question out of curiosity ("what about X?") or a request to do something doesn't count. Return ONLY JSON {"learning": boolean, "topic": what they want to get better at, as a short learning goal under 9 words, or ""}`, 'You judge intent carefully and conservatively. Strict JSON only.', true);
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
    else this.ask(`Someone asked Claude to explain this.${quote ? `\nPart of the answer they quoted:\n${quote}` : ''}\nTheir question: ${question || '(explain it)'}\nName what they want to understand as a short learning goal, under 9 words, phrased as a topic (e.g. "When an effect's cleanup runs"). Return ONLY JSON {"label": string}`, 'Strict JSON only.', true)
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
    this.setState({ messages: [{ id: this.nid(), type: 'user', text: g.question }, { id: this.nid(), type: 'goFirst', key, phase: 'offer', prediction: 0, text: '', picked: {}, grade: null, at: Date.now() }], chatTitle: g.chip.split(' · ')[1], own: null, delayed: null, sel: null, composer: '', view: 'chat', activeGap: null });
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
    this.noteRealWork(m.key, { predicted: m.prediction, actual: r.score });
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
    else if (o.phase === 'ladder' && o.step === 'read') c += 'Current step: reading annotated lines.';
    else if (o.phase === 'ladder' && o.step === 'compare' && o.cmp && o.cmp.cases[o.cmp.idx]) { const k = o.cmp.cases[o.cmp.idx]; c += `Current step: comparing alternatives. Showing "${k.label}":\n${k.code}\n` + (o.cmp.revealed[o.cmp.idx] ? `Result shown: ${k.rows ? k.rows.length + ' rows' : k.answerText || k.outcome}. ${k.note}` : 'Result not revealed yet; do not give it away.'); }
    else c += 'Current phase: ' + o.phase;
    return c;
  }
  askStep = async (text) => {
    const o = this.state.own; const q = (text || '').trim(); if (!o || !q) return;
    const qa = o.qa.concat([{ q, a: '', loading: true }]);
    this.setOwn({ qa, qaInput: '' });
    let a;
    try { a = await this.ask(`${this.stepContext()}\n\nLearner's question: ${q}\n\nAnswer in under 90 words, plain language, referring to the sample rows or lines shown when useful.`, 'You are a patient tutor sitting next to the learner. Direct, specific, no preamble.'); }
    catch (e) { a = "I can't reach the model right now. Try again in a moment, or move on and come back."; }
    this.setOwn(cur => ({ qa: cur.qa.map((x, i) => i === qa.length - 1 ? { q, a, loading: false } : x) }));
  };
  // focus: pass one when the entry point already says what to own ("Own the whole query"); the focus question is then skipped.
  beginOwn(m, code, focus = null, entry = 'own') {
    const sc = m.scenario;
    const i = this.state.messages.findIndex(x => x.id === m.id);
    const asked = this.state.messages.slice(0, i).reverse().find(x => x.type === 'user');
    const own = { id: this.nid(), msgId: m.id, question: asked ? asked.text : '', concept: null, scenario: sc, lang: m.lang, code, why: '', prediction: 0, phase: focus ? 'predict' : 'focus', focus, focusOptions: null, focusOther: '', cmp: null, step: 'read', startStep: 'read', visited: {}, annotations: null, annotLoading: false, see: null, seeIdx: 0, seeLoading: false, bridges: null, asm: null, write: { task: '', ref: '', schema: '', before: '', after: '', placeholder: '', check: null, authoredHints: null, text: '', hints: [], hintLoading: false, grade: null, loading: false, gradeLoading: false, picked: {}, attempts: 0, firstGrade: null }, teach: { msgs: [], input: '', turns: 0, loading: false }, fullCode: m.code, qa: [], qaInput: '', taught: !!m.plain && !(sc && sc.taughtInChat === false), askedFocus: !focus, entry };
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
      ...(this.isMultiLine(o.code) ? [{ label: "The whole thing: each part and why it's in that order", mode: 'sequence' }] : []),
      ...(o.scenario === this.SQL ? [{ label: SQL_TARGETS.whole.label, mode: 'sequence', target: 'whole' }] : []),
    ];
    try {
      const r = await this.ask(`A learner highlighted part of a ${o.lang} answer and wants to learn it, not just use it.\nFull answer:\n${o.fullCode}\n\nHighlighted:\n${o.code}\n\nPropose 3 specific things they might want to own about the highlighted part, most likely first. Return ONLY JSON {"options":[{"label": a learning target under 9 words, phrased as a topic (e.g. "When to use LEFT vs INNER JOIN"), "mode": "sequence" if it is about the order/structure of several lines, else "concept"}]}.`, 'You return strict JSON only.', true);
      const opts = (r.options || []).filter(x => x && x.label).slice(0, 3).map(x => ({ label: x.label, mode: x.mode === 'sequence' ? 'sequence' : 'concept' }));
      this.setOwn({ focusOptions: reactTiming ? [TIMING].concat(opts.slice(0, 2)) : opts.length ? opts : fallback });
    } catch (e) { this.setOwn({ focusOptions: reactTiming ? [TIMING].concat(fallback.slice(0, 1)) : fallback }); }
  }
  // What "Own the whole …" means: the authored whole-query target on the SQL starter, a structure focus otherwise.
  wholeFocus(m) {
    if (m.scenario === this.SQL) return { label: SQL_TARGETS.whole.label, mode: SQL_TARGETS.whole.kind, target: 'whole' };
    if (m.scenario === this.BOOK) return { label: BOOK_TARGETS.rule.label, mode: BOOK_TARGETS.rule.kind, target: 'rule' };
    if (m.scenario === this.REACT) return { label: 'When the effect, cleanup and responses run', mode: 'sequence' };
    if (m.scenario === this.JUNO) return { label: JUNO_TARGETS.ownside.label, mode: JUNO_TARGETS.ownside.kind, target: 'ownside' };
    return { label: "The whole thing: each part and why it's in that order", mode: this.isMultiLine(m.code) ? 'sequence' : 'concept' };
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
  visualStep(o = this.state.own) { const v = this.frame(o).visual; return v === 'compare' ? 'compare' : v ? 'see' : null; }
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
    if (!o.prediction) return this.cancelOwn();
    if (o.write && (o.write.grade || o.write.firstGrade)) return this.finishOwn();
    const L = this.ladder(o), at = STEP_LABELS[o.step] || 'the start';
    const summary = `${o.focus ? o.focus.label : o.lang} · predicted ${o.prediction}/5, stopped at ${at}`;
    const exit = { id: o.id, title: o.focus ? o.focus.label : o.lang, predicted: o.prediction, step: at, stepOf: `${L.indexOf(o.step) + 1} of ${L.length}`, startStep: STEP_LABELS[o.startStep], scenario: o.scenario };
    this.setState({ own: null, exits: this.state.exits.concat([exit]), messages: this.state.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', doneLabel: 'Outsourced', summary } : m) });
  };
  submitWhy = () => { if (this.state.own.why.trim()) this.setOwn({ phase: 'predict' }); };
  pickPrediction(n) {
    // 1–2 start at the first step, 3 at the second, 4 one before writing, 5 straight to writing.
    // After a chat that already taught it, everyone starts at the test; Read and Compare stay one click away.
    // Arrange first only when the written order is the insight and you predicted you couldn't do it yet.
    const start = this.frame().orderMatters && n <= 2 ? 'assemble' : 'write';
    this.setOwn({ prediction: n, phase: 'ladder', step: start, startStep: start, refresherOpen: n <= 2 }, () => this.enterStep(start));
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
      const r = await this.ask(`A learner wants to own this: "${o.focus.label}".\nTheir original question: ${o.question || '(not available)'}\nFull answer they got (${o.lang}):\n${o.fullCode}\nThe part they highlighted:\n${o.code}\n\nWrite the core explanation they should read first. Do NOT give concrete outputs or results of running anything; a later step asks them to predict those. Return ONLY JSON {"model": the mental model in one sentence, "grid": {"headers": [first header empty string, then 2-3 dimensions], "rows": [[alternative name, cell, ...]]} comparing their construct with its 1-2 closest alternatives on the dimension that actually differs, or null if there are no real alternatives, "inYourCode": 1-2 sentences on why this construct fits THEIR question and code specifically, "rule": a practical rule of thumb for choosing it}. Plain words, no jargon without explanation.`, 'You return strict JSON only. Be technically exact.', true);
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
      const r = await this.ask(`A learner wants to own this: "${o.focus ? o.focus.label : 'the highlighted code'}".\nHighlighted ${o.lang}:\n${o.code}\nFull context:\n${o.fullCode}\n\nBuild a contrasting-cases comparison: the highlighted construct next to its 2 closest alternatives a learner might confuse it with. Return ONLY JSON {"intro": one sentence, "cases":[{"label": short name, "code": a minimal snippet (max 6 lines), "outcome": what concretely happens or is returned, max 30 words, "note": why it differs from the others, max 35 words}]} with 3 cases, the learner's own construct included.`, 'You return strict JSON only. Be technically exact.', true);
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

  // Read it
  async loadAnnotations() {
    const o = this.state.own; if (o.annotations) return;
    this.setOwn({ annotLoading: true });
    let ann = null;
    try {
      const r = await this.ask(`Annotate this ${o.lang} code for someone learning it while doing real work. Return ONLY a JSON array of {"line": string, "note": string}, one per non-empty line, note under 22 words: what it does and why it is there.\n\n${o.code}`, 'You return strict JSON only.', true);
      ann = r.map(x => ({ line: x.line, note: x.note }));
    } catch (e) {
      const sc = o.scenario;
      if (sc && sc.annotations && o.code === o.fullCode) ann = sc.annotations.map(a => ({ line: a[0], note: a[1] }));
      else ann = o.code.split('\n').filter(l => l.trim()).map(l => ({ line: l, note: sc && sc.annotations ? (sc.annotations.find(a => a[0].trim() === l.trim()) || ['', 'Part of the code you selected.'])[1] : 'Annotation unavailable offline.' }));
    }
    this.setOwn({ annotations: ann, annotLoading: false });
  }

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
      try { const b = await this.ask(`A front-end developer who knows JavaScript arrays is learning this SQL:\n${o.code}\nGive 3 one-line bridges mapping SQL clauses to JS array methods they know. Return ONLY a JSON array of strings.`, 'You return strict JSON only.', true); this.setOwn({ bridges: b }); }
      catch (e) { this.setOwn({ bridges: this.SQL.bridges }); }
      return;
    }
    if (o.scenario && o.scenario.seeSteps && o.code === o.fullCode) { this.setOwn({ see: o.scenario.seeSteps.map(s => ({ ...s, headers: null })), bridges: o.scenario.bridges, seeIdx: 0, seeLoading: false }); return; }
    this.setOwn({ seeLoading: true });
    try {
      const r = await this.ask(`Walk through how this ${o.lang} ${o.lang === 'email' ? 'email lands with its reader, line by line as they read it' : 'code executes, step by step, in the order things actually happen at runtime (not the order written)'}. Return ONLY JSON: {"steps":[{"clause": short code fragment being executed, "title": string, "note": under 30 words describing the state after this step}], "bridges":[3 one-line analogies to things a front-end JavaScript developer already knows]}. 5 to 8 steps.\n\n${o.code}`, 'You return strict JSON only.', true);
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
      fb = await this.ask(`A learner is ordering shuffled lines of ${o.lang === 'email' ? 'an email' : o.lang + ' code'} (a Parsons problem). Correct version:\n${correctCode}\n\nTheir version:\n${yours || '(empty)'}\n${usedDx ? '\nThey included this piece that does not belong: ' + byId.dx.text : ''}${missing ? '\nThey left ' + missing + ' piece(s) unplaced.' : ''}${wrongLines.length ? '\nLines currently in the wrong position: ' + wrongLines.map(l => '`' + l + '`').join(', ') : ''}\n\nIn at most 2 sentences, name the ONE most important line to reconsider by quoting it in backticks, and connect it to what happens at runtime (execution order). Do not give the answer. No praise, no shame.`, 'You are a calm tutor. Plain language.');
    } catch (e) {
      const q = wrong.filter(id => id !== 'dx').map(id => '`' + byId[id].text.trim() + '`');
      fb = usedDx && o.scenario === this.SALES ? 'One line in your version is about you needing an answer rather than about her problem. Which one, and what does she feel when she reads it?' : usedDx && o.scenario === this.SQL ? "Look back at the run: WHERE runs after the join, and Cy and Fay's rows have status NULL there. What does NULL = 'paid' evaluate to, and what happens to those rows?" : usedDx ? 'One piece in your version contradicts what the code needs to do when the id changes. Which one, and why?' : missing ? 'Some pieces are still in the bank. Which step of the run did they correspond to?' : q.length ? `Look at ${q.slice(0, 2).join(' and ')}. Replay the run in your head: what has to exist before each of these can do its job?` : 'Something is out of order. Replay the run in your head, step by step.';
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
    if (sc && (!o.focus || o.focus.mode === 'sequence')) { this.setOwn(cur => ({ write: { ...cur.write, task: sc.writeTask, ref: sc.writeRef, schema: sc.schema } })); return; }
    this.setOwn(cur => ({ write: { ...cur.write, loading: true } }));
    try {
      const r = await this.ask(`A learner highlighted part of an answer and wants to own: "${o.focus ? o.focus.label : 'the highlighted part'}".\nHighlighted:\n${o.code}\nFull answer (for context):\n${String(o.fullCode).slice(0, 3500)}\n\nDesign ONE short practice that checks they own exactly that, on a NEW small case (not the same example). Choose the format that fits:\n- "code": they write or fix a few lines. Only if producing code IS the skill being owned.\n- "choice": 2-3 multiple-choice questions about the reasoning, 2-3 options each; wrong options must be common misconceptions, each with a one-sentence "gap" explaining why it's wrong.\n- "explain": one question asking them to explain the idea and apply it to the new case, with 2-3 short key points a good answer contains.\nAlso say whether the WRITTEN ORDER of the highlighted lines is itself what's being learned ("orderIsInsight": true only then; runtime order or timing is not written order). Return ONLY JSON {"orderIsInsight": boolean, "format": "code"|"choice"|"explain", "task": one sentence starting "Now a new situation:", "context": what they have to work with, or "", "reference": a reference solution (code only), "questions": [{"prompt": string, "options": [{"label": string, "correct": boolean, "gap": string|null}]}] (choice only), "keyPoints": [string] (explain only)}`, 'You design short, fair practice. Strict JSON only.', true);
      const fmt = ['code', 'choice', 'explain'].includes(r.format) ? r.format : 'explain';
      let patch = { task: r.task, schema: String(r.context || '').replace(/```\w*\n?/g, '').trim(), format: fmt, loading: false, orderMatters: !!r.orderIsInsight };
      if (fmt === 'code') patch = { ...patch, ref: r.reference || '' };
      if (fmt === 'choice') {
        const questions = (r.questions || []).slice(0, 3).map((q, i) => {
          const options = (q.options || []).slice(0, 3).map((x, j) => ({ v: 'o' + j, l: x.label, gap: x.correct ? undefined : x.gap || undefined, correct: !!x.correct }));
          return { id: 'q' + i, short: q.prompt.slice(0, 40), prompt: q.prompt, answer: (options.find(x => x.correct) || options[0] || {}).v, options };
        }).filter(q => q.options.length >= 2);
        patch = questions.length ? { ...patch, check: { type: 'choice', questions } } : { ...patch, format: 'explain', check: { type: 'explain', question: r.task, keyPoints: [] } };
      }
      if (fmt === 'explain') patch = { ...patch, placeholder: 'Explain it in your own words, and apply it to the new case.', check: { type: 'explain', question: r.task, keyPoints: (r.keyPoints || []).slice(0, 3) } };
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
    try { h = await this.ask(`Task: ${o.write.task}\nReference solution (never reveal it):\n${o.write.ref}\nLearner draft so far:\n${o.write.text || '(nothing yet)'}\nPrevious hints: ${o.write.hints.join(' | ') || 'none'}\nGive ONE new hint as a question or nudge, under 25 words. Never write the code for them.`, 'Hints, not answers.'); }
    catch (e) { h = o.scenario === this.SALES ? ['What did Marcus say, in his own numbers? That is your subject and first line.', 'What have you already made for him that you can offer before asking anything?', 'How small can the ask be? Can he answer from his phone in one word?'][o.write.hints.length] || 'Reread the sign-off: is there anything after your name that reads like a template?' : o.scenario === this.SQL ? ['Which table do you start FROM if every author has to appear?', "Where does status = 'published' have to go so authors with no published books survive?", 'An author with no match gets a NULL sum. What turned NULL into 0 in the original?'][o.write.hints.length] || 'Most pages first: which direction is the sort?' : ['What goes in the dependency array so it refetches when slug changes?', 'What did the original return from the effect, and why?', 'Which state do you need, and what does the component show while it is empty?'][o.write.hints.length] || 'Walk through a slug change: what stops the old response from landing?'; }
    this.setOwn(cur => ({ write: { ...cur.write, hints: cur.write.hints.concat([h]), hintLoading: false } }));
  };
  fallbackGrade(o, attempt, ref) {
    const a = attempt.toLowerCase(); let checks;
    if (o.lang === 'email') checks = [[/subject:/, 'has a subject line'], [/you (said|mentioned|told|walked)|in the demo/, "opens with the prospect's own words"], [/draft|mock|put together|checklist|plan|one-page|built/, 'offers something concrete already done'], [/\?/, 'ends with a question'], [/no call|no meeting|reply|send it/, 'keeps the ask small (no meeting)']];
    else if (o.lang === 'sql') checks = [[/left\s+(outer\s+)?join/, 'keeps the left table with no matches (LEFT JOIN)'], [/on[\s\S]*(published|paid)/, 'filters the status inside the ON clause'], [/sum\s*\(|count\s*\(|is\s+null/, 'uses the right aggregate or NULL test'], [/group\s+by|is\s+null/, 'groups per row of the left table'], [/order\s+by[\s\S]*desc|is\s+null/, 'sorts descending (without DESC you get the smallest first)']];
    else checks = [[/usestate/, 'holds the result in state'], [/useeffect/, 'runs the fetch in an effect'], [/\[\s*slug\s*\]|\[\s*id\s*\]|\[\s*\]/, 'has a dependency array'], [/cancelled|ignore|stale|abort/, 'guards against stale responses'], [/return\s*\(\)\s*=>/, 'returns a cleanup']];
    const hit = checks.filter(c => c[0].test(a)); const miss = checks.filter(c => !c[0].test(a));
    const score = attempt.trim().length < 10 ? 1 : Math.max(1, Math.min(5, hit.length));
    return { score, worked: hit.length ? 'Your version ' + hit.map(c => c[1]).join(', ') + '.' : 'A start, but not much of the structure is there yet.', gap: miss.length ? 'Missing: ' + miss.map(c => c[1]).join(', ') + '.' : 'Nothing structural. This holds.' };
  }
  // Shared grader: Sonnet, requirement checklist with quoted evidence, then deterministic clamps.
  async gradeAttempt(task, ref, attempt, lang, extraFields) {
    const r = await this.ask(`You are grading a learner's unassisted attempt.\nTask: ${task}\nReference solution (one valid answer; alternates are fine):\n${ref}\nLearner attempt:\n${attempt}\n\nDifferent but reasonable table, column, alias, or variable names are fine and never count against them; judge the structure and logic. Only grade requirements the task itself states; never penalise for omitting something the task did not ask for.\n\nStep 1: list every concrete requirement implied by the task (e.g. filter, aggregate, grouping, sort direction, limit, state handling). Step 2: for each, quote the EXACT substring of the attempt that satisfies it, or null if none. A requirement with no quoted evidence is NOT met. Never infer something the attempt does not contain. Step 3: score. 5 = all requirements met and would run; 4 = all met, cosmetic issue; 3 = would run but result differs from the task (any unmet requirement caps at 3); 2 = would not run; 1 = not close.\n\nReturn ONLY JSON {"checks":[{"requirement": string, "quoted_evidence": string|null, "met": boolean}], "score": integer, ${extraFields}}. All prose addressed to the learner as "you".`, 'Exacting, fair grader. Quote evidence, never assume. Strict JSON only.', true, 'grade');
    r.checks = Array.isArray(r.checks) ? r.checks : [];
    r.checks.forEach(c => { if (!c.quoted_evidence || !String(attempt).includes(String(c.quoted_evidence).trim().slice(0, 12))) c.met = false; });
    const unmet = r.checks.filter(c => !c.met);
    r.score = Math.max(1, Math.min(5, Math.round(Number(r.score) || 1)));
    if (unmet.length) r.score = Math.min(r.score, 3);
    // deterministic SQL guard for "top N" tasks
    if (lang === 'sql' && /including .* with none|still (show up|appear)|no paid orders|haven't bought|with 0\b/i.test(task) && !/left\s+(outer\s+)?join/i.test(attempt)) { r.score = Math.min(r.score, 3); const n = 'Without a LEFT JOIN, rows with no match on the right side drop out, so the ones the task says to include are missing.'; unmet.push({ requirement: 'LEFT JOIN', met: false }); r.gap = n; r.note = r.note ? n + ' ' + r.note : n; }
    if (lang === 'sql' && /\btop\b|most .* first|highest first/i.test(task) && !/\bdesc\b/i.test(attempt)) { r.score = Math.min(r.score, 3); const n = 'The task asks for the biggest first but there is no DESC, so this sorts ascending and puts them last.'; unmet.push({ requirement: 'sort descending', met: false }); r.gap = n; r.note = r.note ? n + ' ' + r.note : n; }
    if (unmet.length && (!r.gap || /nothing structural/i.test(r.gap))) r.gap = 'Not met: ' + unmet.map(c => c.requirement).join('; ') + '.';
    return r;
  }
  submitWrite = async () => {
    const o = this.state.own, isChoice = o.write.check && o.write.check.type === 'choice';
    if ((isChoice ? !Object.keys(o.write.picked).length : !o.write.text.trim()) || o.write.gradeLoading) return;
    this.setOwn({ write: { ...o.write, gradeLoading: true } });
    let g;
    try {
      if (!o.write.check) throw new Error('no executable check');
      if (o.write.check.type === 'explain') {
        const res = await this.judgeGap({ topic: o.focus ? o.focus.label : '' }, o.write.check, o.write.text);
        const ok = res.points.filter(p => p.ok);
        g = { score: !res.points.length ? 2 : res.closed ? 5 : ok.length ? 3 : 2, why: res.closed ? 'Your answer has every key idea.' : ok.length ? 'Some of the key ideas are there, not all.' : res.points.length ? "The key ideas aren't there yet." : "This couldn't be checked just now.",
          worked: ok.length ? 'You covered: ' + ok.map(p => p.point.toLowerCase()).join('; ') + '.' : '', gap: res.feedback, corrections: [] };
      } else
      g = await runCheck(o.write.check, o.write.text, o.write.before, o.write.after, o.write.picked);
    } catch (_) { try {
      g = await this.gradeAttempt(o.write.task, o.write.ref, o.write.text, o.lang, `"worked": one sentence on what you got right, "gap": one sentence naming the specific unmet requirement (or "Nothing structural." only if every check is met), "revealLine": one sentence comparing your ${o.prediction}/5 prediction to the score, curious in tone, never judgmental, no claims about attempts or effort`);
    } catch (e) { g = this.fallbackGrade(o, o.write.text, o.write.ref); } }
    if (!g.revealLine || (g.checks && g.checks.some(c => !c.met))) {
      const d = g.score - o.prediction;
      g.revealLine = d === 0 ? `You predicted ${o.prediction}/5 and wrote at ${g.score}/5. Your sense of what you know is accurate here.` : d > 0 ? `You predicted ${o.prediction}/5 but wrote at ${g.score}/5. You own more of this than you thought.` : `You predicted ${o.prediction}/5 and wrote at ${g.score}/5. Reading it felt clearer than writing it turned out to be, which is normal, and now you know exactly where.`;
    }
    // The first try is what you could do on your own, so it stays the "actual" that the prediction is measured against.
    // A fix is recorded next to it, never instead of it.
    const first = !o.write.firstGrade, attempts = o.write.attempts + 1;
    const entry = { id: o.id, title: o.focus ? o.focus.label : o.scenario ? o.scenario.title : (o.lang + ' · ' + o.code.split('\n')[0].slice(0, 30)), predicted: o.prediction, actual: first ? g.score : o.write.firstGrade.score, fixed: first ? null : g.score, delayed: null, hints: o.write.hints.length, own: o,
      ownedAt: (this.state.ledger.find(e => e.id === o.id) || {}).ownedAt || this.now(), dueAt: (this.state.ledger.find(e => e.id === o.id) || {}).dueAt || this.now() + 3 * DAY, reviews: (this.state.ledger.find(e => e.id === o.id) || {}).reviews || [] };
    const notes = ruleNotes(o.lang, o.write.text, o.write.task);
    this.setState(s => ({ own: { ...s.own, write: { ...s.own.write, grade: g, gradeLoading: false, attempts, firstGrade: s.own.write.firstGrade || g, notes, notesLoading: true }, phase: 'reveal' }, ledger: s.ledger.filter(e => e.id !== entry.id).concat([entry]) }), () => this.loadNotes(g, notes));
  };

  // "On your version": Claude adds up to 2 notes on HOW you wrote it, beyond the score (which is already decided).
  async loadNotes(g, have) {
    const o = this.state.own, w = o.write, text = w.text;
    const done = extra => this.setOwn(cur => ({ write: { ...cur.write, notes: (cur.write.notes || []).concat(extra).slice(0, 3), notesLoading: false } }));
    if ((w.check && w.check.type === 'choice') || text.trim().length < 40) return done([]);
    try {
      const r = await this.ask(`A learner's attempt has already been scored ${g.score}/5${g.gap ? ` (what to fix: ${g.gap})` : ''}. Do NOT re-score it or repeat that.\nTask: ${w.task}\nTheir attempt (${o.lang}):\n${text}\nAlready noted: ${have.map(n => n.text).join(' | ') || 'nothing'}\n\nWrite 0 to 2 short notes on HOW they wrote it, beyond what the task required: good practice worth keeping (kind "nice"), or a habit worth improving (kind "improve"), e.g. robustness, readability, or a misconception visible in what they wrote. Skip anything already noted. Each note must quote an exact short fragment (under 40 characters) of their attempt. Return ONLY JSON {"notes":[{"kind":"nice"|"improve","quote":string,"text":string under 30 words, addressed to "you"}]}. Return an empty list if nothing is genuinely useful.`, 'You are a kind, precise senior reviewer. Strict JSON only.', true);
      done(keepQuoted(r.notes, text).filter(n => !have.some(h => h.quote.toLowerCase() === n.quote.toLowerCase())).slice(0, 2));
    } catch (e) { done([]); }
  }

  // Back to your own attempt, as you left it, to fix what the check found.
  fixWrite = () => this.setOwn(cur => ({ phase: 'ladder', step: 'write', write: { ...cur.write, lastGap: cur.write.grade && cur.write.grade.gap, grade: null } }));

  // Teach one
  goTeach = () => { const o = this.state.own; this.setOwn({ phase: 'teach', teach: { ...o.teach, msgs: o.teach.msgs.length ? o.teach.msgs : [{ role: 'sam', text: (o.scenario && o.scenario.samOpen) || "Hey! So I've never done this before. Can you tell me what this code is for, like, what problem it solves?" }] } }); };
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
      reply = await complete({ kind: 'tutor', system: `You are Sam, a friendly beginner who has never used ${o.lang}. The learner is explaining this ${o.scenario && o.scenario.prose ? 'idea' : 'code'} to you:\n${o.code}\nA grader noted this gap in the learner's understanding: "${gap}". Gently steer one question toward that gap. Ask ONE short follow-up (under 35 words), in a casual beginner voice, never explain things yourself, never use the words "great" or "exactly". If the learner says they're unsure or guesses, do NOT answer it for them or fill it in: say it sounds like an open question. ${turns >= 3 ? 'This is the last turn: say in one sentence what you now understand, in your own naive words; if anything they explained was a guess, say plainly that part is still a mystery to you both. Then thank them.' : ''}`, messages: hist });
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
      const r = await this.ask(`A learner explained "${o.focus ? o.focus.label : 'an idea'}" to a beginner named Sam. Conversation:\n${msgs.map(m => (m.role === 'sam' ? 'Sam: ' : 'Learner: ') + m.text).join('\n')}\n\nReturn ONLY JSON {"clear":[{"quote": exact words from a Learner line, "text": what that shows they understand, under 20 words}], "unsure":[{"quote": exact words from a Learner line where they hedged, guessed or got it wrong, "question": the Sam question that exposed it, "topic": the open topic as a short learning goal, under 10 words, e.g. "How an aggregator gets started"}]}. Up to 2 clear, up to 2 unsure. Only list unsure if the learner really hedged, guessed or was wrong. Address nothing to the learner; just the JSON.`, 'Strict JSON only. Quote exactly.', true);
      d = { clear: (r.clear || []).filter(c => quoted(c.quote, mine)).slice(0, 2), unsure: (r.unsure || []).filter(u => quoted(u.quote, mine) && u.topic).slice(0, 2) };
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
    this.setState(s => ({ gaps: s.gaps.some(x => x.id === g.id) ? s.gaps : s.gaps.concat([g]), view: 'chat', own: null, delayed: null, sel: null, composer: '', activeGap: g.id, chatTitle: g.topic,
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
      try { const r = await this.ask(checkPrompt(g), 'Strict JSON only.', true); check = { question: r.question, keyPoints: (r.keyPoints || []).slice(0, 3) }; }
      catch (e) { check = { question: `In your own words, with an example: ${g.topic}?`, keyPoints: [] }; }
    }
    this.setGo(id, { phase: 'ask', check });
  }
  async judgeGap(g, check, answer) {
    const quoted = q => q && answer.toLowerCase().includes(String(q).toLowerCase().trim().slice(0, 12));
    try {
      if (!check.keyPoints.length) throw new Error('no key points');
      const r = await this.ask(judgePrompt(g, check, answer), 'Fair, exacting, warm. Quote evidence; never assume. Strict JSON only.', true, 'grade');
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
  // A closed gap becomes something you own: it joins Learnings & insights and comes back for recall in 3 days.
  closeGap(g, check) {
    const now = this.now();
    this.setState(s => ({
      gaps: s.gaps.map(x => x.id === g.id ? { ...x, status: 'closed', closedAt: now } : x),
      ledger: s.ledger.some(e => e.id === 'gap-' + g.id) ? s.ledger : s.ledger.concat([{ id: 'gap-' + g.id, kind: 'gap', title: g.topic, predicted: null, actual: null, fixed: null, delayed: null, hints: 0, realWork: [], reviews: [],
        ownedAt: now, dueAt: now + 3 * DAY, gap: { ...g, check }, own: { scenario: null, focus: { label: g.topic, mode: 'concept' }, lang: 'concept', code: '', write: { schema: '' } } }]),
    }));
  }
  finishOwn = () => {
    const o = this.state.own; const g = o.write.firstGrade || o.write.grade || { score: 0 }, last = o.write.grade;
    const fixed = o.write.attempts > 1 && last && last.score !== g.score ? `, fixed to ${last.score}/5` : '';
    const summary = `${o.focus ? o.focus.label : o.scenario ? o.scenario.title : o.lang} · predicted ${o.prediction}/5, wrote ${g.score}/5${fixed}${o.teach.turns ? ', taught Sam' : ''}`;
    this.setState({ own: null, messages: this.state.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', summary } : m) });
  };

  // 3 days later
  startDelayed(e) {
    const sc = e.own.scenario, t = this.targetOf(e.own), td = t && t.delayed;
    const d = td
      ? { ledgerId: e.id, task: td.task, ref: td.check.expected, schema: td.schema, before: td.before, after: td.after, placeholder: td.placeholder, check: td.check, picked: {}, text: '', grade: null, loading: false, actual: e.actual, lang: e.own.lang }
      : { ledgerId: e.id, task: sc ? sc.delayedTask : '', ref: sc ? sc.delayedRef : '', schema: sc ? sc.schema : (e.own.write.schema || ''), before: '', after: '', placeholder: '', check: null, text: '', grade: null, loading: false, actual: e.actual, lang: e.own.lang };
    this.setState({ delayed: d, messages: this.state.messages.concat([{ id: this.nid(), type: 'delayed' }]) });
    if (!sc && !td) this.ask(`Write a short unassisted recall task (one sentence, starts with "From memory:") testing the same concept as this ${e.own.lang} code, plus a reference solution. Return ONLY JSON {"task": string, "reference": string}.\n${e.own.code}`, 'Strict JSON only.', true).then(r => this.setState(s => ({ delayed: { ...s.delayed, task: r.task, ref: r.reference } }))).catch(() => this.setState(s => ({ delayed: { ...s.delayed, task: 'From memory: rewrite the code you owned without looking back.', ref: e.own.code } })));
  }
  submitDelayed = async () => {
    const d = this.state.delayed, isChoice = d.check && d.check.type === 'choice';
    if ((isChoice ? !Object.keys(d.picked).length : !d.text.trim()) || d.loading) return;
    this.setState({ delayed: { ...d, loading: true } });
    let g;
    try {
      if (!d.check) throw new Error('no executable check');
      const r = await runCheck(d.check, d.text, d.before, d.after, d.picked); g = { score: r.score, note: [r.worked, r.gap, correctionNote(r.corrections)].filter(Boolean).join(' ') };
    } catch (_) {
      try { g = await this.gradeAttempt(d.task, d.ref, d.text, d.lang, `"note": one sentence, specific, curious not judgmental, naming what held and what slipped`); }
      catch (e) { const f = this.fallbackGrade({ lang: d.lang }, d.text, d.ref); g = { score: f.score, note: f.worked + ' ' + f.gap }; }
    }
    const first = !d.firstGrade;
    this.setState(s => ({ delayed: { ...s.delayed, grade: g, loading: false, firstGrade: s.delayed.firstGrade || g, attempts: (s.delayed.attempts || 0) + 1 }, ledger: s.ledger.map(e => e.id === d.ledgerId ? (first ? { ...e, delayed: g.score } : { ...e, delayedFixed: g.score }) : e) }));
  };

  // ---------- recall: what you owned comes back for an unassisted check ----------
  startRecall(e) {
    if (e.kind === 'gap') return this.startGapRecall(e);
    const sc = e.own.scenario, t = this.targetOf(e.own), td = t && t.delayed;
    const last = e.reviews && e.reviews.length ? e.reviews[e.reviews.length - 1].score : e.actual;
    // "Then" is fixed when the recall starts, so the result reads "First try, 3 days ago: 3/5 → today: 5/5".
    const thenLabel = `${e.reviews && e.reviews.length ? `Last recall, ${rel(e.reviews[e.reviews.length - 1].at, this.now())}` : `First try, ${rel(e.ownedAt, this.now())}`}: ${last}/5`;
    const base = { entryId: e.id, picked: {}, text: '', grade: null, loading: false, lang: e.own.lang, then: last, thenLabel };
    const r = td ? { ...base, task: td.task, ref: td.check.expected, schema: td.schema || '', before: td.before || '', after: td.after || '', placeholder: td.placeholder || '', check: td.check }
      : { ...base, task: sc && sc.delayedTask ? sc.delayedTask : '', ref: sc ? sc.delayedRef || '' : '', schema: '', before: '', after: '', placeholder: '', check: null };
    this.setState({ recall: r });
    if (!r.task) this.ask(`Write a short unassisted recall task (one sentence, starts with "From memory:") testing "${e.title}", plus a reference answer. Return ONLY JSON {"task": string, "reference": string}.\n${e.own.code || ''}`, 'Strict JSON only.', true)
      .then(x => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: x.task, ref: x.reference } : s.recall })))
      .catch(() => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: `From memory: explain or redo "${e.title}" without looking back.`, ref: '' } : s.recall })));
  }
  startGapRecall(e) {
    const g = e.gap, base = { entryId: e.id, gapMode: true, picked: {}, text: '', grade: null, loading: false, lang: 'concept', then: null, thenLabel: `Closed ${rel(e.ownedAt, this.now())}`, schema: '', before: '', after: '', placeholder: 'From memory. Explain it and apply it.', check: null };
    const cold = isColdStart(g);
    this.setState({ recall: { ...base, task: cold ? 'From memory, a new situation: a friend is launching a marketplace that connects local tutors with students. Neither side exists yet. What would you tell them to do first, and why?' : '' } });
    if (!cold) this.ask(`Write one new question that checks, from memory, whether someone still understands "${g.topic}" by applying it to a different concrete case than before (${g.check ? g.check.question : ''}). Return ONLY JSON {"question": string}`, 'Strict JSON only.', true)
      .then(x => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: x.question } : s.recall })))
      .catch(() => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: `From memory, in your own words and with a new example: ${g.topic}?` } : s.recall })));
  }
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
      g = { score: res.closed ? 5 : 3, note: res.feedback };
    } else try {
      if (!r.check) throw new Error('no executable check');
      const x = await runCheck(r.check, r.text, r.before, r.after, r.picked); g = { score: x.score, note: [x.worked, x.gap, correctionNote(x.corrections)].filter(Boolean).join(' ') };
    } catch (_) {
      try { g = await this.gradeAttempt(r.task, r.ref, r.text, r.lang, `"note": one sentence, specific, curious not judgmental, naming what held and what slipped`); }
      catch (e) { const f = this.fallbackGrade({ lang: r.lang }, r.text, r.ref); g = { score: f.score, note: f.worked + ' ' + f.gap }; }
    }
    // Spacing: right → wait longer each time (7, then 21, then 60 days); missed → back tomorrow.
    const now = this.now();
    this.setState(s => ({
      recall: { ...s.recall, grade: g, loading: false },
      ledger: s.ledger.map(e => {
        if (e.id !== r.entryId) return e;
        const streak = (() => { let k = 0; for (let i = (e.reviews || []).length - 1; i >= 0 && e.reviews[i].score >= 5; i--) k++; return k; })();
        const gap = g.score >= 5 ? [7, 21, 60][Math.min(streak, 2)] : 1;
        return { ...e, delayed: e.delayed == null ? g.score : e.delayed, reviews: (e.reviews || []).concat([{ at: now, score: g.score }]), dueAt: now + gap * DAY, nextGap: gap };
      }),
    }));
  };
  skipAhead = () => this.setState(s => ({ timeShift: s.timeShift + 3 * DAY }));

  // ---------- learnings page: everything you chose to own, and how it went ----------
  learningsVals() {
    const S = this.state;
    const reopen = sc => sc === this.BOOK ? this.startBook : sc === this.JUNO ? this.startJuno : sc === this.SQL ? this.startSql : null;
    const now = this.now();
    const items = S.ledger.slice().reverse().map(e => {
      const key = goFirstFor(e.own.focus && e.own.focus.target);
      const steps = (e.kind === 'gap'
        ? [{ label: 'Gap found', v: e.gap.source === 'recall' ? 'in a recall' : 'teaching Sam', tone: 'mute' }, { label: 'Closed', v: 'checked ✓', tone: 'act' }]
        : [{ label: 'Predicted', v: `${e.predicted}/5`, tone: 'pred' }, { label: 'First try', v: `${e.actual}/5`, tone: 'act' }])
        .concat(e.fixed != null && e.fixed !== e.actual ? [{ label: 'Fixed', v: `${e.fixed}/5`, tone: 'mute' }] : [])
        .concat((e.reviews || []).map(rv => ({ label: `Recall · ${rel(rv.at, now)}`, v: `${rv.score}/5`, tone: 'act' })))
        .concat((e.realWork || []).map(r => r.outsourced ? { label: 'Real work', v: 'let Claude answer', tone: 'mute' } : { label: 'Real work', v: `went first, ${r.actual}/5`, tone: 'act' }))
        .concat(e.dueAt != null && e.dueAt > now ? [{ label: 'Recall', v: rel(e.dueAt, now), tone: 'next' }] : []);
      const due = e.dueAt != null && e.dueAt <= now, r = S.recall && S.recall.entryId === e.id ? S.recall : null;
      return { id: e.id, title: e.title, from: e.kind === 'gap' ? e.gap.from : e.own.scenario ? e.own.scenario.title : S.chatTitle, steps, due,
        owned: e.ownedAt != null ? `owned ${rel(e.ownedAt, now)}` : '', next: e.dueAt != null && !due ? `next recall ${rel(e.dueAt, now)}` : '',
        onRecall: () => this.startRecall(e), recall: r, then: r ? r.thenLabel : '',
        onNew: key ? () => this.startGoFirst(key) : null, newLabel: key ? GO_FIRST[key].chip : '' };
    });
    const real = S.ledger.flatMap(e => e.realWork || []);
    return {
      askedAbout: S.asked.filter(a => !a.checked).map(a => ({ ...a, when: rel(a.at, now), onCheck: () => this.checkLanded(a.id) })),
      openGaps: S.gaps.filter(g => g.status === 'open').map(g => ({ ...g, when: rel(g.at, now), onExplore: () => this.exploreGap(g.id) })),
      saveRecallGap: () => this.recallGap(), exploreRecallGap: () => this.exploreGap(this.recallGap()), gapTopics: S.gaps.map(g => g.topic),
      items, empty: !items.length, dueItems: items.filter(it => it.due), laterItems: items.filter(it => !it.due),
      onRecallText: e => this.setState(s => ({ recall: { ...s.recall, text: e.target.value } })), onRecallPick: (id, v) => this.setState(s => ({ recall: { ...s.recall, picked: { ...s.recall.picked, [id]: v } } })),
      submitRecall: this.submitRecall, closeRecall: () => this.setState({ recall: null }), skipAhead: this.skipAhead, shifted: S.timeShift > 0, shiftDays: Math.round(S.timeShift / DAY),
      exits: S.exits.map(x => ({ ...x, onReopen: reopen(x.scenario) })),
      stats: [
        { n: S.ledger.length, label: 'owned' },
        { n: S.gaps.length, label: 'gaps found by trying' },
        { n: S.gaps.filter(g => g.status === 'closed').length, label: 'gaps closed' },
        { n: real.filter(r => !r.outsourced).length, label: 'times you went first' },
      ],
    };
  }

  // ---------- render ----------
  renderVals() {
    const S = this.state, o = S.own, d = S.delayed;
    const firstAnswer = S.messages.find(m => m.type === 'assistant' && m.code);
    const openGap = S.activeGap && S.gaps.find(g => g.id === S.activeGap && g.status === 'open');
    const lastAnswer = [...S.messages].reverse().find(m => m.type === 'assistant');
    const checkOpen = S.messages.some(m => m.type === 'gapCheck' && m.phase !== 'done');
    const messages = S.messages.map(m => {
      const v = { ...m, isUser: m.type === 'user', isThinking: m.type === 'thinking', isAssistant: m.type === 'assistant', isOwn: m.type === 'own', isOwnDone: m.type === 'ownDone', isDelayed: m.type === 'delayed' };
      if (m.type === 'gapBanner') { const g = S.gaps.find(x => x.id === m.gapId) || {}; Object.assign(v, { isGapBanner: true, gap: g, gapClosed: g.status === 'closed', checking: S.messages.some(x => x.type === 'gapCheck' && x.gapId === m.gapId && x.phase !== 'done'), onCheck: () => this.startGapCheck(m.gapId) }); }
      if (m.type === 'gapCheck') Object.assign(v, { isGapCheck: true, onText: e2 => this.setGo(m.id, { text: e2.target.value }), onSubmit: () => this.submitGapCheck(this.state.messages.find(x => x.id === m.id)), onAgain: () => this.startGapCheck(m.gapId) });
      if (m.type === 'goFirst') {
        const g = GO_FIRST[m.key], e = this.ownedFor(m.key);
        Object.assign(v, { isGo: true, go: g, goOwned: e ? e.title : '', goWas: e ? `you predicted ${e.predicted}/5 and wrote ${e.actual}/5` : '',
          goFirst: () => this.setGo(m.id, { phase: 'predict' }), goAnswer: () => this.goOutsource(m), goPredict: n => this.setGo(m.id, { prediction: n, phase: 'try' }),
          goText: e2 => this.setGo(m.id, { text: e2.target.value }), goPick: (id, val) => this.setGo(m.id, x => ({ picked: { ...x.picked, [id]: val } })), goCheck: () => this.goCheck(m),
          goResult: m.grade ? (m.grade.score === m.prediction ? `You predicted ${m.prediction}/5 and got ${m.grade.score}/5. Spot on.` : m.grade.score > m.prediction ? `You predicted ${m.prediction}/5 and got ${m.grade.score}/5. You own more than you thought.` : `You predicted ${m.prediction}/5 and got ${m.grade.score}/5.`) : '' });
      }
      if (v.isAssistant) { v.flash = S.flashMsg === m.id; v.owning = o && o.msgId === m.id ? (o.code === o.fullCode || o.code.length > 400 ? 'whole' : 'part') : null; v.hasIntro = !!m.intro; v.hasOutro = !!m.outro; v.hasCode = !!m.code; v.showOwnHint = m.learn && !!m.code; v.checkChip = !!openGap && m === lastAnswer && !checkOpen ? () => this.checkMeFromChat(openGap.id) : null;
        const askedItem = m.askedId && S.asked.find(a => a.id === m.askedId);
        v.ownExpanded = !!(askedItem && !askedItem.checked && !o); if (v.ownExpanded) v.ownAll = () => this.checkLanded(askedItem.id); v.showTip = !S.tipDismissed && !o && m === firstAnswer; v.ownActive = !!o && o.msgId === m.id; v.ownBlocked = !!o && !v.ownActive; v.onCopy = () => this.copyAnswer(m); v.onSpeak = () => this.speakAnswer(m); v.copied = this.state.copied === m.id; v.when = m.at ? ago(m.at) : ''; v.onMouseUp = e => this.onCodeMouseUp(m, e); v.ownAll = () => { if (this.state.own) { if (this.state.own.msgId === m.id) { const pn = this.panelRef.current; if (pn) pn.scrollTop = 0; } return; } this.beginOwn(m, m.code, m.plain ? null : this.wholeFocus(m)); }; v.ownAllLabel = m.lang === 'email' ? 'Own the whole email' : m.lang === 'sql' ? 'Own the whole query' : m.plain ? 'Own this response' : 'Own the whole thing'; v.isMd = !!m.plain; v.isProse = !v.isMd && (m.lang === 'email' || !!(m.scenario && m.scenario.prose) || !!m.plain); v.isCodeBlock = !v.isMd && !v.isProse; }
      return v;
    });
    const ledger = S.ledger.map(e => ({ ...e, hasDelayed: e.delayed != null, isDue: e.dueAt != null && e.dueAt <= this.now() }));
    const withBoth = S.ledger.filter(e => e.kind !== 'gap'); const avgP = withBoth.reduce((a, e) => a + e.predicted, 0) / (withBoth.length || 1), avgA = withBoth.reduce((a, e) => a + e.actual, 0) / (withBoth.length || 1);
    const gapN = avgP - avgA;
    const V = {
      hasOwn: !!o, panelRef: this.panelRef, focusPanel: () => { const pn = this.panelRef.current; if (pn) pn.scrollTop = 0; },
      dismissTip: () => this.setState({ tipDismissed: true }),
      isLearnings: S.view === 'learnings', openLearnings: this.openLearnings, ownedCount: S.ledger.length, dueCount: S.ledger.filter(e => e.dueAt != null && e.dueAt <= this.now()).length,
      learn: this.learningsVals(),
      // Seeded chats show up as past chats: you already talked with Claude, now see what stuck.
      chatList: [
        ...(S.messages.length && ![this.BOOK.title, this.JUNO.title].includes(S.chatTitle) ? [{ title: S.chatTitle, active: true, onClick: () => {} }] : []),
        { title: this.BOOK.title, active: S.chatTitle === this.BOOK.title, onClick: this.startBook },
        { title: this.JUNO.title, active: S.chatTitle === this.JUNO.title, onClick: this.startJuno },
      ],
      messages, ledger, ledgerEmpty: !S.ledger.length && !S.exits.length, exits: S.exits, hasExits: !!S.exits.length, chatTitle: S.chatTitle, isEmpty: !S.messages.length, composer: S.composer,
      hasCalibration: S.ledger.some(e => e.kind !== 'gap'), calibrationText: Math.abs(gapN) < 0.5 ? 'Calibration: your predictions track your results.' : gapN > 0 ? `Calibration: you predict ${gapN.toFixed(1)} higher than you perform. Reading feels like knowing; the ledger shows the difference.` : `Calibration: you underrate yourself by ${(-gapN).toFixed(1)}.`,
      composerBorder: '#D9D4CA', composerPlaceholder: 'Ask Claude anything…',
      onComposer: e => this.setState({ composer: e.target.value }), onComposerKey: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } }, send: this.send, newChat: this.newChat, startSql: this.startSql, startReact: this.startReact, startBook: this.startBook, startJuno: this.startJuno,
      startSales: this.startSales,
      hasSel: !!S.sel, selX: S.sel ? S.sel.x + 'px' : '0px', selY: S.sel ? S.sel.y + 'px' : '0px', ownSelection: this.ownSelection, askSelection: this.askSelection, scrollRef: this.scrollRef,
      // delayed
      delayedBefore: d ? d.before : '', delayedAfter: d ? d.after : '', delayedPlaceholder: d && d.placeholder ? d.placeholder : 'No hints this time. Write it from memory.',
      delayedTask: d ? (d.task || 'Preparing a recall task…') : '', delayedIsChoice: !!(d && d.check && d.check.type === 'choice'), delayedQs: d && d.check && d.check.questions ? d.check.questions : [], delayedPicked: d ? d.picked || {} : {},
      onDelayedPick: (id, v) => this.setState(s => ({ delayed: { ...s.delayed, picked: { ...s.delayed.picked, [id]: v } } })), delayedSchema: d ? d.schema : '', hasDelayedSchema: !!(d && d.schema), delayedOpen: !!d && !d.grade, delayedText: d ? d.text : '', onDelayedText: e => this.setState({ delayed: { ...this.state.delayed, text: e.target.value } }), submitDelayed: this.submitDelayed, delayedLoading: !!d && d.loading, delayedGraded: !!d && !!d.grade, delayedScore: d && d.grade ? (d.firstGrade || d.grade).score : 0, delayedCanFix: !!(d && d.grade && d.grade.score < 5), fixDelayed: () => this.setState(s => ({ delayed: { ...s.delayed, grade: null } })),
      delayedFixLine: d && d.grade && d.attempts > 1 ? `Try ${d.attempts}: ${d.grade.score}/5. The 3-day score stays your first try.` : '', delayedActual: d ? d.actual : 0, delayedNote: d && d.grade ? d.grade.note : '', delayedGradedAny: !!(d && d.firstGrade)
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
    const ladderNav = L.map(s => { const cur = o.step === s && o.phase === 'ladder', done = !!o.visited[s] && !cur; return { label: STEP_LABELS[s], onClick: goStep(s), bg: cur ? '#C4613A' : done ? '#F1E3D8' : 'transparent', fg: cur ? '#fff' : done ? '#9E4B2A' : '#716C64' }; });
    const nextOf = s => L[L.indexOf(s) + 1];
    const nextLabel = { see: 'see it run →', assemble: 'assemble it →', compare: 'compare it →', write: 'now write one yourself →' };
    Object.assign(V, {
      ...(() => {
        const whole = o.code === o.fullCode || o.code.length > 400;
        const lead = o.code.replace(/```[\s\S]*?```/g, ' ').replace(/[*`#>]/g, '').replace(/\s+/g, ' ').trim();
        const looksLikeCode = !o.code.includes('```') && /[;{}=()]|^\s*(SELECT|FROM|LEFT|JOIN|WHERE|GROUP|ORDER|AND|const|let|return|function|if|import)\b/m.test(o.code) && !/[a-z]+ [a-z]+ [a-z]+ [a-z]+[.,]/i.test(o.code);
        return { ownWhole: whole, ownLead: (lead.match(/^.*?[.?!](\s|$)/) || [lead])[0].trim().slice(0, 150), ownQuote: looksLikeCode ? '```' + (o.lang || '') + '\n' + o.code + '\n```' : o.code };
      })(),
      ownEntryLabel: 'Own it', ownTitle: o.focus ? o.focus.label : S.chatTitle, ownCode: o.code.replace(/```\w*\n?/g, '').replace(/\*\*|`/g, ''), ownIsProse: !!(o.scenario && o.scenario.prose), conceptInLabel: (o.scenario && o.scenario.inYourLabel) || 'In your query', hasAnnotations: !!(o.annotations && o.annotations.length) || o.annotLoading, ownPhaseLabel: phaseLabels[o.phase], stepper, ownShowLadderNav: o.phase === 'ladder' || o.phase === 'reveal', ladderNav,
      phaseFocus: o.phase === 'focus', focusLoading: !o.focusOptions, focusOptions: (o.focusOptions || []).map(f => ({ label: f.label, kind: f.mode === 'sequence' ? 'structure' : 'concept', onPick: () => this.pickFocus(f) })),
      focusOther: o.focusOther, onFocusOther: e => this.setOwn({ focusOther: e.target.value }), onFocusOtherKey: e => { if (e.key === 'Enter') this.submitFocusOther(); }, submitFocusOther: this.submitFocusOther,
      hasFocus: !!o.focus, focusLabel: o.focus ? o.focus.label : '',
      toggleRefresher: () => this.setOwn(cur => ({ refresherOpen: !cur.refresherOpen })), refresherOpen: !!o.refresherOpen,
      rereadChat: () => { const hl = this._ownedRange && this._ownedRange.startContainer.parentElement; if (hl) { hl.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } const el = document.querySelector(`[data-msg-id="${o.msgId}"]`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); this.setState({ flashMsg: o.msgId }); setTimeout(() => this.setState({ flashMsg: null }), 1600); } },
      goNext: this.goNext, readNextLabel: 'Makes sense, ' + nextLabel[nextOf('read')], seeNextLabel: 'Got it, ' + nextLabel[nextOf('see')],
      goVisual: this.goVisual, visualAgainLabel: 'See it visually',
      seeIsProse: o.lang === 'email',
      phaseWhy: o.phase === 'why', phasePredict: o.phase === 'predict', phaseLadder: o.phase === 'ladder', phaseReveal: o.phase === 'reveal', phaseTeach: o.phase === 'teach',
      ownWhy: o.why, onWhy: e => this.setOwn({ why: e.target.value }), onWhyKey: e => { if (e.key === 'Enter') this.submitWhy(); }, submitWhy: this.submitWhy, cancelOwn: this.cancelOwn, leaveOwn: this.leaveOwn, changeFocus: this.changeFocus,
      predictHint: "Then you'll try it on a new case. Claude's answer is your material; there's no studying first.",
      ...(() => {
        const w = o.write, chk = w.check, label = o.focus ? o.focus.label : 'this';
        if (w.loading || (!w.task && !chk)) return { predictQuestion: 'Could you do this yourself, without me?', predictNext: 'Preparing your try…' };
        if (chk && chk.type === 'choice') return { predictQuestion: `Could you answer ${chk.questions.length} questions about this without help?`, predictNext: `Next: ${chk.questions.length} questions on “${label}”, on a new case.` };
        if (chk && chk.type === 'explain') return { predictQuestion: 'Could you explain this and apply it to a new case, without me?', predictNext: 'Next: one question, answered in your own words.' };
        if (chk && chk.type === 'number') return { predictQuestion: 'Could you work this out without me?', predictNext: 'Next: a new case to work out.' };
        return { predictQuestion: 'Could you write this yourself, without me?', predictNext: `Next: write it for a new case.` };
      })(),
      writeRefresher: o.write.grade ? [] : [...(this.frame(o).orderMatters ? [{ label: 'Warm up with the pieces', onClick: goStep('assemble') }] : []), ...(this.visualStep(o) ? [{ label: 'See it visually', onClick: goStep(this.visualStep(o)) }] : [])],
      askAboutIt: this.askAboutIt, revealVisual: this.visualStep(o) ? goStep(this.visualStep(o)) : null,
      predictOptions: [1, 2, 3, 4, 5].map(n => ({ n, label: ['Not at all', 'Barely', 'Partly', 'Mostly', 'Easily'][n - 1], onPick: () => this.pickPrediction(n), border: '#E3C9B8', bg: '#fff', fg: '#1F1D1A' })),
      stepRead: o.step === 'read', stepSee: o.step === 'see', stepAsm: o.step === 'assemble', stepCompare: o.step === 'compare', stepWrite: o.step === 'write',
      hasConcept: !!(o.concept && !o.concept.loading), conceptLoading: !!(o.concept && o.concept.loading),
      conceptModel: o.concept ? o.concept.model || '' : '', conceptInYourCode: o.concept ? o.concept.inYourCode || '' : '', conceptRule: o.concept ? o.concept.rule || '' : '',
      conceptGrid: o.concept && o.concept.grid ? { cols: `minmax(90px,.8fr) ${o.concept.grid.headers.slice(1).map(() => 'minmax(0,1fr)').join(' ')}`, headers: o.concept.grid.headers.map(t => ({ t })), rows: o.concept.grid.rows.map(r => ({ cells: r.map((c, j) => typeof c === 'object' && c ? { t: c.t, strong: !!c.strong, first: j === 0 } : { t: String(c), strong: false, first: j === 0 }) })) } : null,
      readIntro: o.focus && o.focus.mode === 'concept' ? `The idea first, then how it applies to your ${o.scenario && o.scenario.prose ? 'question' : 'query'}.` : "Each line, what it does and why it's there. Read, then move on when it makes sense.",
      annotations: o.annotations || [], annotLoading: o.annotLoading, goSee: this.goSee, goAssemble: this.goAssemble, goWrite: this.goWrite,
      qa: o.qa.map(x => ({ ...x, hasA: !!x.a })), hasQa: o.qa.length > 0, qaInput: o.qaInput, onQaInput: e => this.setOwn({ qaInput: e.target.value }), onQaKey: e => { if (e.key === 'Enter') this.askStep(this.state.own.qaInput); }, sendQa: () => this.askStep(this.state.own.qaInput),
      composerPlaceholder: 'Reply to Claude…'
    });
    // see
    const see = o.see, idx = o.seeIdx, cur = see ? see[idx] : null;
    const isSqlSee = o.scenario === this.SQL && o.lang === 'sql';
    Object.assign(V, {
      startSales: this.startSales,
      seeIntro: isSqlSee ? 'The query, run on six customers and twelve orders, in the order the database actually runs it. Two side steps show what would go wrong with a plain JOIN, and with the filter in WHERE.' : o.scenario === this.REACT ? 'The component, run through a mount, two quick id changes, and a late response. Two side steps show what breaks without the cleanup, and with an empty dependency array.' : o.scenario === this.SALES ? 'The email, read the way Priya reads it, line by line. Two side steps show the two most common ways this email goes wrong.' : 'The code, run step by step in the order things actually happen.',
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
      writeIsChoice: !!(w.check && w.check.type === 'choice'), writeQs: w.check && w.check.questions ? w.check.questions : [], writePicked: w.picked,
      onWritePick: (id, v) => this.setOwn(cur => ({ write: { ...cur.write, picked: { ...cur.write.picked, [id]: v } } })),
      writeBefore: w.before, writeAfter: w.after, writePlaceholder: w.placeholder || 'Write it here. Ask for a hint any time; hints are part of learning, not cheating.',
      writeTask: w.task, writeLoading: w.loading, writeSchema: w.schema, hasWriteSchema: !!w.schema, writeText: w.text, onWriteText: e => this.setOwn({ write: { ...this.state.own.write, text: e.target.value } }),
      hasHints: w.hints.length > 0, hints: w.hints.map((t, i) => ({ t, n: i + 1 })), askHint: this.askHint, submitWrite: this.submitWrite,
      writeNotGraded: !w.grade, writeCanDrop: w.hints.length >= 2, gradeLoading: w.gradeLoading || w.hintLoading, gradeLoadingText: w.hintLoading ? 'thinking of a hint…' : 'grading fairly…'
    });
    // reveal
    const g = w.grade || { score: 0, worked: '', gap: '', revealLine: '' };
    const g1 = w.firstGrade || g; // the measurement: your first unassisted try
    const order = L, labels = STEP_LABELS;
    const startI = order.indexOf(o.startStep);
    const pct = n => ((n - 1) / 4 * 100) + '%';
    const lo = Math.min(o.prediction, g1.score), hi = Math.max(o.prediction, g1.score);
    Object.assign(V, {
      revealHeadline: g1.score === o.prediction ? 'Predicted and actual line up.' : g1.score > o.prediction ? 'You own more than you predicted.' : 'The reading was smoother than the writing.',
      canFix: !!w.grade && g.score < 5, fixWrite: this.fixWrite,
      revealFixLine: w.attempts > 1 ? `Try ${w.attempts}: ${g.score}/5${g.score === 5 ? ', fixed' : ''}. Your prediction is still measured against your first try (${g1.score}/5), since that's what you could do on your own.` : '',
      revealNodes: order.map((s, i) => {
        const v = o.visited[s] || 0; const skipped = i < startI && !v;
        let detail = skipped ? 'optional, not opened' : s === 'read' ? 'read with notes' : s === 'see' ? (v > 1 ? 'watched ' + v + '×' : 'watched it run') : s === 'assemble' ? (a ? (a.attempts === 1 ? 'right first try' : a.attempts + ' tries' + (a.usedDistractor ? ', filter in WHERE' : '')) : '') : s === 'compare' ? (cmGuessed ? cmRight + ' of ' + cmGuessed + ' guesses right' : 'compared') : (g1.score + '/5' + (w.attempts > 1 ? ' → ' + g.score + '/5 on try ' + w.attempts : '') + (w.hints.length ? ', ' + w.hints.length + ' hint' + (w.hints.length > 1 ? 's' : '') : ', no hints'));
        return { label: labels[s], detail, above: i === startI ? 'started here · predicted ' + o.prediction : '', mark: skipped ? '' : '✓', dotBg: skipped ? '#F6F4EF' : s === 'write' ? '#2F8F86' : '#C4613A', dotBorder: skipped ? '#D9D4CA' : s === 'write' ? '#2F8F86' : '#C4613A', fg: skipped ? '#B5AFA4' : '#1F1D1A' };
      }),
      revealCols: `repeat(${order.length},1fr)`, predLeft: pct(o.prediction), actLeft: pct(g1.score), gapLeft: pct(lo), gapWidth: ((hi - lo) / 4 * 100) + '%', ownPredictionN: o.prediction, actualN: g1.score,
 revealWhy: `Why ${g.score}/5: ${g.why || RUBRIC_WHY[g.score] || ''}`,
      revealNotes: [...(g.worked ? [{ kind: 'nice', quote: '', text: g.worked }] : []), ...(w.notes || [])], notesLoading: !!w.notesLoading,
      revealScale: 'Scale: ' + (w.check && SCALES[w.check.type] ? SCALES[w.check.type] : g.table || g.corrections ? SQL_SCALE : RUBRIC_SCALE),
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
    return (
      <>
      <div style={css(`display:flex;height:100vh;overflow:hidden`)}>

      <aside style={css(`width:260px;flex:none;background:#F3F1EC;border-right:1px solid #E3DFD6;display:flex;flex-direction:column;padding:16px 12px;gap:18px;overflow:auto`)}>
        <div style={css(`display:flex;align-items:center;justify-content:space-between;padding:0 6px`)}>
          <span style={css(`font-family:Newsreader,serif;font-size:23px;letter-spacing:-.01em`)}>Claude</span>
          <span style={css(`width:18px;height:14px;border:1.4px solid #8A847A;border-radius:3px`)}></span>
        </div>
        <div style={css(`display:flex;background:#E7E3DA;border-radius:10px;padding:3px`)}>
          <span style={css(`flex:1;text-align:center;background:#fff;border-radius:8px;padding:6px 0;font-size:13.5px;box-shadow:0 1px 2px rgba(0,0,0,.08)`)}>Chat</span>
          <span title="Not in this prototype" style={css(`flex:1;text-align:center;padding:6px 0;font-size:13.5px;color:#716C64`)}>Code</span>
        </div>
        <nav style={css(`display:flex;flex-direction:column;gap:1px`)}>
          <button onClick={V.newChat} style={css(NAV)} className="hv1"><span style={css(`width:18px;text-align:center`)}>+</span>New chat</button>
          <button onClick={V.openLearnings} data-role="nav-learnings" style={css(NAV + `;background:${V.isLearnings ? '#E4DFD4' : 'none'}`)} className="hv1"><span style={css(`width:18px;display:flex;justify-content:center;color:#C4613A`)}><OwnIcon /></span>Learnings{V.dueCount > 0 ? <span data-role="recall-badge" title={`${V.dueCount} ready to recall`} aria-label={`${V.dueCount} to recall`} style={css(`margin-left:auto;font-size:11px;background:#C4613A;color:#fff;border-radius:99px;padding:1px 7px;display:flex;align-items:center;gap:4px;white-space:nowrap;flex:none`)}><span style={css(`width:5px;height:5px;border-radius:50%;background:#fff`)}></span>{V.dueCount}</span> : V.ownedCount > 0 && <span style={css(`margin-left:auto;font-size:11px;background:#F1E3D8;color:#9E4B2A;border-radius:99px;padding:1px 7px`)}>{V.ownedCount}</span>}</button>
          {['Search', 'Projects', 'Artifacts', 'Customize'].map(l => <span key={l} title="Not in this prototype" style={css(NAV + `;color:#716C64;cursor:default`)}><span style={css(`width:18px;display:flex;justify-content:center;color:#8A847A`)}>{NAV_ICONS[l]}</span>{l}</span>)}
        </nav>
        <div style={css(`display:flex;flex-direction:column;gap:1px`)}>
          <div style={css(`font-size:13px;color:#716C64;padding:0 8px 6px`)}>Chats</div>
          {V.chatList.map((c, i) => <button key={i} onClick={c.onClick} data-role="past-chat" style={css(NAV + `;font-size:13.5px;background:${c.active ? '#E4DFD4' : 'none'}`)} className="hv1"><span style={css(`width:18px;text-align:center;color:#B5AFA4;font-size:9px`)}>○</span><span style={css(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{c.title}</span></button>)}
        </div>
        {/* What you own lives on the Learnings & insights page; the sidebar only signals when something is ready to recall. */}
        <div style={css(`flex:1`)}></div>
        <div style={css(`display:flex;align-items:center;gap:10px;padding:12px 6px 0;border-top:1px solid #E3DFD6`)}>
          <span style={css(`width:28px;height:28px;border-radius:50%;background:#DCD6CB;display:flex;align-items:center;justify-content:center;font-size:12px;color:#514C44;flex:none`)}>P</span>
          <span style={css(`font-size:12px;color:#716C64;line-height:1.4`)}>Prototype · Own It or Outsource It</span>
        </div>
      </aside>

      <main style={css(`flex:1;display:flex;flex-direction:column;min-width:0;position:relative`)}>
        {V.isLearnings ? this.renderLearnings(V) : (<>
        {!V.isEmpty && (
          <div style={css(`display:flex;align-items:center;justify-content:space-between;padding:14px 24px;flex:none`)}>
            <div style={css(`display:flex;align-items:center;gap:6px;font-size:15px;color:#1F1D1A;min-width:0`)}><span style={css(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{V.chatTitle}</span><span style={css(`color:#8A847A;font-size:11px`)}>⌄</span></div>
            <button aria-disabled="true" title="Not in this prototype" style={css(`background:none;border:none;font-size:13.5px;color:#514C44;display:flex;gap:6px;align-items:center;cursor:default`)}>⇪ Share</button>
          </div>
        )}
        <div ref={V.scrollRef} style={css(`flex:1;overflow:auto;padding:${V.isEmpty ? '0' : '12px'} 0 24px;display:flex;flex-direction:column`)}>
          <div style={css(`width:100%;max-width:${V.isEmpty ? '640px' : '720px'};margin:${V.isEmpty ? 'auto' : '0 auto'};padding:0 28px;display:flex;flex-direction:column;gap:24px`)}>

            {!!(V.isEmpty) && (
              <div style={css(`display:flex;flex-direction:column;align-items:center;gap:26px;animation:rise .4s ease;padding-bottom:8vh`)}>
                <h1 style={css(`display:flex;align-items:center;gap:14px;font-family:Newsreader,serif;font-weight:400;font-size:40px;line-height:1.15;margin:0;letter-spacing:-.01em`)}><Spark />Back at it</h1>
                {this.renderComposer(V, true)}
                <div style={css(`display:flex;gap:8px;flex-wrap:wrap;justify-content:center`)}>
                  <button onClick={V.startSql} style={css(CHIP)} className="hv3">SQL · revenue per customer</button>
                  <button onClick={V.startReact} style={css(CHIP)} className="hv3">React · fetch on mount</button>
                </div>
                <div style={css(`font-size:12.5px;color:#9A948A;text-align:center;max-width:440px;line-height:1.5`)}>Or open a past chat in the sidebar, and own what you learned there.</div>
              </div>
            )}

            {(V.messages || []).map((m, _i) => (<React.Fragment key={_i}>

              {!!(m.isUser) && (<>
                <div style={css(`align-self:flex-end;max-width:80%;background:#E9E4DA;border-radius:16px 16px 4px 16px;padding:11px 15px;font-size:15px;line-height:1.5;white-space:pre-wrap;animation:rise .25s ease`)}>{m.text}</div>
              </>)}

              {!!(m.isThinking) && (<>
                <div style={css(`display:flex;gap:5px;padding:6px 2px`)}><span style={css(`width:7px;height:7px;border-radius:50%;background:#8A847A;animation:pulse 1.2s infinite`)}></span><span style={css(`width:7px;height:7px;border-radius:50%;background:#8A847A;animation:pulse 1.2s .2s infinite`)}></span><span style={css(`width:7px;height:7px;border-radius:50%;background:#8A847A;animation:pulse 1.2s .4s infinite`)}></span></div>
              </>)}

              {!!(m.isAssistant) && (<>
                <div data-msg-id={m.id} data-owning={m.owning || undefined} style={css(`display:flex;flex-direction:column;gap:12px;animation:rise .3s ease;border-radius:12px;transition:box-shadow .3s;${m.flash ? 'box-shadow:0 0 0 3px #F0C9B4,0 0 0 10px #FFF5EE' : ''}`)}>
                  {!!(m.hasIntro) && (<><div style={css(SERIF)}>{m.intro}</div></>)}
                  {!!(m.hasCode) && (<>
                    <div onMouseUp={m.onMouseUp} style={css(m.plain ? `position:relative` : `position:relative;background:#FBFAF7;border:1px solid #E3DFD6;border-radius:10px;overflow:hidden`)}>
                      {!m.plain && <div style={css(`display:flex;justify-content:space-between;align-items:center;padding:6px 12px;border-bottom:1px solid #EEEAE2;font-size:11px;color:#8A847A`)}><span>{m.lang}</span></div>}
                      {!!(m.isMd) && <Md text={m.code} />}
                      {!!(m.isCodeBlock) && (<><pre style={css(`margin:0;padding:14px 16px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;overflow:auto;white-space:pre`)}>{m.code}</pre></>)}
                      {!!(m.isProse) && (<><pre style={css(`margin:0;padding:${m.plain ? '0' : '16px 18px'};font-family:${m.plain ? 'Newsreader,serif' : "'Instrument Sans',system-ui,sans-serif"};font-size:${m.plain ? '16.5px' : '14.5px'};line-height:${m.plain ? '1.65' : '1.7'};white-space:pre-wrap`)}>{m.code}</pre></>)}
                    </div>
                  </>)}
                  {!!(m.hasOutro) && (<><div style={css(SERIF)}>{m.outro}</div></>)}
                  {/* Claude's action row: copy · read aloud · retry, then Own it in the same quiet style, then the time. */}
                  <div style={css(`display:flex;align-items:center;gap:2px;margin-top:-4px;color:#8A847A`)}>
                    <button onClick={m.onCopy} aria-label="Copy" title={m.copied ? 'Copied' : 'Copy'} style={css(ACT)} className="hv4">{m.copied ? <span style={css(`font-size:11px`)}>✓</span> : <CopyIcon />}</button>
                    <button onClick={m.onSpeak} aria-label="Read aloud" title="Read aloud" style={css(ACT)} className="hv4"><SpeakIcon /></button>
                    <button aria-label="Retry (not in this prototype)" title="Retry (not in this prototype)" aria-disabled="true" style={css(ACT + `;opacity:.45;cursor:default`)}><RetryIcon /></button>
                    {!!(m.showOwnHint && m.ownExpanded) && <button onClick={m.ownAll} data-role="own-all" data-expanded="true" title="You're digging into this. Test yourself on it" style={css(`display:flex;align-items:center;gap:6px;background:#C4613A;color:#fff;border:none;border-radius:99px;padding:5px 12px 5px 9px;font-size:12.5px;margin-left:2px;animation:ownexpand .35s ease-out, ownglow 1.6s ease-out .35s 2`)}><OwnIcon />Own it · about 2 min</button>}
                    {!!(m.showOwnHint && !m.ownExpanded) && <button onClick={m.ownAll} data-role="own-all" aria-label={m.ownActive ? 'Owning this response (open in the side panel)' : m.ownAllLabel} aria-pressed={m.ownActive} aria-disabled={m.ownBlocked || undefined}
                      title={m.ownActive ? 'Owning this · open in the side panel' : m.ownBlocked ? 'Close the current Own it first' : `${m.ownAllLabel} · or highlight any part`}
                      style={css(ACT + (m.ownActive ? `;background:#C4613A;color:#fff` : m.ownBlocked ? `;color:#C9C3B8;cursor:default` : `;color:#9E4B2A`))} className={m.ownActive || m.ownBlocked ? '' : 'hv4'}><OwnIcon /></button>}
                    {!!(m.when) && <span style={css(`font-size:12.5px;color:#9A948A;margin-left:6px`)}>{m.when}</span>}
                  </div>
                  {!!(m.checkChip) && (
                    <div style={css(`display:flex;gap:8px;margin-top:-2px`)}>
                      <button onClick={m.checkChip} data-role="gap-check-chip" style={css(`background:#fff;border:1px solid #E3C9B8;border-radius:99px;padding:6px 13px;font-size:13px;color:#9E4B2A`)} className="hv3">I think I've got it: check me</button>
                    </div>
                  )}
                  {!!(m.showTip) && (
                    <div data-role="own-tip" style={css(`align-self:flex-start;display:flex;align-items:center;gap:10px;font-size:13px;line-height:1.45;color:#5A3A2A;background:#FFF5EE;border:1px solid #F0D5C4;border-radius:10px;padding:8px 10px 8px 12px;margin-top:-4px;animation:rise .3s ease`)}>
                      <span style={css(`color:#C4613A;display:flex`)}><OwnIcon /></span>
                      <span>Want to actually learn part of this? Highlight it, or use <span style={css(`color:#C4613A`)}>this icon</span> to own the whole answer. You'll try it yourself and see what stuck.</span>
                      <button onClick={V.dismissTip} aria-label="Dismiss tip" style={css(`background:none;border:none;color:#B58A74;font-size:15px;padding:0 2px`)}>×</button>
                    </div>
                  )}
                </div>
              </>)}

              {!!(m.isGo) && (
                <div data-role="go-first" style={css(`display:flex;flex-direction:column;gap:14px;animation:rise .3s ease`)}>
                  <div style={css(SERIF)}>You're owning <b>{m.goOwned}</b> ({m.goWas}). This one needs it. Want to go first? I'll check yours, then show you mine.</div>
                  {m.phase === 'offer' && (
                    <div style={css(`display:flex;gap:8px;flex-wrap:wrap`)}>
                      <button onClick={m.goFirst} style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>I'll go first</button>
                      <button onClick={m.goAnswer} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)} className="hv6">Just answer this time</button>
                    </div>
                  )}
                  {m.phase === 'predict' && (
                    <div style={css(`display:flex;flex-direction:column;gap:8px`)}>
                      <div style={css(`font-size:14px`)}>How sure are you that you'll get it right?</div>
                      <div style={css(`display:flex;gap:6px;max-width:460px`)}>
                        {['Not at all', 'Barely', 'Partly', 'Mostly', 'Easily'].map((l, i) => <button key={i} onClick={() => m.goPredict(i + 1)} style={css(`flex:1;border:1px solid #E3C9B8;background:#fff;border-radius:10px;padding:9px 4px;display:flex;flex-direction:column;align-items:center;gap:2px`)} className="hv3"><span style={css(`font-family:Newsreader,serif;font-size:18px`)}>{i + 1}</span><span style={css(`font-size:10.5px;color:#716C64`)}>{l}</span></button>)}
                      </div>
                    </div>
                  )}
                  {(m.phase === 'try' || m.phase === 'done') && (
                    <div style={css(`display:flex;flex-direction:column;gap:10px;border:1px solid #F0C9B4;background:#FFFBF8;border-radius:12px;padding:14px 16px`)}>
                      <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9E4B2A`)}>Your go · predicted {m.prediction}/5</div>
                      {!!m.go.task && <div style={css(`font-size:14px`)}>{m.go.task}</div>}
                      {!!m.go.schema && <pre style={css(`margin:0;padding:8px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#514C44;white-space:pre-wrap`)}>{m.go.schema}</pre>}
                      {m.go.check.type === 'choice'
                        ? <ChoiceQuestions qs={m.go.check.questions} picked={m.picked} onPick={m.goPick} locked={m.phase === 'done'} />
                        : <textarea data-role="go-text" value={m.text} onChange={m.goText} readOnly={m.phase === 'done'} placeholder={m.go.placeholder} style={css(`width:100%;min-height:${m.go.lang === 'sql' ? '110px' : '64px'};resize:vertical;border:1px solid #E3C9B8;border-radius:8px;padding:10px 12px;font-family:${m.go.lang === 'sql' ? "'JetBrains Mono',monospace" : 'inherit'};font-size:13.5px;background:#fff;outline:none`)}></textarea>}
                      {m.phase === 'try' && <div style={css(`display:flex;gap:8px;align-items:center`)}><button onClick={m.goCheck} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Check mine</button>{!!m.checking && <span style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>checking…</span>}</div>}
                      {m.phase === 'done' && (
                        <div data-role="go-result" style={css(`display:flex;flex-direction:column;gap:6px;border-top:1px dashed #E3C9B8;padding-top:10px`)}>
                          <div style={css(`font-family:Newsreader,serif;font-size:18px`)}>{m.goResult}</div>
                          {!!m.grade.worked && <div style={css(`font-size:13.5px;color:#514C44`)}><b style={css(`color:#1F6B64`)}>What held:</b> {m.grade.worked}</div>}
                          {!!m.grade.gap && <div style={css(`font-size:13.5px;color:#514C44`)}><b style={css(`color:#9E4B2A`)}>What to look at:</b> {m.grade.gap}</div>}
                        </div>
                      )}
                    </div>
                  )}
                  {(m.phase === 'done' || m.phase === 'answered') && (
                    <div style={css(`display:flex;flex-direction:column;gap:12px;animation:rise .3s ease`)}>
                      {m.phase === 'answered' && <div style={css(`font-size:12.5px;color:#8A847A`)}>No problem: noted in Learnings &amp; insights that you let me take this one.</div>}
                      {!!m.go.answer.intro && <div style={css(SERIF)}>{m.go.answer.intro}</div>}
                      {m.go.prose ? <div style={css(SERIF)}>{m.go.answer.code}</div> : <pre style={css(`margin:0;padding:14px 16px;background:#FBFAF7;border:1px solid #E3DFD6;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;white-space:pre`)}>{m.go.answer.code}</pre>}
                      {!!m.go.answer.outro && <div style={css(SERIF)}>{m.go.answer.outro}</div>}
                    </div>
                  )}
                </div>
              )}

              {!!(m.isGapBanner) && (
                <div data-role="gap-banner" style={css(`display:flex;gap:12px;align-items:center;border-left:3px solid ${m.gapClosed ? '#2F8F86' : '#E3A88A'};padding:4px 0 4px 12px`)}>
                  <div style={css(`display:flex;flex-direction:column;gap:3px;min-width:0`)}>
                    <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${m.gapClosed ? '#1F6B64' : '#9E4B2A'}`)}>{m.gapClosed ? '✓ Gap closed' : 'Closing a gap'}</div>
                    <div style={css(`font-size:14.5px;color:#1F1D1A`)}>{m.gap.topic}</div>
                    <div style={css(`font-size:12px;color:#8A847A`)}>{m.gapClosed ? "It's now something you own. It comes back for recall in 3 days." : `Found ${m.gap.origin}. Talk it through with Claude; check yourself whenever you're ready.`}</div>
                  </div>
                </div>
              )}

              {!!(m.isGapCheck) && (
                <div data-role="gap-check" style={css(`display:flex;flex-direction:column;gap:10px;animation:rise .3s ease`)}>
                  {m.phase === 'loading' && <div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Writing a question for you…</div>}
                  {m.phase !== 'loading' && <>
                    <div style={css(SERIF)}>Before we call it closed: {m.check.question}</div>
                    <textarea data-role="gap-answer" value={m.text} onChange={m.onText} readOnly={m.phase === 'done'} placeholder="In your own words. No looking back." style={css(`width:100%;min-height:80px;resize:vertical;border:1px solid #E3C9B8;border-radius:10px;padding:10px 12px;font-size:14px;background:#fff;outline:none;font-family:inherit`)}></textarea>
                    {m.phase === 'ask' && <div style={css(`display:flex;gap:8px;align-items:center`)}><button onClick={m.onSubmit} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:9px;padding:8px 14px;font-size:13.5px`)}>Check my answer</button>{!!m.judging && <span style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>reading it…</span>}</div>}
                    {m.phase === 'done' && (
                      <div data-role="gap-result" style={css(`display:flex;flex-direction:column;gap:8px;border:1px solid ${m.result.closed ? '#BFE0DB' : '#F0D5C4'};background:${m.result.closed ? '#F2FAF8' : '#FFFBF8'};border-radius:12px;padding:12px 14px`)}>
                        <div style={css(`font-family:Newsreader,serif;font-size:18px;color:${m.result.closed ? '#1F6B64' : '#9E4B2A'}`)}>{m.result.closed ? '✓ Gap closed' : 'Not closed yet'}</div>
                        {m.result.points.map((p, i) => <div key={i} style={css(`display:flex;gap:8px;font-size:13.5px;color:#514C44;line-height:1.45`)}><span style={css(`color:${p.ok ? '#1F6B64' : '#B5AFA4'}`)}>{p.ok ? '✓' : '○'}</span><span>{p.point}</span></div>)}
                        {!!m.result.feedback && <div style={css(`font-size:13.5px;color:#514C44;line-height:1.5`)}>{m.result.feedback}</div>}
                        {m.result.closed
                          ? <div style={css(`font-size:13px;color:#1F6B64`)}>It's now in what you own on Learnings &amp; insights, and comes back for recall in 3 days.</div>
                          : <div style={css(`display:flex;gap:8px;align-items:center;flex-wrap:wrap`)}><span style={css(`font-size:13px;color:#716C64`)}>Keep talking it through with Claude below, then</span><button onClick={m.onAgain} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:6px 12px;font-size:12.5px;color:#514C44`)} className="hv6">check me again</button></div>}
                      </div>
                    )}
                  </>}
                </div>
              )}

              {m.type === 'gap' && (
                <div style={css(`align-self:center;font-size:12px;color:#9A948A;font-style:italic;border-top:1px dashed #D9D4CA;border-bottom:1px dashed #D9D4CA;padding:6px 14px`)}>{m.text}</div>
              )}

              {!!(m.isOwnDone) && (<>
                <div style={css(`border:1px solid #E3DFD6;border-radius:12px;padding:12px 16px;font-size:13px;color:#514C44;display:flex;gap:12px;align-items:center;background:#FBFAF7`)}>
                  <span style={css(`font-family:Newsreader,serif;font-size:15px;color:#1F1D1A`)}>{m.doneLabel || 'Owned'}</span><span>{m.summary}</span>
                </div>
              </>)}

              {!!(m.isDelayed) && (<>
                <div style={css(`border:1px solid #BFE0DB;background:#F2FAF8;border-radius:14px;padding:18px 20px;display:flex;flex-direction:column;gap:12px;animation:rise .3s ease`)}>
                  <div style={css(`display:flex;align-items:center;gap:10px`)}><span style={css(`font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#1F6B64`)}>3 days later · unassisted</span></div>
                  <div style={css(`font-size:14.5px;line-height:1.5`)}>{V.delayedTask}</div>
                  {!!(V.hasDelayedSchema) && (<>
                    <pre style={css(`margin:0;padding:9px 12px;background:#E6F3F1;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.55;white-space:pre-wrap;color:#1F6B64`)}>{V.delayedSchema}</pre>
                  </>)}
                  {!!(V.delayedOpen) && (<>
                    {!!(V.delayedBefore) && (<><pre style={css(`margin:0;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;color:#8A847A;background:#E6F3F1;border-radius:8px`)}>{V.delayedBefore}</pre></>)}
                    {!!(V.delayedIsChoice) && <ChoiceQuestions qs={V.delayedQs} picked={V.delayedPicked} onPick={V.onDelayedPick} />}
                    {!V.delayedIsChoice && <textarea data-role="delayed" value={V.delayedText} onChange={V.onDelayedText} placeholder={V.delayedPlaceholder} style={css(`width:100%;min-height:96px;resize:vertical;border:1px solid #BFE0DB;border-radius:8px;padding:10px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;background:#fff;outline:none`)}></textarea>}
                    {!!(V.delayedAfter) && (<><pre style={css(`margin:0;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;color:#8A847A;background:#E6F3F1;border-radius:8px`)}>{V.delayedAfter}</pre></>)}
                    <div style={css(`display:flex;gap:8px;align-items:center`)}>
                      <button onClick={V.submitDelayed} style={css(`background:#2F8F86;border:none;color:#fff;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Check it</button>
                      {!!(V.delayedLoading) && (<><span style={css(`font-size:12.5px;color:#1F6B64;animation:pulse 1.2s infinite`)}>grading…</span></>)}
                    </div>
                  </>)}
                  {!!(V.delayedGraded) && (<>
                    <div style={css(`display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.5`)}>
                      <div><b>{V.delayedScore}/5</b> unassisted, against <b>{V.delayedActual}/5</b> right after.</div>
                      <div style={css(`color:#514C44`)}>{V.delayedNote}</div>
                      {!!(V.delayedFixLine) && <div style={css(`color:#1F6B64`)}>{V.delayedFixLine}</div>}
                      {!!(V.delayedCanFix) && <button onClick={V.fixDelayed} data-role="fix-delayed" style={css(`align-self:flex-start;background:#2F8F86;border:none;color:#fff;border-radius:9px;padding:7px 13px;font-size:13px`)}>Fix it</button>}
                    </div>
                  </>)}
                </div>
              </>)}

              {!!(m.isOwn) && (
                <button onClick={V.focusPanel} data-role="own-chip" style={css(`align-self:flex-start;display:flex;align-items:center;gap:12px;text-align:left;border:1px solid #F0C9B4;background:#FFF8F3;border-radius:12px;padding:10px 16px 10px 12px`)} className="hv3">
                  <span style={css(`width:34px;height:34px;border-radius:8px;background:#C4613A;color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:18px;flex:none`)}>O</span>
                  <span style={css(`display:flex;flex-direction:column;gap:2px`)}><span style={css(`font-size:14px;color:#1F1D1A`)}>{V.ownEntryLabel} · {V.ownTitle}</span><span style={css(`font-size:12px;color:#8A847A`)}>{V.ownPhaseLabel} · In the side panel</span></span>
                </button>
              )}

            </React.Fragment>))}
          </div>
        </div>

        {!V.isEmpty && (
          <div style={css(`padding:8px 28px 12px;flex:none`)}>
            <div style={css(`max-width:720px;margin:0 auto`)}>{this.renderComposer(V, false)}</div>
          </div>
        )}

        </>)}
        {!!(V.hasSel) && (<>
          <div id="own-sel" style={css(`position:fixed;left:${V.selX};top:${V.selY};transform:translate(-50%,-110%);display:flex;background:#1F1D1A;border-radius:99px;padding:3px;gap:2px;box-shadow:0 4px 14px rgba(0,0,0,.18);z-index:20;animation:rise .15s ease`)}>
            <button onClick={V.askSelection} data-role="ask-sel" title="Quote this into the chat and ask about it" style={css(`background:none;color:#F6F4EF;border:none;border-radius:99px;padding:5px 12px;font-size:13px`)}>Ask Claude</button>
            <span style={css(`width:1px;background:#4A463F;margin:5px 0`)}></span>
            <button id="own-sel-btn" onClick={V.ownSelection} title="Test yourself on this" style={css(`background:none;color:#F6F4EF;border:none;border-radius:99px;padding:5px 12px;font-size:13px`)}>Own it</button>
          </div>
        </>)}
      </main>

      {!!(V.hasOwn && !V.isLearnings) && (
        <aside data-role="own-panel" style={css(`width:46%;min-width:420px;max-width:760px;flex:none;border-left:1px solid #E3DFD6;background:#FBFAF7;display:flex;flex-direction:column;animation:slidein .25s ease`)}>
          <div style={css(`display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:16px 22px;border-bottom:1px solid #EEEAE2`)}>
            <div style={css(`display:flex;align-items:baseline;gap:10px;min-width:0`)}><span style={css(`font-family:Newsreader,serif;font-size:19px;flex:none`)}>Own it</span><span style={css(`font-size:14px;color:#8A847A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{V.ownTitle}</span></div>
            <button onClick={V.leaveOwn} data-role="leave" aria-label="Close, back to chat" title="Close, back to chat" style={css(`background:none;border:none;font-size:18px;line-height:1;color:#716C64;padding:4px 6px;border-radius:6px`)} className="hv4">×</button>
          </div>
          <div ref={V.panelRef} style={css(`flex:1;overflow:auto;padding:20px 22px 28px`)}>
                <div style={css(`display:flex;flex-direction:column;gap:16px`)}>
                  <div style={css(`display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap`)}>
                    <div data-role="stepper" style={css(`display:flex;align-items:center;gap:6px;flex-wrap:wrap`)}>
                      {V.stepper.map((st, i) => <React.Fragment key={i}>{i > 0 && <span style={css(`width:14px;height:1px;background:#D9D4CA`)}></span>}<span style={css(`font-size:11.5px;padding:3px 9px;border-radius:99px;background:${st.cur ? '#C4613A' : st.done ? '#F1E3D8' : 'transparent'};color:${st.cur ? '#fff' : st.done ? '#9E4B2A' : '#9A948A'};border:1px solid ${st.cur ? '#C4613A' : st.done ? '#F1E3D8' : '#E3DFD6'}`)}>{st.done ? '✓ ' : ''}{st.label}</span></React.Fragment>)}
                    </div>
                    {V.ownPhaseLabel.startsWith('Try it · ') && <span style={css(`font-size:12px;color:#8A847A`)}>{V.ownPhaseLabel.slice(9)}</span>}
                  </div>

                  {/* No copy of Claude's text here: the owned part stays highlighted in the chat itself. */}
                  <div style={css(`display:flex;justify-content:flex-end;margin-bottom:-6px`)}><button onClick={V.rereadChat} data-role="reread" style={css(`background:none;border:none;padding:0;font-size:12px;color:#9E4B2A`)}>← {V.ownWhole ? 'Reread it in your chat' : 'See the highlighted part in your chat'}</button></div>

                  {!!(V.phaseFocus) && (<>
                    <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
                      <div style={css(`display:flex;justify-content:space-between;align-items:baseline;gap:12px`)}><div style={css(`font-size:14.5px`)}>What do you want to own here?</div></div>
                      {!!(V.focusLoading) && (<><div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Looking at what you highlighted…</div></>)}
                      <div style={css(`display:flex;flex-direction:column;gap:6px`)}>
                        {V.focusOptions.map((f, _i) => (
                          <button key={_i} onClick={f.onPick} style={css(`text-align:left;background:#fff;border:1px solid #E3C9B8;border-radius:10px;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14px`)} className="hv3">
                            <span>{f.label}</span><span style={css(`font-size:11px;color:#9A948A;flex:none`)}>{f.kind}</span>
                          </button>
                        ))}
                      </div>
                      <div style={css(`display:flex;gap:8px`)}>
                        <input value={V.focusOther} onChange={V.onFocusOther} onKeyDown={V.onFocusOtherKey} placeholder="Something else…" style={css(`flex:1;border:1px solid #E3C9B8;border-radius:8px;padding:9px 12px;font-size:13.5px;background:#fff;outline:none`)} />
                        <button onClick={V.submitFocusOther} style={css(`background:none;border:1px solid #E3C9B8;border-radius:8px;padding:8px 13px;font-size:13px;color:#9E4B2A`)} className="hv4">Use this</button>
                      </div>
                      <div style={css(`font-size:12.5px;color:#8A847A`)}>Your answer decides what you practise and what gets checked at the end.</div>
                    </div>
                  </>)}

                  {!!(V.phasePredict) && (<>
                    <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
                      <div style={css(`display:flex;justify-content:space-between;align-items:baseline;gap:12px`)}><div style={css(`display:flex;flex-direction:column;gap:4px`)}><div style={css(`font-size:12px;color:#9E4B2A`)}>Owning: {V.focusLabel} <button onClick={V.changeFocus} data-role="change-focus" style={css(`background:none;border:none;padding:0;font-size:12px;color:#8A847A;text-decoration:underline;text-underline-offset:2px`)}>change</button></div><div style={css(`font-size:14.5px`)}>{V.predictQuestion}</div>{!!V.predictNext && <div data-role="predict-next" style={css(`font-size:12.5px;color:#716C64`)}>{V.predictNext}</div>}</div><button onClick={V.leaveOwn} style={css(`background:none;border:none;font-size:13px;color:#8A847A;flex:none`)}>Never mind</button></div>
                      <div style={css(`display:flex;gap:6px`)}>
                        {(V.predictOptions || []).map((p, _i) => (<React.Fragment key={_i}>
                          <button onClick={p.onPick} style={css(`flex:1;border:1px solid ${p.border};background:${p.bg};color:${p.fg};border-radius:10px;padding:12px 6px;display:flex;flex-direction:column;gap:3px;align-items:center`)} className="hv3">
                            <span style={css(`font-family:Newsreader,serif;font-size:20px`)}>{p.n}</span><span style={css(`font-size:11px`)}>{p.label}</span>
                          </button>
                        </React.Fragment>))}
                      </div>
                      <div style={css(`font-size:12.5px;color:#8A847A`)}>{V.predictHint}</div>
                    </div>
                  </>)}

                  {!!(V.phaseLadder) && (<>


                    {!!(V.stepSee && V.seeTimeline) && <EffectTimeline code={V.ownCode} onDone={V.goWrite} />}
                    {!!(V.stepSee && !V.seeTimeline) && (<>
                      <div style={css(`display:flex;flex-direction:column;gap:14px`)}>
                        <div style={css(`font-size:14.5px;line-height:1.5`)}>{V.seeIntro}</div>
                        {!!(V.seeLoading) && (<><div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Working out the steps…</div></>)}
                        {!!(V.seeReady) && (<>
                          <div style={css(`display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:16px;align-items:start`)}>
                            <div style={css(`display:flex;flex-direction:column;gap:3px`)}>
                              {(V.seeClauses || []).map((c, _i) => (<React.Fragment key={_i}>
                                <div style={css(`display:flex;gap:10px;align-items:baseline;padding:5px 9px;border-radius:6px;background:${c.bg};color:${c.fg};font-family:'JetBrains Mono',monospace;font-size:12px;white-space:pre-wrap;font-style:${c.italic}`)}><span style={css(`font-size:10px;width:14px;flex:none;opacity:.7`)}>{c.order}</span>{c.text}</div>
                              </React.Fragment>))}
                            </div>
                            <div style={css(`display:flex;flex-direction:column;gap:8px`)}>
                              <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>{V.seeStepKicker}</div>
                              <div style={css(`font-size:13px;font-weight:500;font-family:'JetBrains Mono',monospace;line-height:1.4`)}>{V.seeStepTitle}</div>
                              <div style={css(`font-size:12.5px;color:#514C44;line-height:1.45`)}>{V.seeStepNote}</div>
                              {!!(V.seeHasTable) && (<>
                                <div style={css(`border:1px solid #E3DFD6;border-radius:8px;overflow:hidden;background:#fff`)}>
                                  <div style={css(`display:grid;grid-template-columns:${V.seeCols};font-size:11px;font-weight:600;color:#8A847A;padding:5px 10px;border-bottom:1px solid #EEEAE2;gap:8px`)}>
                                    {(V.seeHeaders || []).map((h, _i) => (<React.Fragment key={_i}><span>{h.t}</span></React.Fragment>))}
                                  </div>
                                  {(V.seeRows || []).map((r, _i) => (<React.Fragment key={_i}>
                                    <div style={css(`display:grid;grid-template-columns:${V.seeCols};font-family:'JetBrains Mono',monospace;font-size:12px;padding:4px 10px;gap:8px;background:${r.bg};color:${r.fg};text-decoration:${r.deco};animation:rise .25s ease`)}>
                                      {(r.cells || []).map((cell, _i) => (<React.Fragment key={_i}><span style={css(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{cell.t}</span></React.Fragment>))}
                                    </div>
                                  </React.Fragment>))}
                                </div>
                                <div style={css(`font-size:11.5px;color:#8A847A`)}>{V.seeRowCount}</div>
                              </>)}
                            </div>
                          </div>
                          <div style={css(`display:flex;gap:8px;align-items:center;justify-content:space-between`)}>
                            <div style={css(`display:flex;gap:6px`)}>
                              <button onClick={V.seePrev} style={css(`background:none;border:1px solid #D9D4CA;border-radius:8px;padding:7px 12px;font-size:13px`)} className="hv6">← Back</button>
                              {!!(V.seeHasNext) && (<><button onClick={V.seeNext} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:8px;padding:7px 14px;font-size:13px`)}>Next step →</button></>)}
                            </div>
                            {!!(V.seeAtEnd) && (<><button onClick={V.goNext} style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>{V.seeNextLabel}</button></>)}
                          </div>
                          {!!(V.hasBridges) && (<>
                            <div style={css(`border-top:1px dashed #E3C9B8;padding-top:10px;display:flex;flex-direction:column;gap:5px`)}>
                              <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9E4B2A`)}>In terms you already know</div>
                              {(V.bridges || []).map((b, _i) => (<React.Fragment key={_i}><div style={css(`font-size:13px;color:#514C44;line-height:1.45`)}>{b.t}</div></React.Fragment>))}
                            </div>
                          </>)}
                        </>)}
                      </div>
                    </>)}

                    {!!(V.stepAsm) && (<>
                      <div style={css(`display:flex;flex-direction:column;gap:14px`)}>
                        <div style={css(`font-size:14.5px;line-height:1.5`)}>A warm-up, not scored: the pieces, shuffled. Tap them into your version in the order they're written.{V.asmHasDecoy ? ' One piece doesn\'t belong.' : ''}</div>
                        <div style={css(`display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start`)}>
                          <div style={css(`display:flex;flex-direction:column;gap:6px`)}>
                            <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>Pieces</div>
                            {(V.asmBank || []).map((p, _i) => (<React.Fragment key={_i}>
                              <button onClick={p.onClick} style={css(`text-align:left;background:#fff;border:1px solid #E3DFD6;border-radius:7px;padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:12px;white-space:pre-wrap`)} className="hv7">{p.text}</button>
                            </React.Fragment>))}
                            {!!(V.asmBankEmpty) && (<><div style={css(`font-size:12px;color:#9A948A;padding:6px 0`)}>All pieces placed.</div></>)}
                          </div>
                          <div style={css(`display:flex;flex-direction:column;gap:6px;min-height:120px;border:1px dashed #E3C9B8;border-radius:8px;padding:10px`)}>
                            <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9E4B2A`)}>Your version</div>
                            {(V.asmSeq || []).map((p, _i) => (<React.Fragment key={_i}>
                              <div style={css(`display:flex;gap:6px;align-items:stretch`)}>
                                <button onClick={p.onClick} style={css(`flex:1;text-align:left;background:${p.bg};border:1px solid ${p.border};border-radius:7px;padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:12px;white-space:pre-wrap`)} className="hv8">{p.text}</button>
                                <button onClick={p.up} style={css(`background:none;border:1px solid #E3DFD6;border-radius:6px;padding:0 7px;font-size:11px;color:#8A847A`)}>↑</button>
                                <button onClick={p.down} style={css(`background:none;border:1px solid #E3DFD6;border-radius:6px;padding:0 7px;font-size:11px;color:#8A847A`)}>↓</button>
                              </div>
                            </React.Fragment>))}
                          </div>
                        </div>
                        {!!(V.asmFeedback) && (<>
                          <div style={css(`border-left:2px solid #C4613A;padding:4px 12px;font-size:13.5px;line-height:1.5;color:#5A3A2A;background:#FFF1E8;border-radius:0 8px 8px 0`)}>{V.asmFeedbackText}</div>
                        </>)}
                        {!!(V.asmNotCorrect) && (<>
                          <div style={css(`display:flex;gap:8px;align-items:center`)}>
                            <button onClick={V.checkAsm} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Check order</button>
                            <button onClick={V.goSee} style={css(`background:none;border:none;font-size:13px;color:#8A847A`)}>Watch it run again</button>
                            {!!(V.asmLoading) && (<><span style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>checking…</span></>)}
                          </div>
                        </>)}
                        {!!(V.asmCorrect) && (<>
                          <div style={css(`display:flex;flex-direction:column;gap:10px`)}>
                            <label style={css(`font-size:14px`)}>{V.asmWhyPrompt}</label>
                            <input value={V.asmWhy} onChange={V.onAsmWhy} placeholder="Your words, one line" style={css(`border:1px solid #E3C9B8;border-radius:8px;padding:10px 12px;font-size:14px;background:#fff;outline:none`)} />
                            <button onClick={V.goWrite} style={css(`align-self:flex-start;background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Now write one yourself →</button>
                          </div>
                        </>)}
                      </div>
                    </>)}

                    {!!(V.stepCompare) && (<>
                      <div style={css(`display:flex;flex-direction:column;gap:14px`)}>
                        {!!(V.conceptLoading) && <div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Working out the core idea…</div>}
                        {!!(V.hasConcept) && (
                          <div data-role="refresher-card" style={css(`display:flex;flex-direction:column;gap:10px`)}>
                            <button onClick={V.toggleRefresher} style={css(`align-self:flex-start;background:none;border:none;padding:0;font-size:12.5px;color:#9E4B2A`)}>{V.refresherOpen ? '▾' : '▸'} Refresher: the idea in one card</button>
                            {!!(V.refresherOpen) && (<>
                          <div style={css(`display:flex;flex-direction:column;gap:14px;background:#fff;border:1px solid #EFE4DA;border-radius:10px;padding:16px 18px`)}>
                            <div style={css(`font-family:Newsreader,serif;font-size:19px;line-height:1.35;letter-spacing:-.005em`)}>{V.conceptModel}</div>
                            {!!(V.conceptGrid) && (<>
                              <div style={css(`border:1px solid #E3DFD6;border-radius:8px;overflow:hidden`)}>
                                <div style={css(`display:grid;grid-template-columns:${V.conceptGrid.cols};gap:10px;padding:7px 12px;background:#F9F7F2;border-bottom:1px solid #EEEAE2;font-size:11px;font-weight:600;color:#8A847A;letter-spacing:.03em`)}>
                                  {V.conceptGrid.headers.map((h, j) => <span key={j}>{h.t}</span>)}
                                </div>
                                {V.conceptGrid.rows.map((r, i) => (
                                  <div key={i} style={css(`display:grid;grid-template-columns:${V.conceptGrid.cols};gap:10px;padding:8px 12px;border-top:${i ? '1px solid #F1EDE5' : 'none'};font-size:13px;line-height:1.4;align-items:baseline`)}>
                                    {r.cells.map((c, j) => <span key={j} style={css(`font-family:${c.first ? "'JetBrains Mono',monospace" : 'inherit'};font-size:${c.first ? '12px' : '13px'};font-weight:${c.strong ? 600 : 400};color:${c.strong ? '#1F6B64' : '#1F1D1A'}`)}>{c.t}</span>)}
                                  </div>
                                ))}
                              </div>
                            </>)}
                            {!!(V.conceptInYourCode) && (<>
                              <div style={css(`display:flex;flex-direction:column;gap:3px`)}>
                                <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9E4B2A`)}>{V.conceptInLabel}</div>
                                <div style={css(`font-size:14px;line-height:1.5`)}>{V.conceptInYourCode}</div>
                              </div>
                            </>)}
                            {!!(V.conceptRule) && (<>
                              <div style={css(`display:flex;flex-direction:column;gap:3px`)}>
                                <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9E4B2A`)}>Rule of thumb</div>
                                <div style={css(`font-size:14px;line-height:1.5`)}>{V.conceptRule}</div>
                              </div>
                            </>)}
                          </div>
                            </>)}
                          </div>
                        )}
                        <div style={css(`font-size:14.5px;line-height:1.5`)}>{V.cmpIntro}</div>
                        {!!(V.cmpLoading) && (<><div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Building the comparison…</div></>)}
                        {!!(V.cmpHasSource) && (<>
                          <div style={css(`display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:12px;align-items:start`)}>
                            {V.cmpSource.map((t, _i) => (
                              <div key={_i} style={css(`display:flex;flex-direction:column;gap:4px`)}>
                                <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>{t.name}</div>
                                <CompareTable t={t} />
                              </div>
                            ))}
                          </div>
                        </>)}
                        {!!(V.cmpHasCases) && (<>
                          <div style={css(`display:flex;gap:6px;flex-wrap:wrap`)}>
                            {V.cmpTabs.map((tb, _i) => (
                              <button key={_i} onClick={tb.onClick} style={css(`font-family:'JetBrains Mono',monospace;font-size:12px;padding:6px 11px;border-radius:99px;border:none;background:${tb.bg};color:${tb.fg}`)} className="hv5">{tb.label}</button>
                            ))}
                          </div>
                          <pre style={css(`margin:0;padding:10px 14px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12.5px;line-height:1.55;white-space:pre-wrap`)}>{V.cmpCode}</pre>
                          {!!(V.cmpHidden && V.cmpIsTable) && (<>
                            <div style={css(`display:flex;flex-direction:column;gap:8px`)}>
                              <div style={css(`font-size:14px`)}>How many rows come back?</div>
                              <div style={css(`display:flex;gap:6px`)}>
                                {V.cmpGuessOptions.map((g, _i) => (
                                  <button key={_i} onClick={g.onPick} style={css(`flex:1;border:1px solid #E3C9B8;background:#fff;border-radius:9px;padding:9px 0;font-family:Newsreader,serif;font-size:18px`)} className="hv3">{g.n}</button>
                                ))}
                              </div>
                            </div>
                          </>)}
                          {!!(V.cmpHidden && V.cmpIsPick) && (<>
                            <div style={css(`display:flex;flex-direction:column;gap:8px`)}>
                              <div style={css(`font-size:14px`)}>{V.cmpAsk}</div>
                              <div style={css(`display:flex;gap:6px`)}>
                                {V.cmpPickOptions.map((g, _i) => (
                                  <button key={_i} onClick={g.onPick} style={css(`flex:1;border:1px solid #E3C9B8;background:#fff;border-radius:9px;padding:9px 0;font-family:Newsreader,serif;font-size:17px`)} className="hv3">{g.l}</button>
                                ))}
                              </div>
                            </div>
                          </>)}
                          {!!(V.cmpHidden && !V.cmpIsTable && !V.cmpIsPick) && (<>
                            <div style={css(`display:flex;gap:8px`)}>
                              <input value={V.cmpGuessText} onChange={V.onCmpGuessText} placeholder="What do you think happens? (optional)" style={css(`flex:1;border:1px solid #E3C9B8;border-radius:8px;padding:9px 12px;font-size:13.5px;background:#fff;outline:none`)} />
                              <button onClick={V.cmpRevealText} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:8px;padding:8px 13px;font-size:13px`)}>Show me</button>
                            </div>
                          </>)}
                          {!!(V.cmpShown) && (<>
                            <div style={css(`display:flex;flex-direction:column;gap:8px;animation:rise .25s ease`)}>
                              {!!(V.cmpResultLine) && (<><div style={css(`font-size:13.5px;font-weight:500`)}>{V.cmpResultLine}</div></>)}
                              {!!(V.cmpTable) && (<><CompareTable t={V.cmpTable} /></>)}
                              {!!(V.cmpDiagram) && <OwnDiagram d={V.cmpDiagram} />}
                              {!!(V.cmpPatterns) && (<>
                                <div data-role="patterns" style={css(`display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:4px`)}>
                                  {V.cmpPatterns.map((p, _i) => <span key={_i} style={css(`font-family:'JetBrains Mono',monospace;font-size:12px;text-align:center;padding:4px 0;border-radius:5px;background:${p.miss ? '#FBE9E1' : '#E2F1EE'};color:${p.miss ? '#9E4B2A' : '#1F6B64'};font-weight:${p.miss ? 600 : 400}`)}>{p.p}</span>)}
                                </div>
                                <div style={css(`font-size:12px;color:#8A847A`)}>{V.cmpPatternLine}</div>
                              </>)}
                              {!!(V.cmpOutcome) && (<><div style={css(`font-size:13.5px;line-height:1.5`)}><b>What happens:</b> {V.cmpOutcome}</div></>)}
                              <div style={css(`border-left:2px solid #C4613A;padding:4px 12px;font-size:13.5px;line-height:1.5;color:#5A3A2A;background:#FFF1E8;border-radius:0 8px 8px 0`)}>{V.cmpNote}</div>
                              {!!(V.cmpHasNextCase) && (<><button onClick={V.cmpNextCase} style={css(`align-self:flex-start;background:none;border:1px solid #D9D4CA;border-radius:8px;padding:7px 12px;font-size:13px`)} className="hv6">Next case →</button></>)}
                            </div>
                          </>)}
                        </>)}
                        {!!(V.cmpAllSeen) && (<><button onClick={V.goNext} style={css(`align-self:flex-start;background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>{V.cmpNextLabel}</button></>)}
                      </div>
                    </>)}

                    {!!(V.stepWrite) && (<>
                      <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
                        <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9E4B2A`)}>{V.writeFixing ? `Fixing it · try ${V.writeTry}` : 'Your turn'}</div>
                        {!!(V.writeFixing) && <div style={css(`font-size:13px;color:#514C44;background:#F4F1EA;border-radius:8px;padding:7px 11px;line-height:1.45`)}><b style={css(`color:#9E4B2A`)}>What to fix:</b> {V.writeLastGap}</div>}
                        {!!(V.writeLoading) && (<><div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Picking a variant for you…</div></>)}
                        <div style={css(`font-size:15px;line-height:1.5`)}>{V.writeTask}</div>
                        {V.writeRefresher.length > 0 && (
                          <div data-role="refresher" style={css(`font-size:12.5px;color:#8A847A;display:flex;gap:8px;align-items:center;flex-wrap:wrap`)}>
                            <span>{V.writeRefresher.length > 1 ? 'Want a warm-up first?' : V.writeRefresher[0].label === 'See it visually' ? 'Want a picture of it first?' : 'Want a warm-up first?'}</span>
                            {V.writeRefresher.map((r, i) => <button key={i} onClick={r.onClick} style={css(`background:none;border:none;padding:0;font-size:12.5px;color:#9E4B2A;text-decoration:underline;text-underline-offset:2px`)}>{r.label}</button>)}
                          </div>
                        )}
                        {!!(V.hasWriteSchema) && (<>
                          <div style={css(`display:flex;flex-direction:column;gap:4px`)}>
                            <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>What you have to work with</div>
                            <pre style={css(`margin:0;padding:9px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.55;white-space:pre-wrap;color:#514C44`)}>{V.writeSchema}</pre>
                          </div>
                        </>)}
                        {!!(V.writeBefore) && (<><pre style={css(`margin:0;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;color:#8A847A;background:#F4F1EA;border-radius:8px`)}>{V.writeBefore}</pre></>)}
                        {!!(V.writeIsChoice) && <ChoiceQuestions qs={V.writeQs} picked={V.writePicked} onPick={V.onWritePick} />}
                        {!V.writeIsChoice && <textarea data-role="write" value={V.writeText} onChange={V.onWriteText} placeholder={V.writePlaceholder} style={css(`width:100%;min-height:${V.writeBefore ? '72px' : '120px'};resize:vertical;border:1px solid #E3C9B8;border-radius:8px;padding:10px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;background:#fff;outline:none;line-height:1.55`)}></textarea>}
                        {!!(V.writeAfter) && (<><pre style={css(`margin:0;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;color:#8A847A;background:#F4F1EA;border-radius:8px`)}>{V.writeAfter}</pre></>)}
                        {!!(V.hasHints) && (<>
                          <div style={css(`display:flex;flex-direction:column;gap:5px`)}>
                            {(V.hints || []).map((h, _i) => (<React.Fragment key={_i}><div style={css(`font-size:13px;color:#514C44;line-height:1.45;display:flex;gap:8px`)}><span style={css(`color:#9E4B2A;flex:none`)}>Hint {h.n}</span><span>{h.t}</span></div></React.Fragment>))}
                          </div>
                        </>)}
                        {!!(V.writeNotGraded) && (<>
                          <div style={css(`display:flex;gap:8px;align-items:center;flex-wrap:wrap`)}>
                            <button onClick={V.submitWrite} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Check my version</button>
                            <button onClick={V.askHint} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)} className="hv6">Give me a hint</button>
                            <button onClick={V.askAboutIt} data-role="ask-stuck" style={css(`background:none;border:none;font-size:13px;color:#9E4B2A`)}>Stuck? Ask Claude in the chat</button>
                            {!!(V.gradeLoading) && (<><span style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>{V.gradeLoadingText}</span></>)}
                          </div>
                        </>)}
                      </div>
                    </>)}


                  </>)}

                  {!!(V.phaseReveal) && (<>
                    <div style={css(`display:flex;flex-direction:column;gap:18px`)}>
                      <div style={css(`font-family:Newsreader,serif;font-size:22px;line-height:1.25;letter-spacing:-.01em`)}>{V.revealHeadline}</div>
                      <div style={css(`position:relative;padding:28px 0 8px`)}>
                        <div style={css(`position:absolute;left:7%;right:7%;top:46px;height:2px;background:#E3DFD6`)}></div>
                        <div style={css(`display:grid;grid-template-columns:${V.revealCols};position:relative`)}>
                          {(V.revealNodes || []).map((n, _i) => (<React.Fragment key={_i}>
                            <div style={css(`display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:0 6px`)}>
                              <div style={css(`height:18px;font-size:11px;color:#9E4B2A;font-weight:600;white-space:nowrap`)}>{n.above}</div>
                              <div style={css(`width:20px;height:20px;border-radius:50%;background:${n.dotBg};border:2px solid ${n.dotBorder};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff`)}>{n.mark}</div>
                              <div style={css(`font-size:12.5px;font-weight:500;color:${n.fg}`)}>{n.label}</div>
                              <div style={css(`font-size:12px;color:#716C64;line-height:1.4`)}>{n.detail}</div>
                            </div>
                          </React.Fragment>))}
                        </div>
                      </div>
                      <div style={css(`display:flex;flex-direction:column;gap:8px;border-top:1px solid #EFE4DA;padding-top:14px`)}>
                        <div style={css(`display:flex;justify-content:space-between;font-size:11px;color:#8A847A`)}><span>1 · couldn't</span><span>5 · easily</span></div>
                        <div style={css(`position:relative;height:36px`)}>
                          <div style={css(`position:absolute;left:0;right:0;top:17px;height:2px;background:#E3DFD6`)}></div>
                          <div style={css(`position:absolute;top:11px;height:14px;width:14px;border-radius:50%;background:#C4613A;left:${V.predLeft};transform:translateX(-50%)`)}></div>
                          <div style={css(`position:absolute;top:11px;height:14px;width:14px;border-radius:50%;background:#2F8F86;left:${V.actLeft};transform:translateX(-50%);animation:rise .5s ease`)}></div>
                          <div style={css(`position:absolute;top:17px;height:2px;background:#9A948A;left:${V.gapLeft};width:${V.gapWidth};transform-origin:left;animation:grow .6s ease`)}></div>
                        </div>
                        <div style={css(`display:flex;gap:16px;font-size:12.5px`)}><span style={css(`color:#9E4B2A`)}>● Predicted {V.ownPredictionN}/5</span><span style={css(`color:#1F6B64`)}>● Actual {V.actualN}/5</span></div>
                      </div>
                      <div style={css(`font-size:14.5px;line-height:1.55`)}>{V.revealLine}</div>
                      <div data-role="saved-line" style={css(`display:flex;gap:8px;align-items:center;font-size:13px;color:#1F6B64`)}><span style={css(`width:6px;height:6px;border-radius:50%;background:#2F8F86`)}></span>Saved to Learnings. It comes back for a quick recall in 3 days.</div>
                      {!!(V.revealFixLine) && <div data-role="fix-line" style={css(`font-size:13.5px;line-height:1.5;color:#1F6B64;background:#E2F1EE;border-radius:8px;padding:7px 11px`)}>{V.revealFixLine}</div>}
                      <div title={V.revealScale} style={css(`font-size:14px;line-height:1.5;font-weight:500`)}>{V.revealWhy}</div>
                      {!!(V.revealCorrection) && (<><div style={css(`font-size:13px;line-height:1.5;color:#514C44;background:#F4F1EA;border-radius:8px;padding:7px 11px`)}>{V.revealCorrection}</div></>)}
                      {!!(V.hasGap) && (<><div style={css(`font-size:13.5px;line-height:1.5;color:#514C44`)}><b style={css(`color:#9E4B2A`)}>What to fix:</b> {V.gradeGap}</div></>)}
                      {V.revealTables.length > 0 && (
                        <div style={css(`display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:start`)}>
                          {V.revealTables.map((t, i) => (
                            <div key={i} style={css(`display:flex;flex-direction:column;gap:4px`)}>
                              <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>{t.title}</div>
                              {t.empty ? <div style={css(`font-size:12.5px;color:#8A847A;padding:6px 0`)}>No rows.</div> : <CompareTable t={t} />}
                              {!!t.legend && <div style={css(`font-size:11.5px;color:#8A847A`)}>{t.legend}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      {(V.revealNotes.length > 0 || V.notesLoading) && (
                        <div data-role="notes" style={css(`display:flex;flex-direction:column;gap:8px;border-top:1px solid #EFE4DA;padding-top:12px`)}>
                          <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>On your version</div>
                          {V.revealNotes.map((n, i) => (
                            <div key={i} style={css(`display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:#514C44`)}>
                              <span style={css(`flex:none;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:2px;background:${n.kind === 'nice' ? '#DDEFEC' : '#FBE9E1'};color:${n.kind === 'nice' ? '#1F6B64' : '#9E4B2A'}`)}>{n.kind === 'nice' ? '✓' : '→'}</span>
                              <span>{!!n.quote && <code style={css(`font-family:'JetBrains Mono',monospace;font-size:12px;background:#F4F1EA;border-radius:5px;padding:1px 6px;margin-right:6px;color:#1F1D1A`)}>{n.quote}</code>}{n.text}</span>
                            </div>
                          ))}
                          {!!V.notesLoading && <div style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Reading how you wrote it…</div>}
                        </div>
                      )}
                      <div style={css(`display:flex;gap:8px;align-items:center;flex-wrap:wrap`)}>
 {!!(V.revealVisual) && <button onClick={V.revealVisual} style={css(`background:none;border:none;font-size:13px;color:#8A847A`)}>See it visually</button>}
                        {!!(V.canFix) && <button onClick={V.askAboutIt} data-role="ask-claude" style={css(`background:none;border:1px solid #E3C9B8;border-radius:9px;padding:8px 13px;font-size:13px;color:#9E4B2A`)} className="hv4">Ask Claude about this</button>}
                        {!!(V.canFix) && <button onClick={V.fixWrite} data-role="fix" style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Fix it</button>}
                        <button onClick={V.finishOwn} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Back to chat</button>
                        <button onClick={V.goTeach} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)} className="hv6">Optional: explain it to Sam</button>
                        <span style={css(`font-size:12px;color:#9A948A`)}>Sam is a beginner. Teaching closes the gap faster than rereading.</span>
                      </div>
                    </div>
                  </>)}

                  {!!(V.phaseTeach) && (<>
                    <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
                      <div style={css(`font-size:13px;color:#716C64`)}>Sam has never touched this. Explain in your own words; Sam will ask what doesn't make sense.</div>
                      <div style={css(`display:flex;flex-direction:column;gap:10px;background:#F4F1EA;border-radius:10px;padding:12px`)}>
                        {(V.teachMsgs || []).map((t, _i) => (<React.Fragment key={_i}>
                          <div style={css(`display:flex;gap:10px;align-items:flex-start;align-self:${t.align};max-width:88%`)}>
                            {!!(t.isSam) && (<><span style={css(`width:26px;height:26px;border-radius:50%;background:#5B7F3C;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;flex:none;font-family:Newsreader,serif`)}>S</span></>)}
                            <div style={css(`font-size:14px;line-height:1.5;background:${t.bg};padding:8px 12px;border-radius:10px;white-space:pre-wrap`)}>{t.text}</div>
                          </div>
                        </React.Fragment>))}
                        {!!(V.teachLoading) && (<><div style={css(`font-size:12.5px;color:#5B7F3C;animation:pulse 1.2s infinite`)}>Sam is thinking…</div></>)}
                      </div>
                      {!!(V.teachOpen) && (<>
                        <div style={css(`display:flex;gap:8px`)}>
                          <input value={V.teachInput} onChange={V.onTeachInput} onKeyDown={V.onTeachKey} placeholder="Explain it to Sam…" style={css(`flex:1;border:1px solid #D9D4CA;border-radius:8px;padding:10px 12px;font-size:14px;background:#fff;outline:none`)} />
                          <button onClick={V.sendTeach} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:8px;padding:9px 14px;font-size:13.5px`)}>Send</button>
                        </div>
                      </>)}
                      {!!(V.teachDebriefLoading) && <div style={css(`font-size:12.5px;color:#5B7F3C;animation:pulse 1.2s infinite`)}>Looking back at how you explained it…</div>}
                      {!!(V.teachDebrief) && (
                        <div data-role="teach-debrief" style={css(`display:flex;flex-direction:column;gap:10px;border:1px solid #E3DFD6;background:#fff;border-radius:12px;padding:14px 16px;animation:rise .3s ease`)}>
                          <div style={css(`font-family:Newsreader,serif;font-size:19px`)}>What teaching Sam showed</div>
                          {V.teachDebrief.clear.map((c, i) => (
                            <div key={'c' + i} style={css(`display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:#514C44`)}>
                              <span style={css(`flex:none;width:18px;height:18px;border-radius:50%;background:#DDEFEC;color:#1F6B64;display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:2px`)}>✓</span>
                              <span><b style={css(`color:#1F6B64`)}>You explained clearly:</b> <i>“{c.quote}”</i> {c.text}</span>
                            </div>
                          ))}
                          {V.teachDebrief.unsure.map((u, i) => (
                            <div key={'u' + i} data-role="teach-gap" style={css(`display:flex;flex-direction:column;gap:8px;background:#FFF5EE;border:1px solid #F0D5C4;border-radius:10px;padding:10px 12px`)}>
                              <div style={css(`display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:#514C44`)}>
                                <span style={css(`flex:none;width:18px;height:18px;border-radius:50%;background:#FBE9E1;color:#9E4B2A;display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:2px`)}>?</span>
                                <span><b style={css(`color:#9E4B2A`)}>You weren't sure:</b> Sam asked <i>“{u.question}”</i> and you said <i>“{u.quote}”</i></span>
                              </div>
                              <div style={css(`font-size:13px;color:#5A3A2A;padding-left:28px`)}>That's a gap you didn't know you had: <b>{u.topic}</b>.</div>
                              <div style={css(`display:flex;gap:8px;padding-left:28px;flex-wrap:wrap`)}>
                                <button onClick={() => V.exploreTeachGap(u)} style={css(`background:#C4613A;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12.5px`)}>Explore this gap with Claude</button>
                                {V.gapTopics.includes(u.topic)
                                  ? <span style={css(`font-size:12.5px;color:#1F6B64;align-self:center`)}>✓ Saved to Learnings & insights</span>
                                  : <button onClick={() => V.saveTeachGap(u)} style={css(`background:none;border:1px solid #E3C9B8;border-radius:8px;padding:6px 12px;font-size:12.5px;color:#9E4B2A`)} className="hv4">Save for later</button>}
                              </div>
                            </div>
                          ))}
                          {V.teachDebrief.unsure.length === 0 && <div style={css(`font-size:13px;color:#1F6B64`)}>No shaky spots: you answered every question Sam asked. Explaining it is the strongest sign you own it.</div>}
                        </div>
                      )}
                      <div style={css(`display:flex;gap:8px`)}>{!!(V.canWrap) && <button onClick={V.wrapTeach} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)} className="hv6">I'm done explaining</button>}<button onClick={V.finishOwn} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)}>Done, back to chat</button></div>
                    </div>
                  </>)}

                </div>
          </div>
        </aside>
      )}
      </div>
      </>
    );
  }

  renderLearnings(V) {
    const L = V.learn;
    const tone = { pred: 'background:#FFE9DC;color:#9E4B2A', act: 'background:#DDEFEC;color:#1F6B64', mute: 'background:#F1EEE8;color:#514C44', next: 'background:transparent;color:#716C64;border:1px dashed #C9C3B8' };
    const Step = ({ st }) => <span style={css(`display:inline-flex;flex-direction:column;gap:2px;padding:6px 10px;border-radius:9px;${tone[st.tone]}`)}><span style={css(`font-size:10.5px;opacity:.8`)}>{st.label}</span><span style={css(`font-size:13px`)}>{st.v}</span></span>;
    const card = `background:#FBFAF7;border:1px solid #E3DFD6;border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px`;
    const link = `background:none;border:1px solid #E3C9B8;border-radius:8px;padding:6px 11px;font-size:12.5px;color:#9E4B2A`;
    const SAMPLE = [
      { title: 'Regex lookaheads: matching without consuming', from: 'Validate a password field', steps: [{ label: 'Predicted', v: '4/5', tone: 'pred' }, { label: 'First try', v: '2/5', tone: 'act' }, { label: 'Fixed', v: '5/5', tone: 'mute' }, { label: '3 days later', v: '3/5', tone: 'act' }] },
      { title: 'groupby vs pivot_table in pandas', from: 'Weekly signups by channel', steps: [{ label: 'Predicted', v: '3/5', tone: 'pred' }, { label: 'First try', v: '4/5', tone: 'act' }, { label: 'Real work', v: 'went first, 5/5', tone: 'act' }, { label: 'Real work', v: 'let Claude answer', tone: 'mute' }] },
      { title: 'Why a P/E ratio can mislead', from: 'Reading an earnings report', steps: [{ label: 'Predicted', v: '4/5', tone: 'pred' }, { label: 'First try', v: '3/5', tone: 'act' }, { label: '3 days later', v: '4/5', tone: 'act' }] },
    ];
    return (
      <div data-role="learnings" style={css(`flex:1;overflow:auto;padding:40px 28px 48px`)}>
        <div style={css(`max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:26px`)}>
          <div style={css(`display:flex;flex-direction:column;gap:6px`)}>
            <h1 style={css(`font-family:Newsreader,serif;font-weight:400;font-size:34px;margin:0`)}>Learnings &amp; insights</h1>
            <div style={css(`font-size:14.5px;color:#716C64`)}>What you chose to own, how your predictions compared, and what stuck.</div>
            <div style={css(`display:flex;gap:10px;align-items:center;font-size:12px;color:#9A948A`)}>
              <button onClick={L.skipAhead} data-role="skip-ahead" style={css(`background:none;border:1px dashed #C9C3B8;border-radius:7px;padding:4px 9px;font-size:12px;color:#514C44`)} className="hv2">⏩ Skip ahead 3 days</button>
              <span>demo control{L.shifted ? ` · it's ${L.shiftDays} days later` : ''}</span>
            </div>
          </div>
          <div style={css(`display:grid;grid-template-columns:repeat(4,1fr);gap:10px`)}>
            {L.stats.map((st, i) => <div key={i} style={css(`background:#FBFAF7;border:1px solid #E3DFD6;border-radius:12px;padding:12px 14px`)}><div style={css(`font-family:Newsreader,serif;font-size:26px`)}>{st.n}</div><div style={css(`font-size:12px;color:#716C64`)}>{st.label}</div></div>)}
          </div>
          {!!V.hasCalibration && <div style={css(`font-size:14px;color:#514C44;background:#F4F1EA;border-radius:10px;padding:10px 14px`)}>{V.calibrationText}</div>}

          {L.askedAbout.length > 0 && (
            <section data-role="asked-about" style={css(`display:flex;flex-direction:column;gap:10px`)}>
              <div style={css(`display:flex;gap:8px;align-items:baseline`)}><div style={css(`font-size:13px;font-weight:600;color:#514C44`)}>You asked about</div><div style={css(`font-size:12px;color:#9A948A`)}>things you asked Claude to explain. Own one to check it landed.</div></div>
              {L.askedAbout.map(a => (
                <div key={a.id} style={css(card + `;flex-direction:row;justify-content:space-between;align-items:center;gap:14px`)}>
                  <div style={css(`display:flex;flex-direction:column;gap:3px;min-width:0`)}><div style={css(`font-size:14.5px`)}>{a.label || 'Naming it…'}</div><div style={css(`font-size:12.5px;color:#8A847A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>asked {a.when} in “{a.chatTitle}”{a.quote ? ` · “${a.quote.slice(0, 70)}${a.quote.length > 70 ? '…' : ''}”` : ''}</div></div>
                  <button onClick={a.onCheck} style={css(link + ';flex:none')} className="hv4">Own it</button>
                </div>
              ))}
            </section>
          )}

          {L.openGaps.length > 0 && (
            <section data-role="open-gaps" style={css(`display:flex;flex-direction:column;gap:10px`)}>
              <div style={css(`display:flex;gap:8px;align-items:baseline`)}><div style={css(`font-size:13px;font-weight:600;color:#9E4B2A`)}>Open gaps</div><div style={css(`font-size:12px;color:#9A948A`)}>things you found you don't know yet. Explore one with Claude, then check yourself to close it.</div></div>
              {L.openGaps.map(g => (
                <div key={g.id} data-role="open-gap" style={css(card + `;border-color:#F0D5C4`)}>
                  <div style={css(`display:flex;justify-content:space-between;gap:12px;align-items:baseline`)}><div style={css(`font-size:15.5px;font-weight:500`)}>{g.topic}</div><div style={css(`font-size:12px;color:#9A948A;flex:none`)}>found {g.when}</div></div>
                  <div style={css(`font-size:13px;color:#716C64;line-height:1.5`)}>It came up {g.origin}.{g.quote ? <> You said <i>“{g.quote}”</i></> : null}</div>
                  <button onClick={g.onExplore} style={css(`align-self:flex-start;background:#C4613A;color:#fff;border:none;border-radius:9px;padding:8px 14px;font-size:13.5px`)}>Explore it with Claude</button>
                </div>
              ))}
            </section>
          )}

          {L.dueItems.length > 0 && (
            <section data-role="due" style={css(`display:flex;flex-direction:column;gap:10px`)}>
              <div style={css(`display:flex;gap:8px;align-items:baseline`)}><div style={css(`font-size:13px;font-weight:600;color:#9E4B2A`)}>Ready to recall</div><div style={css(`font-size:12px;color:#9A948A`)}>a quick check from memory, no looking back</div></div>
              {L.dueItems.map(it => (
                <div key={it.id} data-role="due-item" style={css(card + `;border-color:#F0C9B4;background:#FFFBF8`)}>
                  <div style={css(`display:flex;justify-content:space-between;gap:12px;align-items:baseline`)}><div style={css(`font-size:15.5px;font-weight:500`)}>{it.title}</div><div style={css(`font-size:12px;color:#9A948A;flex:none`)}>{it.owned} · from {it.from}</div></div>
                  <div style={css(`display:flex;gap:6px;flex-wrap:wrap;align-items:center`)}>{it.steps.map((st, j) => <React.Fragment key={j}>{j > 0 && <span style={css(`color:#C9C3B8`)}>→</span>}<Step st={st} /></React.Fragment>)}</div>
                  {!it.recall && <button onClick={it.onRecall} style={css(`align-self:flex-start;background:#C4613A;color:#fff;border:none;border-radius:9px;padding:8px 14px;font-size:13.5px`)}>Recall now · about a minute</button>}
                  {!!it.recall && this.renderRecall(it, L)}
                </div>
              ))}
            </section>
          )}

          <section style={css(`display:flex;flex-direction:column;gap:10px`)}>
            {(L.laterItems.length > 0 || L.empty) && <div style={css(`font-size:13px;font-weight:600;color:#514C44`)}>Owning</div>}
            {L.empty && <div style={css(`font-size:14px;color:#7D776D;line-height:1.5`)}>Nothing yet. Use the <span style={css(`color:#C4613A`)}>Own it</span> icon under any answer, or open a past chat in the sidebar and own what you learned there.</div>}
            {L.laterItems.map((it, i) => (
              <div key={i} data-role="learning" style={css(card)}>
                <div style={css(`display:flex;justify-content:space-between;gap:12px;align-items:baseline`)}><div style={css(`font-size:15.5px;font-weight:500`)}>{it.title}</div><div style={css(`font-size:12px;color:#9A948A;flex:none`)}>{it.owned ? it.owned + ' · ' : ''}from {it.from}</div></div>
                <div style={css(`display:flex;gap:6px;flex-wrap:wrap;align-items:center`)}>{it.steps.map((st, j) => <React.Fragment key={j}>{j > 0 && <span style={css(`color:#C9C3B8`)}>→</span>}<Step st={st} /></React.Fragment>)}</div>
                <div style={css(`display:flex;gap:8px;flex-wrap:wrap`)}>
                  {!!it.recall && this.renderRecall(it, L)}
                  {!!it.onNew && <button onClick={it.onNew} style={css(link)} className="hv4">Try a new question · {it.newLabel.split(' · ')[1]}</button>}
                </div>
              </div>
            ))}
          </section>

          {L.exits.length > 0 && (
            <section style={css(`display:flex;flex-direction:column;gap:10px`)}>
              <div style={css(`font-size:13px;font-weight:600;color:#514C44`)}>You wanted to learn, then stepped away</div>
              {L.exits.map((x, i) => (
                <div key={i} style={css(card + `;flex-direction:row;justify-content:space-between;align-items:center`)}>
                  <div style={css(`display:flex;flex-direction:column;gap:3px`)}><div style={css(`font-size:14.5px`)}>{x.title}</div><div style={css(`font-size:12.5px;color:#8A847A`)}>predicted {x.predicted}/5 · left at {x.step} ({x.stepOf})</div></div>
                  {!!x.onReopen && <button onClick={x.onReopen} style={css(link)} className="hv4">Pick it back up</button>}
                </div>
              ))}
            </section>
          )}

          <section style={css(`display:flex;flex-direction:column;gap:10px;opacity:.75`)}>
            <div style={css(`display:flex;gap:8px;align-items:baseline`)}><div style={css(`font-size:13px;font-weight:600;color:#514C44`)}>Earlier</div><div style={css(`font-size:11.5px;color:#9A948A`)}>sample history, mocked to show what a few weeks of use looks like</div></div>
            {SAMPLE.map((it, i) => (
              <div key={i} style={css(card)}>
                <div style={css(`display:flex;justify-content:space-between;gap:12px;align-items:baseline`)}><div style={css(`font-size:15px`)}>{it.title}</div><div style={css(`font-size:12px;color:#9A948A;flex:none`)}>from {it.from}</div></div>
                <div style={css(`display:flex;gap:6px;flex-wrap:wrap;align-items:center`)}>{it.steps.map((st, j) => <React.Fragment key={j}>{j > 0 && <span style={css(`color:#C9C3B8`)}>→</span>}<Step st={st} /></React.Fragment>)}</div>
              </div>
            ))}
            <div style={css(`font-size:13px;color:#716C64`)}>Over these weeks, your predictions went from 1.4 points above your results to 0.3. You're getting better at knowing what you know.</div>
          </section>
        </div>
      </div>
    );
  }

  // The recall check, inline on its Learnings card: from memory, then "then vs now", then when it comes back.
  renderRecall(it, L) {
    const r = it.recall, choice = r.check && r.check.type === 'choice';
    return (
      <div data-role="recall" style={css(`display:flex;flex-direction:column;gap:10px;border-top:1px dashed #E3C9B8;padding-top:12px`)}>
        <div style={css(`font-size:14.5px;line-height:1.5`)}>{r.task || 'Preparing a question…'}</div>
        {!!r.schema && <pre style={css(`margin:0;padding:8px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;white-space:pre-wrap;color:#514C44`)}>{r.schema}</pre>}
        {!!r.before && <pre style={css(`margin:0;padding:8px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;color:#8A847A`)}>{r.before}</pre>}
        {choice ? <ChoiceQuestions qs={r.check.questions} picked={r.picked} onPick={L.onRecallPick} locked={!!r.grade} />
          : <textarea data-role="recall-text" value={r.text} onChange={L.onRecallText} readOnly={!!r.grade} placeholder={r.placeholder || 'From memory. No looking back.'} style={css(`width:100%;min-height:72px;resize:vertical;border:1px solid #E3C9B8;border-radius:8px;padding:10px 12px;font-family:${r.lang === 'sql' ? "'JetBrains Mono',monospace" : 'inherit'};font-size:13.5px;background:#fff;outline:none`)}></textarea>}
        {!!r.after && <pre style={css(`margin:0;padding:8px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;color:#8A847A`)}>{r.after}</pre>}
        {!r.grade && <div style={css(`display:flex;gap:8px;align-items:center`)}><button onClick={L.submitRecall} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:9px;padding:8px 14px;font-size:13.5px`)}>Check it</button><button onClick={L.closeRecall} style={css(`background:none;border:none;font-size:13px;color:#8A847A`)}>Not now</button>{!!r.loading && <span style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>checking…</span>}</div>}
        {!!r.grade && (
          <div data-role="recall-result" style={css(`display:flex;flex-direction:column;gap:6px`)}>
            <div style={css(`font-family:Newsreader,serif;font-size:19px`)}>{r.gapMode ? (r.grade.score >= 5 ? 'Still closed.' : 'It slipped a little.') : <>{it.then} → today: {r.grade.score}/5</>}</div>
            <div style={css(`font-size:13.5px;color:#514C44;line-height:1.5`)}>{r.grade.note}</div>
            <div style={css(`font-size:13px;color:${r.grade.score >= 5 ? '#1F6B64' : '#9E4B2A'}`)}>{r.grade.score >= 5 ? 'It stuck. ' : "Not quite yet, so it'll come back sooner. "}{it.next ? it.next.replace('next recall', 'Next recall') + '.' : ''}</div>
            <div style={css(`display:flex;gap:8px;flex-wrap:wrap`)}>
              {r.grade.score < 5 && !L.gapTopics.includes(it.title) && <button onClick={L.exploreRecallGap} style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;padding:6px 12px;font-size:12.5px`)}>Explore this gap with Claude</button>}
              {r.grade.score < 5 && !L.gapTopics.includes(it.title) && <button onClick={L.saveRecallGap} style={css(`background:none;border:1px solid #E3C9B8;border-radius:9px;padding:6px 12px;font-size:12.5px;color:#9E4B2A`)} className="hv4">Save as a gap</button>}
              {r.grade.score < 5 && L.gapTopics.includes(it.title) && <span style={css(`font-size:12.5px;color:#1F6B64;align-self:center`)}>✓ Saved as an open gap</span>}
              <button onClick={L.closeRecall} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:6px 12px;font-size:12.5px;color:#514C44`)}>Done</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // The composer, in the middle of the home screen or at the bottom of a chat.
  renderComposer(V, home) {
    return (
      <div style={css(`width:100%`)}>
        <div style={css(`background:#fff;border:1px solid ${V.composerBorder};border-radius:16px;padding:12px 12px 10px 16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 2px 10px rgba(0,0,0,.035)`)}>
          <textarea ref={this.composerRef} value={V.composer} onChange={V.onComposer} onKeyDown={V.onComposerKey} placeholder={home ? 'How can I help you today?' : V.composerPlaceholder} rows="1" style={css(`border:none;background:none;resize:none;font-size:15px;line-height:1.5;outline:none;min-height:26px;max-height:160px;font-family:inherit`)}></textarea>
          <div style={css(`display:flex;align-items:center;gap:8px`)}>
            <button aria-disabled="true" title="Not in this prototype" style={css(`width:30px;height:30px;border:1px solid #E3DFD6;border-radius:8px;background:none;color:#514C44;font-size:16px;cursor:default`)}>+</button>
            <span style={css(`flex:1`)}></span>
            {home && <span style={css(`font-size:13px;color:#1F1D1A`)}>Opus 5.5 <span style={css(`color:#8A847A`)}>Prototype</span></span>}
            <button aria-disabled="true" title="Not in this prototype" style={css(`background:none;border:none;color:#716C64;font-size:15px;cursor:default;display:flex`)}><MicIcon /></button>
            <button onClick={V.send} aria-label="Send" style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;width:32px;height:32px;font-size:16px;flex:none`)} className="hv9">↑</button>
          </div>
        </div>
        {!home && <div style={css(`text-align:center;font-size:12px;color:#9A948A;padding-top:8px`)}>Claude is AI and can make mistakes. Please double-check responses.</div>}
      </div>
    );
  }
}
