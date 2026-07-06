import React, { useState } from 'react';
import { useLibrary, useLibraryDispatch, useGame, useDispatch } from '../state/store.jsx';
import { Thumb, ENTITY_COLORS, PrimIcon } from '../components/bits.jsx';
import FlowCanvas from '../components/FlowCanvas.jsx';
import StructureThumb, { structNodeColor } from '../components/StructureThumb.jsx';
import { narrativeToStructNode, mechPrimitiveToStructNode } from '../state/bridge.js';
import { LIB_BLANK, LIB_PREFIX, BASE_NODE_TYPES, ADDITIONAL_NODE_TYPES } from '../data/seed.js';
import { genId } from '../data/csvSchemas.js';
import TypeChips from '../components/TypeChips.jsx';

// Library catalogue order for Additional Node ("concept") categories.
const CONCEPT_ORDER = ['storyConcept', 'structureConcept', 'characterConcept', 'functionConcept', 'styleConcept'];

const TABS = [
  { id: 'items', label: 'Items & Gadgets', color: 'var(--c-item)', addLabel: '+ New item template' },
  { id: 'locations', label: 'Locations', color: 'var(--c-location)', addLabel: '+ New location template' },
  { id: 'mechanics', label: 'Rules & Mechanics', color: 'var(--c-mechanic)', addLabel: '+ New mechanic' },
  { id: 'mechPrimitives', label: 'Mechanic Nodes', color: '#A87BF0', addLabel: '+ New mechanic node' },
  { id: 'mechStructures', label: 'Mechanic Structures', color: 'var(--c-mechanic)', addLabel: '+ New mechanic structure' },
  { id: 'sensors', label: 'Sensor hardware', color: 'var(--c-sensor)', addLabel: '+ New sensor type' },
  { id: 'narrative', label: 'Narrative', color: '#F08CB4', addLabel: '+ New narrative element' },
  { id: 'stories', label: 'Story Structures', color: 'var(--c-narrative)', addLabel: '+ New structure' },
  { id: 'concepts', label: 'Concepts', color: '#E8D25C', addLabel: '+ New concept' },
];

// Three top-level groups keep the catalogue uncrowded. Story & Narrative holds
// only story content; the mechanic node tree lives under Game Mechanics.
const GROUP_META = {
  physical: { label: 'Physical', tabs: ['items', 'locations', 'sensors'] },
  mechanics: { label: 'Game Mechanics', tabs: ['mechPrimitives', 'mechStructures'] },
  story: { label: 'Story & Narrative', tabs: ['concepts', 'narrative', 'stories'] },
};

// The two structure kinds share one editor: same canvas, different node pool.
const STRUCT_KINDS = {
  stories: { paletteColl: 'narrative', paletteKind: 'lib-narrative', build: narrativeToStructNode, paletteLabel: 'Narrative nodes', paletteHint: 'Story content only. Drag onto the canvas to add a beat.', backLabel: '← Story Structures' },
  mechStructures: { paletteColl: 'mechPrimitives', paletteKind: 'lib-mechPrimitives', build: mechPrimitiveToStructNode, paletteLabel: 'Mechanic nodes', paletteHint: 'Sensors, puzzles, challenges, timers. Drag onto the canvas.', backLabel: '← Mechanic Structures' },
};

const CATEGORY_COLORS = ['#F08CB4', '#5CA8F5', '#E0A23C', '#43BF87', '#A87BF0', '#E8D25C', '#3EC6D6', '#E86464'];

// Draggable palette entry (narrative node): drop onto the structure canvas.
function PaletteNode({ n, onSelect }) {
  return (
    <div className="pnode" draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/x-palette', n.id); e.dataTransfer.effectAllowed = 'copy'; }}
      onClick={onSelect} title={`${n.body || ''} (drag onto the canvas)`}>
      <PrimIcon icon={n.icon} color={n.color} />
      <div><b>{n.name}</b>{n.category && <small>{n.category}</small>}</div>
    </div>
  );
}

// Preview (opened from the library): a live but non-editable mini mind-map of
// the internal structure plus example filled answers, with Add to Canvas.
function ConceptPreview({ concept, onClose }) {
  const lib = useLibrary();
  const proj = useGame();
  const dispatch = useDispatch();
  const meta = ADDITIONAL_NODE_TYPES[concept.category] || { label: 'Concept', color: '#E8D25C' };
  const addToCanvas = () => {
    const id = genId(proj.nodes, `${proj.meta.prefix}-N-`);
    dispatch({
      type: 'ADD_NODE',
      node: {
        id, kind: 'concept', conceptKind: concept.category, conceptId: concept.id,
        title: concept.name, x: 90, y: 90, body: concept.description, color: null,
        teamId: null, sets: [], collapsed: true, conceptAnswers: {}, history: [],
        sub: JSON.parse(JSON.stringify({ nodes: concept.nodes || {}, edges: concept.edges || [] })),
      },
    });
    onClose(true);
  };
  return (
    <div className="modal-backdrop" onClick={() => onClose(false)}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modalhead">
          <b>{concept.name}</b>
          <span className="cptbadge" style={{ color: meta.color, borderColor: meta.color }}>{meta.label}</span>
          <button className="x big" onClick={() => onClose(false)} aria-label="Close">×</button>
        </div>
        <div className="previewbody">
          <div className="previewmap">
            {Object.keys(concept.nodes || {}).length > 0
              ? <StructureThumb structure={concept} lib={lib} width={430} height={200} />
              : <div className="empty">Empty — build inside after adding, or open the editor.</div>}
            <div className="hint" style={{ marginTop: 6 }}>Live mini-map of the internal structure (read-only).</div>
          </div>
          <div className="previewinfo">
            <p className="dim">{concept.description || 'No description yet.'}</p>
            {(concept.questions || []).length > 0 && (
              <div className="previewqa">
                {concept.questions.map((q) => (
                  <div className="qa" key={q.key}>
                    <small>{q.label}</small>
                    <b>{concept.example?.[q.key] || '—'}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modalfoot">
          <button className="btn primary" onClick={addToCanvas}>Add to Canvas (collapsed)</button>
          <button className="btn" onClick={() => onClose(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}

// Dedicated editing viewport for a concept template's internal structure —
// same canvas engine, base-node palette. Edits update the master template.
function ConceptEditor({ concept, selection, onSelect, onBack }) {
  const libDispatch = useLibraryDispatch();
  const patch = (p) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'concepts', id: concept.id, patch: p });
  const selId = selection?.kind === 'lib-structnode' && selection.storyId === concept.id ? selection.id : null;
  const colorOf = (n) => n.color || BASE_NODE_TYPES[n.kind]?.color || '#8B92A6';
  const meta = ADDITIONAL_NODE_TYPES[concept.category] || { label: 'Concept' };
  const addBase = (kind) => {
    const id = genId(concept.nodes, 'S');
    const node = { id, kind, title: `New ${BASE_NODE_TYPES[kind].label.toLowerCase()}`, x: 80 + Math.round(Math.random() * 140), y: 70 + Math.round(Math.random() * 120), body: '', color: null };
    patch({ nodes: { ...concept.nodes, [id]: node } });
    onSelect({ kind: 'lib-structnode', id, storyId: concept.id, coll: 'concepts' });
  };
  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb"><button className="linkbtn" onClick={onBack}>← Concepts</button></div>
          <h2>{concept.name} <span className="libbadge inline">master template · {meta.label}</span></h2>
        </div>
        <div className="right"><span className="mono dim">{Object.keys(concept.nodes).length} nodes · {concept.edges.length} links</span></div>
      </div>
      <div className="toolrow">
        <span className="dim addlab">Add:</span>
        {Object.values(BASE_NODE_TYPES).map((t) => (
          <button key={t.id} className="addnode" title={t.blurb} onClick={() => addBase(t.id)}>
            <span className="sq" style={{ background: t.color }}><PrimIcon icon={t.icon} color="#fff" size={11} /></span>{t.label}
          </button>
        ))}
      </div>
      <FlowCanvas
        nodes={concept.nodes} edges={concept.edges} selId={selId} colorOf={colorOf}
        iconOf={(n) => BASE_NODE_TYPES[n.kind]?.icon || null}
        onSelect={(id) => onSelect({ kind: 'lib-structnode', id, storyId: concept.id, coll: 'concepts' })}
        onMove={(id, x, y) => patch({ nodes: { ...concept.nodes, [id]: { ...concept.nodes[id], x, y } } })}
        onConnect={(from, to) => {
          if (concept.edges.some((e) => e.from === from && e.to === to)) return;
          patch({ edges: [...concept.edges, { from, to, label: '', color: null }] });
        }}
        onRemoveEdge={(e) => patch({ edges: concept.edges.filter((x) => !(x.from === e.from && x.to === e.to)) })}
        onSetColor={(id, color) => patch({ nodes: { ...concept.nodes, [id]: { ...concept.nodes[id], color } } })}
        onDeleteNode={(id) => {
          const nodes = { ...concept.nodes };
          delete nodes[id];
          patch({ nodes, edges: concept.edges.filter((e) => e.from !== id && e.to !== id) });
          onSelect(null);
        }}
        onEditEdge={(e, label) => patch({ edges: concept.edges.map((x) => (x.from === e.from && x.to === e.to ? { ...x, label } : x)) })}
        onPasteNode={(p) => {
          const id = genId(concept.nodes, 'S');
          patch({ nodes: { ...concept.nodes, [id]: { id, kind: p.kind, title: p.title, x: p.x, y: p.y, body: p.body, color: p.color ?? null } } });
        }}
      />
      <div className="statusbar">
        <span>Editing the <b>master template</b> — every game that adds it later gets this structure · rename / describe it from the inspector.</span>
      </div>
    </div>
  );
}

// One editor drives both Story Structures and Mechanic Structures: the same
// FlowCanvas (drag, connect, disconnect, recolor, delete, copy/paste, edge
// labels), only the node palette differs. Every change updates the master
// template in the LIBRARY store.
function StructureEditor({ coll, structure, selection, onSelect, onBack }) {
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();
  const cfg = STRUCT_KINDS[coll];
  const patch = (p) => libDispatch({ type: 'UPDATE_ENTITY', coll, id: structure.id, patch: p });
  const selId = selection?.kind === 'lib-structnode' && selection.storyId === structure.id ? selection.id : null;

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb"><button className="linkbtn" onClick={onBack}>{cfg.backLabel}</button></div>
          <h2>{structure.name} <span className="libbadge inline">master template</span></h2>
        </div>
        <div className="right"><span className="mono dim">~{structure.estMinutes} min · {Object.keys(structure.nodes).length} nodes · {structure.edges.length} links</span></div>
      </div>
      <div className="structeditor">
        <div className="palette">
          <div className="lab">{cfg.paletteLabel}</div>
          <div className="hint" style={{ marginBottom: 9 }}>{cfg.paletteHint}</div>
          {Object.values(lib[cfg.paletteColl]).map((n) => (
            <PaletteNode key={n.id} n={n} onSelect={() => onSelect({ kind: cfg.paletteKind, id: n.id })} />
          ))}
        </div>
        <FlowCanvas
          nodes={structure.nodes} edges={structure.edges} selId={selId}
          colorOf={(n) => structNodeColor(n, lib)}
          onSelect={(id) => onSelect({ kind: 'lib-structnode', id, storyId: structure.id, coll })}
          onMove={(id, x, y) => patch({ nodes: { ...structure.nodes, [id]: { ...structure.nodes[id], x, y } } })}
          onConnect={(from, to) => {
            if (structure.edges.some((e) => e.from === from && e.to === to)) return;
            patch({ edges: [...structure.edges, { from, to, label: '', color: null }] });
          }}
          onRemoveEdge={(e) => patch({ edges: structure.edges.filter((x) => !(x.from === e.from && x.to === e.to)) })}
          onSetColor={(id, color) => patch({ nodes: { ...structure.nodes, [id]: { ...structure.nodes[id], color } } })}
          onDropPalette={(nodeTypeId, x, y) => {
            const t = lib[cfg.paletteColl][nodeTypeId];
            if (!t) return;
            const node = cfg.build(t, structure.nodes, x, y);
            patch({ nodes: { ...structure.nodes, [node.id]: node } });
            onSelect({ kind: 'lib-structnode', id: node.id, storyId: structure.id, coll });
          }}
          onPasteNode={(p) => {
            const id = genId(structure.nodes, 'S');
            const node = { id, primitiveId: p.primitiveId ?? null, kind: p.kind, title: p.title, x: p.x, y: p.y, body: p.body, color: p.color ?? null, image: p.image ?? null };
            patch({ nodes: { ...structure.nodes, [id]: node } });
            onSelect({ kind: 'lib-structnode', id, storyId: structure.id, coll });
          }}
          onDeleteNode={(id) => {
            const nodes = { ...structure.nodes };
            delete nodes[id];
            patch({ nodes, edges: structure.edges.filter((e) => e.from !== id && e.to !== id) });
            onSelect(null);
          }}
          onEditEdge={(e, label) => patch({ edges: structure.edges.map((x) => (x.from === e.from && x.to === e.to ? { ...x, label } : x)) })}
        />
      </div>
      <div className="statusbar">
        <span>Editing the <b>master template</b> · drag to arrange · <b>○ port</b> connects, click a link to disconnect · <b>Ctrl+C</b>/<b>V</b> copy-paste · <b>Delete</b> removes a node.</span>
      </div>
    </div>
  );
}

export default function Library({ group = 'physical', selection, onSelect }) {
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();
  const proj = useGame();
  const projDispatch = useDispatch();
  const groupMeta = GROUP_META[group] ?? GROUP_META.physical;
  const [tab, setTab] = useState(groupMeta.tabs[0]);
  const [editing, setEditing] = useState(null); // { coll, id } for a structure being edited
  const [preview, setPreview] = useState(null); // concept id being previewed
  const [narrFilter, setNarrFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const selId = selection?.kind?.startsWith('lib-') ? selection.id : null;
  const pick = (coll, id) => onSelect({ kind: `lib-${coll}`, id });

  React.useEffect(() => {
    if (!groupMeta.tabs.includes(tab)) { setTab(groupMeta.tabs[0]); setEditing(null); }
  }, [group]); // eslint-disable-line react-hooks/exhaustive-deps

  const addNew = () => {
    const id = genId(lib[tab], LIB_PREFIX[tab]);
    let entity = LIB_BLANK[tab](id);
    if (tab === 'narrative') {
      const cat = narrFilter !== 'all' && lib.narrativeCategories[narrFilter]
        ? narrFilter : Object.keys(lib.narrativeCategories)[0] ?? 'story-beat';
      const meta = lib.narrativeCategories[cat];
      entity = { ...entity, category: cat, color: meta?.color ?? entity.color, icon: meta?.icon ?? entity.icon };
    }
    libDispatch({ type: 'ADD_ENTITY', coll: tab, entity });
    pick(tab, id);
    if (tab === 'stories' || tab === 'mechStructures' || tab === 'concepts') setEditing({ coll: tab, id });
  };

  // "Create new …" inside a specific concept category: starts completely
  // empty; the designer builds inside, renames, and it becomes reusable.
  const addConcept = (category) => {
    const id = genId(lib.concepts, LIB_PREFIX.concepts);
    const entity = { ...LIB_BLANK.concepts(id), category, name: `New ${ADDITIONAL_NODE_TYPES[category]?.label.toLowerCase() ?? 'concept'}` };
    libDispatch({ type: 'ADD_ENTITY', coll: 'concepts', entity });
    pick('concepts', id);
    setEditing({ coll: 'concepts', id });
  };
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  // ---- editable narrative categories ----
  const addCategory = () => {
    const label = window.prompt('Name for the new narrative category:');
    if (!label?.trim()) return;
    let key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
    while (lib.narrativeCategories[key]) key += '-2';
    const color = CATEGORY_COLORS[Object.keys(lib.narrativeCategories).length % CATEGORY_COLORS.length];
    libDispatch({ type: 'ADD_ENTITY', coll: 'narrativeCategories', entity: { id: key, label: label.trim(), color, icon: 'flag' } });
    setNarrFilter(key);
  };
  const deleteCategory = (key) => {
    const remaining = Object.keys(lib.narrativeCategories).filter((k) => k !== key);
    if (remaining.length === 0) { window.alert('At least one category must remain.'); return; }
    const used = Object.values(lib.narrative).filter((n) => n.category === key);
    const fallback = remaining[0];
    const msg = used.length
      ? `Delete "${lib.narrativeCategories[key].label}"? ${used.length} item(s) will move to "${lib.narrativeCategories[fallback].label}".`
      : `Delete the empty category "${lib.narrativeCategories[key].label}"?`;
    if (!window.confirm(msg)) return;
    used.forEach((n) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'narrative', id: n.id, patch: { category: fallback } }));
    libDispatch({ type: 'DELETE_ENTITY', coll: 'narrativeCategories', id: key });
    if (narrFilter === key) setNarrFilter('all');
  };

  if (editing && lib[editing.coll]?.[editing.id]) {
    if (editing.coll === 'concepts') {
      return <ConceptEditor concept={lib.concepts[editing.id]} selection={selection} onSelect={onSelect}
        onBack={() => { setEditing(null); setTab('concepts'); }} />;
    }
    return <StructureEditor coll={editing.coll} structure={lib[editing.coll][editing.id]} selection={selection} onSelect={onSelect}
      onBack={() => { setEditing(null); setTab(editing.coll); }} />;
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
              {t.label} · {Object.keys(lib[t.id] ?? {}).length}
            </button>
          );
        })}
      </div>

      {tab === 'items' && (
        <div className="toolrow" style={{ paddingBottom: 12 }}>
          <TypeChips value={typeFilter} onChange={setTypeFilter} totalLabel={`All types · ${Object.keys(lib.items).length}`} />
        </div>
      )}
      {(tab === 'items' || tab === 'locations') && (
        <div className={`gallery${tab === 'locations' ? ' loc' : ''}`}>
          {Object.values(lib[tab]).filter((t) => tab !== 'items' || typeFilter === 'all' || t.type === typeFilter).map((t) => (
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
              <div><b>{m.name}</b><small>{m.summary}{m.params?.length ? ` · ${m.params.map((p) => `${p.label} ${p.value}`).join(', ')}` : ''}</small></div>
              <span className="mono dim">{m.id}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'mechPrimitives' && (
        <div className="gallery prim">
          {Object.values(lib.mechPrimitives).map((p) => (
            <button key={p.id} className={`primcard${selId === p.id ? ' sel' : ''}`}
              style={{ borderTopColor: p.color }} onClick={() => pick('mechPrimitives', p.id)}>
              <div className="primhead">
                <span className="primic" style={{ background: p.color }}><PrimIcon icon={p.icon} color="#fff" /></span>
                <b>{p.name}</b>
              </div>
              <small>{p.defaultBody}</small>
              <div className="primmeta dim mono">~{p.estMinutes} min · {p.id}</div>
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

      {tab === 'narrative' && (
        <div className="elemwrap">
          <div className="toolrow" style={{ paddingTop: 12 }}>
            <button className={`chip${narrFilter === 'all' ? ' on' : ''}`}
              style={narrFilter === 'all' ? { background: '#F08CB4' } : undefined}
              onClick={() => setNarrFilter('all')}>All · {Object.keys(lib.narrative).length}</button>
            {Object.values(lib.narrativeCategories).map((meta) => (
              <span key={meta.id} className={`chip cat${narrFilter === meta.id ? ' on' : ''}`}
                style={narrFilter === meta.id ? { background: meta.color } : undefined}
                onClick={() => setNarrFilter(meta.id)} role="button" tabIndex={0}>
                {meta.label}s
                <button className="x" title={`Delete category "${meta.label}"`}
                  onClick={(e) => { e.stopPropagation(); deleteCategory(meta.id); }}>×</button>
              </span>
            ))}
            <button className="chip addcat" onClick={addCategory}>+ New category</button>
          </div>
          <div className="gallery elem">
            {Object.values(lib.narrative)
              .filter((n) => narrFilter === 'all' || n.category === narrFilter)
              .map((n) => {
                const meta = lib.narrativeCategories[n.category] ?? { label: n.category, color: '#8B92A6' };
                return (
                  <button key={n.id} className={`elemcard${selId === n.id ? ' sel' : ''}`}
                    style={{ borderTopColor: n.color || meta.color }} onClick={() => pick('narrative', n.id)}>
                    <span className="etag" style={{ color: n.color || meta.color }}><PrimIcon icon={n.icon} color={n.color || meta.color} size={12} /> {meta.label}</span>
                    <b>{n.name}</b>
                    <small>{n.body}</small>
                    <div className="primmeta dim mono">{(n.tags || []).map((t) => `#${t}`).join(' ')} · {n.id}</div>
                  </button>
                );
              })}
            {Object.values(lib.narrative).every((n) => narrFilter !== 'all' && n.category !== narrFilter) && (
              <div className="empty" style={{ gridColumn: '1/-1' }}>
                Nothing in this category yet — <b>{activeTab.addLabel}</b> creates one here.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'concepts' && (
        <div className="cptcatalogue">
          {/* Base Nodes — the minimum independent building blocks. */}
          <div className="cptsection">
            <div className="cptsectionhead">Base Nodes</div>
            <div className="cptgrid">
              {Object.values(BASE_NODE_TYPES).map((t) => (
                <div key={t.id} className="cptcard base" style={{ borderTopColor: t.color }}>
                  <div className="primhead">
                    <span className="primic" style={{ background: t.color }}><PrimIcon icon={t.icon} color="#fff" /></span>
                    <b>{t.label}</b>
                  </div>
                  <small>{t.blurb}</small>
                  <div className="structmeta">
                    <button className="btn" onClick={() => {
                      const id = genId(proj.nodes, `${proj.meta.prefix}-N-`);
                      projDispatch({ type: 'ADD_NODE', node: { id, kind: t.id, title: `New ${t.label.toLowerCase()}`, x: 90, y: 90, body: '', color: null, teamId: null, sets: [], locationId: null, itemId: null, mechanicIds: [], sensorIds: [], history: [] } });
                    }}>Add to Canvas</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Additional Node categories, in the locked order. */}
          {CONCEPT_ORDER.map((cat) => {
            const meta = ADDITIONAL_NODE_TYPES[cat];
            const inCat = Object.values(lib.concepts ?? {}).filter((c) => c.category === cat);
            return (
              <div className="cptsection" key={cat}>
                <div className="cptsectionhead" style={{ color: meta.color }}>
                  <PrimIcon icon={meta.icon} color={meta.color} size={13} /> {meta.label}s
                </div>
                <div className="cptgrid">
                  <button className="cptcard create" onClick={() => addConcept(cat)}>
                    <b>+ Create new {meta.label.toLowerCase()}…</b>
                    <small>Starts completely empty — build inside, rename, save. It becomes a reusable template.</small>
                  </button>
                  {inCat.map((c) => (
                    <button key={c.id} className={`cptcard${selId === c.id ? ' sel' : ''}`} style={{ borderTopColor: meta.color }}
                      onClick={() => { pick('concepts', c.id); setPreview(c.id); }}>
                      <div className="primhead">
                        <span className="primic" style={{ background: meta.color }}><PrimIcon icon={meta.icon} color="#fff" /></span>
                        <b>{c.name}</b>
                        {c.premade && <span className="cptbadge premade">pre-made</span>}
                      </div>
                      <StructureThumb structure={c} lib={lib} width={216} height={70} />
                      <small>{c.description}</small>
                      <div className="primmeta dim mono">{Object.keys(c.nodes).length} nodes · {c.id}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'concepts' && preview && lib.concepts?.[preview] && (
        <ConceptPreview concept={lib.concepts[preview]} onClose={() => setPreview(null)} />
      )}

      {(tab === 'stories' || tab === 'mechStructures') && (
        <div className="structgrid pad">
          {Object.values(lib[tab]).map((st) => (
            <button key={st.id} className={`structcard${selId === st.id ? ' sel' : ''}`}
              onClick={() => { pick(tab, st.id); setEditing({ coll: tab, id: st.id }); }}>
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
          {Object.keys(lib[tab]).length === 0 && (
            <div className="empty" style={{ gridColumn: '1/-1' }}>No structures yet — <b>{activeTab.addLabel}</b> opens a blank canvas.</div>
          )}
        </div>
      )}

      <div className="statusbar">
        <span>Editing a template updates the <b>master blueprint for future games</b> — instances already in a game keep their own copy.</span>
      </div>
    </div>
  );
}
