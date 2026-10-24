// Every prompt the app sends to Claude, by name. The SERVER builds each request from these (server/claude.js):
// the browser sends only a task name and its inputs, never a system prompt, a model or a token limit.
// So /api/claude can't be used as a general-purpose Claude proxy: each task's instructions are fixed here.
//
// A task: { kind, json?, system, user(input) } for one-shot calls, or { kind, system(input), chat: true } for
// conversations, where the browser also sends the turns (the chat itself, Sam).
// kind picks the model settings on the server: 'tutor' (fast), 'json' (structured), 'grade' (most thinking).

const s = v => String(v ?? '');

// ---- conversations ----
// What Claude is told in a gap chat: start from their guess, explain the missing idea concretely, end with
// one question that makes them apply it. The app does the formal check, so Claude doesn't quiz.
export function gapSystem(g) {
  return [
    `You are Claude. The person you're talking with found a gap in their own understanding and wants to close it: "${s(g.topic)}".`,
    g.origin ? `It came up ${s(g.origin)}.` : '',
    g.question ? `They were asked: "${s(g.question)}"` : '',
    g.quote ? `Their best guess was: "${s(g.quote)}"` : '',
    `Help them close it. Start from their guess: say what's right in it, then explain the missing idea concretely, with one or two real examples, in under 200 words of markdown.`,
    `End with ONE short question that asks them to apply the idea${g.context ? ` to ${s(g.context)}` : ' to their own situation'}.`,
    `In later turns, respond to what they actually say, briefly; don't lecture. Don't quiz them formally: the app checks their understanding when they say they're ready.`,
  ].filter(Boolean).join('\n');
}

const CHAT_SYSTEM = {
  answer: 'You are Claude. Answer helpfully and concisely for a working professional, in markdown, with code in fenced blocks where useful.',
  followUp: 'You are Claude, in an ongoing chat with someone who is practising what you showed them. Explain clearly and briefly, in markdown. Help them see why; do not rewrite their whole solution unless they ask.',
};

export const TASKS = {
  chat: { kind: 'tutor', chat: true, system: i => i.gap ? gapSystem(i.gap) : CHAT_SYSTEM[i.mode] || CHAT_SYSTEM.answer },

  sam: { kind: 'tutor', chat: true, system: i => `You are Sam, a friendly beginner who has never used ${s(i.lang)}. The learner is explaining this ${i.prose ? 'idea' : 'code'} to you:\n${s(i.code)}\nA grader noted this gap in the learner's understanding: "${s(i.gap)}". Gently steer one question toward that gap. Ask ONE short follow-up (under 35 words), in a casual beginner voice, never explain things yourself, never use the words "great" or "exactly". If the learner says they're unsure or guesses, do NOT answer it for them or fill it in: say it sounds like an open question. ${i.last ? 'This is the last turn: say in one sentence what you now understand, in your own naive words; if anything they explained was a guess, say plainly that part is still a mystery to you both. Then thank them.' : ''}` },

  // ---- chat: is this person working to get better at something? ----
  inferLearning: { kind: 'json', json: true, system: 'You judge intent carefully and conservatively. Strict JSON only.',
    user: i => `Someone is chatting with Claude. Their latest message:\n"${s(i.text)}"\nClaude's reply to it (excerpt):\n${s(i.answer).slice(0, 800)}\n\nIs this person working to get better at something, not just curious about it? Signs: they ask why or how something works, test their understanding ("so it's..., right?", "what if I..."), say they're confused, or try to apply the idea to a new case. A side question out of curiosity ("what about X?") or a request to do something doesn't count. Return ONLY JSON {"learning": boolean, "topic": what they want to get better at, as a short learning goal under 9 words, or ""}` },

  askedLabel: { kind: 'json', json: true, system: 'Strict JSON only.',
    user: i => `Someone asked Claude to explain this.${i.quote ? `\nPart of the answer they quoted:\n${s(i.quote)}` : ''}\nTheir question: ${s(i.question) || '(explain it)'}\nName what they want to understand as a short learning goal, under 9 words, phrased as a topic (e.g. "When an effect's cleanup runs"). Return ONLY JSON {"label": string}` },

  // ---- Own it ----
  stepQA: { kind: 'tutor', system: 'You are a patient tutor sitting next to the learner. Direct, specific, no preamble.',
    user: i => `${s(i.context)}\n\nLearner's question: ${s(i.question)}\n\nAnswer in under 90 words, plain language, referring to the sample rows or lines shown when useful.` },

  focusOptions: { kind: 'json', json: true, system: 'You return strict JSON only.',
    user: i => `A learner highlighted part of a ${s(i.lang)} answer and wants to learn it, not just use it.\nFull answer:\n${s(i.fullCode)}\n\nHighlighted:\n${s(i.code)}\n\nPropose 3 specific things they might want to own about the highlighted part, most likely first. Each must be about what the highlighted part actually says, in its own terms. Return ONLY JSON {"options":[{"label": a learning target under 9 words, phrased as a topic (e.g. "When to use LEFT vs INNER JOIN"), "mode": "sequence" if it is about the order/structure of several lines, else "concept"}]}.` },

  concept: { kind: 'json', json: true, system: 'You return strict JSON only. Be technically exact.',
    user: i => `A learner wants to own this: "${s(i.label)}".\nTheir original question: ${s(i.question) || '(not available)'}\nFull answer they got (${s(i.lang)}):\n${s(i.fullCode)}\nThe part they highlighted:\n${s(i.code)}\n\nWrite the core explanation they should read first. Do NOT give concrete outputs or results of running anything; a later step asks them to predict those. Return ONLY JSON {"model": the mental model in one sentence, "grid": {"headers": [first header empty string, then 2-3 dimensions], "rows": [[alternative name, cell, ...]]} comparing their construct with its 1-2 closest alternatives on the dimension that actually differs, or null if there are no real alternatives, "inYourCode": 1-2 sentences on why this construct fits THEIR question and code specifically, "rule": a practical rule of thumb for choosing it}. Plain words, no jargon without explanation.` },

  compare: { kind: 'json', json: true, system: 'You return strict JSON only. Be technically exact.',
    user: i => `A learner wants to own this: "${s(i.label) || 'the highlighted code'}".\nHighlighted ${s(i.lang)}:\n${s(i.code)}\nFull context:\n${s(i.fullCode)}\n\nBuild a contrasting-cases comparison: the highlighted construct next to its 2 closest alternatives a learner might confuse it with. Return ONLY JSON {"intro": one sentence, "cases":[{"label": short name, "code": a minimal snippet (max 6 lines), "outcome": what concretely happens or is returned, max 30 words, "note": why it differs from the others, max 35 words}]} with 3 cases, the learner's own construct included.` },

  annotate: { kind: 'json', json: true, system: 'You return strict JSON only.',
    user: i => `Annotate this ${s(i.lang)} code for someone learning it while doing real work. Return ONLY a JSON array of {"line": string, "note": string}, one per non-empty line, note under 22 words: what it does and why it is there.\n\n${s(i.code)}` },

  sqlBridges: { kind: 'json', json: true, system: 'You return strict JSON only.',
    user: i => `A front-end developer who knows JavaScript arrays is learning this SQL:\n${s(i.code)}\nGive 3 one-line bridges mapping SQL clauses to JS array methods they know. Return ONLY a JSON array of strings.` },

  runSteps: { kind: 'json', json: true, system: 'You return strict JSON only.',
    user: i => `Walk through how this ${s(i.lang)} ${i.lang === 'email' ? 'email lands with its reader, line by line as they read it' : 'code executes, step by step, in the order things actually happen at runtime (not the order written)'}. Return ONLY JSON: {"steps":[{"clause": short code fragment being executed, "title": string, "note": under 30 words describing the state after this step}], "bridges":[3 one-line analogies to things a front-end JavaScript developer already knows]}. 5 to 8 steps.\n\n${s(i.code)}` },

  asmFeedback: { kind: 'tutor', system: 'You are a calm tutor. Plain language.',
    user: i => `A learner is ordering shuffled lines of ${i.lang === 'email' ? 'an email' : s(i.lang) + ' code'} (a Parsons problem). Correct version:\n${s(i.correct)}\n\nTheir version:\n${s(i.yours) || '(empty)'}\n${i.distractor ? '\nThey included this piece that does not belong: ' + s(i.distractor) : ''}${i.missing ? '\nThey left ' + Number(i.missing) + ' piece(s) unplaced.' : ''}${(i.wrongLines || []).length ? '\nLines currently in the wrong position: ' + i.wrongLines.map(l => '`' + s(l) + '`').join(', ') : ''}\n\nIn at most 2 sentences, name the ONE most important line to reconsider by quoting it in backticks, and connect it to what happens at runtime (execution order). Do not give the answer. No praise, no shame.` },

  // The generated try. Choice questions must not give the answer away by length or wording (see scripts/eval-generated.mjs).
  writeTask: { kind: 'json', json: true, system: 'You design short, fair practice. Strict JSON only.',
    user: i => `A learner highlighted part of an answer and wants to own: "${s(i.label) || 'the highlighted part'}".\nHighlighted:\n${s(i.code)}\nFull answer (for context):\n${s(i.fullCode).slice(0, 3500)}\n\nDesign ONE short practice that checks they own exactly that, on a NEW small case (not the same example). Choose the format that fits:\n- "code": they write or fix a few lines. Only if producing code IS the skill being owned.\n- "choice": 2-3 multiple-choice questions about the reasoning, 2-3 options each; wrong options must be common misconceptions, each with a one-sentence "gap" explaining why it's wrong. Every question must test the learning goal itself, not a side detail. Make it impossible to pass without the idea: keep the options in a question about the same length and equally specific; don't make wrong options absolute ("always", "never", "only") while the right one is hedged; don't let the right option echo the question's wording; don't make the right option the odd one out by type. The new case must have a different answer from the example in Claude's answer.\n- "explain": one question asking them to explain the idea and apply it to the new case, with 2-3 short key points a good answer contains.\nPrefer "explain" or "code" when recalling the idea in your own words is the skill; use "choice" when the point is telling apart ideas people commonly confuse.\nAlso say whether the WRITTEN ORDER of the highlighted lines is itself what's being learned ("orderIsInsight": true only then; runtime order or timing is not written order). Return ONLY JSON {"orderIsInsight": boolean, "format": "code"|"choice"|"explain", "task": one sentence starting "Now a new situation:", "context": what they have to work with, or "", "reference": a reference solution (code only), "requirements": [2-4 short phrases, each one thing a correct answer must do, the first being the learning goal itself] (code only), "questions": [{"prompt": string, "short": the topic it checks in under 8 words, without giving the answer (e.g. "what runs first"), "options": [{"label": string, "correct": boolean, "gap": string|null}]}] (choice only), "keyPoints": [string] (explain only)}` },

  hint: { kind: 'tutor', system: 'Hints, not answers.',
    user: i => `Task: ${s(i.task)}\nReference solution (never reveal it):\n${s(i.ref)}\nLearner draft so far:\n${s(i.draft) || '(nothing yet)'}\nPrevious hints: ${(i.hints || []).map(s).join(' | ') || 'none'}\nGive ONE new hint as a question or nudge, under 25 words. Never write the code for them.` },

  // Shared grader: requirement checklist with quoted evidence; the app then applies deterministic clamps.
  grade: { kind: 'grade', json: true, system: 'Exacting, fair grader. Quote evidence, never assume. Strict JSON only.',
    user: i => `You are grading a learner's unassisted attempt.\nTask: ${s(i.task)}\nReference solution (one valid answer; alternates are fine):\n${s(i.ref)}\nLearner attempt:\n${s(i.attempt)}\n\nDifferent but reasonable table, column, alias, or variable names are fine and never count against them; judge the structure and logic. Only grade requirements the task itself states; never penalise for omitting something the task did not ask for.\n\nStep 1: ${(i.requirements || []).length ? `the requirements are fixed; check exactly these, in this order, using them as the "requirement" strings: ${i.requirements.map((q, k) => `${k + 1}. ${s(q)}`).join(' ')}` : 'list every concrete requirement implied by the task (e.g. filter, aggregate, grouping, sort direction, limit, state handling).'} Step 2: for each, quote the EXACT substring of the attempt that satisfies it, or null if none. A requirement with no quoted evidence is NOT met. Never infer something the attempt does not contain. Step 3: score. 5 = all requirements met and would run; 4 = all met, cosmetic issue; 3 = would run but result differs from the task (any unmet requirement caps at 3); 2 = would not run; 1 = not close.\n\nReturn ONLY JSON {"checks":[{"requirement": string, "quoted_evidence": string|null, "met": boolean}], "score": integer, ${i.variant === 'note' ? `"note": one sentence, specific, curious not judgmental, naming what held and what slipped` : `"worked": one sentence on what you got right, "gap": one sentence naming the specific unmet requirement (or "Nothing structural." only if every check is met)`}}. All prose addressed to the learner as "you".` },

  notes: { kind: 'json', json: true, system: 'You are a kind, precise senior reviewer. Strict JSON only.',
    user: i => `A learner's attempt has already been checked${i.gap ? ` (what to fix: ${s(i.gap)})` : ''}. Do NOT re-score it or repeat that.\nTask: ${s(i.task)}\nTheir attempt (${s(i.lang)}):\n${s(i.text)}\nAlready noted: ${(i.have || []).map(s).join(' | ') || 'nothing'}\n\nWrite 0 to 2 short notes on HOW they wrote it, beyond what the task required: good practice worth keeping (kind "nice"), or a habit worth improving (kind "improve"), e.g. robustness, readability, or a misconception visible in what they wrote. Skip anything already noted. Each note must quote an exact short fragment (under 40 characters) of their attempt. Return ONLY JSON {"notes":[{"kind":"nice"|"improve","quote":string,"text":string under 30 words, addressed to "you"}]}. Return an empty list if nothing is genuinely useful.` },

  // What teaching Sam showed. "Unsure" splits in two: hedged and wrong (a gap), hedged but right (underconfidence).
  debrief: { kind: 'json', json: true, system: 'Strict JSON only. Quote exactly.',
    user: i => `A learner explained "${s(i.label) || 'an idea'}" to a beginner named Sam. Conversation:\n${(i.msgs || []).map(m => (m.role === 'sam' ? 'Sam: ' : 'Learner: ') + s(m.text)).join('\n')}\n\nReturn ONLY JSON {"clear":[{"quote": exact words from a Learner line, "text": what that shows they understand, under 20 words}], "unsure":[{"quote": exact words from a Learner line where they hedged, guessed or got it wrong, "question": the Sam question that exposed it, "topic": the open topic as a short learning goal, under 10 words, e.g. "How an aggregator gets started", "right": true only if what they said, despite hedging, is actually correct}]}. Up to 2 clear, up to 2 unsure. Only list unsure if the learner really hedged, guessed or was wrong. Address nothing to the learner; just the JSON.` },

  // ---- gaps ----
  // The check that closes a gap: explain and apply, not recite.
  gapCheck: { kind: 'json', json: true, system: 'Strict JSON only.',
    user: g => `Write one question that checks whether someone now understands: "${s(g.topic)}".${g.context ? ` Context: ${s(g.context)}.` : ''} It must ask them to explain the idea in their own words AND apply it to a concrete case, not recall a definition. Also list 2 or 3 key points a good answer must contain, each a short phrase. Return ONLY JSON {"question": string, "keyPoints": [string]}` },

  gapJudge: { kind: 'grade', json: true, system: 'Fair, exacting, warm. Quote evidence; never assume. Strict JSON only.',
    user: i => `Someone is closing a gap in their understanding: "${s(i.topic)}".\nQuestion they answered: ${s(i.question)}\nKey points a good answer contains: ${(i.keyPoints || []).map((p, k) => `${k + 1}. ${s(p)}`).join(' ')}\nTheir answer: ${s(i.answer)}\n\nFor each key point, quote the EXACT words of their answer that show it (any wording is fine if the idea is there), or null.\nReturn ONLY JSON {"points":[{"point": string, "evidence": string|null}], "feedback": one or two warm, specific sentences to them; if a point is missing, ask about it as a question to think about, without giving the answer}` },

  // ---- you go first, when you ask again ----
  goFirstMatch: { kind: 'json', json: true, system: 'You judge carefully and conservatively. Strict JSON only.',
    user: i => `Someone has practised these ideas until they own them:\n${(i.owned || []).map((t, k) => `${k + 1}. ${s(t)}`).join('\n')}\n\nThey now ask Claude a new question:\n"${s(i.question)}"\n\nWould answering it well require applying one of those ideas to this new case (not just mentioning a related word)? If several, pick the most central. Return ONLY JSON {"match": the idea's number, or 0 if none}` },

  goFirstCompare: { kind: 'tutor', system: 'You are Claude. Warm, specific, brief. Markdown.',
    user: i => `You were asked: "${s(i.question)}"\nBefore seeing your answer, the person wrote their own:\n${s(i.attempt)}\n\nYour answer:\n${s(i.answer).slice(0, 3000)}\n\nIn 2-3 short sentences, addressed to them: what their answer got right (quote a few of their words), and the one thing that matters most where yours differs, if anything. No score, no praise words like "great". Don't repeat your whole answer; it's shown right below.` },

  // ---- recall ----
  recallTask: { kind: 'json', json: true, system: 'Strict JSON only.',
    user: i => `Write a short unassisted recall task (one sentence, starts with "From memory:") testing ${i.title ? `"${s(i.title)}"` : `the same concept as this ${s(i.lang)} code`}, plus a reference answer. Return ONLY JSON {"task": string, "reference": string}.\n${s(i.code)}` },

  gapRecall: { kind: 'json', json: true, system: 'Strict JSON only.',
    user: i => `Write one new question that checks, from memory, whether someone still understands "${s(i.topic)}" by applying it to a different concrete case than before (${s(i.before)}). Return ONLY JSON {"question": string}` },
};
