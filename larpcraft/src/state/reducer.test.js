import { describe, it, expect } from 'vitest';
import { reducer, resolveNode, itemsAssignedToTeam, availableItems } from './reducer.js';
import { makeProjectSeed, makeLibrarySeed } from '../data/seed.js';

const seed = () => makeProjectSeed();
const lib = makeLibrarySeed();

describe('assignment logic', () => {
  it('assigning an item to a player flips availability to in-use', () => {
    const s = reducer(seed(), { type: 'ASSIGN_ITEM', itemId: 'CHM-A-004', teamId: 'T-RAVEN', playerId: 'P-ELZA' });
    expect(s.items['CHM-A-004'].availability).toBe('in-use');
    expect(s.items['CHM-A-004'].assignedTo).toEqual({ teamId: 'T-RAVEN', playerId: 'P-ELZA' });
    expect(itemsAssignedToTeam(s, 'T-RAVEN').map((i) => i.id)).toContain('CHM-A-004');
  });

  it('returning an item restores ready and removes it from team kit', () => {
    let s = reducer(seed(), { type: 'ASSIGN_ITEM', itemId: 'CHM-A-004', teamId: 'T-RAVEN', playerId: 'P-ELZA' });
    s = reducer(s, { type: 'UNASSIGN_ITEM', itemId: 'CHM-A-004' });
    expect(s.items['CHM-A-004'].availability).toBe('ready');
    expect(s.items['CHM-A-004'].assignedTo).toBeNull();
    expect(itemsAssignedToTeam(s, 'T-RAVEN')).toHaveLength(0);
  });

  it('deploying an item sets location and deployed status', () => {
    const s = reducer(seed(), { type: 'DEPLOY_ITEM', itemId: 'CHM-G-001', locationId: 'LOC-S7' });
    expect(s.items['CHM-G-001'].availability).toBe('deployed');
    expect(s.items['CHM-G-001'].locationId).toBe('LOC-S7');
  });

  it('assigned items leave the available pool used by the Teams issue dropdown', () => {
    const before = availableItems(seed()).length;
    const s = reducer(seed(), { type: 'ASSIGN_ITEM', itemId: 'CHM-A-004', teamId: 'T-WOLF' });
    expect(availableItems(s).length).toBe(before - 1);
  });
});

describe('cross-referencing', () => {
  it('a flow node resolves to the live item record', () => {
    const s = seed();
    const r = resolveNode(s, lib, 'N-KEY');
    expect(r.item.id).toBe('CHM-A-004');
    expect(r.mechanics.map((m) => m.id)).toContain('LIB-MECH-LOCK');
    expect(r.sensors.map((x) => x.id)).toContain('RFID-07');
  });

  it('edits made via the inspector are visible through node resolution', () => {
    let s = seed();
    s = reducer(s, { type: 'UPDATE_ENTITY', coll: 'items', id: 'CHM-A-004', patch: { buildStatus: 'packed', name: 'Cipher-Key Mk2' } });
    const r = resolveNode(s, lib, 'N-KEY');
    expect(r.item.buildStatus).toBe('packed');
    expect(r.item.name).toBe('Cipher-Key Mk2');
  });
});

describe('images and hardware requirements', () => {
  it('uploading sets the primary thumbnail on the item', () => {
    const image = { kind: 'photo', name: 'key.jpg', dataUrl: 'data:image/jpeg;base64,xxx' };
    const s = reducer(seed(), { type: 'SET_IMAGE', coll: 'items', id: 'CHM-A-004', image });
    expect(s.items['CHM-A-004'].image).toEqual(image);
  });

  it('sensor requirements can be added once and removed', () => {
    let s = reducer(seed(), { type: 'ADD_SENSOR_REQ', itemId: 'CHM-G-001', sensorId: 'MOT-04', note: 'test' });
    expect(s.items['CHM-G-001'].sensorReqs).toHaveLength(1);
    const dup = reducer(s, { type: 'ADD_SENSOR_REQ', itemId: 'CHM-G-001', sensorId: 'MOT-04' });
    expect(dup.items['CHM-G-001'].sensorReqs).toHaveLength(1);
    s = reducer(s, { type: 'REMOVE_SENSOR_REQ', itemId: 'CHM-G-001', sensorId: 'MOT-04' });
    expect(s.items['CHM-G-001'].sensorReqs).toHaveLength(0);
  });

  it('sensor hardware can be issued to a player role', () => {
    const s = reducer(seed(), { type: 'ASSIGN_SENSOR', sensorId: 'RF-01', playerId: 'P-JANIS' });
    expect(s.sensors['RF-01'].assignedTo).toBe('P-JANIS');
  });
});

describe('entity deletion and element categories', () => {
  it('DELETE_ENTITY removes a record and ignores unknown ids', () => {
    const libSeed = makeLibrarySeed();
    const s1 = reducer(libSeed, { type: 'DELETE_ENTITY', coll: 'elementTypes', id: 'rumor' });
    expect(s1.elementTypes.rumor).toBeUndefined();
    expect(Object.keys(s1.elementTypes)).toHaveLength(4);
    expect(reducer(s1, { type: 'DELETE_ENTITY', coll: 'elementTypes', id: 'nope' })).toBe(s1);
  });

  it('new element categories can be added and elements reassigned on delete', () => {
    let libState = makeLibrarySeed();
    libState = reducer(libState, { type: 'ADD_ENTITY', coll: 'elementTypes', entity: { id: 'prophecy', label: 'Prophecy', color: '#3EC6D6' } });
    expect(libState.elementTypes.prophecy.label).toBe('Prophecy');
    // reassign a rumor to the fallback, then delete the category (UI flow)
    libState = reducer(libState, { type: 'UPDATE_ENTITY', coll: 'elements', id: 'LIB-ELM-004', patch: { etype: 'prophecy' } });
    libState = reducer(libState, { type: 'DELETE_ENTITY', coll: 'elementTypes', id: 'rumor' });
    expect(libState.elements['LIB-ELM-004'].etype).toBe('prophecy');
    expect(libState.elementTypes.rumor).toBeUndefined();
  });
});

describe('scenario graph editing', () => {
  const newNode = { id: 'N-TEST', kind: 'story', title: 'New story beat', x: 100, y: 100, body: '', color: null, locationId: null, itemId: null, mechanicIds: [], sensorIds: [] };

  it('adds a node and connects it to an existing node', () => {
    let s = reducer(seed(), { type: 'ADD_NODE', node: newNode });
    expect(s.nodes['N-TEST'].title).toBe('New story beat');
    const before = s.edges.length;
    s = reducer(s, { type: 'ADD_EDGE', from: 'N-BRIEF', to: 'N-TEST', color: '#5CA8F5' });
    expect(s.edges.length).toBe(before + 1);
    expect(s.edges.at(-1)).toMatchObject({ from: 'N-BRIEF', to: 'N-TEST', color: '#5CA8F5' });
  });

  it('rejects self-loops and duplicate connections', () => {
    let s = reducer(seed(), { type: 'ADD_NODE', node: newNode });
    const before = s.edges.length;
    s = reducer(s, { type: 'ADD_EDGE', from: 'N-TEST', to: 'N-TEST' });
    expect(s.edges.length).toBe(before);
    s = reducer(s, { type: 'ADD_EDGE', from: 'N-BRIEF', to: 'N-S7' }); // exists in seed
    expect(s.edges.length).toBe(before);
  });

  it('removes a connection', () => {
    const before = seed().edges.length;
    const s = reducer(seed(), { type: 'REMOVE_EDGE', from: 'N-BRIEF', to: 'N-S7' });
    expect(s.edges.length).toBe(before - 1);
  });

  it('DELETE_NODE removes the node and every edge touching it', () => {
    const s = reducer(seed(), { type: 'DELETE_NODE', nodeId: 'N-KEY' });
    expect(s.nodes['N-KEY']).toBeUndefined();
    expect(s.edges.some((e) => e.from === 'N-KEY' || e.to === 'N-KEY')).toBe(false);
    expect(s.edges.length).toBe(seed().edges.length - 3); // N-KEY had 1 in + 2 out
  });

  it('UPDATE_EDGE edits a connection label', () => {
    const s = reducer(seed(), { type: 'UPDATE_EDGE', from: 'N-KEY', to: 'N-GATE', patch: { label: 'WHEN both keys held' } });
    expect(s.edges.find((e) => e.from === 'N-KEY' && e.to === 'N-GATE').label).toBe('WHEN both keys held');
  });

  it('SET_META stores the per-game hero backdrop; SET_IMAGE respects field', () => {
    let s = reducer(seed(), { type: 'SET_META', patch: { hero: { image: { kind: 'photo', name: 'bg.jpg', dataUrl: 'data:x' }, opacity: 0.4 } } });
    expect(s.meta.hero.opacity).toBe(0.4);
    expect(s.meta.name).toBe('Operation Chimera'); // merge, not replace
    s = reducer(s, { type: 'SET_IMAGE', coll: 'locations', id: 'LOC-S7', field: 'schematic', image: { kind: 'photo', name: 'plan.png', dataUrl: 'data:y' } });
    expect(s.locations['LOC-S7'].schematic.name).toBe('plan.png');
    expect(s.locations['LOC-S7'].image).toBeNull(); // cover untouched
  });

  it('node drag position and color pick persist via UPDATE_ENTITY', () => {
    let s = reducer(seed(), { type: 'UPDATE_ENTITY', coll: 'nodes', id: 'N-BRIEF', patch: { x: 500, y: 250 } });
    s = reducer(s, { type: 'UPDATE_ENTITY', coll: 'nodes', id: 'N-BRIEF', patch: { color: '#E8D25C' } });
    expect(s.nodes['N-BRIEF']).toMatchObject({ x: 500, y: 250, color: '#E8D25C' });
  });
});
