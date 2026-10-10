import React, { useEffect, useState, useCallback } from 'react';
import { Gauge, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, Flag, Globe2, Siren, FileText, ChevronRight, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { openReader, timeAgo } from '../lib/live';
import { navigateTo } from './AiAssist';
import WatchTabs from './WatchTabs';
import StartHereCard from './StartHereCard';
import RapidBriefModal from './RapidBriefModal';

type Band = 'CRISIS' | 'STRESS' | 'ELEVATED' | 'CALM';
type Trend = 'up' | 'down' | 'flat';
interface Top { title: string; url: string; source: string; published: number }
interface Domain { key: string; label: string; view: string; score: number; band: Band; hot: number; total: number; trend: Trend; top: Top | null; extra: { countries?: { country: string; score: number; band: Band }[] } | null; spark: number[] }
interface Risk {
  updatedAt: number;
  composite: { score: number; band: Band; trend: Trend };
  india: { score: number; band: Band; trend: Trend; top: Top | null };
  world: { score: number; band: Band; trend: Trend; top: Top | null };
  domains: Domain[];
  compositeSpark: number[];
}

const BAND_TEXT: Record<Band, string> = { CRISIS: 'text-calibrex-critical', STRESS: 'text-calibrex-high', ELEVATED: 'text-calibrex-gold', CALM: 'text-calibrex-low' };
const BAND_BG: Record<Band, string> = { CRISIS: 'bg-calibrex-critical', STRESS: 'bg-calibrex-high', ELEVATED: 'bg-calibrex-gold', CALM: 'bg-calibrex-low' };
const BAND_RING: Record<Band, string> = { CRISIS: 'border-calibrex-critical/50', STRESS: 'border-calibrex-high/50', ELEVATED: 'border-calibrex-gold/40', CALM: 'border-calibrex-low/40' };
const BAND_STROKE: Record<Band, string> = { CRISIS: '#ff5a6e', STRESS: '#ff9f45', ELEVATED: '#e9c46a', CALM: '#3ec9a7' };

const TrendIcon: React.FC<{ t: Trend; band: Band }> = ({ t, band }) => {
  if (t === 'up') return <TrendingUp size={14} className={BAND_TEXT[band]} />;
  if (t === 'down') return <TrendingDown size={14} className="text-calibrex-low" />;
  return <Minus size={14} className="text-white/30" />;
};

/** Tiny inline sparkline (0–100 series). No deps; crisp in both themes. */
const Spark: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (!data || data.length < 2) return <div className="h-7" />;
  const w = 100, h = 28, max = 100, min = 0;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-7" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const clampScore = (s: number) => Math.max(0, Math.min(100, s));

/** Semicircular gauge for the composite index. */
const G_ = ({ score, band }: { score: number; band: Band }) => {
  const r = 52, cx = 60, cy = 60;
  const a = Math.PI * (1 - clampScore(score) / 100); // 180°→0°
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  return (
    <svg viewBox="0 0 120 70" className="w-36 h-[70px]">
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
  const [brief, setBrief] = useState<{ title: string; text: string; sources: { title: string; source: string; url: string; published?: number }[] } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<Risk>('/risk').then(r => { setRisk(r); setErr(null); }).catch(() => setErr('Could not load the risk picture.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const crisisFeed = (risk?.domains || [])
    .filter(d => d.top && (d.band === 'CRISIS' || d.band === 'STRESS'))
    .sort((a, b) => b.score - a.score);

  const openTop = (t: Top | null, view: string) => { if (t?.url) openReader({ url: t.url, title: t.title, source: t.source, published: t.published }); else navigateTo(view); };

  const compileBrief = () => {
    if (!risk) return;
    const when = new Date(risk.updatedAt || Date.now()).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const lines = [
      `GLOBAL SITUATION BRIEF`,
      `Composite risk ${risk.composite.score}/100 (${risk.composite.band}). India ${risk.india.score} · World ${risk.world.score}. Compiled ${when}.`,
      `Derived from current reporting across the live wires — an aggregation of observed volume and severity, not a forecast.`,
      ``,
      `BY DOMAIN`,
      ...risk.domains.map(d => `- ${d.label}: ${d.band} (${d.score})${d.top ? ` — ${d.top.title}` : ''}`),
    ];
    if (crisisFeed.length) {
      lines.push(``, `ELEVATED / CRISIS NOW`);
      crisisFeed.forEach((d, i) => lines.push(`${i + 1}. [${d.label}] ${d.top!.title} (${d.top!.source})`));
      lines.push(``, `SOURCES`);
      crisisFeed.filter(d => d.top?.url).forEach((d, i) => lines.push(`[${i + 1}] ${d.top!.url}`));
    }
    const sources = crisisFeed.filter(d => d.top?.url).map(d => ({ title: d.top!.title, source: d.top!.source, url: d.top!.url, published: d.top!.published }));
    setBrief({ title: `Global Situation Brief (${risk.composite.band})`, text: lines.join('\n'), sources });
  };

  return (
    <div className="p-3 sm:p-6 pb-12 w-full overflow-x-hidden">
      <WatchTabs current="command" />
      <StartHereCard />

      <div className="flex items-center justify-between gap-2 mb-4">
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
      ) : !risk ? (
        <div className="flex justify-center py-24 text-calibrex-teal"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* Composite + India/World + Rapid Brief */}
          <div className="grid lg:grid-cols-3 gap-3 mb-4">
            <div className={`rounded-2xl border ${BAND_RING[risk.composite.band]} bg-gradient-to-br from-white/5 to-transparent p-4 flex items-center gap-4`}>
              <G_ score={risk.composite.score} band={risk.composite.band} />
              <div className="min-w-0">
                <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Global risk index</div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-black ${BAND_TEXT[risk.composite.band]}`}>{risk.composite.score}</span>
                  <span className="text-white/30 text-sm font-bold">/100</span>
                  <TrendIcon t={risk.composite.trend} band={risk.composite.band} />
                </div>
                <div className={`text-xs font-black uppercase tracking-widest ${BAND_TEXT[risk.composite.band]}`}>{risk.composite.band}</div>
              </div>
            </div>

            {([['India', risk.india, Flag], ['World', risk.world, Globe2]] as const).map(([label, v, Icon]) => (
              <button key={label} onClick={() => navigateTo('dashboard')} className={`text-left rounded-2xl border ${BAND_RING[v.band]} bg-black/20 p-4 hover:bg-black/30 transition-colors`}>
                <div className="flex items-center gap-2 mb-1"><Icon size={14} className="text-calibrex-teal" /><span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{label}</span></div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-black ${BAND_TEXT[v.band]}`}>{v.score}</span>
                  <TrendIcon t={v.trend} band={v.band} />
                  <span className={`text-[11px] font-black uppercase tracking-widest ${BAND_TEXT[v.band]}`}>{v.band}</span>
                </div>
                {v.top && <div className="text-[11px] text-white/50 truncate mt-1">{v.top.title}</div>}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <button onClick={compileBrief} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-calibrex-teal text-calibrex-navy hover:bg-white active:scale-95"><FileText size={14} /> Rapid Brief — global</button>
            <button onClick={() => navigateTo('alerts')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-calibrex-critical/40 text-calibrex-critical hover:bg-calibrex-critical/10"><Siren size={14} /> {alertCount} active alert{alertCount === 1 ? '' : 's'}</button>
          </div>

          {/* Monitor grid */}
          <div className="text-[10px] font-black text-calibrex-muted uppercase tracking-[0.2em] mb-2 opacity-60">Monitors</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {risk.domains.map(d => (
              <div key={d.key} className={`rounded-xl border ${BAND_RING[d.band]} bg-calibrex-surface p-3 flex flex-col group`}>
                <button onClick={() => navigateTo(d.view)} className="flex items-center justify-between gap-2 mb-1.5 text-left">
                  <span className="text-[12px] font-black text-white uppercase tracking-wide flex items-center gap-1.5">{d.label} <ChevronRight size={12} className="text-white/20 group-hover:text-white/50" /></span>
                  <span className={`w-2 h-2 rounded-full ${BAND_BG[d.band]}`} />
                </button>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className={`text-2xl font-black ${BAND_TEXT[d.band]}`}>{d.score}</span>
                  <TrendIcon t={d.trend} band={d.band} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${BAND_TEXT[d.band]}`}>{d.band}</span>
                </div>
                <Spark data={d.spark} color={BAND_STROKE[d.band]} />
                {d.top && <button onClick={() => openTop(d.top, d.view)} className="text-[11px] text-white/55 hover:text-white text-left leading-snug mt-1.5 line-clamp-2">{d.top.title}</button>}
              </div>
            ))}
          </div>

          {/* Cross-domain crisis feed */}
          {crisisFeed.length > 0 && (
            <>
              <div className="text-[10px] font-black text-calibrex-muted uppercase tracking-[0.2em] mb-2 opacity-60">What's hot right now</div>
              <div className="space-y-2">
                {crisisFeed.map(d => (
                  <button key={d.key} onClick={() => openTop(d.top, d.view)} className="w-full flex items-center gap-3 p-3 bg-calibrex-surface border border-white/5 rounded-lg hover:border-white/20 text-left transition-colors">
                    <span className={`shrink-0 text-[8px] font-black uppercase px-2 py-1 rounded-full border ${BAND_RING[d.band]} ${BAND_TEXT[d.band]}`}>{d.label}</span>
                    <span className="min-w-0 flex-1 text-[12px] text-white/85 truncate">{d.top!.title}</span>
                    <span className="shrink-0 text-[10px] font-mono text-white/35">{d.top!.source}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <RapidBriefModal open={!!brief} onClose={() => setBrief(null)} domain="Command" accent="teal" title={brief?.title || ''} text={brief?.text || ''} sources={brief?.sources || []} />
    </div>
  );
};

export default Command;
