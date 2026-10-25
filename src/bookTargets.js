// Learning targets for the book starter: the Rule of Five from Douglas Hubbard's
// "How to Measure Anything". Same spec as targets.js (write · delayed · check),
// but the check is calculated (numberCheck.js) instead of run, and there is no Assemble:
// a short explanation has no order to rebuild.
//
// The anchor confusion is Christine's own (bookTranscript.js): "a median is always between the min and max, so isn't
// this obvious?" That is true of the SAMPLE's median and says nothing about the POPULATION's.

export const BOOK_TARGETS = {
  rule: {
    label: 'The Rule of Five: why a few random samples usually catch the median', kind: 'concept',
    writtenOrderMatters: false,
    // The try checks the idea in a new situation, not the arithmetic (the exact percentage isn't the skill).
    write: {
      task: 'Now a new situation: you time 4 random support calls, to get a feel for how long a typical call takes.',
      hints: ['Each sampled call is a coin flip: longer or shorter than the median of all calls. When does your range miss it?', 'Missing needs every call on the same side. Does that get more or less likely with fewer calls?', "Is the median you care about the one of your 4 calls, or of all calls?"],
      check: { type: 'choice', questions: [
        { id: 'catch', short: 'how likely it catches it', prompt: 'How likely is the range from the shortest to the longest of your 4 calls to catch the median length of ALL calls?', answer: 'likely', options: [
          { v: 'likely', l: 'Very likely, but not certain' },
          { v: 'certain', l: 'Certain: a median is always between the min and max', gap: "That's true of your 4 calls' own median. The median of all calls is the one you can't see, and your 4 could all land on one side of it. (Your original question in the chat.)" },
          { v: 'unlikely', l: 'Unlikely with only 4 calls', gap: "Even 4 is usually enough: the range only misses if all 4 land on the same side of the median, and that's rare." },
        ] },
        { id: 'fewer', short: 'how sample size changes it', prompt: 'Compared with timing 5 calls, is your range with 4 calls…', answer: 'less', ordered: true, options: [
          { v: 'less', l: 'A little less likely to catch it' },
          { v: 'same', l: 'Exactly as likely', gap: "Each call you add is another chance to land on both sides of the median. With one fewer, all of them landing on one side is a bit more likely." },
          { v: 'more', l: 'More likely to catch it', gap: 'Fewer samples make it easier for all of them to land on the same side of the median, so the range misses a bit more often.' },
        ] },
        { id: 'why', short: 'why it can miss', prompt: 'Why could your range miss the median of all calls?', answer: 'side', options: [
          { v: 'side', l: 'All 4 calls could happen to be longer, or all shorter, than it' },
          { v: 'vary', l: 'Calls vary too much in length', gap: "Variation doesn't decide it. Only which side of the median each call lands on matters." },
          { v: 'undefined', l: "The median of 4 numbers isn't well defined", gap: "With 4 numbers the median sits between the middle two, which is fine. The miss happens when all 4 are on one side of the median of ALL calls." },
        ] },
      ] },
    },
    // Recall checks the idea, not the arithmetic: why the range can miss, how sample size changes it, what breaks it.
    delayed: {
      task: 'From memory, a new situation: you note the price of 6 random houses on a long street, to get a feel for the typical (median) price of the whole street.',
      check: { type: 'choice', questions: [
        { id: 'more', short: 'how sample size changes it', prompt: "Compared with checking 5 houses, how likely is the range from the cheapest to the priciest of your 6 houses to catch the whole street's median?", answer: 'more', ordered: true, options: [
          { v: 'less', l: 'Less likely', gap: "More houses can't hurt here: the range only misses if every house lands on the same side of the median, and that gets rarer with each extra house." },
          { v: 'same', l: 'About the same', gap: "Each extra house is another chance for your samples to land on both sides of the median. Missing needs every one of them on the same side, which gets rarer with each house you add." },
          { v: 'more', l: 'More likely' },
        ] },
        { id: 'miss', short: 'when the range misses', prompt: "When would your range miss the street's median?", answer: 'side', options: [
          { v: 'side', l: 'Only if all 6 houses are above it, or all 6 are below it' },
          { v: 'spread', l: 'If the prices vary a lot', gap: "How spread out the prices are doesn't matter. All that matters is which side of the median each house lands on." },
          { v: 'never', l: 'Never: a median is always between the min and max', gap: "That's true of your 6 houses' own median, not the street's. The street's median is hidden, and your 6 could all land on one side of it. (Your original question in the chat.)" },
        ] },
        { id: 'random', short: 'what breaks it', prompt: 'Which of these would break the rule?', answer: 'biased', options: [
          { v: 'biased', l: 'You only looked at houses at the expensive end of the street' },
          { v: 'spread', l: 'The prices are very spread out', gap: "Spread doesn't matter. The rule needs the houses to be picked at random; a lopsided pick can easily put all of them on one side." },
          { v: 'six', l: 'You checked 6 houses instead of 5', gap: "More random samples only make it more likely to catch the median. It's how they're picked that can break it." },
        ] },
      ] },
    },
  },

  population: {
    label: "Why it's the population's median, not your sample's", kind: 'concept',
    writtenOrderMatters: false,
    write: {
      task: 'Now a new situation: you ask 5 random employees how long their commute is: 12, 18, 25, 31 and 47 minutes.',
      hints: ['One question is about the 5 numbers in front of you; the other is about a number you can\'t see.', "When would all 5 employees land on the same side of the company's median?"],
      check: { type: 'choice', questions: [
        { id: 'sample', short: "your 5 answers' median", prompt: 'Is the median of these 5 answers between 12 and 47?', answer: 'always', options: [
          { v: 'always', l: 'Yes, always: 25 is the middle one' },
          { v: 'likely', l: 'Very likely, but not certain', gap: "This one is certain: the middle of your own 5 numbers is 25, which is always between your smallest and largest." },
        ] },
        { id: 'company', short: "the company's median", prompt: 'Is the median commute of the whole company between 12 and 47?', answer: 'likely', options: [
          { v: 'likely', l: 'Very likely, but not certain' },
          { v: 'always', l: 'Yes, always', gap: "That treats the company's median like your sample's. The company's is hidden, and all 5 of your answers could land on one side of it. (Your original question in the chat.)" },
          { v: 'unknown', l: "Can't say anything without more data", gap: "5 random answers already make it very likely: it only misses if all 5 land on the same side of the company's median." },
        ] },
      ] },
    },
    delayed: {
      task: 'From memory, a new situation: you weigh 4 random apples from a big crate.',
      check: { type: 'choice', questions: [
        { id: 'which', short: 'which median is certain', prompt: 'Which median is always between the lightest and the heaviest of your 4 apples?', answer: 'sample', options: [
          { v: 'sample', l: 'The median of your 4 apples' },
          { v: 'crate', l: 'The median of the whole crate', gap: "The crate's median is the one you can't see, and all 4 of your apples could happen to be heavier (or lighter) than it." },
          { v: 'both', l: 'Both', gap: "Only your own 4 apples' median is guaranteed. The crate's is usually caught, not always." },
        ] },
        { id: 'why', short: "why the crate's isn't certain", prompt: "Why isn't the crate's median guaranteed to be in your range?", answer: 'side', options: [
          { v: 'side', l: 'All 4 apples could happen to land on the same side of it' },
          { v: 'outliers', l: 'Crates have unusually heavy or light apples', gap: "Outliers don't decide it. It only misses if all 4 of yours land on one side of the crate's median." },
        ] },
      ] },
    },
  },
};

// Hand-written options only when the highlight is about the Rule of Five (the transcript also covers
// calibration, Monte Carlo…); [] otherwise, so the caller generates options about what was highlighted.
export function bookFocusOptions(selection) {
  const opt = id => ({ label: BOOK_TARGETS[id].label, mode: BOOK_TARGETS[id].kind, target: id });
  if (!/median|rule of five|93|random sample|bracket|1\/32|6\.25|all 5|above|below/i.test(selection)) return [];
  return /population|sample'?s|trivial|obvious|definition/i.test(selection) ? [opt('population'), opt('rule')] : [opt('rule'), opt('population')];
}
