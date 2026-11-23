import React, { useState } from 'react';
import { X, Image as ImageIcon, Sun, Satellite, ExternalLink, Loader2 } from 'lucide-react';
import { ai } from '../lib/features';
import { reverseImageLinks, satelliteViewers } from '../lib/verify';

/**
 * Imagery / geolocation verification toolkit (keyless). Reverse-image search
 * launchers, chronolocation (estimate when a photo was taken from a shadow's
 * direction) and free-satellite viewers for change detection. Built for the
 * defense/geolocation analyst; nothing here phones home with a key.
 */
const field = 'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-calibrex-teal';
const lbl = 'block text-[9px] font-black text-calibrex-gold uppercase tracking-[0.18em] mb-1.5';
const linkBtn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-white/80 hover:text-white hover:border-calibrex-teal/50 text-[11px] font-bold';

const VerifyPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [imgUrl, setImgUrl] = useState('');
  const [lat, setLat] = useState(''); const [lng, setLng] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bearing, setBearing] = useState('');
  const [times, setTimes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const latN = Number(lat), lngN = Number(lng);
  const coordsOk = Number.isFinite(latN) && Number.isFinite(lngN) && lat !== '' && lng !== '';

  const runShadow = async () => {
    setErr(null); setTimes(null);
    if (!coordsOk || bearing === '') { setErr('Enter coordinates and the shadow bearing.'); return; }
    setBusy(true);
    try { const r = await ai.shadowTimes(latN, lngN, date, Number(bearing)); if (r.error) setErr(r.error); else setTimes(r); }
    catch (e: any) { setErr(e?.message || 'Could not compute shadow times.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="cx-card rounded-2xl p-5 sm:p-6 max-w-lg w-full my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div><div className="cx-eyebrow mb-0.5">Verify</div><h2 className="font-display text-base text-white">Imagery &amp; geolocation verification</h2></div>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>

        {/* reverse image */}
        <div className="cx-card rounded-xl p-4 mb-3">
          <label className={lbl}><ImageIcon size={11} className="inline mr-1" /> Reverse-image search</label>
          <input className={field} value={imgUrl} onChange={e => setImgUrl(e.target.value)} placeholder="Paste the image URL to trace where it has appeared" />
          {imgUrl.trim() && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {reverseImageLinks(imgUrl.trim()).map(l => (
                <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" className={linkBtn}>{l.name} <ExternalLink size={11} /></a>
              ))}
            </div>
          )}
          <p className="text-[10px] text-white/35 mt-2">Finds earlier/other appearances of an image — the fastest way to catch recycled or miscaptioned photos.</p>
        </div>

        {/* chronolocation */}
        <div className="cx-card rounded-xl p-4 mb-3">
          <label className={lbl}><Sun size={11} className="inline mr-1" /> Chronolocation (shadow → time)</label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className={field} value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitude" />
            <input className={field} value={lng} onChange={e => setLng(e.target.value)} placeholder="Longitude" />
            <input className={field} type="date" value={date} onChange={e => setDate(e.target.value)} />
            <input className={field} value={bearing} onChange={e => setBearing(e.target.value)} placeholder="Shadow bearing° (0=N,90=E)" />
          </div>
          <button onClick={runShadow} disabled={busy} className="px-4 py-2 rounded-lg bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <Sun size={13} />} Estimate times</button>
          {times && (
            <div className="mt-3 text-[12px] text-white/85">
              {times.candidates.length === 0 ? <p className="text-white/50">No daytime match — the sun never casts a shadow in that direction here on that date.</p> : (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-1">{times.candidates.map((c: any, i: number) => (
                    <span key={i} className="px-2 py-1 rounded-md bg-calibrex-teal/15 border border-calibrex-teal/40 text-calibrex-teal text-[11px] font-mono">{c.utc} UTC · {c.sunElevationDeg}°</span>
                  ))}</div>
                  <p className="text-[10px] text-white/40">{times.note}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* satellite viewers */}
        <div className="cx-card rounded-xl p-4">
          <label className={lbl}><Satellite size={11} className="inline mr-1" /> Satellite imagery (change detection)</label>
          {coordsOk ? (
            <div className="flex flex-wrap gap-2">
              {satelliteViewers(latN, lngN, date).map(v => (
                <a key={v.name} href={v.url} target="_blank" rel="noopener noreferrer" className={linkBtn}>{v.name} <ExternalLink size={11} /></a>
              ))}
            </div>
          ) : <p className="text-[11px] text-white/40">Enter coordinates above to open free satellite viewers (NASA, Sentinel, Esri Wayback…) for before/after imagery at that spot.</p>}
        </div>

        {err && <div className="mt-3 bg-calibrex-critical/15 border border-calibrex-critical/40 text-[11px] text-white px-3 py-2 rounded-lg">{err}</div>}
      </div>
    </div>
  );
};

export default VerifyPanel;
