import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from '../lib/leaflet';
import world from '../lib/world.json';
import { Globe2, Loader2, RefreshCw, Orbit, CloudRain } from 'lucide-react';
import { getWorldmap, WorldmapSnapshot, LayerId, MapPoint } from '../lib/worldmap';
import { openReader, timeAgo } from '../lib/live';
import { addToCase } from '../lib/workbench';
import { getInfrastructure, InfraItem, INFRA_COLOR } from '../lib/infrastructure';
import { loadRecord } from '../lib/api';
import WatchTabs from './WatchTabs';

interface MyAsset { id: string; name: string; lat: number; lng: number; place: string }

const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const BTN = 'margin-top:7px;margin-right:6px;padding:4px 9px;border-radius:6px;font:800 10px system-ui;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;border:0';

// Per-layer colour + default-on. Severity still tints hotspots/conflict/etc.
const LAYERS: { id: LayerId; label: string; color: string; on: boolean }[] = [
  { id: 'hotspots', label: 'Threat hotspots', color: '#ff4444', on: true },
  { id: 'conflict', label: 'Armed conflict', color: '#ff6b6b', on: true },
  { id: 'convergence', label: 'Convergence', color: '#2a8a9a', on: true },
  { id: 'fire', label: 'Active fires', color: '#ff9f45', on: true },
  { id: 'quake', label: 'Earthquakes', color: '#c77dff', on: true },
  { id: 'outages', label: 'Internet outages', color: '#ff7b7b', on: true },
  { id: 'natural', label: 'Natural events', color: '#e9c46a', on: true },
  { id: 'maritime', label: 'Maritime', color: '#48cae4', on: true },
  { id: 'vessels', label: 'Vessels (AIS)', color: '#48cae4', on: false },
  { id: 'aircraft', label: 'Aircraft', color: '#90e0a0', on: false },
];
const SEVC: Record<string, string> = { CRITICAL: '#ff4444', HIGH: '#ff9f45', MEDIUM: '#e9c46a', LOW: '#3ec9a7' };

const GlobalSituation: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [d, setD] = useState<WorldmapSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(LAYERS.map(l => [l.id, l.on])));
  const [infra, setInfra] = useState<InfraItem[]>([]);
  const [infraOn, setInfraOn] = useState(false);
  const [assets, setAssets] = useState<MyAsset[]>([]);
  const [weatherOn, setWeatherOn] = useState(false);
  const [wxUrl, setWxUrl] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef<Record<string, L.LayerGroup>>({});
  const infraGroupRef = useRef<L.LayerGroup | null>(null);
  const assetGroupRef = useRef<L.LayerGroup | null>(null);
  const wxRef = useRef<L.TileLayer | null>(null);

  const load = () => { setLoading(true); getWorldmap().then(setD).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 3 * 60000); return () => clearInterval(t); }, []);
  useEffect(() => { getInfrastructure().then(r => setInfra(r.items)).catch(() => {}); }, []);
  useEffect(() => { loadRecord<MyAsset[]>('atlas_assets', []).then(a => setAssets(Array.isArray(a) ? a : [])).catch(() => {}); }, []);
  // Keyless global precipitation radar (RainViewer, no key) for the weather overlay.
  useEffect(() => {
    fetch('https://api.rainviewer.com/public/weather-maps.json').then(r => r.json()).then(j => {
      const frames = j?.radar?.past || []; const last = frames[frames.length - 1];
      if (j?.host && last?.path) setWxUrl(`${j.host}${last.path}/256/{z}/{x}/{y}/4/1_1.png`);
    }).catch(() => {});
  }, []);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [20, 40], zoom: 2, minZoom: 1, worldCopyJump: true, attributionControl: false, zoomControl: false });
    mapRef.current = map;
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.geoJSON(world as any, { style: { color: 'rgba(42,138,154,0.35)', weight: 1, fillColor: '#0c1a24', fillOpacity: 0.6 } as any }).addTo(map);
    for (const l of LAYERS) groupsRef.current[l.id] = L.layerGroup().addTo(map);
    infraGroupRef.current = L.layerGroup().addTo(map);
    assetGroupRef.current = L.layerGroup().addTo(map);
    // Re-measure a few times: the container can still be laying out (or was
    // off-screen) when the map mounts, which otherwise leaves it blank.
    const timers = [100, 400, 900, 1600].map(ms => setTimeout(() => mapRef.current?.invalidateSize(), ms));
    return () => { timers.forEach(clearTimeout); map.remove(); mapRef.current = null; groupsRef.current = {}; };
  }, []);

  // redraw layers when data or toggles change
  useEffect(() => {
    if (!d || !mapRef.current) return;
    for (const l of LAYERS) {
      const g = groupsRef.current[l.id]; if (!g) continue;
      g.clearLayers();
      if (!on[l.id]) continue;
      // Cap the dense sensor layers so SVG stays responsive to taps (strongest
      // first — fires/quakes come sorted by magnitude/recency from the server).
      const CAP: Record<string, number> = { fire: 350, quake: 300, vessels: 500, aircraft: 300 };
      const pts = (d.layers[l.id] || []).slice(0, CAP[l.id] || 1000);
      for (const p of pts) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        const color = l.id === 'hotspots' || l.id === 'conflict' || l.id === 'maritime' || l.id === 'natural' ? (SEVC[p.severity || ''] || l.color) : l.color;
        const small = l.id === 'aircraft' || l.id === 'vessels';
        const r = small ? 2.5 : p.severity === 'CRITICAL' ? 7 : p.severity === 'HIGH' ? 5 : 4;
        const extra = l.id === 'convergence' ? `${p.streamCount} streams: ${(p.streams || []).join(', ')}` : [p.category, p.magnitude, p.tag].filter(Boolean).join(' · ');
        const m = L.circleMarker([p.lat, p.lng], { radius: r, color, weight: 1, fillColor: color, fillOpacity: l.id === 'aircraft' ? 0.6 : 0.78 });
        const btns = `<div style="margin-top:2px">${p.url ? `<button class="cx-read" style="${BTN};background:#39b0c4;color:#042028">Open source</button>` : ''}<button class="cx-case" style="${BTN};background:#c9a961;color:#0b1522">+ Add to case</button></div>`;
        m.bindPopup(`<div style="min-width:170px"><b>${esc(p.title || l.label)}</b><br><span style="color:#5a6b78;font-size:11px">${esc(extra)}${p.india ? ' · 🇮🇳' : ''}</span>${btns}</div>`);
        // A tap shows the info popup with Open-source (in-app reader) and
        // Add-to-case — turning the map into an investigation surface.
        m.on('popupopen', () => {
          const el = m.getPopup()?.getElement(); if (!el) return;
          const read = el.querySelector('.cx-read') as HTMLElement | null;
          if (read) read.onclick = () => openReader({ url: p.url!, title: p.title || '', source: p.source || '' });
          const cs = el.querySelector('.cx-case') as HTMLElement | null;
          if (cs) cs.onclick = () => { addToCase({ id: 'atlas-' + Date.now().toString(36), title: p.title || l.label, url: p.url || `https://www.google.com/maps?q=${p.lat},${p.lng}`, source: p.source || l.label, severity: p.severity as any, place: p.location || null, published: p.date }); cs.textContent = '✓ Added'; (cs.style as any).background = '#56c877'; };
        });
        m.addTo(g);
      }
    }
  }, [d, on]);

  // strategic infrastructure overlay (square markers, distinct from events)
  useEffect(() => {
    const g = infraGroupRef.current; if (!g) return;
    g.clearLayers();
    if (!infraOn) return;
    for (const it of infra) {
      const color = INFRA_COLOR[it.type];
      const icon = L.divIcon({ className: '', iconSize: [10, 10], html: `<div style="width:9px;height:9px;background:${color};border:1.5px solid #0b1522;transform:rotate(45deg);box-shadow:0 0 0 1px ${color}80"></div>` });
      const m = L.marker([it.lat, it.lng], { icon });
      m.bindPopup(`<div style="min-width:160px"><b>${esc(it.name)}</b><br><span style="color:#5a6b78;font-size:11px;text-transform:uppercase;letter-spacing:.06em">${it.type} · ${esc(it.country)}</span><br><span style="color:#44566a;font-size:11px">${esc(it.note)}</span><div style="margin-top:2px"><button class="cx-case" style="${BTN};background:#c9a961;color:#0b1522">+ Add to case</button></div></div>`);
      m.on('popupopen', () => {
        const el = m.getPopup()?.getElement(); const cs = el?.querySelector('.cx-case') as HTMLElement | null;
        if (cs) cs.onclick = () => { addToCase({ id: 'atlas-' + Date.now().toString(36), title: it.name, url: `https://www.google.com/maps?q=${it.lat},${it.lng}`, source: `Infrastructure · ${it.type}`, place: it.country }); cs.textContent = '✓ Added'; (cs.style as any).background = '#56c877'; };
      });
      m.addTo(g);
    }
  }, [infra, infraOn]);

  // the analyst's own assets (from Asset Exposure) plotted on the map
  useEffect(() => {
    const g = assetGroupRef.current; if (!g) return;
    g.clearLayers();
    for (const a of assets) {
      if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) continue;
      const icon = L.divIcon({ className: '', iconSize: [16, 16], html: `<div style="width:14px;height:14px;border-radius:50%;background:#c9a961;border:2px solid #0b1522;box-shadow:0 0 0 2px #c9a96188"></div>` });
      L.marker([a.lat, a.lng], { icon, zIndexOffset: 1000 })
        .bindPopup(`<div style="min-width:150px"><span style="color:#c9a961;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em">Your site</span><br><b>${esc(a.name)}</b><br><span style="color:#5a6b78;font-size:11px">${esc(a.place)}</span></div>`)
        .addTo(g);
    }
  }, [assets]);

  // weather radar overlay
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (weatherOn && wxUrl) {
      if (wxRef.current) { map.removeLayer(wxRef.current); }
      wxRef.current = L.tileLayer(wxUrl, { opacity: 0.55, zIndex: 350 } as any); wxRef.current.addTo(map);
    } else if (wxRef.current) { map.removeLayer(wxRef.current); wxRef.current = null; }
  }, [weatherOn, wxUrl]);

  const total = useMemo(() => d ? Object.values(d.counts).reduce((a, b) => a + b, 0) : 0, [d]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <WatchTabs current={'geoint' as any} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono font-black text-calibrex-gold uppercase tracking-[0.25em] mb-0.5">Calibrex Atlas</div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Globe2 size={22} className="text-calibrex-teal" /> Global Situation <span className="text-[10px] font-mono text-white/40">2D</span></h1>
          <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Every geolocated stream on one map. Tap a point to read the source or add it to a case{d?.updatedAt ? ` · updated ${timeAgo(d.updatedAt)}` : ''}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'liveearth' }))} className="px-3 py-2 rounded border border-calibrex-teal/40 text-calibrex-teal text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Orbit size={14} /> 3D globe</button>
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {LAYERS.map(l => (
          <button key={l.id} onClick={() => setOn(s => ({ ...s, [l.id]: !s[l.id] }))}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${on[l.id] ? 'bg-white/5 text-white border-white/20' : 'text-white/40 border-white/10'}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color, opacity: on[l.id] ? 1 : 0.3 }} />
            {l.label}<span className="opacity-60 tabular-nums">{d?.counts[l.id] ?? 0}</span>
          </button>
        ))}
        <button onClick={() => setInfraOn(v => !v)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${infraOn ? 'bg-white/5 text-white border-white/20' : 'text-white/40 border-white/10'}`}>
          <span className="w-2.5 h-2.5" style={{ background: '#e9c46a', transform: 'rotate(45deg)', opacity: infraOn ? 1 : 0.3 }} />
          Infrastructure<span className="opacity-60 tabular-nums">{infra.length}</span>
        </button>
        <button onClick={() => setWeatherOn(v => !v)} disabled={!wxUrl} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 disabled:opacity-30 ${weatherOn ? 'bg-white/5 text-white border-white/20' : 'text-white/40 border-white/10'}`}>
          <CloudRain size={13} style={{ opacity: weatherOn ? 1 : 0.5 }} /> Weather
        </button>
        {assets.length > 0 && <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-calibrex-gold/30 text-calibrex-gold flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-calibrex-gold" /> Your sites<span className="opacity-60 tabular-nums">{assets.length}</span></span>}
      </div>

      <div ref={containerRef} className="w-full h-[62vh] min-h-[420px] rounded-2xl border border-white/10 overflow-hidden bg-[#0c1a24]" />
      {!d && <div className="text-center text-calibrex-muted text-sm py-4"><Loader2 className="animate-spin inline mr-2" size={14} /> Loading streams…</div>}
      <p className="text-[10px] text-white/35">{total.toLocaleString()} geolocated signals across {LAYERS.length} layers. Observed reporting and sensor data — not a forecast.</p>
    </div>
  );
};

export default GlobalSituation;
