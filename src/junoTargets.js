// Learning targets for the Juno starter: aggregation theory, from Christine's meeting-prep chat
// (junoTranscript.js). Same spec as targets.js, with a third kind of check: "chosen" (choiceCheck.js).
// The anchor confusion is hers: "wouldn't Juno want to own both, readers AND writers?"
// Vela and Pallet in the tasks are made up, so the transfer can't be answered from memory of the chat.

const VELA = 'Vela (made up) is an app where independent personal trainers post workout programs. Users pay Vela one subscription and can follow any trainer.';
const PALLET = 'Pallet (made up) is an app where home cooks sell meals. Customers browse, order and pay through Pallet.';

export const JUNO_TARGETS = {
  ownside: {
    label: 'Which side an aggregator owns, and why not both', kind: 'concept',
    writtenOrderMatters: false,
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
    writtenOrderMatters: false,
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
          { v: 'trust', l: "Knowing which stranger's home cooking is safe and good" },
          { v: 'delivery', l: 'Getting a meal driven from a home kitchen to your door', gap: "Drivers were never the scarce intermediary; trust in a stranger's cooking was." },
          { v: 'kitchen', l: 'Renting a licensed kitchen to cook meals in for sale', gap: "Pallet's cooks use their own kitchens. What used to need a restaurant's name was trusting the cook." },
        ] },
        { id: 'kind', short: 'mechanism vs result', prompt: '"Customers pay Pallet and complain to Pallet." This is the…', answer: 'result', options: [
          { v: 'result', l: 'Result' },
          { v: 'mechanism', l: 'Mechanism', gap: 'That is the owned relationship: the result.' },
        ] },
        { id: 'rival', short: 'what a rival owns', prompt: 'A rival app signs up only a few famous chefs, and customers search for them by name. Compared with Pallet, the rival…', answer: 'less', options: [
          { v: 'less', l: 'Owns its customers less: they follow the chefs, who can take them along' },
          { v: 'more', l: 'Owns its customers more, since famous chefs bring bigger audiences', gap: "A famous chef's audience belongs to the chef. Nothing about the app is why they came, so nothing stops them leaving with the chef." },
          { v: 'same', l: 'Owns them just as much, since customers still order and pay in the app', gap: 'Paying through the app is the result only when any one chef is replaceable. Here the chef is the reason customers came.' },
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
