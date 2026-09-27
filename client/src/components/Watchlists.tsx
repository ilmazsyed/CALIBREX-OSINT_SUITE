import React, { useEffect, useState } from 'react';
import { Eye, Plus, Trash2, Loader2, Mail, ExternalLink, CheckCheck, Search, BellOff } from 'lucide-react';
import { watch, Watchlist, WatchTerm, Notification, Severity } from '../lib/features';
import { timeAgo, openReader } from '../lib/live';

interface Props {
  notifications: { items: Notification[]; unread: number; markRead: (ids?: string[]) => Promise<void>; clear: () => Promise<void>; reload: () => void };
  onInvestigate: (q: string) => void;
  onNotify: (m: string) => void;
}

const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const sevClass = (s: string) => s === 'CRITICAL' ? 'text-calibrex-critical border-calibrex-critical/40' : s === 'HIGH' ? 'text-calibrex-high border-calibrex-high/40' : s === 'MEDIUM' ? 'text-calibrex-medium border-calibrex-medium/40' : 'text-calibrex-low border-calibrex-low/40';

const Watchlists: React.FC<Props> = ({ notifications, onInvestigate, onNotify }) => {
  const [wl, setWl] = useState<Watchlist | null>(null);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [maxTerms, setMaxTerms] = useState(25);
  const [term, setTerm] = useState('');
  const [minSeverity, setMinSeverity] = useState<Severity>('LOW');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    watch.get().then(r => { setWl(r.watchlist); setEmailAvailable(r.emailAvailable); setMaxTerms(r.maxTerms); setEmail(r.email); }).catch(e => setError(e.message));
  }, []);

  const save = async (next: Watchlist, message?: string) => {
    setSaving(true); setError(null);
    try {
      const r = await watch.save(next);
      setWl(r.watchlist);
      notifications.reload();
      if (message) onNotify(r.added ? `${message} · ${r.added} current match${r.added === 1 ? '' : 'es'} found` : message);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const t = term.trim();
    if (!wl || t.length < 2) return;
    if (wl.terms.some(x => x.term.toLowerCase() === t.toLowerCase())) { setError('That term is already on your watchlist.'); return; }
    const entry: WatchTerm = { id: Date.now().toString(36), term: t, createdAt: Date.now(), minSeverity };
    setTerm('');
    save({ ...wl, terms: [...wl.terms, entry] }, `Watching “${t}”`);
  };

  const unread = notifications.items.filter(n => !n.read);
  const shown = notifications.items.filter(n => filter === 'all' || (filter === 'unread' ? !n.read : n.term === filter));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
      <section className="lg:col-span-2 bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5 h-fit">
        <h2 className="text-lg font-bold text-calibrex-gold flex items-center gap-2 mb-1"><Eye size={18} /> Watchlist</h2>
        <p className="text-sm text-calibrex-muted mb-4">Add names, places, groups, vessels or companies. Calibrex checks every new report as the feeds refresh (every 5 minutes) and tells you when one matches.</p>

        {!wl ? <div className="text-sm text-calibrex-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div> : (
          <>
            <form onSubmit={add} className="space-y-2 mb-4">
              <input id="watch-term" value={term} onChange={e => setTerm(e.target.value)} maxLength={80} placeholder='e.g. Houthi, "Port Sudan", ransomware hospital' className="w-full bg-black/30 border border-white/15 rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
              <div className="flex gap-2">
                <select aria-label="Minimum severity" value={minSeverity} onChange={e => setMinSeverity(e.target.value as Severity)} className="flex-1 bg-black/30 border border-white/15 rounded px-2 py-2 text-sm text-white">
                  {SEVERITIES.map(s => <option key={s} value={s}>{s === 'LOW' ? 'Any severity' : `${s[0]}${s.slice(1).toLowerCase()} and above`}</option>)}
                </select>
                <button id="watch-add" type="submit" disabled={saving || term.trim().length < 2 || wl.terms.length >= maxTerms} className="px-4 py-2 bg-calibrex-teal text-calibrex-navy rounded font-black text-sm flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Watch
                </button>
              </div>
              <p className="text-xs text-calibrex-muted">Every word must appear in the headline or summary. Put a phrase in quotes to match it exactly. {wl.terms.length}/{maxTerms} used.</p>
            </form>

            <ul className="space-y-2 mb-5">
              {wl.terms.length === 0 && <li className="text-sm text-calibrex-muted">No terms yet.</li>}
              {wl.terms.map(t => {
                const count = notifications.items.filter(n => n.term === t.term).length;
                return (
                  <li key={t.id} className="flex items-center gap-2 p-2.5 rounded bg-black/25 border border-white/5">
                    <button onClick={() => setFilter(filter === t.term ? 'all' : t.term)} className={`flex-1 min-w-0 text-left ${filter === t.term ? 'text-calibrex-teal' : 'text-white'}`} title="Show matches for this term">
                      <div className="text-sm font-bold truncate">{t.term}</div>
                      <div className="text-xs text-calibrex-muted">{count} match{count === 1 ? '' : 'es'} · {t.minSeverity === 'LOW' ? 'any severity' : `${t.minSeverity.toLowerCase()}+`}</div>
                    </button>
                    <button onClick={() => onInvestigate(t.term.replace(/"/g, ''))} className="p-1.5 text-calibrex-muted hover:text-calibrex-teal" title="Search live news for this term"><Search size={15} /></button>
                    <button onClick={() => save({ ...wl, terms: wl.terms.filter(x => x.id !== t.id) }, `Stopped watching “${t.term}”`)} className="p-1.5 text-calibrex-muted hover:text-calibrex-critical" title="Remove"><Trash2 size={15} /></button>
                  </li>
                );
              })}
            </ul>

            {emailAvailable && (
            <div className="p-3 rounded bg-black/25 border border-white/5">
              <label htmlFor="watch-email" className="text-sm font-bold text-white flex items-center gap-2 mb-2"><Mail size={15} /> Email alerts</label>

                  <select id="watch-email" value={wl.email} onChange={e => save({ ...wl, email: e.target.value as Watchlist['email'] }, 'Email alerts updated')} className="w-full bg-black/30 border border-white/15 rounded px-2 py-2 text-sm text-white">
                    <option value="off">Off (in-app only)</option>
                    <option value="high">High and critical matches</option>
                    <option value="all">Every match</option>
                  </select>
                  <p className="text-xs text-calibrex-muted mt-2">Sent to {email}, at most one digest every 15 minutes.</p>

            </div>
            )}
          </>
        )}
        {error && <div role="alert" className="mt-3 text-sm text-calibrex-critical">{error}</div>}
      </section>

      <section className="lg:col-span-3 bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-bold text-white">Matches {unread.length > 0 && <span className="ml-1 text-sm text-calibrex-teal">{unread.length} new</span>}</h2>
          <div className="flex items-center gap-2">
            <select aria-label="Filter matches" value={filter} onChange={e => setFilter(e.target.value)} className="bg-black/30 border border-white/15 rounded px-2 py-1.5 text-sm text-white max-w-[180px]">
              <option value="all">All matches</option>
              <option value="unread">Unread</option>
              {wl?.terms.map(t => <option key={t.id} value={t.term}>{t.term}</option>)}
            </select>
            <button onClick={() => notifications.markRead()} disabled={!unread.length} className="px-3 py-1.5 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-40" title="Mark all as read"><CheckCheck size={14} /> Read all</button>
            <button onClick={() => window.confirm('Clear all matches?') && notifications.clear()} disabled={!notifications.items.length} className="px-3 py-1.5 rounded border border-white/15 text-sm text-white disabled:opacity-40" title="Clear the list">Clear</button>
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="py-16 text-center text-calibrex-muted flex flex-col items-center gap-3">
            <BellOff size={28} />
            <p className="text-sm max-w-sm">{wl?.terms.length ? 'No matches yet. New reports are checked every time the feeds refresh.' : 'Add a term on the left to start watching the live feeds.'}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {shown.map(n => (
              <li key={n.id + n.at} className={`p-3 rounded border ${n.read ? 'bg-black/20 border-white/5' : 'bg-calibrex-teal/5 border-calibrex-teal/30'}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
                  {!n.read && <span className="px-1.5 py-0.5 rounded bg-calibrex-teal text-calibrex-navy font-black">NEW</span>}
                  <span className={`px-1.5 py-0.5 rounded-full border font-black ${sevClass(n.severity)}`}>{n.severity}</span>
                  <span className="text-calibrex-teal font-bold">“{n.term}”</span>
                  <span className="text-calibrex-muted">{n.source} · {timeAgo(n.published)}{n.place ? ` · ${n.place}` : ''}</span>
                </div>
                <a href={n.url} target="_blank" rel="noopener noreferrer" onClick={() => !n.read && notifications.markRead([n.id])} className="text-sm font-bold text-white hover:text-calibrex-gold leading-snug inline-flex gap-1.5">
                  {n.title} <ExternalLink size={12} className="shrink-0 mt-1 opacity-60" />
                </a>
                <div className="mt-2 flex gap-3">
                  <button onClick={() => { openReader({ url: n.url, title: n.title, source: n.source, published: n.published }); if (!n.read) notifications.markRead([n.id]); }} className="text-xs font-bold text-calibrex-teal hover:underline">Read article</button>
                  <button onClick={() => onInvestigate(n.title)} className="text-xs font-bold text-calibrex-gold hover:underline">Research this</button>
                  {!n.read && <button onClick={() => notifications.markRead([n.id])} className="text-xs font-bold text-calibrex-muted hover:text-white">Mark read</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Watchlists;
