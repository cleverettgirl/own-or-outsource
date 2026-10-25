// The Own-it panel for a personal topic (research §13): no answer key, so it offers recognition practice
// on made-up people instead of a scored try. Picks live here, not in App: nothing is recorded but the count.
import React, { useState } from 'react';
import { inline } from './parts.jsx';

// The best fit isn't always first: order the readings by a fixed shuffle per scenario, so it's stable across renders.
const order = (sc) => sc.options.slice().sort((a, b) => ((a.v * 7 + sc.id.length * 3) % 5) - ((b.v * 7 + sc.id.length * 3) % 5));

export default function SpotPractice({ spot, scenarios, loading, failed, onStart, onChat, onDone }) {
  const [picked, setPicked] = useState({});
  const btn = 'rounded-[9px] px-[13px] py-[8px] text-[13px] border';

  if (!scenarios && !loading && !failed) return (
    <div data-role="spot-offer" className="flex flex-col gap-3">
      <p className="text-[14px] leading-[1.5] text-ink-2 m-0">
        This is personal, so there's no answer key to test you against. Want to practise spotting <b>{spot}</b> in a few different scenarios? Nothing's scored.
      </p>
      <div className="flex gap-2 flex-wrap">
        <button onClick={onStart} data-role="spot-start" className={`${btn} bg-accent text-on-accent border-accent hover:bg-accent-hover`}>Practise spotting it</button>
        <button onClick={onChat} data-role="spot-chat" className={`${btn} bg-transparent text-ink-2 border-line-strong hover:bg-wash`}>Keep exploring in the chat</button>
      </div>
    </div>
  );
  if (loading) return <div className="text-[13px] text-accent-text animate-pulse">Writing a few scenarios…</div>;
  if (failed) return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] text-muted">Couldn't write the scenarios just now.</div>
      <div className="flex gap-2"><button onClick={onStart} className={`${btn} bg-transparent border-line-strong`}>Try again</button><button onClick={onChat} className={`${btn} bg-transparent border-line-strong`}>Keep exploring in the chat</button></div>
    </div>
  );

  const done = scenarios.every(sc => picked[sc.id] != null);
  return (
    <div data-role="spot-practice" className="flex flex-col gap-5">
      <div className="text-[12.5px] text-muted">Practice, not scored. Each reading is one way to see it.</div>
      {scenarios.map((sc, i) => {
        const pick = picked[sc.id], chosen = pick != null ? sc.options[pick] : null, best = sc.options.find(o => o.fits);
        return (
          <div key={sc.id} data-role="spot-q" className="flex flex-col gap-2">
            <div className="text-[14px] leading-[1.5]"><span className="text-accent-text">{i + 1}.</span> {inline(sc.text)}</div>
            <div className="text-[14px] font-semibold">{inline(sc.prompt)}</div>
            {order(sc).map(o => {
              const on = pick === o.v;
              return <button key={o.v} disabled={pick != null} onClick={() => setPicked(p => ({ ...p, [sc.id]: o.v }))}
                className={`text-left rounded-[9px] px-3 py-2 text-[13.5px] leading-[1.4] text-ink border ${on ? 'border-accent bg-accent-soft' : 'border-accent-border bg-surface'} ${pick == null ? 'hover:bg-wash' : ''}`}>{on ? '● ' : '○ '}{inline(o.label)}</button>;
            })}
            {chosen && (
              <div data-role="spot-note" className="text-[13px] leading-[1.5] text-ink-2 bg-surface-2 border border-line rounded-[9px] px-3 py-2 flex flex-col gap-1">
                <div>{inline(chosen.note)}</div>
                {!chosen.fits && best && <div><span className="text-muted">Another way to see it: </span>{inline(best.label)}. {inline(best.note)}</div>}
              </div>
            )}
          </div>
        );
      })}
      {done && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => onDone(picked)} data-role="spot-done" className={`${btn} bg-accent text-on-accent border-accent hover:bg-accent-hover`}>Done</button>
          <button onClick={onChat} className={`${btn} bg-transparent text-ink-2 border-line-strong hover:bg-wash`}>Talk it through in the chat</button>
        </div>
      )}
    </div>
  );
}
