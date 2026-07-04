import React, { useState } from 'react';
import { useLibrary } from '../state/store.jsx';
import { Thumb, ENTITY_COLORS } from '../components/bits.jsx';

const TABS = [
  { id: 'items', label: 'Items & Gadgets', color: 'var(--c-item)' },
  { id: 'locations', label: 'Locations', color: 'var(--c-location)' },
  { id: 'mechanics', label: 'Rules & Mechanics', color: 'var(--c-mechanic)' },
  { id: 'sensors', label: 'Sensor hardware', color: 'var(--c-sensor)' },
  { id: 'stories', label: 'Story structures', color: 'var(--c-narrative)' },
];

// The master database. Cards here are TEMPLATES — engineering blueprints with
// no game state. Selecting one opens the template editor in the inspector,
// which carries the "Import to Active Game" button.
export default function Library({ selection, onSelect }) {
  const lib = useLibrary();
  const [tab, setTab] = useState('items');
  const selId = selection?.kind === `lib-${tab.slice(0, -1)}` || selection?.kind?.startsWith('lib-') ? selection.id : null;

  const pick = (coll, id) => onSelect({ kind: `lib-${coll}`, id });

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">Library / <b>Master database</b></div>
          <h2>Library Catalogue</h2>
        </div>
        <div className="right"><span className="libbadge">Templates — reusable across games</span></div>
      </div>
      <div className="toolrow">
        {TABS.map((t) => (
          <button key={t.id} className={`chip${tab === t.id ? ' on' : ''}`}
            style={tab === t.id ? { background: t.color } : undefined}
            onClick={() => setTab(t.id)}>
            {t.label} · {Object.keys(lib[t.id]).length}
          </button>
        ))}
      </div>

      {(tab === 'items' || tab === 'locations') && (
        <div className={`gallery${tab === 'locations' ? ' loc' : ''}`}>
          {Object.values(lib[tab]).map((t) => (
            <figure key={t.id} className={`card lib${selId === t.id ? ' sel' : ''}`} onClick={() => pick(tab, t.id)}>
              <div className="thumb"><Thumb image={t.image} type={t.type || 'location'} /></div>
              <figcaption>
                <b>{t.name}</b>
                <span className="tag libtag">Template · <span className="mono">{t.id}</span></span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {tab === 'mechanics' && (
        <div className="librows">
          {Object.values(lib.mechanics).map((m) => (
            <button key={m.id} className={`librow${selId === m.id ? ' sel' : ''}`} onClick={() => pick('mechanics', m.id)}>
              <span className="sq" style={{ background: ENTITY_COLORS.mechanic }} />
              <div><b>{m.name}</b><small>{m.summary}</small></div>
              <span className="mono dim">{m.id}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'sensors' && (
        <div className="librows">
          {Object.values(lib.sensors).map((x) => (
            <button key={x.id} className={`librow${selId === x.id ? ' sel' : ''}`} onClick={() => pick('sensors', x.id)}>
              <span className="sq" style={{ background: ENTITY_COLORS.sensor }} />
              <div><b>{x.kind}</b><small>{x.label}</small></div>
              <span className="mono dim">{x.id}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'stories' && (
        <div className="librows">
          {Object.values(lib.stories).map((st) => (
            <button key={st.id} className={`librow${selId === st.id ? ' sel' : ''}`} onClick={() => pick('stories', st.id)}>
              <span className="sq" style={{ background: ENTITY_COLORS.story }} />
              <div>
                <b>{st.name}</b><small>{st.summary}</small>
                <div className="beats">{st.beats.map((b, i) => (
                  <span key={i} className="beat" style={{ borderColor: ENTITY_COLORS[b.kind] }}>{b.title}</span>
                ))}</div>
              </div>
              <span className="mono dim">{st.id}</span>
            </button>
          ))}
        </div>
      )}

      <div className="statusbar">
        <span>Editing a template updates the <b>master blueprint for future games</b> — instances already in a game keep their own copy.</span>
      </div>
    </div>
  );
}
