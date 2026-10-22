import React, { useState } from 'react';
import { MapPin, Globe2, X, Check } from 'lucide-react';
import { hasAskedGeo, markAskedGeo, requestGeo } from '../lib/geo';

/**
 * First-launch location rationale. Shown once, after sign-in, explaining that
 * Calibrex can tailor what you see to your area — then triggers the browser
 * permission prompt only if the user chooses to allow. The whole-world view
 * never goes away; location only centres the maps and surfaces nearby signals.
 */
const LocationPrompt: React.FC<{ show: boolean }> = ({ show }) => {
  const [done, setDone] = useState(hasAskedGeo());
  const [busy, setBusy] = useState(false);
  if (!show || done) return null;

  const allow = async () => { setBusy(true); await requestGeo(); setBusy(false); setDone(true); };
  const notNow = () => { markAskedGeo(); setDone(true); };

  return (
    <div className="fixed inset-0 z-[1400] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="cx-card rounded-2xl p-5 sm:p-6 max-w-md w-full relative">
        <button onClick={notNow} aria-label="Dismiss" className="absolute top-3 right-3 text-white/40 hover:text-white"><X size={18} /></button>
        <div className="w-11 h-11 rounded-xl bg-calibrex-gold/15 border border-calibrex-gold/40 flex items-center justify-center text-calibrex-gold mb-3"><MapPin size={22} /></div>
        <div className="cx-eyebrow mb-1">Make it local</div>
        <h2 className="font-display text-lg text-white mb-2">Tailor Calibrex to your area</h2>
        <p className="text-[12.5px] text-white/80 leading-relaxed mb-3">
          Allow location and Calibrex centres the maps on where you are and surfaces nearby signals first — so what's relevant to you is right in front of you.
        </p>
        <div className="space-y-1.5 mb-4 text-[11.5px] text-white/60">
          <div className="flex items-start gap-2"><Globe2 size={14} className="text-calibrex-teal shrink-0 mt-0.5" /> The whole world stays visible — this only changes where the map starts and what's ranked first.</div>
          <div className="flex items-start gap-2"><Check size={14} className="text-calibrex-low shrink-0 mt-0.5" /> Your location stays on this device. It is never sent to Calibrex or anyone else.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={allow} disabled={busy} className="flex-1 px-4 py-2.5 rounded-lg bg-calibrex-gold text-calibrex-navy text-[11px] font-black uppercase tracking-widest disabled:opacity-60">{busy ? 'Locating…' : 'Allow location'}</button>
          <button onClick={notNow} className="px-4 py-2.5 rounded-lg border border-white/15 text-white/80 text-[11px] font-black uppercase tracking-widest">Not now</button>
        </div>
        <p className="text-[10px] text-white/35 mt-3">You can turn this on or off anytime with the "Near me" control on the maps.</p>
      </div>
    </div>
  );
};

export default LocationPrompt;
