import React, { useEffect, useMemo, useState } from 'react';
import { Globe2, Loader2, RefreshCw, AlertTriangle, Flame, Flag, FileText, ExternalLink } from 'lucide-react';
import { getGeoint, GeointSnapshot, GeoEvent } from '../lib/geoint';
import { openReader, timeAgo } from '../lib/live';
import WatchTabs from './WatchTabs';
import RapidBriefModal from './RapidBriefModal';

const SEV_CLS: Record<string, string> = {
  CRITICAL: 'text-calibrex-critical border-calibrex-critical/40',
  HIGH: 'text-calibrex-high border-calibrex-high/40',
  MEDIUM: 'text-calibrex-gold border-calibrex-gold/40',
  LOW: 'text-calibrex-low border-calibrex-low/40',
};

const EarthWatch: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [d, setD] = useState<GeointSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<string>('all');
  const [indiaOnly, setIndiaOnly] = useState(false);
  const [brief, setBrief] = useState<{ title: string; text: string; sources: { title: string; source: string; url: string; published?: number }[] } | null>(null);

  const load = () => { setLoading(true); getGeoint().then(x => { setD(x); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 5 * 60000); return () => clearInterval(t); }, []);

  const cats = useMemo(() => d ? Object.entries(d.byCategory).sort((a, b) => b[1] - a[1]) : [], [d]);
  const events = useMemo(() => {
    let list = d?.events || [];
    if (cat !== 'all') list = list.filter(e => e.category === cat);
    if (indiaOnly) list = list.filter(e => e.india);
    return list;
  }, [d, cat, indiaOnly]);
  const indiaCount = d?.events.filter(e => e.india).length || 0;
  const critHigh = d?.events.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH').length || 0;

  const open = (e: GeoEvent) => { if (e.url) openReader({ url: e.url, title: e.title, source: e.source }); };

  const compileBrief = () => {
    const list = events.slice(0, 20);
    const lines = [
      `EARTH WATCH — GEOINT BRIEF${indiaOnly ? ' (INDIA)' : ''}`,
      `${list.length} active natural events${cat !== 'all' ? ` · ${cat}` : ''}. Compiled ${new Date().toLocaleString()}.`,
      `Source: NASA EONET open natural-event feed — observed events with agency source links, not a forecast.`,
      ``, `EVENTS`,
      ...list.map((e, i) => `${i + 1}. [${e.category}] ${e.title}${e.magnitude ? ` (${e.magnitude})` : ''}${e.india ? ' — India' : ''} · ${new Date(e.date).toLocaleDateString()}`),
      ``, `SOURCES`,
      ...list.filter(e => e.url).map((e, i) => `[${i + 1}] ${e.url}`),
    ];
    setBrief({ title: `Earth Watch GEOINT Brief${indiaOnly ? ' (India)' : ''}`, text: lines.join('\n'), sources: list.filter(e => e.url).map(e => ({ title: e.title, source: e.source, url: e.url, published: e.date })) });
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <WatchTabs current="geoint" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Globe2 size={22} className="text-calibrex-teal" /> Earth Watch <span className="text-[10px] font-mono text-white/35 tracking-widest">GEOINT</span></h1>
          <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Live natural-event geospatial intelligence — wildfires, volcanoes, severe storms, floods and more, from NASA's open EONET feed{d?.updatedAt ? ` · updated ${timeAgo(d.updatedAt)}` : ''}. Every event links to its reporting agency.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={compileBrief} disabled={!d?.events.length} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-calibrex-teal text-calibrex-navy hover:bg-white active:scale-95 disabled:opacity-40"><FileText size={14} /> Rapid Brief</button>
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
        </div>
      </div>

      {error && <p className="text-sm text-calibrex-critical flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</p>}

      {!d ? <div className="py-20 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div> : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-calibrex-surface p-3">
              <div className="text-[9px] font-black text-white/40 uppercase tracking-widest">Active events</div>
              <div className="text-2xl font-black text-white">{d.events.length}</div>
            </div>
            <div className="rounded-xl border border-calibrex-high/30 bg-calibrex-surface p-3">
              <div className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1"><Flame size={11} className="text-calibrex-high" /> High / critical</div>
              <div className="text-2xl font-black text-calibrex-high">{critHigh}</div>
            </div>
            <button onClick={() => setIndiaOnly(v => !v)} className={`rounded-xl border p-3 text-left transition-colors ${indiaOnly ? 'border-calibrex-gold/60 bg-calibrex-gold/10' : 'border-white/10 bg-calibrex-surface hover:bg-white/5'}`}>
              <div className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1"><Flag size={11} className="text-calibrex-gold" /> India {indiaOnly ? '· on' : ''}</div>
              <div className="text-2xl font-black text-calibrex-gold">{indiaCount}</div>
            </button>
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            <button onClick={() => setCat('all')} className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border ${cat === 'all' ? 'bg-calibrex-teal/15 border-calibrex-teal/50 text-calibrex-teal' : 'border-white/10 text-calibrex-muted hover:text-white'}`}>All ({d.events.length})</button>
            {cats.map(([c, n]) => (
              <button key={c} onClick={() => setCat(c)} className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border ${cat === c ? 'bg-calibrex-teal/15 border-calibrex-teal/50 text-calibrex-teal' : 'border-white/10 text-calibrex-muted hover:text-white'}`}>{c} ({n})</button>
            ))}
          </div>

          <GeoMapLazy events={events} onPick={open} />

          {/* Event list */}
          <div className="space-y-2">
            {events.length === 0 ? <p className="text-[11px] text-white/40 py-6 text-center">No events match this filter.</p> : events.slice(0, 120).map(e => (
              <div key={e.id} className="flex items-center gap-3 p-3 bg-calibrex-surface border border-white/5 rounded-lg hover:border-white/20 transition-colors">
                <span className={`shrink-0 text-[8px] font-black uppercase px-2 py-1 rounded-full border ${SEV_CLS[e.severity]}`}>{e.category}</span>
                <button onClick={() => onInvestigate(e.title)} className="min-w-0 flex-1 text-left" title="Investigate">
                  <span className="block text-[13px] text-white truncate">{e.title}{e.india && <Flag size={11} className="inline ml-1 text-calibrex-gold" />}</span>
                  <span className="block text-[10px] font-mono text-white/35">{e.magnitude ? e.magnitude + ' · ' : ''}{timeAgo(e.date)} · {e.source}</span>
                </button>
                {e.url && <button onClick={() => open(e)} className="shrink-0 p-1.5 text-calibrex-muted hover:text-calibrex-teal" title="Open source"><ExternalLink size={14} /></button>}
              </div>
            ))}
          </div>
        </>
      )}

      <RapidBriefModal open={!!brief} onClose={() => setBrief(null)} domain="GEOINT" accent="teal" title={brief?.title || ''} text={brief?.text || ''} sources={brief?.sources || []} />
    </div>
  );
};

// GeoMap pulls in Leaflet; load it lazily so the screen paints instantly.
const GeoMapInner = React.lazy(() => import('./GeoMap'));
const GeoMapLazy: React.FC<{ events: GeoEvent[]; onPick: (e: GeoEvent) => void }> = ({ events, onPick }) => (
  <React.Suspense fallback={<div className="w-full h-[420px] rounded-lg border border-white/10 bg-[#0c1a24] flex items-center justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>}>
    <GeoMapInner events={events} onPick={onPick} />
  </React.Suspense>
);

export default EarthWatch;
