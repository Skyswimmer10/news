import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv } from './csv.js';
import { CSV_SCHEMAS } from '../data/csvSchemas.js';
import { reducer } from '../state/reducer.js';
import { makeProjectSeed, makeLibrarySeed } from '../data/seed.js';

const makeSeed = () => ({ ...makeProjectSeed(), mechanics: makeLibrarySeed().mechanics });

describe('csv core', () => {
  it('round-trips quoted fields with commas, quotes and newlines', () => {
    const headers = ['id', 'name', 'notes'];
    const rows = [
      { id: 'A1', name: 'Key, brass ("old")', notes: 'line one\nline two' },
      { id: 'A2', name: 'Plain', notes: '' },
    ];
    const parsed = parseCsv(toCsv(headers, rows));
    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows).toEqual(rows);
  });

  it('handles CRLF input and skips blank lines', () => {
    const { rows } = parseCsv('id,name\r\nA1,Key\r\n\r\nA2,Card\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ id: 'A2', name: 'Card' });
  });
});

describe('items csv schema', () => {
  it('export → import round-trips mechanics and sensor requirements', () => {
    const s = makeSeed();
    const row = CSV_SCHEMAS.items.toRows(s).find((r) => r.id === 'CHM-A-007');
    expect(row.mechanicIds).toBe('LIB-MECH-DECRYPT;LIB-MECH-COMMS');
    const partial = CSV_SCHEMAS.items.fromRow(row, s, () => {});
    expect(partial.mechanicIds).toEqual(['LIB-MECH-DECRYPT', 'LIB-MECH-COMMS']);
    expect(partial.sensorReqs).toEqual(s.items['CHM-A-007'].sensorReqs);
  });

  it('coerces bad enums with warnings and drops unknown references', () => {
    const s = makeSeed();
    const warnings = [];
    const partial = CSV_SCHEMAS.items.fromRow(
      { id: 'X-1', name: 'Mystery box', type: 'weapon', buildStatus: 'done', availability: '', locationId: 'LOC-NOPE', mechanicIds: 'LIB-MECH-LOCK;MECH-FAKE', sensorReqs: 'RFID-07:note here;GHOST-1' },
      s, (m) => warnings.push(m),
    );
    expect(partial.type).toBe('gadget');
    expect(partial.buildStatus).toBe('concept');
    expect(partial.availability).toBe('ready');
    expect(partial.locationId).toBeNull();
    expect(partial.mechanicIds).toEqual(['LIB-MECH-LOCK']);
    expect(partial.sensorReqs).toEqual([{ sensorId: 'RFID-07', note: 'note here' }]);
    expect(warnings.length).toBeGreaterThanOrEqual(4);
  });
});

describe('import merge via reducer', () => {
  it('IMPORT_ENTITIES updates existing records and creates new ones', () => {
    const s0 = makeSeed();
    const updatedExisting = { ...s0.items['CHM-A-004'], name: 'Cipher-Key (renamed)' };
    const brandNew = { ...CSV_SCHEMAS.items.blank('CHM-N-001'), name: 'Smoke Grenade Prop' };
    const s1 = reducer(s0, { type: 'IMPORT_ENTITIES', coll: 'items', entities: { 'CHM-A-004': updatedExisting, 'CHM-N-001': brandNew } });
    expect(s1.items['CHM-A-004'].name).toBe('Cipher-Key (renamed)');
    expect(s1.items['CHM-A-004'].sensorReqs).toEqual(s0.items['CHM-A-004'].sensorReqs); // preserved
    expect(s1.items['CHM-N-001'].name).toBe('Smoke Grenade Prop');
  });

  it('ADD_ENTITY inserts a blank record and refuses duplicates', () => {
    const s0 = makeSeed();
    const s1 = reducer(s0, { type: 'ADD_ENTITY', coll: 'locations', entity: CSV_SCHEMAS.locations.blank('LOC-N-001') });
    expect(s1.locations['LOC-N-001'].name).toBe('New location');
    const s2 = reducer(s1, { type: 'ADD_ENTITY', coll: 'locations', entity: { ...CSV_SCHEMAS.locations.blank('LOC-N-001'), name: 'Clobber' } });
    expect(s2.locations['LOC-N-001'].name).toBe('New location');
  });

  it('players with unknown teams are skipped by the schema', () => {
    const s = makeSeed();
    const bad = CSV_SCHEMAS.players.fromRow({ id: 'P-X', name: 'Ghost', teamId: 'T-NOPE' }, s, () => {});
    expect(bad).toBeNull();
  });

  it('node connectsTo column rebuilds edges after import', () => {
    let s = makeSeed();
    const rows = CSV_SCHEMAS.nodes.toRows(s);
    const brief = rows.find((r) => r.id === 'N-BRIEF');
    expect(brief.connectsTo).toBe('N-S7');
    // simulate importing a new node connected to two existing ones
    const row = { id: 'N-NEW', kind: 'objective', title: 'Extra step', x: '50', y: '60', connectsTo: 'N-GATE;N-PATROL' };
    const partial = CSV_SCHEMAS.nodes.fromRow(row, s, () => {});
    s = reducer(s, { type: 'IMPORT_ENTITIES', coll: 'nodes', entities: { 'N-NEW': { ...CSV_SCHEMAS.nodes.blank('N-NEW'), ...partial } } });
    for (const a of CSV_SCHEMAS.nodes.extra(row)) s = reducer(s, a);
    expect(s.edges.filter((e) => e.from === 'N-NEW').map((e) => e.to).sort()).toEqual(['N-GATE', 'N-PATROL']);
  });
});
