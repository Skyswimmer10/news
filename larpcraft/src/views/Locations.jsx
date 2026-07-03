import React from 'react';
import { useGame } from '../state/store.jsx';
import { Thumb } from '../components/bits.jsx';

export default function Locations({ selection, onSelect }) {
  const s = useGame();
  const selId = selection?.kind === 'location' ? selection.id : null;
  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">Operation Chimera / <b>Locations</b></div>
          <h2>Locations</h2>
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
