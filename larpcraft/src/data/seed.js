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

export const LIB_REV = 8;
export const SEED_REV = 6;

// Default item types — seeds the editable lib.itemTypes collection.
export const DEFAULT_ITEM_TYPES = {
  artifact: { id: 'artifact', label: 'Artifact', color: '#E0A23C' },
  gadget: { id: 'gadget', label: 'Gadget', color: '#3EC6D6' },
  consumable: { id: 'consumable', label: 'Consumable', color: '#E88F8F' },
};

// Location map stage: coordinates for markers/arrows live in a fixed 160×90
// space (16:9) so they stay put on any screen size, over either base layer
// (uploaded schematic image or OpenStreetMap for outdoor sites).
export const STAGE_W = 160;
export const STAGE_H = 90;
export const DEFAULT_OSM = { lat: 56.9496, lon: 24.1052, zoom: 16 };
export const locationMapDefaults = () => ({ mapKind: 'schematic', osm: { ...DEFAULT_OSM }, markers: [], arrows: [] });

// Editable categories for the unified Narrative library (merged primitives +
// elements). Users can add and delete categories. Each carries a color + icon
// used on the narrative node cards and the story-structure canvas.
export const DEFAULT_NARRATIVE_CATEGORIES = {
  'story-beat': { id: 'story-beat', label: 'Story beat', color: '#5CA8F5', icon: 'flag' },
  'plot-hook': { id: 'plot-hook', label: 'Plot hook', color: '#F08CB4', icon: 'alert' },
  'briefing-script': { id: 'briefing-script', label: 'Briefing script', color: '#5CA8F5', icon: 'flag' },
  'npc-bio': { id: 'npc-bio', label: 'NPC bio', color: '#E0A23C', icon: 'swap' },
  'rumor': { id: 'rumor', label: 'Rumor', color: '#43BF87', icon: 'zap' },
  'lore': { id: 'lore', label: 'Lore fragment', color: '#A87BF0', icon: 'cog' },
};

// Descriptive tabs shown under a Game Master Rule's core principle.
export const GM_RULE_TABS = [
  { id: 'implementation', label: 'Implementation' },
  { id: 'rationale', label: 'Rationale' },
];

// ---------------------------------------------------------------------------
// NARRATIVE v2 — a node-graph story model adapted for LIVE (not video) games.
// The professional tools this is modelled on (articy:draft, Arcweave) evaluate
// branch logic in code at runtime. A live game has no runtime engine: a human
// referee, a physical prop, or a hardware sensor decides. So "variables" become
// FACTS (real-world trackable states) and "conditions" become plain-language
// gates a GM or sensor adjudicates.
// ---------------------------------------------------------------------------

// Typed narrative node palette. Each kind renders with its own colour + icon on
// the canvas and offers type-specific fields in the inspector.
export const NARR_NODE_TYPES = {
  beat: { id: 'beat', label: 'Beat', color: '#5CA8F5', icon: 'flag', blurb: 'A scene — what happens at a place and time.' },
  reveal: { id: 'reveal', label: 'Reveal', color: '#F08CB4', icon: 'zap', blurb: 'Deliver information: a clue, an NPC line, a discovered prop.' },
  branch: { id: 'branch', label: 'Branch', color: '#E0A23C', icon: 'swap', blurb: 'A decision point. Each outgoing link carries a plain-language condition a GM or sensor decides.' },
  fact: { id: 'fact', label: 'Fact change', color: '#3EC6D6', icon: 'cog', blurb: 'Records a real-world fact as now true — key held, door open, NPC hostile.' },
  converge: { id: 'converge', label: 'Convergence', color: '#A87BF0', icon: 'pin', blurb: 'Where divergent paths rejoin — keeps the story resilient.' },
  timed: { id: 'timed', label: 'Timed event', color: '#E8D25C', icon: 'clock', blurb: 'Fires at a clock time regardless of player action.' },
  recovery: { id: 'recovery', label: 'Recovery', color: '#E86464', icon: 'cross', blurb: 'A soft-fail nudge that puts a stalled team back in play — never a dead end.' },
};

// Which node kinds belong to the STORY side (vs. the mechanical task side used
// by the Weaver timeline). Legacy 'story' kept for older saves.
export const NARRATIVE_KINDS = ['story', ...Object.keys(NARR_NODE_TYPES)];

// FACTS registry: the live-game replacement for a variable system. A fact is a
// real-world state the game tracks and a GM/sensor can check at a branch.
export const FACT_KINDS = {
  knowledge: { id: 'knowledge', label: 'Knowledge', color: '#5CA8F5', icon: 'flag', hint: 'Something a team has learned — a clue, a code, a name.' },
  physical: { id: 'physical', label: 'Physical', color: '#E0A23C', icon: 'swap', hint: 'A real token / prop / door state — key held, gate open.' },
  sensor: { id: 'sensor', label: 'Sensor', color: '#3EC6D6', icon: 'zap', hint: 'Bound to a hardware sensor in this game.' },
  npc: { id: 'npc', label: 'NPC state', color: '#F08CB4', icon: 'alert', hint: 'An NPC’s disposition — allied, hostile, exposed.' },
  progress: { id: 'progress', label: 'Progress', color: '#A87BF0', icon: 'pin', hint: 'A story milestone the game has reached.' },
};
export const FACT_BLANK = (id) => ({ id, name: 'New fact', kind: 'knowledge', detail: '', sensorId: null });

// Blank factories for the Library's "+ New …" buttons and id prefixes.
export const LIB_PREFIX = {
  items: 'LIB-ITM-', locations: 'LIB-LOC-', mechanics: 'LIB-MECH-N', sensors: 'LIB-SEN-N',
  narrative: 'LIB-NAR-', mechPrimitives: 'LIB-MPRIM-', stories: 'LIB-STORY-N',
  mechStructures: 'LIB-MSTRUCT-N', gmRules: 'LIB-GMR-',
};
export const LIB_BLANK = {
  items: (id) => ({ id, name: 'New item template', type: 'gadget', description: '', propNotes: '', loreNotes: '', mechanicIds: [], sensorReqs: [], image: null }),
  locations: (id) => ({ id, name: 'New location template', notes: '', safety: '', image: null }),
  mechanics: (id) => ({ id, name: 'New mechanic', summary: '', params: [] }),
  sensors: (id) => ({ id, kind: 'New sensor type', label: '' }),
  // Unified narrative building block (story-only): shows in the Narrative
  // library and drops onto the story-structure canvas.
  narrative: (id) => ({ id, name: 'New narrative element', category: 'story-beat', color: '#5CA8F5', icon: 'flag', body: '', tags: [], inputs: ['in'], outputs: ['out'] }),
  // Mechanic node type (sensor/physical/task) for the Game Mechanics node tree.
  mechPrimitives: (id) => ({ id, name: 'New mechanic node', baseKind: 'mechanic', color: '#A87BF0', icon: 'cog', inputs: ['in'], outputs: ['out'], defaultBody: '', estMinutes: 5, crew: 0 }),
  stories: (id) => ({ id, name: 'New structure', description: '', estMinutes: 15, nodes: {}, edges: [] }),
  mechStructures: (id) => ({ id, name: 'New mechanic structure', description: '', estMinutes: 10, nodes: {}, edges: [] }),
  gmRules: (id) => ({ id, title: 'New game master rule', principle: '', implementation: '', rationale: '', aiRule: '' }),
};

// Migration: preserve user-authored library data across schema bumps.
//  - additively backfills any missing collections;
//  - v6→v7 splits the old `primitives` pool into `narrative` (story nodes) and
//    `mechPrimitives` (mechanic nodes), folds `elements` into `narrative`, and
//    renames `elementTypes` → `narrativeCategories`.
export function migrateLibrary(saved) {
  if (!saved || typeof saved !== 'object' || !saved.items) return makeLibrarySeed();
  const seed = makeLibrarySeed();
  const merged = { ...saved };

  if (saved.primitives || saved.elements || saved.elementTypes) {
    const narrative = { ...(saved.narrative || {}) };
    const mechPrimitives = { ...(saved.mechPrimitives || {}) };
    for (const p of Object.values(saved.primitives || {})) {
      if (p.baseKind === 'story') {
        narrative[p.id] = { id: p.id, name: p.name, category: 'story-beat', color: p.color, icon: p.icon || 'flag', body: p.defaultBody || '', tags: [], inputs: p.inputs || [], outputs: p.outputs || ['out'] };
      } else {
        mechPrimitives[p.id] = { ...p };
      }
    }
    const cats = saved.elementTypes || {};
    for (const el of Object.values(saved.elements || {})) {
      narrative[el.id] = { id: el.id, name: el.name, category: el.etype || 'story-beat', color: cats[el.etype]?.color || '#5CA8F5', icon: cats[el.etype]?.icon || 'flag', body: el.text || '', tags: el.tags || [], inputs: ['in'], outputs: ['out'] };
    }
    merged.narrative = narrative;
    merged.mechPrimitives = mechPrimitives;
    merged.narrativeCategories = saved.narrativeCategories
      || { ...seed.narrativeCategories, ...Object.fromEntries(Object.values(cats).map((c) => [c.id, { ...c, icon: c.icon || seed.narrativeCategories[c.id]?.icon || 'flag' }])) };
    delete merged.primitives;
    delete merged.elements;
    delete merged.elementTypes;
  }

  for (const key of Object.keys(seed)) {
    if (merged[key] === undefined) merged[key] = seed[key];
  }
  merged.rev = LIB_REV;
  return merged;
}

export function makeLibrarySeed() {
  return {
    rev: LIB_REV,

    // Mechanic templates carry default PARAMETERS (switch/sensor counts,
    // timings, thresholds). Importing a mechanic into a game copies these; the
    // game instance can then be micro-adjusted (e.g. 1 switch → 4) without
    // ever changing this master blueprint.
    mechanics: {
      'LIB-MECH-LOCK': { id: 'LIB-MECH-LOCK', name: 'Lockpicking minigame', summary: 'Physical pick set on a practice lock; fails raise the alarm.', params: [{ key: 'fails', label: 'Fail limit', value: '3' }, { key: 'locks', label: 'Locks to pick', value: '1' }] },
      'LIB-MECH-DECRYPT': { id: 'LIB-MECH-DECRYPT', name: 'Decryption puzzle', summary: 'Button-box cipher wheel; hint unlocks after failed tries.', params: [{ key: 'hintAfter', label: 'Hint after tries', value: '3' }, { key: 'digits', label: 'Cipher digits', value: '4' }] },
      'LIB-MECH-COMMS': { id: 'LIB-MECH-COMMS', name: 'Comms link', summary: 'Radio protocol between team units and GM console.', params: [{ key: 'channels', label: 'Channels', value: '1' }] },
      'LIB-MECH-ACCESS': { id: 'LIB-MECH-ACCESS', name: 'Access control', summary: 'One switch equals one action; all switches open the gate.', params: [{ key: 'switches', label: 'Switches required', value: '1' }] },
      'LIB-MECH-REVIVE': { id: 'LIB-MECH-REVIVE', name: 'Downed-player revive', summary: 'Medkit card ritual at a safe zone.', params: [{ key: 'seconds', label: 'Revive seconds', value: '90' }] },
      'LIB-MECH-UV': { id: 'LIB-MECH-UV', name: 'Hidden-ink clues', summary: 'UV-reactive markings on props and walls.', params: [{ key: 'clues', label: 'Clue count', value: '3' }] },
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

    // NARRATIVE PRIMITIVES: single, isolated node templates — the raw
    // building blocks of quest design. Each carries default input/output
    // logic handles, default metadata, and a designated color + icon.
    // NARRATIVE (Story & Narrative): one unified list of purely-story building
    // blocks — beats, plot hooks, briefing scripts, NPC bios, rumors, lore.
    // Each is a narrative node you can drop onto a story-structure canvas or
    // import into a game as a story node. No mechanic/sensor logic lives here.
    narrative: {
      'LIB-NAR-001': { id: 'LIB-NAR-001', name: 'Start Briefing', category: 'briefing-script', color: '#5CA8F5', icon: 'flag', body: 'Hand teams the mission dossier and start the clock.', tags: ['opening'], inputs: [], outputs: ['out'] },
      'LIB-NAR-002': { id: 'LIB-NAR-002', name: 'Plot Twist', category: 'plot-hook', color: '#F08CB4', icon: 'alert', body: 'A revelation reframes the mission. Deliver via NPC or comms.', tags: ['twist'], inputs: ['in'], outputs: ['out'] },
      'LIB-NAR-003': { id: 'LIB-NAR-003', name: 'The Double Agent', category: 'plot-hook', color: '#F08CB4', icon: 'alert', body: 'One trusted NPC has been feeding the opposing faction all along. Plant three small clues before the reveal.', tags: ['betrayal', 'mid-game'], inputs: ['in'], outputs: ['out'] },
      'LIB-NAR-004': { id: 'LIB-NAR-004', name: 'Cold Open Briefing', category: 'briefing-script', color: '#5CA8F5', icon: 'flag', body: '"You were told this is a routine supply run. It is not. Twelve hours ago we lost contact with the site team…" — read aloud, then hand over the dossier.', tags: ['opening'], inputs: [], outputs: ['out'] },
      'LIB-NAR-005': { id: 'LIB-NAR-005', name: 'Quartermaster Mank', category: 'npc-bio', color: '#E0A23C', icon: 'swap', body: 'Gruff, incorruptible, keeps meticulous ledgers. Will trade information only for returned equipment. Never leaves the depot.', tags: ['npc', 'trader'], inputs: ['in'], outputs: ['out'] },
      'LIB-NAR-006': { id: 'LIB-NAR-006', name: 'The Meteor Rumor', category: 'rumor', color: '#43BF87', icon: 'zap', body: 'Players overhear: the artifact metal is not from Earth, and it hums near powered sensors. (True — usable as a hint.)', tags: ['hint', 'artifact'], inputs: ['in'], outputs: ['out'] },
      'LIB-NAR-007': { id: 'LIB-NAR-007', name: 'Chimera Program Lore', category: 'lore', color: '#A87BF0', icon: 'cog', body: 'Operation Chimera was a cancelled cold-war program to hide a listening post inside civilian logistics. Its flight paths were never declassified.', tags: ['backstory'], inputs: ['in'], outputs: ['out'] },
      'LIB-NAR-008': { id: 'LIB-NAR-008', name: 'Radio Intercept 03:00', category: 'plot-hook', color: '#F08CB4', icon: 'alert', body: 'A garbled transmission names one of the player teams as "the decoys". Broadcast it on the comms channel at the act break.', tags: ['twist', 'comms'], inputs: ['in'], outputs: ['out'] },
    },

    // MECHANIC PRIMITIVES (Game Mechanics node tree): the physical / sensor /
    // task node types — sensor triggers, puzzles, challenges, timers, waypoints,
    // handoffs. These are the mechanics counterpart to the narrative nodes.
    mechPrimitives: {
      'LIB-MPRIM-WAYPT': { id: 'LIB-MPRIM-WAYPT', name: 'Waypoint Check-in', baseKind: 'location', color: '#43BF87', icon: 'pin', inputs: ['in'], outputs: ['out'], defaultBody: 'Team must physically reach and confirm a marked point.', estMinutes: 5, crew: 0 },
      'LIB-MPRIM-SENSOR': { id: 'LIB-MPRIM-SENSOR', name: 'Sensor Trigger', baseKind: 'sensor', color: '#3EC6D6', icon: 'zap', inputs: ['arm'], outputs: ['fired'], defaultBody: 'Fires a quest flag when the linked hardware triggers.', estMinutes: 1, crew: 0 },
      'LIB-MPRIM-HANDOFF': { id: 'LIB-MPRIM-HANDOFF', name: 'Item Handoff', baseKind: 'objective', color: '#E0A23C', icon: 'swap', inputs: ['in'], outputs: ['done'], defaultBody: 'A physical item changes hands — player↔player or player↔NPC.', estMinutes: 8, crew: 1 },
      'LIB-MPRIM-PUZZLE': { id: 'LIB-MPRIM-PUZZLE', name: 'Environmental Puzzle', baseKind: 'mechanic', color: '#A87BF0', icon: 'cog', inputs: ['in'], outputs: ['solved', 'failed'], defaultBody: 'On-site puzzle using props or sensors; hint after 3 fails.', estMinutes: 12, crew: 0 },
      'LIB-MPRIM-PHYS': { id: 'LIB-MPRIM-PHYS', name: 'Physical Challenge', baseKind: 'enemy', color: '#E86464', icon: 'cross', inputs: ['in'], outputs: ['won', 'lost'], defaultBody: 'Chase, carry, or evade — crew referees the outcome.', estMinutes: 10, crew: 2 },
      'LIB-MPRIM-TIMER': { id: 'LIB-MPRIM-TIMER', name: 'Countdown Pressure', baseKind: 'mechanic', color: '#E8D25C', icon: 'clock', inputs: ['start'], outputs: ['expired'], defaultBody: 'Visible countdown; expiry punishes or escalates.', estMinutes: 15, crew: 0 },
    },

    // Editable type systems (persist across games in the Library).
    itemTypes: { ...DEFAULT_ITEM_TYPES },
    narrativeCategories: { ...DEFAULT_NARRATIVE_CATEGORIES },

    // GAME MASTER RULES: global design principles that shape the whole game.
    // Each rule leads with a short core principle (≤4 sentences), then carries
    // descriptive tabs (implementation / rationale / AI generation rule).
    gmRules: {
      'LIB-GMR-001': {
        id: 'LIB-GMR-001',
        title: 'Distributed Cooperation',
        principle: 'Core cooperative stages should distribute essential information, access, or timing across multiple players so success comes from combining actions, not from one player directing everyone else.',
        implementation: 'When generating a cooperative stage, give different players different pieces of the solution. One player might see a symbol, another might hear a sound cue, another might reach a physical sensor, and another might control timing. Start with information-splitting, then add physical separation or simultaneous triggers when the stage needs stronger cooperation. Use time pressure carefully, mainly for advanced or high-energy stages. The stage should still allow players to communicate, coordinate, and feel shared success rather than simply obeying one dominant player.',
        rationale: 'This prevents the alpha-player problem while supporting real group cohesion. Players are not just standing near each other; they each hold something the group needs. This creates participation, communication, trust, and replayable variation without requiring new hardware for every stage.',
        aiRule: 'Before finalizing a cooperative stage, check whether one player can complete it alone by holding all information, reaching all sensors, and controlling all timing. If yes, split one required element across players: information first, physical access second, timing pressure third. Ensure the split creates meaningful cooperation, not just artificial inconvenience.',
      },
      'LIB-GMR-002': {
        id: 'LIB-GMR-002',
        title: 'Fail Forward',
        principle: 'A failed objective should redirect the story, never dead-end it. Every failure state must hand players a new, playable situation — a harder path, a consequence, or a lead — so momentum and morale survive setbacks.',
        implementation: 'For each stage, author the failure branch as deliberately as the success branch. A failed puzzle might trigger an alarm that reroutes enemies, spend a resource, or unlock a slower manual bypass. Avoid outcomes that force players to stand idle or leave the game. Prefer consequences that change the board (new enemy behaviour, a locked route, a time penalty) over consequences that simply say "no".',
        rationale: 'Real-life games cannot pause and retry cleanly; a hard dead-end strands players physically and kills a session. Fail-forward design keeps everyone in motion, turns mistakes into story, and lets weaker teams still reach an ending.',
        aiRule: 'For every stage with a fail state, verify a defined next action exists on failure. If failure leads to "nothing happens" or "wait and try again", replace it with a consequence that changes the game state or opens an alternate route before finalizing.',
      },
      'LIB-GMR-003': {
        id: 'LIB-GMR-003',
        title: 'Safety Breaks Fiction',
        principle: 'Player safety and consent always override the fiction. Any real-world hazard, medical need, or a player invoking a stop signal immediately pauses the in-game situation, no matter how dramatic the moment.',
        implementation: 'Every stage must define a safe-word / stop-signal response and a nearest out-of-game safe zone. Physical challenges declare their real limits (no grappling, no stairs, no blindfold near hazards) up front. Crew are briefed that enforcing safety is never "breaking immersion" — it is part of the job. Mark exits, hazards and med locations on the location map.',
        rationale: 'A single injury or ignored consent breach ends trust in the whole event. Encoding safety as a first-class rule keeps the game repeatable, insurable, and welcoming to new and vulnerable players.',
        aiRule: 'Before finalizing any stage involving physical action, restricted senses, or time pressure, confirm it names a stop-signal behaviour and a safe zone. If either is missing, add it and flag the stage for a crew safety review.',
      },
    },

    // STORY STRUCTURES: saved, editable narrative graphs — pure story arcs
    // assembled from narrative nodes (no mechanic nodes). Importing one into a
    // game creates a fully detached copy of the whole graph.
    stories: {
      'LIB-STORY-BETRAY': {
        id: 'LIB-STORY-BETRAY', name: 'Betrayal Reveal',
        description: 'A slow-burn traitor arc: seed suspicion, twist the knife, then flip who the enemy really was.',
        estMinutes: 30,
        nodes: {
          S1: { id: 'S1', primitiveId: 'LIB-NAR-001', kind: 'story', title: 'Start Briefing', x: 40, y: 120, body: 'Teams get the mission and meet the trusted contact.', color: null },
          S2: { id: 'S2', primitiveId: 'LIB-NAR-003', kind: 'story', title: 'Seed of Doubt', x: 340, y: 60, body: 'First clue that the contact is a double agent.', color: null },
          S3: { id: 'S3', primitiveId: 'LIB-NAR-008', kind: 'story', title: 'Radio Intercept', x: 640, y: 120, body: 'A transmission names a player team as the decoys.', color: null },
          S4: { id: 'S4', primitiveId: 'LIB-NAR-002', kind: 'story', title: 'The Reveal', x: 940, y: 60, body: 'The contact turns; the real allegiance lands.', color: null },
        },
        edges: [
          { from: 'S1', to: 'S2', label: 'first clue', color: null },
          { from: 'S2', to: 'S3', label: 'suspicion grows', color: null },
          { from: 'S3', to: 'S4', label: 'the turn', color: null },
        ],
      },
      'LIB-STORY-COLDCASE': {
        id: 'LIB-STORY-COLDCASE', name: 'Cold Case',
        description: 'Investigation arc from a cold open through rumor and testimony to an accusation.',
        estMinutes: 25,
        nodes: {
          S1: { id: 'S1', primitiveId: 'LIB-NAR-004', kind: 'story', title: 'Cold Open', x: 40, y: 100, body: 'The briefing that hides the real stakes.', color: null },
          S2: { id: 'S2', primitiveId: 'LIB-NAR-006', kind: 'story', title: 'The Rumor', x: 340, y: 40, body: 'A rumor points players toward the truth.', color: null },
          S3: { id: 'S3', primitiveId: 'LIB-NAR-005', kind: 'story', title: 'Testimony', x: 640, y: 100, body: 'An NPC gives the key testimony — for a price.', color: null },
          S4: { id: 'S4', primitiveId: 'LIB-NAR-002', kind: 'story', title: 'Accusation', x: 940, y: 40, body: 'The twist that names the culprit.', color: null },
        },
        edges: [
          { from: 'S1', to: 'S2', label: 'a lead', color: null },
          { from: 'S2', to: 'S3', label: 'follow up', color: null },
          { from: 'S3', to: 'S4', label: 'the case breaks', color: null },
        ],
      },
    },

    // MECHANIC STRUCTURES: saved, editable graphs of mechanic nodes — the
    // mechanics counterpart to Story Structures. Same node canvas, mechanic
    // palette. Built from Mechanic Nodes.
    mechStructures: {
      'LIB-MSTRUCT-DOOR': {
        id: 'LIB-MSTRUCT-DOOR', name: 'Multi-Switch Door',
        description: 'Cooperative gate: reach the door, hold several switches at once, a sensor confirms, a timer pressures.',
        estMinutes: 15,
        nodes: {
          S1: { id: 'S1', primitiveId: 'LIB-MPRIM-WAYPT', kind: 'location', title: 'Reach the door', x: 40, y: 120, body: 'Team gathers at the sealed door.', color: null },
          S2: { id: 'S2', primitiveId: 'LIB-MPRIM-PUZZLE', kind: 'mechanic', title: 'Hold the switches', x: 340, y: 60, body: 'All switches must be held at once.', color: null },
          S3: { id: 'S3', primitiveId: 'LIB-MPRIM-SENSOR', kind: 'sensor', title: 'Door sensor', x: 640, y: 120, body: 'Sensor confirms the door opened.', color: null },
          S4: { id: 'S4', primitiveId: 'LIB-MPRIM-TIMER', kind: 'mechanic', title: 'Reset timer', x: 940, y: 60, body: 'Door re-locks if the timer expires.', color: null },
        },
        edges: [
          { from: 'S1', to: 'S2', label: 'assemble', color: null },
          { from: 'S2', to: 'S3', label: 'all held', color: null },
          { from: 'S3', to: 'S4', label: 'ON fired', color: null },
        ],
      },
      'LIB-MSTRUCT-CHASE': {
        id: 'LIB-MSTRUCT-CHASE', name: 'Handoff Under Pursuit',
        description: 'An item handoff completed while a physical challenge (pursuit) is running.',
        estMinutes: 12,
        nodes: {
          S1: { id: 'S1', primitiveId: 'LIB-MPRIM-WAYPT', kind: 'location', title: 'Rendezvous', x: 40, y: 100, body: 'Runners meet at the drop.', color: null },
          S2: { id: 'S2', primitiveId: 'LIB-MPRIM-HANDOFF', kind: 'objective', title: 'The Handoff', x: 340, y: 40, body: 'Pass the item, hand to hand.', color: null },
          S3: { id: 'S3', primitiveId: 'LIB-MPRIM-PHYS', kind: 'enemy', title: 'Break contact', x: 640, y: 100, body: 'Evade the pursuit crew to escape.', color: null },
        },
        edges: [
          { from: 'S1', to: 'S2', label: 'in position', color: null },
          { from: 'S2', to: 'S3', label: 'item passed', color: null },
        ],
      },
    },
  };
}

export function makeEmptyProject(name = 'Untitled game') {
  return {
    rev: SEED_REV,
    // hero: per-game backdrop image shown behind the workspace, with
    // adjustable opacity and placement ('app' whole workspace | 'content'
    // behind the main content area). File menu → Set game backdrop…
    meta: { name, prefix: 'GAME', createdAt: Date.now(), hero: { image: null, opacity: 0.25, placement: 'app' }, timeline: { startMin: 540, endMin: 1020 } },
    items: {}, locations: {}, sensors: {}, mechanics: {}, facts: {}, nodes: {}, edges: [], alignments: [], storyTrack: {}, teams: {}, players: {},
  };
}

// Additive project migration: preserve the open game across schema bumps by
// backfilling any collections/fields added in later revs (e.g. `facts`) instead
// of discarding user work. Corrupt/empty saves fall back to a fresh demo.
export function migrateProject(saved) {
  if (!saved || typeof saved !== 'object' || !saved.meta || !saved.nodes) return makeProjectSeed();
  const base = makeEmptyProject(saved.meta.name || 'Untitled game');
  const merged = { ...saved };
  for (const key of Object.keys(base)) {
    if (merged[key] === undefined) merged[key] = base[key];
  }
  return merged;
}

// Demo game: Operation Chimera, built from the library templates above.
export function makeProjectSeed() {
  return {
    rev: SEED_REV,
    meta: { name: 'Operation Chimera', prefix: 'CHM', createdAt: Date.now(), hero: { image: null, opacity: 0.25, placement: 'app' }, timeline: { startMin: 540, endMin: 1020 } },

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
      'LOC-S7': {
        id: 'LOC-S7', templateId: 'LIB-LOC-001', name: 'Sector 7 Warehouse', zone: 'Act 1',
        notes: 'Main quest area. Two patrol routes, locker corridor, marked safety zone.',
        safety: 'Fire exits east + west. No running on the mezzanine.', image: null, schematic: null,
        sensorIds: ['RFID-07', 'NFC-03', 'MOT-04'],
        mapKind: 'schematic', osm: { ...DEFAULT_OSM },
        markers: [
          { id: 'M1', kind: 'item', refId: 'CHM-A-004', x: 62, y: 48 },
          { id: 'M2', kind: 'item', refId: 'CHM-A-007', x: 96, y: 30 },
          { id: 'M3', kind: 'sensor', refId: 'RFID-07', x: 66, y: 54 },
          { id: 'M4', kind: 'sensor', refId: 'NFC-03', x: 100, y: 36 },
          { id: 'M5', kind: 'sensor', refId: 'MOT-04', x: 30, y: 12 },
        ],
        arrows: [
          { id: 'A1', x1: 14, y1: 78, x2: 58, y2: 52 },
          { id: 'A2', x1: 66, y1: 50, x2: 94, y2: 34 },
        ],
      },
      'LOC-S8': {
        id: 'LOC-S8', templateId: 'LIB-LOC-002', name: 'Sector 8 Gate', zone: 'Act 2',
        notes: 'Locked until quest flag key_obtained.', safety: 'Gate is heavy — crew operates it, never players.',
        image: null, schematic: null, sensorIds: ['PRX-02'],
        mapKind: 'osm', osm: { ...DEFAULT_OSM },
        markers: [{ id: 'M1', kind: 'sensor', refId: 'PRX-02', x: 80, y: 45 }],
        arrows: [],
      },
      'LOC-COMMS': { id: 'LOC-COMMS', templateId: 'LIB-LOC-003', name: 'Comms Bench', zone: 'Act 2', notes: 'Decryption puzzle station with cipher button box.', safety: 'Cable run taped down; check before game.', image: null, schematic: null, sensorIds: ['BTN-11'], ...locationMapDefaults() },
      'LOC-MED': { id: 'LOC-MED', templateId: 'LIB-LOC-004', name: 'Med Bay (safe zone)', zone: 'All acts', notes: 'Out-of-game rest area + revive mechanic station.', safety: 'Always out-of-game. Real first aid kit lives here.', image: null, schematic: null, sensorIds: [], ...locationMapDefaults() },
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

    // FACTS: the real-world states this game tracks. Branch gates reference
    // these in plain language; a GM or the bound sensor decides at runtime.
    facts: {
      'F-KEY': { id: 'F-KEY', name: 'Cipher-Key retrieved', kind: 'physical', detail: 'A team physically holds the brass Cipher-Key.', sensorId: 'RFID-07' },
      'F-DECODE': { id: 'F-DECODE', name: 'Dataslate decoded', kind: 'knowledge', detail: 'A team solved the cipher and read the Chimera flight path.', sensorId: null },
      'F-GATE': { id: 'F-GATE', name: 'Sector 8 gate open', kind: 'sensor', detail: 'Gate proximity loop reports the gate has opened.', sensorId: 'PRX-02' },
      'F-ALARM': { id: 'F-ALARM', name: 'Alarm raised', kind: 'progress', detail: 'A failed breach tripped the warehouse alarm; patrols reroute.', sensorId: 'MOT-04' },
      'F-TRAITOR': { id: 'F-TRAITOR', name: 'Contact exposed as double agent', kind: 'npc', detail: 'The trusted contact has been revealed as feeding the other faction.', sensorId: null },
    },

    // Game mechanic INSTANCES: imported from the library, then micro-adjusted
    // for this specific game. Note the Server Room Door needs 4 switches here,
    // while its library blueprint (LIB-MECH-ACCESS) still defaults to 1.
    mechanics: {
      'CHM-MECH-01': { id: 'CHM-MECH-01', templateId: 'LIB-MECH-ACCESS', name: 'Server room door', summary: 'Four wall switches must be held to open the server room.', params: [{ key: 'switches', label: 'Switches required', value: '4' }] },
      'CHM-MECH-02': { id: 'CHM-MECH-02', templateId: 'LIB-MECH-DECRYPT', name: 'Dataslate decryption', summary: 'Cipher wheel on the comms bench; harder this game.', params: [{ key: 'hintAfter', label: 'Hint after tries', value: '5' }, { key: 'digits', label: 'Cipher digits', value: '6' }] },
    },

    // NARRATIVE v2 graph: typed nodes, per-team lanes (teamId), fact-setting
    // nodes (sets[]) and fact-gated branches (see edges). Nodes with a teamId
    // belong to that team's lane; teamId:null is shared across all teams.
    nodes: {
      'N-BRIEF': { id: 'N-BRIEF', kind: 'beat', title: 'Briefing', x: 40, y: 90, body: 'Teams receive the crash-site dossier and a sealed radio frequency.', color: null, teamId: null, sets: [], locationId: null, itemId: null, mechanicIds: [], sensorIds: [] },
      'N-S7': { id: 'N-S7', kind: 'location', title: 'Sector 7 Warehouse', x: 380, y: 40, body: '2 patrols · marked safety zone', color: null, teamId: null, sets: [], locationId: 'LOC-S7', itemId: null, mechanicIds: [], sensorIds: ['RFID-07', 'MOT-04'], startMin: 540, durationMin: 60 },
      'N-KEY': { id: 'N-KEY', kind: 'objective', title: 'Retrieve Cipher-Key', x: 380, y: 300, body: 'Success unlocks Sector 8.', color: null, teamId: 'T-RAVEN', sets: [{ factId: 'F-KEY', to: 'set' }], locationId: 'LOC-S7', itemId: 'CHM-A-004', mechanicIds: ['LIB-MECH-LOCK'], sensorIds: ['RFID-07'], startMin: 600, durationMin: 45 },
      'N-CHOICE': { id: 'N-CHOICE', kind: 'branch', title: 'Breach or bypass?', x: 720, y: 170, body: 'Force the locker corridor (risk the alarm) or take the slow maintenance bypass.', color: null, teamId: 'T-RAVEN', sets: [], locationId: 'LOC-S7', itemId: null, mechanicIds: [], sensorIds: [] },
      'N-PATROL': { id: 'N-PATROL', kind: 'enemy', title: 'Security Patrols', x: 1060, y: 40, body: 'NPC crew: Mank +1 · Tier 2 · 7 min loop', color: null, teamId: null, sets: [], locationId: 'LOC-S7', itemId: null, mechanicIds: [], sensorIds: [], startMin: 660, durationMin: 90 },
      'N-DECRYPT': { id: 'N-DECRYPT', kind: 'mechanic', title: 'Decrypt the Dataslate', x: 720, y: 360, body: 'Fail ×3 → alarm reroutes patrols.', color: null, teamId: 'T-WOLF', sets: [{ factId: 'F-DECODE', to: 'set' }], locationId: 'LOC-COMMS', itemId: 'CHM-A-007', mechanicIds: ['LIB-MECH-DECRYPT'], sensorIds: ['BTN-11', 'NFC-03'], startMin: 780, durationMin: 60 },
      'N-RECOV': { id: 'N-RECOV', kind: 'recovery', title: 'Stuck on the cipher?', x: 720, y: 600, body: 'If a team stalls 15+ min at the bench, Quartermaster Mank offers one partial digit — keeps momentum, never a dead end.', color: null, teamId: 'T-WOLF', sets: [], locationId: 'LOC-COMMS', itemId: null, mechanicIds: [], sensorIds: [] },
      'N-GATE': { id: 'N-GATE', kind: 'sensor', title: 'Sector 8 gate opens', x: 1060, y: 340, body: 'Fires quest.key_obtained to Live Ops.', color: null, teamId: null, sets: [{ factId: 'F-GATE', to: 'set' }], locationId: 'LOC-S8', itemId: 'CHM-A-002', mechanicIds: ['LIB-MECH-ACCESS'], sensorIds: ['PRX-02'], startMin: 900, durationMin: 30 },
      'N-TWIST': { id: 'N-TWIST', kind: 'timed', title: 'False-flag intercept', x: 1060, y: 560, body: 'A radio intercept names one player team as "the decoys". Broadcast on comms at the act break — fires whether or not players are ready.', color: null, teamId: null, sets: [{ factId: 'F-TRAITOR', to: 'set' }], startMin: 840, locationId: null, itemId: null, mechanicIds: [], sensorIds: [] },
      'N-REVEAL': { id: 'N-REVEAL', kind: 'reveal', title: 'Double-agent tell', x: 1400, y: 340, body: 'Players notice the contact’s badge doesn’t match the manifest. Plant this before the twist lands.', color: null, teamId: null, sets: [], locationId: null, itemId: null, mechanicIds: [], sensorIds: [] },
      'N-END': { id: 'N-END', kind: 'beat', title: 'Extraction', x: 1400, y: 560, body: 'Teams call in the beacon and exfiltrate before the timer.', color: null, teamId: null, sets: [], locationId: null, itemId: null, mechanicIds: [], sensorIds: [] },
    },
    // Edges: `label` is the plain-language condition (a GM reads it). A branch
    // gate may also carry factId + expect ('set'|'unset') so it references a
    // tracked fact directly — a coloured fact dot then shows on the connection.
    edges: [
      { from: 'N-BRIEF', to: 'N-S7', label: 'game start', kindColor: 'story' },
      { from: 'N-S7', to: 'N-KEY', label: 'locker corridor', kindColor: 'location' },
      { from: 'N-KEY', to: 'N-CHOICE', label: 'breach attempt', kindColor: 'objective' },
      { from: 'N-CHOICE', to: 'N-PATROL', label: 'IF alarm raised', kindColor: 'enemy', factId: 'F-ALARM', expect: 'set' },
      { from: 'N-CHOICE', to: 'N-DECRYPT', label: 'ELSE stayed quiet', kindColor: 'mechanic' },
      { from: 'N-KEY', to: 'N-GATE', label: 'IF Cipher-Key retrieved', kindColor: 'sensor', factId: 'F-KEY', expect: 'set' },
      { from: 'N-DECRYPT', to: 'N-GATE', label: 'REQUIRES decode', kindColor: 'mechanic', factId: 'F-DECODE', expect: 'set' },
      { from: 'N-DECRYPT', to: 'N-RECOV', label: 'IF stalled 15 min', kindColor: 'mechanic' },
      { from: 'N-RECOV', to: 'N-DECRYPT', label: 'back to it', kindColor: 'mechanic' },
      { from: 'N-GATE', to: 'N-TWIST', label: 'act break', kindColor: 'sensor' },
      { from: 'N-TWIST', to: 'N-REVEAL', label: 'suspicion seeded', kindColor: 'story', factId: 'F-TRAITOR', expect: 'set' },
      { from: 'N-REVEAL', to: 'N-END', label: 'the turn', kindColor: 'story' },
    ],
    // Weaver alignments: story beats ↔ physical tasks they are tied to.
    alignments: [
      { story: 'N-BRIEF', task: 'N-KEY' },
      { story: 'N-TWIST', task: 'N-DECRYPT' },
      { story: 'N-END', task: 'N-GATE' },
    ],
    // Weaver left-panel layout for the macro story track (nodeId → {x,y}).
    storyTrack: {
      'N-BRIEF': { x: 60, y: 40 }, 'N-CHOICE': { x: 60, y: 200 }, 'N-REVEAL': { x: 60, y: 360 },
      'N-TWIST': { x: 340, y: 40 }, 'N-RECOV': { x: 340, y: 200 }, 'N-END': { x: 340, y: 360 },
    },

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
