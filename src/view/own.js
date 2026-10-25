// The Own it panel: what to own, predict, the try, the reveal and teaching Sam.
import { SCALES, RUBRIC_WHY, tally, allRight, correctionNote } from '../scoring.js';
import { ownsWhole, isPickCheck, stepLabel } from '../util.js';

export function ownVals(app, o) {
  const S = app.state, L = app.own.ladder(o), w = o.write, chk = w.check;
  // One progress indicator for the whole flow. Personal practice has no predict or reveal, so no stepper.
  const phases = o.phase === 'spot' ? [] : (o.askedFocus ? ['focus'] : []).concat(['predict', 'ladder', 'reveal']);
  const phaseName = { focus: 'What to own', predict: 'Predict', ladder: 'Try it', reveal: 'Reveal' };
  const curPhase = o.phase === 'teach' ? 'reveal' : o.phase;
  const stepper = phases.map(ph => ({ label: phaseName[ph], cur: ph === curPhase, done: phases.indexOf(ph) < phases.indexOf(curPhase) }));
  const phaseLabels = { ...phaseName, ladder: o.step === 'assemble' ? 'Try it · warming up with the pieces' : phaseName.ladder, teach: 'Optional · teach Sam', spot: 'Practise spotting it' };

  // Predict: you predict about the try itself. It's shown, with what it will be checked on, so "these" points at something.
  const n = app.own.plannedItems(o).length, topics = app.own.plannedTopics(o);
  const thing = chk && chk.type === 'choice' ? 'question' : chk && chk.type === 'steps' ? 'step' : chk && chk.respond ? 'key move' : chk && chk.type === 'explain' ? 'key idea' : chk && chk.type === 'sql' ? 'thing' : 'requirement';
  const plural = n === 1 ? thing : thing + 's';
  const predict = w.loading || (!w.task && !chk) ? { predictQuestion: 'Preparing your try…', predictTask: '', predictTopics: [], predictWhat: '', predictOptions: [] } : {
    predictTask: w.task, predictTopics: topics || [],
    predictWhat: chk && chk.type === 'choice' ? `${n} ${plural}, on:` : topics ? `It's checked on ${n} ${plural}:` : chk && chk.type === 'explain' ? `Your answer is checked for ${n} ${plural}.` : `It's checked on ${n} ${plural}.`,
    predictQuestion: n === 1 ? 'Will you get it right on your own?' : `How many of the ${n} will you get right on your own?`,
    predictLow: app.own.orderMatters(o) ? 'Under half? You\'ll start with a quick warm-up.' : '',
    predictOptions: Array.from({ length: n + 1 }, (_, k) => ({ n: k, label: n === 1 ? (k ? 'Yes' : 'Not yet') : k === 0 ? 'none' : k === n ? 'all' : `of ${n}`, selected: o.predSel === k, onPick: () => app.own.setOwn({ predSel: k }) })),
  };

  // Assemble: a warm-up, the pieces shuffled.
  const a = o.asm, byId = a ? Object.fromEntries(a.pieces.map(p => [p.id, p])) : {}, t = app.own.targetOf(o);
  const asm = a ? {
    asmBank: a.bank.map(id => ({ text: byId[id].text, onClick: () => app.own.asmAdd(id) })), asmBankEmpty: !a.bank.length,
    asmSeq: a.seq.map(id => ({ text: byId[id].text, onClick: () => app.own.asmRemove(id), up: () => app.own.asmMove(id, -1), down: () => app.own.asmMove(id, 1), cls: a.lastWrong.includes(id) ? 'bg-accent-soft border-accent' : 'bg-surface border-line' })),
    asmFeedback: !!a.feedback, asmFeedbackText: a.feedback, asmNotCorrect: !a.correct, asmCorrect: a.correct, asmLoading: a.loading, checkAsm: app.own.checkAsm,
    asmWhyPrompt: (t && t.assemble && t.assemble.why) || 'In one line: what would break if you swapped two of these lines?', asmHasDecoy: a.pieces.some(p => p.id === 'dx'), asmWhy: a.why, onAsmWhy: e => app.own.setAsm({ why: e.target.value }),
  } : {};

  // Reveal: the first unassisted try is the measurement; a fix is shown next to it.
  const g = w.grade || { score: 0, worked: '', gap: '', revealLine: '' };
  const g1 = w.firstGrade || g;
  const startI = L.indexOf(o.startStep);
  const t1 = tally(g1), tn = tally(g), N = t1.n, fixed = w.attempts > 1;
  const pct = k => (N ? k / N * 100 : 0) + '%';
  const lo = Math.min(o.prediction, t1.right), hi = Math.max(o.prediction, t1.right);
  const picks = isPickCheck(chk);
  const revealNodes = L.map((s, i) => {
    const seen = o.visited[s] || 0, skipped = i < startI && !seen;
    const detail = skipped ? 'optional, not opened' : s === 'assemble' ? (a ? (a.attempts === 1 ? 'right first try' : a.attempts + ' tries' + (a.usedDistractor ? ', filter in WHERE' : '')) : '')
      : t1.right + ' of ' + N + (w.attempts > 1 ? ' → ' + tn.right + ' on try ' + w.attempts : '') + (w.hints.length ? ', ' + w.hints.length + ' hint' + (w.hints.length > 1 ? 's' : '') : ', no hints');
    return { label: stepLabel(o, s), detail, above: i === startI ? 'started here · predicted ' + o.prediction : '', mark: skipped ? '' : '✓', dot: skipped ? 'bg-page border-line-strong' : s === 'write' ? 'bg-good border-good' : 'bg-accent border-accent', fg: skipped ? 'text-faint' : 'text-ink' };
  });
  const revealTables = g.table ? [['What yours returns', g.table.yours, 'extra', 'bg-accent-soft'], ['What it should return', g.table.expected, 'missing', 'bg-good-soft']].map(([title, tb, mark, bg]) => ({
    title, empty: !tb.rows.length, cols: tb.cols.map(() => 'minmax(0,1fr)').join(' ') || '1fr', headers: tb.cols.map(c => ({ t: c })),
    rows: tb.rows.map(r => ({ cells: r.cells.map((c, j) => ({ t: c, dim: c === 'NULL', hl: (r.diffs || []).includes(j) ? bg : '' })), bg: r.mark === mark ? bg : '' })),
    legend: [tb.rows.some(r => r.mark === mark) ? (mark === 'extra' ? 'highlighted rows: should not be there' : 'highlighted rows: yours is missing them') : '', tb.rows.some(r => r.mark === 'near') ? 'highlighted cells: the difference' : '', mark === 'extra' && g.table.dropped && g.table.dropped.length ? `extra columns left out: ${g.table.dropped.join(', ')}` : ''].filter(Boolean).join(' · ') })) : [];

  const tc = o.teach;
  return {
    ownWhole: ownsWhole(o), ownTitle: o.focus ? o.focus.label : S.chatTitle, ownPhaseLabel: phaseLabels[o.phase], stepper,
    phaseFocus: o.phase === 'focus', focusLoading: !o.focusOptions, focusOptions: (o.focusOptions || []).map(f => ({ label: f.label, kind: f.mode === 'sequence' ? 'structure' : 'concept', onPick: () => app.own.pickFocus(f) })),
    focusOther: o.focusOther, onFocusOther: e => app.own.setOwn({ focusOther: e.target.value }), onFocusOtherKey: e => { if (e.key === 'Enter') app.own.submitFocusOther(); }, submitFocusOther: app.own.submitFocusOther,
    focusLabel: o.focus ? o.focus.label : o.spot ? o.spot.label[0].toUpperCase() + o.spot.label.slice(1) : '',
    phaseSpot: o.phase === 'spot', spotProps: o.spot ? { spot: o.spot.label, scenarios: o.spot.scenarios, loading: o.spot.loading, failed: o.spot.failed, onStart: app.own.startSpot, onChat: app.own.spotChat, onDone: app.own.finishSpot } : null,
    rereadChat: app.chat.rereadChat,
    phasePredict: o.phase === 'predict', phaseLadder: o.phase === 'ladder', phaseReveal: o.phase === 'reveal', phaseTeach: o.phase === 'teach',
    leaveOwn: app.own.leaveOwn, changeFocus: app.own.changeFocus,
    // Before you commit to a number: a nudge back to what you're owning, which stays open in the chat beside the panel.
    predictReread: ownsWhole(o) ? "Claude's answer" : 'the part you highlighted',
    ...predict,
    // Pick a number, then lock it in: the choice stays visible and changeable until you start.
    predSel: o.predSel ?? null, lockPrediction: () => { const k = app.state.own.predSel; if (k != null) app.own.pickPrediction(k); },
    writeRefresher: !w.grade && app.own.orderMatters(o) ? [{ label: 'Warm up with the pieces', onClick: () => app.own.setOwn({ phase: 'ladder' }, () => app.own.enterStep('assemble')) }] : [],
    askAboutIt: app.own.askAboutIt, stepAsm: o.step === 'assemble', stepWrite: o.step === 'write', goWrite: app.own.goWrite,
    ...asm,
    writeFixing: !!w.firstGrade && !w.grade, writeTry: w.attempts + 1, writeLastGap: w.firstGrade ? (w.lastGap || w.firstGrade.gap || '') : '',
    notReady: o.prediction != null && !w.firstGrade && o.prediction / Math.max(1, n) < 0.5, askClaudeFirst: app.own.askClaudeFirst, seeInLearnings: app.chat.seeInLearnings,
    writeIsChoice: !!(chk && chk.type === 'choice'), writeIsSteps: !!(chk && chk.type === 'steps'), writeSteps: chk && chk.steps ? chk.steps : [], writeQs: chk && chk.questions ? chk.questions : [], writePicked: w.picked,
    onWritePick: (id, val) => app.own.setOwn(cur => ({ write: { ...cur.write, picked: { ...cur.write.picked, [id]: val } } })),
    writeBefore: w.before, writeAfter: w.after, writePlaceholder: w.placeholder || 'Write it here. Ask for a hint any time; hints are part of learning, not cheating.',
    writeTask: w.task, writeProse: !!(chk && chk.type === 'explain'), writeLoading: w.loading, writeSchema: w.schema, hasWriteSchema: !!w.schema, writeText: w.text, onWriteText: e => app.own.setOwn(cur => ({ write: { ...cur.write, text: e.target.value } })),
    hasHints: w.hints.length > 0, hints: w.hints.map((h, i) => ({ t: h, n: i + 1 })), askHint: app.own.askHint, submitWrite: app.own.submitWrite,
    writeNotGraded: !w.grade, gradeLoading: w.gradeLoading || w.hintLoading, gradeLoadingText: w.hintLoading ? 'thinking of a hint…' : 'grading fairly…',
    // After a fix, the result shown is the latest try; only the prediction stays compared with the first try, since
    // that's what you could do on your own (and a retry always ends at full marks).
    revealFixed: fixed,
    revealHeadline: fixed ? (g.judgedByClaude ? `Try ${w.attempts} didn't run, so Claude judged it: ${tn.right} of ${tn.n}.` : g.didntRun ? `Try ${w.attempts} didn't run yet.` : `Try ${w.attempts}: ${tn.right} of ${tn.n}${tn.right === tn.n ? ', all there.' : '.'}`) : g1.judgedByClaude ? "It didn't run, so Claude judged it." : g1.didntRun ? "It didn't run yet." : t1.right === o.prediction ? 'Your prediction matched.' : t1.right > o.prediction ? 'You own more than you predicted.' : 'The reading was smoother than the doing.',
    // What was checked, item by item, on your first try. The idea you came to own is marked.
    revealItems: (g.items || []).map(i => ({ ...i, mark: i.ok ? '✓' : '✗' })), revealOwnedNote: (g.items || []).some(i => i.owned) ? 'the idea you came to own' : '',
    canFix: !!w.grade && !allRight(g), fixWrite: app.own.fixWrite,
    revealNodes, revealCols: `repeat(${L.length},1fr)`, predLeft: pct(o.prediction), actLeft: pct(t1.right), gapLeft: pct(lo), gapWidth: (N ? (hi - lo) / N * 100 : 0) + '%', ownPredictionN: o.prediction, actualN: t1.right, revealN: N,
    // The ✓/✗ list already says what held for picked answers; the explanation line is for runs and written answers.
    revealWhy: g.didntRun || (picks && (g.items || []).length) ? '' : g.why || RUBRIC_WHY[g.score] || '',
    revealNotes: [...(g.worked && !picks ? [{ kind: 'nice', quote: '', text: g.worked }] : []), ...(w.notes || [])], notesLoading: !!w.notesLoading,
    revealScale: g.judgedByClaude ? "It didn't run, so Claude judged each item from your query, quoting it as evidence" : chk && chk.respond ? SCALES.respond : chk && SCALES[chk.type] ? SCALES[chk.type] : 'Checked by Claude against each requirement, quoting your attempt as evidence',
    revealCorrection: correctionNote(g.corrections), revealTables, revealSample: chk && chk.respond ? w.sample || '' : '',
    revealLine: fixed ? `Your prediction (${o.prediction} of ${N}) is compared with your first try (${t1.right} of ${N}), since that's what you could do on your own.` : g1.revealLine, hasGap: !!g.gap, gradeGap: g.gap,
    // Feedback of any kind (a gap, or a note on how you wrote it) is worth following up, even on a full score.
    canAsk: !!g.gap || !allRight(g) || (w.notes || []).some(x => x.kind !== 'nice'), yourAnswer: app.own.attemptText(o) || '', yourAnswerMono: !(chk && ['choice', 'steps', 'explain', 'number'].includes(chk.type)) && app.own.isCodeOwn(o), finishOwn: app.own.finishOwn, goTeach: app.own.goTeach,
    teachMsgs: tc.msgs.map(x => ({ text: x.text, isSam: x.role === 'sam', row: x.role === 'sam' ? 'self-start' : 'self-end', bubble: x.role === 'sam' ? 'bg-surface' : 'bg-bubble' })),
    teachLoading: tc.loading, teachOpen: tc.turns < 3 && !tc.debrief, teachDebrief: tc.debrief || null, teachDebriefLoading: !!tc.debriefLoading, wrapTeach: app.own.debriefTeach, canWrap: tc.turns >= 1 && !tc.debrief,
    exploreTeachGap: u => app.gaps.exploreGap(app.gaps.teachGap(u)), saveTeachGap: u => app.gaps.teachGap(u), gapTopics: S.gaps.map(g => g.topic), teachInput: tc.input, onTeachInput: e => app.own.setOwn(cur => ({ teach: { ...cur.teach, input: e.target.value } })), onTeachKey: e => { if (e.key === 'Enter') app.own.sendTeach(); }, sendTeach: app.own.sendTeach,
  };
}
