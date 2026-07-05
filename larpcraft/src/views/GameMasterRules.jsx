import React, { useState } from 'react';
import { useLibrary, useLibraryDispatch } from '../state/store.jsx';
import { GM_RULE_TABS, LIB_BLANK, LIB_PREFIX } from '../data/seed.js';
import { genId } from '../data/csvSchemas.js';

// Inline editable text field (commit on blur), local to this view.
function Field({ value, onCommit, textarea, rows = 3, placeholder, className = '' }) {
  const [draft, setDraft] = useState(value ?? '');
  React.useEffect(() => setDraft(value ?? ''), [value]);
  const Tag = textarea ? 'textarea' : 'input';
  return (
    <Tag
      className={`field-input ${className}`} value={draft} placeholder={placeholder}
      rows={textarea ? rows : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== (value ?? '')) onCommit(draft); }}
      onKeyDown={(e) => { if (e.key === 'Enter' && !textarea) e.target.blur(); }}
    />
  );
}

// Detail editor for one rule: the core principle stays prominent at the top,
// the descriptive content lives in tabs below.
function RuleDetail({ rule, onBack }) {
  const libDispatch = useLibraryDispatch();
  const [tab, setTab] = useState('implementation');
  const upd = (patch) => libDispatch({ type: 'UPDATE_ENTITY', coll: 'gmRules', id: rule.id, patch });
  const remove = () => {
    if (window.confirm(`Delete the rule "${rule.title}"? This removes it from the master Library.`)) {
      libDispatch({ type: 'DELETE_ENTITY', coll: 'gmRules', id: rule.id });
      onBack();
    }
  };
  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb"><button className="linkbtn" onClick={onBack}>← Game Master Rules</button></div>
          <h2>{rule.title || 'Untitled rule'} <span className="libbadge inline">shapes the whole game</span></h2>
        </div>
        <div className="right"><button className="btn ghost" onClick={remove}>Delete rule</button></div>
      </div>

      <div className="ruledetail">
        <div className="rulefield">
          <div className="lab">Rule name</div>
          <Field value={rule.title} onCommit={(v) => upd({ title: v })} placeholder="Short, memorable name" />
        </div>

        <div className="principlebox">
          <div className="lab">Core principle · shapes the whole game <span className="hintinline">up to ~4 sentences</span></div>
          <Field value={rule.principle} onCommit={(v) => upd({ principle: v })} textarea rows={4}
            className="principle-input" placeholder="State the single guiding principle in a few sentences." />
        </div>

        <div className="ruletabs">
          {GM_RULE_TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="ruletabbody">
          {GM_RULE_TABS.map((t) => tab === t.id && (
            <Field key={t.id} value={rule[t.id]} onCommit={(v) => upd({ [t.id]: v })} textarea rows={9}
              placeholder={`Describe the ${t.label.toLowerCase()} for this rule.`} />
          ))}
        </div>
      </div>

      <div className="statusbar"><span>Game Master Rules live in the <b>master Library</b> and apply as design guidance across every game.</span></div>
    </div>
  );
}

// The section: a readable list of design rules. Each card leads with the
// principle; click to open the full editor with descriptive tabs.
export default function GameMasterRules() {
  const lib = useLibrary();
  const libDispatch = useLibraryDispatch();
  const [openId, setOpenId] = useState(null);
  const rules = Object.values(lib.gmRules ?? {});

  const addNew = () => {
    const id = genId(lib.gmRules ?? {}, LIB_PREFIX.gmRules);
    libDispatch({ type: 'ADD_ENTITY', coll: 'gmRules', entity: LIB_BLANK.gmRules(id) });
    setOpenId(id);
  };

  if (openId && lib.gmRules?.[openId]) {
    return <RuleDetail rule={lib.gmRules[openId]} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb">Library / <b>Game Master Rules</b></div>
          <h2>Game Master Rules</h2>
        </div>
        <div className="right">
          <span className="libbadge">Global — shape every game</span>
          <button className="btn primary" onClick={addNew}>+ New rule</button>
        </div>
      </div>

      <div className="gmlist">
        {rules.map((r) => (
          <button key={r.id} className="gmcard" onClick={() => setOpenId(r.id)}>
            <div className="gmcardhead">
              <b>{r.title || 'Untitled rule'}</b>
              <span className="mono dim">{r.id}</span>
            </div>
            <p className="gmprinciple">{r.principle || <span className="dim">No principle written yet.</span>}</p>
            <div className="gmtabschips">
              {GM_RULE_TABS.map((t) => (
                <span key={t.id} className={`gmtabchip${r[t.id]?.trim() ? ' filled' : ''}`}>{t.label}</span>
              ))}
            </div>
          </button>
        ))}
        {rules.length === 0 && (
          <div className="emptyview" style={{ borderTop: 0 }}>
            <h3>No game master rules yet</h3>
            <p>Capture the design principles that shape the whole game — cooperation, pacing, safety.</p>
            <button className="btn primary" onClick={addNew}>+ New rule</button>
          </div>
        )}
      </div>
      <div className="statusbar"><span><b>{rules.length}</b> rules · click one to edit its principle and descriptive tabs.</span></div>
    </div>
  );
}
