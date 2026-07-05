import React, { useState } from 'react';
import { useGame, useDispatch, useLibrary } from '../state/store.jsx';
import { ENTITY_COLORS } from '../components/bits.jsx';
import LibraryBrowser from '../components/LibraryBrowser.jsx';
import { genId } from '../data/csvSchemas.js';

const isNum = (v) => v !== '' && !Number.isNaN(Number(v));

// One editable parameter row: label + value, with +/- steppers for numbers.
function ParamRow({ param, onChange, onRemove }) {
  const numeric = isNum(param.value);
  const step = (d) => onChange({ ...param, value: String(Number(param.value || 0) + d) });
  return (
    <div className="paramrow">
      <input className="field-input plabel" value={param.label}
        onChange={(e) => onChange({ ...param, label: e.target.value })} placeholder="Parameter" />
      <div className="pval">
        {numeric && <button className="stp" onClick={() => step(-1)} aria-label="decrease">−</button>}
        <input className="field-input pvalinput" value={param.value}
          onChange={(e) => onChange({ ...param, value: e.target.value })} />
        {numeric && <button className="stp" onClick={() => step(1)} aria-label="increase">+</button>}
      </div>
      <button className="x" onClick={onRemove} aria-label="Remove parameter">×</button>
    </div>
  );
}

// Game Mechanics: the micro-adjustment workspace. Mechanics are imported from
// the library and tuned per-game (e.g. 1 switch → 4) without altering the
// master blueprint. Drift from the library default is flagged inline.
export default function GameMechanics() {
  const s = useGame();
  const lib = useLibrary();
  const dispatch = useDispatch();
  const [browsing, setBrowsing] = useState(false);
  const [selId, setSelId] = useState(null);

  const mechs = Object.values(s.mechanics ?? {});
  const sel = selId ? s.mechanics?.[selId] : null;
  const upd = (patch) => dispatch({ type: 'UPDATE_ENTITY', coll: 'mechanics', id: sel.id, patch });

  const addNew = () => {
    const id = genId(s.mechanics ?? {}, `${s.meta.prefix}-MECH-`);
    dispatch({ type: 'ADD_ENTITY', coll: 'mechanics', entity: { id, templateId: null, name: 'New mechanic', summary: '', params: [] } });
    setSelId(id);
  };

  // Compare an instance param against its library template default.
  const templateParam = (mech, key) => lib.mechanics[mech.templateId]?.params?.find((p) => p.key === key);

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">{s.meta.name} / <b>Mechanics</b> · game instances</div>
          <h2>Game Mechanics</h2>
        </div>
        <div className="right">
          <button className="btn" onClick={() => setBrowsing(true)}>⤓ Browse Library</button>
          <button className="btn primary" onClick={addNew}>+ New mechanic</button>
        </div>
      </div>

      {mechs.length === 0 ? (
        <div className="emptyview">
          <h3>No mechanics configured for this game yet</h3>
          <p>Import a mechanic from your library, then micro-adjust it here — for example, take the “one switch = one action” rule and set it to four switches for this room.</p>
          <div className="chips">
            <button className="btn primary" onClick={() => setBrowsing(true)}>⤓ Browse Library</button>
            <button className="btn" onClick={addNew}>+ New mechanic</button>
          </div>
        </div>
      ) : (
        <div className="mechsplit">
          <div className="mechlist">
            {mechs.map((m) => (
              <button key={m.id} className={`mechcard${selId === m.id ? ' sel' : ''}`} onClick={() => setSelId(m.id)}>
                <div className="mechcardhead">
                  <span className="sq" style={{ background: ENTITY_COLORS.mechanic }} />
                  <b>{m.name}</b>
                  <span className="mono dim">{m.id}</span>
                </div>
                <small>{m.summary}</small>
                <div className="mechparams">
                  {m.params.map((p) => <span key={p.key || p.label} className="pchip">{p.label}: <b>{p.value}</b></span>)}
                  {m.params.length === 0 && <span className="dim">no parameters</span>}
                </div>
                {m.templateId && <span className="fromlib">from {m.templateId}</span>}
              </button>
            ))}
          </div>

          <div className="mecheditor">
            {sel ? (
              <>
                <div className="isect"><div className="lab">Mechanic name</div>
                  <input className="field-input" value={sel.name} onChange={(e) => upd({ name: e.target.value })} /></div>
                <div className="isect"><div className="lab">Summary</div>
                  <textarea className="field-input" rows={2} value={sel.summary} onChange={(e) => upd({ summary: e.target.value })} /></div>
                {sel.templateId && (
                  <div className="isect"><div className="hint">Imported from <b>{sel.templateId}</b>. Edits here stay in <b>{s.meta.name}</b> — the library blueprint is unchanged.</div></div>
                )}
                <div className="isect">
                  <div className="lab">Parameters · micro-adjust for this game</div>
                  <div className="paramlist">
                    {sel.params.map((p, i) => {
                      const tpl = templateParam(sel, p.key);
                      const drift = tpl && String(tpl.value) !== String(p.value);
                      return (
                        <div key={i}>
                          <ParamRow param={p}
                            onChange={(np) => upd({ params: sel.params.map((x, j) => (j === i ? np : x)) })}
                            onRemove={() => upd({ params: sel.params.filter((_, j) => j !== i) })} />
                          {drift && <div className="drift">library default: {tpl.value} · this game: {p.value}</div>}
                        </div>
                      );
                    })}
                    <button className="chip addcat" onClick={() => upd({ params: [...sel.params, { key: `p${sel.params.length + 1}`, label: 'New parameter', value: '1' }] })}>+ Add parameter</button>
                  </div>
                </div>
                <div className="isect">
                  <button className="btn ghost" onClick={() => { dispatch({ type: 'DELETE_ENTITY', coll: 'mechanics', id: sel.id }); setSelId(null); }}>Remove from game</button>
                </div>
              </>
            ) : <div className="empty">Select a mechanic to adjust its parameters.</div>}
          </div>
        </div>
      )}
      <div className="statusbar"><span>Mechanics imported here are <b>game instances</b> — tuning them never changes the master library blueprint.</span></div>
      {browsing && <LibraryBrowser coll="mechanics" onClose={() => setBrowsing(false)}
        onImported={(id) => { setBrowsing(false); setSelId(id); }} />}
    </div>
  );
}
