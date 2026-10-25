// The left sidebar: new chat, Learnings (with its recall badge), past chats.
import React from 'react';
import { css } from '../css.js';
import { NAV_ICONS, OwnIcon, NAV } from './parts.jsx';

// System follows the OS setting; Light and Dark override it and are remembered on this device.
function ThemeToggle() {
  const read = () => { try { return window.localStorage.getItem('own-it:theme') || 'system'; } catch (e) { return 'system'; } };
  const [mode, setMode] = React.useState(read);
  const pick = m => {
    setMode(m);
    if (m === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = m;
    try { if (m === 'system') window.localStorage.removeItem('own-it:theme'); else window.localStorage.setItem('own-it:theme', m); } catch (e) { /* not remembered */ }
  };
  return (
    <div role="radiogroup" aria-label="Theme" data-role="theme-toggle" style={css(`display:flex;background:var(--sunken);border:1px solid var(--border);border-radius:8px;padding:2px;margin-left:auto`)}>
      {[['light', '☀', 'Light'], ['dark', '☾', 'Dark'], ['system', 'A', 'Match system']].map(([m, icon, label]) => (
        <button key={m} role="radio" aria-checked={mode === m} aria-label={label} title={label} data-theme-option={m} onClick={() => pick(m)}
          style={css(`border:none;border-radius:6px;width:24px;height:22px;font-size:12px;line-height:1;background:${mode === m ? 'var(--surface)' : 'none'};color:${mode === m ? 'var(--text)' : 'var(--muted)'};${mode === m ? 'box-shadow:0 1px 2px rgba(0,0,0,.12)' : ''}`)}>{icon}</button>
      ))}
    </div>
  );
}

export default function Sidebar({ V }) {
  return (
    // On a phone it's a drawer (mobile.css): choosing anything in it closes it.
    <aside data-role="sidebar" onClickCapture={e => { if (e.target.closest && e.target.closest('button')) V.closeNav(); }} style={css(`width:260px;flex:none;background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:16px 12px;gap:18px;overflow:auto`)}>
      <div style={css(`display:flex;align-items:center;justify-content:space-between;padding:0 6px`)}>
        <span style={css(`font-family:Newsreader,serif;font-size:23px;letter-spacing:-.01em`)}>Claude</span>
        <span style={css(`width:18px;height:14px;border:1.4px solid var(--muted);border-radius:3px`)}></span>
      </div>
      <div style={css(`display:flex;background:var(--border);border-radius:10px;padding:3px`)}>
        <span style={css(`flex:1;text-align:center;background:var(--surface);border-radius:8px;padding:6px 0;font-size:13.5px;box-shadow:0 1px 2px rgba(0,0,0,.08)`)}>Chat</span>
        <span title="Not in this prototype" style={css(`flex:1;text-align:center;padding:6px 0;font-size:13.5px;color:var(--muted)`)}>Code</span>
      </div>
      <nav style={css(`display:flex;flex-direction:column;gap:1px`)}>
        <button onClick={V.newChat} style={css(NAV)} className="hv1"><span style={css(`width:18px;text-align:center`)}>+</span>New chat</button>
        <button onClick={V.openLearnings} data-role="nav-learnings" style={css(NAV + `;background:${V.isLearnings ? 'var(--border)' : 'none'}`)} className="hv1"><span style={css(`width:18px;display:flex;justify-content:center;color:var(--accent)`)}><OwnIcon /></span>Learnings{V.dueCount > 0 ? <span data-role="recall-badge" title={`${V.dueCount} ready to recall`} aria-label={`${V.dueCount} to recall`} style={css(`margin-left:auto;font-size:11px;background:var(--accent);color:var(--on-accent);border-radius:99px;padding:1px 7px;display:flex;align-items:center;gap:4px;white-space:nowrap;flex:none`)}>{V.dueCount} due</span> : V.ownedCount > 0 && <span style={css(`margin-left:auto;font-size:11px;background:var(--accent-soft-2);color:var(--accent-text);border-radius:99px;padding:1px 7px`)}>{V.ownedCount}</span>}</button>
        {['Search', 'Projects', 'Artifacts', 'Customize'].map(l => <span key={l} title="Not in this prototype" style={css(NAV + `;color:var(--muted);cursor:default`)}><span style={css(`width:18px;display:flex;justify-content:center;color:var(--muted)`)}>{NAV_ICONS[l]}</span>{l}</span>)}
      </nav>
      <div style={css(`display:flex;flex-direction:column;gap:1px`)}>
        <div style={css(`font-size:13px;color:var(--muted);padding:0 8px 6px`)}>Chats</div>
        {V.chatList.map((c, i) => <button key={i} onClick={c.onClick} data-role="past-chat" style={css(NAV + `;font-size:13.5px;background:${c.active ? 'var(--border)' : 'none'}`)} className="hv1"><span style={css(`width:18px;text-align:center;color:var(--faint);font-size:9px`)}>○</span><span style={css(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{c.title}</span></button>)}
      </div>
      {/* What you own lives on the Learnings page; the sidebar only signals when something is ready to recall. */}
      <div style={css(`flex:1`)}></div>
      <div style={css(`display:flex;align-items:center;padding:0 8px;font-size:13px;color:var(--muted)`)}>Theme<ThemeToggle /></div>
      <div style={css(`display:flex;align-items:center;gap:10px;padding:12px 6px 0;border-top:1px solid var(--border)`)}>
        <span style={css(`width:28px;height:28px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--text-2);flex:none`)}>P</span>
        <span style={css(`font-size:12px;color:var(--muted);line-height:1.4`)}>Prototype · Own It or Outsource It</span>
      </div>
    </aside>
  );
}
