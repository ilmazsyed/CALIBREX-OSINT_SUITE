import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from '../lib/leaflet';
import world from '../lib/world.json';
import { Globe2, Loader2, RefreshCw } from 'lucide-react';
import { getWorldmap, WorldmapSnapshot, LayerId, MapPoint } from '../lib/worldmap';
import { openReader, timeAgo } from '../lib/live';
import WatchTabs from './WatchTabs';

// Per-layer colour + default-on. Severity still tints hotspots/conflict/etc.
const LAYERS: { id: LayerId; label: string; color: string; on: boolean }[] = [
  { id: 'hotspots', label: 'Threat hotspots', color: '#ff4444', on: true },
  { id: 'conflict', label: 'Armed conflict', color: '#ff6b6b', on: true },
  { id: 'convergence', label: 'Convergence', color: '#2a8a9a', on: true },
  { id: 'fire', label: 'Active fires', color: '#ff9f45', on: true },
  { id: 'quake', label: 'Earthquakes', color: '#c77dff', on: true },
  { id: 'natural', label: 'Natural events', color: '#e9c46a', on: true },
  { id: 'maritime', label: 'Maritime', color: '#48cae4', on: true },
  { id: 'aircraft', label: 'Aircraft', color: '#90e0a0', on: false },
];
const SEVC: Record<string, string> = { CRITICAL: '#ff4444', HIGH: '#ff9f45', MEDIUM: '#e9c46a', LOW: '#3ec9a7' };

const GlobalSituation: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [d, setD] = useState<WorldmapSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(LAYERS.map(l => [l.id, l.on])));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef<Record<string, L.LayerGroup>>({});

  const load = () => { setLoading(true); getWorldmap().then(setD).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 3 * 60000); return () => clearInterval(t); }, []);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [20, 40], zoom: 2, minZoom: 1, worldCopyJump: true, attributionControl: false, zoomControl: false });
    mapRef.current = map;
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.geoJSON(world as any, { style: { color: 'rgba(42,138,154,0.35)', weight: 1, fillColor: '#0c1a24', fillOpacity: 0.6 } as any }).addTo(map);
    for (const l of LAYERS) groupsRef.current[l.id] = L.layerGroup().addTo(map);
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; groupsRef.current = {}; };
  }, []);

  // redraw layers when data or toggles change
  useEffect(() => {
    if (!d || !mapRef.current) return;
    for (const l of LAYERS) {
      const g = groupsRef.current[l.id]; if (!g) continue;
      g.clearLayers();
      if (!on[l.id]) continue;
      for (const p of (d.layers[l.id] || [])) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        const color = l.id === 'hotspots' || l.id === 'conflict' || l.id === 'maritime' || l.id === 'natural' ? (SEVC[p.severity || ''] || l.color) : l.color;
        const r = l.id === 'aircraft' ? 2.5 : p.severity === 'CRITICAL' ? 7 : p.severity === 'HIGH' ? 5 : 4;
        const extra = l.id === 'convergence' ? `${p.streamCount} streams: ${(p.streams || []).join(', ')}` : [p.category, p.magnitude, p.tag].filter(Boolean).join(' · ');
        const m = L.circleMarker([p.lat, p.lng], { radius: r, color, weight: 1, fillColor: color, fillOpacity: l.id === 'aircraft' ? 0.6 : 0.78 })
          .bindPopup(`<b>${p.title || l.label}</b><br>${extra}${p.india ? ' · 🇮🇳' : ''}${p.url ? `<br><a href="${p.url}" target="_blank" rel="noopener noreferrer">source ↗</a>` : ''}`);
        m.on('click', () => { if (p.url) openReader({ url: p.url, title: p.title || '', source: p.source || '' }); else if (p.title) onInvestigate(p.title); });
        m.addTo(g);
      }
    }
  }, [d, on]);

  const total = useMemo(() => d ? Object.values(d.counts).reduce((a, b) => a + b, 0) : 0, [d]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <WatchTabs current={'geoint' as any} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Globe2 size={22} className="text-calibrex-teal" /> Global Situation</h1>
          <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Every geolocated stream on one map — threats, conflict, fires, quakes, natural events, maritime, aircraft and cross-stream convergences{d?.updatedAt ? ` · updated ${timeAgo(d.updatedAt)}` : ''}.</p>
        </div>
        <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {LAYERS.map(l => (
          <button key={l.id} onClick={() => setOn(s => ({ ...s, [l.id]: !s[l.id] }))}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${on[l.id] ? 'bg-white/5 text-white border-white/20' : 'text-white/40 border-white/10'}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color, opacity: on[l.id] ? 1 : 0.3 }} />
            {l.label}<span className="opacity-60 tabular-nums">{d?.counts[l.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div ref={containerRef} className="w-full h-[62vh] min-h-[420px] rounded-2xl border border-white/10 overflow-hidden bg-[#0c1a24]" />
      {!d && <div className="text-center text-calibrex-muted text-sm py-4"><Loader2 className="animate-spin inline mr-2" size={14} /> Loading streams…</div>}
      <p className="text-[10px] text-white/35">{total.toLocaleString()} geolocated signals across {LAYERS.length} layers. Observed reporting and sensor data — not a forecast.</p>
    </div>
  );
};

export default GlobalSituation;
