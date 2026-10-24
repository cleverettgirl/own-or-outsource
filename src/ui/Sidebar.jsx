// The left sidebar: new chat, Learnings (with its recall badge), past chats.
import React from 'react';
import { css } from '../css.js';
import { NAV_ICONS, OwnIcon, NAV } from './parts.jsx';

export default function Sidebar({ V }) {
  return (
    <aside style={css(`width:260px;flex:none;background:#F3F1EC;border-right:1px solid #E3DFD6;display:flex;flex-direction:column;padding:16px 12px;gap:18px;overflow:auto`)}>
      <div style={css(`display:flex;align-items:center;justify-content:space-between;padding:0 6px`)}>
        <span style={css(`font-family:Newsreader,serif;font-size:23px;letter-spacing:-.01em`)}>Claude</span>
        <span style={css(`width:18px;height:14px;border:1.4px solid #8A847A;border-radius:3px`)}></span>
      </div>
      <div style={css(`display:flex;background:#E7E3DA;border-radius:10px;padding:3px`)}>
        <span style={css(`flex:1;text-align:center;background:#fff;border-radius:8px;padding:6px 0;font-size:13.5px;box-shadow:0 1px 2px rgba(0,0,0,.08)`)}>Chat</span>
        <span title="Not in this prototype" style={css(`flex:1;text-align:center;padding:6px 0;font-size:13.5px;color:#716C64`)}>Code</span>
      </div>
      <nav style={css(`display:flex;flex-direction:column;gap:1px`)}>
        <button onClick={V.newChat} style={css(NAV)} className="hv1"><span style={css(`width:18px;text-align:center`)}>+</span>New chat</button>
        <button onClick={V.openLearnings} data-role="nav-learnings" style={css(NAV + `;background:${V.isLearnings ? '#E4DFD4' : 'none'}`)} className="hv1"><span style={css(`width:18px;display:flex;justify-content:center;color:#C4613A`)}><OwnIcon /></span>Learnings{V.dueCount > 0 ? <span data-role="recall-badge" title={`${V.dueCount} ready to recall`} aria-label={`${V.dueCount} to recall`} style={css(`margin-left:auto;font-size:11px;background:#C4613A;color:#fff;border-radius:99px;padding:1px 7px;display:flex;align-items:center;gap:4px;white-space:nowrap;flex:none`)}><span style={css(`width:5px;height:5px;border-radius:50%;background:#fff`)}></span>{V.dueCount}</span> : V.ownedCount > 0 && <span style={css(`margin-left:auto;font-size:11px;background:#F1E3D8;color:#9E4B2A;border-radius:99px;padding:1px 7px`)}>{V.ownedCount}</span>}</button>
        {['Search', 'Projects', 'Artifacts', 'Customize'].map(l => <span key={l} title="Not in this prototype" style={css(NAV + `;color:#716C64;cursor:default`)}><span style={css(`width:18px;display:flex;justify-content:center;color:#8A847A`)}>{NAV_ICONS[l]}</span>{l}</span>)}
      </nav>
      <div style={css(`display:flex;flex-direction:column;gap:1px`)}>
        <div style={css(`font-size:13px;color:#716C64;padding:0 8px 6px`)}>Chats</div>
        {V.chatList.map((c, i) => <button key={i} onClick={c.onClick} data-role="past-chat" style={css(NAV + `;font-size:13.5px;background:${c.active ? '#E4DFD4' : 'none'}`)} className="hv1"><span style={css(`width:18px;text-align:center;color:#B5AFA4;font-size:9px`)}>○</span><span style={css(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{c.title}</span></button>)}
      </div>
      {/* What you own lives on the Learnings page; the sidebar only signals when something is ready to recall. */}
      <div style={css(`flex:1`)}></div>
      <div style={css(`display:flex;align-items:center;gap:10px;padding:12px 6px 0;border-top:1px solid #E3DFD6`)}>
        <span style={css(`width:28px;height:28px;border-radius:50%;background:#DCD6CB;display:flex;align-items:center;justify-content:center;font-size:12px;color:#514C44;flex:none`)}>P</span>
        <span style={css(`font-size:12px;color:#716C64;line-height:1.4`)}>Prototype · Own It or Outsource It</span>
      </div>
    </aside>
  );
}
