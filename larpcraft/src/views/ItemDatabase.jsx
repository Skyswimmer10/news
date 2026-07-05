import React, { useState } from 'react';
import { useGame, useDispatch, useLibrary } from '../state/store.jsx';
import { itemList } from '../state/reducer.js';
import { Thumb, Pill, ENTITY_COLORS, AVAILABILITY } from '../components/bits.jsx';
import CsvButtons from '../components/CsvButtons.jsx';
import LibraryBrowser from '../components/LibraryBrowser.jsx';
import TypeChips from '../components/TypeChips.jsx';
import { CSV_SCHEMAS } from '../data/csvSchemas.js';

export default function ItemDatabase({ selection, onSelect }) {
  const s = useGame();
  const lib = useLibrary();
  const dispatch = useDispatch();
  const typeLabel = (ty) => lib.itemTypes[ty]?.label ?? ty;
  const typeColor = (ty) => lib.itemTypes[ty]?.color ?? '#8B92A6';
  const [view, setView] = useState('gallery');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [browsing, setBrowsing] = useState(false);

  const addNew = () => {
    const id = CSV_SCHEMAS.items.newId(s);
    dispatch({ type: 'ADD_ENTITY', coll: 'items', entity: CSV_SCHEMAS.items.blank(id) });
    onSelect({ kind: 'item', id });
  };

  const items = itemList(s).filter((i) =>
    (filter === 'all' || i.type === filter) &&
    (!q || `${i.name} ${i.id} ${i.propNotes}`.toLowerCase().includes(q.toLowerCase())),
  );
  const selId = selection?.kind === 'item' ? selection.id : null;
  const pick = (id) => onSelect({ kind: 'item', id });
  const empty = itemList(s).length === 0;

  // Instance status line for visual distinction from library templates.
  const statusLine = (i) => {
    if (i.assignedTo) {
      const who = i.assignedTo.playerId ? s.players[i.assignedTo.playerId]?.name : s.teams[i.assignedTo.teamId]?.name;
      return `Assigned to ${who ?? '?'}`;
    }
    if (i.availability === 'deployed' && i.locationId) return `Deployed · ${s.locations[i.locationId]?.name ?? ''}`;
    return AVAILABILITY[i.availability]?.label ?? i.availability;
  };

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">{s.meta.name} / <b>Items &amp; Gadgets</b> · game instances</div>
          <h2>Item Database</h2>
        </div>
        <div className="right">
          <CsvButtons coll="items" />
          <button className="btn" onClick={() => setBrowsing(true)}>⤓ Browse Library</button>
          <button className="btn primary" onClick={addNew}>+ New item</button>
        </div>
      </div>
      <div className="toolrow">
        <input className="search" placeholder="Search items, props, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        <TypeChips value={filter} onChange={setFilter} totalLabel={`All · ${itemList(s).length}`} />
        <div className="viewtog">
          <button className={view === 'gallery' ? 'on' : ''} onClick={() => setView('gallery')}>Gallery</button>
          <button className={view === 'sheet' ? 'on' : ''} onClick={() => setView('sheet')}>Sheet</button>
        </div>
      </div>

      {empty ? (
        <div className="emptyview">
          <h3>No items in this game yet</h3>
          <p>Bring in props from your master database, or build one from scratch.</p>
          <div className="chips">
            <button className="btn primary" onClick={() => setBrowsing(true)}>⤓ Browse Library</button>
            <button className="btn" onClick={addNew}>+ New item</button>
          </div>
        </div>
      ) : view === 'gallery' ? (
        <div className="gallery">
          {items.map((i) => (
            <figure key={i.id} className={`card${selId === i.id ? ' sel' : ''}`} onClick={() => pick(i.id)}>
              <div className="thumb"><Thumb image={i.image} type={i.type} /></div>
              <figcaption>
                <b>{i.name}</b>
                <span className="tag" style={{ color: typeColor(i.type) }}>{typeLabel(i.type)}</span>
                <span className="deploy">{statusLine(i)}</span>
              </figcaption>
              <span className={`st st-${i.availability}`} title={i.availability} />
            </figure>
          ))}
        </div>
      ) : (
        <div className="gridwrap">
          <table>
            <thead>
              <tr><th>Item name</th><th>Type</th><th>Build</th><th>Availability</th><th>Issued to</th><th>Location</th><th>Template</th><th>Sensors</th><th>Instance ID</th></tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const holder = i.assignedTo ? s.players[i.assignedTo.playerId]?.name ?? s.teams[i.assignedTo.teamId]?.name : '—';
                return (
                  <tr key={i.id} className={selId === i.id ? 'sel' : ''} onClick={() => pick(i.id)}>
                    <td>{i.name}</td>
                    <td>{typeLabel(i.type)}</td>
                    <td className="mono">{i.buildStatus}</td>
                    <td><Pill availability={i.availability} /></td>
                    <td>{holder}</td>
                    <td>{i.locationId ? s.locations[i.locationId]?.name : '—'}</td>
                    <td className="mono">{i.templateId ?? '—'}</td>
                    <td className="mono">{i.sensorReqs.map((r) => r.sensorId).join(', ') || '—'}</td>
                    <td className="mono">{i.id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="statusbar"><span><b>{items.length}</b> instances shown</span><span>Edits here affect only <b>{s.meta.name}</b></span></div>
      {browsing && <LibraryBrowser coll="items" onClose={() => setBrowsing(false)}
        onImported={(id) => { setBrowsing(false); onSelect({ kind: 'item', id }); }} />}
    </div>
  );
}
