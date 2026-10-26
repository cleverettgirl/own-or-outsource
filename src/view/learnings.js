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
      const steps = (
        e.kind === 'gap'
          ? [
              {
                label: 'Gap found',
                v: e.gap.source === 'recall' ? 'in a recall' : 'teaching Sam',
                tone: 'mute',
              },
              { label: 'Closed', v: 'checked ✓', tone: 'act' },
            ]
          : (e.earlier || [])
              .map(x => ({
                label: `Earlier, ${rel(x.at, now)}`,
                v: `predicted ${x.predicted}, got ${x.actual} of ${x.n}`,
                tone: 'mute',
              }))
              .concat([
                {
                  label: 'Predicted',
                  v: `${e.predicted} of ${e.n}`,
                  tone: 'pred',
                },
                {
                  label: 'First try',
                  v: `${e.actual} of ${e.n}${e.judged ? ', judged by Claude' : ''}`,
                  tone: 'act',
                },
              ])
      )
        .concat(
          e.fixed != null && e.fixed !== e.actual
            ? [{ label: 'Fixed', v: `${e.fixed} of ${e.n}`, tone: 'mute' }]
            : [],
        )
        .concat(
          (e.reviews || []).map(rv => ({
            label: `Recall · ${rel(rv.at, now)}`,
            v: `${rv.right} of ${rv.n}`,
            tone: 'act',
          })),
        )
        .concat(
          (e.realWork || []).map(r =>
            r.outsourced
              ? { label: 'Real work', v: 'let Claude answer', tone: 'mute' }
              : r.n
                ? {
                    label: 'Real work',
                    v: `went first, ${r.actual} of ${r.n}`,
                    tone: 'act',
                  }
                : { label: 'Real work', v: 'went first', tone: 'act' },
          ),
        )
        .concat(
          e.dueAt != null && e.dueAt > now
            ? [{ label: 'Recall', v: rel(e.dueAt, now), tone: 'next' }]
            : [],
        );
      const due = e.dueAt != null && e.dueAt <= now,
        r = S.recall && S.recall.entryId === e.id ? S.recall : null;
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
        steps,
        due,
        owned: e.ownedAt != null ? `owned ${rel(e.ownedAt, now)}` : '',
        next: e.dueAt != null && !due ? `next recall ${rel(e.dueAt, now)}` : '',
        onRecall: () => app.recall.startRecall(e),
        recall:
          r && r.grade
            ? { ...r, ...tally(r.grade), full: allRight(r.grade) }
            : r,
        then: r ? r.thenLabel : '',
        onNew: key ? () => app.goFirst.startGoFirst(key) : null,
        newLabel: key ? GO_FIRST[key].chip : '',
      };
    });
  const real = S.ledger.flatMap(e => e.realWork || []);
  // Related questions you haven't tried yet: the "go first" questions what you own unlocks, shown dashed on the map.
  const untried = [
    ...new Set(items.map(it => it.onNew && it.newLabel).filter(Boolean)),
  ]
    .filter(
      chip =>
        !S.ledger.some(
          e =>
            (e.realWork || []).length &&
            goFirstFor(e.own.focus && e.own.focus.target) &&
            GO_FIRST[goFirstFor(e.own.focus && e.own.focus.target)].chip ===
              chip,
        ),
    )
    .map(chip => ({
      label: chip.split(' · ')[1],
      parent: items.find(it => it.newLabel === chip).id,
    }));
  return {
    back: S.learnFrom ? app.chat.backFromLearnings : null,
    backLabel: S.own ? 'Back to your try' : 'Back to the chat',
    justOwned: S.justOwned || null,
    untried,
    recalling: items.find(it => it.recall) || null,
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
