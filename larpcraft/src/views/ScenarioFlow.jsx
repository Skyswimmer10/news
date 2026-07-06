import React, { useState } from 'react';
import { useGame, useDispatch, useLibrary } from '../state/store.jsx';
import { ENTITY_COLORS, Pill, PrimIcon } from '../components/bits.jsx';
import FlowCanvas from '../components/FlowCanvas.jsx';
import StructureThumb from '../components/StructureThumb.jsx';
import CsvButtons from '../components/CsvButtons.jsx';
import { importStory } from '../state/bridge.js';
import { genId } from '../data/csvSchemas.js';
import {
  BASE_NODE_TYPES, ADDITIONAL_NODE_TYPES, SUBNODE_TYPES, SUBNODE_BLANK,
  FACT_KINDS, NARR_NODE_TYPES,
} from '../data/seed.js';
import GraphEditor from '../components/GraphEditor.jsx';

// The Narrative Weaver canvas: Base Nodes + collapsed Additional Nodes
// (concepts) + Subnodes, kept deliberately calm — icons, short titles and
// badges live here; everything else lives in the inspector.

const BASE_PALETTE = Object.values(BASE_NODE_TYPES);
const SUB_PALETTE = Object.values(SUBNODE_TYPES);

export const nodeColor = (n) => {
  if (n._sub) return n.color || SUBNODE_TYPES[n.kind]?.color || '#F08CB4';
  if (n.kind === 'concept') return n.color || ADDITIONAL_NODE_TYPES[n.conceptKind]?.color || '#E8D25C';
  return n.color || BASE_NODE_TYPES[n.kind]?.color || NARR_NODE_TYPES[n.kind]?.color || ENTITY_COLORS[n.kind] || '#8B92A6';
};
const nodeIcon = (n) => {
  if (n._sub) return SUBNODE_TYPES[n.kind]?.icon || null;
  if (n.kind === 'concept') return ADDITIONAL_NODE_TYPES[n.conceptKind]?.icon || 'book';
  return BASE_NODE_TYPES[n.kind]?.icon || NARR_NODE_TYPES[n.kind]?.icon || null;
};

// A one-line canvas summary per subnode kind (details live in the inspector).
const subBody = (sn) => {
  switch (sn.kind) {
    case 'outcomeBranches': return `${sn.branches?.length ?? 0} branches · ${sn.mode}`;
    case 'relChange': return `${sn.relType || 'relationship'} · ${sn.direction}`;
    case 'internalState': return `${sn.stateType || 'state'}${sn.level ? ` · ${sn.level}` : ''}`;
    case 'locationArchetype': return sn.archetype;
    case 'narrativeResponse': return sn.text ? `${sn.text.slice(0, 60)}…` : 'empty';
    case 'emotionalTone': return (sn.tags || []).join(' · ') || 'no tags';
    default: return '';
  }
};

// Import Structure modal (kept from the earlier system — still the quickest
// way to drop a whole pre-made arc onto the canvas).
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
        <div className="modalfoot dim">Importing creates a detached copy on this game's canvas — the master template is untouched.</div>
      </div>
    </div>
  );
}

export default function ScenarioFlow({ selection, onSelect }) {
  const s = useGame();
  const lib = useLibrary();
  const dispatch = useDispatch();
  const [importing, setImporting] = useState(false);
  const [lane, setLane] = useState('all');
  const [query, setQuery] = useState('');
  const [openPath, setOpenPath] = useState([]); // drill-in path, ≤ 3 levels
  const teams = Object.values(s.teams);
  const facts = s.facts || {};
  const subnodesColl = s.subnodes || {};

  // ---- drill-in (Edit viewport for concepts / any node's inner graph) ----
  const openTitles = [];
  {
    let cur = s.nodes;
    for (const pid of openPath) {
      const n = cur?.[pid];
      if (!n) break;
      openTitles.push(n.title);
      cur = n.sub?.nodes;
    }
  }
  if (openPath.length && openTitles.length === openPath.length) {
    const depth = openPath.length;
    return (
      <div className="main">
        <div className="mhead">
          <div>
            <div className="crumb">
              {s.meta.name} / <button className="crumblink" onClick={() => { setOpenPath([]); onSelect(null); }}>Narrative</button>
              {openTitles.map((t, i) => (
                <span key={i}> / {i === openTitles.length - 1 ? <b>{t}</b>
                  : <button className="crumblink" onClick={() => { setOpenPath(openPath.slice(0, i + 1)); onSelect(null); }}>{t}</button>}</span>
              ))}
            </div>
            <h2>{openTitles[openTitles.length - 1]} · internal structure</h2>
          </div>
          <div className="right">
            <button className="btn" onClick={() => { setOpenPath(openPath.slice(0, -1)); onSelect(null); }}>← Up one level</button>
          </div>
        </div>
        <div className="subintro dim">Dedicated editing viewport — build the internal nodes, then return. Level {depth} of 3.</div>
        <GraphEditor scope={{ coll: 'nodes', parentPath: openPath }} palette={BASE_PALETTE}
          idPrefix={`${s.meta.prefix}-S`} selection={selection} onSelect={onSelect}
          allowOpen={depth < 3} onOpen={(id) => { setOpenPath([...openPath, id]); onSelect(null); }} />
        <div className="statusbar"><span>Editing an internal structure · saves live · <b>← Up one level</b> returns{depth < 3 ? ' · double-click nests one level deeper' : ' · max nesting depth reached'}.</span></div>
      </div>
    );
  }

  // ---- merged canvas model: nodes + subnodes in one map ----
  const merged = { ...s.nodes };
  for (const sn of Object.values(subnodesColl)) {
    merged[sn.id] = { ...sn, _sub: true, body: subBody(sn) };
  }

  // Subnode → parent attachment lines (with branch labels where relevant).
  const attachments = [];
  for (const sn of Object.values(subnodesColl)) {
    const pr = sn.parentRef;
    if (!pr) continue;
    const to = pr.nodeId || pr.subnodeId;
    if (!merged[to]) continue;
    let label = 'enriches';
    if (pr.subnodeId && pr.branchIndex != null) {
      const parent = subnodesColl[pr.subnodeId];
      label = parent?.branches?.[pr.branchIndex]?.label || `branch ${pr.branchIndex + 1}`;
    }
    attachments.push({ from: sn.id, to, label, color: SUBNODE_TYPES[sn.kind]?.color });
  }

  const addBase = (kind) => {
    const id = genId(s.nodes, `${s.meta.prefix}-N-`);
    dispatch({
      type: 'ADD_NODE',
      node: {
        id, kind, title: `New ${BASE_NODE_TYPES[kind].label.toLowerCase()}`,
        x: 90 + Math.round(Math.random() * 120), y: 80 + Math.round(Math.random() * 120),
        body: '', color: null, teamId: lane === 'all' ? null : lane, sets: [],
        locationId: null, itemId: null, mechanicIds: [], sensorIds: [], history: [],
      },
    });
    onSelect({ kind: 'node', id });
  };
  const addSub = (kind) => {
    const id = genId(subnodesColl, `${s.meta.prefix}-SB-`);
    const sn = { ...SUBNODE_BLANK(id, kind), x: 120 + Math.round(Math.random() * 160), y: 120 + Math.round(Math.random() * 140) };
    dispatch({ type: 'ADD_ENTITY', coll: 'subnodes', entity: sn });
    onSelect({ kind: 'subnode', id });
  };
  const addFrame = () => {
    const id = genId(s.frames || {}, 'FR-');
    dispatch({ type: 'ADD_ENTITY', coll: 'frames', entity: { id, label: 'New frame', x: 60, y: 60, w: 420, h: 300, color: null } });
    onSelect({ kind: 'frame', id });
  };

  const q = query.trim().toLowerCase();
  const matches = (n) => !q || `${n.title} ${n.body || ''}`.toLowerCase().includes(q);
  const dimNode = (n) => (lane !== 'all' && n.teamId && n.teamId !== lane) || !matches(n);
  const teamOf = (n) => (n.teamId && s.teams[n.teamId] ? { name: s.teams[n.teamId].name, color: s.teams[n.teamId].color } : null);
  const edgeFact = (e) => {
    const f = e.factId && facts[e.factId];
    if (!f) return null;
    const fk = FACT_KINDS[f.kind] || { color: '#8B92A6' };
    return { color: fk.color, title: `${e.expect === 'unset' ? 'NOT ' : ''}${f.name}` };
  };
  const selId = (selection?.kind === 'node' || selection?.kind === 'subnode') ? selection.id : null;
  const empty = Object.keys(merged).length === 0;

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">{s.meta.name} / <b>Narrative Weaver</b></div>
          <h2>Narrative</h2>
        </div>
        <div className="right">
          <input className="field-input search" placeholder="Search nodes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <CsvButtons coll="nodes" />
          <button className="btn" onClick={() => setImporting(true)}>⤓ Import Structure</button>
        </div>
      </div>

      <div className="toolrow">
        <span className="dim addlab">Base:</span>
        {BASE_PALETTE.map((t) => (
          <button key={t.id} className="addnode" title={t.blurb} onClick={() => addBase(t.id)}>
            <span className="sq" style={{ background: t.color }}><PrimIcon icon={t.icon} color="#fff" size={11} /></span>{t.label}
          </button>
        ))}
        <button className="addnode frameadd" title="A purely visual grouping box — nodes inside move together." onClick={addFrame}>▭ Frame</button>
      </div>
      <div className="toolrow subrow">
        <span className="dim addlab">Subnodes:</span>
        {SUB_PALETTE.map((t) => (
          <button key={t.id} className="addnode sub" title={t.blurb} onClick={() => addSub(t.id)}>
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
        </div>
      )}

      {empty ? (
        <div className="emptyview">
          <h3>The canvas is empty</h3>
          <p>Add Base Nodes (Event, Character, Story Location, Item, Quest), drop a concept from the Library, or import a Story Structure.</p>
          <div className="chips"><button className="btn primary" onClick={() => setImporting(true)}>⤓ Import Structure</button></div>
        </div>
      ) : (
        <FlowCanvas
          nodes={merged} edges={s.edges} selId={selId} colorOf={nodeColor}
          iconOf={nodeIcon} teamOf={teamOf} dimNode={dimNode} edgeFact={edgeFact}
          nodeClass={(n) => (n._sub ? 'subnode' : n.kind === 'concept' ? `concept${n.collapsed === false ? ' expanded' : ''}` : '')}
          attachments={attachments}
          onDetach={(subId) => dispatch({ type: 'UPDATE_ENTITY', coll: 'subnodes', id: subId, patch: { parentRef: null } })}
          frames={s.frames || {}} selFrame={selection?.kind === 'frame' ? selection.id : null}
          onFrameMove={(id, dx, dy) => dispatch({ type: 'FRAME_MOVE', frameId: id, dx, dy })}
          onFrameResize={(id, w, h) => dispatch({ type: 'UPDATE_ENTITY', coll: 'frames', id, patch: { w, h } })}
          onFrameSelect={(id) => onSelect({ kind: 'frame', id })}
          onSelect={(id) => onSelect(merged[id]?._sub ? { kind: 'subnode', id } : { kind: 'node', id })}
          onMove={(id, x, y) => dispatch({ type: 'UPDATE_ENTITY', coll: merged[id]?._sub ? 'subnodes' : 'nodes', id, patch: { x, y } })}
          onConnect={(from, to) => dispatch({ type: 'ADD_EDGE', from, to, color: nodeColor(merged[from]) })}
          onRemoveEdge={(e) => dispatch({ type: 'REMOVE_EDGE', from: e.from, to: e.to })}
          onSetColor={(id, color) => dispatch({ type: 'UPDATE_ENTITY', coll: merged[id]?._sub ? 'subnodes' : 'nodes', id, patch: { color } })}
          onDeleteNode={(id) => {
            dispatch(merged[id]?._sub ? { type: 'DELETE_SUBNODE', subnodeId: id } : { type: 'DELETE_NODE', nodeId: id });
            onSelect(null);
          }}
          onEditEdge={(e, label) => dispatch({ type: 'UPDATE_EDGE', from: e.from, to: e.to, patch: { label } })}
          onOpenNode={(id) => { if (!merged[id]?._sub) { setOpenPath([id]); onSelect(null); } }}
          onPasteNode={(p) => {
            const id = genId(s.nodes, `${s.meta.prefix}-N-`);
            dispatch({ type: 'ADD_NODE', node: { id, ...p, teamId: p.teamId ?? null, sets: [], locationId: null, itemId: null, mechanicIds: [], sensorIds: [], history: [] } });
            onSelect({ kind: 'node', id });
          }}
          renderExtra={(n) => {
            if (n._sub) return null;
            if (n.kind === 'concept') {
              const cnt = Object.keys(n.sub?.nodes || {}).length;
              const expanded = n.collapsed === false;
              return (
                <div className="cptbody">
                  {expanded && n.sub && <div className="cptmap"><StructureThumb structure={n.sub} lib={lib} width={200} height={110} /></div>}
                  <div className="cptrow">
                    <span className="cptbadge">{ADDITIONAL_NODE_TYPES[n.conceptKind]?.label ?? 'Concept'} · {cnt} inside</span>
                    <button className="linkbtn" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id: n.id, patch: { collapsed: expanded } }); }}>
                      {expanded ? '⊟ Collapse' : '⊞ Expand'}
                    </button>
                    <button className="linkbtn" onClick={(e) => { e.stopPropagation(); setOpenPath([n.id]); onSelect(null); }}>✎ Edit</button>
                  </div>
                </div>
              );
            }
            const item = n.itemId ? s.items[n.itemId] : null;
            const sets = (n.sets || []).map((x) => facts[x.factId]).filter(Boolean);
            const attached = Object.values(subnodesColl).filter((sn) => sn.parentRef?.nodeId === n.id).length;
            return (
              <>
                {item && (
                  <div className="nref">
                    <span className="mono">{item.id}</span>
                    <Pill availability={item.availability} />
                  </div>
                )}
                {(sets.length > 0 || attached > 0) && (
                  <div className="nsets">
                    {sets.map((f) => {
                      const fk = FACT_KINDS[f.kind] || { color: '#8B92A6' };
                      return <span key={f.id} className="factchip sm" style={{ borderColor: fk.color, color: fk.color }}><i style={{ background: fk.color }} />sets {f.name}</span>;
                    })}
                    {attached > 0 && <span className="factchip sm subcount"><i />{attached} subnode{attached === 1 ? '' : 's'}</span>}
                  </div>
                )}
              </>
            );
          }}
        />
      )}
      <div className="statusbar">
        <span><b>Base</b> nodes carry the story · <b>Subnodes</b> enrich (drag one on, then attach from its inspector — <b>⊘</b> on the line detaches) · <b>concepts</b> expand/edit · <b>double-click</b> opens internals.</span>
      </div>
      {importing && <StructureImportModal onClose={() => setImporting(false)}
        onImported={(id) => { setImporting(false); onSelect({ kind: 'node', id }); }} />}
    </div>
  );
}
