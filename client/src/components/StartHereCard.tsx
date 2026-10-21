import React, { useState } from 'react';
import { Compass, X, Radar, Search, FileText } from 'lucide-react';
import { navigateTo } from './AiAssist';

export const STARTHERE_KEY = 'cx_starthere_done';
const KEY = STARTHERE_KEY;

/**
 * First-run orientation card on the Security Dashboard. Explains the three
 * things a new operator actually does, then gets out of the way for good once
 * dismissed (per-device flag). Low-risk: renders nothing after dismissal.
 */
const StartHereCard: React.FC = () => {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem(KEY) !== '1'; } catch { return true; }
  });
  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setShow(false); };

  const steps = [
    { Icon: Radar, title: 'Watch', body: 'Live dashboards — security, markets, government, politics and more. Use the Watch tabs up top to switch.', to: 'markets', cta: 'Open Watch' },
    { Icon: Search, title: 'Investigate', body: 'Research a topic, look up a subject, or run OSINT tools when something needs a closer look.', to: 'research', cta: 'Start research' },
    { Icon: FileText, title: 'Capture', body: 'File a Rapid Brief from any screen into Briefs, then compile the ones that matter into a Report.', to: 'briefs', cta: 'See Briefs' },
  ] as const;

  return (
    <div className="cx-card mb-4 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
      <button onClick={dismiss} aria-label="Dismiss" className="absolute top-3 right-3 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10"><X size={16} /></button>
      <div className="cx-eyebrow mb-2"><Compass size={13} className="text-calibrex-gold" /> Start here</div>
      <h2 className="font-display text-base text-white tracking-[0.1em] mb-1.5">THREE MOVES</h2>
      <p className="text-[11px] text-calibrex-muted mb-3.5 max-w-2xl leading-relaxed">New to Calibrex? Everything fits into three moves. Explore at your own pace — this card won't come back.</p>
      <div className="grid sm:grid-cols-3 gap-2.5">
        {steps.map(({ Icon, title, body, to, cta }, i) => (
          <div key={title} className="cx-card cx-lift rounded-xl p-3.5 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-calibrex-gold/15 text-calibrex-gold font-display text-[10px] flex items-center justify-center">{i + 1}</span>
              <Icon size={14} className="text-calibrex-teal" />
              <span className="font-display text-[11px] text-white tracking-[0.06em]">{title}</span>
            </div>
            <p className="text-[11px] text-calibrex-muted leading-relaxed flex-1">{body}</p>
            <button onClick={() => navigateTo(to)} className="mt-3 self-start text-[10px] font-mono uppercase tracking-[0.18em] text-calibrex-gold hover:text-calibrex-saffron transition-colors">{cta} →</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StartHereCard;
