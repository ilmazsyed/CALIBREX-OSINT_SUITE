import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Loader2, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { getInstability, InstabilitySnapshot, InstabilityCountry } from '../lib/instability';
import { openReader, timeAgo } from '../lib/live';

const BAND: Record<string, string> = {
  SEVERE: 'text-calibrex-critical border-calibrex-critical/50 bg-calibrex-critical/10',
  HIGH: 'text-calibrex-high border-calibrex-high/50 bg-calibrex-high/10',
  ELEVATED: 'text-calibrex-gold border-calibrex-gold/40 bg-calibrex-gold/10',
  LOW: 'text-calibrex-low border-calibrex-low/40 bg-calibrex-low/10',
};
const BAR: Record<string, string> = { SEVERE: 'bg-calibrex-critical', HIGH: 'bg-calibrex-high', ELEVATED: 'bg-calibrex-gold', LOW: 'bg-calibrex-low' };

/** Country Instability Index — observed instability-signal intensity (not a forecast). */
const InstabilityIndex: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [d, setD] = useState<InstabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const load = () => getInstability().then(setD).catch(() => {}).finally(() => setLoading(false));
    load(); const t = setInterval(load, 5 * 60000); return () => clearInterval(t);
  }, []);

  const top = useMemo(() => (d?.countries || []).slice(0, 12), [d]);
  if (loading) return <div className="py-8 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" size={18} /></div>;
  if (!top.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-calibrex-surface p-4 sm:p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Activity size={16} className="text-calibrex-teal" /> Country Instability Index</h3>
        {d?.updatedAt ? <span className="text-[10px] font-mono text-white/35">updated {timeAgo(d.updatedAt)}</span> : null}
      </div>
      <p className="text-[10px] text-white/40 mb-3">Observed instability-signal intensity across the live wires, last 72h — not a forecast.</p>
      <div className="space-y-1.5">
        {top.map((c: InstabilityCountry) => (
          <div key={c.country} className="rounded-lg border border-white/5 bg-black/30">
            <button onClick={() => setOpen(open === c.country ? null : c.country)} className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-white/5 rounded-lg">
              <span className={`shrink-0 w-14 text-center text-[10px] font-black uppercase px-1.5 py-1 rounded border ${BAND[c.band]}`}>{c.band}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-white truncate">{c.country}</span>
                  {c.delta24h !== 0 && (
                    <span className={`text-[9px] font-mono flex items-center gap-0.5 ${c.delta24h > 0 ? 'text-calibrex-critical' : 'text-calibrex-low'}`}>
                      {c.delta24h > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{Math.abs(c.delta24h)}
                    </span>
                  )}
                </span>
                <span className="block mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><span className={`block h-full ${BAR[c.band]}`} style={{ width: `${c.score}%` }} /></span>
              </span>
              <span className="shrink-0 text-lg font-black tabular-nums text-white w-9 text-right">{c.score}</span>
              <ChevronRight size={14} className={`shrink-0 text-white/30 transition-transform ${open === c.country ? 'rotate-90' : ''}`} />
            </button>
            {open === c.country && (
              <div className="px-2.5 pb-2.5 space-y-1 border-t border-white/5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">{c.reports} instability reports in window</span>
                  <button onClick={() => onInvestigate(c.country)} className="text-[10px] font-black uppercase tracking-widest text-calibrex-teal hover:text-white">Investigate →</button>
                </div>
                {c.signals.map((s, i) => (
                  <button key={i} onClick={() => s.url && openReader({ url: s.url, title: s.title, source: s.source })} className="w-full text-left flex items-start gap-2 p-1.5 rounded hover:bg-white/5">
                    <span className="text-[13px] leading-tight text-white/80 flex-1">{s.title}</span>
                    <span className="text-[9px] font-mono text-white/30 shrink-0">{s.source}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InstabilityIndex;
