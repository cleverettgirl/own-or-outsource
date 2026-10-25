// Tailwind class strings used in more than one place. Each is a complete literal, so Tailwind's scanner sees every
// class. There's no preflight (theme.css), so a button without p-0 gets the browser's padding. Add classes on top
// of a base, never one that sets the same property as the base: which one wins depends on the stylesheet, not the
// order in the string.

export const SERIF = 'font-serif text-[16.5px] leading-[1.65] whitespace-pre-wrap';
export const BODY = 'text-[13.5px] leading-normal text-ink-2';

// No background, size or colour here: each use sets its own (a selected row, a smaller chat title, a greyed-out
// item), so two classes for the same property never compete.
export const NAV = 'flex items-center gap-2.5 border-none rounded-lg py-[7px] px-2 text-left w-full';
export const CHIP = 'bg-surface-2 border border-line rounded-full py-[7px] px-3.5 text-[13.5px] text-ink-2';
// No background or colour here: the Own it action sets its own when it's active.
export const ACT = 'border-none rounded-[7px] w-7 h-7 flex items-center justify-center p-0';

// The side panel (Own it, a go-first try, a gap check).
export const PANEL = 'w-[46%] min-w-105 max-w-190 flex-none border-l border-line bg-page flex flex-col animate-slidein';
export const PANEL_HEAD = 'flex items-center justify-between gap-3 py-4.5 px-7 border-b border-line flex-none';
export const PANEL_TITLE = 'font-serif text-[24px]';
export const PANEL_SCROLL = 'flex-1 overflow-auto pt-6 pb-8 px-7';
export const CLOSE_X = 'bg-transparent border-none text-[20px] leading-none text-muted py-1 px-1.5 rounded-md hover:bg-accent-soft';

export const BTN_DARK = 'bg-inverse text-on-inverse border-none rounded-[9px] py-[9px] px-3.5 text-[13.5px]';
export const BTN_PRIMARY = 'bg-accent text-on-accent border-none rounded-[9px] py-[9px] px-3.5 text-[13.5px]';
export const BTN_OUTLINE = 'bg-transparent border rounded-[9px] py-2 px-[13px] text-[13px]';
export const BTN_QUIET = `${BTN_OUTLINE} border-line-strong text-ink-2 hover:bg-sunken`;
export const BTN_ASK = `${BTN_OUTLINE} border-accent-border text-accent-text hover:bg-accent-soft`;
export const POPUP_BTN = 'bg-transparent text-on-inverse border-none rounded-full py-[5px] px-3 text-[13px]';

export const LINK = 'bg-transparent border-none p-0 underline underline-offset-[2px]';
export const LINK_ACCENT = `${LINK} text-[13px] text-accent-text`;
export const LINK_MUTED = `${LINK} text-[13px] text-muted`;

export const LABEL = 'text-[11px] font-semibold tracking-[.06em] text-muted';
export const LABEL_CAPS = 'text-[11px] font-semibold tracking-[.05em] uppercase';
export const LOADING = 'text-[12.5px] text-accent-text animate-blink';
export const LOADING_13 = 'text-[13px] text-accent-text animate-blink';
export const PRE = 'm-0 py-2 px-3 bg-sunken rounded-lg font-mono whitespace-pre-wrap';

export const NOTE_ROW = 'flex gap-2.5 items-start text-[13.5px] leading-normal text-ink-2';
export const MARK = 'flex-none w-4.5 h-4.5 rounded-full flex items-center justify-center text-[11px] mt-0.5';
export const OPTION = 'text-left border text-ink rounded-[9px] py-2 px-3 text-[13.5px] leading-[1.4]';
