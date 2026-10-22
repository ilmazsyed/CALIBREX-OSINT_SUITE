import React, { useEffect, useRef, useState } from 'react';
import * as satellite from 'satellite.js';
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, GeoProjection } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import topoRaw from 'world-atlas/countries-110m.json';
import { Globe2, Loader2, Crosshair, Layers, X, ArrowRight, ExternalLink, Radio, Satellite, FolderPlus, Check } from 'lucide-react';
import { getWorldmap, MapPoint, LayerId } from '../lib/worldmap';
import { getSatellites } from '../lib/satellites';
import { getInfrastructure, INFRA_COLOR } from '../lib/infrastructure';
import { openReader, timeAgo } from '../lib/live';
import { addToCase } from '../lib/workbench';

/* ----------------------------------------------------------------------------
 * Live Earth 3D — a clean orthographic globe drawn on a 2D <canvas> with d3-geo.
 *
 * Why not WebGL / Cesium? Cesium spins up Web Workers that iOS Safari rejects
 * ("SecurityError: The operation is insecure"), and it is a 5MB, battery-heavy
 * dependency. This globe is pure 2D canvas — no workers, no WebGL — so it runs
 * everywhere (iPad included), stays light, and gives exactly what we want: a
 * slowly rotating outlined Earth with blinking realtime dots that open a detail
 * card on click, mirroring the 2D Global Situation map's data and interactions.
 * -------------------------------------------------------------------------- */

const topo: any = topoRaw as any;
const COUNTRIES: any = feature(topo, topo.objects.countries);
const BORDERS: any = mesh(topo, topo.objects.countries, (a: any, b: any) => a !== b);
const GRATICULE: any = geoGraticule10();
const SPHERE: any = { type: 'Sphere' };

const LAYER_COLOR: Record<string, string> = {
  hotspots: '#e9c46a', conflict: '#ff4d4d', fire: '#ff7a1a', quake: '#ffb020',
  natural: '#39b0c4', maritime: '#48cae4', vessels: '#5ad1a5', aircraft: '#cfe8ff',
  outages: '#b57edc', convergence: '#ffd166', infra: '#e9bd78',
};
const LAYER_LABEL: Record<string, string> = {
  aircraft: 'Aircraft', vessels: 'Vessels', fire: 'Fires', quake: 'Quakes',
  conflict: 'Conflict', hotspots: 'Hotspots', maritime: 'Maritime', natural: 'Natural',
  outages: 'Outages', convergence: 'Convergence', infra: 'Infrastructure',
};
// Start lean and readable: aircraft + conflict (satellites are always on). The
// user turns on more from the Layers panel.
const DEFAULT_ON: Record<string, boolean> = { aircraft: true, vessels: false, fire: false, quake: false, conflict: true, hotspots: false, maritime: false, natural: false, outages: false, convergence: false, infra: false };
const LAYER_WHAT: Record<string, string> = {
  aircraft: 'Planes flying now (ADS-B)', vessels: 'Ships at sea (AIS)', fire: 'Active wildfires (NASA)',
  quake: 'Recent earthquakes (USGS)', conflict: 'Armed-conflict events', hotspots: 'Threat hotspots from the wire',
  maritime: 'Shipping incidents & chokepoints', natural: 'Natural events (NASA EONET)', outages: 'Internet outages (IODA)',
  convergence: 'Where multiple streams stack up', infra: 'Ports, airports, chokepoints, energy',
};

type Detail = { title: string; kind: string; rows: [string, string][]; url?: string; follow?: boolean; lat?: number; lng?: number; place?: string; severity?: string; source?: string; published?: number };
interface Dot { lng: number; lat: number; color: string; r: number; kind: string; cx: Detail; ping?: boolean; }
interface SatDot extends Dot { rec: any; name: string; group: string; alt: number; }

function hexA(hex: string, a: number): string {
  try {
    let h = (hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return `rgba(207,232,255,${a})`;
    return `rgba(${r},${g},${b},${a})`;
  } catch { return `rgba(207,232,255,${a})`; }
}

interface Props { onInvestigate?: (q: string) => void }

// Clicking a point shows exactly what it is (no jump to search). onInvestigate
// is accepted for API symmetry with the other views but intentionally unused.
const LiveEarth3D: React.FC<Props> = () => {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // live data collections
  const liveRef = useRef<Record<string, Dot[]>>({});
  const satsRef = useRef<SatDot[]>([]);
  const infraRef = useRef<Dot[]>([]);
  // per-frame hit-test registry (projected positions of visible dots)
  const hitsRef = useRef<{ x: number; y: number; r: number; dot: Dot }[]>([]);

  // projection / interaction state (refs so the RAF loop reads latest values)
  const projRef = useRef<GeoProjection>(geoOrthographic().precision(0.4));
  const rotRef = useRef<[number, number]>([-20, -15]);     // start over Africa/India-ish
  const scaleRef = useRef<number>(240);
  const fitScaleRef = useRef<number>(240);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 600, h: 500, dpr: 1 });
  const draggingRef = useRef(false);
  const followRef = useRef<Dot | null>(null);
  const layersRef = useRef<Record<string, boolean>>(DEFAULT_ON);
  const rafRef = useRef<number>(0);

  const [status, setStatus] = useState('Loading the globe…');
  const [ready, setReady] = useState(false);
  const [lite, setLite] = useState(false);
  const [layers, setLayers] = useState<Record<string, boolean>>(DEFAULT_ON);
  const [sel, setSel] = useState<Detail | null>(null);
  const [added, setAdded] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [, setNowTick] = useState(0);

  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { const t = setInterval(() => setNowTick(n => n + 1), 15000); return () => clearInterval(t); }, []);

  // ---- sizing ----------------------------------------------------------------
  function resize() {
    const el = wrap.current, cv = canvas.current; if (!el || !cv) return;
    const w = el.clientWidth, h = el.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, (matchMedia('(max-width: 820px)').matches ? 1.5 : 2));
    sizeRef.current = { w, h, dpr };
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const fit = Math.min(w, h) / 2 * 0.92;
    fitScaleRef.current = fit;
    // keep current zoom ratio if already zoomed, else fit
    if (!ready) scaleRef.current = fit;
    else scaleRef.current = Math.max(fit * 0.9, Math.min(fit * 6, scaleRef.current));
  }

  // ---- draw ------------------------------------------------------------------
  function draw(now: number) {
    const cv = canvas.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    const proj = projRef.current;
    proj.rotate([rotRef.current[0], rotRef.current[1], 0]).scale(scaleRef.current).translate([w / 2, h / 2]);
    const path = geoPath(proj, ctx as any);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cxp = w / 2, cyp = h / 2, R = scaleRef.current;

    // atmosphere halo
    const ag = ctx.createRadialGradient(cxp, cyp, R * 0.96, cxp, cyp, R * 1.16);
    ag.addColorStop(0, 'rgba(90,185,215,0.22)'); ag.addColorStop(1, 'rgba(90,185,215,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cxp, cyp, R * 1.16, 0, 2 * Math.PI); ctx.fill();

    // ocean sphere (lit gradient)
    const og = ctx.createRadialGradient(cxp - R * 0.35, cyp - R * 0.4, R * 0.1, cxp, cyp, R);
    og.addColorStop(0, '#103049'); og.addColorStop(1, '#061420');
    ctx.beginPath(); path(SPHERE); ctx.fillStyle = og; ctx.fill();

    // graticule
    ctx.beginPath(); path(GRATICULE); ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 0.5; ctx.stroke();

    // land fill + country borders
    ctx.beginPath(); path(COUNTRIES); ctx.fillStyle = '#16304a'; ctx.fill();
    ctx.beginPath(); path(BORDERS); ctx.strokeStyle = 'rgba(123,200,220,0.28)'; ctx.lineWidth = 0.55; ctx.stroke();

    // crisp rim
    ctx.beginPath(); path(SPHERE); ctx.strokeStyle = 'rgba(123,200,220,0.4)'; ctx.lineWidth = 1; ctx.stroke();

    // ---- dots ----
    const center: [number, number] = [-rotRef.current[0], -rotRef.current[1]];
    hitsRef.current = [];
    const L = layersRef.current;

    const plot = (d: Dot) => {
      if (geoDistance([d.lng, d.lat], center) > Math.PI / 2) return; // back hemisphere
      const p = proj([d.lng, d.lat]); if (!p) return;
      const [x, y] = p;
      const pulse = 0.5 + 0.5 * Math.sin(now / 520 + (d.lng + d.lat));
      // breathing glow
      ctx.beginPath(); ctx.arc(x, y, d.r + 3 + pulse * 3, 0, 2 * Math.PI);
      ctx.fillStyle = hexA(d.color, 0.1 + 0.14 * pulse); ctx.fill();
      // radar ping ring for live / high-emphasis dots
      if (d.ping) {
        const t = (now % 2200) / 2200;
        ctx.beginPath(); ctx.arc(x, y, d.r + t * 15, 0, 2 * Math.PI);
        ctx.strokeStyle = hexA(d.color, (1 - t) * 0.5); ctx.lineWidth = 1.3; ctx.stroke();
      }
      // core
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, 2 * Math.PI); ctx.fillStyle = d.color; ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
      hitsRef.current.push({ x, y, r: Math.max(11, d.r + 7), dot: d });
    };

    for (const id of Object.keys(liveRef.current)) { if (L[id]) for (const d of liveRef.current[id]) plot(d); }
    if (L.infra) for (const d of infraRef.current) plot(d);
    for (const d of satsRef.current) plot(d);       // satellites always on

    ctx.restore();
  }

  // ---- animation loop --------------------------------------------------------
  function startLoop() {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(80, now - last); last = now;
      const foll = followRef.current;
      if (foll) {
        rotRef.current = [-foll.lng, -foll.lat];
      } else if (!draggingRef.current) {
        rotRef.current[0] = ((rotRef.current[0] + dt * 0.005 + 180) % 360) - 180;
      }
      draw(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  // ---- data loaders ----------------------------------------------------------
  async function loadLive(mobile: boolean) {
    const snap = await getWorldmap();
    const cap: Record<string, number> = mobile
      ? { aircraft: 120, vessels: 120, fire: 160, quake: 120 }
      : { aircraft: 400, vessels: 400, fire: 500, quake: 350 };
    const next: Record<string, Dot[]> = {};
    for (const [id, pts] of Object.entries(snap.layers) as [LayerId, MapPoint[]][]) {
      if (!LAYER_COLOR[id]) continue;
      const arr: Dot[] = [];
      for (const p of (pts || []).slice(0, cap[id] || 250)) {
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
        const mil = id === 'aircraft' && p.mil;
        const sev = (p.severity || '').toLowerCase();
        const rows: [string, string][] = [['Type', LAYER_LABEL[id] + (mil ? ' · military' : '')]];
        if (p.location) rows.push(['Location', p.location]);
        if (p.magnitude) rows.push(['Magnitude', p.magnitude]);
        if (p.severity) rows.push(['Severity', p.severity]);
        if (p.mmsi) rows.push(['MMSI', p.mmsi]);
        if (p.category) rows.push(['Category', p.category]);
        if (typeof p.reports === 'number') rows.push(['Reports', String(p.reports)]);
        if (typeof p.streamCount === 'number') rows.push(['Converging streams', `${p.streamCount}${p.streams?.length ? ` · ${p.streams.join(', ')}` : ''}`]);
        if (p.source) rows.push(['Source', p.source]);
        rows.push(['Coordinates', `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`]);
        if (p.date) rows.push(['Seen', timeAgo(p.date)]);
        arr.push({
          lng: p.lng, lat: p.lat, kind: id,
          color: mil ? '#ff5d5d' : LAYER_COLOR[id],
          r: id === 'aircraft' ? 3.4 : 3.2,
          ping: id === 'aircraft' || id === 'vessels' || sev === 'high' || sev === 'critical',
          cx: { title: p.title || LAYER_LABEL[id] || id, kind: id, rows, url: p.url || '', follow: id === 'aircraft' || id === 'vessels', lat: p.lat, lng: p.lng, place: p.location || '', severity: p.severity || '', source: p.source || LAYER_LABEL[id] || 'Atlas', published: p.date },
        });
      }
      next[id] = arr;
    }
    liveRef.current = next;
    // a followed live dot was just replaced — release to avoid a stale lock
    if (followRef.current && followRef.current.kind !== 'sat') { followRef.current = null; setTracking(false); }
    setLastSync(snap.updatedAt || Date.now());
  }

  async function loadSats(mobile: boolean) {
    const { satellites: sats } = await getSatellites();
    const arr: SatDot[] = [];
    for (const sx of sats.slice(0, mobile ? 110 : 240)) {
      try {
        const rec = satellite.twoline2satrec(sx.tle1, sx.tle2);
        arr.push({
          rec, name: sx.name, group: sx.group, lng: 0, lat: 0, alt: 400,
          color: '#7ee8ff', r: 2.4, kind: 'sat', ping: true,
          cx: { title: sx.name, kind: 'sat', rows: [['Type', 'Satellite'], ['Catalogue', sx.group], ['Track', 'Live orbital position (SGP4)']], follow: true, source: `Satellite · ${sx.group}` },
        });
      } catch { /* bad TLE */ }
    }
    satsRef.current = arr;
    stepSats();
  }

  async function loadInfra() {
    const { items } = await getInfrastructure();
    infraRef.current = items.map(it => ({
      lng: it.lng, lat: it.lat, kind: 'infra', color: INFRA_COLOR[it.type] || '#e9bd78', r: 4, ping: true,
      cx: { title: it.name, kind: 'infra', rows: [['Type', it.type], ['Country', it.country], ['Note', it.note]], lat: it.lat, lng: it.lng, place: it.country, source: `Infrastructure · ${it.type}` },
    }));
  }

  function stepSats() {
    const recs = satsRef.current; if (!recs.length) return;
    const now = new Date(); const gmst = satellite.gstime(now);
    for (const s of recs) {
      try {
        const pv: any = satellite.propagate(s.rec, now);
        if (!pv || !pv.position) continue;
        const g = satellite.eciToGeodetic(pv.position, gmst);
        s.lng = satellite.degreesLong(g.longitude); s.lat = satellite.degreesLat(g.latitude); s.alt = g.height;
      } catch { /* skip */ }
    }
  }

  // ---- pointer interaction (drag to rotate, pinch/wheel to zoom, tap to pick)-
  function bindPointers() {
    const cv = canvas.current; if (!cv) return () => {};
    const pts = new Map<number, { x: number; y: number }>();
    let moved = 0; let startX = 0, startY = 0; let pinchDist = 0; let pinchScale = 0;

    const dist = () => { const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };

    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { draggingRef.current = true; moved = 0; startX = e.clientX; startY = e.clientY; }
      else if (pts.size === 2) { pinchDist = dist(); pinchScale = scaleRef.current; }
    };
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId); if (!prev) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) {
        const d = dist(); if (pinchDist > 0) { const fit = fitScaleRef.current; scaleRef.current = Math.max(fit * 0.9, Math.min(fit * 6, pinchScale * (d / pinchDist))); }
        return;
      }
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 4) { followRef.current = null; setTracking(false); }
      const k = 0.26 * (fitScaleRef.current / scaleRef.current);
      const r = rotRef.current;
      r[0] = r[0] + dx * k;
      r[1] = Math.max(-89, Math.min(89, r[1] - dy * k));
    };
    const up = (e: PointerEvent) => {
      const wasTap = pts.size === 1 && moved < 5;
      pts.delete(e.pointerId);
      if (pts.size < 1) draggingRef.current = false;
      if (wasTap) pick(e.clientX, e.clientY);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const fit = fitScaleRef.current;
      scaleRef.current = Math.max(fit * 0.9, Math.min(fit * 6, scaleRef.current * (e.deltaY < 0 ? 1.12 : 0.89)));
    };

    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', wheel, { passive: false });
    return () => {
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
      cv.removeEventListener('wheel', wheel);
    };
  }

  function pick(clientX: number, clientY: number) {
    const cv = canvas.current; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    let best: { x: number; y: number; r: number; dot: Dot } | null = null; let bestD = Infinity;
    for (const hpt of hitsRef.current) {
      const dd = Math.hypot(hpt.x - x, hpt.y - y);
      if (dd <= hpt.r && dd < bestD) { bestD = dd; best = hpt; }
    }
    if (!best) { setSel(null); return; }
    const d = best.dot;
    let detail: Detail = d.cx;
    if (d.kind === 'sat') {
      const s = d as SatDot;
      detail = { ...d.cx, lat: s.lat, lng: s.lng, rows: [...d.cx.rows, ['Position', `${s.lat.toFixed(2)}, ${s.lng.toFixed(2)}`], ['Altitude', `${Math.round(s.alt)} km`]] };
    }
    setSel(detail); setAdded(false);
    if (detail.follow) { followRef.current = d; setTracking(true); }
  }

  const stopFollow = () => { followRef.current = null; setTracking(false); };

  // ---- init ------------------------------------------------------------------
  useEffect(() => {
    let destroyed = false;
    const mobile = matchMedia('(max-width: 820px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
    setLite(mobile);
    resize();
    const ro = new ResizeObserver(() => resize());
    if (wrap.current) ro.observe(wrap.current);
    const unbind = bindPointers();
    startLoop();

    let liveT: any, satT: any, stepT: any;
    (async () => {
      try { await loadLive(mobile); if (!destroyed) await loadSats(mobile); if (!destroyed) await loadInfra(); } catch { /* keep what loaded */ }
      if (destroyed) return;
      setReady(true); setStatus('');
      stepT = setInterval(() => { if (!destroyed) stepSats(); }, mobile ? 2500 : 1500);
      liveT = setInterval(() => { if (!destroyed) loadLive(mobile).catch(() => {}); }, 45_000);
      satT = setInterval(() => { if (!destroyed) loadSats(mobile).catch(() => {}); }, 10 * 60_000);
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafRef.current);
      clearInterval(liveT); clearInterval(satT); clearInterval(stepT);
      try { ro.disconnect(); } catch { /* */ }
      try { unbind(); } catch { /* */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layerIds = Object.keys(LAYER_LABEL);
  return (
    <div ref={wrap} className="relative w-full" style={{ height: 'calc(100dvh - 8.5rem)', minHeight: 420 }}>
      <canvas ref={canvas} className="absolute inset-0 rounded-xl bg-black touch-none" style={{ touchAction: 'none' }} />

      {status && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-calibrex-dark/90 rounded-xl z-20">
          <Loader2 className="animate-spin text-calibrex-teal" size={26} /><p className="text-[12px] text-calibrex-muted px-6 text-center">{status}</p>
        </div>
      )}

      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/55 backdrop-blur text-calibrex-teal text-[11px] font-black uppercase tracking-widest border border-white/10"><Globe2 size={14} /> Live Earth 3D{lite && <span className="text-[8px] text-white/40 ml-1">lite</span>}</span>
        <button onClick={() => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'worldmap' }))} className="px-2.5 py-1.5 rounded-lg bg-black/55 backdrop-blur border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest">2D</button>
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <button onClick={() => setShowLayers(v => !v)} className={`px-2.5 py-1.5 rounded-lg backdrop-blur border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${showLayers ? 'bg-calibrex-teal text-calibrex-navy border-calibrex-teal' : 'bg-black/60 text-white/80 border-white/10'}`}><Layers size={13} /> Layers</button>
        {showLayers && (
          <div className="w-60 bg-black/75 backdrop-blur border border-white/10 rounded-xl p-2 space-y-0.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="px-2 py-1 text-[9px] font-black text-white/35 uppercase tracking-widest">Layers · tap to toggle</div>
            {layerIds.map(id => (
              <button key={id} onClick={() => setLayers(l => ({ ...l, [id]: !l[id] }))} className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left">
                <span className="w-3 h-3 rounded-sm shrink-0 mt-0.5" style={{ background: layers[id] ? LAYER_COLOR[id] : 'transparent', border: `1px solid ${LAYER_COLOR[id]}` }} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[11px] font-bold ${layers[id] ? 'text-white' : 'text-white/45'}`}>{LAYER_LABEL[id]} <span className="text-[8px] font-black uppercase text-white/30">· ~45s</span></span>
                  <span className="block text-[9px] text-white/35 leading-tight">{LAYER_WHAT[id]}</span>
                </span>
              </button>
            ))}
            <div className="flex items-start gap-2 px-2 py-1.5 border-t border-white/5 mt-1">
              <span className="w-3 h-3 rounded-sm shrink-0 mt-0.5" style={{ background: '#7ee8ff' }} />
              <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold text-white">Satellites <span className="text-[8px] font-black uppercase text-calibrex-low/90">· live</span></span><span className="block text-[9px] text-white/35">Always on · orbits move in real time</span></span>
            </div>
          </div>
        )}
      </div>

      {/* legend of visible layers + live/snapshot status */}
      {ready && !sel && (
        <div className="absolute bottom-3 left-3 z-10 max-w-[70%] bg-black/55 backdrop-blur border border-white/10 rounded-xl px-3 py-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1">
            {layerIds.filter(id => layers[id]).map(id => (
              <span key={id} className="inline-flex items-center gap-1.5 text-[10px] text-white/70"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: LAYER_COLOR[id] }} />{LAYER_LABEL[id]}</span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[10px] text-white/70"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#7ee8ff' }} />Satellites</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-white/40 font-mono">
            <Radio size={10} className="text-calibrex-low" /> satellites live · other points refresh ~45s{lastSync ? ` · synced ${timeAgo(lastSync)}` : ''} · drag to spin · pinch to zoom
          </div>
        </div>
      )}

      {tracking && (
        <button onClick={stopFollow} className="absolute top-16 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest shadow-lg"><Crosshair size={13} /> Following · tap to release</button>
      )}

      {/* selected point — shows exactly what it is, no search jump */}
      {sel && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-96 z-10 bg-black/80 backdrop-blur border border-white/10 rounded-xl p-3.5">
          <div className="flex items-start gap-2.5 mb-2.5">
            {sel.kind === 'sat' ? <Satellite size={16} className="text-[#7ee8ff] shrink-0 mt-0.5" /> : <span className="w-3.5 h-3.5 rounded-sm shrink-0 mt-1" style={{ background: LAYER_COLOR[sel.kind] || '#cfe8ff' }} />}
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-black text-white leading-tight break-words">{sel.title}</div>
            </div>
            <button onClick={() => setSel(null)} className="text-white/40 hover:text-white shrink-0"><X size={16} /></button>
          </div>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-[12px]">
            {sel.rows.map(([k, v], i) => (
              <React.Fragment key={i}>
                <dt className="text-white/40 font-mono text-[10px] uppercase tracking-wider pt-0.5 whitespace-nowrap">{k}</dt>
                <dd className="text-white/85 break-words">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => { addToCase({ id: 'atlas-' + Date.now().toString(36), title: sel.title, url: sel.url || (sel.lat != null ? `https://www.google.com/maps?q=${sel.lat},${sel.lng}` : 'https://app.calibrex.org'), source: sel.source || 'Calibrex Atlas', severity: sel.severity as any, place: sel.place || null, published: sel.published }); setAdded(true); }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${added ? 'bg-calibrex-low/20 text-calibrex-low border border-calibrex-low/40' : 'bg-calibrex-gold text-calibrex-navy'}`}>
              {added ? <><Check size={13} /> Added</> : <><FolderPlus size={13} /> Add to case</>}
            </button>
            {sel.url && (
              <button onClick={() => openReader({ url: sel.url!, title: sel.title, source: sel.source || 'Atlas' })} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-calibrex-teal/40 text-calibrex-teal text-[10px] font-black uppercase tracking-widest"><ExternalLink size={13} /> Source</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveEarth3D;
