// The Library → Active Project import bridge.
//
// Importing DUPLICATES the master template into the project as an instance:
// a fresh instance id (<prefix>-ITM-001 style), a templateId back-reference,
// the template's engineering fields copied, and game-state fields added.
// Importing an item cascades: sensor hardware the template requires is
// imported too (or reused if this game already has an instance of that
// template), and the instance's sensorReqs are rewritten to instance ids.

import { genId } from '../data/csvSchemas.js';

const sensorInstance = (template, id) => ({
  id, templateId: template.id, kind: template.kind, label: template.label,
  status: 'unplaced', locationId: null, assignedTo: null, battery: 100,
});

export function importSensor(lib, proj, templateId) {
  const t = lib.sensors[templateId];
  if (!t) return null;
  const id = genId(proj.sensors, `${proj.meta.prefix}-SEN-`);
  return { sensors: { [id]: sensorInstance(t, id) }, createdId: id };
}

export function importItem(lib, proj, templateId) {
  const t = lib.items[templateId];
  if (!t) return null;
  const newSensors = {};
  const sensorReqs = (t.sensorReqs || []).map(({ sensorId, note }) => {
    // Reuse an existing instance of the same hardware template if the game
    // already has one; otherwise import the hardware alongside the item.
    let inst = Object.values(proj.sensors).find((x) => x.templateId === sensorId)
      ?? Object.values(newSensors).find((x) => x.templateId === sensorId);
    if (!inst) {
      const st = lib.sensors[sensorId];
      if (!st) return null;
      const id = genId({ ...proj.sensors, ...newSensors }, `${proj.meta.prefix}-SEN-`);
      inst = sensorInstance(st, id);
      newSensors[id] = inst;
    }
    return { sensorId: inst.id, note };
  }).filter(Boolean);

  const id = genId(proj.items, `${proj.meta.prefix}-ITM-`);
  const item = {
    id, templateId: t.id,
    name: t.name, type: t.type, description: t.description,
    propNotes: t.propNotes, loreNotes: t.loreNotes,
    mechanicIds: [...(t.mechanicIds || [])],
    sensorReqs,
    buildStatus: 'concept', availability: 'ready',
    locationId: null, image: t.image ?? null, assignedTo: null,
  };
  return { items: { [id]: item }, sensors: newSensors, createdId: id };
}

export function importLocation(lib, proj, templateId) {
  const t = lib.locations[templateId];
  if (!t) return null;
  const id = genId(proj.locations, `${proj.meta.prefix}-LOC-`);
  const location = {
    id, templateId: t.id, name: t.name, zone: '',
    notes: t.notes, safety: t.safety, image: t.image ?? null, sensorIds: [],
  };
  return { locations: { [id]: location }, createdId: id };
}

// A story structure spawns a chained set of nodes on the flow canvas.
export function importStory(lib, proj, storyId) {
  const t = lib.stories[storyId];
  if (!t) return null;
  const baseY = 80 + (Object.keys(proj.nodes).length ? 260 : 0);
  const nodes = {};
  const edges = [];
  const ids = [];
  t.beats.forEach((beat, i) => {
    const id = genId({ ...proj.nodes, ...nodes }, `${proj.meta.prefix}-N-`);
    nodes[id] = {
      id, kind: beat.kind, title: beat.title, x: 60 + i * 300, y: baseY,
      body: '', color: null, locationId: null, itemId: null, mechanicIds: [], sensorIds: [],
    };
    ids.push(id);
    if (i > 0) edges.push({ from: ids[i - 1], to: id, label: '', color: null });
  });
  return { nodes, edges, createdId: ids[0] };
}
