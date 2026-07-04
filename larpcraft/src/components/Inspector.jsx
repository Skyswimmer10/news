import React, { useState } from 'react';
import { useGame, useDispatch, useLibrary, useLibraryDispatch } from '../state/store.jsx';
import { resolveNode, itemsAssignedToPlayer, sensorsAssignedToPlayer } from '../state/reducer.js';
import { importItem, importLocation, importSensor, importStory, importPrimitive, importElement } from '../state/bridge.js';
import { Chip, SectionLabel, BuildFlow, Pill, ENTITY_COLORS } from './bits.jsx';
import ImageUploader from './ImageUploader.jsx';

function TextField({ label, value, onCommit, textarea, placeholder }) {
  const [draft, setDraft] = React.useState(value ?? '');
  React.useEffect(() => setDraft(value ?? ''), [value]);
  const commit = () => { if (draft !== (value ?? '')) onCommit(draft); };
  const Tag = textarea ? 'textarea' : 'input';
  return (
    <div className="isect">
      <SectionLabel>{label}</SectionLabel>
      <Tag
        className="field-input" value={draft} placeholder={placeholder}
        rows={textarea ? 3 : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter' && !textarea) e.target.blur(); }}
      />
    </div>
  );
}

// Visual distinction between the two data worlds.
function InstanceBadge({ templateId }) {
  return (
    <div className="scopebadge instance">
      Game instance{templateId && <> of <span className="mono">{templateId}</span></>} — edits affect only this game.
    </div>
  );
}
function TemplateBadge() {
  return <div className="scopebadge template">Master template — edits update the blueprint for future games.</div>;
}

// "Import to Active Game" with inline confirmation of the created instance id.
function ImportButton({ build, label = 'Import to Active Game' }) {
  const proj = useGame();
  const lib = useLibrary();
  const dispatch = useDispatch();
  const [done, setDone] = useState(null);
  return (
    <div className="isect">
      <button className="btn primary wide" onClick={() => {
        const result = build(lib, proj);
        if (!result) return;
        dispatch({ type: 'IMPORT_FROM_LIBRARY', ...result });
        setDone(result.createdId);
        setTimeout(() => setDone(null), 5000);
      }}>{done ? `Imported ✓ ${done}` : `⤓ ${label}`}</button>
      <div className="hint">Duplicates this template into <b>{proj.meta.name}</b> with a new instance ID.</div>
    </div>
  );
}

// ---- Item INSTANCE: the editable record for a physical prop in this game ----
function ItemPanel({ item, viaNode }) {
  const s = useGame();
  const lib = useLibrary();
  const dispatch = useDispatch();
  const upd = (patch) => dispatch({ type: 'UPDATE_ENTITY', coll: 'items', id: item.id, patch });
  const location = item.locationId ? s.locations[item.locationId] : null;
  const holder = item.assignedTo
    ? `${s.teams[item.assignedTo.teamId]?.name ?? '?'}${item.assignedTo.playerId ? ` · ${s.players[item.assignedTo.playerId]?.name}` : ''}`
    : null;
  const unusedSensors = Object.values(s.sensors).filter((x) => !item.sensorReqs.some((r) => r.sensorId === x.id));

  return (
    <>
      {viaNode && (
        <div className="via">Node <b>{viaNode.title}</b> → item record
          <button className="linkbtn" style={{ marginLeft: 'auto' }} title="Detach this node from the item"
            onClick={() => dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id: viaNode.id, patch: { itemId: null } })}>Unlink</button>
        </div>
      )}
      <InstanceBadge templateId={item.templateId} />
      <div className="ihead">
        <ImageUploader coll="items" entity={item} />
        <div className="ihrow">
          <h3>{item.name}</h3>
          <Pill availability={item.availability} />
        </div>
        <div className="sub mono">{item.id} · {item.type}</div>
      </div>

      <TextField label="Item name" value={item.name} onCommit={(v) => upd({ name: v })} />
      <div className="isect">
        <SectionLabel>Build status</SectionLabel>
        <BuildFlow value={item.buildStatus} onChange={(v) => upd({ buildStatus: v })} />
      </div>
      <TextField label="Description · shown to players" textarea value={item.description} onCommit={(v) => upd({ description: v })} />
      <TextField label="Real-world prop · crew only" textarea value={item.propNotes} onCommit={(v) => upd({ propNotes: v })} />

      <div className="isect">
        <SectionLabel>Placement</SectionLabel>
        <select
          className="field-input"
          value={item.locationId ?? ''}
          onChange={(e) => e.target.value
            ? dispatch({ type: 'DEPLOY_ITEM', itemId: item.id, locationId: e.target.value })
            : upd({ locationId: null })}
        >
          <option value="">— not placed —</option>
          {Object.values(s.locations).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {location && <div className="hint">Placing an item sets it to <b>Deployed</b> in the database.</div>}
      </div>

      {holder && (
        <div className="isect">
          <SectionLabel>Issued to</SectionLabel>
          <div className="chips">
            <Chip color="#5CA8F5">{holder}</Chip>
            <button className="linkbtn" onClick={() => dispatch({ type: 'UNASSIGN_ITEM', itemId: item.id })}>Return to stock</button>
          </div>
        </div>
      )}

      <div className="isect">
        <SectionLabel>Linked mechanics · from Library</SectionLabel>
        <div className="chips">
          {item.mechanicIds.map((id) => lib.mechanics[id] && (
            <Chip key={id} color={ENTITY_COLORS.mechanic} title={lib.mechanics[id].summary}
              onRemove={() => upd({ mechanicIds: item.mechanicIds.filter((m) => m !== id) })}>
              {lib.mechanics[id].name}
            </Chip>
          ))}
          <select className="chip-add" value="" onChange={(e) => e.target.value && upd({ mechanicIds: [...item.mechanicIds, e.target.value] })}>
            <option value="">+ link…</option>
            {Object.values(lib.mechanics).filter((m) => !item.mechanicIds.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="isect">
        <SectionLabel>Sensor requirements · hardware in this game</SectionLabel>
        <div className="senslist">
          {item.sensorReqs.map(({ sensorId, note }) => {
            const sen = s.sensors[sensorId];
            if (!sen) return null;
            return (
              <div className="sensrow" key={sensorId}>
                <span className="sq" style={{ background: ENTITY_COLORS.sensor }} />
                <div><b>{sen.id}</b> <span className="dim">{sen.kind} · {sen.battery}%</span>{note && <small>{note}</small>}</div>
                <span className={`sdot ${sen.status}`} title={sen.status} />
                <button className="x" onClick={() => dispatch({ type: 'REMOVE_SENSOR_REQ', itemId: item.id, sensorId })} aria-label="Remove requirement">×</button>
              </div>
            );
          })}
          <select className="chip-add" value="" onChange={(e) => e.target.value && dispatch({ type: 'ADD_SENSOR_REQ', itemId: item.id, sensorId: e.target.value })}>
            <option value="">+ require hardware…</option>
            {unusedSensors.map((x) => <option key={x.id} value={x.id}>{x.id} — {x.kind}</option>)}
          </select>
        </div>
      </div>

      <TextField label="Lore notes" textarea value={item.loreNotes} onCommit={(v) => upd({ loreNotes: v })} />
    </>
  );
}

// ---- Location INSTANCE ----
function LocationPanel({ location, viaNode }) {
  const s = useGame();
  const dispatch = useDispatch();
  const upd = (patch) => dispatch({ type: 'UPDATE_ENTITY', coll: 'locations', id: location.id, patch });
  return (
    <>
      {viaNode && (
        <div className="via">Node <b>{viaNode.title}</b> → location record
          <button className="linkbtn" style={{ marginLeft: 'auto' }} title="Detach this node from the location"
            onClick={() => dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id: viaNode.id, patch: { locationId: null } })}>Unlink</button>
        </div>
      )}
      <InstanceBadge templateId={location.templateId} />
      <div className="ihead">
        <ImageUploader coll="locations" entity={location} />
        <div className="ihrow"><h3>{location.name}</h3></div>
        <div className="sub mono">{location.id}{location.zone && ` · ${location.zone}`}</div>
      </div>
      <TextField label="Location name" value={location.name} onCommit={(v) => upd({ name: v })} />
      <TextField label="Zone / act" value={location.zone} onCommit={(v) => upd({ zone: v })} />
      <TextField label="Notes" textarea value={location.notes} onCommit={(v) => upd({ notes: v })} />
      <TextField label="Safety · crew only" textarea value={location.safety} onCommit={(v) => upd({ safety: v })} />
      <div className="isect">
        <SectionLabel>Sensors on site</SectionLabel>
        <div className="chips">
          {location.sensorIds.map((id) => s.sensors[id] && (
            <Chip key={id} color={ENTITY_COLORS.sensor} title={s.sensors[id].kind}>{id} · {s.sensors[id].status}</Chip>
          ))}
          {location.sensorIds.length === 0 && <span className="dim">none placed</span>}
        </div>
      </div>
      <div className="isect">
        <SectionLabel>Items placed here</SectionLabel>
        <div className="chips">
          {Object.values(s.items).filter((i) => i.locationId === location.id).map((i) => (
            <Chip key={i.id} color={ENTITY_COLORS.item}>{i.name}</Chip>
          ))}
        </div>
      </div>
    </>
  );
}

function PlayerPanel({ player }) {
  const s = useGame();
  const dispatch = useDispatch();
  const kit = itemsAssignedToPlayer(s, player.id);
  const hw = sensorsAssignedToPlayer(s, player.id);
  const team = s.teams[player.teamId];
  const upd = (patch) => dispatch({ type: 'UPDATE_ENTITY', coll: 'players', id: player.id, patch });
  return (
    <>
      <div className="ihead">
        <div className="ihrow"><h3>{player.name}</h3></div>
        <div className="sub">{team?.name} · {player.role}{player.flags.map((f) => ` · ${f}`)}</div>
      </div>
      <TextField label="Player name" value={player.name} onCommit={(v) => upd({
        name: v,
        initials: v.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?',
      })} />
      <TextField label="Role" value={player.role} onCommit={(v) => upd({ role: v })} />
      <div className="isect">
        <SectionLabel>Issued kit</SectionLabel>
        <div className="chips">
          {kit.map((i) => <Chip key={i.id} color={ENTITY_COLORS.item}>{i.name}</Chip>)}
          {hw.map((x) => <Chip key={x.id} color={ENTITY_COLORS.sensor}>{x.id} · {x.kind}</Chip>)}
          {kit.length + hw.length === 0 && <span className="dim">nothing issued — assign from the Teams screen</span>}
        </div>
      </div>
    </>
  );
}

const NODE_SWATCHES = ['#5CA8F5', '#43BF87', '#E0A23C', '#E86464', '#A87BF0', '#3EC6D6', '#E8D25C', '#F08CB4'];

function NodePanel({ node }) {
  const s = useGame();
  const lib = useLibrary();
  const dispatch = useDispatch();
  const upd = (patch) => dispatch({ type: 'UPDATE_ENTITY', coll: 'nodes', id: node.id, patch });
  const prim = node.primitiveId ? lib.primitives[node.primitiveId] : null;
  const color = node.color || prim?.color || ENTITY_COLORS[node.kind] || '#8B92A6';
  const connections = s.edges.filter((e) => e.from === node.id || e.to === node.id);
  return (
    <>
      {prim && <InstanceBadge templateId={prim.id} />}
      <div className="ihead">
        <div className="ihrow"><span className="sq big" style={{ background: color }} /><h3>{node.title}</h3></div>
        <div className="sub">{node.kind} node · {node.id}{prim && <> · from <b>{prim.name}</b></>}</div>
      </div>
      <TextField label="Node title" value={node.title} onCommit={(v) => upd({ title: v })} />
      <TextField label="Notes" textarea value={node.body} onCommit={(v) => upd({ body: v })} />
      <div className="isect">
        <SectionLabel>Node color</SectionLabel>
        <div className="chips">
          {NODE_SWATCHES.map((c) => (
            <button key={c} className={`swatch${color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => upd({ color: c })} />
          ))}
          <button className="linkbtn" onClick={() => upd({ color: null })}>Auto</button>
        </div>
      </div>
      <div className="isect">
        <SectionLabel>Link to a record in this game</SectionLabel>
        <select className="field-input" value="" onChange={(e) => {
          const v = e.target.value;
          if (v.startsWith('item:')) upd({ itemId: v.slice(5) });
          else if (v.startsWith('loc:')) upd({ locationId: v.slice(4) });
        }}>
          <option value="">— link an item or location —</option>
          <optgroup label="Items">
            {Object.values(s.items).map((i) => <option key={i.id} value={`item:${i.id}`}>{i.name} · {i.id}</option>)}
          </optgroup>
          <optgroup label="Locations">
            {Object.values(s.locations).map((l) => <option key={l.id} value={`loc:${l.id}`}>{l.name}</option>)}
          </optgroup>
        </select>
        <div className="hint">Linked nodes show the live record here instead.</div>
      </div>
      <div className="isect">
        <SectionLabel>Connections</SectionLabel>
        <div className="chips">
          {connections.map((e, i) => (
            <Chip key={i} color={color}>{e.from === node.id ? `→ ${s.nodes[e.to]?.title}` : `← ${s.nodes[e.from]?.title}`}</Chip>
          ))}
          {connections.length === 0 && <span className="dim">none — drag from the node's ○ port on the canvas</span>}
        </div>
      </div>
    </>
  );
}

// ---- Library TEMPLATE panels: edit the master blueprint, import instances ----
function LibItemPanel({ template }) {
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();
  const upd = (patch) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'items', id: template.id, patch });
  return (
    <>
      <TemplateBadge />
      <div className="ihead">
        <ImageUploader coll="items" entity={template} dispatchOverride={libDispatch} />
        <div className="ihrow"><h3>{template.name}</h3></div>
        <div className="sub mono">{template.id} · {template.type} · template</div>
      </div>
      <ImportButton build={(l, p) => importItem(l, p, template.id)} />
      <TextField label="Name" value={template.name} onCommit={(v) => upd({ name: v })} />
      <TextField label="Default lore / description" textarea value={template.description} onCommit={(v) => upd({ description: v })} />
      <TextField label="Base construction · crew only" textarea value={template.propNotes} onCommit={(v) => upd({ propNotes: v })} />
      <div className="isect">
        <SectionLabel>Default mechanics</SectionLabel>
        <div className="chips">
          {template.mechanicIds.map((id) => lib.mechanics[id] && (
            <Chip key={id} color={ENTITY_COLORS.mechanic}
              onRemove={() => upd({ mechanicIds: template.mechanicIds.filter((m) => m !== id) })}>
              {lib.mechanics[id].name}
            </Chip>
          ))}
          <select className="chip-add" value="" onChange={(e) => e.target.value && upd({ mechanicIds: [...template.mechanicIds, e.target.value] })}>
            <option value="">+ link…</option>
            {Object.values(lib.mechanics).filter((m) => !template.mechanicIds.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="isect">
        <SectionLabel>Required hardware (templates)</SectionLabel>
        <div className="chips">
          {template.sensorReqs.map(({ sensorId, note }) => lib.sensors[sensorId] && (
            <Chip key={sensorId} color={ENTITY_COLORS.sensor} title={note}
              onRemove={() => upd({ sensorReqs: template.sensorReqs.filter((r) => r.sensorId !== sensorId) })}>
              {lib.sensors[sensorId].kind}
            </Chip>
          ))}
          <select className="chip-add" value="" onChange={(e) => e.target.value && upd({ sensorReqs: [...template.sensorReqs, { sensorId: e.target.value, note: '' }] })}>
            <option value="">+ require…</option>
            {Object.values(lib.sensors).filter((x) => !template.sensorReqs.some((r) => r.sensorId === x.id)).map((x) => <option key={x.id} value={x.id}>{x.kind}</option>)}
          </select>
        </div>
        <div className="hint">Importing this item also imports its hardware into the game.</div>
      </div>
    </>
  );
}

function LibLocationPanel({ template }) {
  const libDispatch = useLibraryDispatch();
  const upd = (patch) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'locations', id: template.id, patch });
  return (
    <>
      <TemplateBadge />
      <div className="ihead">
        <ImageUploader coll="locations" entity={template} dispatchOverride={libDispatch} />
        <div className="ihrow"><h3>{template.name}</h3></div>
        <div className="sub mono">{template.id} · template</div>
      </div>
      <ImportButton build={(l, p) => importLocation(l, p, template.id)} />
      <TextField label="Name" value={template.name} onCommit={(v) => upd({ name: v })} />
      <TextField label="Notes" textarea value={template.notes} onCommit={(v) => upd({ notes: v })} />
      <TextField label="Safety checklist" textarea value={template.safety} onCommit={(v) => upd({ safety: v })} />
    </>
  );
}

function LibMechanicPanel({ template }) {
  const libDispatch = useLibraryDispatch();
  const upd = (patch) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'mechanics', id: template.id, patch });
  return (
    <>
      <TemplateBadge />
      <div className="ihead">
        <div className="ihrow"><span className="sq big" style={{ background: ENTITY_COLORS.mechanic }} /><h3>{template.name}</h3></div>
        <div className="sub mono">{template.id} · rule / mechanic</div>
      </div>
      <TextField label="Name" value={template.name} onCommit={(v) => upd({ name: v })} />
      <TextField label="How it plays" textarea value={template.summary} onCommit={(v) => upd({ summary: v })} />
      <div className="isect"><div className="hint">Mechanics are referenced by games directly — no instance copy needed.</div></div>
    </>
  );
}

function LibSensorPanel({ template }) {
  const libDispatch = useLibraryDispatch();
  const upd = (patch) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'sensors', id: template.id, patch });
  return (
    <>
      <TemplateBadge />
      <div className="ihead">
        <div className="ihrow"><span className="sq big" style={{ background: ENTITY_COLORS.sensor }} /><h3>{template.kind}</h3></div>
        <div className="sub mono">{template.id} · hardware template</div>
      </div>
      <ImportButton build={(l, p) => importSensor(l, p, template.id)} label="Import hardware unit" />
      <TextField label="Kind" value={template.kind} onCommit={(v) => upd({ kind: v })} />
      <TextField label="Build / model notes" textarea value={template.label} onCommit={(v) => upd({ label: v })} />
      <div className="isect"><div className="hint">Instances track per-game state: battery, placement, assignment, online status.</div></div>
    </>
  );
}

function LibStoryPanel({ template }) {
  const libDispatch = useLibraryDispatch();
  const upd = (patch) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'stories', id: template.id, patch });
  return (
    <>
      <TemplateBadge />
      <div className="ihead">
        <div className="ihrow"><span className="sq big" style={{ background: ENTITY_COLORS.story }} /><h3>{template.name}</h3></div>
        <div className="sub mono">{template.id} · story structure · {Object.keys(template.nodes).length} nodes · {template.edges.length} links</div>
      </div>
      <ImportButton build={(l, p) => importStory(l, p, template.id)} label="Import structure into game" />
      <TextField label="Name" value={template.name} onCommit={(v) => upd({ name: v })} />
      <TextField label="Description" textarea value={template.description} onCommit={(v) => upd({ description: v })} />
      <TextField label="Estimated duration (minutes)" value={String(template.estMinutes)} onCommit={(v) => upd({ estMinutes: Math.max(1, parseInt(v, 10) || template.estMinutes) })} />
      <div className="isect"><div className="hint">Open the structure from the catalogue grid to edit its node graph — changes there update this master template.</div></div>
    </>
  );
}

function LibPrimitivePanel({ template }) {
  const libDispatch = useLibraryDispatch();
  const upd = (patch) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'primitives', id: template.id, patch });
  return (
    <>
      <TemplateBadge />
      <div className="ihead">
        <div className="ihrow"><span className="sq big" style={{ background: template.color }} /><h3>{template.name}</h3></div>
        <div className="sub mono">{template.id} · narrative primitive · {template.baseKind}</div>
      </div>
      <ImportButton build={(l, p) => importPrimitive(l, p, template.id)} label="Add node to game canvas" />
      <TextField label="Name" value={template.name} onCommit={(v) => upd({ name: v })} />
      <TextField label="Default description" textarea value={template.defaultBody} onCommit={(v) => upd({ defaultBody: v })} />
      <div className="isect">
        <SectionLabel>Logic handles</SectionLabel>
        <div className="chips">
          {template.inputs.map((h) => <Chip key={h} color="#8B92A6">▸ {h}</Chip>)}
          {template.inputs.length === 0 && <Chip color="#43BF87">entry point</Chip>}
          {template.outputs.map((h) => <Chip key={h} color={template.color}>{h} ▸</Chip>)}
          {template.outputs.length === 0 && <Chip color="#E86464">terminal</Chip>}
        </div>
      </div>
      <div className="frow" style={{ padding: '13px 16px 0' }}>
        <div><SectionLabel>Est. minutes</SectionLabel>
          <input className="field-input" defaultValue={template.estMinutes}
            onBlur={(e) => upd({ estMinutes: Math.max(1, parseInt(e.target.value, 10) || template.estMinutes) })} /></div>
        <div><SectionLabel>Crew needed</SectionLabel>
          <input className="field-input" defaultValue={template.crew}
            onBlur={(e) => upd({ crew: Math.max(0, parseInt(e.target.value, 10) || 0) })} /></div>
      </div>
    </>
  );
}

function LibElementPanel({ template }) {
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();
  const upd = (patch) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'elements', id: template.id, patch });
  const meta = lib.elementTypes[template.etype] ?? { label: template.etype, color: '#8B92A6' };
  return (
    <>
      <TemplateBadge />
      <div className="ihead">
        <div className="ihrow"><span className="sq big" style={{ background: meta.color }} /><h3>{template.name}</h3></div>
        <div className="sub mono">{template.id} · narrative element · {meta.label}</div>
      </div>
      <ImportButton build={(l, p) => importElement(l, p, template.id)} label="Add as story node in game" />
      <TextField label="Name" value={template.name} onCommit={(v) => upd({ name: v })} />
      <div className="isect">
        <SectionLabel>Category</SectionLabel>
        <select className="field-input" value={template.etype} onChange={(e) => upd({ etype: e.target.value })}>
          {Object.values(lib.elementTypes).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          {!lib.elementTypes[template.etype] && <option value={template.etype}>{template.etype} (deleted)</option>}
        </select>
      </div>
      <TextField label="Text · the element itself" textarea value={template.text} onCommit={(v) => upd({ text: v })} />
      <TextField label="Tags (comma separated)" value={template.tags.join(', ')}
        onCommit={(v) => upd({ tags: v.split(',').map((t) => t.trim()).filter(Boolean) })} />
    </>
  );
}

// A node inside a Story Structure's master graph (library editor selection).
function LibStructNodePanel({ storyId, nodeId }) {
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();
  const st = lib.stories[storyId];
  const n = st?.nodes[nodeId];
  if (!n) return <div className="empty">Node not found in this structure.</div>;
  const upd = (patch) => libDispatch({
    type: 'UPDATE_ENTITY', coll: 'stories', id: storyId,
    patch: { nodes: { ...st.nodes, [nodeId]: { ...n, ...patch } } },
  });
  const prim = n.primitiveId ? lib.primitives[n.primitiveId] : null;
  return (
    <>
      <TemplateBadge />
      <div className="ihead">
        <div className="ihrow"><span className="sq big" style={{ background: n.color || prim?.color || ENTITY_COLORS[n.kind] }} /><h3>{n.title}</h3></div>
        <div className="sub">node in <b>{st.name}</b> · {n.kind}</div>
      </div>
      <TextField label="Node title" value={n.title} onCommit={(v) => upd({ title: v })} />
      <TextField label="Notes" textarea value={n.body} onCommit={(v) => upd({ body: v })} />
      {prim && (
        <div className="isect">
          <SectionLabel>Built from primitive</SectionLabel>
          <div className="chips"><Chip color={prim.color}>{prim.name} · ~{prim.estMinutes} min</Chip></div>
        </div>
      )}
    </>
  );
}

// The shared right-hand details panel. Project selections show game instances;
// lib-* selections show master templates with the import bridge.
export default function Inspector({ selection, onSelect }) {
  const s = useGame();
  const lib = useLibrary();
  if (!selection) return <aside className="inspector"><div className="empty">Select an item, node, location or player to inspect it.</div></aside>;

  let body = null;
  const { kind, id } = selection;
  if (kind === 'item' && s.items[id]) body = <ItemPanel item={s.items[id]} />;
  else if (kind === 'location' && s.locations[id]) body = <LocationPanel location={s.locations[id]} />;
  else if (kind === 'player' && s.players[id]) body = <PlayerPanel player={s.players[id]} />;
  else if (kind === 'lib-items' && lib.items[id]) body = <LibItemPanel template={lib.items[id]} />;
  else if (kind === 'lib-locations' && lib.locations[id]) body = <LibLocationPanel template={lib.locations[id]} />;
  else if (kind === 'lib-mechanics' && lib.mechanics[id]) body = <LibMechanicPanel template={lib.mechanics[id]} />;
  else if (kind === 'lib-sensors' && lib.sensors[id]) body = <LibSensorPanel template={lib.sensors[id]} />;
  else if (kind === 'lib-stories' && lib.stories[id]) body = <LibStoryPanel template={lib.stories[id]} />;
  else if (kind === 'lib-primitives' && lib.primitives[id]) body = <LibPrimitivePanel template={lib.primitives[id]} />;
  else if (kind === 'lib-elements' && lib.elements[id]) body = <LibElementPanel template={lib.elements[id]} />;
  else if (kind === 'lib-structnode') body = <LibStructNodePanel storyId={selection.storyId} nodeId={id} />;
  else if (kind === 'node') {
    const r = resolveNode(s, lib, id);
    if (!r) body = null;
    else if (r.item) body = <ItemPanel item={r.item} viaNode={r.node} />;
    else if (r.location) body = <LocationPanel location={r.location} viaNode={r.node} />;
    else body = <NodePanel node={r.node} />;
  }
  return <aside className="inspector" key={`${kind}:${id}`}>{body ?? <div className="empty">Record not found in this game.</div>}</aside>;
}
