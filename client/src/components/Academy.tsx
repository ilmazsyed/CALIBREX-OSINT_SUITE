import React, { useEffect, useRef, useState } from 'react';
import { GraduationCap, Loader2, ExternalLink, RefreshCw } from 'lucide-react';

export const ACADEMY_URL = 'https://calibrex.org/academy/';

/**
 * OSINT Academy — the in-app training zone. Loads the Calibrex Academy site in
 * an embedded frame so the user never leaves the app. If the site refuses to be
 * framed (X-Frame-Options / CSP) or is slow, a fallback offers a one-tap open
 * in a new tab so it always works.
 */
const Academy: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [nonce, setNonce] = useState(0);        // bump to force a reload
  const frameRef = useRef<HTMLIFrameElement>(null);

  // If the frame hasn't loaded in a few seconds, surface the open-in-tab path
  // (covers a site that blocks framing, where onLoad may never fire cleanly).
  useEffect(() => {
    setLoaded(false); setSlow(false);
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [nonce]);

  const openTab = () => window.open(ACADEMY_URL, '_blank', 'noopener,noreferrer');

  return (
    <div className="p-3 sm:p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="shrink-0 w-10 h-10 rounded-xl bg-calibrex-gold/15 border border-calibrex-gold/30 flex items-center justify-center text-calibrex-gold"><GraduationCap size={20} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-[0.12em]">OSINT Academy</h1>
          <p className="text-[11px] text-calibrex-muted">Training zone — courses and walkthroughs to get sharp fast.</p>
        </div>
        <button onClick={() => setNonce(n => n + 1)} title="Reload" className="p-2 rounded-lg border border-white/10 text-calibrex-muted hover:text-calibrex-teal shrink-0"><RefreshCw size={15} /></button>
        <button onClick={openTab} title="Open in a new tab" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-calibrex-teal/40 text-calibrex-teal text-[10px] font-black uppercase tracking-widest shrink-0"><ExternalLink size={13} /> <span className="hidden sm:inline">New tab</span></button>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40" style={{ height: 'calc(100dvh - 11rem)', minHeight: 420 }}>
        <iframe
          key={nonce}
          ref={frameRef}
          src={ACADEMY_URL}
          title="OSINT Academy"
          onLoad={() => setLoaded(true)}
          className="w-full h-full"
          style={{ border: 0 }}
          allow="fullscreen; clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* Loading / fallback overlay. */}
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-calibrex-dark/95 px-6 text-center">
            {!slow ? (
              <>
                <Loader2 className="animate-spin text-calibrex-teal" size={26} />
                <p className="text-[12px] text-calibrex-muted">Loading the Academy…</p>
              </>
            ) : (
              <>
                <GraduationCap className="text-calibrex-gold" size={30} />
                <p className="text-[13px] text-white font-bold">Taking longer than usual.</p>
                <p className="text-[12px] text-calibrex-muted max-w-xs leading-relaxed">If it stays blank, your browser may be blocking the embed. Open it in a new tab instead — you’ll stay signed in.</p>
                <div className="flex gap-2">
                  <button onClick={() => setNonce(n => n + 1)} className="px-4 py-2 rounded-lg border border-white/15 text-white/70 text-[10px] font-black uppercase tracking-widest">Retry</button>
                  <button onClick={openTab} className="px-4 py-2 rounded-lg bg-calibrex-teal text-calibrex-navy text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><ExternalLink size={13} /> Open the Academy</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Academy;
