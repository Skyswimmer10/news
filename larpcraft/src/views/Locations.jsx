import React from 'react';
import { useGame, useDispatch } from '../state/store.jsx';
import { Thumb } from '../components/bits.jsx';
import CsvButtons from '../components/CsvButtons.jsx';
import { CSV_SCHEMAS } from '../data/csvSchemas.js';

export default function Locations({ selection, onSelect }) {
  const s = useGame();
  const dispatch = useDispatch();
  const selId = selection?.kind === 'location' ? selection.id : null;
  const addNew = () => {
    const id = CSV_SCHEMAS.locations.newId(s);
    dispatch({ type: 'ADD_ENTITY', coll: 'locations', entity: CSV_SCHEMAS.locations.blank(id) });
    onSelect({ kind: 'location', id });
  };
  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">Operation Chimera / <b>Locations</b></div>
          <h2>Locations</h2>
        </div>
        <div className="right">
          <CsvButtons coll="locations" />
          <button className="btn primary" onClick={addNew}>+ New location</button>
        </div>
      </div>
      <div className="gallery loc">
        {Object.values(s.locations).map((l) => (
          <figure key={l.id} className={`card${selId === l.id ? ' sel' : ''}`} onClick={() => onSelect({ kind: 'location', id: l.id })}>
            <div className="thumb"><Thumb image={l.image} type="location" /></div>
            <figcaption>
              <b>{l.name}</b>
              <span className="tag" style={{ color: 'var(--c-location)' }}>{l.zone} · {l.sensorIds.length} sensors</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="statusbar"><span>Select a location and drop a reference photo in the details panel.</span></div>
    </div>
  );
}
