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
    notes: t.notes, safety: t.safety, image: t.image ?? null, schematic: null, sensorIds: [],
    mapKind: 'schematic', osm: { lat: 56.9496, lon: 24.1052, zoom: 16 }, markers: [], arrows: [],
  };
  return { locations: { [id]: location }, createdId: id };
}

// Import a mechanic template into the game as a configurable instance. Its
// parameters are copied so the game can micro-adjust them (add switches,
// change timings) without touching the master blueprint in the library.
export function importMechanic(lib, proj, mechId) {
  const t = lib.mechanics[mechId];
  if (!t) return null;
  const id = genId(proj.mechanics ?? {}, `${proj.meta.prefix}-MECH-`);
  const mech = {
    id, templateId: t.id, name: t.name, summary: t.summary,
    params: (t.params || []).map((p) => ({ ...p })),
  };
  return { mechanics: { [id]: mech }, createdId: id };
}

// A story structure is a saved node GRAPH. Importing instantiates a fully
// detached copy: every node gets a fresh project id (the whole layout is
// preserved, shifted below existing content), edges are remapped to the new
// ids, and the copy keeps primitiveId provenance. Editing the copy never
// touches the master template.
export function importStory(lib, proj, storyId) {
  const t = lib.stories[storyId];
  if (!t) return null;
  const tplNodes = Object.values(t.nodes);
  if (!tplNodes.length) return null;
  const existing = Object.values(proj.nodes);
  const offsetY = existing.length ? Math.max(...existing.map((n) => n.y)) + 260 : 80;
  const minX = Math.min(...tplNodes.map((n) => n.x));
  const minY = Math.min(...tplNodes.map((n) => n.y));

  const idMap = {};
  const nodes = {};
  tplNodes.forEach((n) => {
    const id = genId({ ...proj.nodes, ...nodes }, `${proj.meta.prefix}-N-`);
    idMap[n.id] = id;
    nodes[id] = {
      id, primitiveId: n.primitiveId ?? null, kind: n.kind, title: n.title,
      x: n.x - minX + 60, y: n.y - minY + offsetY,
      body: n.body ?? '', color: n.color ?? null,
      locationId: null, itemId: null, mechanicIds: [], sensorIds: [],
    };
  });
  const edges = t.edges
    .filter((e) => idMap[e.from] && idMap[e.to])
    .map((e) => ({ from: idMap[e.from], to: idMap[e.to], label: e.label || '', color: e.color ?? null }));
  return { nodes, edges, createdId: idMap[tplNodes[0].id] };
}

// A single narrative building block dropped into the game as a story node.
export function importNarrative(lib, proj, narrativeId, x = 100, y = 100) {
  const n = lib.narrative[narrativeId];
  if (!n) return null;
  const id = genId(proj.nodes, `${proj.meta.prefix}-N-`);
  const node = {
    id, primitiveId: n.id, kind: 'story', title: n.name,
    x: Math.round(x), y: Math.round(y), body: n.body || '', color: n.color ?? null,
    locationId: null, itemId: null, mechanicIds: [], sensorIds: [],
  };
  return { nodes: { [id]: node }, createdId: id };
}

// A single mechanic node type dropped into the game as a node of its baseKind.
export function importMechPrimitive(lib, proj, primitiveId, x = 100, y = 100) {
  const p = lib.mechPrimitives[primitiveId];
  if (!p) return null;
  const id = genId(proj.nodes, `${proj.meta.prefix}-N-`);
  const node = {
    id, primitiveId: p.id, kind: p.baseKind, title: p.name,
    x: Math.round(x), y: Math.round(y), body: p.defaultBody || '', color: null,
    locationId: null, itemId: null, mechanicIds: [], sensorIds: [],
  };
  return { nodes: { [id]: node }, createdId: id };
}

// Instantiate a narrative node INSIDE a story structure (library editor).
export function narrativeToStructNode(narrative, structNodes, x, y) {
  const id = genId(structNodes, 'S');
  return {
    id, primitiveId: narrative.id, kind: 'story', title: narrative.name,
    x: Math.round(x), y: Math.round(y), body: narrative.body || '', color: narrative.color ?? null,
  };
}

// Save the active game's macro story track (its story-kind nodes + the edges
// between them) to the Library as a reusable Story Structure. Positions come
// from the Weaver's story-track layout so the saved template mirrors it.
export function storyTrackToStructure(proj, id, name) {
  const storyNodes = Object.values(proj.nodes).filter((n) => n.kind === 'story' || n.elementId);
  const idMap = {};
  const nodes = {};
  storyNodes.forEach((n, i) => {
    const sid = `S${i + 1}`;
    idMap[n.id] = sid;
    const pos = proj.storyTrack?.[n.id] || { x: 60, y: 40 + i * 180 };
    nodes[sid] = { id: sid, primitiveId: n.primitiveId ?? null, kind: 'story', title: n.title, x: pos.x, y: pos.y, body: n.body || '', color: n.color ?? null };
  });
  const edges = proj.edges
    .filter((e) => idMap[e.from] && idMap[e.to])
    .map((e) => ({ from: idMap[e.from], to: idMap[e.to], label: e.label || '', color: e.color ?? null }));
  return { id, name, description: `Saved from ${proj.meta.name}`, estMinutes: 30, nodes, edges };
}

// Instantiate a mechanic node INSIDE a mechanic structure (library editor).
export function mechPrimitiveToStructNode(primitive, structNodes, x, y) {
  const id = genId(structNodes, 'S');
  return {
    id, primitiveId: primitive.id, kind: primitive.baseKind, title: primitive.name,
    x: Math.round(x), y: Math.round(y), body: primitive.defaultBody || '', color: primitive.color ?? null,
  };
}
