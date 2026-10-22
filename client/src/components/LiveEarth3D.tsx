import React, { useEffect, useRef, useState } from 'react';
import * as satellite from 'satellite.js';
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, GeoProjection } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import topoRaw from 'world-atlas/countries-110m.json';
import { Globe2, Loader2, Layers, Radio } from 'lucide-react';
import { getWorldmap, MapPoint, LayerId } from '../lib/worldmap';
import { getSatellites } from '../lib/satellites';
import { getInfrastructure, INFRA_COLOR } from '../lib/infrastructure';
import { timeAgo } from '../lib/live';
import { LAYER_META, layerColor, layerLabel, layerWhat, severityRadius, AtlasDetail, detailFromPoint, detailFromInfra, detailFromSat } from '../lib/maplayers';
import AtlasDetailCard from './AtlasDetailCard';

/* ----------------------------------------------------------------------------
 * Live Earth 3D — a clean orthographic globe drawn on a 2D <canvas> with d3-geo.
 * Pure 2D canvas (no WebGL, no Web Workers), so it runs everywhere including
 * iPad, where Cesium's workers threw "SecurityError: The operation is insecure".
 * Same live feeds, colours and detail card as the 2D Global Situation map.
 * -------------------------------------------------------------------------- */

const topo: any = topoRaw as any;
const COUNTRIES: any = feature(topo, topo.objects.countries);
const BORDERS: any = mesh(topo, topo.objects.countries, (a: any, b: any) => a !== b);
const GRATICULE: any = geoGraticule10();
const SPHERE: any = { type: 'Sphere' };

// Toggleable layers (satellites are always on). Order = legend/panel order.
const LAYER_IDS = ['conflict', 'hotspots', 'fire', 'natural', 'quake', 'outages', 'maritime', 'vessels', 'aircraft', 'convergence', 'infra'] as const;
// Start lean and readable: conflict + aircraft (plus always-on satellites).
const DEFAULT_ON: Record<string, boolean> = { conflict: true, hotspots: false, fire: false, natural: false, quake: false, outages: false, maritime: false, vessels: false, aircraft: true, convergence: false, infra: false };

interface Dot { lng: number; lat: number; color: string; r: number; kind: string; cx: AtlasDetail; ping?: boolean; }
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

const LiveEarth3D: React.FC<Props> = ({ onInvestigate }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const liveRef = useRef<Record<string, Dot[]>>({});
  const satsRef = useRef<SatDot[]>([]);
  const infraRef = useRef<Dot[]>([]);
  const hitsRef = useRef<{ x: number; y: number; r: number; dot: Dot }[]>([]);

  const projRef = useRef<GeoProjection>(geoOrthographic().precision(0.4));
  const rotRef = useRef<[number, number]>([-20, -15]);
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
  const [sel, setSel] = useState<AtlasDetail | null>(null);
  const [tracking, setTracking] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [, setNowTick] = useState(0);

  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { const t = setInterval(() => setNowTick(n => n + 1), 15000); return () => clearInterval(t); }, []);

  function resize() {
    const el = wrap.current, cv = canvas.current; if (!el || !cv) return;
    const w = el.clientWidth, h = el.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, (matchMedia('(max-width: 820px)').matches ? 1.5 : 2));
    sizeRef.current = { w, h, dpr };
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const fit = Math.min(w, h) / 2 * 0.92;
    fitScaleRef.current = fit;
    if (!ready) scaleRef.current = fit;
    else scaleRef.current = Math.max(fit * 0.9, Math.min(fit * 6, scaleRef.current));
  }

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

    const ag = ctx.createRadialGradient(cxp, cyp, R * 0.96, cxp, cyp, R * 1.16);
    ag.addColorStop(0, 'rgba(90,185,215,0.22)'); ag.addColorStop(1, 'rgba(90,185,215,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cxp, cyp, R * 1.16, 0, 2 * Math.PI); ctx.fill();

    const og = ctx.createRadialGradient(cxp - R * 0.35, cyp - R * 0.4, R * 0.1, cxp, cyp, R);
    og.addColorStop(0, '#103049'); og.addColorStop(1, '#061420');
    ctx.beginPath(); path(SPHERE); ctx.fillStyle = og; ctx.fill();

    ctx.beginPath(); path(GRATICULE); ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.beginPath(); path(COUNTRIES); ctx.fillStyle = '#16304a'; ctx.fill();
    ctx.beginPath(); path(BORDERS); ctx.strokeStyle = 'rgba(123,200,220,0.28)'; ctx.lineWidth = 0.55; ctx.stroke();
    ctx.beginPath(); path(SPHERE); ctx.strokeStyle = 'rgba(123,200,220,0.4)'; ctx.lineWidth = 1; ctx.stroke();

    const center: [number, number] = [-rotRef.current[0], -rotRef.current[1]];
    hitsRef.current = [];
    const L = layersRef.current;

    const plot = (d: Dot) => {
      if (geoDistance([d.lng, d.lat], center) > Math.PI / 2) return;
      const p = proj([d.lng, d.lat]); if (!p) return;
      const [x, y] = p;
      const pulse = 0.5 + 0.5 * Math.sin(now / 520 + (d.lng + d.lat));
      ctx.beginPath(); ctx.arc(x, y, d.r + 3 + pulse * 3, 0, 2 * Math.PI);
      ctx.fillStyle = hexA(d.color, 0.1 + 0.14 * pulse); ctx.fill();
      if (d.ping) {
        const t = (now % 2200) / 2200;
        ctx.beginPath(); ctx.arc(x, y, d.r + t * 15, 0, 2 * Math.PI);
        ctx.strokeStyle = hexA(d.color, (1 - t) * 0.5); ctx.lineWidth = 1.3; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, 2 * Math.PI); ctx.fillStyle = d.color; ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
      hitsRef.current.push({ x, y, r: Math.max(11, d.r + 7), dot: d });
    };

    for (const id of Object.keys(liveRef.current)) { if (L[id]) for (const d of liveRef.current[id]) plot(d); }
    if (L.infra) for (const d of infraRef.current) plot(d);
    for (const d of satsRef.current) plot(d);
    ctx.restore();
  }

  function startLoop() {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(80, now - last); last = now;
      const foll = followRef.current;
      if (foll) rotRef.current = [-foll.lng, -foll.lat];
      else if (!draggingRef.current) rotRef.current[0] = ((rotRef.current[0] + dt * 0.005 + 180) % 360) - 180;
      draw(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  async function loadLive(mobile: boolean) {
    const snap = await getWorldmap();
    const cap: Record<string, number> = mobile
      ? { aircraft: 120, vessels: 120, fire: 160, quake: 120 }
      : { aircraft: 400, vessels: 400, fire: 500, quake: 350 };
    const next: Record<string, Dot[]> = {};
    for (const [id, pts] of Object.entries(snap.layers) as [LayerId, MapPoint[]][]) {
      if (!LAYER_META[id]) continue;
      const arr: Dot[] = [];
      const base = (id === 'aircraft' || id === 'vessels') ? 3 : 3.2;
      for (const p of (pts || []).slice(0, cap[id] || 250)) {
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
        const sev = (p.severity || '').toUpperCase();
        arr.push({
          lng: p.lng, lat: p.lat, kind: id, color: layerColor(id),
          r: severityRadius(sev, base),
          ping: id === 'aircraft' || id === 'vessels' || sev === 'HIGH' || sev === 'CRITICAL' || id === 'convergence',
          cx: detailFromPoint(id, p),
        });
      }
      next[id] = arr;
    }
    liveRef.current = next;
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
          color: layerColor('sat'), r: 2.4, kind: 'sat', ping: true,
          cx: detailFromSat(sx.name, sx.group, 0, 0, 400),
        });
      } catch { /* bad TLE */ }
    }
    satsRef.current = arr;
    stepSats();
  }

  async function loadInfra() {
    const { items } = await getInfrastructure();
    infraRef.current = items.map(it => ({
      lng: it.lng, lat: it.lat, kind: 'infra', color: INFRA_COLOR[it.type] || layerColor('infra'), r: 4, ping: true,
      cx: detailFromInfra(it),
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

  function bindPointers() {
    const cv = canvas.current; if (!cv) return () => {};
    const pts = new Map<number, { x: number; y: number }>();
    let moved = 0; let pinchDist = 0; let pinchScale = 0;
    const dist = () => { const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { draggingRef.current = true; moved = 0; }
      else if (pts.size === 2) { pinchDist = dist(); pinchScale = scaleRef.current; }
    };
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId); if (!prev) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) { const d = dist(); if (pinchDist > 0) { const fit = fitScaleRef.current; scaleRef.current = Math.max(fit * 0.9, Math.min(fit * 6, pinchScale * (d / pinchDist))); } return; }
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
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
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
    let detail: AtlasDetail = d.cx;
    if (d.kind === 'sat') { const s = d as SatDot; detail = detailFromSat(s.name, s.group, s.lat, s.lng, s.alt); }
    setSel(detail);
    if (detail.follow) { followRef.current = d; setTracking(true); }
  }

  const stopFollow = () => { followRef.current = null; setTracking(false); };

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

  return (
    <div ref={wrap} className="relative w-full" style={{ height: 'calc(100dvh - 8.5rem)', minHeight: 420 }}>
      <canvas ref={canvas} className="absolute inset-0 rounded-xl bg-black" style={{ touchAction: 'none' }} />

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
            {LAYER_IDS.map(id => (
              <button key={id} onClick={() => setLayers(l => ({ ...l, [id]: !l[id] }))} className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left">
                <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ background: layers[id] ? layerColor(id) : 'transparent', border: `1px solid ${layerColor(id)}` }} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[11px] font-bold ${layers[id] ? 'text-white' : 'text-white/45'}`}>{layerLabel(id)} <span className="text-[8px] font-black uppercase text-white/30">· ~45s</span></span>
                  <span className="block text-[9px] text-white/35 leading-tight">{layerWhat(id)}</span>
                </span>
              </button>
            ))}
            <div className="flex items-start gap-2 px-2 py-1.5 border-t border-white/5 mt-1">
              <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ background: layerColor('sat') }} />
              <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold text-white">Satellites <span className="text-[8px] font-black uppercase text-calibrex-low/90">· live</span></span><span className="block text-[9px] text-white/35">Always on · orbits move in real time</span></span>
            </div>
          </div>
        )}
      </div>

      {ready && !sel && (
        <div className="absolute bottom-3 left-3 z-10 max-w-[72%] bg-black/55 backdrop-blur border border-white/10 rounded-xl px-3 py-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1">
            {LAYER_IDS.filter(id => layers[id]).map(id => (
              <span key={id} className="inline-flex items-center gap-1.5 text-[10px] text-white/70"><span className="w-2.5 h-2.5 rounded-full" style={{ background: layerColor(id) }} />{layerLabel(id)}</span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[10px] text-white/70"><span className="w-2.5 h-2.5 rounded-full" style={{ background: layerColor('sat') }} />Satellites</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-white/40 font-mono">
            <Radio size={10} className="text-calibrex-low" /> satellites live · points refresh ~45s{lastSync ? ` · synced ${timeAgo(lastSync)}` : ''} · drag to spin · pinch to zoom
          </div>
        </div>
      )}

      {sel && (
        <AtlasDetailCard
          detail={sel}
          onClose={() => setSel(null)}
          onInvestigate={onInvestigate}
          following={tracking}
          onStopFollow={stopFollow}
        />
      )}
    </div>
  );
};

export default LiveEarth3D;
