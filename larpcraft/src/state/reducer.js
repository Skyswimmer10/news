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

    // Uploaded file becomes the primary thumbnail for the item / location.
    case 'SET_IMAGE': {
      const { coll, id, image } = action; // image: { dataUrl?, kind, name } | null
      const entity = state[coll][id];
      if (!entity) return state;
      return { ...state, [coll]: { ...state[coll], [id]: { ...entity, image } } };
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

// The cross-reference at the heart of the app: a flow node resolves to live records.
export const resolveNode = (s, nodeId) => {
  const node = s.nodes[nodeId];
  if (!node) return null;
  return {
    node,
    item: node.itemId ? s.items[node.itemId] : null,
    location: node.locationId ? s.locations[node.locationId] : null,
    mechanics: (node.mechanicIds || []).map((id) => s.mechanics[id]).filter(Boolean),
    sensors: (node.sensorIds || []).map((id) => s.sensors[id]).filter(Boolean),
  };
};
