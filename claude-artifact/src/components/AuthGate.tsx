import React, { useState, useEffect } from 'react';
import { ShieldAlert, Fingerprint, CheckCircle2, Building, User, Loader2, ShieldOff } from 'lucide-react';
import CalibrexLogo from './CalibrexLogo';
import { Operator } from '../lib/claude';

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  org: string;
  avatarUrl: string;
  isMaster: boolean;
  canEdit: boolean;
}

interface AuthGateProps {
  operator: Operator | null;          // null while identity is still resolving
  revoked: boolean;
  providerContact?: string;
  savedProfile: { name: string; org: string } | null;
  onAuthenticated: (user: SessionUser, profile: { name: string; org: string }, isNew: boolean) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'BOOTING' | 'SUCCESS_MODAL';

const bootLogs = [
  "INITIALIZING CALIBREX KERNEL v6.4...",
  "PROPRIETARY OSINT SUITE BY ILMAZ SYED...",
  "ESTABLISHING SECURE NEURAL UPLINK...",
  "VERIFYING CLAUDE IDENTITY...",
  "KERNEL INTEGRITY: VERIFIED [SYED-2025]",
  "AWAITING CLEARANCE..."
];

const AuthGate: React.FC<AuthGateProps> = ({ operator, revoked, providerContact, savedProfile, onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>('BOOTING');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bootStep, setBootStep] = useState(0);

  useEffect(() => {
    if (mode !== 'BOOTING') return;
    const timer = setInterval(() => {
      setBootStep(prev => (prev < bootLogs.length - 1 ? prev + 1 : prev));
    }, 450);
    return () => clearInterval(timer);
  }, [mode]);

  // Leave the boot screen once the log has run and identity has resolved.
  useEffect(() => {
    if (mode === 'BOOTING' && bootStep >= bootLogs.length - 1 && operator) {
      const t = setTimeout(() => setMode(savedProfile ? 'LOGIN' : 'REGISTER'), 500);
      return () => clearTimeout(t);
    }
  }, [mode, bootStep, operator, savedProfile]);

  useEffect(() => {
    if (operator && !name) setName(savedProfile?.name || operator.name || '');
    if (savedProfile && !org) setOrg(savedProfile.org);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operator, savedProfile]);

  const buildUser = (profile: { name: string; org: string }): SessionUser => ({
    id: operator?.id || 'local-operator',
    name: profile.name || operator?.name || 'Operator',
    email: operator?.email || null,
    org: profile.org || 'Independent',
    avatarUrl: operator?.avatarUrl || '',
    isMaster: !!operator?.isOwner,
    canEdit: !!operator?.canEdit,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (revoked || !savedProfile) return;
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));
    onAuthenticated(buildUser(savedProfile), savedProfile, false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (revoked) return;
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setIsLoading(false);
    setMode('SUCCESS_MODAL');
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
          <div className="text-[9px] font-mono text-calibrex-teal/40 uppercase mb-2 h-4">{bootLogs[bootStep]}</div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
            <div className="h-full bg-calibrex-teal transition-all duration-500 shadow-[0_0_10px_#2a8a9a]" style={{ width: `${((bootStep + 1) / bootLogs.length) * 100}%` }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (revoked) {
    return (
      <div className="fixed inset-0 bg-[#050a0f] flex items-center justify-center p-4 z-[999]">
        <div className="w-full max-w-sm bg-calibrex-navy/80 border border-calibrex-critical/40 rounded-[2rem] p-8 text-center animate-in zoom-in-95 shadow-[0_0_50px_rgba(255,68,68,0.15)]">
          <ShieldOff size={64} className="text-calibrex-critical mx-auto mb-6" />
          <h2 className="text-xl font-black text-white uppercase mb-2">Suspended by Calibrex</h2>
          <p className="text-[11px] text-calibrex-muted uppercase tracking-widest mt-2 leading-relaxed">
            Your Calibrex OSINT Studio account is paused. Contact your provider for re-access.
          </p>
          {providerContact && (
            <p className="mt-5 text-sm font-bold text-calibrex-gold break-words select-text">{providerContact}</p>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'SUCCESS_MODAL') {
    return (
      <div className="fixed inset-0 bg-[#050a0f] flex items-center justify-center p-4 z-[999]">
        <div className="w-full max-w-sm bg-calibrex-navy/80 border border-calibrex-teal/40 rounded-[2rem] p-8 text-center animate-in zoom-in-95 shadow-[0_0_50px_rgba(42,138,154,0.2)]">
          <CheckCircle2 size={64} className="text-calibrex-teal mx-auto mb-6" />
          <h2 className="text-xl font-black text-white uppercase mb-2">Registry Committed</h2>
          <p className="text-[10px] text-calibrex-muted uppercase tracking-widest mt-2 mb-8 leading-relaxed">Identity profile linked to your Claude account. Initialize the uplink to enter the studio.</p>
          <button
            onClick={() => { const p = { name: name.trim(), org: org.trim() }; onAuthenticated(buildUser(p), p, true); }}
            className="w-full py-4 bg-calibrex-teal text-calibrex-navy font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white transition-all shadow-xl active:scale-95"
          >
            Initialize Uplink
          </button>
        </div>
      </div>
    );
  }

  const identityCard = (
    <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl p-4">
      {operator?.avatarUrl
        ? <img src={operator.avatarUrl} alt="" className="w-11 h-11 rounded-xl border border-calibrex-teal/30 shrink-0" />
        : <div className="w-11 h-11 rounded-xl bg-calibrex-teal/10 border border-calibrex-teal/20 flex items-center justify-center text-calibrex-teal shrink-0"><Fingerprint size={20} /></div>}
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-black text-calibrex-teal/60 uppercase tracking-[0.2em]">Claude Identity</div>
        <div className="text-sm font-black text-white truncate">{operator?.name || (operator?.id ? 'Verified operator' : 'Guest operator')}</div>
        {operator?.email && <div className="text-[10px] font-mono text-white/40 truncate">{operator.email}</div>}
      </div>
      {operator?.isOwner && <span className="text-[8px] bg-calibrex-gold/10 text-calibrex-gold border border-calibrex-gold/30 px-2 py-0.5 rounded font-black uppercase tracking-widest shrink-0">Owner</span>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#050a0f] flex items-center justify-center p-4 z-[999] overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(42,138,154,0.05)_0%,_transparent_70%)] pointer-events-none"></div>
      <div className="w-full max-w-sm sm:max-w-md bg-calibrex-navy/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-6 sm:p-10 relative overflow-hidden animate-in fade-in duration-700 shadow-2xl">
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <CalibrexLogo size={72} className="mb-4 sm:mb-6" />
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">{mode === 'LOGIN' ? 'Access Portal' : 'Identity Registry'}</h1>
          <p className="text-[10px] text-calibrex-teal font-black uppercase tracking-[0.3em] mt-1 opacity-60">SYED-2025-v6.4-GOLD</p>
        </div>

        {!operator?.id && (
          <div className="bg-calibrex-high/10 border border-calibrex-high/30 p-3 sm:p-4 rounded-2xl mb-5 text-calibrex-high text-[10px] font-black uppercase flex items-center gap-3">
            <ShieldAlert size={16} className="shrink-0" />
            <span>Open this page in claude.ai while signed in to link your identity and use AI synthesis.</span>
          </div>
        )}

        {mode === 'LOGIN' ? (
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            {identityCard}
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest px-1">
              Callsign <span className="text-white/80">{savedProfile?.name}</span> · Sector <span className="text-white/80">{savedProfile?.org}</span>
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-calibrex-teal hover:bg-white text-calibrex-navy font-black py-3.5 sm:py-4 rounded-2xl uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(42,138,154,0.3)] active:scale-95 disabled:opacity-50 text-xs sm:text-base">
              {isLoading ? <><Loader2 size={16} className="animate-spin" /> SYNCING...</> : 'Initialize Uplink'}
            </button>
            <button type="button" onClick={() => setMode('REGISTER')} className="w-full text-[9px] sm:text-[10px] font-black text-white/30 hover:text-calibrex-gold uppercase tracking-[0.3em] mt-4 sm:mt-6 transition-colors">Update Access Profile</button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-2 sm:space-y-3">
            {identityCard}
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input id="op-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="OPERATOR NAME" className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-xs sm:py-3.5 text-white focus:outline-none focus:border-calibrex-gold transition-all placeholder:text-white/30" />
            </div>
            <div className="relative">
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input id="op-org" type="text" required value={org} onChange={(e) => setOrg(e.target.value)} placeholder="AGENCY / SECTOR" className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-xs sm:py-3.5 text-white focus:outline-none focus:border-calibrex-gold transition-all placeholder:text-white/30" />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-calibrex-gold hover:bg-white text-calibrex-navy font-black py-3.5 sm:py-4 rounded-xl uppercase tracking-[0.2em] transition-all shadow-[0_10px_30px_rgba(201,169,97,0.2)] mt-2 active:scale-95 disabled:opacity-50 text-xs sm:text-base">
              {isLoading ? 'TRANSMITTING...' : 'Provision Clearance'}
            </button>
            {savedProfile && (
              <button type="button" onClick={() => setMode('LOGIN')} className="w-full text-[9px] sm:text-[10px] font-black text-white/30 hover:text-white uppercase mt-3 sm:mt-4 transition-colors">Return to Access</button>
            )}
          </form>
        )}
      </div>
      <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 text-center flex flex-col items-center gap-2 opacity-30 hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-[9px] font-mono text-white uppercase tracking-[0.5em] flex items-center gap-2">
            <Fingerprint size={12} className="text-calibrex-teal" /> Calibrex Enclave v6.4
        </p>
        <p className="text-[8px] text-white/50 uppercase tracking-widest">Ownership & Patent Ilmaz Syed 2025</p>
      </div>
    </div>
  );
};

export default AuthGate;
