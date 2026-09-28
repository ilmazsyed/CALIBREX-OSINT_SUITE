import React from 'react';

/** Slim, professional footer — one tidy row (stacks on very small screens). */
const Footer: React.FC = () => (
  <footer className="mt-auto border-t border-white/5 bg-black/20 px-4 sm:px-6 py-3">
    <div className="max-w-6xl mx-auto flex flex-col-reverse sm:flex-row items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0 opacity-80">
          <path d="M16 28 L24 38 L32 24 L40 38 L48 28" stroke="#c9a961" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M48 48 A 22 22 0 1 1 48 16" stroke="#2a8a9a" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <span className="text-[11px] font-black tracking-[0.2em] text-white/80 uppercase">
          Calibrex <span className="text-calibrex-teal/80">OSINT Studio</span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-medium text-white/30 tracking-wide">
        <span className="hidden sm:inline">Professional Intelligence Suite</span>
        <span className="hidden sm:inline text-white/15">·</span>
        <span>© {new Date().getFullYear()} Ilmaz Syed</span>
      </div>
    </div>
  </footer>
);

export default Footer;
