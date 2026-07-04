import React, { useState } from 'react';
import { useLibrary, useLibraryDispatch } from '../state/store.jsx';
import { Thumb, ENTITY_COLORS, PrimIcon } from '../components/bits.jsx';
import FlowCanvas from '../components/FlowCanvas.jsx';
import StructureThumb, { structNodeColor } from '../components/StructureThumb.jsx';
import { primitiveToStructNode } from '../state/bridge.js';

const TABS = [
  { id: 'items', label: 'Items & Gadgets', color: 'var(--c-item)' },
  { id: 'locations', label: 'Locations', color: 'var(--c-location)' },
  { id: 'mechanics', label: 'Rules & Mechanics', color: 'var(--c-mechanic)' },
  { id: 'sensors', label: 'Sensor hardware', color: 'var(--c-sensor)' },
  { id: 'primitives', label: 'Narrative Primitives', color: '#F08CB4' },
  { id: 'stories', label: 'Story Structures', color: 'var(--c-narrative)' },
];

// Draggable palette entry: drop onto the structure editor canvas to add a
// node built from this primitive.
function PalettePrimitive({ p, onSelect }) {
  return (
    <div className="pnode" draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/x-palette', p.id); e.dataTransfer.effectAllowed = 'copy'; }}
      onClick={onSelect} title={`${p.defaultBody} (drag onto the canvas)`}>
      <PrimIcon icon={p.icon} color={p.color} />
      <div><b>{p.name}</b><small>~{p.estMinutes} min</small></div>
    </div>
  );
}

// Editor for one Story Structure: the master template's node graph, globally
// editable. Every change dispatches to the LIBRARY store, permanently
// updating the template for future games.
function StructureEditor({ structure, selection, onSelect, onBack }) {
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();
  const patch = (p) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'stories', id: structure.id, patch: p });
  const selId = selection?.kind === 'lib-structnode' && selection.storyId === structure.id ? selection.id : null;

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb"><button className="linkbtn" onClick={onBack}>← Story Structures</button></div>
          <h2>{structure.name} <span className="libbadge inline">master template</span></h2>
        </div>
        <div className="right"><span className="mono dim">~{structure.estMinutes} min · {Object.keys(structure.nodes).length} nodes · {structure.edges.length} links</span></div>
      </div>
      <div className="structeditor">
        <div className="palette">
          <div className="lab">Narrative Primitives</div>
          <div className="hint" style={{ marginBottom: 9 }}>Drag onto the canvas to add a node to this template.</div>
          {Object.values(lib.primitives).map((p) => (
            <PalettePrimitive key={p.id} p={p} onSelect={() => onSelect({ kind: 'lib-primitives', id: p.id })} />
          ))}
        </div>
        <FlowCanvas
          nodes={structure.nodes} edges={structure.edges} selId={selId}
          colorOf={(n) => structNodeColor(n, lib)}
          onSelect={(id) => onSelect({ kind: 'lib-structnode', id, storyId: structure.id })}
          onMove={(id, x, y) => patch({ nodes: { ...structure.nodes, [id]: { ...structure.nodes[id], x, y } } })}
          onConnect={(from, to) => {
            if (structure.edges.some((e) => e.from === from && e.to === to)) return;
            patch({ edges: [...structure.edges, { from, to, label: '', color: null }] });
          }}
          onRemoveEdge={(e) => patch({ edges: structure.edges.filter((x) => !(x.from === e.from && x.to === e.to)) })}
          onSetColor={(id, color) => patch({ nodes: { ...structure.nodes, [id]: { ...structure.nodes[id], color } } })}
          onDropPalette={(primitiveId, x, y) => {
            const p = lib.primitives[primitiveId];
            if (!p) return;
            const node = primitiveToStructNode(p, structure.nodes, x, y);
            patch({ nodes: { ...structure.nodes, [node.id]: node } });
            onSelect({ kind: 'lib-structnode', id: node.id, storyId: structure.id });
          }}
        />
      </div>
      <div className="statusbar">
        <span>Editing the <b>master template</b> — changes apply to future imports. Games that already imported it keep their detached copies.</span>
      </div>
    </div>
  );
}

// The master database. Two narrative sub-sections: Narrative Primitives
// (isolated building-block node templates) and Story Structures (saved,
// editable node graphs assembled from primitives).
export default function Library({ selection, onSelect }) {
  const lib = useLibrary();
  const [tab, setTab] = useState('items');
  const [editingStory, setEditingStory] = useState(null);
  const selId = selection?.kind?.startsWith('lib-') ? selection.id : null;
  const pick = (coll, id) => onSelect({ kind: `lib-${coll}`, id });

  if (editingStory && lib.stories[editingStory]) {
    return <StructureEditor structure={lib.stories[editingStory]} selection={selection} onSelect={onSelect}
      onBack={() => { setEditingStory(null); setTab('stories'); }} />;
  }

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">Library / <b>Master database</b></div>
          <h2>Library Catalogue</h2>
        </div>
        <div className="right"><span className="libbadge">Templates — reusable across games</span></div>
      </div>
      <div className="toolrow">
        {TABS.map((t) => (
          <button key={t.id} className={`chip${tab === t.id ? ' on' : ''}`}
            style={tab === t.id ? { background: t.color } : undefined}
            onClick={() => setTab(t.id)}>
            {t.label} · {Object.keys(lib[t.id]).length}
          </button>
        ))}
      </div>

      {(tab === 'items' || tab === 'locations') && (
        <div className={`gallery${tab === 'locations' ? ' loc' : ''}`}>
          {Object.values(lib[tab]).map((t) => (
            <figure key={t.id} className={`card lib${selId === t.id ? ' sel' : ''}`} onClick={() => pick(tab, t.id)}>
              <div className="thumb"><Thumb image={t.image} type={t.type || 'location'} /></div>
              <figcaption>
                <b>{t.name}</b>
                <span className="tag libtag">Template · <span className="mono">{t.id}</span></span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {tab === 'mechanics' && (
        <div className="librows">
          {Object.values(lib.mechanics).map((m) => (
            <button key={m.id} className={`librow${selId === m.id ? ' sel' : ''}`} onClick={() => pick('mechanics', m.id)}>
              <span className="sq" style={{ background: ENTITY_COLORS.mechanic }} />
              <div><b>{m.name}</b><small>{m.summary}</small></div>
              <span className="mono dim">{m.id}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'sensors' && (
        <div className="librows">
          {Object.values(lib.sensors).map((x) => (
            <button key={x.id} className={`librow${selId === x.id ? ' sel' : ''}`} onClick={() => pick('sensors', x.id)}>
              <span className="sq" style={{ background: ENTITY_COLORS.sensor }} />
              <div><b>{x.kind}</b><small>{x.label}</small></div>
              <span className="mono dim">{x.id}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'primitives' && (
        <div className="gallery prim">
          {Object.values(lib.primitives).map((p) => (
            <button key={p.id} className={`primcard${selId === p.id ? ' sel' : ''}`}
              style={{ borderTopColor: p.color }} onClick={() => pick('primitives', p.id)}>
              <div className="primhead">
                <span className="primic" style={{ background: p.color }}><PrimIcon icon={p.icon} color="#fff" /></span>
                <b>{p.name}</b>
              </div>
              <small>{p.defaultBody}</small>
              <div className="primmeta">
                <span className="handle in">{p.inputs.length ? `in: ${p.inputs.join(', ')}` : 'entry point'}</span>
                <span className="handle out">{p.outputs.length ? `out: ${p.outputs.join(', ')}` : 'terminal'}</span>
              </div>
              <div className="primmeta dim mono">~{p.estMinutes} min · crew {p.crew} · {p.id}</div>
            </button>
          ))}
        </div>
      )}

      {tab === 'stories' && (
        <div className="structgrid pad">
          {Object.values(lib.stories).map((st) => (
            <button key={st.id} className={`structcard${selId === st.id ? ' sel' : ''}`}
              onClick={() => { pick('stories', st.id); setEditingStory(st.id); }}>
              <StructureThumb structure={st} lib={lib} />
              <b>{st.name}</b>
              <small>{st.description}</small>
              <div className="structmeta">
                <span className="mono">~{st.estMinutes} min</span>
                <span className="mono dim">{Object.keys(st.nodes).length} nodes · {st.edges.length} links</span>
                <span className="linkbtn">Open editor →</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="statusbar">
        <span>Editing a template updates the <b>master blueprint for future games</b> — instances already in a game keep their own copy.</span>
      </div>
    </div>
  );
}
