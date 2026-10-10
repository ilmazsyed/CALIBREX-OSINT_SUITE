import React, { useEffect, useState } from 'react';
import { ShieldCheck, Search, Loader2, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { getSanctionsStatus, screenSanctions, SanctionStatus, SanctionMatch } from '../lib/sanctions';
import { timeAgo } from '../lib/live';

const scoreCls = (s: number) => s >= 85 ? 'text-calibrex-critical border-calibrex-critical/50 bg-calibrex-critical/10'
  : s >= 65 ? 'text-calibrex-high border-calibrex-high/50 bg-calibrex-high/10'
  : 'text-calibrex-gold border-calibrex-gold/40 bg-calibrex-gold/10';

const SanctionsScreen: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [status, setStatus] = useState<SanctionStatus | null>(null);
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<SanctionMatch[] | null>(null);
  const [searched, setSearched] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { getSanctionsStatus().then(setStatus).catch(() => {}); }, []);

  const run = (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true); setErr(null);
    screenSanctions(query).then(r => { setMatches(r.matches); setSearched(query); }).catch(() => setErr('Screening failed. Try again.')).finally(() => setLoading(false));
  };

  const loaded = status && status.total > 0;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><ShieldCheck size={22} className="text-calibrex-teal" /> Sanctions Screening</h1>
        <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Screen a person, company or vessel against public US OFAC consolidated sanctions lists. A match is a <b className="text-calibrex-text">lead to verify</b>, never a determination — always confirm against the official listing.</p>
      </div>

      <div className="text-[11px] font-mono text-white/40 flex flex-wrap gap-x-4 gap-y-1">
        {status ? (loaded
          ? <><span><CheckCircle2 size={11} className="inline text-calibrex-low mr-1" />{status.total.toLocaleString()} entries loaded</span>{Object.entries(status.counts).map(([k, v]) => <span key={k}>{k}: {v.toLocaleString()}</span>)}<span>updated {timeAgo(status.updatedAt)}</span></>
          : <span className="text-calibrex-high"><AlertTriangle size={11} className="inline mr-1" />Lists not loaded yet — the server fetches them on start; try again shortly.</span>)
          : <span>Checking list status…</span>}
      </div>

      <form onSubmit={run} className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, company or vessel…" aria-label="Screen a name"
          className="flex-1 bg-calibrex-surface-light border border-calibrex-teal/30 rounded-lg px-3 py-2.5 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal" />
        <button type="submit" disabled={loading || !q.trim()} className="px-4 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy font-black text-sm flex items-center gap-1.5 disabled:opacity-40">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Screen
        </button>
      </form>

      {err && <p className="text-sm text-calibrex-critical">{err}</p>}

      {matches !== null && (
        matches.length === 0 ? (
          <div className="rounded-xl border border-calibrex-low/30 bg-calibrex-low/5 p-4 flex items-start gap-2">
            <CheckCircle2 size={18} className="text-calibrex-low shrink-0 mt-0.5" />
            <div><div className="text-sm font-bold text-calibrex-low">No sanctions match for “{searched}”</div><div className="text-[11px] text-calibrex-muted mt-1">No entry on the loaded OFAC lists scored above the match threshold. This is not legal clearance — spelling variants and other lists (UN, EU, India) may still apply.</div></div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] font-black text-calibrex-muted uppercase tracking-widest">{matches.length} possible match{matches.length === 1 ? '' : 'es'} for “{searched}”</div>
            {matches.map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-calibrex-surface border border-white/10 rounded-lg">
                <span className={`shrink-0 w-12 text-center text-[13px] font-black px-1.5 py-1 rounded-lg border ${scoreCls(m.score)}`}>{m.score}</span>
                <button onClick={() => onInvestigate(m.name)} className="min-w-0 flex-1 text-left" title="Investigate this entity">
                  <span className="block text-[13px] font-bold text-white truncate">{m.name}</span>
                  <span className="block text-[10px] font-mono text-white/40">{m.type} · {m.program || '—'} · {m.list}</span>
                </button>
                <a href={`https://sanctionssearch.ofac.treas.gov/`} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 text-calibrex-muted hover:text-calibrex-teal" title="Verify on OFAC"><ExternalLink size={14} /></a>
              </div>
            ))}
            <p className="text-[10px] text-white/30 mt-1">Match score is name similarity only (0–100). Verify every hit against the official OFAC record before acting.</p>
          </div>
        )
      )}
    </div>
  );
};

export default SanctionsScreen;
