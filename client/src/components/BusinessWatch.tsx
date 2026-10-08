import React, { useMemo, useState } from 'react';
import { Briefcase, Globe, Flag, Map as MapIcon, Crosshair, Loader2, RefreshCw, BookOpen, Images, ExternalLink, Filter, AlertTriangle, Gauge, TrendingDown, Banknote, Handshake, Crown, FileText, X, Copy, Check } from 'lucide-react';
import { LiveIntel, LiveItem, timeAgo, openReader } from '../lib/live';
import { copyText } from '../lib/api';
import { openVisuals, proxied, mediaThumb } from '../lib/visuals';
import { Area, Axis, Theme, Band, isIndia, areaOf, axisOf, themeOf, isShock, isSignificant, stressOf, balance5050 } from '../lib/business';
import RapidBriefModal from './RapidBriefModal';

interface Props { live: LiveIntel; onInvestigate: (query: string) => void; isOffline?: boolean }

type Lens = 'world' | 'india' | 'area' | 'axis';
type Seg = 'all' | Theme | 'shocks';

const LENSES: { id: Lens; label: string; icon: React.ReactNode }[] = [
  { id: 'world', label: 'World', icon: <Globe size={13} /> },
  { id: 'india', label: 'India', icon: <Flag size={13} /> },
  { id: 'area', label: 'By area', icon: <MapIcon size={13} /> },
  { id: 'axis', label: 'By axis', icon: <Crosshair size={13} /> },
];
const AREA_ORDER: Area[] = ['South Asia', 'East Asia', 'Middle East & Gulf', 'Europe', 'North America', 'Latin America', 'Africa', 'Global'];
const AXIS_ORDER: Axis[] = ['India', 'US & West', 'China', 'Russia & Eurasia', 'Gulf & OPEC', 'Unaligned'];

const BAND_TXT: Record<Band, string> = { CRISIS: 'text-calibrex-critical', STRESS: 'text-calibrex-high', ELEVATED: 'text-calibrex-medium', CALM: 'text-calibrex-low' };
const BAND_BG: Record<Band, string> = { CRISIS: 'bg-calibrex-critical', STRESS: 'bg-calibrex-high', ELEVATED: 'bg-calibrex-medium', CALM: 'bg-calibrex-low' };

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

// Horizontal risk meter: gradient track with a marker at the score position.
const Meter: React.FC<{ score: number; band: Band }> = ({ score, band }) => (
  <div className="relative h-2.5 rounded-full overflow-visible" style={{ background: 'linear-gradient(90deg,#44cc44 0%,#ffcc00 45%,#ff9900 70%,#ff5d5d 100%)' }}>
    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow" style={{ left: `${score}%`, background: 'currentColor' }} aria-label={`${band} ${score}`} />
  </div>
);

const Card: React.FC<{ item: LiveItem; onInvestigate: (q: string) => void }> = ({ item, onInvestigate }) => {
  const theme = themeOf(item);
  return (
    <div role="button" tabIndex={0} onClick={() => openReader({ url: item.url, title: item.title, source: item.source, kind: item.kind, published: item.published })} onKeyDown={(e) => { if (e.key === 'Enter') openReader({ url: item.url, title: item.title, source: item.source, kind: item.kind, published: item.published }); }}
      className="p-3 bg-black/20 rounded-lg border border-white/5 cursor-pointer hover:border-calibrex-gold/50 transition-all flex flex-col gap-1 group" title="Read the full article">
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
          <button onClick={(e) => { e.stopPropagation(); openVisuals({ title: item.title, urls: [item.url], place: item.place?.name, lat: item.place?.lat, lng: item.place?.lng, preload: (item.media || []).map(m => ({ ...m, from: { title: item.title, source: item.source, url: item.url, published: item.published, kind: item.kind } })) }); }} className="text-[9px] font-black text-calibrex-gold hover:underline uppercase inline-flex items-center gap-1 py-0.5" title="Photos & imagery"><Images size={11} /> Visual{item.media?.length ? ` (${item.media.length})` : ''}</button>
          <button onClick={(e) => { e.stopPropagation(); openReader({ url: item.url, title: item.title, source: item.source, kind: item.kind, published: item.published }); }} className="text-[9px] font-black text-calibrex-teal hover:underline uppercase inline-flex items-center gap-1 py-0.5" title="Read the full article"><BookOpen size={11} /> Read</button>
          <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[9px] font-black text-white/40 hover:text-calibrex-teal uppercase inline-flex items-center gap-1 py-0.5">Source <ExternalLink size={11} /></a>
          <button onClick={(e) => { e.stopPropagation(); onInvestigate(item.title); }} className="text-[9px] font-black text-calibrex-navy bg-calibrex-gold/90 hover:bg-calibrex-gold rounded px-2 py-1 uppercase inline-flex items-center gap-1" title="Open in Intelligence Research">Investigate <ExternalLink size={10} /></button>
        </div>
      </div>
    </div>
  );
};

const BusinessWatch: React.FC<Props> = ({ live, onInvestigate, isOffline }) => {
  const [lens, setLens] = useState<Lens>('world');
  const [seg, setSeg] = useState<Seg>('all');
  const [briefOpen, setBriefOpen] = useState(false);
  const feed = live.feeds.BUSINESS;

  // Full de-duped business set (newest first) — drives meters and card counts.
  const all: LiveItem[] = useMemo(() => {
    const seen = new Set<string>();
    return [...feed.items].sort((a, b) => b.published - a.published)
      .filter(i => { const k = i.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
  }, [feed.items]);

  const overall = useMemo(() => stressOf(all), [all]);
  const indiaStress = useMemo(() => stressOf(all.filter(isIndia)), [all]);
  const globalStress = useMemo(() => stressOf(all.filter(i => !isIndia(i))), [all]);

  const segMatch = (i: LiveItem) => seg === 'all' ? true : seg === 'shocks' ? isShock(i) : themeOf(i) === seg;
  const base = useMemo(() => all.filter(segMatch), [all, seg]);

  const worldList = useMemo(() => balance5050(base, isIndia, 80), [base]);
  const indiaList = useMemo(() => base.filter(isIndia).slice(0, 80), [base]);
  const grouped = useMemo(() => {
    const by = (fn: (i: LiveItem) => string) => { const m = new Map<string, LiveItem[]>(); for (const i of base) { const k = fn(i); (m.get(k) || m.set(k, []).get(k)!).push(i); } return m; };
    return { area: by(areaOf), axis: by(axisOf) };
  }, [base]);

  // Severity cards: label, the segment they filter to, count, tone.
  const cards: { label: string; seg: Seg; icon: React.ReactNode; count: number; tone: string }[] = [
    { label: 'Distress & failures', seg: 'Distress & failures', icon: <TrendingDown size={16} />, count: all.filter(i => themeOf(i) === 'Distress & failures').length, tone: 'critical' },
    { label: 'Market shocks', seg: 'shocks', icon: <Gauge size={16} />, count: all.filter(isShock).length, tone: 'high' },
    { label: 'M&A & deals', seg: 'M&A & deals', icon: <Handshake size={16} />, count: all.filter(i => themeOf(i) === 'M&A & deals').length, tone: 'teal' },
    { label: 'Tycoons & oligarchs', seg: 'Tycoons & oligarchs', icon: <Crown size={16} />, count: all.filter(i => themeOf(i) === 'Tycoons & oligarchs').length, tone: 'gold' },
  ];
  const toneCls: Record<string, string> = {
    critical: 'text-calibrex-critical border-calibrex-critical/40', high: 'text-calibrex-high border-calibrex-high/40',
    teal: 'text-calibrex-teal border-calibrex-teal/40', gold: 'text-calibrex-gold border-calibrex-gold/40',
  };

  // Deterministic Rapid Brief (works with no AI connected).
  const topArea = [...grouped.area.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const topAxis = [...grouped.axis.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const briefText = useMemo(() => {
    const signif = all.filter(isSignificant).slice(0, 6);
    const inN = all.filter(isIndia).length, glN = all.length - inN;
    const hotArea = [...stressRank(all, areaOf)][0];
    const hotAxis = [...stressRank(all, axisOf)][0];
    const assess = overall.band === 'CRISIS' ? 'Acute economic stress — multiple failures/shocks in play; expect political and market spillover.'
      : overall.band === 'STRESS' ? 'Elevated stress — distress and shocks clustering; watch for contagion.'
      : overall.band === 'ELEVATED' ? 'Some pressure building; a few notable events but no systemic signal yet.'
      : 'Quiet — routine deal and market flow, no distress cluster.';
    return [
      `RAPID BRIEF — BUSINESS WATCH · ${new Date().toLocaleString()}`,
      ``,
      `SITUATION`,
      `${all.length} business reports in the last 48h (${inN} India / ${glN} global). Business stress ${overall.band} (${overall.score}/100): ${overall.drivers.join(', ')}.`,
      `India stress ${indiaStress.band} (${indiaStress.score}) · Global stress ${globalStress.band} (${globalStress.score}).`,
      ``,
      `KEY SIGNALS`,
      ...(signif.length ? signif.map((i, n) => `${n + 1}. ${i.title} — ${i.source}`) : ['— No high-impact events in window.']),
      ``,
      `HOTSPOTS`,
      `Most active area: ${hotArea ? `${hotArea[0]} (${hotArea[1]})` : '—'}. Most active axis: ${hotAxis ? `${hotAxis[0]} (${hotAxis[1]})` : '—'}.`,
      ``,
      `ASSESSMENT`,
      assess,
    ].join('\n');
  }, [all, overall, indiaStress, globalStress]);

  const loading = feed.loading && all.length === 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Briefcase size={22} className="text-calibrex-gold" /> Business Watch</h1>
          <p className="text-[11px] sm:text-xs text-calibrex-muted mt-1 max-w-2xl">Mergers, distressed companies, business giants, tycoons &amp; oligarchs, money markets — and how their decisions move economies, politics and global power. Weighted 50% India / 50% global.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setBriefOpen(true)} className="flex items-center gap-1.5 bg-calibrex-gold text-calibrex-navy hover:bg-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 shadow"><FileText size={14} /> Rapid Brief</button>
          {isOffline ? <span className="text-[8px] font-black text-calibrex-critical uppercase">Offline</span>
            : <span className="text-[8px] font-mono font-black text-calibrex-low border border-calibrex-low/30 bg-calibrex-low/10 px-1.5 py-0.5 rounded tracking-widest">LIVE</span>}
          <button onClick={live.refresh} disabled={isOffline || live.refreshing} title="Refresh now" className="text-white/40 hover:text-calibrex-gold disabled:opacity-30 p-1">{live.refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
        </div>
      </div>

      {/* Crisis meter */}
      <div className="bg-calibrex-surface border border-white/10 rounded-xl p-4 sm:p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-calibrex-gold flex items-center gap-2"><Gauge size={14} /> Business stress index</h2>
          <span className={`text-sm font-black uppercase ${BAND_TXT[overall.band]}`}>{overall.band} · {overall.score}</span>
        </div>
        <div className={BAND_TXT[overall.band]}><Meter score={overall.score} band={overall.band} /></div>
        <p className="text-[10px] text-calibrex-muted mt-2">{overall.drivers.join(' · ')} over {overall.total} reports (48h). A read on where economic pressure is building — not investment advice.</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {([['India', indiaStress], ['Global', globalStress]] as const).map(([lbl, s]) => (
            <div key={lbl} className="bg-black/20 rounded-lg p-3 border border-white/5">
              <div className="flex items-center justify-between mb-1.5"><span className="text-[10px] font-black uppercase tracking-wider text-white/70 flex items-center gap-1.5">{lbl === 'India' ? <Flag size={11} /> : <Globe size={11} />}{lbl}</span><span className={`text-[10px] font-black uppercase ${BAND_TXT[s.band]}`}>{s.band} · {s.score}</span></div>
              <div className="h-1.5 bg-white/5 rounded"><div className={`h-1.5 rounded ${BAND_BG[s.band]}`} style={{ width: `${s.score}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Crisis severity cards (click to filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {cards.map(c => {
          const active = seg === c.seg;
          return (
            <button key={c.label} onClick={() => setSeg(active ? 'all' : c.seg)} aria-pressed={active}
              className={`text-left bg-calibrex-surface border rounded-xl p-3.5 transition-all active:scale-[0.98] ${active ? `${toneCls[c.tone]} ring-1 ring-current` : 'border-white/10 hover:border-white/25'}`}>
              <div className={`flex items-center justify-between mb-2 ${toneCls[c.tone].split(' ')[0]}`}>{c.icon}<span className="text-2xl font-black tabular-nums text-white">{c.count}</span></div>
              <div className="text-[9px] font-black uppercase tracking-wider text-white/70">{c.label}</div>
              <div className="text-[8px] font-mono text-white/35 mt-0.5">{active ? 'filtering · tap to clear' : 'tap to filter'}</div>
            </button>
          );
        })}
      </div>

      {/* Lenses */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
        {LENSES.map(l => (
          <button key={l.id} onClick={() => setLens(l.id)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 border transition-all ${lens === l.id ? 'bg-calibrex-gold text-calibrex-navy border-calibrex-gold' : 'bg-white/5 text-white/50 border-white/5 hover:border-white/20'}`}>{l.icon}{l.label}</button>
        ))}
        {seg !== 'all' && <button onClick={() => setSeg('all')} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 border border-calibrex-gold/40 text-calibrex-gold bg-calibrex-gold/10"><X size={12} /> {seg === 'shocks' ? 'Market shocks' : seg}</button>}
      </div>

      {feed.error && feed.errorCode !== 'empty' && (
        <div className="px-3 py-2 mb-3 bg-calibrex-high/10 border border-calibrex-high/20 rounded text-[10px] text-calibrex-high font-bold flex items-start gap-2"><AlertTriangle size={12} className="shrink-0 mt-0.5" /><span>{feed.error}</span></div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-calibrex-gold gap-3"><Loader2 size={28} className="animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest">Pulling business wires…</p></div>
      ) : base.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-40 text-center px-4"><Filter size={40} className="mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">{all.length === 0 ? 'No business reports yet' : 'Nothing in this filter'}</p><p className="text-[10px] mt-2">{all.length === 0 ? 'New reports arrive on the 5-minute server pull.' : 'Tap the active card again to clear the filter.'}</p></div>
      ) : lens === 'world' ? (
        <>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">{worldList.length} reports · <span className="text-calibrex-gold">{worldList.filter(isIndia).length} India</span> / {worldList.filter(i => !isIndia(i)).length} global</div>
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

      <RapidBriefModal open={briefOpen} onClose={() => setBriefOpen(false)} domain="Business"
        title={`${overall.band} stress (${overall.score}/100)`} text={briefText}
        sources={(all.filter(isSignificant).slice(0, 8).length ? all.filter(isSignificant) : all).slice(0, 8)} />
    </div>
  );
};

// Count items per group key, return entries sorted by count desc.
function stressRank(items: LiveItem[], fn: (i: LiveItem) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const i of items) m.set(fn(i), (m.get(fn(i)) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export default BusinessWatch;
