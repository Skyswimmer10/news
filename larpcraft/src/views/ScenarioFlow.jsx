import React, { useState } from 'react';
import { useGame, useDispatch, useLibrary } from '../state/store.jsx';
import { ENTITY_COLORS, Pill, PrimIcon } from '../components/bits.jsx';
import FlowCanvas from '../components/FlowCanvas.jsx';
import StructureThumb from '../components/StructureThumb.jsx';
import CsvButtons from '../components/CsvButtons.jsx';
import { importStory } from '../state/bridge.js';
import { genId } from '../data/csvSchemas.js';
import { NARR_NODE_TYPES, FACT_KINDS } from '../data/seed.js';

export const nodeColor = (n) => n.color || ENTITY_COLORS[n.kind] || '#8B92A6';
const nodeIcon = (n) => NARR_NODE_TYPES[n.kind]?.icon || null;

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
  const [lane, setLane] = useState('all'); // 'all' | teamId
  const selId = selection?.kind === 'node' ? selection.id : null;
  const empty = Object.keys(s.nodes).length === 0;
  const teams = Object.values(s.teams);
  const facts = s.facts || {};

  const addNode = (kind) => {
    const id = genId(s.nodes, `${s.meta.prefix}-N-`);
    const t = NARR_NODE_TYPES[kind];
    const node = {
      id, kind, title: `New ${(t?.label || kind).toLowerCase()}`,
      x: 90 + Math.round(Math.random() * 120), y: 80 + Math.round(Math.random() * 120),
      body: '', color: null, primitiveId: null,
      teamId: lane === 'all' ? null : lane, sets: [],
      locationId: null, itemId: null, mechanicIds: [], sensorIds: [],
      ...(kind === 'timed' ? { startMin: s.meta.timeline?.startMin ?? 540 } : {}),
    };
    dispatch({ type: 'ADD_NODE', node });
    onSelect({ kind: 'node', id });
  };

  // A node is dimmed when a specific lane is active and the node is neither in
  // that lane nor shared (teamId null shows in every lane).
  const dimNode = (n) => lane !== 'all' && n.teamId && n.teamId !== lane;
  const teamOf = (n) => (n.teamId && s.teams[n.teamId] ? { name: s.teams[n.teamId].name, color: s.teams[n.teamId].color } : null);
  // A gated connection referencing a fact shows a coloured dot in its label.
  const edgeFact = (e) => {
    const f = e.factId && facts[e.factId];
    if (!f) return null;
    const fk = FACT_KINDS[f.kind] || { color: '#8B92A6' };
    return { color: fk.color, title: `${e.expect === 'unset' ? 'NOT ' : ''}${f.name} · ${fk.label ?? f.kind}` };
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
        {Object.values(NARR_NODE_TYPES).map((t) => (
          <button key={t.id} className="addnode" title={t.blurb} onClick={() => addNode(t.id)}>
            <span className="sq" style={{ background: t.color }}><PrimIcon icon={t.icon} color="#fff" size={11} /></span>{t.label}
          </button>
        ))}
      </div>

      {teams.length > 0 && (
        <div className="lanerow">
          <span className="dim addlab">Lane:</span>
          <button className={`lanetab${lane === 'all' ? ' on' : ''}`} onClick={() => setLane('all')}>All teams</button>
          {teams.map((t) => (
            <button key={t.id} className={`lanetab${lane === t.id ? ' on' : ''}`} onClick={() => setLane(t.id)}>
              <span className="sq" style={{ background: t.color }} />{t.name}
            </button>
          ))}
          {lane !== 'all' && <span className="lanehint dim">Shared beats stay lit; other lanes dim. New nodes drop into this lane.</span>}
        </div>
      )}

      {empty ? (
        <div className="emptyview">
          <h3>The questline is empty</h3>
          <p>Start from a pre-made Story Structure, or add a typed node from the row above — beats, reveals, branches, fact changes, timed events and recovery paths.</p>
          <div className="chips">
            <button className="btn primary" onClick={() => setImporting(true)}>⤓ Import Structure</button>
          </div>
        </div>
      ) : (
        <FlowCanvas
          nodes={s.nodes} edges={s.edges} selId={selId} colorOf={nodeColor}
          iconOf={nodeIcon} teamOf={teamOf} dimNode={dimNode} edgeFact={edgeFact}
          onSelect={(id) => onSelect({ kind: 'node', id })}
          onMove={(id, x, y) => dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id, patch: { x, y } })}
          onConnect={(from, to) => dispatch({ type: 'ADD_EDGE', from, to, color: nodeColor(s.nodes[from]) })}
          onRemoveEdge={(e) => dispatch({ type: 'REMOVE_EDGE', from: e.from, to: e.to })}
          onSetColor={(id, color) => dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id, patch: { color } })}
          onDeleteNode={(id) => { dispatch({ type: 'DELETE_NODE', nodeId: id }); onSelect(null); }}
          onEditEdge={(e, label) => dispatch({ type: 'UPDATE_EDGE', from: e.from, to: e.to, patch: { label } })}
          onPasteNode={(p) => {
            const id = genId(s.nodes, `${s.meta.prefix}-N-`);
            dispatch({
              type: 'ADD_NODE',
              node: { id, ...p, teamId: p.teamId ?? null, sets: [], locationId: null, itemId: null, mechanicIds: [], sensorIds: [] },
            });
            onSelect({ kind: 'node', id });
          }}
          renderExtra={(n) => {
            const item = n.itemId ? s.items[n.itemId] : null;
            const sets = (n.sets || []).map((x) => facts[x.factId]).filter(Boolean);
            return (
              <>
                {item && (
                  <div className="nref">
                    <span className="mono">{item.id}</span>
                    <span className="mono dim">{item.buildStatus}</span>
                    <Pill availability={item.availability} />
                  </div>
                )}
                {sets.length > 0 && (
                  <div className="nsets">
                    {sets.map((f) => {
                      const fk = FACT_KINDS[f.kind] || { color: '#8B92A6' };
                      return <span key={f.id} className="factchip sm" style={{ borderColor: fk.color, color: fk.color }}><i style={{ background: fk.color }} />sets {f.name}</span>;
                    })}
                  </div>
                )}
              </>
            );
          }}
        />
      )}
      <div className="statusbar">
        <span>Drag to arrange · <b>○ port</b> connects · click a connection's label to set its <b>plain-language condition</b> · a coloured dot marks a fact gate · <b>Ctrl+C/V</b> copy · <b>Delete</b> removes.</span>
      </div>
      {importing && <StructureImportModal onClose={() => setImporting(false)}
        onImported={(id) => { setImporting(false); onSelect({ kind: 'node', id }); }} />}
    </div>
  );
}
