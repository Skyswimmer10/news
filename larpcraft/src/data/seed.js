// Two separate stores:
//
//  LIBRARY (master database, persists across games)
//    - templates for items, locations, sensors; rules & mechanics; story structures
//    - ids are LIB-*  · editing a template updates the blueprint for FUTURE games
//
//  ACTIVE PROJECT (the currently open game)
//    - instances of items/locations/sensors copied from the Library, plus the
//      quest node graph, teams and players
//    - ids are <prefix>-* (e.g. CHM-…)  · instances carry templateId and add
//      game-state fields (build status, availability, placement, assignment,
//      sensor battery) · edits affect only this game

export const LIB_REV = 1;
export const SEED_REV = 4;

export function makeLibrarySeed() {
  return {
    rev: LIB_REV,

    mechanics: {
      'LIB-MECH-LOCK': { id: 'LIB-MECH-LOCK', name: 'Lockpicking minigame', summary: 'Physical pick set on a practice lock; 3 fails raise the alarm.' },
      'LIB-MECH-DECRYPT': { id: 'LIB-MECH-DECRYPT', name: 'Decryption puzzle', summary: 'Button-box cipher wheel; hint unlocks after 3 failed tries.' },
      'LIB-MECH-COMMS': { id: 'LIB-MECH-COMMS', name: 'Comms link', summary: 'Radio protocol between team units and GM console.' },
      'LIB-MECH-ACCESS': { id: 'LIB-MECH-ACCESS', name: 'Access control', summary: 'Key card gates between zones.' },
      'LIB-MECH-REVIVE': { id: 'LIB-MECH-REVIVE', name: 'Downed-player revive', summary: 'Medkit card ritual, 90 seconds at a safe zone.' },
      'LIB-MECH-UV': { id: 'LIB-MECH-UV', name: 'Hidden-ink clues', summary: 'UV-reactive markings on props and walls.' },
    },

    // Hardware templates: base construction only. Battery, placement and
    // assignment live on the game instance.
    sensors: {
      'LIB-SEN-NFC': { id: 'LIB-SEN-NFC', kind: 'NFC reader', label: 'NFC reader (ESP32 dock)' },
      'LIB-SEN-BTN': { id: 'LIB-SEN-BTN', kind: 'Button box', label: '4-button cipher box' },
      'LIB-SEN-MOT': { id: 'LIB-SEN-MOT', kind: 'Motion sensor', label: 'PIR motion node' },
      'LIB-SEN-PRX': { id: 'LIB-SEN-PRX', kind: 'Proximity sensor', label: 'Gate proximity loop' },
      'LIB-SEN-RF': { id: 'LIB-SEN-RF', kind: 'RF beacon', label: 'LoRa beacon RX' },
    },

    items: {
      'LIB-ITM-001': { id: 'LIB-ITM-001', name: 'Cipher-Key', type: 'artifact', description: 'An ancient-looking brass key used for unlocking a sealed room.', propNotes: 'Heavy brass key, detailed engravings. Cast a spare per game.', loreNotes: 'Rumored to be made from meteoritic iron.', mechanicIds: ['LIB-MECH-LOCK'], sensorReqs: [{ sensorId: 'LIB-SEN-NFC', note: 'confirms pickup' }], image: null },
      'LIB-ITM-002': { id: 'LIB-ITM-002', name: 'Encrypted Dataslate', type: 'artifact', description: 'A weathered military dataslate containing corrupted data. Needs to be decoded.', propNotes: 'Plastic + metal case, low-res OLED, four buttons, 2×AA.', loreNotes: 'Recovered from a crash site.', mechanicIds: ['LIB-MECH-DECRYPT', 'LIB-MECH-COMMS'], sensorReqs: [{ sensorId: 'LIB-SEN-NFC', note: 'dock detects slate' }, { sensorId: 'LIB-SEN-BTN', note: 'cipher input' }], image: null },
      'LIB-ITM-003': { id: 'LIB-ITM-003', name: 'Serum Vial', type: 'gadget', description: 'A glowing vial required for the antidote ritual.', propNotes: 'Glow vial, UV-reactive fluid.', loreNotes: '', mechanicIds: ['LIB-MECH-REVIVE'], sensorReqs: [], image: null },
      'LIB-ITM-004': { id: 'LIB-ITM-004', name: 'Old-school Key Card', type: 'artifact', description: 'An embossed magstripe card that opens sector gates.', propNotes: 'Embossed magstripe card, weathered edges.', loreNotes: '', mechanicIds: ['LIB-MECH-ACCESS'], sensorReqs: [{ sensorId: 'LIB-SEN-PRX', note: 'gate unlock check' }], image: null },
      'LIB-ITM-005': { id: 'LIB-ITM-005', name: 'Comms Unit', type: 'gadget', description: 'Team radio tuned to the operation frequency.', propNotes: 'Repainted walkie, weathered.', loreNotes: '', mechanicIds: ['LIB-MECH-COMMS'], sensorReqs: [], image: null },
      'LIB-ITM-006': { id: 'LIB-ITM-006', name: 'Signal Beacon', type: 'gadget', description: 'Extraction call-in beacon for finales.', propNotes: '3D-printed shell, ESP32 + LED ring.', loreNotes: '', mechanicIds: [], sensorReqs: [{ sensorId: 'LIB-SEN-RF', note: 'GM console receiver' }], image: null },
      'LIB-ITM-007': { id: 'LIB-ITM-007', name: 'UV Torch', type: 'gadget', description: 'Reveals hidden ink markings.', propNotes: 'Consumer UV flashlight.', loreNotes: '', mechanicIds: ['LIB-MECH-UV'], sensorReqs: [], image: null },
      'LIB-ITM-008': { id: 'LIB-ITM-008', name: 'Medkit Prop', type: 'consumable', description: 'Revive kit: bandage cards + ritual instructions.', propNotes: 'Surplus pouch, 12 bandage cards.', loreNotes: '', mechanicIds: ['LIB-MECH-REVIVE'], sensorReqs: [], image: null },
    },

    locations: {
      'LIB-LOC-001': { id: 'LIB-LOC-001', name: 'Warehouse hall', notes: 'Large indoor space, patrol routes, locker corridor.', safety: 'Mark fire exits; no running on mezzanines.', image: null },
      'LIB-LOC-002': { id: 'LIB-LOC-002', name: 'Gated checkpoint', notes: 'Lockable gate between zones; good act boundary.', safety: 'Crew operates the gate, never players.', image: null },
      'LIB-LOC-003': { id: 'LIB-LOC-003', name: 'Puzzle bench', notes: 'Table station for decryption / crafting mechanics.', safety: 'Tape down cable runs.', image: null },
      'LIB-LOC-004': { id: 'LIB-LOC-004', name: 'Safe zone / med bay', notes: 'Out-of-game rest area + revive station.', safety: 'Always out-of-game; real first aid kit here.', image: null },
    },

    // Story structures: reusable quest skeletons. Importing one spawns a
    // chained set of nodes on the active project's flow canvas.
    stories: {
      'LIB-STORY-HEIST': {
        id: 'LIB-STORY-HEIST', name: 'Three-act heist',
        summary: 'Brief → infiltrate → steal the MacGuffin → security responds → extract.',
        beats: [
          { kind: 'story', title: 'Briefing' },
          { kind: 'location', title: 'Infiltration site' },
          { kind: 'objective', title: 'Steal the MacGuffin' },
          { kind: 'enemy', title: 'Security response' },
          { kind: 'story', title: 'Extraction finale' },
        ],
      },
      'LIB-STORY-INVEST': {
        id: 'LIB-STORY-INVEST', name: 'Investigation loop',
        summary: 'Clue chain: each solved mechanic reveals the next site.',
        beats: [
          { kind: 'story', title: 'Cold open' },
          { kind: 'mechanic', title: 'First clue puzzle' },
          { kind: 'location', title: 'Revealed site' },
          { kind: 'objective', title: 'Confront the suspect' },
        ],
      },
    },
  };
}

export function makeEmptyProject(name = 'Untitled game') {
  return {
    rev: SEED_REV,
    meta: { name, prefix: 'GAME', createdAt: Date.now() },
    items: {}, locations: {}, sensors: {}, nodes: {}, edges: [], teams: {}, players: {},
  };
}

// Demo game: Operation Chimera, built from the library templates above.
export function makeProjectSeed() {
  return {
    rev: SEED_REV,
    meta: { name: 'Operation Chimera', prefix: 'CHM', createdAt: Date.now() },

    // Sensor hardware INSTANCES: template + game state (status, placement,
    // assignment, battery).
    sensors: {
      'RFID-07': { id: 'RFID-07', templateId: 'LIB-SEN-NFC', kind: 'NFC reader', label: 'Locker 12 reader', status: 'online', locationId: 'LOC-S7', assignedTo: null, battery: 92 },
      'NFC-03': { id: 'NFC-03', templateId: 'LIB-SEN-NFC', kind: 'NFC reader', label: 'Dataslate dock', status: 'online', locationId: 'LOC-S7', assignedTo: null, battery: 88 },
      'BTN-11': { id: 'BTN-11', templateId: 'LIB-SEN-BTN', kind: 'Button box', label: 'Cipher button box', status: 'offline', locationId: 'LOC-COMMS', assignedTo: null, battery: 15 },
      'MOT-04': { id: 'MOT-04', templateId: 'LIB-SEN-MOT', kind: 'Motion sensor', label: 'North door motion', status: 'offline', locationId: 'LOC-S7', assignedTo: null, battery: 0 },
      'PRX-02': { id: 'PRX-02', templateId: 'LIB-SEN-PRX', kind: 'Proximity sensor', label: 'Gate proximity', status: 'online', locationId: 'LOC-S8', assignedTo: null, battery: 76 },
      'RF-01': { id: 'RF-01', templateId: 'LIB-SEN-RF', kind: 'RF beacon', label: 'Extraction beacon RX', status: 'unplaced', locationId: null, assignedTo: null, battery: 100 },
    },

    locations: {
      'LOC-S7': { id: 'LOC-S7', templateId: 'LIB-LOC-001', name: 'Sector 7 Warehouse', zone: 'Act 1', notes: 'Main quest area. Two patrol routes, locker corridor, marked safety zone.', safety: 'Fire exits east + west. No running on the mezzanine.', image: null, sensorIds: ['RFID-07', 'NFC-03', 'MOT-04'] },
      'LOC-S8': { id: 'LOC-S8', templateId: 'LIB-LOC-002', name: 'Sector 8 Gate', zone: 'Act 2', notes: 'Locked until quest flag key_obtained.', safety: 'Gate is heavy — crew operates it, never players.', image: null, sensorIds: ['PRX-02'] },
      'LOC-COMMS': { id: 'LOC-COMMS', templateId: 'LIB-LOC-003', name: 'Comms Bench', zone: 'Act 2', notes: 'Decryption puzzle station with cipher button box.', safety: 'Cable run taped down; check before game.', image: null, sensorIds: ['BTN-11'] },
      'LOC-MED': { id: 'LOC-MED', templateId: 'LIB-LOC-004', name: 'Med Bay (safe zone)', zone: 'All acts', notes: 'Out-of-game rest area + revive mechanic station.', safety: 'Always out-of-game. Real first aid kit lives here.', image: null, sensorIds: [] },
    },

    // Item INSTANCES: template fields copied at import time + game state.
    items: {
      'CHM-A-004': { id: 'CHM-A-004', templateId: 'LIB-ITM-001', name: 'Cipher-Key', type: 'artifact', buildStatus: 'tested', availability: 'ready', description: 'An ancient-looking brass key used for unlocking the central server room.', propNotes: 'Heavy brass key, detailed engravings. Spare taped inside GM binder p.12.', loreNotes: 'Rumored to be made from meteoritic iron.', locationId: 'LOC-S7', mechanicIds: ['LIB-MECH-LOCK'], sensorReqs: [{ sensorId: 'RFID-07', note: 'confirms pickup, fires key_obtained' }], image: null, assignedTo: null },
      'CHM-A-007': { id: 'CHM-A-007', templateId: 'LIB-ITM-002', name: 'Encrypted Dataslate', type: 'artifact', buildStatus: 'build', availability: 'ready', description: 'A weathered military dataslate containing corrupted operational data. Needs to be decoded.', propNotes: 'Custom plastic + metal case, low-res OLED, four buttons. Battery 2×AA — swap before game.', loreNotes: "Recovered from a crash site; rumored to hold the 'Operation Chimera' flight path.", locationId: 'LOC-S7', mechanicIds: ['LIB-MECH-DECRYPT', 'LIB-MECH-COMMS'], sensorReqs: [{ sensorId: 'NFC-03', note: 'dock detects slate placement' }, { sensorId: 'BTN-11', note: 'cipher input during decryption' }], image: null, assignedTo: null },
      'CHM-G-012': { id: 'CHM-G-012', templateId: 'LIB-ITM-003', name: 'Serum Vial', type: 'gadget', buildStatus: 'packed', availability: 'ready', description: 'A glowing vial required for the antidote ritual.', propNotes: 'Glow vial, UV-reactive fluid. 3 spares in the med crate.', loreNotes: '', locationId: 'LOC-MED', mechanicIds: ['LIB-MECH-REVIVE'], sensorReqs: [], image: null, assignedTo: null },
      'CHM-A-002': { id: 'CHM-A-002', templateId: 'LIB-ITM-004', name: 'Old-school Key Card', type: 'artifact', buildStatus: 'packed', availability: 'ready', description: 'An embossed magstripe card that opens sector gates.', propNotes: 'Embossed magstripe card, weathered edges.', loreNotes: '', locationId: 'LOC-S8', mechanicIds: ['LIB-MECH-ACCESS'], sensorReqs: [{ sensorId: 'PRX-02', note: 'gate unlock check' }], image: null, assignedTo: null },
      'CHM-G-005': { id: 'CHM-G-005', templateId: 'LIB-ITM-005', name: 'Comms Unit A', type: 'gadget', buildStatus: 'tested', availability: 'missing', description: 'Team radio tuned to the operation frequency.', propNotes: 'Repainted walkie, weathered. LAST SEEN: prop crate 2.', loreNotes: '', locationId: null, mechanicIds: ['LIB-MECH-COMMS'], sensorReqs: [], image: null, assignedTo: null },
      'CHM-G-018': { id: 'CHM-G-018', templateId: 'LIB-ITM-006', name: 'Signal Beacon', type: 'gadget', buildStatus: 'build', availability: 'ready', description: 'Extraction call-in beacon for the finale.', propNotes: '3D-printed shell, ESP32 + LED ring. Needs field test.', loreNotes: '', locationId: 'LOC-S8', mechanicIds: [], sensorReqs: [{ sensorId: 'RF-01', note: 'GM console receiver' }], image: null, assignedTo: null },
      'CHM-G-001': { id: 'CHM-G-001', templateId: 'LIB-ITM-007', name: 'UV Torch', type: 'gadget', buildStatus: 'packed', availability: 'ready', description: 'Reveals hidden ink markings.', propNotes: 'Consumer UV flashlight ×4, batteries fresh.', loreNotes: '', locationId: null, mechanicIds: ['LIB-MECH-UV'], sensorReqs: [], image: null, assignedTo: null },
      'CHM-C-009': { id: 'CHM-C-009', templateId: 'LIB-ITM-008', name: 'Medkit Prop', type: 'consumable', buildStatus: 'packed', availability: 'ready', description: 'Revive kit: bandage cards + ritual instructions.', propNotes: 'Surplus pouch, 12 bandage cards.', loreNotes: '', locationId: 'LOC-MED', mechanicIds: ['LIB-MECH-REVIVE'], sensorReqs: [], image: null, assignedTo: null },
    },

    nodes: {
      'N-BRIEF': { id: 'N-BRIEF', kind: 'story', title: 'Briefing', x: 40, y: 90, body: 'Teams receive the crash-site dossier and a sealed radio frequency.', color: null, locationId: null, itemId: null, mechanicIds: [], sensorIds: [] },
      'N-S7': { id: 'N-S7', kind: 'location', title: 'Sector 7 Warehouse', x: 380, y: 40, body: '2 patrols · marked safety zone', color: null, locationId: 'LOC-S7', itemId: null, mechanicIds: [], sensorIds: ['RFID-07', 'MOT-04'] },
      'N-KEY': { id: 'N-KEY', kind: 'objective', title: 'Retrieve Cipher-Key', x: 380, y: 300, body: 'Success unlocks Sector 8.', color: null, locationId: 'LOC-S7', itemId: 'CHM-A-004', mechanicIds: ['LIB-MECH-LOCK'], sensorIds: ['RFID-07'] },
      'N-PATROL': { id: 'N-PATROL', kind: 'enemy', title: 'Security Patrols', x: 720, y: 40, body: 'NPC crew: Mank +1 · Tier 2 · 7 min loop', color: null, locationId: 'LOC-S7', itemId: null, mechanicIds: [], sensorIds: [] },
      'N-DECRYPT': { id: 'N-DECRYPT', kind: 'mechanic', title: 'Decrypt the Dataslate', x: 720, y: 300, body: 'Fail ×3 → alarm reroutes patrols.', color: null, locationId: 'LOC-COMMS', itemId: 'CHM-A-007', mechanicIds: ['LIB-MECH-DECRYPT'], sensorIds: ['BTN-11', 'NFC-03'] },
      'N-GATE': { id: 'N-GATE', kind: 'sensor', title: 'Sector 8 gate opens', x: 1060, y: 170, body: 'Fires quest.key_obtained to Live Ops.', color: null, locationId: 'LOC-S8', itemId: 'CHM-A-002', mechanicIds: ['LIB-MECH-ACCESS'], sensorIds: ['PRX-02'] },
    },
    edges: [
      { from: 'N-BRIEF', to: 'N-S7', label: 'game start', kindColor: 'story' },
      { from: 'N-S7', to: 'N-KEY', label: 'locker corridor', kindColor: 'location' },
      { from: 'N-S7', to: 'N-PATROL', label: 'ON alarm raised', kindColor: 'enemy' },
      { from: 'N-KEY', to: 'N-DECRYPT', label: 'IF key obtained', kindColor: 'objective' },
      { from: 'N-KEY', to: 'N-GATE', label: 'THEN unlock Sector 8', kindColor: 'sensor' },
      { from: 'N-DECRYPT', to: 'N-GATE', label: 'REQUIRES decode', kindColor: 'mechanic' },
    ],

    teams: {
      'T-RAVEN': { id: 'T-RAVEN', name: 'Team Raven', color: '#5CA8F5', focus: 'Infiltration specialists · returning crew' },
      'T-WOLF': { id: 'T-WOLF', name: 'Team Wolfpack', color: '#E0A23C', focus: 'Puzzle-heavy playstyle · mixed experience' },
      'T-CINDER': { id: 'T-CINDER', name: 'Team Cinder', color: '#A87BF0', focus: 'First-timers · assign shepherd NPC' },
    },
    players: {
      'P-ELZA': { id: 'P-ELZA', name: 'Elza K.', initials: 'EK', role: 'Leader', teamId: 'T-RAVEN', flags: ['MED'] },
      'P-JANIS': { id: 'P-JANIS', name: 'Janis B.', initials: 'JB', role: 'Engineer', teamId: 'T-RAVEN', flags: [] },
      'P-LIENE': { id: 'P-LIENE', name: 'Liene S.', initials: 'LS', role: 'Medic', teamId: 'T-RAVEN', flags: [] },
      'P-ANNA': { id: 'P-ANNA', name: 'Anna V.', initials: 'AV', role: 'Leader', teamId: 'T-WOLF', flags: [] },
      'P-RIH': { id: 'P-RIH', name: 'Rihards D.', initials: 'RD', role: 'Decoder', teamId: 'T-WOLF', flags: [] },
      'P-KATE': { id: 'P-KATE', name: 'Kate P.', initials: 'KP', role: 'Medic', teamId: 'T-WOLF', flags: ['MED'] },
      'P-DAVIS': { id: 'P-DAVIS', name: 'Davis K.', initials: 'DK', role: 'Leader', teamId: 'T-CINDER', flags: [] },
      'P-SANITA': { id: 'P-SANITA', name: 'Sanita N.', initials: 'SN', role: 'Decoder', teamId: 'T-CINDER', flags: ['NEW'] },
    },
  };
}
