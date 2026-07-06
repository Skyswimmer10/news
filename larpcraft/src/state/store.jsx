import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { reducer } from './reducer.js';
import { makeLibrarySeed, makeProjectSeed, makeEmptyProject, migrateLibrary, migrateProject, LIB_REV, SEED_REV } from '../data/seed.js';
import { loadKey, saveKeyDebounced, clearKey } from './storage.js';

// Two distinct stores:
//  - Library: the persistent master database (templates). Survives across games.
//  - Project: the currently open game (instances, quest graph, teams).
// Each has its own context pair and its own IndexedDB slot.

const LIB_KEY = 'larpcraft:library';
const PROJ_KEY = 'larpcraft:activeProject';

const LibStateCtx = createContext(null);
const LibDispatchCtx = createContext(null);
const ProjStateCtx = createContext(null);
const ProjDispatchCtx = createContext(null);

export function StoreProvider({ children }) {
  const [lib, libDispatch] = useReducer(reducer, null);
  const [proj, projDispatch] = useReducer(reducer, null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadKey(LIB_KEY), loadKey(PROJ_KEY)]).then(([savedLib, savedProj]) => {
      if (!alive) return;
      // Library is migrated additively: newer schema revs backfill missing
      // collections (e.g. gmRules) instead of discarding the saved library.
      libDispatch({ type: 'RESET', seed: migrateLibrary(savedLib) });
      // Project is migrated additively (backfills `facts` etc.) so an open game
      // survives schema bumps instead of being reset.
      projDispatch({ type: 'RESET', seed: migrateProject(savedProj) });
      setBooted(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (booted && lib) saveKeyDebounced(LIB_KEY, lib); }, [lib, booted]);
  useEffect(() => { if (booted && proj) saveKeyDebounced(PROJ_KEY, proj); }, [proj, booted]);

  if (!booted || !lib || !proj) return <div className="boot">Loading library &amp; game…</div>;
  return (
    <LibStateCtx.Provider value={lib}>
      <LibDispatchCtx.Provider value={libDispatch}>
        <ProjStateCtx.Provider value={proj}>
          <ProjDispatchCtx.Provider value={projDispatch}>{children}</ProjDispatchCtx.Provider>
        </ProjStateCtx.Provider>
      </LibDispatchCtx.Provider>
    </LibStateCtx.Provider>
  );
}

// Project (active game) hooks — the names most views already use.
export const useGame = () => useContext(ProjStateCtx);
export const useDispatch = () => useContext(ProjDispatchCtx);
// Library (master database) hooks.
export const useLibrary = () => useContext(LibStateCtx);
export const useLibraryDispatch = () => useContext(LibDispatchCtx);

export function newGame(projDispatch, name = 'Untitled game') {
  projDispatch({ type: 'RESET', seed: makeEmptyProject(name) });
}

export async function resetDemoData(libDispatch, projDispatch) {
  await Promise.all([clearKey(LIB_KEY), clearKey(PROJ_KEY)]);
  libDispatch({ type: 'RESET', seed: makeLibrarySeed() });
  projDispatch({ type: 'RESET', seed: makeProjectSeed() });
}
