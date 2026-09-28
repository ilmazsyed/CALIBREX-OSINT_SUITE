import React, { useEffect } from 'react';

interface LaunchPageProps { onFinish: () => void }

/** Animated splash: the Calibrex mark draws in over a pulsing halo, the wordmark
 *  tracks in, and a thin progress bar fills before handing off to the app. */
const LaunchPage: React.FC<LaunchPageProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(onFinish, 2600);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center overflow-hidden cx-fade"
      style={{ background: 'radial-gradient(120% 90% at 50% 40%, #0a1622 0%, #050a0f 60%)' }}>
      {/* ambient glow */}
      <div className="cx-splash-glow pointer-events-none absolute" style={{ width: 520, height: 520, background: 'radial-gradient(circle, rgba(42,138,154,0.22), transparent 60%)', filter: 'blur(10px)' }} />

      {/* logo + halo rings */}
      <div className="relative mb-9 grid place-items-center" style={{ width: 150, height: 150 }}>
        {[0, 0.6, 1.2].map((d, i) => (
          <span key={i} className="cx-halo absolute rounded-full" style={{ width: 120, height: 120, border: '1px solid rgba(42,138,154,0.5)', animationDelay: `${d}s` }} />
        ))}
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="cx-logo-in relative w-[120px] h-[120px] drop-shadow-[0_0_24px_rgba(42,138,154,0.55)]">
          {/* crown, drawn in */}
          <path d="M16 28 L24 38 L32 24 L40 38 L48 28" stroke="#c9a961" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ strokeDasharray: 80, strokeDashoffset: 80, animation: 'cx-draw 1s ease-out 0.5s forwards' }} />
          <circle cx="16" cy="28" r="1.6" fill="#c9a961" /><circle cx="32" cy="24" r="1.6" fill="#c9a961" /><circle cx="48" cy="28" r="1.6" fill="#c9a961" />
          {/* the C arc, sweeping in then settling into a gentle live pulse */}
          <path d="M48 48 A 22 22 0 1 1 48 16" stroke="#2a8a9a" strokeWidth="5" strokeLinecap="round"
            className="animate-[dash_2.4s_ease-in-out_infinite]" />
          <circle cx="48" cy="16" r="2.6" fill="white" /><circle cx="48" cy="48" r="2.6" fill="white" />
        </svg>
      </div>

      <h1 className="cx-brand-in text-3xl sm:text-4xl font-black text-white uppercase mb-2" style={{ letterSpacing: '0.5em', paddingLeft: '0.5em' }}>CALIBREX</h1>
      <p className="text-[10px] text-calibrex-teal font-black tracking-[0.35em] uppercase cx-fade" style={{ animationDelay: '0.7s' }}>OSINT Studio Terminal</p>

      {/* progress bar */}
      <div className="mt-9 h-[3px] w-44 rounded-full bg-white/10 overflow-hidden">
        <div className="cx-progress-bar h-full w-full rounded-full" style={{ background: 'linear-gradient(90deg, #2a8a9a, #c9a961)' }} />
      </div>

      <style>{`@keyframes dash { 0% { stroke-dasharray: 1,150; stroke-dashoffset: 0; } 50% { stroke-dasharray: 90,150; stroke-dashoffset: -35; } 100% { stroke-dasharray: 90,150; stroke-dashoffset: -124; } }`}</style>
    </div>
  );
};

export default LaunchPage;
