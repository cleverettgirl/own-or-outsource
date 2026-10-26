import { useRef } from 'react';
import { ask } from '../claude.js';
import { GO_FIRST } from '../goFirst.js';
import { tally } from '../scoring.js';
import { TARGETS } from '../scenarios.js';
import { runCheck, judgeSqlThatDidntRun } from '../grading.js';
import { quote, answerText, pickedText } from '../util.js';

// What a ledger title is called on a new question: a hand-written target's general name when its label is tied to its example.
const ideaName = title => {
  const t = Object.values(TARGETS).find(x => x.label === title);
  return (t && t.idea) || title;
};

// You go first: a later question that needs what you own is offered to you before Claude answers it. Its tries
// live in the chat's messages (goAsk for a question you asked, goFirst for a home-screen one).
export function useGoFirst(app) {
  // Claude's answer to a go-first offer, by message id: it's fetched alongside the offer and waited on after your try.
  const replyFor = useRef({}).current;

  // ---------- when you ask again ----------
  // A new question that needs something you own is the moment you'd normally outsource it. Claude checks that
  // (one small call, run alongside the answer so nothing waits) and, if it does, offers you the first try.
  // Claude's answer is ready behind it either way. Questions about understanding don't trigger this: it only
  // looks at the first question of a new chat.
  const ownedTitles = () =>
    [
      ...new Set(
        app.state.ledger
          .filter(e => e.kind === 'gap' || e.actual != null)
          .map(e => e.title),
      ),
    ].slice(-12);
  async function answerOrGoFirst(m) {
    const owned = ownedTitles();
    const replyP = app.chat.fetchReply(m);
    let hit = null;
    try {
      const r = await ask('goFirstMatch', {
        question: m.question,
        owned: owned.map(t => ideaName(t)),
      });
      hit = r.match >= 1 && r.match <= owned.length ? owned[r.match - 1] : null;
    } catch (e) {
      hit = null;
    }
    if (!hit) return app.chat.showReply(m, await replyP);
    const id = app.nid();
    replyFor[id] = replyP;
    app.chat.set(s => ({
      messages: s.messages
        .filter(x => x.type !== 'thinking')
        .concat([
          {
            id,
            type: 'goAsk',
            owned: hit,
            ownedName: ideaName(hit),
            question: m.question,
            phase: 'offer',
            text: '',
            reply: null,
            note: '',
          },
        ]),
    }));
    replyP.then(reply => app.chat.setGo(id, { reply }));
  }
  function goAskNote(id, rec) {
    const S = app.state,
      g = S.messages.find(x => x.id === id);
    const e = S.ledger
      .slice()
      .reverse()
      .find(x => x.title === g.owned);
    if (e) app.progress.appendRealWork(e.id, rec);
  }
  const goAskAnswer = id => {
    app.chat.setGo(id, { phase: 'answered' });
    goAskNote(id, { outsourced: true });
  };
  async function goAskSubmit(id) {
    const g = app.state.messages.find(x => x.id === id);
    if (!g.text.trim() || g.phase !== 'try') return;
    app.chat.setGo(id, { phase: 'checking' });
    goAskNote(id, { wentFirst: true });
    const reply = g.reply || (await replyFor[id]);
    let r = {};
    try {
      r =
        (await ask('goFirstCompare', {
          question: g.question,
          owned: g.ownedName || g.owned,
          attempt: g.text,
          answer: answerText(reply),
        })) || {};
    } catch (e) {
      r = {};
    }
    const verdict = ['yes', 'partly', 'no'].includes(r.owned) ? r.owned : null;
    app.chat.setGo(id, {
      phase: 'done',
      note: String(r.note || ''),
      verdict,
      verdictLine: verdict ? String(r.ownedLine || '') : '',
      deeper: (r.deeper || [])
        .map(d => d && String(d.idea || '').trim())
        .filter(Boolean)
        .slice(0, 2),
    });
  }

  // ---------- from the home screen ----------
  // The ledger entry that unlocks a go-first question: the latest thing you owned that it needs.
  const ownedFor = key =>
    app.state.ledger
      .slice()
      .reverse()
      .find(e =>
        GO_FIRST[key].targets.includes(e.own.focus && e.own.focus.target),
      );
  function startGoFirst(key) {
    const g = GO_FIRST[key];
    app.own.set({ own: null });
    app.chat.set({
      messages: [
        { id: app.nid(), type: 'user', text: g.question },
        {
          id: app.nid(),
          type: 'goFirst',
          key,
          phase: 'offer',
          prediction: null,
          text: '',
          picked: {},
          grade: null,
          at: Date.now(),
        },
      ],
      chatTitle: g.chip.split(' · ')[1],
      sel: null,
      composer: '',
      view: 'chat',
      activeGap: null,
    });
  }
  const unchecked = r =>
    !!(r && r.items && r.items.length && r.items.every(i => i.unchecked));
  // Record what you did in real work on the ledger entry that unlocked it: went first (with a score) or let Claude answer.
  function noteRealWork(key, rec) {
    const e = ownedFor(key);
    if (e) app.progress.appendRealWork(e.id, rec);
  }
  function goOutsource(m) {
    app.chat.setGo(m.id, { phase: 'answered' });
    noteRealWork(m.key, { outsourced: true });
  }
  async function goCheck(m) {
    const g = GO_FIRST[m.key];
    if (
      g.check.type === 'choice' ? !Object.keys(m.picked).length : !m.text.trim()
    )
      return;
    app.chat.setGo(m.id, { checking: true });
    const before = g.before || '',
      after = g.after || '';
    let r = await runCheck(g.check, m.text, before, after, m.picked);
    // A query that didn't run is judged by Claude on the same items, as on the Own-it try. If Claude can't be
    // reached either, nothing was checked, so nothing is scored: you went first, and that's all that's recorded.
    if (g.check.type === 'sql' && unchecked(r))
      r = await judgeSqlThatDidntRun(
        {
          write: {
            task: g.question,
            check: g.check,
            before,
            text: m.text,
            after,
          },
        },
        r,
      );
    app.chat.setGo(m.id, { checking: false, grade: r, phase: 'done' });
    if (unchecked(r)) return noteRealWork(m.key, { wentFirst: true });
    const t = tally(r);
    noteRealWork(m.key, { predicted: m.prediction, actual: t.right, n: t.n });
  }

  // The same "Ask Claude about this" as on the reveal, for the panel's other reveals (go-first and the gap check,
  // log 90): the context goes into this chat's box as a quote, the question is yours, and the panel stays open beside it.
  function askAboutPanelTry(id) {
    const S = app.state,
      m = S.messages.find(x => x.id === id);
    if (!m) return;
    let head, question, answer, said;
    if (m.type === 'goFirst') {
      const g = GO_FIRST[m.key],
        gr = m.grade || {};
      head = 'my go';
      question = g.question;
      answer =
        g.check.type === 'choice'
          ? pickedText(g.check, m.picked)
          : [g.before, m.text, g.after].filter(Boolean).join('\n');
      said = [
        gr.gap,
        (gr.items || [])
          .filter(i => !i.ok)
          .map(i => 'Missed: ' + i.short)
          .join('; '),
      ]
        .filter(Boolean)
        .join(' ');
    } else if (m.type === 'goAsk') {
      head = 'my go';
      question = m.question;
      answer = m.text;
      said = [m.verdictLine, m.note].filter(Boolean).join(' ');
    } else {
      const g = S.gaps.find(x => x.id === m.gapId) || {},
        r = m.result || {};
      head = `closing the gap “${g.topic || ''}”`;
      question = m.check.question;
      answer = m.text;
      said = [r.closed ? 'Closed.' : 'Not closed yet.', r.feedback]
        .filter(Boolean)
        .join(' ');
    }
    app.chat.prefillChat(
      `About ${head}:\n${quote('Question: ' + question)}\n${quote('My answer: ' + (answer || '(nothing)'))}${said ? '\n' + quote('The check said: ' + said) : ''}\n\n`,
    );
  }
  // A gap the go-first check spotted, taken to the chat: your try is quoted and the idea named; the question is yours.
  // Nothing is saved: if Claude's explanation lands, Own it is offered under it as usual.
  function goDeeper(id, idea) {
    const m = app.state.messages.find(x => x.id === id);
    if (!m) return;
    app.chat.prefillChat(
      `About my go:\n${quote('Question: ' + m.question)}\n${quote('My answer: ' + (m.text || '(nothing)'))}\n\nI'd like to go deeper on: ${idea}. `,
    );
  }

  return {
    ownedTitles,
    answerOrGoFirst,
    goAskAnswer,
    goAskSubmit,
    ownedFor,
    startGoFirst,
    goOutsource,
    goCheck,
    askAboutPanelTry,
    goDeeper,
  };
}
