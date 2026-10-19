import React, { useEffect, useState, useCallback } from 'react';
import { ScrollText, Loader2, RefreshCw } from 'lucide-react';
import { admin, EntAuditEntry } from '../lib/api';
import { timeAgo } from '../lib/live';

const ACTION_CLS: Record<string, string> = {
  select: 'text-calibrex-teal', request: 'text-calibrex-gold',
  request_approved: 'text-calibrex-low', request_denied: 'text-white/50',
  admin_edit: 'text-calibrex-gold', pricing: 'text-calibrex-teal',
};

/** Master-admin log of every subscription/entitlement change. */
const AdminEntitlementAudit: React.FC = () => {
  const [entries, setEntries] = useState<EntAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries((await admin.entitlementAudit()).entries); setError(null); }
    catch (e: any) { setError(e?.message || 'Could not load the log.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mt-8 bg-calibrex-surface border border-calibrex-teal/15 rounded-[2rem] p-5 sm:p-8">
      <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-calibrex-teal/10 rounded-2xl border border-calibrex-teal/30"><ScrollText className="text-calibrex-teal" size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-[0.15em]">Subscription log</h2>
            <p className="text-[11px] text-white/45 mt-0.5">Selections, requests, approvals, admin edits and price changes — who and when.</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-calibrex-teal text-[10px] font-black uppercase tracking-widest disabled:opacity-40"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>
      {error && <p className="text-[11px] text-calibrex-critical font-bold">{error}</p>}
      {loading && !entries.length ? (
        <div className="py-10 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>
      ) : entries.length === 0 ? (
        <p className="text-[11px] text-white/40 py-6 text-center">No subscription activity yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-[28rem] overflow-y-auto custom-scrollbar pr-1">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-3 p-2.5 bg-black/30 border border-white/5 rounded-lg text-[12px]">
              <span className={`shrink-0 font-black uppercase tracking-wider text-[9px] w-32 ${ACTION_CLS[e.action] || 'text-white/60'}`}>{e.action.replace(/_/g, ' ')}</span>
              <span className="min-w-0 flex-1 truncate text-white/80">{e.email}</span>
              <span className="shrink-0 text-[10px] text-white/45 font-mono truncate max-w-[40%]">{e.detail}</span>
              <span className="shrink-0 text-[10px] text-white/30 font-mono w-20 text-right">{timeAgo(e.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminEntitlementAudit;
