import React, { useEffect, useMemo, useState } from 'react';
import { LineChart as LineIcon, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, Landmark, AlertTriangle, Download, X, Search, Activity } from 'lucide-react';
import { getMarkets, getSeries, movers, MarketsSnapshot, Quote, SeriesPoint } from '../lib/markets';
import { timeAgo } from '../lib/live';
import LineChart from './LineChart';

const GROUP_ORDER = ['Commodities', 'Volatility', 'Indices', 'Forex', 'Crypto'];
const REGION_ORDER = ['Americas', 'Europe', 'Asia-Pacific'];

const fmt = (v: number, dp: number) => v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtUsd = (v: number) => v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${v.toLocaleString()}`;

const Spark: React.FC<{ data: number[]; up: boolean }> = ({ data, up }) => {
  if (data.length < 2) return null;
  const w = 96, h = 30, min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / rng) * (h - 4)).toFixed(1)}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-24 h-[30px] shrink-0" aria-hidden="true"><polyline points={pts} fill="none" stroke={up ? '#3fb950' : '#ff5555'} strokeWidth="1.6" /></svg>;
};

const Change: React.FC<{ pct: number }> = ({ pct }) => {
  const up = pct > 0, flat = Math.abs(pct) < 0.005;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const cls = flat ? 'text-calibrex-muted' : up ? 'text-calibrex-low' : 'text-calibrex-critical';
  return <span className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${cls}`}><Icon size={13} />{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</span>;
};

const QuoteCard: React.FC<{ q: Quote; onOpen: (q: Quote) => void }> = ({ q, onOpen }) => (
  <button onClick={() => onOpen(q)} className="text-left bg-calibrex-surface border border-white/10 rounded-lg p-3.5 flex flex-col gap-1.5 hover:border-calibrex-teal/40 transition-colors">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-white leading-tight truncate">{q.label}</div>
        <div className="text-[10px] text-calibrex-muted uppercase tracking-wide">{q.unit || q.source}</div>
      </div>
      <Spark data={q.spark} up={q.changePct >= 0} />
    </div>
    <div className="flex items-baseline justify-between gap-2 mt-0.5">
      <span className="text-lg font-black text-white tabular-nums">{fmt(q.value, q.dp)}</span>
      <Change pct={q.changePct} />
    </div>
  </button>
);

const Markets: React.FC<{ onInvestigate?: (q: string) => void }> = ({ onInvestigate }) => {
  const [data, setData] = useState<MarketsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Quote | null>(null);
  const [series, setSeries] = useState<SeriesPoint[] | null>(null);

  const load = () => { setLoading(true); getMarkets().then(d => { setData(d); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 5 * 60000); return () => clearInterval(t); }, []);

  const openChart = (q: Quote) => { setOpen(q); setSeries(null); getSeries(q.id).then(r => setSeries(r.series)).catch(() => setSeries([])); };

  const topMovers = useMemo(() => data ? movers(data.groups).slice(0, 8) : [], [data]);
  const failed = data ? Object.entries(data.sources).filter(([, s]) => !s.ok).length : 0;

  const exportCsv = () => {
    if (!data) return;
    const rows = [['id', 'label', 'category', 'value', 'changePct', 'unit', 'asOf', 'source']];
    Object.values(data.groups).flat().forEach(q => rows.push([q.id, q.label, q.category, String(q.value), q.changePct.toFixed(2), q.unit, q.asOf, q.source]));
    const csv = rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `calibrex_markets_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const renderCards = (quotes: Quote[]) => <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{quotes.map(q => <QuoteCard key={q.id} q={q} onOpen={openChart} />)}</div>;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><LineIcon size={20} className="text-calibrex-teal" /> Markets &amp; Reserves</h2>
          <p className="text-sm text-calibrex-muted">Global indices, commodities, forex, the fear gauge, the US yield curve and official reserves. Free public data, end-of-day{data?.updatedAt ? ` · updated ${timeAgo(data.updatedAt)}` : ''}.</p>
        </div>
        <div className="flex gap-2">
          {data && <button onClick={exportCsv} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5"><Download size={14} /> CSV</button>}
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh</button>
        </div>
      </div>

      {error && <p className="text-sm text-calibrex-critical">{error}</p>}
      {failed > 0 && <p className="text-xs text-calibrex-high flex items-center gap-1.5"><AlertTriangle size={13} /> {failed} data source{failed === 1 ? '' : 's'} unreachable this cycle; those figures may be missing or stale.</p>}

      {!data ? <div className="py-16 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div> : (
        <>
          {/* Market signals (crisis engine) */}
          {data.crisis && data.crisis.events.length > 0 && (
            <section>
              <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3 flex items-center gap-2"><AlertTriangle size={15} /> Market signals</h3>
              <div className="space-y-1.5">
                {data.crisis.events.slice(0, 8).map(e => {
                  const cls = e.severity === 'CRITICAL' ? 'border-calibrex-critical bg-calibrex-critical/10' : e.severity === 'HIGH' ? 'border-calibrex-high bg-calibrex-high/5' : 'border-white/10 bg-calibrex-surface';
                  return (
                    <div key={e.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${cls}`}>
                      <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 shrink-0 ${e.severity === 'CRITICAL' ? 'text-calibrex-critical' : e.severity === 'HIGH' ? 'text-calibrex-high' : 'text-calibrex-muted'}`}>{e.severity}</span>
                      <span className="text-sm text-white flex-1 min-w-0">{e.message}</span>
                      {onInvestigate && <button onClick={() => onInvestigate(e.investigate)} title="Investigate the news" className="text-calibrex-gold hover:text-white shrink-0"><Search size={14} /></button>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Country financial-stress index */}
          {data.crisis && data.crisis.stress.length > 0 && (
            <section>
              <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3">Country financial-stress index</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.crisis.stress.map(s => {
                  const color = s.band === 'CRISIS' ? 'bg-calibrex-critical' : s.band === 'STRESS' ? 'bg-calibrex-high' : s.band === 'ELEVATED' ? 'bg-calibrex-medium' : 'bg-calibrex-low';
                  const txt = s.band === 'CRISIS' ? 'text-calibrex-critical' : s.band === 'STRESS' ? 'text-calibrex-high' : s.band === 'ELEVATED' ? 'text-calibrex-medium' : 'text-calibrex-low';
                  return (
                    <div key={s.country} className="bg-calibrex-surface border border-white/10 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1"><span className="text-sm font-bold text-white">{s.country}</span><span className={`text-[10px] font-black uppercase ${txt}`}>{s.band} · {s.score}</span></div>
                      <div className="h-2 bg-white/5 rounded mb-1.5"><div className={`h-2 rounded ${color}`} style={{ width: `${s.score}%` }} /></div>
                      <div className="text-[10px] text-calibrex-muted">{s.drivers.join(' · ')}</div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-calibrex-muted mt-2">Composite of equity drawdown and currency depreciation vs the trailing year. A read on where stress is building — not investment advice.</p>
            </section>
          )}

          {/* Movers board */}
          {topMovers.length > 0 && (
            <section>
              <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3 flex items-center gap-2"><Activity size={15} /> Today's biggest movers</h3>
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                {topMovers.map(q => (
                  <button key={q.id} onClick={() => openChart(q)} className="shrink-0 bg-calibrex-surface border border-white/10 rounded-lg px-3 py-2 hover:border-calibrex-teal/40 text-left min-w-[130px]">
                    <div className="text-[11px] text-calibrex-muted truncate">{q.label}</div>
                    <div className="flex items-baseline justify-between gap-2"><span className="text-sm font-black text-white tabular-nums">{fmt(q.value, q.dp)}</span><Change pct={q.changePct} /></div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Yield curve */}
          {data.yields && (
            <section className="bg-calibrex-surface border border-white/10 rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest">US Treasury yield curve</h3>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${data.yields.inverted ? 'bg-calibrex-critical/15 border-calibrex-critical/40 text-calibrex-critical' : 'bg-calibrex-low/10 border-calibrex-low/40 text-calibrex-low'}`}>
                  10Y–2Y {data.yields.spread10y2y != null ? `${data.yields.spread10y2y > 0 ? '+' : ''}${data.yields.spread10y2y}%` : '—'} {data.yields.inverted ? '· INVERTED' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-4">
                {data.yields.points.map(p => (
                  <div key={p.label} className="text-center"><div className="text-[10px] text-calibrex-muted uppercase">{p.label}</div><div className="text-base font-black text-white tabular-nums">{p.pct.toFixed(2)}%</div></div>
                ))}
              </div>
              {data.yields.inverted && <p className="text-xs text-calibrex-muted mt-2">An inverted curve (10-year below 2-year) has preceded most US recessions — a classic leading indicator.</p>}
            </section>
          )}

          {/* Quote groups */}
          {GROUP_ORDER.filter(g => data.groups[g]?.length).map(name => {
            const quotes = data.groups[name];
            if (name === 'Indices') {
              const byRegion = REGION_ORDER.filter(r => quotes.some(q => q.region === r));
              const other = quotes.filter(q => !q.region);
              return (
                <section key={name}>
                  <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3">Stock indices</h3>
                  {byRegion.map(r => (
                    <div key={r} className="mb-3">
                      <div className="text-[11px] font-bold text-calibrex-muted uppercase tracking-widest mb-2">{r}</div>
                      {renderCards(quotes.filter(q => q.region === r))}
                    </div>
                  ))}
                  {other.length > 0 && renderCards(other)}
                </section>
              );
            }
            return <section key={name}><h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3">{name}</h3>{renderCards(quotes)}</section>;
          })}

          {/* Reserves */}
          {data.reserves.length > 0 && (
            <section>
              <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3 flex items-center gap-2"><Landmark size={15} /> Foreign exchange &amp; gold reserves</h3>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                {data.reserves.map((r, i) => (
                  <div key={r.code} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 ? 'bg-black/20' : 'bg-calibrex-surface'}`}>
                    <span className="w-32 shrink-0 text-sm font-bold text-white truncate">{r.country}</span>
                    <div className="flex-1 h-2.5 bg-white/5 rounded"><div className="h-2.5 rounded bg-calibrex-teal" style={{ width: `${(r.usd / data.reserves[0].usd) * 100}%` }} /></div>
                    <span className="w-20 text-right text-sm tabular-nums text-white">{fmtUsd(r.usd)}</span>
                    <span className="w-10 text-right text-xs text-calibrex-muted">{r.year}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-calibrex-muted mt-2">Total reserves including gold (World Bank, annual, most recent year). Official figures, not live.</p>
            </section>
          )}
        </>
      )}

      {/* Chart modal */}
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(null)}>
          <div className="bg-calibrex-surface border border-white/10 rounded-2xl w-full max-w-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-bold text-white">{open.label}</h3>
                <div className="flex items-baseline gap-3"><span className="text-xl font-black text-white tabular-nums">{fmt(open.value, open.dp)}</span><Change pct={open.changePct} /><span className="text-xs text-calibrex-muted">{open.unit || open.source} · {open.asOf}</span></div>
              </div>
              <button onClick={() => setOpen(null)} className="text-calibrex-muted hover:text-white"><X size={18} /></button>
            </div>
            {series === null ? <div className="h-[240px] flex items-center justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>
              : <LineChart series={series} dp={open.dp} />}
            {onInvestigate && (
              <button onClick={() => { onInvestigate(`${open.label} ${open.changePct < 0 ? 'fall drop' : 'surge rally'}`); setOpen(null); }} className="mt-4 w-full py-2.5 bg-calibrex-gold/15 border border-calibrex-gold/40 text-calibrex-gold text-[11px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2">
                <Search size={14} /> Why did it move? Investigate the news
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Markets;
