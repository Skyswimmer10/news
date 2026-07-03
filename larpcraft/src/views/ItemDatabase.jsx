import React, { useState } from 'react';
import { useGame } from '../state/store.jsx';
import { itemList } from '../state/reducer.js';
import { Thumb, Pill, ENTITY_COLORS } from '../components/bits.jsx';

const TYPE_TAGS = { artifact: 'Artifact', gadget: 'Gadget', consumable: 'Consumable' };

export default function ItemDatabase({ selection, onSelect }) {
  const s = useGame();
  const [view, setView] = useState('gallery');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const items = itemList(s).filter((i) =>
    (filter === 'all' || i.type === filter) &&
    (!q || `${i.name} ${i.id} ${i.propNotes}`.toLowerCase().includes(q.toLowerCase())),
  );
  const selId = selection?.kind === 'item' ? selection.id : null;
  const pick = (id) => onSelect({ kind: 'item', id });

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">Operation Chimera / <b>Items &amp; Gadgets</b></div>
          <h2>Item Database</h2>
        </div>
      </div>
      <div className="toolrow">
        <input className="search" placeholder="Search items, props, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        {['all', 'artifact', 'gadget', 'consumable'].map((f) => (
          <button key={f} className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? `All · ${itemList(s).length}` : `${TYPE_TAGS[f]}s`}
          </button>
        ))}
        <div className="viewtog">
          <button className={view === 'gallery' ? 'on' : ''} onClick={() => setView('gallery')}>Gallery</button>
          <button className={view === 'sheet' ? 'on' : ''} onClick={() => setView('sheet')}>Sheet</button>
        </div>
      </div>

      {view === 'gallery' ? (
        <div className="gallery">
          {items.map((i) => (
            <figure key={i.id} className={`card${selId === i.id ? ' sel' : ''}`} onClick={() => pick(i.id)}>
              <div className="thumb"><Thumb image={i.image} type={i.type} /></div>
              <figcaption>
                <b>{i.name}</b>
                <span className="tag" style={{ color: ENTITY_COLORS[i.type] }}>{TYPE_TAGS[i.type]}</span>
              </figcaption>
              <span className={`st st-${i.availability}`} title={i.availability} />
            </figure>
          ))}
        </div>
      ) : (
        <div className="gridwrap">
          <table>
            <thead>
              <tr><th>Item name</th><th>Type</th><th>Build</th><th>Availability</th><th>Issued to</th><th>Location</th><th>Mechanics</th><th>Sensors</th><th>Tag ID</th></tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const holder = i.assignedTo ? s.players[i.assignedTo.playerId]?.name ?? s.teams[i.assignedTo.teamId]?.name : '—';
                return (
                  <tr key={i.id} className={selId === i.id ? 'sel' : ''} onClick={() => pick(i.id)}>
                    <td>{i.name}</td>
                    <td>{TYPE_TAGS[i.type]}</td>
                    <td className="mono">{i.buildStatus}</td>
                    <td><Pill availability={i.availability} /></td>
                    <td>{holder}</td>
                    <td>{i.locationId ? s.locations[i.locationId]?.name : '—'}</td>
                    <td>{i.mechanicIds.map((m) => s.mechanics[m]?.name).join(', ') || '—'}</td>
                    <td className="mono">{i.sensorReqs.map((r) => r.sensorId).join(', ') || '—'}</td>
                    <td className="mono">{i.id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="statusbar"><span><b>{items.length}</b> items shown</span><span>Edits save locally · IndexedDB</span></div>
    </div>
  );
}
