// Pure state transitions. Every view dispatches through here, so an edit made
// anywhere (inspector, teams screen, uploader) is visible everywhere on the
// next render — there is exactly one copy of each entity.

// ---- located graphs (for hierarchical / nested node editing) ----
// A `scope` addresses one editable {nodes, edges} graph in the project:
//   { coll:'nodes' }                        → the narrative graph
//   { coll:'taskNodes' }                    → the surface Task flow
//   { coll, parentId }                      → that parent node's nested `.sub`
//   { coll, parentPath:[id0,id1,…] }        → deeper nesting (≤ 3 levels)
const topKeys = (coll) => (coll === 'taskNodes' ? { nk: 'taskNodes', ek: 'taskEdges' } : { nk: 'nodes', ek: 'edges' });
const scopePath = (scope) => scope.parentPath ?? (scope.parentId ? [scope.parentId] : []);

export function locateGraph(state, scope) {
  const { nk, ek } = topKeys(scope.coll);
  let nodes = state[nk] || {};
  let edges = state[ek] || [];
  for (const pid of scopePath(scope)) {
    const sub = nodes[pid]?.sub || { nodes: {}, edges: [] };
    nodes = sub.nodes || {};
    edges = sub.edges || [];
  }
  return { nodes, edges };
}
function writeGraph(state, scope, next) {
  const { nk, ek } = topKeys(scope.coll);
  const path = scopePath(scope);
  if (path.length === 0) return { ...state, [nk]: next.nodes, [ek]: next.edges };
  // Rebuild the chain of parents immutably from the top down.
  const rebuild = (nodes, depth) => {
    const pid = path[depth];
    const parent = nodes[pid];
    if (!parent) return nodes;
    const sub = parent.sub || { nodes: {}, edges: [] };
    const inner = depth === path.length - 1
      ? { nodes: next.nodes, edges: next.edges }
      : { nodes: rebuild(sub.nodes || {}, depth + 1), edges: sub.edges || [] };
    return { ...nodes, [pid]: { ...parent, sub: inner } };
  };
  return { ...state, [nk]: rebuild(state[nk], 0) };
}

// Append a change-history entry (skips pure position/history writes) so every
// node and subnode carries its own audit trail, capped at 20 entries.
const HISTORY_SKIP = new Set(['x', 'y', 'history', 'sub', 'collapsed']);
function withHistory(entity, patch) {
  const fields = Object.keys(patch).filter((k) => !HISTORY_SKIP.has(k));
  if (fields.length === 0) return { ...entity, ...patch };
  const history = [...(entity.history || []), { t: Date.now(), fields }].slice(-20);
  return { ...entity, ...patch, history };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return action.seed;

    // Generic field edit from the inspector: { coll:'items', id, patch:{name:'…'} }
    // Narrative nodes and subnodes also log a change-history entry.
    case 'UPDATE_ENTITY': {
      const { coll, id, patch } = action;
      const entity = state[coll][id];
      if (!entity) return state;
      const next = (coll === 'nodes' || coll === 'subnodes') ? withHistory(entity, patch) : { ...entity, ...patch };
      return { ...state, [coll]: { ...state[coll], [id]: next } };
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

    // Delete a node and every connection (and Weaver alignment) touching it.
    // Subnodes attached to it are detached (set floating), never destroyed.
    case 'DELETE_NODE': {
      const { nodeId } = action;
      if (!state.nodes[nodeId]) return state;
      const nodes = { ...state.nodes };
      delete nodes[nodeId];
      const subnodes = Object.fromEntries(Object.entries(state.subnodes || {}).map(([id, sn]) =>
        [id, sn.parentRef?.nodeId === nodeId ? { ...sn, parentRef: null } : sn]));
      return {
        ...state, nodes, subnodes,
        edges: state.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
        alignments: (state.alignments || []).filter((a) => a.story !== nodeId && a.task !== nodeId),
      };
    }

    // Delete a subnode: cascades to its child subnodes and removes any canvas
    // connections that start or end on the deleted subnodes.
    case 'DELETE_SUBNODE': {
      const { subnodeId } = action;
      if (!state.subnodes?.[subnodeId]) return state;
      const doomed = new Set([subnodeId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const sn of Object.values(state.subnodes)) {
          if (!doomed.has(sn.id) && sn.parentRef?.subnodeId && doomed.has(sn.parentRef.subnodeId)) { doomed.add(sn.id); grew = true; }
        }
      }
      const subnodes = Object.fromEntries(Object.entries(state.subnodes).filter(([id]) => !doomed.has(id)));
      return { ...state, subnodes, edges: state.edges.filter((e) => !doomed.has(e.from) && !doomed.has(e.to)) };
    }

    // Weaver: position of a story beat on the left story-track canvas
    // (kept separate from its Narrative & Quests canvas position).
    case 'SET_STORY_POS': {
      return { ...state, storyTrack: { ...(state.storyTrack || {}), [action.nodeId]: { x: action.x, y: action.y } } };
    }

    // Weaver: conceptual alignment links between a story beat and a task.
    case 'ADD_ALIGN': {
      const aligns = state.alignments || [];
      if (aligns.some((a) => a.story === action.story && a.task === action.task)) return state;
      return { ...state, alignments: [...aligns, { story: action.story, task: action.task }] };
    }
    case 'REMOVE_ALIGN': {
      return { ...state, alignments: (state.alignments || []).filter((a) => !(a.story === action.story && a.task === action.task)) };
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

    // Connect two nodes (or subnodes — e.g. an Outcome branch merging into a
    // later node). Ignores self-loops and duplicate connections.
    case 'ADD_EDGE': {
      const { from, to, label = '', color = null } = action;
      const exists = (id) => state.nodes[id] || state.subnodes?.[id];
      if (from === to || !exists(from) || !exists(to)) return state;
      if (state.edges.some((e) => e.from === from && e.to === to)) return state;
      return { ...state, edges: [...state.edges, { from, to, label, color }] };
    }

    // ---- frames: purely visual grouping; moving a frame carries members ----
    // Members are recomputed by containment on every step: nodes/subnodes
    // whose top-left sits inside the frame, and frames fully inside it.
    case 'FRAME_MOVE': {
      const { frameId, dx, dy } = action;
      const fr = state.frames?.[frameId];
      if (!fr) return state;
      const inside = (x, y) => x >= fr.x && x <= fr.x + fr.w && y >= fr.y && y <= fr.y + fr.h;
      const shift = (coll) => Object.fromEntries(Object.entries(coll).map(([id, n]) =>
        [id, inside(n.x, n.y) ? { ...n, x: n.x + dx, y: n.y + dy } : n]));
      const frames = Object.fromEntries(Object.entries(state.frames).map(([id, f]) => {
        if (id === frameId) return [id, { ...f, x: f.x + dx, y: f.y + dy }];
        return [id, inside(f.x, f.y) && inside(f.x + f.w, f.y + f.h) ? { ...f, x: f.x + dx, y: f.y + dy } : f];
      }));
      return { ...state, frames, nodes: shift(state.nodes), subnodes: shift(state.subnodes || {}) };
    }

    // Convert a Frame into a Composite (concept node): member nodes move into
    // the new node's sub-graph; interior edges follow; edges crossing the
    // boundary re-point to the composite. The frame itself disappears.
    case 'FRAME_TO_COMPOSITE': {
      const { frameId, nodeId } = action;
      const fr = state.frames?.[frameId];
      if (!fr || !nodeId || state.nodes[nodeId]) return state;
      const inside = (n) => n.x >= fr.x && n.x <= fr.x + fr.w && n.y >= fr.y && n.y <= fr.y + fr.h;
      const memberIds = new Set(Object.values(state.nodes).filter(inside).map((n) => n.id));
      if (memberIds.size === 0) return state;
      const subNodes = {};
      for (const id of memberIds) {
        const n = state.nodes[id];
        subNodes[id] = { ...n, x: n.x - fr.x + 20, y: n.y - fr.y + 20 };
      }
      const subEdges = state.edges.filter((e) => memberIds.has(e.from) && memberIds.has(e.to));
      const edges = state.edges
        .filter((e) => !(memberIds.has(e.from) && memberIds.has(e.to)))
        .map((e) => ({
          ...e,
          from: memberIds.has(e.from) ? nodeId : e.from,
          to: memberIds.has(e.to) ? nodeId : e.to,
        }))
        .filter((e) => e.from !== e.to);
      const nodes = Object.fromEntries(Object.entries(state.nodes).filter(([id]) => !memberIds.has(id)));
      nodes[nodeId] = {
        id: nodeId, kind: 'concept', conceptKind: 'structureConcept', conceptId: null,
        title: fr.label || 'Composite', x: fr.x, y: fr.y, body: '', color: fr.color ?? null,
        teamId: null, sets: [], collapsed: true, conceptAnswers: {},
        sub: { nodes: subNodes, edges: subEdges },
      };
      const frames = { ...state.frames };
      delete frames[frameId];
      const subnodes = Object.fromEntries(Object.entries(state.subnodes || {}).map(([id, sn]) =>
        [id, sn.parentRef?.nodeId && memberIds.has(sn.parentRef.nodeId) ? { ...sn, parentRef: { nodeId } } : sn]));
      return { ...state, nodes, edges, frames, subnodes };
    }

    // Convert a Composite (concept node) back into a Frame: its sub-graph
    // spills onto the canvas grouped under a new frame; the node disappears.
    case 'COMPOSITE_TO_FRAME': {
      const { nodeId, frameId } = action;
      const n = state.nodes[nodeId];
      if (!n?.sub || !frameId || state.frames?.[frameId]) return state;
      const inner = Object.values(n.sub.nodes || {});
      if (inner.length === 0) return state;
      const nodes = { ...state.nodes };
      delete nodes[nodeId];
      const remap = {};
      for (const m of inner) {
        let id = m.id;
        while (nodes[id]) id = `${id}X`; // avoid collisions with canvas ids
        remap[m.id] = id;
        nodes[id] = { ...m, id, x: n.x + m.x - 20 + 0, y: n.y + m.y - 20 + 34 };
      }
      const maxX = Math.max(...inner.map((m) => m.x)) + 260;
      const maxY = Math.max(...inner.map((m) => m.y)) + 140;
      const frames = { ...(state.frames || {}), [frameId]: { id: frameId, label: n.title, x: n.x, y: n.y, w: maxX, h: maxY + 34, color: n.color ?? null } };
      const innerEdges = (n.sub.edges || []).map((e) => ({ ...e, from: remap[e.from], to: remap[e.to] }));
      const edges = [...state.edges.filter((e) => e.from !== nodeId && e.to !== nodeId), ...innerEdges];
      return { ...state, nodes, edges, frames };
    }

    case 'REMOVE_EDGE': {
      return { ...state, edges: state.edges.filter((e) => !(e.from === action.from && e.to === action.to)) };
    }

    // ---- generic located-graph editing (surface task flow + nested subs) ----
    case 'GRAPH_ADD_NODE': {
      const { scope, node } = action;
      const g = locateGraph(state, scope);
      if (!node?.id || g.nodes[node.id]) return state;
      return writeGraph(state, scope, { nodes: { ...g.nodes, [node.id]: node }, edges: g.edges });
    }
    case 'GRAPH_UPDATE_NODE': {
      const { scope, id, patch } = action;
      const g = locateGraph(state, scope);
      if (!g.nodes[id]) return state;
      return writeGraph(state, scope, { nodes: { ...g.nodes, [id]: { ...g.nodes[id], ...patch } }, edges: g.edges });
    }
    case 'GRAPH_DELETE_NODE': {
      const { scope, id } = action;
      const g = locateGraph(state, scope);
      if (!g.nodes[id]) return state;
      const nodes = { ...g.nodes };
      delete nodes[id];
      const next = writeGraph(state, scope, { nodes, edges: g.edges.filter((e) => e.from !== id && e.to !== id) });
      // Deleting a top-level task also clears its Weaver alignments.
      if (scope.coll === 'taskNodes' && !scopePath(scope).length) {
        next.alignments = (next.alignments || []).filter((a) => a.task !== id);
      }
      return next;
    }
    case 'GRAPH_ADD_EDGE': {
      const { scope, from, to, label = '', color = null } = action;
      const g = locateGraph(state, scope);
      if (from === to || !g.nodes[from] || !g.nodes[to]) return state;
      if (g.edges.some((e) => e.from === from && e.to === to)) return state;
      return writeGraph(state, scope, { nodes: g.nodes, edges: [...g.edges, { from, to, label, color }] });
    }
    case 'GRAPH_UPDATE_EDGE': {
      const { scope, from, to, patch } = action;
      const g = locateGraph(state, scope);
      return writeGraph(state, scope, { nodes: g.nodes, edges: g.edges.map((e) => (e.from === from && e.to === to ? { ...e, ...patch } : e)) });
    }
    case 'GRAPH_REMOVE_EDGE': {
      const { scope, from, to } = action;
      const g = locateGraph(state, scope);
      return writeGraph(state, scope, { nodes: g.nodes, edges: g.edges.filter((e) => !(e.from === from && e.to === to)) });
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
