# LARP Craft — functional prototype

Live-action game builder & management tool. React + Vite, single global store.

```bash
cd larpcraft
npm install
npm run dev      # http://localhost:5173
npm test         # reducer/selector tests (vitest)
npm run build    # static build in dist/
```

## Architecture

- **Two distinct stores** (`src/state/store.jsx`), each its own context pair and
  IndexedDB slot:
  - **Library** — the persistent master database: item / location / sensor
    *templates*, rules & mechanics, story structures. Ids are `LIB-*`. Editing a
    template updates the blueprint for future games only.
  - **Active Project** — the currently open game: *instances* imported from the
    Library (with `templateId` back-references and game state: build status,
    availability, placement, assignment, sensor battery), plus the quest node
    graph, teams and players. Ids are `<prefix>-*` (e.g. `CHM-ITM-001`).
- **Project lifecycle** (`ProjectMenu.jsx`): File → New / Open / Save / Rename /
  Close game. Save serializes the ActiveProjectState to JSON; Open loads it back.
  New Game empties Build & Manage while the Library stays fully populated.
- **Import bridge** (`src/state/bridge.js`): "Import to Active Game" on any
  Library detail panel, or "Browse Library" inside Build views. Importing
  duplicates the master record under a fresh instance id and cascades required
  sensor hardware (reusing an existing instance of the same template if the game
  already has one). Story structures spawn chained nodes on the flow canvas.
- Within each store: React Context + `useReducer`; every entity exists exactly
  once, so an edit anywhere shows up everywhere on the next render.
- **Pure reducer** (`src/state/reducer.js`): all transitions are plain functions,
  covered by `reducer.test.js`. Key rules:
  - `ASSIGN_ITEM` (Teams screen "issue" dropdown) → item `availability: 'in-use'`
  - `UNASSIGN_ITEM` → back to `'ready'`
  - `DEPLOY_ITEM` (placement select in the inspector) → `'deployed'`
  - `ASSIGN_SENSOR` issues hardware (NFC reader, button box…) to a player role
- **Cross-referencing** (`resolveNode` selector): clicking a node like
  *Retrieve Cipher-Key* on the Scenario Flow canvas resolves its `itemId` /
  `locationId` / `mechanicIds` / `sensorIds` against the store, and the shared
  right-hand inspector renders the live, editable record.
- **ImageUploader** (`src/components/ImageUploader.jsx`): drag-and-drop or click
  to browse in the item/location details panel. Photos and SVGs are stored as
  data URLs and immediately become the entity's primary thumbnail (gallery card /
  location reference image); 3D exports (`.glb .gltf .obj .fbx .stl`) are accepted
  and shown as a model badge (inline 3D preview is a later feature).

## Persistence — the storage decision

**Now (this prototype): local-first IndexedDB.** The full project state, including
image data URLs, is saved to IndexedDB (`idb-keyval`) ~400 ms after every change and
restored on load. No server, works offline, survives restarts. `storage.js` is the
single seam where persistence is implemented.

**Next (desktop app): JSON project file + assets folder via Electron.** Swap
`storage.js` for `fs`-based saves: one human-readable `project.json` plus an
`assets/` folder for original image files (store file paths, not data URLs).
Git-friendly, trivially backed up, easy to hand a project to another GM.

**Later, only if needed:**
- **SQLite** when a project outgrows one JSON file (thousands of items, full-text
  search, game-history queries).
- **Cloud sync (Supabase/Firebase)** only when two things demand it: multiple
  organizers editing one project simultaneously, and Live Ops streaming sensor
  events to phones in the field. Local-first remains the source of truth.
