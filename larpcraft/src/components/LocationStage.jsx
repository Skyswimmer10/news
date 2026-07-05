import React, { useEffect, useRef, useState } from 'react';
import { useGame, useDispatch } from '../state/store.jsx';
import { ENTITY_COLORS } from './bits.jsx';
import { STAGE_W, STAGE_H } from '../data/seed.js';

// ---------------- OpenStreetMap base layer (outdoor locations) ----------------
// Plain slippy-tile math, no map library. Tiles come straight from
// tile.openstreetmap.org; when the network blocks them (e.g. the hosted
// artifact's sandbox) the stage falls back to the grid and everything else
// keeps working.
const toTile = (lat, lon, z) => {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x, y };
};
const fromPx = (px, py, z) => {
  const n = 2 ** z;
  const lon = (px / (256 * n)) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / (256 * n)))) * 180) / Math.PI;
  return { lat, lon };
};

function OsmLayer({ osm, blocked, onBlocked }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tiles = [];
  if (size.w && !blocked) {
    const n = 2 ** osm.zoom;
    const c = toTile(osm.lat, osm.lon, osm.zoom);
    const left = c.x * 256 - size.w / 2;
    const top = c.y * 256 - size.h / 2;
    for (let tx = Math.floor(left / 256); tx * 256 < left + size.w; tx++) {
      for (let ty = Math.floor(top / 256); ty * 256 < top + size.h; ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push({
          key: `${osm.zoom}:${tx}:${ty}`,
          src: `https://tile.openstreetmap.org/${osm.zoom}/${wx}/${ty}.png`,
          l: tx * 256 - left, t: ty * 256 - top,
        });
      }
    }
  }
  return (
    <div className="osmlayer" ref={ref}>
      {tiles.map((t) => <img key={t.key} src={t.src} style={{ left: t.l, top: t.t }} alt="" draggable={false} onError={onBlocked} />)}
      {blocked && <div className="osmblocked">Street map tiles can't load here (offline / sandboxed).<br />Markers and arrows still work — run the app locally for live maps.</div>}
      <span className="osmattr">© OpenStreetMap contributors</span>
    </div>
  );
}

// ---------------- The stage: base layer + markers + movement arrows ----------------
export default function LocationStage({ location, onBack, onSelect }) {
  const s = useGame();
  const dispatch = useDispatch();
  const stageRef = useRef(null);
  const [tool, setTool] = useState('move'); // 'move' | 'arrow'
  const [pending, setPending] = useState(null); // marker waiting for a click: {kind, refId}
  const [drawing, setDrawing] = useState(null); // arrow preview {x1,y1,x2,y2}
  const [tilesBlocked, setTilesBlocked] = useState(false);
  const dragRef = useRef(null);

  const patch = (p) => dispatch({ type: 'UPDATE_ENTITY', coll: 'locations', id: location.id, patch: p });

  const stagePoint = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    return {
      x: Math.min(STAGE_W, Math.max(0, ((e.clientX - r.left) / r.width) * STAGE_W)),
      y: Math.min(STAGE_H, Math.max(0, ((e.clientY - r.top) / r.height) * STAGE_H)),
    };
  };
  const round1 = (v) => Math.round(v * 10) / 10;

  const markerMeta = (m) => {
    if (m.kind === 'item') { const it = s.items[m.refId]; return it && { name: it.name, color: ENTITY_COLORS.item }; }
    if (m.kind === 'sensor') { const sen = s.sensors[m.refId]; return sen && { name: sen.id, color: ENTITY_COLORS.sensor }; }
    const n = s.nodes[m.refId]; return n && { name: n.title, color: n.color || ENTITY_COLORS[n.kind] };
  };

  // Placing a marker also wires the game state: items deploy here, sensors move here.
  const placeMarker = (p) => {
    const id = `M${Date.now().toString(36).toUpperCase()}`;
    const marker = { id, kind: pending.kind, refId: pending.refId, x: round1(p.x), y: round1(p.y) };
    const extra = pending.kind === 'sensor' && !location.sensorIds.includes(pending.refId)
      ? { sensorIds: [...location.sensorIds, pending.refId] } : {};
    patch({ markers: [...location.markers, marker], ...extra });
    if (pending.kind === 'item') dispatch({ type: 'DEPLOY_ITEM', itemId: pending.refId, locationId: location.id });
    if (pending.kind === 'sensor') dispatch({ type: 'UPDATE_ENTITY', coll: 'sensors', id: pending.refId, patch: { locationId: location.id } });
    setPending(null);
  };

  // stage-level pointer handlers: place pending marker, or draw an arrow
  const onStageDown = (e) => {
    if (e.target.closest('.marker')) return;
    const p = stagePoint(e);
    if (pending) { placeMarker(p); return; }
    if (tool === 'arrow') {
      setDrawing({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const onStageMove = (e) => {
    if (drawing) { const p = stagePoint(e); setDrawing((d) => ({ ...d, x2: p.x, y2: p.y })); }
  };
  const onStageUp = () => {
    if (!drawing) return;
    const len = Math.hypot(drawing.x2 - drawing.x1, drawing.y2 - drawing.y1);
    if (len > 4) {
      patch({ arrows: [...location.arrows, { id: `A${Date.now().toString(36).toUpperCase()}`, x1: round1(drawing.x1), y1: round1(drawing.y1), x2: round1(drawing.x2), y2: round1(drawing.y2) }] });
    }
    setDrawing(null);
  };

  // marker dragging (move tool)
  const onMarkerDown = (e, m) => {
    if (tool !== 'move') return;
    e.stopPropagation();
    dragRef.current = m.id;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMarkerMove = (e) => {
    if (!dragRef.current) return;
    const p = stagePoint(e);
    patch({ markers: location.markers.map((m) => (m.id === dragRef.current ? { ...m, x: round1(p.x), y: round1(p.y) } : m)) });
  };
  const onMarkerUp = () => { dragRef.current = null; };

  const removeMarker = (id) => patch({ markers: location.markers.filter((m) => m.id !== id) });
  const removeArrow = (id) => patch({ arrows: location.arrows.filter((a) => a.id !== id) });

  // OSM pan/zoom controls
  const panBy = (dx, dy) => {
    const c = toTile(location.osm.lat, location.osm.lon, location.osm.zoom);
    const next = fromPx(c.x * 256 + dx, c.y * 256 + dy, location.osm.zoom);
    patch({ osm: { ...location.osm, lat: round1(next.lat * 10000) / 10000 || next.lat, lon: next.lon } });
  };
  const zoomBy = (dz) => patch({ osm: { ...location.osm, zoom: Math.min(19, Math.max(3, location.osm.zoom + dz)) } });
  const setCoords = () => {
    const v = window.prompt('Center coordinates as "lat, lon":', `${location.osm.lat}, ${location.osm.lon}`);
    if (!v) return;
    const [lat, lon] = v.split(',').map((x) => parseFloat(x.trim()));
    if (Number.isFinite(lat) && Number.isFinite(lon)) patch({ osm: { ...location.osm, lat, lon } });
  };

  const placedIds = new Set(location.markers.map((m) => `${m.kind}:${m.refId}`));
  const arrowHead = (a) => {
    const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const L = 3.4;
    return `M ${a.x2} ${a.y2} L ${a.x2 - L * Math.cos(ang - 0.45)} ${a.y2 - L * Math.sin(ang - 0.45)} M ${a.x2} ${a.y2} L ${a.x2 - L * Math.cos(ang + 0.45)} ${a.y2 - L * Math.sin(ang + 0.45)}`;
  };

  return (
    <div className="main">
      <div className="mhead">
        <div>
          <div className="crumb"><button className="linkbtn" onClick={onBack}>← Locations</button></div>
          <h2>{location.name} <span className="mono dim" style={{ fontSize: 12 }}>{location.id}</span></h2>
        </div>
        <div className="right">
          <div className="viewtog">
            <button className={location.mapKind === 'schematic' ? 'on' : ''} onClick={() => patch({ mapKind: 'schematic' })}>Room schematic</button>
            <button className={location.mapKind === 'osm' ? 'on' : ''} onClick={() => patch({ mapKind: 'osm' })}>Street map</button>
          </div>
        </div>
      </div>

      <div className="toolrow">
        <select className="chip-add" value="" onChange={(e) => {
          const [kind, refId] = e.target.value.split('|');
          if (kind) { setPending({ kind, refId }); setTool('move'); }
        }}>
          <option value="">＋ Place marker…</option>
          <optgroup label="Items">
            {Object.values(s.items).filter((i) => !placedIds.has(`item:${i.id}`)).map((i) => <option key={i.id} value={`item|${i.id}`}>{i.name} · {i.id}</option>)}
          </optgroup>
          <optgroup label="Sensors">
            {Object.values(s.sensors).filter((x) => !placedIds.has(`sensor:${x.id}`)).map((x) => <option key={x.id} value={`sensor|${x.id}`}>{x.id} — {x.kind}</option>)}
          </optgroup>
          <optgroup label="Quest nodes">
            {Object.values(s.nodes).filter((n) => !placedIds.has(`node:${n.id}`)).map((n) => <option key={n.id} value={`node|${n.id}`}>{n.title}</option>)}
          </optgroup>
        </select>
        <button className={`chip${tool === 'arrow' ? ' on' : ''}`} style={tool === 'arrow' ? { background: '#E8D25C', color: '#1A1D26' } : undefined}
          onClick={() => { setTool(tool === 'arrow' ? 'move' : 'arrow'); setPending(null); }}>
          ↗ Draw movement arrow
        </button>
        {pending && <span className="csvmsg">Click on the map to place the marker</span>}
        {tool === 'arrow' && !pending && <span className="dim" style={{ fontSize: 11.5 }}>drag to draw · click an arrow to delete it</span>}
        {location.mapKind === 'osm' && (
          <span className="osmctl">
            <button className="btn ghost small" onClick={() => panBy(0, -128)}>↑</button>
            <button className="btn ghost small" onClick={() => panBy(0, 128)}>↓</button>
            <button className="btn ghost small" onClick={() => panBy(-128, 0)}>←</button>
            <button className="btn ghost small" onClick={() => panBy(128, 0)}>→</button>
            <button className="btn ghost small" onClick={() => zoomBy(1)}>＋</button>
            <button className="btn ghost small" onClick={() => zoomBy(-1)}>−</button>
            <button className="btn ghost small" onClick={setCoords}>Set coords…</button>
            <span className="mono dim">z{location.osm.zoom}</span>
          </span>
        )}
      </div>

      <div className="stagewrap">
        <div
          className={`stage${pending ? ' placing' : ''}${tool === 'arrow' ? ' drawing' : ''}`}
          ref={stageRef}
          onPointerDown={onStageDown} onPointerMove={onStageMove} onPointerUp={onStageUp}
        >
          {location.mapKind === 'osm'
            ? <OsmLayer osm={location.osm} blocked={tilesBlocked} onBlocked={() => setTilesBlocked(true)} />
            : location.schematic?.dataUrl
              ? <img className="schematic" src={location.schematic.dataUrl} alt="" draggable={false} />
              : <div className="schematic empty"><b>No schematic uploaded</b><span>Add a floor plan under "Room schematic" in the panel on the right — the cover image is separate. Markers and arrows work meanwhile.</span></div>}

          <svg className="stagesvg" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} preserveAspectRatio="none">
            {location.arrows.map((a) => (
              <g key={a.id} className="parrow" onPointerDown={(e) => { e.stopPropagation(); removeArrow(a.id); }}>
                <path d={`M ${a.x1} ${a.y1} L ${a.x2} ${a.y2} ${arrowHead(a)}`} className="arrowline" />
                {/* delete hitbox is inert while placing a marker or drawing */}
                <path d={`M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}`} className="arrowhit"
                  style={{ pointerEvents: pending || tool === 'arrow' ? 'none' : 'stroke' }} />
              </g>
            ))}
            {drawing && <path d={`M ${drawing.x1} ${drawing.y1} L ${drawing.x2} ${drawing.y2} ${arrowHead(drawing)}`} className="arrowline preview" />}
          </svg>

          {location.markers.map((m) => {
            const meta = markerMeta(m);
            if (!meta) return null;
            return (
              <div key={m.id} className="marker" style={{ left: `${(m.x / STAGE_W) * 100}%`, top: `${(m.y / STAGE_H) * 100}%` }}
                onPointerDown={(e) => onMarkerDown(e, m)} onPointerMove={onMarkerMove} onPointerUp={onMarkerUp}
                onClick={() => { if (m.kind === 'item') onSelect?.({ kind: 'item', id: m.refId }); else if (m.kind === 'node') onSelect?.({ kind: 'node', id: m.refId }); }}>
                <span className="mdot" style={{ background: meta.color }} />
                <span className="mlabel" style={{ borderColor: meta.color }}>{meta.name}
                  <button className="x" title="Remove marker" onClick={(e) => { e.stopPropagation(); removeMarker(m.id); }}>×</button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="statusbar">
        <span><b>{location.markers.length}</b> markers · <b>{location.arrows.length}</b> movement arrows · drag markers to reposition · placing an item marker sets it <b>Deployed</b> here.</span>
      </div>
    </div>
  );
}
