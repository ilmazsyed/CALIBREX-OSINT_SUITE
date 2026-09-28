import React, { useEffect, useState } from 'react';
import { LineChart, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, Landmark, AlertTriangle } from 'lucide-react';
import { getMarkets, MarketsSnapshot, Quote } from '../lib/markets';
import { timeAgo } from '../lib/live';

const GROUP_ORDER = ['Commodities', 'Forex', 'Indices', 'Crypto'];

const fmt = (v: number, dp: number) => v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtUsd = (v: number) => {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  return `$${v.toLocaleString()}`;
};

const Spark: React.FC<{ data: number[]; up: boolean }> = ({ data, up }) => {
  if (data.length < 2) return null;
  const w = 96, h = 30, min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / rng) * (h - 4)).toFixed(1)}`).join(' ');
  const color = up ? 'var(--cx-up, #44cc44)' : 'var(--cx-down, #ff5555)';
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-24 h-[30px] shrink-0" aria-hidden="true"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" /></svg>;
};

const Change: React.FC<{ q: Quote }> = ({ q }) => {
  const up = q.changePct > 0, flat = Math.abs(q.changePct) < 0.005;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const cls = flat ? 'text-calibrex-muted' : up ? 'text-calibrex-low' : 'text-calibrex-critical';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${cls}`}>
      <Icon size={13} />{q.changePct > 0 ? '+' : ''}{q.changePct.toFixed(2)}%
    </span>
  );
};

const QuoteCard: React.FC<{ q: Quote }> = ({ q }) => (
  <div className="bg-calibrex-surface border border-white/10 rounded-lg p-3.5 flex flex-col gap-1.5">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-white leading-tight truncate">{q.label}</div>
        <div className="text-[10px] text-calibrex-muted uppercase tracking-wide">{q.unit || q.source}</div>
      </div>
      <Spark data={q.spark} up={q.changePct >= 0} />
    </div>
    <div className="flex items-baseline justify-between gap-2 mt-0.5">
      <span className="text-lg font-black text-white tabular-nums">{fmt(q.value, q.dp)}</span>
      <Change q={q} />
    </div>
  </div>
);

const Markets: React.FC = () => {
  const [data, setData] = useState<MarketsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => { setLoading(true); getMarkets().then(d => { setData(d); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 5 * 60000); return () => clearInterval(t); }, []);

  const groups = data ? GROUP_ORDER.filter(g => data.groups[g]?.length).map(g => [g, data.groups[g]] as const) : [];
  const failed = data ? Object.entries(data.sources).filter(([, s]) => !s.ok).length : 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" style={{ ['--cx-up' as any]: '#44cc44', ['--cx-down' as any]: '#ff5555' }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><LineChart size={20} className="text-calibrex-teal" /> Markets &amp; Reserves</h2>
          <p className="text-sm text-calibrex-muted">Crude, gold, forex, indices, crypto and official reserves. Free public data, slightly delayed{data?.updatedAt ? ` · updated ${timeAgo(data.updatedAt)}` : ''}.</p>
        </div>
        <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh</button>
      </div>

      {error && <p className="text-sm text-calibrex-critical">{error}</p>}
      {failed > 0 && <p className="text-xs text-calibrex-high flex items-center gap-1.5"><AlertTriangle size={13} /> {failed} data source{failed === 1 ? '' : 's'} could not be reached this cycle; those figures may be missing or stale.</p>}

      {!data ? <div className="py-16 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div> : (
        <>
          {groups.map(([name, quotes]) => (
            <section key={name}>
              <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3">{name}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {quotes.map(q => <QuoteCard key={q.id} q={q} />)}
              </div>
            </section>
          ))}
          {groups.length === 0 && <p className="text-sm text-calibrex-muted">No market data yet. It loads on the server every 10 minutes.</p>}

          {data.reserves.length > 0 && (
            <section>
              <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3 flex items-center gap-2"><Landmark size={15} /> Foreign exchange &amp; gold reserves</h3>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                {data.reserves.map((r, i) => {
                  const max = data.reserves[0].usd;
                  return (
                    <div key={r.code} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 ? 'bg-black/20' : 'bg-calibrex-surface'}`}>
                      <span className="w-32 shrink-0 text-sm font-bold text-white truncate">{r.country}</span>
                      <div className="flex-1 h-2.5 bg-white/5 rounded"><div className="h-2.5 rounded bg-calibrex-teal" style={{ width: `${(r.usd / max) * 100}%` }} /></div>
                      <span className="w-20 text-right text-sm tabular-nums text-white">{fmtUsd(r.usd)}</span>
                      <span className="w-10 text-right text-xs text-calibrex-muted">{r.year}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-calibrex-muted mt-2">Total reserves including gold (World Bank, annual, most recent year shown). Official figures, not live.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default Markets;
