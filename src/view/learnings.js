// The Learnings page: everything you chose to own, and how it went.
import { GO_FIRST, goFirstFor } from '../goFirst.js';
import { tally, allRight, calibration } from '../scoring.js';
import { scKey } from '../scenarios.js';
import { DAY, rel } from '../util.js';

export function learningsVals(app) {
  const S = app.state;
  const now = app.now();
  const items = S.ledger
    .filter(e => !e.merged)
    .reverse()
    .map(e => {
      const key = goFirstFor(e.own.focus && e.own.focus.target);
      const due = e.dueAt != null && e.dueAt <= now,
        r = S.recall && S.recall.entryId === e.id ? S.recall : null;
      const tc = S.teaching && S.teaching.entryId === e.id ? S.teaching : null;
      // For the map and the card covers: which chat it came from, what kind it is, how soon it comes back.
      return {
        sc: e.kind === 'gap' ? 'GAP' : scKey(e.own.scenario),
        target: e.own.focus && e.own.focus.target,
        dueAt: e.dueAt,
        daysToDue: e.dueAt == null ? null : (e.dueAt - now) / DAY,
        example: !!e.example,
        firstLine:
          e.kind === 'gap'
            ? ''
            : `predicted ${e.predicted} of ${e.n}, got ${e.actual} of ${e.n} on the first try`,
        id: e.id,
        title: e.title,
        from:
          e.kind === 'gap'
            ? e.gap.from
            : e.own.scenario
              ? e.own.scenario.title
              : S.chatTitle,
        due,
        owned: e.ownedAt != null ? `owned ${rel(e.ownedAt, now)}` : '',
        next: e.dueAt != null && !due ? `next recall ${rel(e.dueAt, now)}` : '',
        onRecall: () => app.recall.startRecall(e),
        recall:
          r && r.grade
            ? { ...r, ...tally(r.grade), full: allRight(r.grade) }
            : r,
        then: r ? r.thenLabel : '',
        onTeach: () => app.teach.startTeach(e),
        teaching: tc,
        onNew: key ? () => app.goFirst.startGoFirst(key) : null,
        newLabel: key ? GO_FIRST[key].chip : '',
      };
    });
  const real = S.ledger.flatMap(e => e.realWork || []);
  // The new question each thing you own unlocks: a node on the map off its parent, dashed until you've tried it.
  // Clicking it starts the question (You go first). The cards keep to recall and Sam (log 115).
  const related = [
    ...new Set(items.map(it => it.onNew && it.newLabel).filter(Boolean)),
  ].map(chip => {
    const it = items.find(x => x.newLabel === chip);
    return {
      label: chip.split(' · ')[1],
      parent: it.id,
      onClick: it.onNew,
      tried: S.ledger.some(
        e =>
          (e.realWork || []).length &&
          goFirstFor(e.own.focus && e.own.focus.target) &&
          GO_FIRST[goFirstFor(e.own.focus && e.own.focus.target)].chip === chip,
      ),
    };
  });
  return {
    back: S.learnFrom ? app.chat.backFromLearnings : null,
    backLabel: S.own ? 'Back to your try' : 'Back to the chat',
    justOwned: S.justOwned || null,
    related,
    recalling: items.find(it => it.recall) || null,
    teachingItem: items.find(it => it.teaching) || null,
    teach: S.teaching && {
      msgs: S.teaching.msgs.map(x => ({
        text: x.text,
        isSam: x.role === 'sam',
      })),
      loading: S.teaching.loading,
      open: S.teaching.turns < 3 && !S.teaching.debrief,
      input: S.teaching.input,
      onInput: app.teach.onInput,
      send: app.teach.sendTeach,
      debrief: S.teaching.debrief,
      debriefLoading: S.teaching.debriefLoading,
      gapTopics: S.gaps.map(g => g.topic),
      savedLabel: 'Saved under Open gaps',
      explore: app.teach.exploreGap,
      save: app.teach.saveGap,
    },
    canWrapTeach: !!S.teaching && S.teaching.turns >= 1 && !S.teaching.debrief,
    wrapTeach: app.teach.wrapTeach,
    closeTeach: app.teach.close,
    nextUp:
      items
        .filter(it => !it.due && it.dueAt != null)
        .sort((a, b) => a.dueAt - b.dueAt)[0] || null,
    calPct: (() => {
      const c = calibration(S.ledger);
      return c.items ? c.got : null;
    })(),
    practised: (S.practised || [])
      .slice()
      .reverse()
      .map(p => ({ ...p, when: rel(p.at, now) })),
    openGaps: S.gaps
      .filter(g => g.status === 'open')
      .map(g => ({
        ...g,
        when: rel(g.at, now),
        onExplore: () => app.gaps.exploreGap(g.id),
      })),
    saveRecallGap: () => app.recall.recallGap(),
    exploreRecallGap: () => app.gaps.exploreGap(app.recall.recallGap()),
    gapTopics: S.gaps.map(g => g.topic),
    items,
    empty: !items.length,
    dueItems: items.filter(it => it.due),
    onRecallText: e =>
      app.recall.set(s => ({ recall: { ...s.recall, text: e.target.value } })),
    onRecallPick: (id, v) =>
      app.recall.set(s => ({
        recall: { ...s.recall, picked: { ...s.recall.picked, [id]: v } },
      })),
    askAboutRecall: app.recall.askAboutRecall,
    resetDemo: app.progress.resetDemo,
    submitRecall: app.recall.submitRecall,
    closeRecall: () => app.recall.set({ recall: null }),
    skipAhead: app.progress.skipAhead,
    shifted: S.timeShift > 0,
    shiftDays: Math.round(S.timeShift / DAY),
    stats: [
      { n: S.ledger.filter(e => !e.merged).length, label: 'owned' },
      { n: S.gaps.length, label: 'gaps found by trying' },
      {
        n: S.gaps.filter(g => g.status === 'closed').length,
        label: 'gaps closed',
      },
      {
        n: real.filter(r => !r.outsourced).length,
        label: 'times you went first',
      },
    ],
  };
}
