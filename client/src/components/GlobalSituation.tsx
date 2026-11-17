import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from '../lib/leaflet';
import world from '../lib/world.json';
import { Globe2, Loader2, RefreshCw, Orbit, CloudRain, LocateFixed, Flag, AlertTriangle, Search } from 'lucide-react';
import { getUserGeo, requestGeo, useUserGeo } from '../lib/geo';
import { getWorldmap, WorldmapSnapshot, LayerId } from '../lib/worldmap';
import { timeAgo } from '../lib/live';
import { getInfrastructure, InfraItem, INFRA_COLOR } from '../lib/infrastructure';
import { loadRecord, localPref, setLocalPref } from '../lib/api';
import { LAYER_META, layerColor, layerLabel, severityRadius, SEVERITY_COLOR, AtlasDetail, detailFromPoint, detailFromInfra } from '../lib/maplayers';
import AtlasDetailCard from './AtlasDetailCard';
import { fitIndia } from '../lib/mapview';
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
  const [timeWindow, setTimeWindow] = useState('24');
  const [bookmarks, setBookmarks] = useState<{id:string;name:string;center:[number,number];zoom:number}[]>(() => localPref('atlas_map_bookmarks', []));
  const [bookmarkSync, setBookmarkSync] = useState<'loading'|'synced'|'local'>('loading');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef<Record<string, L.LayerGroup>>({});
  const infraGroupRef = useRef<L.LayerGroup | null>(null);
  const assetGroupRef = useRef<L.LayerGroup | null>(null);
  const wxRef = useRef<L.TileLayer | null>(null);
  const meGroupRef = useRef<L.LayerGroup | null>(null);
  const geo = useUserGeo();

  const load = () => { setLoading(true); getWorldmap().then(setD).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 3 * 60000); return () => clearInterval(t); }, []);
  useEffect(() => { getInfrastructure().then(r => setInfra(r.items)).catch(() => {}); }, []);
  useEffect(() => { loadRecord<MyAsset[]>('atlas_assets', []).then(a => setAssets(Array.isArray(a) ? a : [])).catch(() => {}); }, []);
  useEffect(() => { loadRecord<typeof bookmarks>('atlas_map_bookmarks', []).then(saved => { if (Array.isArray(saved)) { setBookmarks(saved); setLocalPref('atlas_map_bookmarks', saved); setBookmarkSync('synced'); } else setBookmarkSync('local'); }).catch(() => setBookmarkSync('local')); }, []);
  useEffect(() => {
    fetch('https://api.rainviewer.com/public/weather-maps.json').then(r => r.json()).then(j => {
      const frames = j?.radar?.past || []; const last = frames[frames.length - 1];
      if (j?.host && last?.path) setWxUrl(`${j.host}${last.path}/256/{z}/{x}/{y}/4/1_1.png`);
    }).catch(() => {});
  }, []);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const g0 = getUserGeo();                            // start on the user's area when known
    const map = L.map(containerRef.current, { center: g0 ? [g0.lat, g0.lng] : [20, 40], zoom: g0 ? 5 : 2, minZoom: 1, worldCopyJump: true, attributionControl: false, zoomControl: false });
    mapRef.current = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.geoJSON(world as any, { style: { color: 'rgba(42,138,154,0.35)', weight: 1, fillColor: '#0c1a24', fillOpacity: 0.6 } as any }).addTo(map);
    for (const l of LAYER_DEFS) groupsRef.current[l.id] = L.layerGroup().addTo(map);
    infraGroupRef.current = L.layerGroup().addTo(map);
    assetGroupRef.current = L.layerGroup().addTo(map);
    meGroupRef.current = L.layerGroup().addTo(map);
    map.on('click', () => setSel(null));       // tap empty map closes the card
    const timers = [100, 400, 900, 1600].map(ms => setTimeout(() => mapRef.current?.invalidateSize(), ms));
    return () => { timers.forEach(clearTimeout); map.remove(); mapRef.current = null; groupsRef.current = {}; };
  }, []);

  const visibleSnapshot = useMemo(() => {
    if (!d || timeWindow === 'all') return d;
    const cutoff = Date.now() - Number(timeWindow) * 60 * 60 * 1000;
    const layers = Object.fromEntries(Object.entries(d.layers).map(([id, points]) => [id, points.filter(p => !p.date || p.date >= cutoff)])) as WorldmapSnapshot['layers'];
    return { ...d, layers, counts: Object.fromEntries(Object.entries(layers).map(([id, points]) => [id, points.length])) as WorldmapSnapshot['counts'] };
  }, [d, timeWindow]);

  const saveMapBookmark = () => {
    const map = mapRef.current; if (!map) return;
    const name = window.prompt('Name this map view (e.g. Eastern India, Arabian Sea):');
    if (!name?.trim()) return;
    const center = map.getCenter();
    const next = [{ id: Date.now().toString(36), name: name.trim().slice(0,50), center: [center.lat, center.lng] as [number,number], zoom: map.getZoom() }, ...bookmarks].slice(0,20);
    setBookmarks(next); setLocalPref('atlas_map_bookmarks', next); saveRecord('atlas_map_bookmarks', next).then(ok => setBookmarkSync(ok ? 'synced' : 'local'));
  };
  const openMapBookmark = (id:string) => { const b = bookmarks.find(x => x.id === id); if (b && mapRef.current) mapRef.current.flyTo(b.center, b.zoom, { duration: 0.8 }); };
  const removeMapBookmark = (id:string) => { const next = bookmarks.filter(x => x.id !== id); setBookmarks(next); setLocalPref('atlas_map_bookmarks', next); saveRecord('atlas_map_bookmarks', next).then(ok => setBookmarkSync(ok ? 'synced' : 'local')); };

  // redraw event layers when data or toggles change
  useEffect(() => {
    if (!visibleSnapshot || !mapRef.current) return;
    for (const l of LAYER_DEFS) {
      const g = groupsRef.current[l.id]; if (!g) continue;
      g.clearLayers();
      if (!on[l.id]) continue;
      const CAP: Record<string, number> = { fire: 350, quake: 300, vessels: 500, aircraft: 300 };
      const pts = (visibleSnapshot.layers[l.id] || []).slice(0, CAP[l.id] || 1000);
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
  }, [visibleSnapshot, on]);

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

  // "you are here" marker (coarse device location)
  useEffect(() => {
    const g = meGroupRef.current; if (!g) return;
    g.clearLayers();
    if (!geo) return;
    const icon = L.divIcon({ className: '', iconSize: [18, 18], html: `<div style="width:14px;height:14px;border-radius:50%;background:#2a8a9a;border:2px solid #eaf6ff;box-shadow:0 0 0 4px #2a8a9a44,0 0 14px #2a8a9a"></div>` });
    L.marker([geo.lat, geo.lng], { icon, zIndexOffset: 1200 }).bindPopup('<b>Your area</b><br><span style="color:#5a6b78;font-size:11px">Approximate — used only to centre and rank nearby signals.</span>').addTo(g);
  }, [geo]);

  const nearMe = async () => {
    const map = mapRef.current; if (!map) return;
    const g = getUserGeo() || await requestGeo();
    if (g) map.flyTo([g.lat, g.lng], 6, { duration: 1.1 });
  };

  // weather radar overlay
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (weatherOn && wxUrl) {
      if (wxRef.current) { map.removeLayer(wxRef.current); }
      wxRef.current = L.tileLayer(wxUrl, { opacity: 0.55, zIndex: 350 } as any); wxRef.current.addTo(map);
    } else if (wxRef.current) { map.removeLayer(wxRef.current); wxRef.current = null; }
  }, [weatherOn, wxUrl]);

  const total = useMemo(() => visibleSnapshot ? Object.values(visibleSnapshot.counts).reduce((a, b) => a + b, 0) : 0, [visibleSnapshot]);
  const prioritySignals = useMemo(() => {
    if (!visibleSnapshot) return [];
    return [...(visibleSnapshot.layers.convergence || []), ...(visibleSnapshot.layers.conflict || []), ...(visibleSnapshot.layers.hotspots || []), ...(visibleSnapshot.layers.outages || [])]
      .filter(p => ['CRITICAL', 'HIGH'].includes(String(p.severity || '').toUpperCase()))
      .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.date || 0) - (a.date || 0))
      .slice(0, 4);
  }, [visibleSnapshot]);
  const criticalCount = prioritySignals.filter(p => String(p.severity).toUpperCase() === 'CRITICAL').length;
  const convergenceCount = visibleSnapshot?.counts.convergence || 0;

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
          <button onClick={() => mapRef.current && fitIndia(mapRef.current)} title="Show the full Indian map, including Jammu & Kashmir and Ladakh" className="px-3 py-2 rounded border border-calibrex-gold/40 text-calibrex-gold text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Flag size={14} /> India · Full map</button>
          <button onClick={nearMe} title="Centre on my area" className={`px-3 py-2 rounded border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${geo ? 'border-calibrex-teal/40 text-calibrex-teal' : 'border-white/15 text-white/70'}`}><LocateFixed size={14} /> Near me</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'liveearth' }))} className="px-3 py-2 rounded border border-calibrex-teal/40 text-calibrex-teal text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Orbit size={14} /> 3D globe</button>
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-calibrex-surface p-3">
          <div className="text-[9px] font-black uppercase tracking-widest text-white/45 mb-1">Priority signals</div>
          <div className="flex items-baseline gap-2"><span className="text-2xl font-black text-calibrex-critical tabular-nums">{criticalCount}</span><span className="text-xs text-white/55">critical · {prioritySignals.length} high/critical leads</span></div>
          <p className="text-[10px] text-white/40 mt-1">Severity is a triage indicator, not a verified threat assessment.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-calibrex-surface p-3">
          <div className="text-[9px] font-black uppercase tracking-widest text-white/45 mb-1">Signal convergence</div>
          <div className="flex items-baseline gap-2"><span className="text-2xl font-black text-calibrex-gold tabular-nums">{convergenceCount}</span><span className="text-xs text-white/55">locations with overlapping streams</span></div>
          <p className="text-[10px] text-white/40 mt-1">Convergence highlights areas for independent corroboration.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-calibrex-surface p-3">
          <div className="text-[9px] font-black uppercase tracking-widest text-white/45 mb-1">Collection picture</div>
          <div className="flex items-baseline gap-2"><span className="text-2xl font-black text-calibrex-teal tabular-nums">{total.toLocaleString()}</span><span className="text-xs text-white/55">geolocated observations</span></div>
          <p className="text-[10px] text-white/40 mt-1">Counts are records, not unique incidents or confirmed events.</p>
        </div>
      </section>

      {prioritySignals.length > 0 && <section className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2"><AlertTriangle size={14} className="text-calibrex-high" /> Analyst attention queue</h2>
          <span className="text-[9px] text-white/35">Highest-priority located leads</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {prioritySignals.map((p, i) => {
            const layer: LayerId = (d?.layers.convergence || []).includes(p) ? 'convergence' : (d?.layers.conflict || []).includes(p) ? 'conflict' : (d?.layers.hotspots || []).includes(p) ? 'hotspots' : 'outages';
            return <button key={(p.title || 'signal') + i} onClick={() => setSel(detailFromPoint(layer, p))} className="text-left rounded-lg border border-white/10 bg-white/[0.03] p-3 hover:border-calibrex-teal/40 transition-colors">
              <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-widest text-calibrex-high">{p.severity || 'Signal'}</span><span className="text-[9px] text-white/35">{p.source || 'Public source'}</span></div>
              <div className="text-xs font-bold text-white mt-1 line-clamp-2">{p.title || 'Untitled signal'}</div>
              <div className="text-[10px] text-white/45 mt-1">{p.location || 'Location not specified'}{p.date ? ' · ' + timeAgo(p.date) : ''}</div>
              <div className="text-[9px] text-calibrex-teal mt-2 flex items-center gap-1"><Search size={11}/> Inspect signal</div>
            </button>;
          })}
        </div>
      </section>}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
        <label className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Time window
          <select aria-label="Atlas time window" value={timeWindow} onChange={e => setTimeWindow(e.target.value)} className="ml-2 bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white">
            <option value="6">Last 6 hours</option><option value="24">Last 24 hours</option><option value="72">Last 3 days</option><option value="168">Last 7 days</option><option value="all">All available</option>
          </select>
        </label>
        <button onClick={saveMapBookmark} className="px-2.5 py-1.5 rounded-lg border border-calibrex-gold/35 text-calibrex-gold text-[10px] font-black uppercase tracking-widest">Save map view</button>
        <span className="text-[9px] text-white/35">{bookmarkSync === 'synced' ? 'Synced to your account' : bookmarkSync === 'loading' ? 'Loading saved views…' : 'Saved on this device only'}</span>
        {bookmarks.length > 0 && <label className="text-[10px] text-white/50">Saved views
          <select defaultValue="" onChange={e => { if(e.target.value) openMapBookmark(e.target.value); e.currentTarget.value=''; }} className="ml-2 bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white">
            <option value="">Choose view…</option>{bookmarks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>}
        {bookmarks.length > 0 && <div className="flex flex-wrap gap-1">{bookmarks.map(b => <button key={b.id} title="Remove saved map view" onClick={() => removeMapBookmark(b.id)} className="text-[9px] text-white/35 hover:text-calibrex-critical px-1">{b.name} ×</button>)}</div>}
      </div>

      <div className="flex flex-wrap gap-2">
        {LAYER_DEFS.map(l => (
          <button key={l.id} onClick={() => setOn(s => ({ ...s, [l.id]: !s[l.id] }))}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${on[l.id] ? 'bg-white/5 text-white border-white/20' : 'text-white/40 border-white/10'}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: layerColor(l.id), opacity: on[l.id] ? 1 : 0.3 }} />
            {layerLabel(l.id)}<span className="opacity-60 tabular-nums">{visibleSnapshot?.counts[l.id] ?? 0}</span>
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
      <p className="text-[10px] text-white/35">Observed public reporting and sensor data only. Multiple streams may repeat the same event; independent corroboration and analyst review are required. These indicators are not attribution or forecasts.</p>
    </div>
  );
};

export default GlobalSituation;
