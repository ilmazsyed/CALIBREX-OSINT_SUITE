import React, { useEffect, useState, useCallback } from 'react';
import { Inbox, Loader2, RefreshCw, Check, X } from 'lucide-react';
import { admin, FeatureRequest, FeatureDef } from '../lib/api';
import { timeAgo } from '../lib/live';

/** Master-admin queue of feature / plan access requests. */
const AdminFeatureRequests: React.FC<{ features: FeatureDef[]; onDecided?: () => void }> = ({ features, onDecided }) => {
  const [reqs, setReqs] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nameOf = (id: string | null) => features.find(f => f.id === id)?.name || id || '';

  const load = useCallback(async () => {
    setLoading(true);
    try { setReqs((await admin.featureRequests()).requests); setError(null); }
    catch (e: any) { setError(e?.message || 'Could not load requests.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 45000); return () => clearInterval(t); }, [load]);

  const decide = async (r: FeatureRequest, decision: 'approved' | 'denied') => {
    setBusy(r.id);
    try { await admin.decideRequest(r.id, decision); await load(); onDecided?.(); }
    catch { /* ignore */ }
    finally { setBusy(null); }
  };

  const pending = reqs.filter(r => r.status === 'pending');
  const decided = reqs.filter(r => r.status !== 'pending').slice(0, 40);

  return (
    <div className="mt-8 bg-calibrex-surface border border-calibrex-gold/20 rounded-[2rem] p-5 sm:p-8">
      <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-calibrex-gold/10 rounded-2xl border border-calibrex-gold/30 relative"><Inbox className="text-calibrex-gold" size={24} />{pending.length > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-calibrex-critical text-white text-[10px] font-black flex items-center justify-center">{pending.length}</span>}</div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-[0.15em]">Access requests</h2>
            <p className="text-[11px] text-white/45 mt-0.5">Approve or deny feature add-ons and plan upgrades. Approving unlocks it for that account.</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-calibrex-teal text-[10px] font-black uppercase tracking-widest disabled:opacity-40"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {error && <p className="text-[11px] text-calibrex-critical font-bold mb-3">{error}</p>}
      {loading && !reqs.length ? (
        <div className="py-10 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>
      ) : pending.length === 0 ? (
        <p className="text-[11px] text-white/40 py-4 text-center">No pending requests.</p>
      ) : (
        <div className="space-y-2">
          {pending.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-3 bg-black/30 border border-calibrex-gold/20 rounded-xl text-[12px]">
              <span className="min-w-0 flex-1">
                <span className="block text-white font-bold truncate">{r.email}</span>
                <span className="block text-white/55">wants {r.kind === 'plan' ? <>the <b className="text-calibrex-teal capitalize">{r.plan}</b> plan</> : <>the <b className="text-calibrex-teal">{nameOf(r.featureId)}</b> feature{r.group ? ` (${r.group})` : ''}</>} · {timeAgo(r.at)}</span>
                {r.note && <span className="block text-white/40 italic mt-0.5">“{r.note}”</span>}
              </span>
              <button onClick={() => decide(r, 'approved')} disabled={busy === r.id} className="px-3 py-2 rounded-lg bg-calibrex-low/15 border border-calibrex-low/40 text-calibrex-low text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"><Check size={13} /> Approve</button>
              <button onClick={() => decide(r, 'denied')} disabled={busy === r.id} className="px-3 py-2 rounded-lg border border-white/15 text-white/60 hover:text-calibrex-critical text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"><X size={13} /> Deny</button>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-1">
          <div className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">Recent decisions</div>
          {decided.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-2 text-[11px] text-white/50">
              <span className={`shrink-0 font-black uppercase text-[9px] ${r.status === 'approved' ? 'text-calibrex-low' : 'text-white/40'}`}>{r.status}</span>
              <span className="flex-1 truncate">{r.email} · {r.kind === 'plan' ? `${r.plan} plan` : nameOf(r.featureId)}</span>
              <span className="shrink-0 text-white/30 font-mono">{r.decidedBy || ''} · {r.decidedAt ? timeAgo(r.decidedAt) : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFeatureRequests;
