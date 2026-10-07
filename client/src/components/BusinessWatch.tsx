import React, { useMemo, useState } from 'react';
import { Briefcase, Globe, Flag, Map as MapIcon, Crosshair, Loader2, RefreshCw, BookOpen, Images, ExternalLink, Filter, AlertTriangle } from 'lucide-react';
import { LiveIntel, LiveItem, timeAgo, openReader } from '../lib/live';
import { openVisuals, proxied, mediaThumb } from '../lib/visuals';
import { Area, Axis, Theme, isIndia, areaOf, axisOf, themeOf, balance5050 } from '../lib/business';

interface Props {
  live: LiveIntel;
  onInvestigate: (query: string) => void;
  isOffline?: boolean;
}

type Lens = 'world' | 'india' | 'area' | 'axis';
const LENSES: { id: Lens; label: string; icon: React.ReactNode }[] = [
  { id: 'world', label: 'World', icon: <Globe size={13} /> },
  { id: 'india', label: 'India', icon: <Flag size={13} /> },
  { id: 'area', label: 'By area', icon: <MapIcon size={13} /> },
  { id: 'axis', label: 'By axis', icon: <Crosshair size={13} /> },
];

const THEMES: (Theme | 'All')[] = ['All', 'M&A & deals', 'Distress & failures', 'Tycoons & oligarchs', 'Money markets', 'Insider chatter'];
const AREA_ORDER: Area[] = ['South Asia', 'East Asia', 'Middle East & Gulf', 'Europe', 'North America', 'Latin America', 'Africa', 'Global'];
const AXIS_ORDER: Axis[] = ['India', 'US & West', 'China', 'Russia & Eurasia', 'Gulf & OPEC', 'Unaligned'];

const themeColor = (t: Theme) => {
  switch (t) {
    case 'Distress & failures': return 'text-calibrex-critical border-calibrex-critical/30';
    case 'M&A & deals': return 'text-calibrex-teal border-calibrex-teal/30';
    case 'Tycoons & oligarchs': return 'text-calibrex-gold border-calibrex-gold/30';
    case 'Money markets': return 'text-calibrex-high border-calibrex-high/30';
    case 'Insider chatter': return 'text-calibrex-medium border-calibrex-medium/30';
    default: return 'text-white/50 border-white/10';
  }
};

const Card: React.FC<{ item: LiveItem; onInvestigate: (q: string) => void }> = ({ item, onInvestigate }) => {
  const theme = themeOf(item);
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onInvestigate(item.title)}
      onKeyDown={(e) => { if (e.key === 'Enter') onInvestigate(item.title); }}
      className="p-3 bg-black/20 rounded-lg border border-white/5 cursor-pointer hover:border-calibrex-gold/50 transition-all flex flex-col gap-1 group"
      title="Open in Intelligence Research"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[9px] font-mono text-calibrex-gold uppercase tracking-tighter truncate min-w-0">
          {isIndia(item) ? <Flag size={12} className="shrink-0" /> : <Globe size={12} className="shrink-0" />}
          <span className="truncate">{item.source} • {areaOf(item)}</span>
        </div>
        <span className="text-[9px] text-white/40 font-mono shrink-0" title={new Date(item.published).toLocaleString()}>{timeAgo(item.published)}</span>
      </div>
      <div className="text-[11px] font-bold text-white uppercase leading-tight group-hover:text-calibrex-gold transition-colors">{item.title}</div>
      {item.media && item.media[0] && mediaThumb(item.media[0]) && (
        <img src={proxied(mediaThumb(item.media[0]))} alt="" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} className="mt-1 w-full max-h-40 object-cover rounded border border-white/5" />
      )}
      {item.summary && item.kind !== 'social' && <p className="text-[11px] text-white/60 leading-snug line-clamp-2 normal-case">{item.summary}</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mt-2">
        <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border tracking-widest uppercase ${themeColor(theme)}`}>{theme}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <button onClick={(e) => { e.stopPropagation(); openVisuals({ title: item.title, urls: [item.url], place: item.place?.name, lat: item.place?.lat, lng: item.place?.lng, preload: (item.media || []).map(m => ({ ...m, from: { title: item.title, source: item.source, url: item.url, published: item.published, kind: item.kind } })) }); }} className="text-[9px] font-black text-calibrex-gold hover:underline uppercase inline-flex items-center gap-1 py-0.5" title="Photos & imagery for this report"><Images size={11} /> Visual{item.media?.length ? ` (${item.media.length})` : ''}</button>
          <button onClick={(e) => { e.stopPropagation(); openReader({ url: item.url, title: item.title, source: item.source, kind: item.kind, published: item.published }); }} className="text-[9px] font-black text-calibrex-teal hover:underline uppercase inline-flex items-center gap-1 py-0.5" title="Read the full article here"><BookOpen size={11} /> Read</button>
          <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[9px] font-black text-white/40 hover:text-calibrex-teal uppercase inline-flex items-center gap-1 py-0.5">Source <ExternalLink size={11} /></a>
          <button onClick={(e) => { e.stopPropagation(); onInvestigate(item.title); }} className="text-[9px] font-black text-calibrex-navy bg-calibrex-gold/90 hover:bg-calibrex-gold rounded px-2 py-1 uppercase inline-flex items-center gap-1" title="Open in Intelligence Research">Investigate <ExternalLink size={10} /></button>
        </div>
      </div>
    </div>
  );
};

const BusinessWatch: React.FC<Props> = ({ live, onInvestigate, isOffline }) => {
  const [lens, setLens] = useState<Lens>('world');
  const [theme, setTheme] = useState<Theme | 'All'>('All');
  const feed = live.feeds.BUSINESS;

  // Base set: newest first, de-duplicated by headline, theme-filtered.
  const base: LiveItem[] = useMemo(() => {
    const seen = new Set<string>();
    return [...feed.items]
      .sort((a, b) => b.published - a.published)
      .filter(i => { const k = i.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
      .filter(i => theme === 'All' || themeOf(i) === theme);
  }, [feed.items, theme]);

  const indiaCount = useMemo(() => base.filter(isIndia).length, [base]);
  const worldList = useMemo(() => balance5050(base, isIndia, 80), [base]);
  const indiaList = useMemo(() => base.filter(isIndia).slice(0, 80), [base]);

  const grouped = useMemo(() => {
    const by = (fn: (i: LiveItem) => string) => {
      const m = new Map<string, LiveItem[]>();
      for (const i of base) { const k = fn(i); (m.get(k) || m.set(k, []).get(k)!).push(i); }
      return m;
    };
    return { area: by(areaOf), axis: by(axisOf) };
  }, [base]);

  const loading = feed.loading && base.length === 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Briefcase size={22} className="text-calibrex-gold" /> Business Watch</h1>
          <p className="text-[11px] sm:text-xs text-calibrex-muted mt-1 max-w-2xl">Mergers, distressed companies, business giants, tycoons &amp; oligarchs, money markets — and how their decisions move economies, politics and global power. Weighted 50% India / 50% global.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOffline ? <span className="text-[8px] font-black text-calibrex-critical uppercase">Offline</span>
            : <span className="text-[8px] font-mono font-black text-calibrex-low border border-calibrex-low/30 bg-calibrex-low/10 px-1.5 py-0.5 rounded tracking-widest">LIVE</span>}
          <button onClick={live.refresh} disabled={isOffline || live.refreshing} title="Refresh now" className="text-white/40 hover:text-calibrex-gold disabled:opacity-30 p-1">
            {live.refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {/* Lenses */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
        {LENSES.map(l => (
          <button key={l.id} onClick={() => setLens(l.id)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 border transition-all ${lens === l.id ? 'bg-calibrex-gold text-calibrex-navy border-calibrex-gold' : 'bg-white/5 text-white/50 border-white/5 hover:border-white/20'}`}>{l.icon}{l.label}</button>
        ))}
      </div>

      {/* Theme filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
        {THEMES.map(t => (
          <button key={t} onClick={() => setTheme(t)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 border transition-all ${theme === t ? 'bg-calibrex-teal text-calibrex-navy border-calibrex-teal' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'}`}>{t}</button>
        ))}
      </div>

      {feed.error && feed.errorCode !== 'empty' && (
        <div className="px-3 py-2 mb-3 bg-calibrex-high/10 border border-calibrex-high/20 rounded text-[10px] text-calibrex-high font-bold flex items-start gap-2"><AlertTriangle size={12} className="shrink-0 mt-0.5" /><span>{feed.error}</span></div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-calibrex-gold gap-3"><Loader2 size={28} className="animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest">Pulling business wires…</p></div>
      ) : base.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 opacity-40 text-center px-4"><Filter size={40} className="mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">No business reports in this band yet</p><p className="text-[10px] mt-2">New reports arrive on the 5-minute server pull.</p></div>
      ) : lens === 'world' ? (
        <>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">{worldList.length} reports · <span className="text-calibrex-gold">{worldList.filter(isIndia).length} India</span> / {worldList.filter(i => !isIndia(i)).length} global · {indiaCount} India of {base.length} total</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{worldList.map(i => <Card key={i.id} item={i} onInvestigate={onInvestigate} />)}</div>
        </>
      ) : lens === 'india' ? (
        <>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">{indiaList.length} India-facing business reports</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{indiaList.map(i => <Card key={i.id} item={i} onInvestigate={onInvestigate} />)}</div>
        </>
      ) : (
        <div className="space-y-6">
          {(lens === 'area' ? AREA_ORDER : AXIS_ORDER).map(key => {
            const list = (lens === 'area' ? grouped.area : grouped.axis).get(key as string) || [];
            if (!list.length) return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-calibrex-dark/80 backdrop-blur-sm py-1 z-[1]">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-calibrex-gold">{key}</h2>
                  <span className="text-[9px] font-mono text-white/30">{list.length}</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{list.slice(0, 40).map(i => <Card key={i.id} item={i} onInvestigate={onInvestigate} />)}</div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center mt-8">{isOffline ? 'Offline cache' : 'Server pull every 5 min'} · updated {timeAgo(feed.updatedAt)}</p>
    </div>
  );
};

export default BusinessWatch;
