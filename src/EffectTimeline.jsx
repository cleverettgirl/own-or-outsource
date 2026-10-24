// "See it run" for useEffect + cleanup: the timing, which the code can't show. Built on the effect from
// Claude's real answer (AbortController). Each effect run is a lane with its request as a bar. When you
// click a new user, React re-renders, runs the OLD effect's cleanup (controller.abort(): the old request
// is cut off, ✂), then runs the new effect. Step through it like a video; at each click a numbered strip
// shows that cycle. Then "break it": no cleanup, or [] deps, and watch the card go wrong.
import React from 'react';
import { css } from './css.js';

// The effect from Claude's answer, trimmed to the lines that matter for timing.
const CODE = [
  'useEffect(() => {',
  '  const controller = new AbortController();',
  '  async function fetchUser() {',
  '    const res = await fetch(`/api/users/${userId}`,',
  '      { signal: controller.signal });',
  '    const data = await res.json();',
  '    setUser(data);',
  '  }',
  '  fetchUser();',
  '  return () => controller.abort();   // cleanup',
  '}, [userId]);',
];

const USERS = { 1: 'Ada', 2: 'Bo', 3: 'Cy' };
// One race: Bo's request is slow and would answer after Cy's.
const RUNS = [{ n: 1, id: 1, start: 1, resp: 3, cleanup: 5 }, { n: 2, id: 2, start: 5, resp: 12, cleanup: 7 }, { n: 3, id: 3, start: 7, resp: 10, cleanup: 14 }];
const CLICKS = [{ from: 0, to: 5, id: 1 }, { from: 5, to: 7, id: 2 }, { from: 7, to: 15, id: 3 }];
// What happens, in order, when you click a new name: the cycle the cleanup lives in.
const cycle = (oldN, newId, aborts) => [
  { t: `React re-renders with userId = ${newId}` },
  { t: `Cleanup of run #${oldN}: controller.abort()${aborts ? ` → cuts off ${aborts}'s request` : ' (its request already finished, nothing to cut)'}`, key: true },
  { t: `Run #${oldN + 1} starts: fetch user ${newId}` },
];

const VARIANTS = {
  correct: {
    label: "Claude's code: cleanup + [userId]",
    runs: RUNS,
    screen: [{ from: 0, to: 3, t: 'Loading…' }, { from: 3, to: 10, t: 'Ada' }, { from: 10, to: 15, t: 'Cy' }],
    events: [
      { t: 0, title: 'You click Ada (userId = 1)', note: 'The card mounts. It knows WHICH user to show (userId 1) but has no data yet, so it shows "Loading…".', lines: [] },
      { t: 1, title: 'The effect runs: run #1 fetches Ada', note: 'After the first paint, React runs the effect. Run #1 gets its own controller.', lines: [1, 3, 4, 8] },
      { t: 3, title: "Ada's data arrives", note: 'setUser(Ada). The card shows Ada.', lines: [5, 6] },
      { t: 5, title: 'You click Bo (userId → 2)', note: 'The dependency changed, so the effect must re-run. But first, React cleans up after the previous run:', cycle: cycle(1, 2, null), lines: [9, 10, 1, 3] },
      { t: 7, title: 'You quickly click Cy (userId → 3)', note: "Bo's request is still in flight. Same cycle, and this time the cleanup matters:", cycle: cycle(2, 3, 'Bo'), lines: [9, 1, 3] },
      { t: 10, title: "Cy's data arrives", note: 'setUser(Cy). The card matches what you clicked.', lines: [5, 6] },
      { t: 12, title: "When Bo's slow request would have finished", note: "It was cut off at ✂ when you clicked Cy, so there's no response to land. (fetch rejects with an AbortError, which Claude's answer ignores on purpose.)", lines: [9],
        ask: { q: "You clicked Cy last. Bo's slow request would have finished now. What does the card show?", options: ['Bo', 'Cy'], answer: 'Cy' } },
      { t: 14, title: 'You close the card (unmount)', note: 'Cleanup runs one last time, for run #3. Anything still in flight is cut off.', lines: [9] },
    ],
  },
  noCleanup: {
    label: 'Break it: no cleanup',
    removed: [9],
    runs: RUNS.map(r => ({ ...r, cleanup: null })),
    screen: [{ from: 0, to: 3, t: 'Loading…' }, { from: 3, to: 10, t: 'Ada' }, { from: 10, to: 12, t: 'Cy' }, { from: 12, to: 15, t: 'Bo', bad: true }],
    events: [
      { t: 5, title: 'You click Bo, then quickly Cy', note: "No cleanup, so nothing cuts off the old requests. Bo's and Cy's are both in flight.", lines: [1, 3] },
      { t: 10, title: "Cy's data arrives", note: 'setUser(Cy). Looks fine, for now.', lines: [6] },
      { t: 12, title: "Bo's slow response arrives", note: 'Nothing stopped it: setUser(Bo). You clicked Cy, but the card shows Bo. The wrong user, and it stays.', lines: [6], bad: true },
    ],
  },
  emptyDeps: {
    label: 'Break it: [] instead of [userId]',
    changed: { 10: '}, []);' },
    runs: [{ ...RUNS[0], cleanup: 14 }],
    screen: [{ from: 0, to: 3, t: 'Loading…' }, { from: 3, to: 5, t: 'Ada' }, { from: 5, to: 15, t: 'Ada', bad: true }],
    events: [
      { t: 1, title: 'You click Ada: the effect runs once', note: 'With [] the effect runs on mount and never again, so there is never a cleanup-then-rerun.', lines: [1, 3] },
      { t: 5, title: 'You click Bo', note: 'The card gets userId 2 and re-renders, but [] means the effect does not re-run. No new fetch.', lines: [10], bad: true },
      { t: 7, title: 'You click Cy', note: 'Still no fetch. The card shows Ada forever, whatever you click.', lines: [10], bad: true },
    ],
  },
};

const T_MAX = 15;
const X0 = 70, W = 520;
const x = t => X0 + (t / T_MAX) * W;

export default function EffectTimeline({ onDone }) {
  const [variant, setVariant] = React.useState('correct');
  const [i, setI] = React.useState(0);
  const [answer, setAnswer] = React.useState(null);
  const [seenAll, setSeenAll] = React.useState(false);
  const V = VARIANTS[variant], ev = V.events[i], now = ev.t;
  const blocked = !!ev.ask && answer == null;
  const go = d => { const j = Math.min(V.events.length - 1, Math.max(0, i + d)); setI(j); if (variant === 'correct' && j === V.events.length - 1) setSeenAll(true); };
  const pick = v => { setVariant(v); setI(0); };
  const fade = t => (t > now ? 0.18 : 1);
  const lane = (k, label) => <text x={8} y={22 + k * 30} fontSize="11" fill="#8A847A">{label}</text>;
  const y = k => 12 + k * 30;
  const picked = CLICKS.find(p => now >= p.from && now < p.to).id;
  const shown = V.screen.find(sc => now >= sc.from && now < sc.to);

  return (
    <div data-role="effect-timeline" style={css(`display:flex;flex-direction:column;gap:12px`)}>
      <div style={css(`font-size:13.5px;line-height:1.5;color:#514C44`)}>The setup: the card sits next to a list of users. Clicking a name sends its <code>userId</code> to the card. You click Ada, then Bo, then quickly Cy, before Bo's data has arrived. Watch when the <b>cleanup</b> runs.</div>
      <div data-role="mini-app" style={css(`display:flex;gap:10px;align-items:stretch`)}>
        <div style={css(`display:flex;flex-direction:column;gap:3px;background:#fff;border:1px solid #E3DFD6;border-radius:10px;padding:6px;width:140px`)}>
          <div style={css(`font-size:10.5px;color:#9A948A;padding:2px 6px`)}>Users</div>
          {[1, 2, 3].map(id => <div key={id} style={css(`font-size:13px;padding:5px 8px;border-radius:6px;background:${picked === id ? '#1F1D1A' : 'transparent'};color:${picked === id ? '#fff' : '#514C44'}`)}>{USERS[id]}{picked === id ? '  ← clicked' : ''}</div>)}
        </div>
        <div style={css(`flex:1;background:#fff;border:1px solid ${shown && shown.bad ? '#C4613A' : '#E3DFD6'};border-radius:10px;padding:10px 14px;display:flex;flex-direction:column;gap:4px;justify-content:center`)}>
          <div style={css(`font-size:10.5px;color:#9A948A`)}>UserProfile · props: userId = {picked}</div>
          <div style={css(`font-family:Newsreader,serif;font-size:22px;color:${shown && shown.bad ? '#9E4B2A' : '#1F1D1A'}`)}>{shown ? shown.t : ''}</div>
          {shown && shown.bad && <div style={css(`font-size:12px;color:#9E4B2A`)}>Wrong user: you clicked {USERS[picked]}</div>}
        </div>
      </div>

      <div style={css(`display:flex;gap:6px;flex-wrap:wrap`)}>
        {Object.entries(VARIANTS).map(([k, v]) => (
          <button key={k} onClick={() => pick(k)} disabled={k !== 'correct' && !seenAll} title={k !== 'correct' && !seenAll ? 'Watch the working version to the end first' : ''}
            style={css(`font-size:12px;padding:5px 11px;border-radius:99px;border:1px solid ${variant === k ? '#C4613A' : '#E3DFD6'};background:${variant === k ? '#C4613A' : '#fff'};color:${variant === k ? '#fff' : k !== 'correct' && !seenAll ? '#B5AFA4' : '#514C44'}`)}>{v.label}</button>
        ))}
      </div>

      <svg viewBox={`0 0 600 ${y(5) + 18}`} style={css(`width:100%;background:#fff;border:1px solid #E3DFD6;border-radius:10px`)} role="img" aria-label="Timeline of clicks, effect runs, their requests and cleanups, and what the card shows">
        {lane(0, 'you click')}
        {CLICKS.map((p, k) => <g key={k} opacity={fade(p.from)}><rect x={x(p.from) + 1} y={y(0)} width={x(p.to) - x(p.from) - 2} height="16" rx="4" fill="#F1EEE8" /><text x={x(p.from) + 6} y={y(0) + 12} fontSize="11" fill="#514C44">{USERS[p.id]} (userId {p.id})</text></g>)}
        {RUNS.map((r, k) => {
          const run = V.runs.find(q => q.n === r.n);
          if (!run) return <g key={k}>{lane(k + 1, `run #${r.n}`)}<text x={x(r.start)} y={y(k + 1) + 12} fontSize="11" fill="#C9C3B8" opacity={fade(r.start)}>never runs</text></g>;
          // A cleanup before the response cuts the request off there.
          const aborted = run.cleanup != null && run.cleanup < run.resp;
          const end = aborted ? run.cleanup : run.resp;
          const tone = variant === 'noCleanup' && run.n === 2 ? '#C4613A' : '#2F8F86';
          return (
            <g key={k}>
              {lane(k + 1, `run #${r.n}`)}
              {aborted && <rect x={x(run.start)} y={y(k + 1) + 4} width={x(run.resp) - x(run.start)} height="8" rx="4" fill="none" stroke="#E8C8B5" strokeDasharray="3 3" opacity={run.start > now ? 0.12 : 0.45} />}
              <rect x={x(run.start)} y={y(k + 1) + 4} width={Math.max(0, Math.min(x(end), x(now)) - x(run.start))} height="8" rx="4" fill="#E8C8B5" opacity={run.start > now ? 0 : 1} />
              <text x={x(run.start)} y={y(k + 1) + 2} fontSize="9" fill="#9E4B2A" opacity={fade(run.start)}>fetch {USERS[run.id]}</text>
              {run.cleanup != null && run.cleanup <= T_MAX && <g opacity={fade(run.cleanup)}><line x1={x(run.cleanup)} x2={x(run.cleanup)} y1={y(k + 1) - 2} y2={y(k + 1) + 18} stroke="#9E4B2A" strokeWidth="2" /><text x={x(run.cleanup) - 4} y={y(k + 1) + 12} fontSize="11" fill="#9E4B2A" textAnchor="end">✂</text></g>}
              {aborted
                ? <text x={x(run.resp) + 6} y={y(k + 1) + 12} fontSize="9" fill="#B5AFA4" opacity={fade(run.resp)}>would have arrived</text>
                : <g opacity={fade(run.resp)}><circle cx={x(run.resp)} cy={y(k + 1) + 8} r="8" fill={tone} /><text x={x(run.resp)} y={y(k + 1) + 12} fontSize="10" fill="#fff" textAnchor="middle">✓</text></g>}
            </g>
          );
        })}
        {lane(4, 'card shows')}
        {V.screen.map((s, k) => <g key={k} opacity={fade(s.from)}><rect x={x(s.from) + 1} y={y(4)} width={x(s.to) - x(s.from) - 2} height="18" rx="4" fill={s.bad ? '#FBE9E1' : s.t === 'Loading…' ? '#F4F1EA' : '#E2F1EE'} stroke={s.bad ? '#C4613A' : 'none'} /><text x={x(s.from) + 6} y={y(4) + 13} fontSize="11" fill={s.bad ? '#9E4B2A' : '#1F1D1A'} fontWeight={s.bad ? 600 : 400}>{s.t}</text></g>)}
        <line x1={x(now)} x2={x(now)} y1="4" y2={y(5) + 4} stroke="#1F1D1A" strokeWidth="1.5" />
        <text x={x(now)} y={y(5) + 15} fontSize="10" textAnchor="middle" fill="#1F1D1A">now</text>
      </svg>
      <div style={css(`display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:#8A847A;margin-top:-6px`)}>
        <span><span style={css(`display:inline-block;width:18px;height:6px;border-radius:3px;background:#E8C8B5;vertical-align:middle`)}></span> request in flight</span>
        <span style={css(`color:#9E4B2A`)}>✂ cleanup: controller.abort()</span>
        <span><span style={css(`color:#2F8F86`)}>✓</span> response shown</span>
        <span>dashed: the part that was cut off</span>
      </div>

      <div style={css(`display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start`)}>
        <div style={css(`display:flex;flex-direction:column;gap:6px;border-left:2px solid ${ev.bad ? '#C4613A' : '#2F8F86'};padding:2px 0 2px 12px`)}>
          <div style={css(`font-size:11px;color:#8A847A`)}>step {i + 1} of {V.events.length}{V.removed || V.changed ? ' · code changed on the right' : ''}</div>
          <div style={css(`font-size:14.5px;font-weight:500;color:${ev.bad ? '#9E4B2A' : '#1F1D1A'}`)}>{ev.title}</div>
          {ev.ask && answer == null ? (
            <div style={css(`display:flex;flex-direction:column;gap:6px`)}>
              <div style={css(`font-size:13.5px`)}>{ev.ask.q}</div>
              <div style={css(`display:flex;gap:6px`)}>{ev.ask.options.map(o => <button key={o} onClick={() => setAnswer(o)} style={css(`flex:1;border:1px solid #E3C9B8;background:#fff;border-radius:8px;padding:7px 0;font-size:13.5px`)} className="hv3">{o}</button>)}</div>
            </div>
          ) : (
            <>
              {ev.ask && <div style={css(`font-size:13px;font-weight:500;color:${answer === ev.ask.answer ? '#1F6B64' : '#9E4B2A'}`)}>You said {answer}. {answer === ev.ask.answer ? 'Right.' : `It's ${ev.ask.answer}.`}</div>}
              <div style={css(`font-size:13px;line-height:1.5;color:#514C44`)}>{ev.note}</div>
              {ev.cycle && (
                <ol data-role="cycle" style={css(`margin:2px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px`)}>
                  {ev.cycle.map((c, k) => <li key={k} style={css(`display:flex;gap:8px;align-items:baseline;font-size:12.5px;line-height:1.4;padding:5px 8px;border-radius:7px;background:${c.key ? '#FBE9E1' : '#F4F1EA'};color:${c.key ? '#9E4B2A' : '#514C44'};font-weight:${c.key ? 600 : 400}`)}><span style={css(`flex:none`)}>{k + 1}.</span><span>{c.t}</span></li>)}
                </ol>
              )}
            </>
          )}
        </div>
        <pre style={css(`margin:0;padding:8px 0;background:#FBFAF7;border:1px solid #E3DFD6;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6;overflow:auto`)}>
          {CODE.map((l, k) => {
            const gone = (V.removed || []).includes(k), changed = V.changed && V.changed[k] != null, on = ev.lines.includes(k);
            return <div key={k} style={css(`padding:0 10px;white-space:pre;background:${changed || (on && (ev.bad || k === 9)) ? '#FBE9E1' : on ? '#FFF1E8' : 'transparent'};color:${gone ? '#C4613A' : changed || on ? '#1F1D1A' : '#9A948A'};text-decoration:${gone ? 'line-through' : 'none'};font-weight:${on && k === 9 ? 600 : 400}`)}>{(changed ? V.changed[k] : l) || ' '}</div>;
          })}
          <div style={css(`padding:4px 10px 0;font-family:'Instrument Sans',system-ui,sans-serif;font-size:10.5px;color:#9A948A;white-space:normal`)}>the effect from Claude's answer, trimmed to the timing</div>
        </pre>
      </div>

      <div style={css(`display:flex;gap:8px;align-items:center;justify-content:space-between`)}>
        <div style={css(`display:flex;gap:6px`)}>
          <button onClick={() => go(-1)} disabled={i === 0} style={css(`background:none;border:1px solid #D9D4CA;border-radius:8px;padding:7px 12px;font-size:13px`)} className="hv6">← Back</button>
          {i < V.events.length - 1 && <button onClick={() => go(1)} disabled={blocked} style={css(`background:${blocked ? '#C9C3B8' : '#1F1D1A'};color:#F6F4EF;border:none;border-radius:8px;padding:7px 14px;font-size:13px`)}>Next →</button>}
        </div>
        {seenAll && variant === 'correct' && i === V.events.length - 1 && <span style={css(`font-size:12.5px;color:#8A847A`)}>Now try breaking it ↑</span>}
        {seenAll && <button onClick={onDone} style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Got it, now write one yourself →</button>}
      </div>
    </div>
  );
}
