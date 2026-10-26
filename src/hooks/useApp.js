import { createRef, useLayoutEffect, useRef } from 'react';
import { STORE, saveProgress } from '../progress.js';
import { useProgress } from './useProgress.js';
import { useChat } from './useChat.js';
import { useGoFirst } from './useGoFirst.js';
import { useOwn } from './useOwn.js';
import { useGaps } from './useGaps.js';
import { useRecall } from './useRecall.js';

// The app as one object the views read: app.state (every domain's state, as last rendered), the refs, and each
// domain's actions (app.chat, app.own, …). Domains call each other through it when an action runs, so they can
// depend on one another without importing each other.
function useCore() {
  const ref = useRef(null);
  if (!ref.current) {
    const pending = [];
    const app = {
      uid: 0,
      nid: () => ++app.uid,
      storeKey: STORE,
      scrollRef: createRef(),
      panelRef: createRef(),
      composerRef: createRef(),
      // Callbacks from set(patch, cb), run after the update commits (like a class's setState callback).
      afterCommit: cb => pending.push(cb),
      runAfterCommit: () => pending.splice(0).forEach(cb => cb()),
      get state() {
        return {
          ...app.progress.ref.current,
          ...app.chat.ref.current,
          ...app.own.ref.current,
          ...app.recall.ref.current,
        };
      },
      // Simulated "now": the demo can skip ahead in time to bring things due.
      now: () => Date.now() + app.state.timeShift,
    };
    ref.current = app;
  }
  return ref.current;
}

// A newly opened panel: the Own it try, or the latest go-first try or gap check that's under way.
const panelKey = st =>
  (st.own ? 'own' + st.own.id : '') +
  (st.messages
    .filter(
      m =>
        ['goFirst', 'goAsk', 'gapCheck'].includes(m.type) &&
        !m.panelClosed &&
        m.phase !== 'offer' &&
        m.phase !== 'answered',
    )
    .map(m => m.id)
    .pop() || '');

export function useApp() {
  const app = useCore();
  app.progress = useProgress(app);
  app.chat = useChat(app);
  app.own = useOwn(app);
  app.recall = useRecall(app);
  app.goFirst = useGoFirst(app);
  app.gaps = useGaps(app);

  // After each update, compared with the state of the previous one (not on the first render).
  const prevRef = useRef(null);
  useLayoutEffect(() => {
    const prev = prevRef.current,
      S = app.state;
    prevRef.current = S;
    if (!prev) return;
    // A newly opened panel starts open, not tucked away (phones).
    if (S.sheetMin && panelKey(prev) !== panelKey(S) && panelKey(S))
      app.chat.set({ sheetMin: false });
    if (
      [
        'ledger',
        'gaps',
        'asked',
        'exits',
        'practised',
        'timeShift',
        'tipDismissed',
      ].some(k => prev[k] !== S[k])
    )
      saveProgress(app.storeKey, S, app.uid);
    // A new answer lands with its top in view and stays put while it streams in, so you read from the start without
    // scrolling back up (log 111). Anything else new (your message, a try) scrolls to the bottom as before.
    const el = app.scrollRef.current,
      last = S.messages[S.messages.length - 1],
      prevLast = prev.messages[prev.messages.length - 1];
    const answerUpdate =
      !!last &&
      last.type === 'assistant' &&
      !!prevLast &&
      prevLast.id === last.id;
    if (
      el &&
      prev.messages !== S.messages &&
      last &&
      last.type === 'assistant' &&
      !answerUpdate
    ) {
      requestAnimationFrame(() => {
        const node = el.querySelector(`[data-msg-id="${last.id}"]`);
        if (node)
          el.scrollTop +=
            node.getBoundingClientRect().top -
            el.getBoundingClientRect().top -
            12;
        else el.scrollTop = el.scrollHeight;
      });
    } else if (
      el &&
      !answerUpdate &&
      (prev.messages !== S.messages ||
        (S.own &&
          prev.own !== S.own &&
          prev.own &&
          prev.own.phase !== S.own.phase))
    ) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
    app.chat.markOwnedText();
    // The panel starts each phase and step at the top.
    const a = prev.own,
      b = S.own;
    if (b && (!a || a.phase !== b.phase || a.step !== b.step))
      app.chat.focusPanel();
  });
  useLayoutEffect(() => app.runAfterCommit());

  return app;
}
