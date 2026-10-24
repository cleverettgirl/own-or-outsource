// The Own it panel: what to own, predict, the try, the reveal, and teaching Sam.
import React from 'react';
import { css } from '../css.js';
import { ItemList, ChoiceQuestions, StepInputs, OwnDiagram, CompareTable, Md, inline } from './parts.jsx';

// What you have to work with: hand-written schemas are plain text; a generated try's context is markdown (tables of
// rows, fenced code), so it renders as markdown when it has any.
const isMdBlock = t => /```|^\s*\|.*\|\s*$/m.test(String(t || ''));
import EffectTimeline from '../EffectTimeline.jsx';

export default function OwnPanel({ V }) {
  return (
    <aside data-role="own-panel" style={css(`width:46%;min-width:420px;max-width:760px;flex:none;border-left:1px solid #E2DCD0;background:#F7F4EE;display:flex;flex-direction:column;animation:slidein .25s ease`)}>
      {/* Design 2a: one focal title, big choices. "Own it" alone in the header; what you're owning is the title below. */}
      <div style={css(`display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 28px;border-bottom:1px solid #E2DCD0;flex:none`)}>
        <span style={css(`font-family:Newsreader,Georgia,serif;font-size:24px`)}>Own it</span>
        <button onClick={V.leaveOwn} data-role="leave" aria-label="Close, back to chat" title="Close, back to chat" style={css(`background:none;border:none;font-size:20px;line-height:1;color:#8A8477;padding:4px 6px;border-radius:6px`)} className="hv4">×</button>
      </div>
      <div ref={V.panelRef} style={css(`flex:1;overflow:auto;padding:24px 28px 32px`)}>
            <div style={css(`display:flex;flex-direction:column;gap:18px`)}>
              <div data-role="stepper" style={css(`display:flex;align-items:center;font-size:13px`)}>
                {V.stepper.map((st, i) => <React.Fragment key={i}>
                  {i > 0 && <span style={css(`flex:1;min-width:12px;height:1px;background:${st.done || st.cur ? '#7FA394' : '#DDD6C8'};margin:0 10px`)}></span>}
                  <span style={css(`display:flex;align-items:center;gap:6px;white-space:nowrap;color:${st.cur ? '#1F1E1B' : st.done ? '#7FA394' : '#8A8477'};font-weight:${st.cur ? 600 : st.done ? 500 : 400}`)}>
                    <i style={css(`width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-style:normal;${st.done ? 'background:#7FA394;color:#fff' : st.cur ? 'background:#C4613C;color:#fff' : 'border:1px solid #C9C1B2'}`)}>{st.done ? '✓' : i + 1}</i>{st.label}
                  </span>
                </React.Fragment>)}
              </div>
              {V.ownPhaseLabel.startsWith('Try it · ') && <span style={css(`font-size:12px;color:#8A8477;margin-top:-8px`)}>{V.ownPhaseLabel.slice(9)}</span>}

              {/* No copy of Claude's text here: the owned part stays highlighted in the chat itself. */}
              <div style={css(`display:flex;flex-direction:column;gap:10px;padding-top:10px`)}>
                {!V.phaseFocus && <span style={css(`font-size:12px;font-weight:600;letter-spacing:.06em;color:#8A8477`)}>OWNING</span>}
                <span data-role="own-title" style={css(`font-family:Newsreader,Georgia,serif;font-size:28px;line-height:1.2;letter-spacing:-.01em`)}>{V.phaseFocus ? 'What do you want to own here?' : V.focusLabel || V.ownTitle}</span>
                <span style={css(`display:flex;gap:16px;font-size:13px;color:#6B665C`)}>
                  {!!V.phasePredict && <button onClick={V.changeFocus} data-role="change-focus" style={css(`background:none;border:none;padding:0;font-size:13px;color:#6B665C;text-decoration:underline;text-underline-offset:2px`)}>Change</button>}
                  <button onClick={V.rereadChat} data-role="reread" style={css(`background:none;border:none;padding:0;font-size:13px;color:#6B665C;text-decoration:underline;text-underline-offset:2px`)}>{V.ownWhole ? 'Reread it in your chat' : 'See the highlighted part in your chat'}</button>
                </span>
              </div>
              <div style={css(`border-top:1px solid #E2DCD0;margin:6px 0 4px`)}></div>

              {!!(V.phaseFocus) && (<>
                <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
                  {!!(V.focusLoading) && (<><div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Looking at what you highlighted…</div></>)}
                  <div style={css(`display:flex;flex-direction:column;gap:6px`)}>
                    {V.focusOptions.map((f, _i) => (
                      <button key={_i} onClick={f.onPick} style={css(`text-align:left;background:#fff;border:1px solid #E3C9B8;border-radius:10px;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14px`)} className="hv3">
                        <span>{f.label}</span><span style={css(`font-size:11px;color:#9A948A;flex:none`)}>{f.kind}</span>
                      </button>
                    ))}
                  </div>
                  <div style={css(`display:flex;gap:8px`)}>
                    <input value={V.focusOther} onChange={V.onFocusOther} onKeyDown={V.onFocusOtherKey} placeholder="Something else…" style={css(`flex:1;border:1px solid #E3C9B8;border-radius:8px;padding:9px 12px;font-size:13.5px;background:#fff;outline:none`)} />
                    <button onClick={V.submitFocusOther} style={css(`background:none;border:1px solid #E3C9B8;border-radius:8px;padding:8px 13px;font-size:13px;color:#9E4B2A`)} className="hv4">Use this</button>
                  </div>
                  <div style={css(`font-size:12.5px;color:#8A847A`)}>Your answer decides what you practise and what gets checked at the end.</div>
                </div>
              </>)}

              {!!(V.phasePredict) && (<>
                <div style={css(`display:flex;flex-direction:column;gap:18px`)}>
                  {!!V.predictTask && (
                    <div data-role="predict-try" style={css(`display:flex;flex-direction:column;gap:8px;background:#fff;border:1px solid #E2DCD0;border-radius:12px;padding:16px 18px`)}>
                      <div style={css(`font-size:11px;font-weight:600;letter-spacing:.06em;color:#8A8477`)}>YOUR TRY</div>
                      <div style={css(`font-size:14.5px;line-height:1.5`)}>{inline(V.predictTask)}</div>
                      <div style={css(`font-size:13px;color:#514C44`)}>{V.predictWhat}</div>
                      {V.predictTopics.length > 0 && <ul data-role="predict-topics" style={css(`margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#514C44`)}>{V.predictTopics.map((t, i) => <li key={i}>{t}</li>)}</ul>}
                    </div>
                  )}
                  <div style={css(`font-size:20px;font-weight:500;line-height:1.3`)}>{V.predictQuestion}</div>
                  <div style={css(`display:grid;grid-template-columns:repeat(${Math.max(2, V.predictOptions.length)},1fr);gap:10px`)}>
                    {(V.predictOptions || []).map((p, _i) => (
                      <button key={_i} onClick={p.onPick} data-role="predict-option" data-n={p.n} aria-pressed={p.selected} style={css(`background:#fff;border:${p.selected ? '2px solid #C4613C' : '1px solid #DDD6C8'};border-radius:12px;height:88px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;box-sizing:border-box`)} className="hv3">
                        <span style={css(`font-family:Newsreader,Georgia,serif;font-size:32px;color:${p.selected ? '#C4613C' : '#1F1E1B'}`)}>{p.n}</span><span style={css(`font-size:12px;color:${p.selected ? '#C4613C' : '#8A8477'}`)}>{p.label}</span>
                      </button>
                    ))}
                  </div>
                  <div data-role="predict-hint" style={css(`font-size:14px;line-height:1.55;color:#6B665C`)}>Not sure? <button onClick={V.rereadChat} data-role="predict-reread" style={css(`background:none;border:none;padding:0;font-size:14px;color:#6B665C;text-decoration:underline;text-underline-offset:2px`)}>Reread {V.predictReread}</button> before you lock in a number.{!!V.predictLow && <> {V.predictLow}</>}</div>
              <div data-role="no-idea" style={css(`font-size:13.5px;line-height:1.5;color:#514C44;border-top:1px solid #E2DCD0;padding-top:14px`)}>
                No idea where to start? <button onClick={V.askClaudeFirst} data-role="ask-first-predict" style={css(`background:none;border:none;padding:0;font-size:13.5px;color:#9E4B2A;text-decoration:underline;text-underline-offset:2px`)}>Have Claude walk you through it first</button>, step by step in the chat. Come back to Own it after.
              </div>
                </div>
              </>)}

              {!!(V.phaseLadder) && (<>


                {!!(V.stepSee && V.seeTimeline) && <EffectTimeline code={V.ownCode} onDone={V.goWrite} />}
                {!!(V.stepSee && !V.seeTimeline) && (<>
                  <div style={css(`display:flex;flex-direction:column;gap:14px`)}>
                    <div style={css(`font-size:14.5px;line-height:1.5`)}>{V.seeIntro}</div>
                    {!!(V.seeLoading) && (<><div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Working out the steps…</div></>)}
                    {!!(V.seeReady) && (<>
                      <div style={css(`display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:16px;align-items:start`)}>
                        <div style={css(`display:flex;flex-direction:column;gap:3px`)}>
                          {(V.seeClauses || []).map((c, _i) => (<React.Fragment key={_i}>
                            <div style={css(`display:flex;gap:10px;align-items:baseline;padding:5px 9px;border-radius:6px;background:${c.bg};color:${c.fg};font-family:'JetBrains Mono',monospace;font-size:12px;white-space:pre-wrap;font-style:${c.italic}`)}><span style={css(`font-size:10px;width:14px;flex:none;opacity:.7`)}>{c.order}</span>{c.text}</div>
                          </React.Fragment>))}
                        </div>
                        <div style={css(`display:flex;flex-direction:column;gap:8px`)}>
                          <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>{V.seeStepKicker}</div>
                          <div style={css(`font-size:13px;font-weight:500;font-family:'JetBrains Mono',monospace;line-height:1.4`)}>{V.seeStepTitle}</div>
                          <div style={css(`font-size:12.5px;color:#514C44;line-height:1.45`)}>{V.seeStepNote}</div>
                          {!!(V.seeHasTable) && (<>
                            <div style={css(`border:1px solid #E3DFD6;border-radius:8px;overflow:hidden;background:#fff`)}>
                              <div style={css(`display:grid;grid-template-columns:${V.seeCols};font-size:11px;font-weight:600;color:#8A847A;padding:5px 10px;border-bottom:1px solid #EEEAE2;gap:8px`)}>
                                {(V.seeHeaders || []).map((h, _i) => (<React.Fragment key={_i}><span>{h.t}</span></React.Fragment>))}
                              </div>
                              {(V.seeRows || []).map((r, _i) => (<React.Fragment key={_i}>
                                <div style={css(`display:grid;grid-template-columns:${V.seeCols};font-family:'JetBrains Mono',monospace;font-size:12px;padding:4px 10px;gap:8px;background:${r.bg};color:${r.fg};text-decoration:${r.deco};animation:rise .25s ease`)}>
                                  {(r.cells || []).map((cell, _i) => (<React.Fragment key={_i}><span style={css(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{cell.t}</span></React.Fragment>))}
                                </div>
                              </React.Fragment>))}
                            </div>
                            <div style={css(`font-size:11.5px;color:#8A847A`)}>{V.seeRowCount}</div>
                          </>)}
                        </div>
                      </div>
                      <div style={css(`display:flex;gap:8px;align-items:center;justify-content:space-between`)}>
                        <div style={css(`display:flex;gap:6px`)}>
                          <button onClick={V.seePrev} style={css(`background:none;border:1px solid #D9D4CA;border-radius:8px;padding:7px 12px;font-size:13px`)} className="hv6">← Back</button>
                          {!!(V.seeHasNext) && (<><button onClick={V.seeNext} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:8px;padding:7px 14px;font-size:13px`)}>Next step →</button></>)}
                        </div>
                        {!!(V.seeAtEnd) && (<><button onClick={V.goNext} style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>{V.seeNextLabel}</button></>)}
                  </div>
                    </>)}
                  </div>
                </>)}

                {!!(V.stepAsm) && (<>
                  <div style={css(`display:flex;flex-direction:column;gap:14px`)}>
                    <div style={css(`font-size:14.5px;line-height:1.5`)}>A warm-up, not scored: the pieces, shuffled. Tap them into your version in the order they're written.{V.asmHasDecoy ? ' One piece doesn\'t belong.' : ''}</div>
                    <div style={css(`display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start`)}>
                      <div style={css(`display:flex;flex-direction:column;gap:6px`)}>
                        <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>Pieces</div>
                        {(V.asmBank || []).map((p, _i) => (<React.Fragment key={_i}>
                          <button onClick={p.onClick} style={css(`text-align:left;background:#fff;border:1px solid #E3DFD6;border-radius:7px;padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:12px;white-space:pre-wrap`)} className="hv7">{p.text}</button>
                        </React.Fragment>))}
                        {!!(V.asmBankEmpty) && (<><div style={css(`font-size:12px;color:#9A948A;padding:6px 0`)}>All pieces placed.</div></>)}
                      </div>
                      <div style={css(`display:flex;flex-direction:column;gap:6px;min-height:120px;border:1px dashed #E3C9B8;border-radius:8px;padding:10px`)}>
                        <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9E4B2A`)}>Your version</div>
                        {(V.asmSeq || []).map((p, _i) => (<React.Fragment key={_i}>
                          <div style={css(`display:flex;gap:6px;align-items:stretch`)}>
                            <button onClick={p.onClick} style={css(`flex:1;text-align:left;background:${p.bg};border:1px solid ${p.border};border-radius:7px;padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:12px;white-space:pre-wrap`)} className="hv8">{p.text}</button>
                            <button onClick={p.up} style={css(`background:none;border:1px solid #E3DFD6;border-radius:6px;padding:0 7px;font-size:11px;color:#8A847A`)}>↑</button>
                            <button onClick={p.down} style={css(`background:none;border:1px solid #E3DFD6;border-radius:6px;padding:0 7px;font-size:11px;color:#8A847A`)}>↓</button>
                          </div>
                        </React.Fragment>))}
                      </div>
                    </div>
                    {!!(V.asmFeedback) && (<>
                      <div style={css(`border-left:2px solid #C4613A;padding:4px 12px;font-size:13.5px;line-height:1.5;color:#5A3A2A;background:#FFF1E8;border-radius:0 8px 8px 0`)}>{V.asmFeedbackText}</div>
                    </>)}
                    {!!(V.asmNotCorrect) && (<>
                      <div style={css(`display:flex;gap:8px;align-items:center`)}>
                        <button onClick={V.checkAsm} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Check order</button>
                        {!!(V.asmLoading) && (<><span style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>checking…</span></>)}
                      </div>
                    </>)}
                    {!!(V.asmCorrect) && (<>
                      <div style={css(`display:flex;flex-direction:column;gap:10px`)}>
                        <label style={css(`font-size:14px`)}>{V.asmWhyPrompt}</label>
                        <input value={V.asmWhy} onChange={V.onAsmWhy} placeholder="Your words, one line" style={css(`border:1px solid #E3C9B8;border-radius:8px;padding:10px 12px;font-size:14px;background:#fff;outline:none`)} />
                        <button onClick={V.goWrite} style={css(`align-self:flex-start;background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Now write one yourself →</button>
                      </div>
                    </>)}
                  </div>
                </>)}

                {!!(V.stepCompare) && (<>
                  <div style={css(`display:flex;flex-direction:column;gap:14px`)}>
                    {!!(V.conceptLoading) && <div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Working out the core idea…</div>}
                    {!!(V.hasConcept) && (
                      <div data-role="refresher-card" style={css(`display:flex;flex-direction:column;gap:10px`)}>
                        <button onClick={V.toggleRefresher} style={css(`align-self:flex-start;background:none;border:none;padding:0;font-size:12.5px;color:#9E4B2A`)}>{V.refresherOpen ? '▾' : '▸'} Refresher: the idea in one card</button>
                        {!!(V.refresherOpen) && (<>
                      <div style={css(`display:flex;flex-direction:column;gap:14px;background:#fff;border:1px solid #EFE4DA;border-radius:10px;padding:16px 18px`)}>
                        <div style={css(`font-family:Newsreader,serif;font-size:19px;line-height:1.35;letter-spacing:-.005em`)}>{V.conceptModel}</div>
                        {!!(V.conceptGrid) && (<>
                          <div style={css(`border:1px solid #E3DFD6;border-radius:8px;overflow:hidden`)}>
                            <div style={css(`display:grid;grid-template-columns:${V.conceptGrid.cols};gap:10px;padding:7px 12px;background:#F9F7F2;border-bottom:1px solid #EEEAE2;font-size:11px;font-weight:600;color:#8A847A;letter-spacing:.03em`)}>
                              {V.conceptGrid.headers.map((h, j) => <span key={j}>{h.t}</span>)}
                            </div>
                            {V.conceptGrid.rows.map((r, i) => (
                              <div key={i} style={css(`display:grid;grid-template-columns:${V.conceptGrid.cols};gap:10px;padding:8px 12px;border-top:${i ? '1px solid #F1EDE5' : 'none'};font-size:13px;line-height:1.4;align-items:baseline`)}>
                                {r.cells.map((c, j) => <span key={j} style={css(`font-family:${c.first ? "'JetBrains Mono',monospace" : 'inherit'};font-size:${c.first ? '12px' : '13px'};font-weight:${c.strong ? 600 : 400};color:${c.strong ? '#1F6B64' : '#1F1D1A'}`)}>{c.t}</span>)}
                              </div>
                            ))}
                          </div>
                        </>)}
                        {!!(V.conceptInYourCode) && (<>
                          <div style={css(`display:flex;flex-direction:column;gap:3px`)}>
                            <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9E4B2A`)}>{V.conceptInLabel}</div>
                            <div style={css(`font-size:14px;line-height:1.5`)}>{V.conceptInYourCode}</div>
                          </div>
                        </>)}
                        {!!(V.conceptRule) && (<>
                          <div style={css(`display:flex;flex-direction:column;gap:3px`)}>
                            <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9E4B2A`)}>Rule of thumb</div>
                            <div style={css(`font-size:14px;line-height:1.5`)}>{V.conceptRule}</div>
                          </div>
                        </>)}
                      </div>
                        </>)}
                      </div>
                    )}
                    <div style={css(`font-size:14.5px;line-height:1.5`)}>{V.cmpIntro}</div>
                    {!!(V.cmpLoading) && (<><div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Building the comparison…</div></>)}
                    {!!(V.cmpHasSource) && (<>
                      <div style={css(`display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:12px;align-items:start`)}>
                        {V.cmpSource.map((t, _i) => (
                          <div key={_i} style={css(`display:flex;flex-direction:column;gap:4px`)}>
                            <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>{t.name}</div>
                            <CompareTable t={t} />
                          </div>
                        ))}
                      </div>
                    </>)}
                    {!!(V.cmpHasCases) && (<>
                      <div style={css(`display:flex;gap:6px;flex-wrap:wrap`)}>
                        {V.cmpTabs.map((tb, _i) => (
                          <button key={_i} onClick={tb.onClick} style={css(`font-family:'JetBrains Mono',monospace;font-size:12px;padding:6px 11px;border-radius:99px;border:none;background:${tb.bg};color:${tb.fg}`)} className="hv5">{tb.label}</button>
                        ))}
                      </div>
                      <pre style={css(`margin:0;padding:10px 14px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12.5px;line-height:1.55;white-space:pre-wrap`)}>{V.cmpCode}</pre>
                      {!!(V.cmpHidden && V.cmpIsTable) && (<>
                        <div style={css(`display:flex;flex-direction:column;gap:8px`)}>
                          <div style={css(`font-size:14px`)}>How many rows come back?</div>
                          <div style={css(`display:flex;gap:6px`)}>
                            {V.cmpGuessOptions.map((g, _i) => (
                              <button key={_i} onClick={g.onPick} style={css(`flex:1;border:1px solid #E3C9B8;background:#fff;border-radius:9px;padding:9px 0;font-family:Newsreader,serif;font-size:18px`)} className="hv3">{g.n}</button>
                            ))}
                          </div>
                        </div>
                      </>)}
                      {!!(V.cmpHidden && V.cmpIsPick) && (<>
                        <div style={css(`display:flex;flex-direction:column;gap:8px`)}>
                          <div style={css(`font-size:14px`)}>{V.cmpAsk}</div>
                          <div style={css(`display:flex;gap:6px`)}>
                            {V.cmpPickOptions.map((g, _i) => (
                              <button key={_i} onClick={g.onPick} style={css(`flex:1;border:1px solid #E3C9B8;background:#fff;border-radius:9px;padding:9px 0;font-family:Newsreader,serif;font-size:17px`)} className="hv3">{g.l}</button>
                            ))}
                          </div>
                        </div>
                      </>)}
                      {!!(V.cmpHidden && !V.cmpIsTable && !V.cmpIsPick) && (<>
                        <div style={css(`display:flex;gap:8px`)}>
                          <input value={V.cmpGuessText} onChange={V.onCmpGuessText} placeholder="What do you think happens? (optional)" style={css(`flex:1;border:1px solid #E3C9B8;border-radius:8px;padding:9px 12px;font-size:13.5px;background:#fff;outline:none`)} />
                          <button onClick={V.cmpRevealText} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:8px;padding:8px 13px;font-size:13px`)}>Show me</button>
                        </div>
                      </>)}
                      {!!(V.cmpShown) && (<>
                        <div style={css(`display:flex;flex-direction:column;gap:8px;animation:rise .25s ease`)}>
                          {!!(V.cmpResultLine) && (<><div style={css(`font-size:13.5px;font-weight:500`)}>{V.cmpResultLine}</div></>)}
                          {!!(V.cmpTable) && (<><CompareTable t={V.cmpTable} /></>)}
                          {!!(V.cmpDiagram) && <OwnDiagram d={V.cmpDiagram} />}
                          {!!(V.cmpPatterns) && (<>
                            <div data-role="patterns" style={css(`display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:4px`)}>
                              {V.cmpPatterns.map((p, _i) => <span key={_i} style={css(`font-family:'JetBrains Mono',monospace;font-size:12px;text-align:center;padding:4px 0;border-radius:5px;background:${p.miss ? '#FBE9E1' : '#E2F1EE'};color:${p.miss ? '#9E4B2A' : '#1F6B64'};font-weight:${p.miss ? 600 : 400}`)}>{p.p}</span>)}
                            </div>
                            <div style={css(`font-size:12px;color:#8A847A`)}>{V.cmpPatternLine}</div>
                          </>)}
                          {!!(V.cmpOutcome) && (<><div style={css(`font-size:13.5px;line-height:1.5`)}><b>What happens:</b> {V.cmpOutcome}</div></>)}
                          <div style={css(`border-left:2px solid #C4613A;padding:4px 12px;font-size:13.5px;line-height:1.5;color:#5A3A2A;background:#FFF1E8;border-radius:0 8px 8px 0`)}>{V.cmpNote}</div>
                          {!!(V.cmpHasNextCase) && (<><button onClick={V.cmpNextCase} style={css(`align-self:flex-start;background:none;border:1px solid #D9D4CA;border-radius:8px;padding:7px 12px;font-size:13px`)} className="hv6">Next case →</button></>)}
                        </div>
                      </>)}
                    </>)}
                    {!!(V.cmpAllSeen) && (<><button onClick={V.goNext} style={css(`align-self:flex-start;background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>{V.cmpNextLabel}</button></>)}
                  </div>
                </>)}

                {!!(V.stepWrite) && (<>
                  <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
                    <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9E4B2A`)}>{V.writeFixing ? `Fixing it · try ${V.writeTry}` : 'Your turn'}</div>
                    {!!(V.writeFixing) && <div style={css(`font-size:13px;color:#514C44;background:#F4F1EA;border-radius:8px;padding:7px 11px;line-height:1.45`)}><b style={css(`color:#9E4B2A`)}>What to fix:</b> {inline(V.writeLastGap || "")}</div>}
                    {!!(V.writeLoading) && (<><div style={css(`font-size:13px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Picking a variant for you…</div></>)}
                    {!!V.notReady && (
                      <div data-role="not-ready" style={css(`font-size:13px;color:#514C44;background:#F4F1EA;border-radius:8px;padding:8px 11px;line-height:1.45;display:flex;gap:8px;align-items:center;flex-wrap:wrap`)}>
                        <span>Not ready yet? Ask Claude about it first, then come back.</span>
                        <button onClick={V.askClaudeFirst} data-role="ask-first" style={css(`background:none;border:none;padding:0;font-size:13px;color:#9E4B2A;text-decoration:underline;text-underline-offset:2px`)}>Ask Claude first</button>
                        <span style={css(`color:#8A847A`)}>or give it a go: a wrong first try still teaches.</span>
                      </div>
                    )}
                    <div style={css(`font-size:15px;line-height:1.5`)}>{inline(V.writeTask || '')}</div>
                    {V.writeRefresher.length > 0 && (
                      <div data-role="refresher" style={css(`font-size:12.5px;color:#8A847A;display:flex;gap:8px;align-items:center;flex-wrap:wrap`)}>
                        <span>{V.writeRefresher.length > 1 ? 'Want a warm-up first?' : V.writeRefresher[0].label === 'See it visually' ? 'Want a picture of it first?' : 'Want a warm-up first?'}</span>
                        {V.writeRefresher.map((r, i) => <button key={i} onClick={r.onClick} style={css(`background:none;border:none;padding:0;font-size:12.5px;color:#9E4B2A;text-decoration:underline;text-underline-offset:2px`)}>{r.label}</button>)}
                      </div>
                    )}
                    {!!(V.hasWriteSchema) && (<>
                      <div style={css(`display:flex;flex-direction:column;gap:4px`)}>
                        <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>What you have to work with</div>
                        {isMdBlock(V.writeSchema) ? <div data-role="schema-md" style={css(`font-size:13px`)}><Md text={V.writeSchema} small /></div> : <pre style={css(`margin:0;padding:9px 12px;background:#F4F1EA;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.55;white-space:pre-wrap;color:#514C44`)}>{V.writeSchema}</pre>}
                      </div>
                    </>)}
                    {!!(V.writeBefore) && (<><pre style={css(`margin:0;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;color:#8A847A;background:#F4F1EA;border-radius:8px`)}>{V.writeBefore}</pre></>)}
                    {!!(V.writeIsChoice) && <ChoiceQuestions qs={V.writeQs} picked={V.writePicked} onPick={V.onWritePick} />}
                    {!!(V.writeIsSteps) && <StepInputs steps={V.writeSteps} entered={V.writePicked} onEnter={V.onWritePick} />}
                    {!V.writeIsChoice && !V.writeIsSteps && <textarea data-role="write" value={V.writeText} onChange={V.onWriteText} placeholder={V.writePlaceholder} style={css(`width:100%;min-height:${V.writeBefore ? '72px' : '120px'};resize:vertical;border:1px solid #E3C9B8;border-radius:8px;padding:10px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;background:#fff;outline:none;line-height:1.55`)}></textarea>}
                    {!!(V.writeAfter) && (<><pre style={css(`margin:0;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;color:#8A847A;background:#F4F1EA;border-radius:8px`)}>{V.writeAfter}</pre></>)}
                    {!!(V.hasHints) && (<>
                      <div style={css(`display:flex;flex-direction:column;gap:5px`)}>
                        {(V.hints || []).map((h, _i) => (<React.Fragment key={_i}><div style={css(`font-size:13px;color:#514C44;line-height:1.45;display:flex;gap:8px`)}><span style={css(`color:#9E4B2A;flex:none`)}>Hint {h.n}</span><span>{h.t}</span></div></React.Fragment>))}
                      </div>
                    </>)}
                    {!!(V.writeNotGraded) && (<>
                  <div style={css(`display:flex;gap:8px;margin-top:24px;align-items:center;flex-wrap:wrap`)}>
                        <button onClick={V.submitWrite} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Check my version</button>
                        <button onClick={V.askHint} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)} className="hv6">Give me a hint</button>
                        <button onClick={V.askAboutIt} data-role="ask-stuck" style={css(`background:none;border:none;font-size:13px;color:#9E4B2A`)}>Stuck? Ask Claude in the chat</button>
                        {!!(V.gradeLoading) && (<><span style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>{V.gradeLoadingText}</span></>)}
                      </div>
                    </>)}
                  </div>
                </>)}


              </>)}

              {!!(V.phaseReveal) && (<>
                <div style={css(`display:flex;flex-direction:column;gap:18px`)}>
                  <div style={css(`font-family:Newsreader,serif;font-size:22px;line-height:1.25;letter-spacing:-.01em`)}>{V.revealHeadline}</div>
                  <div style={css(`position:relative;padding:28px 0 8px`)}>
                    <div style={css(`position:absolute;left:7%;right:7%;top:46px;height:2px;background:#E3DFD6`)}></div>
                    <div style={css(`display:grid;grid-template-columns:${V.revealCols};position:relative`)}>
                      {(V.revealNodes || []).map((n, _i) => (<React.Fragment key={_i}>
                        <div style={css(`display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:0 6px`)}>
                          <div style={css(`height:18px;font-size:11px;color:#9E4B2A;font-weight:600;white-space:nowrap`)}>{n.above}</div>
                          <div style={css(`width:20px;height:20px;border-radius:50%;background:${n.dotBg};border:2px solid ${n.dotBorder};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff`)}>{n.mark}</div>
                          <div style={css(`font-size:12.5px;font-weight:500;color:${n.fg}`)}>{n.label}</div>
                          <div style={css(`font-size:12px;color:#716C64;line-height:1.4`)}>{n.detail}</div>
                        </div>
                      </React.Fragment>))}
                    </div>
                  </div>
                  <div style={css(`display:flex;flex-direction:column;gap:8px;border-top:1px solid #EFE4DA;padding-top:14px`)}>
                    <div style={css(`display:flex;justify-content:space-between;font-size:11px;color:#8A847A`)}><span>0</span><span>{V.revealN}</span></div>
                    <div style={css(`position:relative;height:36px`)}>
                      <div style={css(`position:absolute;left:0;right:0;top:17px;height:2px;background:#E3DFD6`)}></div>
                      <div style={css(`position:absolute;top:11px;height:14px;width:14px;border-radius:50%;background:#C4613A;left:${V.predLeft};transform:translateX(-50%)`)}></div>
                      <div style={css(`position:absolute;top:11px;height:14px;width:14px;border-radius:50%;background:#2F8F86;left:${V.actLeft};transform:translateX(-50%);animation:rise .5s ease`)}></div>
                      <div style={css(`position:absolute;top:17px;height:2px;background:#9A948A;left:${V.gapLeft};width:${V.gapWidth};transform-origin:left;animation:grow .6s ease`)}></div>
                    </div>
                    <div style={css(`display:flex;gap:16px;font-size:12.5px`)}><span style={css(`color:#9E4B2A`)}>● You said {V.ownPredictionN} of {V.revealN}</span><span style={css(`color:#1F6B64`)}>● You got {V.actualN}</span></div>
                  </div>
                  <div style={css(`font-size:14.5px;line-height:1.55`)}>{V.revealLine}</div>
                  <div data-role="saved-line" style={css(`display:flex;gap:8px;align-items:center;font-size:13px;color:#1F6B64`)}><span style={css(`width:6px;height:6px;border-radius:50%;background:#2F8F86`)}></span>Saved to Learnings. It comes back for a quick recall in 3 days.</div>
                  {!!(V.revealFixLine) && <div data-role="fix-line" style={css(`font-size:13.5px;line-height:1.5;color:#1F6B64;background:#E2F1EE;border-radius:8px;padding:7px 11px`)}>{V.revealFixLine}</div>}
                  {V.revealItems.length > 0 && <ItemList items={V.revealItems} ownedNote={V.revealOwnedNote} title={V.revealScale} />}
                  {!!V.revealWhy && <div title={V.revealScale} style={css(`font-size:13.5px;line-height:1.5;color:#514C44`)}>{V.revealWhy}</div>}
                  {!!(V.revealCorrection) && (<><div style={css(`font-size:13px;line-height:1.5;color:#514C44;background:#F4F1EA;border-radius:8px;padding:7px 11px`)}>{V.revealCorrection}</div></>)}
                  {!!(V.hasGap) && (<><div style={css(`font-size:13.5px;line-height:1.5;color:#514C44`)}><b style={css(`color:#9E4B2A`)}>What to fix:</b> {inline(V.gradeGap || '')}</div></>)}
                  {V.revealTables.length > 0 && (
                    <div style={css(`display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:start`)}>
                      {V.revealTables.map((t, i) => (
                        <div key={i} style={css(`display:flex;flex-direction:column;gap:4px`)}>
                          <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>{t.title}</div>
                          {t.empty ? <div style={css(`font-size:12.5px;color:#8A847A;padding:6px 0`)}>No rows.</div> : <CompareTable t={t} />}
                          {!!t.legend && <div style={css(`font-size:11.5px;color:#8A847A`)}>{t.legend}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {(V.revealNotes.length > 0 || V.notesLoading) && (
                    <div data-role="notes" style={css(`display:flex;flex-direction:column;gap:8px;border-top:1px solid #EFE4DA;padding-top:12px`)}>
                      <div style={css(`font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A847A`)}>On your version</div>
                      {V.revealNotes.map((n, i) => (
                        <div key={i} style={css(`display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:#514C44`)}>
                          <span style={css(`flex:none;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:2px;background:${n.kind === 'nice' ? '#DDEFEC' : '#FBE9E1'};color:${n.kind === 'nice' ? '#1F6B64' : '#9E4B2A'}`)}>{n.kind === 'nice' ? '✓' : '→'}</span>
                          <span>{!!n.quote && <code style={css(`font-family:'JetBrains Mono',monospace;font-size:12px;background:#F4F1EA;border-radius:5px;padding:1px 6px;margin-right:6px;color:#1F1D1A`)}>{n.quote}</code>}{n.text}</span>
                        </div>
                      ))}
                      {!!V.notesLoading && <div style={css(`font-size:12.5px;color:#9E4B2A;animation:pulse 1.2s infinite`)}>Reading how you wrote it…</div>}
                    </div>
                  )}
                  <div style={css(`display:flex;gap:8px;align-items:center;flex-wrap:wrap`)}>
     {!!(V.revealVisual) && <button onClick={V.revealVisual} style={css(`background:none;border:none;font-size:13px;color:#8A847A`)}>See it visually</button>}
                    {!!(V.canFix) && <button onClick={V.askAboutIt} data-role="ask-claude" style={css(`background:none;border:1px solid #E3C9B8;border-radius:9px;padding:8px 13px;font-size:13px;color:#9E4B2A`)} className="hv4">Ask Claude about this</button>}
                    {!!(V.canFix) && <button onClick={V.fixWrite} data-role="fix" style={css(`background:#C4613A;color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Fix it</button>}
                    <button onClick={V.finishOwn} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px`)}>Back to chat</button>
                <button onClick={V.seeInLearnings} data-role="see-in-learnings" style={css(`background:none;border:1px solid #CFE3DE;border-radius:9px;padding:8px 13px;font-size:13px;color:#1F6B64`)} className="hv6">See it in Learnings →</button>
                    <button onClick={V.goTeach} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)} className="hv6">Optional: explain it to Sam</button>
                    <span style={css(`font-size:12px;color:#9A948A`)}>Sam is a beginner. Teaching closes the gap faster than rereading.</span>
                  </div>
                </div>
              </>)}

              {!!(V.phaseTeach) && (<>
                <div style={css(`display:flex;flex-direction:column;gap:12px`)}>
                  <div style={css(`font-size:13px;color:#716C64`)}>Sam has never touched this. Explain in your own words; Sam will ask what doesn't make sense.</div>
                  <div style={css(`display:flex;flex-direction:column;gap:10px;background:#F4F1EA;border-radius:10px;padding:12px`)}>
                    {(V.teachMsgs || []).map((t, _i) => (<React.Fragment key={_i}>
                      <div style={css(`display:flex;gap:10px;align-items:flex-start;align-self:${t.align};max-width:88%`)}>
                        {!!(t.isSam) && (<><span style={css(`width:26px;height:26px;border-radius:50%;background:#5B7F3C;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;flex:none;font-family:Newsreader,serif`)}>S</span></>)}
                        <div style={css(`font-size:14px;line-height:1.5;background:${t.bg};padding:8px 12px;border-radius:10px;white-space:pre-wrap`)}>{t.text}</div>
                      </div>
                    </React.Fragment>))}
                    {!!(V.teachLoading) && (<><div style={css(`font-size:12.5px;color:#5B7F3C;animation:pulse 1.2s infinite`)}>Sam is thinking…</div></>)}
                  </div>
                  {!!(V.teachOpen) && (<>
                    <div style={css(`display:flex;gap:8px`)}>
                      <input value={V.teachInput} onChange={V.onTeachInput} onKeyDown={V.onTeachKey} placeholder="Explain it to Sam…" style={css(`flex:1;border:1px solid #D9D4CA;border-radius:8px;padding:10px 12px;font-size:14px;background:#fff;outline:none`)} />
                      <button onClick={V.sendTeach} style={css(`background:#1F1D1A;color:#F6F4EF;border:none;border-radius:8px;padding:9px 14px;font-size:13.5px`)}>Send</button>
                    </div>
                  </>)}
                  {!!(V.teachDebriefLoading) && <div style={css(`font-size:12.5px;color:#5B7F3C;animation:pulse 1.2s infinite`)}>Looking back at how you explained it…</div>}
                  {!!(V.teachDebrief) && (
                    <div data-role="teach-debrief" style={css(`display:flex;flex-direction:column;gap:10px;border:1px solid #E3DFD6;background:#fff;border-radius:12px;padding:14px 16px;animation:rise .3s ease`)}>
                      <div style={css(`font-family:Newsreader,serif;font-size:19px`)}>What teaching Sam showed</div>
                      {V.teachDebrief.clear.map((c, i) => (
                        <div key={'c' + i} style={css(`display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:#514C44`)}>
                          <span style={css(`flex:none;width:18px;height:18px;border-radius:50%;background:#DDEFEC;color:#1F6B64;display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:2px`)}>✓</span>
                          <span><b style={css(`color:#1F6B64`)}>You explained clearly:</b> <i>“{c.quote}”</i> {c.text}</span>
                        </div>
                      ))}
                      {(V.teachDebrief.unsureRight || []).map((u, i) => (
                        <div key={'r' + i} data-role="teach-unsure-right" style={css(`display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:#514C44`)}>
                          <span style={css(`flex:none;width:18px;height:18px;border-radius:50%;background:#DDEFEC;color:#1F6B64;display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:2px`)}>✓</span>
                          <span><b style={css(`color:#1F6B64`)}>Unsure, but right:</b> you said <i>“{u.quote}”</i> That holds. You knew more than you trusted.</span>
                        </div>
                      ))}
                      {V.teachDebrief.unsure.map((u, i) => (
                        <div key={'u' + i} data-role="teach-gap" style={css(`display:flex;flex-direction:column;gap:8px;background:#FFF5EE;border:1px solid #F0D5C4;border-radius:10px;padding:10px 12px`)}>
                          <div style={css(`display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:#514C44`)}>
                            <span style={css(`flex:none;width:18px;height:18px;border-radius:50%;background:#FBE9E1;color:#9E4B2A;display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:2px`)}>?</span>
                            <span><b style={css(`color:#9E4B2A`)}>You weren't sure:</b> Sam asked <i>“{u.question}”</i> and you said <i>“{u.quote}”</i></span>
                          </div>
                          <div style={css(`font-size:13px;color:#5A3A2A;padding-left:28px`)}>That's a gap you didn't know you had: <b>{u.topic}</b>.</div>
                          <div style={css(`display:flex;gap:8px;padding-left:28px;flex-wrap:wrap`)}>
                            <button onClick={() => V.exploreTeachGap(u)} style={css(`background:#C4613A;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12.5px`)}>Explore this gap with Claude</button>
                            {V.gapTopics.includes(u.topic)
                              ? <span style={css(`font-size:12.5px;color:#1F6B64;align-self:center`)}>✓ Saved to Learnings</span>
                              : <button onClick={() => V.saveTeachGap(u)} style={css(`background:none;border:1px solid #E3C9B8;border-radius:8px;padding:6px 12px;font-size:12.5px;color:#9E4B2A`)} className="hv4">Save for later</button>}
                          </div>
                        </div>
                      ))}
                      {V.teachDebrief.unsure.length === 0 && <div style={css(`font-size:13px;color:#1F6B64`)}>No shaky spots: you answered every question Sam asked. Explaining it is the strongest sign you own it.</div>}
                    </div>
                  )}
              <div style={css(`display:flex;gap:8px`)}>{!!(V.canWrap) && <button onClick={V.wrapTeach} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)} className="hv6">I'm done explaining</button>}<button onClick={V.finishOwn} style={css(`background:none;border:1px solid #D9D4CA;border-radius:9px;padding:8px 13px;font-size:13px;color:#514C44`)}>Done, back to chat</button><button onClick={V.seeInLearnings} data-role="see-in-learnings" style={css(`background:none;border:none;padding:0 4px;font-size:13px;color:#1F6B64;text-decoration:underline;text-underline-offset:2px`)}>See it in Learnings →</button></div>
                </div>
              </>)}

            </div>
      </div>
      {!!V.phasePredict && (
        <div data-role="predict-footer" style={css(`flex:none;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 28px 22px;border-top:1px solid #E2DCD0`)}>
          <button onClick={V.leaveOwn} style={css(`background:none;border:none;padding:0;font-size:14px;color:#8A8477`)}>Never mind</button>
          <button onClick={V.lockPrediction} data-role="predict-lock" disabled={V.predSel == null} style={css(`background:${V.predSel == null ? '#E2DCD0' : '#C4613C'};color:${V.predSel == null ? '#8A8477' : '#fff'};border:none;border-radius:99px;padding:12px 22px;font-size:15px;font-weight:500;cursor:${V.predSel == null ? 'default' : 'pointer'}`)}>{V.predSel == null ? 'Pick a number to start' : `Lock in ${V.predSel} · start`}</button>
        </div>
      )}
    </aside>
  );
}
