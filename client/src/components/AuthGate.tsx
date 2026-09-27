import React, { useState, useEffect } from 'react';
import { ShieldAlert, Fingerprint, Building, User as UserIcon, Mail, Lock, Loader2, ShieldOff, Hourglass, LogOut } from 'lucide-react';
import CalibrexLogo from './CalibrexLogo';
import { auth, User, ApiError } from '../lib/api';

interface AuthGateProps {
  /** Signed-in user who cannot enter yet (pending or suspended), if any. */
  blockedUser: User | null;
  providerContact?: string;
  onAuthenticated: (user: User, contact: string) => void;
  onSignOut: () => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'BOOTING';

const bootLogs = [
  "INITIALIZING CALIBREX KERNEL v6.4...",
  "PROPRIETARY OSINT SUITE BY ILMAZ SYED...",
  "ESTABLISHING SECURE UPLINK...",
  "SYNCING LIVE OSINT WIRES...",
  "KERNEL INTEGRITY: VERIFIED [SYED-2025]",
  "AWAITING CLEARANCE..."
];

const inputCls = "w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-calibrex-teal transition-all placeholder:text-white/30";

const AuthGate: React.FC<AuthGateProps> = ({ blockedUser, providerContact, onAuthenticated, onSignOut }) => {
  const [mode, setMode] = useState<AuthMode>(() => (sessionStorage.getItem('cx_booted') ? 'LOGIN' : 'BOOTING'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bootStep, setBootStep] = useState(0);

  useEffect(() => {
    if (mode !== 'BOOTING') return;
    const timer = setInterval(() => setBootStep(prev => (prev < bootLogs.length - 1 ? prev + 1 : prev)), 380);
    const done = setTimeout(() => { try { sessionStorage.setItem('cx_booted', '1'); } catch { /* ignore */ } setMode('LOGIN'); }, 380 * bootLogs.length + 400);
    return () => { clearInterval(timer); clearTimeout(done); };
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const r = mode === 'REGISTER'
        ? await auth.signup({ email, password, name, org })
        : await auth.login(email, password);
      setPassword('');
      onAuthenticated(r.user, r.contact);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'BOOTING') {
    return (
      <div className="fixed inset-0 bg-[#050a0f] flex flex-col items-center justify-center z-[1000]">
        <CalibrexLogo size={120} className="mb-8" />
        <div className="text-center">
          <h1 className="text-4xl font-black text-white tracking-[0.5em] uppercase mb-2 animate-pulse">CALIBREX</h1>
          <p className="text-[10px] text-calibrex-teal font-black tracking-[0.3em] uppercase">OSINT Studio Terminal</p>
        </div>
        <div className="w-64 mt-8">
          <div className="text-[9px] font-mono text-calibrex-teal/60 uppercase mb-2 h-4">{bootLogs[bootStep]}</div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
            <div className="h-full bg-calibrex-teal transition-all duration-500 shadow-[0_0_10px_#2a8a9a]" style={{ width: `${((bootStep + 1) / bootLogs.length) * 100}%` }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (blockedUser) {
    const suspended = blockedUser.status === 'suspended';
    return (
      <div className="fixed inset-0 bg-[#050a0f] flex items-center justify-center p-4 z-[999]">
        <div className={`w-full max-w-sm bg-calibrex-navy/80 border rounded-[2rem] p-8 text-center shadow-[0_0_50px_rgba(0,0,0,0.3)] ${suspended ? 'border-calibrex-critical/40' : 'border-calibrex-gold/40'}`}>
          {suspended
            ? <ShieldOff size={64} className="text-calibrex-critical mx-auto mb-6" />
            : <Hourglass size={64} className="text-calibrex-gold mx-auto mb-6" />}
          <h2 className="text-xl font-black text-white uppercase mb-2">{suspended ? 'Suspended by Calibrex' : 'Awaiting Activation'}</h2>
          <p className="text-[11px] text-calibrex-muted uppercase tracking-widest mt-2 leading-relaxed">
            {suspended
              ? 'Your Calibrex OSINT Studio account is paused. Contact your provider for re-access.'
              : `Thanks, ${blockedUser.name || 'operator'}. Your account is registered and will be activated by your provider. Contact them to complete access.`}
          </p>
          {providerContact && <p className="mt-5 text-sm font-bold text-calibrex-gold break-words select-text">{providerContact}</p>}
          <p className="mt-5 text-[10px] font-mono text-white/40">{blockedUser.email}</p>
          <button onClick={onSignOut} className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2">
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#050a0f] flex items-center justify-center p-4 z-[999] overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(42,138,154,0.05)_0%,_transparent_70%)] pointer-events-none"></div>
      <div className="w-full max-w-sm sm:max-w-md bg-calibrex-navy/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-6 sm:p-10 relative overflow-hidden shadow-2xl my-8">
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <CalibrexLogo size={72} className="mb-4 sm:mb-6" />
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">{mode === 'LOGIN' ? 'Access Portal' : 'Identity Registry'}</h1>
          <p className="text-[10px] text-calibrex-teal font-black uppercase tracking-[0.3em] mt-1 opacity-70">SYED-2025-v6.4-GOLD</p>
        </div>

        {error && (
          <div role="alert" className="bg-calibrex-critical/10 border border-calibrex-critical/30 p-3 sm:p-4 rounded-2xl mb-5 text-calibrex-critical text-[11px] font-bold flex items-center gap-3">
            <ShieldAlert size={16} className="shrink-0" /> <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          {mode === 'REGISTER' && (
            <>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input id="su-name" type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="OPERATOR NAME" className={inputCls} />
              </div>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input id="su-org" type="text" autoComplete="organization" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="AGENCY / SECTOR" className={inputCls} />
              </div>
            </>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="EMAIL" className={inputCls} />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input id="auth-password" type="password" required minLength={mode === 'REGISTER' ? 8 : undefined} autoComplete={mode === 'REGISTER' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'REGISTER' ? 'PASSWORD (8+ CHARACTERS)' : 'PASSWORD'} className={inputCls} />
          </div>
          <button type="submit" disabled={isLoading} className={`w-full ${mode === 'LOGIN' ? 'bg-calibrex-teal' : 'bg-calibrex-gold'} hover:bg-white text-calibrex-navy font-black py-4 rounded-2xl uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(42,138,154,0.3)] active:scale-95 disabled:opacity-50 text-xs sm:text-sm mt-2`}>
            {isLoading ? <><Loader2 size={16} className="animate-spin" /> {mode === 'LOGIN' ? 'Syncing…' : 'Transmitting…'}</> : mode === 'LOGIN' ? 'Initialize Uplink' : 'Request Clearance'}
          </button>
          <button type="button" onClick={() => { setError(null); setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); }} className="w-full text-[10px] font-black text-white/50 hover:text-calibrex-gold uppercase tracking-[0.2em] mt-4 transition-colors">
            {mode === 'LOGIN' ? 'New operator? Request access' : 'Already registered? Sign in'}
          </button>
          {mode === 'REGISTER' && <p className="text-[10px] text-white/50 text-center leading-relaxed">New accounts are activated by your provider before first use.</p>}
        </form>
      </div>
      <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 text-center flex flex-col items-center gap-2 opacity-40 pointer-events-none">
        <p className="text-[9px] font-mono text-white uppercase tracking-[0.5em] flex items-center gap-2">
            <Fingerprint size={12} className="text-calibrex-teal" /> Calibrex Enclave v6.4
        </p>
        <p className="text-[8px] text-white/60 uppercase tracking-widest">Ownership & Patent Ilmaz Syed 2025</p>
      </div>
    </div>
  );
};

export default AuthGate;
