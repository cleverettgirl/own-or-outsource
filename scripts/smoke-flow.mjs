// Headless end-to-end run of the SQL starter in jsdom, with the API unreachable,
// so every Claude call takes its offline fallback. Run: node scripts/smoke-flow.mjs
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.getSelection = dom.window.getSelection.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.fetch = async () => {
  throw new Error('offline (smoke test)');
};
globalThis.__SQL_WASM_PATH = new URL(
  '../node_modules/sql.js/dist/sql-wasm.wasm',
  import.meta.url,
).pathname;

const errors = [];
const origError = console.error;
console.error = (...a) => {
  errors.push(a.map(String).join(' '));
};

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = React;

const wait = ms => act(() => new Promise(r => setTimeout(r, ms)));
const text = () => document.body.textContent;
// What Learnings has recorded (the cards show only recall and Sam; the history is in saved progress, log 115).
const savedLedger = () =>
  JSON.parse(window.localStorage.getItem('own-it:v1') || '{}').ledger || [];
const ownTitle = () =>
  document.querySelector('[data-role=own-title]')?.textContent || '';
const buttons = () => [...document.querySelectorAll('button')];
async function click(label) {
  // Exact label first ("4" must not hit "step 3 of 4"), then any button containing it.
  const b =
    buttons().find(b => b.textContent.trim() === label) ||
    buttons().find(b => b.textContent.trim().includes(label));
  if (!b)
    throw new Error(
      `No button containing "${label}". Buttons: ${buttons()
        .map(b => b.textContent.trim())
        .join(' | ')}`,
    );
  await act(async () => {
    b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await wait(30);
}
// The prediction is "how many of N will you get right?": one button per count.
async function predict(k) {
  const b = document.querySelector(`[data-role=predict-option][data-n="${k}"]`);
  if (!b) throw new Error(`No prediction button for ${k}`);
  await act(async () => {
    b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  // Pick, then lock it in (design 2a): nothing starts until you confirm.
  const lock = document.querySelector('[data-role=predict-lock]');
  if (!lock || lock.disabled || !lock.textContent.includes(`Lock in ${k}`))
    throw new Error(
      `Lock-in button not ready for ${k}: ${lock && lock.textContent}`,
    );
  await act(async () => {
    lock.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await wait(30);
}
async function type(el, value) {
  const proto =
    el.tagName === 'TEXTAREA'
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
async function ownAll(i = -1) {
  const all = [...document.querySelectorAll('button[data-role=own-all]')];
  const b = all.at(i);
  if (!b) throw new Error('No own-all icon');
  await act(async () => {
    b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await wait(30);
}
async function openLearnings() {
  await act(async () => {
    document
      .querySelector('button[data-role=nav-learnings]')
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await wait(30);
}
function step(name, ok, detail = '') {
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`,
  );
  if (!ok) process.exitCode = 1;
}

const root = createRoot(document.getElementById('root'));
await act(async () => root.render(React.createElement(App)));
step(
  'home: greeting, composer without an upfront toggle, typed starters as chips',
  text().includes('Back at it') &&
    !buttons().some(b =>
      /Learn this too|Just the answer/.test(b.textContent),
    ) &&
    buttons().some(b => b.textContent === 'SQL · revenue per customer'),
);
step(
  'home: seeded chats are past chats in the sidebar',
  document.querySelectorAll('[data-role=past-chat]').length === 2,
);
step(
  'recall: an item from a few days ago is ready, shown on Learnings',
  document
    .querySelector('[data-role=recall-badge]')
    ?.getAttribute('aria-label') === '1 to recall',
);

step(
  'home: the quick starts are prompts: leadership, SQL, React, risk, parenting, tax; Juno is a past chat',
  [
    'Leadership · leading without a title',
    'SQL · revenue per customer',
    'React · fetch on mount',
    'Health · a bacon and cancer headline',
    'Parenting · a meltdown leaving the park',
    'Money · a raise into a higher tax bracket',
  ].every(l => buttons().some(b => b.textContent === l)) &&
    !buttons().some(b => /Start here/.test(b.textContent)),
);
await click('SQL · revenue per customer');
await wait(50);
step(
  'a quick start sends its prompt as your message; offline, the saved answer stands in, labelled',
  text().includes('Write me a SQL query for revenue per customer') &&
    text().includes("this is Claude's saved answer to the same question"),
);
step(
  "SQL starter is Claude's real answer, rendered as Claude renders it",
  text().includes('The key detail is putting the') &&
    text().includes('GROUP BY c.id, c.name') &&
    text().includes('Tie-breaking:') &&
    !!document.querySelector('main ul'),
);

step(
  'one-time tip on the first answer explains how to own',
  !!document.querySelector('[data-role=own-tip]') &&
    text().includes('Want to actually learn part of this?'),
);
step(
  'own-all is an icon with a tooltip, no text',
  (() => {
    const b = document.querySelector('button[data-role=own-all]');
    return (
      b &&
      !b.textContent.trim() &&
      b.getAttribute('aria-label') === 'Own the whole query'
    );
  })(),
);
await ownAll();
step(
  'owning a whole answer asks what to own, hand-written targets first',
  text().includes('What do you want to own here?') &&
    text().includes('The whole query') &&
    text().includes('When to use LEFT vs INNER'),
);
step(
  'tip goes away once you own something',
  !document.querySelector('[data-role=own-tip]'),
);
step(
  "panel: no copy of Claude's text; the whole reply is marked as being owned in the chat",
  document.querySelectorAll('[data-msg-id][data-owning=whole]').length === 1 &&
    !document.querySelector('[data-role=own-panel] pre') &&
    text().includes('Reread it in your chat'),
);
step(
  'panel: Own it opens on the side, chat stays visible, chip marks it',
  !!document.querySelector('[data-role=own-panel]') &&
    !!document.querySelector('[data-role=own-chip]') &&
    !!document.querySelector('main pre'),
);
await click('The whole query');
step(
  'predict: "no idea where to start?" offers Claude walking you through it first',
  !!document.querySelector('[data-role=ask-first-predict]') &&
    /Not sure\? Reread .+, or have Claude walk you through it first in the chat\./.test(
      document.querySelector('[data-role=predict-hint]').textContent,
    ) &&
    !document.querySelector('[data-role=no-idea]'),
);
step(
  'predict: the try is shown with what it is checked on, named without giving answers away',
  ownTitle().includes('The whole query') &&
    !!document.querySelector('[data-role=predict-try]') &&
    text().includes('total pages per author') &&
    [...document.querySelectorAll('[data-role=predict-topics] li')]
      .map(li => li.textContent)
      .join(' | ') ===
      'who appears | what an empty total shows | which pages count | the sort order' &&
    !text().includes('even Cal') &&
    text().includes('How many of the 4 will you get right on your own?') &&
    text().includes("Under half? You'll start with a quick warm-up.") &&
    document.querySelectorAll('[data-role=predict-option]').length === 5,
);
await act(async () => {
  document
    .querySelector('button[data-role=change-focus]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(50);
step(
  '"change" reopens the focus question',
  text().includes('What do you want to own here?') &&
    text().includes('When to use LEFT vs INNER'),
);
await click('The whole query');

await predict(0); // 0 of 4 on a focus where the written order is the insight → Arrange warm-up first
await wait(50);
step(
  'framework: whole query + low prediction → Arrange warm-up first, with the decoy',
  text().includes('A warm-up, not scored') &&
    text().includes('warming up with the pieces') &&
    buttons().some(b => b.textContent.trim() === "WHERE o.status = 'paid'"),
);
await click("WHERE o.status = 'paid'");
await click('Check order');
await wait(50);
step('arrange: the decoy gets feedback', text().includes("NULL = 'paid'"));
await click("WHERE o.status = 'paid'"); // take it back out
for (const line of [
  'SELECT c.id, c.name, COALESCE(SUM(o.total), 0) AS revenue',
  'FROM customers c',
  'LEFT JOIN orders o ON o.customer_id = c.id',
  "AND o.status = 'paid'",
  'GROUP BY c.id, c.name',
  'ORDER BY revenue DESC;',
])
  await click(line);
await click('Check order');
step(
  "arrange: the lines of Claude's real query, in order",
  text().includes("why does status = 'paid' live in ON rather than WHERE?"),
);
await click('Now write one yourself');
await wait(50);
step(
  'then the try, the only part that is measured',
  text().includes('total pages per author') &&
    !!document.querySelector('textarea[data-role=write]'),
);
step(
  "the warm-up stays an optional link; no visual in the panel (a different explanation is the chat's job)",
  !!document.querySelector('[data-role=refresher]') &&
    !text().includes('See it visually') &&
    text().includes('Warm up with the pieces'),
);
step(
  'reread points back to the chat',
  !!document.querySelector('button[data-role=reread]'),
);
await click('Stuck? Ask Claude in the chat');
step(
  'stuck: the chat composer gets your try as context, and the question is left to you',
  (() => {
    const v = document.querySelector('main textarea')?.value || '';
    return (
      v.startsWith('About my try on') &&
      v.includes('total pages per author') &&
      !/stuck|Can you|nudge/i.test(v) &&
      v.endsWith('\n\n')
    );
  })(),
);
await act(async () => {
  const el = document.querySelector('main textarea');
  const set = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  set.call(el, '');
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
await click('Give me a hint');
await wait(50);
step('write it: hint (fallback)', text().includes('Hint 1'));
const attempt =
  "SELECT a.name, COALESCE(SUM(b.pages), 0) AS pages\nFROM autors a\nLEFT JOIN books b ON b.author_id = a.id AND b.status = 'published'\nGROUP BY a.name\nORDER BY pages DESC;";
await type(document.querySelector('textarea[data-role=write]'), attempt);
await click('Check my version');
await wait(400);
step(
  'whole query: executed, correct answer gets 4 of 4',
  text().includes('You got 4') &&
    text().includes('exactly the right 4 rows') &&
    document.querySelectorAll('[data-role=items] > div').length === 4,
);
step(
  'typo forgiven with a note',
  text().includes('Read “autors” as “authors”. Typos don'),
);
step(
  'reveal shows predicted vs actual, in the same units',
  text().includes('You said 0 of 4') &&
    text().includes('You said 0 of 4, and got 4'),
);
step(
  'ledger got an entry',
  text().includes("The whole query: each part and why it's in that order") &&
    text().includes('You said 0 of 4'),
);
step(
  'reveal: says it was saved and when it comes back',
  !!document.querySelector('[data-role=saved-line]') &&
    text().includes('It comes back for a quick recall in 3 days'),
);
await click('See it in Learnings →');
step(
  'see it in Learnings: the panel gives way to Learnings, the new item marked on the map and its card',
  !!document.querySelector('[data-role=learnings]') &&
    !!document.querySelector('[data-role=just-owned]') &&
    !!document.querySelector('[data-just-owned]'),
);
await click('← Back to your try');
step(
  'back from Learnings: the chat again, with the panel still on the reveal you left',
  !document.querySelector('[data-role=learnings]') &&
    !!document.querySelector('[data-role=saved-line]'),
);
step(
  'on your version: notes on how you wrote it, quoting your query',
  !!document.querySelector('[data-role=notes]') &&
    text().includes('Grouping by name alone would merge two people') &&
    text().includes('COALESCE turns the NULL') &&
    !text().includes('Reading how you wrote it'),
);

await click('Optional: explain it to Sam');
step('teach: Sam opens', text().includes("I've never done this before"));
await type(
  document.querySelector('input[placeholder^="Explain it to Sam"]'),
  'It totals paid orders per customer and keeps customers with none.',
);
await click('Send');
await wait(50);
step(
  'teach: Sam replies (fallback)',
  document.querySelectorAll('span').length > 0 && text().includes('Hm ok'),
);
await click('Done, back to chat');
step(
  'own card collapses to summary',
  text().includes('Owned') && text().includes('taught Sam'),
);

// ---- Second run: highlight only the LEFT JOIN line (the case that used to land on a 2-piece Assemble).
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
const sel = 'LEFT JOIN orders o ON o.customer_id = c.id';
const realGetSelection = window.getSelection;
// A real selection inside the answer, let go outside it (past the edge, or back over the margin from a line break).
{
  const body = document.querySelector('main [data-answer-body]');
  const walker = document.createTreeWalker(
    body,
    dom.window.NodeFilter.SHOW_TEXT,
  );
  let node;
  while ((node = walker.nextNode()) && !node.textContent.includes('LEFT JOIN'));
  const range = document.createRange();
  const at = node.textContent.indexOf('LEFT JOIN');
  range.setStart(node, at);
  range.setEnd(node, at + 9);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  await act(async () => {
    document.querySelector('main').dispatchEvent(
      new dom.window.MouseEvent('mouseup', {
        bubbles: true,
        clientX: 900,
        clientY: 100,
      }),
    );
  });
  step(
    'highlight: letting go outside the answer still offers the popover',
    !!document.querySelector('#own-sel-btn'),
  );
  await act(async () => {
    document.body.dispatchEvent(
      new dom.window.MouseEvent('mousedown', { bubbles: true }),
    );
    window.getSelection().removeAllRanges();
  });
}
window.getSelection = () => ({ toString: () => sel, removeAllRanges() {} });
await act(async () => {
  document.querySelector('main [data-msg-id] > div').dispatchEvent(
    new dom.window.MouseEvent('mouseup', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );
});
await click('Own it');
window.getSelection = realGetSelection;
step(
  'panel: owning a highlight marks that part in the chat, no copy in the panel',
  document.querySelectorAll('[data-msg-id][data-owning=part]').length === 1 &&
    text().includes('See the highlighted part in your chat'),
);
step(
  'fragment: focus offers concept options first',
  text().includes('What do you want to own here?') &&
    buttons().findIndex(b => b.textContent.includes('LEFT vs INNER')) <
      buttons().findIndex(b => b.textContent.includes('goes in ON')),
);
await click('When to use LEFT vs INNER');
await predict(0);
await wait(50);
step(
  'fragment: straight to the try, no visual in the panel',
  text().includes("list every order with its customer's name") &&
    !text().includes('See it visually'),
);
step(
  'fragment write: transfer task with scaffold',
  text().includes('list every order with its customer') &&
    document.querySelector('pre') &&
    text().includes('SELECT o.id, o.total, c.name'),
);
await click('Give me a hint');
step(
  'fragment write: authored hint',
  text().includes('This time, which table has to keep every one of its rows?'),
);
// The classic mistake: copy "customers first" from the original query.
await type(
  document.querySelector('textarea[data-role=write]'),
  'FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id',
);
await click('Check my version');
await wait(400);
step(
  'fragment write: copy mistake diagnosed, 0 of 2, the owned idea named',
  text().includes('You got 0') &&
    text().includes('this time every order has to stay') &&
    text().includes('the idea you came to own'),
);
step(
  'reveal explains the result and how it was checked',
  text().includes(
    "It runs, but the rows it returns aren't the ones the task asks for.",
  ) && !!document.querySelector('[title^="Checked by running your query"]'),
);
step(
  'reveal: your answer is there to look back at, as written',
  document.querySelector('[data-role=your-answer] summary')?.textContent ===
    'Your answer' &&
    document
      .querySelector('[data-role=your-answer] div')
      ?.textContent.includes('LEFT JOIN'),
);
step(
  'reveal shows your rows vs expected, marked',
  text().includes('What yours returns') &&
    text().includes('What it should return') &&
    text().includes('highlighted rows: yours is missing them'),
);
step(
  'fragment: ledger names the focus',
  text().includes('When to use LEFT vs INNER vs RIGHT JOIN'),
);
step(
  'own icon stays visible, shown active while its panel is open',
  (() => {
    const bs = [...document.querySelectorAll('button[data-role=own-all]')];
    return bs.length > 0 && bs.at(-1).getAttribute('aria-pressed') === 'true';
  })(),
);
await click('Ask Claude about this');
step(
  'reveal: "Ask Claude about this" prefills a chat follow-up with your attempt and the gap',
  (() => {
    const v = document.querySelector('main textarea')?.value || '';
    return (
      v.includes('> My answer: ') &&
      v.includes('FROM customers c') &&
      v.includes('> The check said: ') &&
      v.includes('every order has to stay') &&
      !/Can you help|Don't just give/.test(v)
    );
  })(),
);
await click('↑'); // send it: it goes to the chat, not the panel
await wait(50);
step(
  'the follow-up lands in the chat while the panel stays open',
  [...document.querySelectorAll('main div')].some(d =>
    d.textContent.startsWith('About my try on'),
  ) && !!document.querySelector('[data-role=own-panel]'),
);
// Fix it: back to your own attempt, as you left it; the first try stays the measurement.
await click('Fix it');
const kept = document.querySelector('textarea[data-role=write]');
step(
  'fix: your attempt is still there to edit',
  kept &&
    kept.value ===
      'FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id' &&
    text().includes('Fixing it · try 2') &&
    text().includes('What to fix:'),
);
await type(
  kept,
  'FROM orders o\nLEFT JOIN customers c ON c.id = o.customer_id',
);
await click('Check my version');
await wait(400);
step(
  'fix: the reveal shows try 2 (its ✓ list, no ✗), and only the prediction is compared with try 1, in one quiet line',
  text().includes('Try 2: 2 of 2, all there.') &&
    !document.querySelector('[data-role=items]')?.textContent.includes('✗') &&
    document
      .querySelector('[data-role=reveal-line]')
      ?.textContent.includes('compared with your first try (0 of 2)') &&
    !text().includes('You got 0') &&
    !buttons().some(b => b.textContent === 'Fix it'),
);
await click('Back to chat');

// ---- You go first: a new question that needs what you owned. Claude offers you the first try.
await click('New chat');
step(
  'sidebar has no ledger; home has no go-first chips (Learnings holds it all)',
  !text().includes('what you chose to own') &&
    !text().includes('New questions that use what you own'),
);
await openLearnings();
step(
  'learnings: a fix is recorded next to the first try',
  savedLedger().some(e => e.fixed === 2 && e.n === 2),
);
// Owned here: LEFT vs INNER vs RIGHT, so the new question is its own: which table's unmatched rows survive, the
// SELECT written for you, and only that idea checked (log 112). No counting: that's the whole query's question.
await click('every customer and their orders');
step(
  'go first: Claude offers the first try instead of answering',
  !!document.querySelector('[data-role=go-first]') &&
    text().includes("Want to answer it yourself first? I'll check yours") &&
    !text().includes('Customers go on the left'),
);
await click("I'll go first");
const panel = () => document.querySelector('[data-role=go-panel]'),
  inMain = sel => !!document.querySelector('main ' + sel);
step(
  'go first: the try opens in the side panel; the chat points to it and keeps the offer',
  !!panel() &&
    !!panel().querySelector('[data-role=go-topics]') &&
    !inMain('[data-role=go-topics]') &&
    !!document.querySelector('main [data-role=go-pointer]') &&
    panel().textContent.includes('orders whose customer isn'),
);
step(
  'go first: before predicting, it shows what the try is checked on: only the idea you own',
  [...document.querySelectorAll('[data-role=go-topics] li')]
    .map(li => li.textContent)
    .join(' | ') === 'which customers appear | which orders appear' &&
    text().includes('How many of the 2 will you get right on your own?') &&
    !text().includes('This one needs it'),
);
await act(async () => {
  panel()
    .querySelector('[data-role=go-predict][data-n="2"]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30); // predicted 2 of 2
step(
  'go first: you write your answer in the panel, not in the chat, with the SELECT written for you',
  !!panel().querySelector('textarea[data-role=go-text]') &&
    !inMain('textarea[data-role=go-text]') &&
    panel().textContent.includes('SELECT c.name, o.id') &&
    panel().textContent.includes('The SELECT is written for you'),
);
await click('Back to chat');
step(
  'go first: closing the panel mid-try leaves a way back in the chat',
  !panel() && !!document.querySelector('main [data-role=go-open]'),
);
await click('Open it');
await type(
  document.querySelector('textarea[data-role=go-text]'),
  'FROM customers c\nJOIN orders o ON o.customer_id = c.id',
);
await click('Check mine');
await wait(400);
step(
  'go first: checked by running it with the SELECT around it; the INNER JOIN slip is explained',
  text().includes('You said 2 of 2 and got 1.') &&
    text().includes('an INNER JOIN drops her'),
);
step(
  "go first: the result is in the panel; Claude's answer appears in the chat",
  !!panel().querySelector('[data-role=go-result]') &&
    !inMain('[data-role=go-result]') &&
    (document.querySelector('main')?.textContent || '').includes(
      'Customers go on the left',
    ),
);
await act(async () => {
  panel()
    .querySelector('[data-role=ask-claude]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
step(
  'go first: "Ask Claude about this" puts the question, your answer and what the check said in the chat box; the question is yours',
  (() => {
    const v = document.querySelector('main textarea')?.value || '';
    return (
      v.startsWith('About my go:') &&
      v.includes('> Question: Write me a SQL query') &&
      v.includes('> My answer: SELECT c.name, o.id') &&
      v.includes('JOIN orders o ON o.customer_id = c.id') &&
      v.includes('> The check said: ') &&
      v.endsWith('\n\n') &&
      !!panel()
    );
  })(),
);
await act(async () => {
  const el = document.querySelector('main textarea');
  const set = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  set.call(el, '');
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
// A query that doesn't run, with Claude out of reach: nothing could be checked, so nothing is scored.
await openLearnings();
await click('every customer and their orders');
await click("I'll go first");
await act(async () => {
  panel()
    .querySelector('[data-role=go-predict][data-n="2"]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
await type(
  document.querySelector('textarea[data-role=go-text]'),
  'FROM customers c LEFT JOIN orders o o.customer_id = c.id',
);
await click('Check mine');
await wait(400);
step(
  "go first: a query that doesn't run (and no Claude to judge it) isn't scored as wrong",
  panel().textContent.includes('nothing was scored') &&
    !panel().textContent.includes('You said 2 of 2 and got 0'),
);
await openLearnings();
step(
  'go first: Learnings records it as real work',
  savedLedger().some(e =>
    (e.realWork || []).some(r => !r.outsourced && r.actual === 1 && r.n === 2),
  ),
);

// ---- Third run: leave halfway. "Back to chat" must be on every screen of the card.
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
window.getSelection = () => ({ toString: () => sel, removeAllRanges() {} });
await act(async () => {
  document.querySelector('main [data-msg-id] > div').dispatchEvent(
    new dom.window.MouseEvent('mouseup', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );
});
await click('Own it');
window.getSelection = realGetSelection;
step(
  'leave: exit offered on focus screen',
  !!document.querySelector('button[data-role=leave]'),
);
await click('When to use LEFT vs INNER');
await predict(0);
step(
  'leave: exit offered mid-ladder',
  !!document.querySelector('button[data-role=leave]'),
);
await act(async () => {
  document
    .querySelector('button[data-role=leave]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
step(
  'leave: card closes, chat notes where you stopped',
  !document.querySelector('button[data-role=leave]') &&
    text().includes('Outsourced') &&
    text().includes('stopped at Write it'),
);
await openLearnings();
step(
  'leave: the exit is kept as data, not scored',
  (
    JSON.parse(window.localStorage.getItem('own-it:v1') || '{}').exits || []
  ).some(x => x.step === 'Write it' && x.predicted === 0),
);

// ---- Fourth run: a part with no hand-written target (ORDER BY) must get options about itself.
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
window.getSelection = () => ({
  toString: () => 'ORDER BY revenue DESC;',
  removeAllRanges() {},
});
await act(async () => {
  document.querySelector('main [data-msg-id] > div').dispatchEvent(
    new dom.window.MouseEvent('mouseup', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );
});
await click('Own it');
window.getSelection = realGetSelection;
await wait(100);
const focusLabels = buttons()
  .map(b => b.textContent.trim())
  .filter(t => /concept|structure$/.test(t));
step(
  'unmatched part: options name it, no unrelated join options',
  focusLabels[0]?.includes('ORDER BY revenue DESC') &&
    !focusLabels.some(t => /JOIN|ON, not WHERE/.test(t)),
  focusLabels.join(' | '),
);
await click('What ORDER BY');
await wait(50);
step(
  'unmatched part: the prediction shows the try it fits (explain, not "write code")',
  text().includes('Will you get it right on your own?') &&
    text().includes('Your answer is checked for 1 key idea.'),
);
await predict(0);
await wait(200);
step(
  'unmatched part: straight to the try (no hand-written visual for it)',
  !!document.querySelector('button[data-role=leave]') &&
    !!document.querySelector('textarea[data-role=write]') &&
    !text().includes('See it visually'),
);

// ---- Fifth run: the book starter. Same framework, no code: calculated check, no Assemble.
await click('New chat');
await click('Rule of Five');
await wait(50);
step(
  'book: replays the real transcript, both turns',
  text().includes('Are you familiar with the book') &&
    text().includes(
      'a median is always in between the smallest and largest values no?',
    ) &&
    text().includes('The Rule of Five is about the population’s true median'),
);
step(
  'book: each answer rendered once',
  document.querySelectorAll('main [data-msg-id]').length === 2 &&
    (text().match(/Core ideas:/g) || []).length === 1,
);
step(
  'book: every answer has the own icon',
  document.querySelectorAll('button[data-role=own-all]').length === 2,
);
// A part of the first answer that isn't about the Rule of Five must not get Rule of Five options.
window.getSelection = () => ({
  toString: () =>
    'calibrated estimation (training people to give realistic confidence intervals)',
  removeAllRanges() {},
});
await act(async () => {
  document.querySelector('main [data-msg-id] > div').dispatchEvent(
    new dom.window.MouseEvent('mouseup', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );
});
await click('Own it');
window.getSelection = realGetSelection;
await wait(100);
const bookOpts = buttons()
  .map(b => b.textContent.trim())
  .filter(t => /concept|structure$/.test(t));
step(
  'book: unrelated highlight gets options about itself',
  bookOpts.length > 0 &&
    bookOpts.every(t => !/Rule of Five|population/.test(t)) &&
    bookOpts[0].includes('calibrated estimation'),
  bookOpts.join(' | '),
);
await act(async () => {
  document
    .querySelector('button[data-role=leave]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
await ownAll();
step(
  'book: owning a whole long answer asks what to own',
  text().includes('What do you want to own here?'),
);
await click(
  'The Rule of Five: why a few random samples usually catch the median',
);
step(
  'book: focus picked',
  ownTitle().includes(
    'The Rule of Five: why a few random samples usually catch the median',
  ),
);
step(
  "predict: nudges you to reread what you're owning before locking in, as a link to it in the chat",
  !!document.querySelector('[data-role=predict-reread]') &&
    /Not sure\? Reread (Claude's answer|the part you highlighted), or have Claude/.test(
      document.querySelector('[data-role=predict-hint]').textContent,
    ),
);
await predict(0);
await wait(50);
step(
  'book: starts at the test even at 0, with no visual in the panel',
  text().includes('4 random support calls') &&
    !text().includes('See it visually'),
);
step(
  'book: transfer task is new (4 calls)',
  text().includes('4 random support calls'),
);
step(
  'book: the try asks about the reasoning, not a percentage',
  text().includes(
    'How likely is the range from the shortest to the longest of your 4 calls',
  ) && !document.querySelector('textarea[data-role=write]'),
);
await click('Certain: a median is always between the min and max'); // her original confusion
await click('A little less likely to catch it');
await click('All 4 calls could happen to be longer');
await click('Check my version');
await wait(100);
step(
  'book: her original confusion is recognised and explained, 2 of 3',
  text().includes('You got 2') &&
    text().includes("That's true of your 4 calls' own median") &&
    !!document.querySelector('[title^="Checked against the answer key"]'),
);
await click('Optional: explain it to Sam');
step(
  'book: Sam asks your own question',
  text().includes(
    "Isn't the median always between the smallest and the biggest number?",
  ),
);
await click('Done, back to chat');

// ---- Sixth run: the Juno starter. Interpretive topic, "chosen" check.
await click('New chat');
await click('aggregation theory');
await wait(50);
step(
  'juno: replays the real chat with the company renamed',
  text().includes("I'm trying to prep for a meeting") &&
    text().includes('wouldnt juno want to own both?') &&
    !/\bmedium\b/i.test(text()),
);
step(
  'juno: filled-in turns present, remaining gap marked',
  text().includes('how exactly are they doing this?') &&
    text().includes('reviews or nyt bestsellers etc also helped.') &&
    [...document.querySelectorAll('div')].filter(d =>
      d.textContent.startsWith('Earlier turns aren’t shown'),
    ).length === 1,
);
step(
  'juno: each answer rendered once, as prose',
  document.querySelectorAll('main [data-msg-id]').length === 8,
);
step(
  'juno: every answer has the own icon',
  document.querySelectorAll('button[data-role=own-all]').length === 8,
);
await ownAll();
await click('Which side an aggregator owns');
step(
  'juno: focus picked',
  ownTitle().includes('Which side an aggregator owns, and why not both'),
);
await predict(0);
await wait(50);
step(
  'juno: starts at the test, no visual in the panel',
  text().includes('Vela (made up)') && !text().includes('See it visually'),
);
step(
  'juno: transfer task is a made-up company',
  text().includes('Vela (made up)') &&
    document.querySelectorAll('[data-role=choice-q]').length === 3,
);
await click('Both users and trainers, equally'); // her original instinct
await click('Stay on Vela and train with someone else');
await click('Vela, because any one trainer is replaceable');
await click('Check my version');
await wait(50);
step(
  'juno: "own both" diagnosed with the Airbnb test, 2 of 3',
  text().includes('You got 2') &&
    text().includes('Test it like Airbnb: if one trainer left') &&
    !!document.querySelector('[title^="Checked against the answer key"]'),
);
await click('Optional: explain it to Sam');
step(
  'juno: Sam asks your question',
  text().includes("wouldn't it want both of them to love it?"),
);
// Christine's real explanation, including the moment she wasn't sure.
const teachInput = () =>
  document.querySelector('input[placeholder^="Explain it to Sam"]');
await type(
  teachInput(),
  'yes, of course we want both to love juno, but we want to commoditize editorial excellence such that if one writer leaves it isnt a huge negative against Juno.',
);
await click('Send');
await wait(30);
await type(
  teachInput(),
  'well if we have readers, writers will want to reach them. if we have good writers, we will attract interested readers. its a positive feedback loop.',
);
await click('Send');
await wait(30);
await type(
  teachInput(),
  "hm, i'm not really sure but i would guess we'd need writers first",
);
await click('Send');
await wait(80);
step(
  'teach: ends with what teaching showed, not just thanks',
  !!document.querySelector('[data-role=teach-debrief]') &&
    text().includes('What teaching Sam showed') &&
    text().includes('You explained clearly'),
);
step(
  "teach: the hedge becomes a gap you didn't know you had",
  !!document.querySelector('[data-role=teach-gap]') &&
    text().includes("You weren't sure") &&
    text().includes("i would guess we'd need writers first") &&
    text().includes("a gap you didn't know you had"),
);
await click('Save for later');
step('teach: the gap can be saved', text().includes('✓ Saved to Learnings'));
await openLearnings();
step(
  'gaps: an open gap waits on Learnings, with where it came from and your words',
  !!document.querySelector('[data-role=open-gap]') &&
    text().includes('while you were explaining') &&
    text().includes("i would guess we'd need writers first"),
);
await click('Explore it with Claude');
await wait(80);
step(
  'gaps: exploring opens a new chat about just that gap, with the goal in view',
  !!document.querySelector('[data-role=gap-banner]') &&
    text().includes('Closing a gap') &&
    text().includes('I want to close a gap:'),
);
step(
  'gaps: Claude starts from your guess and explains (offline: the hand-written cold-start answer)',
  text().includes('one side usually has to come first') &&
    text().includes('Seed one side yourself'),
);
step(
  'gaps: the banner is context only; "check me" is a suggested reply under Claude\'s latest answer',
  !document.querySelector('[data-role=gap-banner] button') &&
    !!document.querySelector('[data-role=gap-check-chip]'),
);
await click("I think I've got it: check me");
await wait(30);
step(
  'gaps: checking yourself is the next turn of the chat',
  [...document.querySelectorAll('main div')].some(
    d => d.textContent === "I think I've got it. Check me.",
  ) && !document.querySelector('[data-role=gap-check-chip]'),
);
step(
  'gaps: the check opens in the side panel, asking you to explain and apply, not recite',
  !!document.querySelector(
    '[data-role=gap-panel] textarea[data-role=gap-answer]',
  ) &&
    document
      .querySelector('[data-role=gap-panel]')
      .textContent.includes('Name at least one concrete move') &&
    !document.querySelector('main textarea[data-role=gap-answer]') &&
    !!document.querySelector('main [data-role=gap-check-pointer]'),
);
await type(
  document.querySelector('textarea[data-role=gap-answer]'),
  'i guess they just market it a lot',
);
await click('Check my answer');
await wait(50);
step(
  'gaps: not closed yet: the panel says so and offers another check; the chat says to keep talking',
  document
    .querySelector('[data-role=gap-panel]')
    ?.textContent.includes('Not closed yet') &&
    buttons().some(b => b.textContent === 'Check me again') &&
    (
      document.querySelector('main [data-role=gap-check-pointer]')
        ?.textContent || ''
    ).includes('Keep talking it through'),
);
await act(async () => {
  document
    .querySelector('[data-role=gap-panel] [data-role=ask-claude]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
step(
  'gaps: "Ask Claude about this" quotes the check into the gap chat',
  (() => {
    const v = document.querySelector('main textarea')?.value || '';
    return (
      v.startsWith('About closing the gap “') &&
      v.includes('> My answer: i guess they just market it a lot') &&
      v.includes('> The check said: Not closed yet.')
    );
  })(),
);
await act(async () => {
  const el = document.querySelector('main textarea');
  const set = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  set.call(el, '');
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
await click('Check me again');
await wait(50);
step(
  'gaps: checking again opens a fresh check in the panel',
  !!document.querySelector(
    '[data-role=gap-panel] textarea[data-role=gap-answer]',
  ) &&
    !document
      .querySelector('[data-role=gap-panel]')
      .textContent.includes('Not closed yet'),
);
await type(
  document.querySelector('textarea[data-role=gap-answer]'),
  "neither side shows up while the other is empty, so it's chicken and egg. Juno should seed writers first, maybe pay or invite a small group, so there's something worth reading.",
);
await click('Check my answer');
await wait(50);
step(
  'gaps: closed when both key ideas are there; the result is in the panel, with a one-line note in the chat',
  !!document.querySelector('[data-role=gap-panel] [data-role=gap-result]') &&
    document
      .querySelector('[data-role=gap-panel]')
      .textContent.includes("It's now in what you own") &&
    (
      [...document.querySelectorAll('main [data-role=gap-check-pointer]')].at(
        -1,
      )?.textContent || ''
    ).includes('✓ Gap closed'),
);
await openLearnings();
step(
  'gaps: a closed gap becomes something you own, not an open gap',
  !document.querySelector('[data-role=open-gap]') &&
    savedLedger().some(e => e.kind === 'gap') &&
    JSON.parse(window.localStorage.getItem('own-it:v1')).gaps.some(
      g => g.status === 'closed',
    ) &&
    [...document.querySelectorAll('[data-role=learning]')].some(c =>
      c.textContent.includes(savedLedger().find(e => e.kind === 'gap').title),
    ),
);
await click('New chat');

// ---- You go first, outsourced: "just answer this time" is a fine choice, and it's noted.
await click('New chat');
await openLearnings();
step(
  'go first: every owned topic offers its new question on the Learnings map',
  [
    'orders per customer',
    '6 timed checkouts',
    'a top writer wants a bigger cut',
  ].every(l =>
    [...document.querySelectorAll('[data-role=map-question]')].some(
      b => b.textContent.trim() === l,
    ),
  ),
);
await click('a top writer wants a bigger cut');
await click('Just answer this time');
step(
  'go first: outsourcing gets the answer straight away, and is noted',
  text().includes('that you let me take this one') &&
    text().includes('Less worried than it feels'),
);
await openLearnings();
step(
  'go first: Learnings notes you let Claude answer',
  text().includes('let Claude answer'),
);

// ---- React: Claude's real answer, and the cleanup's timing as a timeline you step through.
await click('New chat');
await click('React · fetch on mount');
await wait(50);
step(
  "react: replays Claude's real answer, rendered (code blocks, headings, bullets)",
  text().includes('controller.abort()') &&
    text().includes('How it works') &&
    text().includes('TanStack Query') &&
    document.querySelectorAll('main pre').length === 2 &&
    !!document.querySelector('main ul'),
);
// Highlighting offers "Ask Claude" (explain, in the chat) next to "Own it" (test yourself).
window.getSelection = () => ({
  toString: () => 'AbortError is expected when you cancel',
  removeAllRanges() {},
});
await act(async () => {
  document.querySelector('main [data-msg-id] > div').dispatchEvent(
    new dom.window.MouseEvent('mouseup', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );
});
window.getSelection = realGetSelection;
step(
  'highlight: offers Ask Claude next to Own it',
  !!document.querySelector('[data-role=ask-sel]') &&
    !!document.querySelector('#own-sel-btn'),
);
await act(async () => {
  document
    .querySelector('[data-role=ask-sel]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(20);
step(
  'highlight: Ask Claude quotes it into the chat to ask about',
  (document.querySelector('main textarea')?.value || '').startsWith(
    'About this part of your answer:\n> AbortError is expected when you cancel',
  ),
);
// "Check it landed": ask Claude to explain the cleanup line; the explanation offers a check. (One stand-in reply.)
window.getSelection = () => ({
  toString: () => 'return () => controller.abort();',
  removeAllRanges() {},
});
await act(async () => {
  document.querySelector('main [data-msg-id] > div').dispatchEvent(
    new dom.window.MouseEvent('mouseup', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );
});
window.getSelection = realGetSelection;
await act(async () => {
  document
    .querySelector('[data-role=ask-sel]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(20);
await act(async () => {
  const el = document.querySelector('main textarea');
  const set = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  set.call(el, el.value + 'can you explain this more, how is this working?');
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
const offline = globalThis.fetch;
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    text: 'The cleanup function runs before the next effect and on unmount…',
  }),
});
await click('↑');
await wait(80);
globalThis.fetch = offline;
step(
  'own it: the icon under an explanation you asked for expands into the button',
  !!document.querySelector('button[data-role=own-all][data-expanded]') &&
    text().includes('The cleanup function runs before the next effect'),
);
step(
  'own it: one control per answer — the expanded button replaces the icon, never both',
  (() => {
    const msg = [...document.querySelectorAll('main [data-msg-id]')].at(-1);
    return (
      msg.querySelectorAll('button[data-role=own-all]').length === 1 &&
      !!msg.querySelector('button[data-role=own-all][data-expanded]')
    );
  })(),
);
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ text: 'Here it is as a custom hook: useUser(userId)…' }),
});
await act(async () => {
  const el = document.querySelector('main textarea');
  const set = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  set.call(el, 'make it a custom hook');
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
await click('↑');
await wait(80);
globalThis.fetch = offline;
step(
  'own it: a do-this request (not a learning one) keeps the quiet icon',
  (() => {
    const msg = [...document.querySelectorAll('main [data-msg-id]')].at(-1);
    return (
      msg.textContent.includes('custom hook') &&
      !msg.querySelector('button[data-role=own-all][data-expanded]')
    );
  })(),
);
step(
  'check it landed: the explanation you asked for offers Own it right under it',
  !!document.querySelector('button[data-role=own-all][data-expanded]'),
);
await act(async () => {
  document
    .querySelector('button[data-role=own-all][data-expanded]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(50);
step(
  'one action, one name: the chip is "Own it" too, and the owned answer\'s icon shows it',
  [...document.querySelectorAll('button[data-role=own-all]')].some(
    b => b.getAttribute('aria-pressed') === 'true',
  ) && text().includes('Own it · When the cleanup runs'),
);
step(
  'check it landed: Own-it on what you asked, no focus question, matched to the hand-written target',
  !!document.querySelector('[data-role=own-panel]') &&
    ownTitle().includes('When the cleanup runs') &&
    !text().includes('What do you want to own here?') &&
    text().includes('How many of the 3 will you get right on your own?') &&
    document.querySelectorAll('[data-role=predict-topics] li').length === 3,
);
await act(async () => {
  document
    .querySelector('button[data-role=leave]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(20);
step(
  'check it landed: once owned, the expanded button goes',
  !document.querySelector('button[data-role=own-all][data-expanded]'),
);
// Highlight the cleanup line: the timing focus comes first.
window.getSelection = () => ({
  toString: () => 'return () => controller.abort();',
  removeAllRanges() {},
});
await act(async () => {
  document.querySelector('main [data-msg-id] > div').dispatchEvent(
    new dom.window.MouseEvent('mouseup', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );
});
await click('Own it');
window.getSelection = realGetSelection;
await wait(100);
step(
  'react: highlighting the cleanup offers "when the cleanup runs" first',
  (
    buttons()
      .map(b => b.textContent.trim())
      .filter(t => /concept|structure$/.test(t))[0] || ''
  ).startsWith('When the cleanup runs'),
);
await click('When the cleanup runs');
await predict(0);
await wait(50);
step(
  'react: straight to the try — reasoning about timing on a new case, not writing a component',
  text().includes('SearchResults') &&
    text().includes('what happens first?') &&
    !document.querySelector('textarea[data-role=write]'),
);
step(
  "react: no timeline in the panel (seeing it another way is the chat's job)",
  !document.querySelector('[data-role=effect-timeline]') &&
    !text().includes('See it visually'),
);
await click('×');

// ---- Recall: what you owned comes back. The seeded item first, then things owned today after skipping ahead.
await act(async () => {
  document
    .querySelector('button[data-role=nav-learnings]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
const dueTitles = () =>
  [...document.querySelectorAll('[data-role=due-item]')].map(
    d => d.textContent,
  );
// The seeded item (Juno's mechanism, owned "3 days ago") is the one thing due; recalling it is a new made-up company.
const seedDue = () =>
  [...document.querySelectorAll('[data-role=due-item]')].find(d =>
    d.textContent.includes('Mechanism vs result'),
  );
step(
  'recall: the seeded Juno item is the only thing due',
  dueTitles().length === 1 &&
    !!seedDue() &&
    seedDue().textContent.includes('Juno'),
);
step(
  'recall: the seeded item says it is an example, since a first-time visitor never owned it',
  /An example: as if you'd owned this in the Juno chat 3 days ago/.test(
    document.querySelector('[data-role=recall-rail]')?.textContent || '',
  ),
);
await act(async () => {
  [...seedDue().querySelectorAll('button')]
    .find(b => b.textContent.includes('Recall now'))
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
step(
  'recall: the seeded item is a new company, three questions about the idea, not a number',
  text().includes('Pallet (made up)') &&
    text().includes('What scarce thing did Pallet make cheap?') &&
    text().includes('Compared with Pallet, the rival'),
);
await click("Knowing which stranger's home cooking is safe and good");
await click('Result');
await click(
  'Owns its customers more, since famous chefs bring bigger audiences',
);
await click('Check it');
await wait(50);
step(
  'recall: a wrong pick on the seeded item is explained',
  text().includes("A famous chef's audience belongs to the chef"),
);
await click('Done');
const ruleCards = () =>
  [
    ...document.querySelectorAll('[data-role=learning], [data-role=due-item]'),
  ].filter(d => d.textContent.includes('The Rule of Five'));
step(
  'repeat: nothing is due now, so there is no indicator',
  !document.querySelector('[data-role=recall-badge]') &&
    dueTitles().length === 0,
);
await click('⏩ Skip ahead 3 days');
step(
  'recall: 3 days later, what you owned today comes due',
  dueTitles().length >= 3 &&
    /to recall$/.test(
      document
        .querySelector('[data-role=recall-badge]')
        ?.getAttribute('aria-label') || '',
    ),
);
await act(async () => {
  [...ruleCards()[0].querySelectorAll('button')]
    .find(b => b.textContent.includes('Recall now'))
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
step('recall: a new case, from memory', text().includes('6 random houses'));
step(
  'recall: questions about the reasoning, not the arithmetic',
  text().includes(
    'the range from the cheapest to the priciest of your 6 houses',
  ) &&
    text().includes('When would your range miss') &&
    text().includes('Which of these would break the rule?'),
);
await click('More likely');
await click('Only if all 6 houses are above it');
await click('You only looked at houses at the expensive end');
await click('Check it');
await wait(50);
step(
  'recall: then vs now, and when it comes back',
  text().includes('First try, 3 days ago: 2 of 3 → today: 3 of 3') &&
    text().includes('It stuck.') &&
    text().includes('Next recall in 7 days'),
);
step(
  'recall: after checking, "Ask Claude about this" is offered (never before you answer)',
  !!document.querySelector('[data-role=recall-ask]'),
);
await click('Done');
const sqlDue = [...document.querySelectorAll('[data-role=due-item]')].find(d =>
  d.textContent.includes('When to use LEFT vs INNER'),
);
await act(async () => {
  [...sqlDue.querySelectorAll('button')]
    .find(b => b.textContent.includes('Recall now'))
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
step(
  'recall: SQL recall keeps the scaffold',
  text().includes('customers who have never placed an order') &&
    text().includes('WHERE o.id IS NULL'),
);
await type(
  document.querySelector('textarea[data-role=recall-text]'),
  'FROM customers c JOIN orders o ON o.customer_id = c.id',
);
await click('Check it');
await wait(400);
step(
  'recall: a slip brings it back sooner, run and explained',
  text().includes('→ today: 0 of 2') &&
    text().includes('come back sooner') &&
    text().includes('Next recall in 1 day'),
);
await click('Done');
const gapDue = [...document.querySelectorAll('[data-role=due-item]')].find(d =>
  d.textContent.includes('cold start'),
);
step('recall: the closed gap comes back too', !!gapDue);
await act(async () => {
  [...gapDue.querySelectorAll('button')]
    .find(b => b.textContent.includes('Recall now'))
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
step(
  'recall: a closed gap comes back as a new case to apply it to',
  text().includes('marketplace that connects local tutors with students'),
);
await type(
  document.querySelector('textarea[data-role=recall-text]'),
  "it's chicken and egg: no tutors without students and no students without tutors. I'd recruit a small group of tutors first, maybe at one school.",
);
await click('Check it');
await wait(50);
step('recall: still closed', text().includes('Still closed.'));

// ---- Learnings page: everything you chose to own, from the sidebar.
await act(async () => {
  document
    .querySelector('button[data-role=nav-learnings]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
step(
  'learnings: opens from the sidebar, lists what you own with its history',
  !!document.querySelector('[data-role=learnings]') &&
    document.querySelectorAll('[data-role=learning], [data-role=due-item]')
      .length >= 4 &&
    savedLedger().some(e =>
      (e.realWork || []).some(r => r.actual === 1 && r.n === 2),
    ),
);
step(
  'learnings: no "You asked about" or "stepped away" sections (cut for focus), sample history labelled',
  !text().includes('You wanted to learn, then stepped away') &&
    !document.querySelector('[data-role=asked-about]') &&
    text().includes('sample history, mocked'),
);
await click('6 timed checkouts');
step(
  'learnings: revisit by trying a new question',
  !document.querySelector('[data-role=learnings]') &&
    text().includes('I timed 6 random checkout transactions'),
);
await click("I'll go first");
step(
  'checkout question checks the reasoning, not 96.875%: three reasoning questions, no number box',
  [
    ...document.querySelectorAll(
      '[data-role=go-panel] [data-role=go-topics] li',
    ),
  ]
    .map(li => li.textContent)
    .join(' | ') ===
    'how likely the range catches it | when the range misses | what breaks the bet',
);
await act(async () => {
  document
    .querySelector('[data-role=go-panel] [data-role=go-predict][data-n="3"]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
await click('Very likely, about 97%: it misses only if all 6 land on one side');
await click('Only when all 6 timings land on the same side of it');
await click('You timed only 6 checkouts, not 60');
await click('Check mine');
await wait(50);
step(
  'checkout question: "about 97%" is right without the exact number; a wrong pick is explained',
  text().includes('You said 3 of 3 and got 2') &&
    text().includes('Six is plenty for this bet') &&
    !document.querySelector('[data-role=go-panel] textarea'),
);
await click('Back to chat');

// ---- Calibration counts the same things it predicts; a blank answer is never right.
await click('New chat');
await click('aggregation theory');
await wait(50);
await ownAll();
await click('Which side an aggregator owns');
step(
  'calibration: the prediction is about the 3 questions shown with the try',
  text().includes('How many of the 3 will you get right on your own?') &&
    text().includes('3 questions, on:') &&
    document.querySelectorAll('[data-role=predict-topics] li').length === 3 &&
    document.querySelectorAll('[data-role=predict-option]').length === 4,
);
await predict(3);
await click('Stay on Vela and train with someone else'); // one right answer; the other two left blank
await click('Check my version');
await wait(50);
step(
  'calibration: 1 right and 2 blank is 1 of 3, never "line up" with a prediction of 3',
  text().includes('You said 3 of 3, and got 1') &&
    (text().match(/\(left blank\)/g) || []).length === 2 &&
    !text().includes('accurate here'),
);
await click('Back to chat');
await openLearnings();
// The Juno run above owned "which side" already: owning it again is one card, with the first attempt folded in.
const sideCards = () =>
  [
    ...document.querySelectorAll('[data-role=learning], [data-role=due-item]'),
  ].filter(d => d.textContent.startsWith('Which side an aggregator owns'));
step(
  'repeat: owning the same thing again is one card, with the earlier attempt on it',
  sideCards().length === 1 &&
    savedLedger().some(
      e =>
        !e.merged &&
        e.title.startsWith('Which side an aggregator owns') &&
        (e.earlier || []).length >= 1,
    ),
);
step(
  'repeat: the map shows it once',
  [...document.querySelectorAll('[data-role=map] button')].filter(b =>
    b.textContent.startsWith('Which side an aggregator owns'),
  ).length === 1,
);

// ---- Saved in this browser: a refresh keeps what you own and when it comes back.
await openLearnings();
const ownedBefore = document.querySelectorAll(
  '[data-role=learning], [data-role=due-item]',
).length;
const calBefore =
  document.querySelector('[data-role=calibration]')?.textContent || '';
await act(async () => root.unmount());
const root2 = createRoot(document.getElementById('root'));
await act(async () => {
  root2.render(React.createElement(App));
});
await wait(50);
await openLearnings();
step(
  'saved: after a reload, Learnings still has everything you own, with calibration',
  ownedBefore > 1 &&
    document.querySelectorAll('[data-role=learning], [data-role=due-item]')
      .length === ownedBefore &&
    (document.querySelector('[data-role=calibration]')?.textContent || '') ===
      calBefore &&
    calBefore.includes('Calibration, across'),
  `${ownedBefore} → ${document.querySelectorAll('[data-role=learning], [data-role=due-item]').length} · ${calBefore.slice(0, 60)}`,
);
step(
  'saved: the demo clock survives a reload too',
  /it's \d+ days later/.test(text()),
);
window.confirm = () => true;
await act(async () => {
  document
    .querySelector('[data-role=reset-demo]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
await openLearnings();
step(
  'saved: Reset demo goes back to the starting state',
  document.querySelectorAll('[data-role=learning], [data-role=due-item]')
    .length === 1 && !/it's \d+ days later/.test(text()),
  `${document.querySelectorAll('[data-role=learning], [data-role=due-item]').length} items`,
);

// ---- You go first, when you ask again: a new chat's question that needs something you own.
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
await ownAll();
await click('The whole query: each part');
await predict(4);
await type(
  document.querySelector('textarea[data-role=write]'),
  "SELECT a.name, COALESCE(SUM(b.pages), 0) AS pages\nFROM authors a\nLEFT JOIN books b ON b.author_id = a.id AND b.status = 'published'\nGROUP BY a.name\nORDER BY pages DESC;",
);
await click('Check my version');
await wait(500);
await click('Back to chat');
await click('New chat');
const asked = [];
globalThis.fetch = async (url, opts) => {
  const b = JSON.parse(opts.body);
  asked.push(b.task);
  const text =
    b.task === 'goFirstMatch'
      ? '{"match": 1}'
      : b.task === 'goFirstCompare'
        ? JSON.stringify({
            owned: 'yes',
            ownedLine:
              'You kept the review filters in **ON**, so products with none stay.',
            note: 'You started from **products**, which keeps every one.',
            deeper: [
              { idea: 'Counting matches after a LEFT JOIN' },
              { idea: 'Filtering a year with a date range' },
            ],
          })
        : 'Start FROM products and LEFT JOIN the reviews.';
  return { ok: true, status: 200, json: async () => ({ text }) };
};
await act(async () => {
  const el = document.querySelector('main textarea');
  const set = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  set.call(
    el,
    'Write me SQL: every product with its number of reviews, including products with none.',
  );
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
await click('↑');
await wait(120);
step(
  'go first on ask: Claude offers the first try, with its answer held back',
  !!document.querySelector('[data-role=go-ask]') &&
    text().includes('This one uses something you own') &&
    !text().includes('Start FROM products') &&
    asked.includes('goFirstMatch') &&
    asked.includes('chat'),
);
await click("I'll go first");
step(
  'go first on ask: your answer goes in the side panel too',
  !!document.querySelector(
    '[data-role=go-panel] textarea[data-role=go-ask-text]',
  ) && !document.querySelector('main textarea[data-role=go-ask-text]'),
);
await type(
  document.querySelector('textarea[data-role=go-ask-text]'),
  'SELECT p.name, COUNT(r.id) FROM products p LEFT JOIN reviews r ON r.product_id = p.id GROUP BY p.name',
);
await click('Show me yours');
await wait(400);
step(
  'go first on ask: Claude compares, then shows its answer',
  !!document.querySelector('[data-role=go-ask-note]') &&
    text().includes('You started from products') &&
    text().includes('Start FROM products'),
);
step(
  'go first on ask: the idea you own gets its own verdict, first',
  document.querySelector('[data-role=go-ask-verdict]')?.dataset.verdict ===
    'yes' &&
    text().includes('You applied what you own') &&
    text().includes('kept the review filters in ON'),
);
step(
  'go first on ask: new gaps are named as ideas to go deeper on, and not saved',
  document.querySelectorAll('[data-role=go-deeper-item]').length === 2 &&
    text().includes('Not saved to Learnings'),
);
const ledgerBeforeDeeper = JSON.parse(
  window.localStorage.getItem('own-it:v1') || '{}',
).ledger?.length;
await act(async () => {
  document
    .querySelector('[data-role=go-deeper-item]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
step(
  'go deeper: your try is quoted in the chat box with the idea named; the question is yours',
  (() => {
    const v = document.querySelector('main textarea')?.value || '';
    return (
      v.startsWith('About my go:') &&
      v.includes('> My answer: SELECT p.name') &&
      v
        .trim()
        .endsWith(
          "I'd like to go deeper on: Counting matches after a LEFT JOIN.",
        )
    );
  })(),
);
step(
  'go deeper: nothing is added to Learnings',
  ledgerBeforeDeeper > 0 &&
    JSON.parse(window.localStorage.getItem('own-it:v1') || '{}').ledger
      ?.length === ledgerBeforeDeeper,
);
await type(document.querySelector('main textarea'), '');
globalThis.fetch = offline;
await openLearnings();
step(
  'go first on ask: Learnings records that you went first',
  text().includes('went first'),
);

// ---- A calculation is worked out step by step, not picked from options (generated try, "steps" format).
await click('New chat');
const STEPS_TRY = {
  orderIsInsight: false,
  format: 'steps',
  task: 'Now a new situation: drug C raises a 4 in 1,000 risk by 50%; drug D raises a 30 in 100 risk by 10%.',
  context: '',
  steps: [
    {
      label: "D's baseline, per 1,000",
      answer: 300,
      unit: '',
      how: '30 in 100 is 300 in 1,000.',
    },
    {
      label: 'Extra cases per 1,000 from C',
      answer: 2,
      unit: '',
      how: '50% of 4 is 2.',
    },
    {
      label: 'Extra cases per 1,000 from D',
      answer: 30,
      unit: '',
      how: '10% of 300 is 30.',
    },
  ],
};
globalThis.fetch = async (url, opts) => {
  const b = JSON.parse(opts.body);
  const text =
    b.task === 'chat'
      ? 'Put both baselines in the same units, find the extra cases, then compare the absolute numbers.'
      : b.task === 'focusOptions'
        ? '{"options":[{"label":"Converting baselines to the same units","mode":"concept"}]}'
        : b.task === 'writeTask'
          ? JSON.stringify(STEPS_TRY)
          : b.task === 'inferLearning'
            ? '{"learning": false, "topic": ""}'
            : '{}';
  return { ok: true, status: 200, json: async () => ({ text }) };
};
await act(async () => {
  const el = document.querySelector('main textarea');
  const set = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  set.call(el, 'How do I compare two risks given as percentages?');
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
await click('↑');
await wait(120);
await ownAll();
await wait(80);
await click('Converting baselines to the same units');
await wait(120);
step(
  'steps: a calculation is predicted step by step, with the steps shown',
  text().includes('How many of the 3 will you get right on your own?') &&
    text().includes("It's checked on 3 steps:") &&
    text().includes("D's baseline, per 1,000"),
);
await predict(3);
await wait(50);
const stepInputs = () => [
  ...document.querySelectorAll('input[data-role=step-input]'),
];
step(
  'steps: one number box per step, no multiple choice',
  stepInputs().length === 3 && !document.querySelector('[data-role=choice-q]'),
);
await type(stepInputs()[0], '300');
await type(stepInputs()[1], '2');
await type(stepInputs()[2], '3');
await click('Check my version');
await wait(80);
step(
  'steps: each step checked by its number; the first slip is named with how to get it',
  text().includes('You said 3 of 3, and got 2') &&
    text().includes(
      'Step 3: the answer is 30, and you have 3. 10% of 300 is 30.',
    ) &&
    document.querySelectorAll('[data-role=items] > div').length === 3,
);
step(
  'steps: the reveal names the try "Work it out"',
  text().includes('Work it out'),
);
globalThis.fetch = offline;
await click('Back to chat');

// ---- Full score with feedback (Christine's run): the join is right, but the paid filter in ON blanks names.
// You can still see what you wrote and ask Claude about the feedback.
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
window.getSelection = () => ({ toString: () => sel, removeAllRanges() {} });
await act(async () => {
  document.querySelector('main [data-msg-id] > div').dispatchEvent(
    new dom.window.MouseEvent('mouseup', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );
});
await click('Own it');
window.getSelection = realGetSelection;
await click('When to use LEFT vs INNER');
await predict(2);
await type(
  document.querySelector('textarea[data-role=write]'),
  "FROM orders o\nLEFT JOIN customers c ON c.id = o.customer_id and o.status = 'paid'",
);
await click('Check my version');
await wait(400);
step(
  'full score with feedback: your answer is shown and "Ask Claude about this" is offered',
  text().includes('You got 2') &&
    text().includes('What to fix:') &&
    document
      .querySelector('[data-role=your-answer] div')
      ?.textContent.includes("o.status = 'paid'") &&
    !!document.querySelector('[data-role=ask-claude]'),
);
await click('Back to chat');

// ---- Not ready yet: a low prediction offers the way back to Claude, with the highlight quoted.
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
const hl =
  "The key detail is putting the status filter in the LEFT JOIN's ON clause rather than in WHERE";
window.getSelection = () => ({ toString: () => hl, removeAllRanges() {} });
await act(async () => {
  document.querySelector('main [data-msg-id] > div').dispatchEvent(
    new dom.window.MouseEvent('mouseup', {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );
});
await click('Own it');
window.getSelection = realGetSelection;
step(
  'highlight heading: a sentence about ON vs WHERE offers that first, even though it says "join"',
  (
    buttons()
      .map(b => b.textContent.trim())
      .filter(t => /concept|structure$/.test(t))[0] || ''
  ).startsWith("Why status = 'paid' goes in ON"),
);
await click("Why status = 'paid' goes in ON");
await predict(0);
step(
  'not ready: predicting under half offers "Ask Claude first" next to the try',
  !!document.querySelector('[data-role=not-ready]') &&
    !!document.querySelector('textarea[data-role=write]'),
);
await act(async () => {
  document
    .querySelector('[data-role=ask-first]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
step(
  'not ready: the panel closes; your highlight is quoted in the chat box, with a request to explain it step by step',
  !document.querySelector('[data-role=own-panel]') &&
    (document.querySelector('main textarea')?.value || '').startsWith(
      `I'm trying to learn “Why status = 'paid' goes in ON, not WHERE”, and I don't really get it yet. Here's the part I mean:\n> ${hl}\n\n`,
    ) &&
    (document.querySelector('main textarea')?.value || '').includes(
      'explain it another way, with a concrete example?',
    ) &&
    !(document.querySelector('main textarea')?.value || '').includes(
      'whatever form',
    ) &&
    !(document.querySelector('main textarea')?.value || '').includes(
      'predict',
    ) &&
    text().includes('Asked Claude first'),
);
// Send it, then Own it under the new explanation: it owns the focus you picked, not one guessed again from the quote.
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    text: 'Think of ON as deciding which orders count as a match…',
  }),
});
await click('↑');
await wait(80);
globalThis.fetch = offline;
await act(async () => {
  document
    .querySelector('button[data-role=own-all][data-expanded]')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(50);
step(
  'highlight heading: after "explain another way", Own it keeps the focus you picked',
  ownTitle().includes("Why status = 'paid' goes in ON") &&
    !ownTitle().includes('LEFT vs INNER'),
  ownTitle(),
);
await click('Never mind');
await openLearnings();
step(
  'not ready: going to Claude first is kept as data, not counted as a miss',
  (
    JSON.parse(window.localStorage.getItem('own-it:v1') || '{}').exits || []
  ).some(x => x.askedFirst),
);

// ---- A new question that needs ON vs WHERE is named by the idea, not the old example's "status = 'paid'".
{
  const { SQL_TARGETS } = await vite.ssrLoadModule('/src/targets.js');
  const idea = SQL_TARGETS.onwhere.idea || '';
  step(
    'go first on ask: ON vs WHERE has a general name for new questions, free of the paid example',
    /ON vs WHERE/.test(idea) && !/paid|status|customer|order/i.test(idea),
    idea,
  );
}

// ---- Colours are tokens (src/theme.css), so light and dark are two lists of values; a hard-coded colour would
// stay the same in both themes.
{
  const { readFileSync, readdirSync } = await import('node:fs');
  const files = ['src', 'src/ui'].flatMap(d =>
    readdirSync(d)
      .filter(f => /\.(jsx?|css)$/.test(f) && f !== 'theme.css')
      .map(f => `${d}/${f}`),
  );
  const stray = files.flatMap(f =>
    (
      readFileSync(f, 'utf8').match(
        /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?![-\w])/g,
      ) || []
    ).map(h => `${f} ${h}`),
  );
  step(
    'theme: no hard-coded colours outside theme.css',
    stray.length === 0,
    stray.slice(0, 5).join(', '),
  );
  // Styling is Tailwind classes: no css() style strings, and text on clay or teal uses the on-accent colour, which
  // stays white in dark mode (text-surface turned dark there).
  const src = files
    .filter(f => f.endsWith('.jsx'))
    .map(f => readFileSync(f, 'utf8'))
    .join('\n');
  step(
    'styling: Tailwind classes only, no css() style strings',
    !/\bcss\(/.test(src) && !files.includes('src/css.js'),
  );
  step(
    'styling: text on a coloured background uses the on-accent colour',
    !/text-surface\b/.test(src),
  );
}

// ---- Markdown emphasis: nested and adjacent bold/italic render with no stray asterisks (spec B2).
{
  const { inline } = await vite.ssrLoadModule('/src/ui/parts.jsx');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = t =>
    renderToStaticMarkup(React.createElement('span', null, inline(t)));
  const plain = t => html(t).replace(/<[^>]+>/g, '');
  step(
    'markdown: *Grant, **Think Again**: confident humility.*',
    html('*Grant, **Think Again**: confident humility.*') ===
      '<span><i>Grant, <b>Think Again</b>: confident humility.</i></span>',
  );
  step(
    'markdown: ***bold italic***',
    !plain('***bold italic***').includes('*') &&
      html('***bold italic***').includes('<b>') &&
      html('***bold italic***').includes('<i>'),
  );
  step(
    'markdown: **Sinek** (*Leaders Eat Last*)',
    html('**Sinek** (*Leaders Eat Last*)') ===
      '<span><b>Sinek</b> (<i>Leaders Eat Last</i>)</span>',
  );
  step(
    'markdown: emphasis closing with *** leaves no stray asterisks',
    [
      '**Brown: *trust (psychological safety).***',
      '*Grant: **change your mind.***',
      '***Sinek:** start with why.*',
    ].every(t => !plain(t).includes('*')),
  );
}

// ---- Markdown tables: Claude's tables of rows render as tables, text before them stays a paragraph.
{
  const { Md } = await vite.ssrLoadModule('/src/ui/parts.jsx');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(
    React.createElement(Md, {
      text: 'Here are the rows after the join:\n| name | status | total |\n|---|:---:|---:|\n| Ada | `paid` | 320 |\n| Dee | NULL | **NULL** |\n\nWhich rows survive?',
    }),
  );
  step(
    'markdown: a pipe table renders as a table, with inline markdown in cells and the lead-in kept',
    (html.match(/<tr>/g) || []).length === 3 &&
      html.includes('<th') &&
      html.includes('<code') &&
      html.includes('<b>NULL</b>') &&
      html.includes('Here are the rows after the join:') &&
      !html.includes('|---'),
  );
  step(
    'markdown: a --- divider is a rule, not text',
    renderToStaticMarkup(
      React.createElement(Md, { text: 'One\n\n---\n\nTwo' }),
    ).includes('<hr'),
  );
  const flipMd =
    "Two versions:\n\n:::flip\n## Filter in ON\n| name | revenue |\n|---|---|\n| Bo | 0 |\n## Filter in WHERE\n```sql\nWHERE o.status = 'paid'\n```\nBo is gone.\n:::\n\nSo ON keeps Bo.";
  const flipHtml = renderToStaticMarkup(
    React.createElement(Md, { text: flipMd }),
  );
  step(
    'flip-through: views become tabs with Back/Next, the first view shown, a table inside it, text around it kept',
    flipHtml.includes('data-role="flip"') &&
      flipHtml.includes('Filter in ON') &&
      flipHtml.includes('Filter in WHERE') &&
      flipHtml.includes('1 of 2') &&
      flipHtml.includes('<table') &&
      !flipHtml.includes('Bo is gone') &&
      flipHtml.includes('Two versions:') &&
      flipHtml.includes('So ON keeps Bo.') &&
      !flipHtml.includes(':::'),
  );
  const streaming = renderToStaticMarkup(
    React.createElement(Md, {
      text: ':::flip\n## Step 1\nMount.\n## Step 2\nThe id chan',
    }),
  );
  step(
    'flip-through: while streaming, an unclosed block already shows as tabs',
    streaming.includes('data-role="flip"') &&
      streaming.includes('1 of 2') &&
      !streaming.includes(':::'),
  );
  const lone = renderToStaticMarkup(
    React.createElement(Md, { text: ':::flip\n## Only one\nJust this.\n:::' }),
  );
  step(
    'flip-through: a single view is not a flip-through, just markdown',
    !lone.includes('data-role="flip"') && lone.includes('Just this.'),
  );
  const mixed = renderToStaticMarkup(
    React.createElement(Md, {
      text: '## Where to start this week\n1. In one meeting, ask the problem first.\n2. Publicly credit one teammate.\nTry these:\n- one\n- two\n  still two\n### The data\n| a | b |\n|---|---|\n| 1 | 2 |',
    }),
  );
  step(
    'markdown: a heading, list, paragraph and table with no blank lines between still render as separate blocks',
    (mixed.match(/<li>/g) || []).length === 4 &&
      mixed.includes('<ol') &&
      mixed.includes('<ul') &&
      mixed.includes('<table') &&
      /Where to start this week<\/div>/.test(mixed) &&
      /The data<\/div>/.test(mixed) &&
      mixed.includes('two still two') &&
      !mixed.includes('##'),
  );
  const plain = renderToStaticMarkup(
    React.createElement(Md, { text: 'a | b is not a table' }),
  );
  step(
    'markdown: a lone pipe in text is not a table',
    !plain.includes('<table'),
  );
}

// ---- A first visit (nothing saved) gets the seeded recall; asking Claude about a recall. The earlier progress is put back after.
{
  const realBefore = window.localStorage.getItem('own-it:v1');
  window.localStorage.removeItem('own-it:v1');
  const box = document.createElement('div');
  document.body.appendChild(box);
  const demoRoot = createRoot(box);
  await act(async () => {
    demoRoot.render(React.createElement(App));
  });
  await wait(50);
  await act(async () => {
    box
      .querySelector('button[data-role=nav-learnings]')
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await wait(50);
  const t = box.textContent,
    cards = box.querySelectorAll('[data-role=learning], [data-role=due-item]');
  step(
    'first visit: one seeded recall, due and labelled as an example',
    cards.length === 1 &&
      box.querySelectorAll('[data-role=due-item]').length === 1 &&
      t.includes('An example: as if') &&
      t.includes('saved in this browser'),
    `${cards.length} cards`,
  );
  step(
    'first visit: the seeded Mechanism item offers its own new question, not the which-side one (log 112)',
    t.includes('what gives Juno its hold') &&
      !t.includes('a top writer wants a bigger cut'),
  );
  // Recall in the sample, then a question about it: quoted into a new chat, the question left to you, no go-first offer.
  const bclick = label =>
    act(async () => {
      const b =
        [...box.querySelectorAll('button')].find(
          x => x.textContent.trim() === label,
        ) ||
        [...box.querySelectorAll('button')].find(x =>
          x.textContent.includes(label),
        );
      b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
  await bclick('Recall now · about a minute');
  await wait(30);
  step(
    'first visit: no "Ask Claude about this" on a recall before you answer',
    !box.querySelector('[data-role=recall-ask]'),
  );
  await bclick("Knowing which stranger's home cooking");
  await bclick('Result');
  await bclick('Owns its customers less');
  await bclick('Check it');
  await wait(50);
  step(
    'recall: once checked, you can explain it to Sam next',
    !!box.querySelector('[data-role=recall-teach]'),
  );
  await act(async () => {
    box
      .querySelector('[data-role=recall-ask]')
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await wait(30);
  const draft = box.querySelector('main textarea')?.value || '';
  step(
    'recall ask: the recall is quoted into a new chat, the question left to you',
    draft.startsWith('About my recall on “Mechanism vs result') &&
      draft.includes('> Question: ') &&
      draft.includes('> My answer: ') &&
      draft.endsWith('\n\n'),
  );
  const tasks = [];
  globalThis.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    tasks.push(b.task);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        text:
          b.task === 'inferLearning'
            ? '{"learning": true, "topic": "Why the range only misses when all land on one side"}'
            : 'Because missing needs every house on the same side of the median.',
      }),
    };
  };
  await act(async () => {
    const el = box.querySelector('main textarea');
    const set = Object.getOwnPropertyDescriptor(
      dom.window.HTMLTextAreaElement.prototype,
      'value',
    ).set;
    set.call(el, draft + 'why does it only miss when all six are on one side?');
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await bclick('↑');
  await wait(120);
  globalThis.fetch = offline;
  step(
    'recall ask: Claude answers it (no go-first offer for a question you bring)',
    tasks.includes('chat') &&
      !tasks.includes('goFirstMatch') &&
      box.textContent.includes('Because missing needs every house'),
  );
  await act(async () => {
    demoRoot.unmount();
  });
  box.remove();
  if (realBefore === null) window.localStorage.removeItem('own-it:v1');
  else window.localStorage.setItem('own-it:v1', realBefore);
}

// ---- The try fits the focus: a focus about order at runtime ("when the cleanup runs") gets a try designed for it,
// not the chat's "write a new one from scratch" task, and the predict screen lists what it checks.
{
  await click('New chat');
  await click('React · fetch on mount');
  await wait(900);
  globalThis.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    const text =
      b.task === 'focusOptions'
        ? JSON.stringify({
            options: [
              {
                label: 'When React runs effect cleanup functions',
                mode: 'sequence',
              },
            ],
          })
        : b.task === 'writeTask'
          ? JSON.stringify({
              orderIsInsight: false,
              format: 'explain',
              task: 'Now a new situation: a chat room subscribes when roomId changes. Explain what runs, and when, as you switch rooms.',
              context:
                'rooms\n| id | name |\n|---|---|\n| 1 | **general** |\n\n```js\nuseEffect(() => subscribe(roomId), [roomId]);\n```',
              keyPoints: [
                'The old subscription is cleaned up before the new one starts',
                'Cleanup also runs on unmount',
              ],
              keyTopics: [
                'what happens to the old room',
                'what happens when you leave',
              ],
            })
          : '{}';
    return { ok: true, status: 200, json: async () => ({ text }) };
  };
  window.getSelection = () => ({
    toString: () => 'return () => controller.abort();',
    removeAllRanges() {},
  });
  await act(async () => {
    document.querySelector('main [data-msg-id] > div').dispatchEvent(
      new dom.window.MouseEvent('mouseup', {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    );
  });
  window.getSelection = realGetSelection;
  await click('Own it');
  await wait(100);
  await click('When React runs effect cleanup functions');
  await wait(100);
  globalThis.fetch = offline;
  const tryText =
    document.querySelector('[data-role=predict-try]')?.textContent || '';
  step(
    'try fits the focus: a runtime-order focus is not given the "write a new one from scratch" task',
    tryText.includes('a chat room subscribes') &&
      !tryText.includes('PostTitle'),
  );
  step(
    'predict lists what an explanation is checked on, by topic, without the answers',
    !!document.querySelector('[data-role=predict-topics]') &&
      tryText.includes('what happens to the old room') &&
      !tryText.includes('cleaned up before'),
  );
  await predict(1);
  const schema = document.querySelector('[data-role=schema-md]');
  step(
    "a generated try's context renders as markdown in the panel: a real table, a code block, no raw pipes or fences",
    !!schema &&
      !!schema.querySelector('table') &&
      !!schema.querySelector('pre') &&
      !!schema.querySelector('b') &&
      !schema.textContent.includes('|---') &&
      !schema.textContent.includes('```'),
  );
  await click('×');
}

// ---- The parenting and tax starters are live prompts with no saved answer: offline, they say so instead of standing in.
for (const [chip, prompt] of [
  [
    'Parenting · a meltdown leaving the park',
    'melts down every time we have to leave the park',
  ],
  [
    'Money · a raise into a higher tax bracket',
    'moves me into a higher tax bracket',
  ],
]) {
  await click('New chat');
  globalThis.fetch = offline;
  await click(chip);
  await wait(150);
  step(
    `${chip.split(' ·')[0]} starter sends its prompt as your message; offline, no saved answer, it says so`,
    text().includes(prompt) &&
      text().includes("I couldn't reach the model just now") &&
      !text().includes("Claude's saved answer"),
  );
}

// ---- Sam fits what you own: a live answer about a health headline is an idea, so Sam asks about an idea, not code.
{
  await click('New chat');
  globalThis.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    const text =
      b.task === 'chat'
        ? 'Not necessarily. The 18% is a **relative** risk: about 6 in 100 people get bowel cancer, and daily bacon makes it about 7 in 100.'
        : b.task === 'focusOptions'
          ? JSON.stringify({
              options: [
                {
                  label: 'Understand relative versus absolute risk',
                  mode: 'concept',
                },
              ],
            })
          : b.task === 'writeTask'
            ? JSON.stringify({
                orderIsInsight: false,
                format: 'steps',
                task: 'Now a new situation: a drink raises a 10 in 1,000 risk by 30%.',
                context: '',
                steps: [
                  {
                    label: 'Extra cases per 1,000',
                    answer: 3,
                    unit: '',
                    how: '30% of 10 is 3.',
                  },
                  {
                    label: 'New cases per 1,000',
                    answer: 13,
                    unit: '',
                    how: '10 + 3.',
                  },
                ],
              })
            : '{}';
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ text }),
    };
  };
  await click('Health · a bacon and cancer headline');
  await wait(150);
  await ownAll();
  await wait(100);
  await click('Understand relative versus absolute risk');
  await wait(100);
  await predict(2);
  const boxes = [...document.querySelectorAll('[data-role=step-input]')];
  await type(boxes[0], '3');
  await type(boxes[1], '13');
  await click('Check my version');
  await wait(150);
  await click('Optional: explain it to Sam');
  await wait(50);
  globalThis.fetch = offline;
  step(
    'sam: on an idea (not code), Sam asks what the idea is, never about code',
    text().includes("What's the main idea, in plain words") &&
      !text().includes('what this code is for'),
  );
  await click('Done, back to chat');
}

// ---- A generated choice try whose right answers are the longest options is asked for again (the length giveaway).
{
  await click('New chat');
  const q = (prompt, right, wrong1, wrong2) => ({
    prompt,
    short: prompt,
    options: [
      { label: right, correct: true },
      { label: wrong1, correct: false, gap: 'No.' },
      { label: wrong2, correct: false, gap: 'No.' },
    ],
  });
  const lopsided = {
    format: 'choice',
    task: 'Now a new situation: LOPSIDED speed cameras.',
    questions: [
      q(
        'Why did crashes drop?',
        'A record year is partly bad luck, and that luck tends not to repeat the next year',
        'Drivers got careful',
        'Roads aged',
      ),
      q(
        'What would show the cameras worked?',
        'Compare with similar high-crash intersections that got no cameras at all',
        'Wait a year',
        'Ask drivers',
      ),
    ],
  };
  const balanced = {
    format: 'choice',
    task: 'Now a new situation: BALANCED speed cameras.',
    questions: [
      q(
        'Why did crashes drop?',
        'A bad year is partly luck that fades',
        'Drivers got more careful in general',
        'Old roads get safer as they age',
      ),
      q(
        'What would show the cameras worked?',
        'Compare similar sites without cameras',
        'Watch the same sites for a few years',
        'Survey drivers about the cameras',
      ),
    ],
  };
  let tries = 0;
  globalThis.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    const text =
      b.task === 'chat'
        ? 'Probably not: a bad game is partly bad luck, so the next one is usually better whatever the coach does.'
        : b.task === 'focusOptions'
          ? JSON.stringify({
              personal: false,
              spot: '',
              options: [
                { label: 'Spotting regression to the mean', mode: 'concept' },
              ],
            })
          : b.task === 'writeTask'
            ? JSON.stringify(++tries === 1 ? lopsided : balanced)
            : '{}';
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ text }),
    };
  };
  await click('Parenting · a meltdown leaving the park');
  await wait(150);
  await ownAll();
  await wait(100);
  await click('Spotting regression to the mean');
  await wait(150);
  globalThis.fetch = offline;
  step(
    'length giveaway: a try where the longest option is right twice is asked for again, and the balanced one is used',
    tries === 2 &&
      text().includes('BALANCED speed cameras') &&
      !text().includes('LOPSIDED'),
  );
  await click('×');
}

// ---- A message too long for the server is named as too long, not as Claude being unreachable.
{
  await click('New chat');
  globalThis.fetch = async () => ({
    ok: false,
    status: 413,
    headers: { get: () => 'application/json' },
    json: async () => ({ error: 'Input too long for this prototype.' }),
  });
  await type(document.querySelector('main textarea'), 'x'.repeat(50));
  await click('↑');
  await wait(150);
  globalThis.fetch = offline;
  step(
    'too long: a 413 says the message is too long, not that the model is unreachable',
    text().includes('That message is too long for this prototype') &&
      !text().includes("couldn't reach the model"),
  );
}

// ---- A people skill is done, not picked: you write what you'd say, it's checked for key moves quoted from your words,
// and a sample is shown after as one way to say it.
{
  await click('New chat');
  const reply =
    "Okay, let's go. I can see you're sad to leave. Do you want to race me to the gate or hop like a frog?";
  let judgeDown = true;
  globalThis.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    if (b.task === 'gapJudge' && judgeDown)
      return {
        ok: false,
        status: 503,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: 'Overloaded' }),
      };
    const text =
      b.task === 'chat'
        ? 'Connect first, then redirect: name the feeling in a few words, then offer a choice about how you leave.'
        : b.task === 'focusOptions'
          ? JSON.stringify({
              personal: false,
              spot: '',
              options: [
                { label: 'Connecting before redirecting', mode: 'concept' },
              ],
            })
          : b.task === 'writeTask'
            ? JSON.stringify({
                orderIsInsight: false,
                format: 'respond',
                task: 'Now a new situation: your 4-year-old is crying because the library is closing. What do you say next?',
                context: '',
                keyPoints: [
                  'Names the feeling briefly',
                  'Offers a choice about how to leave, not whether',
                ],
                keyTopics: ['the feeling', 'what the child gets to choose'],
                sample:
                  'SAMPLE: You love it here. Shall we tiptoe out or walk like giants?',
              })
            : b.task === 'gapJudge'
              ? JSON.stringify({
                  points: [
                    {
                      point: 'Names the feeling briefly',
                      evidence: "I can see you're sad to leave",
                    },
                    { point: 'Offers a choice', evidence: null },
                  ],
                  feedback: 'What could they choose about leaving?',
                })
              : '{}';
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ text }),
    };
  };
  await click('Parenting · a meltdown leaving the park');
  await wait(150);
  await ownAll();
  await wait(100);
  await click('Connecting before redirecting');
  await wait(150);
  const tryText =
    document.querySelector('[data-role=predict-try]')?.textContent || '';
  step(
    'respond: a people skill gets a scenario to act in, checked on key moves named by topic, without the moves or the sample',
    tryText.includes('library is closing') &&
      text().includes('key moves') &&
      tryText.includes('what the child gets to choose') &&
      !text().includes('Offers a choice') &&
      !text().includes('SAMPLE'),
  );
  await predict(1);
  const box = document.querySelector('textarea[data-role=write]');
  step(
    'respond: you write it in your own words, in a prose box, not pick it',
    !!box &&
      box.placeholder.includes("what you'd say or do") &&
      !box.className.includes('font-mono') &&
      !document.querySelector('[data-role=choice-q]'),
  );
  await type(box, reply);
  const ledgerBefore = JSON.parse(
    window.localStorage.getItem('own-it:v1') || '{}',
  ).ledger?.length;
  await click('Check my version');
  await wait(200);
  step(
    "couldn't check: when Claude can't be reached, nothing is scored or recorded; your answer stays and it says so",
    !!document.querySelector('[data-role=check-error]') &&
      text().includes('nothing was scored') &&
      !document.querySelector('[data-role=items]') &&
      document.querySelector('textarea[data-role=write]')?.value === reply &&
      JSON.parse(window.localStorage.getItem('own-it:v1') || '{}').ledger
        ?.length === ledgerBefore,
  );
  judgeDown = false;
  await click('Check my version');
  await wait(200);
  globalThis.fetch = offline;
  step(
    "couldn't check: checking again once Claude is back scores it as your first try",
    !document.querySelector('[data-role=check-error]') &&
      !text().includes('Try 2'),
  );
  const quote = document.querySelector('[data-role=item-quote]');
  step(
    'respond: the reveal quotes your words for the move you made, and marks the one you missed',
    !!quote &&
      quote.textContent.includes('sad to leave') &&
      text().includes('✗') &&
      document.querySelector('[data-role=items]')?.title.includes('key move'),
  );
  const sample = document.querySelector('[data-role=sample]');
  step(
    'respond: a sample is offered after, as one way to say it, closed until you open it',
    !!sample &&
      !sample.open &&
      sample.textContent.includes('One way to say it') &&
      sample.textContent.includes('SAMPLE'),
  );
  await click('×');
}

// ---- A personal topic has no answer key: recognition practice on made-up people, nothing scored (research §13).
{
  await click('New chat');
  const opt = (label, fits) => ({ label, fits, note: `Note on ${label}.` });
  globalThis.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    const text =
      b.task === 'chat'
        ? 'Conviction points at what you did and toward repair; shame says you are bad and pushes you to hide.'
        : b.task === 'focusOptions'
          ? JSON.stringify({
              personal: true,
              spot: 'shame vs conviction',
              options: [
                { label: 'Telling conviction from shame', mode: 'concept' },
              ],
            })
          : b.task === 'spotPractice'
            ? JSON.stringify({
                scenarios: [
                  {
                    text: 'Priya fixed a missed form the same day, but weeks later calls herself a fraud.',
                    prompt: "What's going on?",
                    options: [
                      opt('Shame lingering after repair', true),
                      opt('Conviction still at work', false),
                      opt('Healthy humility', false),
                    ],
                  },
                  {
                    text: 'Marcus snapped at a coworker, apologised the next day and felt settled.',
                    prompt: "What's going on?",
                    options: [
                      opt('Conviction leading to repair', true),
                      opt('Shame about who he is', false),
                    ],
                  },
                ],
              })
            : '{}';
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ text }),
    };
  };
  await click('Health · a bacon and cancer headline');
  await wait(150);
  await ownAll();
  await wait(150);
  step(
    'personal: no focus list or prediction, an unscored offer to practise spotting it',
    text().includes("there's no answer key to test you against") &&
      text().includes('shame vs conviction') &&
      !document.querySelector('[data-role=predict-option]') &&
      !document.querySelector('[data-role=stepper]')?.textContent,
  );
  await click('Practise spotting it');
  await wait(150);
  step(
    'personal: scenarios about made-up people, nothing scored',
    document.querySelectorAll('[data-role=spot-q]').length === 2 &&
      text().includes('Practice, not scored'),
  );
  await click('Conviction still at work');
  await click('Conviction leading to repair');
  step(
    'personal: a pick that fits less well also shows another way to see it',
    text().includes('Note on Conviction still at work.') &&
      text().includes('Another way to see it: Shame lingering after repair'),
  );
  await click('Done');
  await wait(50);
  globalThis.fetch = offline;
  step(
    'personal: the chat says practised, not scored, and no score is shown',
    text().includes('Practised') &&
      text().includes(
        'shame vs conviction · practised 2 scenarios, not scored',
      ) &&
      !/predicted \d/.test(text().split('Practised')[1] || ''),
  );
  await openLearnings();
  const pr = document.querySelector('[data-role=practised]');
  step(
    'personal: Learnings lists it under practised, not scored, with the topic and count only',
    !!pr &&
      pr.textContent.includes('Shame vs conviction') &&
      pr.textContent.includes('Spotted it in 2 scenarios') &&
      !pr.textContent.includes('Priya') &&
      !pr.textContent.includes('Conviction still at work'),
  );
}

// ---- Hybrid SQL check: a query that doesn't run is judged by Claude on the same items, and says so.
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
await ownAll();
await click('The whole query: each part');
await predict(2);
const slipped =
  "SELECT a.name, COALESCE(SUM(b.pages), 0) AS pages\nFROM authors a\nLEFT JOIN ON b.author_id = a.id AND b.status = 'published'\nGROUP BY a.name\nORDER BY pages ASC;";
await type(document.querySelector('textarea[data-role=write]'), slipped);
globalThis.fetch = async (url, opts) => {
  const b = JSON.parse(opts.body);
  const text =
    b.task === 'grade'
      ? JSON.stringify({
          checks: [
            {
              requirement: b.input.requirements[0],
              quoted_evidence: 'LEFT JOIN ON b.author_id',
              met: true,
            },
            {
              requirement: b.input.requirements[1],
              quoted_evidence: 'COALESCE(SUM(b.pages), 0)',
              met: true,
            },
            {
              requirement: b.input.requirements[2],
              quoted_evidence: "AND b.status = 'published'",
              met: true,
            },
            {
              requirement: b.input.requirements[3],
              quoted_evidence: null,
              met: false,
            },
          ],
          score: 3,
          worked: 'x',
          gap: 'x',
        })
      : '{}';
  return { ok: true, status: 200, json: async () => ({ text }) };
};
await click('Check my version');
await wait(500);
globalThis.fetch = offline;
step(
  'hybrid: a query that does not run is judged by Claude on the same 4 items, labelled',
  text().includes("It didn't run, so Claude judged it.") &&
    (text().match(/\(judged by Claude\)/g) || []).length === 4 &&
    text().includes(
      "You said 2 of 4. It didn't run, so Claude judged it from your query: 3 of 4 would be right once it runs.",
    ),
);
step(
  'hybrid: the plain-words syntax fix is still what to fix',
  text().includes('Your JOIN is missing the table it joins'),
);
await click('Back to chat');
await openLearnings();
step(
  'hybrid: the card says the first try was judged by Claude',
  savedLedger().some(e => e.judged && e.actual === 3 && e.n === 4),
);

step(
  'cards: recall and Sam only; history behind a disabled "See history"; no pills or new-question button',
  [
    ...document.querySelectorAll('[data-role=learning], [data-role=due-item]'),
  ].every(
    c =>
      !!c.querySelector('[data-role=teach-sam], [data-role=see-history]') &&
      c.querySelector('[data-role=see-history]')?.title ===
        'Disabled for demo purposes' &&
      !c.textContent.includes('Try a new question') &&
      !c.textContent.includes('Predicted'),
  ),
);
// ---- Teach one from Learnings: explain anything you own to Sam, not only at the end of a try. (Already on Learnings.)
const teachBtn = document.querySelector('[data-role=teach-sam]');
step('learn teach: each Owning card offers Explain it to Sam', !!teachBtn);
await act(async () => {
  teachBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
});
await wait(30);
const learnTeach = () => document.querySelector('[data-role=learn-teach]');
step(
  'learn teach: Sam opens on Learnings, not in a panel',
  !!learnTeach() &&
    !document.querySelector('[data-role=own-panel]') &&
    text().includes('Explaining to Sam above'),
);
const samCalls = [];
globalThis.fetch = async (url, opts) => {
  const b = JSON.parse(opts.body);
  samCalls.push(b);
  const t =
    b.task === 'debrief'
      ? JSON.stringify({
          clear: [
            { quote: 'it owns the side that', text: 'You named who it owns.' },
          ],
          unsure: [
            {
              quote: 'not sure, maybe they',
              question: 'How does it start?',
              topic: 'How a new marketplace gets its first users',
              right: false,
            },
          ],
        })
      : 'Hm, but how does it start?';
  return { ok: true, status: 200, json: async () => ({ text: t }) };
};
for (const line of [
  'it owns the side that customers keep coming back to',
  'not sure, maybe they pay the first suppliers',
  'that is all I know',
]) {
  await type(
    document.querySelector('input[placeholder^="Explain it to Sam"]'),
    line,
  );
  await click('Send');
  await wait(60);
}
globalThis.fetch = offline;
const samReq = samCalls.find(b => b.task === 'sam');
step(
  'learn teach: Sam hears what you own (the answer, or its name), with no gap to steer to',
  !!samReq && !!samReq.input.code && !samReq.input.gap,
);
step(
  'learn teach: after three turns, what teaching Sam showed, quoting you',
  !!learnTeach().querySelector('[data-role=teach-debrief]') &&
    learnTeach().textContent.includes('“it owns the side that”') &&
    !!learnTeach().querySelector('[data-role=teach-gap]'),
);
await click('Save for later');
step(
  'learn teach: the shaky spot is saved as an open gap on the same page',
  learnTeach().textContent.includes('Saved under Open gaps') &&
    document
      .querySelector('[data-role=open-gaps]')
      ?.textContent.includes('How a new marketplace gets its first users'),
);
await click('Done');
step(
  'learn teach: Learnings records that you taught Sam',
  !learnTeach() &&
    savedLedger().some(e => (e.taught || []).some(x => x.gaps === 1)),
);

const reactErrors = errors.filter(e => !e.includes('offline (smoke test)'));
step(
  'no React/runtime errors',
  reactErrors.length === 0,
  reactErrors.slice(0, 3).join(' || '),
);
console.error = origError;
await act(async () => root2.unmount());
await vite.close();
