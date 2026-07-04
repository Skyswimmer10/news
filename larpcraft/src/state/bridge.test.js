import { describe, it, expect } from 'vitest';
import { importItem, importLocation, importStory } from './bridge.js';
import { reducer } from './reducer.js';
import { makeLibrarySeed, makeProjectSeed, makeEmptyProject } from '../data/seed.js';

const lib = makeLibrarySeed();

describe('library → project import bridge', () => {
  it('imports an item template as an instance with a new id and templateId', () => {
    const proj = makeEmptyProject('Test Game');
    const result = importItem(lib, proj, 'LIB-ITM-003'); // Serum Vial, no sensors
    const item = result.items[result.createdId];
    expect(result.createdId).toMatch(/^GAME-ITM-\d+$/);
    expect(item.templateId).toBe('LIB-ITM-003');
    expect(item.name).toBe('Serum Vial');
    expect(item.buildStatus).toBe('concept');       // fresh game state
    expect(item.availability).toBe('ready');
    expect(item.locationId).toBeNull();             // placement is per-game
  });

  it('cascades required sensor hardware and rewrites refs to instance ids', () => {
    const proj = makeEmptyProject('Test Game');
    const result = importItem(lib, proj, 'LIB-ITM-002'); // Dataslate: NFC + button box
    const item = result.items[result.createdId];
    const sensorIds = Object.keys(result.sensors);
    expect(sensorIds).toHaveLength(2);
    expect(item.sensorReqs.map((r) => r.sensorId).sort()).toEqual(sensorIds.sort());
    expect(Object.values(result.sensors).map((x) => x.templateId).sort()).toEqual(['LIB-SEN-BTN', 'LIB-SEN-NFC']);
    expect(Object.values(result.sensors).every((x) => x.battery === 100 && x.status === 'unplaced')).toBe(true);
  });

  it('reuses existing hardware instances instead of duplicating them', () => {
    let proj = makeEmptyProject('Test Game');
    proj = reducer(proj, { type: 'IMPORT_FROM_LIBRARY', ...importItem(lib, proj, 'LIB-ITM-001') }); // brings one NFC reader
    const second = importItem(lib, proj, 'LIB-ITM-002'); // needs NFC + BTN
    // only the button box is new; the NFC instance is reused
    expect(Object.values(second.sensors).map((x) => x.templateId)).toEqual(['LIB-SEN-BTN']);
    const nfcInstance = Object.values(proj.sensors).find((x) => x.templateId === 'LIB-SEN-NFC');
    expect(second.items[second.createdId].sensorReqs.map((r) => r.sensorId)).toContain(nfcInstance.id);
  });

  it('the demo game already uses this scheme (instances carry templateIds)', () => {
    const proj = makeProjectSeed();
    expect(proj.items['CHM-A-004'].templateId).toBe('LIB-ITM-001');
    expect(proj.sensors['RFID-07'].templateId).toBe('LIB-SEN-NFC');
  });

  it('imports a location template as a fresh instance', () => {
    const proj = makeEmptyProject('Test Game');
    const result = importLocation(lib, proj, 'LIB-LOC-001');
    const loc = result.locations[result.createdId];
    expect(loc.templateId).toBe('LIB-LOC-001');
    expect(loc.sensorIds).toEqual([]);
  });

  it('imports a story structure as chained flow nodes', () => {
    let proj = makeEmptyProject('Test Game');
    const result = importStory(lib, proj, 'LIB-STORY-HEIST');
    expect(Object.keys(result.nodes)).toHaveLength(5);
    expect(result.edges).toHaveLength(4);
    proj = reducer(proj, { type: 'IMPORT_FROM_LIBRARY', ...result });
    expect(Object.keys(proj.nodes)).toHaveLength(5);
    expect(proj.edges).toHaveLength(4);
  });

  it('new game state is empty while the library stays populated', () => {
    const proj = makeEmptyProject('Fresh');
    expect(Object.keys(proj.items)).toHaveLength(0);
    expect(Object.keys(proj.nodes)).toHaveLength(0);
    expect(Object.keys(lib.items).length).toBeGreaterThan(0); // untouched master DB
  });

  it('active project serializes to JSON and loads back (mock save/load)', () => {
    const proj = makeProjectSeed();
    const restored = reducer(null, { type: 'RESET', seed: JSON.parse(JSON.stringify(proj)) });
    expect(restored.items['CHM-A-004'].name).toBe('Cipher-Key');
    expect(restored.meta.name).toBe('Operation Chimera');
  });
});
