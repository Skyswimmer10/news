import React, { useState } from 'react';
import { StoreProvider, useGame, useDispatch, useLibrary, useLibraryDispatch, resetDemoData } from './state/store.jsx';
import Inspector from './components/Inspector.jsx';
import ProjectMenu from './components/ProjectMenu.jsx';
import ItemDatabase from './views/ItemDatabase.jsx';
import ScenarioFlow from './views/ScenarioFlow.jsx';
import Teams from './views/Teams.jsx';
import Locations from './views/Locations.jsx';
import Library from './views/Library.jsx';
import GameMasterRules from './views/GameMasterRules.jsx';
import GameMechanics from './views/GameMechanics.jsx';
import Weaver from './views/Weaver.jsx';

const BUILD_VIEWS = [
  { id: 'flow', label: 'Narrative & Quests', color: 'var(--c-narrative)', comp: ScenarioFlow, count: (p) => Object.keys(p.nodes).length },
  { id: 'weaver', label: 'Weaver', color: 'var(--c-sensor)', comp: Weaver, count: (p) => (p.alignments ?? []).length },
  { id: 'locations', label: 'Locations', color: 'var(--c-location)', comp: Locations, count: (p) => Object.keys(p.locations).length },
  { id: 'items', label: 'Items & Gadgets', color: 'var(--c-item)', comp: ItemDatabase, count: (p) => Object.keys(p.items).length },
  { id: 'mechanics', label: 'Mechanics', color: 'var(--c-mechanic)', comp: GameMechanics, count: (p) => Object.keys(p.mechanics ?? {}).length },
];
const MANAGE_VIEWS = [
  { id: 'teams', label: 'Players & Teams', color: 'var(--c-mechanic)', comp: Teams, count: (p) => Object.keys(p.players).length },
];

// The Library, grouped: physical templates, game mechanics, story content.
const LIB_GROUPS = [
  { id: 'physical', label: 'Physical', color: 'var(--c-item)', colls: ['items', 'locations', 'sensors'] },
  { id: 'mechanics', label: 'Game Mechanics', color: 'var(--c-mechanic)', colls: ['mechanics', 'mechPrimitives'] },
  { id: 'story', label: 'Story & Narrative', color: 'var(--c-narrative)', colls: ['narrative', 'stories'] },
];

function Shell() {
  const proj = useGame();
  const lib = useLibrary();
  const dispatch = useDispatch();
  const libDispatch = useLibraryDispatch();
  const [view, setView] = useState('items');
  const [libGroup, setLibGroup] = useState('physical');
  const [selection, setSelection] = useState(null);

  const all = [...BUILD_VIEWS, ...MANAGE_VIEWS];
  const isLibrary = view === 'library';
  const isRules = view === 'gmrules';
  const ActiveView = isLibrary || isRules ? null : all.find((v) => v.id === view).comp;

  const navBtn = (v) => (
    <button key={v.id} className={`nav${view === v.id ? ' on' : ''}`} onClick={() => setView(v.id)}>
      <span className="sq" style={{ background: v.color }} />{v.label}<span className="n">{v.count(proj)}</span>
    </button>
  );

  const hero = proj.meta.hero;
  const heroPlacement = hero?.placement || 'app';
  return (
    <div className={`chrome${hero?.image?.dataUrl ? ` has-hero hero-${heroPlacement}` : ''}`}>
      {hero?.image?.dataUrl && (
        <div className={`herobg${heroPlacement === 'content' ? ' content' : ''}`}
          style={{ backgroundImage: `url(${hero.image.dataUrl})`, opacity: hero.opacity ?? 0.25 }} />
      )}
      <div className="sidebar">
        <div className="proj"><span className="dot" /><div><b>{proj.meta.name}</b><small>Active game · {Object.keys(proj.items).length} items</small></div></div>
        <div className="navlab">Build</div>
        {BUILD_VIEWS.map(navBtn)}
        <div className="navlab">Manage</div>
        {MANAGE_VIEWS.map(navBtn)}
        <div className="navlab">Library · master database</div>
        {LIB_GROUPS.map((g) => (
          <button key={g.id} className={`nav${view === 'library' && libGroup === g.id ? ' on' : ''}`}
            onClick={() => { setView('library'); setLibGroup(g.id); }}>
            <span className="sq" style={{ background: g.color }} />{g.label}
            <span className="n">{g.colls.reduce((sum, c) => sum + Object.keys(lib[c]).length, 0)}</span>
          </button>
        ))}
        <button className={`nav${isRules ? ' on' : ''}`} onClick={() => setView('gmrules')}>
          <span className="sq" style={{ background: '#E8D25C' }} />Game Master Rules
          <span className="n">{Object.keys(lib.gmRules ?? {}).length}</span>
        </button>
        <div className="sidefoot">
          <button className="linkbtn" onClick={() => resetDemoData(libDispatch, dispatch)}>Reset demo data</button>
        </div>
      </div>
      {isLibrary
        ? <Library group={libGroup} selection={selection} onSelect={setSelection} />
        : isRules
          ? <GameMasterRules />
          : <ActiveView selection={selection} onSelect={setSelection} />}
      <Inspector selection={isRules ? null : selection} onSelect={setSelection} />
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
