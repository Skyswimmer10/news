import React from 'react';
import { useGame } from '../state/store.jsx';
import { ENTITY_COLORS, Pill } from '../components/bits.jsx';

const NODE_W = 236;
const NODE_H = 118;
const KIND_LABEL = { story: 'Story beat', location: 'Location', objective: 'Objective', enemy: 'Enemy encounter', mechanic: 'Mechanic', sensor: 'Sensor trigger' };

// Node canvas. Clicking a node selects it; the app resolves its itemId /
// locationId against global state and the inspector shows the live record.
export default function ScenarioFlow({ selection, onSelect }) {
  const s = useGame();
  const nodes = Object.values(s.nodes);
  const selId = selection?.kind === 'node' ? selection.id : null;

  const anchor = (n, side) => ({
    x: n.x + (side === 'out' ? NODE_W : 0),
    y: n.y + NODE_H / 2,
  });

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">Operation Chimera / Narrative &amp; Quests / <b>Main questline</b></div>
          <h2>Scenario Flow — Act 1</h2>
        </div>
      </div>
      <div className="canvas">
        <svg className="edges">
          {s.edges.map((e, idx) => {
            const a = anchor(s.nodes[e.from], 'out');
            const b = anchor(s.nodes[e.to], 'in');
            const mx = (a.x + b.x) / 2;
            const color = ENTITY_COLORS[e.kindColor] ?? '#8B92A6';
            return (
              <g key={idx}>
                <path d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`} stroke={color} strokeWidth="2" fill="none" opacity=".8" />
                <foreignObject x={mx - 70} y={(a.y + b.y) / 2 - 26} width="140" height="26">
                  <div className="elab" style={{ borderColor: color, color }}>{e.label}</div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
        {nodes.map((n) => {
          const item = n.itemId ? s.items[n.itemId] : null;
          const color = ENTITY_COLORS[n.kind];
          return (
            <button
              key={n.id}
              className={`node${selId === n.id ? ' sel' : ''}`}
              style={{ left: n.x, top: n.y, width: NODE_W, borderTopColor: color }}
              onClick={() => onSelect({ kind: 'node', id: n.id })}
            >
              <div className="nh">
                <span className="ic" style={{ background: color }} />
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
            </button>
          );
        })}
      </div>
      <div className="statusbar"><span>Click a node — the details panel resolves its linked records live from the database.</span></div>
    </div>
  );
}
