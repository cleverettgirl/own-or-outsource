// Learnings: what you own and how it went, recall when it comes due, open gaps, what you asked about.
import React from 'react';
import { css } from '../css.js';
import { ChoiceQuestions } from './parts.jsx';

export default function Learnings({ V }) {
  const L = V.learn;
  const tone = { pred: 'background:#FFE9DC;color:#9E4B2A', act: 'background:#DDEFEC;color:#1F6B64', mute: 'background:#F1EEE8;color:#514C44', next: 'background:transparent;color:#716C64;border:1px dashed #C9C3B8' };
  const Step = ({ st }) => <span style={css(`display:inline-flex;flex-direction:column;gap:2px;padding:6px 10px;border-radius:9px;${tone[st.tone]}`)}><span style={css(`font-size:10.5px;opacity:.8`)}>{st.label}</span><span style={css(`font-size:13px`)}>{st.v}</span></span>;
  const card = `background:#FBFAF7;border:1px solid #E3DFD6;border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px`;
  const link = `background:none;border:1px solid #E3C9B8;border-radius:8px;padding:6px 11px;font-size:12.5px;color:#9E4B2A`;
  const SAMPLE = [
    { title: 'Regex lookaheads: matching without consuming', from: 'Validate a password field', steps: [{ label: 'Predicted', v: '3 of 3', tone: 'pred' }, { label: 'First try', v: '1 of 3', tone: 'act' }, { label: 'Fixed', v: '3 of 3', tone: 'mute' }, { label: '3 days later', v: '2 of 3', tone: 'act' }] },
    { title: 'groupby vs pivot_table in pandas', from: 'Weekly signups by channel', steps: [{ label: 'Predicted', v: '1 of 2', tone: 'pred' }, { label: 'First try', v: '2 of 2', tone: 'act' }, { label: 'Real work', v: 'went first, 3 of 3', tone: 'act' }, { label: 'Real work', v: 'let Claude answer', tone: 'mute' }] },
    { title: 'Why a P/E ratio can mislead', from: 'Reading an earnings report', steps: [{ label: 'Predicted', v: '3 of 3', tone: 'pred' }, { label: 'First try', v: '2 of 3', tone: 'act' }, { label: '3 days later', v: '3 of 3', tone: 'act' }] },
  ];
  return (
    <div data-role="learnings" style={css(`flex:1;overflow:auto;padding:40px 28px 48px`)}>
      <div style={css(`max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:26px`)}>
        <div style={css(`display:flex;flex-direction:column;gap:6px`)}>
          <h1 style={css(`font-family:Newsreader,serif;font-weight:400;font-size:34px;margin:0`)}>Learnings</h1>
          <div style={css(`font-size:14.5px;color:#716C64`)}>What you chose to own, how your predictions compared, and what stuck.</div>
          <div style={css(`display:flex;gap:10px;align-items:center;font-size:12px;color:#9A948A`)}>
            <button onClick={L.skipAhead} data-role="skip-ahead" style={css(`background:none;border:1px dashed #C9C3B8;border-radius:7px;padding:4px 9px;font-size:12px;color:#514C44`)} className="hv2">⏩ Skip ahead 3 days</button>
            <span>demo control{L.shifted ? ` · it's ${L.shiftDays} days later` : ''} · saved in this browser</span>
            <button onClick={L.resetDemo} data-role="reset-demo" style={css(`background:none;border:none;padding:0;font-size:12px;color:#9A948A;text-decoration:underline;text-underline-offset:2px`)}>Reset demo</button>
          </div>
        </div>
        <div style={css(`display:grid;grid-template-columns:repeat(4,1fr);gap:10px`)}>
          {L.stats.map((st, i) => <div key={i} style={css(`background:#FBFAF7;border:1px solid #E3DFD6;border-radius:12px;padding:12px 14px`)}><div style={css(`font-family:Newsreader,serif;font-size:26px`)}>{st.n}</div><div style={css(`font-size:12px;color:#716C64`)}>{st.label}</div></div>)}
        </div>
        {!!V.hasCalibration && <div data-role="calibration" title={V.calibrationTitle} style={css(`font-size:14px;color:#514C44;background:#F4F1EA;border-radius:10px;padding:10px 14px`)}>{V.calibrationText}</div>}

        {L.dueItems.length > 0 && (
          <section data-role="due" style={css(`display:flex;flex-direction:column;gap:10px`)}>
            <div style={css(`display:flex;gap:8px;align-items:baseline`)}><div style={css(`font-size:13px;font-weight:600;color:#9E4B2A`)}>Ready to recall</div><div style={css(`font-size:12px;color:#9A948A`)}>a quick check from memory, no looking back</div></div>
            {L.dueItems.map(it => (
              <div key={it.id} data-role="due-item" style={css(card + `;border-color:#F0C9B4;background:#FFFBF8`)}>
                <div style={css(`display:flex;justify-content:space-between;gap:12px;align-items:baseline`)}><div style={css(`font-size:15.5px;font-weight:500`)}>{it.title}</div><div style={css(`font-size:12px;color:#9A948A;flex:none`)}>{it.owned} · from {it.from}</div></div>
                <div style={css(`display:flex;gap:6px;flex-wrap:wrap;align-items:center`)}>{it.steps.map((st, j) => <React.Fragment key={j}>{j > 0 && <span style={css(`color:#C9C3B8`)}>→</span>}<Step st={st} /></React.Fragment>)}</div>
                {!it.recall && <button onClick={it.onRecall} style={css(`align-self:flex-start;background:#C4613A;color:#fff;border:none;border-radius:9px;padding:8px 14px;font-size:13.5px`)}>Recall now · about a minute</button>}
                {!!it.recall && <Recall it={it} L={L} />}
              </div>
            ))}
          </section>
        )}

        <section style={css(`display:flex;flex-direction:column;gap:10px`)}>
          {(L.laterItems.length > 0 || L.empty) && <div style={css(`font-size:13px;font-weight:600;color:#514C44`)}>Owning</div>}
          {L.empty && <div style={css(`font-size:14px;color:#7D776D;line-height:1.5`)}>Nothing yet. Use the <span style={css(`color:#C4613A`)}>Own it</span> icon under any answer, or open a past chat in the sidebar and own what you learned there.</div>}
          {L.laterItems.map((it, i) => (
            <div key={i} data-role="learning" style={css(card)}>
              <div style={css(`display:flex;justify-content:space-between;gap:12px;align-items:baseline`)}><div style={css(`font-size:15.5px;font-weight:500`)}>{it.title}</div><div style={css(`font-size:12px;color:#9A948A;flex:none`)}>{it.owned ? it.owned + ' · ' : ''}from {it.from}</div></div>
              <div style={css(`display:flex;gap:6px;flex-wrap:wrap;align-items:center`)}>{it.steps.map((st, j) => <React.Fragment key={j}>{j > 0 && <span style={css(`color:#C9C3B8`)}>→</span>}<Step st={st} /></React.Fragment>)}</div>
              <div style={css(`display:flex;gap:8px;flex-wrap:wrap`)}>
                {!!it.recall && <Recall it={it} L={L} />}
                {!!it.onNew && <button onClick={it.onNew} style={css(link)} className="hv4">Try a new question · {it.newLabel.split(' · ')[1]}</button>}
              </div>
            </div>
          ))}
        </section>

        {L.openGaps.length > 0 && (
          <section data-role="open-gaps" style={css(`display:flex;flex-direction:column;gap:10px`)}>
            <div style={css(`display:flex;gap:8px;align-items:baseline`)}><div style={css(`font-size:13px;font-weight:600;color:#9E4B2A`)}>Open gaps</div><div style={css(`font-size:12px;color:#9A948A`)}>things you found you don't know yet. Explore one with Claude, then check yourself to close it.</div></div>
            {L.openGaps.map(g => (
              <div key={g.id} data-role="open-gap" style={css(card + `;border-color:#F0D5C4`)}>
                <div style={css(`display:flex;justify-content:space-between;gap:12px;align-items:baseline`)}><div style={css(`font-size:15.5px;font-weight:500`)}>{g.topic}</div><div style={css(`font-size:12px;color:#9A948A;flex:none`)}>found {g.when}</div></div>
                <div style={css(`font-size:13px;color:#716C64;line-height:1.5`)}>It came up {g.origin}.{g.quote ? <> You said <i>“{g.quote}”</i></> : null}</div>
                <button onClick={g.onExplore} style={css(`align-self:flex-start;background:#C4613A;color:#fff;border:none;border-radius:9px;padding:8px 14px;font-size:13.5px`)}>Explore it with Claude</button>
              </div>
            ))}
          </section>
        )}

        {L.askedAbout.length > 0 && (
          <section data-role="asked-about" style={css(`display:flex;flex-direction:column;gap:10px`)}>
            <div style={css(`display:flex;gap:8px;align-items:baseline`)}><div style={css(`font-size:13px;font-weight:600;color:#514C44`)}>You asked about</div><div style={css(`font-size:12px;color:#9A948A`)}>things you asked Claude to explain. Own one to check it landed.</div></div>
            {L.askedAbout.map(a => (
              <div key={a.id} style={css(card + `;flex-direction:row;justify-content:space-between;align-items:center;gap:14px`)}>
                <div style={css(`display:flex;flex-direction:column;gap:3px;min-width:0`)}><div style={css(`font-size:14.5px`)}>{a.label || 'Naming it…'}</div><div style={css(`font-size:12.5px;color:#8A847A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>asked {a.when} in “{a.chatTitle}”{a.quote ? ` · “${a.quote.slice(0, 70)}${a.quote.length > 70 ? '…' : ''}”` : ''}</div></div>
                <button onClick={a.onCheck} style={css(link + ';flex:none')} className="hv4">Own it</button>
              </div>
            ))}
          </section>
        )}

        {L.exits.length > 0 && (
          <section style={css(`display:flex;flex-direction:column;gap:10px`)}>
            <div style={css(`font-size:13px;font-weight:600;color:#514C44`)}>You wanted to learn, then stepped away</div>
            {L.exits.map((x, i) => (
              <div key={i} style={css(card + `;flex-direction:row;justify-content:space-between;align-items:center`)}>
                <div style={css(`display:flex;flex-direction:column;gap:3px`)}><div style={css(`font-size:14.5px`)}>{x.title}</div><div style={css(`font-size:12.5px;color:#8A847A`)}>predicted {x.predicted} of {x.n} · {x.askedFirst ? 'went to Claude first' : `left at ${x.step} (${x.stepOf})`}</div></div>
                {!!x.onReopen && <button onClick={x.onReopen} style={css(link)} className="hv4">Pick it back up</button>}
              </div>
            ))}
          </section>
        )}

        <section style={css(`display:flex;flex-direction:column;gap:10px;opacity:.75`)}>
          <div style={css(`display:flex;gap:8px;align-items:baseline`)}><div style={css(`font-size:13px;font-weight:600;color:#514C44`)}>Earlier</div><div style={css(`font-size:11.5px;color:#9A948A`)}>sample history, mocked to show what a few weeks of use looks like</div></div>
          {SAMPLE.map((it, i) => (
            <div key={i} style={css(card)}>
              <div style={css(`display:flex;justify-content:space-between;gap:12px;align-items:baseline`)}><div style={css(`font-size:15px`)}>{it.title}</div><div style={css(`font-size:12px;color:#9A948A;flex:none`)}>from {it.from}</div></div>
              <div style={css(`display:flex;gap:6px;flex-wrap:wrap;align-items:center`)}>{it.steps.map((st, j) => <React.Fragment key={j}>{j > 0 && <span style={css(`color:#C9C3B8`)}>→</span>}<Step st={st} /></React.Fragment>)}</div>
            </div>
          ))}
          <div style={css(`font-size:13px;color:#716C64`)}>Over these weeks, you went from expecting 30% more than you got to 5% more. You're getting better at knowing what you know.</div>
        </section>
      </div>
    </div>
  );
}

// The recall check, inline on its Learnings card: from memory, then "then vs now", then when it comes back.
function Recall({ it, L }) {
  const r = it.recall, choice = r.check && r.check.type === 'choice';
  return (
    <div data-role="recall" style={css(`display:flex;flex-direction:column;gap:10px;border-top:1px dashed #E3C9B8;padding-top:12px`)}>
      <div style={css(`font-size:14.5px;line-height:1.5`)}>{r.task || 'Preparing a question…'}</div>
      {!!r.schema && <pre style={css(`margin:0;padding:8px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;white-space:pre-wrap;color:#514C44`)}>{r.schema}</pre>}
      {!!r.before && <pre style={css(`margin:0;padding:8px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;color:#8A847A`)}>{r.before}</pre>}
      {choice ? <ChoiceQuestions qs={r.check.questions} picked={r.picked} onPick={L.onRecallPick} locked={!!r.grade} />
        : <textarea data-role="recall-text" value={r.text} onChange={L.onRecallText} readOnly={!!r.grade} placeholder={r.placeholder || 'From memory. No looking back.'} style={css(`width:100%;min-height:72px;resize:vertical;border:1px solid #E3C9B8;border-radius:8px;padding:10px 12px;font-family:${r.lang === 'sql' ? "'JetBrains Mono',monospace" : 'inherit'};font-size:13.5px;background:#fff;outline:none`)}></textarea>}
      {!!r.after && <pre style={css(`margin:0;padding:8px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;color:#8A847A`)}>{r.after}</pre>}
      {!r.grade && <div style={css(`display:flex;gap:8px;align-items:center`)}><button onClick={L.submitRecall} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:9px;padding:8px 14px;font-size:13.5px`)}>Check it</button><button onClick={L.closeRecall} style={css(`background:none;border:none;font-size:13px;color:#8A847A`)}>Not now</button>{!!r.loading && <span style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>checking…</span>}</div>}
      {!!r.grade && (
        <div data-role="recall-result" style={css(`display:flex;flex-direction:column;gap:6px`)}>
          <div style={css(`font-family:Newsreader,serif;font-size:19px`)}>{r.gapMode ? (r.full ? 'Still closed.' : 'It slipped a little.') : <>{it.then} → today: {r.right} of {r.n}</>}</div>
          <div style={css(`font-size:13.5px;color:#514C44;line-height:1.5`)}>{r.grade.note}</div>
          <div style={css(`font-size:13px;color:${r.full ? '#1F6B64' : '#9E4B2A'}`)}>{r.full ? 'It stuck. ' : "Not quite yet, so it'll come back sooner. "}{it.next ? it.next.replace('next recall', 'Next recall') + '.' : ''}</div>
          <div style={css(`display:flex;gap:8px;flex-wrap:wrap`)}>
            {!r.full && !L.gapTopics.includes(it.title) && <button onClick={L.exploreRecallGap} style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;padding:6px 12px;font-size:12.5px`)}>Explore this gap with Claude</button>}
            {!r.full && !L.gapTopics.includes(it.title) && <button onClick={L.saveRecallGap} style={css(`background:none;border:1px solid #E3C9B8;border-radius:9px;padding:6px 12px;font-size:12.5px;color:#9E4B2A`)} className="hv4">Save as a gap</button>}
            {!r.full && L.gapTopics.includes(it.title) && <span style={css(`font-size:12.5px;color:#1F6B64;align-self:center`)}>✓ Saved as an open gap</span>}
            <button onClick={L.closeRecall} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:6px 12px;font-size:12.5px;color:#514C44`)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
