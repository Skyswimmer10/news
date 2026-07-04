import React, { useState } from 'react';
import { useLibrary, useLibraryDispatch } from '../state/store.jsx';
import { Thumb, ENTITY_COLORS, PrimIcon } from '../components/bits.jsx';
import FlowCanvas from '../components/FlowCanvas.jsx';
import StructureThumb, { structNodeColor } from '../components/StructureThumb.jsx';
import { primitiveToStructNode } from '../state/bridge.js';
import { LIB_BLANK, LIB_PREFIX } from '../data/seed.js';
import { genId } from '../data/csvSchemas.js';

const TABS = [
  { id: 'items', label: 'Items & Gadgets', color: 'var(--c-item)', addLabel: '+ New item template' },
  { id: 'locations', label: 'Locations', color: 'var(--c-location)', addLabel: '+ New location template' },
  { id: 'mechanics', label: 'Rules & Mechanics', color: 'var(--c-mechanic)', addLabel: '+ New mechanic' },
  { id: 'sensors', label: 'Sensor hardware', color: 'var(--c-sensor)', addLabel: '+ New sensor type' },
  { id: 'primitives', label: 'Narrative Primitives', color: '#F08CB4', addLabel: '+ New primitive' },
  { id: 'elements', label: 'Narrative Elements', color: '#E8D25C', addLabel: '+ New element' },
  { id: 'stories', label: 'Story Structures', color: 'var(--c-narrative)', addLabel: '+ New structure' },
];

// Three top-level groups keep the catalogue uncrowded; each sidebar entry
// shows only its own collections.
const GROUP_META = {
  physical: { label: 'Physical', tabs: ['items', 'locations', 'sensors'] },
  mechanics: { label: 'Game Mechanics', tabs: ['mechanics'] },
  story: { label: 'Story & Narrative', tabs: ['primitives', 'elements', 'stories'] },
};

const CATEGORY_COLORS = ['#F08CB4', '#5CA8F5', '#E0A23C', '#43BF87', '#A87BF0', '#E8D25C', '#3EC6D6', '#E86464'];

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
          onPasteNode={(p) => {
            const id = genId(structure.nodes, 'S');
            const node = { id, primitiveId: p.primitiveId ?? null, kind: p.kind, title: p.title, x: p.x, y: p.y, body: p.body, color: p.color ?? null };
            patch({ nodes: { ...structure.nodes, [id]: node } });
            onSelect({ kind: 'lib-structnode', id, storyId: structure.id });
          }}
        />
      </div>
      <div className="statusbar">
        <span>Editing the <b>master template</b> — changes apply to future imports · <b>Ctrl+C</b> copies the selected node, <b>Ctrl+V</b> pastes (works across canvases).</span>
      </div>
    </div>
  );
}

// The master database. Two narrative sub-sections: Narrative Primitives
// (isolated building-block node templates) and Story Structures (saved,
// editable node graphs assembled from primitives).
export default function Library({ group = 'physical', selection, onSelect }) {
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();
  const groupMeta = GROUP_META[group] ?? GROUP_META.physical;
  const [tab, setTab] = useState(groupMeta.tabs[0]);
  const [editingStory, setEditingStory] = useState(null);
  const [elemFilter, setElemFilter] = useState('all');
  const selId = selection?.kind?.startsWith('lib-') ? selection.id : null;
  const pick = (coll, id) => onSelect({ kind: `lib-${coll}`, id });

  // Switching sidebar groups lands on that group's first collection.
  React.useEffect(() => {
    if (!groupMeta.tabs.includes(tab)) { setTab(groupMeta.tabs[0]); setEditingStory(null); }
  }, [group]); // eslint-disable-line react-hooks/exhaustive-deps

  // "+ New …" for every library section: create a blank template, select it;
  // new structures open straight into the graph editor.
  const addNew = () => {
    const id = genId(lib[tab], LIB_PREFIX[tab]);
    let entity = LIB_BLANK[tab](id);
    if (tab === 'elements') {
      const etype = elemFilter !== 'all' && lib.elementTypes[elemFilter]
        ? elemFilter : Object.keys(lib.elementTypes)[0] ?? 'plot-hook';
      entity = { ...entity, etype };
    }
    libDispatch({ type: 'ADD_ENTITY', coll: tab, entity });
    pick(tab, id);
    if (tab === 'stories') setEditingStory(id);
  };
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  // ---- editable element categories ----
  const addCategory = () => {
    const label = window.prompt('Name for the new element category:');
    if (!label?.trim()) return;
    let key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
    while (lib.elementTypes[key]) key += '-2';
    const color = CATEGORY_COLORS[Object.keys(lib.elementTypes).length % CATEGORY_COLORS.length];
    libDispatch({ type: 'ADD_ENTITY', coll: 'elementTypes', entity: { id: key, label: label.trim(), color } });
    setElemFilter(key);
  };
  const deleteCategory = (key) => {
    const remaining = Object.keys(lib.elementTypes).filter((k) => k !== key);
    if (remaining.length === 0) { window.alert('At least one category must remain.'); return; }
    const used = Object.values(lib.elements).filter((el) => el.etype === key);
    const fallback = remaining[0];
    const msg = used.length
      ? `Delete "${lib.elementTypes[key].label}"? ${used.length} element(s) will be moved to "${lib.elementTypes[fallback].label}".`
      : `Delete the empty category "${lib.elementTypes[key].label}"?`;
    if (!window.confirm(msg)) return;
    used.forEach((el) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'elements', id: el.id, patch: { etype: fallback } }));
    libDispatch({ type: 'DELETE_ENTITY', coll: 'elementTypes', id: key });
    if (elemFilter === key) setElemFilter('all');
  };

  if (editingStory && lib.stories[editingStory]) {
    return <StructureEditor structure={lib.stories[editingStory]} selection={selection} onSelect={onSelect}
      onBack={() => { setEditingStory(null); setTab('stories'); }} />;
  }

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">Library / <b>{groupMeta.label}</b></div>
          <h2>Library — {groupMeta.label}</h2>
        </div>
        <div className="right">
          <span className="libbadge">Templates — reusable across games</span>
          <button className="btn primary" onClick={addNew}>{activeTab.addLabel}</button>
        </div>
      </div>
      <div className="toolrow">
        {groupMeta.tabs.map((tid) => {
          const t = TABS.find((x) => x.id === tid);
          return (
            <button key={t.id} className={`chip${tab === t.id ? ' on' : ''}`}
              style={tab === t.id ? { background: t.color } : undefined}
              onClick={() => setTab(t.id)}>
              {t.label} · {Object.keys(lib[t.id]).length}
            </button>
          );
        })}
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

      {tab === 'elements' && (
        <div className="elemwrap">
          <div className="toolrow" style={{ paddingTop: 12 }}>
            <button className={`chip${elemFilter === 'all' ? ' on' : ''}`}
              style={elemFilter === 'all' ? { background: '#E8D25C', color: '#1A1D26' } : undefined}
              onClick={() => setElemFilter('all')}>All · {Object.keys(lib.elements).length}</button>
            {Object.values(lib.elementTypes).map((meta) => (
              <span key={meta.id} className={`chip cat${elemFilter === meta.id ? ' on' : ''}`}
                style={elemFilter === meta.id ? { background: meta.color } : undefined}
                onClick={() => setElemFilter(meta.id)} role="button" tabIndex={0}>
                {meta.label}s
                <button className="x" title={`Delete category "${meta.label}"`}
                  onClick={(e) => { e.stopPropagation(); deleteCategory(meta.id); }}>×</button>
              </span>
            ))}
            <button className="chip addcat" onClick={addCategory}>+ New category</button>
          </div>
          <div className="gallery elem">
            {Object.values(lib.elements)
              .filter((el) => elemFilter === 'all' || el.etype === elemFilter)
              .map((el) => {
                const meta = lib.elementTypes[el.etype] ?? { label: el.etype, color: '#8B92A6' };
                return (
                  <button key={el.id} className={`elemcard${selId === el.id ? ' sel' : ''}`}
                    style={{ borderTopColor: meta.color }} onClick={() => pick('elements', el.id)}>
                    <span className="etag" style={{ color: meta.color }}>{meta.label}</span>
                    <b>{el.name}</b>
                    <small>{el.text}</small>
                    <div className="primmeta dim mono">{el.tags.map((t) => `#${t}`).join(' ')} · {el.id}</div>
                  </button>
                );
              })}
            {Object.values(lib.elements).every((el) => elemFilter !== 'all' && el.etype !== elemFilter) && (
              <div className="empty" style={{ gridColumn: '1/-1' }}>
                No elements in this category yet — <b>{activeTab.addLabel}</b> creates one here.
              </div>
            )}
          </div>
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
