import React, { useEffect, useState } from 'react';
import { GitMerge, Loader2, Swords, Flame, Activity, Mountain, Waves, Newspaper } from 'lucide-react';
import { getCorrelations, CorrelationSnapshot } from '../lib/correlation';
import { timeAgo } from '../lib/live';

const STREAM: Record<string, { icon: React.ReactNode; label: string }> = {
  news: { icon: <Newspaper size={11} />, label: 'News' },
  conflict: { icon: <Swords size={11} />, label: 'Conflict' },
  fire: { icon: <Flame size={11} />, label: 'Fire' },
  quake: { icon: <Mountain size={11} />, label: 'Seismic' },
  natural: { icon: <Waves size={11} />, label: 'Natural' },
};

/** Cross-stream convergence alerts — where ≥2 different signal streams are active on one country. */
const ConvergenceAlerts: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [d, setD] = useState<CorrelationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => getCorrelations().then(setD).catch(() => {}).finally(() => setLoading(false));
    load(); const t = setInterval(load, 5 * 60000); return () => clearInterval(t);
  }, []);

  if (loading) return <div className="py-6 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" size={16} /></div>;
  const list = (d?.convergences || []).slice(0, 8);
  if (!list.length) return null;

  return (
    <div className="rounded-2xl border border-calibrex-teal/25 bg-calibrex-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><GitMerge size={16} className="text-calibrex-teal" /> Signal Convergence</h3>
        {d?.updatedAt ? <span className="text-[10px] font-mono text-white/35">updated {timeAgo(d.updatedAt)}</span> : null}
      </div>
      <p className="text-[10px] text-white/40 mb-3">Countries where multiple independent signal streams are active at once — a prompt to look, not a forecast.</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {list.map(c => (
          <button key={c.country} onClick={() => onInvestigate(c.country)} className="text-left rounded-lg border border-white/10 bg-black/30 p-3 hover:border-calibrex-teal/40">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-bold text-white">{c.country}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-calibrex-teal bg-calibrex-teal/10 border border-calibrex-teal/30 rounded px-1.5 py-0.5">{c.streamCount} streams</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {c.streams.map(s => (
                <span key={s} className="text-[9px] font-mono text-white/60 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 flex items-center gap-1">{STREAM[s]?.icon}{STREAM[s]?.label || s}</span>
              ))}
            </div>
            <ul className="space-y-1">
              {c.details.slice(0, 3).map((x, i) => (
                <li key={i} className="text-[11px] text-white/55 leading-snug flex gap-1.5"><span className="text-white/30 shrink-0">·</span><span className="line-clamp-2">{x.text}</span></li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ConvergenceAlerts;
