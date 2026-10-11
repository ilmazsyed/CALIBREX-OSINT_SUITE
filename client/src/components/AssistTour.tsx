import React, { useEffect, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Compass } from 'lucide-react';

/** Start the guided tour from anywhere. */
export const startTour = () => window.dispatchEvent(new Event('cx:tour'));
const DONE_KEY = 'cx_tour_done_v1';

interface Step { title: string; body: string; view?: string }
const STEPS: Step[] = [
  { title: 'Welcome to Calibrex', body: 'A 60-second tour of how to go from a live event to a sourced brief. You can skip anytime and re-open this from the ? in the header.' },
  { title: 'Command', body: 'Your home screen and single risk picture: a composite index plus a risk band for every monitor. Flip the Global / India / World toggle to re-scope everything, and fire a Rapid Brief straight from here.', view: 'command' },
  { title: 'The Watch strip', body: 'One strip across the top of every live board links them all — Security, Markets, Business, Government, Politics, Signals, Earth, Conflict and Maritime. Markers are events, grouped by place and coloured by severity; the feeds refresh every five minutes.', view: 'dashboard' },
  { title: 'Earth, Conflict & Maritime', body: 'Natural-event and hazard overlays (Earth Watch), conflict hotspots aggregated from the wires, and maritime incidents with the OFAC sanctioned-vessel registry — each on its own live map.', view: 'maritime' },
  { title: 'Research & verify', body: 'Search any place, group or event, then Verify to see how many independent outlets carry it right now. Pin the reports you trust.', view: 'research' },
  { title: 'Link Analysis & Sanctions', body: 'Pivot a domain, IP, email or name into its connected infrastructure on an interactive graph, and screen any name against the OFAC sanctions lists with fuzzy matching.', view: 'graph' },
  { title: 'Gated tools', body: 'Social Footprint is off by default. An admin enables it; each use needs an accepted agreement and is logged for audit.', view: 'socmint' },
  { title: 'Workbench & Briefs', body: 'Pin findings into persistent Cases, then export a court-ready evidence report with per-item SHA-256 integrity hashes. Rapid Briefs you generate anywhere are saved under Briefs.', view: 'workbench' },
  { title: 'Reports', body: 'Turn your pinned reports into an editable, fully-sourced brief, run a corroboration audit, then export or archive it.', view: 'reports' },
  { title: 'Alerts & security', body: 'Set watchlists so the news finds you, push high-severity alerts to Telegram or a webhook (optionally geofenced), connect your own AI, edit your profile and turn on two-factor sign-in — all in Settings.', view: 'settings' },
  { title: "You're set", body: 'That is the whole loop: scan Command → watch → verify → investigate → organise → report → get alerted. Open the ? in the header anytime for the full guide.' },
];

/** Skippable, clickable step-by-step assist. Navigates the app as it goes. */
const AssistTour: React.FC = () => {
  const [i, setI] = useState<number | null>(null);

  useEffect(() => {
    const start = () => setI(0);
    window.addEventListener('cx:tour', start);
    return () => window.removeEventListener('cx:tour', start);
  }, []);

  // Drive the app to the step's screen so the user sees the real thing behind the card.
  useEffect(() => {
    if (i == null) return;
    const v = STEPS[i].view;
    if (v) window.dispatchEvent(new CustomEvent('cx:navigate', { detail: v }));
  }, [i]);

  if (i == null) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const close = () => { setI(null); try { localStorage.setItem(DONE_KEY, '1'); } catch { /* ignore */ } };

  return (
    <div className="fixed inset-0 z-[2100] flex items-end sm:items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 cx-fade pointer-events-auto" onClick={close} />
      <div className="relative pointer-events-auto cx-glass cx-pop rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md m-0 sm:m-6 p-5 shadow-2xl" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-2 text-[11px] font-black text-calibrex-teal uppercase tracking-widest"><Compass size={14} /> Guided tour</span>
          <button onClick={close} aria-label="Skip tour" className="text-calibrex-muted hover:text-white text-[11px] font-bold flex items-center gap-1">Skip <X size={14} /></button>
        </div>
        <h3 className="text-lg font-black text-white mb-1.5">{step.title}</h3>
        <p className="text-sm text-calibrex-muted leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-center gap-1.5 my-4">
          {STEPS.map((_, n) => (
            <button key={n} onClick={() => setI(n)} aria-label={`Step ${n + 1}`} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-calibrex-teal' : 'w-1.5 bg-white/20 hover:bg-white/40'}`} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="px-3 py-2.5 rounded-lg border border-white/15 text-white text-sm flex items-center gap-1.5 disabled:opacity-30"><ArrowLeft size={15} /> Back</button>
          {last ? (
            <button onClick={close} className="flex-1 px-3 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy text-sm font-black uppercase tracking-widest flex items-center justify-center gap-1.5"><Check size={15} /> Done</button>
          ) : (
            <button onClick={() => setI(i + 1)} className="flex-1 px-3 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy text-sm font-black uppercase tracking-widest flex items-center justify-center gap-1.5">Next <ArrowRight size={15} /></button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssistTour;
export { DONE_KEY as TOUR_DONE_KEY };
