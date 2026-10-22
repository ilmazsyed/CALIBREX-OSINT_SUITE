import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from '../lib/leaflet';
import world from '../lib/world.json';
import { Globe2, Loader2, RefreshCw, Orbit, CloudRain } from 'lucide-react';
import { getWorldmap, WorldmapSnapshot, LayerId } from '../lib/worldmap';
import { timeAgo } from '../lib/live';
import { getInfrastructure, InfraItem, INFRA_COLOR } from '../lib/infrastructure';
import { loadRecord } from '../lib/api';
import { LAYER_META, layerColor, layerLabel, severityRadius, SEVERITY_COLOR, AtlasDetail, detailFromPoint, detailFromInfra } from '../lib/maplayers';
import AtlasDetailCard from './AtlasDetailCard';
import WatchTabs from './WatchTabs';

interface MyAsset { id: string; name: string; lat: number; lng: number; place: string }

const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Which event layers to show and their default on/off. Colours and labels come
// from the shared LAYER_META so 2D and 3D match exactly.
const LAYER_DEFS: { id: LayerId; on: boolean }[] = [
  { id: 'conflict', on: true }, { id: 'hotspots', on: true }, { id: 'convergence', on: true },
  { id: 'fire', on: true }, { id: 'quake', on: true }, { id: 'outages', on: true },
  { id: 'natural', on: true }, { id: 'maritime', on: true }, { id: 'vessels', on: false }, { id: 'aircraft', on: false },
];

const GlobalSituation: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [d, setD] = useState<WorldmapSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(LAYER_DEFS.map(l => [l.id, l.on])));
  const [infra, setInfra] = useState<InfraItem[]>([]);
  const [infraOn, setInfraOn] = useState(false);
  const [assets, setAssets] = useState<MyAsset[]>([]);
  const [weatherOn, setWeatherOn] = useState(false);
  const [wxUrl, setWxUrl] = useState('');
  const [sel, setSel] = useState<AtlasDetail | null>(null);
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
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.geoJSON(world as any, { style: { color: 'rgba(42,138,154,0.35)', weight: 1, fillColor: '#0c1a24', fillOpacity: 0.6 } as any }).addTo(map);
    for (const l of LAYER_DEFS) groupsRef.current[l.id] = L.layerGroup().addTo(map);
    infraGroupRef.current = L.layerGroup().addTo(map);
    assetGroupRef.current = L.layerGroup().addTo(map);
    map.on('click', () => setSel(null));       // tap empty map closes the card
    const timers = [100, 400, 900, 1600].map(ms => setTimeout(() => mapRef.current?.invalidateSize(), ms));
    return () => { timers.forEach(clearTimeout); map.remove(); mapRef.current = null; groupsRef.current = {}; };
  }, []);

  // redraw event layers when data or toggles change
  useEffect(() => {
    if (!d || !mapRef.current) return;
    for (const l of LAYER_DEFS) {
      const g = groupsRef.current[l.id]; if (!g) continue;
      g.clearLayers();
      if (!on[l.id]) continue;
      const CAP: Record<string, number> = { fire: 350, quake: 300, vessels: 500, aircraft: 300 };
      const pts = (d.layers[l.id] || []).slice(0, CAP[l.id] || 1000);
      const color = layerColor(l.id);                    // colour ALWAYS identifies the layer
      const small = l.id === 'aircraft' || l.id === 'vessels';
      for (const p of pts) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        const sev = (p.severity || '').toUpperCase();
        const r = severityRadius(sev, small ? 2.5 : 4);   // severity shows as SIZE, not colour
        const crit = sev === 'CRITICAL' || sev === 'HIGH';
        const m = L.circleMarker([p.lat, p.lng], {
          radius: r, color: crit ? (SEVERITY_COLOR[sev] || color) : color, weight: crit ? 2 : 1,
          fillColor: color, fillOpacity: small ? 0.6 : 0.82,
        });
        m.on('click', () => setSel(detailFromPoint(l.id, p)));
        m.addTo(g);
      }
    }
  }, [d, on]);

  // strategic infrastructure overlay (diamond markers, distinct shape)
  useEffect(() => {
    const g = infraGroupRef.current; if (!g) return;
    g.clearLayers();
    if (!infraOn) return;
    for (const it of infra) {
      const color = INFRA_COLOR[it.type];
      const icon = L.divIcon({ className: '', iconSize: [12, 12], html: `<div style="width:10px;height:10px;background:${color};border:1.5px solid #0b1522;transform:rotate(45deg);box-shadow:0 0 0 1px ${color}80"></div>` });
      const m = L.marker([it.lat, it.lng], { icon });
      m.on('click', () => setSel(detailFromInfra(it)));
      m.addTo(g);
    }
  }, [infra, infraOn]);

  // the analyst's own assets (from Asset Exposure) plotted on the map
  useEffect(() => {
    const g = assetGroupRef.current; if (!g) return;
    g.clearLayers();
    for (const a of assets) {
      if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) continue;
      const icon = L.divIcon({ className: '', iconSize: [16, 16], html: `<div style="width:14px;height:14px;border-radius:50%;background:#e9bd78;border:2px solid #0b1522;box-shadow:0 0 0 2px #e9bd7888"></div>` });
      L.marker([a.lat, a.lng], { icon, zIndexOffset: 1000 })
        .bindPopup(`<div style="min-width:150px"><span style="color:#e9bd78;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em">Your site</span><br><b>${esc(a.name)}</b><br><span style="color:#5a6b78;font-size:11px">${esc(a.place)}</span></div>`)
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
          <div className="cx-eyebrow mb-0.5">Calibrex Atlas</div>
          <h1 className="font-display text-xl sm:text-2xl text-white tracking-[0.04em] flex items-center gap-2"><Globe2 size={22} className="text-calibrex-teal" /> Global Situation <span className="text-[10px] font-mono text-white/40">2D</span></h1>
          <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Every geolocated stream on one map. Tap a point to see what it is and act on it{d?.updatedAt ? ` · updated ${timeAgo(d.updatedAt)}` : ''}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'liveearth' }))} className="px-3 py-2 rounded border border-calibrex-teal/40 text-calibrex-teal text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Orbit size={14} /> 3D globe</button>
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {LAYER_DEFS.map(l => (
          <button key={l.id} onClick={() => setOn(s => ({ ...s, [l.id]: !s[l.id] }))}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${on[l.id] ? 'bg-white/5 text-white border-white/20' : 'text-white/40 border-white/10'}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: layerColor(l.id), opacity: on[l.id] ? 1 : 0.3 }} />
            {layerLabel(l.id)}<span className="opacity-60 tabular-nums">{d?.counts[l.id] ?? 0}</span>
          </button>
        ))}
        <button onClick={() => setInfraOn(v => !v)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${infraOn ? 'bg-white/5 text-white border-white/20' : 'text-white/40 border-white/10'}`}>
          <span className="w-2.5 h-2.5" style={{ background: LAYER_META.infra.color, transform: 'rotate(45deg)', opacity: infraOn ? 1 : 0.3 }} />
          Infrastructure<span className="opacity-60 tabular-nums">{infra.length}</span>
        </button>
        <button onClick={() => setWeatherOn(v => !v)} disabled={!wxUrl} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 disabled:opacity-30 ${weatherOn ? 'bg-white/5 text-white border-white/20' : 'text-white/40 border-white/10'}`}>
          <CloudRain size={13} style={{ opacity: weatherOn ? 1 : 0.5 }} /> Weather
        </button>
        {assets.length > 0 && <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-calibrex-gold/30 text-calibrex-gold flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-calibrex-gold" /> Your sites<span className="opacity-60 tabular-nums">{assets.length}</span></span>}
      </div>

      <div className="relative w-full h-[62vh] min-h-[420px] rounded-2xl border border-white/10 overflow-hidden bg-[#0c1a24]">
        <div ref={containerRef} className="absolute inset-0 z-0" />
        {sel && <AtlasDetailCard detail={sel} onClose={() => setSel(null)} onInvestigate={onInvestigate} />}
      </div>
      {!d && <div className="text-center text-calibrex-muted text-sm py-4"><Loader2 className="animate-spin inline mr-2" size={14} /> Loading streams…</div>}
      <p className="text-[10px] text-white/35">{total.toLocaleString()} geolocated signals across {LAYER_DEFS.length} layers. Colour marks the layer; dot size marks severity. Observed reporting and sensor data — not a forecast.</p>
    </div>
  );
};

export default GlobalSituation;
