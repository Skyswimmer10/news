import React, { useState } from 'react';
import { StoreProvider, useGame, useDispatch, resetDemoData } from './state/store.jsx';
import Inspector from './components/Inspector.jsx';
import ItemDatabase from './views/ItemDatabase.jsx';
import ScenarioFlow from './views/ScenarioFlow.jsx';
import Teams from './views/Teams.jsx';
import Locations from './views/Locations.jsx';

const VIEWS = [
  { id: 'flow', label: 'Narrative & Quests', color: 'var(--c-narrative)', comp: ScenarioFlow },
  { id: 'locations', label: 'Locations', color: 'var(--c-location)', comp: Locations },
  { id: 'items', label: 'Items & Gadgets', color: 'var(--c-item)', comp: ItemDatabase },
  { id: 'teams', label: 'Players & Teams', color: 'var(--c-mechanic)', comp: Teams },
];

function Shell() {
  const s = useGame();
  const dispatch = useDispatch();
  const [view, setView] = useState('items');
  // Global selection: any view can select; the shared inspector renders it.
  const [selection, setSelection] = useState({ kind: 'item', id: 'CHM-A-007' });

  const counts = {
    flow: Object.keys(s.nodes).length,
    locations: Object.keys(s.locations).length,
    items: Object.keys(s.items).length,
    teams: Object.keys(s.players).length,
  };
  const Active = VIEWS.find((v) => v.id === view).comp;

  return (
    <div className="chrome">
      <div className="sidebar">
        <div className="proj"><span className="dot" /><div><b>Operation Chimera</b><small>Sat 12 Jul · Sector 7 site</small></div></div>
        <div className="navlab">Build &amp; manage</div>
        {VIEWS.map((v) => (
          <button key={v.id} className={`nav${view === v.id ? ' on' : ''}`} onClick={() => setView(v.id)}>
            <span className="sq" style={{ background: v.color }} />{v.label}<span className="n">{counts[v.id]}</span>
          </button>
        ))}
        <div className="sidefoot">
          <button className="linkbtn" onClick={() => resetDemoData(dispatch)}>Reset demo data</button>
        </div>
      </div>
      <Active selection={selection} onSelect={setSelection} />
      <Inspector selection={selection} onSelect={setSelection} />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <div className="frame">
        <div className="titlebar">
          <span className="logo" />
          <span className="appname">LARP Craft — Operation Chimera</span>
        </div>
        <Shell />
      </div>
    </StoreProvider>
  );
}
