import React, { useEffect, useState } from 'react';
import { X, Ship, Loader2, RefreshCw } from 'lucide-react';
import { ai } from '../lib/features';

/**
 * Supply-chain disruption board: live signal intensity near the world's
 * strategic ports, maritime chokepoints and energy terminals. Observed
 * reporting, not a forecast.
 */
const STATUS_COLOR: Record<string, string> = { HIGH: '#ff5252', ELEVATED: '#ff9800', WATCH: '#ffd54f', NORMAL: '#6ce1c4' };

const SupplyBoard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => { setBusy(true); setErr(null); ai.supplyPorts(300).then(setData).catch(e => setErr(e?.message || 'Could not load the board.')).finally(() => setBusy(false)); };
  useEffect(load, []);

  return (
    <div className="fixed inset-0 z-[1300] bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="cx-card rounded-2xl p-5 sm:p-6 max-w-2xl w-full my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div><div className="cx-eyebrow mb-0.5">Supply chain</div><h2 className="font-display text-base text-white flex items-center gap-2"><Ship size={18} className="text-calibrex-teal" /> Chokepoint &amp; port board</h2></div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={busy} className="p-2 rounded-lg border border-white/15 text-white/70 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}</button>
            <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
          </div>
        </div>
        <p className="text-[11px] text-calibrex-muted mb-3">Live disruption within ~300&nbsp;km of each strategic node (conflict, maritime, outages, hazards). Observed signals, not a forecast.</p>

        {err && <div className="bg-calibrex-critical/15 border border-calibrex-critical/40 text-[12px] text-white px-3 py-2 rounded-lg mb-3">{err}</div>}
        {!data && !err && <div className="py-10 text-center text-calibrex-muted text-sm"><Loader2 className="animate-spin inline mr-2" size={14} /> Scoring nodes…</div>}

        {data && (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
            {data.nodes.map((n: any) => (
              <div key={n.id} className="flex items-center gap-3 bg-black/25 border border-white/10 rounded-lg px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[n.status] || '#6ce1c4' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-white truncate">{n.name} <span className="text-[10px] font-mono text-white/35 uppercase">{n.type}</span></div>
                  <div className="text-[10px] text-white/40">{n.country}{n.signalCount ? ` · ${n.signalCount} nearby signal${n.signalCount === 1 ? '' : 's'}` : ' · quiet'}</div>
                </div>
                <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: STATUS_COLOR[n.status], background: `${STATUS_COLOR[n.status]}1f`, border: `1px solid ${STATUS_COLOR[n.status]}55` }}>{n.status} · {n.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplyBoard;
