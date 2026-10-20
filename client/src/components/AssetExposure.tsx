import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, Plus, Trash2, Loader2, MapPin, Anchor, Factory, AlertTriangle, FolderPlus, ExternalLink, RefreshCw } from 'lucide-react';
import { loadRecord, saveRecord } from '../lib/api';
import { getWorldmap, MapPoint, LayerId } from '../lib/worldmap';
import { getInstability, InstabilityCountry } from '../lib/instability';
import { getInfrastructure, InfraItem, distanceKm } from '../lib/infrastructure';
import { addToCase } from '../lib/workbench';
import { openReader } from '../lib/live';

interface Asset { id: string; name: string; lat: number; lng: number; place: string }

// Bundled location options so analysts can place a site without a geocoder.
const CITIES: { name: string; lat: number; lng: number; country: string }[] = [
  { name: 'Mumbai', lat: 19.08, lng: 72.88, country: 'India' }, { name: 'Delhi', lat: 28.61, lng: 77.21, country: 'India' },
  { name: 'Bengaluru', lat: 12.97, lng: 77.59, country: 'India' }, { name: 'Chennai', lat: 13.08, lng: 80.27, country: 'India' },
  { name: 'Hyderabad', lat: 17.38, lng: 78.49, country: 'India' }, { name: 'Pune', lat: 18.52, lng: 73.86, country: 'India' },
  { name: 'Kolkata', lat: 22.57, lng: 88.36, country: 'India' }, { name: 'Ahmedabad', lat: 23.02, lng: 72.57, country: 'India' },
  { name: 'Gurugram', lat: 28.46, lng: 77.03, country: 'India' }, { name: 'Surat', lat: 21.17, lng: 72.83, country: 'India' },
  { name: 'Dubai', lat: 25.2, lng: 55.27, country: 'UAE' }, { name: 'Singapore', lat: 1.35, lng: 103.82, country: 'Singapore' },
  { name: 'Shanghai', lat: 31.23, lng: 121.47, country: 'China' }, { name: 'Shenzhen', lat: 22.54, lng: 114.06, country: 'China' },
  { name: 'Hong Kong', lat: 22.32, lng: 114.17, country: 'China' }, { name: 'Ho Chi Minh City', lat: 10.82, lng: 106.63, country: 'Vietnam' },
  { name: 'Bangkok', lat: 13.76, lng: 100.5, country: 'Thailand' }, { name: 'Jakarta', lat: -6.21, lng: 106.85, country: 'Indonesia' },
  { name: 'Istanbul', lat: 41.01, lng: 28.98, country: 'Turkey' }, { name: 'Rotterdam', lat: 51.92, lng: 4.48, country: 'Netherlands' },
  { name: 'Hamburg', lat: 53.55, lng: 9.99, country: 'Germany' }, { name: 'London', lat: 51.51, lng: -0.13, country: 'UK' },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24, country: 'USA' }, { name: 'Houston', lat: 29.76, lng: -95.37, country: 'USA' },
  { name: 'New York', lat: 40.71, lng: -74.01, country: 'USA' }, { name: 'São Paulo', lat: -23.55, lng: -46.63, country: 'Brazil' },
  { name: 'Cairo', lat: 30.04, lng: 31.24, country: 'Egypt' }, { name: 'Johannesburg', lat: -26.2, lng: 28.05, country: 'South Africa' },
  { name: 'Riyadh', lat: 24.71, lng: 46.68, country: 'Saudi Arabia' }, { name: 'Tel Aviv', lat: 32.08, lng: 34.78, country: 'Israel' },
];

const RADIUS = 400; // km — "nearby" for risk events
const RISK = { conflict: ['conflict', 'hotspots'], hazard: ['fire', 'quake', 'natural'], maritime: ['maritime', 'vessels'], outage: ['outages'] } as const;
const bandOf = (s: number) => (s >= 70 ? { label: 'CRITICAL', cls: 'text-calibrex-critical', bg: 'bg-calibrex-critical/15 border-calibrex-critical/40' } : s >= 45 ? { label: 'HIGH', cls: 'text-calibrex-high', bg: 'bg-calibrex-high/15 border-calibrex-high/40' } : s >= 22 ? { label: 'ELEVATED', cls: 'text-calibrex-medium', bg: 'bg-calibrex-medium/15 border-calibrex-medium/40' } : { label: 'LOW', cls: 'text-calibrex-low', bg: 'bg-calibrex-low/15 border-calibrex-low/40' });

interface Scored {
  asset: Asset; score: number;
  conflict: number; hazard: number; maritime: number; outage: number;
  region: InstabilityCountry | null;
  nearestChoke?: { it: InfraItem; km: number }; nearestPort?: { it: InfraItem; km: number };
  events: (MapPoint & { _km: number; _layer: string })[];
}

const AssetExposure: React.FC<{ onNotify?: (m: string) => void }> = ({ onNotify }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [world, setWorld] = useState<Record<string, MapPoint[]> | null>(null);
  const [countries, setCountries] = useState<InstabilityCountry[]>([]);
  const [infra, setInfra] = useState<InfraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { loadRecord<Asset[]>('atlas_assets', []).then(a => setAssets(Array.isArray(a) ? a : [])).catch(() => {}); }, []);
  const persist = (next: Asset[]) => { setAssets(next); saveRecord('atlas_assets', next).catch(() => {}); };

  const loadData = () => {
    setLoading(true);
    Promise.allSettled([getWorldmap(), getInstability(), getInfrastructure()]).then(([w, i, f]) => {
      if (w.status === 'fulfilled') setWorld(w.value.layers);
      if (i.status === 'fulfilled') setCountries(i.value.countries);
      if (f.status === 'fulfilled') setInfra(f.value.items);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { loadData(); const t = setInterval(loadData, 3 * 60000); return () => clearInterval(t); }, []);

  const options = useMemo(() => {
    const opts = [
      ...CITIES.map(c => ({ name: c.name, place: c.country, lat: c.lat, lng: c.lng })),
      ...infra.map(i => ({ name: i.name, place: `${i.type} · ${i.country}`, lat: i.lat, lng: i.lng })),
    ];
    const t = q.trim().toLowerCase();
    return (t ? opts.filter(o => o.name.toLowerCase().includes(t) || o.place.toLowerCase().includes(t)) : opts).slice(0, 8);
  }, [q, infra]);

  const addAsset = (o: { name: string; place: string; lat: number; lng: number }) => {
    persist([...assets, { id: 'a-' + Date.now().toString(36), name: o.name, place: o.place, lat: o.lat, lng: o.lng }]);
    setQ(''); setOpen(false); onNotify?.(`Added ${o.name} to your exposure watch.`);
  };
  const removeAsset = (id: string) => persist(assets.filter(a => a.id !== id));

  const scored: Scored[] = useMemo(() => {
    if (!world) return [];
    const nearestOf = (a: Asset, type: string) => {
      let best: { it: InfraItem; km: number } | undefined;
      for (const it of infra) if (it.type === type) { const km = distanceKm(a, it); if (!best || km < best.km) best = { it, km }; }
      return best;
    };
    return assets.map(a => {
      const counts = { conflict: 0, hazard: 0, maritime: 0, outage: 0 };
      const events: (MapPoint & { _km: number; _layer: string })[] = [];
      for (const [bucket, layers] of Object.entries(RISK)) {
        for (const lid of layers as readonly string[]) {
          for (const p of (world[lid as LayerId] || [])) {
            if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
            const km = distanceKm(a, p);
            if (km <= RADIUS) { (counts as any)[bucket]++; events.push({ ...p, _km: km, _layer: lid }); }
          }
        }
      }
      let region: InstabilityCountry | null = null, rbest = Infinity;
      for (const c of countries) { const km = distanceKm(a, c); if (km < 1500 && km < rbest) { rbest = km; region = c; } }
      const nearestChoke = nearestOf(a, 'chokepoint');
      const nearestPort = nearestOf(a, 'port');
      const score = Math.min(100, Math.round(
        counts.conflict * 11 + counts.hazard * 3.5 + counts.maritime * 4 + counts.outage * 6 +
        (region ? region.score * 0.35 : 0) +
        (nearestChoke ? (nearestChoke.km < 200 ? 16 : nearestChoke.km < 500 ? 8 : 0) : 0)
      ));
      events.sort((x, y) => x._km - y._km);
      return { asset: a, score, ...counts, region, nearestChoke, nearestPort, events: events.slice(0, 8) };
    }).sort((x, y) => y.score - x.score);
  }, [assets, world, countries, infra]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono font-black text-calibrex-gold uppercase tracking-[0.25em] mb-0.5">Calibrex Atlas</div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><ShieldAlert size={22} className="text-calibrex-gold" /> Asset Exposure</h1>
          <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Add your sites, suppliers or routes. Calibrex scores each against live conflict, hazards, instability and proximity to chokepoints — observed signal, not a forecast.</p>
        </div>
        <button onClick={loadData} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
      </div>

      {/* add asset */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5">
          <Plus size={16} className="text-calibrex-teal shrink-0" />
          <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Add a site — search a city, port, airport or facility…" className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-white/30" />
        </div>
        {open && options.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-calibrex-surface border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            {options.map((o, i) => (
              <button key={i} onClick={() => addAsset(o)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5">
                <MapPin size={14} className="text-calibrex-teal shrink-0" />
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-white truncate">{o.name}</span><span className="block text-[11px] text-white/45">{o.place}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {assets.length === 0 && !loading && (
        <div className="py-14 text-center flex flex-col items-center gap-3 bg-black/20 rounded-2xl border border-dashed border-white/10">
          <Factory className="text-white/20" size={40} />
          <p className="text-sm font-black text-white/50 uppercase tracking-widest">No assets yet</p>
          <p className="text-[12px] text-white/45 max-w-sm">Add your factories, suppliers, ports or offices above to see their live exposure.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {scored.map(s => {
          const band = bandOf(s.score);
          return (
            <div key={s.asset.id} className={`rounded-2xl border bg-calibrex-surface p-4 ${band.bg}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-black text-white truncate">{s.asset.name}</div>
                  <div className="text-[11px] text-white/45">{s.asset.place} · {s.asset.lat.toFixed(2)}, {s.asset.lng.toFixed(2)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-2xl font-black tabular-nums ${band.cls}`}>{s.score}</div>
                  <div className={`text-[9px] font-black uppercase tracking-widest ${band.cls}`}>{band.label}</div>
                </div>
                <button onClick={() => removeAsset(s.asset.id)} className="text-white/30 hover:text-calibrex-critical shrink-0" title="Remove"><Trash2 size={15} /></button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center">
                <Factor label="Conflict" n={s.conflict} warn={s.conflict > 0} />
                <Factor label="Hazards" n={s.hazard} warn={s.hazard > 2} />
                <Factor label="Maritime" n={s.maritime} warn={s.maritime > 0} />
                <Factor label="Outages" n={s.outage} warn={s.outage > 0} />
              </div>

              <div className="mt-3 space-y-1 text-[11px] text-white/60">
                {s.region && <div className="flex items-center gap-1.5"><AlertTriangle size={12} className="text-calibrex-gold" /> Region instability: <b className="text-white">{s.region.country} {s.region.score}/100 ({s.region.band})</b></div>}
                {s.nearestChoke && <div className="flex items-center gap-1.5"><Anchor size={12} className="text-calibrex-teal" /> Nearest chokepoint: <b className="text-white">{s.nearestChoke.it.name}</b> · {Math.round(s.nearestChoke.km)} km</div>}
                {s.nearestPort && <div className="flex items-center gap-1.5"><Anchor size={12} className="text-calibrex-teal/70" /> Nearest major port: <b className="text-white">{s.nearestPort.it.name}</b> · {Math.round(s.nearestPort.km)} km</div>}
              </div>

              {s.events.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">Nearest live signals (within {RADIUS} km)</div>
                  <div className="space-y-1">
                    {s.events.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="text-white/35 font-mono shrink-0 w-14">{Math.round(e._km)} km</span>
                        <span className="min-w-0 flex-1 truncate text-white/80">{e.title || e._layer}</span>
                        <button onClick={() => addToCase({ id: 'atlas-' + Date.now().toString(36), title: e.title || e._layer, url: e.url || `https://www.google.com/maps?q=${e.lat},${e.lng}`, source: `Exposure · ${s.asset.name}`, severity: e.severity as any, place: e.location || s.asset.place, published: e.date })} className="text-calibrex-gold hover:text-white shrink-0" title="Add to case"><FolderPlus size={13} /></button>
                        {e.url && <button onClick={() => openReader({ url: e.url!, title: e.title || '', source: e.source || 'Atlas' })} className="text-calibrex-teal hover:text-white shrink-0" title="Open source"><ExternalLink size={13} /></button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {assets.length > 0 && <p className="text-[10px] text-white/35">Exposure blends nearby conflict, hazards, maritime and outage signals, regional instability and chokepoint proximity. Observed signal intensity — not a forecast.</p>}
    </div>
  );
};

const Factor: React.FC<{ label: string; n: number; warn: boolean }> = ({ label, n, warn }) => (
  <div className={`rounded-lg border px-2 py-1.5 ${warn ? 'border-calibrex-high/30 bg-calibrex-high/5' : 'border-white/5 bg-black/20'}`}>
    <div className={`text-base font-black tabular-nums ${warn ? 'text-calibrex-high' : 'text-white/70'}`}>{n}</div>
    <div className="text-[8px] font-black uppercase tracking-widest text-white/40">{label}</div>
  </div>
);

export default AssetExposure;
