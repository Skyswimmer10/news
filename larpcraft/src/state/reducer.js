// Pure state transitions. Every view dispatches through here, so an edit made
// anywhere (inspector, teams screen, uploader) is visible everywhere on the
// next render — there is exactly one copy of each entity.

export function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return action.seed;

    // Generic field edit from the inspector: { coll:'items', id, patch:{name:'…'} }
    case 'UPDATE_ENTITY': {
      const { coll, id, patch } = action;
      const entity = state[coll][id];
      if (!entity) return state;
      return { ...state, [coll]: { ...state[coll], [id]: { ...entity, ...patch } } };
    }

    // Issue a physical item to a player. Availability flips to 'in-use'
    // automatically so the Item Database reflects the assignment instantly.
    case 'ASSIGN_ITEM': {
      const { itemId, teamId, playerId } = action;
      const item = state.items[itemId];
      if (!item) return state;
      return {
        ...state,
        items: {
          ...state.items,
          [itemId]: { ...item, assignedTo: { teamId, playerId: playerId ?? null }, availability: 'in-use' },
        },
      };
    }

    case 'UNASSIGN_ITEM': {
      const item = state.items[action.itemId];
      if (!item) return state;
      return {
        ...state,
        items: { ...state.items, [action.itemId]: { ...item, assignedTo: null, availability: 'ready' } },
      };
    }

    // Place an item in the field (environmental placement) → 'deployed'.
    case 'DEPLOY_ITEM': {
      const item = state.items[action.itemId];
      if (!item) return state;
      return {
        ...state,
        items: {
          ...state.items,
          [action.itemId]: { ...item, locationId: action.locationId, assignedTo: null, availability: 'deployed' },
        },
      };
    }

    // Issue sensor hardware (NFC reader, button box, …) to a player role.
    case 'ASSIGN_SENSOR': {
      const sensor = state.sensors[action.sensorId];
      if (!sensor) return state;
      return {
        ...state,
        sensors: { ...state.sensors, [action.sensorId]: { ...sensor, assignedTo: action.playerId ?? null } },
      };
    }

    // Add/remove a hardware requirement on an item.
    case 'ADD_SENSOR_REQ': {
      const item = state.items[action.itemId];
      if (!item || item.sensorReqs.some((r) => r.sensorId === action.sensorId)) return state;
      return {
        ...state,
        items: {
          ...state.items,
          [action.itemId]: { ...item, sensorReqs: [...item.sensorReqs, { sensorId: action.sensorId, note: action.note || '' }] },
        },
      };
    }
    case 'REMOVE_SENSOR_REQ': {
      const item = state.items[action.itemId];
      if (!item) return state;
      return {
        ...state,
        items: {
          ...state.items,
          [action.itemId]: { ...item, sensorReqs: item.sensorReqs.filter((r) => r.sensorId !== action.sensorId) },
        },
      };
    }

    case 'DELETE_ENTITY': {
      const { coll, id } = action;
      if (!state[coll]?.[id]) return state;
      const next = { ...state[coll] };
      delete next[id];
      return { ...state, [coll]: next };
    }

    // "Add new" buttons: insert a fresh entity into a collection.
    case 'ADD_ENTITY': {
      const { coll, entity } = action;
      if (!entity?.id || state[coll][entity.id]) return state;
      return { ...state, [coll]: { ...state[coll], [entity.id]: entity } };
    }

    // CSV import: entities are fully built by the caller (existing records
    // merged, new records from blanks) and replace by id.
    case 'IMPORT_ENTITIES': {
      const { coll, entities } = action;
      return { ...state, [coll]: { ...state[coll], ...entities } };
    }

    // Library → project import: pre-built instances land in the game.
    case 'IMPORT_FROM_LIBRARY': {
      return {
        ...state,
        items: { ...state.items, ...(action.items || {}) },
        locations: { ...state.locations, ...(action.locations || {}) },
        sensors: { ...state.sensors, ...(action.sensors || {}) },
        mechanics: { ...(state.mechanics || {}), ...(action.mechanics || {}) },
        nodes: { ...state.nodes, ...(action.nodes || {}) },
        edges: action.edges?.length ? [...state.edges, ...action.edges] : state.edges,
      };
    }

    case 'RENAME_PROJECT': {
      return { ...state, meta: { ...state.meta, name: action.name } };
    }

    // Per-game settings (hero backdrop image + opacity, etc.).
    case 'SET_META': {
      return { ...state, meta: { ...state.meta, ...action.patch } };
    }

    // Delete a node and every connection touching it.
    case 'DELETE_NODE': {
      const { nodeId } = action;
      if (!state.nodes[nodeId]) return state;
      const nodes = { ...state.nodes };
      delete nodes[nodeId];
      return { ...state, nodes, edges: state.edges.filter((e) => e.from !== nodeId && e.to !== nodeId) };
    }

    // Edit a connection's label (or other fields).
    case 'UPDATE_EDGE': {
      const { from, to, patch } = action;
      return { ...state, edges: state.edges.map((e) => (e.from === from && e.to === to ? { ...e, ...patch } : e)) };
    }

    // ---- scenario graph editing ----
    case 'ADD_NODE': {
      const n = action.node;
      if (!n?.id || state.nodes[n.id]) return state;
      return { ...state, nodes: { ...state.nodes, [n.id]: n } };
    }

    // Connect two nodes. Ignores self-loops and duplicate connections.
    case 'ADD_EDGE': {
      const { from, to, label = '', color = null } = action;
      if (from === to || !state.nodes[from] || !state.nodes[to]) return state;
      if (state.edges.some((e) => e.from === from && e.to === to)) return state;
      return { ...state, edges: [...state.edges, { from, to, label, color }] };
    }

    case 'REMOVE_EDGE': {
      return { ...state, edges: state.edges.filter((e) => !(e.from === action.from && e.to === action.to)) };
    }

    // Uploaded file lands on the entity's image field — `field` picks which
    // one (default cover 'image'; locations also have 'schematic').
    case 'SET_IMAGE': {
      const { coll, id, image, field = 'image' } = action;
      const entity = state[coll][id];
      if (!entity) return state;
      return { ...state, [coll]: { ...state[coll], [id]: { ...entity, [field]: image } } };
    }

    default:
      return state;
  }
}

// ---------- selectors (derived views; keep single source of truth) ----------

export const itemList = (s) => Object.values(s.items);

export const itemsAssignedToTeam = (s, teamId) =>
  itemList(s).filter((i) => i.assignedTo?.teamId === teamId);

export const itemsAssignedToPlayer = (s, playerId) =>
  itemList(s).filter((i) => i.assignedTo?.playerId === playerId);

export const sensorsAssignedToPlayer = (s, playerId) =>
  Object.values(s.sensors).filter((x) => x.assignedTo === playerId);

export const availableItems = (s) => itemList(s).filter((i) => i.availability === 'ready');

export const playersOfTeam = (s, teamId) =>
  Object.values(s.players).filter((p) => p.teamId === teamId);

// The cross-reference at the heart of the app: a flow node resolves to live
// records — item/location/sensor instances from the project, rules from the
// library master database.
export const resolveNode = (s, lib, nodeId) => {
  const node = s.nodes[nodeId];
  if (!node) return null;
  return {
    node,
    item: node.itemId ? s.items[node.itemId] : null,
    location: node.locationId ? s.locations[node.locationId] : null,
    mechanics: (node.mechanicIds || []).map((id) => lib.mechanics[id]).filter(Boolean),
    sensors: (node.sensorIds || []).map((id) => s.sensors[id]).filter(Boolean),
  };
};
