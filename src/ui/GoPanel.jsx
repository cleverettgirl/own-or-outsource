// "You go first" (and closing a gap, below), in the side panel. Every try happens in the panel and the chat holds the conversation (research §8f,
// log 88): the offer and Claude's answer stay in the chat; predicting, trying and the result happen here.
// m is the go-first message's view (App.jsx): type goFirst (a hand-written question from Learnings, checked against a
// key) or goAsk (your own new question, compared with Claude's answer).
import { ItemList, ChoiceQuestions, Md, Stepper, inline } from './parts.jsx';
import { BODY, PANEL, PANEL_HEAD, PANEL_TITLE, PANEL_SCROLL, CLOSE_X, BTN_DARK, BTN_QUIET, BTN_ASK, LABEL, LABEL_CAPS, LOADING, LOADING_13, PRE } from './styles.js';


export default function GoPanel({ m }) {
  const ask = !!m.isGoAsk;
  const order = ask ? ['try', 'done'] : ['predict', 'try', 'done'];
  const at = order.indexOf(m.phase === 'checking' ? 'try' : m.phase);
  const steps = order.map((p, i) => ({ label: { predict: 'Predict', try: 'Try it', done: 'Reveal' }[p], cur: i === at, done: i < at }));
  return (
    <aside data-role="go-panel" className={PANEL}>
      <div className={PANEL_HEAD}>
        <span className={PANEL_TITLE}>You go first</span>
        <button onClick={m.onClosePanel} data-role="go-close" aria-label="Close, back to chat" title="Close, back to chat" className={CLOSE_X}>×</button>
      </div>
      <div className={`${PANEL_SCROLL} flex flex-col gap-4.5`}>
        <Stepper steps={steps} />
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>USING WHAT YOU OWN</span>
          <span className="font-serif text-[26px] leading-[1.2]">{ask ? m.ownedName || m.owned : m.goOwned}</span>
          {!ask && !!m.goWas && <span className="text-[13px] text-muted">Last time {m.goWas}.</span>}
        </div>
        <div className="flex flex-col gap-1.5 bg-surface border border-line rounded-xl py-3.5 px-4.5">
          <span className={LABEL}>THE QUESTION</span>
          <div className="text-[14.5px] leading-normal">{ask ? m.question : m.go.question}</div>
        </div>

        {!ask && m.phase === 'predict' && (
          <div className="flex flex-col gap-3">
            {m.goTopics.length > 0 && (
              <div data-role="go-topics" className="text-[13px] text-ink-2 flex flex-col gap-1">
                <span>{m.goN} {m.goKind}{m.goN === 1 ? '' : 's'}, on:</span>
                <ul className="m-0 pl-4.5 leading-[1.6]">{m.goTopics.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            <div className="text-[20px] font-medium leading-[1.3]">{m.goN === 1 ? 'Will you get it right on your own?' : `How many of the ${m.goN} will you get right on your own?`}</div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${m.goN + 1},1fr)` }}>
              {Array.from({ length: m.goN + 1 }, (_, k) => (
                <button key={k} onClick={() => m.goPredict(k)} data-role="go-predict" data-n={k} className="bg-surface border border-line-strong rounded-xl h-19 flex flex-col items-center justify-center gap-1 hover:border-accent">
                  <span className="font-serif text-[28px]">{k}</span>
                  <span className="text-[12px] text-muted">{k === 0 ? 'none' : k === m.goN ? 'all' : `of ${m.goN}`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!ask && (m.phase === 'try' || m.phase === 'done') && (
          <div className="flex flex-col gap-3">
            <div className={`${LABEL_CAPS} text-accent-text`}>Your go · predicted {m.prediction} of {m.goN}</div>
            {!!m.go.task && <div className="text-[14.5px]">{inline(m.go.task)}</div>}
            {!!m.go.schema && <pre className={`${PRE} text-[12px] text-ink-2`}>{m.go.schema}</pre>}
            {m.go.check.type === 'choice'
              ? <ChoiceQuestions qs={m.go.check.questions} picked={m.picked} onPick={m.goPick} locked={m.phase === 'done'} />
              : <textarea data-role="go-text" value={m.text} onChange={m.goText} readOnly={m.phase === 'done'} placeholder={m.go.placeholder} className={`w-full resize-y border border-accent-border rounded-[10px] py-2.5 px-3 text-[13.5px] bg-surface box-border ${m.go.lang === 'sql' ? 'min-h-32.5 font-mono' : 'min-h-18 font-[inherit]'}`} />}
            {m.phase === 'try' && <div className="flex gap-2 items-center"><button onClick={m.goCheck} className={BTN_DARK}>Check mine</button>{!!m.checking && <span className={LOADING}>checking…</span>}</div>}
            {m.phase === 'done' && (
              <div data-role="go-result" className="flex flex-col gap-2 border-t border-line pt-3.5">
                <div className="font-serif text-[19px]">{m.goResult}</div>
                {m.goItems.length > 0 && <ItemList items={m.goItems} />}
                {!!m.grade.worked && <div className="text-[13.5px] text-ink-2"><b className="text-good-text">What held:</b> {inline(m.grade.worked)}</div>}
                {!!m.grade.gap && <div className="text-[13.5px] text-ink-2"><b className="text-accent-text">What to look at:</b> {inline(m.grade.gap)}</div>}
              </div>
            )}
          </div>
        )}

        {ask && (
          <div className="flex flex-col gap-3">
            <div className={`${LABEL_CAPS} text-accent-text`}>Your go</div>
            <textarea data-role="go-ask-text" value={m.text} onChange={m.onText} readOnly={m.phase !== 'try'} placeholder="Your answer, in your own words or code. No looking anything up." className="w-full min-h-27.5 resize-y border border-accent-border rounded-[10px] py-2.5 px-3 font-[inherit] text-[13.5px] bg-surface box-border" />
            {m.phase === 'try' && <div><button onClick={m.onSubmit} className={BTN_DARK}>Show me yours</button></div>}
            {m.phase === 'checking' && <span className={LOADING}>comparing…</span>}
            {m.phase === 'done' && !!m.verdict && (
              <div data-role="go-ask-verdict" data-verdict={m.verdict} className="border-t border-line pt-3 flex gap-2.5 items-start">
                <span className={`flex-none w-5 h-5 rounded-full flex items-center justify-center text-[11px] mt-0.5 ${m.verdict === 'yes' ? 'bg-good-soft text-good-text' : 'bg-accent-soft text-accent-text'}`}>{m.verdict === 'yes' ? '✓' : m.verdict === 'partly' ? '~' : '✗'}</span>
                <div className="flex flex-col gap-[3px]">
                  <div className="text-[14px] font-semibold">{m.verdict === 'yes' ? 'You applied what you own' : m.verdict === 'partly' ? 'You partly applied what you own' : "What you own didn't carry over yet"}</div>
                  {!!m.verdictLine && <div className={BODY}>{inline(m.verdictLine)}</div>}
                </div>
              </div>
            )}
            {m.phase === 'done' && !!m.note && <div data-role="go-ask-note" className={m.verdict ? '' : 'border-t border-line pt-3'}><Md text={m.note} small /></div>}
            {m.phase === 'done' && (m.deeper || []).length > 0 && (
              <div data-role="go-deeper" className="flex flex-col gap-2 border-t border-line pt-3">
                <div className={`${LABEL_CAPS} text-muted`}>Worth going deeper on</div>
                {m.deeper.map((d, i) => (
                  <button key={i} onClick={() => m.onDeeper(d)} data-role="go-deeper-item" className="text-left bg-surface border border-line rounded-[10px] py-[9px] px-3 text-[13.5px] text-ink flex justify-between gap-2.5 items-center hover:border-accent"><span>{inline(d)}</span><span className="flex-none text-[12.5px] text-accent-text">Ask Claude →</span></button>
                ))}
                <div className="text-[12px] text-muted">Not saved to Learnings. Own it after Claude explains, if you want to keep it.</div>
              </div>
            )}
          </div>
        )}

        {m.phase === 'done' && (
          <div className="flex gap-2.5 items-center flex-wrap">
            <button onClick={m.onAskAbout} data-role="ask-claude" className={BTN_ASK}>Ask Claude about this</button>
            <button onClick={m.onClosePanel} className={BTN_DARK}>Back to chat</button>
            <span className="text-[13px] text-muted">Claude's answer is in the chat.</span>
          </div>
        )}
        {m.phase !== 'done' && <div><button onClick={m.onClosePanel} className={BTN_QUIET}>Back to chat</button></div>}
      </div>
    </aside>
  );
}

// Closing a gap, in the side panel: the check at the end of talking a gap through with Claude. The chat keeps the
// conversation and a one-line result; the question, your answer and what the check found are here.
export function GapPanel({ m }) {
  const done = m.phase === 'done', r = m.result;
  const steps = [{ label: 'Answer it', cur: !done, done }, { label: 'Reveal', cur: done, done: false }];
  return (
    <aside data-role="gap-panel" className={PANEL}>
      <div className={PANEL_HEAD}>
        <span className={PANEL_TITLE}>Close the gap</span>
        <button onClick={m.onClosePanel} data-role="gap-close" aria-label="Close, back to chat" title="Close, back to chat" className={CLOSE_X}>×</button>
      </div>
      <div className={`${PANEL_SCROLL} flex flex-col gap-4.5`}>
        <Stepper steps={steps} />
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>THE GAP</span>
          <span className="font-serif text-[26px] leading-[1.2]">{m.gapTopic}</span>
        </div>
        {m.phase === 'loading' && <div className={LOADING_13}>Writing a question for you…</div>}
        {m.phase !== 'loading' && (
          <div data-role="gap-check" className="flex flex-col gap-3">
            <div className="text-[15px] leading-normal">{inline(m.check.question)}</div>
            <textarea data-role="gap-answer" value={m.text} onChange={m.onText} readOnly={done} placeholder="In your own words. No looking back." className="w-full min-h-27.5 resize-y border border-accent-border rounded-[10px] py-2.5 px-3 text-[14px] bg-surface outline-none font-[inherit] box-border"></textarea>
            {m.phase === 'ask' && <div className="flex gap-2 items-center"><button onClick={m.onSubmit} className={BTN_DARK}>Check my answer</button>{!!m.judging && <span className={LOADING}>reading it…</span>}</div>}
            {m.phase === 'ask' && !!m.checkError && <div data-role="check-error" role="alert" className="text-[13px] leading-normal text-accent-text bg-accent-soft rounded-lg py-[7px] px-[11px]">{m.checkError}</div>}
            {done && (
              <div data-role="gap-result" className="flex flex-col gap-2 border-t border-line pt-3.5">
                <div className={`font-serif text-[19px] ${r.closed ? 'text-good-text' : 'text-accent-text'}`}>{r.closed ? '✓ Gap closed' : 'Not closed yet'}</div>
                {r.points.map((p, i) => <div key={i} className="flex gap-2 text-[13.5px] text-ink-2 leading-[1.45]"><span className={`${p.ok ? 'text-good-text' : 'text-faint'}`}>{p.ok ? '✓' : '○'}</span><span>{inline(p.point)}</span></div>)}
                {!!r.feedback && <div className={BODY}>{inline(r.feedback)}</div>}
                {r.closed
                  ? <div className="text-[13px] text-good-text">It's now in what you own on Learnings, and comes back for recall in 3 days.</div>
                  : <div className="text-[13px] text-muted">Keep talking it through with Claude in the chat, then check again.</div>}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button onClick={m.onClosePanel} className={done ? BTN_DARK : BTN_QUIET}>Back to chat</button>
          {done && !r.closed && <button onClick={m.onAgain} className={BTN_QUIET}>Check me again</button>}
          {done && <button onClick={m.onAskAbout} data-role="ask-claude" className={BTN_ASK}>Ask Claude about this</button>}
        </div>
      </div>
    </aside>
  );
}
