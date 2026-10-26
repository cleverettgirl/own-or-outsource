// Learning target for the React starter: when the effect's cleanup runs, and why it aborts the request.
// The try checks the timing in a new situation with reasoning questions, not "write a component": knowing
// WHEN code runs is a different skill from producing it (process log 42). Wrong options are the classic
// misconceptions, each with its own explanation.
export const REACT_TARGETS = {
  timing: {
    label: 'When the cleanup runs, and why it aborts the request',
    kind: 'sequence',
    // The Own-it framework (research §8f): the RUNTIME order is the insight, not the written order, so no Arrange.
    writtenOrderMatters: false,
    write: {
      task: 'Now a new situation: a SearchResults component fetches results for a `query` prop with the same useEffect + AbortController pattern. You type "c", then quickly "ca", then "cat".',
      hints: [
        'When a dependency changes, React has two things to do: clean up the old run and start the new one. In which order?',
        "What does the cleanup do to a request that hasn't finished yet?",
        'Cleanup also runs at one other moment. When?',
      ],
      check: {
        type: 'choice',
        questions: [
          {
            id: 'order',
            short: 'what runs first',
            prompt:
              'When the query changes from "ca" to "cat", what happens first?',
            answer: 'cleanup',
            options: [
              { v: 'cleanup', l: 'The "ca" run\'s cleanup aborts its request' },
              {
                v: 'effect',
                l: 'The new effect starts fetching "cat"',
                gap: "The new run waits its turn: React always runs the previous run's cleanup first, then the new effect.",
              },
              {
                v: 'wait',
                l: 'Nothing, until the "ca" request finishes',
                gap: "React doesn't wait for requests. The query changed, so it cleans up the old run straight away and starts the new one.",
              },
            ],
          },
          {
            id: 'late',
            short: 'what a slow response does',
            prompt:
              'The "ca" request was slow and would have finished after "cat". What do the results show?',
            answer: 'cat',
            options: [
              { v: 'cat', l: 'Results for "cat"' },
              {
                v: 'ca',
                l: 'Results for "ca"',
                gap: "That's what happens without the cleanup: the slow response lands last and overwrites the newer one. Here the abort cut it off.",
              },
              {
                v: 'flicker',
                l: 'They flicker between "ca" and "cat"',
                gap: 'The aborted request never delivers, so there is nothing to flicker to.',
              },
            ],
          },
          {
            id: 'leave',
            short: 'cleanup on unmount',
            prompt:
              'You navigate away while "cat" is still loading. What does the cleanup do?',
            answer: 'abort',
            options: [
              {
                v: 'abort',
                l: 'Aborts the "cat" request, so nothing updates a component that\'s gone',
              },
              {
                v: 'nothing',
                l: 'Nothing: cleanup only runs when the query changes',
                gap: 'Cleanup also runs on unmount. That\'s the "state update on unmounted component" problem the answer mentions.',
              },
            ],
          },
        ],
      },
    },
    delayed: {
      task: 'From memory, a new situation: a Price component fetches the price for a `ticker` prop with the same pattern. You switch from AAPL to MSFT quickly.',
      check: {
        type: 'choice',
        questions: [
          {
            id: 'when',
            short: "when AAPL's cleanup runs",
            prompt: "When does the AAPL run's cleanup run?",
            answer: 'change',
            options: [
              {
                v: 'change',
                l: 'Right after the ticker changes, before the MSFT effect runs',
              },
              {
                v: 'response',
                l: 'When the AAPL response arrives',
                gap: 'Cleanup is tied to the dependency changing (or unmounting), not to responses arriving.',
              },
            ],
          },
          {
            id: 'deps',
            short: '[] instead of [ticker]',
            prompt:
              'If the dependency array were [] instead of [ticker], what would the card show after you switch?',
            answer: 'stuck',
            options: [
              { v: 'stuck', l: 'Still AAPL: the effect never re-runs' },
              {
                v: 'msft',
                l: 'MSFT, a moment later',
                gap: 'With [] the effect runs once, on mount. Changing the ticker re-renders, but nothing refetches.',
              },
            ],
          },
        ],
      },
    },
  },
};
