import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto py-12 px-6 border-t border-white/5 bg-black/10 flex flex-col items-center gap-6">
      <div className="flex items-center gap-3 grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all duration-500 cursor-default">
          <div className="w-8 h-8">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  {/* Crown Elements */}
                  <path d="M16 28 L24 38 L32 24 L40 38 L48 28" stroke="#c9a961" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Circuit C Letter */}
                  <path d="M48 48 A 22 22 0 1 1 48 16" stroke="#2a8a9a" strokeWidth="6" strokeLinecap="round" />
              </svg>
          </div>
          <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-[0.3em] leading-none">CALIBREX</span>
              <span className="text-[8px] text-calibrex-teal font-black tracking-[0.4em] uppercase mt-0.5">OSINT Studio Terminal</span>
          </div>
      </div>
      <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-4 opacity-20">
              <div className="h-px w-8 bg-white/50"></div>
              <p className="text-[9px] font-black text-white uppercase tracking-[0.4em]">
                  Professional Intelligence Management Suite
              </p>
              <div className="h-px w-8 bg-white/50"></div>
          </div>
          <p className="text-[8px] font-mono text-white/10 uppercase tracking-tighter">
              v2.4.0-STABLE • SYNC-PULSE: ACTIVE • ENCRYPTION: AES-256 • © 2025 ILMAZ SYED • ALL RIGHTS RESERVED
          </p>
      </div>
    </footer>
  );
};

export default Footer;