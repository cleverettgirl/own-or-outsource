// Shared pieces of the interface: markdown, item lists, choice questions, icons, small diagrams, style constants.
import React from 'react';
import { css } from '../css.js';


// Claude's answers as Claude renders them: paragraphs, ## headings, - bullets, `inline code`, fenced code blocks.
// Inline markdown: `code`, **bold**, *italic*, nested in any combination (*italic with **bold***, ***both***).
// Runs of asterisks are paired the way markdown renderers do it: each closing run matches the nearest open run
// before it, taking 2 (bold) when both runs have 2, else 1 (italic). Unpaired asterisks stay as text.
const codeCss = `font-family:'JetBrains Mono',monospace;font-size:.86em;background:var(--color-sunken);border-radius:4px;padding:1px 5px`;
export function inline(t) {
  const toks = [];
  for (const m of String(t).matchAll(/`[^`]+`|\*+|[^*`]+|`/g)) {
    const x = m[0], before = t[m.index - 1] || ' ', after = t[m.index + x.length] || ' ';
    if (x[0] === '`' && x.length > 1) toks.push({ code: x.slice(1, -1) });
    else if (x[0] === '*') toks.push({ star: x.length, open: !/\s/.test(after), close: !/\s/.test(before) });
    else toks.push({ text: x });
  }
  // Each token becomes a list of nodes; matched runs wrap the nodes between them.
  const out = []; // items: { nodes } or an open star run { star, open, close, at }
  const stack = [];
  for (const tk of toks) {
    if (!tk.star) { out.push({ nodes: [tk.code != null ? <code style={css(codeCss)}>{tk.code}</code> : tk.text] }); continue; }
    let left = tk.star;
    while (left && tk.close && stack.length) {
      const op = stack[stack.length - 1], use = op.star >= 2 && left >= 2 ? 2 : 1;
      const inner = keyed(out.splice(op.at + 1).flatMap(x => x.nodes || ['*'.repeat(x.star)]));
      const node = use === 2 ? <b>{inner}</b> : <i>{inner}</i>;
      op.star -= use; left -= use;
      out.push({ nodes: [node] });
      if (!op.star) { out.splice(op.at, 1); stack.pop(); }
    }
    if (left && tk.open) { stack.push({ star: left }); out.push(stack[stack.length - 1]); stack[stack.length - 1].at = out.length - 1; }
    else if (left) out.push({ nodes: ['*'.repeat(left)] });
  }
  return keyed(out.flatMap(x => x.nodes || ['*'.repeat(x.star)]));
}
const keyed = nodes => nodes.map((n, i) => (typeof n === 'string' ? n : React.cloneElement(n, { key: i })));

// A flip-through block: views you look at one at a time (steps of a process, or versions to compare).
// Claude writes   :::flip / ## Label / markdown… / ## Label / markdown… / :::   (chat prompt, src/prompts.js).
// Each view is ordinary markdown, so tables and code work inside. While it streams, an unclosed block is shown
// as far as it has got. Fewer than two views isn't a flip-through, so it renders as plain markdown.
function splitFlips(text) {
  const out = []; let buf = [], flip = null;
  for (const l of String(text).split('\n')) {
    if (!flip && /^:::flip\b/.test(l.trim())) { out.push({ md: buf.join('\n') }); buf = []; flip = []; continue; }
    if (flip && /^:::\s*$/.test(l.trim())) { out.push({ flip: flip.join('\n') }); flip = null; continue; }
    (flip || buf).push(l);
  }
  if (flip) out.push({ flip: flip.join('\n') });
  out.push({ md: buf.join('\n') });
  return out.filter(x => (x.md != null ? x.md.trim() : x.flip.trim()));
}
function Flip({ text, small }) {
  const views = text.split(/^## /m).map(v => v.trim()).filter(Boolean).map(v => { const nl = v.indexOf('\n'); return nl < 0 ? { label: v, body: '' } : { label: v.slice(0, nl).trim(), body: v.slice(nl + 1) }; });
  const [at, setAt] = React.useState(0);
  if (views.length < 2) return <MdBlocks text={text.replace(/^## /gm, '### ')} small={small} />;
  const i = Math.min(at, views.length - 1), nav = `background:none;border:1px solid var(--color-line-strong);border-radius:8px;padding:5px 11px;font-size:12.5px;color:var(--color-ink-2)`;
  return (
    <div data-role="flip" style={css(`border:1px solid var(--color-line);border-radius:12px;background:var(--color-surface);overflow:hidden`)}>
      <div style={css(`display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--color-line-soft);background:var(--color-surface-2)`)}>
        {views.map((v, j) => <button key={j} onClick={() => setAt(j)} aria-pressed={j === i} style={css(`border-radius:99px;padding:4px 11px;font-size:12.5px;border:1px solid ${j === i ? 'var(--color-accent)' : 'var(--color-line)'};background:${j === i ? 'var(--color-accent)' : 'var(--color-surface)'};color:${j === i ? 'var(--color-surface)' : 'var(--color-ink-2)'}`)}>{inline(v.label)}</button>)}
      </div>
      <div style={css(`padding:14px 16px`)}><MdBlocks text={views[i].body} small={small} /></div>
      <div style={css(`display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-top:1px solid var(--color-line-soft)`)}>
        <button onClick={() => setAt(i - 1)} disabled={i === 0} style={css(nav + (i === 0 ? ';opacity:.4' : ''))}>← Back</button>
        <span style={css(`font-size:12px;color:var(--color-muted)`)}>{i + 1} of {views.length}</span>
        <button onClick={() => setAt(i + 1)} disabled={i === views.length - 1} data-role="flip-next" style={css(nav + (i === views.length - 1 ? ';opacity:.4' : ''))}>Next →</button>
      </div>
    </div>
  );
}

export function Md({ text, small }) {
  const parts = splitFlips(text);
  if (parts.length === 1 && parts[0].md != null) return <MdBlocks text={parts[0].md} small={small} />;
  return <div style={css(`display:flex;flex-direction:column;gap:12px`)}>{parts.map((p, i) => (p.flip != null ? <Flip key={i} text={p.flip} small={small} /> : <MdBlocks key={i} text={p.md} small={small} />))}</div>;
}

// Markdown doesn't need blank lines between a heading, a list, a table and a paragraph, and Claude often leaves them
// out ("## Where to start\n1. …\n2. …"). This puts a blank line wherever the kind of line changes, so each becomes
// its own block. A list item's indented continuation line joins the item.
function separate(text) {
  const kind = l => (/^#{1,6} /.test(l) ? 'h' : /^\d+\. /.test(l) ? 'ol' : /^[-*] /.test(l) ? 'ul' : /^\s*\|/.test(l) ? 'tb' : /^(-{3,}|\*{3,}|_{3,})$/.test(l.trim()) ? 'hr' : !l.trim() ? '' : 'p');
  const out = []; let prev = '';
  for (const l of String(text).split('\n')) {
    const k = kind(l);
    if (k === 'p' && /^\s+\S/.test(l) && (prev === 'ol' || prev === 'ul')) { out[out.length - 1] += ' ' + l.trim(); continue; }
    if (k && prev && (k !== prev || k === 'h' || k === 'hr')) out.push('');
    out.push(l); prev = k;
  }
  return out.join('\n');
}

function MdBlocks({ text, small }) {
  const body = small ? 'font-family:Newsreader,serif;font-size:14.5px;line-height:1.55;white-space:pre-wrap' : SERIF;
  const parts = text.split(/```(\w*)\n([\s\S]*?)```/);
  const out = [];
  for (let i = 0; i < parts.length; i += 3) {
    separate(parts[i]).split(/\n{2,}/).map(b => b.trim()).filter(Boolean).forEach((b, j) => {
      const key = `${i}-${j}`;
      const tb = mdTable(b, small, key);
      if (tb) out.push(...tb);
      else if (/^(-{3,}|\*{3,}|_{3,})$/.test(b)) out.push(<hr key={key} style={css(`border:none;border-top:1px solid var(--color-line);margin:4px 0;width:100%`)} />);
      else if (/^#{1,3} /.test(b)) out.push(<div key={key} style={css(`font-family:Newsreader,serif;font-size:${small ? '15.5px' : '18.5px'};font-weight:600;margin-top:4px`)}>{inline(b.replace(/^#{1,3} /, ''))}</div>);
      else if (b.split('\n').every(l => /^\d+\. /.test(l))) out.push(<ol key={key} style={css(`margin:0;padding-left:24px;display:flex;flex-direction:column;gap:6px;font-family:Newsreader,serif;font-size:${small ? '14.5px' : '16.5px'};line-height:1.6`)}>{b.split('\n').map((l, k) => <li key={k}>{inline(l.replace(/^\d+\. /, ''))}</li>)}</ol>);
      else if (b.split('\n').every(l => /^[-*] /.test(l))) out.push(<ul key={key} style={css(`margin:0;padding-left:22px;display:flex;flex-direction:column;gap:6px;font-family:Newsreader,serif;font-size:${small ? '14.5px' : '16.5px'};line-height:1.6`)}>{b.split('\n').map((l, k) => <li key={k}>{inline(l.slice(2))}</li>)}</ul>);
      else out.push(<div key={key} style={css(body)}>{inline(b)}</div>);
    });
    if (parts[i + 2] != null) out.push(
      <div key={`c${i}`} style={css(`background:var(--color-surface-2);border:1px solid var(--color-line);border-radius:10px;overflow:hidden`)}>
        <div style={css(`padding:6px 12px;border-bottom:1px solid var(--color-line-soft);font-size:11px;color:var(--color-muted)`)}>{parts[i + 1] || 'code'}</div>
        <pre style={css(`margin:0;padding:14px 16px;font-family:'JetBrains Mono',monospace;font-size:${small ? '12px' : '13px'};line-height:1.6;overflow:auto;white-space:pre`)}>{parts[i + 2].replace(/\n$/, '')}</pre>
      </div>);
  }
  return <div style={css(`display:flex;flex-direction:column;gap:12px`)}>{out}</div>;
}


// A GitHub-style table (| a | b | rows under a |---| line), styled like the panel's Compare tables. Lines before it
// in the same block (e.g. "Here are the rows:") stay a paragraph. Returns null when the block has no table.
const cellsOf = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
function mdTable(b, small, key) {
  const lines = b.split('\n'), sep = lines.findIndex(l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-'));
  if (sep < 1 || !lines[sep - 1].includes('|') || !lines.slice(sep - 1).every(l => l.includes('|'))) return null;
  const head = cellsOf(lines[sep - 1]), rows = lines.slice(sep + 1).map(cellsOf), before = lines.slice(0, sep - 1).join('\n').trim();
  const cell = `padding:5px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--color-line-soft)`;
  return [
    before && <div key={key + 'p'} style={css(small ? 'font-family:Newsreader,serif;font-size:14.5px;line-height:1.55' : SERIF)}>{inline(before)}</div>,
    <div key={key} data-role="md-table" style={css(`border:1px solid var(--color-line);border-radius:8px;overflow:auto;background:var(--color-surface)`)}>
      <table style={css(`border-collapse:collapse;width:100%;font-size:${small ? '12px' : '13px'};line-height:1.45`)}>
        <thead><tr>{head.map((h, i) => <th key={i} style={css(cell + `;font-size:11px;font-weight:600;color:var(--color-muted)`)}>{inline(h)}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{head.map((_, j) => <td key={j} style={css(cell + (i === rows.length - 1 ? ';border-bottom:none' : ''))}>{inline(r[j] || '')}</td>)}</tr>)}</tbody>
      </table>
    </div>,
  ].filter(Boolean);
}

// What a check looked at, item by item: ✓ or ✗, with the idea you came to own marked.
export function ItemList({ items, ownedNote = '', title }) {
  return (
    <div data-role="items" title={title} style={css(`display:flex;flex-direction:column;gap:4px`)}>
      {items.map((it, i) => (
        <div key={i} style={css(`display:flex;gap:8px;align-items:baseline;font-size:13.5px;line-height:1.45;color:${it.ok ? 'var(--color-ink)' : it.unchecked ? 'var(--color-muted)' : 'var(--color-accent-text)'}`)}>
          <span style={css(`flex:none;width:14px;color:${it.ok ? 'var(--color-good)' : it.unchecked ? 'var(--color-faint)' : 'var(--color-accent)'}`)}>{it.ok ? '✓' : it.unchecked ? '–' : '✗'}</span>
          <span>{it.short}{it.blank ? <span style={css(`color:var(--color-muted)`)}> (left blank)</span> : null}{it.unchecked ? <span style={css(`color:var(--color-muted)`)}> (not checked: it didn't run)</span> : null}{it.judged ? <span style={css(`color:var(--color-muted)`)}> (judged by Claude)</span> : null}{it.owned && ownedNote ? <span style={css(`font-size:12px;color:var(--color-muted)`)}> · {ownedNote}</span> : null}</span>
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
          <div style={css(`font-size:14px;line-height:1.45`)}><span style={css(`color:var(--color-accent-text)`)}>{i + 1}.</span> {inline(q.prompt)}</div>
          {shuffled(q).map(o => {
            const on = picked[q.id] === o.v;
            return <button key={o.v} disabled={locked} onClick={() => onPick(q.id, o.v)} style={css(`text-align:left;border:1px solid ${on ? 'var(--color-accent)' : 'var(--color-accent-border)'};background:${on ? 'var(--color-accent-soft)' : 'var(--color-surface)'};color:var(--color-ink);border-radius:9px;padding:8px 12px;font-size:13.5px;line-height:1.4`)} className={locked ? '' : 'hv3'}>{on ? '● ' : '○ '}{inline(o.l)}</button>;
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
  Customize: <svg {...ico}><path d="M2.5 5h11M2.5 11h11" /><circle cx="6" cy="5" r="1.5" fill="var(--color-sidebar)" /><circle cx="10" cy="11" r="1.5" fill="var(--color-sidebar)" /></svg>,
};

// Placeholder for the Own-it entry point (an open book); the designer will choose the final icon.
export const OwnIcon = () => <svg {...ico}><path d="M8 4.2C6.6 3.2 4.6 2.8 2.5 3v9.3c2.1-.2 4.1.2 5.5 1.2 1.4-1 3.4-1.4 5.5-1.2V3c-2.1-.2-4.1.2-5.5 1.2z" /><path d="M8 4.2v9.3" /></svg>;


// Who holds the relationship: platform owns users (supply is replaceable), or supply and users bond directly.
export function OwnDiagram({ d }) {
  const direct = d.owned === 'direct';
  const box = dim => css(`flex:none;padding:7px 12px;border-radius:8px;font-size:13px;border:1px ${dim ? 'dashed var(--color-faint)' : 'solid var(--color-line)'};background:${dim ? 'transparent' : 'var(--color-surface)'};color:${dim ? 'var(--color-muted)' : 'var(--color-ink)'}`);
  const line = thick => css(`flex:1;min-width:24px;border-top:${thick ? '4px solid var(--color-good)' : '1px dashed var(--color-faint)'}`);
  return (
    <div data-role="own-diagram" style={css(`display:flex;flex-direction:column;gap:6px`)}>
      <div style={css(`display:flex;align-items:center;gap:6px`)}>
        <span style={box(false)}>{d.supply}</span><span style={line(direct)}></span>
        <span style={box(direct)}>{d.platform}{direct ? ' (plumbing)' : ''}</span><span style={line(true)}></span>
        <span style={box(false)}>{d.users}</span>
      </div>
      <div style={css(`font-size:12px;color:var(--color-muted)`)}>{direct ? `The thick line is the relationship: ${d.supply.toLowerCase()} and ${d.users.toLowerCase()} are bonded directly, through ${d.platform}.` : `The thick line is the owned relationship: ${d.platform} ↔ ${d.users.toLowerCase()}. ${d.supply} are replaceable (dashed).`}</div>
    </div>
  );
}


export const SERIF = 'font-family:Newsreader,serif;font-size:16.5px;line-height:1.65;white-space:pre-wrap';

export const NAV = 'display:flex;align-items:center;gap:10px;background:none;border:none;border-radius:8px;padding:7px 8px;font-size:14px;color:var(--color-ink);text-align:left;width:100%';

export const CHIP = 'background:var(--color-surface-2);border:1px solid var(--color-line);border-radius:99px;padding:7px 14px;font-size:13.5px;color:var(--color-ink-2)';

// A generic spark for the greeting (not Anthropic's logo).
export const Spark = () => <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <rect key={i} x="14" y="2" width="2.2" height="11" rx="1.1" fill="var(--color-accent)" transform={`rotate(${i * 30} 15 15)`} />)}</svg>;

export const ACT = 'background:none;border:none;border-radius:7px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:inherit;padding:0';


export function CompareTable({ t }) {
  return (
    <div style={css(`border:1px solid var(--color-line);border-radius:8px;overflow:hidden;background:var(--color-surface)`)}>
      <div style={css(`display:grid;grid-template-columns:${t.cols};font-size:11px;font-weight:600;color:var(--color-muted);padding:5px 10px;border-bottom:1px solid var(--color-line-soft);gap:8px`)}>
        {t.headers.map((h, i) => <span key={i}>{h.t}</span>)}
      </div>
      {t.rows.map((r, i) => (
        <div key={i} style={css(`display:grid;grid-template-columns:${t.cols};font-family:'JetBrains Mono',monospace;font-size:12px;padding:4px 10px;gap:8px;background:${r.bg || 'transparent'}`)}>
          {r.cells.map((c, j) => <span key={j} style={css(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${c.dim ? 'var(--color-accent-mid)' : 'var(--color-ink)'};${c.hl ? `background:${c.hl};border-radius:4px;margin:-1px -4px;padding:1px 4px;font-weight:600` : ''}`)}>{c.t}</span>)}
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
          <span style={css(`font-size:14px;line-height:1.45`)}><span style={css(`color:var(--color-accent-text)`)}>Step {i + 1}.</span> {st.label}</span>
          <span style={css(`display:flex;align-items:center;gap:6px`)}>
            <input data-role="step-input" inputMode="decimal" value={entered[st.id] || ''} onChange={e => onEnter(st.id, e.target.value)} readOnly={locked} placeholder="Your number" style={css(`width:160px;border:1px solid var(--color-accent-border);border-radius:8px;padding:8px 10px;font-size:14px;background:var(--color-surface);outline:none`)} />
            {st.unit === '%' && <span style={css(`font-size:14px;color:var(--color-muted)`)}>%</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
