// Learning targets for the Juno starter: aggregation theory, from Christine's meeting-prep chat
// (junoTranscript.js). Same spec as targets.js, with a third kind of check: "chosen" (choiceCheck.js).
// The anchor confusion is hers: "wouldn't Juno want to own both, readers AND writers?"
// Vela and Pallet in the tasks are made up, so the transfer can't be answered from memory of the chat.

// Compare: one question for every case, so the pattern carries the lesson. Each reveal draws who
// holds the relationship: supply ─ platform ═ users (platform owns users), or supply ═ users (direct).
const OPTIONS = [{ v: 'stay', l: 'Users stay' }, { v: 'follow', l: 'Users follow the supplier' }];
const ask = 'What do most users do?';
const CASES = [
  { label: 'Airbnb', code: 'A popular host takes their apartment off Airbnb.', answer: 'stay', ask,
    diagram: { supply: 'Hosts', platform: 'Airbnb', users: 'Guests', owned: 'users' },
    note: 'Guests book another place. They have an account with Airbnb, pay Airbnb and complain to Airbnb, not the host. Hosts are interchangeable on purpose.' },
  { label: 'Netflix', code: 'A studio pulls its shows from Netflix.', answer: 'stay', ask,
    diagram: { supply: 'Studios', platform: 'Netflix', users: 'Subscribers', owned: 'users' },
    note: "Most subscribers stay: they're there for something good to watch tonight, not for one studio. Netflix commoditized the scarce thing (broadcast availability) and kept the subscriber." },
  { label: 'Hairdresser', code: 'Your hairdresser leaves their salon for one across town.', answer: 'follow', ask,
    diagram: { supply: 'Hairdresser', platform: 'Salon', users: 'Clients', owned: 'direct' },
    note: "Many clients follow. They're loyal to the person, not the building. That's a supplier owning the relationship, not the platform: the everyday version of the test, from your chat." },
  { label: 'Substack', code: 'A popular writer leaves Substack for their own website.', answer: 'follow', ask,
    diagram: { supply: 'Writer', platform: 'Substack', users: 'Readers', owned: 'direct' },
    note: "Readers follow. They subscribed to the writer, and the writer takes the email list along. Substack is built on the opposite bet: help the writer keep the relationship." },
  { label: 'Juno', code: 'A popular writer leaves Juno for Substack. (Assume the aggregator model is working.)', answer: 'stay', ask,
    diagram: { supply: 'Writers', platform: 'Juno', users: 'Readers', owned: 'users' },
    note: "Readers stay and read someone else. That is the test from your chat: if they followed the writer out the door, Juno wouldn't own the relationship, whatever the org chart says." },
].map(c => ({ ...c, options: OPTIONS, answerText: OPTIONS.find(o => o.v === c.answer).l.toLowerCase() }));
const COMPARE = { intro: 'Five cases, one question: a supplier leaves. Before each answer appears, guess what most users do.', cases: CASES };

const VELA = 'Vela (made up) is an app where independent personal trainers post workout programs. Users pay Vela one subscription and can follow any trainer.';
const PALLET = 'Pallet (made up) is an app where home cooks sell meals. Customers browse, order and pay through Pallet.';

export const JUNO_TARGETS = {
  ownside: {
    label: 'Which side an aggregator owns, and why not both', kind: 'concept',
    // The Own-it framework (research §8f): three answers decide the steps.
    producingIsSkill: false, writtenOrderMatters: false, visual: 'compare',
    explain: {
      model: 'An aggregator keeps a deep, owned relationship with users and a shallow, replaceable one with suppliers. The asymmetry is the point.',
      grid: { headers: ['', 'the relationship', 'if one of them leaves'], rows: [
        ['users (readers)', { t: 'deep, owned, sticky', strong: true }, 'the business is hurt'],
        ['suppliers (writers)', 'shallow, interchangeable', 'users read someone else'],
      ] },
      inYourCode: 'You asked whether Juno would want to own both. Test it like Airbnb: if one writer left, would readers follow them out, or stay and read someone else? Only the second means Juno owns the relationship.',
      rule: 'Ask: if a top supplier leaves, do users follow them? If yes, the supplier owns the relationship, not the platform.',
    },
    compare: COMPARE,
    write: {
      task: `Now a new situation. ${VELA}`,
      hints: ['Run the Airbnb test: if one trainer left, would Vela be hurt the way it would be if users stopped coming?', 'Who do users pay, and who do they complain to?'],
      check: { type: 'choice', questions: [
        { id: 'own', short: 'which side Vela owns', prompt: 'If Vela is an aggregator, which relationship does it need to own?', answer: 'users', options: [
          { v: 'users', l: 'Users' },
          { v: 'both', l: 'Both users and trainers, equally', gap: "Test it like Airbnb: if one trainer left, would Vela be hurt the way it would if users stopped coming? An aggregator wants trainers abundant and interchangeable. Owning each trainer too would make it a talent agency, not an aggregator." },
          { v: 'trainers', l: 'Trainers', gap: "That's the opposite bet, Substack's: help the supplier keep the relationship. Then users are loyal to the trainer, and Vela is plumbing." },
        ] },
        { id: 'leave', short: 'what happens when a star leaves', prompt: 'A star trainer leaves to launch their own app. If Vela is working as an aggregator, most of their followers…', answer: 'stay', options: [
          { v: 'stay', l: 'Stay on Vela and train with someone else' },
          { v: 'follow', l: 'Follow the trainer to the new app', gap: "If followers leave with the trainer, their loyalty was to the trainer, so Vela never owned the relationship. That's the test from your chat." },
        ] },
        { id: 'leverage', short: 'who has leverage', prompt: 'Who has more leverage in a negotiation over revenue share?', answer: 'vela', options: [
          { v: 'vela', l: 'Vela, because any one trainer is replaceable' },
          { v: 'trainer', l: 'A top trainer, because users love them', gap: "Only if users would follow that trainer out. For an aggregator, commoditized supply means no single supplier is essential, which is where the platform's leverage comes from." },
        ] },
      ] },
    },
    delayed: {
      task: `From memory, a new situation. ${PALLET}`,
      check: { type: 'choice', questions: [
        { id: 'own', short: 'which side Pallet owns', prompt: 'As an aggregator, which relationship does Pallet need to own?', answer: 'customers', options: [
          { v: 'customers', l: 'Customers' },
          { v: 'both', l: 'Both, equally', gap: 'Cooks need to stay abundant and interchangeable; the owned relationship is with customers.' },
          { v: 'cooks', l: 'Cooks', gap: "That would be the supplier-first bet; customers would be loyal to cooks, not Pallet." },
        ] },
        { id: 'leave', short: 'what happens when a star leaves', prompt: 'A popular cook leaves Pallet. If the model works, most of their customers…', answer: 'stay', options: [
          { v: 'stay', l: 'Order from another cook on Pallet' },
          { v: 'follow', l: 'Follow the cook', gap: 'Then the cook, not Pallet, owned those customers.' },
        ] },
      ] },
    },
  },

  mechanism: {
    label: 'Mechanism vs result: what gets commoditized, what gets owned', kind: 'concept',
    producingIsSkill: false, writtenOrderMatters: false, visual: 'compare',
    explain: {
      model: 'The mechanism is commoditizing the scarce thing. The result is owning the user relationship. The first is what makes the second possible.',
      grid: { headers: ['', 'scarce thing made cheap (mechanism)', 'result'], rows: [
        ['Airbnb', 'trust in a stranger’s home', 'owns the guest'],
        ['Uber', 'dispatch + driver trust', 'owns the rider'],
        ['Netflix', 'broadcast availability', 'owns the subscriber'],
        ['Google', 'the cost of finding information', 'owns the searcher'],
        ['Juno', { t: 'curation and discovery', strong: true }, 'owns the reader'],
      ] },
      inYourCode: "Before the internet, publishing's scarce thing was editorial vetting. Once anyone could publish, it flipped: too much to read, so the scarce thing became finding what's worth it. That's what Juno makes cheap, and why it can own the reader.",
      rule: 'Find what used to need an expensive, trusted, scarce intermediary. Whoever makes it cheap first gets to own the user.',
    },
    compare: COMPARE,
    write: {
      task: `Now a new situation. ${VELA} Sort out the mechanism from the result.`,
      hints: ['Before Vela, what did you need a gym or a referral for?', 'One statement describes what Vela did; the other, what it got as a result.'],
      check: { type: 'choice', questions: [
        { id: 'scarce', short: 'the scarce thing', prompt: 'What scarce thing did Vela make cheap and abundant?', answer: 'trust', options: [
          { v: 'trust', l: 'Finding a good trainer you can trust (it used to take a gym or a referral)' },
          { v: 'video', l: 'Hosting workout videos', gap: "Video hosting was already cheap and abundant, so it isn't the scarce thing. What used to need an expensive, trusted intermediary?" },
          { v: 'equipment', l: 'Workout equipment', gap: "Vela doesn't touch equipment. Look for the thing a gym or referral used to provide: knowing which trainer is any good." },
        ] },
        { id: 'kind', short: 'mechanism vs result', prompt: '"Users have an account with Vela, pay Vela, and complain to Vela, not the trainer." This is the…', answer: 'result', options: [
          { v: 'result', l: 'Result' },
          { v: 'mechanism', l: 'Mechanism', gap: 'Paying and complaining to the platform is the result: the owned relationship. The mechanism is what made it possible: making good trainers easy to find and trust.' },
        ] },
        { id: 'cause', short: 'which causes which', prompt: 'Which is true?', answer: 'enables', options: [
          { v: 'enables', l: 'Commoditizing trainers is what lets Vela own users' },
          { v: 'reverse', l: 'Owning users is what lets Vela commoditize trainers', gap: 'The order runs the other way: users bond with the platform only once any single trainer is replaceable.' },
          { v: 'parallel', l: 'They are two separate goals', gap: "From your chat: it's not two things in parallel, it's one enabling the other." },
        ] },
      ] },
    },
    delayed: {
      task: `From memory, a new situation. ${PALLET}`,
      check: { type: 'choice', questions: [
        { id: 'scarce', short: 'the scarce thing', prompt: 'What scarce thing did Pallet make cheap?', answer: 'trust', options: [
          { v: 'trust', l: 'Finding home-cooked food you can trust from a stranger' },
          { v: 'delivery', l: 'Cars for delivery', gap: 'Cars were never the scarce intermediary; trust in a stranger\'s cooking was.' },
        ] },
        { id: 'kind', short: 'mechanism vs result', prompt: '"Customers pay Pallet and complain to Pallet." This is the…', answer: 'result', options: [
          { v: 'result', l: 'Result' },
          { v: 'mechanism', l: 'Mechanism', gap: 'That is the owned relationship: the result.' },
        ] },
      ] },
    },
  },
};

// Hand-written options only when the highlight is about these ideas; [] otherwise.
export function junoFocusOptions(selection) {
  const opt = id => ({ label: JUNO_TARGETS[id].label, mode: JUNO_TARGETS[id].kind, target: id });
  if (/own|both|writer|reader|leave|follow|loyal|relationship|supplier|substack|host/i.test(selection)) return [opt('ownside'), opt('mechanism')];
  if (/commoditi|scarce|mechanism|result|trust|curation|discovery|vetting|gatekeep|bottleneck/i.test(selection)) return [opt('mechanism'), opt('ownside')];
  return [];
}
