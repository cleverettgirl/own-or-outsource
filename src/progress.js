// What you own, your gaps, what you asked about, where you stepped away and the demo clock are kept in this
// browser (localStorage), so someone who comes back days later finds their recalls due. Chats aren't kept.
// Scenarios are saved by name and the Own-it state is trimmed to what Learnings and recall read.
import { SCENARIOS, scKey } from './scenarios.js';
import { foldRepeats } from './util.js';

export const STORE = 'own-it:v1';
// ?demo in the URL loads a realistic sample state (for recording the demo video), kept under its own key so it
// never mixes with a real tester's progress.
export const DEMO_STORE = 'own-it:demo:v1';

export function saveProgress(key, S, uid) {
  const sc = x => ({ ...x, scenario: scKey(x.scenario) });
  const own = o => o && { scenario: scKey(o.scenario), focus: o.focus, lang: o.lang, code: String(o.code || '').slice(0, 4000), write: { schema: (o.write && o.write.schema) || '' } };
  const data = { v: 1, uid, timeShift: S.timeShift, tipDismissed: S.tipDismissed, gaps: S.gaps, asked: S.asked.map(sc), exits: S.exits.map(sc), practised: S.practised, ledger: S.ledger.map(e => ({ ...e, own: own(e.own) })) };
  try { window.localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* storage blocked or full: progress just isn't kept */ }
}

// The saved state and the last id it used, or null.
export function loadProgress(key) {
  let d = null;
  try { d = JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (e) { d = null; }
  if (!d || d.v !== 1) return null;
  const sc = x => ({ ...x, scenario: x.scenario ? SCENARIOS[x.scenario] : null });
  return { uid: d.uid || 0, state: { timeShift: d.timeShift || 0, tipDismissed: !!d.tipDismissed, gaps: d.gaps || [], asked: (d.asked || []).map(sc), exits: (d.exits || []).map(sc), practised: d.practised || [], ledger: foldRepeats((d.ledger || []).map(e => ({ ...e, own: sc(e.own) }))) } };
}
