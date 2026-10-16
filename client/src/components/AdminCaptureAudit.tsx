import React, { useEffect, useState, useCallback } from 'react';
import { Camera, Loader2, RefreshCw } from 'lucide-react';
import { admin, CaptureAuditEntry } from '../lib/api';
import { timeAgo } from '../lib/live';

const KIND_LABEL: Record<string, string> = {
  printscreen: 'PrintScreen key',
  hidden: 'Left / hid the app',
  unknown: 'Capture signal',
};
const KIND_CLS: Record<string, string> = {
  printscreen: 'text-calibrex-critical',
  hidden: 'text-calibrex-gold',
  unknown: 'text-white/60',
};

/** Master-admin log of detectable screen-capture signals, per account. The web
 *  platform can't block a screenshot, so this makes every detectable capture
 *  attributable: who, which screen, when, and from what device. */
const AdminCaptureAudit: React.FC = () => {
  const [entries, setEntries] = useState<CaptureAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries((await admin.captureAudit()).entries); setError(null); }
    catch (e: any) { setError(e?.message || 'Could not load the capture log.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mt-8 bg-calibrex-surface border border-calibrex-teal/15 rounded-[2rem] p-5 sm:p-8">
      <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-calibrex-critical/10 rounded-2xl border border-calibrex-critical/30"><Camera className="text-calibrex-critical" size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-[0.15em]">Screen-capture log</h2>
            <p className="text-[11px] text-white/45 mt-0.5">Detectable capture signals (PrintScreen, app hidden) stamped to the account. The web can’t block captures — this makes every leak traceable.</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-calibrex-teal text-[10px] font-black uppercase tracking-widest disabled:opacity-40"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {error && <p className="text-[11px] text-calibrex-critical font-bold">{error}</p>}
      {loading && !entries.length ? (
        <div className="py-10 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>
      ) : entries.length === 0 ? (
        <p className="text-[11px] text-white/40 py-6 text-center">No capture signals recorded yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-[28rem] overflow-y-auto custom-scrollbar pr-1">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-3 p-2.5 bg-black/30 border border-white/5 rounded-lg text-[12px]">
              <span className={`shrink-0 font-black uppercase tracking-wider text-[9px] w-32 ${KIND_CLS[e.kind] || 'text-white/60'}`}>{KIND_LABEL[e.kind] || e.kind}</span>
              <span className="min-w-0 flex-1 truncate text-white/80">{e.email}</span>
              {e.view && <span className="shrink-0 font-mono text-[10px] text-white/50 uppercase">{e.view}</span>}
              <span className="shrink-0 text-[10px] text-white/30 font-mono w-20 text-right">{timeAgo(e.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCaptureAudit;
