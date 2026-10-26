// The main column: home, the conversation (answers, Own it cards, go-first offers, gap chats), the composer and the highlight popup. Learnings takes its place when open.
import React from 'react';
import {
  Md,
  CopyIcon,
  SpeakIcon,
  RetryIcon,
  OwnIcon,
  Spark,
} from './parts.jsx';
import Learnings from './Learnings.jsx';
import Composer from './Composer.jsx';
import {
  SERIF,
  CHIP,
  ACT,
  BTN_PRIMARY,
  BTN_QUIET,
  POPUP_BTN,
  LINK_ACCENT,
  LABEL_CAPS,
} from './styles.js';

export default function Chat({ V }) {
  return (
    <main className="flex-1 flex flex-col min-w-0 relative phone:in-[.with-sheet]:pb-16">
      <button
        className="hidden phone:flex absolute top-2.5 left-2.5 z-[5] w-9.5 h-9.5 rounded-[10px] border border-line bg-page items-center justify-center text-[18px] text-ink-2"
        data-role="nav-toggle"
        onClick={V.openNav}
        aria-label="Open the menu"
      >
        ☰
      </button>
      {V.isLearnings ? (
        <Learnings V={V} />
      ) : (
        <>
          {!V.isEmpty && (
            <div
              data-role="chat-header"
              className="flex items-center justify-between py-3.5 px-6 phone:pl-14.5 flex-none"
            >
              <div className="flex items-center gap-1.5 text-[15px] text-ink min-w-0">
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {V.chatTitle}
                </span>
                <span className="text-muted text-[11px]">⌄</span>
              </div>
              <button
                aria-disabled="true"
                title="Not in this prototype"
                className="bg-transparent border-none text-[13.5px] text-ink-2 flex gap-1.5 items-center cursor-default"
              >
                ⇪ Share
              </button>
            </div>
          )}
          <div
            ref={V.scrollRef}
            className={`flex-1 overflow-auto pb-6 px-0 flex flex-col ${V.isEmpty ? 'pt-0' : 'pt-3'}`}
          >
            <div
              data-role="chat-col"
              className={`w-full py-0 px-7 phone:px-4 flex flex-col gap-6 ${V.isEmpty ? 'max-w-160 m-auto' : 'max-w-180 my-0 mx-auto'}`}
            >
              {!!V.isEmpty && (
                <div className="flex flex-col items-center gap-6.5 animate-[rise_.4s_ease] pb-[8vh]">
                  <h1
                    data-role="home-title"
                    className="flex items-center gap-3.5 font-serif font-normal text-[40px] phone:text-[30px] leading-[1.15] m-0 tracking-[-.01em]"
                  >
                    <Spark />
                    Back at it
                  </h1>
                  <div
                    data-role="framing"
                    className="text-[15px] text-ink-2 text-center max-w-125 leading-[1.55] -mt-3"
                  >
                    Claude's answers make things feel clear.{' '}
                    <b className="font-semibold text-accent-text">Own it</b>{' '}
                    checks whether you could do it yourself, and brings it back
                    so it sticks.
                  </div>
                  {<Composer V={V} home />}
                  <div className="flex gap-2 flex-wrap justify-center">
                    {/* Prompts, sent live. The Juno chat is a long past conversation, so it lives in the sidebar. */}
                    <button
                      onClick={V.startLead}
                      data-role="start-lead"
                      className={`${CHIP} hover:border-accent`}
                    >
                      Leadership · leading without a title
                    </button>
                    <button
                      onClick={V.startSql}
                      data-role="start-sql"
                      className={`${CHIP} hover:border-accent`}
                    >
                      SQL · revenue per customer
                    </button>
                    <button
                      onClick={V.startReact}
                      data-role="start-react"
                      className={`${CHIP} hover:border-accent`}
                    >
                      React · fetch on mount
                    </button>
                    <button
                      onClick={V.startRisk}
                      data-role="start-risk"
                      className={`${CHIP} hover:border-accent`}
                    >
                      Health · a bacon and cancer headline
                    </button>
                    <button
                      onClick={V.startPark}
                      data-role="start-park"
                      className={`${CHIP} hover:border-accent`}
                    >
                      Parenting · a meltdown leaving the park
                    </button>
                    <button
                      onClick={V.startTax}
                      data-role="start-tax"
                      className={`${CHIP} hover:border-accent`}
                    >
                      Money · a raise into a higher tax bracket
                    </button>
                  </div>
                  <div className="text-[12.5px] text-muted text-center max-w-110 leading-normal">
                    Each of these starts a new chat. Or open a past chat in the
                    sidebar, like the Juno strategy chat. Under any answer, the
                    Own it icon turns it into a try.
                  </div>
                </div>
              )}

              {V.messages.map((m, i) => (
                <React.Fragment key={i}>
                  {!!m.isUser && (
                    <div className="self-end max-w-[80%] bg-bubble rounded-2xl rounded-br-sm py-[11px] px-[15px] text-[15px] leading-normal whitespace-pre-wrap animate-[rise_.25s_ease]">
                      {m.text}
                    </div>
                  )}

                  {!!m.isThinking && (
                    <div className="flex gap-[5px] py-1.5 px-0.5">
                      <span className="w-[7px] h-[7px] rounded-full bg-muted animate-blink"></span>
                      <span className="w-[7px] h-[7px] rounded-full bg-muted animate-[blink_1.2s_.2s_infinite]"></span>
                      <span className="w-[7px] h-[7px] rounded-full bg-muted animate-[blink_1.2s_.4s_infinite]"></span>
                    </div>
                  )}

                  {!!m.isAssistant && (
                    <div
                      data-msg-id={m.id}
                      data-owning={m.owning || undefined}
                      className={`flex flex-col gap-3 animate-rise rounded-xl transition-shadow duration-300 ${m.flash ? 'shadow-[0_0_0_3px_var(--color-accent-border),0_0_0_10px_var(--color-accent-soft)]' : ''}`}
                    >
                      {!!m.hasIntro && <div className={SERIF}>{m.intro}</div>}
                      {!!m.hasCode && (
                        <div
                          onMouseUp={m.onMouseUp}
                          data-answer-body="true"
                          className="relative"
                        >
                          <Md text={m.code} />
                        </div>
                      )}
                      {!!m.hasOutro && <div className={SERIF}>{m.outro}</div>}
                      {/* Claude's action row: copy · read aloud · retry, then Own it in the same quiet style, then the time. */}
                      {!m.streaming && (
                        <div className="flex items-center gap-0.5 -mt-1 text-muted">
                          <button
                            onClick={m.onCopy}
                            aria-label="Copy"
                            title={m.copied ? 'Copied' : 'Copy'}
                            className={`${ACT} bg-transparent text-inherit hover:bg-accent-soft`}
                          >
                            {m.copied ? (
                              <span className="text-[11px]">✓</span>
                            ) : (
                              <CopyIcon />
                            )}
                          </button>
                          <button
                            onClick={m.onSpeak}
                            aria-label="Read aloud"
                            title="Read aloud"
                            className={`${ACT} bg-transparent text-inherit hover:bg-accent-soft`}
                          >
                            <SpeakIcon />
                          </button>
                          <button
                            aria-label="Retry (not in this prototype)"
                            title="Retry (not in this prototype)"
                            aria-disabled="true"
                            className={`${ACT} bg-transparent text-inherit opacity-45 cursor-default`}
                          >
                            <RetryIcon />
                          </button>
                          {!!(m.showOwnHint && m.ownExpanded) && (
                            <button
                              onClick={m.ownAll}
                              data-role="own-all"
                              data-expanded="true"
                              title="You're digging into this. Test yourself on it"
                              className="flex items-center gap-1.5 bg-accent text-on-accent border-none rounded-full py-[5px] pr-3 pl-[9px] text-[12.5px] ml-0.5 animate-[ownexpand_.35s_ease-out,_ownglow_1.6s_ease-out_.35s_2]"
                            >
                              <OwnIcon />
                              Own it · about 2 min
                            </button>
                          )}
                          {!!(m.showOwnHint && !m.ownExpanded) && (
                            <button
                              onClick={m.ownAll}
                              data-role="own-all"
                              aria-label={
                                m.ownActive
                                  ? 'Owning this response (open in the side panel)'
                                  : m.ownAllLabel
                              }
                              aria-pressed={m.ownActive}
                              aria-disabled={m.ownBlocked || undefined}
                              title={
                                m.ownActive
                                  ? 'Owning this · open in the side panel'
                                  : m.ownBlocked
                                    ? 'Close the current Own it first'
                                    : `${m.ownAllLabel} · or highlight any part`
                              }
                              className={`${ACT} ${m.ownActive ? 'bg-accent text-on-accent' : m.ownBlocked ? 'bg-transparent text-faint cursor-default' : 'bg-transparent text-accent-text hover:bg-accent-soft'}`}
                            >
                              <OwnIcon />
                            </button>
                          )}
                          {!!m.when && (
                            <span className="text-[12.5px] text-muted ml-1.5">
                              {m.when}
                            </span>
                          )}
                        </div>
                      )}
                      {!!m.checkChip && (
                        <div className="flex gap-2 -mt-0.5">
                          <button
                            onClick={m.checkChip}
                            data-role="gap-check-chip"
                            className="bg-surface border border-accent-border rounded-full py-1.5 px-[13px] text-[13px] text-accent-text hover:border-accent"
                          >
                            I think I've got it: check me
                          </button>
                        </div>
                      )}
                      {!!m.showTip && (
                        <div
                          data-role="own-tip"
                          className="self-start flex items-center gap-2.5 text-[13px] leading-[1.45] text-accent-deep bg-accent-soft border border-accent-soft-2 rounded-[10px] py-2 pr-2.5 pl-3 -mt-1 animate-rise"
                        >
                          <span className="text-accent flex">
                            <OwnIcon />
                          </span>
                          {/* Highlighting to own needs a mouse, so touch screens only hear about the icon. */}
                          <span>
                            Want to actually learn{' '}
                            <span className="pointer-coarse:hidden">
                              part of this? Highlight it, or use
                            </span>
                            <span className="hidden pointer-coarse:inline">
                              this? Use
                            </span>{' '}
                            <span className="text-accent">this icon</span> to
                            own the whole answer. You'll try it yourself and see
                            what stuck.
                          </span>
                          <button
                            onClick={V.dismissTip}
                            aria-label="Dismiss tip"
                            className="bg-transparent border-none text-accent-mid text-[15px] py-0 px-0.5"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!!m.isGoAsk && (
                    <div
                      data-role="go-ask"
                      className="flex flex-col gap-3.5 animate-rise"
                    >
                      <div className={SERIF}>
                        This one uses something you own:{' '}
                        <b>{m.ownedName || m.owned}</b>. Want to go first? Write
                        your answer, then I'll show you mine.
                      </div>
                      {m.phase === 'offer' && (
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={m.onFirst} className={BTN_PRIMARY}>
                            I'll go first
                          </button>
                          <button onClick={m.onAnswer} className={BTN_QUIET}>
                            Just answer this time
                          </button>
                        </div>
                      )}
                      {m.inPanel !== undefined &&
                        m.phase !== 'offer' &&
                        m.phase !== 'answered' && (
                          <div
                            data-role="go-pointer"
                            className="flex gap-2.5 items-center text-[13px] text-muted"
                          >
                            <span>
                              {m.phase === 'done'
                                ? "Your go is in the side panel. Here's mine:"
                                : "Your go is in the side panel. My answer waits until you've tried."}
                            </span>
                            {!m.inPanel && (
                              <button
                                onClick={m.onOpenPanel}
                                data-role="go-open"
                                className={LINK_ACCENT}
                              >
                                Open it
                              </button>
                            )}
                          </div>
                        )}
                      {m.phase === 'answered' && (
                        <div className="text-[12.5px] text-muted">
                          No problem: noted in Learnings that you let me take
                          this one.
                        </div>
                      )}
                      {m.showReply &&
                        (m.replyText ? (
                          <Md text={m.replyText} />
                        ) : (
                          <span className="text-[12.5px] text-muted animate-blink">
                            writing my answer…
                          </span>
                        ))}
                    </div>
                  )}

                  {!!m.isGo && (
                    <div
                      data-role="go-first"
                      className="flex flex-col gap-3.5 animate-rise"
                    >
                      <div className={SERIF}>
                        You own <b>{m.goOwned}</b>
                        {m.goWas ? ` (${m.goWas})` : ''}. This new question uses
                        the same idea. Want to answer it yourself first? I'll
                        check yours, then show you mine.
                      </div>
                      {m.phase === 'offer' && (
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={m.goFirst} className={BTN_PRIMARY}>
                            I'll go first
                          </button>
                          <button onClick={m.goAnswer} className={BTN_QUIET}>
                            Just answer this time
                          </button>
                        </div>
                      )}
                      {m.inPanel !== undefined &&
                        m.phase !== 'offer' &&
                        m.phase !== 'answered' && (
                          <div
                            data-role="go-pointer"
                            className="flex gap-2.5 items-center text-[13px] text-muted"
                          >
                            <span>
                              {m.phase === 'done'
                                ? "Your go is in the side panel. Here's mine:"
                                : "Your go is in the side panel. My answer waits until you've tried."}
                            </span>
                            {!m.inPanel && (
                              <button
                                onClick={m.onOpenPanel}
                                data-role="go-open"
                                className={LINK_ACCENT}
                              >
                                Open it
                              </button>
                            )}
                          </div>
                        )}
                      {(m.phase === 'done' || m.phase === 'answered') && (
                        <div className="flex flex-col gap-3 animate-rise">
                          {m.phase === 'answered' && (
                            <div className="text-[12.5px] text-muted">
                              No problem: noted in Learnings that you let me
                              take this one.
                            </div>
                          )}
                          {!!m.go.answer.intro && (
                            <div className={SERIF}>{m.go.answer.intro}</div>
                          )}
                          {m.go.prose ? (
                            <div className={SERIF}>{m.go.answer.code}</div>
                          ) : (
                            <pre className="m-0 py-3.5 px-4 bg-surface-2 border border-line rounded-[10px] font-mono text-[13px] leading-[1.6] whitespace-pre">
                              {m.go.answer.code}
                            </pre>
                          )}
                          {!!m.go.answer.outro && (
                            <div className={SERIF}>{m.go.answer.outro}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!!m.isGapBanner && (
                    <div
                      data-role="gap-banner"
                      className={`flex gap-3 items-center border-l-[3px] py-1 pr-0 pl-3 ${m.gapClosed ? 'border-good' : 'border-accent-mid'}`}
                    >
                      <div className="flex flex-col gap-[3px] min-w-0">
                        <div
                          className={`${LABEL_CAPS} ${m.gapClosed ? 'text-good-text' : 'text-accent-text'}`}
                        >
                          {m.gapClosed ? '✓ Gap closed' : 'Closing a gap'}
                        </div>
                        <div className="text-[14.5px] text-ink">
                          {m.gap.topic}
                        </div>
                        <div className="text-[12px] text-muted">
                          {m.gapClosed
                            ? "It's now something you own. It comes back for recall in 3 days."
                            : `Found ${m.gap.origin}. Talk it through with Claude; check yourself whenever you're ready.`}
                        </div>
                      </div>
                    </div>
                  )}

                  {!!m.isGapCheck && (
                    <div
                      data-role="gap-check-pointer"
                      className="flex gap-2.5 items-center text-[13px] text-muted flex-wrap"
                    >
                      {m.phase === 'done' ? (
                        <span
                          className={`${m.result.closed ? 'text-good-text' : 'text-accent-text'}`}
                        >
                          {m.result.closed
                            ? '✓ Gap closed. It comes back for recall in 3 days.'
                            : 'Not closed yet. Keep talking it through, then check again.'}
                        </span>
                      ) : (
                        <span>Your check is in the side panel.</span>
                      )}
                      {!m.inPanel && (
                        <button
                          onClick={m.onOpenPanel}
                          data-role="gap-open"
                          className={LINK_ACCENT}
                        >
                          {m.phase === 'done' ? 'See the check' : 'Open it'}
                        </button>
                      )}
                    </div>
                  )}

                  {m.type === 'gap' && (
                    <div className="self-center text-[12px] text-muted italic border-t border-dashed border-line-strong border-b border-dashed border-line-strong py-1.5 px-3.5">
                      {m.text}
                    </div>
                  )}

                  {!!m.isOwnDone && (
                    <div className="border border-line rounded-xl py-3 px-4 text-[13px] text-ink-2 flex gap-3 items-center bg-surface-2">
                      <span className="font-serif text-[15px] text-ink">
                        {m.doneLabel || 'Owned'}
                      </span>
                      <span>{m.summary}</span>
                    </div>
                  )}

                  {!!m.isOwn && (
                    <button
                      onClick={V.focusPanel}
                      data-role="own-chip"
                      className="self-start flex items-center gap-3 text-left border border-accent-border bg-accent-soft rounded-xl py-2.5 pr-4 pl-3 hover:border-accent"
                    >
                      <span className="w-8.5 h-8.5 rounded-lg bg-accent text-on-accent flex items-center justify-center font-serif text-[18px] flex-none">
                        O
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[14px] text-ink">
                          Own it · {V.ownTitle}
                        </span>
                        <span className="text-[12px] text-muted">
                          {V.ownPhaseLabel} · In the side panel
                        </span>
                      </span>
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {!V.isEmpty && (
            <div className="pt-2 pb-3 px-7 flex-none">
              <div className="max-w-180 mx-auto">
                {<Composer V={V} home={false} />}
              </div>
            </div>
          )}
        </>
      )}
      {!!V.hasSel && (
        <div
          id="own-sel"
          className="fixed -translate-x-1/2 -translate-y-[110%] flex bg-inverse rounded-full p-[3px] gap-0.5 shadow-[0_4px_14px_rgba(0,0,0,.18)] z-[20] animate-[rise_.15s_ease]"
          style={{ left: V.selX, top: V.selY }}
        >
          <button
            onClick={V.askSelection}
            data-role="ask-sel"
            title="Quote this into the chat and ask about it"
            className={POPUP_BTN}
          >
            Ask Claude
          </button>
          <span className="w-[1px] bg-ink-2 my-[5px]"></span>
          <button
            id="own-sel-btn"
            onClick={V.ownSelection}
            title="Test yourself on this"
            className={POPUP_BTN}
          >
            Own it
          </button>
        </div>
      )}
    </main>
  );
}
