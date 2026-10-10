import React, { useEffect, useState } from 'react';
import { History, RefreshCw, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/live';

interface Change { field: string; from: string; to: string }
interface Entry { id: string; userId: string; email: string; name: string; at: number; changes: Change[] }

/** Master-admin view of self-service profile edits, newest first. */
const AdminProfileAudit: React.FC = () => {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => { setLoading(true); api<{ entries: Entry[] }>('/admin/profile-audit').then(r => setEntries(r.entries || [])).catch(() => setEntries([])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  return (
    <div className="mt-6 bg-calibrex-surface border border-white/10 rounded-[2rem] p-5 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-[0.2em] flex items-center gap-2"><History size={16} className="text-calibrex-gold" /> Profile edit log</h3>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-calibrex-teal hover:text-calibrex-gold hover:border-calibrex-gold/30 text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <p className="text-[11px] text-calibrex-muted mb-4">Every change an operator makes to their own profile, auto-logged. Read-only.</p>

      {entries === null ? (
        <div className="flex justify-center py-10 text-calibrex-gold"><Loader2 className="animate-spin" /></div>
      ) : entries.length === 0 ? (
        <p className="text-center py-10 text-[11px] text-white/40 uppercase tracking-widest">No profile edits yet</p>
      ) : (
        <div className="space-y-2.5 max-h-[28rem] overflow-y-auto custom-scrollbar pr-1">
          {entries.map(e => (
            <div key={e.id} className="bg-black/25 border border-white/5 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[12px] font-bold text-white truncate">{e.name} <span className="text-calibrex-teal/70 font-mono text-[10px]">{e.email}</span></span>
                <span className="text-[10px] font-mono text-white/35 shrink-0">{timeAgo(e.at)}</span>
              </div>
              <div className="space-y-1">
                {e.changes.map((c, i) => (
                  <div key={i} className="text-[11px] flex flex-wrap items-center gap-1.5">
                    <span className="text-calibrex-gold font-black uppercase text-[9px] tracking-widest">{c.field}</span>
                    <span className="text-white/40 line-through break-all">{c.from || '—'}</span>
                    <span className="text-white/30">→</span>
                    <span className="text-white break-all">{c.to || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminProfileAudit;
