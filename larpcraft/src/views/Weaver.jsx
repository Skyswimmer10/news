import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGame, useDispatch, useLibrary, useLibraryDispatch } from '../state/store.jsx';
import { ENTITY_COLORS } from '../components/bits.jsx';
import FlowCanvas from '../components/FlowCanvas.jsx';
import { storyTrackToStructure } from '../state/bridge.js';
import { genId } from '../data/csvSchemas.js';
import { LIB_PREFIX, NARRATIVE_KINDS } from '../data/seed.js';

// Story-side nodes (the macro track) vs. mechanical task nodes (the timeline).
const isStory = (n) => NARRATIVE_KINDS.includes(n.kind) || !!n.elementId;
const KIND_LABEL = { location: 'Location', objective: 'Objective', enemy: 'Enemy', mechanic: 'Mechanic', sensor: 'Sensor' };
const nodeColor = (n) => n.color || ENTITY_COLORS[n.kind] || '#8B92A6';
const pad2 = (v) => String(v).padStart(2, '0');
const toLabel = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
const parseHM = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim()); return m ? +m[1] * 60 + +m[2] : null; };

// Split-Screen Weaver: left = the macro story track (an editable node canvas),
// right = the mechanical timeline (tasks scheduled on a real clock). Alignment
// curves cross the divider tying a story beat to the task it drives.
export default function Weaver() {
  const s = useGame();
  const dispatch = useDispatch();
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const barDrag = useRef(null);
  const [armed, setArmed] = useState(null);
  const [, setTick] = useState(0);
  const anchorsRef = useRef({});
  const anchors = anchorsRef.current;

  const win = s.meta.timeline || { startMin: 540, endMin: 1020 };
  const span = Math.max(60, win.endMin - win.startMin);
  const aligns = s.alignments || [];

  const storyNodes = Object.values(s.nodes).filter(isStory);
  const tasks = Object.values(s.nodes).filter((n) => !isStory(n)).sort((a, b) => (a.startMin ?? 9999) - (b.startMin ?? 9999) || a.x - b.x);
  const effStart = (t, i) => t.startMin ?? Math.round(win.startMin + ((i + 1) * span) / (tasks.length + 1));
  const effDur = (t) => t.durationMin ?? 45;

  // Left-panel view nodes use the Weaver's own story-track layout.
  const storyView = storyNodes.map((n, i) => {
    const pos = s.storyTrack?.[n.id] || { x: 60, y: 40 + i * 180 };
    return { ...n, x: pos.x, y: pos.y };
  }).reduce((m, n) => { m[n.id] = n; return m; }, {});
  const storyEdges = s.edges.filter((e) => s.nodes[e.from] && s.nodes[e.to] && isStory(s.nodes[e.from]) && isStory(s.nodes[e.to]));

  // ---- alignment anchors, measured from the live DOM. Only commit when the
  // measurement actually changes so the layout effect converges (no loop). ----
  useLayoutEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const cr = c.getBoundingClientRect();
    const next = {};
    c.querySelector('.wpanel.left')?.querySelectorAll('[data-node]').forEach((el) => {
      const r = el.getBoundingClientRect();
      next[`story:${el.dataset.node}`] = { x: r.right - cr.left, y: r.top - cr.top + r.height / 2 };
    });
    c.querySelectorAll('[data-task]').forEach((el) => {
      const r = el.getBoundingClientRect();
      next[`task:${el.dataset.task}`] = { x: r.left - cr.left, y: r.top - cr.top + r.height / 2 };
    });
    const prev = anchorsRef.current;
    const keys = Object.keys(next);
    const changed = keys.length !== Object.keys(prev).length
      || keys.some((k) => !prev[k] || Math.abs(prev[k].x - next[k].x) > 0.5 || Math.abs(prev[k].y - next[k].y) > 0.5);
    if (changed) { anchorsRef.current = next; setTick((t) => t + 1); }
  });
  useEffect(() => {
    const onWin = () => setTick((t) => t + 1);
    window.addEventListener('resize', onWin);
    const ro = new ResizeObserver(onWin);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { window.removeEventListener('resize', onWin); ro.disconnect(); };
  }, []);

  const toggleAlign = (taskId) => {
    if (!armed) return;
    const exists = aligns.some((a) => a.story === armed && a.task === taskId);
    dispatch({ type: exists ? 'REMOVE_ALIGN' : 'ADD_ALIGN', story: armed, task: taskId });
  };

  // ---- timeline task bar dragging (reschedule) ----
  const xOf = (min, innerW) => 8 + ((min - win.startMin) / span) * innerW;
  const onBarDown = (e, t, i) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    barDrag.current = { id: t.id, startX: e.clientX, orig: effStart(t, i), dur: effDur(t), moved: false };
  };
  const onBarMove = (e) => {
    const d = barDrag.current;
    if (!d) return;
    const innerW = (trackRef.current?.clientWidth ?? 600) - 16;
    const deltaMin = ((e.clientX - d.startX) / innerW) * span;
    if (Math.abs(e.clientX - d.startX) > 3) d.moved = true;
    let next = Math.round((d.orig + deltaMin) / 5) * 5;
    next = Math.max(win.startMin, Math.min(win.endMin - d.dur, next));
    dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id: d.id, patch: { startMin: next, durationMin: d.dur } });
  };
  const onBarUp = (t) => {
    const d = barDrag.current; barDrag.current = null;
    if (d && !d.moved) toggleAlign(t.id);
  };

  const saveTemplate = () => {
    const name = window.prompt('Save this story track to the Library as a Story Structure named:', `${s.meta.name} — story arc`);
    if (!name?.trim()) return;
    const id = genId(lib.stories, LIB_PREFIX.stories);
    libDispatch({ type: 'ADD_ENTITY', coll: 'stories', entity: storyTrackToStructure(s, id, name.trim()) });
    window.alert(`Saved "${name.trim()}" to Library → Story & Narrative → Story Structures.`);
  };
  const editWindow = () => {
    const v = window.prompt('Day window as HH:MM-HH:MM', `${toLabel(win.startMin)}-${toLabel(win.endMin)}`);
    if (!v) return;
    const [a, b] = v.split('-');
    const startMin = parseHM(a || ''); const endMin = parseHM(b || '');
    if (startMin != null && endMin != null && endMin > startMin) dispatch({ type: 'SET_META', patch: { timeline: { startMin, endMin } } });
  };

  const innerW = (trackRef.current?.clientWidth ?? 600) - 16;
  const hours = [];
  for (let h = Math.ceil(win.startMin / 60); h * 60 <= win.endMin; h++) hours.push(h * 60);
  const rowH = 48; const headH = 30;

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">{s.meta.name} / <b>Weaver</b></div>
          <h2>Split-Screen Weaver</h2>
        </div>
        <div className="right"><span className="dim" style={{ fontSize: 12 }}>
          {armed ? 'Now click a task on the timeline to link it · click the story beat again to cancel' : 'Click a story beat, then a task, to align them'}
        </span></div>
      </div>

      <div className="weaver2" ref={containerRef} onScroll={() => setTick((t) => t + 1)}>
        {/* alignment curves across the divider */}
        <svg className="align-overlay" width="100%" height="100%" aria-hidden="true">
          {aligns.map((a, i) => {
            const p = anchors[`story:${a.story}`]; const q = anchors[`task:${a.task}`];
            if (!p || !q) return null;
            const mx = (p.x + q.x) / 2;
            const color = ENTITY_COLORS[s.nodes[a.task]?.kind] || 'var(--brand)';
            return (
              <g key={i}>
                <path d={`M ${p.x} ${p.y} C ${mx} ${p.y}, ${mx} ${q.y}, ${q.x} ${q.y}`} className="wline" style={{ stroke: color }} />
                <path d={`M ${p.x} ${p.y} C ${mx} ${p.y}, ${mx} ${q.y}, ${q.x} ${q.y}`} className="whit"
                  onClick={() => dispatch({ type: 'REMOVE_ALIGN', story: a.story, task: a.task })} />
              </g>
            );
          })}
        </svg>

        {/* LEFT: macro story track — editable node canvas */}
        <div className="wpanel left">
          <div className="wphead">
            <span>Active Story Track — <b>{s.meta.name}</b></span>
            <button className="btn ghost small" onClick={saveTemplate}>⤴ Save as Template</button>
          </div>
          <FlowCanvas
            nodes={storyView} edges={storyEdges} selId={armed} colorOf={nodeColor}
            onSelect={(id) => setArmed((cur) => (cur === id ? null : id))}
            onMove={(id, x, y) => dispatch({ type: 'SET_STORY_POS', nodeId: id, x, y })}
            onConnect={(from, to) => dispatch({ type: 'ADD_EDGE', from, to, color: nodeColor(s.nodes[from]) })}
            onRemoveEdge={(e) => dispatch({ type: 'REMOVE_EDGE', from: e.from, to: e.to })}
            onSetColor={(id, color) => dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id, patch: { color } })}
            onDeleteNode={(id) => { dispatch({ type: 'DELETE_NODE', nodeId: id }); setArmed(null); }}
            onEditEdge={(e, label) => dispatch({ type: 'UPDATE_EDGE', from: e.from, to: e.to, patch: { label } })}
          />
        </div>

        {/* RIGHT: mechanical timeline — real clock schedule */}
        <div className="wpanel right">
          <div className="wphead">
            <span>Mechanical Timeline — <b>{toLabel(win.startMin)}–{toLabel(win.endMin)}</b></span>
            <button className="btn ghost small" onClick={editWindow}>✎ Edit window</button>
          </div>
          <div className="timeline" ref={trackRef} onPointerMove={onBarMove} onPointerUp={() => (barDrag.current = null)}>
            <div className="tlaxis" style={{ height: headH }}>
              {hours.map((m) => (
                <span key={m} className="tltick" style={{ left: xOf(m, innerW) }}>{toLabel(m)}</span>
              ))}
            </div>
            <div className="tlgrid">
              {hours.map((m) => <i key={m} style={{ left: xOf(m, innerW) }} />)}
            </div>
            {tasks.map((t, i) => {
              const start = effStart(t, i); const dur = effDur(t);
              const left = xOf(start, innerW);
              const width = Math.max(72, (dur / span) * innerW);
              const linkedToArmed = armed && aligns.some((a) => a.story === armed && a.task === t.id);
              return (
                <div key={t.id} data-task={t.id} className={`tlbar${linkedToArmed ? ' linked' : ''}${armed ? ' arming' : ''}`}
                  style={{ left, width, top: headH + 6 + i * rowH, borderLeftColor: ENTITY_COLORS[t.kind] }}
                  onPointerDown={(e) => onBarDown(e, t, i)} onPointerUp={() => onBarUp(t)} title={`${t.title} · ${toLabel(start)}–${toLabel(start + dur)}`}>
                  <span className="tlkind" style={{ color: ENTITY_COLORS[t.kind] }}>{KIND_LABEL[t.kind] || t.kind}</span>
                  <b>{t.title}</b>
                  <span className="tltime mono">{toLabel(start)}–{toLabel(start + dur)}</span>
                </div>
              );
            })}
            {tasks.length === 0 && <div className="empty" style={{ padding: 24 }}>No tasks yet — add objective / location / mechanic / sensor nodes on the Narrative &amp; Quests canvas.</div>}
            <div style={{ height: headH + tasks.length * rowH + 20 }} />
          </div>
        </div>
      </div>

      <div className="statusbar">
        <span><b>{aligns.length}</b> alignments · drag a timeline bar to reschedule · click a link to remove · <b>Save as Template</b> stores the story arc in the Library.</span>
      </div>
    </div>
  );
}
