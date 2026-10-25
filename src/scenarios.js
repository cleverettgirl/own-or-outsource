// The prepared starters (recorded and replayed chats) and the starter questions nobody prepared targets for.
// Scenarios are compared by identity and saved by name (SCENARIOS), so each is one shared object.
import { SQL_TARGETS } from './targets.js';
import { BOOK_TARGETS } from './bookTargets.js';
import { JUNO_TARGETS } from './junoTargets.js';
import { REACT_TARGETS } from './reactTargets.js';

// The leadership starter: a question nobody prepared targets for, so it shows the generated path (spec-leadership-fixes.md).
// It asks about disagreeing and names Roger Martin among the authors to draw on (until 2026-10-25 it
// also quoted his "what would have to be true?", log 85). That's the person's question, not app logic about leadership.
export const LEAD_QUESTION = "I'm not a manager, but I want to grow as a leader on my team. What does leading without a title actually look like day to day, including how to disagree with a plan without just criticizing it? Draw on Brené Brown, Adam Grant, Simon Sinek, or Roger Martin where it's relevant.";
// The risk starter: a real health headline (WHO/IARC 2015: 50g of processed meat a day, +18% bowel cancer risk), asked
// the way a person would. Relative vs absolute risk is what the answer has to teach; owning a calculation in it gets a
// generated "work it out" try (log 63).
export const RISK_QUESTION = 'I just saw a headline saying that eating 50g of processed meat a day, about two slices of bacon, raises your risk of bowel cancer by 18%. Should I stop eating meat?';
// Two more topics nobody prepared targets for (§13): a parenting strategy and marginal vs effective tax rate. Each question
// reports something the person believes or already tried, so the answer corrects them and there's a move to own.
// Tried and cut: reading development (advice, nothing to own) and a coach who yells (not how a parent would ask).
// Only the person's question is written here; the try is generated.
export const PARK_QUESTION = "My 6-year-old melts down every time we have to leave the park, and when I explain why we have to go it just gets worse. I've been reading The Whole-Brain Child. How do I actually use 'connect and redirect' in the moment?";
export const TAX_QUESTION = 'I just got a raise that moves me into a higher tax bracket. Will I actually take home less?';
// Names userId, as the recorded component and its walkthrough do (asked with "id", live answers used `id`).
export const REACT_LIVE_QUESTION = 'How do I fetch a user by userId in a React component when it mounts, and refetch when userId changes?';

// Every hand-written learning target, by id. Ids are unique across starters.
export const TARGETS = { ...SQL_TARGETS, ...BOOK_TARGETS, ...JUNO_TARGETS, ...REACT_TARGETS };
// React's lesson is when things run (reactTargets.js), so anything about the effect owns that.
export const REACT_TIMING = { label: REACT_TARGETS.timing.label, mode: 'sequence', target: 'timing' };
export const isReactTiming = text => /useEffect|\.abort\(|cleanup|new AbortController|\[userId\]|return \(\) =>|dependency array|rerun|race condition/i.test(text);

export const SQL = {
  title: 'Revenue per customer, LEFT JOIN',
  lang: 'sql',
  schema: "authors(id, name)\nbooks(id, author_id, pages, status)   -- status is 'published' or 'draft'",
  writeRequirements: ['Every author appears, even with no published books', 'An empty total shows 0, not NULL', 'Only published pages count', 'Most pages first'],
  writeTask: 'Now write a new one from scratch, same shape, different data: total pages per author from published books, most pages first. Authors with no published books should still appear with 0.',
  writeRef: "SELECT a.name, COALESCE(SUM(b.pages), 0) AS pages\nFROM authors a\nLEFT JOIN books b ON b.author_id = a.id\n  AND b.status = 'published'\nGROUP BY a.name\nORDER BY pages DESC;",
  delayedTask: 'From memory: the names of customers who have no paid orders at all.',
  delayedRef: "SELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\n  AND o.status = 'paid'\nWHERE o.id IS NULL;"
};
export const REACT = {
  title: 'Fetch a user with useEffect',
  lang: 'jsx',
  schema: "Props: { slug }\nEndpoint: GET /api/posts/:slug → { title, ... }\nAvailable: useState, useEffect, fetch",
  writeRequirements: ['Holds the post in state and shows it', 'Fetches in an effect that re-runs when slug changes', 'Stops an old response from overwriting a newer one', 'Cleans up on unmount'],
  writeTask: 'Now write a new one from scratch, same shape, different data: a PostTitle component that fetches a post by slug on mount, refetches when slug changes, and ignores stale responses.',
  writeRef: "function PostTitle({ slug }) {\n  const [post, setPost] = useState(null);\n  useEffect(() => {\n    const controller = new AbortController();\n    fetch(`/api/posts/${slug}`, { signal: controller.signal })\n      .then(r => r.json())\n      .then(setPost)\n      .catch(err => { if (err.name !== 'AbortError') throw err; });\n    return () => controller.abort();\n  }, [slug]);\n  if (!post) return <p>Loading…</p>;\n  return <h2>{post.title}</h2>;\n}",
  delayedTask: 'From memory: a component that subscribes to window resize on mount and unsubscribes on unmount, storing the width in state.',
  delayedRef: "function Width() {\n  const [w, setW] = useState(window.innerWidth);\n  useEffect(() => {\n    const on = () => setW(window.innerWidth);\n    window.addEventListener('resize', on);\n    return () => window.removeEventListener('resize', on);\n  }, []);\n  return <span>{w}</span>;\n}"
};
// A study-buddy chat about a book: Christine's real transcript (bookTranscript.js), replayed.
export const BOOK = {
  title: 'How to Measure Anything · Rule of Five',
  prose: true,
  lang: 'statistics',
  samOpen: "Hey! I've never done statistics. Isn't the median always between the smallest and the biggest number? Why is that a rule?",
  samLines: ["Ok, so there are two medians? Which one can I actually see?", "Wait, why does it matter if all of them land on one side? How would that even happen?", "Ok I think I get it: my numbers always surround their own middle, but the real middle is hidden, and I only miss it if I'm unlucky and all my picks are on one side. Thanks!"],
};
// Christine's real meeting-prep chat on aggregation theory (junoTranscript.js); the company renamed to Juno.
export const JUNO = {
  title: 'Juno · aggregation theory',
  prose: true,
  lang: 'strategy',
  samOpen: "Hi! I don't know much about business. If Juno has writers and readers, wouldn't it want both of them to love it? Why pick one?",
  samLines: ["Ohh, so no single writer is a big deal. But if writers know they're replaceable, why would the really good ones stick around on Juno?", "Ooh, a loop! But how does it get started? On day one there are no readers or writers, so what makes the first ones show up?", "Ok, so I think I get it: Juno wants readers loyal to Juno itself, and readers and writers keep pulling each other in. How that loop starts on day one is still a mystery to both of us, though. Thanks!"],
};

export const SCENARIOS = { SQL, REACT, BOOK, JUNO };
export const scKey = sc => Object.keys(SCENARIOS).find(k => SCENARIOS[k] === sc) || null;
