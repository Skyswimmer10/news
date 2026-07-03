import { describe, it, expect } from 'vitest';
import { reducer, resolveNode, itemsAssignedToTeam, availableItems } from './reducer.js';
import { makeSeed } from '../data/seed.js';

const seed = () => makeSeed();

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
    const r = resolveNode(s, 'N-KEY');
    expect(r.item.id).toBe('CHM-A-004');
    expect(r.mechanics.map((m) => m.id)).toContain('MECH-LOCK');
    expect(r.sensors.map((x) => x.id)).toContain('RFID-07');
  });

  it('edits made via the inspector are visible through node resolution', () => {
    let s = seed();
    s = reducer(s, { type: 'UPDATE_ENTITY', coll: 'items', id: 'CHM-A-004', patch: { buildStatus: 'packed', name: 'Cipher-Key Mk2' } });
    const r = resolveNode(s, 'N-KEY');
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
