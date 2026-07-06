import React from 'react';
import { useGame, useDispatch } from '../state/store.jsx';
import { PrimIcon } from '../components/bits.jsx';
import { FACT_KINDS, FACT_BLANK } from '../data/seed.js';
import { genId } from '../data/csvSchemas.js';

// Facts & State: the registry that replaces a video game's variable system.
// Each fact is a real-world state (a clue held, a door open, a sensor tripped)
// that branch gates reference and a GM or the bound sensor decides at runtime.
export default function FactsView({ selection, onSelect }) {
  const s = useGame();
  const dispatch = useDispatch();
  const facts = s.facts || {};
  const list = Object.values(facts);
  const selId = selection?.kind === 'fact' ? selection.id : null;

  const addFact = (kind) => {
    const id = genId(facts, `${s.meta.prefix}-F-`);
    dispatch({ type: 'ADD_ENTITY', coll: 'facts', entity: { ...FACT_BLANK(id), kind } });
    onSelect({ kind: 'fact', id });
  };

  // Each fact: which nodes set it, how many branches it gates.
  const usage = (fid) => ({
    setBy: Object.values(s.nodes).filter((n) => (n.sets || []).some((x) => x.factId === fid)).length,
    gates: s.edges.filter((e) => e.factId === fid).length,
  });

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">{s.meta.name} / <b>Facts &amp; State</b></div>
          <h2>Facts &amp; State</h2>
        </div>
        <div className="right">
          {Object.values(FACT_KINDS).map((k) => (
            <button key={k.id} className="btn" title={k.hint} onClick={() => addFact(k.id)}>+ {k.label}</button>
          ))}
        </div>
      </div>

      <div className="factintro dim">
        The live-game replacement for coded variables. A fact is a real-world state — a clue a team holds, a prop, a door, a sensor,
        an NPC's disposition. Branches reference these in plain language, and a Game Master or the bound sensor decides at runtime.
      </div>

      {list.length === 0 ? (
        <div className="emptyview">
          <h3>No facts yet</h3>
          <p>Add the first real-world state your story tracks — use the buttons above.</p>
        </div>
      ) : (
        <div className="factgrid">
          {Object.values(FACT_KINDS).map((k) => {
            const inKind = list.filter((f) => f.kind === k.id);
            if (inKind.length === 0) return null;
            return (
              <div className="factcol" key={k.id}>
                <div className="factcolhead"><span className="sq" style={{ background: k.color }}><PrimIcon icon={k.icon} color="#fff" size={11} /></span>{k.label}<span className="n">{inKind.length}</span></div>
                {inKind.map((f) => {
                  const u = usage(f.id);
                  const bound = f.kind === 'sensor' && f.sensorId ? s.sensors[f.sensorId] : null;
                  return (
                    <button key={f.id} className={`factcard${selId === f.id ? ' on' : ''}`} style={{ borderLeftColor: k.color }}
                      onClick={() => onSelect({ kind: 'fact', id: f.id })}>
                      <div className="factcardhead">
                        <b>{f.name}</b>
                        <span className="x" title="Delete fact" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_ENTITY', coll: 'facts', id: f.id }); if (selId === f.id) onSelect(null); }}>×</span>
                      </div>
                      {f.detail && <small className="factdetail">{f.detail}</small>}
                      <div className="factmeta mono dim">
                        {bound && <span className="factbound" style={{ color: k.color }}>⛓ {bound.id}</span>}
                        <span>set by {u.setBy}</span>
                        <span>gates {u.gates}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      <div className="statusbar">
        <span>Add a fact by kind above · click a fact to edit it · a fact is checked by a <b>GM</b> or its bound <b>sensor</b>, never by code · reference it from a Branch node's <b>Outgoing conditions</b>.</span>
      </div>
    </div>
  );
}
