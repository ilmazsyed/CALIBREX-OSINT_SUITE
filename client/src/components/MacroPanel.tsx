import React, { useEffect, useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { getMacro, MacroSnapshot } from '../lib/macro';
import { timeAgo } from '../lib/live';

const fmt = (v?: { value: number; year: string }) => (v ? v.value.toFixed(1) : '—');
// For inflation / debt, higher is worse (red); for growth, lower is worse.
const tone = (key: string, v?: { value: number }) => {
  if (!v) return 'text-white/40';
  if (key === 'gdpGrowth') return v.value < 0 ? 'text-calibrex-critical' : v.value < 2 ? 'text-calibrex-gold' : 'text-calibrex-low';
  if (key === 'inflation') return v.value >= 15 ? 'text-calibrex-critical' : v.value >= 7 ? 'text-calibrex-gold' : 'text-white/70';
  if (key === 'govDebt') return v.value >= 100 ? 'text-calibrex-critical' : v.value >= 70 ? 'text-calibrex-gold' : 'text-white/70';
  return 'text-white/70';
};

/** Macro & economic-vulnerability context (World Bank, annual). */
const MacroPanel: React.FC = () => {
  const [d, setD] = useState<MacroSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getMacro().then(setD).catch(() => {}).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="py-6 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" size={16} /></div>;
  if (!d?.countries?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-calibrex-surface p-4 sm:p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Landmark size={16} className="text-calibrex-teal" /> Macro &amp; vulnerability</h3>
        {d.updatedAt ? <span className="text-[10px] font-mono text-white/35">updated {timeAgo(d.updatedAt)}</span> : null}
      </div>
      <p className="text-[10px] text-white/40 mb-3">{d.note}</p>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-[11px] min-w-[560px]">
          <thead>
            <tr className="text-white/40 text-left uppercase tracking-widest text-[9px]">
              <th className="py-1.5 pr-3">Country</th>
              {d.indicators.map(i => <th key={i.key} className="py-1.5 px-2 text-right">{i.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {d.countries.map(c => (
              <tr key={c.iso} className="border-t border-white/5">
                <td className="py-1.5 pr-3 font-bold text-white whitespace-nowrap">{c.country}</td>
                {d.indicators.map(i => (
                  <td key={i.key} className={`py-1.5 px-2 text-right font-mono tabular-nums ${tone(i.key, c.indicators[i.key])}`}>
                    {fmt(c.indicators[i.key])}
                    {c.indicators[i.key] && <span className="text-white/25 text-[8px] ml-0.5">'{String(c.indicators[i.key].year).slice(2)}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MacroPanel;
