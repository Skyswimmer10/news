# LARP Craft — UX concept notes

Mockups: `larpcraft-ux-mockups.html` (self-contained, open in any browser). Four screens,
switchable via the tabs at the top or the sidebar entries.

## What the mockups show

1. **Item Database** — three synced panes: visual gallery (Google-Photos-like), spreadsheet
   grid (Excel-like), and an inspector for the selected record. A view toggle
   (Gallery / Split / Grid) lets the user pick; selecting anywhere selects everywhere.
2. **Scenario Flow** — node canvas for the questline. Node color = entity type, edge labels
   carry conditions (IF / ON / REQUIRES / THEN). Left pane doubles as node palette + act
   outline; a validation banner surfaces unreachable nodes before game night.
3. **Live Ops** (new suggestion) — mission-control screen for running the actual game night:
   site map with team positions and sensor health, live event feed driven by sensor triggers,
   per-team progress cards with "stuck" detection and one-tap hint sending.
4. **Players & Teams** — team cards with roster, per-player safety/consent flags, kit
   checklists tied to item Tag IDs, waiver tracking, and a player inspector with history.

## Design decisions

- **One entity color system everywhere**: narrative blue, location green, enemy red,
  item amber, mechanic purple, sensor cyan. Same hue in the sidebar, node headers, grid
  links, inspector chips, and the live event feed — you always know what kind of thing
  you're looking at.
- **Everything is a link**: any mention of a location, mechanic, or sensor in the grid or
  inspector is a chip/link that jumps to that record. The database is a graph, not tables.
- **Two descriptions per item**: "shown to players" vs. "real-world prop, crew only" —
  fiction and logistics never mix.
- **Build-status workflow** per item (Concept → Design → In build → Tested → Packed)
  instead of a free-text status field, so pre-game readiness is a filterable pipeline.
- **Stable tag IDs** (`CHM-A-004`) shared between the item record, the physical RFID/NFC
  tag, printed prop labels, and the live event feed.
