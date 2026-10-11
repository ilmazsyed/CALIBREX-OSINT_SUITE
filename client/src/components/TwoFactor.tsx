import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, Check, ShieldCheck, Copy } from 'lucide-react';
import { auth, ApiError, copyText } from '../lib/api';

/** Optional TOTP two-factor auth setup. */
const TwoFactor: React.FC<{ onNotify?: (m: string) => void }> = ({ onNotify }) => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [stage, setStage] = useState<'idle' | 'setup'>('idle');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { auth.twofa.status().then(r => setEnabled(r.enabled)).catch(() => setEnabled(false)); }, []);

  const startSetup = () => {
    setBusy(true); setErr(null);
    auth.twofa.setup().then(r => { setSecret(r.secret); setStage('setup'); }).catch(() => setErr('Could not start setup.')).finally(() => setBusy(false));
  };
  const confirm = () => {
    setBusy(true); setErr(null);
    auth.twofa.enable(code.trim()).then(() => { setEnabled(true); setStage('idle'); setCode(''); setSecret(''); onNotify?.('Two-factor authentication is on.'); })
      .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Could not enable.')).finally(() => setBusy(false));
  };
  const disable = () => {
    setBusy(true); setErr(null);
    auth.twofa.disable(code.trim()).then(() => { setEnabled(false); setCode(''); onNotify?.('Two-factor authentication is off.'); })
      .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Could not disable.')).finally(() => setBusy(false));
  };

  const input = 'w-full bg-calibrex-surface-light border border-calibrex-teal/30 rounded px-3 py-2 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal';

  return (
    <section className="bg-calibrex-surface border border-calibrex-surface-light rounded-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-calibrex-gold mb-1 flex items-center gap-2"><ShieldCheck size={18} /> Two-factor authentication</h2>
      <p className="text-sm text-calibrex-muted mb-5">Protect your account with a time-based code from an authenticator app (Google Authenticator, Authy, 1Password…). You'll enter a 6-digit code at sign-in.</p>

      {enabled === null ? <div className="py-4 flex justify-center text-calibrex-gold"><Loader2 className="animate-spin" /></div>
      : enabled ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-calibrex-low"><Check size={16} /> Two-factor is ON.</div>
          <label className="block text-[12px] text-calibrex-muted">Turn it off (enter a current code to confirm):</label>
          <div className="flex gap-2">
            <input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" className={input + ' max-w-[160px] tracking-[0.3em] text-center'} />
            <button onClick={disable} disabled={busy || code.length < 6} className="px-4 py-2 rounded-lg border border-calibrex-critical/40 text-calibrex-critical text-xs font-black uppercase tracking-widest disabled:opacity-40">{busy ? <Loader2 size={13} className="animate-spin" /> : 'Turn off'}</button>
          </div>
        </div>
      ) : stage === 'idle' ? (
        <button onClick={startSetup} disabled={busy} className="px-4 py-2.5 rounded-lg bg-calibrex-gold text-calibrex-navy font-black text-sm flex items-center gap-2 disabled:opacity-40">{busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Set up two-factor</button>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-calibrex-text">1. Add this secret key to your authenticator app (choose "enter a setup key" / manual entry):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm text-calibrex-gold bg-black/40 border border-white/10 rounded px-3 py-2 break-all select-all">{secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            <button onClick={() => copyText(secret).then(ok => ok && onNotify?.('Secret copied.'))} className="p-2 rounded border border-white/15 text-white" title="Copy"><Copy size={15} /></button>
          </div>
          <p className="text-[11px] text-calibrex-muted">Account: your email · Issuer: Calibrex · 6 digits · 30s.</p>
          <p className="text-[12px] text-calibrex-text">2. Enter the current 6-digit code to confirm:</p>
          <div className="flex gap-2">
            <input inputMode="numeric" maxLength={6} autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" className={input + ' max-w-[160px] tracking-[0.3em] text-center'} />
            <button onClick={confirm} disabled={busy || code.length < 6} className="px-4 py-2 rounded-lg bg-calibrex-teal text-calibrex-navy text-xs font-black uppercase tracking-widest disabled:opacity-40">{busy ? <Loader2 size={13} className="animate-spin" /> : 'Enable'}</button>
            <button onClick={() => { setStage('idle'); setCode(''); setSecret(''); setErr(null); }} className="px-3 py-2 rounded-lg border border-white/15 text-white text-xs font-black uppercase tracking-widest">Cancel</button>
          </div>
        </div>
      )}
      {err && <p className="text-[12px] text-calibrex-critical mt-2">{err}</p>}
    </section>
  );
};

export default TwoFactor;
