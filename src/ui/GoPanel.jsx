// "You go first" (and closing a gap, below), in the side panel. Every try happens in the panel and the chat holds the conversation (research §8f,
// log 88): the offer and Claude's answer stay in the chat; predicting, trying and the result happen here.
// m is the go-first message's view (App.jsx): type goFirst (a hand-written question from Learnings, checked against a
// key) or goAsk (your own new question, compared with Claude's answer).
import React from 'react';
import { css } from '../css.js';
import { ItemList, ChoiceQuestions, Md, inline } from './parts.jsx';

const LABEL = `font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--muted)`;
const DARK = `background:var(--inverse);color:var(--inverse-text);border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`;
const QUIET = `background:none;border:1px solid var(--border-strong);border-radius:9px;padding:8px 13px;font-size:13px;color:var(--text-2)`;

function Stepper({ steps }) {
  return (
    <div data-role="stepper" style={css(`display:flex;align-items:center;font-size:13px`)}>
      {steps.map((st, i) => <React.Fragment key={i}>
        {i > 0 && <span style={css(`flex:1;min-width:12px;height:1px;background:${st.done || st.cur ? 'var(--good-mid)' : 'var(--border-strong)'};margin:0 10px`)}></span>}
        <span style={css(`display:flex;align-items:center;gap:6px;white-space:nowrap;color:${st.cur ? 'var(--text)' : st.done ? 'var(--good-mid)' : 'var(--muted)'};font-weight:${st.cur ? 600 : st.done ? 500 : 400}`)}>
          <i style={css(`width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-style:normal;${st.done ? 'background:var(--good-mid);color:var(--on-accent)' : st.cur ? 'background:var(--accent);color:var(--on-accent)' : 'border:1px solid var(--border-strong)'}`)}>{st.done ? '✓' : i + 1}</i>{st.label}
        </span>
      </React.Fragment>)}
    </div>
  );
}

export default function GoPanel({ m }) {
  const ask = !!m.isGoAsk;
  const order = ask ? ['try', 'done'] : ['predict', 'try', 'done'];
  const at = order.indexOf(m.phase === 'checking' ? 'try' : m.phase);
  const steps = order.map((p, i) => ({ label: { predict: 'Predict', try: 'Try it', done: 'Reveal' }[p], cur: i === at, done: i < at }));
  return (
    <aside data-role="go-panel" style={css(`width:46%;min-width:420px;max-width:760px;flex:none;border-left:1px solid var(--border);background:var(--bg);display:flex;flex-direction:column;animation:slidein .25s ease`)}>
      <div style={css(`display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 28px;border-bottom:1px solid var(--border);flex:none`)}>
        <span style={css(`font-family:Newsreader,Georgia,serif;font-size:24px`)}>You go first</span>
        <button onClick={m.onClosePanel} data-role="go-close" aria-label="Close, back to chat" title="Close, back to chat" style={css(`background:none;border:none;font-size:20px;line-height:1;color:var(--muted);padding:4px 6px;border-radius:6px`)} className="hv4">×</button>
      </div>
      <div style={css(`flex:1;overflow:auto;padding:24px 28px 32px;display:flex;flex-direction:column;gap:18px`)}>
        <Stepper steps={steps} />
        <div style={css(`display:flex;flex-direction:column;gap:6px`)}>
          <span style={css(LABEL)}>USING WHAT YOU OWN</span>
          <span style={css(`font-family:Newsreader,Georgia,serif;font-size:26px;line-height:1.2`)}>{ask ? m.ownedName || m.owned : m.goOwned}</span>
          {!ask && !!m.goWas && <span style={css(`font-size:13px;color:var(--muted)`)}>Last time {m.goWas}.</span>}
        </div>
        <div style={css(`display:flex;flex-direction:column;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px`)}>
          <span style={css(LABEL)}>THE QUESTION</span>
          <div style={css(`font-size:14.5px;line-height:1.5`)}>{ask ? m.question : m.go.question}</div>
        </div>

        {!ask && m.phase === 'predict' && (
          <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
            {m.goTopics.length > 0 && (
              <div data-role="go-topics" style={css(`font-size:13px;color:var(--text-2);display:flex;flex-direction:column;gap:4px`)}>
                <span>{m.goN} {m.goKind}{m.goN === 1 ? '' : 's'}, on:</span>
                <ul style={css(`margin:0;padding-left:18px;line-height:1.6`)}>{m.goTopics.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            <div style={css(`font-size:20px;font-weight:500;line-height:1.3`)}>{m.goN === 1 ? 'Will you get it right on your own?' : `How many of the ${m.goN} will you get right on your own?`}</div>
            <div style={css(`display:grid;grid-template-columns:repeat(${m.goN + 1},1fr);gap:10px`)}>
              {Array.from({ length: m.goN + 1 }, (_, k) => (
                <button key={k} onClick={() => m.goPredict(k)} data-role="go-predict" data-n={k} style={css(`background:var(--surface);border:1px solid var(--border-strong);border-radius:12px;height:76px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px`)} className="hv3">
                  <span style={css(`font-family:Newsreader,Georgia,serif;font-size:28px`)}>{k}</span>
                  <span style={css(`font-size:12px;color:var(--muted)`)}>{k === 0 ? 'none' : k === m.goN ? 'all' : `of ${m.goN}`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!ask && (m.phase === 'try' || m.phase === 'done') && (
          <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
            <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--accent-text)`)}>Your go · predicted {m.prediction} of {m.goN}</div>
            {!!m.go.task && <div style={css(`font-size:14.5px`)}>{inline(m.go.task)}</div>}
            {!!m.go.schema && <pre style={css(`margin:0;padding:8px 12px;background:var(--sunken);border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-2);white-space:pre-wrap`)}>{m.go.schema}</pre>}
            {m.go.check.type === 'choice'
              ? <ChoiceQuestions qs={m.go.check.questions} picked={m.picked} onPick={m.goPick} locked={m.phase === 'done'} />
              : <textarea data-role="go-text" value={m.text} onChange={m.goText} readOnly={m.phase === 'done'} placeholder={m.go.placeholder} style={css(`width:100%;min-height:${m.go.lang === 'sql' ? '130px' : '72px'};resize:vertical;border:1px solid var(--accent-border);border-radius:10px;padding:10px 12px;font-family:${m.go.lang === 'sql' ? "'JetBrains Mono',monospace" : 'inherit'};font-size:13.5px;background:var(--surface);box-sizing:border-box`)} />}
            {m.phase === 'try' && <div style={css(`display:flex;gap:8px;align-items:center`)}><button onClick={m.goCheck} style={css(DARK)}>Check mine</button>{!!m.checking && <span style={css(`font-size:12.5px;color:var(--accent-text);animation:pulse 1.2s infinite`)}>checking…</span>}</div>}
            {m.phase === 'done' && (
              <div data-role="go-result" style={css(`display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--border);padding-top:14px`)}>
                <div style={css(`font-family:Newsreader,serif;font-size:19px`)}>{m.goResult}</div>
                {m.goItems.length > 0 && <ItemList items={m.goItems} />}
                {!!m.grade.worked && <div style={css(`font-size:13.5px;color:var(--text-2)`)}><b style={css(`color:var(--good-text)`)}>What held:</b> {inline(m.grade.worked)}</div>}
                {!!m.grade.gap && <div style={css(`font-size:13.5px;color:var(--text-2)`)}><b style={css(`color:var(--accent-text)`)}>What to look at:</b> {inline(m.grade.gap)}</div>}
              </div>
            )}
          </div>
        )}

        {ask && (
          <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
            <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--accent-text)`)}>Your go</div>
            <textarea data-role="go-ask-text" value={m.text} onChange={m.onText} readOnly={m.phase !== 'try'} placeholder="Your answer, in your own words or code. No looking anything up." style={css(`width:100%;min-height:110px;resize:vertical;border:1px solid var(--accent-border);border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13.5px;background:var(--surface);box-sizing:border-box`)} />
            {m.phase === 'try' && <div><button onClick={m.onSubmit} style={css(DARK)}>Show me yours</button></div>}
            {m.phase === 'checking' && <span style={css(`font-size:12.5px;color:var(--accent-text);animation:pulse 1.2s infinite`)}>comparing…</span>}
            {m.phase === 'done' && !!m.verdict && (
              <div data-role="go-ask-verdict" data-verdict={m.verdict} style={css(`border-top:1px solid var(--border);padding-top:12px;display:flex;gap:10px;align-items:flex-start`)}>
                <span style={css(`flex:none;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:2px;background:${m.verdict === 'yes' ? 'var(--good-soft)' : 'var(--accent-soft)'};color:${m.verdict === 'yes' ? 'var(--good-text)' : 'var(--accent-text)'}`)}>{m.verdict === 'yes' ? '✓' : m.verdict === 'partly' ? '~' : '✗'}</span>
                <div style={css(`display:flex;flex-direction:column;gap:3px`)}>
                  <div style={css(`font-size:14px;font-weight:600`)}>{m.verdict === 'yes' ? 'You applied what you own' : m.verdict === 'partly' ? 'You partly applied what you own' : "What you own didn't carry over yet"}</div>
                  {!!m.verdictLine && <div style={css(`font-size:13.5px;line-height:1.5;color:var(--text-2)`)}>{inline(m.verdictLine)}</div>}
                </div>
              </div>
            )}
            {m.phase === 'done' && !!m.note && <div data-role="go-ask-note" style={css(`${m.verdict ? '' : 'border-top:1px solid var(--border);padding-top:12px'}`)}><Md text={m.note} small /></div>}
            {m.phase === 'done' && (m.deeper || []).length > 0 && (
              <div data-role="go-deeper" style={css(`display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--border);padding-top:12px`)}>
                <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)`)}>Worth going deeper on</div>
                {m.deeper.map((d, i) => (
                  <button key={i} onClick={() => m.onDeeper(d)} data-role="go-deeper-item" style={css(`text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:9px 12px;font-size:13.5px;color:var(--text);display:flex;justify-content:space-between;gap:10px;align-items:center`)} className="hv3"><span>{inline(d)}</span><span style={css(`flex:none;font-size:12.5px;color:var(--accent-text)`)}>Ask Claude →</span></button>
                ))}
                <div style={css(`font-size:12px;color:var(--muted)`)}>Not saved to Learnings. Own it after Claude explains, if you want to keep it.</div>
              </div>
            )}
          </div>
        )}

        {m.phase === 'done' && (
          <div style={css(`display:flex;gap:10px;align-items:center;flex-wrap:wrap`)}>
            <button onClick={m.onAskAbout} data-role="ask-claude" style={css(`background:none;border:1px solid var(--accent-border);border-radius:9px;padding:8px 13px;font-size:13px;color:var(--accent-text)`)} className="hv4">Ask Claude about this</button>
            <button onClick={m.onClosePanel} style={css(DARK)}>Back to chat</button>
            <span style={css(`font-size:13px;color:var(--muted)`)}>Claude's answer is in the chat.</span>
          </div>
        )}
        {m.phase !== 'done' && <div><button onClick={m.onClosePanel} style={css(QUIET)} className="hv6">Back to chat</button></div>}
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
    <aside data-role="gap-panel" style={css(`width:46%;min-width:420px;max-width:760px;flex:none;border-left:1px solid var(--border);background:var(--bg);display:flex;flex-direction:column;animation:slidein .25s ease`)}>
      <div style={css(`display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 28px;border-bottom:1px solid var(--border);flex:none`)}>
        <span style={css(`font-family:Newsreader,Georgia,serif;font-size:24px`)}>Close the gap</span>
        <button onClick={m.onClosePanel} data-role="gap-close" aria-label="Close, back to chat" title="Close, back to chat" style={css(`background:none;border:none;font-size:20px;line-height:1;color:var(--muted);padding:4px 6px;border-radius:6px`)} className="hv4">×</button>
      </div>
      <div style={css(`flex:1;overflow:auto;padding:24px 28px 32px;display:flex;flex-direction:column;gap:18px`)}>
        <Stepper steps={steps} />
        <div style={css(`display:flex;flex-direction:column;gap:6px`)}>
          <span style={css(LABEL)}>THE GAP</span>
          <span style={css(`font-family:Newsreader,Georgia,serif;font-size:26px;line-height:1.2`)}>{m.gapTopic}</span>
        </div>
        {m.phase === 'loading' && <div style={css(`font-size:13px;color:var(--accent-text);animation:pulse 1.2s infinite`)}>Writing a question for you…</div>}
        {m.phase !== 'loading' && (
          <div data-role="gap-check" style={css(`display:flex;flex-direction:column;gap:12px`)}>
            <div style={css(`font-size:15px;line-height:1.5`)}>{inline(m.check.question)}</div>
            <textarea data-role="gap-answer" value={m.text} onChange={m.onText} readOnly={done} placeholder="In your own words. No looking back." style={css(`width:100%;min-height:110px;resize:vertical;border:1px solid var(--accent-border);border-radius:10px;padding:10px 12px;font-size:14px;background:var(--surface);outline:none;font-family:inherit;box-sizing:border-box`)}></textarea>
            {m.phase === 'ask' && <div style={css(`display:flex;gap:8px;align-items:center`)}><button onClick={m.onSubmit} style={css(DARK)}>Check my answer</button>{!!m.judging && <span style={css(`font-size:12.5px;color:var(--accent-text);animation:pulse 1.2s infinite`)}>reading it…</span>}</div>}
            {done && (
              <div data-role="gap-result" style={css(`display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--border);padding-top:14px`)}>
                <div style={css(`font-family:Newsreader,serif;font-size:19px;color:${r.closed ? 'var(--good-text)' : 'var(--accent-text)'}`)}>{r.closed ? '✓ Gap closed' : 'Not closed yet'}</div>
                {r.points.map((p, i) => <div key={i} style={css(`display:flex;gap:8px;font-size:13.5px;color:var(--text-2);line-height:1.45`)}><span style={css(`color:${p.ok ? 'var(--good-text)' : 'var(--faint)'}`)}>{p.ok ? '✓' : '○'}</span><span>{inline(p.point)}</span></div>)}
                {!!r.feedback && <div style={css(`font-size:13.5px;color:var(--text-2);line-height:1.5`)}>{inline(r.feedback)}</div>}
                {r.closed
                  ? <div style={css(`font-size:13px;color:var(--good-text)`)}>It's now in what you own on Learnings, and comes back for recall in 3 days.</div>
                  : <div style={css(`font-size:13px;color:var(--muted)`)}>Keep talking it through with Claude in the chat, then check again.</div>}
              </div>
            )}
          </div>
        )}
        <div style={css(`display:flex;gap:8px;flex-wrap:wrap`)}>
          <button onClick={m.onClosePanel} style={css(done ? DARK : QUIET)} className={done ? '' : 'hv6'}>Back to chat</button>
          {done && !r.closed && <button onClick={m.onAgain} style={css(QUIET)} className="hv6">Check me again</button>}
          {done && <button onClick={m.onAskAbout} data-role="ask-claude" style={css(`background:none;border:1px solid var(--accent-border);border-radius:9px;padding:8px 13px;font-size:13px;color:var(--accent-text)`)} className="hv4">Ask Claude about this</button>}
        </div>
      </div>
    </aside>
  );
}
