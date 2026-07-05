import React, { useEffect, useRef, useState } from 'react';
import { useGame, useDispatch, newGame } from '../state/store.jsx';
import { makeEmptyProject, SEED_REV } from '../data/seed.js';
import { downloadText } from '../lib/csv.js';

// File menu: the active game's lifecycle. The Library is untouched by all of
// these — only the ActiveProjectState is created / serialized / replaced.
export default function ProjectMenu() {
  const proj = useGame();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);
  const heroRef = useRef(null);
  const rootRef = useRef(null);
  const hero = proj.meta.hero ?? { image: null, opacity: 0.25 };

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const act = (fn) => () => { setOpen(false); fn(); };

  const doNew = act(() => {
    if (!window.confirm('Start a new game? The current game will be replaced — use "Save game" first to keep a JSON copy.')) return;
    const name = window.prompt('Name for the new game:', 'Untitled game') || 'Untitled game';
    newGame(dispatch, name);
  });

  const doSave = act(() => {
    const slug = proj.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
    downloadText(`${slug}.larpcraft.json`, JSON.stringify(proj, null, 2), 'application/json');
  });

  const doOpen = act(() => fileRef.current?.click());

  async function openFile(file) {
    try {
      const data = JSON.parse(await file.text());
      if (data.rev !== SEED_REV || !data.meta || !data.items || !data.nodes) {
        window.alert('This file is not a compatible LARP Craft game save.');
        return;
      }
      dispatch({ type: 'RESET', seed: data });
    } catch {
      window.alert("Couldn't read that file — it isn't valid JSON.");
    }
  }

  const doRename = act(() => {
    const name = window.prompt('Rename this game:', proj.meta.name);
    if (name) dispatch({ type: 'RENAME_PROJECT', name });
  });

  const doClose = act(() => {
    if (!window.confirm('Close the current game? Unsaved-to-file changes stay only in this browser until a new game replaces them.')) return;
    dispatch({ type: 'RESET', seed: makeEmptyProject('No game open') });
  });

  // Per-game hero backdrop: an image shown behind the workspace.
  async function setHeroImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => dispatch({
      type: 'SET_META',
      patch: { hero: { image: { kind: 'photo', name: file.name, dataUrl: reader.result }, opacity: hero.opacity ?? 0.25 } },
    });
    reader.readAsDataURL(file);
  }

  return (
    <div className="filemenu" ref={rootRef}>
      <button className={`menubtn${open ? ' on' : ''}`} onClick={() => setOpen(!open)}>File</button>
      {open && (
        <div className="menudrop">
          <button onClick={doNew}>New game…</button>
          <button onClick={doOpen}>Open game (JSON)…</button>
          <button onClick={doSave}>Save game as JSON</button>
          <button onClick={doRename}>Rename game…</button>
          <div className="menusep" />
          <button onClick={() => heroRef.current?.click()}>{hero.image ? 'Replace game backdrop…' : 'Set game backdrop…'}</button>
          {hero.image && (
            <>
              <div className="menuslider">
                <span>Backdrop opacity · {Math.round((hero.opacity ?? 0.25) * 100)}%</span>
                <input type="range" min="5" max="70" value={Math.round((hero.opacity ?? 0.25) * 100)}
                  onChange={(e) => dispatch({ type: 'SET_META', patch: { hero: { ...hero, opacity: +e.target.value / 100 } } })} />
              </div>
              <button onClick={() => dispatch({ type: 'SET_META', patch: { hero: { image: null, opacity: hero.opacity } } })}>Remove backdrop</button>
            </>
          )}
          <div className="menusep" />
          <button onClick={doClose}>Close game</button>
        </div>
      )}
      <input ref={fileRef} hidden type="file" accept=".json,application/json"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ''; }} />
      <input ref={heroRef} hidden type="file" accept="image/*"
        onChange={(e) => { setHeroImage(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
