import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2, Search, BarChart3 } from 'lucide-react';
import { trends, TrendDay } from '../lib/features';
import { WIRES, WIRE_KEYS, WireKey } from '../lib/live';

const SEV = [
  { key: 'CRITICAL', label: 'Critical', color: '#ff4444' },
  { key: 'HIGH', label: 'High', color: '#ff9900' },
  { key: 'MEDIUM', label: 'Medium', color: '#ffcc00' },
  { key: 'LOW', label: 'Low', color: '#5f7a8f' },
] as const;
const RANGES = [7, 14, 30, 90];

const fmtDay = (d: string, withWeekday = false) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString([], withWeekday ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });

/** Fill gaps so every calendar day in the range has an entry (missing days count as no data). */
function lastNDays(days: TrendDay[], n: number): (TrendDay | null)[] {
  const byDate = new Map(days.map(d => [d.date, d]));
  const out: (TrendDay | null)[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push(byDate.get(date) || null);
  }
  return out;
}

const Change: React.FC<{ now: number; base: number | null }> = ({ now, base }) => {
  if (base === null || (base === 0 && now > 0)) return <span className="text-calibrex-muted text-xs">new</span>;
  if (base === 0 && now === 0) return <span className="text-calibrex-muted text-xs flex items-center gap-1"><Minus size={12} /> 0%</span>;
  const pct = base === 0 ? 100 : Math.round(((now - base) / base) * 100);
  const up = pct > 0;
  const Icon = pct === 0 ? Minus : up ? TrendingUp : TrendingDown;
  return <span className={`text-xs font-bold flex items-center gap-1 ${pct === 0 ? 'text-calibrex-muted' : up ? 'text-calibrex-high' : 'text-calibrex-low'}`}><Icon size={12} />{up ? '+' : ''}{pct}%</span>;
};

/** Stacked daily bars by severity. */
const VolumeChart: React.FC<{ series: (TrendDay | null)[]; dates: string[] }> = ({ series, dates }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 220, P = { l: 36, r: 8, t: 10, b: 26 };
  const max = Math.max(1, ...series.map(d => d?.total || 0));
  const niceMax = Math.ceil(max / 10) * 10 || 10;
  const bw = (W - P.l - P.r) / series.length;
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / niceMax);
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.ceil(series.length / 8);
  const h = hover !== null ? series[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Reports per day by severity">
        {ticks.map(t => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#a8b5c5">{t}</text>
          </g>
        ))}
        {series.map((d, i) => {
          const x = P.l + i * bw + bw * 0.15;
          const w = Math.max(2, bw * 0.7);
          let acc = 0;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={P.l + i * bw} y={P.t} width={bw} height={H - P.t - P.b} fill={hover === i ? 'rgba(255,255,255,0.04)' : 'transparent'} />
              {d ? [...SEV].reverse().map(s => {
                const v = d.severity?.[s.key] || 0;
                if (!v) return null;
                const top = y(acc + v);
                const hgt = y(acc) - top;
                acc += v;
                return <rect key={s.key} x={x} y={top} width={w} height={Math.max(0, hgt - 1)} fill={s.color} rx={1} />;
              }) : <rect x={x} y={y(0) - 2} width={w} height={2} fill="rgba(255,255,255,0.12)" />}
              {i % labelEvery === 0 && <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#a8b5c5">{fmtDay(dates[i])}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="absolute top-0 right-0 bg-black/85 border border-white/15 rounded p-2 text-xs pointer-events-none">
          <div className="font-bold text-white mb-1">{fmtDay(dates[hover], true)}</div>
          {h ? <>
            <div className="text-white">{h.total} reports</div>
            {SEV.map(s => <div key={s.key} className="flex items-center gap-1.5 text-calibrex-muted"><span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />{s.label}: {h.severity?.[s.key] || 0}</div>)}
          </> : <div className="text-calibrex-muted">No data recorded</div>}
        </div>
      )}
    </div>
  );
};

const Sparkline: React.FC<{ values: (number | null)[] }> = ({ values }) => {
  const W = 120, H = 32;
  const max = Math.max(1, ...values.map(v => v || 0));
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const pts = values.map((v, i) => (v === null ? null : [i * step, H - 2 - (v / max) * (H - 4)] as const));
  // Break the line where a day has no data.
  let path = '';
  let pen = false;
  for (const p of pts) {
    if (!p) { pen = false; continue; }
    path += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)} `;
    pen = true;
  }
  const lastPt = [...pts].reverse().find(Boolean);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[120px] h-8" aria-hidden="true">
      <path d={path.trim()} fill="none" stroke="#2a8a9a" strokeWidth="1.8" strokeLinejoin="round" />
      {lastPt && <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill="#2a8a9a" />}
    </svg>
  );
};

const Trends: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [days, setDays] = useState<TrendDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(14);

  useEffect(() => {
    const load = () => trends.get().then(r => setDays(r.days)).catch(e => setError(e.message));
    load();
    const t = setInterval(load, 5 * 60000);
    return () => clearInterval(t);
  }, []);

  const view = useMemo(() => {
    if (!days) return null;
    const series = lastNDays(days, range);
    const dates = series.map((_, i) => new Date(Date.now() - (range - 1 - i) * 86400000).toISOString().slice(0, 10));
    const today = series[series.length - 1];
    // Baseline: average of the 7 recorded days before today.
    const prev = series.slice(-8, -1).filter(Boolean) as TrendDay[];
    const avg = (f: (d: TrendDay) => number) => (prev.length ? prev.reduce((a, d) => a + f(d), 0) / prev.length : null);
    const wires = WIRE_KEYS.map(k => ({
      key: k, label: WIRES[k].label,
      today: today?.wires?.[k] || 0,
      base: avg(d => d.wires?.[k] || 0),
      values: series.map(d => (d ? d.wires?.[k] || 0 : null)),
    }));
    const placeNames = new Set<string>();
    [today, ...prev].forEach(d => d && Object.keys(d.places || {}).forEach(p => placeNames.add(p)));
    const places = [...placeNames].map(name => ({ name, today: today?.places?.[name] || 0, base: avg(d => d.places?.[name] || 0) }))
      .filter(p => p.today > 0)
      .map(p => ({ ...p, lift: p.base === null ? p.today : p.today - p.base }))
      .sort((a, b) => b.lift - a.lift || b.today - a.today)
      .slice(0, 12);
    return { series, dates, today, total: today?.total || 0, base: avg(d => d.total), wires, places, recorded: days.length };
  }, [days, range]);

  if (error) return <div className="p-6 text-calibrex-critical text-sm">{error}</div>;
  if (!view) return <div className="p-10 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><BarChart3 size={20} className="text-calibrex-teal" /> Trends</h2>
          <p className="text-sm text-calibrex-muted">Daily report volume from the live wires (UTC days). {view.recorded < 8 ? `History builds up day by day: ${view.recorded} day${view.recorded === 1 ? '' : 's'} recorded so far.` : `${view.recorded} days recorded.`}</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Time range">
          {RANGES.map(r => <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded text-sm font-bold ${range === r ? 'bg-calibrex-teal text-calibrex-navy' : 'bg-white/5 text-calibrex-muted hover:text-white'}`}>{r}d</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg bg-calibrex-surface border border-white/10">
          <div className="text-xs text-calibrex-muted">Reports today</div>
          <div className="text-2xl font-black text-white tabular-nums">{view.total}</div>
          <Change now={view.total} base={view.base} />
        </div>
        {SEV.slice(0, 3).map(s => (
          <div key={s.key} className="p-4 rounded-lg bg-calibrex-surface border border-white/10">
            <div className="text-xs text-calibrex-muted flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />{s.label} today</div>
            <div className="text-2xl font-black text-white tabular-nums">{view.today?.severity?.[s.key] || 0}</div>
          </div>
        ))}
      </div>

      <section className="p-4 rounded-lg bg-calibrex-surface border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold text-white">Reports per day by severity</h3>
          <div className="flex flex-wrap gap-3">{SEV.map(s => <span key={s.key} className="text-xs text-calibrex-muted flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>)}</div>
        </div>
        <VolumeChart series={view.series} dates={view.dates} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="p-4 rounded-lg bg-calibrex-surface border border-white/10">
          <h3 className="text-sm font-bold text-white mb-1">By wire</h3>
          <p className="text-xs text-calibrex-muted mb-3">Today against the average of the previous 7 days.</p>
          <ul className="divide-y divide-white/5">
            {view.wires.map(w => (
              <li key={w.key} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{w.label}</div>
                  <div className="text-xs text-calibrex-muted tabular-nums">{w.today} today{w.base !== null ? ` · avg ${w.base.toFixed(1)}` : ''}</div>
                </div>
                <Sparkline values={w.values} />
                <div className="w-14 flex justify-end"><Change now={w.today} base={w.base} /></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="p-4 rounded-lg bg-calibrex-surface border border-white/10">
          <h3 className="text-sm font-bold text-white mb-1">Places gaining attention</h3>
          <p className="text-xs text-calibrex-muted mb-3">Most reports today above their usual level.</p>
          {view.places.length === 0 ? <p className="text-sm text-calibrex-muted py-6 text-center">No located reports yet today.</p> : (
            <ul className="divide-y divide-white/5">
              {view.places.map(p => {
                const maxToday = Math.max(...view.places.map(x => x.today));
                return (
                  <li key={p.name} className="py-2 flex items-center gap-3">
                    <button onClick={() => onInvestigate(p.name)} className="w-32 shrink-0 text-left text-sm font-bold text-white hover:text-calibrex-teal truncate flex items-center gap-1.5" title={`Research ${p.name}`}><Search size={12} className="opacity-60 shrink-0" /><span className="truncate">{p.name}</span></button>
                    <div className="flex-1 h-2 bg-white/5 rounded"><div className="h-2 rounded bg-calibrex-teal" style={{ width: `${(p.today / maxToday) * 100}%` }} /></div>
                    <span className="w-8 text-right text-sm tabular-nums text-white">{p.today}</span>
                    <div className="w-14 flex justify-end"><Change now={p.today} base={p.base} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default Trends;
