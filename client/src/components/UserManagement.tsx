import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Users, ShieldOff, Fingerprint, Activity, ShieldAlert, Database, ShieldCheck, Eye, Loader2, RotateCcw, RefreshCw, KeyRound, Trash2, CheckCircle2, Rss, Crown } from 'lucide-react';
import AdminWorkspace from './AdminWorkspace';
import { admin, User } from '../lib/api';
import { timeAgo } from '../lib/live';

interface Props {
  currentUserId: string;
  providerContact: string;
  onContactSaved: (c: string) => void;
  onNotify: (msg: string) => void;
}

type Filter = 'all' | 'pending' | 'active' | 'suspended';

const UserManagement: React.FC<Props> = ({ currentUserId, providerContact, onContactSaved, onNotify }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; action: 'suspend' | 'delete' } | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [contactDraft, setContactDraft] = useState(providerContact);
  const [savingContact, setSavingContact] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = await admin.users();
      setUsers(u.users);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => { setContactDraft(providerContact); }, [providerContact]);

  const act = async (u: User, fn: () => Promise<any>, msg: string) => {
    setBusy(u.id);
    try { await fn(); onNotify(msg); await load(); }
    catch (e: any) { onNotify(e?.message || 'That action failed. Try again.'); }
    finally { setBusy(null); setConfirming(null); }
  };

  const saveContact = async () => {
    setSavingContact(true);
    try { const r = await admin.setContact(contactDraft.trim()); onContactSaved(r.contact); onNotify('Provider contact saved'); }
    catch (e: any) { onNotify(e?.message || 'Could not save the contact.'); }
    finally { setSavingContact(false); }
  };

  const counts = useMemo(() => ({
    all: users.length,
    pending: users.filter(u => u.status === 'pending').length,
    active: users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
  }), [users]);
  const online = users.filter(u => u.lastSeen && Date.now() - u.lastSeen < 5 * 60000).length;
  const shown = users.filter(u => filter === 'all' || u.status === filter);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto pb-32">
      <div className="bg-calibrex-surface backdrop-blur-xl border border-calibrex-gold/20 rounded-[2rem] p-5 sm:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-calibrex-gold/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6 border-b border-white/5 pb-8 relative z-10">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-calibrex-gold/10 rounded-2xl border border-calibrex-gold/30"><Users className="text-calibrex-gold" size={32} /></div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-[0.2em] mb-1">Master Identity Registry</h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] text-calibrex-gold font-black uppercase tracking-widest bg-calibrex-gold/10 px-2 py-0.5 rounded border border-calibrex-gold/20">Clearance: Level V</span>
                <span className="text-[10px] text-white/50 font-mono uppercase">Administrator console</span>
              </div>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-calibrex-teal hover:text-calibrex-gold hover:border-calibrex-gold/30 text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 relative z-10">
          {[
            ['Awaiting activation', counts.pending, 'text-calibrex-gold'],
            ['Active accounts', counts.active, 'text-calibrex-teal'],
            ['Suspended', counts.suspended, 'text-calibrex-critical'],
            ['Online now', online, 'text-calibrex-low'],
          ].map(([label, n, cls]) => (
            <div key={label as string} className="bg-black/40 border border-white/5 p-4 sm:p-5 rounded-2xl">
              <div className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">{label}</div>
              <div className={`text-xl font-black tabular-nums ${cls}`}>{n as number}</div>
            </div>
          ))}
        </div>

        <div className="mb-8 relative z-10 bg-black/30 border border-white/10 rounded-2xl p-4 sm:p-5">
          <label htmlFor="provider-contact" className="block text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] mb-2">Provider contact shown to pending and suspended accounts</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input id="provider-contact" type="text" value={contactDraft} onChange={e => setContactDraft(e.target.value)} placeholder="e.g. access@calibrex.com or a WhatsApp number" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-calibrex-gold placeholder:text-white/30" />
            <button onClick={saveContact} disabled={savingContact || contactDraft.trim() === providerContact} className="px-5 py-2.5 bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              {savingContact && <Loader2 size={12} className="animate-spin" />} Save
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5 relative z-10">
          {(['all', 'pending', 'active', 'suspended'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${filter === f ? 'bg-calibrex-gold text-calibrex-navy border-calibrex-gold' : 'bg-white/5 text-white/60 border-white/10 hover:border-calibrex-gold/40'}`}>
              {f} <span className="opacity-70 tabular-nums">{counts[f]}</span>
            </button>
          ))}
        </div>

        {error && <p className="text-[11px] text-calibrex-critical font-bold mb-4">{error}</p>}

        <div className="space-y-4 relative z-10">
          {!loading && shown.length === 0 && (
            <div className="py-12 text-center flex flex-col items-center gap-4 bg-black/20 rounded-3xl border border-dashed border-white/10">
              <ShieldOff className="text-white/20" size={48} />
              <p className="text-sm font-black text-white/50 uppercase tracking-[0.3em]">{filter === 'pending' ? 'Nobody awaiting activation' : 'No accounts here'}</p>
              {filter === 'all' && <p className="text-[11px] text-white/50 max-w-sm">Share this site's address. New operators request access from the sign-in page and appear here for activation.</p>}
            </div>
          )}
          {shown.map(u => {
            const me = u.id === currentUserId;
            const isOnline = u.lastSeen && Date.now() - u.lastSeen < 5 * 60000;
            return (
              <div key={u.id} className={`bg-black/40 p-4 sm:p-6 rounded-2xl border flex flex-col gap-4 ${u.status === 'suspended' ? 'border-calibrex-critical/30' : u.status === 'pending' ? 'border-calibrex-gold/30' : 'border-white/5'}`}>
                <div className="flex gap-4 items-center min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 bg-calibrex-teal/10 rounded-2xl border border-calibrex-teal/20 flex items-center justify-center text-calibrex-teal">{u.role === 'admin' ? <Crown size={20} className="text-calibrex-gold" /> : <Fingerprint size={20} />}</div>
                    {isOnline && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-calibrex-low border-2 border-calibrex-dark" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-base font-black text-white uppercase tracking-tight truncate max-w-full">{u.name || 'Unnamed'}</span>
                      {u.role === 'admin' && <span className="text-[8px] bg-calibrex-gold/15 text-calibrex-gold px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Admin</span>}
                      <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${u.status === 'active' ? 'bg-calibrex-low/15 text-calibrex-low' : u.status === 'pending' ? 'bg-calibrex-gold/15 text-calibrex-gold' : 'bg-calibrex-critical/20 text-calibrex-critical'}`}>{u.status}</span>
                      {me && <span className="text-[8px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">You</span>}
                    </div>
                    <div className="text-xs text-calibrex-teal font-mono truncate select-text">{u.email}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {u.org && <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5 text-[9px] text-white/60 uppercase font-black tracking-widest"><Database size={10} /> {u.org}</span>}
                      <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5 text-[9px] text-calibrex-gold/80 uppercase font-black tracking-widest"><Activity size={10} /> Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5 text-[9px] text-white/60 uppercase font-black tracking-widest tabular-nums"><Eye size={10} /> {u.visits} sign-ins · last seen {isOnline ? 'now' : timeAgo(u.lastSeen)}</span>
                    </div>
                  </div>
                </div>

                {!me && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5">
                    {u.status === 'pending' && (
                      <button onClick={() => act(u, () => admin.update(u.id, { status: 'active' }), `Activated: ${u.name}`)} disabled={busy === u.id} className="px-4 py-2 bg-calibrex-low/15 hover:bg-calibrex-low/25 border border-calibrex-low/40 text-calibrex-low text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 disabled:opacity-50">
                        {busy === u.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Activate
                      </button>
                    )}
                    {u.status === 'suspended' && (
                      <button onClick={() => act(u, () => admin.update(u.id, { status: 'active' }), `Account reactivated: ${u.name}`)} disabled={busy === u.id} className="px-4 py-2 bg-calibrex-teal/10 hover:bg-calibrex-teal border border-calibrex-teal/30 text-calibrex-teal hover:text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 disabled:opacity-50">
                        {busy === u.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Reactivate Account
                      </button>
                    )}
                    {u.status === 'active' && (confirming?.id === u.id && confirming.action === 'suspend' ? (
                      <>
                        <button onClick={() => setConfirming(null)} className="px-4 py-2 bg-white/5 border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest rounded-xl">Cancel</button>
                        <button onClick={() => act(u, () => admin.update(u.id, { status: 'suspended' }), `Account suspended: ${u.name}`)} disabled={busy === u.id} className="px-4 py-2 bg-calibrex-critical text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 disabled:opacity-50">
                          {busy === u.id ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />} Confirm Suspend
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirming({ id: u.id, action: 'suspend' })} className="px-4 py-2 bg-calibrex-critical/10 hover:bg-calibrex-critical border border-calibrex-critical/30 text-calibrex-critical hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2">
                        <ShieldAlert size={14} /> Suspend Account
                      </button>
                    ))}
                    <button onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setNewPassword(''); }} className="px-4 py-2 bg-white/5 border border-white/10 text-white/70 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2"><KeyRound size={14} /> Reset password</button>
                    <button onClick={() => act(u, () => admin.update(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }), u.role === 'admin' ? `Admin removed: ${u.name}` : `Now an admin: ${u.name}`)} disabled={busy === u.id} className="px-4 py-2 bg-white/5 border border-white/10 text-white/70 hover:text-calibrex-gold text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2"><Crown size={14} /> {u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>
                    {confirming?.id === u.id && confirming.action === 'delete' ? (
                      <button onClick={() => act(u, () => admin.remove(u.id), `Deleted: ${u.name}`)} disabled={busy === u.id} className="px-4 py-2 bg-calibrex-critical text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2"><Trash2 size={14} /> Confirm delete</button>
                    ) : (
                      <button onClick={() => setConfirming({ id: u.id, action: 'delete' })} className="px-4 py-2 text-white/40 hover:text-calibrex-critical text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                    )}
                  </div>
                )}
                {resetFor === u.id && (
                  <form onSubmit={e => { e.preventDefault(); act(u, () => admin.setPassword(u.id, newPassword), `Password reset for ${u.name}. Send it to them securely.`).then(() => setResetFor(null)); }} className="flex flex-col sm:flex-row gap-2">
                    <input id={`pw-${u.id}`} type="text" minLength={8} required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (8+ characters)" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-calibrex-gold" />
                    <button type="submit" className="px-5 py-2.5 bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-xl">Set password</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>

      </div>
      <AdminWorkspace onNotify={onNotify} />
      <div className="mt-12 text-center opacity-50">
        <p className="text-[9px] font-mono text-white/60 uppercase tracking-[0.5em] flex items-center justify-center gap-2"><ShieldCheck size={12} className="text-calibrex-gold" /> Identity Integrity Hub v6.4</p>
      </div>
    </div>
  );
};

export default UserManagement;
