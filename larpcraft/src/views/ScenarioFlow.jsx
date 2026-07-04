import React, { useRef, useState } from 'react';
import { useGame, useDispatch } from '../state/store.jsx';
import { ENTITY_COLORS, Pill } from '../components/bits.jsx';
import CsvButtons from '../components/CsvButtons.jsx';

const NODE_W = 236;
const KIND_LABEL = { story: 'Story beat', location: 'Location', objective: 'Objective', enemy: 'Enemy encounter', mechanic: 'Mechanic', sensor: 'Sensor trigger' };
const KINDS = Object.keys(KIND_LABEL);
const SWATCHES = ['#5CA8F5', '#43BF87', '#E0A23C', '#E86464', '#A87BF0', '#3EC6D6', '#E8D25C', '#F08CB4'];

// A node's top color: explicit pick wins, otherwise its kind color.
export const nodeColor = (n) => n.color || ENTITY_COLORS[n.kind] || '#8B92A6';

// Interactive node canvas:
//  - drag a node body to move it
//  - drag from the round port on a node's right edge onto another node to connect
//  - click the square swatch in a node header to recolor that node
//  - "+ add" row creates new nodes, which the inspector can link to records
export default function ScenarioFlow({ selection, onSelect }) {
  const s = useGame();
  const dispatch = useDispatch();
  const canvasRef = useRef(null);
  const dragRef = useRef(null);            // { id, offX, offY, moved }
  const [linkDrag, setLinkDrag] = useState(null); // { from, x, y }
  const [pickerFor, setPickerFor] = useState(null);

  const nodes = Object.values(s.nodes);
  const selId = selection?.kind === 'node' ? selection.id : null;
  const extentX = Math.max(1400, ...nodes.map((n) => n.x + NODE_W + 320));
  const extentY = Math.max(620, ...nodes.map((n) => n.y + 360));

  const canvasPoint = (e) => {
    const el = canvasRef.current;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left + el.scrollLeft, y: e.clientY - r.top + el.scrollTop };
  };
  const outAnchor = (n) => ({ x: n.x + NODE_W, y: n.y + 36 });
  const inAnchor = (n) => ({ x: n.x, y: n.y + 36 });

  // ---- node dragging ----
  const onNodeDown = (e, n) => {
    if (e.button !== 0 || e.target.closest('.port, .icpick, .swatchpop, .x')) return;
    const p = canvasPoint(e);
    dragRef.current = { id: n.id, offX: p.x - n.x, offY: p.y - n.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onNodeMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const p = canvasPoint(e);
    const x = Math.max(8, Math.round(p.x - d.offX));
    const y = Math.max(8, Math.round(p.y - d.offY));
    const n = s.nodes[d.id];
    if (!d.moved && Math.abs(x - n.x) + Math.abs(y - n.y) < 4) return;
    d.moved = true;
    dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id: d.id, patch: { x, y } });
  };
  const onNodeUp = (e, n) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved) { onSelect({ kind: 'node', id: n.id }); setPickerFor(null); }
  };

  // ---- connecting: drag from a port onto another node ----
  const onPortDown = (e, n) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = canvasPoint(e);
    setLinkDrag({ from: n.id, x: p.x, y: p.y });
  };
  const onPortMove = (e) => {
    if (!linkDrag) return;
    const p = canvasPoint(e);
    setLinkDrag((l) => ({ ...l, x: p.x, y: p.y }));
  };
  const onPortUp = (e) => {
    if (!linkDrag) return;
    const targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-node]');
    const to = targetEl?.dataset.node;
    if (to && to !== linkDrag.from) {
      dispatch({ type: 'ADD_EDGE', from: linkDrag.from, to, color: nodeColor(s.nodes[linkDrag.from]) });
    }
    setLinkDrag(null);
  };

  // ---- adding nodes ----
  const addNode = (kind) => {
    const el = canvasRef.current;
    const id = `N-${Date.now().toString(36).toUpperCase()}`;
    const node = {
      id, kind, title: `New ${KIND_LABEL[kind].toLowerCase()}`,
      x: Math.round((el?.scrollLeft ?? 0) + 90 + Math.random() * 120),
      y: Math.round((el?.scrollTop ?? 0) + 80 + Math.random() * 120),
      body: '', color: null, locationId: null, itemId: null, mechanicIds: [], sensorIds: [],
    };
    dispatch({ type: 'ADD_NODE', node });
    onSelect({ kind: 'node', id });
  };

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">Operation Chimera / Narrative &amp; Quests / <b>Main questline</b></div>
          <h2>Scenario Flow — Act 1</h2>
        </div>
        <div className="right">
          <CsvButtons coll="nodes" />
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

      <div className="canvas" ref={canvasRef}>
        <svg className="edges" width={extentX} height={extentY}>
          {s.edges.map((e, idx) => {
            const from = s.nodes[e.from], to = s.nodes[e.to];
            if (!from || !to) return null;
            const a = outAnchor(from), b = inAnchor(to);
            const mx = (a.x + b.x) / 2;
            const color = e.color || ENTITY_COLORS[e.kindColor] || '#8B92A6';
            return (
              <g key={idx}>
                <path d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`} stroke={color} strokeWidth="2" fill="none" opacity=".8" />
                <foreignObject x={mx - 75} y={(a.y + b.y) / 2 - 26} width="150" height="28">
                  <div className="elab" style={{ borderColor: color, color }}>
                    <span>{e.label || '•'}</span>
                    <button className="x" title="Remove connection"
                      onClick={() => dispatch({ type: 'REMOVE_EDGE', from: e.from, to: e.to })}>×</button>
                  </div>
                </foreignObject>
              </g>
            );
          })}
          {linkDrag && (() => {
            const a = outAnchor(s.nodes[linkDrag.from]);
            const mx = (a.x + linkDrag.x) / 2;
            return <path d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${linkDrag.y}, ${linkDrag.x} ${linkDrag.y}`}
              stroke={nodeColor(s.nodes[linkDrag.from])} strokeWidth="2" strokeDasharray="6 5" fill="none" opacity=".9" />;
          })()}
        </svg>

        {nodes.map((n) => {
          const item = n.itemId ? s.items[n.itemId] : null;
          const color = nodeColor(n);
          return (
            <div
              key={n.id} data-node={n.id} role="button" tabIndex={0}
              className={`node${selId === n.id ? ' sel' : ''}${linkDrag && linkDrag.from !== n.id ? ' droppable' : ''}`}
              style={{ left: n.x, top: n.y, width: NODE_W, borderTopColor: color }}
              onPointerDown={(e) => onNodeDown(e, n)}
              onPointerMove={onNodeMove}
              onPointerUp={(e) => onNodeUp(e, n)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect({ kind: 'node', id: n.id }); }}
            >
              <div className="nh">
                <button className="icpick" style={{ background: color }} title="Change node color"
                  onClick={(e) => { e.stopPropagation(); setPickerFor(pickerFor === n.id ? null : n.id); }} />
                <div><small style={{ color }}>{KIND_LABEL[n.kind]}</small><b>{n.title}</b></div>
              </div>
              <div className="nb">
                {n.body}
                {item && (
                  <div className="nref">
                    <span className="mono">{item.id}</span>
                    <span className="mono dim">{item.buildStatus}</span>
                    <Pill availability={item.availability} />
                  </div>
                )}
              </div>
              <span className="port" title="Drag to another node to connect"
                onPointerDown={(e) => onPortDown(e, n)} onPointerMove={onPortMove} onPointerUp={onPortUp} />
              {pickerFor === n.id && (
                <div className="swatchpop" onPointerDown={(e) => e.stopPropagation()}>
                  {SWATCHES.map((c) => (
                    <button key={c} className={`swatch${color === c ? ' on' : ''}`} style={{ background: c }}
                      onClick={() => { dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id: n.id, patch: { color: c } }); setPickerFor(null); }} />
                  ))}
                  <label className="swatch custom" title="Custom color">
                    <input type="color" value={color} onChange={(e) =>
                      dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id: n.id, patch: { color: e.target.value } })} />
                  </label>
                  <button className="swatchauto" onClick={() => {
                    dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id: n.id, patch: { color: null } }); setPickerFor(null);
                  }}>Auto</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="statusbar">
        <span>Drag nodes to arrange · drag the <b>○ port</b> onto another node to connect · click a node's <b>■ swatch</b> to recolor.</span>
      </div>
    </div>
  );
}
