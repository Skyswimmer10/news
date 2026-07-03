import React from 'react';
import { useGame, useDispatch } from '../state/store.jsx';
import { resolveNode, itemsAssignedToPlayer, sensorsAssignedToPlayer } from '../state/reducer.js';
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

// ---- Item record: the editable single source of truth for a physical prop ----
function ItemPanel({ item, viaNode }) {
  const s = useGame();
  const dispatch = useDispatch();
  const upd = (patch) => dispatch({ type: 'UPDATE_ENTITY', coll: 'items', id: item.id, patch });
  const location = item.locationId ? s.locations[item.locationId] : null;
  const holder = item.assignedTo
    ? `${s.teams[item.assignedTo.teamId]?.name ?? '?'}${item.assignedTo.playerId ? ` · ${s.players[item.assignedTo.playerId]?.name}` : ''}`
    : null;
  const unusedSensors = Object.values(s.sensors).filter((x) => !item.sensorReqs.some((r) => r.sensorId === x.id));

  return (
    <>
      {viaNode && <div className="via">Node <b>{viaNode.title}</b> → item record</div>}
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
        <SectionLabel>Linked mechanics</SectionLabel>
        <div className="chips">
          {item.mechanicIds.map((id) => s.mechanics[id] && (
            <Chip key={id} color={ENTITY_COLORS.mechanic} title={s.mechanics[id].summary}
              onRemove={() => upd({ mechanicIds: item.mechanicIds.filter((m) => m !== id) })}>
              {s.mechanics[id].name}
            </Chip>
          ))}
          <select className="chip-add" value="" onChange={(e) => e.target.value && upd({ mechanicIds: [...item.mechanicIds, e.target.value] })}>
            <option value="">+ link…</option>
            {Object.values(s.mechanics).filter((m) => !item.mechanicIds.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="isect">
        <SectionLabel>Sensor requirements · hardware</SectionLabel>
        <div className="senslist">
          {item.sensorReqs.map(({ sensorId, note }) => {
            const sen = s.sensors[sensorId];
            if (!sen) return null;
            return (
              <div className="sensrow" key={sensorId}>
                <span className="sq" style={{ background: ENTITY_COLORS.sensor }} />
                <div><b>{sen.id}</b> <span className="dim">{sen.kind}</span>{note && <small>{note}</small>}</div>
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

// ---- Location record with reference-image upload ----
function LocationPanel({ location, viaNode }) {
  const s = useGame();
  const dispatch = useDispatch();
  const upd = (patch) => dispatch({ type: 'UPDATE_ENTITY', coll: 'locations', id: location.id, patch });
  return (
    <>
      {viaNode && <div className="via">Node <b>{viaNode.title}</b> → location record</div>}
      <div className="ihead">
        <ImageUploader coll="locations" entity={location} />
        <div className="ihrow"><h3>{location.name}</h3></div>
        <div className="sub mono">{location.id} · {location.zone}</div>
      </div>
      <TextField label="Location name" value={location.name} onCommit={(v) => upd({ name: v })} />
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
  const kit = itemsAssignedToPlayer(s, player.id);
  const hw = sensorsAssignedToPlayer(s, player.id);
  const team = s.teams[player.teamId];
  return (
    <>
      <div className="ihead">
        <div className="ihrow"><h3>{player.name}</h3></div>
        <div className="sub">{team?.name} · {player.role}{player.flags.map((f) => ` · ${f}`)}</div>
      </div>
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

// The shared right-hand details panel. Selecting a flow node that references an
// item resolves it against the Item Database state and shows the live record.
export default function Inspector({ selection, onSelect }) {
  const s = useGame();
  if (!selection) return <aside className="inspector"><div className="empty">Select an item, node, location or player to inspect it.</div></aside>;

  let body = null;
  if (selection.kind === 'item' && s.items[selection.id]) {
    body = <ItemPanel item={s.items[selection.id]} />;
  } else if (selection.kind === 'location' && s.locations[selection.id]) {
    body = <LocationPanel location={s.locations[selection.id]} />;
  } else if (selection.kind === 'player' && s.players[selection.id]) {
    body = <PlayerPanel player={s.players[selection.id]} />;
  } else if (selection.kind === 'node') {
    const r = resolveNode(s, selection.id);
    if (!r) body = null;
    else if (r.item) body = <ItemPanel item={r.item} viaNode={r.node} />;
    else if (r.location) body = <LocationPanel location={r.location} viaNode={r.node} />;
    else body = (
      <div className="ihead">
        <div className="ihrow"><h3>{r.node.title}</h3></div>
        <div className="sub">{r.node.kind} node</div>
        <p className="dim" style={{ marginTop: 10 }}>{r.node.body}</p>
      </div>
    );
  }
  return <aside className="inspector" key={`${selection.kind}:${selection.id}`}>{body ?? <div className="empty">Record not found.</div>}</aside>;
}
