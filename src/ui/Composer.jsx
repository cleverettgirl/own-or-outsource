// The message box, on the home screen and under a chat.
import React from 'react';
import { css } from '../css.js';
import { MicIcon } from './parts.jsx';

// The composer, in the middle of the home screen or at the bottom of a chat.
export default function Composer({ V, home }) {
  return (
    <div style={css(`width:100%`)}>
      <div style={css(`background:#fff;border:1px solid ${V.composerBorder};border-radius:16px;padding:12px 12px 10px 16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 2px 10px rgba(0,0,0,.035)`)}>
        <textarea ref={V.composerRef} value={V.composer} onChange={V.onComposer} onKeyDown={V.onComposerKey} placeholder={home ? 'How can I help you today?' : V.composerPlaceholder} rows="1" style={css(`border:none;background:none;resize:none;font-size:15px;line-height:1.5;outline:none;min-height:26px;max-height:160px;font-family:inherit`)}></textarea>
        <div style={css(`display:flex;align-items:center;gap:8px`)}>
          <button aria-disabled="true" title="Not in this prototype" style={css(`width:30px;height:30px;border:1px solid #E3DFD6;border-radius:8px;background:none;color:#514C44;font-size:16px;cursor:default`)}>+</button>
          <span style={css(`flex:1`)}></span>
          {home && <span style={css(`font-size:13px;color:#1F1D1A`)}>Opus 5.5 <span style={css(`color:#8A847A`)}>Prototype</span></span>}
          <button aria-disabled="true" title="Not in this prototype" style={css(`background:none;border:none;color:#716C64;font-size:15px;cursor:default;display:flex`)}><MicIcon /></button>
          <button onClick={V.send} aria-label="Send" style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;width:32px;height:32px;font-size:16px;flex:none`)} className="hv9">↑</button>
        </div>
      </div>
      {!home && <div style={css(`text-align:center;font-size:12px;color:#9A948A;padding-top:8px`)}>Claude is AI and can make mistakes. Please double-check responses.</div>}
    </div>
  );
}
