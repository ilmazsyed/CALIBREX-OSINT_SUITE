import React, { useEffect, useState, useCallback } from 'react';
import { Gauge, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, Flag, Globe2, Siren, FileText, ChevronRight, AlertTriangle, Compass, ArrowRight, GraduationCap } from 'lucide-react';
import { openMission } from '../lib/mission';
import { api } from '../lib/api';
import { openReader, timeAgo } from '../lib/live';
import { navigateTo } from './AiAssist';
import WatchTabs from './WatchTabs';
import StartHereCard from './StartHereCard';
import RapidBriefModal from './RapidBriefModal';

type Band = 'CRISIS' | 'STRESS' | 'ELEVATED' | 'CALM';
type Trend = 'up' | 'down' | 'flat';
type Scope = 'all' | 'india' | 'world';
interface Top { title: string; url: string; source: string; published: number }
interface Scoped { score: number; band: Band; hot: number; total: number; top: Top | null; extra?: { countries?: { country: string; score: number; band: Band }[] } }
interface Domain { key: string; label: string; view: string; global: boolean; trend: Trend; spark: number[]; all: Scoped; india: Scoped; world: Scoped }
interface Risk {
  updatedAt: number;
  composite: Record<Scope, { score: number; band: Band; trend: Trend }>;
  domains: Domain[];
  compositeSpark: number[]; indiaSpark: number[]; worldSpark: number[];
}

const BAND_TEXT: Record<Band, string> = { CRISIS: 'text-calibrex-critical', STRESS: 'text-calibrex-high', ELEVATED: 'text-calibrex-gold', CALM: 'text-calibrex-low' };
const BAND_BG: Record<Band, string> = { CRISIS: 'bg-calibrex-critical', STRESS: 'bg-calibrex-high', ELEVATED: 'bg-calibrex-gold', CALM: 'bg-calibrex-low' };
const BAND_RING: Record<Band, string> = { CRISIS: 'border-calibrex-critical/50', STRESS: 'border-calibrex-high/50', ELEVATED: 'border-calibrex-gold/40', CALM: 'border-calibrex-low/40' };
const BAND_STROKE: Record<Band, string> = { CRISIS: '#ff5a6e', STRESS: '#ff9f45', ELEVATED: '#e9c46a', CALM: '#3ec9a7' };
const SCOPE_LABEL: Record<Scope, string> = { all: 'Global', india: 'India', world: 'World' };

const TrendIcon: React.FC<{ t: Trend; band: Band }> = ({ t, band }) => {
  if (t === 'up') return <TrendingUp size={14} className={BAND_TEXT[band]} />;
  if (t === 'down') return <TrendingDown size={14} className="text-calibrex-low" />;
  return <Minus size={14} className="text-white/30" />;
};

const clampScore = (s: number) => Math.max(0, Math.min(100, s));

const Spark: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (!data || data.length < 2) return <div className="h-7" />;
  const w = 100, h = 28;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - (clampScore(v) / 100) * h).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-7" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/** Semicircular gauge for the composite index. */
const G_ = ({ score, band }: { score: number; band: Band }) => {
  const r = 52, cx = 60, cy = 60;
  const a = Math.PI * (1 - clampScore(score) / 100);
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  return (
    <svg viewBox="0 0 120 70" className="w-32 h-[64px] sm:w-36 sm:h-[70px]">
      <path d={`M 8 60 A ${r} ${r} 0 0 1 112 60`} fill="none" stroke="#ffffff14" strokeWidth="9" strokeLinecap="round" />
      <path d={`M 8 60 A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke={BAND_STROKE[band]} strokeWidth="9" strokeLinecap="round" />
      <circle cx={x} cy={y} r="4" fill={BAND_STROKE[band]} />
    </svg>
  );
};

const Command: React.FC<{ alertCount?: number }> = ({ alertCount = 0 }) => {
  const [risk, setRisk] = useState<Risk | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<Scope>('all');
  const [brief, setBrief] = useState<{ title: string; text: string; sources: { title: string; source: string; url: string; published?: number }[] } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<Risk>('/risk').then(r => { setRisk(r); setErr(null); }).catch(() => setErr('Could not load the risk picture.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const comp = risk?.composite[scope];
  const compSpark = scope === 'india' ? risk?.indiaSpark : scope === 'world' ? risk?.worldSpark : risk?.compositeSpark;
  // Region-scoped monitor readings + crisis feed.
  const tiles = (risk?.domains || []).map(d => ({ ...d, s: d[scope] }));
  const crisisFeed = tiles.filter(d => d.s.top && (d.s.band === 'CRISIS' || d.s.band === 'STRESS')).sort((a, b) => b.s.score - a.s.score);

  const openTop = (t: Top | null, view: string) => { if (t?.url) openReader({ url: t.url, title: t.title, source: t.source, published: t.published }); else navigateTo(view); };

  const compileBrief = () => {
    if (!risk || !comp) return;
    const reg = SCOPE_LABEL[scope];
    const when = new Date(risk.updatedAt || Date.now()).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const lines = [
      `${reg.toUpperCase()} SITUATION BRIEF`,
      `${reg} risk ${comp.score}/100 (${comp.band}). Compiled ${when}.`,
      `Derived from current reporting across the live wires — an aggregation of observed volume and severity, not a forecast.`,
      ``, `BY DOMAIN (${reg})`,
      ...tiles.map(d => `- ${d.label}: ${d.s.band} (${d.s.score})${d.s.top ? ` — ${d.s.top.title}` : ''}`),
    ];
    if (crisisFeed.length) {
      lines.push(``, `ELEVATED / CRISIS NOW`);
      crisisFeed.forEach((d, i) => lines.push(`${i + 1}. [${d.label}] ${d.s.top!.title} (${d.s.top!.source})`));
      lines.push(``, `SOURCES`);
      crisisFeed.filter(d => d.s.top?.url).forEach((d, i) => lines.push(`[${i + 1}] ${d.s.top!.url}`));
    }
    const sources = crisisFeed.filter(d => d.s.top?.url).map(d => ({ title: d.s.top!.title, source: d.s.top!.source, url: d.s.top!.url, published: d.s.top!.published }));
    setBrief({ title: `${reg} Situation Brief (${comp.band})`, text: lines.join('\n'), sources });
  };

  return (
    <div className="p-3 sm:p-6 pb-12 w-full overflow-x-hidden">
      <WatchTabs current="command" />
      <StartHereCard />

      <button onClick={() => openMission()} className="w-full mb-4 flex items-center gap-3 p-3.5 rounded-2xl border border-calibrex-gold/30 bg-gradient-to-r from-calibrex-gold/10 to-transparent hover:border-calibrex-gold/50 text-left active:scale-[0.99] transition">
        <span className="cx-mission-glow shrink-0 w-10 h-10 rounded-xl bg-calibrex-gold/15 border border-calibrex-gold/30 flex items-center justify-center text-calibrex-gold"><Compass size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-white">Start a Guided Mission</span>
          <span className="block text-[11px] text-white/55">We’ll coach you from a live topic to a filed brief — pick a lead, build a case, pin sources, compile a report.</span>
        </span>
        <ArrowRight size={16} className="shrink-0 text-calibrex-gold" />
      </button>

      <button onClick={() => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'academy' }))} className="w-full mb-4 flex items-center gap-3 p-3.5 rounded-2xl border border-calibrex-teal/30 bg-gradient-to-r from-calibrex-teal/10 to-transparent hover:border-calibrex-teal/50 text-left active:scale-[0.99] transition">
        <span className="shrink-0 w-10 h-10 rounded-xl bg-calibrex-teal/15 border border-calibrex-teal/30 flex items-center justify-center text-calibrex-teal"><GraduationCap size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-white">OSINT Academy</span>
          <span className="block text-[11px] text-white/55">Your training zone — courses and walkthroughs to sharpen your tradecraft, right inside the app.</span>
        </span>
        <ArrowRight size={16} className="shrink-0 text-calibrex-teal" />
      </button>

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Gauge size={20} className="text-calibrex-teal" />
          <div>
            <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-[0.18em]">Command</h1>
            <p className="text-[10px] font-mono text-white/35 uppercase tracking-widest">Every monitor · one risk picture</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-calibrex-muted hover:text-calibrex-teal disabled:opacity-40">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {risk ? timeAgo(risk.updatedAt) : ''}
        </button>
      </div>

      {err && !risk ? (
        <div className="flex flex-col items-center justify-center py-20 text-calibrex-muted"><AlertTriangle size={28} className="mb-3 text-calibrex-high" /><p className="text-sm">{err}</p><button onClick={load} className="mt-3 text-xs font-bold text-calibrex-teal">Retry</button></div>
      ) : !risk || !comp ? (
        <div className="flex justify-center py-24 text-calibrex-teal"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* Region toggle — each chip shows that scope's live score. Tapping re-scopes the whole board. */}
          <div className="grid grid-cols-3 gap-2 mb-3" role="tablist" aria-label="Risk region">
            {(['all', 'india', 'world'] as Scope[]).map(sc => {
              const c = risk.composite[sc];
              const on = scope === sc;
              const Icon = sc === 'india' ? Flag : sc === 'world' ? Globe2 : Gauge;
              return (
                <button key={sc} role="tab" aria-selected={on} onClick={() => setScope(sc)}
                  className={`rounded-xl border p-3 text-left transition-all ${on ? `${BAND_RING[c.band]} bg-white/5` : 'border-white/10 bg-black/20 hover:bg-black/30'}`}>
                  <div className="flex items-center gap-1.5 mb-0.5"><Icon size={12} className={on ? 'text-calibrex-teal' : 'text-white/40'} /><span className="text-[9px] font-black uppercase tracking-widest text-white/50">{SCOPE_LABEL[sc]}</span></div>
                  <div className="flex items-baseline gap-1"><span className={`text-2xl font-black ${BAND_TEXT[c.band]}`}>{c.score}</span><TrendIcon t={c.trend} band={c.band} /></div>
                  <div className={`text-[9px] font-black uppercase tracking-widest ${BAND_TEXT[c.band]}`}>{c.band}</div>
                </button>
              );
            })}
          </div>

          {/* Selected-region gauge */}
          <div className={`rounded-2xl border ${BAND_RING[comp.band]} bg-gradient-to-br from-white/5 to-transparent p-4 mb-4 flex items-center gap-4`}>
            <G_ score={comp.score} band={comp.band} />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">{SCOPE_LABEL[scope]} risk index</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black ${BAND_TEXT[comp.band]}`}>{comp.score}</span>
                <span className="text-white/30 text-sm font-bold">/100</span>
                <TrendIcon t={comp.trend} band={comp.band} />
                <span className={`text-xs font-black uppercase tracking-widest ${BAND_TEXT[comp.band]}`}>{comp.band}</span>
              </div>
              <div className="mt-1"><Spark data={compSpark || []} color={BAND_STROKE[comp.band]} /></div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <button onClick={compileBrief} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-calibrex-teal text-calibrex-navy hover:bg-white active:scale-95"><FileText size={14} /> Rapid Brief — {SCOPE_LABEL[scope]}</button>
            <button onClick={() => navigateTo('alerts')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-calibrex-critical/40 text-calibrex-critical hover:bg-calibrex-critical/10"><Siren size={14} /> {alertCount} active alert{alertCount === 1 ? '' : 's'}</button>
          </div>

          {/* Monitor grid (region-scoped) */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-black text-calibrex-muted uppercase tracking-[0.2em] opacity-60">Monitors · {SCOPE_LABEL[scope]}</div>
            <div className="text-[9px] text-white/25 uppercase tracking-widest">tap a tile to open</div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {tiles.map(d => (
              <button key={d.key} onClick={() => navigateTo(d.view)} className={`rounded-xl border ${BAND_RING[d.s.band]} bg-calibrex-surface p-3 flex flex-col text-left group hover:bg-white/5 transition-colors active:scale-[0.98]`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[12px] font-black text-white uppercase tracking-wide flex items-center gap-1">{d.label} <ChevronRight size={12} className="text-white/20 group-hover:text-calibrex-teal" /></span>
                  <span className={`w-2 h-2 rounded-full ${BAND_BG[d.s.band]}`} />
                </div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className={`text-2xl font-black ${BAND_TEXT[d.s.band]}`}>{d.s.score}</span>
                  <TrendIcon t={d.trend} band={d.s.band} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${BAND_TEXT[d.s.band]}`}>{d.s.band}</span>
                  {d.global && scope !== 'all' && <span className="text-[8px] text-white/30 uppercase ml-auto">global</span>}
                </div>
                <Spark data={d.spark} color={BAND_STROKE[d.s.band]} />
                {d.s.top && <span onClick={e => { e.stopPropagation(); openTop(d.s.top, d.view); }} className="text-[11px] text-white/55 hover:text-white leading-snug mt-1.5 line-clamp-2 cursor-pointer">{d.s.top.title}</span>}
              </button>
            ))}
          </div>

          {/* Cross-domain crisis feed (region-scoped) */}
          <div className="text-[10px] font-black text-calibrex-muted uppercase tracking-[0.2em] mb-2 opacity-60">What's hot · {SCOPE_LABEL[scope]}</div>
          {crisisFeed.length > 0 ? (
            <div className="space-y-2">
              {crisisFeed.map(d => (
                <button key={d.key} onClick={() => openTop(d.s.top, d.view)} className="w-full flex items-center gap-3 p-3 bg-calibrex-surface border border-white/5 rounded-lg hover:border-white/20 text-left transition-colors">
                  <span className={`shrink-0 text-[8px] font-black uppercase px-2 py-1 rounded-full border ${BAND_RING[d.s.band]} ${BAND_TEXT[d.s.band]}`}>{d.label}</span>
                  <span className="min-w-0 flex-1 text-[12px] text-white/85 truncate">{d.s.top!.title}</span>
                  <span className="shrink-0 text-[10px] font-mono text-white/35">{d.s.top!.source}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-white/40 py-4">Nothing in crisis or stress for {SCOPE_LABEL[scope]} right now — the board is calm. Tiles above stay live.</p>
          )}
        </>
      )}

      <RapidBriefModal open={!!brief} onClose={() => setBrief(null)} domain="Command" accent="teal" title={brief?.title || ''} text={brief?.text || ''} sources={brief?.sources || []} />
    </div>
  );
};

export default Command;
