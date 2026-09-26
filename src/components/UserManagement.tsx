import React, { useEffect, useMemo, useState } from 'react';
import { Users, ShieldOff, Fingerprint, Activity, ShieldAlert, Database, ShieldCheck, Radio, Eye, Share2, Loader2, RotateCcw } from 'lucide-react';
import { VisitRecord, LivePeer, Revocation, resolveProfiles, setRevoked } from '../lib/claude';

interface Props {
  visits: VisitRecord[];
  peers: LivePeer[];
  revocations: Record<string, Revocation>;
  onNotify: (msg: string) => void;
}

const VIEW_LABELS: Record<string, string> = {
  'dashboard': 'Dashboard', 'geopolitical': 'Crisis Monitor', 'research': 'Intelligence Research',
  'report-gen': 'Report Generator', 'dispatch-studio': 'Dispatch Studio', 'tools': 'OSINT Tools',
  'history': 'Report History', 'alerts': 'Active Alerts', 'settings': 'Settings', 'info': 'Platform Info',
  'threat-wire': 'Threat Wire', 'dev-registry': 'User Management',
};

function ago(iso?: string) {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type Row = VisitRecord & { live?: LivePeer; revoked?: Revocation };

const UserManagement: React.FC<Props> = ({ visits, peers, revocations, onNotify }) => {
  const [profiles, setProfiles] = useState<Record<string, { name: string; email: string | null; avatarUrl: string; guest: boolean }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'live' | 'revoked'>('all');

  const rows: Row[] = useMemo(() => {
    const byId = new Map<string, Row>();
    for (const v of visits) byId.set(v.id, { ...v });
    for (const p of peers) {
      if (!p.by || p.isMe) continue;
      const r: Row = byId.get(p.by) || { id: p.by, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), visits: 1, guest: p.guest };
      byId.set(p.by, { ...r, live: p, lastView: p.view || r.lastView });
    }
    for (const id of Object.keys(revocations)) {
      const r: Row = byId.get(id) || { id, firstSeen: revocations[id].at, lastSeen: revocations[id].at, visits: 0 };
      byId.set(id, { ...r, revoked: revocations[id] });
    }
    return [...byId.values()].sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.lastSeen.localeCompare(a.lastSeen));
  }, [visits, peers, revocations]);

  const idsKey = rows.map(r => r.id).join(',');
  useEffect(() => {
    let alive = true;
    resolveProfiles(rows.map(r => r.id)).then(p => { if (alive) setProfiles(p); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const anonymousLive = peers.filter(p => !p.by && !p.isMe).length;
  const shown = rows.filter(r => filter === 'all' || (filter === 'live' ? !!r.live : !!r.revoked));

  const toggle = async (row: Row) => {
    setBusy(row.id);
    try {
      await setRevoked(row.id, !row.revoked, revocations);
      const who = profiles[row.id]?.name || row.callsign || 'Operator';
      onNotify(row.revoked ? `Clearance restored: ${who}` : `Clearance revoked: ${who}`);
    } catch {
      onNotify('Could not update clearance. Check your connection and try again.');
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto pb-32">
      <div className="bg-calibrex-surface backdrop-blur-xl border border-calibrex-gold/20 rounded-[2rem] p-5 sm:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-8 duration-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-calibrex-gold/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-calibrex-teal/5 rounded-full -ml-24 -mb-24 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6 border-b border-white/5 pb-8 relative z-10">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-calibrex-gold/10 rounded-2xl border border-calibrex-gold/30 shadow-[0_0_20px_rgba(201,169,97,0.15)]">
              <Users className="text-calibrex-gold" size={32} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-[0.2em] mb-1">Master Identity Registry</h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] text-calibrex-gold font-black uppercase tracking-widest bg-calibrex-gold/10 px-2 py-0.5 rounded border border-calibrex-gold/20">Clearance: Level V</span>
                <span className="text-[10px] text-white/40 font-mono uppercase tracking-tighter">Owner-only oversight · live</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {(['all', 'live', 'revoked'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${filter === f ? 'bg-calibrex-gold text-calibrex-navy border-calibrex-gold' : 'bg-white/5 text-white/50 border-white/10 hover:border-calibrex-gold/40'}`}>{f}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 relative z-10">
          <div className="bg-black/40 border border-white/5 p-4 sm:p-5 rounded-2xl shadow-inner">
            <div className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Known Operators</div>
            <div className="text-xl font-black text-calibrex-teal tabular-nums">{rows.length}</div>
          </div>
          <div className="bg-black/40 border border-white/5 p-4 sm:p-5 rounded-2xl shadow-inner">
            <div className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Online Now</div>
            <div className="text-xl font-black text-calibrex-low tabular-nums">{rows.filter(r => r.live).length + anonymousLive}</div>
          </div>
          <div className="bg-black/40 border border-white/5 p-4 sm:p-5 rounded-2xl shadow-inner">
            <div className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Revoked</div>
            <div className="text-xl font-black text-calibrex-critical tabular-nums">{Object.keys(revocations).length}</div>
          </div>
          <div className="bg-black/40 border border-white/5 p-4 sm:p-5 rounded-2xl shadow-inner">
            <div className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Total Sessions</div>
            <div className="text-xl font-black text-calibrex-gold tabular-nums">{rows.reduce((n, r) => n + (r.visits || 0), 0)}</div>
          </div>
        </div>

        <div className="mb-8 relative z-10 bg-calibrex-teal/5 border border-calibrex-teal/20 rounded-2xl p-4 sm:p-5 flex gap-4 items-start">
          <Share2 size={18} className="text-calibrex-teal shrink-0 mt-0.5" />
          <div className="text-[11px] text-white/70 leading-relaxed space-y-1.5">
            <p><strong className="text-white">Grant access</strong> with the Share button at the top of this page in claude.ai. Every person signs in with their own Claude account, and their AI usage runs on that account.</p>
            <p><strong className="text-white">Revoke</strong> below locks a person out of the studio immediately, including mid-session. To remove the link from their account entirely, also remove them in the Share menu.</p>
            <p className="text-white/40">People who can write to this page log their own visits. View-only guests are logged while you have this console open.</p>
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          {shown.length === 0 ? (
            <div className="py-12 sm:py-20 text-center flex flex-col items-center gap-6 bg-black/20 rounded-3xl border border-dashed border-white/10">
              <ShieldOff className="text-white/20" size={48} />
              <div className="space-y-2 px-4">
                <p className="text-sm font-black text-white/40 uppercase tracking-[0.3em]">{filter === 'all' ? 'No operators yet' : filter === 'live' ? 'Nobody else online' : 'No revoked operators'}</p>
                <p className="text-[10px] font-mono text-white/30 uppercase">{filter === 'all' ? 'Share this page to provision operators. They appear here on their first visit.' : 'The registry updates live.'}</p>
              </div>
            </div>
          ) : shown.map((u, i) => {
            const p = profiles[u.id];
            const name = p?.name || u.callsign || 'Unresolved operator';
            return (
              <div key={u.id} className={`bg-black/40 p-4 sm:p-6 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center group transition-all gap-4 sm:gap-6 shadow-xl relative overflow-hidden ${u.revoked ? 'border-calibrex-critical/30 opacity-80' : 'border-white/5 hover:border-calibrex-teal/40'}`}>
                <div className="flex gap-4 sm:gap-5 items-center flex-1 w-full min-w-0">
                  <div className="relative shrink-0">
                    {p?.avatarUrl
                      ? <img src={p.avatarUrl} alt="" className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border border-calibrex-teal/20" />
                      : <div className="w-12 h-12 sm:w-14 sm:h-14 bg-calibrex-teal/10 rounded-2xl border border-calibrex-teal/20 flex items-center justify-center text-calibrex-teal"><Fingerprint size={22} /></div>}
                    {u.live && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-calibrex-low border-2 border-calibrex-dark animate-pulse" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <div className="text-base sm:text-lg font-black text-white uppercase tracking-tight truncate max-w-full">{name}</div>
                      <span className="text-[8px] bg-calibrex-teal/20 text-calibrex-teal px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Operator {i + 1}</span>
                      {(p?.guest || u.guest) && <span className="text-[8px] bg-calibrex-gold/15 text-calibrex-gold px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Guest</span>}
                      {u.revoked && <span className="text-[8px] bg-calibrex-critical/20 text-calibrex-critical px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Revoked</span>}
                    </div>
                    {p?.email && <div className="text-xs text-calibrex-teal font-mono tracking-tighter opacity-80 mb-2 truncate">{p.email}</div>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {u.org && (
                        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5">
                          <Database size={10} className="text-white/40" />
                          <span className="text-[9px] text-white/60 uppercase font-black tracking-widest">Sector: {u.org}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5">
                        <Activity size={10} className="text-calibrex-gold/70" />
                        <span className="text-[9px] text-calibrex-gold/80 uppercase font-black tracking-widest">First seen {ago(u.firstSeen)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5">
                        <Eye size={10} className="text-white/40" />
                        <span className="text-[9px] text-white/60 uppercase font-black tracking-widest tabular-nums">{u.visits || 0} sessions · last {u.live ? 'now' : ago(u.lastSeen)}</span>
                      </div>
                      {u.live && (
                        <div className="flex items-center gap-1.5 bg-calibrex-low/10 px-2 py-1 rounded border border-calibrex-low/20">
                          <Radio size={10} className="text-calibrex-low" />
                          <span className="text-[9px] text-calibrex-low uppercase font-black tracking-widest">Live · {VIEW_LABELS[u.lastView || ''] || 'Studio'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-4 sm:pt-0 border-t sm:border-0 border-white/5">
                  {u.revoked ? (
                    <button onClick={() => toggle(u)} disabled={busy === u.id} className="w-full sm:w-auto px-4 sm:px-6 py-2.5 bg-calibrex-teal/10 hover:bg-calibrex-teal border border-calibrex-teal/30 text-calibrex-teal hover:text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                      {busy === u.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Restore Clearance
                    </button>
                  ) : confirming === u.id ? (
                    <>
                      <button onClick={() => setConfirming(null)} className="flex-1 sm:flex-none px-4 py-2.5 bg-white/5 border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10">Cancel</button>
                      <button onClick={() => toggle(u)} disabled={busy === u.id} className="flex-1 sm:flex-none px-4 py-2.5 bg-calibrex-critical text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                        {busy === u.id ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />} Confirm Revoke
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirming(u.id)} className="w-full sm:w-auto px-4 sm:px-6 py-2.5 bg-calibrex-critical/10 hover:bg-calibrex-critical border border-calibrex-critical/30 text-calibrex-critical hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                      <ShieldAlert size={14} /> Revoke Clearance
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-12 text-center space-y-3 opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[9px] font-mono text-white/60 uppercase tracking-[0.5em] flex items-center justify-center gap-2">
          <ShieldCheck size={12} className="text-calibrex-gold" /> Identity Integrity Hub v6.4 • CALIBREX_SECURE_ENCLAVE
        </p>
        <p className="text-[8px] text-white/40 uppercase tracking-widest leading-loose">
          Identities verified by claude.ai sign-in • Proprietary oversight interface • Ilmaz Syed 2025
        </p>
      </div>
    </div>
  );
};

export default UserManagement;
