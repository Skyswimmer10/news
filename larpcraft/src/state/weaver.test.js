import { describe, it, expect } from 'vitest';
import { reducer } from './reducer.js';
import { makeProjectSeed, makeEmptyProject, SUBNODE_BLANK, BASE_KINDS } from '../data/seed.js';

const seed = () => makeProjectSeed();

describe('Narrative Weaver seed', () => {
  it('ships base nodes, a concept container, subnodes and a frame', () => {
    const s = seed();
    const kinds = new Set(Object.values(s.nodes).map((n) => n.kind));
    expect([...kinds].every((k) => BASE_KINDS.includes(k) || k === 'concept')).toBe(true);
    expect(Object.keys(s.subnodes).length).toBeGreaterThan(0);
    expect(Object.keys(s.frames).length).toBeGreaterThan(0);
    expect(s.nodes['N-CPT1'].kind).toBe('concept');
  });

  it('every attached subnode points at a real parent', () => {
    const s = seed();
    for (const sn of Object.values(s.subnodes)) {
      const pr = sn.parentRef;
      if (!pr) continue;
      if (pr.nodeId) expect(s.nodes[pr.nodeId]).toBeTruthy();
      if (pr.subnodeId) expect(s.subnodes[pr.subnodeId]).toBeTruthy();
    }
  });

  it('an outcome-branch edge merges into a later node', () => {
    const s = seed();
    expect(s.edges.some((e) => s.subnodes[e.from]?.kind === 'outcomeBranches')).toBe(true);
  });
});

describe('subnode delete cascade', () => {
  it('deleting an outcome-branches subnode removes its child subnodes and edges', () => {
    const s = reducer(seed(), { type: 'DELETE_SUBNODE', subnodeId: 'SB-OB1' });
    expect(s.subnodes['SB-OB1']).toBeUndefined();
    expect(s.subnodes['SB-NR1']).toBeUndefined(); // child (branchIndex 1)
    expect(s.edges.some((e) => e.from === 'SB-OB1')).toBe(false);
  });

  it('deleting a node detaches (never destroys) its subnodes', () => {
    const s = reducer(seed(), { type: 'DELETE_NODE', nodeId: 'N-TWIST' });
    expect(s.nodes['N-TWIST']).toBeUndefined();
    expect(s.subnodes['SB-RC1']).toBeTruthy();
    expect(s.subnodes['SB-RC1'].parentRef).toBeNull();
  });
});

describe('subnode attach / detach', () => {
  it('a floating subnode can be attached and detached', () => {
    let s = seed();
    expect(s.subnodes['SB-IS1'].parentRef).toBeNull();
    s = reducer(s, { type: 'UPDATE_ENTITY', coll: 'subnodes', id: 'SB-IS1', patch: { parentRef: { nodeId: 'N-PATROL' } } });
    expect(s.subnodes['SB-IS1'].parentRef).toEqual({ nodeId: 'N-PATROL' });
    s = reducer(s, { type: 'UPDATE_ENTITY', coll: 'subnodes', id: 'SB-IS1', patch: { parentRef: null } });
    expect(s.subnodes['SB-IS1'].parentRef).toBeNull();
  });

  it('SUBNODE_BLANK builds a valid 3-branch-capable outcome node', () => {
    const ob = SUBNODE_BLANK('X', 'outcomeBranches');
    expect(ob.branches.length).toBe(2);
    expect(ob.mode).toBe('choice');
    expect(ob.selectionType).toBe('single');
  });
});

describe('edges may span nodes and subnodes', () => {
  it('rejects an edge to a non-existent endpoint but allows subnode endpoints', () => {
    let s = makeEmptyProject('g');
    s.nodes = { A: { id: 'A', kind: 'event', title: 'A', x: 0, y: 0 } };
    s.subnodes = { OB: SUBNODE_BLANK('OB', 'outcomeBranches') };
    s = reducer(s, { type: 'ADD_EDGE', from: 'OB', to: 'A' });
    expect(s.edges.some((e) => e.from === 'OB' && e.to === 'A')).toBe(true);
    s = reducer(s, { type: 'ADD_EDGE', from: 'OB', to: 'NOPE' });
    expect(s.edges.some((e) => e.to === 'NOPE')).toBe(false);
  });
});

describe('frames', () => {
  it('FRAME_MOVE carries nodes whose top-left sits inside', () => {
    let s = makeEmptyProject('g');
    s.frames = { F: { id: 'F', label: 'f', x: 0, y: 0, w: 200, h: 200, color: null } };
    s.nodes = {
      IN: { id: 'IN', kind: 'event', title: 'in', x: 50, y: 50 },
      OUT: { id: 'OUT', kind: 'event', title: 'out', x: 400, y: 400 },
    };
    s = reducer(s, { type: 'FRAME_MOVE', frameId: 'F', dx: 10, dy: 20 });
    expect(s.nodes['IN'].x).toBe(60);
    expect(s.nodes['IN'].y).toBe(70);
    expect(s.nodes['OUT'].x).toBe(400); // untouched
    expect(s.frames['F'].x).toBe(10);
  });

  it('FRAME_TO_COMPOSITE folds members into a concept node sub-graph', () => {
    let s = makeEmptyProject('g');
    s.frames = { F: { id: 'F', label: 'Act 1', x: 0, y: 0, w: 300, h: 300, color: '#5CA8F5' } };
    s.nodes = {
      A: { id: 'A', kind: 'event', title: 'A', x: 20, y: 20 },
      B: { id: 'B', kind: 'quest', title: 'B', x: 60, y: 60 },
      OUT: { id: 'OUT', kind: 'event', title: 'out', x: 500, y: 500 },
    };
    s.edges = [{ from: 'A', to: 'B' }, { from: 'B', to: 'OUT' }];
    s = reducer(s, { type: 'FRAME_TO_COMPOSITE', frameId: 'F', nodeId: 'CPT' });
    expect(s.frames['F']).toBeUndefined();
    expect(s.nodes['CPT'].kind).toBe('concept');
    expect(Object.keys(s.nodes['CPT'].sub.nodes).sort()).toEqual(['A', 'B']);
    expect(s.nodes['A']).toBeUndefined(); // moved inside
    // the boundary-crossing edge now leaves the composite
    expect(s.edges.some((e) => e.from === 'CPT' && e.to === 'OUT')).toBe(true);
  });
});

describe('change history', () => {
  it('logs a content edit on a node but not a pure move', () => {
    let s = reducer(seed(), { type: 'UPDATE_ENTITY', coll: 'nodes', id: 'N-BRIEF', patch: { title: 'New title' } });
    const len = s.nodes['N-BRIEF'].history.length;
    expect(len).toBeGreaterThan(0);
    s = reducer(s, { type: 'UPDATE_ENTITY', coll: 'nodes', id: 'N-BRIEF', patch: { x: 5, y: 5 } });
    expect(s.nodes['N-BRIEF'].history.length).toBe(len); // move not logged
  });
});
