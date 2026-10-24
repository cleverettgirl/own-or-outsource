// Learnings: what you own and how it went (design 3a). A map of what you own around you (inner ring: recall this
// week), the next recall and the counts beside it, calibration, then a card per thing you own. Below: recall when
// it's open, open gaps, what you asked about, what you stepped away from, and a labelled sample history.
import React from 'react';
import { css } from '../css.js';
import { ChoiceQuestions } from './parts.jsx';

const INK = '#1F1E1B', MUTE = '#6B665C', FAINT = '#8A8477', LINE = '#E2DCD0', ORANGE = '#C4613C', GREEN = '#7FA394';
const SERIF = 'Newsreader,Georgia,serif';
const pill = { pred: 'background:#FBEDE4;color:#A85331', act: 'background:#E3EFEA;color:#3D6B5A', mute: 'background:#EFEAE0;color:#6B665C', next: `border:1px dashed #B8B1A3;color:${MUTE}` };
const Pill = ({ st }) => <span style={css(`padding:4px 9px;border-radius:99px;font-size:12px;${pill[st.tone]}`)}>{st.label} {st.v}</span>;
const shortTitle = t => { const s = String(t).split(/:\s|,\s/)[0]; return s.length > 34 ? s.slice(0, 32) + '…' : s; };
const shortFrom = f => String(f || '').split(/ · |, /)[0];
const inDays = d => (d <= 0 ? 'Recall due now' : `Recall in ${Math.max(1, Math.round(d))} day${Math.round(d) === 1 ? '' : 's'}`);

// A cover for each card, from the chat it came from.
function Cover({ it, height = 120 }) {
  const mono = t => <span style={css(`font-family:'JetBrains Mono',Menlo,monospace;color:#fff;font-size:14px`)}>{t}</span>;
  const c = it.sc === 'BOOK' ? ['#E8906A', <span style={css(`width:40px;height:40px;border-radius:50%;border:2px solid #fff;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:600`)}>5</span>]
    : it.sc === 'SQL' ? ['#6A9BD8', mono({ onwhere: 'ON ≠ WHERE', joins: 'LEFT JOIN', whole: 'SELECT …' }[it.target] || 'SQL')]
    : it.sc === 'JUNO' ? ['#A9C0B5', <span style={css(`display:flex;gap:6px`)}>{[0, 1, 2].map(i => <i key={i} style={css(`width:10px;height:10px;border-radius:50%;background:#fff;display:block`)}></i>)}</span>]
    : it.sc === 'REACT' ? ['#9B8AC4', mono('useEffect')]
    : it.sc === 'GAP' ? ['#F1D9C9', <span style={css(`font-size:13px;color:#A85331;font-weight:600`)}>gap closed ✓</span>]
    : ['#ECE6DA', <span style={css(`font-family:${SERIF};font-size:26px;color:${INK}`)}>{String(it.title).split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</span>];
  return <div style={css(`height:${height}px;background:${c[0]};display:grid;place-items:center;flex:none`)}>{c[1]}</div>;
}

// Everything you own around you: due (orange, pulsing) and this week on the inner ring, later on the outer ring,
// related questions you haven't tried yet dashed beyond their concept.
function Map({ L }) {
  const W = 768, H = 440, cx = W / 2, cy = 235, rIn = 95, rOut = 165;
  const ring = it => (it.due || (it.daysToDue != null && it.daysToDue <= 7) ? rIn : rOut);
  const n = L.items.length, pos = {};
  L.items.forEach((it, i) => { const a = -Math.PI * 0.82 + (i / Math.max(1, n)) * Math.PI * 2, r = ring(it); pos[it.id] = { x: cx + Math.cos(a) * r * 1.55, y: cy + Math.sin(a) * r * 0.92, a }; });
  const kids = L.untried.filter(u => pos[u.parent]).map(u => { const p = pos[u.parent]; return { ...u, x: cx + Math.cos(p.a + 0.18) * 205 * 1.55, y: Math.min(H - 30, cy + Math.sin(p.a + 0.18) * 205 * 0.92), px: p.x, py: p.y }; });
  const at = (x, y) => `position:absolute;left:${(x / W) * 100}%;top:${(y / H) * 100}%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:6px`;
  const chats = new Set(L.items.map(it => shortFrom(it.from))).size;
  return (
    <div data-role="map" style={css(`position:relative;background:#fff;border:1px solid ${LINE};border-radius:14px;height:${H}px;overflow:hidden;min-width:0`)}>
      <div style={css(`position:absolute;top:18px;left:22px;right:22px;display:flex;justify-content:space-between;gap:12px;font-size:12px;color:${MUTE};z-index:1`)}>
        <span style={css(`font-weight:600;color:#3A3732;font-size:13px`)}>Your map · {n} {n === 1 ? 'concept' : 'concepts'} across {chats} {chats === 1 ? 'chat' : 'chats'}</span>
        <span style={css(`display:flex;gap:14px`)}>
          <span style={css(`display:flex;gap:6px;align-items:center`)}><i style={css(`width:10px;height:10px;border-radius:50%;background:${ORANGE};display:inline-block`)}></i>due</span>
          <span style={css(`display:flex;gap:6px;align-items:center`)}><i style={css(`width:10px;height:10px;border-radius:50%;background:${GREEN};display:inline-block`)}></i>owned</span>
          <span style={css(`display:flex;gap:6px;align-items:center`)}><i style={css(`width:10px;height:10px;border-radius:50%;border:1.5px dashed ${FAINT};display:inline-block;box-sizing:border-box`)}></i>not tried</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={css(`position:absolute;inset:0;width:100%;height:100%`)} fill="none" stroke="#DDD6C8" strokeWidth="1.5">
        <ellipse cx={cx} cy={cy} rx={rIn * 1.55} ry={rIn * 0.92} />
        <ellipse cx={cx} cy={cy} rx={rOut * 1.55} ry={rOut * 0.92} />
        {L.items.map(it => <line key={it.id} x1={cx} y1={cy} x2={pos[it.id].x} y2={pos[it.id].y} />)}
        {kids.map((k, i) => <line key={'k' + i} x1={k.px} y1={k.py} x2={k.x} y2={k.y} strokeDasharray="4 5" />)}
      </svg>
      <div style={css(at(cx, cy) + `;width:64px;height:64px;border-radius:50%;background:${INK};color:#fff;display:grid;place-items:center;font-size:11px;font-weight:500`)}>you</div>
      {L.items.map(it => (
        <button key={it.id} onClick={it.due && !it.recall ? it.onRecall : undefined} title={it.title} style={css(at(pos[it.id].x, pos[it.id].y) + `;background:none;border:none;padding:0;cursor:${it.due ? 'pointer' : 'default'}`)}>
          <span style={css(`width:${it.due ? 30 : 22}px;height:${it.due ? 30 : 22}px;border-radius:50%;background:${it.due ? ORANGE : GREEN};${it.due ? 'animation:mappulse 1.8s ease-out infinite' : ''}`)}></span>
          <span style={css(`font-size:13px;font-weight:500;text-align:center;max-width:160px;line-height:1.3;color:${INK}`)}>{shortTitle(it.title)}</span>
          <span style={css(`font-size:11px;color:${FAINT}`)}>{shortFrom(it.from)}</span>
        </button>
      ))}
      {kids.map((k, i) => (
        <div key={'n' + i} style={css(at(k.x, k.y))}>
          <span style={css(`width:16px;height:16px;border-radius:50%;border:1.5px dashed ${FAINT};box-sizing:border-box`)}></span>
          <span style={css(`font-size:12px;color:${FAINT};white-space:nowrap`)}>{k.label}</span>
        </div>
      ))}
      <div style={css(`position:absolute;right:22px;bottom:18px;font-size:12px;color:${FAINT}`)}>inner ring: recall this week · outer ring: later</div>
    </div>
  );
}

export default function Learnings({ V }) {
  const L = V.learn;
  const first = L.dueItems[0];
  const card = `background:#fff;border:1px solid ${LINE};border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:10px`;
  const head = (title, note, color = INK) => <div style={css(`display:flex;gap:10px;align-items:baseline;flex-wrap:wrap`)}><span style={css(`font-size:18px;font-weight:600;color:${color}`)}>{title}</span>{!!note && <span style={css(`font-size:13px;color:${FAINT}`)}>{note}</span>}</div>;
  const outline = `background:none;border:1px solid ${ORANGE};color:${ORANGE};border-radius:99px;padding:7px 12px;font-size:13px;font-weight:500`;
  const SAMPLE = [
    { title: 'Regex lookaheads: matching without consuming', from: 'Validate a password field', steps: [{ label: 'Predicted', v: '3 of 3', tone: 'pred' }, { label: 'First try', v: '1 of 3', tone: 'act' }, { label: 'Fixed', v: '3 of 3', tone: 'mute' }, { label: '3 days later', v: '2 of 3', tone: 'act' }] },
    { title: 'groupby vs pivot_table in pandas', from: 'Weekly signups by channel', steps: [{ label: 'Predicted', v: '1 of 2', tone: 'pred' }, { label: 'First try', v: '2 of 2', tone: 'act' }, { label: 'Real work', v: 'went first, 3 of 3', tone: 'act' }, { label: 'Real work', v: 'let Claude answer', tone: 'mute' }] },
    { title: 'Why a P/E ratio can mislead', from: 'Reading an earnings report', steps: [{ label: 'Predicted', v: '3 of 3', tone: 'pred' }, { label: 'First try', v: '2 of 3', tone: 'act' }, { label: '3 days later', v: '3 of 3', tone: 'act' }] },
  ];
  return (
    <div data-role="learnings" style={css(`flex:1;overflow:auto;padding:40px 48px 56px;background:#F7F4EE`)}>
      <div style={css(`max-width:1124px;margin:0 auto;display:flex;flex-direction:column;gap:28px`)}>
        <div style={css(`display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap`)}>
          <div>
            <h1 style={css(`font-family:${SERIF};font-weight:400;font-size:44px;margin:0 0 6px;letter-spacing:-.01em`)}>Learnings</h1>
            <p style={css(`margin:0;font-size:16px;color:${MUTE}`)}>What you chose to own, how your predictions compared, and what stuck.</p>
          </div>
          <div style={css(`display:flex;gap:10px;align-items:center;font-size:13px;color:${FAINT};flex-wrap:wrap`)}>
            <button onClick={L.skipAhead} data-role="skip-ahead" style={css(`background:none;border:1px dashed #B8B1A3;border-radius:8px;padding:7px 12px;color:#3A3732;font-size:13px;white-space:nowrap`)} className="hv2">⏩ Skip ahead 3 days</button>
            <span>demo control{L.shifted ? ` · it's ${L.shiftDays} days later` : ''} · saved in this browser</span>
            <button onClick={L.resetDemo} data-role="reset-demo" style={css(`background:none;border:none;padding:0;font-size:13px;color:${FAINT};text-decoration:underline;text-underline-offset:2px`)}>Reset demo</button>
          </div>
        </div>

        {L.empty ? (
          <div style={css(card + ';font-size:15px;color:#3A3732;line-height:1.5')}>Nothing yet. Use the <span style={css(`color:${ORANGE}`)}>Own it</span> icon under any answer, or open a past chat in the sidebar and own what you learned there.</div>
        ) : (
          <div style={css(`display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px`)}>
            <Map L={L} />
            <div style={css(`display:flex;flex-direction:column;gap:16px`)}>
              {first ? (
                <div data-role="recall-rail" style={css(`background:${ORANGE};color:#fff;border-radius:14px;padding:22px;display:flex;flex-direction:column;gap:12px;flex:1`)}>
                  <span style={css(`font-size:12px;font-weight:600;letter-spacing:.04em;opacity:.85`)}>READY TO RECALL{L.dueItems.length > 1 ? ` · ${L.dueItems.length} DUE` : ''}</span>
                  <span style={css(`font-family:${SERIF};font-size:24px;line-height:1.25`)}>{first.title}</span>
                  <span style={css(`font-size:13px;line-height:1.5;opacity:.9`)}>A quick check from memory, no looking back.{first.firstLine ? ` You ${first.firstLine}.` : ''}</span>
                  {!first.recall && <button onClick={first.onRecall} style={css(`margin-top:auto;align-self:flex-start;background:#fff;color:${ORANGE};border:none;border-radius:99px;padding:10px 18px;font-size:14px;font-weight:600`)}>Recall now · about a minute</button>}
                  {!!first.recall && <span style={css(`margin-top:auto;font-size:13px;opacity:.9`)}>Recalling below ↓</span>}
                </div>
              ) : (
                <div data-role="recall-rail" style={css(`background:#EFEAE0;border-radius:14px;padding:22px;display:flex;flex-direction:column;gap:10px;flex:1`)}>
                  <span style={css(`font-size:12px;font-weight:600;letter-spacing:.04em;color:${FAINT}`)}>NOTHING DUE</span>
                  <span style={css(`font-family:${SERIF};font-size:21px;line-height:1.3;color:${INK}`)}>{L.nextUp ? L.nextUp.title : 'All caught up'}</span>
                  {!!L.nextUp && <span style={css(`font-size:13px;color:${MUTE}`)}>{inDays(L.nextUp.daysToDue).replace('Recall in', 'Comes back in')}.</span>}
                </div>
              )}
              <div style={css(`background:#EFEAE0;border-radius:14px;padding:18px 20px;display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;font-size:12px;color:${MUTE}`)}>
                {L.stats.map((st, i) => <span key={i}><b style={css(`display:block;font-family:${SERIF};font-weight:400;font-size:26px;color:${INK}`)}>{st.n}</b>{st.label}</span>)}
              </div>
            </div>
          </div>
        )}

        {!!V.hasCalibration && (
          <div data-role="calibration" title={V.calibrationTitle} style={css(`display:flex;gap:14px;align-items:center;font-size:15px;line-height:1.5;color:#3A3732`)}>
            {L.calPct != null && <span style={css(`font-family:${SERIF};font-size:32px;color:${ORANGE};flex:none`)}>{L.calPct}%</span>}
            <span>{V.calibrationText}</span>
          </div>
        )}

        {!!L.recalling && (
          <section style={css(`display:flex;flex-direction:column;gap:10px`)}>
            {head('Recall', L.recalling.title, ORANGE)}
            <div style={css(card + `;border-color:#E8C9BA`)}><Recall it={L.recalling} L={L} /></div>
          </section>
        )}

        {!L.empty && (
          <section style={css(`display:flex;flex-direction:column;gap:14px`)}>
            <div style={css(`display:flex;justify-content:space-between;align-items:baseline`)}>
              {head('Owning')}
              <button onClick={L.toggleSort} style={css(`background:none;border:none;padding:0;font-size:14px;color:${MUTE};text-decoration:underline;text-underline-offset:2px`)}>{L.sortByDue ? 'Sort by most recent' : 'Sort by next recall'}</button>
            </div>
            <div style={css(`display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px`)}>
              {L.sorted.map(it => (
                <div key={it.id} data-role={it.due ? 'due-item' : 'learning'} style={css(`background:#fff;border:1px solid ${it.due ? '#E8C9BA' : LINE};border-radius:12px;overflow:hidden;display:flex;flex-direction:column`)}>
                  <Cover it={it} />
                  <div style={css(`padding:16px;display:flex;flex-direction:column;gap:10px;flex:1`)}>
                    <span style={css(`font-size:15px;font-weight:600;line-height:1.3`)}>{it.title}</span>
                    <span style={css(`font-size:12px;color:${FAINT}`)}>{it.owned ? it.owned + ' · ' : ''}{it.from}</span>
                    <div style={css(`display:flex;gap:6px;flex-wrap:wrap`)}>{it.steps.filter(st => st.tone !== 'next').map((st, j) => <Pill key={j} st={st} />)}</div>
                    <div style={css(`margin-top:auto;display:flex;flex-direction:column;gap:8px;align-items:flex-start`)}>
                      {it.due && !it.recall && <button onClick={it.onRecall} style={css(`background:none;border:none;padding:0;font-size:13px;color:${ORANGE};font-weight:600`)}>Recall now · due</button>}
                      {it.due && !!it.recall && <span style={css(`font-size:13px;color:${ORANGE}`)}>Recalling above ↑</span>}
                      {!it.due && it.daysToDue != null && <span style={css(`font-size:13px;color:${FAINT}`)}>{inDays(it.daysToDue)}</span>}
                      {!!it.onNew && <button onClick={it.onNew} style={css(outline)} className="hv4">Try a new question · {it.newLabel.split(' · ')[1]}</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {L.openGaps.length > 0 && (
          <section data-role="open-gaps" style={css(`display:flex;flex-direction:column;gap:12px`)}>
            {head('Open gaps', "things you found you don't know yet. Explore one with Claude, then check yourself to close it.", '#A85331')}
            <div style={css(`display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px`)}>
              {L.openGaps.map(g => (
                <div key={g.id} data-role="open-gap" style={css(card + `;border-color:#E8C9BA`)}>
                  <div style={css(`display:flex;justify-content:space-between;gap:12px;align-items:baseline`)}><span style={css(`font-size:15px;font-weight:600`)}>{g.topic}</span><span style={css(`font-size:12px;color:${FAINT};flex:none`)}>found {g.when}</span></div>
                  <div style={css(`font-size:13px;color:${MUTE};line-height:1.5`)}>It came up {g.origin}.{g.quote ? <> You said <i>“{g.quote}”</i></> : null}</div>
                  <button onClick={g.onExplore} style={css(`align-self:flex-start;background:${ORANGE};color:#fff;border:none;border-radius:99px;padding:8px 16px;font-size:13.5px;font-weight:500`)}>Explore it with Claude</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {L.askedAbout.length > 0 && (
          <section data-role="asked-about" style={css(`display:flex;flex-direction:column;gap:12px`)}>
            {head('You asked about', 'things you asked Claude to explain. Own one to check it landed.')}
            {L.askedAbout.map(a => (
              <div key={a.id} style={css(card + `;flex-direction:row;justify-content:space-between;align-items:center;gap:14px`)}>
                <div style={css(`display:flex;flex-direction:column;gap:3px;min-width:0`)}><span style={css(`font-size:15px;font-weight:500`)}>{a.label || 'Naming it…'}</span><span style={css(`font-size:12.5px;color:${FAINT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>asked {a.when} in “{a.chatTitle}”{a.quote ? ` · “${a.quote.slice(0, 70)}${a.quote.length > 70 ? '…' : ''}”` : ''}</span></div>
                <button onClick={a.onCheck} style={css(outline + ';flex:none')} className="hv4">Own it</button>
              </div>
            ))}
          </section>
        )}

        {L.exits.length > 0 && (
          <section style={css(`display:flex;flex-direction:column;gap:12px`)}>
            {head('You wanted to learn, then stepped away')}
            {L.exits.map((x, i) => (
              <div key={i} style={css(card + `;flex-direction:row;justify-content:space-between;align-items:center;gap:14px`)}>
                <div style={css(`display:flex;flex-direction:column;gap:3px`)}><span style={css(`font-size:15px;font-weight:500`)}>{x.title}</span><span style={css(`font-size:12.5px;color:${FAINT}`)}>predicted {x.predicted} of {x.n} · {x.askedFirst ? 'went to Claude first' : `left at ${x.step} (${x.stepOf})`}</span></div>
                {!!x.onReopen && <button onClick={x.onReopen} style={css(outline + ';flex:none')} className="hv4">Pick it back up</button>}
              </div>
            ))}
          </section>
        )}

        <section style={css(`display:flex;flex-direction:column;gap:12px;opacity:.75`)}>
          {head('Earlier', 'sample history, mocked to show what a few weeks of use looks like')}
          <div style={css(`display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px`)}>
            {SAMPLE.map((it, i) => (
              <div key={i} style={css(card)}>
                <span style={css(`font-size:15px;font-weight:500`)}>{it.title}</span>
                <span style={css(`font-size:12px;color:${FAINT}`)}>{it.from}</span>
                <div style={css(`display:flex;gap:6px;flex-wrap:wrap`)}>{it.steps.map((st, j) => <Pill key={j} st={st} />)}</div>
              </div>
            ))}
          </div>
          <div style={css(`font-size:13px;color:${MUTE}`)}>Over these weeks, you went from expecting 30% more than you got to 5% more. You're getting better at knowing what you know.</div>
        </section>
      </div>
    </div>
  );
}

// The recall check: from memory, then "then vs now", then when it comes back.
function Recall({ it, L }) {
  const r = it.recall, choice = r.check && r.check.type === 'choice';
  return (
    <div data-role="recall" style={css(`display:flex;flex-direction:column;gap:10px`)}>
      <div style={css(`font-size:15px;line-height:1.5`)}>{r.task || 'Preparing a question…'}</div>
      {!!r.schema && <pre style={css(`margin:0;padding:8px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;white-space:pre-wrap;color:#514C44`)}>{r.schema}</pre>}
      {!!r.before && <pre style={css(`margin:0;padding:8px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;color:#8A847A`)}>{r.before}</pre>}
      {choice ? <ChoiceQuestions qs={r.check.questions} picked={r.picked} onPick={L.onRecallPick} locked={!!r.grade} />
        : <textarea data-role="recall-text" value={r.text} onChange={L.onRecallText} readOnly={!!r.grade} placeholder={r.placeholder || 'From memory. No looking back.'} style={css(`width:100%;min-height:72px;resize:vertical;border:1px solid #E3C9B8;border-radius:8px;padding:10px 12px;font-family:${r.lang === 'sql' ? "'JetBrains Mono',monospace" : 'inherit'};font-size:13.5px;background:#fff;outline:none`)}></textarea>}
      {!!r.after && <pre style={css(`margin:0;padding:8px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;color:#8A847A`)}>{r.after}</pre>}
      {!r.grade && <div style={css(`display:flex;gap:8px;align-items:center`)}><button onClick={L.submitRecall} style={css(`background:${INK};color:#F6F4EF;border:none;border-radius:99px;padding:9px 16px;font-size:13.5px`)}>Check it</button><button onClick={L.closeRecall} style={css(`background:none;border:none;font-size:13px;color:${FAINT}`)}>Not now</button>{!!r.loading && <span style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>checking…</span>}</div>}
      {!!r.grade && (
        <div data-role="recall-result" style={css(`display:flex;flex-direction:column;gap:6px`)}>
          <div style={css(`font-family:${SERIF};font-size:20px`)}>{r.gapMode ? (r.full ? 'Still closed.' : 'It slipped a little.') : <>{it.then} → today: {r.right} of {r.n}</>}</div>
          <div style={css(`font-size:13.5px;color:#514C44;line-height:1.5`)}>{r.grade.note}</div>
          <div style={css(`font-size:13px;color:${r.full ? '#3D6B5A' : '#A85331'}`)}>{r.full ? 'It stuck. ' : "Not quite yet, so it'll come back sooner. "}{it.next ? it.next.replace('next recall', 'Next recall') + '.' : ''}</div>
          <div style={css(`display:flex;gap:8px;flex-wrap:wrap`)}>
            {!r.full && !L.gapTopics.includes(it.title) && <button onClick={L.exploreRecallGap} style={css(`background:${ORANGE};color:#fff;border:none;border-radius:99px;padding:7px 14px;font-size:12.5px`)}>Explore this gap with Claude</button>}
            {!r.full && !L.gapTopics.includes(it.title) && <button onClick={L.saveRecallGap} style={css(`background:none;border:1px solid #E3C9B8;border-radius:99px;padding:7px 14px;font-size:12.5px;color:#A85331`)} className="hv4">Save as a gap</button>}
            {!r.full && L.gapTopics.includes(it.title) && <span style={css(`font-size:12.5px;color:#3D6B5A;align-self:center`)}>✓ Saved as an open gap</span>}
            <button onClick={L.closeRecall} style={css(`background:none;border:1px solid #D9D4CA;border-radius:99px;padding:7px 14px;font-size:12.5px;color:#514C44`)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
