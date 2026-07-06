import React, { useState } from 'react';
import { useGame } from '../state/store.jsx';
import GraphEditor from '../components/GraphEditor.jsx';
import { TASK_DETAIL_TYPES } from '../data/seed.js';

// The surface level offers a single "Task" node kind; branching is done with
// connections (task 2 → task 3 / task 4). Detail nodes use the typed palette.
const TASK_PALETTE = [{ id: 'task', label: 'Task', color: '#5BC0BE', icon: null, blurb: 'A step in the game. Double-click it to build its details.' }];
const DETAIL_PALETTE = Object.values(TASK_DETAIL_TYPES);

export default function TasksView({ selection, onSelect }) {
  const s = useGame();
  const [openId, setOpenId] = useState(null); // which task is drilled into
  const task = openId ? s.taskNodes?.[openId] : null;
  // If the drilled-in task was deleted, fall back to the surface.
  const inside = openId && task;

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">
            {s.meta.name} / {inside
              ? <><button className="crumblink" onClick={() => { setOpenId(null); onSelect(null); }}>Tasks</button> / <b>{task.title}</b></>
              : <b>Tasks</b>}
          </div>
          <h2>{inside ? task.title : 'Task Flow'}</h2>
        </div>
        <div className="right">
          {inside && <button className="btn" onClick={() => { setOpenId(null); onSelect(null); }}>← Back to task flow</button>}
        </div>
      </div>

      {inside ? (
        <>
          <div className="subintro dim">
            Detail nodes for <b>{task.title}</b> — where players stand, how many tries, props, powers a team can use, and staged effects.
          </div>
          <GraphEditor
            scope={{ coll: 'taskNodes', parentId: openId }}
            palette={DETAIL_PALETTE}
            idPrefix={`${s.meta.prefix}-DET`}
            selection={selection} onSelect={onSelect}
          />
        </>
      ) : (
        <>
          <div className="subintro dim">
            The surface flow of what happens, step by step. Connect tasks linearly, or branch one task to several. <b>Double-click a task</b> to open its detail graph.
          </div>
          <GraphEditor
            scope={{ coll: 'taskNodes' }}
            palette={TASK_PALETTE}
            idPrefix={`${s.meta.prefix}-TSK`}
            allowOpen onOpen={(id) => { setOpenId(id); onSelect(null); }}
            selection={selection} onSelect={onSelect}
          />
        </>
      )}
      <div className="statusbar">
        <span>{inside
          ? 'Build this task with detail nodes · drag to arrange · ○ port connects · Delete removes · ← Back returns to the task flow.'
          : 'Each node is a task · connect them linearly or branch to several · double-click (or ⧉) to open a task and spec its details.'}</span>
      </div>
    </div>
  );
}
