import { ask } from '../claude.js';
import { tally, correctionNote } from '../scoring.js';
import { isColdStart } from '../gaps.js';
import { runCheck, gradeAttempt, fallbackGrade, judgeGap, COULDNT_CHECK } from '../grading.js';
import { DAY, rel, quote, pickedText } from '../util.js';
import { useMergeState } from './useMergeState.js';

// Recall: what you owned comes back for an unassisted check. Spaced: owned things come due after 3 days;
// recalled right → a week, then 3 weeks; missed → tomorrow.
export function useRecall(app) {
  const [state, set, ref] = useMergeState({ recall: null }, app.afterCommit);

  function startRecall(e) {
    if (e.kind === 'gap') return startGapRecall(e);
    const sc = e.own.scenario, t = app.own.targetOf(e.own), td = t && t.delayed;
    const lastRv = e.reviews && e.reviews.length ? e.reviews[e.reviews.length - 1] : null;
    // "Then" is fixed when the recall starts, so the result reads "First try, 3 days ago: 1 of 2 → today: 2 of 2".
    const thenLabel = `${lastRv ? `Last recall, ${rel(lastRv.at, app.now())}: ${lastRv.right} of ${lastRv.n}` : `First try, ${rel(e.ownedAt, app.now())}: ${e.actual} of ${e.n}`}`;
    const last = lastRv ? lastRv.right : e.actual;
    const base = { entryId: e.id, picked: {}, text: '', grade: null, loading: false, lang: e.own.lang, then: last, thenLabel };
    const r = td ? { ...base, task: td.task, ref: td.check.expected, schema: td.schema || '', before: td.before || '', after: td.after || '', placeholder: td.placeholder || '', check: td.check }
      : { ...base, task: sc && sc.delayedTask ? sc.delayedTask : '', ref: sc ? sc.delayedRef || '' : '', schema: '', before: '', after: '', placeholder: '', check: null };
    set({ recall: r });
    if (!r.task) ask('recallTask', { title: e.title, code: e.own.code || '' })
      .then(x => set(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: x.task, ref: x.reference } : s.recall })))
      .catch(() => set(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: `From memory: explain or redo "${e.title}" without looking back.`, ref: '' } : s.recall })));
  }
  function startGapRecall(e) {
    const g = e.gap, base = { entryId: e.id, gapMode: true, picked: {}, text: '', grade: null, loading: false, lang: 'concept', then: null, thenLabel: `Closed ${rel(e.ownedAt, app.now())}`, schema: '', before: '', after: '', placeholder: 'From memory. Explain it and apply it.', check: null };
    const cold = isColdStart(g);
    set({ recall: { ...base, task: cold ? 'From memory, a new situation: a friend is launching a marketplace that connects local tutors with students. Neither side exists yet. What would you tell them to do first, and why?' : '' } });
    if (!cold) ask('gapRecall', { topic: g.topic, before: g.check ? g.check.question : '' })
      .then(x => set(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: x.question } : s.recall })))
      .catch(() => set(s => ({ recall: s.recall && s.recall.entryId === e.id ? { ...s.recall, task: `From memory, in your own words and with a new example: ${g.topic}?` } : s.recall })));
  }
  // A question you noticed while recalling: after you've checked (so it never becomes a lookup), quote the recall
  // into a new chat and leave the question to you, the same "Ask Claude about this" as on the reveal. If it's about
  // understanding, it lands under "You asked about", ready to own; the loop starts again from recall.
  function askAboutRecall() {
    const r = app.state.recall, e = app.state.ledger.find(x => x.id === r.entryId); if (!r || !r.grade) return;
    const answer = r.check && r.check.type === 'choice' ? pickedText(r.check, r.picked) : r.text;
    const text = `About my recall on “${e.title}”:\n${quote('Question: ' + r.task)}\n${quote('My answer: ' + (answer || '(nothing)'))}${r.grade.note ? '\n' + quote('The check said: ' + r.grade.note) : ''}\n\n`;
    set({ recall: null });
    app.own.set({ own: null });
    app.chat.prefillChat(text, { messages: [], sel: null, activeGap: null, chatTitle: 'New chat' });
  }
  // A missed recall is a gap: keep it, and explore it in a chat.
  function recallGap() {
    const r = app.state.recall, e = app.state.ledger.find(x => x.id === r.entryId);
    const quote = r.check && r.check.type === 'choice' ? '' : r.text;
    return app.progress.saveGap({ ...app.gaps.makeGap({ topic: e.title, question: r.task, quote }, 'recall', 'in a recall check, from memory'), from: e.title });
  }
  async function submitRecall() {
    const r = app.state.recall, isChoice = r.check && r.check.type === 'choice';
    if ((isChoice ? !Object.keys(r.picked).length : !r.text.trim()) || r.loading) return;
    set({ recall: { ...r, loading: true, checkError: '' } });
    let g;
    if (r.gapMode) {
      const e = app.state.ledger.find(x => x.id === r.entryId);
      const res = await judgeGap(e.gap, e.gap.check || { question: r.task, keyPoints: [] }, r.text);
      g = res.failed ? null : { score: res.closed ? 5 : 3, items: res.points.length ? res.points.map(p => ({ short: p.point, ok: p.ok })) : [{ short: e.title, ok: res.closed }], note: res.feedback };
    } else try {
      if (!r.check) throw new Error('no executable check');
      const x = await runCheck(r.check, r.text, r.before, r.after, r.picked); g = { score: x.score, items: x.items, note: [x.worked, x.gap, correctionNote(x.corrections)].filter(Boolean).join(' ') };
    } catch (_) {
      try { g = await gradeAttempt(r.task, r.ref, r.text, r.lang, 'note'); }
      catch (e) { const f = fallbackGrade({ lang: r.lang }, r.text, r.ref); g = f && { score: f.score, items: f.items, note: f.worked + ' ' + f.gap }; }
    }
    // Nothing could be checked: say so, keep your answer, and leave the schedule as it was.
    if (!g) return set(s => ({ recall: { ...s.recall, loading: false, checkError: COULDNT_CHECK } }));
    // Spacing: right → wait longer each time (7, then 21, then 60 days); missed → back tomorrow.
    const now = app.now();
    set(s => ({ recall: { ...s.recall, grade: g, loading: false } }));
    app.progress.set(s => ({
      ledger: s.ledger.map(e => {
        if (e.id !== r.entryId) return e;
        const streak = (() => { let k = 0; for (let i = (e.reviews || []).length - 1; i >= 0 && e.reviews[i].right === e.reviews[i].n; i--) k++; return k; })();
        const t = tally(g), gap = t.right === t.n ? [7, 21, 60][Math.min(streak, 2)] : 1;
        return { ...e, reviews: (e.reviews || []).concat([{ at: now, right: t.right, n: t.n }]), dueAt: now + gap * DAY };
      }),
    }));
  }

  return { state, ref, set, startRecall, askAboutRecall, recallGap, submitRecall };
}
