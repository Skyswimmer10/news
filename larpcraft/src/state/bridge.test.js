import { describe, it, expect } from 'vitest';
import { importItem, importLocation, importStory, importNarrative, importMechPrimitive, importMechanic, narrativeToStructNode, storyTrackToStructure } from './bridge.js';
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
    const result = importStory(lib, proj, 'LIB-STORY-BETRAY');
    expect(Object.keys(result.nodes)).toHaveLength(4);
    expect(result.edges).toHaveLength(3);
    // ids are remapped to project instance ids, provenance kept, all story
    for (const n of Object.values(result.nodes)) {
      expect(n.id).toMatch(/^GAME-N-\d+$/);
      expect(n.primitiveId).toMatch(/^LIB-NAR-/);
      expect(n.kind).toBe('story');
    }
    expect(result.edges.every((e) => result.nodes[e.from] && result.nodes[e.to])).toBe(true);
    expect(result.edges.map((e) => e.label)).toContain('suspicion grows');
    proj = reducer(proj, { type: 'IMPORT_FROM_LIBRARY', ...result });
    expect(Object.keys(proj.nodes)).toHaveLength(4);

    // editing the copy leaves the master template untouched (detached)
    const copyId = Object.keys(proj.nodes)[0];
    reducer(proj, { type: 'UPDATE_ENTITY', coll: 'nodes', id: copyId, patch: { title: 'Changed' } });
    expect(lib.stories['LIB-STORY-BETRAY'].nodes.S1.title).toBe('Start Briefing');
  });

  it('storyTrackToStructure saves the macro story arc as a Story Structure', () => {
    const proj = makeProjectSeed();
    const struct = storyTrackToStructure(proj, 'LIB-STORY-N001', 'Chimera arc');
    // only story-kind nodes, remapped to S-ids
    expect(Object.keys(struct.nodes).length).toBe(3); // N-BRIEF, N-TWIST, N-END
    expect(Object.values(struct.nodes).every((n) => n.kind === 'story')).toBe(true);
    // the N-TWIST → N-END story edge survives, remapped
    const titles = Object.values(struct.nodes).map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining(['Briefing', 'Extraction']));
    expect(struct.name).toBe('Chimera arc');
  });

  it('imports a narrative node as a story node with its text', () => {
    const proj = makeEmptyProject('Test Game');
    const result = importNarrative(lib, proj, 'LIB-NAR-005'); // Quartermaster Mank bio
    const node = result.nodes[result.createdId];
    expect(node.primitiveId).toBe('LIB-NAR-005');
    expect(node.kind).toBe('story');
    expect(node.title).toBe('Quartermaster Mank');
    expect(node.body).toContain('meticulous ledgers');
  });

  it('imports a mechanic node type as a node of its baseKind', () => {
    const proj = makeEmptyProject('Test Game');
    const result = importMechPrimitive(lib, proj, 'LIB-MPRIM-SENSOR', 200, 150);
    const node = result.nodes[result.createdId];
    expect(node.primitiveId).toBe('LIB-MPRIM-SENSOR');
    expect(node.kind).toBe('sensor');
    expect(node.title).toBe('Sensor Trigger');
  });

  it('narrative nodes instantiate as structure nodes for the template editor', () => {
    const st = lib.stories['LIB-STORY-COLDCASE'];
    const node = narrativeToStructNode(lib.narrative['LIB-NAR-002'], st.nodes, 300, 200);
    expect(st.nodes[node.id]).toBeUndefined();
    expect(node).toMatchObject({ primitiveId: 'LIB-NAR-002', kind: 'story', title: 'Plot Twist', x: 300, y: 200 });
  });

  it('mechanic structures use the same node-graph engine, keyed to mech nodes', async () => {
    const { mechPrimitiveToStructNode } = await import('./bridge.js');
    // seeded mechanic structures exist and are built from mechanic nodes
    expect(Object.keys(lib.mechStructures).length).toBeGreaterThanOrEqual(2);
    for (const st of Object.values(lib.mechStructures)) {
      for (const n of Object.values(st.nodes)) expect(lib.mechPrimitives[n.primitiveId]).toBeDefined();
    }
    // dropping a mechanic node onto the canvas keeps its baseKind
    const st = lib.mechStructures['LIB-MSTRUCT-DOOR'];
    const node = mechPrimitiveToStructNode(lib.mechPrimitives['LIB-MPRIM-SENSOR'], st.nodes, 100, 100);
    expect(node).toMatchObject({ primitiveId: 'LIB-MPRIM-SENSOR', kind: 'sensor', title: 'Sensor Trigger' });
    // editing a mech-structure node via the generic reducer path (detached template)
    const s2 = reducer(lib, { type: 'UPDATE_ENTITY', coll: 'mechStructures', id: 'LIB-MSTRUCT-DOOR', patch: { nodes: { ...st.nodes, S1: { ...st.nodes.S1, title: 'Renamed' } } } });
    expect(s2.mechStructures['LIB-MSTRUCT-DOOR'].nodes.S1.title).toBe('Renamed');
  });

  it('the narrative and mechanic node pools are cleanly separated', () => {
    // narrative holds only story content (no sensor/mechanic baseKinds)
    expect(lib.narrative['LIB-NAR-001']).toBeDefined();
    expect(Object.values(lib.narrative).every((n) => !n.baseKind || n.baseKind === undefined)).toBe(true);
    // mechanic node tree holds the physical/sensor/task types
    const mechNames = Object.values(lib.mechPrimitives).map((p) => p.name);
    expect(mechNames).toEqual(expect.arrayContaining(['Sensor Trigger', 'Physical Challenge', 'Countdown Pressure', 'Waypoint Check-in']));
    // seeded structures are pure narrative
    for (const st of Object.values(lib.stories)) {
      for (const n of Object.values(st.nodes)) {
        expect(lib.narrative[n.primitiveId]).toBeDefined();
        expect(n.kind).toBe('story');
      }
    }
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

  it('migrateLibrary splits old primitives/elements into narrative + mechPrimitives', async () => {
    const { migrateLibrary } = await import('../data/seed.js');
    // craft a legacy (v6) library with the old shape + a user-added primitive/element
    const old = {
      ...makeLibrarySeed(), rev: 6,
      primitives: {
        'LIB-PRIM-BRIEF': { id: 'LIB-PRIM-BRIEF', name: 'Start Briefing', baseKind: 'story', color: '#5CA8F5', icon: 'flag', inputs: [], outputs: ['out'], defaultBody: 'Brief.', estMinutes: 10, crew: 1 },
        'LIB-PRIM-SENSOR': { id: 'LIB-PRIM-SENSOR', name: 'Sensor Trigger', baseKind: 'sensor', color: '#3EC6D6', icon: 'zap', inputs: ['arm'], outputs: ['fired'], defaultBody: 'Fires.', estMinutes: 1, crew: 0 },
      },
      elements: { 'LIB-ELM-001': { id: 'LIB-ELM-001', name: 'The Double Agent', etype: 'plot-hook', text: 'A traitor.', tags: ['betrayal'] } },
      elementTypes: { 'plot-hook': { id: 'plot-hook', label: 'Plot hook', color: '#F08CB4' } },
    };
    delete old.narrative; delete old.mechPrimitives; delete old.narrativeCategories;
    const m = migrateLibrary(old);
    // story primitive + element land in narrative; sensor primitive lands in mechPrimitives
    expect(m.narrative['LIB-PRIM-BRIEF'].category).toBe('story-beat');
    expect(m.narrative['LIB-ELM-001'].body).toBe('A traitor.');
    expect(m.mechPrimitives['LIB-PRIM-SENSOR'].baseKind).toBe('sensor');
    expect(m.narrativeCategories['plot-hook']).toBeDefined();
    expect(m.primitives).toBeUndefined();
    expect(m.elements).toBeUndefined();
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
