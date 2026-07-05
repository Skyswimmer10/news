import React, { useState } from 'react';
import { useLibrary, useLibraryDispatch } from '../state/store.jsx';
import { Thumb, ENTITY_COLORS, PrimIcon } from '../components/bits.jsx';
import FlowCanvas from '../components/FlowCanvas.jsx';
import StructureThumb, { structNodeColor } from '../components/StructureThumb.jsx';
import { narrativeToStructNode } from '../state/bridge.js';
import { LIB_BLANK, LIB_PREFIX } from '../data/seed.js';
import { genId } from '../data/csvSchemas.js';
import TypeChips from '../components/TypeChips.jsx';

const TABS = [
  { id: 'items', label: 'Items & Gadgets', color: 'var(--c-item)', addLabel: '+ New item template' },
  { id: 'locations', label: 'Locations', color: 'var(--c-location)', addLabel: '+ New location template' },
  { id: 'mechanics', label: 'Rules & Mechanics', color: 'var(--c-mechanic)', addLabel: '+ New mechanic' },
  { id: 'mechPrimitives', label: 'Mechanic Nodes', color: '#A87BF0', addLabel: '+ New mechanic node' },
  { id: 'sensors', label: 'Sensor hardware', color: 'var(--c-sensor)', addLabel: '+ New sensor type' },
  { id: 'narrative', label: 'Narrative', color: '#F08CB4', addLabel: '+ New narrative element' },
  { id: 'stories', label: 'Story Structures', color: 'var(--c-narrative)', addLabel: '+ New structure' },
];

// Three top-level groups keep the catalogue uncrowded. Story & Narrative holds
// only story content; the mechanic node tree lives under Game Mechanics.
const GROUP_META = {
  physical: { label: 'Physical', tabs: ['items', 'locations', 'sensors'] },
  mechanics: { label: 'Game Mechanics', tabs: ['mechanics', 'mechPrimitives'] },
  story: { label: 'Story & Narrative', tabs: ['narrative', 'stories'] },
};

const CATEGORY_COLORS = ['#F08CB4', '#5CA8F5', '#E0A23C', '#43BF87', '#A87BF0', '#E8D25C', '#3EC6D6', '#E86464'];

// Draggable palette entry (narrative node): drop onto the structure canvas.
function PaletteNode({ n, onSelect }) {
  return (
    <div className="pnode" draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/x-palette', n.id); e.dataTransfer.effectAllowed = 'copy'; }}
      onClick={onSelect} title={`${n.body || ''} (drag onto the canvas)`}>
      <PrimIcon icon={n.icon} color={n.color} />
      <div><b>{n.name}</b><small>{n.category}</small></div>
    </div>
  );
}

// Editor for one Story Structure: a pure narrative graph. The palette offers
// only narrative nodes (strict separation from mechanics). Every change
// dispatches to the LIBRARY store, updating the master template.
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
          <div className="lab">Narrative nodes</div>
          <div className="hint" style={{ marginBottom: 9 }}>Story content only. Drag onto the canvas to add a beat.</div>
          {Object.values(lib.narrative).map((n) => (
            <PaletteNode key={n.id} n={n} onSelect={() => onSelect({ kind: 'lib-narrative', id: n.id })} />
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
          onDropPalette={(narrativeId, x, y) => {
            const n = lib.narrative[narrativeId];
            if (!n) return;
            const node = narrativeToStructNode(n, structure.nodes, x, y);
            patch({ nodes: { ...structure.nodes, [node.id]: node } });
            onSelect({ kind: 'lib-structnode', id: node.id, storyId: structure.id });
          }}
          onPasteNode={(p) => {
            const id = genId(structure.nodes, 'S');
            const node = { id, primitiveId: p.primitiveId ?? null, kind: p.kind, title: p.title, x: p.x, y: p.y, body: p.body, color: p.color ?? null, image: p.image ?? null };
            patch({ nodes: { ...structure.nodes, [id]: node } });
            onSelect({ kind: 'lib-structnode', id, storyId: structure.id });
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
        <span>Editing the <b>master template</b> — pure narrative graph · <b>Ctrl+C</b>/<b>V</b> copy-paste · <b>Delete</b> removes a node.</span>
      </div>
    </div>
  );
}

export default function Library({ group = 'physical', selection, onSelect }) {
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();
  const groupMeta = GROUP_META[group] ?? GROUP_META.physical;
  const [tab, setTab] = useState(groupMeta.tabs[0]);
  const [editingStory, setEditingStory] = useState(null);
  const [narrFilter, setNarrFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const selId = selection?.kind?.startsWith('lib-') ? selection.id : null;
  const pick = (coll, id) => onSelect({ kind: `lib-${coll}`, id });

  React.useEffect(() => {
    if (!groupMeta.tabs.includes(tab)) { setTab(groupMeta.tabs[0]); setEditingStory(null); }
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
    if (tab === 'stories') setEditingStory(id);
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
              <div className="primmeta">
                <span className="handle in">{p.inputs.length ? `in: ${p.inputs.join(', ')}` : 'entry point'}</span>
                <span className="handle out">{p.outputs.length ? `out: ${p.outputs.join(', ')}` : 'terminal'}</span>
              </div>
              <div className="primmeta dim mono">{p.baseKind} · ~{p.estMinutes} min · {p.id}</div>
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
