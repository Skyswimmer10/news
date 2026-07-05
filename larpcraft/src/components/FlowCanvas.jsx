import React, { useEffect, useRef, useState } from 'react';
import { ENTITY_COLORS } from './bits.jsx';

// In-app node clipboard, shared across canvases (copy in a structure
// template, paste on the game canvas, and vice versa).
let nodeClipboard = null;

export const NODE_W = 236;
export const KIND_LABEL = { story: 'Story beat', location: 'Location', objective: 'Objective', enemy: 'Enemy encounter', mechanic: 'Mechanic', sensor: 'Sensor trigger' };
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
}) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
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
      <svg className="edges" width={extentX} height={extentY}>
        {edges.map((e, idx) => {
          const from = nodes[e.from], to = nodes[e.to];
          if (!from || !to) return null;
          const a = outAnchor(from), b = inAnchor(to);
          const mx = (a.x + b.x) / 2;
          const color = e.color || ENTITY_COLORS[e.kindColor] || colorOf(from) || '#8B92A6';
          return (
            <g key={idx}>
              <path d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`} stroke={color} strokeWidth="2" fill="none" opacity=".8" />
              <foreignObject x={mx - 80} y={(a.y + b.y) / 2 - 26} width="160" height="28">
                <div className={`elab${e.label ? '' : ' empty'}`} style={{ borderColor: color, color }}>
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
        return (
          <div
            key={n.id} data-node={n.id} role="button" tabIndex={0}
            className={`node${selId === n.id ? ' sel' : ''}${linkDrag && linkDrag.from !== n.id ? ' droppable' : ''}`}
            style={{ left: n.x, top: n.y, width: NODE_W, borderTopColor: color }}
            onPointerDown={(e) => onNodeDown(e, n)}
            onPointerMove={onNodeMove}
            onPointerUp={(e) => onNodeUp(e, n)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(n.id); }}
          >
            <div className="nh">
              {onSetColor ? (
                <button className="icpick" style={{ background: color }} title="Change node color"
                  onClick={(e) => { e.stopPropagation(); setPickerFor(pickerFor === n.id ? null : n.id); }} />
              ) : <span className="icpick" style={{ background: color }} />}
              <div><small style={{ color }}>{KIND_LABEL[n.kind] ?? n.kind}</small><b>{n.title}</b></div>
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
