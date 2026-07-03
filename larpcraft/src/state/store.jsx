import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { reducer } from './reducer.js';
import { makeSeed, SEED_REV } from '../data/seed.js';
import { loadProject, saveProjectDebounced, clearProject } from './storage.js';

const StateCtx = createContext(null);
const DispatchCtx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let alive = true;
    loadProject().then((saved) => {
      if (!alive) return;
      // Older saves (schema changed) fall back to fresh seed.
      const usable = saved && saved.rev === SEED_REV ? saved : makeSeed();
      dispatch({ type: 'RESET', seed: usable });
      setBooted(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (booted && state) saveProjectDebounced(state);
  }, [state, booted]);

  if (!booted || !state) return <div className="boot">Loading project…</div>;
  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export const useGame = () => useContext(StateCtx);
export const useDispatch = () => useContext(DispatchCtx);

export async function resetDemoData(dispatch) {
  await clearProject();
  dispatch({ type: 'RESET', seed: makeSeed() });
}
