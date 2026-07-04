import React, { useState } from 'react';
import { StoreProvider, useGame, useDispatch, useLibrary, useLibraryDispatch, resetDemoData } from './state/store.jsx';
import Inspector from './components/Inspector.jsx';
import ProjectMenu from './components/ProjectMenu.jsx';
import ItemDatabase from './views/ItemDatabase.jsx';
import ScenarioFlow from './views/ScenarioFlow.jsx';
import Teams from './views/Teams.jsx';
import Locations from './views/Locations.jsx';
import Library from './views/Library.jsx';

const BUILD_VIEWS = [
  { id: 'flow', label: 'Narrative & Quests', color: 'var(--c-narrative)', comp: ScenarioFlow, count: (p) => Object.keys(p.nodes).length },
  { id: 'locations', label: 'Locations', color: 'var(--c-location)', comp: Locations, count: (p) => Object.keys(p.locations).length },
  { id: 'items', label: 'Items & Gadgets', color: 'var(--c-item)', comp: ItemDatabase, count: (p) => Object.keys(p.items).length },
];
const MANAGE_VIEWS = [
  { id: 'teams', label: 'Players & Teams', color: 'var(--c-mechanic)', comp: Teams, count: (p) => Object.keys(p.players).length },
];

function Shell() {
  const proj = useGame();
  const lib = useLibrary();
  const dispatch = useDispatch();
  const libDispatch = useLibraryDispatch();
  const [view, setView] = useState('items');
  const [selection, setSelection] = useState(null);

  const all = [...BUILD_VIEWS, ...MANAGE_VIEWS];
  const Active = view === 'library' ? Library : all.find((v) => v.id === view).comp;
  const libCount = Object.keys(lib.items).length + Object.keys(lib.locations).length
    + Object.keys(lib.mechanics).length + Object.keys(lib.sensors).length + Object.keys(lib.stories).length;

  const navBtn = (v) => (
    <button key={v.id} className={`nav${view === v.id ? ' on' : ''}`} onClick={() => setView(v.id)}>
      <span className="sq" style={{ background: v.color }} />{v.label}<span className="n">{v.count(proj)}</span>
    </button>
  );

  return (
    <div className="chrome">
      <div className="sidebar">
        <div className="proj"><span className="dot" /><div><b>{proj.meta.name}</b><small>Active game · {Object.keys(proj.items).length} items</small></div></div>
        <div className="navlab">Build</div>
        {BUILD_VIEWS.map(navBtn)}
        <div className="navlab">Manage</div>
        {MANAGE_VIEWS.map(navBtn)}
        <div className="navlab">Library · master database</div>
        <button className={`nav${view === 'library' ? ' on' : ''}`} onClick={() => setView('library')}>
          <span className="sq" style={{ background: 'var(--brand)' }} />Library catalogue<span className="n">{libCount}</span>
        </button>
        <div className="sidefoot">
          <button className="linkbtn" onClick={() => resetDemoData(libDispatch, dispatch)}>Reset demo data</button>
        </div>
      </div>
      <Active selection={selection} onSelect={setSelection} />
      <Inspector selection={selection} onSelect={setSelection} />
    </div>
  );
}

function TitleBar() {
  const proj = useGame();
  return (
    <div className="titlebar">
      <span className="logo" />
      <ProjectMenu />
      <span className="appname">LARP Craft — {proj.meta.name}</span>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <div className="frame">
        <TitleBar />
        <Shell />
      </div>
    </StoreProvider>
  );
}
