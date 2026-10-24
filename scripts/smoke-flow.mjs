// Headless end-to-end run of the SQL starter in jsdom, with the API unreachable,
// so every Claude call takes its offline fallback. Run: node scripts/smoke-flow.mjs
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true, url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, getSelection: dom.window.getSelection.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true });
globalThis.fetch = async () => { throw new Error('offline (smoke test)'); };
globalThis.__SQL_WASM_PATH = new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url).pathname;

const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); };

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = React;

const wait = ms => act(() => new Promise(r => setTimeout(r, ms)));
const text = () => document.body.textContent;
const buttons = () => [...document.querySelectorAll('button')];
async function click(label) {
  // Exact label first ("4" must not hit "step 3 of 4"), then any button containing it.
  const b = buttons().find(b => b.textContent.trim() === label) || buttons().find(b => b.textContent.trim().includes(label));
  if (!b) throw new Error(`No button containing "${label}". Buttons: ${buttons().map(b => b.textContent.trim()).join(' | ')}`);
  await act(async () => { b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await wait(30);
}
// The prediction is "how many of N will you get right?": one button per count.
async function predict(k) {
  const b = document.querySelector(`[data-role=predict-option][data-n="${k}"]`);
  if (!b) throw new Error(`No prediction button for ${k}`);
  await act(async () => { b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await wait(30);
}
async function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
async function ownAll(i = -1) {
  const all = [...document.querySelectorAll('button[data-role=own-all]')];
  const b = all.at(i);
  if (!b) throw new Error('No own-all icon');
  await act(async () => { b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await wait(30);
}
async function openLearnings() {
  await act(async () => { document.querySelector('button[data-role=nav-learnings]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await wait(30);
}
function step(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) process.exitCode = 1; }

const root = createRoot(document.getElementById('root'));
await act(async () => root.render(React.createElement(App)));
step('home: greeting, composer without an upfront toggle, typed starters as chips', text().includes('Back at it') && !buttons().some(b => /Learn this too|Just the answer/.test(b.textContent)) && buttons().some(b => b.textContent === 'SQL · revenue per customer'));
step('home: seeded chats are past chats in the sidebar', document.querySelectorAll('[data-role=past-chat]').length === 2);
step('recall: an item from a few days ago is ready, shown on Learnings', document.querySelector('[data-role=recall-badge]')?.getAttribute('aria-label') === '1 to recall');

await click('SQL · revenue per customer');
await wait(50);
step("SQL starter is Claude's real answer, rendered as Claude renders it", text().includes('The key detail is putting the') && text().includes('GROUP BY c.id, c.name') && text().includes('Tie-breaking:') && !!document.querySelector('main ul'));

step('one-time tip on the first answer explains how to own', !!document.querySelector('[data-role=own-tip]') && text().includes('Want to actually learn part of this?'));
step('own-all is an icon with a tooltip, no text', (() => { const b = document.querySelector('button[data-role=own-all]'); return b && !b.textContent.trim() && b.getAttribute('aria-label') === 'Own the whole query'; })());
await ownAll();
step('owning a whole answer asks what to own, hand-written targets first', text().includes('What do you want to own here?') && text().includes('The whole query') && text().includes('When to use LEFT vs INNER'));
step('tip goes away once you own something', !document.querySelector('[data-role=own-tip]'));
step('panel: no copy of Claude\'s text; the whole reply is marked as being owned in the chat', document.querySelectorAll('[data-msg-id][data-owning=whole]').length === 1 && !document.querySelector('[data-role=own-panel] pre') && text().includes('Reread it in your chat'));
step('panel: Own it opens on the side, chat stays visible, chip marks it', !!document.querySelector('[data-role=own-panel]') && !!document.querySelector('[data-role=own-chip]') && !!document.querySelector('main pre'));
await click('The whole query');
step('predict: names the focus, and asks how many of N you will get right', text().includes('Owning: The whole query') && text().includes('How many of these 4 will you get right on your own?') && text().includes('Next: a new query, checked for 4 things') && document.querySelectorAll('[data-role=predict-option]').length === 5);
await act(async () => { document.querySelector('button[data-role=change-focus]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(50);
step('"change" reopens the focus question', text().includes('What do you want to own here?') && text().includes('When to use LEFT vs INNER'));
await click('The whole query');

await predict(0); // 0 of 4 on a focus where the written order is the insight → Arrange warm-up first
await wait(50);
step('framework: whole query + low prediction → Arrange warm-up first, with the decoy', text().includes('A warm-up, not scored') && text().includes('warming up with the pieces') && buttons().some(b => b.textContent.trim() === "WHERE o.status = 'paid'"));
await click("WHERE o.status = 'paid'");
await click('Check order');
await wait(50);
step('arrange: the decoy gets feedback', text().includes("NULL = 'paid'"));
await click("WHERE o.status = 'paid'"); // take it back out
for (const line of ['SELECT c.id, c.name, COALESCE(SUM(o.total), 0) AS revenue', 'FROM customers c', 'LEFT JOIN orders o ON o.customer_id = c.id', "AND o.status = 'paid'", 'GROUP BY c.id, c.name', 'ORDER BY revenue DESC;']) await click(line);
await click('Check order');
step('arrange: the lines of Claude\'s real query, in order', text().includes("why does status = 'paid' live in ON rather than WHERE?"));
await click('Now write one yourself');
await wait(50);
step('then the try, the only part that is measured', text().includes('total pages per author') && !!document.querySelector('textarea[data-role=write]'));
step('the warm-up and the visual stay available as optional links', !!document.querySelector('[data-role=refresher]') && text().includes('See it visually') && text().includes('Warm up with the pieces'));
step('reread points back to the chat', !!document.querySelector('button[data-role=reread]'));
await click('Stuck? Ask Claude in the chat');
step('stuck: the chat composer gets your try as context, and the question is left to you', (() => { const v = document.querySelector('main textarea')?.value || ''; return v.startsWith('About my try on') && v.includes('total pages per author') && !/stuck|Can you|nudge/i.test(v) && v.endsWith('\n\n'); })());
await act(async () => { const el = document.querySelector('main textarea'); const set = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set; set.call(el, ''); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
await click('See it visually');
step('visual: the clause-by-clause run-through', text().includes('FROM customers c') && text().includes('6 rows'));
let n = 0;
while (buttons().some(b => b.textContent.includes('Next step')) && n++ < 20) await click('Next step');
await click('Got it, now write one yourself');
await wait(50);
step('back from the visual to the try', text().includes('total pages per author'));
await click('Give me a hint');
await wait(50);
step('write it: hint (fallback)', text().includes('Hint 1'));
const attempt = "SELECT a.name, COALESCE(SUM(b.pages), 0) AS pages\nFROM autors a\nLEFT JOIN books b ON b.author_id = a.id AND b.status = 'published'\nGROUP BY a.name\nORDER BY pages DESC;";
await type(document.querySelector('textarea[data-role=write]'), attempt);
await click('Check my version');
await wait(400);
step('whole query: executed, correct answer gets 4 of 4', text().includes('You got 4') && text().includes('exactly the right 4 rows') && document.querySelectorAll('[data-role=items] > div').length === 4);
step('typo forgiven with a note', text().includes('Read “autors” as “authors”. Typos don') );
step('reveal shows predicted vs actual, in the same units', text().includes('You said 0 of 4') && text().includes('You said 0 of 4, and got 4'));
step('ledger got an entry', text().includes("The whole query: each part and why it's in that order") && text().includes('You said 0 of 4'));
step('reveal: says it was saved and when it comes back', !!document.querySelector('[data-role=saved-line]') && text().includes('It comes back for a quick recall in 3 days'));
step('on your version: notes on how you wrote it, quoting your query', !!document.querySelector('[data-role=notes]') && text().includes('Grouping by name alone would merge two people') && text().includes('COALESCE turns the NULL') && !text().includes('Reading how you wrote it'));

await click('Optional: explain it to Sam');
step('teach: Sam opens', text().includes("I've never done this before"));
await type(document.querySelector('input[placeholder^="Explain it to Sam"]'), 'It totals paid orders per customer and keeps customers with none.');
await click('Send');
await wait(50);
step('teach: Sam replies (fallback)', document.querySelectorAll('span').length > 0 && text().includes('Hm ok'));
await click('Done, back to chat');
step('own card collapses to summary', text().includes('Owned') && text().includes('taught Sam'));


// ---- Second run: highlight only the LEFT JOIN line (the case that used to land on a 2-piece Assemble).
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
const sel = 'LEFT JOIN orders o ON o.customer_id = c.id';
const realGetSelection = window.getSelection;
window.getSelection = () => ({ toString: () => sel, removeAllRanges() {} });
await act(async () => { document.querySelector('main [data-msg-id] > div').dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 100 })); });
await click('Own it');
window.getSelection = realGetSelection;
step('panel: owning a highlight marks that part in the chat, no copy in the panel', document.querySelectorAll('[data-msg-id][data-owning=part]').length === 1 && text().includes('See the highlighted part in your chat'));
step('fragment: focus offers concept options first', text().includes('What do you want to own here?') && buttons().findIndex(b => b.textContent.includes('LEFT vs INNER')) < buttons().findIndex(b => b.textContent.includes("goes in ON")));
await click('When to use LEFT vs INNER');
await predict(0);
await wait(50);
step('fragment: straight to the try, with the comparison as an optional visual', text().includes("list every order with its customer's name") && text().includes('See it visually'));
await click('See it visually');
step('one progress indicator, no extra step pills: the visual is part of "Try it"', !buttons().some(b => /^(Read|See|Assemble|Compare|Write) it$/.test(b.textContent.trim())) && text().includes('seeing it visually'));
step('fragment: compare opens with the idea card as a refresher (open after a low prediction)', text().includes('only decides what happens to the rows that don') && text().includes('In your query') && text().includes('Rule of thumb') && text().includes('kept, with NULLs') && !/\b[456] rows\b/.test(text().slice(text().indexOf('Rule of thumb'))));
step('compare: source tables + first case', text().includes('How many rows come back?') && text().includes('INNER JOIN') && text().includes('customer_id'));
await click('4'); // INNER → 4 (right)
step('compare: INNER reveals 4 rows', text().includes('You guessed 4. Right: 4 rows.'));
await click('Next case');
await click('4'); // LEFT → 5 (wrong guess)
step('compare: LEFT reveals 5 rows', text().includes("You guessed 4. It's 5 rows."));
await click('Next case');
await click('6'); // RIGHT → 6
step('compare: RIGHT reveals 6 rows', text().includes('You guessed 6. Right: 6 rows.'));
await click('Got it, now write one yourself');
await wait(50);
step('fragment write: transfer task with scaffold', text().includes('list every order with its customer') && document.querySelector('pre') && text().includes('SELECT o.id, o.total, c.name'));
await click('Give me a hint');
step('fragment write: authored hint', text().includes('This time, which table has to keep every one of its rows?'));
// The classic mistake: copy "customers first" from the original query.
await type(document.querySelector('textarea[data-role=write]'), 'FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id');
await click('Check my version');
await wait(400);
step('fragment write: copy mistake diagnosed, 0 of 2, the owned idea named', text().includes('You got 0') && text().includes('this time every order has to stay') && text().includes('the idea you came to own'));
step('reveal explains the result and how it was checked', text().includes("It runs, but the rows it returns aren't the ones the task asks for.") && !!document.querySelector('[title^="Checked by running your query"]'));
step('reveal shows your rows vs expected, marked', text().includes('What yours returns') && text().includes('What it should return') && text().includes('highlighted rows: yours is missing them'));
step('fragment: reveal credits compare guesses', text().includes('2 of 3 guesses right'));
step('fragment: ledger names the focus', text().includes('When to use LEFT vs INNER vs RIGHT JOIN'));
step('own icon stays visible, shown active while its panel is open', (() => { const bs = [...document.querySelectorAll('button[data-role=own-all]')]; return bs.length > 0 && bs.at(-1).getAttribute('aria-pressed') === 'true'; })());
await click('Ask Claude about this');
step('reveal: "Ask Claude about this" prefills a chat follow-up with your attempt and the gap', (() => { const v = document.querySelector('main textarea')?.value || ''; return v.includes('> My answer: ') && v.includes('FROM customers c') && v.includes('> The check said: ') && v.includes('every order has to stay') && !/Can you help|Don't just give/.test(v); })());
await click('↑'); // send it: it goes to the chat, not the panel
await wait(50);
step('the follow-up lands in the chat while the panel stays open', [...document.querySelectorAll('main div')].some(d => d.textContent.startsWith('About my try on')) && !!document.querySelector('[data-role=own-panel]'));
// Fix it: back to your own attempt, as you left it; the first try stays the measurement.
await click('Fix it');
const kept = document.querySelector('textarea[data-role=write]');
step('fix: your attempt is still there to edit', kept && kept.value === 'FROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id' && text().includes('Fixing it · try 2') && text().includes('What to fix:'));
await type(kept, 'FROM orders o\nLEFT JOIN customers c ON c.id = o.customer_id');
await click('Check my version');
await wait(400);
step('fix: try 2 passes, prediction still measured against try 1', text().includes('Try 2: 2 of 2, fixed') && text().includes('measured against your first try (0 of 2)') && text().includes('You got 0') && !buttons().some(b => b.textContent === 'Fix it'));
await click('Back to chat');

// ---- You go first: a new question that needs what you owned. Claude offers you the first try.
await click('New chat');
step('sidebar has no ledger; home has no go-first chips (Learnings holds it all)', !text().includes('what you chose to own') && !text().includes('New questions that use what you own'));
await openLearnings();
step('learnings: a fix shows next to the first try', (document.querySelector('[data-role=learnings]')?.textContent || '').includes('Fixed2 of 2'));
await click('Try a new question · orders per customer');
step('go first: Claude offers the first try instead of answering', !!document.querySelector('[data-role=go-first]') && text().includes("Want to go first? I'll check yours") && !text().includes('COUNT(o.id) AS orders'));
await click("I'll go first");
await click('2'); // predicted 2 of 3
await type(document.querySelector('textarea[data-role=go-text]'), 'SELECT c.name, COUNT(*)\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;');
await click('Check mine');
await wait(400);
step('go first: checked by running it, classic COUNT(*) slip explained', text().includes('You said 2 of 3 and got 2. Spot on.') && text().includes('Dee shows 1 instead of 0'));
step("go first: then Claude shows its answer", text().includes('COUNT(o.id) AS orders'));
await openLearnings();
step('go first: Learnings records it as real work', text().includes('went first, 2 of 3'));

// ---- Third run: leave halfway. "Back to chat" must be on every screen of the card.
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
window.getSelection = () => ({ toString: () => sel, removeAllRanges() {} });
await act(async () => { document.querySelector('main [data-msg-id] > div').dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 100 })); });
await click('Own it');
window.getSelection = realGetSelection;
step('leave: exit offered on focus screen', !!document.querySelector('button[data-role=leave]'));
await click('When to use LEFT vs INNER');
await predict(0);
step('leave: exit offered mid-ladder', !!document.querySelector('button[data-role=leave]'));
await act(async () => { document.querySelector('button[data-role=leave]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(30);
step('leave: card closes, chat notes where you stopped', !document.querySelector('button[data-role=leave]') && text().includes('Outsourced') && text().includes('stopped at Write it'));
await openLearnings();
step('leave: exit kept as data on Learnings, not scored', text().includes('You wanted to learn, then stepped away') && text().includes('predicted 0 of 2 · left at Write it (2 of 2)'));

// ---- Fourth run: a part with no hand-written target (ORDER BY) must get options about itself.
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
window.getSelection = () => ({ toString: () => 'ORDER BY revenue DESC;', removeAllRanges() {} });
await act(async () => { document.querySelector('main [data-msg-id] > div').dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 100 })); });
await click('Own it');
window.getSelection = realGetSelection;
await wait(100);
const focusLabels = buttons().map(b => b.textContent.trim()).filter(t => /concept|structure$/.test(t));
step('unmatched part: options name it, no unrelated join options', focusLabels[0]?.includes('ORDER BY revenue DESC') && !focusLabels.some(t => /JOIN|ON, not WHERE/.test(t)), focusLabels.join(' | '));
await click('What ORDER BY');
await wait(50);
step('unmatched part: the prediction names the try it fits (explain, not "write code")', text().includes('Will you get it right on your own?') && text().includes('Next: one question in your own words'));
await predict(0);
await wait(200);
step('unmatched part: straight to the try (no hand-written visual for it)', !!document.querySelector('button[data-role=leave]') && !!document.querySelector('textarea[data-role=write]') && !text().includes('See it visually'));

// ---- Fifth run: the book starter. Same framework, no code: calculated check, no Assemble.
await click('New chat');
await click('Rule of Five');
await wait(50);
step('book: replays the real transcript, both turns', text().includes('Are you familiar with the book') && text().includes('a median is always in between the smallest and largest values no?') && text().includes('The Rule of Five is about the population’s true median'));
step('book: each answer rendered once', document.querySelectorAll('main [data-msg-id]').length === 2 && (text().match(/Core ideas:/g) || []).length === 1);
step('book: every answer has the own icon', document.querySelectorAll('button[data-role=own-all]').length === 2);
// A part of the first answer that isn't about the Rule of Five must not get Rule of Five options.
window.getSelection = () => ({ toString: () => 'calibrated estimation (training people to give realistic confidence intervals)', removeAllRanges() {} });
await act(async () => { document.querySelector('main [data-msg-id] > div').dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 100 })); });
await click('Own it');
window.getSelection = realGetSelection;
await wait(100);
const bookOpts = buttons().map(b => b.textContent.trim()).filter(t => /concept|structure$/.test(t));
step('book: unrelated highlight gets options about itself', bookOpts.length > 0 && bookOpts.every(t => !/Rule of Five|population/.test(t)) && bookOpts[0].includes('calibrated estimation'), bookOpts.join(' | '));
await act(async () => { document.querySelector('button[data-role=leave]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(30);
await ownAll();
step('book: owning a whole long answer asks what to own', text().includes('What do you want to own here?'));
await click('The Rule of Five: why a few random samples usually catch the median');
step('book: focus picked', text().includes('Owning: The Rule of Five: why a few random samples usually catch the median'));
step('book: predict says the try comes next', text().includes("Claude's answer is your material"));
await predict(0);
await wait(50);
step('book: starts at the test even at 0, refresher offered', text().includes('4 random support calls') && !!document.querySelector('[data-role=refresher]'));
await click('See it visually');
step('book: the visual sits inside "Try it", no extra step pills', !buttons().some(b => /^(Read|See|Assemble|Compare|Write) it$/.test(b.textContent.trim())) && text().includes('seeing it visually'));
step('book: idea card as refresher, no line-by-line', text().includes('The true median is a hidden line') && text().includes('In your question') && !text().includes('Line by line'));
await click('100%'); // your sample's own median → 100 (right)
step('book: compare reveals the obvious case', text().includes('You guessed 100%. Right: 100%.') && text().includes("not what the rule claims"));
await click('Next case');
await click('50%');
await click('Next case');
await click('≈ 94%'); // 3 samples → 75 (wrong guess)
step('book: compare shows the pattern picture', document.querySelectorAll('[data-role=patterns] span').length === 8 && text().includes('2 of 8 equally likely patterns miss'));
await click('Next case');
await click('≈ 94%');
step('book: five samples, 32 patterns', document.querySelectorAll('[data-role=patterns] span').length === 32 && text().includes('Right: 93.75%'));
await click('Got it, now write one yourself');
step('book: transfer task is new (4 calls)', text().includes('4 random support calls'));
step('book: the try asks about the reasoning, not a percentage', text().includes('How likely is your shortest-to-longest range') && !document.querySelector('textarea[data-role=write]'));
await click('Certain: a median is always between the min and max'); // her original confusion
await click('A little less likely to catch it');
await click('All 4 calls could happen to be longer');
await click('Check my version');
await wait(100);
step('book: her original confusion is recognised and explained, 2 of 3', text().includes('You got 2') && text().includes("That's true of your 4 calls' own median") && !!document.querySelector('[title^="Checked against the answer key"]'));
step('book: compare guesses credited', text().includes('3 of 4 guesses right'));
await click('Optional: explain it to Sam');
step('book: Sam asks your own question', text().includes("Isn't the median always between the smallest and the biggest number?"));
await click('Done, back to chat');

// ---- Sixth run: the Juno starter. Interpretive topic, "chosen" check.
await click('New chat');
await click('aggregation theory');
await wait(50);
step('juno: replays the real chat with the company renamed', text().includes('I\'m trying to prep for a meeting') && text().includes('wouldnt juno want to own both?') && !/\bmedium\b/i.test(text()));
step('juno: filled-in turns present, remaining gap marked', text().includes('how exactly are they doing this?') && text().includes('reviews or nyt bestsellers etc also helped.') && [...document.querySelectorAll('div')].filter(d => d.textContent.startsWith('Earlier turns aren’t shown')).length === 1);
step('juno: each answer rendered once, as prose', document.querySelectorAll('main [data-msg-id]').length === 8);
step('juno: every answer has the own icon', document.querySelectorAll('button[data-role=own-all]').length === 8);
await ownAll();
await click('Which side an aggregator owns');
step('juno: focus picked', text().includes('Owning: Which side an aggregator owns, and why not both'));
await predict(0);
await wait(50);
step('juno: starts at the test', text().includes('Vela (made up)') && !!document.querySelector('[data-role=refresher]'));
await click('See it visually');
step('juno: idea card speaks to your question', text().includes('The asymmetry is the point') && text().includes('You asked whether Juno would want to own both'));
await click('Users stay'); // Airbnb → stay (right)
step('juno: compare reveals and draws who owns whom', !!document.querySelector('[data-role=own-diagram]') && text().includes('You guessed users stay. Right: users stay.'));
await click('Next case'); await click('Users stay');
await click('Next case'); await click('Users follow the supplier'); // hairdresser → follow (right)
step('juno: hairdresser case, clients follow the person', text().includes('Right: users follow the supplier.') && text().includes('loyal to the person, not the building'));
await click('Next case'); await click('Users stay'); // Substack → follow (wrong)
step('juno: Substack is the opposite bet', text().includes("It's users follow the supplier.") && text().includes('(plumbing)'));
await click('Next case'); await click('Users stay');
await click('Got it, now write one yourself');
step('juno: transfer task is a made-up company', text().includes('Vela (made up)') && document.querySelectorAll('[data-role=choice-q]').length === 3);
await click('Both users and trainers, equally'); // her original instinct
await click('Stay on Vela and train with someone else');
await click('Vela, because any one trainer is replaceable');
await click('Check my version');
await wait(50);
step('juno: "own both" diagnosed with the Airbnb test, 2 of 3', text().includes('You got 2') && text().includes('Test it like Airbnb: if one trainer left') && !!document.querySelector('[title^="Checked against the answer key"]'));
await click('Optional: explain it to Sam');
step('juno: Sam asks your question', text().includes("wouldn't it want both of them to love it?"));
// Christine's real explanation, including the moment she wasn't sure.
const teachInput = () => document.querySelector('input[placeholder^="Explain it to Sam"]');
await type(teachInput(), 'yes, of course we want both to love juno, but we want to commoditize editorial excellence such that if one writer leaves it isnt a huge negative against Juno.');
await click('Send'); await wait(30);
await type(teachInput(), 'well if we have readers, writers will want to reach them. if we have good writers, we will attract interested readers. its a positive feedback loop.');
await click('Send'); await wait(30);
await type(teachInput(), "hm, i'm not really sure but i would guess we'd need writers first");
await click('Send'); await wait(80);
step('teach: ends with what teaching showed, not just thanks', !!document.querySelector('[data-role=teach-debrief]') && text().includes('What teaching Sam showed') && text().includes('You explained clearly'));
step('teach: the hedge becomes a gap you didn\'t know you had', !!document.querySelector('[data-role=teach-gap]') && text().includes("You weren't sure") && text().includes("i would guess we'd need writers first") && text().includes("a gap you didn't know you had"));
await click('Save for later');
step('teach: the gap can be saved', text().includes('✓ Saved to Learnings'));
await openLearnings();
step('gaps: an open gap waits on Learnings, with where it came from and your words', !!document.querySelector('[data-role=open-gap]') && text().includes('while you were explaining') && text().includes("i would guess we'd need writers first"));
await click('Explore it with Claude');
await wait(80);
step('gaps: exploring opens a new chat about just that gap, with the goal in view', !!document.querySelector('[data-role=gap-banner]') && text().includes('Closing a gap') && text().includes('I want to close a gap:'));
step('gaps: Claude starts from your guess and explains (offline: the hand-written cold-start answer)', text().includes('one side usually has to come first') && text().includes('Seed one side yourself'));
step('gaps: the banner is context only; "check me" is a suggested reply under Claude\'s latest answer', !document.querySelector('[data-role=gap-banner] button') && !!document.querySelector('[data-role=gap-check-chip]'));
await click("I think I've got it: check me");
await wait(30);
step('gaps: checking yourself is the next turn of the chat', [...document.querySelectorAll('main div')].some(d => d.textContent === "I think I've got it. Check me.") && !document.querySelector('[data-role=gap-check-chip]'));
step('gaps: the check asks you to explain and apply, not recite', text().includes('Before we call it closed:') && text().includes('Name at least one concrete move'));
await type(document.querySelector('textarea[data-role=gap-answer]'), "neither side shows up while the other is empty, so it's chicken and egg. Juno should seed writers first, maybe pay or invite a small group, so there's something worth reading.");
await click('Check my answer');
await wait(50);
step('gaps: closed when both key ideas are there', text().includes('✓ Gap closed') && text().includes("It's now in what you own"));
await openLearnings();
step('gaps: a closed gap becomes something you own, not an open gap', !document.querySelector('[data-role=open-gap]') && text().includes('Gap found') && text().includes('checked ✓'));
await click('New chat');

// ---- You go first, outsourced: "just answer this time" is a fine choice, and it's noted.
await click('New chat');
await openLearnings();
step('go first: every owned topic offers its new question on Learnings', ['orders per customer', '6 timed checkouts', 'a top writer wants a bigger cut'].every(l => buttons().some(b => b.textContent.includes('Try a new question · ' + l))));
await click('Try a new question · a top writer wants a bigger cut');
await click('Just answer this time');
step('go first: outsourcing gets the answer straight away, and is noted', text().includes('that you let me take this one') && text().includes('Less worried than it feels'));
await openLearnings();
step('go first: Learnings notes you let Claude answer', text().includes('let Claude answer'));

// ---- React: Claude's real answer, and the cleanup's timing as a timeline you step through.
await click('New chat');
await click('React · fetch on mount');
await wait(50);
step('react: replays Claude\'s real answer, rendered (code blocks, headings, bullets)', text().includes('controller.abort()') && text().includes('How it works') && text().includes('TanStack Query') && document.querySelectorAll('main pre').length === 2 && !!document.querySelector('main ul'));
// Highlighting offers "Ask Claude" (explain, in the chat) next to "Own it" (test yourself).
window.getSelection = () => ({ toString: () => 'AbortError is expected when you cancel', removeAllRanges() {} });
await act(async () => { document.querySelector('main [data-msg-id] > div').dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 100 })); });
window.getSelection = realGetSelection;
step('highlight: offers Ask Claude next to Own it', !!document.querySelector('[data-role=ask-sel]') && !!document.querySelector('#own-sel-btn'));
await act(async () => { document.querySelector('[data-role=ask-sel]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(20);
step('highlight: Ask Claude quotes it into the chat to ask about', (document.querySelector('main textarea')?.value || '').startsWith('About this part of your answer:\n> AbortError is expected when you cancel'));
// "Check it landed": ask Claude to explain the cleanup line; the explanation offers a check. (One stand-in reply.)
window.getSelection = () => ({ toString: () => 'return () => controller.abort();', removeAllRanges() {} });
await act(async () => { document.querySelector('main [data-msg-id] > div').dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 100 })); });
window.getSelection = realGetSelection;
await act(async () => { document.querySelector('[data-role=ask-sel]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(20);
await act(async () => { const el = document.querySelector('main textarea'); const set = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set; set.call(el, el.value + 'can you explain this more, how is this working?'); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
const offline = globalThis.fetch;
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ text: 'The cleanup function runs before the next effect and on unmount…' }) });
await click('↑');
await wait(80);
globalThis.fetch = offline;
step('own it: the icon under an explanation you asked for expands into the button', !!document.querySelector('button[data-role=own-all][data-expanded]') && text().includes('The cleanup function runs before the next effect'));
step('own it: one control per answer — the expanded button replaces the icon, never both', (() => { const msg = [...document.querySelectorAll('main [data-msg-id]')].at(-1); return msg.querySelectorAll('button[data-role=own-all]').length === 1 && !!msg.querySelector('button[data-role=own-all][data-expanded]'); })());
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ text: 'Here it is as a custom hook: useUser(userId)…' }) });
await act(async () => { const el = document.querySelector('main textarea'); const set = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set; set.call(el, 'make it a custom hook'); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
await click('↑');
await wait(80);
globalThis.fetch = offline;
step('own it: a do-this request (not a learning one) keeps the quiet icon', (() => { const msg = [...document.querySelectorAll('main [data-msg-id]')].at(-1); return msg.textContent.includes('custom hook') && !msg.querySelector('button[data-role=own-all][data-expanded]'); })());
await openLearnings();
step('check it landed: saved under "You asked about" on Learnings', !!document.querySelector('[data-role=asked-about]') && text().includes('When the cleanup runs'));
await click('Own it');
await wait(50);
step('one action, one name: the chip is "Own it" too, and the owned answer\'s icon shows it', [...document.querySelectorAll('button[data-role=own-all]')].some(b => b.getAttribute('aria-pressed') === 'true') && text().includes('Own it · When the cleanup runs'));
step('check it landed: Own-it on what you asked, no focus question, matched to the hand-written target', !!document.querySelector('[data-role=own-panel]') && text().includes('Owning: When the cleanup runs') && !text().includes('What do you want to own here?') && text().includes('How many of these 3 will you get right on your own?'));
await act(async () => { document.querySelector('button[data-role=leave]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(20);
step('check it landed: once checked, it leaves "You asked about" and the chip goes', !document.querySelector('button[data-role=own-all][data-expanded]'));
// Highlight the cleanup line: the timing focus comes first.
window.getSelection = () => ({ toString: () => 'return () => controller.abort();', removeAllRanges() {} });
await act(async () => { document.querySelector('main [data-msg-id] > div').dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 100 })); });
await click('Own it');
window.getSelection = realGetSelection;
await wait(100);
step('react: highlighting the cleanup offers "when the cleanup runs" first', (buttons().map(b => b.textContent.trim()).filter(t => /concept|structure$/.test(t))[0] || '').startsWith('When the cleanup runs'));
await click('When the cleanup runs');
await predict(0);
await wait(50);
step('react: straight to the try — reasoning about timing on a new case, not writing a component', text().includes('SearchResults') && text().includes('what happens first?') && text().includes('See it visually') && !document.querySelector('textarea[data-role=write]'));
await click('See it visually');
step('react: the timeline is the visual inside "Try it"', (document.querySelector('[data-role=stepper]')?.textContent || '').includes('Try it'));
step('react: see it is the timing timeline, with the app it happens in', !!document.querySelector('[data-role=effect-timeline]') && !!document.querySelector('[data-role=mini-app]') && text().includes('You click Ada (userId = 1)'));
for (let k = 0; k < 3; k++) await click('Next →');
step('react: each click shows the cycle, cleanup in the middle', (document.querySelector('[data-role=cycle]')?.textContent || '').includes('Cleanup of run #1: controller.abort()'));
await click('Next →');
step('react: on the quick click, cleanup cuts off Bo\'s request', text().includes("cuts off Bo's request"));
for (let k = 0; k < 2; k++) await click('Next →');
step('react: asks before revealing', text().includes("Bo's slow request would have finished now") && buttons().find(b => b.textContent === 'Next →')?.disabled);
await click('Bo');
step('react: reveal explains the abort', text().includes("You said Bo. It's Cy.") && text().includes('It was cut off at ✂'));
await click('Next →');
await click('Break it: no cleanup');
for (let k = 0; k < 2; k++) await click('Next →');
step('react: breaking it shows the wrong user on the card', text().includes('You clicked Cy, but the card shows Bo') && text().includes('Wrong user: you clicked Cy'));
await click('Got it, now write one yourself →');
step('react: then back to the try', text().includes('SearchResults'));
await click('×');

// ---- Recall: what you owned comes back. The seeded item first, then things owned today after skipping ahead.
await act(async () => { document.querySelector('button[data-role=nav-learnings]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(30);
const dueTitles = () => [...document.querySelectorAll('[data-role=due-item]')].map(d => d.textContent);
step('recall: the Rule of Five item from your book chat is ready, owned 3 days ago', dueTitles().length === 1 && dueTitles()[0].includes('The Rule of Five') && dueTitles()[0].includes('owned 3 days ago'));
await click('Recall now');
step('recall: a new case, from memory', text().includes('6 random houses'));
step('recall: questions about the reasoning, not the arithmetic', text().includes('how likely is your cheapest-to-priciest range') && text().includes('When would your range miss') && text().includes('Which of these would break the rule?'));
await click('More likely');
await click('Only if all 6 houses are above it');
await click('You only looked at houses at the expensive end');
await click('Check it');
await wait(50);
step('recall: then vs now, and when it comes back', text().includes('First try, 3 days ago: 2 of 3 → today: 3 of 3') && text().includes('It stuck.') && text().includes('Next recall in 7 days'));
await click('Done');
step('recall: nothing else due yet, so the indicator goes', !document.querySelector('[data-role=recall-badge]'));
await click('⏩ Skip ahead 3 days');
step('recall: 3 days later, what you owned today comes due', dueTitles().length >= 3 && /to recall$/.test(document.querySelector('[data-role=recall-badge]')?.getAttribute('aria-label') || ''));
const sqlDue = [...document.querySelectorAll('[data-role=due-item]')].find(d => d.textContent.includes('When to use LEFT vs INNER'));
await act(async () => { [...sqlDue.querySelectorAll('button')].find(b => b.textContent.includes('Recall now')).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(30);
step('recall: SQL recall keeps the scaffold', text().includes('customers who have never placed an order') && text().includes('WHERE o.id IS NULL'));
await type(document.querySelector('textarea[data-role=recall-text]'), 'FROM customers c JOIN orders o ON o.customer_id = c.id');
await click('Check it');
await wait(400);
step('recall: a slip brings it back sooner, run and explained', text().includes('→ today: 0 of 2') && text().includes('come back sooner') && text().includes('Next recall in 1 day'));
await click('Done');
const gapDue = [...document.querySelectorAll('[data-role=due-item]')].find(d => d.textContent.includes('cold start'));
step('recall: the closed gap comes back too', !!gapDue);
await act(async () => { [...gapDue.querySelectorAll('button')].find(b => b.textContent.includes('Recall now')).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(30);
step('recall: a closed gap comes back as a new case to apply it to', text().includes('marketplace that connects local tutors with students'));
await type(document.querySelector('textarea[data-role=recall-text]'), "it's chicken and egg: no tutors without students and no students without tutors. I'd recruit a small group of tutors first, maybe at one school.");
await click('Check it');
await wait(50);
step('recall: still closed', text().includes('Still closed.'));

// ---- Learnings page: everything you chose to own, from the sidebar.
await act(async () => { document.querySelector('button[data-role=nav-learnings]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(30);
step('learnings: opens from the sidebar, lists what you own with its history', !!document.querySelector('[data-role=learnings]') && document.querySelectorAll('[data-role=learning], [data-role=due-item]').length >= 4 && text().includes('First try') && text().includes('went first, 2 of 3'));
step('learnings: shows what you stepped away from, and a labeled sample history', text().includes('You wanted to learn, then stepped away') && text().includes('sample history, mocked'));
await click('Try a new question · 6 timed checkouts');
step('learnings: revisit by trying a new question', !document.querySelector('[data-role=learnings]') && text().includes('I timed 6 random checkout transactions'));

// ---- Calibration counts the same things it predicts; a blank answer is never right.
await click('New chat');
await click('aggregation theory');
await wait(50);
await ownAll();
await click('Which side an aggregator owns');
step('calibration: the prediction is how many of the 3 questions you will get right', text().includes('How many of these 3 will you get right on your own?') && document.querySelectorAll('[data-role=predict-option]').length === 4);
await predict(3);
await click('Stay on Vela and train with someone else'); // one right answer; the other two left blank
await click('Check my version');
await wait(50);
step('calibration: 1 right and 2 blank is 1 of 3, never "line up" with a prediction of 3', text().includes('You said 3 of 3, and got 1') && (text().match(/\(left blank\)/g) || []).length === 2 && !text().includes('accurate here'));
await click('Back to chat');

// ---- Saved in this browser: a refresh keeps what you own and when it comes back.
await openLearnings();
const ownedBefore = document.querySelectorAll('[data-role=learning], [data-role=due-item]').length;
const calBefore = document.querySelector('[data-role=calibration]')?.textContent || '';
await act(async () => root.unmount());
const root2 = createRoot(document.getElementById('root'));
await act(async () => { root2.render(React.createElement(App)); });
await wait(50);
await openLearnings();
step('saved: after a reload, Learnings still has everything you own, with calibration', ownedBefore > 1 && document.querySelectorAll('[data-role=learning], [data-role=due-item]').length === ownedBefore && (document.querySelector('[data-role=calibration]')?.textContent || '') === calBefore && calBefore.includes('Calibration, across'), `${ownedBefore} → ${document.querySelectorAll('[data-role=learning], [data-role=due-item]').length} · ${calBefore.slice(0, 60)}`);
step('saved: the demo clock survives a reload too', /it's \d+ days later/.test(text()));
window.confirm = () => true;
await act(async () => { document.querySelector('[data-role=reset-demo]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(30);
await openLearnings();
step('saved: Reset demo goes back to the starting state', document.querySelectorAll('[data-role=learning], [data-role=due-item]').length === 1 && !/it's \d+ days later/.test(text()), `${document.querySelectorAll('[data-role=learning], [data-role=due-item]').length} items`);

// ---- You go first, when you ask again: a new chat's question that needs something you own.
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
await ownAll();
await click('The whole query: each part');
await predict(4);
await type(document.querySelector('textarea[data-role=write]'), "SELECT a.name, COALESCE(SUM(b.pages), 0) AS pages\nFROM authors a\nLEFT JOIN books b ON b.author_id = a.id AND b.status = 'published'\nGROUP BY a.name\nORDER BY pages DESC;");
await click('Check my version');
await wait(500);
await click('Back to chat');
await click('New chat');
const asked = [];
globalThis.fetch = async (url, opts) => { const b = JSON.parse(opts.body); asked.push(b.task); const text = b.task === 'goFirstMatch' ? '{"match": 1}' : b.task === 'goFirstCompare' ? 'You started from **products**, which keeps every one.' : 'Start FROM products and LEFT JOIN the reviews.'; return { ok: true, status: 200, json: async () => ({ text }) }; };
await act(async () => { const el = document.querySelector('main textarea'); const set = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set; set.call(el, 'Write me SQL: every product with its number of reviews, including products with none.'); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
await click('↑');
await wait(120);
step('go first on ask: Claude offers the first try, with its answer held back', !!document.querySelector('[data-role=go-ask]') && text().includes('This one uses something you own') && !text().includes('Start FROM products') && asked.includes('goFirstMatch') && asked.includes('chat'));
await click("I'll go first");
await type(document.querySelector('textarea[data-role=go-ask-text]'), 'SELECT p.name, COUNT(r.id) FROM products p LEFT JOIN reviews r ON r.product_id = p.id GROUP BY p.name');
await click('Show me yours');
await wait(400);
step('go first on ask: Claude compares, then shows its answer', !!document.querySelector('[data-role=go-ask-note]') && text().includes('You started from products') && text().includes('Start FROM products'));
globalThis.fetch = offline;
await openLearnings();
step('go first on ask: Learnings records that you went first', text().includes('went first'));

// ---- A calculation is worked out step by step, not picked from options (generated try, "steps" format).
await click('New chat');
const STEPS_TRY = { orderIsInsight: false, format: 'steps', task: 'Now a new situation: drug C raises a 4 in 1,000 risk by 50%; drug D raises a 30 in 100 risk by 10%.', context: '',
  steps: [{ label: "D's baseline, per 1,000", answer: 300, unit: '', how: '30 in 100 is 300 in 1,000.' }, { label: 'Extra cases per 1,000 from C', answer: 2, unit: '', how: '50% of 4 is 2.' }, { label: 'Extra cases per 1,000 from D', answer: 30, unit: '', how: '10% of 300 is 30.' }] };
globalThis.fetch = async (url, opts) => { const b = JSON.parse(opts.body); const text = b.task === 'chat' ? 'Put both baselines in the same units, find the extra cases, then compare the absolute numbers.' : b.task === 'focusOptions' ? '{"options":[{"label":"Converting baselines to the same units","mode":"concept"}]}' : b.task === 'writeTask' ? JSON.stringify(STEPS_TRY) : b.task === 'inferLearning' ? '{"learning": false, "topic": ""}' : '{}'; return { ok: true, status: 200, json: async () => ({ text }) }; };
await act(async () => { const el = document.querySelector('main textarea'); const set = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set; set.call(el, 'How do I compare two risks given as percentages?'); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
await click('↑');
await wait(120);
await ownAll();
await wait(80);
await click('Converting baselines to the same units');
await wait(120);
step('steps: a calculation is predicted step by step', text().includes('How many of these 3 will you get right on your own?') && text().includes('Next: a new case to work out, in 3 steps'));
await predict(3);
await wait(50);
const stepInputs = () => [...document.querySelectorAll('input[data-role=step-input]')];
step('steps: one number box per step, no multiple choice', stepInputs().length === 3 && !document.querySelector('[data-role=choice-q]'));
await type(stepInputs()[0], '300'); await type(stepInputs()[1], '2'); await type(stepInputs()[2], '3');
await click('Check my version');
await wait(80);
step('steps: each step checked by its number; the first slip is named with how to get it', text().includes('You said 3 of 3, and got 2') && text().includes('Step 3: the answer is 30, and you have 3. 10% of 300 is 30.') && document.querySelectorAll('[data-role=items] > div').length === 3);
step('steps: the reveal names the try "Work it out"', text().includes('Work it out'));
globalThis.fetch = offline;
await click('Back to chat');

// ---- Not ready yet: a low prediction offers the way back to Claude, with the highlight quoted.
await click('New chat');
await click('SQL · revenue per customer');
await wait(900);
const hl = "The key detail is putting the status filter in the LEFT JOIN's ON clause rather than in WHERE";
window.getSelection = () => ({ toString: () => hl, removeAllRanges() {} });
await act(async () => { document.querySelector('main [data-msg-id] > div').dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 100 })); });
await click('Own it');
window.getSelection = realGetSelection;
await click("Why status = 'paid' goes in ON");
await predict(0);
step('not ready: predicting under half offers "Ask Claude first" next to the try', !!document.querySelector('[data-role=not-ready]') && !!document.querySelector('textarea[data-role=write]'));
await act(async () => { document.querySelector('[data-role=ask-first]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
await wait(30);
step('not ready: the panel closes and your highlight is quoted in the chat box, question left to you', !document.querySelector('[data-role=own-panel]') && (document.querySelector('main textarea')?.value || '') === `About this part of your answer:\n> ${hl}\n\n` && text().includes('Asked Claude first'));
await openLearnings();
step('not ready: Learnings keeps it as a choice you can pick back up', text().includes('went to Claude first'));

// ---- Markdown emphasis: nested and adjacent bold/italic render with no stray asterisks (spec B2).
{
  const { inline } = await vite.ssrLoadModule('/src/ui/parts.jsx');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = t => renderToStaticMarkup(React.createElement('span', null, inline(t)));
  const plain = t => html(t).replace(/<[^>]+>/g, '');
  step('markdown: *Grant, **Think Again**: confident humility.*', html('*Grant, **Think Again**: confident humility.*') === '<span><i>Grant, <b>Think Again</b>: confident humility.</i></span>');
  step('markdown: ***bold italic***', !plain('***bold italic***').includes('*') && html('***bold italic***').includes('<b>') && html('***bold italic***').includes('<i>'));
  step('markdown: **Sinek** (*Leaders Eat Last*)', html('**Sinek** (*Leaders Eat Last*)') === '<span><b>Sinek</b> (<i>Leaders Eat Last</i>)</span>');
  step('markdown: emphasis closing with *** leaves no stray asterisks', ['**Brown: *trust (psychological safety).***', '*Grant: **change your mind.***', '***Sinek:** start with why.*'].every(t => !plain(t).includes('*')));
}

const reactErrors = errors.filter(e => !e.includes('offline (smoke test)'));
step('no React/runtime errors', reactErrors.length === 0, reactErrors.slice(0, 3).join(' || '));
console.error = origError;
await act(async () => root2.unmount());
await vite.close();
