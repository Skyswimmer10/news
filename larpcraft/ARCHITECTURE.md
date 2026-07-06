# LARP Craft — Complete Application Description (AI Handoff Document)

> **Purpose of this file.** This is a self-contained briefing for an AI (or human)
> code builder who has never seen this project. Read it fully before editing.
> It describes what the app is, how it is architected, every data collection and
> node type, the reducer contract, the view map, the visual language, hard
> invariants you must not break, how to run/test/ship, and where to extend.
> When you change architecture, **update this file in the same commit.**

---

## 1. What the app is

**LARP Craft** is a design & live-management studio for **LARP** (live-action
role-play) and city-scale **ARG**-style games — real games played by real people
in real places, *not* video games. A designer uses it during the planning phase
to author the whole game: the story, the physical tasks, the props/sensors, the
locations, the teams, and the rules. It is **local-first** and runs entirely in
the browser with no backend.

The single most important design axiom, which shapes everything:

> **There is no runtime engine.** In a video game, code evaluates branch logic at
> play time. In a live game, a **Game Master**, a **physical prop/token**, or a
> **hardware sensor** decides. So this app is an *authoring* tool that produces a
> human-and-sensor-adjudicable plan. Everything is **pre-authored**: players only
> *select* among pre-planned paths; nothing is created or destroyed at run time.

A second axiom: **two data worlds.** A persistent **Library** of reusable
templates (master blueprints, survive across games) and an **Active Project**
(the one open game: instances copied from the library + all game-specific
authoring). Editing a library template never touches a game; editing a game
never touches the library. An **import bridge** copies templates into a game as
detached instances.

---

## 2. Tech stack & how to run

- **React 18** + **Vite 5**, plain JS (`.jsx`), no TypeScript, no CSS framework
  (single hand-written `src/styles.css` using CSS variables for theming).
- **State**: React Context + `useReducer`. **No Redux, no Zustand.** One pure
  reducer (`src/state/reducer.js`) drives both stores.
- **Persistence**: `idb-keyval` (IndexedDB) with a `localStorage` fallback so the
  single-file offline build persists too.
- **Tests**: `vitest` (unit, jsdom-free pure-function tests).
- The app lives in the **`larpcraft/`** subdirectory of the repo. All commands
  below run **from `larpcraft/`** (the repo root is a different, unrelated
  Node project — do not run `npm test` from the root).

```bash
cd larpcraft
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm test          # vitest, must stay green (currently 81 tests, 6 files)
```

There is **no lint/typecheck step**; keep code style consistent with what exists.

---

## 3. Directory map (every source file)

```
larpcraft/src/
  main.jsx                  App bootstrap (ReactDOM.createRoot on #root)
  App.jsx                   Shell: sidebar nav, view routing, hero backdrop
  styles.css                ALL styling (one file, CSS variables, dark+light aware)

  state/
    store.jsx               Two Context stores (Library + Active Project); load,
                            migrate, persist. Hooks: useGame/useDispatch/
                            useLibrary/useLibraryDispatch. newGame/resetDemoData.
    reducer.js              THE pure reducer + selectors (locateGraph, resolveNode…)
    storage.js              loadKey/saveKeyDebounced/clearKey (IDB + localStorage)
    bridge.js               Library→Project import (duplicate template→instance)
    *.test.js               reducer / bridge / graph / weaver unit tests

  data/
    seed.js                 ALL type registries + demo seed + migrations + blanks
    csvSchemas.js           Per-collection CSV import/export schemas + genId()
    *.test.js               narrativeV2 unit tests

  lib/
    csv.js                  CSV encode/decode helpers
    csv.test.js

  components/
    FlowCanvas.jsx          THE node-canvas engine (drag/connect/frames/subnodes)
    GraphEditor.jsx         Generic canvas bound to a located sub-graph (GRAPH_*)
    Inspector.jsx           THE right-hand details panel (all node/subnode panels)
    ImageUploader.jsx       Drag-drop image/SVG/3D-export upload → dataURL
    StructureThumb.jsx      Mini SVG thumbnail of a node graph (+ structNodeColor)
    bits.jsx                ENTITY_COLORS, PrimIcon (icon set), Pill, Chip, etc.
    ProjectMenu.jsx         File menu: New/Open/Save/Close game as JSON
    LocationStage.jsx       Indoor schematic / OSM map stage with markers+arrows
    CsvButtons.jsx          Import/export CSV for a collection
    TypeChips.jsx           Item-type filter chips
    LibraryBrowser.jsx      (legacy helper)

  views/                    One component per left-nav destination:
    ScenarioFlow.jsx        BUILD ▸ "Narrative Weaver"  (the main narrative canvas)
    TasksView.jsx           BUILD ▸ "Tasks"             (hierarchical task flow)
    Weaver.jsx              BUILD ▸ "Weaver"            (split story↔timeline)
    Locations.jsx           BUILD ▸ "Locations"
    ItemDatabase.jsx        BUILD ▸ "Items & Gadgets"   (gallery + spreadsheet)
    FactsView.jsx           MANAGE ▸ "Facts & State"
    Teams.jsx               MANAGE ▸ "Players & Teams"
    Library.jsx             LIBRARY (all template catalogues, incl. Concepts)
    GameMasterRules.jsx     Game Master Rules section
```

---

## 4. The two stores & persistence

`store.jsx` creates **two independent** Context+reducer pairs:

| Store | IndexedDB key | Hook (state / dispatch) | Contents |
|---|---|---|---|
| **Library** | `larpcraft:library` | `useLibrary` / `useLibraryDispatch` | Reusable master templates. `rev = LIB_REV` (currently **9**). |
| **Active Project** | `larpcraft:activeProject` | `useGame` / `useDispatch` | The open game. `rev = SEED_REV` (currently **7**). |

Both persist via `saveKeyDebounced` (400 ms debounce) whenever they change. On
boot, each is loaded and passed through its migration:

- `migrateLibrary(saved)` — **additive**: backfills any missing collections and
  runs one-time transforms; never discards user data. Bump `LIB_REV` when adding
  a library collection and add a backfill line.
- `migrateProject(saved)` — **additive**: backfills missing project collections
  (`facts`, `subnodes`, `frames`, `taskNodes`, `taskEdges`, …) onto older saves.
  Returns a fresh demo only for null/garbage. Bump `SEED_REV` when the project
  shape changes; **never** hard-reset an existing game on rev mismatch.

**Invariant:** migrations are additive. A user's authored game must survive a
schema bump. Both migrations key off `makeEmptyProject()` / `makeLibrarySeed()`
so simply adding a collection there + backfilling is the standard pattern.

`resetDemoData()` clears both keys and reseeds (`makeLibrarySeed`,
`makeProjectSeed`). `newGame()` swaps the project for `makeEmptyProject(name)`.
`ProjectMenu.jsx` does File ▸ New/Open/Save/Close as JSON (the durable,
unlimited, portable save path independent of browser storage).

---

## 5. The reducer contract (`state/reducer.js`)

**Every** mutation in the app flows through this **one pure reducer**, used by
**both** stores. There is exactly one copy of each entity, so an edit made in the
inspector is visible on the canvas on the next render. Never mutate state
outside the reducer; never keep a second source of truth.

### Generic entity actions (work on any top-level collection)
- `RESET {seed}` — replace whole state (used on load / newGame / reset).
- `ADD_ENTITY {coll, entity}` — insert (ignores duplicate id).
- `UPDATE_ENTITY {coll, id, patch}` — shallow-merge patch. **For `coll:'nodes'`
  and `coll:'subnodes'` it also appends a Change-History entry** (see §9).
- `DELETE_ENTITY {coll, id}`.
- `IMPORT_ENTITIES {coll, entities}` — bulk merge (CSV import).
- `SET_IMAGE {coll, id, image, field='image'}` — image upload target.
- `SET_META {patch}` / `RENAME_PROJECT {name}` — project meta.

### Item / sensor lifecycle (auto status flips)
- `ASSIGN_ITEM` → availability `in-use`; `UNASSIGN_ITEM` → `ready`;
  `DEPLOY_ITEM` → `deployed`; `ASSIGN_SENSOR`; `ADD_/REMOVE_SENSOR_REQ`.

### Top-level narrative graph (`nodes` + `edges`)
- `ADD_NODE {node}`, `DELETE_NODE {nodeId}` (cascade: removes touching edges &
  alignments, and **detaches** — never deletes — subnodes attached to it),
  `ADD_EDGE {from,to,label,color}` (endpoints may be **nodes OR subnodes**),
  `REMOVE_EDGE`, `UPDATE_EDGE {from,to,patch}`.

### Subnodes & frames (Narrative Weaver)
- `DELETE_SUBNODE {subnodeId}` — cascades to child subnodes, removes their edges.
- `FRAME_MOVE {frameId,dx,dy}` — moves the frame + everything whose top-left is
  inside it (recomputed by containment each step).
- `FRAME_TO_COMPOSITE {frameId,nodeId}` / `COMPOSITE_TO_FRAME {nodeId,frameId}`.

### Located graphs (hierarchical / nested editing) — **the key abstraction**
A **`scope`** addresses any editable `{nodes, edges}` graph in the project:
```
{ coll:'nodes' }                       → the narrative graph  (state.nodes/edges)
{ coll:'taskNodes' }                   → the surface Task flow (state.taskNodes/taskEdges)
{ coll, parentId }                     → that parent node's nested `.sub` graph
{ coll, parentPath:[id0,id1,…] }       → deeper nesting (≤ 3 levels)
```
`locateGraph(state, scope)` reads it; `writeGraph` rebuilds the parent chain
immutably. Actions: `GRAPH_ADD_NODE / GRAPH_UPDATE_NODE / GRAPH_DELETE_NODE /
GRAPH_ADD_EDGE / GRAPH_UPDATE_EDGE / GRAPH_REMOVE_EDGE`, each taking `{scope, …}`.
**Nested detail graphs live on `node.sub = { nodes, edges }`.** This one system
powers: Task detail graphs, Narrative-node detail graphs, and concept internals.

### Weaver alignment (story beat ↔ task)
- `SET_STORY_POS {nodeId,x,y}` (left-panel layout), `ADD_ALIGN/REMOVE_ALIGN
  {story, task}`.

### Selectors (exported)
`resolveNode(s, lib, id)` (cross-reference a node to its live item/location/
mechanic/sensor records), `locateGraph`, `itemList`, `itemsAssignedToTeam/Player`,
`sensorsAssignedToPlayer`, `availableItems`, `playersOfTeam`.

---

## 6. Active Project shape (collections)

`makeProjectSeed()` / `makeEmptyProject()` in `seed.js` define it:

```
{
  rev: SEED_REV,
  meta: { name, prefix, createdAt, hero:{image,opacity,placement}, timeline:{startMin,endMin} },
  items:{}, locations:{}, sensors:{}, mechanics:{},   // physical instances
  facts:{},                                           // real-world state registry
  nodes:{}, edges:[],                                 // Narrative Weaver graph
  subnodes:{}, frames:{},                             // Weaver enrichments + grouping
  taskNodes:{}, taskEdges:[],                         // Tasks flow (surface + .sub detail)
  alignments:[], storyTrack:{},                       // Weaver split-screen linkage
  teams:{}, players:{},
}
```

Instance ids are prefixed per game (`meta.prefix`, e.g. `CHM-…`); instances carry
`templateId` back-references and game-state fields (buildStatus, availability,
placement, battery, assignment). Library ids are `LIB-…`.

---

## 7. Library shape (template collections)

`makeLibrarySeed()`:
`mechanics, sensors, items, locations` (physical templates) · `narrative`
(story building blocks) · `mechPrimitives, mechStructures` (mechanic node tree) ·
`stories` (story-structure graphs) · `concepts` (Additional-Node templates) ·
`gmRules` · editable type systems `itemTypes, narrativeCategories`.

`LIB_PREFIX` and `LIB_BLANK` in `seed.js` supply the id prefix and the
"+ New …" blank factory for each. `bridge.js` exposes `importItem/importLocation/
importSensor/importMechanic/importStory/importNarrative/importMechPrimitive`
(each duplicates a template into the project with a fresh id, copies engineering
fields, adds game-state, and cascades required hardware), plus
`narrativeToStructNode/mechPrimitiveToStructNode` (palette-drop → structure node)
and `storyTrackToStructure` (save the Weaver track back to the library).

---

## 8. THE NARRATIVE WEAVER (the heart of the app)

Build ▸ **Narrative Weaver** (`views/ScenarioFlow.jsx`) is a node editor for the
**narrative layer only** — no mechanic logic lives here; nodes carry a *reference*
"Link to Mechanic Node" field into the (separate) mechanic layer. Three visually
distinct node classes (all registries in `seed.js`):

### 8a. Base Nodes — the independent story building blocks
`BASE_NODE_TYPES` / `BASE_KINDS`: **event, character, storyLocation, item, quest**.
Cool solid colours + icons. These are plain entries in `state.nodes` with
`kind ∈ BASE_KINDS`. Each can carry `teamId` (per-team lane), `sets` (facts it
records), `conceptId`+`conceptAnswers` (Event nodes applying a Story Concept),
`locationId`/`itemId` (bind to a real venue/prop record), `mechanicIds`, `sub`
(its own nested detail graph, opened by double-click), and `history`.

### 8b. Additional Nodes ("concepts") — Pip-Decks-style containers
`ADDITIONAL_NODE_TYPES`: **storyConcept, characterConcept, functionConcept,
structureConcept, styleConcept** (gold family). On the canvas they are
`state.nodes` entries with `kind:'concept'` + `conceptKind` (which of the five) +
optional `conceptId` (source library template) + `collapsed` (default `true`) +
`sub` (internal graph). Two actions on the card: **Expand** (renders a live
read-only mini-map of `.sub` inside the container via `StructureThumb`) and
**Edit** (opens a dedicated viewport = `ScenarioFlow` drill-in over
`scope:{coll:'nodes', parentPath:[…]}`, **nesting up to 3 levels**). "Create
new…" concepts start empty; a game concept can be **saved to the Library** as a
reusable template (adds to `lib.concepts`).

### 8c. Subnodes — precision enrichments (`state.subnodes`)
`SUBNODE_TYPES` (rose family, smaller pill cards). Each subnode is its own entity
with a common shell `{id, kind, title, x, y, parentRef, notes, keywords,
history}` + kind-specific fields (`SUBNODE_BLANK(id, kind)` builds them). They
**float unattached** on the canvas until linked. `parentRef` is:
- `null` — floating;
- `{nodeId}` — attached to a node;
- `{subnodeId}` — child of another subnode;
- `{subnodeId, branchIndex}` — attached to one branch of an Outcome Branches subnode.

The six subnode kinds:
1. **outcomeBranches** (attaches to event/quest) — the branching engine. Fields:
   `mode` (choice|performance|mixed), `selectionType` (single|multi), `branches[]`
   (2–5) each `{label, outcome, mechanicId}`. Branches **merge into later nodes
   via ordinary canvas edges** (an edge may start on the subnode). Story/flavor
   text belongs on the parent event, not here.
2. **relChange** (attaches to any node) — Relationship/Status Change. Fields:
   `relType, targets, direction` (**graduated outcomes** `GRADUATED_OUTCOMES`:
   yes-and/yes/yes-but/no-but/no/no-and), `intensity, trigger, effects,
   mechanicId`. Supports child subnodes.
3. **internalState** (any node) — `stateType, level, trigger, effects, mechanicId`.
4. **locationArchetype** (storyLocation **only**) — `archetype`
   (`LOCATION_ARCHETYPES`), `influence`.
5. **narrativeResponse** (child of relChange/internalState/**branch**) — rich
   `text`.
6. **emotionalTone** (child of relChange/internalState/**branch**) — `tags[]`.

Attachment is drawn as a **dashed line** with a one-click **⊘ detach** at the
midpoint (`attachments` + `onDetach` props of FlowCanvas). Deleting a parent node
detaches its subnodes (never destroys); deleting a subnode cascades to its
children.

### 8d. Frames — purely visual grouping (`state.frames`)
`{id,label,x,y,w,h,color}`. Dragging the header moves the frame and everything
inside; a grip resizes; nested frames travel together; **connections and data are
unaffected**. Convert **Frame ⇄ Composite** (a `kind:'concept'` node) both ways.
> **CSS gotcha:** the app shell root is `<div className="frame">`. Canvas frames
> therefore use class **`.gframe`** (never `.frame`). Do not reintroduce a
> `.frame` rule for the canvas.

### 8e. The canvas merges nodes + subnodes
`ScenarioFlow` builds one `merged` map (`{...nodes}` plus each subnode tagged
`_sub:true` with a one-line summary body) and passes it to `FlowCanvas`. On
select, it routes `{kind:'node'|'subnode', id}`. `nodeClass(n)` returns
`'subnode'` / `'concept'` for styling. There is a **search box** (highlight via
`dimNode`) and per-team **lane** filter.

---

## 9. THE INSPECTOR (`components/Inspector.jsx`) — fixed section order

The right panel renders a panel per selection `kind`. **Every node and subnode
panel uses one fixed top-to-bottom section order** (progressive disclosure via the
collapsible `ISection` component):

```
Core Identity (open) → Main Content → Composition (attached subnodes) →
Type-specific → Relationships / Links → Notes & Keywords → Change History (collapsed)
```

- **Change History** is auto-logged: `UPDATE_ENTITY` on `nodes`/`subnodes`
  appends `{t, fields}` (capped 20, skips pure x/y/history/sub/collapsed writes).
- **Subnodes open in their OWN marked panel** (`.subpanelbadge`) with a parent
  breadcrumb — they do not replace the parent's data, and clicking a child chip
  navigates to it.
- **"Link to Mechanic Node"** appears on base nodes, each outcome branch, and the
  functional subnodes — reference only.

Selection `kind` → panel routing (all handled in the `Inspector` dispatcher):
`item, location, player, fact, subnode, frame, graphnode, node` (project) and
`lib-items, lib-locations, lib-mechanics, lib-sensors, lib-stories, lib-concepts,
lib-mechPrimitives, lib-narrative, lib-structnode` (library). For `kind:'node'`
it further dispatches: `concept` → `ConceptPanel`, base kinds → `BaseNodePanel`,
legacy narrative kinds → `NodePanel`, else the linked item/location panel.
`graphnode` (nodes inside a located sub-graph) carries `{scope, id}` and edits via
`GRAPH_UPDATE_NODE`.

---

## 10. Facts & State (`FactsView.jsx`) — the "variables" of a live game

`state.facts` (`FACT_KINDS`: knowledge/physical/sensor/npc/progress) is the
live-game replacement for coded variables. A fact is a **real-world state a GM or
a bound sensor can check**. It has **no runtime value** — it is an authoring
vocabulary: nodes *record* facts (`node.sets = [{factId, to:'set'|'unset'}]`) and
**edges gate on them** (`edge.factId` + `edge.expect`), rendered as a coloured dot
on the connection. Sensor-kind facts bind to a `sensorId`. Managed under
**Manage ▸ Facts & State**. (A live run-mode that gives facts a current value is a
recommended future feature, not built.)

---

## 11. Tasks (`TasksView.jsx`) — hierarchical physical-task flow

Build ▸ **Tasks**. Surface graph = `taskNodes`/`taskEdges` (single `kind:'task'`,
connect linearly or branch). **Double-click a task → its nested detail graph**
(`node.sub`, scope `{coll:'taskNodes', parentId}`) built from `TASK_DETAIL_TYPES`:
placement/rule/prop/power/effect. Two-level nesting. Uses the shared
`GraphEditor` for both levels. (This replaced an earlier per-game "Mechanics
micro-adjustment" page, which was removed.)

---

## 12. Weaver (`Weaver.jsx`) — split-screen story↔time

Left = the macro **story track** (an editable `FlowCanvas` of the narrative
nodes, positioned by `storyTrack`); right = the **mechanical timeline** (the
`taskNodes` scheduled on a real clock via `startMin`/`durationMin`, drag a bar to
reschedule → `GRAPH_UPDATE_NODE` on `taskNodes`). Click a story beat then a task
to **align** them (`alignments`); curves cross the divider. "Save as Template"
writes the track to `lib.stories`.

---

## 13. FlowCanvas & GraphEditor — the shared engines

- **`FlowCanvas.jsx`** is the ONE node-canvas engine, reused by every graph view.
  Pointer-drag to move, port-drag to connect, click an edge label to edit it, ×
  to disconnect, swatch to recolour, Delete key, Ctrl+C/V paste, palette
  drag-drop. Optional presentation props keep it generic: `iconOf, teamOf,
  dimNode, edgeFact, nodeClass, onOpenNode` (double-click drill-in), `attachments
  + onDetach` (subnode lines), `frames + onFrameMove/Resize/Select`. `KIND_LABEL`
  and `ENTITY_COLORS` (in `bits.jsx`) map every kind → label/colour; `PrimIcon`
  is the icon set. **When you add a node kind, add it to `ENTITY_COLORS`,
  `KIND_LABEL`, and the relevant `*_TYPES` registry.**
- **`GraphEditor.jsx`** wraps `FlowCanvas` for a **located sub-graph** (any
  `scope`), wiring all edits to `GRAPH_*` actions with a typed palette. Use it for
  any new nested-graph surface.

---

## 14. Visual language & theming

`styles.css` is the only stylesheet; it uses CSS custom properties and is
light/dark aware. Colour families: **Base nodes** = cool solids (blue/amber/
green/teal/purple), **concepts** = gold, **subnodes** = rose/magenta,
**tasks** = teal, **facts** = per-kind. Canvas philosophy is **calm**: icons +
short titles + status badges on the canvas; everything else lives in the
inspector. Keep new UI consistent with existing class patterns (`.node`, `.isect`,
`.chip`, `.btn`, `.card`, `.gframe`, `.factchip`, …).

---

## 15. HARD INVARIANTS (do not break these)

1. **One reducer, one source of truth.** All mutations via `reducer.js`; no
   duplicated/derived state stores.
2. **Two worlds stay separate.** Library edits never mutate a game and vice
   versa; crossing them only happens through `bridge.js` import.
3. **Migrations are additive.** Adding a collection = add it to
   `makeEmptyProject`/`makeLibrarySeed` + backfill in `migrateProject`/
   `migrateLibrary`; bump the matching REV. Never reset a user's game on mismatch.
4. **Pre-authored only.** No feature may create/destroy nodes at "play" time; the
   app authors plans, it does not run them.
5. **Narrative layer ≠ mechanic layer.** Narrative entities may only *reference*
   mechanics (`mechanicId`), never embed mechanic logic.
6. **Graduated outcomes, never binary.** Any success/failure modelling uses
   `GRAPH...`→ the `GRADUATED_OUTCOMES` scale, and quests avoid hard dead-ends
   (author a recovery/fail-forward path).
7. **Fixed inspector section order** for every node & subnode (§9).
8. **The canvas frame class is `.gframe`**, never `.frame` (shell collision).
9. **Subnodes float until linked; deleting a parent detaches, never destroys**
   its subnodes.
10. **Nesting depth is capped at 3** for concept/detail drill-in.
11. Keep `npm test` green and add tests for new reducer actions / seed shape.
12. Run all app commands from `larpcraft/`, not the repo root.

---

## 16. Type registries (single source, in `seed.js`)

`BASE_NODE_TYPES`/`BASE_KINDS` · `ADDITIONAL_NODE_TYPES` · `SUBNODE_TYPES`/
`SUBNODE_BLANK` · `GRADUATED_OUTCOMES` · `LOCATION_ARCHETYPES` ·
`DRAGON_QUESTIONS`/`HERO_GUIDE_QUESTIONS` · `FACT_KINDS`/`FACT_BLANK` ·
`TASK_DETAIL_TYPES`/`TASK_DETAIL_KINDS` · `NARR_NODE_TYPES`/`NARRATIVE_KINDS`
(legacy typed narrative nodes kept for older saves) · `DEFAULT_ITEM_TYPES` ·
`DEFAULT_NARRATIVE_CATEGORIES` · `GM_RULE_TABS` · `LIB_PREFIX`/`LIB_BLANK`.
**Add new kinds here first**, then thread them through `ENTITY_COLORS`,
`KIND_LABEL`, the CSV `NODE_KINDS` enum (`csvSchemas.js`), and the inspector.

---

## 17. Current demo content (Operation Chimera)

The seed ships a playable demo: an infiltration game with base nodes (Briefing
event, warehouse story-location, retrieve-key quest, patrols character, decrypt
quest, gate/twist/extraction events), a **Dragon & the City** concept instance,
five facts, six subnodes (incl. a floating Internal State and an Outcome Branches
whose branches merge forward), one frame, a four-task flow with nested detail
(the "ball-in-the-net" style extraction task), teams/players, and Weaver
alignments. Use it as the reference for expected data shapes.

---

## 18. Where to extend next (recommended, not yet built)

1. **Live Ops / run mode** — give facts a *current* value; a GM console that
   flips them and lights up which branches/paths open. The data model already
   supports it (facts + gated edges).
2. **True in-place editing inside an Expanded concept** (currently Expand shows a
   read-only mini-map; Edit is the editable viewport).
3. **Timeline auto-layout** for the narrative canvas.
4. **Validation pass** surfaced as badges: orphan subnodes, branches with no
   outcome text, facts never set or never gated, quests with a hard dead-end.
5. **Concept role-binding** (Hero→team, Guide→NPC record) tying concepts into
   Teams data.
6. **Electron packaging** (the storage seam in `storage.js` is designed for it).

---

*Keep this document in sync with the code. If a future change contradicts a
statement here, fix the statement in the same commit.*
