import React, { useEffect, useState } from 'react';
import { ShieldAlert, Search, Loader2, Lock, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';
import { getGate, checkBreach, Gate, BreachResult } from '../lib/sensitive';
import { ApiError } from '../lib/api';

const BreachCheck: React.FC = () => {
  const [gate, setGate] = useState<Gate | null>(null);
  const [email, setEmail] = useState('');
  const [res, setRes] = useState<BreachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { getGate().then(setGate).catch(() => setGate({ enabled: false, acknowledgedBy: null, acknowledgedAt: null })); }, []);

  const run = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = email.trim(); if (!q) return;
    setLoading(true); setErr(null); setRes(null);
    checkBreach(q).then(setRes).catch((er: unknown) => setErr(er instanceof ApiError ? er.message : 'Lookup failed.')).finally(() => setLoading(false));
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><ShieldAlert size={22} className="text-calibrex-high" /> Breach Exposure</h1>
        <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Check whether an email appears in known public data breaches (via HaveIBeenPwned). A <b className="text-calibrex-text">gated tool</b>: it touches personal data, so it runs only when an administrator has authorized it, and every lookup is logged.</p>
      </div>

      {!gate ? <div className="py-12 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>
      : !gate.enabled ? (
        <div className="rounded-xl border border-calibrex-high/30 bg-calibrex-high/5 p-5 flex items-start gap-3">
          <Lock size={20} className="text-calibrex-high shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-calibrex-high">Sensitive tools are disabled</div>
            <p className="text-[12px] text-calibrex-muted mt-1">An administrator must enable sensitive tools (with an authorization acknowledgment) in <b>User Management → Sensitive tools</b> before breach lookups can run. This protects you and your subjects under data-protection rules.</p>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={run} className="flex gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" aria-label="Email to check"
              className="flex-1 bg-calibrex-surface-light border border-calibrex-teal/30 rounded-lg px-3 py-2.5 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal" />
            <button type="submit" disabled={loading || !email.trim()} className="px-4 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy font-black text-sm flex items-center gap-1.5 disabled:opacity-40">{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Check</button>
          </form>
          <p className="text-[10px] text-white/30">This lookup is logged with your identity and the email queried. Only run it on subjects you are authorized to investigate.</p>

          {err && <p className="text-sm text-calibrex-critical flex items-center gap-1.5"><AlertTriangle size={14} /> {err}</p>}

          {res && (res.configured === false ? (
            <div className="rounded-xl border border-calibrex-gold/30 bg-calibrex-gold/5 p-4 flex items-start gap-3">
              <KeyRound size={18} className="text-calibrex-gold shrink-0 mt-0.5" />
              <div><div className="text-sm font-bold text-calibrex-gold">Breach source not configured</div><p className="text-[12px] text-calibrex-muted mt-1">Add a HaveIBeenPwned API key as <code className="font-mono">HIBP_API_KEY</code> on the server (bring-your-own-key) to enable lookups.</p></div>
            </div>
          ) : res.count === 0 ? (
            <div className="rounded-xl border border-calibrex-low/30 bg-calibrex-low/5 p-4 flex items-start gap-3">
              <CheckCircle2 size={18} className="text-calibrex-low shrink-0 mt-0.5" />
              <div><div className="text-sm font-bold text-calibrex-low">No known breaches for {res.email}</div><p className="text-[12px] text-calibrex-muted mt-1">Not found in HaveIBeenPwned's public breach corpus. This is not proof the account is secure.</p></div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[10px] font-black text-calibrex-high uppercase tracking-widest flex items-center gap-1.5"><AlertTriangle size={12} /> {res.count} breach{res.count === 1 ? '' : 'es'} for {res.email}</div>
              {res.breaches.map((b, i) => (
                <div key={i} className="p-3 bg-calibrex-surface border border-white/10 rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-white">{b.name} {b.domain && <span className="text-white/40 font-mono text-[11px]">· {b.domain}</span>}</span>
                    <span className="text-[10px] font-mono text-white/40">{b.breachDate}{b.pwnCount ? ` · ${b.pwnCount.toLocaleString()} accounts` : ''}</span>
                  </div>
                  {b.dataClasses.length > 0 && <div className="flex flex-wrap gap-1 mt-1.5">{b.dataClasses.map((c, j) => <span key={j} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-calibrex-high/10 text-calibrex-high border border-calibrex-high/20">{c}</span>)}</div>}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default BreachCheck;
