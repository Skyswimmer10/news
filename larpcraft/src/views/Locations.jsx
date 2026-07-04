import React, { useState } from 'react';
import { useGame, useDispatch } from '../state/store.jsx';
import { Thumb } from '../components/bits.jsx';
import CsvButtons from '../components/CsvButtons.jsx';
import LibraryBrowser from '../components/LibraryBrowser.jsx';
import { CSV_SCHEMAS } from '../data/csvSchemas.js';

export default function Locations({ selection, onSelect }) {
  const s = useGame();
  const dispatch = useDispatch();
  const [browsing, setBrowsing] = useState(false);
  const selId = selection?.kind === 'location' ? selection.id : null;
  const empty = Object.keys(s.locations).length === 0;

  const addNew = () => {
    const id = CSV_SCHEMAS.locations.newId(s);
    dispatch({ type: 'ADD_ENTITY', coll: 'locations', entity: CSV_SCHEMAS.locations.blank(id) });
    onSelect({ kind: 'location', id });
  };

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">{s.meta.name} / <b>Locations</b> · game instances</div>
          <h2>Locations</h2>
        </div>
        <div className="right">
          <CsvButtons coll="locations" />
          <button className="btn" onClick={() => setBrowsing(true)}>⤓ Browse Library</button>
          <button className="btn primary" onClick={addNew}>+ New location</button>
        </div>
      </div>
      {empty ? (
        <div className="emptyview">
          <h3>No locations in this game yet</h3>
          <p>Import site templates from your Library, or map a new one.</p>
          <div className="chips">
            <button className="btn primary" onClick={() => setBrowsing(true)}>⤓ Browse Library</button>
            <button className="btn" onClick={addNew}>+ New location</button>
          </div>
        </div>
      ) : (
        <div className="gallery loc">
          {Object.values(s.locations).map((l) => (
            <figure key={l.id} className={`card${selId === l.id ? ' sel' : ''}`} onClick={() => onSelect({ kind: 'location', id: l.id })}>
              <div className="thumb"><Thumb image={l.image} type="location" /></div>
              <figcaption>
                <b>{l.name}</b>
                <span className="tag" style={{ color: 'var(--c-location)' }}>{l.zone || 'unzoned'} · {l.sensorIds.length} sensors</span>
                <span className="deploy">{Object.values(s.items).filter((i) => i.locationId === l.id).length} items placed</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="statusbar"><span>Edits here affect only <b>{s.meta.name}</b> — site templates live in the Library.</span></div>
      {browsing && <LibraryBrowser coll="locations" onClose={() => setBrowsing(false)}
        onImported={(id) => { setBrowsing(false); onSelect({ kind: 'location', id }); }} />}
    </div>
  );
}
