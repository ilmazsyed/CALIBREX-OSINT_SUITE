import React, { useState } from 'react';
import { Globe, Search, Loader2, AlertTriangle, Copy, Check, Bitcoin, Mail, KeyRound, Link2, Send, Signal, SignalZero, ArrowUpRight } from 'lucide-react';
import { searchDark, DarkHit, DarkStats, DarkIndicators } from '../lib/sensitive';
import { ApiError, copyText } from '../lib/api';
import GateLock from './GateLock';

const CAT_CLS: Record<string, string> = {
  market: 'text-calibrex-critical border-calibrex-critical/40',
  leak: 'text-calibrex-critical border-calibrex-critical/40',
  crypto: 'text-calibrex-gold border-calibrex-gold/40',
  forum: 'text-calibrex-teal border-calibrex-teal/40',
  wiki: 'text-calibrex-teal border-calibrex-teal/40',
  email: 'text-calibrex-high border-calibrex-high/40',
  hosting: 'text-calibrex-high border-calibrex-high/40',
  search: 'text-white/60 border-white/20',
  privacy: 'text-calibrex-teal border-calibrex-teal/40',
  news: 'text-calibrex-low border-calibrex-low/40',
  social: 'text-calibrex-teal border-calibrex-teal/40',
  other: 'text-white/50 border-white/15',
};

// Which indicator kinds map to which pivot, with an icon + label.
const IND_META: { key: keyof DarkIndicators; label: string; Icon: React.ElementType }[] = [
  { key: 'btc', label: 'BTC', Icon: Bitcoin },
  { key: 'xmr', label: 'XMR', Icon: Bitcoin },
  { key: 'eth', label: 'ETH', Icon: Bitcoin },
  { key: 'emails', label: 'Email', Icon: Mail },
  { key: 'pgp', label: 'PGP', Icon: KeyRound },
  { key: 'clearnet', label: 'Domain', Icon: Link2 },
  { key: 'telegram', label: 'Handle', Icon: Send },
];

const Inner: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<DarkHit[] | null>(null);
  const [stats, setStats] = useState<DarkStats | null>(null);
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [searched, setSearched] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = q.trim(); if (!query) return;
    setLoading(true); setErr(null); setHits(null); setStats(null);
    searchDark(query)
      .then(r => { setHits(r.results); setStats(r.stats); setSource(r.source); setNote(r.note || ''); setSearched(query); })
      .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Search failed — the index may be unreachable.'))
      .finally(() => setLoading(false));
  };
  const copy = (s: string) => copyText(s).then(ok => { if (ok) { setCopied(s); setTimeout(() => setCopied(null), 1500); } });

  const stat = (label: string, value: number, cls = 'text-white') => (
    <div className="rounded-lg border border-white/10 bg-calibrex-surface px-3 py-2">
      <div className="text-[9px] font-black text-white/40 uppercase tracking-widest">{label}</div>
      <div className={`text-lg font-black ${cls}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-calibrex-high/30 bg-calibrex-high/5 p-3 text-[11px] text-calibrex-muted flex items-start gap-2">
        <AlertTriangle size={14} className="text-calibrex-high shrink-0 mt-0.5" />
        <span>This returns public clearnet onion-index engines' <b className="text-calibrex-text">search index</b> only — titles, .onion addresses and any indicators found in the index text. Calibrex never opens onion sites. Visiting any result requires a Tor browser, proper OPSEC and lawful authorization, which are your responsibility. Every query is logged.</span>
      </div>

      <form onSubmit={run} className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="search the .onion index — a name, vendor, email, wallet, breach…" aria-label="Dark web query"
          className="flex-1 bg-calibrex-surface-light border border-calibrex-teal/30 rounded-lg px-3 py-2.5 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal" />
        <button type="submit" disabled={loading || !q.trim()} className="px-4 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy font-black text-sm flex items-center gap-1.5 disabled:opacity-40">{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Search</button>
      </form>

      {err && <p className="text-sm text-calibrex-critical flex items-center gap-1.5"><AlertTriangle size={14} /> {err}</p>}

      {hits && (hits.length === 0 ? (
        <p className="text-[11px] text-white/40 py-4">No indexed results for “{searched}”. These engines index only a slice of the network — try a broader term, a known vendor/alias, or an email / wallet string.</p>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {stat('Results', stats.total)}
              {stat('Live (v3)', stats.live, 'text-calibrex-low')}
              {stat('Legacy (v2)', stats.dead, 'text-white/40')}
              {stat('With indicators', stats.withIndicators, 'text-calibrex-gold')}
            </div>
          )}
          {note && <div className="rounded-lg border border-calibrex-teal/25 bg-calibrex-teal/5 p-2.5 text-[11px] text-calibrex-muted">{note}</div>}
          <div className="text-[10px] font-black text-calibrex-muted uppercase tracking-widest">{hits.length} indexed results for “{searched}”{source && source !== 'none' ? ` · via ${source}` : ''}</div>

          {hits.map((h, i) => (
            <div key={i} className="p-3 bg-calibrex-surface border border-white/10 rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-white">{h.title}</div>
                  {h.description && <div className="text-[11px] text-calibrex-muted mt-0.5 leading-snug">{h.description}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {h.curated && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full border text-calibrex-teal border-calibrex-teal/40 flex items-center gap-1"><Check size={9} /> Verified</span>}
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${CAT_CLS[h.category] || CAT_CLS.other}`}>{h.category}</span>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${h.live ? 'text-calibrex-low border-calibrex-low/40' : 'text-white/40 border-white/15'}`}>
                    {h.live ? <Signal size={9} /> : <SignalZero size={9} />}{h.version}{h.live ? '' : ' · dead'}
                  </span>
                  {h.source && <span className="text-[8px] font-mono text-white/30 uppercase tracking-wider">{h.source}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 text-[11px] font-mono text-calibrex-gold/80 bg-black/40 border border-white/10 rounded px-2 py-1 truncate select-all">{h.onion}</code>
                <button onClick={() => copy(h.onion)} className="shrink-0 p-1.5 rounded border border-white/15 text-white" title="Copy onion address">{copied === h.onion ? <Check size={14} /> : <Copy size={14} />}</button>
                <button onClick={() => onInvestigate(h.title || h.host)} className="shrink-0 p-1.5 rounded border border-calibrex-teal/40 text-calibrex-teal hover:bg-calibrex-teal/10" title="Investigate in Research"><ArrowUpRight size={14} /></button>
              </div>

              {/* Extracted indicators — each a pivot back into Calibrex */}
              {h.indicators?.count > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {IND_META.map(({ key, label, Icon }) => {
                    const vals = h.indicators[key] as string[];
                    if (!Array.isArray(vals) || !vals.length) return null;
                    return vals.map((v, k) => (
                      <button key={`${key}-${k}`} onClick={() => onInvestigate(v)} title={`Investigate ${label}: ${v}`}
                        className="flex items-center gap-1 max-w-[16rem] text-[10px] font-mono px-2 py-1 rounded border border-white/15 bg-black/30 text-white/80 hover:border-calibrex-teal/50 hover:text-calibrex-teal">
                        <Icon size={11} className="shrink-0" /> <span className="truncate">{v}</span>
                      </button>
                    ));
                  })}
                </div>
              )}
            </div>
          ))}
          <p className="text-[10px] text-white/30">Addresses are shown as text, not links — Calibrex does not route to Tor. Indicator chips pivot into Research; v2 (16-char) onions have been offline across Tor since October 2021.</p>
        </div>
      ))}
    </div>
  );
};

const DarkWebSearch: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => (
  <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
    <div>
      <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Globe size={22} className="text-calibrex-high" /> Dark Web Search <span className="text-[10px] font-mono text-white/35 tracking-widest">GATED</span></h1>
      <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Search public clearnet .onion index engines. Index only — no onion content is fetched. Each hit is enriched with liveness, a category, and any wallets, emails, PGP keys or clearnet domains found in the index, ready to pivot into Research.</p>
    </div>
    <GateLock><Inner onInvestigate={onInvestigate} /></GateLock>
  </div>
);

export default DarkWebSearch;
