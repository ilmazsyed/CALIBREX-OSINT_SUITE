import React, { useState } from 'react';
import { Lock, ArrowRight, Check, Loader2, Compass } from 'lucide-react';
import { User, sub } from '../lib/api';

/** Marketing / activation site. */
export const WEBSITE = 'https://calibrex.org';
export const WEBSITE_LABEL = 'calibrex.org';

// Views every signed-in account can always reach (never sold).
export const BASELINE_VIEWS = new Set<string>(['command', 'threat-wire', 'settings', 'alerts', 'plans', 'dev-registry']);

/** Is the user entitled to this view/feature right now? */
export function isEntitled(user: User | null | undefined, view: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (BASELINE_VIEWS.has(view)) return true;
  const e = user.entitlement;
  if (e) return e.allAccess || e.entitled.includes(view);
  return user.access === 'full';          // legacy accounts (pre-entitlement)
}
export const isLocked = (user: User | null | undefined, view: string) => !isEntitled(user, view);

const prettyView = (v: string) => v.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** Shown in place of a locked view: request access, or open Plans & Features. */
export const LicenseLocked: React.FC<{ view: string; featureName?: string }> = ({ view, featureName }) => {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const name = featureName || prettyView(view);
  const request = async () => {
    setState('sending');
    try { await sub.request({ featureId: view }); setState('done'); }
    catch { setState('error'); }
  };
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl border border-calibrex-gold/25 bg-calibrex-surface p-8 sm:p-12 text-center shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-calibrex-gold/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-calibrex-gold/10 border border-calibrex-gold/30 flex items-center justify-center text-calibrex-gold mb-5"><Lock size={30} /></div>
          <div className="text-[10px] font-mono font-black text-white/40 uppercase tracking-[0.25em] mb-2">{name}</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Not in your plan yet</h1>
          <p className="text-sm text-calibrex-muted mt-3 max-w-lg leading-relaxed">
            <b className="text-white">{name}</b> isn’t part of your current plan. Request access and your administrator will review it, or add it a-la-carte from Plans &amp; Features.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5 justify-center">
            {state === 'done' ? (
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-calibrex-low/15 border border-calibrex-low/40 text-calibrex-low font-black text-sm uppercase tracking-widest"><Check size={16} /> Request sent</span>
            ) : (
              <button onClick={request} disabled={state === 'sending'} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-calibrex-gold text-calibrex-navy font-black text-sm uppercase tracking-widest hover:bg-white active:scale-95 transition-all disabled:opacity-60">
                {state === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} Request access
              </button>
            )}
            <button onClick={() => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'plans' }))} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-calibrex-teal/40 text-calibrex-teal font-black text-sm uppercase tracking-widest hover:bg-calibrex-teal/10 active:scale-95 transition-all">
              Plans &amp; features <ArrowRight size={15} />
            </button>
          </div>
          {state === 'error' && <p className="text-[11px] text-calibrex-critical mt-3">Couldn’t send the request — try again.</p>}
          <p className="text-[11px] text-white/40 mt-4">Your administrator approves access from their dashboard.</p>
        </div>
      </div>
    </div>
  );
};

const PLAN_LABEL: Record<string, string> = { demo: 'Demo', starter: 'Starter', professional: 'Professional', business: 'Business', enterprise: 'Enterprise' };

/** Thin status strip above the content showing the current plan. */
export const LicenseBanner: React.FC<{ user: User }> = ({ user }) => {
  const e = user.entitlement;
  if (user.role === 'admin' || e?.allAccess) return null;
  // Legacy accounts with no entitlement object but full access → nothing.
  if (!e && user.access === 'full') return null;
  const plan = e?.plan || (user.access === 'full' ? 'business' : 'demo');
  const openPlans = () => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'plans' }));

  if (plan === 'demo') {
    return (
      <div className="flex items-center justify-center gap-3 flex-wrap px-4 py-2 bg-calibrex-gold/10 border-b border-calibrex-gold/25 text-[11.5px]">
        <span className="flex items-center gap-1.5 font-bold text-calibrex-gold"><Lock size={12} /> Demo plan · {e && !e.locked ? 'choose your free feature' : 'basic features'}</span>
        <button onClick={openPlans} className="inline-flex items-center gap-1 font-black text-calibrex-gold hover:text-white">Plans &amp; features <ArrowRight size={12} /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap px-4 py-2 bg-calibrex-teal/10 border-b border-calibrex-teal/25 text-[11.5px]">
      <span className="flex items-center gap-1.5 font-bold text-calibrex-teal"><Compass size={12} /> {PLAN_LABEL[plan]} plan</span>
      {e && !e.locked && <span className="text-white/55">Pick your included features →</span>}
      <button onClick={openPlans} className="inline-flex items-center gap-1 font-black text-calibrex-teal hover:text-white">Manage <ArrowRight size={12} /></button>
    </div>
  );
};
