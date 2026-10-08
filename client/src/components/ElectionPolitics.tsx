import React, { useMemo, useState } from 'react';
import { Vote, Users, Globe, Flag, Map as MapIcon, Crosshair, Gauge, TrendingUp, TrendingDown, Minus, FileText, BookOpen, ExternalLink, Loader2, RefreshCw, Filter, AlertTriangle, X, Copy, Check, BarChart3 } from 'lucide-react';
import { LiveIntel, LiveItem, timeAgo, openReader } from '../lib/live';
import { copyText } from '../lib/api';
import { balance5050, Band } from '../lib/business';
import { Area, Axis, PolType, Momentum, LEADERS, PARTIES, isIndia, areaOf, axisOf, countryOf, typeOf, momentumBoard, isElection, electionStage, isSignificant, countryStress } from '../lib/politics';
import RapidBriefModal from './RapidBriefModal';

interface Props { live: LiveIntel; onInvestigate: (query: string) => void; isOffline?: boolean }

type Lens = 'overview' | 'india' | 'world' | 'country' | 'area' | 'axis';
const LENSES: { id: Lens; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Globe size={13} /> },
  { id: 'india', label: 'India', icon: <Flag size={13} /> },
  { id: 'world', label: 'World', icon: <Globe size={13} /> },
  { id: 'country', label: 'By country', icon: <Vote size={13} /> },
  { id: 'area', label: 'By area', icon: <MapIcon size={13} /> },
  { id: 'axis', label: 'By axis', icon: <Crosshair size={13} /> },
];
const AREA_ORDER: Area[] = ['South Asia', 'East Asia', 'Middle East & Gulf', 'Europe', 'North America', 'Latin America', 'Africa', 'Oceania', 'Global'];
const AXIS_ORDER: Axis[] = ['India', 'US & West', 'China', 'Russia & Eurasia', 'Gulf & OPEC', 'Unaligned'];
const TYPES: (PolType | 'All')[] = ['All', 'Elections', 'Leadership', 'Upheaval & crisis', 'Party & campaign', 'Polls & chatter'];

const BAND_TXT: Record<Band, string> = { CRISIS: 'text-calibrex-critical', STRESS: 'text-calibrex-high', ELEVATED: 'text-calibrex-medium', CALM: 'text-calibrex-low' };
const BAND_BG: Record<Band, string> = { CRISIS: 'bg-calibrex-critical', STRESS: 'bg-calibrex-high', ELEVATED: 'bg-calibrex-medium', CALM: 'bg-calibrex-low' };

const pollSearch = (name: string) => `https://www.google.com/search?q=${encodeURIComponent(name + ' approval rating opinion poll')}`;

// A momentum card: coverage count + a sentiment lean bar. NOT a poll.
const MomCard: React.FC<{ m: Momentum; onInvestigate: (q: string) => void }> = ({ m, onInvestigate }) => {
  const lean = m.sentiment > 0.12 ? 'pos' : m.sentiment < -0.12 ? 'neg' : 'mix';
  const color = lean === 'pos' ? 'bg-calibrex-low' : lean === 'neg' ? 'bg-calibrex-critical' : 'bg-calibrex-medium';
  const txt = lean === 'pos' ? 'text-calibrex-low' : lean === 'neg' ? 'text-calibrex-critical' : 'text-calibrex-medium';
  const Icon = lean === 'pos' ? TrendingUp : lean === 'neg' ? TrendingDown : Minus;
  return (
    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <button onClick={() => onInvestigate(m.name)} className="text-xs font-bold text-white hover:text-calibrex-gold text-left truncate" title={`Investigate ${m.name}`}>{m.name}</button>
        <span className={`text-[10px] font-black uppercase inline-flex items-center gap-1 ${txt}`}><Icon size={12} /> {lean === 'pos' ? 'Positive' : lean === 'neg' ? 'Negative' : 'Mixed'}</span>
      </div>
      <div className="text-[9px] font-mono text-white/40 mb-1">{m.country} · {m.mentions} report{m.mentions === 1 ? '' : 's'} (48h)</div>
      <div className="relative h-1.5 bg-white/10 rounded"><div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/30" /><div className={`h-1.5 rounded ${color}`} style={{ width: `${m.score}%` }} /></div>
      <a href={pollSearch(m.name)} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-calibrex-teal hover:underline uppercase inline-flex items-center gap-1 mt-1.5">See real polls <ExternalLink size={9} /></a>
    </div>
  );
};

const Card: React.FC<{ item: LiveItem; onInvestigate: (q: string) => void }> = ({ item, onInvestigate }) => (
  <div role="button" tabIndex={0} onClick={() => openReader({ url: item.url, title: item.title, source: item.source, kind: item.kind, published: item.published })} onKeyDown={(e) => { if (e.key === 'Enter') openReader({ url: item.url, title: item.title, source: item.source, kind: item.kind, published: item.published }); }}
    className="p-3 bg-black/20 rounded-lg border border-white/5 cursor-pointer hover:border-calibrex-gold/50 transition-all flex flex-col gap-1 group" title="Read the full article">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-[9px] font-mono text-calibrex-gold uppercase tracking-tighter truncate min-w-0">{isIndia(item) ? <Flag size={12} className="shrink-0" /> : <Globe size={12} className="shrink-0" />}<span className="truncate">{item.source} • {countryOf(item)}</span></div>
      <span className="text-[9px] text-white/40 font-mono shrink-0">{timeAgo(item.published)}</span>
    </div>
    <div className="text-[11px] font-bold text-white uppercase leading-tight group-hover:text-calibrex-gold transition-colors">{item.title}</div>
    <div className="flex flex-wrap gap-1 mt-0.5">
      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full border border-white/10 text-white/50 tracking-wider uppercase">{typeOf(item)}</span>
      {item.kind === 'social' && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full border border-calibrex-medium/40 text-calibrex-medium tracking-widest">SOCIAL · UNVERIFIED</span>}
    </div>
    {item.summary && item.kind !== 'social' && <p className="text-[11px] text-white/60 leading-snug line-clamp-2 normal-case mt-1">{item.summary}</p>}
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 mt-2">
      <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[9px] font-black text-calibrex-gold hover:underline uppercase inline-flex items-center gap-1 py-0.5"><FileText size={11} /> Source <ExternalLink size={10} /></a>
      <button onClick={(e) => { e.stopPropagation(); openReader({ url: item.url, title: item.title, source: item.source, kind: item.kind, published: item.published }); }} className="text-[9px] font-black text-calibrex-teal hover:underline uppercase inline-flex items-center gap-1 py-0.5"><BookOpen size={11} /> Read</button>
      <button onClick={(e) => { e.stopPropagation(); onInvestigate(item.title); }} className="text-[9px] font-black text-calibrex-navy bg-calibrex-gold/90 hover:bg-calibrex-gold rounded px-2 py-1 uppercase inline-flex items-center gap-1">Investigate <ExternalLink size={10} /></button>
    </div>
  </div>
);

const ElectionPolitics: React.FC<Props> = ({ live, onInvestigate, isOffline }) => {
  const [lens, setLens] = useState<Lens>('overview');
  const [type, setType] = useState<PolType | 'All'>('All');
  const [briefOpen, setBriefOpen] = useState(false);
  const feed = live.feeds.POLITICS;

  const all: LiveItem[] = useMemo(() => {
    const seen = new Set<string>();
    return [...feed.items].sort((a, b) => b.published - a.published)
      .filter(i => { const k = i.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
  }, [feed.items]);

  const stress = useMemo(() => countryStress(all), [all]);
  const leaders = useMemo(() => momentumBoard(LEADERS, all, 10), [all]);
  const parties = useMemo(() => momentumBoard(PARTIES, all, 8), [all]);
  const elections = useMemo(() => all.filter(isElection), [all]);
  const electionResults = useMemo(() => elections.filter(i => electionStage(i) === 'Results & projections').slice(0, 14), [elections]);
  const electionUpcoming = useMemo(() => elections.filter(i => electionStage(i) === 'Campaign & upcoming').slice(0, 14), [elections]);

  const base = useMemo(() => all.filter(i => type === 'All' || typeOf(i) === type), [all, type]);
  const overviewList = useMemo(() => balance5050(base, isIndia, 80), [base]);
  const indiaList = useMemo(() => base.filter(isIndia).slice(0, 80), [base]);
  const worldList = useMemo(() => base.filter(i => !isIndia(i)).slice(0, 80), [base]);
  const byCountry = useMemo(() => { const m = new Map<string, LiveItem[]>(); for (const i of base) { const k = countryOf(i); (m.get(k) || m.set(k, []).get(k)!).push(i); } return [...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 14); }, [base]);
  const byArea = useMemo(() => { const m = new Map<string, LiveItem[]>(); for (const i of base) { const k = areaOf(i); (m.get(k) || m.set(k, []).get(k)!).push(i); } return m; }, [base]);
  const byAxis = useMemo(() => { const m = new Map<string, LiveItem[]>(); for (const i of base) { const k = axisOf(i); (m.get(k) || m.set(k, []).get(k)!).push(i); } return m; }, [base]);

  const briefText = useMemo(() => {
    const signif = all.filter(isSignificant).slice(0, 6);
    const inN = all.filter(isIndia).length, glN = all.length - inN;
    const topC = stress[0];
    return [
      `RAPID BRIEF — ELECTIONS & POLITICS · ${new Date().toLocaleString()}`, ``,
      `SITUATION`,
      `${all.length} political reports in 48h (${inN} India / ${glN} world). ${elections.length} election-related, ${electionResults.length} reporting results/projections.`,
      topC ? `Highest political stress: ${topC.country} (${topC.band} · ${topC.score}).` : `No country stress cluster.`,
      ``, `KEY DEVELOPMENTS`,
      ...(signif.length ? signif.map((i, n) => `${n + 1}. ${i.title} — ${i.source} [${countryOf(i)}]`) : ['— Quiet window.']),
      ``, `COVERAGE MOMENTUM (news tone, not polls)`,
      ...(leaders.slice(0, 4).map(m => `${m.name}: ${m.sentiment > 0.12 ? 'positive' : m.sentiment < -0.12 ? 'negative' : 'mixed'} lean, ${m.mentions} reports`)),
      ``, `ASSESSMENT`,
      topC && topC.band === 'CRISIS' ? `${topC.country} shows acute political stress — upheaval/results clustering.` : `Normal political flow across tracked states.`,
    ].join('\n');
  }, [all, stress, elections, electionResults, leaders]);

  const loading = feed.loading && all.length === 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Vote size={22} className="text-calibrex-gold" /> Election &amp; Politics Watch</h1>
          <p className="text-[11px] sm:text-xs text-calibrex-muted mt-1 max-w-3xl">Political upheaval, elections, leaders and parties — country, area and axis wise. Leader &amp; party momentum tracks live news coverage &amp; tone (not opinion polls); elections show results and forecasts as reported, with source links. Weighted 50% India / 50% world.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setBriefOpen(true)} className="flex items-center gap-1.5 bg-calibrex-gold text-calibrex-navy hover:bg-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 shadow"><FileText size={14} /> Rapid Brief</button>
          {isOffline ? <span className="text-[8px] font-black text-calibrex-critical uppercase">Offline</span> : <span className="text-[8px] font-mono font-black text-calibrex-low border border-calibrex-low/30 bg-calibrex-low/10 px-1.5 py-0.5 rounded tracking-widest">LIVE</span>}
          <button onClick={live.refresh} disabled={isOffline || live.refreshing} title="Refresh now" className="text-white/40 hover:text-calibrex-gold disabled:opacity-30 p-1">{live.refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
        </div>
      </div>

      {/* Countrywise political stress meter */}
      <div className="bg-calibrex-surface border border-white/10 rounded-xl p-4 sm:p-5 mb-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-calibrex-gold flex items-center gap-2 mb-3"><Gauge size={14} /> Political stress — countrywise</h2>
        {stress.length === 0 ? <p className="text-[10px] text-calibrex-muted">Fills on the next pull.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {stress.map(s => (
              <button key={s.country} onClick={() => setLens('country')} className="text-left bg-black/20 rounded-lg p-3 border border-white/5 hover:border-white/20 transition-all">
                <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold text-white">{s.country}</span><span className={`text-[10px] font-black uppercase ${BAND_TXT[s.band]}`}>{s.band} · {s.score}</span></div>
                <div className="h-1.5 bg-white/5 rounded"><div className={`h-1.5 rounded ${BAND_BG[s.band]}`} style={{ width: `${s.score}%` }} /></div>
                <div className="text-[9px] text-calibrex-muted mt-1 font-mono">{s.signif} major · {s.total} reports</div>
              </button>
            ))}
          </div>
        )}
        <p className="text-[9px] text-calibrex-muted mt-2">Weighted by high-impact political events (results, upheaval, crises) per country over 48h.</p>
      </div>

      {/* Leader & party momentum */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {[{ t: 'Leader momentum', icon: <Users size={14} />, board: leaders }, { t: 'Party momentum', icon: <BarChart3 size={14} />, board: parties }].map(sec => (
          <div key={sec.t} className="bg-calibrex-surface border border-white/10 rounded-xl p-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-calibrex-teal flex items-center gap-2 mb-1">{sec.icon} {sec.t}</h2>
            <p className="text-[9px] text-calibrex-muted mb-3">News coverage &amp; tone over 48h — a momentum signal, <span className="text-white/60">not an opinion poll</span>.</p>
            {sec.board.length === 0 ? <p className="text-[10px] text-calibrex-muted py-4">No coverage in window.</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{sec.board.map(m => <MomCard key={m.name} m={m} onInvestigate={onInvestigate} />)}</div>
            )}
          </div>
        ))}
      </div>

      {/* Election tracker */}
      {(electionResults.length > 0 || electionUpcoming.length > 0) && (
        <div className="bg-calibrex-surface border border-white/10 rounded-xl p-4 mb-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-calibrex-gold flex items-center gap-2 mb-1"><Vote size={14} /> Election tracker</h2>
          <p className="text-[9px] text-calibrex-muted mb-3">Live from reporting worldwide — results and forecasts <span className="text-white/60">as reported by outlets, with links; not official counts</span>.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-calibrex-low mb-2">Results &amp; projections ({electionResults.length})</div>
              <div className="space-y-2">{electionResults.length ? electionResults.map(i => <Card key={i.id} item={i} onInvestigate={onInvestigate} />) : <p className="text-[10px] text-calibrex-muted">None reported now.</p>}</div>
            </div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-calibrex-teal mb-2">Campaign &amp; upcoming ({electionUpcoming.length})</div>
              <div className="space-y-2">{electionUpcoming.length ? electionUpcoming.map(i => <Card key={i.id} item={i} onInvestigate={onInvestigate} />) : <p className="text-[10px] text-calibrex-muted">None in window.</p>}</div>
            </div>
          </div>
        </div>
      )}

      {/* Type filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
        {TYPES.map(t => (<button key={t} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 border ${type === t ? 'bg-calibrex-teal text-calibrex-navy border-calibrex-teal' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'}`}>{t}</button>))}
      </div>
      {/* Lenses */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
        {LENSES.map(l => (<button key={l.id} onClick={() => setLens(l.id)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 border transition-all ${lens === l.id ? 'bg-calibrex-gold text-calibrex-navy border-calibrex-gold' : 'bg-white/5 text-white/50 border-white/5 hover:border-white/20'}`}>{l.icon}{l.label}</button>))}
      </div>

      {feed.error && feed.errorCode !== 'empty' && (<div className="px-3 py-2 mb-3 bg-calibrex-high/10 border border-calibrex-high/20 rounded text-[10px] text-calibrex-high font-bold flex items-start gap-2"><AlertTriangle size={12} className="shrink-0 mt-0.5" /><span>{feed.error}</span></div>)}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-calibrex-gold gap-3"><Loader2 size={28} className="animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest">Pulling political wires…</p></div>
      ) : base.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-40 text-center px-4"><Filter size={40} className="mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">{all.length === 0 ? 'No political reports yet' : 'Nothing in this type'}</p><p className="text-[10px] mt-2">New reports arrive on the 5-minute server pull.</p></div>
      ) : lens === 'overview' || lens === 'india' || lens === 'world' ? (
        <>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">{(lens === 'overview' ? overviewList : lens === 'india' ? indiaList : worldList).length} reports{lens === 'overview' ? ` · ${overviewList.filter(isIndia).length} India / ${overviewList.filter(i => !isIndia(i)).length} world` : ''}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{(lens === 'overview' ? overviewList : lens === 'india' ? indiaList : worldList).map(i => <Card key={i.id} item={i} onInvestigate={onInvestigate} />)}</div>
        </>
      ) : (
        <div className="space-y-6">
          {(lens === 'country' ? byCountry.map(([k]) => k) : lens === 'area' ? AREA_ORDER : AXIS_ORDER).map(key => {
            const list = lens === 'country' ? (byCountry.find(([k]) => k === key)?.[1] || []) : lens === 'area' ? (byArea.get(key as string) || []) : (byAxis.get(key as string) || []);
            if (!list.length) return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-calibrex-dark/80 backdrop-blur-sm py-1 z-[1]"><h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-calibrex-gold">{key}</h2><span className="text-[9px] font-mono text-white/30">{list.length}</span><div className="h-px flex-1 bg-white/10" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{list.slice(0, 40).map(i => <Card key={i.id} item={i} onInvestigate={onInvestigate} />)}</div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center mt-8">{isOffline ? 'Offline cache' : 'Server pull every 5 min'} · updated {timeAgo(feed.updatedAt)}</p>

      <RapidBriefModal open={briefOpen} onClose={() => setBriefOpen(false)} domain="Politics"
        title={stress[0] ? `${stress[0].country} ${stress[0].band}` : 'global'} text={briefText}
        sources={(all.filter(isSignificant).slice(0, 8).length ? all.filter(isSignificant) : all).slice(0, 8)} />
    </div>
  );
};

export default ElectionPolitics;
