import { describe, it, expect } from 'vitest';
import { reducer, locateGraph } from './reducer.js';
import { makeProjectSeed, makeEmptyProject, migrateProject } from '../data/seed.js';

const seed = () => makeProjectSeed();

describe('located graphs', () => {
  it('locateGraph reaches the surface task flow and a task sub-graph', () => {
    const s = seed();
    const top = locateGraph(s, { coll: 'taskNodes' });
    expect(Object.keys(top.nodes).length).toBeGreaterThan(0);
    const sub = locateGraph(s, { coll: 'taskNodes', parentId: 'TSK-4' });
    expect(Object.keys(sub.nodes).length).toBeGreaterThan(0); // ball-in-net detail
  });

  it('locateGraph reaches a narrative node sub-graph', () => {
    const sub = locateGraph(seed(), { coll: 'nodes', parentId: 'N-BRIEF' });
    expect(Object.keys(sub.nodes).length).toBe(3);
  });
});

describe('GRAPH_* editing on the surface task flow', () => {
  const scope = { coll: 'taskNodes' };
  it('adds, moves, connects and deletes task nodes', () => {
    let s = reducer(seed(), { type: 'GRAPH_ADD_NODE', scope, node: { id: 'TSK-X', kind: 'task', title: 'New', x: 5, y: 5 } });
    expect(s.taskNodes['TSK-X']).toBeTruthy();
    s = reducer(s, { type: 'GRAPH_UPDATE_NODE', scope, id: 'TSK-X', patch: { x: 99, y: 40 } });
    expect(s.taskNodes['TSK-X'].x).toBe(99);
    s = reducer(s, { type: 'GRAPH_ADD_EDGE', scope, from: 'TSK-1', to: 'TSK-X', label: 'go' });
    expect(s.taskEdges.some((e) => e.from === 'TSK-1' && e.to === 'TSK-X')).toBe(true);
    s = reducer(s, { type: 'GRAPH_DELETE_NODE', scope, id: 'TSK-X' });
    expect(s.taskNodes['TSK-X']).toBeUndefined();
    // deleting a node removes its edges
    expect(s.taskEdges.some((e) => e.to === 'TSK-X')).toBe(false);
  });

  it('rejects self-loops and duplicate edges', () => {
    let s = reducer(seed(), { type: 'GRAPH_ADD_EDGE', scope, from: 'TSK-1', to: 'TSK-1' });
    const before = s.taskEdges.length;
    s = reducer(s, { type: 'GRAPH_ADD_EDGE', scope, from: 'TSK-1', to: 'TSK-2' }); // already exists in seed
    expect(s.taskEdges.length).toBe(before);
  });
});

describe('GRAPH_* editing inside a nested sub-graph', () => {
  const scope = { coll: 'taskNodes', parentId: 'TSK-2' };
  it('writes into the parent task .sub without touching the surface', () => {
    let s = reducer(seed(), { type: 'GRAPH_ADD_NODE', scope, node: { id: 'D9', kind: 'effect', title: 'Smoke', x: 8, y: 8 } });
    expect(s.taskNodes['TSK-2'].sub.nodes['D9']).toBeTruthy();
    // surface graph untouched
    expect(s.taskNodes['TSK-2'].kind).toBe('task');
    s = reducer(s, { type: 'GRAPH_UPDATE_EDGE', scope, from: 'D1', to: 'D2', patch: { label: 'changed' } });
    expect(s.taskNodes['TSK-2'].sub.edges.find((e) => e.from === 'D1' && e.to === 'D2').label).toBe('changed');
  });

  it('creates .sub on a node that had none', () => {
    const s0 = makeEmptyProject('g');
    let s = reducer(s0, { type: 'GRAPH_ADD_NODE', scope: { coll: 'taskNodes' }, node: { id: 'T1', kind: 'task', title: 'T', x: 0, y: 0 } });
    s = reducer(s, { type: 'GRAPH_ADD_NODE', scope: { coll: 'taskNodes', parentId: 'T1' }, node: { id: 'D1', kind: 'rule', title: 'r', x: 0, y: 0 } });
    expect(s.taskNodes['T1'].sub.nodes['D1']).toBeTruthy();
  });
});

describe('migrateProject backfills the task graph', () => {
  it('older saves gain empty taskNodes/taskEdges', () => {
    const old = makeProjectSeed();
    delete old.taskNodes; delete old.taskEdges;
    const m = migrateProject(old);
    expect(m.taskNodes).toEqual({});
    expect(m.taskEdges).toEqual([]);
    expect(m.nodes['N-BRIEF']).toBeTruthy(); // content preserved
  });
});
