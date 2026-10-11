import React, { useState } from 'react';
import { Globe, Search, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import { searchDark, DarkHit } from '../lib/sensitive';
import { ApiError, copyText } from '../lib/api';
import GateLock from './GateLock';

const Inner: React.FC = () => {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<DarkHit[] | null>(null);
  const [searched, setSearched] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = q.trim(); if (!query) return;
    setLoading(true); setErr(null); setHits(null);
    searchDark(query).then(r => { setHits(r.results); setSearched(query); }).catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Search failed — the index may be unreachable.')).finally(() => setLoading(false));
  };
  const copy = (s: string) => copyText(s).then(ok => { if (ok) { setCopied(s); setTimeout(() => setCopied(null), 1500); } });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-calibrex-high/30 bg-calibrex-high/5 p-3 text-[11px] text-calibrex-muted flex items-start gap-2">
        <AlertTriangle size={14} className="text-calibrex-high shrink-0 mt-0.5" />
        <span>This returns the Ahmia <b className="text-calibrex-text">search index</b> only — titles and .onion addresses. Calibrex never opens onion sites. Visiting any result requires a Tor browser, proper OPSEC and lawful authorization, which are your responsibility. Every query is logged.</span>
      </div>

      <form onSubmit={run} className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="search the .onion index" aria-label="Dark web query"
          className="flex-1 bg-calibrex-surface-light border border-calibrex-teal/30 rounded-lg px-3 py-2.5 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal" />
        <button type="submit" disabled={loading || !q.trim()} className="px-4 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy font-black text-sm flex items-center gap-1.5 disabled:opacity-40">{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Search</button>
      </form>

      {err && <p className="text-sm text-calibrex-critical flex items-center gap-1.5"><AlertTriangle size={14} /> {err}</p>}

      {hits && (hits.length === 0 ? <p className="text-[11px] text-white/40 py-4">No indexed results for “{searched}”.</p> : (
        <div className="space-y-2">
          <div className="text-[10px] font-black text-calibrex-muted uppercase tracking-widest">{hits.length} indexed results for “{searched}” · via Ahmia</div>
          {hits.map((h, i) => (
            <div key={i} className="p-3 bg-calibrex-surface border border-white/10 rounded-lg">
              <div className="text-[13px] font-bold text-white">{h.title}</div>
              {h.description && <div className="text-[11px] text-calibrex-muted mt-1 leading-snug">{h.description}</div>}
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 min-w-0 text-[11px] font-mono text-calibrex-gold/80 bg-black/40 border border-white/10 rounded px-2 py-1 truncate select-all">{h.onion}</code>
                <button onClick={() => copy(h.onion)} className="shrink-0 p-1.5 rounded border border-white/15 text-white" title="Copy onion address">{copied === h.onion ? <Check size={14} /> : <Copy size={14} />}</button>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-white/30">Addresses are shown as text, not links — Calibrex does not route to Tor.</p>
        </div>
      ))}
    </div>
  );
};

const DarkWebSearch: React.FC = () => (
  <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
    <div>
      <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Globe size={22} className="text-calibrex-high" /> Dark Web Search <span className="text-[10px] font-mono text-white/35 tracking-widest">GATED</span></h1>
      <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Search the .onion index via Ahmia, a filtered clearnet search engine. Index only — no onion content is fetched.</p>
    </div>
    <GateLock><Inner /></GateLock>
  </div>
);

export default DarkWebSearch;
