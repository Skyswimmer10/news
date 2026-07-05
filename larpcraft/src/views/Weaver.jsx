import React, { useLayoutEffect, useRef, useState } from 'react';
import { useGame, useDispatch } from '../state/store.jsx';
import { ENTITY_COLORS } from '../components/bits.jsx';

// A node counts as a "story beat" if it is a story-kind node or was imported
// from a narrative element; everything else is a physical "task".
const isStory = (n) => n.kind === 'story' || !!n.elementId;
const KIND_LABEL = { location: 'Location', objective: 'Objective', enemy: 'Enemy', mechanic: 'Mechanic', sensor: 'Sensor' };

// Split-Screen Weaver: narrative beats on the left, the task timeline on the
// right, with hand-drawn alignment links tying a story beat to the physical
// task it is conceptually bound to — without putting them on one canvas.
export default function Weaver() {
  const s = useGame();
  const dispatch = useDispatch();
  const bodyRef = useRef(null);
  const refs = useRef({}); // nodeId -> element
  const [anchors, setAnchors] = useState({});
  const [armed, setArmed] = useState(null); // a story id waiting to link
  const [tick, setTick] = useState(0);

  const stories = Object.values(s.nodes).filter(isStory).sort((a, b) => a.x - b.x || a.y - b.y);
  // Tasks form the timeline, ordered by their canvas position (left→right).
  const tasks = Object.values(s.nodes).filter((n) => !isStory(n)).sort((a, b) => a.x - b.x || a.y - b.y);
  const aligns = s.alignments || [];

  // Measure connector anchor points relative to the scrolling body.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const measure = () => {
      const next = {};
      for (const [id, el] of Object.entries(refs.current)) {
        if (!el) continue;
        const story = isStory(s.nodes[id] || {});
        next[id] = {
          x: story ? el.offsetLeft + el.offsetWidth : el.offsetLeft,
          y: el.offsetTop + el.offsetHeight / 2,
        };
      }
      setAnchors(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    return () => ro.disconnect();
  }, [s.nodes, aligns.length, tick]);

  const armStory = (id) => setArmed((cur) => (cur === id ? null : id));
  const clickTask = (taskId) => {
    if (!armed) return;
    const exists = aligns.some((a) => a.story === armed && a.task === taskId);
    dispatch({ type: exists ? 'REMOVE_ALIGN' : 'ADD_ALIGN', story: armed, task: taskId });
  };
  const linkCount = (id, side) => aligns.filter((a) => a[side] === id).length;

  const contentH = Math.max(
    ...stories.map((_, i) => 0), ...tasks.map((_, i) => 0),
    (bodyRef.current?.scrollHeight ?? 400),
  );

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">{s.meta.name} / <b>Weaver</b></div>
          <h2>Split-Screen Weaver</h2>
        </div>
        <div className="right">
          <span className="dim" style={{ fontSize: 12 }}>
            {armed ? 'Now click a task to align it · click the story again to cancel' : 'Click a story beat, then a task, to link them'}
          </span>
        </div>
      </div>

      <div className="weaverbody" ref={bodyRef} onScroll={() => setTick((t) => t + 1)}>
        <div className="weavercolhead left">Narrative beats</div>
        <div className="weavercolhead right">Task timeline</div>

        <svg className="weaveredges" width="100%" height={contentH} aria-hidden="true">
          {aligns.map((a, i) => {
            const p = anchors[a.story]; const q = anchors[a.task];
            if (!p || !q) return null;
            const mx = (p.x + q.x) / 2;
            const color = ENTITY_COLORS[s.nodes[a.task]?.kind] || 'var(--brand)';
            return (
              <g key={i} className="weaveredge">
                <path d={`M ${p.x} ${p.y} C ${mx} ${p.y}, ${mx} ${q.y}, ${q.x} ${q.y}`} className="weaverline" style={{ stroke: color }} />
                <path d={`M ${p.x} ${p.y} C ${mx} ${p.y}, ${mx} ${q.y}, ${q.x} ${q.y}`} className="weaverhit"
                  onClick={() => dispatch({ type: 'REMOVE_ALIGN', story: a.story, task: a.task })} />
              </g>
            );
          })}
        </svg>

        <div className="weavercol left">
          {stories.map((n) => (
            <button key={n.id} ref={(el) => { refs.current[n.id] = el; }}
              className={`weavecard story${armed === n.id ? ' armed' : ''}`}
              style={{ borderLeftColor: n.color || ENTITY_COLORS.story }}
              onClick={() => armStory(n.id)}>
              <b>{n.title}</b>
              {n.body && <small>{n.body}</small>}
              <span className="wmeta">{linkCount(n.id, 'story') ? `${linkCount(n.id, 'story')} aligned` : 'no links'}</span>
            </button>
          ))}
          {stories.length === 0 && <div className="empty">No story beats yet — add story nodes on the Narrative &amp; Quests canvas.</div>}
        </div>

        <div className="weavercol right">
          {tasks.map((n) => {
            const linkedToArmed = armed && aligns.some((a) => a.story === armed && a.task === n.id);
            return (
              <button key={n.id} ref={(el) => { refs.current[n.id] = el; }}
                className={`weavecard task${linkedToArmed ? ' linked' : ''}${armed ? ' arming' : ''}`}
                style={{ borderLeftColor: ENTITY_COLORS[n.kind] }}
                onClick={() => clickTask(n.id)}>
                <span className="tkind" style={{ color: ENTITY_COLORS[n.kind] }}>{KIND_LABEL[n.kind] || n.kind}</span>
                <b>{n.title}</b>
                <span className="wmeta">{linkCount(n.id, 'task') ? `${linkCount(n.id, 'task')} aligned` : ''}</span>
              </button>
            );
          })}
          {tasks.length === 0 && <div className="empty">No tasks yet — add objective / location / mechanic / sensor nodes.</div>}
        </div>
      </div>

      <div className="statusbar">
        <span><b>{aligns.length}</b> alignment links · click a link to remove it · story and tasks stay on their own canvases.</span>
      </div>
    </div>
  );
}
