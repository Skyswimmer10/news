import React from 'react';
import { useGame, useDispatch } from '../state/store.jsx';
import { playersOfTeam, itemsAssignedToPlayer, itemsAssignedToTeam, availableItems, sensorsAssignedToPlayer } from '../state/reducer.js';
import { Pill, ENTITY_COLORS } from '../components/bits.jsx';

// Teams & Rosters: issue physical items and sensor hardware to player roles.
// Assigning dispatches ASSIGN_ITEM, which also flips the item to 'in-use' in
// the Item Database — one state, every view updates.
export default function Teams({ selection, onSelect }) {
  const s = useGame();
  const dispatch = useDispatch();
  const freeItems = availableItems(s);
  const freeSensors = Object.values(s.sensors).filter((x) => !x.assignedTo);

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">Operation Chimera / <b>Players &amp; Teams</b></div>
          <h2>Teams &amp; Rosters</h2>
        </div>
      </div>

      <div className="teamgrid">
        {Object.values(s.teams).map((team) => {
          const roster = playersOfTeam(s, team.id);
          const teamKit = itemsAssignedToTeam(s, team.id);
          return (
            <div className="team" key={team.id}>
              <div className="th">
                <span className="emb" style={{ background: team.color }}>{team.name.split(' ').pop()[0]}</span>
                <div><b>{team.name}</b><small>{team.focus}</small></div>
                <span className="kitcount mono">{teamKit.length} items issued</span>
              </div>

              <div className="roster">
                {roster.map((p) => {
                  const kit = itemsAssignedToPlayer(s, p.id);
                  const hw = sensorsAssignedToPlayer(s, p.id);
                  return (
                    <div className="pl" key={p.id}>
                      <button className="plmain" onClick={() => onSelect({ kind: 'player', id: p.id })}>
                        <span className="av" style={{ background: team.color }}>{p.initials}</span>
                        <b>{p.name}</b>
                        {p.flags.map((f) => <span key={f} className={`flag ${f.toLowerCase()}`}>{f}</span>)}
                        <span className="role">{p.role}</span>
                      </button>
                      <div className="kit">
                        {kit.map((i) => (
                          <span className="kitem" key={i.id}>
                            <span className="sq" style={{ background: ENTITY_COLORS.item }} />
                            {i.name} <Pill availability={i.availability} />
                            <button className="x" onClick={() => dispatch({ type: 'UNASSIGN_ITEM', itemId: i.id })} aria-label={`Return ${i.name}`}>×</button>
                          </span>
                        ))}
                        {hw.map((x) => (
                          <span className="kitem" key={x.id}>
                            <span className="sq" style={{ background: ENTITY_COLORS.sensor }} />
                            {x.id} · {x.kind}
                            <button className="x" onClick={() => dispatch({ type: 'ASSIGN_SENSOR', sensorId: x.id, playerId: null })} aria-label={`Return ${x.id}`}>×</button>
                          </span>
                        ))}
                        <select className="chip-add" value="" onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          if (v.startsWith('item:')) dispatch({ type: 'ASSIGN_ITEM', itemId: v.slice(5), teamId: team.id, playerId: p.id });
                          else dispatch({ type: 'ASSIGN_SENSOR', sensorId: v.slice(7), playerId: p.id });
                        }}>
                          <option value="">+ issue…</option>
                          {freeItems.length > 0 && <optgroup label="Items (ready)">
                            {freeItems.map((i) => <option key={i.id} value={`item:${i.id}`}>{i.name} · {i.id}</option>)}
                          </optgroup>}
                          {freeSensors.length > 0 && <optgroup label="Sensor hardware">
                            {freeSensors.map((x) => <option key={x.id} value={`sensor:${x.id}`}>{x.id} — {x.kind}</option>)}
                          </optgroup>}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="statusbar"><span>Issuing an item sets it to <b>In use</b> in the Item Database; returning it sets <b>Ready</b>.</span></div>
    </div>
  );
}
