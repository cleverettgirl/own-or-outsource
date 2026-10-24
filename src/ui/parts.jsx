// Shared pieces of the interface: markdown, item lists, choice questions, icons, small diagrams, style constants.
import React from 'react';
import { css } from '../css.js';


// Claude's answers as Claude renders them: paragraphs, ## headings, - bullets, `inline code`, fenced code blocks.
export const inline = t => t.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/).map((p, i) => p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <b key={i}>{inline(p.slice(2, -2))}</b> : p.startsWith('*') && p.endsWith('*') && p.length > 2 && !p.startsWith('**') ? <i key={i}>{inline(p.slice(1, -1))}</i> : p.startsWith('`') && p.endsWith('`') && p.length > 1 ? <code key={i} style={css(`font-family:'JetBrains Mono',monospace;font-size:.86em;background:#F1EEE8;border-radius:4px;padding:1px 5px`)}>{p.slice(1, -1)}</code> : p);

export function Md({ text, small }) {
  const body = small ? 'font-family:Newsreader,serif;font-size:14.5px;line-height:1.55;white-space:pre-wrap' : SERIF;
  const parts = text.split(/```(\w*)\n([\s\S]*?)```/);
  const out = [];
  for (let i = 0; i < parts.length; i += 3) {
    parts[i].split(/\n{2,}/).map(b => b.trim()).filter(Boolean).forEach((b, j) => {
      const key = `${i}-${j}`;
      if (/^#{1,3} /.test(b)) out.push(<div key={key} style={css(`font-family:Newsreader,serif;font-size:${small ? '15.5px' : '18.5px'};font-weight:600;margin-top:4px`)}>{inline(b.replace(/^#{1,3} /, ''))}</div>);
      else if (b.split('\n').every(l => /^\d+\. /.test(l))) out.push(<ol key={key} style={css(`margin:0;padding-left:24px;display:flex;flex-direction:column;gap:6px;font-family:Newsreader,serif;font-size:${small ? '14.5px' : '16.5px'};line-height:1.6`)}>{b.split('\n').map((l, k) => <li key={k}>{inline(l.replace(/^\d+\. /, ''))}</li>)}</ol>);
      else if (b.split('\n').every(l => l.startsWith('- '))) out.push(<ul key={key} style={css(`margin:0;padding-left:22px;display:flex;flex-direction:column;gap:6px;font-family:Newsreader,serif;font-size:${small ? '14.5px' : '16.5px'};line-height:1.6`)}>{b.split('\n').map((l, k) => <li key={k}>{inline(l.slice(2))}</li>)}</ul>);
      else out.push(<div key={key} style={css(body)}>{inline(b)}</div>);
    });
    if (parts[i + 2] != null) out.push(
      <div key={`c${i}`} style={css(`background:#FBFAF7;border:1px solid #E3DFD6;border-radius:10px;overflow:hidden`)}>
        <div style={css(`padding:6px 12px;border-bottom:1px solid #EEEAE2;font-size:11px;color:#8A847A`)}>{parts[i + 1] || 'code'}</div>
        <pre style={css(`margin:0;padding:14px 16px;font-family:'JetBrains Mono',monospace;font-size:${small ? '12px' : '13px'};line-height:1.6;overflow:auto;white-space:pre`)}>{parts[i + 2].replace(/\n$/, '')}</pre>
      </div>);
  }
  return <div style={css(`display:flex;flex-direction:column;gap:12px`)}>{out}</div>;
}


// What a check looked at, item by item: ✓ or ✗, with the idea you came to own marked.
export function ItemList({ items, ownedNote = '', title }) {
  return (
    <div data-role="items" title={title} style={css(`display:flex;flex-direction:column;gap:4px`)}>
      {items.map((it, i) => (
        <div key={i} style={css(`display:flex;gap:8px;align-items:baseline;font-size:13.5px;line-height:1.45;color:${it.ok ? '#1F1D1A' : '#9E4B2A'}`)}>
          <span style={css(`flex:none;width:14px;color:${it.ok ? '#2F8F86' : '#C4613A'}`)}>{it.ok ? '✓' : '✗'}</span>
          <span>{it.short}{it.blank ? <span style={css(`color:#8A847A`)}> (left blank)</span> : null}{it.owned && ownedNote ? <span style={css(`font-size:12px;color:#8A847A`)}> · {ownedNote}</span> : null}</span>
        </div>
      ))}
    </div>
  );
}


// Multiple-choice questions for a "chosen" check. Picks lock once checked.
// Options are shown in a random order, so the right one isn't always first (it was, in every hand-written question
// and most generated ones). The order is picked once per question per visit, so it stays put while you answer.
// A question marked ordered (a scale like less / same / more) keeps its order.
const orders = new Map();
export function shuffled(q, rnd = Math.random) {
  if (q.ordered) return q.options;
  const key = q.id + '|' + q.prompt;
  if (!orders.has(key)) {
    const o = q.options.map(x => x.v);
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    orders.set(key, o);
  }
  const order = orders.get(key);
  return order.map(v => q.options.find(x => x.v === v)).filter(Boolean);
}
export function ChoiceQuestions({ qs, picked, onPick, locked }) {
  return (
    <div style={css(`display:flex;flex-direction:column;gap:14px`)}>
      {qs.map((q, i) => (
        <div key={q.id} data-role="choice-q" style={css(`display:flex;flex-direction:column;gap:6px`)}>
          <div style={css(`font-size:14px;line-height:1.45`)}><span style={css(`color:#9E4B2A`)}>{i + 1}.</span> {q.prompt}</div>
          {shuffled(q).map(o => {
            const on = picked[q.id] === o.v;
            return <button key={o.v} disabled={locked} onClick={() => onPick(q.id, o.v)} style={css(`text-align:left;border:1px solid ${on ? '#C4613A' : '#E3C9B8'};background:${on ? '#FFF1E8' : '#fff'};color:#1F1D1A;border-radius:9px;padding:8px 12px;font-size:13.5px;line-height:1.4`)} className={locked ? '' : 'hv3'}>{on ? '● ' : '○ '}{o.l}</button>;
          })}
        </div>
      ))}
    </div>
  );
}


// Action-row icons, drawn to sit with Claude's copy / read aloud / retry row.
export const ico = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const CopyIcon = () => <svg {...ico}><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5V3.8A1.3 1.3 0 0 0 9.2 2.5H3.8A1.3 1.3 0 0 0 2.5 3.8v5.4a1.3 1.3 0 0 0 1.3 1.3h1.7" /></svg>;

export const SpeakIcon = () => <svg {...ico}><path d="M2.5 6v4h2.5l3.5 3V3L5 6z" /><path d="M11 5.8a3 3 0 0 1 0 4.4M12.8 4.2a5.3 5.3 0 0 1 0 7.6" /></svg>;

export const RetryIcon = () => <svg {...ico}><path d="M13.2 8A5.2 5.2 0 1 1 11.6 4.2" /><path d="M11.8 1.8v2.6H9.2" /></svg>;

export const MicIcon = () => <svg {...ico}><rect x="5.8" y="2" width="4.4" height="7.5" rx="2.2" /><path d="M3.5 7.8a4.5 4.5 0 0 0 9 0M8 12.3V14" /></svg>;

export const NAV_ICONS = {
  Search: <svg {...ico}><circle cx="7" cy="7" r="4.3" /><path d="M10.2 10.2 13.5 13.5" /></svg>,
  Projects: <svg {...ico}><rect x="2.5" y="3.5" width="11" height="9" rx="1.5" /><path d="M2.5 6.5h11" /></svg>,
  Artifacts: <svg {...ico}><path d="M8 2.3 13.2 5v6L8 13.7 2.8 11V5z" /><path d="M2.8 5 8 7.8 13.2 5M8 7.8v5.9" /></svg>,
  Customize: <svg {...ico}><path d="M2.5 5h11M2.5 11h11" /><circle cx="6" cy="5" r="1.5" fill="#F3F1EC" /><circle cx="10" cy="11" r="1.5" fill="#F3F1EC" /></svg>,
};

// Placeholder for the Own-it entry point (an open book); the designer will choose the final icon.
export const OwnIcon = () => <svg {...ico}><path d="M8 4.2C6.6 3.2 4.6 2.8 2.5 3v9.3c2.1-.2 4.1.2 5.5 1.2 1.4-1 3.4-1.4 5.5-1.2V3c-2.1-.2-4.1.2-5.5 1.2z" /><path d="M8 4.2v9.3" /></svg>;


// Who holds the relationship: platform owns users (supply is replaceable), or supply and users bond directly.
export function OwnDiagram({ d }) {
  const direct = d.owned === 'direct';
  const box = dim => css(`flex:none;padding:7px 12px;border-radius:8px;font-size:13px;border:1px ${dim ? 'dashed #C9C3B8' : 'solid #E3DFD6'};background:${dim ? 'transparent' : '#fff'};color:${dim ? '#8A847A' : '#1F1D1A'}`);
  const line = thick => css(`flex:1;min-width:24px;border-top:${thick ? '4px solid #2F8F86' : '1px dashed #C9C3B8'}`);
  return (
    <div data-role="own-diagram" style={css(`display:flex;flex-direction:column;gap:6px`)}>
      <div style={css(`display:flex;align-items:center;gap:6px`)}>
        <span style={box(false)}>{d.supply}</span><span style={line(direct)}></span>
        <span style={box(direct)}>{d.platform}{direct ? ' (plumbing)' : ''}</span><span style={line(true)}></span>
        <span style={box(false)}>{d.users}</span>
      </div>
      <div style={css(`font-size:12px;color:#8A847A`)}>{direct ? `The thick line is the relationship: ${d.supply.toLowerCase()} and ${d.users.toLowerCase()} are bonded directly, through ${d.platform}.` : `The thick line is the owned relationship: ${d.platform} ↔ ${d.users.toLowerCase()}. ${d.supply} are replaceable (dashed).`}</div>
    </div>
  );
}


export const SERIF = 'font-family:Newsreader,serif;font-size:16.5px;line-height:1.65;white-space:pre-wrap';

export const NAV = 'display:flex;align-items:center;gap:10px;background:none;border:none;border-radius:8px;padding:7px 8px;font-size:14px;color:#1F1D1A;text-align:left;width:100%';

export const CHIP = 'background:#FBFAF7;border:1px solid #E3DFD6;border-radius:99px;padding:7px 14px;font-size:13.5px;color:#514C44';

// A generic spark for the greeting (not Anthropic's logo).
export const Spark = () => <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <rect key={i} x="14" y="2" width="2.2" height="11" rx="1.1" fill="#D97757" transform={`rotate(${i * 30} 15 15)`} />)}</svg>;

export const ACT = 'background:none;border:none;border-radius:7px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:inherit;padding:0';


export function CompareTable({ t }) {
  return (
    <div style={css(`border:1px solid #E3DFD6;border-radius:8px;overflow:hidden;background:#fff`)}>
      <div style={css(`display:grid;grid-template-columns:${t.cols};font-size:11px;font-weight:600;color:#8A847A;padding:5px 10px;border-bottom:1px solid #EEEAE2;gap:8px`)}>
        {t.headers.map((h, i) => <span key={i}>{h.t}</span>)}
      </div>
      {t.rows.map((r, i) => (
        <div key={i} style={css(`display:grid;grid-template-columns:${t.cols};font-family:'JetBrains Mono',monospace;font-size:12px;padding:4px 10px;gap:8px;background:${r.bg || 'transparent'}`)}>
          {r.cells.map((c, j) => <span key={j} style={css(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${c.dim ? '#B58A74' : '#1F1D1A'};${c.hl ? `background:${c.hl};border-radius:4px;margin:-1px -4px;padding:1px 4px;font-weight:600` : ''}`)}>{c.t}</span>)}
        </div>
      ))}
    </div>
  );
}

// A "work it out" try: one labelled box per step, a number in each.
export function StepInputs({ steps, entered, onEnter, locked }) {
  return (
    <div data-role="steps" style={css(`display:flex;flex-direction:column;gap:10px`)}>
      {steps.map((st, i) => (
        <label key={st.id} style={css(`display:flex;flex-direction:column;gap:5px`)}>
          <span style={css(`font-size:14px;line-height:1.45`)}><span style={css(`color:#9E4B2A`)}>Step {i + 1}.</span> {st.label}</span>
          <span style={css(`display:flex;align-items:center;gap:6px`)}>
            <input data-role="step-input" inputMode="decimal" value={entered[st.id] || ''} onChange={e => onEnter(st.id, e.target.value)} readOnly={locked} placeholder="Your number" style={css(`width:160px;border:1px solid #E3C9B8;border-radius:8px;padding:8px 10px;font-size:14px;background:#fff;outline:none`)} />
            {st.unit === '%' && <span style={css(`font-size:14px;color:#716C64`)}>%</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
