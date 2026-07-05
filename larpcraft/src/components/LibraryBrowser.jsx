import React, { useState } from 'react';
import { useLibrary, useGame, useDispatch } from '../state/store.jsx';
import { importItem, importLocation, importMechanic } from '../state/bridge.js';
import { Thumb } from './bits.jsx';

const TITLES = { items: 'Items & Gadgets', locations: 'Locations', mechanics: 'Game Mechanics' };
const IMPORTERS = { items: importItem, locations: importLocation, mechanics: importMechanic };
const FOOTS = {
  items: 'Importing duplicates the master record into this game with a new instance ID. Required sensor hardware is imported along with it.',
  locations: 'Importing duplicates the master record into this game with a new instance ID.',
  mechanics: 'Importing copies the mechanic and its parameters into this game — adjust them locally (e.g. add switches) without changing the library blueprint.',
};

// "Browse Library" modal inside a Build view: pick a master template and it is
// duplicated into the active game as a new instance (unique instance id).
export default function LibraryBrowser({ coll, onClose, onImported }) {
  const lib = useLibrary();
  const proj = useGame();
  const dispatch = useDispatch();
  const [q, setQ] = useState('');

  const templates = Object.values(lib[coll]).filter(
    (t) => !q || `${t.name} ${t.id}`.toLowerCase().includes(q.toLowerCase()),
  );

  const doImport = (templateId) => {
    const result = IMPORTERS[coll](lib, proj, templateId);
    if (!result) return;
    dispatch({ type: 'IMPORT_FROM_LIBRARY', ...result });
    onImported(result.createdId);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalhead">
          <b>Browse Library — {TITLES[coll]}</b>
          <button className="x big" onClick={onClose} aria-label="Close">×</button>
        </div>
        <input className="search wide" autoFocus placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="modallist">
          {templates.map((t) => {
            const already = Object.values(proj[coll] ?? {}).filter((i) => i.templateId === t.id).length;
            return (
              <div className="modalrow" key={t.id}>
                {coll !== 'mechanics' && <div className="modalthumb"><Thumb image={t.image} type={t.type || 'location'} /></div>}
                <div className="modalinfo">
                  <b>{t.name}</b>
                  <small className="mono dim">{t.id}{already > 0 && ` · ${already} already in this game`}</small>
                  <small>{t.summary || t.description || t.notes}{coll === 'mechanics' && t.params?.length ? ` · ${t.params.map((p) => `${p.label} ${p.value}`).join(', ')}` : ''}</small>
                </div>
                <button className="btn primary" onClick={() => doImport(t.id)}>Import</button>
              </div>
            );
          })}
          {templates.length === 0 && <div className="empty">No templates match.</div>}
        </div>
        <div className="modalfoot dim">{FOOTS[coll]}</div>
      </div>
    </div>
  );
}
