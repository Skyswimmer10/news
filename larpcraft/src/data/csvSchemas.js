// Per-section CSV schemas: how each collection flattens to rows (export) and
// how a row becomes an entity again (import). Import merges by id — an
// existing id updates that record, a new id creates one. `blank(id)` supplies
// defaults for created records and for the per-page "add new" buttons.
// Fields that can't survive a spreadsheet (images, live assignments) are
// omitted from CSV and preserved on update.

const ITEM_TYPES = ['artifact', 'gadget', 'consumable'];
const BUILD = ['concept', 'design', 'build', 'tested', 'packed'];
const AVAIL = ['ready', 'in-use', 'deployed', 'missing'];
const NODE_KINDS = ['story', 'location', 'objective', 'enemy', 'mechanic', 'sensor'];

export function genId(existing, prefix) {
  let n = Object.keys(existing).length + 1;
  let id;
  do { id = `${prefix}${String(n).padStart(3, '0')}`; n++; } while (existing[id]);
  return id;
}

const list = (v) => (v ? v.split(';').map((x) => x.trim()).filter(Boolean) : []);
const pickEnum = (v, allowed, fallback, warn, what) => {
  if (!v) return fallback;
  if (allowed.includes(v)) return v;
  warn(`unknown ${what} "${v}" → ${fallback}`);
  return fallback;
};

export const CSV_SCHEMAS = {
  items: {
    filename: 'items.csv',
    headers: ['id', 'name', 'type', 'buildStatus', 'availability', 'description', 'propNotes', 'loreNotes', 'locationId', 'mechanicIds', 'sensorReqs'],
    newId: (s) => genId(s.items, 'CHM-N-'),
    blank: (id) => ({ id, templateId: null, name: 'New item', type: 'gadget', buildStatus: 'concept', availability: 'ready', description: '', propNotes: '', loreNotes: '', locationId: null, mechanicIds: [], sensorReqs: [], image: null, assignedTo: null }),
    toRows: (s) => Object.values(s.items).map((i) => ({
      ...i,
      locationId: i.locationId ?? '',
      mechanicIds: i.mechanicIds.join(';'),
      sensorReqs: i.sensorReqs.map((r) => (r.note ? `${r.sensorId}:${r.note}` : r.sensorId)).join(';'),
    })),
    fromRow: (row, s, warn) => {
      const p = {
        name: row.name || 'Unnamed item',
        type: pickEnum(row.type, ITEM_TYPES, 'gadget', warn, 'type'),
        buildStatus: pickEnum(row.buildStatus, BUILD, 'concept', warn, 'buildStatus'),
        availability: pickEnum(row.availability, AVAIL, 'ready', warn, 'availability'),
        description: row.description ?? '',
        propNotes: row.propNotes ?? '',
        loreNotes: row.loreNotes ?? '',
      };
      p.locationId = row.locationId && s.locations[row.locationId] ? row.locationId : (row.locationId && warn(`unknown location "${row.locationId}"`), null);
      p.mechanicIds = list(row.mechanicIds).filter((m) => s.mechanics[m] || (warn(`unknown mechanic "${m}"`), false));
      p.sensorReqs = list(row.sensorReqs).map((entry) => {
        const idx = entry.indexOf(':');
        const sensorId = idx === -1 ? entry : entry.slice(0, idx);
        const note = idx === -1 ? '' : entry.slice(idx + 1);
        if (!s.sensors[sensorId]) { warn(`unknown sensor "${sensorId}"`); return null; }
        return { sensorId, note };
      }).filter(Boolean);
      return p;
    },
  },

  locations: {
    filename: 'locations.csv',
    headers: ['id', 'name', 'zone', 'notes', 'safety', 'sensorIds'],
    newId: (s) => genId(s.locations, 'LOC-N-'),
    blank: (id) => ({ id, templateId: null, name: 'New location', zone: '', notes: '', safety: '', image: null, sensorIds: [] }),
    toRows: (s) => Object.values(s.locations).map((l) => ({ ...l, sensorIds: l.sensorIds.join(';') })),
    fromRow: (row, s, warn) => ({
      name: row.name || 'Unnamed location',
      zone: row.zone ?? '',
      notes: row.notes ?? '',
      safety: row.safety ?? '',
      sensorIds: list(row.sensorIds).filter((x) => s.sensors[x] || (warn(`unknown sensor "${x}"`), false)),
    }),
  },

  players: {
    filename: 'players.csv',
    headers: ['id', 'name', 'initials', 'role', 'teamId', 'flags'],
    newId: (s) => genId(s.players, 'P-N-'),
    blank: (id) => ({ id, name: 'New player', initials: 'NP', role: 'Player', teamId: null, flags: [] }),
    toRows: (s) => Object.values(s.players).map((p) => ({ ...p, flags: p.flags.join(';') })),
    fromRow: (row, s, warn) => {
      if (!row.teamId || !s.teams[row.teamId]) {
        warn(`player "${row.id}": unknown team "${row.teamId}" — row skipped`);
        return null;
      }
      const name = row.name || 'Unnamed player';
      return {
        name,
        initials: row.initials || name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
        role: row.role || 'Player',
        teamId: row.teamId,
        flags: list(row.flags),
      };
    },
  },

  nodes: {
    filename: 'quest-nodes.csv',
    headers: ['id', 'kind', 'title', 'x', 'y', 'color', 'body', 'itemId', 'locationId', 'connectsTo'],
    newId: (s) => genId(s.nodes, 'N-'),
    blank: (id) => ({ id, kind: 'story', title: 'New story beat', x: 80, y: 80, body: '', color: null, locationId: null, itemId: null, mechanicIds: [], sensorIds: [] }),
    toRows: (s) => Object.values(s.nodes).map((n) => ({
      ...n,
      color: n.color ?? '',
      itemId: n.itemId ?? '',
      locationId: n.locationId ?? '',
      connectsTo: s.edges.filter((e) => e.from === n.id).map((e) => e.to).join(';'),
    })),
    fromRow: (row, s, warn) => ({
      kind: pickEnum(row.kind, NODE_KINDS, 'story', warn, 'node kind'),
      title: row.title || 'Untitled node',
      x: Number.isFinite(+row.x) && row.x !== '' ? Math.max(8, Math.round(+row.x)) : 80,
      y: Number.isFinite(+row.y) && row.y !== '' ? Math.max(8, Math.round(+row.y)) : 80,
      color: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(row.color) ? row.color : null,
      body: row.body ?? '',
      itemId: row.itemId && s.items[row.itemId] ? row.itemId : (row.itemId && warn(`unknown item "${row.itemId}"`), null),
      locationId: row.locationId && s.locations[row.locationId] ? row.locationId : (row.locationId && warn(`unknown location "${row.locationId}"`), null),
    }),
    // Rebuild connections after the nodes themselves are merged in.
    extra: (row) => list(row.connectsTo).map((to) => ({ type: 'ADD_EDGE', from: row.id, to })),
  },
};
