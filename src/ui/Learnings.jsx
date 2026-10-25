// Learnings: what you own and how it went (design 3a). A map of what you own around you (inner ring: recall this
// week), the next recall and the counts beside it, calibration, then a card per thing you own. Below: recall when
// it's open, open gaps, and a labelled sample history.
import { ChoiceQuestions } from './parts.jsx';
import { BODY, LINK, LINK_MUTED, LOADING, PRE } from './styles.js';

const pill = { pred: 'bg-accent-soft text-accent-hover', act: 'bg-good-soft text-good-text', mute: 'bg-sunken text-muted', next: 'border border-dashed border-faint text-muted' };
// "Predicted 3 of 3", "Real work · let Claude answer", "Recall 3 days ago: 3 of 3".
const pillText = st => /^Recall · /.test(st.label) ? `Recall ${st.label.slice(9)}: ${st.v}` : /^\d/.test(st.v) ? `${st.label} ${st.v}` : `${st.label} · ${st.v}`;
const Pill = ({ st }) => <span className={`py-1 px-[9px] rounded-full text-[12px] ${pill[st.tone]}`}>{pillText(st)}</span>;
const shortTitle = t => { const s = String(t).split(/:\s|,\s/)[0]; return s.length > 34 ? s.slice(0, 32) + '…' : s; };
const shortFrom = f => String(f || '').split(/ · |, /)[0];
const inDays = d => (d <= 0 ? 'Recall due now' : `Recall in ${Math.max(1, Math.round(d))} day${Math.round(d) === 1 ? '' : 's'}`);

// A cover for each card, from the chat it came from.
function Cover({ it }) {
  const mono = t => <span className="font-mono text-on-accent text-[14px]">{t}</span>;
  const c = it.sc === 'BOOK' ? ['bg-accent-mid', <span className="w-10 h-10 rounded-full border-[2px] border-surface grid place-items-center text-on-accent text-[12px] font-semibold">5</span>]
    : it.sc === 'SQL' ? ['bg-blue', mono({ onwhere: 'ON ≠ WHERE', joins: 'LEFT JOIN', whole: 'SELECT …' }[it.target] || 'SQL')]
    : it.sc === 'JUNO' ? ['bg-good-mid', <span className="flex gap-1.5">{[0, 1, 2].map(i => <i key={i} className="w-2.5 h-2.5 rounded-full bg-surface block"></i>)}</span>]
    : it.sc === 'REACT' ? ['bg-purple', mono('useEffect')]
    : it.sc === 'GAP' ? ['bg-accent-soft-2', <span className="text-[13px] text-accent-hover font-semibold">gap closed ✓</span>]
    : ['bg-line', <span className="text-[26px] font-serif text-ink">{String(it.title).split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</span>];
  return <div className={`grid place-items-center flex-none h-30 ${c[0]}`}>{c[1]}</div>;
}

// Everything you own around you: due (orange, pulsing) and this week on the inner ring, later on the outer ring,
// related questions you haven't tried yet dashed beyond their concept.
function Map({ L }) {
  const W = 768, H = 440, cx = W / 2, cy = 235, rIn = 95, rOut = 165;
  // The sooner it comes back, the closer to you: due now sits just inside the inner ring, two weeks out on the
  // outer ring. Items are spread evenly around you, soonest first, so labels don't pile up.
  const r = it => (it.due ? 78 : Math.min(rOut, 82 + (Math.max(0, it.daysToDue || 14) / 14) * (rOut - 82)));
  const order = L.items.slice().sort((a, b) => (a.due ? -1 : a.daysToDue ?? 99) - (b.due ? -1 : b.daysToDue ?? 99));
  const n = order.length, pos = {};
  order.forEach((it, i) => { const a = -Math.PI * 0.75 + (i / Math.max(1, n)) * Math.PI * 2, rr = r(it); pos[it.id] = { x: cx + Math.cos(a) * rr * 1.75, y: cy + Math.sin(a) * rr * 0.98, a }; });
  const kids = L.untried.filter(u => pos[u.parent]).map(u => { const p = pos[u.parent]; return { ...u, x: Math.max(70, Math.min(W - 70, cx + Math.cos(p.a) * 200 * 1.75)), y: Math.max(60, Math.min(H - 40, cy + Math.sin(p.a) * 200 * 0.98)), px: p.x, py: p.y }; });
  // Placed by percentage so the map scales with its box; each node is centred on its point.
  const at = (x, y) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });
  const NODE = 'absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5';
  const chats = new Set(L.items.map(it => shortFrom(it.from))).size;
  return (
    <div data-role="map" className="phone:hidden relative bg-surface border border-line rounded-[14px] overflow-hidden min-w-0 h-110">
      <div className="absolute top-4.5 left-5.5 right-5.5 flex justify-between gap-3 text-[12px] z-[1] text-muted">
        <span className="font-semibold text-ink-2 text-[13px]">Your map · {n} {n === 1 ? 'concept' : 'concepts'} across {chats} {chats === 1 ? 'chat' : 'chats'}</span>
        <span className="flex gap-3.5">
          <span className="flex gap-1.5 items-center"><i className="w-2.5 h-2.5 rounded-full inline-block bg-accent"></i>due</span>
          <span className="flex gap-1.5 items-center"><i className="w-2.5 h-2.5 rounded-full inline-block bg-good-mid"></i>owned</span>
          <span className="flex gap-1.5 items-center"><i className="w-2.5 h-2.5 rounded-full inline-block box-border border-[1.5px] border-dashed border-muted"></i>not tried</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" fill="none" stroke="var(--color-line-strong)" strokeWidth="1.5">
        <ellipse cx={cx} cy={cy} rx={rIn * 1.75} ry={rIn * 0.98} />
        <ellipse cx={cx} cy={cy} rx={rOut * 1.75} ry={rOut * 0.98} />
        {L.items.map(it => <line key={it.id} x1={cx} y1={cy} x2={pos[it.id].x} y2={pos[it.id].y} />)}
        {kids.map((k, i) => <line key={'k' + i} x1={k.px} y1={k.py} x2={k.x} y2={k.y} strokeDasharray="4 5" />)}
      </svg>
      <div className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-inverse text-on-inverse grid place-items-center text-[11px] font-medium" style={at(cx, cy)}>you</div>
      {L.items.map(it => (
        <button key={it.id} onClick={it.due && !it.recall ? it.onRecall : undefined} title={it.title} className={`${NODE} bg-transparent border-none p-0 ${it.due ? 'cursor-pointer' : 'cursor-default'}`} style={at(pos[it.id].x, pos[it.id].y)}>
          <span className={`rounded-full ${it.due ? 'w-7.5 h-7.5 bg-accent animate-[mappulse_1.8s_ease-out_infinite]' : 'w-5.5 h-5.5 bg-good-mid'} ${it.id === L.justOwned ? 'shadow-[0_0_0_4px_var(--color-surface),0_0_0_6px_var(--color-accent)]' : ''}`}></span>
          {it.id === L.justOwned && <span data-role="just-owned" className="text-[10.5px] font-semibold tracking-[.05em] text-accent">JUST OWNED</span>}
          <span className="text-[12.5px] font-medium text-center max-w-37.5 leading-[1.3] text-ink">{shortTitle(it.title)}</span>
          <span className="text-[11px] text-muted">{shortFrom(it.from)}</span>
        </button>
      ))}
      {kids.map((k, i) => (
        <div key={'n' + i} className={NODE} style={at(k.x, k.y)}>
          <span className="w-4 h-4 rounded-full box-border border-[1.5px] border-dashed border-muted"></span>
          <span className="text-[12px] whitespace-nowrap text-muted">{k.label}</span>
        </div>
      ))}
      <div className="absolute right-5.5 bottom-4.5 text-[12px] text-muted">inner ring: recall this week · outer ring: later</div>
    </div>
  );
}

export default function Learnings({ V }) {
  const L = V.learn;
  const first = L.dueItems[0];
  // No border colour here: each card sets its own (line, or the accent for recall and gaps).
  const card = 'bg-surface border rounded-xl py-4 px-4.5 flex flex-col gap-2.5';
  const head = (title, note, color = 'text-ink') => <div className="flex gap-2.5 items-baseline flex-wrap"><span className={`text-[18px] font-semibold ${color}`}>{title}</span>{!!note && <span className="text-[13px] text-muted">{note}</span>}</div>;
  const outline = 'bg-transparent border border-accent text-accent rounded-full py-[7px] px-3 text-[13px] font-medium';
  const SAMPLE = [
    { title: 'Regex lookaheads: matching without consuming', from: 'Validate a password field', steps: [{ label: 'Predicted', v: '3 of 3', tone: 'pred' }, { label: 'First try', v: '1 of 3', tone: 'act' }, { label: 'Fixed', v: '3 of 3', tone: 'mute' }, { label: '3 days later', v: '2 of 3', tone: 'act' }] },
    { title: 'groupby vs pivot_table in pandas', from: 'Weekly signups by channel', steps: [{ label: 'Predicted', v: '1 of 2', tone: 'pred' }, { label: 'First try', v: '2 of 2', tone: 'act' }, { label: 'Real work', v: 'went first, 3 of 3', tone: 'act' }, { label: 'Real work', v: 'let Claude answer', tone: 'mute' }] },
    { title: 'Why a P/E ratio can mislead', from: 'Reading an earnings report', steps: [{ label: 'Predicted', v: '3 of 3', tone: 'pred' }, { label: 'First try', v: '2 of 3', tone: 'act' }, { label: '3 days later', v: '3 of 3', tone: 'act' }] },
  ];
  return (
    <div data-role="learnings" className="flex-1 overflow-auto pt-10 pb-14 px-12 phone:pt-15 phone:pb-10 phone:px-4 bg-page">
      <div className="max-w-281 mx-auto flex flex-col gap-7">
        <div className="flex justify-between items-end gap-6 flex-wrap">
          <div>
            {!!L.back && <button onClick={L.back} data-role="learnings-back" className="bg-transparent border-none p-0 mt-0 mb-3.5 mx-0 text-[14px] block hover:border-good hover:text-good-text text-muted">← {L.backLabel}</button>}
            <h1 className="font-normal text-[44px] mt-0 mb-1.5 mx-0 tracking-[-.01em] font-serif">Learnings</h1>
            <p className="m-0 text-[16px] text-muted">What you chose to own, how your predictions compared, and what stuck.</p>
          </div>
          <div className="flex gap-2.5 items-center text-[13px] flex-wrap text-muted">
            <button onClick={L.skipAhead} data-role="skip-ahead" className="bg-transparent border border-dashed border-faint rounded-lg py-[7px] px-3 text-ink-2 text-[13px] whitespace-nowrap hover:border-good hover:text-good-text">⏩ Skip ahead 3 days</button>
            <span>demo control{L.shifted ? ` · it's ${L.shiftDays} days later` : ''} · {L.isDemo ? 'sample data' : 'saved in this browser'}</span>
            <button onClick={L.resetDemo} data-role="reset-demo" className={LINK_MUTED}>Reset demo</button>
          </div>
        </div>

        {L.empty ? (
          <div className={`${card} border-line text-[15px] text-ink-2 leading-normal`}><p className="m-0">Nothing owned yet. Use the <span className="text-accent">Own it</span> icon under any answer, or open a past chat in the sidebar and own what you learned there.</p></div>
        ) : (
          <div data-role="learn-top" className="grid grid-cols-[minmax(0,1fr)_340px] phone:grid-cols-1 gap-4">
            <Map L={L} />
            <div className="flex flex-col gap-4">
              {first ? (
                <div data-role="recall-rail" className="text-on-accent rounded-[14px] p-5.5 flex flex-col gap-3 flex-1 bg-accent">
                  <span className="text-[12px] font-semibold tracking-[.04em] opacity-[.85]">READY TO RECALL{L.dueItems.length > 1 ? ` · ${L.dueItems.length} DUE` : ''}</span>
                  <span className="text-[24px] leading-tight font-serif">{first.title}</span>
                  <span className="text-[13px] leading-normal opacity-[.9]">A quick check from memory, no looking back.{first.firstLine ? ` You ${first.firstLine}.` : ''}</span>
                  {!first.recall && <button onClick={first.onRecall} className="mt-auto self-start bg-surface border-none rounded-full py-2.5 px-4.5 text-[14px] font-semibold text-accent">Recall now · about a minute</button>}
                  {!!first.recall && <span className="mt-auto text-[13px] opacity-[.9]">Recalling below ↓</span>}
                </div>
              ) : (
                <div data-role="recall-rail" className="bg-sunken rounded-[14px] p-5.5 flex flex-col gap-2.5 flex-1">
                  <span className="text-[12px] font-semibold tracking-[.04em] text-muted">NOTHING DUE</span>
                  <span className="text-[21px] leading-[1.3] font-serif text-ink">{L.nextUp ? L.nextUp.title : 'All caught up'}</span>
                  {!!L.nextUp && <span className="text-[13px] text-muted">{inDays(L.nextUp.daysToDue).replace('Recall in', 'Comes back in')}.</span>}
                </div>
              )}
              <div className="bg-sunken rounded-[14px] py-4.5 px-5 grid grid-cols-[1fr_1fr] gap-y-3 gap-x-4 text-[12px] text-muted">
                {L.stats.map((st, i) => <span key={i}><b className="block font-normal text-[26px] font-serif text-ink">{st.n}</b>{st.label}</span>)}
              </div>
            </div>
          </div>
        )}

        {!!V.hasCalibration && (
          <div data-role="calibration" title={V.calibrationTitle} className="flex gap-3.5 items-center text-[15px] leading-normal text-ink-2">
            {L.calPct != null && <span className="text-[32px] flex-none font-serif text-accent">{L.calPct}%</span>}
            <span>{V.calibrationText}</span>
          </div>
        )}

        {!!L.recalling && (
          <section className="flex flex-col gap-2.5">
            {head('Recall', L.recalling.title, 'text-accent')}
            <div className={`${card} border-accent-border`}><Recall it={L.recalling} L={L} /></div>
          </section>
        )}

        {!L.empty && (
          <section className="flex flex-col gap-3.5">
            <div className="flex justify-between items-baseline">
              {head('Owning')}
              <button onClick={L.toggleSort} className={`${LINK} text-[14px] text-muted`}>{L.sortByDue ? 'Sort by most recent' : 'Sort by next recall'}</button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
              {L.sorted.map(it => (
                <div key={it.id} data-role={it.due ? 'due-item' : 'learning'} data-just-owned={it.id === L.justOwned || undefined} className={`bg-surface rounded-xl overflow-hidden flex flex-col ${it.id === L.justOwned ? 'border-2 border-accent' : it.due ? 'border border-accent-border' : 'border border-line'}`}>
                  <Cover it={it} />
                  <div className="p-4 flex flex-col gap-2.5 flex-1">
                    <span className="text-[15px] font-semibold leading-[1.3]">{it.title}</span>
                    <span className="text-[12px] text-muted">{it.owned ? it.owned + ' · ' : ''}{it.from}</span>
                    <div className="flex gap-1.5 flex-wrap">{it.steps.filter(st => st.tone !== 'next').map((st, j) => <Pill key={j} st={st} />)}</div>
                    <div className="mt-auto flex flex-col gap-2 items-start">
                      {it.due && !it.recall && <button onClick={it.onRecall} className="bg-transparent border-none p-0 text-[13px] font-semibold text-accent">Recall now · due</button>}
                      {it.due && !!it.recall && <span className="text-[13px] text-accent">Recalling above ↑</span>}
                      {!it.due && it.daysToDue != null && <span className="text-[13px] text-muted">{inDays(it.daysToDue)}</span>}
                      {!!it.onNew && <button onClick={it.onNew} className={`${outline} hover:bg-accent-soft`}>Try a new question · {it.newLabel.split(' · ')[1]}</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {L.openGaps.length > 0 && (
          <section data-role="open-gaps" className="flex flex-col gap-3">
            {head('Open gaps', "things you found you don't know yet. Explore one with Claude, then check yourself to close it.", 'text-accent-hover')}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
              {L.openGaps.map(g => (
                <div key={g.id} data-role="open-gap" className={`${card} border-accent-border`}>
                  <div className="flex justify-between gap-3 items-baseline"><span className="text-[15px] font-semibold">{g.topic}</span><span className="text-[12px] flex-none text-muted">found {g.when}</span></div>
                  <div className="text-[13px] leading-normal text-muted">It came up {g.origin}.{g.quote ? <> You said <i>“{g.quote}”</i></> : null}</div>
                  <button onClick={g.onExplore} className="self-start text-on-accent border-none rounded-full py-2 px-4 text-[13.5px] font-medium bg-accent">Explore it with Claude</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {L.practised.length > 0 && (
          <section data-role="practised" className="flex flex-col gap-3">
            {head('Practised, not scored', "personal topics have no answer key, so only the topic is kept here: nothing you picked, and no score.")}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {L.practised.map(p => (
                <div key={p.id} className={`${card} border-line`}>
                  <span className="text-[15px] font-semibold">{p.topic[0].toUpperCase() + p.topic.slice(1)}</span>
                  <span className="text-[12px] text-muted">Spotted it in {p.n} scenario{p.n === 1 ? '' : 's'} · {p.when}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* "You asked about" and "stepped away" were cut for focus (process log 75): both are still recorded, and
            listed in the doc as ways to extend this. Asking leads to owning from the chat's own Own it button. */}

        <section className="flex flex-col gap-3 opacity-[.75]">
          {head('Earlier', 'sample history, mocked to show what a few weeks of use looks like')}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {SAMPLE.map((it, i) => (
              <div key={i} className={`${card} border-line`}>
                <span className="text-[15px] font-medium">{it.title}</span>
                <span className="text-[12px] text-muted">{it.from}</span>
                <div className="flex gap-1.5 flex-wrap">{it.steps.map((st, j) => <Pill key={j} st={st} />)}</div>
              </div>
            ))}
          </div>
          <div className="text-[13px] text-muted">Over these weeks, you went from expecting 30% more than you got to 5% more. You're getting better at knowing what you know.</div>
        </section>
      </div>
    </div>
  );
}

// The recall check: from memory, then "then vs now", then when it comes back.
function Recall({ it, L }) {
  const r = it.recall, choice = r.check && r.check.type === 'choice';
  return (
    <div data-role="recall" className="flex flex-col gap-2.5">
      <div className="text-[15px] leading-normal">{r.task || 'Preparing a question…'}</div>
      {!!r.schema && <pre className={`${PRE} text-[12px] text-ink-2`}>{r.schema}</pre>}
      {!!r.before && <pre className={`${PRE} text-[13px] text-muted`}>{r.before}</pre>}
      {choice ? <ChoiceQuestions qs={r.check.questions} picked={r.picked} onPick={L.onRecallPick} locked={!!r.grade} />
        : <textarea data-role="recall-text" value={r.text} onChange={L.onRecallText} readOnly={!!r.grade} placeholder={r.placeholder || 'From memory. No looking back.'} className={`w-full min-h-18 resize-y border border-accent-border rounded-lg py-2.5 px-3 text-[13.5px] bg-surface outline-none ${r.lang === 'sql' ? 'font-mono' : 'font-[inherit]'}`}></textarea>}
      {!!r.after && <pre className={`${PRE} text-[13px] text-muted`}>{r.after}</pre>}
      {!r.grade && <div className="flex gap-2 items-center"><button onClick={L.submitRecall} className="bg-inverse text-on-inverse border-none rounded-full py-[9px] px-4 text-[13.5px]">Check it</button><button onClick={L.closeRecall} className="bg-transparent border-none text-[13px] text-muted">Not now</button>{!!r.loading && <span className={LOADING}>checking…</span>}</div>}
      {!!r.grade && (
        <div data-role="recall-result" className="flex flex-col gap-1.5">
          <div className="text-[20px] font-serif">{r.gapMode ? (r.full ? 'Still closed.' : 'It slipped a little.') : <>{it.then} → today: {r.right} of {r.n}</>}</div>
          <div className={BODY}>{r.grade.note}</div>
          <div className={`text-[13px] ${r.full ? 'text-good-text' : 'text-accent-hover'}`}>{r.full ? 'It stuck. ' : "Not quite yet, so it'll come back sooner. "}{it.next ? it.next.replace('next recall', 'Next recall') + '.' : ''}</div>
          <div className="flex gap-2 flex-wrap">
            {!r.full && !L.gapTopics.includes(it.title) && <button onClick={L.exploreRecallGap} className="text-on-accent border-none rounded-full py-[7px] px-3.5 text-[12.5px] bg-accent">Explore this gap with Claude</button>}
            {!r.full && !L.gapTopics.includes(it.title) && <button onClick={L.saveRecallGap} className="bg-transparent border border-accent-border rounded-full py-[7px] px-3.5 text-[12.5px] text-accent-hover hover:bg-accent-soft">Save as a gap</button>}
            {!r.full && L.gapTopics.includes(it.title) && <span className="text-[12.5px] text-good-text self-center">✓ Saved as an open gap</span>}
            <button onClick={L.askAboutRecall} data-role="recall-ask" className="bg-transparent border border-accent-border rounded-full py-[7px] px-3.5 text-[12.5px] text-accent-hover hover:bg-accent-soft">Ask Claude about this</button>
            <button onClick={L.closeRecall} className="bg-transparent border border-line-strong rounded-full py-[7px] px-3.5 text-[12.5px] text-ink-2">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
