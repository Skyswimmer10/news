import React, { useState } from 'react';
import { useGame, useDispatch, useLibrary } from '../state/store.jsx';
import { ENTITY_COLORS, Pill } from '../components/bits.jsx';
import FlowCanvas, { KIND_LABEL } from '../components/FlowCanvas.jsx';
import StructureThumb from '../components/StructureThumb.jsx';
import CsvButtons from '../components/CsvButtons.jsx';
import { importStory } from '../state/bridge.js';
import { genId } from '../data/csvSchemas.js';

const KINDS = Object.keys(KIND_LABEL);

export const nodeColor = (n) => n.color || ENTITY_COLORS[n.kind] || '#8B92A6';

// Import Structure modal: pick a Story Structure from the Library; the whole
// graph is instantiated as a detached copy on this game's canvas.
function StructureImportModal({ onClose, onImported }) {
  const lib = useLibrary();
  const proj = useGame();
  const dispatch = useDispatch();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modalhead">
          <b>Import Structure — Story Structures from the Library</b>
          <button className="x big" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="structgrid">
          {Object.values(lib.stories).map((st) => (
            <div className="structcard" key={st.id}>
              <StructureThumb structure={st} lib={lib} />
              <b>{st.name}</b>
              <small>{st.description}</small>
              <div className="structmeta">
                <span className="mono">~{st.estMinutes} min</span>
                <span className="mono dim">{Object.keys(st.nodes).length} nodes</span>
                <button className="btn primary" onClick={() => {
                  const result = importStory(lib, proj, st.id);
                  if (!result) return;
                  dispatch({ type: 'IMPORT_FROM_LIBRARY', ...result });
                  onImported(result.createdId);
                }}>Import</button>
              </div>
            </div>
          ))}
        </div>
        <div className="modalfoot dim">Importing creates a detached copy on this game's canvas — edit it freely, the master template is untouched.</div>
      </div>
    </div>
  );
}

export default function ScenarioFlow({ selection, onSelect }) {
  const s = useGame();
  const dispatch = useDispatch();
  const [importing, setImporting] = useState(false);
  const selId = selection?.kind === 'node' ? selection.id : null;
  const empty = Object.keys(s.nodes).length === 0;

  const addNode = (kind) => {
    const id = `N-${Date.now().toString(36).toUpperCase()}`;
    const node = {
      id, kind, title: `New ${KIND_LABEL[kind].toLowerCase()}`,
      x: 90 + Math.round(Math.random() * 120), y: 80 + Math.round(Math.random() * 120),
      body: '', color: null, primitiveId: null, locationId: null, itemId: null, mechanicIds: [], sensorIds: [],
    };
    dispatch({ type: 'ADD_NODE', node });
    onSelect({ kind: 'node', id });
  };

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">{s.meta.name} / Narrative &amp; Quests / <b>Main questline</b></div>
          <h2>Scenario Flow</h2>
        </div>
        <div className="right">
          <CsvButtons coll="nodes" />
          <button className="btn" onClick={() => setImporting(true)}>⤓ Import Structure</button>
        </div>
      </div>
      <div className="toolrow">
        <span className="dim addlab">Add node:</span>
        {KINDS.map((k) => (
          <button key={k} className="addnode" onClick={() => addNode(k)}>
            <span className="sq" style={{ background: ENTITY_COLORS[k] }} />{KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {empty ? (
        <div className="emptyview">
          <h3>The questline is empty</h3>
          <p>Start from a pre-made Story Structure, or add nodes one by one from the row above.</p>
          <div className="chips">
            <button className="btn primary" onClick={() => setImporting(true)}>⤓ Import Structure</button>
          </div>
        </div>
      ) : (
        <FlowCanvas
          nodes={s.nodes} edges={s.edges} selId={selId} colorOf={nodeColor}
          onSelect={(id) => onSelect({ kind: 'node', id })}
          onMove={(id, x, y) => dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id, patch: { x, y } })}
          onConnect={(from, to) => dispatch({ type: 'ADD_EDGE', from, to, color: nodeColor(s.nodes[from]) })}
          onRemoveEdge={(e) => dispatch({ type: 'REMOVE_EDGE', from: e.from, to: e.to })}
          onSetColor={(id, color) => dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id, patch: { color } })}
          onPasteNode={(p) => {
            const id = genId(s.nodes, `${s.meta.prefix}-N-`);
            dispatch({
              type: 'ADD_NODE',
              node: { id, ...p, locationId: null, itemId: null, mechanicIds: [], sensorIds: [] },
            });
            onSelect({ kind: 'node', id });
          }}
          renderExtra={(n) => {
            const item = n.itemId ? s.items[n.itemId] : null;
            if (!item) return null;
            return (
              <div className="nref">
                <span className="mono">{item.id}</span>
                <span className="mono dim">{item.buildStatus}</span>
                <Pill availability={item.availability} />
              </div>
            );
          }}
        />
      )}
      <div className="statusbar">
        <span>Drag to arrange · drag the <b>○ port</b> to connect · <b>■ swatch</b> recolors · <b>Ctrl+C</b> copies the selected node, <b>Ctrl+V</b> pastes.</span>
      </div>
      {importing && <StructureImportModal onClose={() => setImporting(false)}
        onImported={(id) => { setImporting(false); onSelect({ kind: 'node', id }); }} />}
    </div>
  );
}
