// The message box, on the home screen and under a chat.
import React from 'react';
import { MicIcon } from './parts.jsx';

// The composer, in the middle of the home screen or at the bottom of a chat.
// It grows with what you type (up to max-height, then scrolls), including text filled in for you,
// like a quote from "Ask Claude about this".
export default function Composer({ V, home }) {
  React.useLayoutEffect(() => {
    const el = V.composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [V.composer, V.composerRef]);
  return (
    <div className="w-full">
      <div className="bg-surface border border-line-strong rounded-2xl pt-3 pb-2.5 pr-3 pl-4 flex flex-col gap-2.5 shadow-[0_2px_10px_rgba(0,0,0,.035)]">
        <textarea
          ref={V.composerRef}
          value={V.composer}
          onChange={V.onComposer}
          onKeyDown={V.onComposerKey}
          placeholder={
            home ? 'How can I help you today?' : V.composerPlaceholder
          }
          rows="1"
          className="border-none bg-transparent resize-none text-[15px] leading-normal outline-none min-h-6.5 max-h-40 overflow-y-auto font-[inherit]"
        ></textarea>
        <div className="flex items-center gap-2">
          <button
            aria-disabled="true"
            title="Not in this prototype"
            className="w-7.5 h-7.5 border border-line rounded-lg bg-transparent text-ink-2 text-[16px] cursor-default"
          >
            +
          </button>
          <span className="flex-1"></span>
          {home && (
            <span className="text-[13px] text-ink">
              Opus 5.5 <span className="text-muted">Prototype</span>
            </span>
          )}
          <button
            aria-disabled="true"
            title="Not in this prototype"
            className="bg-transparent border-none text-muted text-[15px] cursor-default flex"
          >
            <MicIcon />
          </button>
          <button
            onClick={V.send}
            aria-label="Send"
            className="bg-accent text-on-accent border-none rounded-[9px] w-8 h-8 text-[16px] flex-none hover:bg-accent-text"
          >
            ↑
          </button>
        </div>
      </div>
      {!home && (
        <div className="text-center text-[12px] text-muted pt-2">
          Claude is AI and can make mistakes. Please double-check responses.
        </div>
      )}
    </div>
  );
}
