import React from 'react';
import { useGame, useDispatch } from '../state/store.jsx';
import { locateGraph } from '../state/reducer.js';
import { ENTITY_COLORS, PrimIcon } from './bits.jsx';
import FlowCanvas from './FlowCanvas.jsx';
import { genId } from '../data/csvSchemas.js';

const scopeKey = (s) => `${s.coll}:${(s.parentPath ?? (s.parentId ? [s.parentId] : [])).join('/')}`;
const sameScope = (a, b) => a && b && scopeKey(a) === scopeKey(b);

// A self-contained node canvas bound to one located graph (a surface task flow
// or any node's nested `.sub`). All edits flow through the generic GRAPH_*
// actions, so the same component drives every level of the hierarchy.
//   scope   — { coll, parentId? } locating the graph to edit
//   palette — typed node kinds to offer in the add row
//   allowOpen / onOpen — enable double-click drill-in on this level
export default function GraphEditor({ scope, palette, allowOpen, onOpen, selection, onSelect, idPrefix = 'D' }) {
  const s = useGame();
  const dispatch = useDispatch();
  const g = locateGraph(s, scope);
  const paletteById = Object.fromEntries(palette.map((p) => [p.id, p]));
  const selId = selection?.kind === 'graphnode' && sameScope(selection.scope, scope) ? selection.id : null;

  const colorOf = (n) => n.color || paletteById[n.kind]?.color || ENTITY_COLORS[n.kind] || '#8B92A6';
  const iconOf = (n) => paletteById[n.kind]?.icon || null;

  const addNode = (kind) => {
    const id = genId(g.nodes, `${idPrefix}-`);
    const node = {
      id, kind, title: `New ${(paletteById[kind]?.label || kind).toLowerCase()}`,
      x: 70 + Math.round(Math.random() * 110), y: 70 + Math.round(Math.random() * 100),
      body: '', color: null,
    };
    dispatch({ type: 'GRAPH_ADD_NODE', scope, node });
    onSelect({ kind: 'graphnode', scope, id });
  };

  const empty = Object.keys(g.nodes).length === 0;

  return (
    <>
      <div className="toolrow">
        <span className="dim addlab">Add:</span>
        {palette.map((p) => (
          <button key={p.id} className="addnode" title={p.blurb} onClick={() => addNode(p.id)}>
            <span className="sq" style={{ background: p.color }}>{p.icon && <PrimIcon icon={p.icon} color="#fff" size={11} />}</span>{p.label}
          </button>
        ))}
      </div>
      {empty ? (
        <div className="emptyview">
          <h3>Nothing here yet</h3>
          <p>Add a node from the row above to start building this out.</p>
        </div>
      ) : (
        <FlowCanvas
          nodes={g.nodes} edges={g.edges} selId={selId} colorOf={colorOf} iconOf={iconOf}
          onSelect={(id) => onSelect({ kind: 'graphnode', scope, id })}
          onMove={(id, x, y) => dispatch({ type: 'GRAPH_UPDATE_NODE', scope, id, patch: { x, y } })}
          onConnect={(from, to) => dispatch({ type: 'GRAPH_ADD_EDGE', scope, from, to, color: colorOf(g.nodes[from]) })}
          onRemoveEdge={(e) => dispatch({ type: 'GRAPH_REMOVE_EDGE', scope, from: e.from, to: e.to })}
          onSetColor={(id, color) => dispatch({ type: 'GRAPH_UPDATE_NODE', scope, id, patch: { color } })}
          onDeleteNode={(id) => { dispatch({ type: 'GRAPH_DELETE_NODE', scope, id }); onSelect(null); }}
          onEditEdge={(e, label) => dispatch({ type: 'GRAPH_UPDATE_EDGE', scope, from: e.from, to: e.to, patch: { label } })}
          onOpenNode={allowOpen ? onOpen : undefined}
          onPasteNode={(p) => {
            const id = genId(g.nodes, `${idPrefix}-`);
            dispatch({ type: 'GRAPH_ADD_NODE', scope, node: { id, kind: p.kind, title: p.title, body: p.body ?? '', color: p.color ?? null, x: p.x, y: p.y } });
            onSelect({ kind: 'graphnode', scope, id });
          }}
          renderExtra={allowOpen ? (n) => {
            const cnt = Object.keys(n.sub?.nodes || {}).length;
            return <div className="nsub dim">{cnt > 0 ? `${cnt} detail node${cnt === 1 ? '' : 's'} · double-click to open` : 'double-click to add detail'}</div>;
          } : undefined}
        />
      )}
    </>
  );
}
