import React from 'react';
import { ENTITY_COLORS } from './bits.jsx';
import { NODE_W } from './FlowCanvas.jsx';

export const structNodeColor = (n, lib) =>
  n.color
  || lib.narrative?.[n.primitiveId]?.color
  || lib.mechPrimitives?.[n.primitiveId]?.color
  || lib.primitives?.[n.primitiveId]?.color // legacy
  || ENTITY_COLORS[n.kind] || '#8B92A6';

// Auto-generated thumbnail of a story structure's node-graph layout:
// the real positions, scaled down, nodes as color-coded blocks.
export default function StructureThumb({ structure, lib, width = 216, height = 92 }) {
  const nodes = Object.values(structure.nodes);
  if (!nodes.length) return <svg width={width} height={height} className="structthumb" />;
  const pad = 12;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_W));
  const maxY = Math.max(...nodes.map((n) => n.y + 90));
  const sx = (width - pad * 2) / Math.max(1, maxX - minX);
  const sy = (height - pad * 2) / Math.max(1, maxY - minY);
  const s = Math.min(sx, sy);
  const X = (v) => pad + (v - minX) * s;
  const Y = (v) => pad + (v - minY) * s;
  const w = Math.max(14, NODE_W * s);
  const h = Math.max(8, 70 * s);
  const byId = structure.nodes;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="structthumb" aria-hidden="true">
      {structure.edges.map((e, i) => {
        const a = byId[e.from], b = byId[e.to];
        if (!a || !b) return null;
        const x1 = X(a.x) + w, y1 = Y(a.y) + h / 2, x2 = X(b.x), y2 = Y(b.y) + h / 2;
        const mx = (x1 + x2) / 2;
        return <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
          stroke={structNodeColor(a, lib)} strokeWidth="1.3" fill="none" opacity=".65" />;
      })}
      {Object.values(structure.nodes).map((n) => (
        <g key={n.id}>
          <rect x={X(n.x)} y={Y(n.y)} width={w} height={h} rx="2.5" fill="#232836" stroke={structNodeColor(n, lib)} strokeWidth="1.2" />
          <rect x={X(n.x)} y={Y(n.y)} width={w} height="2.5" fill={structNodeColor(n, lib)} />
        </g>
      ))}
    </svg>
  );
}
