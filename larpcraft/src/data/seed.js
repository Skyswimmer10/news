// Seed project: "Operation Chimera".
// Schema notes:
//  - items[].buildStatus:   concept → design → build → tested → packed  (prop pipeline)
//  - items[].availability:  ready | in-use | deployed | missing
//      * assigning to a player sets 'in-use' automatically (see reducer)
//      * placing at a location sets 'deployed'
//  - items[].sensorReqs:    physical hardware this item needs on site
//  - items[].image:         { dataUrl?, kind: 'photo'|'svg'|'model', name } — primary thumbnail
//  - sensors[].assignedTo:  playerId when hardware is issued to a role
//  - nodes[].itemId etc.:   cross-references resolved live against this state

export const SEED_REV = 3;

export function makeSeed() {
  return {
    rev: SEED_REV,

    mechanics: {
      'MECH-LOCK': { id: 'MECH-LOCK', name: 'Lockpicking minigame', summary: 'Physical pick set on a practice lock; 3 fails raise the alarm.' },
      'MECH-DECRYPT': { id: 'MECH-DECRYPT', name: 'Decryption puzzle', summary: 'Button-box cipher wheel; hint unlocks after 3 failed tries.' },
      'MECH-COMMS': { id: 'MECH-COMMS', name: 'Comms link', summary: 'Radio protocol between team units and GM console.' },
      'MECH-ACCESS': { id: 'MECH-ACCESS', name: 'Access control', summary: 'Key card gates between sectors.' },
      'MECH-REVIVE': { id: 'MECH-REVIVE', name: 'Downed-player revive', summary: 'Medkit card ritual, 90 seconds at the med bay.' },
      'MECH-UV': { id: 'MECH-UV', name: 'Hidden-ink clues', summary: 'UV-reactive markings on props and walls.' },
    },

    sensors: {
      'RFID-07': { id: 'RFID-07', kind: 'NFC reader', label: 'Locker 12 reader', status: 'online', locationId: 'LOC-S7', assignedTo: null },
      'NFC-03': { id: 'NFC-03', kind: 'NFC reader', label: 'Dataslate dock', status: 'online', locationId: 'LOC-S7', assignedTo: null },
      'BTN-11': { id: 'BTN-11', kind: 'Button box', label: 'Cipher button box', status: 'offline', locationId: 'LOC-COMMS', assignedTo: null },
      'MOT-04': { id: 'MOT-04', kind: 'Motion sensor', label: 'North door motion', status: 'offline', locationId: 'LOC-S7', assignedTo: null },
      'PRX-02': { id: 'PRX-02', kind: 'Proximity sensor', label: 'Gate proximity', status: 'online', locationId: 'LOC-S8', assignedTo: null },
      'RF-01': { id: 'RF-01', kind: 'RF beacon', label: 'Extraction beacon RX', status: 'unplaced', locationId: null, assignedTo: null },
    },

    locations: {
      'LOC-S7': { id: 'LOC-S7', name: 'Sector 7 Warehouse', zone: 'Act 1', notes: 'Main quest area. Two patrol routes, locker corridor, marked safety zone.', safety: 'Fire exits east + west. No running on the mezzanine.', image: null, sensorIds: ['RFID-07', 'NFC-03', 'MOT-04'] },
      'LOC-S8': { id: 'LOC-S8', name: 'Sector 8 Gate', zone: 'Act 2', notes: 'Locked until quest flag key_obtained. Proximity sensor opens GM alert.', safety: 'Gate is heavy — crew operates it, never players.', image: null, sensorIds: ['PRX-02'] },
      'LOC-COMMS': { id: 'LOC-COMMS', name: 'Comms Bench', zone: 'Act 2', notes: 'Decryption puzzle station with cipher button box.', safety: 'Cable run taped down; check before game.', image: null, sensorIds: ['BTN-11'] },
      'LOC-MED': { id: 'LOC-MED', name: 'Med Bay (safe zone)', zone: 'All acts', notes: 'Out-of-game rest area + revive mechanic station.', safety: 'Always out-of-game. Real first aid kit lives here.', image: null, sensorIds: [] },
    },

    items: {
      'CHM-A-004': {
        id: 'CHM-A-004', name: 'Cipher-Key', type: 'artifact',
        buildStatus: 'tested', availability: 'ready',
        description: 'An ancient-looking brass key used for unlocking the central server room.',
        propNotes: 'Heavy brass key, detailed engravings. Spare taped inside GM binder p.12.',
        loreNotes: 'Rumored to be made from meteoritic iron.',
        locationId: 'LOC-S7', mechanicIds: ['MECH-LOCK'],
        sensorReqs: [{ sensorId: 'RFID-07', note: 'confirms pickup, fires key_obtained' }],
        image: null, assignedTo: null,
      },
      'CHM-A-007': {
        id: 'CHM-A-007', name: 'Encrypted Dataslate', type: 'artifact',
        buildStatus: 'build', availability: 'ready',
        description: 'A weathered military dataslate containing corrupted operational data. Needs to be decoded.',
        propNotes: 'Custom plastic + metal case, low-res OLED, four buttons. Battery 2×AA — swap before game.',
        loreNotes: "Recovered from a crash site; rumored to hold the 'Operation Chimera' flight path.",
        locationId: 'LOC-S7', mechanicIds: ['MECH-DECRYPT', 'MECH-COMMS'],
        sensorReqs: [
          { sensorId: 'NFC-03', note: 'dock detects slate placement' },
          { sensorId: 'BTN-11', note: 'cipher input during decryption' },
        ],
        image: null, assignedTo: null,
      },
      'CHM-G-012': {
        id: 'CHM-G-012', name: 'Serum Vial', type: 'gadget',
        buildStatus: 'packed', availability: 'ready',
        description: 'A glowing vial required for the antidote ritual.',
        propNotes: 'Glow vial, UV-reactive fluid. 3 spares in the med crate.',
        loreNotes: '', locationId: 'LOC-MED', mechanicIds: ['MECH-REVIVE'],
        sensorReqs: [], image: null, assignedTo: null,
      },
      'CHM-A-002': {
        id: 'CHM-A-002', name: 'Old-school Key Card', type: 'artifact',
        buildStatus: 'packed', availability: 'ready',
        description: 'An embossed magstripe card that opens sector gates.',
        propNotes: 'Embossed magstripe card, weathered edges.',
        loreNotes: '', locationId: 'LOC-S8', mechanicIds: ['MECH-ACCESS'],
        sensorReqs: [{ sensorId: 'PRX-02', note: 'gate unlock check' }],
        image: null, assignedTo: null,
      },
      'CHM-G-005': {
        id: 'CHM-G-005', name: 'Comms Unit A', type: 'gadget',
        buildStatus: 'tested', availability: 'missing',
        description: 'Team radio tuned to the operation frequency.',
        propNotes: 'Repainted walkie, weathered. LAST SEEN: prop crate 2.',
        loreNotes: '', locationId: null, mechanicIds: ['MECH-COMMS'],
        sensorReqs: [], image: null, assignedTo: null,
      },
      'CHM-G-018': {
        id: 'CHM-G-018', name: 'Signal Beacon', type: 'gadget',
        buildStatus: 'build', availability: 'ready',
        description: 'Extraction call-in beacon for the finale.',
        propNotes: '3D-printed shell, ESP32 + LED ring. Needs field test.',
        loreNotes: '', locationId: 'LOC-S8', mechanicIds: [],
        sensorReqs: [{ sensorId: 'RF-01', note: 'GM console receiver' }],
        image: null, assignedTo: null,
      },
      'CHM-G-001': {
        id: 'CHM-G-001', name: 'UV Torch', type: 'gadget',
        buildStatus: 'packed', availability: 'ready',
        description: 'Reveals hidden ink markings.',
        propNotes: 'Consumer UV flashlight ×4, batteries fresh.',
        loreNotes: '', locationId: null, mechanicIds: ['MECH-UV'],
        sensorReqs: [], image: null, assignedTo: null,
      },
      'CHM-C-009': {
        id: 'CHM-C-009', name: 'Medkit Prop', type: 'consumable',
        buildStatus: 'packed', availability: 'ready',
        description: 'Revive kit: bandage cards + ritual instructions.',
        propNotes: 'Surplus pouch, 12 bandage cards.',
        loreNotes: '', locationId: 'LOC-MED', mechanicIds: ['MECH-REVIVE'],
        sensorReqs: [], image: null, assignedTo: null,
      },
    },

    nodes: {
      'N-BRIEF': { id: 'N-BRIEF', kind: 'story', title: 'Briefing', x: 40, y: 90, body: 'Teams receive the crash-site dossier and a sealed radio frequency.', locationId: null, itemId: null, mechanicIds: [], sensorIds: [] },
      'N-S7': { id: 'N-S7', kind: 'location', title: 'Sector 7 Warehouse', x: 380, y: 40, body: '2 patrols · marked safety zone', locationId: 'LOC-S7', itemId: null, mechanicIds: [], sensorIds: ['RFID-07', 'MOT-04'] },
      'N-KEY': { id: 'N-KEY', kind: 'objective', title: 'Retrieve Cipher-Key', x: 380, y: 300, body: 'Success unlocks Sector 8.', locationId: 'LOC-S7', itemId: 'CHM-A-004', mechanicIds: ['MECH-LOCK'], sensorIds: ['RFID-07'] },
      'N-PATROL': { id: 'N-PATROL', kind: 'enemy', title: 'Security Patrols', x: 720, y: 40, body: 'NPC crew: Mank +1 · Tier 2 · 7 min loop', locationId: 'LOC-S7', itemId: null, mechanicIds: [], sensorIds: [] },
      'N-DECRYPT': { id: 'N-DECRYPT', kind: 'mechanic', title: 'Decrypt the Dataslate', x: 720, y: 300, body: 'Fail ×3 → alarm reroutes patrols.', locationId: 'LOC-COMMS', itemId: 'CHM-A-007', mechanicIds: ['MECH-DECRYPT'], sensorIds: ['BTN-11', 'NFC-03'] },
      'N-GATE': { id: 'N-GATE', kind: 'sensor', title: 'Sector 8 gate opens', x: 1060, y: 170, body: 'Fires quest.key_obtained to Live Ops.', locationId: 'LOC-S8', itemId: 'CHM-A-002', mechanicIds: ['MECH-ACCESS'], sensorIds: ['PRX-02'] },
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
