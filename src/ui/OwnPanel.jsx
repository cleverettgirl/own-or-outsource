// The Own it panel: what to own, predict, the try, the reveal, and teaching Sam.
import React from 'react';
import { ItemList, ChoiceQuestions, StepInputs, OwnDiagram, CompareTable, Md, inline } from './parts.jsx';

// What you have to work with: hand-written schemas are plain text; a generated try's context is markdown (tables of
// rows, fenced code), so it renders as markdown when it has any.
const isMdBlock = t => /```|^\s*\|.*\|\s*$/m.test(String(t || ''));
import EffectTimeline from '../EffectTimeline.jsx';
import SpotPractice from './SpotPractice.jsx';

export default function OwnPanel({ V }) {
  return (
    <aside data-role="own-panel" className="w-[46%] min-w-105 max-w-190 flex-none border-l border-line bg-page flex flex-col animate-slidein">
      {/* Design 2a: one focal title, big choices. "Own it" alone in the header; what you're owning is the title below. */}
      <div className="flex items-center justify-between gap-3 py-4.5 px-7 border-b border-line flex-none">
        <span className="font-serif text-[24px]">Own it</span>
        <button onClick={V.leaveOwn} data-role="leave" aria-label="Close, back to chat" title="Close, back to chat" className="bg-transparent border-none text-[20px] leading-none text-muted py-1 px-1.5 rounded-md hover:bg-accent-soft">×</button>
      </div>
      <div ref={V.panelRef} className="flex-1 overflow-auto pt-6 pb-8 px-7">
            <div className="flex flex-col gap-4.5">
              <div data-role="stepper" className="flex items-center text-[13px] phone:text-[11.5px] phone:*:mx-[3px] phone:*:not-has-[i]:min-w-1.5">
                {V.stepper.map((st, i) => <React.Fragment key={i}>
                  {i > 0 && <span className={`flex-1 min-w-3 h-[1px] my-0 mx-2.5 ${st.done || st.cur ? 'bg-good-mid' : 'bg-line-strong'}`}></span>}
                  <span className={`flex items-center gap-1.5 whitespace-nowrap ${st.cur ? 'text-ink' : st.done ? 'text-good-mid' : 'text-muted'} ${st.cur ? 'font-semibold' : st.done ? 'font-medium' : 'font-normal'}`}>
                    <i className={`w-4.5 h-4.5 rounded-full grid place-items-center text-[11px] not-italic ${st.done ? 'bg-good-mid text-on-accent' : st.cur ? 'bg-accent text-on-accent' : 'border border-line-strong'}`}>{st.done ? '✓' : i + 1}</i>{st.label}
                  </span>
                </React.Fragment>)}
              </div>
              {V.ownPhaseLabel.startsWith('Try it · ') && <span className="text-[12px] text-muted -mt-2">{V.ownPhaseLabel.slice(9)}</span>}

              {/* No copy of Claude's text here: the owned part stays highlighted in the chat itself. */}
              <div className="flex flex-col gap-2.5 pt-2.5">
                {!V.phaseFocus && <span className="text-[12px] font-semibold tracking-[.06em] text-muted">OWNING</span>}
                <span data-role="own-title" className="font-serif text-[28px] leading-[1.2] tracking-[-.01em]">{V.phaseFocus ? 'What do you want to own here?' : V.focusLabel || V.ownTitle}</span>
                <span className="flex gap-4 text-[13px] text-muted">
                  {!!V.phasePredict && <button onClick={V.changeFocus} data-role="change-focus" className="bg-transparent border-none p-0 text-[13px] text-muted underline underline-offset-[2px]">Change</button>}
                  <button onClick={V.rereadChat} data-role="reread" className="bg-transparent border-none p-0 text-[13px] text-muted underline underline-offset-[2px]">{V.ownWhole ? 'Reread it in your chat' : 'See the highlighted part in your chat'}</button>
                </span>
              </div>
              <div className="border-t border-line mt-1.5 mb-1"></div>

              {!!(V.phaseFocus) && (<>
                <div className="flex flex-col gap-3">
                  {!!(V.focusLoading) && (<><div className="text-[13px] text-accent-text animate-blink">Looking at what you highlighted…</div></>)}
                  <div className="flex flex-col gap-1.5">
                    {V.focusOptions.map((f, _i) => (
                      <button key={_i} onClick={f.onPick} className="text-left bg-surface border border-accent-border rounded-[10px] py-[11px] px-3.5 flex justify-between items-center gap-3 text-[14px] hover:border-accent">
                        <span>{f.label}</span><span className="text-[11px] text-muted flex-none">{f.kind}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={V.focusOther} onChange={V.onFocusOther} onKeyDown={V.onFocusOtherKey} placeholder="Something else…" className="flex-1 border border-accent-border rounded-lg py-[9px] px-3 text-[13.5px] bg-surface outline-none" />
                    <button onClick={V.submitFocusOther} className="bg-transparent border border-accent-border rounded-lg py-2 px-[13px] text-[13px] text-accent-text hover:bg-accent-soft">Use this</button>
                  </div>
                  <div className="text-[12.5px] text-muted">Your answer decides what you practise and what gets checked at the end.</div>
                </div>
              </>)}

              {!!(V.phaseSpot) && <SpotPractice {...V.spotProps} />}

              {!!(V.phasePredict) && (<>
                <div className="flex flex-col gap-4.5">
                  {!!V.predictTask && (
                    <div data-role="predict-try" className="flex flex-col gap-2 bg-surface border border-line rounded-xl py-4 px-4.5">
                      <div className="text-[11px] font-semibold tracking-[.06em] text-muted">YOUR TRY</div>
                      <div className="text-[14.5px] leading-normal">{inline(V.predictTask)}</div>
                      <div className="text-[13px] text-ink-2">{V.predictWhat}</div>
                      {V.predictTopics.length > 0 && <ul data-role="predict-topics" className="m-0 pl-4.5 text-[13px] leading-[1.6] text-ink-2">{V.predictTopics.map((t, i) => <li key={i}>{t}</li>)}</ul>}
                    </div>
                  )}
                  <div className="text-[20px] font-medium leading-[1.3]">{V.predictQuestion}</div>
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.max(2, V.predictOptions.length)},1fr)` }}>
                    {(V.predictOptions || []).map((p, _i) => (
                      <button key={_i} onClick={p.onPick} data-role="predict-option" data-n={p.n} aria-pressed={p.selected} className={`bg-surface rounded-xl h-22 phone:h-18 flex flex-col items-center justify-center gap-1 box-border ${p.selected ? 'border-[2px] border-accent' : 'border border-line-strong'} hover:border-accent`}>
                        <span className={`font-serif text-[32px] ${p.selected ? 'text-accent' : 'text-ink'}`}>{p.n}</span><span className={`text-[12px] ${p.selected ? 'text-accent' : 'text-muted'}`}>{p.label}</span>
                      </button>
                    ))}
                  </div>
                  <div data-role="predict-hint" className="text-[14px] leading-[1.55] text-muted">Not sure? <button onClick={V.rereadChat} data-role="predict-reread" className="bg-transparent border-none p-0 text-[14px] text-muted underline underline-offset-[2px]">Reread {V.predictReread}</button> before you lock in a number.{!!V.predictLow && <> {V.predictLow}</>}</div>
              <div data-role="no-idea" className="text-[13.5px] leading-normal text-ink-2 border-t border-line pt-3.5">
                No idea where to start? <button onClick={V.askClaudeFirst} data-role="ask-first-predict" className="bg-transparent border-none p-0 text-[13.5px] text-accent-text underline underline-offset-[2px]">Have Claude walk you through it first</button>, step by step in the chat. Come back to Own it after.
              </div>
                </div>
              </>)}

              {!!(V.phaseLadder) && (<>


                {!!(V.stepSee && V.seeTimeline) && <EffectTimeline code={V.ownCode} onDone={V.goWrite} />}
                {!!(V.stepSee && !V.seeTimeline) && (<>
                  <div className="flex flex-col gap-3.5">
                    <div className="text-[14.5px] leading-normal">{V.seeIntro}</div>
                    {!!(V.seeLoading) && (<><div className="text-[13px] text-accent-text animate-blink">Working out the steps…</div></>)}
                    {!!(V.seeReady) && (<>
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 items-start">
                        <div className="flex flex-col gap-[3px]">
                          {(V.seeClauses || []).map((c, _i) => (<React.Fragment key={_i}>
                            <div className={`flex gap-2.5 items-baseline py-[5px] px-[9px] rounded-md font-mono text-[12px] whitespace-pre-wrap ${c.cls}`}><span className="text-[10px] w-3.5 flex-none opacity-[.7]">{c.order}</span>{c.text}</div>
                          </React.Fragment>))}
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="text-[11px] font-semibold tracking-[.05em] uppercase text-muted">{V.seeStepKicker}</div>
                          <div className="text-[13px] font-medium font-mono leading-[1.4]">{V.seeStepTitle}</div>
                          <div className="text-[12.5px] text-ink-2 leading-[1.45]">{V.seeStepNote}</div>
                          {!!(V.seeHasTable) && (<>
                            <div className="border border-line rounded-lg overflow-hidden bg-surface">
                              <div className="grid text-[11px] font-semibold text-muted py-[5px] px-2.5 border-b border-line-soft gap-2" style={{ gridTemplateColumns: V.seeCols }}>
                                {(V.seeHeaders || []).map((h, _i) => (<React.Fragment key={_i}><span>{h.t}</span></React.Fragment>))}
                              </div>
                              {(V.seeRows || []).map((r, _i) => (<React.Fragment key={_i}>
                                <div className={`grid font-mono text-[12px] py-1 px-2.5 gap-2 animate-[rise_.25s_ease] ${r.cls}`} style={{ gridTemplateColumns: V.seeCols }}>
                                  {(r.cells || []).map((cell, _i) => (<React.Fragment key={_i}><span className="whitespace-nowrap overflow-hidden text-ellipsis">{cell.t}</span></React.Fragment>))}
                                </div>
                              </React.Fragment>))}
                            </div>
                            <div className="text-[11.5px] text-muted">{V.seeRowCount}</div>
                          </>)}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center justify-between">
                        <div className="flex gap-1.5">
                          <button onClick={V.seePrev} className="bg-transparent border border-line-strong rounded-lg py-[7px] px-3 text-[13px] hover:bg-sunken">← Back</button>
                          {!!(V.seeHasNext) && (<><button onClick={V.seeNext} className="bg-inverse text-on-inverse border-none rounded-lg py-[7px] px-3.5 text-[13px]">Next step →</button></>)}
                        </div>
                        {!!(V.seeAtEnd) && (<><button onClick={V.goNext} className="bg-accent text-on-accent border-none rounded-[9px] py-[9px] px-3.5 text-[13.5px]">{V.seeNextLabel}</button></>)}
                  </div>
                    </>)}
                  </div>
                </>)}

                {!!(V.stepAsm) && (<>
                  <div className="flex flex-col gap-3.5">
                    <div className="text-[14.5px] leading-normal">A warm-up, not scored: the pieces, shuffled. Tap them into your version in the order they're written.{V.asmHasDecoy ? ' One piece doesn\'t belong.' : ''}</div>
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3.5 items-start">
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[11px] font-semibold tracking-[.05em] uppercase text-muted">Pieces</div>
                        {(V.asmBank || []).map((p, _i) => (<React.Fragment key={_i}>
                          <button onClick={p.onClick} className="text-left bg-surface border border-line rounded-[7px] py-[7px] px-2.5 font-mono text-[12px] whitespace-pre-wrap hover:border-accent hover:bg-accent-soft">{p.text}</button>
                        </React.Fragment>))}
                        {!!(V.asmBankEmpty) && (<><div className="text-[12px] text-muted py-1.5">All pieces placed.</div></>)}
                      </div>
                      <div className="flex flex-col gap-1.5 min-h-30 border border-dashed border-accent-border rounded-lg p-2.5">
                        <div className="text-[11px] font-semibold tracking-[.05em] uppercase text-accent-text">Your version</div>
                        {(V.asmSeq || []).map((p, _i) => (<React.Fragment key={_i}>
                          <div className="flex gap-1.5 items-stretch">
                            <button onClick={p.onClick} className={`flex-1 text-left rounded-[7px] py-[7px] px-2.5 font-mono text-[12px] whitespace-pre-wrap border ${p.cls} hover:border-muted`}>{p.text}</button>
                            <button onClick={p.up} className="bg-transparent border border-line rounded-md py-0 px-[7px] text-[11px] text-muted">↑</button>
                            <button onClick={p.down} className="bg-transparent border border-line rounded-md py-0 px-[7px] text-[11px] text-muted">↓</button>
                          </div>
                        </React.Fragment>))}
                      </div>
                    </div>
                    {!!(V.asmFeedback) && (<>
                      <div className="border-l-[2px] border-accent py-1 px-3 text-[13.5px] leading-normal text-accent-deep bg-accent-soft rounded-r-lg">{V.asmFeedbackText}</div>
                    </>)}
                    {!!(V.asmNotCorrect) && (<>
                      <div className="flex gap-2 items-center">
                        <button onClick={V.checkAsm} className="bg-inverse text-on-inverse border-none rounded-[9px] py-[9px] px-3.5 text-[13.5px]">Check order</button>
                        {!!(V.asmLoading) && (<><span className="text-[12.5px] text-accent-text animate-blink">checking…</span></>)}
                      </div>
                    </>)}
                    {!!(V.asmCorrect) && (<>
                      <div className="flex flex-col gap-2.5">
                        <label className="text-[14px]">{V.asmWhyPrompt}</label>
                        <input value={V.asmWhy} onChange={V.onAsmWhy} placeholder="Your words, one line" className="border border-accent-border rounded-lg py-2.5 px-3 text-[14px] bg-surface outline-none" />
                        <button onClick={V.goWrite} className="self-start bg-accent text-on-accent border-none rounded-[9px] py-[9px] px-3.5 text-[13.5px]">Now write one yourself →</button>
                      </div>
                    </>)}
                  </div>
                </>)}

                {!!(V.stepCompare) && (<>
                  <div className="flex flex-col gap-3.5">
                    {!!(V.conceptLoading) && <div className="text-[13px] text-accent-text animate-blink">Working out the core idea…</div>}
                    {!!(V.hasConcept) && (
                      <div data-role="refresher-card" className="flex flex-col gap-2.5">
                        <button onClick={V.toggleRefresher} className="self-start bg-transparent border-none p-0 text-[12.5px] text-accent-text">{V.refresherOpen ? '▾' : '▸'} Refresher: the idea in one card</button>
                        {!!(V.refresherOpen) && (<>
                      <div className="flex flex-col gap-3.5 bg-surface border border-line-soft rounded-[10px] py-4 px-4.5">
                        <div className="font-serif text-[19px] leading-[1.35] tracking-[-.005em]">{V.conceptModel}</div>
                        {!!(V.conceptGrid) && (<>
                          <div className="border border-line rounded-lg overflow-hidden">
                            <div className="grid gap-2.5 py-[7px] px-3 bg-page border-b border-line-soft text-[11px] font-semibold text-muted tracking-[.03em]" style={{ gridTemplateColumns: V.conceptGrid.cols }}>
                              {V.conceptGrid.headers.map((h, j) => <span key={j}>{h.t}</span>)}
                            </div>
                            {V.conceptGrid.rows.map((r, i) => (
                              <div key={i} className={`grid gap-2.5 py-2 px-3 text-[13px] leading-[1.4] items-baseline ${i ? 'border-t border-sunken' : 'border-t-0'}`} style={{ gridTemplateColumns: V.conceptGrid.cols }}>
                                {r.cells.map((c, j) => <span key={j} className={`${c.first ? 'text-[12px]' : 'text-[13px]'} ${c.strong ? 'text-good-text' : 'text-ink'} ${c.first ? 'font-mono' : 'font-[inherit]'} ${c.strong ? 'font-semibold' : 'font-normal'}`}>{c.t}</span>)}
                              </div>
                            ))}
                          </div>
                        </>)}
                        {!!(V.conceptInYourCode) && (<>
                          <div className="flex flex-col gap-[3px]">
                            <div className="text-[11px] font-semibold tracking-[.05em] uppercase text-accent-text">{V.conceptInLabel}</div>
                            <div className="text-[14px] leading-normal">{V.conceptInYourCode}</div>
                          </div>
                        </>)}
                        {!!(V.conceptRule) && (<>
                          <div className="flex flex-col gap-[3px]">
                            <div className="text-[11px] font-semibold tracking-[.05em] uppercase text-accent-text">Rule of thumb</div>
                            <div className="text-[14px] leading-normal">{V.conceptRule}</div>
                          </div>
                        </>)}
                      </div>
                        </>)}
                      </div>
                    )}
                    <div className="text-[14.5px] leading-normal">{V.cmpIntro}</div>
                    {!!(V.cmpLoading) && (<><div className="text-[13px] text-accent-text animate-blink">Building the comparison…</div></>)}
                    {!!(V.cmpHasSource) && (<>
                      <div className="grid grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] gap-3 items-start">
                        {V.cmpSource.map((t, _i) => (
                          <div key={_i} className="flex flex-col gap-1">
                            <div className="text-[11px] font-semibold tracking-[.05em] uppercase text-muted">{t.name}</div>
                            <CompareTable t={t} />
                          </div>
                        ))}
                      </div>
                    </>)}
                    {!!(V.cmpHasCases) && (<>
                      <div className="flex gap-1.5 flex-wrap">
                        {V.cmpTabs.map((tb, _i) => (
                          <button key={_i} onClick={tb.onClick} className={`font-mono text-[12px] py-1.5 px-[11px] rounded-full border-none hover:shadow-[inset_0_0_0_1px_var(--color-accent)] ${tb.cls}`}>{tb.label}</button>
                        ))}
                      </div>
                      <pre className="m-0 py-2.5 px-3.5 bg-sunken rounded-lg font-mono text-[12.5px] leading-[1.55] whitespace-pre-wrap">{V.cmpCode}</pre>
                      {!!(V.cmpHidden && V.cmpIsTable) && (<>
                        <div className="flex flex-col gap-2">
                          <div className="text-[14px]">How many rows come back?</div>
                          <div className="flex gap-1.5">
                            {V.cmpGuessOptions.map((g, _i) => (
                              <button key={_i} onClick={g.onPick} className="flex-1 border border-accent-border bg-surface rounded-[9px] py-[9px] px-0 font-serif text-[18px] hover:border-accent">{g.n}</button>
                            ))}
                          </div>
                        </div>
                      </>)}
                      {!!(V.cmpHidden && V.cmpIsPick) && (<>
                        <div className="flex flex-col gap-2">
                          <div className="text-[14px]">{V.cmpAsk}</div>
                          <div className="flex gap-1.5">
                            {V.cmpPickOptions.map((g, _i) => (
                              <button key={_i} onClick={g.onPick} className="flex-1 border border-accent-border bg-surface rounded-[9px] py-[9px] px-0 font-serif text-[17px] hover:border-accent">{g.l}</button>
                            ))}
                          </div>
                        </div>
                      </>)}
                      {!!(V.cmpHidden && !V.cmpIsTable && !V.cmpIsPick) && (<>
                        <div className="flex gap-2">
                          <input value={V.cmpGuessText} onChange={V.onCmpGuessText} placeholder="What do you think happens? (optional)" className="flex-1 border border-accent-border rounded-lg py-[9px] px-3 text-[13.5px] bg-surface outline-none" />
                          <button onClick={V.cmpRevealText} className="bg-inverse text-on-inverse border-none rounded-lg py-2 px-[13px] text-[13px]">Show me</button>
                        </div>
                      </>)}
                      {!!(V.cmpShown) && (<>
                        <div className="flex flex-col gap-2 animate-[rise_.25s_ease]">
                          {!!(V.cmpResultLine) && (<><div className="text-[13.5px] font-medium">{V.cmpResultLine}</div></>)}
                          {!!(V.cmpTable) && (<><CompareTable t={V.cmpTable} /></>)}
                          {!!(V.cmpDiagram) && <OwnDiagram d={V.cmpDiagram} />}
                          {!!(V.cmpPatterns) && (<>
                            <div data-role="patterns" className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1">
                              {V.cmpPatterns.map((p, _i) => <span key={_i} className={`font-mono text-[12px] text-center py-1 px-0 rounded-[5px] ${p.miss ? 'bg-accent-soft text-accent-text' : 'bg-good-soft text-good-text'} ${p.miss ? 'font-semibold' : 'font-normal'}`}>{p.p}</span>)}
                            </div>
                            <div className="text-[12px] text-muted">{V.cmpPatternLine}</div>
                          </>)}
                          {!!(V.cmpOutcome) && (<><div className="text-[13.5px] leading-normal"><b>What happens:</b> {V.cmpOutcome}</div></>)}
                          <div className="border-l-[2px] border-accent py-1 px-3 text-[13.5px] leading-normal text-accent-deep bg-accent-soft rounded-r-lg">{V.cmpNote}</div>
                          {!!(V.cmpHasNextCase) && (<><button onClick={V.cmpNextCase} className="self-start bg-transparent border border-line-strong rounded-lg py-[7px] px-3 text-[13px] hover:bg-sunken">Next case →</button></>)}
                        </div>
                      </>)}
                    </>)}
                    {!!(V.cmpAllSeen) && (<><button onClick={V.goNext} className="self-start bg-accent text-on-accent border-none rounded-[9px] py-[9px] px-3.5 text-[13.5px]">{V.cmpNextLabel}</button></>)}
                  </div>
                </>)}

                {!!(V.stepWrite) && (<>
                  <div className="flex flex-col gap-3">
                    <div className="text-[11px] font-semibold tracking-[.05em] uppercase text-accent-text">{V.writeFixing ? `Fixing it · try ${V.writeTry}` : 'Your turn'}</div>
                    {!!(V.writeFixing) && <div className="text-[13px] text-ink-2 bg-sunken rounded-lg py-[7px] px-[11px] leading-[1.45]"><b className="text-accent-text">What to fix:</b> {inline(V.writeLastGap || "")}</div>}
                    {!!(V.writeLoading) && (<><div className="text-[13px] text-accent-text animate-blink">Picking a variant for you…</div></>)}
                    {!!V.notReady && (
                      <div data-role="not-ready" className="text-[13px] text-ink-2 bg-sunken rounded-lg py-2 px-[11px] leading-[1.45] flex gap-2 items-center flex-wrap">
                        <span>Not ready yet? Ask Claude about it first, then come back.</span>
                        <button onClick={V.askClaudeFirst} data-role="ask-first" className="bg-transparent border-none p-0 text-[13px] text-accent-text underline underline-offset-[2px]">Ask Claude first</button>
                        <span className="text-muted">or give it a go: a wrong first try still teaches.</span>
                      </div>
                    )}
                    <div className="text-[15px] leading-normal">{inline(V.writeTask || '')}</div>
                    {V.writeRefresher.length > 0 && (
                      <div data-role="refresher" className="text-[12.5px] text-muted flex gap-2 items-center flex-wrap">
                        <span>{V.writeRefresher.length > 1 ? 'Want a warm-up first?' : V.writeRefresher[0].label === 'See it visually' ? 'Want a picture of it first?' : 'Want a warm-up first?'}</span>
                        {V.writeRefresher.map((r, i) => <button key={i} onClick={r.onClick} className="bg-transparent border-none p-0 text-[12.5px] text-accent-text underline underline-offset-[2px]">{r.label}</button>)}
                      </div>
                    )}
                    {!!(V.hasWriteSchema) && (<>
                      <div className="flex flex-col gap-1">
                        <div className="text-[11px] font-semibold tracking-[.05em] uppercase text-muted">What you have to work with</div>
                        {isMdBlock(V.writeSchema) ? <div data-role="schema-md" className="text-[13px]"><Md text={V.writeSchema} small /></div> : <pre className="m-0 py-[9px] px-3 bg-sunken rounded-lg font-mono text-[12px] leading-[1.55] whitespace-pre-wrap text-ink-2">{V.writeSchema}</pre>}
                      </div>
                    </>)}
                    {!!(V.writeBefore) && (<><pre className="m-0 py-2 px-3 font-mono text-[13px] leading-[1.55] whitespace-pre-wrap text-muted bg-sunken rounded-lg">{V.writeBefore}</pre></>)}
                    {!!(V.writeIsChoice) && <ChoiceQuestions qs={V.writeQs} picked={V.writePicked} onPick={V.onWritePick} />}
                    {!!(V.writeIsSteps) && <StepInputs steps={V.writeSteps} entered={V.writePicked} onEnter={V.onWritePick} />}
                    {!V.writeIsChoice && !V.writeIsSteps && <textarea data-role="write" value={V.writeText} onChange={V.onWriteText} placeholder={V.writePlaceholder} className={`w-full resize-y border border-accent-border rounded-lg py-2.5 px-3 font-mono text-[13px] bg-surface outline-none leading-[1.55] ${V.writeBefore ? 'min-h-18' : 'min-h-30'}`}></textarea>}
                    {!!(V.writeAfter) && (<><pre className="m-0 py-2 px-3 font-mono text-[13px] leading-[1.55] whitespace-pre-wrap text-muted bg-sunken rounded-lg">{V.writeAfter}</pre></>)}
                    {!!(V.hasHints) && (<>
                      <div className="flex flex-col gap-[5px]">
                        {(V.hints || []).map((h, _i) => (<React.Fragment key={_i}><div className="text-[13px] text-ink-2 leading-[1.45] flex gap-2"><span className="text-accent-text flex-none">Hint {h.n}</span><span>{h.t}</span></div></React.Fragment>))}
                      </div>
                    </>)}
                    {!!(V.writeNotGraded) && (<>
                  <div className="flex gap-2 mt-6 items-center flex-wrap">
                        <button onClick={V.submitWrite} className="bg-inverse text-on-inverse border-none rounded-[9px] py-[9px] px-3.5 text-[13.5px]">Check my version</button>
                        <button onClick={V.askHint} className="bg-transparent border border-line-strong rounded-[9px] py-2 px-[13px] text-[13px] text-ink-2 hover:bg-sunken">Give me a hint</button>
                        <button onClick={V.askAboutIt} data-role="ask-stuck" className="bg-transparent border-none text-[13px] text-accent-text">Stuck? Ask Claude in the chat</button>
                        {!!(V.gradeLoading) && (<><span className="text-[12.5px] text-accent-text animate-blink">{V.gradeLoadingText}</span></>)}
                      </div>
                    </>)}
                  </div>
                </>)}


              </>)}

              {!!(V.phaseReveal) && (<>
                <div className="flex flex-col gap-4.5">
                  <div className="font-serif text-[22px] leading-tight tracking-[-.01em]">{V.revealHeadline}</div>
                  <div className="relative pt-7 pb-2">
                    <div className="absolute left-[7%] right-[7%] top-11.5 h-0.5 bg-line"></div>
                    <div className="grid relative" style={{ gridTemplateColumns: V.revealCols }}>
                      {(V.revealNodes || []).map((n, _i) => (<React.Fragment key={_i}>
                        <div className="flex flex-col items-center gap-2 text-center px-1.5">
                          <div className="h-4.5 text-[11px] text-accent-text font-semibold whitespace-nowrap">{n.above}</div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-on-accent border-2 ${n.dot}`}>{n.mark}</div>
                          <div className={`text-[12.5px] font-medium ${n.fg}`}>{n.label}</div>
                          <div className="text-[12px] text-muted leading-[1.4]">{n.detail}</div>
                        </div>
                      </React.Fragment>))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 border-t border-line-soft pt-3.5">
                    <div className="flex justify-between text-[11px] text-muted"><span>0</span><span>{V.revealN}</span></div>
                    <div className="relative h-9">
                      <div className="absolute left-0 right-0 top-[17px] h-0.5 bg-line"></div>
                      <div className="absolute top-[11px] h-3.5 w-3.5 rounded-full bg-accent -translate-x-1/2" style={{ left: V.predLeft }}></div>
                      <div className="absolute top-[11px] h-3.5 w-3.5 rounded-full bg-good -translate-x-1/2 animate-[rise_.5s_ease]" style={{ left: V.actLeft }}></div>
                      <div className="absolute top-[17px] h-0.5 bg-muted origin-left animate-[grow_.6s_ease]" style={{ left: V.gapLeft, width: V.gapWidth }}></div>
                    </div>
                    <div className="flex gap-4 text-[12.5px]"><span className="text-accent-text">● You said {V.ownPredictionN} of {V.revealN}</span><span className="text-good-text">● You got {V.actualN}</span></div>
                  </div>
                  <div className="text-[14.5px] leading-[1.55]">{V.revealLine}</div>
                  <div data-role="saved-line" className="flex gap-2 items-center text-[13px] text-good-text"><span className="w-1.5 h-1.5 rounded-full bg-good"></span>Saved to Learnings. It comes back for a quick recall in 3 days.</div>
                  {!!(V.revealFixLine) && <div data-role="fix-line" className="text-[13.5px] leading-normal text-good-text bg-good-soft rounded-lg py-[7px] px-[11px]">{V.revealFixLine}</div>}
                  {V.revealItems.length > 0 && <ItemList items={V.revealItems} ownedNote={V.revealOwnedNote} title={V.revealScale} />}
                  {!!V.revealWhy && <div title={V.revealScale} className="text-[13.5px] leading-normal text-ink-2">{V.revealWhy}</div>}
                  {!!(V.revealCorrection) && (<><div className="text-[13px] leading-normal text-ink-2 bg-sunken rounded-lg py-[7px] px-[11px]">{V.revealCorrection}</div></>)}
                  {!!V.yourAnswer && (
                    <details data-role="your-answer" className="text-[13.5px] text-ink-2">
                      <summary className="cursor-pointer text-[13px] text-muted">Your answer</summary>
                      <div className={`mt-1.5 bg-sunken rounded-lg py-[9px] px-3 whitespace-pre-wrap leading-normal ${V.yourAnswerMono ? 'font-mono text-[12.5px]' : ''}`}>{V.yourAnswer}</div>
                    </details>
                  )}
                  {!!(V.hasGap) && (<><div className="text-[13.5px] leading-normal text-ink-2"><b className="text-accent-text">What to fix:</b> {inline(V.gradeGap || '')}</div></>)}
                  {V.revealTables.length > 0 && (
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 items-start">
                      {V.revealTables.map((t, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="text-[11px] font-semibold tracking-[.05em] uppercase text-muted">{t.title}</div>
                          {t.empty ? <div className="text-[12.5px] text-muted py-1.5">No rows.</div> : <CompareTable t={t} />}
                          {!!t.legend && <div className="text-[11.5px] text-muted">{t.legend}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {(V.revealNotes.length > 0 || V.notesLoading) && (
                    <div data-role="notes" className="flex flex-col gap-2 border-t border-line-soft pt-3">
                      <div className="text-[11px] font-semibold tracking-[.05em] uppercase text-muted">On your version</div>
                      {V.revealNotes.map((n, i) => (
                        <div key={i} className="flex gap-2.5 items-start text-[13.5px] leading-normal text-ink-2">
                          <span className={`flex-none w-4.5 h-4.5 rounded-full flex items-center justify-center text-[11px] mt-0.5 ${n.kind === 'nice' ? 'bg-good-soft text-good-text' : 'bg-accent-soft text-accent-text'}`}>{n.kind === 'nice' ? '✓' : '→'}</span>
                          <span>{!!n.quote && <code className="font-mono text-[12px] bg-sunken rounded-[5px] py-px px-1.5 mr-1.5 text-ink">{n.quote}</code>}{n.text}</span>
                        </div>
                      ))}
                      {!!V.notesLoading && <div className="text-[12.5px] text-accent-text animate-blink">Reading how you wrote it…</div>}
                    </div>
                  )}
                  <div className="flex gap-2 items-center flex-wrap">
     {!!(V.revealVisual) && <button onClick={V.revealVisual} className="bg-transparent border-none text-[13px] text-muted">See it visually</button>}
                    {!!(V.canAsk) && <button onClick={V.askAboutIt} data-role="ask-claude" className="bg-transparent border border-accent-border rounded-[9px] py-2 px-[13px] text-[13px] text-accent-text hover:bg-accent-soft">Ask Claude about this</button>}
                    {!!(V.canFix) && <button onClick={V.fixWrite} data-role="fix" className="bg-accent text-on-accent border-none rounded-[9px] py-[9px] px-3.5 text-[13.5px]">Fix it</button>}
                    <button onClick={V.finishOwn} className="bg-inverse text-on-inverse border-none rounded-[9px] py-[9px] px-3.5 text-[13.5px]">Back to chat</button>
                <button onClick={V.seeInLearnings} data-role="see-in-learnings" className="bg-transparent border border-good-border rounded-[9px] py-2 px-[13px] text-[13px] text-good-text hover:bg-sunken">See it in Learnings →</button>
                    <button onClick={V.goTeach} className="bg-transparent border border-line-strong rounded-[9px] py-2 px-[13px] text-[13px] text-ink-2 hover:bg-sunken">Optional: explain it to Sam</button>
                    <span className="text-[12px] text-muted">Sam is a beginner. Teaching closes the gap faster than rereading.</span>
                  </div>
                </div>
              </>)}

              {!!(V.phaseTeach) && (<>
                <div className="flex flex-col gap-3">
                  <div className="text-[13px] text-muted">Sam has never touched this. Explain in your own words; Sam will ask what doesn't make sense.</div>
                  <div className="flex flex-col gap-2.5 bg-sunken rounded-[10px] p-3">
                    {(V.teachMsgs || []).map((t, _i) => (<React.Fragment key={_i}>
                      <div className={`flex gap-2.5 items-start max-w-[88%] ${t.row}`}>
                        {!!(t.isSam) && (<><span className="w-6.5 h-6.5 rounded-full bg-olive text-on-accent text-[12px] flex items-center justify-center flex-none font-serif">S</span></>)}
                        <div className={`text-[14px] leading-normal py-2 px-3 rounded-[10px] whitespace-pre-wrap ${t.bubble}`}>{t.text}</div>
                      </div>
                    </React.Fragment>))}
                    {!!(V.teachLoading) && (<><div className="text-[12.5px] text-olive animate-blink">Sam is thinking…</div></>)}
                  </div>
                  {!!(V.teachOpen) && (<>
                    <div className="flex gap-2">
                      <input value={V.teachInput} onChange={V.onTeachInput} onKeyDown={V.onTeachKey} placeholder="Explain it to Sam…" className="flex-1 border border-line-strong rounded-lg py-2.5 px-3 text-[14px] bg-surface outline-none" />
                      <button onClick={V.sendTeach} className="bg-inverse text-on-inverse border-none rounded-lg py-[9px] px-3.5 text-[13.5px]">Send</button>
                    </div>
                  </>)}
                  {!!(V.teachDebriefLoading) && <div className="text-[12.5px] text-olive animate-blink">Looking back at how you explained it…</div>}
                  {!!(V.teachDebrief) && (
                    <div data-role="teach-debrief" className="flex flex-col gap-2.5 border border-line bg-surface rounded-xl py-3.5 px-4 animate-rise">
                      <div className="font-serif text-[19px]">What teaching Sam showed</div>
                      {V.teachDebrief.clear.map((c, i) => (
                        <div key={'c' + i} className="flex gap-2.5 items-start text-[13.5px] leading-normal text-ink-2">
                          <span className="flex-none w-4.5 h-4.5 rounded-full bg-good-soft text-good-text flex items-center justify-center text-[11px] mt-0.5">✓</span>
                          <span><b className="text-good-text">You explained clearly:</b> <i>“{c.quote}”</i> {c.text}</span>
                        </div>
                      ))}
                      {(V.teachDebrief.unsureRight || []).map((u, i) => (
                        <div key={'r' + i} data-role="teach-unsure-right" className="flex gap-2.5 items-start text-[13.5px] leading-normal text-ink-2">
                          <span className="flex-none w-4.5 h-4.5 rounded-full bg-good-soft text-good-text flex items-center justify-center text-[11px] mt-0.5">✓</span>
                          <span><b className="text-good-text">Unsure, but right:</b> you said <i>“{u.quote}”</i> That holds. You knew more than you trusted.</span>
                        </div>
                      ))}
                      {V.teachDebrief.unsure.map((u, i) => (
                        <div key={'u' + i} data-role="teach-gap" className="flex flex-col gap-2 bg-accent-soft border border-accent-soft-2 rounded-[10px] py-2.5 px-3">
                          <div className="flex gap-2.5 items-start text-[13.5px] leading-normal text-ink-2">
                            <span className="flex-none w-4.5 h-4.5 rounded-full bg-accent-soft text-accent-text flex items-center justify-center text-[11px] mt-0.5">?</span>
                            <span><b className="text-accent-text">You weren't sure:</b> Sam asked <i>“{u.question}”</i> and you said <i>“{u.quote}”</i></span>
                          </div>
                          <div className="text-[13px] text-accent-deep pl-7">That's a gap you didn't know you had: <b>{u.topic}</b>.</div>
                          <div className="flex gap-2 pl-7 flex-wrap">
                            <button onClick={() => V.exploreTeachGap(u)} className="bg-accent text-on-accent border-none rounded-lg py-1.5 px-3 text-[12.5px]">Explore this gap with Claude</button>
                            {V.gapTopics.includes(u.topic)
                              ? <span className="text-[12.5px] text-good-text self-center">✓ Saved to Learnings</span>
                              : <button onClick={() => V.saveTeachGap(u)} className="bg-transparent border border-accent-border rounded-lg py-1.5 px-3 text-[12.5px] text-accent-text hover:bg-accent-soft">Save for later</button>}
                          </div>
                        </div>
                      ))}
                      {V.teachDebrief.unsure.length === 0 && <div className="text-[13px] text-good-text">No shaky spots: you answered every question Sam asked. Explaining it is the strongest sign you own it.</div>}
                    </div>
                  )}
              <div className="flex gap-2">{!!(V.canWrap) && <button onClick={V.wrapTeach} className="bg-transparent border border-line-strong rounded-[9px] py-2 px-[13px] text-[13px] text-ink-2 hover:bg-sunken">I'm done explaining</button>}<button onClick={V.finishOwn} className="bg-transparent border border-line-strong rounded-[9px] py-2 px-[13px] text-[13px] text-ink-2">Done, back to chat</button><button onClick={V.seeInLearnings} data-role="see-in-learnings" className="bg-transparent border-none py-0 px-1 text-[13px] text-good-text underline underline-offset-[2px]">See it in Learnings →</button></div>
                </div>
              </>)}

            </div>
      </div>
      {!!V.phasePredict && (
        <div data-role="predict-footer" className="flex-none flex justify-between items-center gap-3 pt-4.5 pb-5.5 px-7 border-t border-line">
          <button onClick={V.leaveOwn} className="bg-transparent border-none p-0 text-[14px] text-muted">Never mind</button>
          <button onClick={V.lockPrediction} data-role="predict-lock" disabled={V.predSel == null} className={`border-none rounded-full py-3 px-5.5 text-[15px] font-medium ${V.predSel == null ? 'bg-line text-muted cursor-default' : 'bg-accent text-on-accent cursor-pointer'}`}>{V.predSel == null ? 'Pick a number to start' : `Lock in ${V.predSel} · start`}</button>
        </div>
      )}
    </aside>
  );
}
