import React, { useEffect, useState, useCallback } from 'react';
import { ScrollText, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { admin, LicenseAuditEntry } from '../lib/api';
import { timeAgo } from '../lib/live';

const ACTION_LABEL: Record<string, string> = {
  signup: 'Signed up (demo)',
  tier_change: 'Licence changed',
  trial_expired: 'Trial expired → demo',
  status_change: 'Status changed',
  role_change: 'Role changed',
};
const ACTION_CLS: Record<string, string> = {
  signup: 'text-calibrex-gold',
  tier_change: 'text-calibrex-teal',
  trial_expired: 'text-calibrex-gold',
  status_change: 'text-white/70',
  role_change: 'text-calibrex-gold',
};

/** Master-admin log of every access/licence change (promotions, trials, expiries, sign-ups). */
const AdminLicenseAudit: React.FC = () => {
  const [entries, setEntries] = useState<LicenseAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries((await admin.licenseAudit()).entries); setError(null); }
    catch (e: any) { setError(e?.message || 'Could not load the licence log.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mt-8 bg-calibrex-surface border border-calibrex-teal/15 rounded-[2rem] p-5 sm:p-8">
      <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-calibrex-teal/10 rounded-2xl border border-calibrex-teal/30"><ScrollText className="text-calibrex-teal" size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-[0.15em]">Licence &amp; access log</h2>
            <p className="text-[11px] text-white/45 mt-0.5">Every promotion, demotion, trial, expiry and sign-up — who did it and when.</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-calibrex-teal text-[10px] font-black uppercase tracking-widest disabled:opacity-40"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {error && <p className="text-[11px] text-calibrex-critical font-bold">{error}</p>}
      {loading && !entries.length ? (
        <div className="py-10 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>
      ) : entries.length === 0 ? (
        <p className="text-[11px] text-white/40 py-6 text-center">No licence activity recorded yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-[28rem] overflow-y-auto custom-scrollbar pr-1">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-3 p-2.5 bg-black/30 border border-white/5 rounded-lg text-[12px]">
              <span className={`shrink-0 font-black uppercase tracking-wider text-[9px] w-36 ${ACTION_CLS[e.action] || 'text-white/60'}`}>{ACTION_LABEL[e.action] || e.action}</span>
              <span className="min-w-0 flex-1 truncate text-white/80">{e.email}</span>
              {(e.from || e.to) && (
                <span className="shrink-0 flex items-center gap-1 font-mono text-[10px] text-white/50 uppercase">{e.from || '—'} <ArrowRight size={10} /> {e.to || '—'}</span>
              )}
              <span className="shrink-0 text-[10px] text-white/35 font-mono">by {e.by}</span>
              <span className="shrink-0 text-[10px] text-white/30 font-mono w-20 text-right">{timeAgo(e.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLicenseAudit;
