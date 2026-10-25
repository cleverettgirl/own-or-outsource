import React from 'react';
import { ask, complete } from './claude.js';
import { SQL_TARGETS, sqlFocusOptions } from './targets.js';
import { bookFocusOptions } from './bookTargets.js';
import { junoFocusOptions } from './junoTargets.js';
import { BOOK_TURNS } from './bookTranscript.js';
import { JUNO_TURNS } from './junoTranscript.js';
import { REACT_TURNS } from './reactTranscript.js';
import { SQL_TURNS, SQL_QUESTION } from './sqlTranscript.js';
import { normalizeSpot, spotSummary } from './spot.js';
import { GO_FIRST } from './goFirst.js';
import { ruleNotes, keepQuoted } from './notes.js';
import { tally, correctionNote } from './scoring.js';
import { isColdStart, COLD_START } from './gaps.js';
import { SQL, REACT, BOOK, JUNO, TARGETS, REACT_TIMING, isReactTiming, LEAD_QUESTION, RISK_QUESTION, READING_QUESTION, TAX_QUESTION, REACT_LIVE_QUESTION } from './scenarios.js';
import { runCheck, gradeAttempt, judgeSqlThatDidntRun, fallbackGrade, judgeGap } from './grading.js';
import { STORE, DEMO_STORE, saveProgress, loadProgress } from './progress.js';
import { seedLedger, demoState } from './demo.js';
import { DAY, rel, quote, answerText, pickedText, ownsWhole, isPickCheck, stepLabel, foldRepeats } from './util.js';
import Sidebar from './ui/Sidebar.jsx';
import Chat from './ui/Chat.jsx';
import OwnPanel from './ui/OwnPanel.jsx';
import GoPanel, { GapPanel } from './ui/GoPanel.jsx';
import { renderVals } from './view/chat.js';

export default class App extends React.Component {
  state = { messages: [], composer: '', own: null, ledger: [], exits: [], sel: null, chatTitle: 'New chat', tipDismissed: false, view: 'chat', timeShift: 0, recall: null, gaps: [], activeGap: null, asked: [] };
  // Simulated "now": the demo can skip ahead in time to bring things due.
  now() { return Date.now() + this.state.timeShift; }
  scrollRef = React.createRef();
  panelRef = React.createRef();
  uid = 0;
  nid() { return ++this.uid; }

  isDemo = typeof window !== 'undefined' && /[?&]demo\b/.test(window.location.search);
  storeKey = this.isDemo ? DEMO_STORE : STORE;
  resetDemo = () => {
    if (!window.confirm(this.isDemo ? 'Reset the sample data to how it started?' : 'Clear everything you own, your gaps and recalls, and start the demo fresh?')) return;
    try { window.localStorage.removeItem(this.storeKey); } catch (e) { /* nothing saved */ }
    this.uid = 0;
    this.setState({ messages: [], own: null, ledger: seedLedger(), exits: [], gaps: [], asked: [], ...(this.isDemo ? demoState() : {}), timeShift: 0, tipDismissed: false, recall: null, activeGap: null, chatTitle: 'New chat', view: 'chat', composer: '' });
  };

  // ---------- chat ----------
  // While you own a highlighted part, it stays highlighted in Claude's reply. Finds the text across the rendered
  // nodes (whitespace-insensitive) and marks it with a CSS highlight, so the chat's own markup isn't touched.
  markOwnedText() {
    if (typeof window === 'undefined' || !window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    const o = this.state.own, key = o ? `${o.msgId}|${o.code}` : '';
    if (key === this._marked) return;
    this._marked = key; CSS.highlights.delete('owned'); this._ownedRange = null;
    if (!o || ownsWhole(o)) return;
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
  componentDidMount() {
    const saved = loadProgress(this.storeKey);
    if (saved) { this.uid = Math.max(this.uid, saved.uid); this.setState(saved.state); } else if (this.isDemo) this.setState(demoState()); else if (!this.state.ledger.length) this.setState({ ledger: seedLedger() });
    this._onDown = e => { if (this.state.sel && !(e.target.closest && e.target.closest('#own-sel'))) this.setState({ sel: null }); };
    this._onSelChange = () => { const s = window.getSelection(); if (this.state.sel && (!s || !s.toString().trim())) this.setState({ sel: null }); };
    document.addEventListener('mousedown', this._onDown);
    document.addEventListener('selectionchange', this._onSelChange);
    document.addEventListener('mouseup', this.onDocMouseUp);
  }
  componentWillUnmount() { document.removeEventListener('mousedown', this._onDown); document.removeEventListener('selectionchange', this._onSelChange); document.removeEventListener('mouseup', this.onDocMouseUp); }
  componentDidUpdate(_, prev) {
    const S = this.state;
    // A newly opened panel starts open, not tucked away (phones).
    const key = st => (st.own ? 'own' + st.own.id : '') + (st.messages.filter(m => ['goFirst', 'goAsk', 'gapCheck'].includes(m.type) && !m.panelClosed && m.phase !== 'offer' && m.phase !== 'answered').map(m => m.id).pop() || '');
    if (S.sheetMin && key(prev) !== key(S) && key(S)) this.setState({ sheetMin: false });
    if (['ledger', 'gaps', 'asked', 'exits', 'timeShift', 'tipDismissed'].some(k => prev[k] !== S[k])) saveProgress(this.storeKey, S, this.uid);
    if (prev.messages !== this.state.messages || (this.state.own && prev.own !== this.state.own && prev.own && prev.own.phase !== this.state.own.phase)) {
      const el = this.scrollRef.current; if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
    this.markOwnedText();
    // The panel starts each phase and step at the top.
    const a = prev.own, b = this.state.own;
    if (b && (!a || a.phase !== b.phase || a.step !== b.step)) this.focusPanel();
  }
  focusPanel = () => { const pn = this.panelRef.current; if (pn) pn.scrollTop = 0; };
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
  startReading = () => this.startLive(READING_QUESTION);
  startTax = () => this.startLive(TAX_QUESTION);
  startSql = () => this.startLive(SQL_QUESTION, SQL, SQL_TURNS[0].claude);
  startReact = () => this.startLive(REACT_LIVE_QUESTION, REACT, REACT_TURNS[0].claude);
  // Replays a real chat as-is. Every answer can be highlighted or owned whole (the icon under it).
  // turns: [{ user, claude }] pairs, or single { user } / { claude } / { gap } entries.
  replay(sc, turns) {
    const flat = turns.flatMap(t => [t.user != null && { user: t.user }, t.gap && { gap: t.gap }, t.claude != null && { claude: t.claude }].filter(Boolean));
    const msgs = flat.map(t => t.user != null ? { id: this.nid(), type: 'user', text: t.user }
      : t.gap ? { id: this.nid(), type: 'gap', text: t.gap }
      : { id: this.nid(), type: 'assistant', intro: '', code: t.claude, lang: sc.lang, outro: '', scenario: sc, plain: true, at: Date.now() });
    this.setState({ messages: msgs, composer: '', chatTitle: sc.title, own: null, sel: null, view: 'chat', activeGap: null });
  }
  startBook = () => this.replay(BOOK, BOOK_TURNS);
  startJuno = () => this.replay(JUNO, JUNO_TURNS);
  send = () => { const t = this.state.composer.trim(); if (!t) return; this.sendText(t, null, !!this.state.own); };
  composerRef = React.createRef();
  // Own-it finds the gap; the chat explains it. These prefill a follow-up with your attempt and what the check said.
  // The context goes in as a quote (the task, your answer, what the check said); the question is yours to write.
  // Naming what confuses you is part of the learning, so the app doesn't put words in your mouth.
  // Your try as text: the code or explanation you wrote, or each pick. Shown on the reveal and quoted when you ask.
  attemptText(o = this.state.own) {
    const w = o.write, c = w.check;
    return c && c.type === 'choice' ? pickedText(c, w.picked)
      : c && c.type === 'steps' ? c.steps.map(st => `${st.label}: ${w.picked[st.id] || '(blank)'}`).join('\n') : w.text;
  }
  askAboutIt = () => {
    const o = this.state.own, w = o.write, g = w.grade;
    const attempt = this.attemptText(o);
    this.prefillChat(`About my try on “${o.focus ? o.focus.label : 'this'}”:\n${quote('Task: ' + w.task)}\n${quote('My answer: ' + (attempt || '(nothing yet)'))}${g ? '\n' + quote('The check said: ' + (g.gap || g.why || '')) : ''}\n\n`);
  };
  // No upfront "just the answer / learn this too" toggle: intent is declared by what you choose to own,
  // and confidence by what you predict. Every answer can be owned.
  // starter: a home quick-start prompt. Its answer streams in, so you watch Claude write it.
  sendText(text, scenario, followUp = false, starter = null) {
    const m = { id: this.nid(), scenario, question: text, followUp, starter: !!starter, recorded: starter && starter.recorded };
    // A question you bring from a try or a recall ("About my…") is asking, not outsourcing: no go-first offer.
    const firstOfChat = !this.state.messages.length && !this.state.activeGap && !scenario && !m.starter && !/^About (my|this)/.test(text);
    const msgs = this.state.messages.concat([{ id: this.nid(), type: 'user', text }, { id: this.nid(), type: 'thinking' }]);
    this.setState({ messages: msgs, composer: '', chatTitle: this.state.messages.length ? this.state.chatTitle : (scenario ? scenario.title : text.slice(0, 40)) },
      () => (firstOfChat && this.ownedTitles().length ? this.answerOrGoFirst(m) : this.answer(m)));
  }

  // ---------- you go first, when you ask again ----------
  // A new question that needs something you own is the moment you'd normally outsource it. Claude checks that
  // (one small call, run alongside the answer so nothing waits) and, if it does, offers you the first try.
  // Claude's answer is ready behind it either way. Questions about understanding don't trigger this: it only
  // looks at the first question of a new chat.
  // What a ledger title is called on a new question: a hand-written target's general name when its label is tied to its example.
  ideaName(title) { const t = Object.values(TARGETS).find(x => x.label === title); return (t && t.idea) || title; }
  ownedTitles() { return [...new Set(this.state.ledger.filter(e => e.kind === 'gap' || e.actual != null).map(e => e.title))].slice(-12); }
  // Claude's answer to a go-first offer, by message id: it's fetched alongside the offer and waited on after your try.
  replyFor = {};
  async answerOrGoFirst(m) {
    const owned = this.ownedTitles();
    const replyP = this.fetchReply(m);
    let hit = null;
    try { const r = await ask('goFirstMatch', { question: m.question, owned: owned.map(t => this.ideaName(t)) }); hit = r.match >= 1 && r.match <= owned.length ? owned[r.match - 1] : null; } catch (e) { hit = null; }
    if (!hit) return this.showReply(m, await replyP);
    const id = this.nid();
    this.replyFor[id] = replyP;
    this.setState(s => ({ messages: s.messages.filter(x => x.type !== 'thinking').concat([{ id, type: 'goAsk', owned: hit, ownedName: this.ideaName(hit), question: m.question, phase: 'offer', text: '', reply: null, note: '' }]) }));
    replyP.then(reply => this.setGo(id, { reply }));
  }
  appendRealWork(entryId, rec) { this.setState(s => ({ ledger: s.ledger.map(x => x.id === entryId ? { ...x, realWork: (x.realWork || []).concat([rec]) } : x) })); }
  goAskNote(id, rec) { const g = this.state.messages.find(x => x.id === id); const e = this.state.ledger.slice().reverse().find(x => x.title === g.owned); if (e) this.appendRealWork(e.id, rec); }
  goAskAnswer = id => { this.setGo(id, { phase: 'answered' }); this.goAskNote(id, { outsourced: true }); };
  goAskSubmit = async id => {
    const g = this.state.messages.find(x => x.id === id); if (!g.text.trim() || g.phase !== 'try') return;
    this.setGo(id, { phase: 'checking' }); this.goAskNote(id, { wentFirst: true });
    const reply = g.reply || await this.replyFor[id];
    let r = {};
    try { r = await ask('goFirstCompare', { question: g.question, owned: g.ownedName || g.owned, attempt: g.text, answer: answerText(reply) }) || {}; } catch (e) { r = {}; }
    const verdict = ['yes', 'partly', 'no'].includes(r.owned) ? r.owned : null;
    this.setGo(id, { phase: 'done', note: String(r.note || ''), verdict, verdictLine: verdict ? String(r.ownedLine || '') : '', deeper: (r.deeper || []).map(d => d && String(d.idea || '').trim()).filter(Boolean).slice(0, 2) });
  };
  // The conversation so far, as API turns: user/assistant alternating, starting with the user, recent turns first
  // when it's long (the server caps input size).
  chatHistory() {
    const turns = [];
    for (const x of this.state.messages) {
      if (x.type === 'user') turns.push({ role: 'user', content: x.text });
      else if (x.type === 'assistant' && (x.code || x.intro)) turns.push({ role: 'assistant', content: answerText(x) });
    }
    const merged = [];
    for (const t of turns) { const last = merged[merged.length - 1]; if (last && last.role === t.role) last.content += '\n\n' + t.content; else merged.push({ ...t }); }
    const out = []; let total = 0;
    for (let i = merged.length - 1; i >= 0; i--) { total += merged[i].content.length; if (total > 8000 && out.length) break; out.unshift(merged[i]); }
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }
  async answer(m) {
    const id = this.nid();
    const reply = await this.fetchReply(m, m.starter ? t => this.streamInto(id, m, t) : null);
    this.showReply(m, reply, id);
  }
  // The answer so far, shown as it streams in (replacing the thinking dots). showReply puts the finished one in its place.
  streamInto(id, m, text) {
    this.setState(s => ({ messages: s.messages.some(x => x.id === id)
      ? s.messages.map(x => (x.id === id ? { ...x, code: text } : x))
      : s.messages.filter(x => x.type !== 'thinking').concat([{ id, type: 'assistant', at: Date.now(), askedId: null, intro: '', code: text, lang: 'text', outro: '', scenario: m.scenario || null, plain: true, streaming: true }]) }));
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
  showReply(m, reply, id = this.nid()) {
    const followUp = this.canOfferOwn();
    this.setState(s => ({ messages: s.messages.filter(x => x.type !== 'thinking' && x.id !== id).concat([{ id, type: 'assistant', at: Date.now(), askedId: null, ...reply }]) }));
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
      const r = await ask('inferLearning', { text, answer });
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
    const a = { id: 'a' + this.nid(), msgId, quote, question, scenario: first ? first.scenario : null, at: this.now(), label: '', checked: false };
    this.setState(s => ({ asked: s.asked.concat([a]) }));
    // Name it as a learning target (a short phrase) for Learnings. A focus carried from "explain another way" wins
    // (it's what you chose), then a matched hand-written target.
    const c = this.state.carryFocus;
    if (c && (c.quote ? quote.trim() === c.quote : question.includes(c.label))) { this.setState({ carryFocus: null }); this.setAsked(a.id, { label: c.focus.label, focus: c.focus }); return a; }
    const t = this.matchTarget(a);
    if (t) this.setAsked(a.id, { label: t.label, focus: t });
    else if (topic) this.setAsked(a.id, { label: topic });
    else ask('askedLabel', { quote, question })
      .then(r => this.setAsked(a.id, { label: r.label }))
      .catch(() => this.setAsked(a.id, { label: (question || quote).split(/[.?!\n]/)[0].slice(0, 60) }));
    return a;
  }
  setAsked(id, patch) { this.setState(s => ({ asked: s.asked.map(a => a.id === id ? { ...a, ...patch } : a) })); }
  // A hand-written target that fits what was asked about, if any (same matching as highlights).
  matchTarget(a) {
    const text = `${a.quote}\n${a.question}`, sc = a.scenario;
    const opts = this.authoredFocus(sc, text);
    if (opts.length && !(sc === SQL && opts[0].target === 'whole')) return opts[0];
    if (sc === REACT && isReactTiming(text)) return REACT_TIMING;
    return null;
  }
  authoredFocus(sc, text) { return sc === SQL ? sqlFocusOptions(text) : sc === BOOK ? bookFocusOptions(text) : sc === JUNO ? junoFocusOptions(text) : []; }
  // Own it, from an explanation you asked for (the same action as the icon, another way in). Claude's explanation is the material; no focus question.
  checkLanded = askedId => {
    const a = this.state.asked.find(x => x.id === askedId); if (!a || this.state.own) return;
    const m = this.state.messages.find(x => x.id === a.msgId) || { id: a.msgId, scenario: a.scenario, code: a.quote || a.question, lang: 'text', plain: true };
    const focus = a.focus || { label: a.label || (a.question || a.quote).slice(0, 60), mode: 'concept' };
    this.setAsked(a.id, { checked: true });
    this.setState({ view: 'chat' }, () => this.beginOwn({ ...m, scenario: a.scenario || m.scenario, code: [m.code, a.quote].filter(Boolean).join('\n\n') }, a.quote || a.question, focus));
  };

  copyAnswer(m) {
    if (navigator.clipboard) navigator.clipboard.writeText(answerText(m)).catch(() => { /* clipboard blocked */ });
    this.setState({ copied: m.id }); setTimeout(() => this.setState(s => s.copied === m.id ? { copied: null } : null), 1500);
  }
  speakAnswer(m) {
    const sy = window.speechSynthesis; if (!sy) return;
    if (sy.speaking) { sy.cancel(); return; }
    sy.speak(new SpeechSynthesisUtterance(answerText(m, '. ')));
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
  noteRealWork(key, rec) { const e = this.ownedFor(key); if (e) this.appendRealWork(e.id, rec); }
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
  onCodeMouseUp(m, e, text = null) {
    const s = window.getSelection(); const t = text != null ? text : s ? s.toString().trim() : '';
    if (!t || this.state.own) { if (this.state.sel) this.setState({ sel: null }); return; }
    this.setState({ sel: { text: t, x: e.clientX, y: e.clientY, msg: m } });
  }
  // Highlight → "Ask Claude": quote it into the chat and ask. Explanation is what the chat already does well.
  askSelection = () => { const s = this.state.sel; if (!s) return; const ws = window.getSelection(); if (ws) ws.removeAllRanges(); this.prefillChat(`About this part of your answer:\n${quote(s.text)}\n\n`, { sel: null }); };
  ownSelection = () => { const s = this.state.sel; if (!s) return; this.setState({ sel: null }); const ws = window.getSelection(); if (ws) ws.removeAllRanges(); this.beginOwn(s.msg, s.text); };
  // A drag that starts in an answer but is let go outside it (past the edge, below it, or back over the margin when
  // you start at a line break) still offers the popover. The answer's own mouseup handles a release inside it.
  onDocMouseUp = e => {
    if (e.target.closest && e.target.closest('[data-answer-body]')) return;
    const s = window.getSelection(); if (!s || !s.rangeCount || !s.toString().trim()) return;
    const el = n => n && (n.nodeType === 1 ? n : n.parentElement);
    const body = el(s.anchorNode) && el(s.anchorNode).closest('[data-answer-body]'); if (!body) return;
    const m = this.state.messages.find(x => String(x.id) === body.closest('[data-msg-id]').getAttribute('data-msg-id')); if (!m) return;
    // Only the part inside that answer counts, not the buttons or the next message the drag ran into.
    const r = s.getRangeAt(0).cloneRange();
    if (!body.contains(r.startContainer)) r.setStart(body, 0);
    if (!body.contains(r.endContainer)) r.setEnd(body, body.childNodes.length);
    this.onCodeMouseUp(m, e, r.toString().trim());
  };
  // focus: pass one when the entry point already says what to own ("Own the whole query"); the focus question is then skipped.
  beginOwn(m, code, focus = null) {
    const i = this.state.messages.findIndex(x => x.id === m.id);
    const asked = this.state.messages.slice(0, i).reverse().find(x => x.type === 'user');
    const own = { id: this.nid(), msgId: m.id, question: asked ? asked.text : '', scenario: m.scenario, lang: m.lang, code, prediction: null, phase: focus ? 'predict' : 'focus', focus, focusOptions: null, focusOther: '', step: 'read', startStep: 'read', visited: {}, asm: null, write: { task: '', ref: '', schema: '', before: '', after: '', placeholder: '', check: null, authoredHints: null, text: '', hints: [], hintLoading: false, grade: null, loading: false, gradeLoading: false, picked: {}, attempts: 0, firstGrade: null }, teach: { msgs: [], input: '', turns: 0, loading: false }, fullCode: m.code, askedFocus: !focus };
    this.setState({ own, tipDismissed: true, messages: this.state.messages.concat([{ id: own.id, type: 'own' }]) }, () => { if (!focus) this.loadFocusOptions(); else this.loadWriteTask(); });
  }

  // ---------- focus: what exactly does the learner want to own? ----------
  // sequence = owning a structure (order matters: assemble, write)
  // concept  = owning one construct (write)
  isMultiLine(code) { return code.split('\n').filter(l => l.trim()).length >= 3; }
  async loadFocusOptions() {
    const o = this.state.own;
    const authored = this.authoredFocus(o.scenario, o.code);
    const reactTiming = o.scenario === REACT && isReactTiming(o.code);
    if (authored.length) { this.setOwn({ focusOptions: authored }); return; }
    // Offline fallback still names what was highlighted (its first words), so it never reads as unrelated.
    const part = o.code.trim().split('\n')[0].replace(/[;,]\s*$/, '').split(/\s+/).slice(0, 4).join(' ');
    const prose = !!(o.scenario && o.scenario.prose);
    const fallback = prose ? [{ label: `What “${o.code.trim().split(/\s+/).slice(0, 6).join(' ')}…” means`, mode: 'concept' }] : [
      { label: `What ${part} does and when to use it`, mode: 'concept' },
      ...(this.isMultiLine(o.code) ? [{ label: "The whole thing: each part and why it's in that order", mode: 'sequence', whole: true }] : []),
      ...(o.scenario === SQL ? [{ label: SQL_TARGETS.whole.label, mode: 'sequence', target: 'whole' }] : []),
    ];
    try {
      const r = await ask('focusOptions', { lang: o.lang, fullCode: o.fullCode, code: o.code });
      // A personal topic (faith, family, your own feelings) has no answer key: offer recognition practice, never a score.
      if (r.personal && r.spot && !reactTiming) return this.setOwn({ phase: 'spot', spot: { label: String(r.spot), scenarios: null, loading: false, failed: false } });
      const opts = (r.options || []).filter(x => x && x.label).slice(0, 3).map(x => ({ label: x.label, mode: x.mode === 'sequence' ? 'sequence' : 'concept' }));
      this.setOwn({ focusOptions: reactTiming ? [REACT_TIMING].concat(opts.slice(0, 2)) : opts.length ? opts : fallback });
    } catch (e) { this.setOwn({ focusOptions: reactTiming ? [REACT_TIMING].concat(fallback.slice(0, 1)) : fallback }); }
  }
  // Recognition practice on made-up people (research §13). The picks stay in the panel; only the count reaches the chat.
  startSpot = async () => {
    const o = this.state.own;
    this.setOwn(cur => ({ spot: { ...cur.spot, loading: true, failed: false } }));
    try {
      const scenarios = normalizeSpot(await ask('spotPractice', { spot: o.spot.label, fullCode: o.fullCode }));
      this.setOwn(cur => ({ spot: { ...cur.spot, loading: false, scenarios: scenarios.length ? scenarios : null, failed: !scenarios.length } }));
    } catch (e) { this.setOwn(cur => ({ spot: { ...cur.spot, loading: false, failed: true } })); }
  };
  // Back to the chat with the question left to you, as elsewhere (log 63).
  spotChat = () => { this.cancelOwn(); const el = this.composerRef.current; if (el) el.focus(); };
  finishSpot = picked => {
    const o = this.state.own, summary = spotSummary(o.spot.label, picked, o.spot.scenarios || []);
    this.setState({ own: null, messages: this.state.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', doneLabel: 'Practised', summary } : m) });
  };
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
    const t = o.scenario === JUNO ? (/own|both|side|writer|reader|leave|follow/i.test(label) ? 'ownside' : /commoditi|scarce|mechanism|result/i.test(label) ? 'mechanism' : null)
      : o.scenario === BOOK ? (/population|sample|obvious|trivial/i.test(label) ? 'population' : /93|five|5|why|work|chance|percent/i.test(label) ? 'rule' : null)
      : o.scenario !== SQL ? null : /where|\bon\b|paid|status|filter/i.test(label) ? 'onwhere' : /join|left|right|inner/i.test(label) ? 'joins' : null;
    this.pickFocus({ label, mode: t || !this.isMultiLine(o.code) ? 'concept' : 'sequence', target: t || undefined });
  };
  // The steps for this focus, in order. Claude's answer is the reading, so Own-it is the try: you go straight to a
  // new case. The Own-it framework (research §8f): each target declares whether its written order matters.
  //   writtenOrderMatters → Arrange as a warm-up (first after a 1–2 prediction, otherwise optional; never scored)
  // Generated tries answer the same questions (see loadWriteTask).
  orderMatters(o = this.state.own) {
    const t = this.targetOf(o);
    return t ? !!t.writtenOrderMatters : !!(o.write && o.write.orderMatters) && this.isMultiLine(o.code);
  }
  ladder(o = this.state.own) { return this.orderMatters(o) ? ['assemble', 'write'] : ['write']; }
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
  // works for SQL and React and for a people skill like leadership (log 84). Asking for "whatever form makes it clearest" changed nothing (log 96), so it isn't asked. Predicting stays in the panel. Someone with no idea doesn't know what to ask
  // yet, so here the app does put words in your mouth (unlike "Ask Claude about this" after a try). It's not
  // counted as a miss: Own it is offered again under the explanation.
  askClaudeFirst = () => {
    const o = this.state.own, n = this.plannedItems(o).length, label = o.focus ? o.focus.label : o.lang;
    const part = ownsWhole(o) ? '' : o.code;
    const ask = "I don't really get this yet. Can you explain it another way, with a concrete example?";
    const text = part ? `About this part of your answer:\n${quote(part)}\n\n${ask}` : `About “${label}”: ${ask}`;
    const exit = { id: o.id, title: label, predicted: o.prediction, n, step: 'asked Claude first', askedFirst: true, stepOf: '', startStep: stepLabel(o, o.startStep), scenario: o.scenario };
    // The focus you picked travels with the question, so Own it under the new explanation owns the same thing
    // (recordAsked) instead of guessing it again from the quoted words.
    this.prefillChat(text, { own: null, exits: this.state.exits.concat([exit]), carryFocus: o.focus ? { quote: part.trim(), label, focus: o.focus } : null,
      messages: this.state.messages.map(m => m.id === o.id ? { ...m, type: 'ownDone', doneLabel: 'Asked Claude first', summary: o.prediction == null ? label : `${label} · predicted ${o.prediction} of ${n}` } : m) });
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
    // Arrange first only when the written order is the insight and you predicted you'd get under half right.
    const start = this.orderMatters() && n / this.plannedItems().length < 0.5 ? 'assemble' : 'write';
    this.setOwn({ prediction: n, phase: 'ladder', step: start, startStep: start }, () => this.enterStep(start));
  }
  enterStep(step) {
    const o = this.state.own; const visited = { ...o.visited, [step]: (o.visited[step] || 0) + 1 };
    this.setOwn({ step, visited });
    if (step === 'assemble') this.buildAsm();
    if (step === 'write') this.loadWriteTask();
  }

  goWrite = () => (this.state.own.write.grade ? this.setOwn({ phase: 'reveal' }) : this.enterStep('write'));

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
      fb = await ask('asmFeedback', { lang: o.lang, correct: correctCode, yours, distractor: usedDx ? byId.dx.text : '', missing, wrongLines });
    } catch (e) {
      const q = wrong.filter(id => id !== 'dx').map(id => '`' + byId[id].text.trim() + '`');
      fb = usedDx && o.scenario === SQL ? "Look back at the run: WHERE runs after the join, and Cy and Fay's rows have status NULL there. What does NULL = 'paid' evaluate to, and what happens to those rows?" : usedDx ? 'One piece in your version contradicts what the code needs to do when the id changes. Which one, and why?' : missing ? 'Some pieces are still in the bank. Which step of the run did they correspond to?' : q.length ? `Look at ${q.slice(0, 2).join(' and ')}. Replay the run in your head: what has to exist before each of these can do its job?` : 'Something is out of order. Replay the run in your head, step by step.';
    }
    this.setAsm({ loading: false, feedback: fb });
  };

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
    try { h = await ask('hint', { task: o.write.task, ref: o.write.ref, draft: o.write.text, hints: o.write.hints }); }
    catch (e) { h = o.scenario === SQL ? ['Which table do you start FROM if every author has to appear?', "Where does status = 'published' have to go so authors with no published books survive?", 'An author with no match gets a NULL sum. What turned NULL into 0 in the original?'][o.write.hints.length] || 'Most pages first: which direction is the sort?' : ['What goes in the dependency array so it refetches when slug changes?', 'What did the original return from the effect, and why?', 'Which state do you need, and what does the component show while it is empty?'][o.write.hints.length] || 'Walk through a slug change: what stops the old response from landing?'; }
    this.setOwn(cur => ({ write: { ...cur.write, hints: cur.write.hints.concat([h]), hintLoading: false } }));
  };
  submitWrite = async () => {
    const o = this.state.own, isChoice = isPickCheck(o.write.check);
    if ((isChoice ? !Object.values(o.write.picked).some(v => String(v).trim()) : !o.write.text.trim()) || o.write.gradeLoading) return;
    this.setOwn({ write: { ...o.write, gradeLoading: true } });
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
    const g1 = first ? g : o.write.firstGrade, t1 = tally(g1), had = this.state.ledger.find(e => e.id === o.id) || {};
    const entry = { id: o.id, title: o.focus ? o.focus.label : o.scenario ? o.scenario.title : (o.lang + ' · ' + o.code.split('\n')[0].slice(0, 30)), predicted: o.prediction, actual: t1.right, n: t1.n, judged: !!g1.judgedByClaude, fixed: first ? null : tally(g).right, hints: o.write.hints.length, own: o,
      ownedAt: had.ownedAt || this.now(), dueAt: had.dueAt || this.now() + 3 * DAY, reviews: had.reviews || [] };
    const notes = ruleNotes(o.lang, o.write.text, o.write.task);
    this.setState(s => ({ own: { ...s.own, write: { ...s.own.write, grade: g, gradeLoading: false, attempts, firstGrade: s.own.write.firstGrade || g, notes, notesLoading: true }, phase: 'reveal' }, ledger: foldRepeats(s.ledger.filter(e => e.id !== entry.id).concat([entry])) }), () => this.loadNotes(g, notes));
  };

  // "On your version": Claude adds up to 2 notes on HOW you wrote it, beyond the score (which is already decided).
  async loadNotes(g, have) {
    const o = this.state.own, w = o.write, text = w.text;
    const done = extra => this.setOwn(cur => ({ write: { ...cur.write, notes: (cur.write.notes || []).concat(extra).slice(0, 3), notesLoading: false } }));
    if (isPickCheck(w.check) || text.trim().length < 40) return done([]);
    try {
      const r = await ask('notes', { gap: g.gap, task: w.task, lang: o.lang, text, have: have.map(n => n.text), isCode: !(w.check && w.check.type === 'explain') && !(o.scenario && o.scenario.prose) && !!o.write.ref && /[;{}=()]|\bSELECT\b/i.test(o.write.ref) });
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
      messages: [{ id: this.nid(), type: 'gapBanner', gapId: g.id }, { id: this.nid(), type: 'user', text }, { id: this.nid(), type: 'thinking' }] }), () => this.answer({ question: text }));
  }
  // "Check me": one question that asks you to explain and apply the idea; Claude judges it against key points.
  checkMeFromChat = gapId => { this.setState(s => ({ messages: s.messages.concat([{ id: this.nid(), type: 'user', text: "I think I've got it. Check me." }]) }), () => this.startGapCheck(gapId)); };
  async startGapCheck(gapId) {
    const g = this.state.gaps.find(x => x.id === gapId), id = this.nid();
    this.setState(s => ({ messages: s.messages.concat([{ id, type: 'gapCheck', gapId, phase: 'loading', text: '' }]) }));
    let check;
    if (isColdStart(g)) check = COLD_START.check;
    else {
      try { const r = await ask('gapCheck', { topic: g.topic, context: g.context }); check = { question: r.question, keyPoints: (r.keyPoints || []).slice(0, 3) }; }
      catch (e) { check = { question: `In your own words, with an example: ${g.topic}?`, keyPoints: [] }; }
    }
    this.setGo(id, { phase: 'ask', check });
  }
  async submitGapCheck(m) {
    if (!m.text.trim() || m.judging) return;
    this.setGo(m.id, { judging: true });
    const g = this.state.gaps.find(x => x.id === m.gapId);
    const result = await judgeGap(g, m.check, m.text);
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
    if (!r.task) ask('recallTask', { title: e.title, code: e.own.code || '' })
      .then(x => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: x.task, ref: x.reference } : s.recall })))
      .catch(() => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: `From memory: explain or redo "${e.title}" without looking back.`, ref: '' } : s.recall })));
  }
  startGapRecall(e) {
    const g = e.gap, base = { entryId: e.id, gapMode: true, picked: {}, text: '', grade: null, loading: false, lang: 'concept', then: null, thenLabel: `Closed ${rel(e.ownedAt, this.now())}`, schema: '', before: '', after: '', placeholder: 'From memory. Explain it and apply it.', check: null };
    const cold = isColdStart(g);
    this.setState({ recall: { ...base, task: cold ? 'From memory, a new situation: a friend is launching a marketplace that connects local tutors with students. Neither side exists yet. What would you tell them to do first, and why?' : '' } });
    if (!cold) ask('gapRecall', { topic: g.topic, before: g.check ? g.check.question : '' })
      .then(x => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: x.question } : s.recall })))
      .catch(() => this.setState(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: `From memory, in your own words and with a new example: ${g.topic}?` } : s.recall })));
  }
  // A question you noticed while recalling: after you've checked (so it never becomes a lookup), quote the recall
  // into a new chat and leave the question to you, the same "Ask Claude about this" as on the reveal. If it's about
  // understanding, it lands under "You asked about", ready to own; the loop starts again from recall.
  askAboutRecall = () => {
    const r = this.state.recall, e = this.state.ledger.find(x => x.id === r.entryId); if (!r || !r.grade) return;
    const answer = r.check && r.check.type === 'choice' ? pickedText(r.check, r.picked) : r.text;
    const text = `About my recall on “${e.title}”:\n${quote('Question: ' + r.task)}\n${quote('My answer: ' + (answer || '(nothing)'))}${r.grade.note ? '\n' + quote('The check said: ' + r.grade.note) : ''}\n\n`;
    this.prefillChat(text, { recall: null, messages: [], own: null, sel: null, activeGap: null, chatTitle: 'New chat' });
  };
  // The same for the panel's other reveals (go-first and the gap check, log 90): the context goes into this chat's box
  // as a quote, the question is yours, and the panel stays open beside it.
  askAboutPanelTry = id => {
    const m = this.state.messages.find(x => x.id === id); if (!m) return;
    let head, question, answer, said;
    if (m.type === 'goFirst') {
      const g = GO_FIRST[m.key], gr = m.grade || {};
      head = 'my go'; question = g.question; answer = g.check.type === 'choice' ? pickedText(g.check, m.picked) : m.text;
      said = [gr.gap, (gr.items || []).filter(i => !i.ok).map(i => 'Missed: ' + i.short).join('; ')].filter(Boolean).join(' ');
    } else if (m.type === 'goAsk') { head = 'my go'; question = m.question; answer = m.text; said = [m.verdictLine, m.note].filter(Boolean).join(' '); }
    else { const g = this.state.gaps.find(x => x.id === m.gapId) || {}, r = m.result || {}; head = `closing the gap “${g.topic || ''}”`; question = m.check.question; answer = m.text; said = [r.closed ? 'Closed.' : 'Not closed yet.', r.feedback].filter(Boolean).join(' '); }
    this.prefillChat(`About ${head}:\n${quote('Question: ' + question)}\n${quote('My answer: ' + (answer || '(nothing)'))}${said ? '\n' + quote('The check said: ' + said) : ''}\n\n`);
  };
  // A gap the go-first check spotted, taken to the chat: your try is quoted and the idea named; the question is yours.
  // Nothing is saved: if Claude's explanation lands, Own it is offered under it as usual.
  goDeeper = (id, idea) => {
    const m = this.state.messages.find(x => x.id === id); if (!m) return;
    this.prefillChat(`About my go:\n${quote('Question: ' + m.question)}\n${quote('My answer: ' + (m.text || '(nothing)'))}\n\nI'd like to go deeper on: ${idea}. `);
  };
  // Puts text in the chat box with the caret at the end; extra is any other state to set with it.
  prefillChat(text, extra = {}) { this.setState({ ...extra, composer: text, view: 'chat' }, () => { const el = this.composerRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); }
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
      const res = await judgeGap(e.gap, e.gap.check || { question: r.task, keyPoints: [] }, r.text);
      g = { score: res.closed ? 5 : 3, items: res.points.length ? res.points.map(p => ({ short: p.point, ok: p.ok })) : [{ short: e.title, ok: res.closed }], note: res.feedback };
    } else try {
      if (!r.check) throw new Error('no executable check');
      const x = await runCheck(r.check, r.text, r.before, r.after, r.picked); g = { score: x.score, items: x.items, note: [x.worked, x.gap, correctionNote(x.corrections)].filter(Boolean).join(' ') };
    } catch (_) {
      try { g = await gradeAttempt(r.task, r.ref, r.text, r.lang, 'note'); }
      catch (e) { const f = fallbackGrade({ lang: r.lang }, r.text, r.ref); g = { score: f.score, items: f.items, note: f.worked + ' ' + f.gap }; }
    }
    // Spacing: right → wait longer each time (7, then 21, then 60 days); missed → back tomorrow.
    const now = this.now();
    this.setState(s => ({
      recall: { ...s.recall, grade: g, loading: false },
      ledger: s.ledger.map(e => {
        if (e.id !== r.entryId) return e;
        const streak = (() => { let k = 0; for (let i = (e.reviews || []).length - 1; i >= 0 && e.reviews[i].right === e.reviews[i].n; i--) k++; return k; })();
        const t = tally(g), gap = t.right === t.n ? [7, 21, 60][Math.min(streak, 2)] : 1;
        return { ...e, reviews: (e.reviews || []).concat([{ at: now, right: t.right, n: t.n }]), dueAt: now + gap * DAY };
      }),
    }));
  };
  skipAhead = () => this.setState(s => ({ timeShift: s.timeShift + 3 * DAY }));
  rereadChat = () => {
    const o = this.state.own;
    if (window.matchMedia && window.matchMedia('(max-width: 760px)').matches) this.setState({ sheetMin: true });
    const hl = this._ownedRange && this._ownedRange.startContainer.parentElement;
    if (hl) { hl.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const el = document.querySelector(`[data-msg-id="${o.msgId}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); this.setState({ flashMsg: o.msgId }); setTimeout(() => this.setState({ flashMsg: null }), 1600); }
  };

  render() {
    const V = renderVals(this);
    const panel = V.hasOwn && !V.isLearnings ? <OwnPanel V={V} /> : V.goPanel && !V.isLearnings ? (V.goPanel.isGapCheck ? <GapPanel m={V.goPanel} /> : <GoPanel m={V.goPanel} />) : null;
    return (
      <>
      <div data-role="app" className={`flex h-[100vh] phone:h-dvh overflow-hidden ${(this.state.navOpen ? 'nav-open ' : '') + (panel ? 'with-sheet' : '')}`}>

      <Sidebar V={V} />
      {!!this.state.navOpen && <div className="hidden phone:block fixed inset-0 z-[55] bg-[rgba(31,29,26,.35)]" onClick={() => this.setState({ navOpen: false })}></div>}

      <Chat V={V} />

      {/* On a phone the panel is a sheet over the chat (sheet.css); on a wide screen the wrapper doesn't exist for layout. */}
      {!!panel && (
        <div className={'sheet' + (this.state.sheetMin ? ' min' : '')}>
          {panel}
          <button className="hidden phone:flex absolute top-[13px] right-14 z-[2] w-9.5 h-9.5 rounded-[10px] border-none bg-transparent items-center justify-center text-[18px] text-muted" data-role="sheet-toggle" onClick={() => this.setState(s => ({ sheetMin: !s.sheetMin }))} aria-label={this.state.sheetMin ? 'Open the panel' : 'Tuck the panel away to read the chat'}>{this.state.sheetMin ? '⌃' : '⌄'}</button>
        </div>
      )}
      </div>
      </>
    );
  }
}
