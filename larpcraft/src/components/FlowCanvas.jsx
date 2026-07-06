import React, { useEffect, useRef, useState } from 'react';
import { ENTITY_COLORS, PrimIcon } from './bits.jsx';

// In-app node clipboard, shared across canvases (copy in a structure
// template, paste on the game canvas, and vice versa).
let nodeClipboard = null;

export const NODE_W = 236;
export const KIND_LABEL = {
  story: 'Story beat', location: 'Location', objective: 'Objective', enemy: 'Enemy encounter', mechanic: 'Mechanic', sensor: 'Sensor trigger',
  // Narrative v2 typed nodes.
  beat: 'Beat', reveal: 'Reveal', branch: 'Branch', fact: 'Fact change', converge: 'Convergence', timed: 'Timed event', recovery: 'Recovery',
  // Tasks + task-detail node types.
  task: 'Task', placement: 'Placement', rule: 'Rule', prop: 'Prop / kit', power: 'Power', effect: 'Effect',
  // Narrative Weaver: base nodes, concept containers, subnodes.
  event: 'Event', character: 'Character', storyLocation: 'Story Location', quest: 'Quest', concept: 'Concept',
  outcomeBranches: 'Outcome Branches', relChange: 'Rel. / Status Change', internalState: 'Internal State',
  locationArchetype: 'Location Archetype', narrativeResponse: 'Narrative Response', emotionalTone: 'Emotional Tone',
};
const SWATCHES = ['#5CA8F5', '#43BF87', '#E0A23C', '#E86464', '#A87BF0', '#3EC6D6', '#E8D25C', '#F08CB4'];

// Generic interactive node canvas, shared by the active game's quest editor
// and the Library's story-structure editor. The host owns the data and passes
// mutation callbacks:
//   onMove(id,x,y) · onConnect(from,to) · onRemoveEdge(edge) ·
//   onSetColor(id,color|null) · onSelect(id) · onDropPalette(payload,x,y)
// Also accepts drops of palette entries carrying dataTransfer 'text/x-palette'.
export default function FlowCanvas({
  nodes, edges, selId, colorOf,
  onSelect, onMove, onConnect, onRemoveEdge, onSetColor, onDropPalette,
  onPasteNode, onDeleteNode, onEditEdge, renderExtra,
  // Optional presentation hooks (unused by the library structure editors):
  //   iconOf(node) → icon name · teamOf(node) → {name,color} · dimNode(node) →
  //   bool · edgeFact(edge) → {color,title} to show a fact dot on a connection.
  iconOf, teamOf, dimNode, edgeFact,
  // onOpenNode(id): double-click a node to drill into its nested sub-graph.
  onOpenNode,
  // nodeClass(node) → extra class names ('subnode', 'concept', …).
  nodeClass,
  // attachments: [{ from, to, label?, color? }] — subnode→parent links drawn
  // as dashed lines with a one-click detach (⊘) at the midpoint.
  attachments, onDetach,
  // frames: visual grouping rectangles. Dragging the header moves the frame
  // and everything inside (host reducer handles containment).
  frames, onFrameMove, onFrameResize, onFrameSelect, selFrame,
}) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const frameRef = useRef(null);
  const [linkDrag, setLinkDrag] = useState(null);
  const [pickerFor, setPickerFor] = useState(null);

  // Keyboard: Ctrl/Cmd+C copies the selected node, Ctrl/Cmd+V (or Ctrl+P)
  // pastes a duplicate, Delete/Backspace removes the selected node with its
  // connections. All skipped while typing in a field or copying real text.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && onDeleteNode && selId && nodes[selId]) {
        e.preventDefault();
        onDeleteNode(selId);
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || !onPasteNode) return;
      const k = e.key.toLowerCase();
      if (k === 'c') {
        if (window.getSelection()?.toString()) return; // real text copy wins
        const n = selId && nodes[selId];
        if (!n) return;
        nodeClipboard = { kind: n.kind, title: n.title, body: n.body ?? '', color: n.color ?? null, primitiveId: n.primitiveId ?? null, image: n.image ?? null, x: n.x, y: n.y };
        e.preventDefault();
      } else if (k === 'v' || k === 'p') {
        if (!nodeClipboard) return;
        e.preventDefault();
        nodeClipboard = { ...nodeClipboard, x: nodeClipboard.x + 28, y: nodeClipboard.y + 28 };
        onPasteNode({ ...nodeClipboard });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selId, nodes, onPasteNode, onDeleteNode]);

  const list = Object.values(nodes);
  const extentX = Math.max(1400, ...list.map((n) => n.x + NODE_W + 320));
  const extentY = Math.max(620, ...list.map((n) => n.y + 360));

  const canvasPoint = (e) => {
    const el = canvasRef.current;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left + el.scrollLeft, y: e.clientY - r.top + el.scrollTop };
  };
  const outAnchor = (n) => ({ x: n.x + NODE_W, y: n.y + 36 });
  const inAnchor = (n) => ({ x: n.x, y: n.y + 36 });

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
    const n = nodes[d.id];
    if (!d.moved && Math.abs(x - n.x) + Math.abs(y - n.y) < 4) return;
    d.moved = true;
    onMove(d.id, x, y);
  };
  const onNodeUp = (e, n) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved) { onSelect(n.id); setPickerFor(null); }
  };

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
    if (to && to !== linkDrag.from) onConnect(linkDrag.from, to);
    setLinkDrag(null);
  };

  // Frame drag (header) and resize (corner handle).
  const onFrameDown = (e, f, mode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = canvasPoint(e);
    frameRef.current = { id: f.id, mode, lastX: p.x, lastY: p.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    onFrameSelect?.(f.id);
  };
  const onFramePtrMove = (e) => {
    const d = frameRef.current;
    if (!d) return;
    const p = canvasPoint(e);
    const dx = Math.round(p.x - d.lastX), dy = Math.round(p.y - d.lastY);
    if (dx === 0 && dy === 0) return;
    d.lastX = p.x; d.lastY = p.y;
    const f = frames[d.id];
    if (d.mode === 'move') onFrameMove?.(d.id, dx, dy);
    else onFrameResize?.(d.id, Math.max(160, f.w + dx), Math.max(100, f.h + dy));
  };
  const onFramePtrUp = () => { frameRef.current = null; };

  return (
    <div
      className="canvas" ref={canvasRef}
      onDragOver={onDropPalette ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } : undefined}
      onDrop={onDropPalette ? (e) => {
        e.preventDefault();
        const payload = e.dataTransfer.getData('text/x-palette');
        if (!payload) return;
        const p = canvasPoint(e);
        onDropPalette(payload, Math.max(8, p.x - NODE_W / 2), Math.max(8, p.y - 20));
      } : undefined}
    >
      {frames && Object.values(frames).map((f) => (
        <div key={f.id} className={`gframe${selFrame === f.id ? ' sel' : ''}`}
          style={{ left: f.x, top: f.y, width: f.w, height: f.h, borderColor: f.color || 'var(--line)' }}>
          <div className="gframehead" style={{ background: f.color || 'var(--raised)' }}
            onPointerDown={(e) => onFrameDown(e, f, 'move')} onPointerMove={onFramePtrMove} onPointerUp={onFramePtrUp}
            title="Drag to move the frame and everything inside it">
            {f.label || 'Frame'}
          </div>
          <div className="gframegrip" title="Drag to resize"
            onPointerDown={(e) => onFrameDown(e, f, 'resize')} onPointerMove={onFramePtrMove} onPointerUp={onFramePtrUp} />
        </div>
      ))}
      <svg className="edges" width={extentX} height={extentY}>
        {(attachments || []).map((a, idx) => {
          const from = nodes[a.from], to = nodes[a.to];
          if (!from || !to) return null;
          const x1 = from.x + NODE_W / 2, y1 = from.y + 30, x2 = to.x + NODE_W / 2, y2 = to.y + 34;
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          const color = a.color || '#F08CB4';
          return (
            <g key={`att${idx}`}>
              <path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke={color} strokeWidth="1.6" strokeDasharray="4 4" fill="none" opacity=".75" />
              <foreignObject x={mx - 55} y={my - 12} width="110" height="24">
                <div className="attlab" style={{ borderColor: color, color }}>
                  <span>{a.label || 'enriches'}</span>
                  {onDetach && <button className="x" title="Detach subnode" onClick={() => onDetach(a.from)}>⊘</button>}
                </div>
              </foreignObject>
            </g>
          );
        })}
        {edges.map((e, idx) => {
          const from = nodes[e.from], to = nodes[e.to];
          if (!from || !to) return null;
          const a = outAnchor(from), b = inAnchor(to);
          const mx = (a.x + b.x) / 2;
          const color = e.color || ENTITY_COLORS[e.kindColor] || colorOf(from) || '#8B92A6';
          const fact = edgeFact?.(e);
          return (
            <g key={idx}>
              <path d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`} stroke={color} strokeWidth="2" fill="none" opacity=".8" />
              <foreignObject x={mx - 90} y={(a.y + b.y) / 2 - 26} width="180" height="28">
                <div className={`elab${e.label ? '' : ' empty'}`} style={{ borderColor: color, color }}>
                  {fact && <span className="efact" style={{ background: fact.color }} title={fact.title} />}
                  <span className={onEditEdge ? 'editable' : ''}
                    title={onEditEdge ? 'Click to edit the connection label' : undefined}
                    onClick={onEditEdge ? () => {
                      const v = window.prompt('Connection label (e.g. "IF key obtained"):', e.label || '');
                      if (v !== null) onEditEdge(e, v.trim());
                    } : undefined}>
                    {e.label || (onEditEdge ? '+ label' : '•')}
                  </span>
                  {onRemoveEdge && <button className="x" title="Remove connection" onClick={() => onRemoveEdge(e)}>×</button>}
                </div>
              </foreignObject>
            </g>
          );
        })}
        {linkDrag && (() => {
          const a = outAnchor(nodes[linkDrag.from]);
          const mx = (a.x + linkDrag.x) / 2;
          return <path d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${linkDrag.y}, ${linkDrag.x} ${linkDrag.y}`}
            stroke={colorOf(nodes[linkDrag.from])} strokeWidth="2" strokeDasharray="6 5" fill="none" opacity=".9" />;
        })()}
      </svg>

      {list.map((n) => {
        const color = colorOf(n);
        const icon = iconOf?.(n);
        const team = teamOf?.(n);
        return (
          <div
            key={n.id} data-node={n.id} role="button" tabIndex={0}
            className={`node${selId === n.id ? ' sel' : ''}${linkDrag && linkDrag.from !== n.id ? ' droppable' : ''}${dimNode?.(n) ? ' dim' : ''}${nodeClass ? ` ${nodeClass(n) || ''}` : ''}`}
            style={{ left: n.x, top: n.y, width: NODE_W, borderTopColor: color }}
            onPointerDown={(e) => onNodeDown(e, n)}
            onPointerMove={onNodeMove}
            onPointerUp={(e) => onNodeUp(e, n)}
            onDoubleClick={onOpenNode ? (e) => { e.stopPropagation(); onOpenNode(n.id); } : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(n.id); }}
          >
            <div className="nh">
              {onSetColor ? (
                <button className="icpick" style={{ background: color }} title="Change node color"
                  onClick={(e) => { e.stopPropagation(); setPickerFor(pickerFor === n.id ? null : n.id); }}>
                  {icon && <PrimIcon icon={icon} color="#fff" size={12} />}
                </button>
              ) : <span className="icpick" style={{ background: color }}>{icon && <PrimIcon icon={icon} color="#fff" size={12} />}</span>}
              <div className="nhmeta"><small style={{ color }}>{KIND_LABEL[n.kind] ?? n.kind}</small><b>{n.title}</b></div>
              {team && <span className="nteam" style={{ background: team.color }} title={`Lane: ${team.name}`}>{team.name}</span>}
              {onOpenNode && (
                <button className="nopen" title="Open detail graph (or double-click the node)"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onOpenNode(n.id); }}>
                  {Object.keys(n.sub?.nodes || {}).length > 0 ? `⧉ ${Object.keys(n.sub.nodes).length}` : '⧉'}
                </button>
              )}
            </div>
            <div className="nb">
              {n.image?.dataUrl && <img className="nimg" src={n.image.dataUrl} alt="" draggable={false} />}
              {n.body}
              {renderExtra?.(n)}
            </div>
            {onConnect && (
              <span className="port" title="Drag to another node to connect"
                onPointerDown={(e) => onPortDown(e, n)} onPointerMove={onPortMove} onPointerUp={onPortUp} />
            )}
            {onSetColor && pickerFor === n.id && (
              <div className="swatchpop" onPointerDown={(e) => e.stopPropagation()}>
                {SWATCHES.map((c) => (
                  <button key={c} className={`swatch${color === c ? ' on' : ''}`} style={{ background: c }}
                    onClick={() => { onSetColor(n.id, c); setPickerFor(null); }} />
                ))}
                <label className="swatch custom" title="Custom color">
                  <input type="color" value={color} onChange={(e) => onSetColor(n.id, e.target.value)} />
                </label>
                <button className="swatchauto" onClick={() => { onSetColor(n.id, null); setPickerFor(null); }}>Auto</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
