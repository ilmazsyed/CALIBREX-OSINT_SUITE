import React, { useState } from 'react';
import { Users, Search, Loader2, AlertTriangle, ExternalLink, CheckCircle2, HelpCircle, XCircle, MessageSquare } from 'lucide-react';
import { checkUsername, searchReddit, UsernameHit, RedditPost } from '../lib/sensitive';
import { timeAgo } from '../lib/live';
import { ApiError } from '../lib/api';
import GateLock from './GateLock';

const EXISTS: Record<string, { cls: string; Icon: typeof CheckCircle2; label: string }> = {
  yes: { cls: 'text-calibrex-low border-calibrex-low/40', Icon: CheckCircle2, label: 'found' },
  no: { cls: 'text-white/30 border-white/10', Icon: XCircle, label: 'not found' },
  unknown: { cls: 'text-calibrex-gold border-calibrex-gold/30', Icon: HelpCircle, label: 'unknown' },
};

const Inner: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [mode, setMode] = useState<'username' | 'reddit'>('username');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<UsernameHit[] | null>(null);
  const [posts, setPosts] = useState<RedditPost[] | null>(null);
  const [searched, setSearched] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = q.trim(); if (!query) return;
    setLoading(true); setErr(null); setHits(null); setPosts(null);
    const p = mode === 'username' ? checkUsername(query).then(r => { if (!r.valid) throw new ApiError(400, 'Usernames use letters, numbers, dot, dash or underscore.'); setHits(r.results); }) : searchReddit(query).then(r => setPosts(r.posts));
    p.then(() => setSearched(query)).catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Lookup failed.')).finally(() => setLoading(false));
  };

  const tab = (id: 'username' | 'reddit', label: string) => (
    <button onClick={() => { setMode(id); setHits(null); setPosts(null); setErr(null); }} className={`px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest border ${mode === id ? 'bg-calibrex-teal/15 border-calibrex-teal/50 text-calibrex-teal' : 'border-white/10 text-calibrex-muted hover:text-white'}`}>{label}</button>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">{tab('username', 'Username presence')}{tab('reddit', 'Reddit search')}</div>

      <form onSubmit={run} className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={mode === 'username' ? 'username (no @)' : 'search term'} aria-label="Query"
          className="flex-1 bg-calibrex-surface-light border border-calibrex-teal/30 rounded-lg px-3 py-2.5 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal" />
        <button type="submit" disabled={loading || !q.trim()} className="px-4 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy font-black text-sm flex items-center gap-1.5 disabled:opacity-40">{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Run</button>
      </form>
      <p className="text-[10px] text-white/30">Logged with your identity. Public profiles and Reddit's public search only. Presence is inferred from HTTP status and can be wrong — treat "found/unknown" as a lead, not proof.</p>

      {err && <p className="text-sm text-calibrex-critical flex items-center gap-1.5"><AlertTriangle size={14} /> {err}</p>}

      {hits && (
        <div>
          <div className="text-[10px] font-black text-calibrex-muted uppercase tracking-widest mb-2">“{searched}” · {hits.filter(h => h.exists === 'yes').length} likely found</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {hits.map((h, i) => { const e = EXISTS[h.exists]; return (
              <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2.5 rounded-lg border bg-calibrex-surface hover:bg-white/5 ${e.cls}`}>
                <e.Icon size={15} className="shrink-0" />
                <span className="flex-1 min-w-0"><span className="text-[13px] font-bold text-white">{h.site}</span><span className="block text-[10px] text-white/40 truncate">{e.label}</span></span>
                <ExternalLink size={13} className="text-white/30 shrink-0" />
              </a>
            ); })}
          </div>
        </div>
      )}

      {posts && (posts.length === 0 ? <p className="text-[11px] text-white/40 py-4">No Reddit posts for “{searched}”.</p> : (
        <div className="space-y-2">
          <div className="text-[10px] font-black text-calibrex-muted uppercase tracking-widest">{posts.length} Reddit posts for “{searched}”</div>
          {posts.map((p, i) => (
            <div key={i} className="p-3 bg-calibrex-surface border border-white/5 rounded-lg">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-white hover:text-calibrex-teal flex items-start gap-1.5"><MessageSquare size={13} className="shrink-0 mt-0.5 text-calibrex-muted" /> {p.title}</a>
              <div className="text-[10px] font-mono text-white/35 mt-1">{p.subreddit} · {p.author} · {p.score}▲ {p.comments}💬 · {timeAgo(p.created)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const SocialFootprint: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => (
  <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
    <div>
      <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Users size={22} className="text-calibrex-teal" /> Social Footprint <span className="text-[10px] font-mono text-white/35 tracking-widest">GATED</span></h1>
      <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Find where a username appears across public platforms, and search public Reddit. A gated, logged tool — run it only on subjects you are authorized to investigate.</p>
    </div>
    <GateLock><Inner onInvestigate={onInvestigate} /></GateLock>
  </div>
);

export default SocialFootprint;
