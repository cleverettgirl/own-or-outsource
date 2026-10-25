// The main column: home, the conversation (answers, Own it cards, go-first offers, gap chats), the composer and the highlight popup. Learnings takes its place when open.
import React from 'react';
import { css } from '../css.js';
import { Md, ItemList, ChoiceQuestions, CopyIcon, SpeakIcon, RetryIcon, OwnIcon, SERIF, CHIP, Spark, ACT } from './parts.jsx';
import Learnings from './Learnings.jsx';
import Composer from './Composer.jsx';

export default function Chat({ V }) {
  return (
    <main style={css(`flex:1;display:flex;flex-direction:column;min-width:0;position:relative`)}>
      <button className="nav-toggle mobile-only" data-role="nav-toggle" onClick={V.openNav} aria-label="Open the menu">☰</button>
      {V.isLearnings ? <Learnings V={V} /> : (<>
      {!V.isEmpty && (
        <div data-role="chat-header" style={css(`display:flex;align-items:center;justify-content:space-between;padding:14px 24px;flex:none`)}>
          <div style={css(`display:flex;align-items:center;gap:6px;font-size:15px;color:#1F1D1A;min-width:0`)}><span style={css(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{V.chatTitle}</span><span style={css(`color:#8A847A;font-size:11px`)}>⌄</span></div>
          <button aria-disabled="true" title="Not in this prototype" style={css(`background:none;border:none;font-size:13.5px;color:#514C44;display:flex;gap:6px;align-items:center;cursor:default`)}>⇪ Share</button>
        </div>
      )}
      <div ref={V.scrollRef} style={css(`flex:1;overflow:auto;padding:${V.isEmpty ? '0' : '12px'} 0 24px;display:flex;flex-direction:column`)}>
        <div data-role="chat-col" style={css(`width:100%;max-width:${V.isEmpty ? '640px' : '720px'};margin:${V.isEmpty ? 'auto' : '0 auto'};padding:0 28px;display:flex;flex-direction:column;gap:24px`)}>

          {!!(V.isEmpty) && (
            <div style={css(`display:flex;flex-direction:column;align-items:center;gap:26px;animation:rise .4s ease;padding-bottom:8vh`)}>
              <h1 data-role="home-title" style={css(`display:flex;align-items:center;gap:14px;font-family:Newsreader,serif;font-weight:400;font-size:40px;line-height:1.15;margin:0;letter-spacing:-.01em`)}><Spark />Back at it</h1>
              <div data-role="framing" style={css(`font-size:15px;color:#514C44;text-align:center;max-width:500px;line-height:1.55;margin-top:-12px`)}>Claude's answers make things feel clear. <b style={css(`font-weight:600;color:#9E4B2A`)}>Own it</b> checks whether you could do it yourself, and brings it back so it sticks.</div>
              {<Composer V={V} home />}
              <div style={css(`display:flex;gap:8px;flex-wrap:wrap;justify-content:center`)}>
                {/* Prompts, sent live. The Juno chat is a long past conversation, so it lives in the sidebar. */}
                <button onClick={V.startLead} data-role="start-lead" style={css(CHIP)} className="hv3">Leadership · leading without a title</button>
                <button onClick={V.startSql} data-role="start-sql" style={css(CHIP)} className="hv3">SQL · revenue per customer</button>
                <button onClick={V.startReact} data-role="start-react" style={css(CHIP)} className="hv3">React · fetch on mount</button>
                <button onClick={V.startRisk} data-role="start-risk" style={css(CHIP)} className="hv3">Health · a bacon and cancer headline</button>
              </div>
              <div style={css(`font-size:12.5px;color:#9A948A;text-align:center;max-width:440px;line-height:1.5`)}>Ask anything, or open a past chat like the Juno strategy chat. Under any answer, the Own it icon turns it into a try.</div>
            </div>
          )}

          {(V.messages || []).map((m, _i) => (<React.Fragment key={_i}>

            {!!(m.isUser) && (<>
              <div style={css(`align-self:flex-end;max-width:80%;background:#E9E4DA;border-radius:16px 16px 4px 16px;padding:11px 15px;font-size:15px;line-height:1.5;white-space:pre-wrap;animation:rise .25s ease`)}>{m.text}</div>
            </>)}

            {!!(m.isThinking) && (<>
              <div style={css(`display:flex;gap:5px;padding:6px 2px`)}><span style={css(`width:7px;height:7px;border-radius:50%;background:#8A847A;animation:pulse 1.2s infinite`)}></span><span style={css(`width:7px;height:7px;border-radius:50%;background:#8A847A;animation:pulse 1.2s .2s infinite`)}></span><span style={css(`width:7px;height:7px;border-radius:50%;background:#8A847A;animation:pulse 1.2s .4s infinite`)}></span></div>
            </>)}

            {!!(m.isAssistant) && (<>
              <div data-msg-id={m.id} data-owning={m.owning || undefined} style={css(`display:flex;flex-direction:column;gap:12px;animation:rise .3s ease;border-radius:12px;transition:box-shadow .3s;${m.flash ? 'box-shadow:0 0 0 3px #F0C9B4,0 0 0 10px #FFF5EE' : ''}`)}>
                {!!(m.hasIntro) && (<><div style={css(SERIF)}>{m.intro}</div></>)}
                {!!(m.hasCode) && (<>
                  <div onMouseUp={m.onMouseUp} style={css(m.plain ? `position:relative` : `position:relative;background:#FBFAF7;border:1px solid #E3DFD6;border-radius:10px;overflow:hidden`)}>
                    {!m.plain && <div style={css(`display:flex;justify-content:space-between;align-items:center;padding:6px 12px;border-bottom:1px solid #EEEAE2;font-size:11px;color:#8A847A`)}><span>{m.lang}</span></div>}
                    {!!(m.isMd) && <Md text={m.code} />}
                    {!!(m.isCodeBlock) && (<><pre style={css(`margin:0;padding:14px 16px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;overflow:auto;white-space:pre`)}>{m.code}</pre></>)}
                    {!!(m.isProse) && (<><pre style={css(`margin:0;padding:${m.plain ? '0' : '16px 18px'};font-family:${m.plain ? 'Newsreader,serif' : "'Instrument Sans',system-ui,sans-serif"};font-size:${m.plain ? '16.5px' : '14.5px'};line-height:${m.plain ? '1.65' : '1.7'};white-space:pre-wrap`)}>{m.code}</pre></>)}
                  </div>
                </>)}
                {!!(m.hasOutro) && (<><div style={css(SERIF)}>{m.outro}</div></>)}
                {/* Claude's action row: copy · read aloud · retry, then Own it in the same quiet style, then the time. */}
                {!m.streaming && <div style={css(`display:flex;align-items:center;gap:2px;margin-top:-4px;color:#8A847A`)}>
                  <button onClick={m.onCopy} aria-label="Copy" title={m.copied ? 'Copied' : 'Copy'} style={css(ACT)} className="hv4">{m.copied ? <span style={css(`font-size:11px`)}>✓</span> : <CopyIcon />}</button>
                  <button onClick={m.onSpeak} aria-label="Read aloud" title="Read aloud" style={css(ACT)} className="hv4"><SpeakIcon /></button>
                  <button aria-label="Retry (not in this prototype)" title="Retry (not in this prototype)" aria-disabled="true" style={css(ACT + `;opacity:.45;cursor:default`)}><RetryIcon /></button>
                  {!!(m.showOwnHint && m.ownExpanded) && <button onClick={m.ownAll} data-role="own-all" data-expanded="true" title="You're digging into this. Test yourself on it" style={css(`display:flex;align-items:center;gap:6px;background:#C4613A;color:#fff;border:none;border-radius:99px;padding:5px 12px 5px 9px;font-size:12.5px;margin-left:2px;animation:ownexpand .35s ease-out, ownglow 1.6s ease-out .35s 2`)}><OwnIcon />Own it · about 2 min</button>}
                  {!!(m.showOwnHint && !m.ownExpanded) && <button onClick={m.ownAll} data-role="own-all" aria-label={m.ownActive ? 'Owning this response (open in the side panel)' : m.ownAllLabel} aria-pressed={m.ownActive} aria-disabled={m.ownBlocked || undefined}
                    title={m.ownActive ? 'Owning this · open in the side panel' : m.ownBlocked ? 'Close the current Own it first' : `${m.ownAllLabel} · or highlight any part`}
                    style={css(ACT + (m.ownActive ? `;background:#C4613A;color:#fff` : m.ownBlocked ? `;color:#C9C3B8;cursor:default` : `;color:#9E4B2A`))} className={m.ownActive || m.ownBlocked ? '' : 'hv4'}><OwnIcon /></button>}
                  {!!(m.when) && <span style={css(`font-size:12.5px;color:#9A948A;margin-left:6px`)}>{m.when}</span>}
                </div>}
                {!!(m.checkChip) && (
                  <div style={css(`display:flex;gap:8px;margin-top:-2px`)}>
                    <button onClick={m.checkChip} data-role="gap-check-chip" style={css(`background:#fff;border:1px solid #E3C9B8;border-radius:99px;padding:6px 13px;font-size:13px;color:#9E4B2A`)} className="hv3">I think I've got it: check me</button>
                  </div>
                )}
                {!!(m.showTip) && (
                  <div data-role="own-tip" style={css(`align-self:flex-start;display:flex;align-items:center;gap:10px;font-size:13px;line-height:1.45;color:#5A3A2A;background:#FFF5EE;border:1px solid #F0D5C4;border-radius:10px;padding:8px 10px 8px 12px;margin-top:-4px;animation:rise .3s ease`)}>
                    <span style={css(`color:#C4613A;display:flex`)}><OwnIcon /></span>
                    <span>Want to actually learn part of this? Highlight it, or use <span style={css(`color:#C4613A`)}>this icon</span> to own the whole answer. You'll try it yourself and see what stuck.</span>
                    <button onClick={V.dismissTip} aria-label="Dismiss tip" style={css(`background:none;border:none;color:#B58A74;font-size:15px;padding:0 2px`)}>×</button>
                  </div>
                )}
              </div>
            </>)}

            {!!(m.isGoAsk) && (
              <div data-role="go-ask" style={css(`display:flex;flex-direction:column;gap:14px;animation:rise .3s ease`)}>
                <div style={css(SERIF)}>This one uses something you own: <b>{m.owned}</b>. Want to go first? Write your answer, then I'll show you mine.</div>
                {m.phase === 'offer' && (
                  <div style={css(`display:flex;gap:8px;flex-wrap:wrap`)}>
                    <button onClick={m.onFirst} style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>I'll go first</button>
                    <button onClick={m.onAnswer} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)} className="hv6">Just answer this time</button>
                  </div>
                )}
                {m.inPanel !== undefined && m.phase !== 'offer' && m.phase !== 'answered' && (
                  <div data-role="go-pointer" style={css(`display:flex;gap:10px;align-items:center;font-size:13px;color:#6B665C`)}>
                    <span>{m.phase === 'done' ? 'Your go is in the side panel. Here\'s mine:' : 'Your go is in the side panel. My answer waits until you\'ve tried.'}</span>
                    {!m.inPanel && <button onClick={m.onOpenPanel} data-role="go-open" style={css(`background:none;border:none;padding:0;font-size:13px;color:#9E4B2A;text-decoration:underline;text-underline-offset:2px`)}>Open it</button>}
                  </div>
                )}
                {m.phase === 'answered' && <div style={css(`font-size:12.5px;color:#8A847A`)}>No problem: noted in Learnings that you let me take this one.</div>}
                {m.showReply && (m.replyText ? <Md text={m.replyText} /> : <span style={css(`font-size:12.5px;color:#8A847A;animation:pulse 1.2s infinite`)}>writing my answer…</span>)}
              </div>
            )}

            {!!(m.isGo) && (
              <div data-role="go-first" style={css(`display:flex;flex-direction:column;gap:14px;animation:rise .3s ease`)}>
                <div style={css(SERIF)}>You own <b>{m.goOwned}</b>{m.goWas ? ` (${m.goWas})` : ''}. This new question uses the same idea. Want to answer it yourself first? I'll check yours, then show you mine.</div>
                {m.phase === 'offer' && (
                  <div style={css(`display:flex;gap:8px;flex-wrap:wrap`)}>
                    <button onClick={m.goFirst} style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>I'll go first</button>
                    <button onClick={m.goAnswer} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)} className="hv6">Just answer this time</button>
                  </div>
                )}
                {m.inPanel !== undefined && m.phase !== 'offer' && m.phase !== 'answered' && (
                  <div data-role="go-pointer" style={css(`display:flex;gap:10px;align-items:center;font-size:13px;color:#6B665C`)}>
                    <span>{m.phase === 'done' ? 'Your go is in the side panel. Here\'s mine:' : 'Your go is in the side panel. My answer waits until you\'ve tried.'}</span>
                    {!m.inPanel && <button onClick={m.onOpenPanel} data-role="go-open" style={css(`background:none;border:none;padding:0;font-size:13px;color:#9E4B2A;text-decoration:underline;text-underline-offset:2px`)}>Open it</button>}
                  </div>
                )}
                {(m.phase === 'done' || m.phase === 'answered') && (
                  <div style={css(`display:flex;flex-direction:column;gap:12px;animation:rise .3s ease`)}>
                    {m.phase === 'answered' && <div style={css(`font-size:12.5px;color:#8A847A`)}>No problem: noted in Learnings that you let me take this one.</div>}
                    {!!m.go.answer.intro && <div style={css(SERIF)}>{m.go.answer.intro}</div>}
                    {m.go.prose ? <div style={css(SERIF)}>{m.go.answer.code}</div> : <pre style={css(`margin:0;padding:14px 16px;background:#FBFAF7;border:1px solid #E3DFD6;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;white-space:pre`)}>{m.go.answer.code}</pre>}
                    {!!m.go.answer.outro && <div style={css(SERIF)}>{m.go.answer.outro}</div>}
                  </div>
                )}
              </div>
            )}

            {!!(m.isGapBanner) && (
              <div data-role="gap-banner" style={css(`display:flex;gap:12px;align-items:center;border-left:3px solid ${m.gapClosed ? '#2F8F86' : '#E3A88A'};padding:4px 0 4px 12px`)}>
                <div style={css(`display:flex;flex-direction:column;gap:3px;min-width:0`)}>
                  <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${m.gapClosed ? '#1F6B64' : '#9E4B2A'}`)}>{m.gapClosed ? '✓ Gap closed' : 'Closing a gap'}</div>
                  <div style={css(`font-size:14.5px;color:#1F1D1A`)}>{m.gap.topic}</div>
                  <div style={css(`font-size:12px;color:#8A847A`)}>{m.gapClosed ? "It's now something you own. It comes back for recall in 3 days." : `Found ${m.gap.origin}. Talk it through with Claude; check yourself whenever you're ready.`}</div>
                </div>
              </div>
            )}

            {!!(m.isGapCheck) && (
              <div data-role="gap-check-pointer" style={css(`display:flex;gap:10px;align-items:center;font-size:13px;color:#6B665C;flex-wrap:wrap`)}>
                {m.phase === 'done'
                  ? <span style={css(`color:${m.result.closed ? '#1F6B64' : '#9E4B2A'}`)}>{m.result.closed ? '✓ Gap closed. It comes back for recall in 3 days.' : 'Not closed yet. Keep talking it through, then check again.'}</span>
                  : <span>Your check is in the side panel.</span>}
                {!m.inPanel && <button onClick={m.onOpenPanel} data-role="gap-open" style={css(`background:none;border:none;padding:0;font-size:13px;color:#9E4B2A;text-decoration:underline;text-underline-offset:2px`)}>{m.phase === 'done' ? 'See the check' : 'Open it'}</button>}
              </div>
            )}

            {m.type === 'gap' && (
              <div style={css(`align-self:center;font-size:12px;color:#9A948A;font-style:italic;border-top:1px dashed #D9D4CA;border-bottom:1px dashed #D9D4CA;padding:6px 14px`)}>{m.text}</div>
            )}

            {!!(m.isOwnDone) && (<>
              <div style={css(`border:1px solid #E3DFD6;border-radius:12px;padding:12px 16px;font-size:13px;color:#514C44;display:flex;gap:12px;align-items:center;background:#FBFAF7`)}>
                <span style={css(`font-family:Newsreader,serif;font-size:15px;color:#1F1D1A`)}>{m.doneLabel || 'Owned'}</span><span>{m.summary}</span>
              </div>
            </>)}

            {!!(m.isOwn) && (
              <button onClick={V.focusPanel} data-role="own-chip" style={css(`align-self:flex-start;display:flex;align-items:center;gap:12px;text-align:left;border:1px solid #F0C9B4;background:#FFF8F3;border-radius:12px;padding:10px 16px 10px 12px`)} className="hv3">
                <span style={css(`width:34px;height:34px;border-radius:8px;background:#C4613A;color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:18px;flex:none`)}>O</span>
                <span style={css(`display:flex;flex-direction:column;gap:2px`)}><span style={css(`font-size:14px;color:#1F1D1A`)}>{V.ownEntryLabel} · {V.ownTitle}</span><span style={css(`font-size:12px;color:#8A847A`)}>{V.ownPhaseLabel} · In the side panel</span></span>
              </button>
            )}

          </React.Fragment>))}
        </div>
      </div>

      {!V.isEmpty && (
        <div style={css(`padding:8px 28px 12px;flex:none`)}>
          <div style={css(`max-width:720px;margin:0 auto`)}>{<Composer V={V} home={false} />}</div>
        </div>
      )}

      </>)}
      {!!(V.hasSel) && (<>
        <div id="own-sel" style={css(`position:fixed;left:${V.selX};top:${V.selY};transform:translate(-50%,-110%);display:flex;background:#1F1D1A;border-radius:99px;padding:3px;gap:2px;box-shadow:0 4px 14px rgba(0,0,0,.18);z-index:20;animation:rise .15s ease`)}>
          <button onClick={V.askSelection} data-role="ask-sel" title="Quote this into the chat and ask about it" style={css(`background:none;color:#F6F4EF;border:none;border-radius:99px;padding:5px 12px;font-size:13px`)}>Ask Claude</button>
          <span style={css(`width:1px;background:#4A463F;margin:5px 0`)}></span>
          <button id="own-sel-btn" onClick={V.ownSelection} title="Test yourself on this" style={css(`background:none;color:#F6F4EF;border:none;border-radius:99px;padding:5px 12px;font-size:13px`)}>Own it</button>
        </div>
      </>)}
    </main>
  );
}
