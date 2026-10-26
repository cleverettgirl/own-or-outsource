// Teach one: explain what you own to Sam, a beginner, then see what explaining showed. Used by the Own it panel
// (after a try) and by Learnings (any time, or after a recall), so both get the same Sam and the same debrief.
import { ask, complete } from './claude.js';
import { isColdStart } from './gaps.js';

// Is what you're owning code? The replayed chats say so themselves; otherwise it's code only when the try was
// writing code. A live answer about a health headline or leadership is an idea, so Sam asks about an idea.
export const isCodeOwn = own =>
  own.scenario
    ? !own.scenario.prose
    : !!own.write && own.write.format === 'code';

export const samOpening = own =>
  (own.scenario && own.scenario.samOpen) ||
  (isCodeOwn(own)
    ? "Hey! So I've never done this before. Can you tell me what this code is for, like, what problem it solves?"
    : "Hi! I've never come across this before. What's the main idea, in plain words, and why does it matter?");

// Sam's next line. `gap` is what a check found you missed, if anything, so Sam can steer one question toward it.
export async function samReply({ own, material, msgs, turns, gap }) {
  try {
    const hist = msgs.map(m => ({
      role: m.role === 'sam' ? 'assistant' : 'user',
      content: m.text,
    }));
    // The API needs the conversation to open with a user turn; Sam speaks first in the UI.
    if (hist[0].role === 'assistant')
      hist.unshift({
        role: 'user',
        content: '(The learner opens the chat with Sam.)',
      });
    const reply = await complete({
      task: 'sam',
      input: {
        lang: own.lang,
        prose: !isCodeOwn(own),
        code: material,
        gap,
        last: turns >= 3,
      },
      messages: hist,
    });
    return String(reply).trim();
  } catch (e) {
    const sl = own.scenario && own.scenario.samLines;
    return sl
      ? sl[Math.min(turns, 3) - 1]
      : turns >= 3
        ? 'Ok I think I get it: you squash the rows into one per person first, and only then can you ask about the totals. Thanks!'
        : turns === 1
          ? "Hm ok. So the part that filters, does it look at every single row, or at the totals? I don't get when the totals show up."
          : "Wait so if I wanted only people whose total is big, why can't I just put that in the first filter?";
  }
}

// The aha of teaching: what you explained clearly, and where you weren't sure (a gap you didn't know you had).
// Claude reads the conversation and must quote your words; offline, hedges ("not sure", "I guess") mark the gaps.
export async function debriefTeach({ label, msgs }) {
  const mine = msgs.filter(m => m.role === 'user').map(m => m.text);
  const samBefore = i => {
    for (let k = i - 1; k >= 0; k--)
      if (msgs[k].role === 'sam') return msgs[k].text;
    return '';
  };
  const quoted = (q, list) =>
    q &&
    list.some(t =>
      t.toLowerCase().includes(String(q).toLowerCase().trim().slice(0, 25)),
    );
  try {
    const r = await ask('debrief', { label, msgs });
    // Hedged but right is underconfidence, the other half of calibration: shown as "unsure, but right", not a gap.
    const unsure = (r.unsure || [])
      .filter(u => quoted(u.quote, mine) && u.topic)
      .slice(0, 2);
    return {
      clear: (r.clear || []).filter(c => quoted(c.quote, mine)).slice(0, 2),
      unsure: unsure.filter(u => !u.right),
      unsureRight: unsure.filter(u => u.right),
    };
  } catch (e) {
    const hedge =
      /not (really |quite )?sure|i guess|i'd guess|i would guess|maybe|no idea|i think|don't know|dont know/i;
    return {
      clear: mine
        .filter(t => !hedge.test(t))
        .slice(0, 1)
        .map(t => ({
          quote: t.length > 90 ? t.slice(0, 90) + '…' : t,
          text: 'You put the core idea in your own words.',
        })),
      unsure: msgs
        .map((m, i) => ({ m, i }))
        .filter(x => x.m.role === 'user' && hedge.test(x.m.text))
        .slice(0, 2)
        .map(x => ({
          quote: x.m.text,
          question: samBefore(x.i),
          topic: isColdStart({ topic: '', question: samBefore(x.i) })
            ? 'How a two-sided platform solves the cold start'
            : (
                samBefore(x.i)
                  .replace(/^(oo+h|oh|ok|hm+|wait)[,!. ]+/i, '')
                  .split(/[.?!]/)
                  .filter(Boolean)
                  .pop() || 'The question Sam asked'
              )
                .trim()
                .slice(0, 70),
        })),
    };
  }
}
