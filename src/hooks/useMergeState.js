import { useRef, useState } from 'react';

// One state object, updated the way a class component's setState is: the patch (or a function of the latest
// state) is merged in, every update renders, and cb runs once the update has committed. ref.current is the state
// as last rendered, which is what actions read after an await.
export function useMergeState(initial, afterCommit) {
  const [state, setState] = useState(initial);
  const ref = useRef(state);
  ref.current = state;
  const set = useRef((patch, cb) => {
    setState(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
    if (cb) afterCommit(cb);
  }).current;
  return [state, set, ref];
}
