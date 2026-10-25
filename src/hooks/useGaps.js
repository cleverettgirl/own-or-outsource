import { ask } from '../claude.js';
import { isColdStart, COLD_START } from '../gaps.js';
import { judgeGap } from '../grading.js';
import { DAY } from '../util.js';

// Gaps: found (by explaining, or a missed recall) → explored in a chat → closed by a check → kept.
// The gaps themselves are saved progress (useProgress); the check lives in the chat's messages.
export function useGaps(app) {
  function makeGap(u, source, origin) {
    const S = app.state, o = S.own;
    return { id: 'g' + app.nid(), topic: u.topic, question: u.question || '', quote: u.quote || '', source, origin,
      from: o && o.focus ? o.focus.label : S.chatTitle, at: app.now(), status: 'open', context: isColdStart(u) ? COLD_START.context : (u.context || '') };
  }
  function teachGap(u) { const o = app.state.own; return app.progress.saveGap(makeGap(u, 'teach', `while you were explaining “${o && o.focus ? o.focus.label : 'this'}” to Sam`)); }
  // A new chat about just this gap. Claude starts from your guess; the banner keeps the goal in view.
  function exploreGap(gapOrId) {
    const g = typeof gapOrId === 'string' ? app.state.gaps.find(x => x.id === gapOrId) : gapOrId;
    if (app.state.own) app.own.finishOwn();
    const mine = g.origin.replace('you were', 'I was');
    const text = `I want to close a gap: ${g.topic}.\n\nIt came up ${mine}.${g.question ? ` I was asked: “${g.question}”` : ''}${g.quote ? ` My best guess was: “${g.quote}”` : ''}`;
    app.progress.set(s => ({ gaps: s.gaps.some(x => x.id === g.id) ? s.gaps : s.gaps.concat([g]) }));
    app.own.set({ own: null });
    app.chat.set({ view: 'chat', sel: null, composer: '', activeGap: g.id, chatTitle: g.topic,
      messages: [{ id: app.nid(), type: 'gapBanner', gapId: g.id }, { id: app.nid(), type: 'user', text }, { id: app.nid(), type: 'thinking' }] }, () => app.chat.answer({ question: text }));
  }
  // "Check me": one question that asks you to explain and apply the idea; Claude judges it against key points.
  const checkMeFromChat = gapId => { app.chat.set(s => ({ messages: s.messages.concat([{ id: app.nid(), type: 'user', text: "I think I've got it. Check me." }]) }), () => startGapCheck(gapId)); };
  async function startGapCheck(gapId) {
    const g = app.state.gaps.find(x => x.id === gapId), id = app.nid();
    app.chat.set(s => ({ messages: s.messages.concat([{ id, type: 'gapCheck', gapId, phase: 'loading', text: '' }]) }));
    let check;
    if (isColdStart(g)) check = COLD_START.check;
    else {
      try { const r = await ask('gapCheck', { topic: g.topic, context: g.context }); check = { question: r.question, keyPoints: (r.keyPoints || []).slice(0, 3) }; }
      catch (e) { check = { question: `In your own words, with an example: ${g.topic}?`, keyPoints: [] }; }
    }
    app.chat.setGo(id, { phase: 'ask', check });
  }
  async function submitGapCheck(m) {
    if (!m.text.trim() || m.judging) return;
    app.chat.setGo(m.id, { judging: true });
    const g = app.state.gaps.find(x => x.id === m.gapId);
    const result = await judgeGap(g, m.check, m.text);
    // Nothing could be checked: stay on the question with your answer, and say so.
    if (result.failed) return app.chat.setGo(m.id, { judging: false, checkError: result.feedback });
    app.chat.setGo(m.id, { judging: false, checkError: '', phase: 'done', result });
    if (result.closed) closeGap(g, m.check);
  }
  // A closed gap becomes something you own: it joins Learnings and comes back for recall in 3 days.
  function closeGap(g, check) {
    const now = app.now();
    app.progress.set(s => ({
      gaps: s.gaps.map(x => x.id === g.id ? { ...x, status: 'closed', closedAt: now } : x),
      ledger: s.ledger.some(e => e.id === 'gap-' + g.id) ? s.ledger : s.ledger.concat([{ id: 'gap-' + g.id, kind: 'gap', title: g.topic, predicted: null, actual: null, fixed: null, hints: 0, realWork: [], reviews: [],
        ownedAt: now, dueAt: now + 3 * DAY, gap: { ...g, check }, own: { scenario: null, focus: { label: g.topic, mode: 'concept' }, lang: 'concept', code: '', write: { schema: '' } } }]),
    }));
  }

  return { makeGap, teachGap, exploreGap, checkMeFromChat, startGapCheck, submitGapCheck };
}
