import { allRight } from '../scoring.js';
import { samOpening, samReply, debriefTeach as debriefOf } from '../teach.js';
import { useMergeState } from './useMergeState.js';

// Teach one from Learnings: explain anything you own to Sam, any time, or right after a recall. The same Sam and
// debrief as the panel (teach.js); a shaky spot becomes an open gap on the same page. Nothing is scored.
export function useTeach(app) {
  const [state, set, ref] = useMergeState({ teaching: null }, app.afterCommit);
  const patch = (p, cb) =>
    set(s => ({ teaching: { ...s.teaching, ...p } }), cb);

  function startTeach(e) {
    // Just recalled it and missed something? Sam steers one question toward what the check said.
    const r = app.state.recall;
    const gap =
      r && r.entryId === e.id && r.grade && !allRight(r.grade)
        ? r.grade.note || ''
        : '';
    set({
      teaching: {
        entryId: e.id,
        gap,
        msgs: [{ role: 'sam', text: samOpening(e.own) }],
        input: '',
        turns: 0,
        loading: false,
        debrief: null,
        debriefLoading: false,
      },
    });
  }
  const entryOf = t => app.state.ledger.find(x => x.id === t.entryId);
  async function sendTeach() {
    const t = app.state.teaching,
      text = t.input.trim();
    if (!text || t.loading) return;
    const e = entryOf(t),
      msgs = t.msgs.concat([{ role: 'user', text }]),
      turns = t.turns + 1;
    patch({ msgs, input: '', turns, loading: true });
    const reply = await samReply({
      own: e.own,
      // What Sam is hearing about: the answer you owned from, or (for a closed gap or the seed) just its name.
      material: e.own.code || e.title,
      msgs,
      turns,
      gap: t.gap,
    });
    patch(
      { msgs: msgs.concat([{ role: 'sam', text: reply }]), loading: false },
      () => {
        if (turns >= 3) wrapTeach();
      },
    );
  }
  async function wrapTeach() {
    const t = app.state.teaching;
    if (!t || t.debrief || t.debriefLoading) return;
    const e = entryOf(t);
    patch({ debriefLoading: true });
    const d = await debriefOf({ label: e.title, msgs: t.msgs });
    patch({ debrief: d, debriefLoading: false });
    // The card's timeline shows you explained it, the way it shows a recall.
    app.progress.set(s => ({
      ledger: s.ledger.map(x =>
        x.id === e.id
          ? {
              ...x,
              taught: (x.taught || []).concat([
                { at: app.now(), gaps: d.unsure.length },
              ]),
            }
          : x,
      ),
    }));
  }
  // A shaky spot is a gap, named for where it came from.
  function saveGap(u) {
    const e = entryOf(app.state.teaching);
    return app.progress.saveGap({
      ...app.gaps.makeGap(
        u,
        'teach',
        `while you were explaining “${e.title}” to Sam`,
      ),
      from: e.title,
    });
  }
  function exploreGap(u) {
    const g = saveGap(u);
    set({ teaching: null });
    app.gaps.exploreGap(g);
  }

  return {
    state,
    ref,
    set,
    startTeach,
    sendTeach,
    wrapTeach,
    saveGap,
    exploreGap,
    onInput: ev => patch({ input: ev.target.value }),
    close: () => set({ teaching: null }),
  };
}
