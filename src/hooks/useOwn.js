import { ask, complete } from '../claude.js';
import { SQL_TARGETS } from '../targets.js';
import { normalizeSpot, spotSummary } from '../spot.js';
import { ruleNotes, keepQuoted } from '../notes.js';
import { tally } from '../scoring.js';
import { isColdStart } from '../gaps.js';
import { SQL, REACT, BOOK, JUNO, TARGETS, REACT_TIMING, isReactTiming } from '../scenarios.js';
import { runCheck, gradeAttempt, judgeSqlThatDidntRun, fallbackGrade, judgeGap } from '../grading.js';
import { DAY, quote, pickedText, ownsWhole, isPickCheck, stepLabel, foldRepeats } from '../util.js';
import { authoredFocus } from './useChat.js';
import { useMergeState } from './useMergeState.js';

// sequence = owning a structure (order matters: assemble, write)
// concept  = owning one construct (write)
const isMultiLine = code => code.split('\n').filter(l => l.trim()).length >= 3;

// Own it: the panel's flow from what to own, through predict and the try, to the reveal and teaching Sam.
export function useOwn(app) {
  const [state, set, ref] = useMergeState({ own: null }, app.afterCommit);
  // patch can be an object, or a function of the latest own state (use that after an await,
  // where app.state may not include updates queued before the await yet).
  const setOwn = (patch, cb) => set(s => ({ own: { ...s.own, ...(typeof patch === 'function' ? patch(s.own) : patch) } }), cb);

  // Own-it finds the gap; the chat explains it. These prefill a follow-up with your attempt and what the check said.
  // The context goes in as a quote (the task, your answer, what the check said); the question is yours to write.
  // Naming what confuses you is part of the learning, so the app doesn't put words in your mouth.
  // Your try as text: the code or explanation you wrote, or each pick. Shown on the reveal and quoted when you ask.
  function attemptText(o = app.state.own) {
    const w = o.write, c = w.check;
    return c && c.type === 'choice' ? pickedText(c, w.picked)
      : c && c.type === 'steps' ? c.steps.map(st => `${st.label}: ${w.picked[st.id] || '(blank)'}`).join('\n') : w.text;
  }
  function askAboutIt() {
    const o = app.state.own, w = o.write, g = w.grade;
    const attempt = attemptText(o);
    app.chat.prefillChat(`About my try on “${o.focus ? o.focus.label : 'this'}”:\n${quote('Task: ' + w.task)}\n${quote('My answer: ' + (attempt || '(nothing yet)'))}${g ? '\n' + quote('The check said: ' + (g.gap || g.why || '')) : ''}\n\n`);
  }
  // focus: pass one when the entry point already says what to own ("Own the whole query"); the focus question is then skipped.
  function beginOwn(m, code, focus = null) {
    const messages = app.state.messages;
    const i = messages.findIndex(x => x.id === m.id);
    const asked = messages.slice(0, i).reverse().find(x => x.type === 'user');
    const own = { id: app.nid(), msgId: m.id, question: asked ? asked.text : '', scenario: m.scenario, lang: m.lang, code, prediction: null, phase: focus ? 'predict' : 'focus', focus, focusOptions: null, focusOther: '', step: 'read', startStep: 'read', visited: {}, asm: null, write: { task: '', ref: '', schema: '', before: '', after: '', placeholder: '', check: null, authoredHints: null, text: '', hints: [], hintLoading: false, grade: null, loading: false, gradeLoading: false, picked: {}, attempts: 0, firstGrade: null }, teach: { msgs: [], input: '', turns: 0, loading: false }, fullCode: m.code, askedFocus: !focus };
    app.progress.set({ tipDismissed: true });
    app.chat.set({ messages: messages.concat([{ id: own.id, type: 'own' }]) });
    set({ own }, () => { if (!focus) loadFocusOptions(); else loadWriteTask(); });
  }

  // ---------- focus: what exactly does the learner want to own? ----------
  async function loadFocusOptions() {
    const o = app.state.own;
    const authored = authoredFocus(o.scenario, o.code);
    const reactTiming = o.scenario === REACT && isReactTiming(o.code);
    if (authored.length) { setOwn({ focusOptions: authored }); return; }
    // Offline fallback still names what was highlighted (its first words), so it never reads as unrelated.
    const part = o.code.trim().split('\n')[0].replace(/[;,]\s*$/, '').split(/\s+/).slice(0, 4).join(' ');
    const prose = !!(o.scenario && o.scenario.prose);
    const fallback = prose ? [{ label: `What “${o.code.trim().split(/\s+/).slice(0, 6).join(' ')}…” means`, mode: 'concept' }] : [
      { label: `What ${part} does and when to use it`, mode: 'concept' },
      ...(isMultiLine(o.code) ? [{ label: "The whole thing: each part and why it's in that order", mode: 'sequence', whole: true }] : []),
      ...(o.scenario === SQL ? [{ label: SQL_TARGETS.whole.label, mode: 'sequence', target: 'whole' }] : []),
    ];
    try {
      const r = await ask('focusOptions', { lang: o.lang, fullCode: o.fullCode, code: o.code });
      // A personal topic (faith, family, your own feelings) has no answer key: offer recognition practice, never a score.
      if (r.personal && r.spot && !reactTiming) return setOwn({ phase: 'spot', spot: { label: String(r.spot), scenarios: null, loading: false, failed: false } });
      const opts = (r.options || []).filter(x => x && x.label).slice(0, 3).map(x => ({ label: x.label, mode: x.mode === 'sequence' ? 'sequence' : 'concept' }));
      setOwn({ focusOptions: reactTiming ? [REACT_TIMING].concat(opts.slice(0, 2)) : opts.length ? opts : fallback });
    } catch (e) { setOwn({ focusOptions: reactTiming ? [REACT_TIMING].concat(fallback.slice(0, 1)) : fallback }); }
  }
  // Recognition practice on made-up people (research §13). The picks stay in the panel; only the count reaches the chat.
  async function startSpot() {
    const o = app.state.own;
    setOwn(cur => ({ spot: { ...cur.spot, loading: true, failed: false } }));
    try {
      const scenarios = normalizeSpot(await ask('spotPractice', { spot: o.spot.label, fullCode: o.fullCode }));
      setOwn(cur => ({ spot: { ...cur.spot, loading: false, scenarios: scenarios.length ? scenarios : null, failed: !scenarios.length } }));
    } catch (e) { setOwn(cur => ({ spot: { ...cur.spot, loading: false, failed: true } })); }
  }
  // Back to the chat with the question left to you, as elsewhere (log 63).
  const spotChat = () => { cancelOwn(); const el = app.composerRef.current; if (el) el.focus(); };
  function finishSpot(picked) {
    const o = app.state.own, summary = spotSummary(o.spot.label, picked, o.spot.scenarios || []);
    set({ own: null });
    app.chat.set({ messages: app.state.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', doneLabel: 'Practised', summary } : m) });
  }
  const changeFocus = () => { setOwn({ phase: 'focus', focus: null, askedFocus: true }, () => { if (!app.state.own.focusOptions) loadFocusOptions(); }); };
  // The try is prepared as soon as the focus is known, so the prediction can say what you'll be asked to do.
  function pickFocus(focus) {
    const changed = !app.state.own.focus || app.state.own.focus.label !== focus.label;
    setOwn(cur => ({ focus, phase: 'predict', ...(changed ? { write: { ...cur.write, task: '', ref: '', schema: '', before: '', after: '', placeholder: '', check: null, authoredHints: null, format: null } } : {}) }), () => loadWriteTask());
  }
  // The hand-written learning target for this focus, if there is one (see targets.js).
  const targetOf = (o = app.state.own) => o && o.focus && o.focus.target ? TARGETS[o.focus.target] || null : null;
  function submitFocusOther() {
    const o = app.state.own; const label = o.focusOther.trim(); if (!label) return;
    // Free text on the SQL starter still maps to a hand-written target when it clearly names one.
    const t = o.scenario === JUNO ? (/own|both|side|writer|reader|leave|follow/i.test(label) ? 'ownside' : /commoditi|scarce|mechanism|result/i.test(label) ? 'mechanism' : null)
      : o.scenario === BOOK ? (/population|sample|obvious|trivial/i.test(label) ? 'population' : /93|five|5|why|work|chance|percent/i.test(label) ? 'rule' : null)
      : o.scenario !== SQL ? null : /where|\bon\b|paid|status|filter/i.test(label) ? 'onwhere' : /join|left|right|inner/i.test(label) ? 'joins' : null;
    pickFocus({ label, mode: t || !isMultiLine(o.code) ? 'concept' : 'sequence', target: t || undefined });
  }
  // The steps for this focus, in order. Claude's answer is the reading, so Own-it is the try: you go straight to a
  // new case. The Own-it framework (research §8f): each target declares whether its written order matters.
  //   writtenOrderMatters → Arrange as a warm-up (first after a 1–2 prediction, otherwise optional; never scored)
  // Generated tries answer the same questions (see loadWriteTask).
  function orderMatters(o = app.state.own) {
    const t = targetOf(o);
    return t ? !!t.writtenOrderMatters : !!(o.write && o.write.orderMatters) && isMultiLine(o.code);
  }
  const ladder = (o = app.state.own) => orderMatters(o) ? ['assemble', 'write'] : ['write'];
  function cancelOwn() { set({ own: null }); app.chat.set({ messages: app.state.messages.filter(x => x.type !== 'own') }); }
  // "Back to chat" from anywhere. Nothing predicted yet → nothing to keep. Already checked → same as finishing.
  // Otherwise leave a one-line note in the chat: stopping is a real choice (outsourcing it), not a failure.
  // Exits are kept as their own data (where people back out, after predicting what), outside the calibration math.
  function leaveOwn() {
    const o = app.state.own;
    if (o.prediction == null) return cancelOwn();
    if (o.write && (o.write.grade || o.write.firstGrade)) return finishOwn();
    const L = ladder(o), at = stepLabel(o, o.step) || 'the start';
    const n = plannedItems(o).length;
    const summary = `${o.focus ? o.focus.label : o.lang} · predicted ${o.prediction} of ${n}, stopped at ${at}`;
    const exit = { id: o.id, title: o.focus ? o.focus.label : o.lang, predicted: o.prediction, n, step: at, stepOf: `${L.indexOf(o.step) + 1} of ${L.length}`, startStep: stepLabel(o, o.startStep), scenario: o.scenario };
    set({ own: null });
    app.progress.set({ exits: app.state.exits.concat([exit]) });
    app.chat.set({ messages: app.state.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', doneLabel: 'Outsourced', summary } : m) });
  }
  // "I have no idea" (before predicting) or predicting under half says "not ready yet": that's a moment for
  // explanation, which is the chat's job (the chat explains; the panel checks and reinforces). It goes back to the
  // main chat with the message written for you, asking Claude to explain it another way. It names no format: the chat
  // prompt lists what the chat can show (tables, flip-through views…) and Claude picks what fits the topic, which
  // works for SQL and React and for a people skill like leadership (log 84). Asking for "whatever form makes it clearest" changed nothing (log 96), so it isn't asked. Predicting stays in the panel. Someone with no idea doesn't know what to ask
  // yet, so here the app does put words in your mouth (unlike "Ask Claude about this" after a try). It's not
  // counted as a miss: Own it is offered again under the explanation.
  function askClaudeFirst() {
    const S = app.state, o = S.own, n = plannedItems(o).length, label = o.focus ? o.focus.label : o.lang;
    const part = ownsWhole(o) ? '' : o.code;
    const ask = "I don't really get this yet. Can you explain it another way, with a concrete example?";
    const text = part ? `About this part of your answer:\n${quote(part)}\n\n${ask}` : `About “${label}”: ${ask}`;
    const exit = { id: o.id, title: label, predicted: o.prediction, n, step: 'asked Claude first', askedFirst: true, stepOf: '', startStep: stepLabel(o, o.startStep), scenario: o.scenario };
    set({ own: null });
    app.progress.set({ exits: S.exits.concat([exit]) });
    // The focus you picked travels with the question, so Own it under the new explanation owns the same thing
    // (recordAsked) instead of guessing it again from the quoted words.
    app.chat.prefillChat(text, { carryFocus: o.focus ? { quote: part.trim(), label, focus: o.focus } : null,
      messages: S.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', doneLabel: 'Asked Claude first', summary: o.prediction == null ? label : `${label} · predicted ${o.prediction} of ${n}` } : m) });
  }
  // What the try will check, known before you try it: the prediction is "how many of these N will you get right?".
  // Only N is shown when you predict; the items themselves would give the answer away.
  function plannedItems(o = app.state.own) {
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
  function plannedTopics(o = app.state.own) {
    const c = o.write.check;
    if (c && c.type === 'explain') return c.topics && c.topics.length === c.keyPoints.length && c.keyPoints.length ? c.topics : null;
    if (!c && o.write.requirements && o.write.requirements.length) return o.write.requirements;
    if (c && c.type === 'choice') return c.questions.map(q => q.short || q.prompt);
    if (c && c.type === 'steps') return c.steps.map(st => st.label);
    if (c && c.type === 'sql' && c.items && c.items.every(i => i.topic)) return c.items.map(i => i.topic);
    if (c && c.type === 'number' && c.labels) return c.labels;
    return null;
  }
  function pickPrediction(n) {
    // Arrange first only when the written order is the insight and you predicted you'd get under half right.
    const start = orderMatters() && n / plannedItems().length < 0.5 ? 'assemble' : 'write';
    setOwn({ prediction: n, phase: 'ladder', step: start, startStep: start }, () => enterStep(start));
  }
  function enterStep(step) {
    const o = app.state.own; const visited = { ...o.visited, [step]: (o.visited[step] || 0) + 1 };
    setOwn({ step, visited });
    if (step === 'assemble') buildAsm();
    if (step === 'write') loadWriteTask();
  }
  const goWrite = () => (app.state.own.write.grade ? setOwn({ phase: 'reveal' }) : enterStep('write'));

  function buildAsm() {
    const o = app.state.own; if (o.asm) return;
    const t = targetOf(o), spec = t && t.assemble;
    const lines = spec ? spec.lines : o.code.split('\n').filter(l => l.trim());
    const pieces = lines.map((l, i) => ({ id: 'p' + i, text: l, correct: i }));
    const distractor = spec && spec.distractor ? { id: 'dx', text: spec.distractor, correct: -1 } : null;
    if (distractor) pieces.push(distractor);
    const bank = pieces.map(p => p.id).sort(() => Math.random() - 0.5);
    setOwn({ asm: { pieces, bank, seq: [], attempts: 0, mistakes: 0, usedDistractor: false, feedback: '', correct: false, why: '', loading: false, lastWrong: [] } });
  }
  const setAsm = patch => setOwn(cur => ({ asm: { ...cur.asm, ...patch } }));
  function asmAdd(id) { const a = app.state.own.asm; setAsm({ bank: a.bank.filter(x => x !== id), seq: a.seq.concat([id]), feedback: '', lastWrong: [] }); }
  function asmRemove(id) { const a = app.state.own.asm; setAsm({ seq: a.seq.filter(x => x !== id), bank: a.bank.concat([id]), feedback: '', lastWrong: [] }); }
  function asmMove(id, d) { const a = app.state.own.asm; const i = a.seq.indexOf(id), j = i + d; if (j < 0 || j >= a.seq.length) return; const s = a.seq.slice(); s[i] = a.seq[j]; s[j] = id; setAsm({ seq: s, feedback: '', lastWrong: [] }); }
  async function checkAsm() {
    const o = app.state.own, a = o.asm; const byId = {}; a.pieces.forEach(p => byId[p.id] = p);
    const expected = a.pieces.filter(p => p.correct >= 0).length;
    const usedDx = a.seq.includes('dx');
    const wrong = a.seq.filter((id, i) => byId[id].correct !== i);
    const missing = expected - a.seq.filter(id => byId[id].correct >= 0).length;
    const ok = wrong.length === 0 && missing === 0 && !usedDx;
    const attempts = a.attempts + 1;
    if (ok) { setAsm({ attempts, correct: true, feedback: attempts === 1 ? 'Right first time.' : 'That is the order. Now the part that matters: say why.', lastWrong: [] }); return; }
    setAsm({ attempts, mistakes: a.mistakes + 1, usedDistractor: a.usedDistractor || usedDx, loading: true, lastWrong: wrong });
    let fb;
    const yours = a.seq.map(id => byId[id].text).join('\n'), correctCode = a.pieces.filter(p => p.correct >= 0).map(p => p.text).join('\n');
    try {
      const wrongLines = wrong.filter(id => id !== 'dx').map(id => byId[id].text.trim());
      fb = await ask('asmFeedback', { lang: o.lang, correct: correctCode, yours, distractor: usedDx ? byId.dx.text : '', missing, wrongLines });
    } catch (e) {
      const q = wrong.filter(id => id !== 'dx').map(id => '`' + byId[id].text.trim() + '`');
      fb = usedDx && o.scenario === SQL ? "Look back at the run: WHERE runs after the join, and Cy and Fay's rows have status NULL there. What does NULL = 'paid' evaluate to, and what happens to those rows?" : usedDx ? 'One piece in your version contradicts what the code needs to do when the id changes. Which one, and why?' : missing ? 'Some pieces are still in the bank. Which step of the run did they correspond to?' : q.length ? `Look at ${q.slice(0, 2).join(' and ')}. Replay the run in your head: what has to exist before each of these can do its job?` : 'Something is out of order. Replay the run in your head, step by step.';
    }
    setAsm({ loading: false, feedback: fb });
  }

  async function loadWriteTask() {
    const o = app.state.own; if (o.write.task) return;
    const t = targetOf(o), sc = o.scenario;
    if (t && t.write) {
      const w = t.write;
      setOwn(cur => ({ write: { ...cur.write, task: w.task, schema: w.schema, before: w.before, after: w.after, placeholder: w.placeholder, check: w.check, ref: w.check.expected, authoredHints: w.hints } }));
      return;
    }
    // The chat's fixed "write a new one" task is only for owning the whole thing. Any other focus, including one about
    // order or timing, gets a try designed for it (writeTask decides whether producing it is the skill, research §8f).
    if (sc && sc.writeTask && (!o.focus || o.focus.whole)) { setOwn(cur => ({ write: { ...cur.write, task: sc.writeTask, ref: sc.writeRef, schema: sc.schema, requirements: sc.writeRequirements || null } })); return; }
    setOwn(cur => ({ write: { ...cur.write, loading: true } }));
    try {
      const r = await ask('writeTask', { label: o.focus ? o.focus.label : '', code: o.code, fullCode: o.fullCode });
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
      setOwn(cur => ({ write: { ...cur.write, ...patch } }));
    } catch (e) {
      const label = o.focus ? o.focus.label : 'the part you highlighted';
      setOwn(cur => ({ write: { ...cur.write, task: `Now a new situation: in your own words, explain ${label}, and give an example of where it matters.`, format: 'explain', placeholder: 'Explain it in your own words, and apply it to the new case.', check: { type: 'explain', question: label, keyPoints: [] }, loading: false } }));
    }
  }
  async function askHint() {
    const o = app.state.own; if (o.write.hintLoading) return;
    if (o.write.authoredHints) {
      const h = o.write.authoredHints[o.write.hints.length] || 'No more hints. Give it a go: the check will show exactly what comes back.';
      setOwn(cur => ({ write: { ...cur.write, hints: cur.write.hints.concat([h]) } }));
      return;
    }
    setOwn({ write: { ...o.write, hintLoading: true } });
    let h;
    try { h = await ask('hint', { task: o.write.task, ref: o.write.ref, draft: o.write.text, hints: o.write.hints }); }
    catch (e) { h = o.scenario === SQL ? ['Which table do you start FROM if every author has to appear?', "Where does status = 'published' have to go so authors with no published books survive?", 'An author with no match gets a NULL sum. What turned NULL into 0 in the original?'][o.write.hints.length] || 'Most pages first: which direction is the sort?' : ['What goes in the dependency array so it refetches when slug changes?', 'What did the original return from the effect, and why?', 'Which state do you need, and what does the component show while it is empty?'][o.write.hints.length] || 'Walk through a slug change: what stops the old response from landing?'; }
    setOwn(cur => ({ write: { ...cur.write, hints: cur.write.hints.concat([h]), hintLoading: false } }));
  }
  async function submitWrite() {
    const o = app.state.own, isChoice = isPickCheck(o.write.check);
    if ((isChoice ? !Object.values(o.write.picked).some(v => String(v).trim()) : !o.write.text.trim()) || o.write.gradeLoading) return;
    setOwn({ write: { ...o.write, gradeLoading: true } });
    let g;
    try {
      if (!o.write.check) throw new Error('no executable check');
      if (o.write.check.type === 'explain') {
        const res = await judgeGap({ topic: o.focus ? o.focus.label : '' }, o.write.check, o.write.text);
        const ok = res.points.filter(p => p.ok);
        const items = o.write.check.keyPoints.length ? o.write.check.keyPoints.map((p, i) => ({ short: p, ok: !!(res.points[i] && res.points[i].ok) })) : [{ short: 'Explains the idea and applies it', ok: res.closed }];
        g = { items, score: !res.points.length ? 2 : res.closed ? 5 : ok.length ? 3 : 2, why: res.closed ? 'Your answer has every key idea.' : ok.length ? 'Some of the key ideas are there, not all.' : res.points.length ? "The key ideas aren't there yet." : "This couldn't be checked just now.",
          worked: '', gap: res.feedback, corrections: [] }; // what was covered is the ✓ list itself
      } else
      g = await runCheck(o.write.check, o.write.text, o.write.before, o.write.after, o.write.picked);
      // Hybrid SQL check: if it runs, running it decides (exact, with the row tables). If it doesn't run, one slip
      // shouldn't zero a query whose idea is right, so Claude judges the same items from the query itself, and
      // the reveal says so. The plain-words syntax fix stays as "what to fix".
      if (g.didntRun && o.write.check.type === 'sql') g = await judgeSqlThatDidntRun(o, g);
    } catch (_) { try {
      g = await gradeAttempt(o.write.task, o.write.ref, o.write.text, o.lang, 'reveal', o.write.requirements);
    } catch (e) { g = fallbackGrade(o, o.write.text, o.write.ref); } }
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
    const g1 = first ? g : o.write.firstGrade, t1 = tally(g1), had = app.state.ledger.find(e => e.id === o.id) || {};
    const entry = { id: o.id, title: o.focus ? o.focus.label : o.scenario ? o.scenario.title : (o.lang + ' · ' + o.code.split('\n')[0].slice(0, 30)), predicted: o.prediction, actual: t1.right, n: t1.n, judged: !!g1.judgedByClaude, fixed: first ? null : tally(g).right, hints: o.write.hints.length, own: o,
      ownedAt: had.ownedAt || app.now(), dueAt: had.dueAt || app.now() + 3 * DAY, reviews: had.reviews || [] };
    const notes = ruleNotes(o.lang, o.write.text, o.write.task);
    app.progress.set(s => ({ ledger: foldRepeats(s.ledger.filter(e => e.id !== entry.id).concat([entry])) }));
    set(s => ({ own: { ...s.own, write: { ...s.own.write, grade: g, gradeLoading: false, attempts, firstGrade: s.own.write.firstGrade || g, notes, notesLoading: true }, phase: 'reveal' } }), () => loadNotes(g, notes));
  }
  // "On your version": Claude adds up to 2 notes on HOW you wrote it, beyond the score (which is already decided).
  async function loadNotes(g, have) {
    const o = app.state.own, w = o.write, text = w.text;
    const done = extra => setOwn(cur => ({ write: { ...cur.write, notes: (cur.write.notes || []).concat(extra).slice(0, 3), notesLoading: false } }));
    if (isPickCheck(w.check) || text.trim().length < 40) return done([]);
    try {
      const r = await ask('notes', { gap: g.gap, task: w.task, lang: o.lang, text, have: have.map(n => n.text), isCode: !(w.check && w.check.type === 'explain') && !(o.scenario && o.scenario.prose) && !!o.write.ref && /[;{}=()]|\bSELECT\b/i.test(o.write.ref) });
      done(keepQuoted(r.notes, text).filter(n => !have.some(h => h.quote.toLowerCase() === n.quote.toLowerCase())).slice(0, 2));
    } catch (e) { done([]); }
  }
  // Back to your own attempt, as you left it, to fix what the check found.
  const fixWrite = () => setOwn(cur => ({ phase: 'ladder', step: 'write', write: { ...cur.write, lastGap: cur.write.grade && cur.write.grade.gap, grade: null } }));

  // ---------- teach one ----------
  // Is what you're owning code? The replayed chats say so themselves; otherwise it's code only when the try was
  // writing code. A live answer about a health headline or leadership is an idea, so Sam asks about an idea.
  const isCodeOwn = (o = app.state.own) => o.scenario ? !o.scenario.prose : o.write.format === 'code';
  function goTeach() {
    const o = app.state.own;
    setOwn({ phase: 'teach', teach: { ...o.teach, msgs: o.teach.msgs.length ? o.teach.msgs : [{ role: 'sam', text: (o.scenario && o.scenario.samOpen)
      || (isCodeOwn(o) ? "Hey! So I've never done this before. Can you tell me what this code is for, like, what problem it solves?" : "Hi! I've never come across this before. What's the main idea, in plain words, and why does it matter?") }] } });
  }
  async function sendTeach() {
    const o = app.state.own; const t = o.teach.input.trim(); if (!t || o.teach.loading) return;
    const msgs = o.teach.msgs.concat([{ role: 'user', text: t }]); const turns = o.teach.turns + 1;
    setOwn({ teach: { ...o.teach, msgs, input: '', turns, loading: true } });
    let reply;
    const gap = o.write.grade ? o.write.grade.gap : '';
    try {
      const hist = msgs.map(m => ({ role: m.role === 'sam' ? 'assistant' : 'user', content: m.text }));
      // The API needs the conversation to open with a user turn; Sam speaks first in the UI.
      if (hist[0].role === 'assistant') hist.unshift({ role: 'user', content: '(The learner opens the chat with Sam.)' });
      reply = await complete({ task: 'sam', input: { lang: o.lang, prose: !isCodeOwn(o), code: o.code, gap, last: turns >= 3 }, messages: hist });
      reply = String(reply).trim();
    } catch (e) { const sl = o.scenario && o.scenario.samLines; reply = sl ? sl[Math.min(turns, 3) - 1] : turns >= 3 ? "Ok I think I get it: you squash the rows into one per person first, and only then can you ask about the totals. Thanks!" : turns === 1 ? "Hm ok. So the part that filters, does it look at every single row, or at the totals? I don't get when the totals show up." : "Wait so if I wanted only people whose total is big, why can't I just put that in the first filter?"; }
    setOwn(cur => ({ teach: { ...cur.teach, msgs: msgs.concat([{ role: 'sam', text: reply }]), loading: false } }), () => { if (turns >= 3) debriefTeach(); });
  }
  // The aha of teaching: what you explained clearly, and where you weren't sure (a gap you didn't know you had).
  // Claude reads the conversation and must quote your words; offline, hedges ("not sure", "I guess") mark the gaps.
  async function debriefTeach() {
    const o = app.state.own, msgs = o.teach.msgs; if (o.teach.debrief || o.teach.debriefLoading) return;
    setOwn(cur => ({ teach: { ...cur.teach, debriefLoading: true } }));
    const mine = msgs.filter(m => m.role === 'user').map(m => m.text);
    const samBefore = i => { for (let k = i - 1; k >= 0; k--) if (msgs[k].role === 'sam') return msgs[k].text; return ''; };
    const quoted = (q, list) => q && list.some(t => t.toLowerCase().includes(String(q).toLowerCase().trim().slice(0, 25)));
    let d;
    try {
      const r = await ask('debrief', { label: o.focus ? o.focus.label : '', msgs });
      // Hedged but right is underconfidence, the other half of calibration: shown as "unsure, but right", not a gap.
      const unsure = (r.unsure || []).filter(u => quoted(u.quote, mine) && u.topic).slice(0, 2);
      d = { clear: (r.clear || []).filter(c => quoted(c.quote, mine)).slice(0, 2), unsure: unsure.filter(u => !u.right), unsureRight: unsure.filter(u => u.right) };
    } catch (e) {
      const hedge = /not (really |quite )?sure|i guess|i'd guess|i would guess|maybe|no idea|i think|don't know|dont know/i;
      d = { clear: mine.filter(t => !hedge.test(t)).slice(0, 1).map(t => ({ quote: t.length > 90 ? t.slice(0, 90) + '…' : t, text: 'You put the core idea in your own words.' })),
        unsure: msgs.map((m, i) => ({ m, i })).filter(x => x.m.role === 'user' && hedge.test(x.m.text)).slice(0, 2)
          .map(x => ({ quote: x.m.text, question: samBefore(x.i), topic: isColdStart({ topic: '', question: samBefore(x.i) }) ? 'How a two-sided platform solves the cold start' : (samBefore(x.i).replace(/^(oo+h|oh|ok|hm+|wait)[,!. ]+/i, '').split(/[.?!]/).filter(Boolean).pop() || 'The question Sam asked').trim().slice(0, 70) })) };
    }
    setOwn(cur => ({ teach: { ...cur.teach, debrief: d, debriefLoading: false } }));
  }
  function finishOwn() {
    const o = app.state.own; const g = o.write.firstGrade || o.write.grade || { score: 0 }, last = o.write.grade;
    const t = tally(g), tl = last ? tally(last) : t;
    const fixed = o.write.attempts > 1 && last && tl.right !== t.right ? `, fixed to ${tl.right} of ${tl.n}` : '';
    const summary = `${o.focus ? o.focus.label : o.scenario ? o.scenario.title : o.lang} · predicted ${o.prediction} of ${t.n}, got ${t.right}${fixed}${o.teach.turns ? ', taught Sam' : ''}`;
    set({ own: null });
    app.chat.set({ messages: app.state.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', summary } : m) });
  }

  return { state, ref, set, setOwn, attemptText, askAboutIt, beginOwn, startSpot, spotChat, finishSpot, changeFocus, pickFocus, targetOf, submitFocusOther, orderMatters, ladder,
    leaveOwn, askClaudeFirst, plannedItems, plannedTopics, pickPrediction, enterStep, goWrite, setAsm, asmAdd, asmRemove, asmMove, checkAsm, askHint, submitWrite, fixWrite,
    isCodeOwn, goTeach, sendTeach, debriefTeach, finishOwn };
}
