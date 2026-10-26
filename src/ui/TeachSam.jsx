// Teach one: the conversation with Sam and what it showed. The Own it panel shows it after a try; Learnings shows
// it for anything you own. T carries the state and actions; the buttons that end it belong to whoever shows it.
import { NOTE_ROW, MARK } from './styles.js';

export default function TeachSam({ T }) {
  return (
    <div data-role="teach" className="flex flex-col gap-3">
      <div className="text-[13px] text-muted">
        Sam has never touched this. Explain in your own words; Sam will ask what
        doesn't make sense.
      </div>
      <div className="flex flex-col gap-2.5 bg-sunken rounded-[10px] p-3">
        {T.msgs.map((t, i) => (
          <div
            key={i}
            className={`flex gap-2.5 items-start max-w-[88%] ${t.isSam ? 'self-start' : 'self-end'}`}
          >
            {!!t.isSam && (
              <span className="w-6.5 h-6.5 rounded-full bg-olive text-on-accent text-[12px] flex items-center justify-center flex-none font-serif">
                S
              </span>
            )}
            <div
              className={`text-[14px] leading-normal py-2 px-3 rounded-[10px] whitespace-pre-wrap ${t.isSam ? 'bg-surface' : 'bg-bubble'}`}
            >
              {t.text}
            </div>
          </div>
        ))}
        {!!T.loading && (
          <div className="text-[12.5px] text-olive animate-blink">
            Sam is thinking…
          </div>
        )}
      </div>
      {!!T.open && (
        <div className="flex gap-2">
          <input
            value={T.input}
            onChange={T.onInput}
            onKeyDown={e => {
              if (e.key === 'Enter') T.send();
            }}
            placeholder="Explain it to Sam…"
            className="flex-1 border border-line-strong rounded-lg py-2.5 px-3 text-[14px] bg-surface outline-none"
          />
          <button
            onClick={T.send}
            className="bg-inverse text-on-inverse border-none rounded-lg py-[9px] px-3.5 text-[13.5px]"
          >
            Send
          </button>
        </div>
      )}
      {!!T.debriefLoading && (
        <div className="text-[12.5px] text-olive animate-blink">
          Looking back at how you explained it…
        </div>
      )}
      {!!T.debrief && (
        <div
          data-role="teach-debrief"
          className="flex flex-col gap-2.5 border border-line bg-surface rounded-xl py-3.5 px-4 animate-rise"
        >
          <div className="font-serif text-[19px]">What teaching Sam showed</div>
          {T.debrief.clear.map((c, i) => (
            <div key={'c' + i} className={NOTE_ROW}>
              <span className={`${MARK} bg-good-soft text-good-text`}>✓</span>
              <span>
                <b className="text-good-text">You explained clearly:</b>{' '}
                <i>“{c.quote}”</i> {c.text}
              </span>
            </div>
          ))}
          {(T.debrief.unsureRight || []).map((u, i) => (
            <div
              key={'r' + i}
              data-role="teach-unsure-right"
              className={NOTE_ROW}
            >
              <span className={`${MARK} bg-good-soft text-good-text`}>✓</span>
              <span>
                <b className="text-good-text">Unsure, but right:</b> you said{' '}
                <i>“{u.quote}”</i> That holds. You knew more than you trusted.
              </span>
            </div>
          ))}
          {T.debrief.unsure.map((u, i) => (
            <div
              key={'u' + i}
              data-role="teach-gap"
              className="flex flex-col gap-2 bg-accent-soft border border-accent-soft-2 rounded-[10px] py-2.5 px-3"
            >
              <div className={NOTE_ROW}>
                <span className={`${MARK} bg-accent-soft text-accent-text`}>
                  ?
                </span>
                <span>
                  <b className="text-accent-text">You weren't sure:</b> Sam
                  asked <i>“{u.question}”</i> and you said <i>“{u.quote}”</i>
                </span>
              </div>
              <div className="text-[13px] text-accent-deep pl-7">
                That's a gap you didn't know you had: <b>{u.topic}</b>.
              </div>
              <div className="flex gap-2 pl-7 flex-wrap">
                <button
                  onClick={() => T.explore(u)}
                  className="bg-accent text-on-accent border-none rounded-lg py-1.5 px-3 text-[12.5px]"
                >
                  Explore this gap with Claude
                </button>
                {T.gapTopics.includes(u.topic) ? (
                  <span className="text-[12.5px] text-good-text self-center">
                    ✓ {T.savedLabel || 'Saved to Learnings'}
                  </span>
                ) : (
                  <button
                    onClick={() => T.save(u)}
                    className="bg-transparent border border-accent-border rounded-lg py-1.5 px-3 text-[12.5px] text-accent-text hover:bg-accent-soft"
                  >
                    Save for later
                  </button>
                )}
              </div>
            </div>
          ))}
          {T.debrief.unsure.length === 0 && (
            <div className="text-[13px] text-good-text">
              No shaky spots: you answered every question Sam asked. Explaining
              it is the strongest sign you own it.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
