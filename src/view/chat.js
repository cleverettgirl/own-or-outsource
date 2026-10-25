// What the app renders, as plain values and handlers: the chat, the sidebar and (via ownVals) the Own it panel.
import { GO_FIRST } from '../goFirst.js';
import { tally, calibration } from '../scoring.js';
import { BOOK, JUNO } from '../scenarios.js';
import { ago, answerText, ownsWhole } from '../util.js';
import { learningsVals } from './learnings.js';
import { ownVals } from './own.js';

export function renderVals(app) {
  const S = app.state, o = S.own;
  const ctx = {
    firstAnswer: S.messages.find(m => m.type === 'assistant' && m.code),
    lastAnswer: [...S.messages].reverse().find(m => m.type === 'assistant'),
    openGap: S.activeGap && S.gaps.find(g => g.id === S.activeGap && g.status === 'open'),
    checkOpen: S.messages.some(m => m.type === 'gapCheck' && m.phase !== 'done'),
  };
  const messages = S.messages.map(m => messageVals(app, m, ctx));
  // The go-first try shown in the side panel: the latest one that's under way (or just finished) and not closed.
  const goPanel = messages.slice().reverse().find(v => ((v.isGo && ['predict', 'try', 'done'].includes(v.phase)) || (v.isGoAsk && ['try', 'checking', 'done'].includes(v.phase)) || v.isGapCheck) && !v.panelClosed) || null;
  if (goPanel) goPanel.inPanel = true;
  // Calibration across every item you predicted: what share you expected to get right vs what you got.
  // The Brier score (mean squared gap between your expected chance and each item's outcome; 0 is perfect)
  // is in the tooltip for anyone who wants the standard measure.
  const cal = calibration(S.ledger);
  const V = {
    goPanel, hasOwn: !!o, panelRef: app.panelRef, focusPanel: app.chat.focusPanel,
    dismissTip: () => app.progress.set({ tipDismissed: true }),
    openNav: () => app.chat.set({ navOpen: true }), closeNav: () => app.chat.set({ navOpen: false }),
    isLearnings: S.view === 'learnings', openLearnings: app.chat.openLearnings, ownedCount: S.ledger.filter(e => !e.merged).length, dueCount: S.ledger.filter(e => e.dueAt != null && e.dueAt <= app.now()).length,
    learn: S.view === 'learnings' ? learningsVals(app) : null,
    // Seeded chats show up as past chats: you already talked with Claude, now see what stuck.
    chatList: [
      ...(S.messages.length && ![BOOK.title, JUNO.title].includes(S.chatTitle) ? [{ title: S.chatTitle, active: true, onClick: () => {} }] : []),
      { title: BOOK.title, active: S.chatTitle === BOOK.title, onClick: app.chat.startBook },
      { title: JUNO.title, active: S.chatTitle === JUNO.title, onClick: app.chat.startJuno },
    ],
    messages, chatTitle: S.chatTitle, isEmpty: !S.messages.length, composer: S.composer,
    hasCalibration: cal.items > 0, calibrationText: cal.text, calibrationTitle: cal.title,
    composerPlaceholder: o ? 'Reply to Claude…' : 'Ask Claude anything…',
    onComposer: e => app.chat.set({ composer: e.target.value }), onComposerKey: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); app.chat.send(); } },
    send: app.chat.send, newChat: app.chat.newChat, startLead: app.chat.startLead, startRisk: app.chat.startRisk, startPark: app.chat.startPark, startTax: app.chat.startTax, startSql: app.chat.startSql, startReact: app.chat.startReact,
    composerRef: app.composerRef, hasSel: !!S.sel, selX: S.sel ? S.sel.x + 'px' : '0px', selY: S.sel ? S.sel.y + 'px' : '0px', ownSelection: app.chat.ownSelection, askSelection: app.chat.askSelection, scrollRef: app.scrollRef,
  };
  return o ? { ...V, ...ownVals(app, o) } : V;
}

// One message, as the chat (and, for a go-first try or a gap check, the side panel) shows it.
function messageVals(app, m, { firstAnswer, lastAnswer, openGap, checkOpen }) {
  const S = app.state, o = S.own, onText = e => app.chat.setGo(m.id, { text: e.target.value });
  const v = { ...m, isUser: m.type === 'user', isThinking: m.type === 'thinking', isAssistant: m.type === 'assistant', isOwn: m.type === 'own', isOwnDone: m.type === 'ownDone' };
  // Go-first tries happen in the side panel (log 88); the chat keeps the offer and Claude's answer.
  const panelTry = { inPanel: false, onAskAbout: () => app.goFirst.askAboutPanelTry(m.id), onDeeper: idea => app.goFirst.goDeeper(m.id, idea), onClosePanel: () => app.chat.setGo(m.id, { panelClosed: true }), onOpenPanel: () => app.chat.setGo(m.id, { panelClosed: false }) };
  if (m.type === 'gapBanner') {
    const g = S.gaps.find(x => x.id === m.gapId) || {};
    return { ...v, isGapBanner: true, gap: g, gapClosed: g.status === 'closed' };
  }
  if (m.type === 'gapCheck') return { ...v, ...panelTry, isGapCheck: true, gapTopic: (S.gaps.find(x => x.id === m.gapId) || {}).topic || '', onText, onSubmit: () => app.gaps.submitGapCheck(app.state.messages.find(x => x.id === m.id)), onAgain: () => app.gaps.startGapCheck(m.gapId) };
  if (m.type === 'goAsk') return { ...v, ...panelTry, isGoAsk: true, onFirst: () => app.chat.setGo(m.id, { phase: 'try' }), onAnswer: () => app.goFirst.goAskAnswer(m.id), onText, onSubmit: () => app.goFirst.goAskSubmit(m.id),
    replyText: m.reply ? answerText(m.reply) : '', showReply: m.phase === 'answered' || m.phase === 'done' };
  if (m.type === 'goFirst') {
    const g = GO_FIRST[m.key], e = app.goFirst.ownedFor(m.key), planned = { write: { check: g.check } }, t = m.grade && tally(m.grade);
    const said = t && `You said ${m.prediction} of ${t.n} and got ${t.right}.`;
    return { ...v, ...panelTry, isGo: true, go: g, goOwned: e ? e.title : '', goWas: e ? `you predicted ${e.predicted} of ${e.n} and got ${e.actual}` : '', goN: app.own.plannedItems(planned).length,
      // What the go-first try is checked on, named as topics (as on the predict screen), so "how many" points at something.
      goTopics: app.own.plannedTopics(planned) || [],
      goKind: g.check.type === 'choice' ? 'question' : g.check.type === 'sql' ? 'thing it has to get right' : 'answer',
      goFirst: () => app.chat.setGo(m.id, { phase: 'predict' }), goAnswer: () => app.goFirst.goOutsource(m), goPredict: n => app.chat.setGo(m.id, { prediction: n, phase: 'try' }),
      goText: onText, goPick: (id, val) => app.chat.setGo(m.id, x => ({ picked: { ...x.picked, [id]: val } })), goCheck: () => app.goFirst.goCheck(m),
      goResult: !t ? '' : t.right === m.prediction ? `${said} Spot on.` : t.right > m.prediction ? `${said} You own more than you thought.` : said, goItems: m.grade && m.grade.items ? m.grade.items : [] };
  }
  if (m.type !== 'assistant') return v;
  const askedItem = m.askedId && S.asked.find(a => a.id === m.askedId), ownActive = !!o && o.msgId === m.id;
  const ownExpanded = !!(askedItem && !askedItem.checked && !o);
  return { ...v, flash: S.flashMsg === m.id, owning: ownActive ? (ownsWhole(o) ? 'whole' : 'part') : null, hasIntro: !!m.intro, hasOutro: !!m.outro, hasCode: !!m.code,
    showOwnHint: !!m.code && !m.streaming, checkChip: !!openGap && m === lastAnswer && !checkOpen ? () => app.gaps.checkMeFromChat(openGap.id) : null,
    ownExpanded, showTip: !S.tipDismissed && !o && m === firstAnswer, ownActive, ownBlocked: !!o && !ownActive,
    onCopy: () => app.chat.copyAnswer(m), onSpeak: () => app.chat.speakAnswer(m), copied: S.copied === m.id, when: m.at ? ago(m.at) : '', onMouseUp: e => app.chat.onCodeMouseUp(m, e),
    // The expanded button owns exactly what you asked about (no focus question).
    ownAll: ownExpanded ? () => app.chat.checkLanded(askedItem.id) : () => { if (app.state.own) { if (app.state.own.msgId === m.id) app.chat.focusPanel(); return; } app.own.beginOwn(m, m.code); },
    ownAllLabel: m.lang === 'sql' ? 'Own the whole query' : 'Own this response' };
}
