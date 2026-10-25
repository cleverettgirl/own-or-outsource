import { useLayoutEffect, useRef } from 'react';
import { ask, complete } from '../claude.js';
import { sqlFocusOptions } from '../targets.js';
import { bookFocusOptions } from '../bookTargets.js';
import { junoFocusOptions } from '../junoTargets.js';
import { BOOK_TURNS } from '../bookTranscript.js';
import { JUNO_TURNS } from '../junoTranscript.js';
import { REACT_TURNS } from '../reactTranscript.js';
import { SQL_TURNS, SQL_QUESTION } from '../sqlTranscript.js';
import { isColdStart, COLD_START } from '../gaps.js';
import { SQL, REACT, BOOK, JUNO, REACT_TIMING, isReactTiming, LEAD_QUESTION, RISK_QUESTION, PARK_QUESTION, TAX_QUESTION, REACT_LIVE_QUESTION } from '../scenarios.js';
import { quote, answerText, ownsWhole } from '../util.js';
import { useMergeState } from './useMergeState.js';

// The hand-written focus options for a selection in one of the prepared starters.
export const authoredFocus = (sc, text) => sc === SQL ? sqlFocusOptions(text) : sc === BOOK ? bookFocusOptions(text) : sc === JUNO ? junoFocusOptions(text) : [];
// A follow-up that asks Claude to explain (the "Ask Claude" quote, or wording like "how does this work").
const isExplainAsk = text => /^About this part of your answer:/.test(text) || /\bexplain|how (is|does|do|did) (this|that|it)|why (is|does|do)|what does|what happens|walk me through|(don't|dont|do not) (get|understand)|confus|more detail/i.test(text);

// The chat: messages, the composer, the selection popover, which page is showing, and the small UI flags.
export function useChat(app) {
  const [state, set, ref] = useMergeState({ messages: [], composer: '', sel: null, chatTitle: 'New chat', view: 'chat', activeGap: null }, app.afterCommit);
  const marked = useRef(undefined), ownedRange = useRef(null);

  useLayoutEffect(() => {
    const onDown = e => { if (app.state.sel && !(e.target.closest && e.target.closest('#own-sel'))) set({ sel: null }); };
    const onSelChange = () => { const s = window.getSelection(); if (app.state.sel && (!s || !s.toString().trim())) set({ sel: null }); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('selectionchange', onSelChange);
    document.addEventListener('mouseup', onDocMouseUp);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('selectionchange', onSelChange); document.removeEventListener('mouseup', onDocMouseUp); };
  }, []);

  // While you own a highlighted part, it stays highlighted in Claude's reply. Finds the text across the rendered
  // nodes (whitespace-insensitive) and marks it with a CSS highlight, so the chat's own markup isn't touched.
  function markOwnedText() {
    if (typeof window === 'undefined' || !window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    const o = app.state.own, key = o ? `${o.msgId}|${o.code}` : '';
    if (key === marked.current) return;
    marked.current = key; CSS.highlights.delete('owned'); ownedRange.current = null;
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
    ownedRange.current = r;
  }
  const focusPanel = () => { const pn = app.panelRef.current; if (pn) pn.scrollTop = 0; };
  function newChat() { set({ messages: [], sel: null, chatTitle: 'New chat', composer: '', view: 'chat', activeGap: null }); app.own.set({ own: null }); }
  // Learnings remembers where you came from, so Back returns there: the chat, with the Own it panel as you left it.
  const openLearnings = () => set(s => ({ view: 'learnings', sel: null, justOwned: null, learnFrom: s.view === 'learnings' ? s.learnFrom : s.messages.length || app.state.own ? 'chat' : null }));
  // From the end of a try: see the thing you just owned on the map and in your cards.
  const seeInLearnings = () => set({ view: 'learnings', sel: null, justOwned: app.state.own && app.state.own.id, learnFrom: 'chat' });
  const backFromLearnings = () => set({ view: 'chat', learnFrom: null, justOwned: null });
  // The home starters are prompts, sent live, so you watch Claude answer. SQL and React keep their scenario, so the
  // hand-written targets and the "see it run" walkthroughs still apply: live answers to these prompts match the
  // recorded query and component (sampled 2026-10-24). If the model can't be reached, the recorded answer stands in.
  function startLive(text, sc = null, recorded = null) {
    app.own.set({ own: null });
    set({ messages: [], sel: null, chatTitle: 'New chat', composer: '', view: 'chat', activeGap: null, learnFrom: null }, () => sendText(text, sc, false, { recorded }));
  }
  const startLead = () => startLive(LEAD_QUESTION);
  const startRisk = () => startLive(RISK_QUESTION);
  const startPark = () => startLive(PARK_QUESTION);
  const startTax = () => startLive(TAX_QUESTION);
  const startSql = () => startLive(SQL_QUESTION, SQL, SQL_TURNS[0].claude);
  const startReact = () => startLive(REACT_LIVE_QUESTION, REACT, REACT_TURNS[0].claude);
  // Replays a real chat as-is. Every answer can be highlighted or owned whole (the icon under it).
  // turns: [{ user, claude }] pairs, or single { user } / { claude } / { gap } entries.
  function replay(sc, turns) {
    const flat = turns.flatMap(t => [t.user != null && { user: t.user }, t.gap && { gap: t.gap }, t.claude != null && { claude: t.claude }].filter(Boolean));
    const msgs = flat.map(t => t.user != null ? { id: app.nid(), type: 'user', text: t.user }
      : t.gap ? { id: app.nid(), type: 'gap', text: t.gap }
      : { id: app.nid(), type: 'assistant', intro: '', code: t.claude, lang: sc.lang, outro: '', scenario: sc, plain: true, at: Date.now() });
    app.own.set({ own: null });
    set({ messages: msgs, composer: '', chatTitle: sc.title, sel: null, view: 'chat', activeGap: null });
  }
  const startBook = () => replay(BOOK, BOOK_TURNS);
  const startJuno = () => replay(JUNO, JUNO_TURNS);
  const send = () => { const t = app.state.composer.trim(); if (!t) return; sendText(t, null, !!app.state.own); };
  // No upfront "just the answer / learn this too" toggle: intent is declared by what you choose to own,
  // and confidence by what you predict. Every answer can be owned.
  // starter: a home quick-start prompt. Its answer streams in, so you watch Claude write it.
  function sendText(text, scenario, followUp = false, starter = null) {
    const S = app.state;
    const m = { id: app.nid(), scenario, question: text, followUp, starter: !!starter, recorded: starter && starter.recorded };
    // A question you bring from a try or a recall ("About my…") is asking, not outsourcing: no go-first offer.
    const firstOfChat = !S.messages.length && !S.activeGap && !scenario && !m.starter && !/^About (my|this)/.test(text);
    const msgs = S.messages.concat([{ id: app.nid(), type: 'user', text }, { id: app.nid(), type: 'thinking' }]);
    set({ messages: msgs, composer: '', chatTitle: S.messages.length ? S.chatTitle : (scenario ? scenario.title : text.slice(0, 40)) },
      () => (firstOfChat && app.goFirst.ownedTitles().length ? app.goFirst.answerOrGoFirst(m) : answer(m)));
  }
  // The conversation so far, as API turns: user/assistant alternating, starting with the user, recent turns first
  // when it's long (the server caps input size).
  function chatHistory() {
    const turns = [];
    for (const x of app.state.messages) {
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
  async function answer(m) {
    const id = app.nid();
    const reply = await fetchReply(m, m.starter ? t => streamInto(id, m, t) : null);
    showReply(m, reply, id);
  }
  // The answer so far, shown as it streams in (replacing the thinking dots). showReply puts the finished one in its place.
  function streamInto(id, m, text) {
    set(s => ({ messages: s.messages.some(x => x.id === id)
      ? s.messages.map(x => (x.id === id ? { ...x, code: text } : x))
      : s.messages.filter(x => x.type !== 'thinking').concat([{ id, type: 'assistant', at: Date.now(), askedId: null, intro: '', code: text, lang: 'text', outro: '', scenario: m.scenario || null, plain: true, streaming: true }]) }));
  }
  async function fetchReply(m, onText) {
    let reply;
    const S = app.state, gap = S.activeGap ? S.gaps.find(g => g.id === S.activeGap) : null;
    try {
      const t = String(await complete({ task: 'chat', input: gap ? { gap } : { mode: m.followUp ? 'followUp' : 'answer' }, messages: chatHistory().filter(x => x.content), onText })).trim();
      reply = { intro: '', code: t, lang: (t.match(/```(\w+)/) || [])[1] || 'text', outro: '', scenario: m.scenario || null, plain: true };
    } catch (e) {
      // Offline, the cold-start gap still gets a real explanation (hand-written), so the loop can be demoed.
      const first = !app.state.messages.some(x => x.type === 'assistant');
      reply = gap && isColdStart(gap) && first ? { intro: '', code: COLD_START.offlineAnswer, lang: 'text', outro: '', scenario: null, plain: true }
        : m.recorded ? { intro: '', code: m.recorded, lang: m.scenario.lang, outro: "(I couldn't reach the model just now, so this is Claude's saved answer to the same question.)", scenario: m.scenario, plain: true }
        : { intro: "I couldn't reach the model just now. Try again in a moment, or open a past chat in the sidebar.", code: '', lang: '', outro: '', scenario: null };
    }
    return reply;
  }
  function showReply(m, reply, id = app.nid()) {
    const followUp = canOfferOwn();
    set(s => ({ messages: s.messages.filter(x => x.type !== 'thinking' && x.id !== id).concat([{ id, type: 'assistant', at: Date.now(), askedId: null, ...reply }]) }));
    // Trying to understand something is the moment to offer Own it: Claude judges that from the message.
    if (reply.plain && followUp) inferLearning(m.question, reply.code, id);
  }
  const canOfferOwn = () => !app.state.activeGap && app.state.messages.filter(x => x.type === 'assistant').length >= 1;
  // Is this follow-up working to get better at something (why/how, "I'm confused", applying it), not a curious aside or a request?
  // Judged from the latest message only: with earlier questions as context, every follow-up looked like learning (process log 54).
  // Claude decides and names it; keyword matching is only the fallback when Claude can't be reached. It only ever offers.
  async function inferLearning(text, answer, msgId) {
    let learning = false, topic = '';
    try {
      const r = await ask('inferLearning', { text, answer });
      learning = !!r.learning; topic = r.topic || '';
    } catch (e) { learning = isExplainAsk(text); }
    if (!learning) return;
    const a = recordAsked(text, msgId, topic);
    setGo(msgId, { askedId: a.id });
  }
  function recordAsked(text, msgId, topic = '') {
    const quote = (text.match(/^> .*$/gm) || []).map(l => l.slice(2)).join('\n');
    const question = text.replace(/^About this part of your answer:\n?/, '').replace(/^> .*\n?/gm, '').trim();
    const first = app.state.messages.find(x => x.type === 'assistant');
    const a = { id: 'a' + app.nid(), msgId, quote, question, scenario: first ? first.scenario : null, at: app.now(), label: '', checked: false };
    app.progress.set(s => ({ asked: s.asked.concat([a]) }));
    // Name it as a learning target (a short phrase) for Learnings. A focus carried from "explain another way" wins
    // (it's what you chose), then a matched hand-written target.
    const c = app.state.carryFocus, setAsked = app.progress.setAsked;
    if (c && (c.quote ? quote.trim() === c.quote : question.includes(c.label))) { set({ carryFocus: null }); setAsked(a.id, { label: c.focus.label, focus: c.focus }); return a; }
    const t = matchTarget(a);
    if (t) setAsked(a.id, { label: t.label, focus: t });
    else if (topic) setAsked(a.id, { label: topic });
    else ask('askedLabel', { quote, question })
      .then(r => setAsked(a.id, { label: r.label }))
      .catch(() => setAsked(a.id, { label: (question || quote).split(/[.?!\n]/)[0].slice(0, 60) }));
    return a;
  }
  // A hand-written target that fits what was asked about, if any (same matching as highlights).
  function matchTarget(a) {
    const text = `${a.quote}\n${a.question}`, sc = a.scenario;
    const opts = authoredFocus(sc, text);
    if (opts.length && !(sc === SQL && opts[0].target === 'whole')) return opts[0];
    if (sc === REACT && isReactTiming(text)) return REACT_TIMING;
    return null;
  }
  // Own it, from an explanation you asked for (the same action as the icon, another way in). Claude's explanation is the material; no focus question.
  function checkLanded(askedId) {
    const S = app.state, a = S.asked.find(x => x.id === askedId); if (!a || S.own) return;
    const m = S.messages.find(x => x.id === a.msgId) || { id: a.msgId, scenario: a.scenario, code: a.quote || a.question, lang: 'text', plain: true };
    const focus = a.focus || { label: a.label || (a.question || a.quote).slice(0, 60), mode: 'concept' };
    app.progress.setAsked(a.id, { checked: true });
    set({ view: 'chat' }, () => app.own.beginOwn({ ...m, scenario: a.scenario || m.scenario, code: [m.code, a.quote].filter(Boolean).join('\n\n') }, a.quote || a.question, focus));
  }
  function copyAnswer(m) {
    if (navigator.clipboard) navigator.clipboard.writeText(answerText(m)).catch(() => { /* clipboard blocked */ });
    set({ copied: m.id }); setTimeout(() => set(s => s.copied === m.id ? { copied: null } : null), 1500);
  }
  function speakAnswer(m) {
    const sy = window.speechSynthesis; if (!sy) return;
    if (sy.speaking) { sy.cancel(); return; }
    sy.speak(new SpeechSynthesisUtterance(answerText(m, '. ')));
  }
  function setGo(id, patch) { set(s => ({ messages: s.messages.map(m => m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m) })); }

  // ---------- selection ----------
  function onCodeMouseUp(m, e, text = null) {
    const s = window.getSelection(); const t = text != null ? text : s ? s.toString().trim() : '';
    if (!t || app.state.own) { if (app.state.sel) set({ sel: null }); return; }
    set({ sel: { text: t, x: e.clientX, y: e.clientY, msg: m } });
  }
  // Highlight → "Ask Claude": quote it into the chat and ask. Explanation is what the chat already does well.
  const askSelection = () => { const s = app.state.sel; if (!s) return; const ws = window.getSelection(); if (ws) ws.removeAllRanges(); prefillChat(`About this part of your answer:\n${quote(s.text)}\n\n`, { sel: null }); };
  const ownSelection = () => { const s = app.state.sel; if (!s) return; set({ sel: null }); const ws = window.getSelection(); if (ws) ws.removeAllRanges(); app.own.beginOwn(s.msg, s.text); };
  // A drag that starts in an answer but is let go outside it (past the edge, below it, or back over the margin when
  // you start at a line break) still offers the popover. The answer's own mouseup handles a release inside it.
  function onDocMouseUp(e) {
    if (e.target.closest && e.target.closest('[data-answer-body]')) return;
    const s = window.getSelection(); if (!s || !s.rangeCount || !s.toString().trim()) return;
    const el = n => n && (n.nodeType === 1 ? n : n.parentElement);
    const body = el(s.anchorNode) && el(s.anchorNode).closest('[data-answer-body]'); if (!body) return;
    const m = app.state.messages.find(x => String(x.id) === body.closest('[data-msg-id]').getAttribute('data-msg-id')); if (!m) return;
    // Only the part inside that answer counts, not the buttons or the next message the drag ran into.
    const r = s.getRangeAt(0).cloneRange();
    if (!body.contains(r.startContainer)) r.setStart(body, 0);
    if (!body.contains(r.endContainer)) r.setEnd(body, body.childNodes.length);
    onCodeMouseUp(m, e, r.toString().trim());
  }
  // Puts text in the chat box with the caret at the end; extra is any other chat state to set with it.
  function prefillChat(text, extra = {}) { set({ ...extra, composer: text, view: 'chat' }, () => { const el = app.composerRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); }
  function rereadChat() {
    const o = app.state.own;
    if (window.matchMedia && window.matchMedia('(max-width: 760px)').matches) set({ sheetMin: true });
    const hl = ownedRange.current && ownedRange.current.startContainer.parentElement;
    if (hl) { hl.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const el = document.querySelector(`[data-msg-id="${o.msgId}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); set({ flashMsg: o.msgId }); setTimeout(() => set({ flashMsg: null }), 1600); }
  }

  return { state, ref, set, markOwnedText, focusPanel, newChat, openLearnings, seeInLearnings, backFromLearnings, startLead, startRisk, startPark, startTax, startSql, startReact,
    startBook, startJuno, send, answer, fetchReply, showReply, checkLanded, copyAnswer, speakAnswer, setGo, onCodeMouseUp, askSelection, ownSelection, prefillChat, rereadChat };
}
