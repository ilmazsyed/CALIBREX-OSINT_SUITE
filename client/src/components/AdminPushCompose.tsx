import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, Send, Loader2, Users, Globe, Search, CheckCircle2, AlertTriangle, Inbox } from 'lucide-react';
import { admin, api, ApiError, User, PushAuditEntry } from '../lib/api';
import { timeAgo } from '../lib/live';

type Audience = 'all' | 'selected';

/**
 * Admin-only composer to send a custom push notification to every registered
 * device, or to a selected set of accounts. Also drops into each recipient's
 * in-app inbox. Hidden only for genuine non-admins (403).
 */
const AdminPushCompose: React.FC = () => {
  const [hidden, setHidden] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [alsoInbox, setAlsoInbox] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');

  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<PushAuditEntry[]>([]);

  useEffect(() => {
    admin.users().then(r => { setUsers(r.users); setHidden(false); }).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 403) setHidden(true);
    });
    api<{ entries: PushAuditEntry[] }>('/admin/push/audit').then(r => setAudit(r.entries)).catch(() => {});
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = users.filter(u => u.role !== 'admin' || true); // include everyone
    return s ? list.filter(u => (u.name || '').toLowerCase().includes(s) || u.email.toLowerCase().includes(s)) : list;
  }, [users, q]);

  const toggle = (id: string) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const canSend = title.trim().length > 0 && (audience === 'all' || picked.size > 0);

  const doSend = async () => {
    setSending(true); setError(null); setResult(null); setConfirming(false);
    try {
      const r = await admin.pushBroadcast({
        title: title.trim(), body: body.trim(), url: url.trim() || undefined,
        audience, userIds: audience === 'selected' ? [...picked] : undefined, alsoInbox,
      });
      setResult(`Sent to ${r.devices} device${r.devices === 1 ? '' : 's'} across ${r.recipients} account${r.recipients === 1 ? '' : 's'} (of ${r.targeted} targeted)${alsoInbox ? ' · added to their in-app inbox' : ''}.`);
      setTitle(''); setBody(''); setUrl(''); setPicked(new Set());
      api<{ entries: PushAuditEntry[] }>('/admin/push/audit').then(x => setAudit(x.entries)).catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Send failed.');
    } finally { setSending(false); }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    if (audience === 'all') setConfirming(true); else doSend();
  };

  if (hidden) return null;

  const inputCls = 'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-calibrex-gold placeholder:text-white/30';

  return (
    <div className="mt-5 pt-5 border-t border-white/10">
      <h3 className="text-sm font-bold text-calibrex-text flex items-center gap-2 mb-3"><Megaphone size={15} className="text-calibrex-gold" /> Send push notification <span className="text-[10px] font-mono text-calibrex-muted">(admin)</span></h3>

      <form onSubmit={onSubmit} className="space-y-3">
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Title (e.g. Service update)" className={inputCls} />
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={400} rows={3} placeholder="Message body (optional)" className={inputCls + ' resize-none'} />
        <input value={url} onChange={e => setUrl(e.target.value)} maxLength={300} placeholder="Link to open on tap (optional — defaults to the app)" className={inputCls} />

        {/* Audience */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setAudience('all')} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-widest ${audience === 'all' ? 'bg-calibrex-gold/15 border-calibrex-gold/50 text-calibrex-gold' : 'border-white/10 text-white/60 hover:border-white/25'}`}><Globe size={14} /> All devices</button>
          <button type="button" onClick={() => setAudience('selected')} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-widest ${audience === 'selected' ? 'bg-calibrex-teal/15 border-calibrex-teal/50 text-calibrex-teal' : 'border-white/10 text-white/60 hover:border-white/25'}`}><Users size={14} /> Selected {picked.size > 0 ? `(${picked.size})` : ''}</button>
        </div>

        {audience === 'selected' && (
          <div className="bg-black/30 border border-white/10 rounded-xl p-3 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search accounts…" className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-[13px] text-white focus:outline-none focus:border-calibrex-teal" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/40 uppercase tracking-widest px-1">
              <button type="button" onClick={() => setPicked(new Set(shown.map(u => u.id)))} className="hover:text-calibrex-teal">Select all shown</button>
              <button type="button" onClick={() => setPicked(new Set())} className="hover:text-calibrex-teal">Clear</button>
            </div>
            <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
              {shown.map(u => (
                <label key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" checked={picked.has(u.id)} onChange={() => toggle(u.id)} className="accent-calibrex-teal" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] text-white truncate">{u.name || 'Unnamed'} {u.role === 'admin' && <span className="text-[8px] text-calibrex-gold">· admin</span>}</span>
                    <span className="block text-[10px] font-mono text-white/40 truncate">{u.email} · {u.plan}</span>
                  </span>
                </label>
              ))}
              {shown.length === 0 && <p className="text-[11px] text-white/40 py-3 text-center">No accounts match.</p>}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-[12px] text-white/70 cursor-pointer">
          <input type="checkbox" checked={alsoInbox} onChange={e => setAlsoInbox(e.target.checked)} className="accent-calibrex-teal" />
          <Inbox size={13} className="text-white/40" /> Also add to the in-app notification inbox (seen even without a subscribed device)
        </label>

        {error && <p className="text-[12px] text-calibrex-critical flex items-center gap-1.5"><AlertTriangle size={13} /> {error}</p>}
        {result && <p className="text-[12px] text-calibrex-low flex items-center gap-1.5"><CheckCircle2 size={13} /> {result}</p>}

        {confirming ? (
          <div className="flex items-center gap-2 bg-calibrex-gold/10 border border-calibrex-gold/30 rounded-xl p-3">
            <AlertTriangle size={15} className="text-calibrex-gold shrink-0" />
            <span className="text-[12px] text-white/80 flex-1">Send this to <b className="text-calibrex-gold">every registered device</b>?</span>
            <button type="button" onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded-lg border border-white/15 text-white/70 text-[11px] font-black uppercase">Cancel</button>
            <button type="button" onClick={doSend} disabled={sending} className="px-3 py-1.5 rounded-lg bg-calibrex-gold text-calibrex-navy text-[11px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50">{sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Confirm send</button>
          </div>
        ) : (
          <button type="submit" disabled={!canSend || sending} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-calibrex-gold text-calibrex-navy font-black text-sm uppercase tracking-widest disabled:opacity-40 hover:bg-white active:scale-95">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send {audience === 'all' ? 'to all devices' : `to ${picked.size} account${picked.size === 1 ? '' : 's'}`}
          </button>
        )}
      </form>

      {audit.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Recent sends</div>
          <div className="space-y-1">
            {audit.slice(0, 6).map(a => (
              <div key={a.id} className="flex items-center gap-2 text-[11px] bg-black/20 border border-white/5 rounded-lg px-2.5 py-1.5">
                <span className={`shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${a.audience === 'all' ? 'bg-calibrex-gold/15 text-calibrex-gold' : 'bg-calibrex-teal/15 text-calibrex-teal'}`}>{a.audience}</span>
                <span className="min-w-0 flex-1 truncate text-white/80">{a.title}</span>
                <span className="shrink-0 font-mono text-white/40">{a.devices}dev · {a.recipients}acct</span>
                <span className="shrink-0 font-mono text-white/30 w-16 text-right">{timeAgo(a.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPushCompose;
