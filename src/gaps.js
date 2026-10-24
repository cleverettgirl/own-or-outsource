// Gaps: things you found you don't understand yet, by trying (teaching Sam, a missed recall).
// The loop: found → explored (a new chat with Claude about just that gap) → closed (one check of the idea)
// → kept (it becomes something you own, so recall brings it back).
//
// Why: tutors learn when explaining exposes what they don't know and they rebuild it ("knowledge-building"),
// not when they repeat what they already know ("knowledge-telling") — Roscoe & Chi 2007. The gap loop turns
// the moment Sam exposes a gap into that rebuilding, with Claude as the help and a check as the finish line.

// The prompts for the loop (the gap chat, the check, the judge) are in prompts.js, with the rest.

// ---- the cold-start gap (from teaching Sam about Juno), hand-written ----
const COLD = /cold.?start|get(s|ting)? started|first (writers|readers|users|ones)|chicken|day one|neither side|loop (gets )?start/i;
export const isColdStart = g => COLD.test(`${g.topic} ${g.question || ''}`);

export const COLD_START = {
  context: 'Juno, a writing platform that aggregates readers',
  // Shown when Claude can't be reached, so exploring still works offline.
  offlineAnswer: `Your guess points the right way: one side usually has to come first. The trick is that the platform doesn't wait for the loop to start itself. It **gives one side a reason to show up before the other side exists**.

The common moves:

- **Seed one side yourself.** Invite or pay a small group of writers so there's something worth reading on day one.
- **Bring supply that already exists.** Google didn't wait for people to write pages for it: it indexed the web that was already there.
- **Start small.** Facebook began at one university, so a small, dense group could find each other before it widened.
- **Make one side useful on its own** ("come for the tool, stay for the network"): if writing on the platform is good even with no readers, writers come first and readers follow.

For Juno: which side would you get first, and with which move?`,
  check: {
    question: 'In your own words: how does a platform like Juno get its first writers and readers when neither exists yet? Name at least one concrete move it could make.',
    keyPoints: ["It's a chicken-and-egg problem: each side waits for the other", 'A concrete way to start one side first (seed or pay writers, bring existing content, start in a small niche, or make writing valuable on its own)'],
  },
};

// Offline judge for the cold-start check: both ideas must show up in some form.
export function judgeColdStartOffline(answer) {
  const a = answer.toLowerCase();
  const p1 = /chicken|egg|each side|both sides|neither|wait(s|ing)? for|nobody|no one|empty|no readers|no writers/.test(a);
  const p2 = /seed|subsid|pay|invite|recruit|import|existing|already|niche|small|one (city|school|campus|group)|tool|on (its|their) own|without readers|first writers|bring/.test(a);
  return {
    points: [{ point: COLD_START.check.keyPoints[0], evidence: p1 ? 'yes' : null }, { point: COLD_START.check.keyPoints[1], evidence: p2 ? 'yes' : null }],
    feedback: p1 && p2 ? 'You named the problem and a concrete way out of it. That gap is closed.'
      : p2 ? "You've got a concrete move. What makes this hard in the first place: why can't the loop just start by itself?"
      : p1 ? "You've named why it's hard. What's one concrete thing Juno could do to get one side there first?"
      : 'Think about day one: what does each side need before it shows up, and how could Juno give one side that without the other?',
  };
}
