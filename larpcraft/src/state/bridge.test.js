import { describe, it, expect } from 'vitest';
import { importItem, importLocation, importStory, importPrimitive, importElement, importMechanic, primitiveToStructNode } from './bridge.js';
import { reducer } from './reducer.js';
import { makeLibrarySeed, makeProjectSeed, makeEmptyProject, LIB_BLANK, LIB_PREFIX } from '../data/seed.js';
import { genId } from '../data/csvSchemas.js';

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

  it('imports a story structure as a detached full-graph copy', () => {
    let proj = makeEmptyProject('Test Game');
    const result = importStory(lib, proj, 'LIB-STORY-COURIER');
    expect(Object.keys(result.nodes)).toHaveLength(5);
    expect(result.edges).toHaveLength(4);
    // ids are remapped to project instance ids, provenance kept
    for (const n of Object.values(result.nodes)) {
      expect(n.id).toMatch(/^GAME-N-\d+$/);
      expect(n.primitiveId).toMatch(/^LIB-PRIM-/);
    }
    // edges reference the new ids and preserve labels
    expect(result.edges.every((e) => result.nodes[e.from] && result.nodes[e.to])).toBe(true);
    expect(result.edges.map((e) => e.label)).toContain('package in hand');
    proj = reducer(proj, { type: 'IMPORT_FROM_LIBRARY', ...result });
    expect(Object.keys(proj.nodes)).toHaveLength(5);

    // editing the copy leaves the master template untouched (detached)
    const copyId = Object.keys(proj.nodes)[0];
    reducer(proj, { type: 'UPDATE_ENTITY', coll: 'nodes', id: copyId, patch: { title: 'Changed' } });
    expect(lib.stories['LIB-STORY-COURIER'].nodes.S1.title).toBe('Start Briefing');
  });

  it('imports a single narrative primitive as one node with defaults', () => {
    const proj = makeEmptyProject('Test Game');
    const result = importPrimitive(lib, proj, 'LIB-PRIM-HANDOFF', 200, 150);
    const node = result.nodes[result.createdId];
    expect(node.primitiveId).toBe('LIB-PRIM-HANDOFF');
    expect(node.kind).toBe('objective');
    expect(node.title).toBe('Item Handoff');
    expect(node.body).toContain('changes hands');
  });

  it('primitives instantiate as structure nodes for the template editor', () => {
    const st = lib.stories['LIB-STORY-AMBUSH'];
    const node = primitiveToStructNode(lib.primitives['LIB-PRIM-TIMER'], st.nodes, 300, 200);
    expect(st.nodes[node.id]).toBeUndefined(); // fresh local id
    expect(node).toMatchObject({ primitiveId: 'LIB-PRIM-TIMER', kind: 'mechanic', title: 'Countdown Pressure', x: 300, y: 200 });
  });

  it('seeded structures are built from seeded primitives', () => {
    for (const st of Object.values(lib.stories)) {
      for (const n of Object.values(st.nodes)) {
        expect(lib.primitives[n.primitiveId]).toBeDefined();
      }
    }
    expect(Object.keys(lib.primitives).length).toBeGreaterThanOrEqual(4);
    expect(lib.stories['LIB-STORY-COURIER'].estMinutes).toBe(35);
  });

  it('imports a mechanic with its params, then micro-adjusts without touching the library', () => {
    let proj = makeEmptyProject('Test Game');
    const result = importMechanic(lib, proj, 'LIB-MECH-ACCESS'); // switches default 1
    const mech = result.mechanics[result.createdId];
    expect(mech.templateId).toBe('LIB-MECH-ACCESS');
    expect(mech.params.find((p) => p.key === 'switches').value).toBe('1');
    proj = reducer(proj, { type: 'IMPORT_FROM_LIBRARY', ...result });

    // bump switches to 4 for this game only
    const bumped = { ...mech, params: [{ key: 'switches', label: 'Switches required', value: '4' }] };
    proj = reducer(proj, { type: 'UPDATE_ENTITY', coll: 'mechanics', id: mech.id, patch: bumped });
    expect(proj.mechanics[mech.id].params[0].value).toBe('4');
    // library blueprint is untouched
    expect(lib.mechanics['LIB-MECH-ACCESS'].params.find((p) => p.key === 'switches').value).toBe('1');
  });

  it('the demo game ships a micro-adjusted mechanic (4 switches vs library 1)', () => {
    const proj = makeProjectSeed();
    expect(proj.mechanics['CHM-MECH-01'].params.find((p) => p.key === 'switches').value).toBe('4');
    expect(lib.mechanics['LIB-MECH-ACCESS'].params.find((p) => p.key === 'switches').value).toBe('1');
  });

  it('the library seeds game master rules with principle + descriptive tabs', () => {
    expect(Object.keys(lib.gmRules).length).toBeGreaterThanOrEqual(3);
    const r = lib.gmRules['LIB-GMR-001'];
    expect(r.principle).toMatch(/distribute essential information/i);
    expect(r.implementation && r.rationale && r.aiRule).toBeTruthy();
  });

  it('migrateLibrary backfills missing collections without dropping user data', async () => {
    const { migrateLibrary } = await import('../data/seed.js');
    // simulate an older saved library (rev 5) with a user-added item, no gmRules
    const old = { ...makeLibrarySeed(), rev: 5 };
    delete old.gmRules;
    old.items['LIB-ITM-USER'] = { id: 'LIB-ITM-USER', name: 'My custom prop', type: 'gadget', description: '', propNotes: '', loreNotes: '', mechanicIds: [], sensorReqs: [], image: null };
    const migrated = migrateLibrary(old);
    expect(migrated.gmRules['LIB-GMR-001']).toBeDefined();      // backfilled
    expect(migrated.items['LIB-ITM-USER'].name).toBe('My custom prop'); // preserved
    expect(migrateLibrary(null).items).toBeDefined();           // null → fresh seed
  });

  it('new game state is empty while the library stays populated', () => {
    const proj = makeEmptyProject('Fresh');
    expect(Object.keys(proj.items)).toHaveLength(0);
    expect(Object.keys(proj.nodes)).toHaveLength(0);
    expect(Object.keys(lib.items).length).toBeGreaterThan(0); // untouched master DB
  });

  it('imports a narrative element as a story node carrying its text', () => {
    const proj = makeEmptyProject('Test Game');
    const result = importElement(lib, proj, 'LIB-ELM-003'); // Quartermaster Mank bio
    const node = result.nodes[result.createdId];
    expect(node.kind).toBe('story');
    expect(node.title).toBe('Quartermaster Mank');
    expect(node.body).toContain('meticulous ledgers');
    expect(node.elementId).toBe('LIB-ELM-003');
  });

  it('every library section has a working blank factory for "+ New …"', () => {
    let state = makeLibrarySeed();
    for (const coll of Object.keys(LIB_BLANK)) {
      const id = genId(state[coll], LIB_PREFIX[coll]);
      state = reducer(state, { type: 'ADD_ENTITY', coll, entity: LIB_BLANK[coll](id) });
      expect(state[coll][id]).toBeDefined();
      expect(state[coll][id].id).toBe(id);
    }
    // a blank structure opens as an empty, editable graph
    const newStory = Object.values(state.stories).find((s) => s.name === 'New structure');
    expect(newStory.nodes).toEqual({});
    expect(newStory.edges).toEqual([]);
  });

  it('active project serializes to JSON and loads back (mock save/load)', () => {
    const proj = makeProjectSeed();
    const restored = reducer(null, { type: 'RESET', seed: JSON.parse(JSON.stringify(proj)) });
    expect(restored.items['CHM-A-004'].name).toBe('Cipher-Key');
    expect(restored.meta.name).toBe('Operation Chimera');
  });
});
