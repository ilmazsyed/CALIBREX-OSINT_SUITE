import React, { useEffect, useMemo, useState } from 'react';
import { Cctv, Loader2, RefreshCw, AlertTriangle, Play, ExternalLink, Radio } from 'lucide-react';
import { getCameras, Camera } from '../lib/cameras';

const ytEmbed = (channel: string) =>
  `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channel)}&autoplay=0&mute=1&modestbranding=1&rel=0`;

/** One camera tile. MJPEG streams are long-lived, so they mount only after a click. */
const CameraTile: React.FC<{ cam: Camera }> = ({ cam }) => {
  const [live, setLive] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [failed, setFailed] = useState(false);

  return (
    <div className="bg-calibrex-surface border border-white/10 rounded-lg overflow-hidden flex flex-col">
      <div className="relative bg-black aspect-video">
        {cam.kind === 'youtube' ? (
          <iframe
            title={cam.name}
            src={ytEmbed(cam.channel!)}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : live && !failed ? (
          <img
            key={nonce}
            src={`${cam.stream}?t=${nonce}`}
            alt={cam.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <button
            onClick={() => { setFailed(false); setLive(true); setNonce(n => n + 1); }}
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 text-calibrex-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            {failed ? <AlertTriangle size={26} className="text-calibrex-high" /> : <Play size={30} className="text-calibrex-teal" />}
            <span className="text-xs font-bold uppercase tracking-widest">{failed ? 'Offline — retry' : 'Connect'}</span>
          </button>
        )}
        {cam.kind === 'youtube' && <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-calibrex-critical/90 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Radio size={9} /> Live TV</span>}
      </div>
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">{cam.name}</div>
          <div className="text-xs text-calibrex-muted truncate">{cam.place}</div>
          {cam.note && <div className="text-[10px] text-calibrex-muted/70 mt-0.5">{cam.note}</div>}
        </div>
        {cam.kind === 'mjpeg' && live && !failed && (
          <button onClick={() => { setFailed(false); setNonce(n => n + 1); }} title="Reload" className="text-calibrex-muted hover:text-white shrink-0"><RefreshCw size={13} /></button>
        )}
      </div>
    </div>
  );
};

const Cameras: React.FC = () => {
  const [cams, setCams] = useState<Camera[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState<string>('All');

  const load = () => { setLoading(true); getCameras().then(x => { setCams(x.cameras); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const regions = useMemo(() => ['All', ...Array.from(new Set((cams || []).map(c => c.region)))], [cams]);
  const shown = (cams || []).filter(c => region === 'All' || c.region === region);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Cctv size={20} className="text-calibrex-teal" /> Live Cameras</h2>
          <p className="text-sm text-calibrex-muted">Openly broadcast public video — 24/7 news channels and public webcams — for visual confirmation.</p>
        </div>
        <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh</button>
      </div>

      <p className="text-xs text-calibrex-muted flex items-start gap-1.5 border border-white/10 rounded-lg p-3 bg-black/20">
        <AlertTriangle size={13} className="text-calibrex-gold mt-0.5 shrink-0" />
        Cameras are third-party public feeds. Live-TV tiles show an "offline" card when a channel isn't currently streaming; webcams are proxied through the server (fixing browser mixed-content blocks) and are best-effort — some go offline without notice. This is open broadcast video only, not interception of any private stream.
      </p>

      {error && <p className="text-sm text-calibrex-critical">{error}</p>}

      {regions.length > 2 && (
        <div className="flex flex-wrap gap-1.5">
          {regions.map(r => (
            <button key={r} onClick={() => setRegion(r)} className={`px-2.5 py-1 rounded-full text-xs font-bold border ${region === r ? 'bg-calibrex-teal/15 border-calibrex-teal text-calibrex-teal' : 'border-white/10 text-calibrex-muted hover:text-white'}`}>{r}</button>
          ))}
        </div>
      )}

      {!cams ? <div className="py-16 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map(c => <CameraTile key={c.id} cam={c} />)}
          {shown.length === 0 && <p className="text-sm text-calibrex-muted">No cameras in this region.</p>}
        </div>
      )}

      <p className="text-[11px] text-calibrex-muted/60 flex items-center gap-1.5">
        <ExternalLink size={11} /> Want a specific strait, port, border, or city cam added? Send the channel or stream and it can be pinned here.
      </p>
    </div>
  );
};

export default Cameras;
