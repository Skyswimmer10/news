import React from 'react';
import { useGame, useDispatch, useLibrary, useLibraryDispatch } from '../state/store.jsx';

const TYPE_COLORS = ['#E0A23C', '#3EC6D6', '#E88F8F', '#43BF87', '#A87BF0', '#5CA8F5', '#E8D25C', '#F08CB4'];

// Editable item-type chips, shared by the game's Item Database and the
// Library's Items tab. Types live in the LIBRARY store so they persist
// across games. Deleting a type reassigns every item and template using it.
export default function TypeChips({ value, onChange, totalLabel }) {
  const proj = useGame();
  const dispatch = useDispatch();
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();

  const addType = () => {
    const label = window.prompt('Name for the new item type:');
    if (!label?.trim()) return;
    let key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'type';
    while (lib.itemTypes[key]) key += '-2';
    const color = TYPE_COLORS[Object.keys(lib.itemTypes).length % TYPE_COLORS.length];
    libDispatch({ type: 'ADD_ENTITY', coll: 'itemTypes', entity: { id: key, label: label.trim(), color } });
    onChange(key);
  };

  const deleteType = (key) => {
    const remaining = Object.keys(lib.itemTypes).filter((k) => k !== key);
    if (!remaining.length) { window.alert('At least one item type must remain.'); return; }
    const fallback = remaining[0];
    const usedGame = Object.values(proj.items).filter((i) => i.type === key);
    const usedLib = Object.values(lib.items).filter((i) => i.type === key);
    const parts = [];
    if (usedGame.length) parts.push(`${usedGame.length} item(s) in this game`);
    if (usedLib.length) parts.push(`${usedLib.length} library template(s)`);
    const msg = parts.length
      ? `Delete type "${lib.itemTypes[key].label}"? ${parts.join(' and ')} will be moved to "${lib.itemTypes[fallback].label}".`
      : `Delete the unused type "${lib.itemTypes[key].label}"?`;
    if (!window.confirm(msg)) return;
    usedGame.forEach((i) => dispatch({ type: 'UPDATE_ENTITY', coll: 'items', id: i.id, patch: { type: fallback } }));
    usedLib.forEach((i) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'items', id: i.id, patch: { type: fallback } }));
    libDispatch({ type: 'DELETE_ENTITY', coll: 'itemTypes', id: key });
    if (value === key) onChange('all');
  };

  return (
    <>
      <button className={`chip${value === 'all' ? ' on' : ''}`}
        style={value === 'all' ? { background: 'var(--c-item)' } : undefined}
        onClick={() => onChange('all')}>{totalLabel}</button>
      {Object.values(lib.itemTypes).map((t) => (
        <span key={t.id} className={`chip cat${value === t.id ? ' on' : ''}`}
          style={value === t.id ? { background: t.color } : undefined}
          onClick={() => onChange(t.id)} role="button" tabIndex={0}>
          {t.label}s
          <button className="x" title={`Delete type "${t.label}"`}
            onClick={(e) => { e.stopPropagation(); deleteType(t.id); }}>×</button>
        </span>
      ))}
      <button className="chip addcat" onClick={addType}>+ New type</button>
    </>
  );
}
