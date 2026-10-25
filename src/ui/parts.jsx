// Shared pieces of the interface: markdown, item lists, choice questions, icons, small diagrams, style constants.
import React from 'react';


// Claude's answers as Claude renders them: paragraphs, ## headings, - bullets, `inline code`, fenced code blocks.
// Inline markdown: `code`, **bold**, *italic*, nested in any combination (*italic with **bold***, ***both***).
// Runs of asterisks are paired the way markdown renderers do it: each closing run matches the nearest open run
// before it, taking 2 (bold) when both runs have 2, else 1 (italic). Unpaired asterisks stay as text.
const CODE = 'font-mono text-[.86em] bg-sunken rounded-sm py-px px-[5px]';
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
    if (!tk.star) { out.push({ nodes: [tk.code != null ? <code className={CODE}>{tk.code}</code> : tk.text] }); continue; }
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
  const i = Math.min(at, views.length - 1), nav = 'bg-transparent border border-line-strong rounded-lg py-[5px] px-[11px] text-[12.5px] text-ink-2 disabled:opacity-40';
  return (
    <div data-role="flip" className="border border-line rounded-xl bg-surface overflow-hidden">
      <div className="flex gap-1.5 flex-wrap py-2.5 px-3 border-b border-line-soft bg-surface-2">
        {views.map((v, j) => <button key={j} onClick={() => setAt(j)} aria-pressed={j === i} className={`rounded-full py-1 px-[11px] text-[12.5px] border ${j === i ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink-2'}`}>{inline(v.label)}</button>)}
      </div>
      <div className="py-3.5 px-4"><MdBlocks text={views[i].body} small={small} /></div>
      <div className="flex justify-between items-center py-2 px-3 border-t border-line-soft">
        <button onClick={() => setAt(i - 1)} disabled={i === 0} className={nav}>← Back</button>
        <span className="text-[12px] text-muted">{i + 1} of {views.length}</span>
        <button onClick={() => setAt(i + 1)} disabled={i === views.length - 1} data-role="flip-next" className={nav}>Next →</button>
      </div>
    </div>
  );
}

export function Md({ text, small }) {
  const parts = splitFlips(text);
  if (parts.length === 1 && parts[0].md != null) return <MdBlocks text={parts[0].md} small={small} />;
  return <div className="flex flex-col gap-3">{parts.map((p, i) => (p.flip != null ? <Flip key={i} text={p.flip} small={small} /> : <MdBlocks key={i} text={p.md} small={small} />))}</div>;
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
  const body = small ? 'font-serif text-[14.5px] leading-[1.55] whitespace-pre-wrap' : SERIF;
  const parts = text.split(/```(\w*)\n([\s\S]*?)```/);
  const out = [];
  for (let i = 0; i < parts.length; i += 3) {
    separate(parts[i]).split(/\n{2,}/).map(b => b.trim()).filter(Boolean).forEach((b, j) => {
      const key = `${i}-${j}`;
      const tb = mdTable(b, small, key);
      if (tb) out.push(...tb);
      else if (/^(-{3,}|\*{3,}|_{3,})$/.test(b)) out.push(<hr key={key} className="border-0 border-t border-line my-1 mx-0 w-full" />);
      else if (/^#{1,3} /.test(b)) out.push(<div key={key} className={`font-serif font-semibold mt-1 ${small ? 'text-[15.5px]' : 'text-[18.5px]'}`}>{inline(b.replace(/^#{1,3} /, ''))}</div>);
      else if (b.split('\n').every(l => /^\d+\. /.test(l))) out.push(<ol key={key} className={`m-0 pl-6 flex flex-col gap-1.5 font-serif leading-[1.6] ${small ? 'text-[14.5px]' : 'text-[16.5px]'}`}>{b.split('\n').map((l, k) => <li key={k}>{inline(l.replace(/^\d+\. /, ''))}</li>)}</ol>);
      else if (b.split('\n').every(l => /^[-*] /.test(l))) out.push(<ul key={key} className={`m-0 pl-5.5 flex flex-col gap-1.5 font-serif leading-[1.6] ${small ? 'text-[14.5px]' : 'text-[16.5px]'}`}>{b.split('\n').map((l, k) => <li key={k}>{inline(l.slice(2))}</li>)}</ul>);
      else out.push(<div key={key} className={body}>{inline(b)}</div>);
    });
    if (parts[i + 2] != null) out.push(
      <div key={`c${i}`} className="bg-surface-2 border border-line rounded-[10px] overflow-hidden">
        <div className="py-1.5 px-3 border-b border-line-soft text-[11px] text-muted">{parts[i + 1] || 'code'}</div>
        <pre className={`m-0 py-3.5 px-4 font-mono leading-[1.6] overflow-auto whitespace-pre ${small ? 'text-[12px]' : 'text-[13px]'}`}>{parts[i + 2].replace(/\n$/, '')}</pre>
      </div>);
  }
  return <div className="flex flex-col gap-3">{out}</div>;
}


// A GitHub-style table (| a | b | rows under a |---| line), styled like the panel's Compare tables. Lines before it
// in the same block (e.g. "Here are the rows:") stay a paragraph. Returns null when the block has no table.
const cellsOf = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
function mdTable(b, small, key) {
  const lines = b.split('\n'), sep = lines.findIndex(l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-'));
  if (sep < 1 || !lines[sep - 1].includes('|') || !lines.slice(sep - 1).every(l => l.includes('|'))) return null;
  const head = cellsOf(lines[sep - 1]), rows = lines.slice(sep + 1).map(cellsOf), before = lines.slice(0, sep - 1).join('\n').trim();
  const cell = 'py-[5px] px-3 text-left align-top border-line-soft';
  return [
    before && <div key={key + 'p'} className={small ? 'font-serif text-[14.5px] leading-[1.55]' : SERIF}>{inline(before)}</div>,
    <div key={key} data-role="md-table" className="border border-line rounded-lg overflow-auto bg-surface">
      <table className={`border-collapse w-full leading-[1.45] ${small ? 'text-[12px]' : 'text-[13px]'}`}>
        <thead><tr>{head.map((h, i) => <th key={i} className={`${cell} border-b text-[11px] font-semibold text-muted`}>{inline(h)}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{head.map((_, j) => <td key={j} className={`${cell} ${i === rows.length - 1 ? '' : 'border-b'}`}>{inline(r[j] || '')}</td>)}</tr>)}</tbody>
      </table>
    </div>,
  ].filter(Boolean);
}

// What a check looked at, item by item: ✓ or ✗, with the idea you came to own marked.
export function ItemList({ items, ownedNote = '', title }) {
  return (
    <div data-role="items" title={title} className="flex flex-col gap-1">
      {items.map((it, i) => (
        <div key={i} className={`flex gap-2 items-baseline text-[13.5px] leading-[1.45] ${it.ok ? 'text-ink' : it.unchecked ? 'text-muted' : 'text-accent-text'}`}>
          <span className={`flex-none w-3.5 ${it.ok ? 'text-good' : it.unchecked ? 'text-faint' : 'text-accent'}`}>{it.ok ? '✓' : it.unchecked ? '–' : '✗'}</span>
          <span>{it.short}{it.blank ? <span className="text-muted"> (left blank)</span> : null}{it.unchecked ? <span className="text-muted"> (not checked: it didn't run)</span> : null}{it.judged ? <span className="text-muted"> (judged by Claude)</span> : null}{it.owned && ownedNote ? <span className="text-[12px] text-muted"> · {ownedNote}</span> : null}</span>
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
    <div className="flex flex-col gap-3.5">
      {qs.map((q, i) => (
        <div key={q.id} data-role="choice-q" className="flex flex-col gap-1.5">
          <div className="text-[14px] leading-[1.45]"><span className="text-accent-text">{i + 1}.</span> {inline(q.prompt)}</div>
          {shuffled(q).map(o => {
            const on = picked[q.id] === o.v;
            return <button key={o.v} disabled={locked} onClick={() => onPick(q.id, o.v)} className={`text-left border text-ink rounded-[9px] py-2 px-3 text-[13.5px] leading-[1.4] ${on ? 'border-accent bg-accent-soft' : 'border-accent-border bg-surface'} ${locked ? '' : 'hover:border-accent'}`}>{on ? '● ' : '○ '}{inline(o.l)}</button>;
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
  const box = dim => `flex-none py-[7px] px-3 rounded-lg text-[13px] border ${dim ? 'border-dashed border-faint bg-transparent text-muted' : 'border-line bg-surface text-ink'}`;
  const line = thick => `flex-1 min-w-6 ${thick ? 'border-t-4 border-good' : 'border-t border-dashed border-faint'}`;
  return (
    <div data-role="own-diagram" className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className={box(false)}>{d.supply}</span><span className={line(direct)}></span>
        <span className={box(direct)}>{d.platform}{direct ? ' (plumbing)' : ''}</span><span className={line(true)}></span>
        <span className={box(false)}>{d.users}</span>
      </div>
      <div className="text-[12px] text-muted">{direct ? `The thick line is the relationship: ${d.supply.toLowerCase()} and ${d.users.toLowerCase()} are bonded directly, through ${d.platform}.` : `The thick line is the owned relationship: ${d.platform} ↔ ${d.users.toLowerCase()}. ${d.supply} are replaceable (dashed).`}</div>
    </div>
  );
}


export const SERIF = 'font-serif text-[16.5px] leading-[1.65] whitespace-pre-wrap';

// No background, size or colour here: each use sets its own (a selected row, a smaller chat title, a greyed-out
// item), so two classes for the same property never compete.
export const NAV = 'flex items-center gap-2.5 border-none rounded-lg py-[7px] px-2 text-left w-full';

export const CHIP = 'bg-surface-2 border border-line rounded-full py-[7px] px-3.5 text-[13.5px] text-ink-2';

// A generic spark for the greeting (not Anthropic's logo).
export const Spark = () => <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <rect key={i} x="14" y="2" width="2.2" height="11" rx="1.1" fill="var(--color-accent)" transform={`rotate(${i * 30} 15 15)`} />)}</svg>;

// No background or colour here: the Own it action sets its own when it's active.
export const ACT = 'border-none rounded-[7px] w-7 h-7 flex items-center justify-center p-0';


export function CompareTable({ t }) {
  return (
    <div className="border border-line rounded-lg overflow-hidden bg-surface">
      <div className="grid text-[11px] font-semibold text-muted py-[5px] px-2.5 border-b border-line-soft gap-2" style={{ gridTemplateColumns: t.cols }}>
        {t.headers.map((h, i) => <span key={i}>{h.t}</span>)}
      </div>
      {t.rows.map((r, i) => (
        <div key={i} className={`grid font-mono text-[12px] py-1 px-2.5 gap-2 ${r.bg}`} style={{ gridTemplateColumns: t.cols }}>
          {r.cells.map((c, j) => <span key={j} className={`whitespace-nowrap overflow-hidden text-ellipsis ${c.dim ? 'text-accent-mid' : 'text-ink'} ${c.hl ? `${c.hl} rounded-sm -my-px -mx-1 py-px px-1 font-semibold` : ''}`}>{c.t}</span>)}
        </div>
      ))}
    </div>
  );
}

// A "work it out" try: one labelled box per step, a number in each.
export function StepInputs({ steps, entered, onEnter, locked }) {
  return (
    <div data-role="steps" className="flex flex-col gap-2.5">
      {steps.map((st, i) => (
        <label key={st.id} className="flex flex-col gap-[5px]">
          <span className="text-[14px] leading-[1.45]"><span className="text-accent-text">Step {i + 1}.</span> {st.label}</span>
          <span className="flex items-center gap-1.5">
            <input data-role="step-input" inputMode="decimal" value={entered[st.id] || ''} onChange={e => onEnter(st.id, e.target.value)} readOnly={locked} placeholder="Your number" className="w-40 border border-accent-border rounded-lg py-2 px-2.5 text-[14px] bg-surface outline-none" />
            {st.unit === '%' && <span className="text-[14px] text-muted">%</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
