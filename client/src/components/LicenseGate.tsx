import React from 'react';
import { Lock, ExternalLink, Sparkles, Clock, ArrowRight } from 'lucide-react';

/** Marketing / activation site. Links open in a new tab so the app keeps running. */
export const WEBSITE = 'https://calibrex.org';
export const WEBSITE_LABEL = 'calibrex.org';

/**
 * Views a DEMO account may use in full. Everything else is visible in the nav
 * but shows the "Get License to Activate" screen. Admins and full/trial accounts
 * are never gated (the app passes access='full').
 */
export const DEMO_VIEWS = new Set<string>(['command', 'dashboard', 'threat-wire', 'settings', 'academy']);

export const isLocked = (access: string | undefined, view: string) =>
  access === 'demo' && !DEMO_VIEWS.has(view);

const PERKS = [
  'Every live monitor — Markets, Signals, Earth, Conflict, Maritime and more',
  'Investigation suite — Link Analysis, Sanctions, Research, Workbench',
  'Rapid Briefs, sourced reports and court-ready evidence export',
  'Watchlists, alerts and push/Telegram delivery',
];

/** Full-screen "Get License to Activate" panel shown in place of a locked view. */
export const LicenseLocked: React.FC<{ title?: string }> = ({ title }) => (
  <div className="p-4 sm:p-6 max-w-3xl mx-auto">
    <div className="relative overflow-hidden rounded-3xl border border-calibrex-gold/25 bg-calibrex-surface p-8 sm:p-12 text-center shadow-2xl">
      <div className="absolute top-0 right-0 w-64 h-64 bg-calibrex-gold/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-calibrex-gold/10 border border-calibrex-gold/30 flex items-center justify-center text-calibrex-gold mb-5">
          <Lock size={30} />
        </div>
        {title && <div className="text-[10px] font-mono font-black text-white/40 uppercase tracking-[0.25em] mb-2">{title}</div>}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Get License to Activate</h1>
        <p className="text-sm text-calibrex-muted mt-3 max-w-lg leading-relaxed">
          You're exploring Calibrex in <b className="text-calibrex-gold">demo mode</b>. This screen is part of the full platform.
          Activate a licence — or ask your administrator for a <b className="text-white">7-day trial</b> — to unlock it.
        </p>

        <div className="mt-6 w-full max-w-md text-left space-y-2">
          {PERKS.map(p => (
            <div key={p} className="flex items-start gap-2.5 bg-black/30 border border-white/5 rounded-xl px-3.5 py-2.5">
              <Sparkles size={14} className="text-calibrex-teal shrink-0 mt-0.5" />
              <span className="text-[12.5px] text-white/80 leading-snug">{p}</span>
            </div>
          ))}
        </div>

        <a href={WEBSITE} target="_blank" rel="noopener noreferrer"
          className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-calibrex-gold text-calibrex-navy font-black text-sm uppercase tracking-widest hover:bg-white active:scale-95 transition-all">
          Get a licence at {WEBSITE_LABEL} <ExternalLink size={15} />
        </a>
        <p className="text-[11px] text-white/40 mt-3">Already licensed? Ask your administrator to activate your account.</p>
      </div>
    </div>
  </div>
);

/**
 * Thin status strip shown above the content for demo and trial accounts.
 * Full/admin accounts see nothing.
 */
export const LicenseBanner: React.FC<{ plan: string; access: string; trialDaysLeft: number }> = ({ plan, access, trialDaysLeft }) => {
  if (plan === 'full' && access === 'full') return null;

  if (plan === 'trial' && access === 'full') {
    return (
      <div className="flex items-center justify-center gap-3 flex-wrap px-4 py-2 bg-calibrex-teal/10 border-b border-calibrex-teal/25 text-[11.5px]">
        <span className="flex items-center gap-1.5 font-bold text-calibrex-teal"><Clock size={13} /> Trial active · {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left</span>
        <span className="text-white/45">Full access, then your account returns to demo.</span>
        <a href={WEBSITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-black text-calibrex-teal hover:text-white">Get a licence <ArrowRight size={12} /></a>
      </div>
    );
  }

  // demo (includes a lapsed trial that has returned to demo)
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap px-4 py-2 bg-calibrex-gold/10 border-b border-calibrex-gold/25 text-[11.5px]">
      <span className="flex items-center gap-1.5 font-bold text-calibrex-gold"><Lock size={12} /> Demo mode · basic features only</span>
      <a href={WEBSITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-black text-calibrex-gold hover:text-white">Get License to Activate <ExternalLink size={12} /></a>
    </div>
  );
};
