import React, { useMemo, useState } from 'react';
import { Building2, Globe, Flag, Map as MapIcon, Users, Loader2, RefreshCw, BookOpen, ExternalLink, Filter, AlertTriangle, Gauge, FileText, X, Copy, Check, Landmark } from 'lucide-react';
import { LiveIntel, LiveItem, timeAgo, openReader } from '../lib/live';
import { copyText } from '../lib/api';
import { balance5050, Band } from '../lib/business';
import { Area, Domain, Alliance, ALLIANCES, domainOf, countryOf, areaOf, alliancesOf, isIndia, isSignificant, isDocument, countryStress } from '../lib/gov';
import RapidBriefModal from './RapidBriefModal';

interface Props { live: LiveIntel; onInvestigate: (query: string) => void; isOffline?: boolean }

type Lens = 'overview' | 'india' | 'world' | 'country' | 'area' | 'alliance';
const LENSES: { id: Lens; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Globe size={13} /> },
  { id: 'india', label: 'India', icon: <Flag size={13} /> },
  { id: 'world', label: 'World', icon: <Globe size={13} /> },
  { id: 'country', label: 'By country', icon: <Landmark size={13} /> },
  { id: 'area', label: 'By area', icon: <MapIcon size={13} /> },
  { id: 'alliance', label: 'By alliance', icon: <Users size={13} /> },
];
const AREA_ORDER: Area[] = ['South Asia', 'East Asia', 'Middle East & Gulf', 'Europe', 'North America', 'Latin America', 'Africa', 'Oceania', 'Global'];
const DOMAINS: Domain[] = ['Foreign affairs & geopolitics', 'Defence & military', 'Elections & polity', 'Crisis & unrest', 'Law & order', 'Governance & orders', 'Economy & fiscal', 'Trade & commerce', 'Energy & oil', 'Food security', 'Environment & climate', 'Disasters & relief', 'Industry & infrastructure', 'Democracy & rights'];

const BAND_TXT: Record<Band, string> = { CRISIS: 'text-calibrex-critical', STRESS: 'text-calibrex-high', ELEVATED: 'text-calibrex-medium', CALM: 'text-calibrex-low' };
const BAND_BG: Record<Band, string> = { CRISIS: 'bg-calibrex-critical', STRESS: 'bg-calibrex-high', ELEVATED: 'bg-calibrex-medium', CALM: 'bg-calibrex-low' };

const Card: React.FC<{ item: LiveItem; onInvestigate: (q: string) => void }> = ({ item, onInvestigate }) => {
  const doc = isDocument(item);
  return (
    <div role="button" tabIndex={0} onClick={() => onInvestigate(item.title)} onKeyDown={(e) => { if (e.key === 'Enter') onInvestigate(item.title); }}
      className="p-3 bg-black/20 rounded-lg border border-white/5 cursor-pointer hover:border-calibrex-teal/50 transition-all flex flex-col gap-1 group" title="Open in Intelligence Research">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[9px] font-mono text-calibrex-teal uppercase tracking-tighter truncate min-w-0">
          {isIndia(item) ? <Flag size={12} className="shrink-0" /> : <Globe size={12} className="shrink-0" />}
          <span className="truncate">{item.source} • {countryOf(item)}</span>
        </div>
        <span className="text-[9px] text-white/40 font-mono shrink-0" title={new Date(item.published).toLocaleString()}>{timeAgo(item.published)}</span>
      </div>
      <div className="text-[11px] font-bold text-white uppercase leading-tight group-hover:text-calibrex-teal transition-colors">{item.title}</div>
      <div className="flex flex-wrap gap-1 mt-0.5">
        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full border border-white/10 text-white/50 tracking-wider uppercase">{domainOf(item)}</span>
        {doc && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full border border-calibrex-low/40 text-calibrex-low tracking-widest">OFFICIAL</span>}
        {alliancesOf(item).map(a => <span key={a} className="text-[8px] font-black px-1.5 py-0.5 rounded-full border border-calibrex-gold/30 text-calibrex-gold tracking-wider">{a}</span>)}
      </div>
      {item.summary && item.kind !== 'social' && <p className="text-[11px] text-white/60 leading-snug line-clamp-2 normal-case mt-1">{item.summary}</p>}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 mt-2">
        <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[9px] font-black text-calibrex-gold hover:underline uppercase inline-flex items-center gap-1 py-0.5" title={doc ? 'Open the official release / document' : 'Open the source'}><FileText size={11} /> {doc ? 'Document' : 'Source'} <ExternalLink size={10} /></a>
        <button onClick={(e) => { e.stopPropagation(); openReader({ url: item.url, title: item.title, source: item.source, kind: item.kind, published: item.published }); }} className="text-[9px] font-black text-calibrex-teal hover:underline uppercase inline-flex items-center gap-1 py-0.5" title="Read the full text here"><BookOpen size={11} /> Read</button>
        <button onClick={(e) => { e.stopPropagation(); onInvestigate(item.title); }} className="text-[9px] font-black text-calibrex-navy bg-calibrex-teal/90 hover:bg-calibrex-teal rounded px-2 py-1 uppercase inline-flex items-center gap-1" title="Open in Intelligence Research">Investigate <ExternalLink size={10} /></button>
      </div>
    </div>
  );
};

const GovernmentDashboard: React.FC<Props> = ({ live, onInvestigate, isOffline }) => {
  const [lens, setLens] = useState<Lens>('overview');
  const [domain, setDomain] = useState<Domain | 'All'>('All');
  const [briefOpen, setBriefOpen] = useState(false);
  const feed = live.feeds.GOV;

  const all: LiveItem[] = useMemo(() => {
    const seen = new Set<string>();
    return [...feed.items].sort((a, b) => b.published - a.published)
      .filter(i => { const k = i.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
  }, [feed.items]);

  const stress = useMemo(() => countryStress(all), [all]);
  const domainCounts = useMemo(() => { const m = new Map<Domain, number>(); for (const i of all) m.set(domainOf(i), (m.get(domainOf(i)) || 0) + 1); return m; }, [all]);

  const base = useMemo(() => all.filter(i => domain === 'All' || domainOf(i) === domain), [all, domain]);

  const overviewList = useMemo(() => balance5050(base, isIndia, 80), [base]);
  const indiaList = useMemo(() => base.filter(isIndia).slice(0, 80), [base]);
  const worldList = useMemo(() => base.filter(i => !isIndia(i)).slice(0, 80), [base]);
  const byCountry = useMemo(() => groupSort(base, countryOf), [base]);
  const byArea = useMemo(() => groupMap(base, areaOf), [base]);
  const byAlliance = useMemo(() => { const m = new Map<Alliance, LiveItem[]>(); for (const i of base) for (const a of alliancesOf(i)) (m.get(a) || m.set(a, []).get(a)!).push(i); return m; }, [base]);

  const briefText = useMemo(() => {
    const signif = all.filter(isSignificant).slice(0, 6);
    const inN = all.filter(isIndia).length, glN = all.length - inN;
    const topC = stress[0];
    return [
      `RAPID BRIEF — GOVERNMENT · ${new Date().toLocaleString()}`, ``,
      `SITUATION`,
      `${all.length} government reports in the last 48h (${inN} India / ${glN} world). ${all.filter(isDocument).length} official releases.`,
      topC ? `Highest governance stress: ${topC.country} (${topC.band} · ${topC.score}, ${topC.signif} major actions).` : `No country stress cluster.`,
      ``, `KEY ACTIONS`,
      ...(signif.length ? signif.map((i, n) => `${n + 1}. ${i.title} — ${i.source} [${countryOf(i)}]`) : ['— No high-impact orders/decisions in window.']),
      ``, `HOTSPOTS`,
      `Top countries: ${stress.slice(0, 4).map(s => `${s.country} (${s.band})`).join(', ') || '—'}.`,
      ``, `ASSESSMENT`,
      topC && topC.band === 'CRISIS' ? `${topC.country} shows acute governance stress — orders/crisis clustering; watch for spillover.`
        : topC && (topC.band === 'STRESS') ? `Elevated activity in ${topC.country}; monitor follow-on decisions.`
        : `Routine governance flow across tracked states.`,
    ].join('\n');
  }, [all, stress]);

  const loading = feed.loading && all.length === 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Building2 size={22} className="text-calibrex-teal" /> Government Dashboard</h1>
          <p className="text-[11px] sm:text-xs text-calibrex-muted mt-1 max-w-3xl">Major decisions, orders, statements and public releases — policy, polity, elections, governance, defence, commerce, industry, environment, foreign affairs, geopolitics, disasters, threats, law &amp; order, democracy, food security, energy &amp; oil and more. Every official release links to its document. Weighted 50% India / 50% world.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setBriefOpen(true)} className="flex items-center gap-1.5 bg-calibrex-teal text-calibrex-navy hover:bg-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 shadow"><FileText size={14} /> Rapid Brief</button>
          {isOffline ? <span className="text-[8px] font-black text-calibrex-critical uppercase">Offline</span>
            : <span className="text-[8px] font-mono font-black text-calibrex-low border border-calibrex-low/30 bg-calibrex-low/10 px-1.5 py-0.5 rounded tracking-widest">LIVE</span>}
          <button onClick={live.refresh} disabled={isOffline || live.refreshing} title="Refresh now" className="text-white/40 hover:text-calibrex-teal disabled:opacity-30 p-1">{live.refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
        </div>
      </div>

      {/* Countrywise governance stress meter */}
      <div className="bg-calibrex-surface border border-white/10 rounded-xl p-4 sm:p-5 mb-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-calibrex-teal flex items-center gap-2 mb-3"><Gauge size={14} /> Governance stress — countrywise</h2>
        {stress.length === 0 ? (
          <p className="text-[10px] text-calibrex-muted">No country-tagged activity yet — fills on the next pull.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {stress.map(s => (
              <button key={s.country} onClick={() => { setLens('country'); }} className="text-left bg-black/20 rounded-lg p-3 border border-white/5 hover:border-white/20 transition-all">
                <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold text-white">{s.country}</span><span className={`text-[10px] font-black uppercase ${BAND_TXT[s.band]}`}>{s.band} · {s.score}</span></div>
                <div className="h-1.5 bg-white/5 rounded"><div className={`h-1.5 rounded ${BAND_BG[s.band]}`} style={{ width: `${s.score}%` }} /></div>
                <div className="text-[9px] text-calibrex-muted mt-1 font-mono">{s.signif} major action{s.signif === 1 ? '' : 's'} · {s.total} report{s.total === 1 ? '' : 's'}</div>
              </button>
            ))}
          </div>
        )}
        <p className="text-[9px] text-calibrex-muted mt-2">Weighted by high-impact actions (orders, emergencies, sanctions, crises) per country over 48h. A read on where state activity is concentrating — not a risk rating.</p>
      </div>

      {/* Domain filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
        <button onClick={() => setDomain('All')} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 border ${domain === 'All' ? 'bg-calibrex-teal text-calibrex-navy border-calibrex-teal' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'}`}>All domains</button>
        {DOMAINS.map(d => { const n = domainCounts.get(d) || 0; if (!n && domain !== d) return null; return (
          <button key={d} onClick={() => setDomain(domain === d ? 'All' : d)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 border inline-flex items-center gap-1.5 ${domain === d ? 'bg-calibrex-teal text-calibrex-navy border-calibrex-teal' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'}`}>{d}<span className="opacity-60 tabular-nums">{n}</span></button>
        ); })}
      </div>

      {/* Lenses */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
        {LENSES.map(l => (
          <button key={l.id} onClick={() => setLens(l.id)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 border transition-all ${lens === l.id ? 'bg-calibrex-gold text-calibrex-navy border-calibrex-gold' : 'bg-white/5 text-white/50 border-white/5 hover:border-white/20'}`}>{l.icon}{l.label}</button>
        ))}
      </div>

      {feed.error && feed.errorCode !== 'empty' && (
        <div className="px-3 py-2 mb-3 bg-calibrex-high/10 border border-calibrex-high/20 rounded text-[10px] text-calibrex-high font-bold flex items-start gap-2"><AlertTriangle size={12} className="shrink-0 mt-0.5" /><span>{feed.error}</span></div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-calibrex-teal gap-3"><Loader2 size={28} className="animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest">Pulling government wires…</p></div>
      ) : base.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-40 text-center px-4"><Filter size={40} className="mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">{all.length === 0 ? 'No government reports yet' : 'Nothing in this domain'}</p><p className="text-[10px] mt-2">New releases arrive on the 5-minute server pull.</p></div>
      ) : lens === 'overview' || lens === 'india' || lens === 'world' ? (
        <>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">{(lens === 'overview' ? overviewList : lens === 'india' ? indiaList : worldList).length} reports{lens === 'overview' ? ` · ${overviewList.filter(isIndia).length} India / ${overviewList.filter(i => !isIndia(i)).length} world` : ''}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{(lens === 'overview' ? overviewList : lens === 'india' ? indiaList : worldList).map(i => <Card key={i.id} item={i} onInvestigate={onInvestigate} />)}</div>
        </>
      ) : (
        <div className="space-y-6">
          {(lens === 'country' ? byCountry.map(([k]) => k) : lens === 'area' ? AREA_ORDER : [...ALLIANCES]).map(key => {
            const list = lens === 'country' ? (byCountry.find(([k]) => k === key)?.[1] || []) : lens === 'area' ? (byArea.get(key as string) || []) : (byAlliance.get(key as Alliance) || []);
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
          {lens === 'alliance' && [...byAlliance.keys()].length === 0 && <p className="text-[10px] text-calibrex-muted text-center py-10">No multilateral (UN/NATO/EU/bloc) items in this filter.</p>}
        </div>
      )}

      <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center mt-8">{isOffline ? 'Offline cache' : 'Server pull every 5 min'} · updated {timeAgo(feed.updatedAt)}</p>

      <RapidBriefModal open={briefOpen} onClose={() => setBriefOpen(false)} domain="Government" accent="teal"
        title={stress[0] ? `${stress[0].country} ${stress[0].band}` : 'global'} text={briefText}
        sources={(all.filter(isSignificant).slice(0, 8).length ? all.filter(isSignificant) : all).slice(0, 8)} />
    </div>
  );
};

function groupMap(items: LiveItem[], fn: (i: LiveItem) => string): Map<string, LiveItem[]> {
  const m = new Map<string, LiveItem[]>();
  for (const i of items) { const k = fn(i); (m.get(k) || m.set(k, []).get(k)!).push(i); }
  return m;
}
function groupSort(items: LiveItem[], fn: (i: LiveItem) => string): [string, LiveItem[]][] {
  return [...groupMap(items, fn).entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 14);
}

export default GovernmentDashboard;
