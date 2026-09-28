import React, { useEffect, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Compass } from 'lucide-react';

/** Start the guided tour from anywhere. */
export const startTour = () => window.dispatchEvent(new Event('cx:tour'));
const DONE_KEY = 'cx_tour_done_v1';

interface Step { title: string; body: string; view?: string }
const STEPS: Step[] = [
  { title: 'Welcome to Calibrex', body: 'A 60-second tour of how to go from a live event to a sourced brief. You can skip anytime and re-open this from the ? in the header.' },
  { title: 'Dashboard', body: 'Your situational picture: a live map and wire feed. Flip the All Signals / Crisis toggle at the top to focus on conflict, with earthquake and disaster overlays.', view: 'dashboard' },
  { title: 'Workbench', body: 'Search everything ingested, view it as a timeline, and pin findings into Cases — your persistent investigation workspaces.', view: 'workbench' },
  { title: 'Research & verify', body: 'Search any place, group or event, then Verify to see how many independent outlets carry it. Pin the reports you trust.', view: 'research' },
  { title: 'Markets & crisis signals', body: 'Global indices, the yield curve and commodities — with a crisis engine that flags crashes, currency records and country stress in plain language.', view: 'markets' },
  { title: 'Signals', body: 'Live aircraft on a map (military highlighted), space weather, and trending attention. Set aircraft watches on an airbase, callsign or emergency squawk.', view: 'signals' },
  { title: 'Reports', body: 'Turn your pinned reports into an editable, fully-sourced brief, run a corroboration audit, then export or archive it — all in one place.', view: 'reports' },
  { title: 'Alerts that reach you', body: 'In Settings → Alert Delivery, push high-severity alerts to Telegram or a webhook, optionally geofenced. Set your watchlists so the news finds you.', view: 'settings' },
  { title: "You're set", body: 'That is the whole loop: spot → verify → organise → report → get alerted. Open the ? in the header anytime for the full guide.' },
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
