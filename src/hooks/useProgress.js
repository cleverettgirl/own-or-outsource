import { useLayoutEffect } from 'react';
import { loadProgress } from '../progress.js';
import { seedLedger, demoState } from '../demo.js';
import { DAY } from '../util.js';
import { useMergeState } from './useMergeState.js';

// What you own, your gaps, what you asked about, where you stepped away and the demo clock: the state that is
// kept in this browser (progress.js saves it after each change, see useApp).
export function useProgress(app) {
  const [state, set, ref] = useMergeState({ ledger: [], exits: [], gaps: [], asked: [], timeShift: 0, tipDismissed: false }, app.afterCommit);

  useLayoutEffect(() => {
    const saved = loadProgress(app.storeKey);
    if (saved) { app.uid = Math.max(app.uid, saved.uid); set(saved.state); } else if (app.isDemo) set(demoState()); else if (!ref.current.ledger.length) set({ ledger: seedLedger() });
  }, []);

  function resetDemo() {
    if (!window.confirm(app.isDemo ? 'Reset the sample data to how it started?' : 'Clear everything you own, your gaps and recalls, and start the demo fresh?')) return;
    try { window.localStorage.removeItem(app.storeKey); } catch (e) { /* nothing saved */ }
    app.uid = 0;
    set({ ledger: seedLedger(), exits: [], gaps: [], asked: [], ...(app.isDemo ? demoState() : {}), timeShift: 0, tipDismissed: false });
    app.chat.set({ messages: [], activeGap: null, chatTitle: 'New chat', view: 'chat', composer: '' });
    app.own.set({ own: null });
    app.recall.set({ recall: null });
  }
  const skipAhead = () => set(s => ({ timeShift: s.timeShift + 3 * DAY }));
  function appendRealWork(entryId, rec) { set(s => ({ ledger: s.ledger.map(x => x.id === entryId ? { ...x, realWork: (x.realWork || []).concat([rec]) } : x) })); }
  function setAsked(id, patch) { set(s => ({ asked: s.asked.map(a => a.id === id ? { ...a, ...patch } : a) })); }
  // Same topic twice is one gap.
  function saveGap(g) { const have = app.state.gaps.find(x => x.topic === g.topic); if (have) return have; set(s => ({ gaps: s.gaps.concat([g]) })); return g; }

  return { state, ref, set, resetDemo, skipAhead, appendRealWork, setAsked, saveGap };
}
