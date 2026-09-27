import React, { useEffect, useState } from 'react';
import { X, Loader2, Images, Satellite, ExternalLink, AlertTriangle } from 'lucide-react';
import { visuals, VisualTarget, CollectedMedia, SatelliteView, proxied } from '../lib/visuals';
import MediaTile from './MediaTile';
import MediaLightbox, { LightboxEntry } from './MediaLightbox';

/** Pop-up collection of every picture, video and satellite view for one story, alert or threat. */
const VisualCollection: React.FC = () => {
  const [target, setTarget] = useState<VisualTarget | null>(null);
  const [media, setMedia] = useState<CollectedMedia[]>([]);
  const [sat, setSat] = useState<SatelliteView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'media' | 'sat'>('media');
  const [light, setLight] = useState<number | null>(null);
  const [brokenSat, setBrokenSat] = useState<Set<string>>(new Set());

  useEffect(() => {
    const open = (e: Event) => setTarget((e as CustomEvent).detail);
    window.addEventListener('cx:visuals', open);
    return () => window.removeEventListener('cx:visuals', open);
  }, []);

  useEffect(() => {
    if (!target) return;
    let alive = true;
    setMedia(target.preload || []); setSat(null); setError(null); setLoading(true); setTab('media'); setLight(null); setBrokenSat(new Set());
    visuals.collect(target)
      .then(r => {
        if (!alive) return;
        const seen = new Set<string>();
        const merged = [...(target.preload || []), ...r.media].filter(m => { const k = (m as any).src || (m as any).href || (m as any).poster; if (!k || seen.has(k)) return false; seen.add(k); return true; });
        setMedia(merged); setSat(r.satellite);
        if (!merged.length && r.satellite) setTab('sat');
      })
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [target]);

  useEffect(() => {
    if (!target || light !== null) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setTarget(null); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [target, light]);

  if (!target) return null;
  const panels = (sat?.panels || []).filter(p => !brokenSat.has(p.id));
  const entries: LightboxEntry[] = tab === 'media' ? media.map(m => ({ kind: 'media', m })) : panels.map(p => ({ kind: 'sat', p, place: sat?.place || '' }));

  return (
    <div className="fixed inset-0 z-[125] bg-black/80 flex items-stretch sm:items-center justify-center sm:p-6" onClick={() => setTarget(null)}>
      <div role="dialog" aria-modal="true" aria-label="Visual intel" onClick={e => e.stopPropagation()} className="bg-[#0a1420] border border-white/10 sm:rounded-xl w-full max-w-5xl max-h-full flex flex-col shadow-2xl">
        <header className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/10">
          <div className="min-w-0">
            <div className="text-xs font-black text-calibrex-gold tracking-widest flex items-center gap-2"><Images size={14} /> VISUAL INTEL</div>
            <h2 className="text-base sm:text-lg font-bold text-white leading-snug mt-1 line-clamp-2">{target.title}</h2>
          </div>
          <button id="visuals-close" onClick={() => setTarget(null)} className="p-2 text-calibrex-muted hover:text-white shrink-0" aria-label="Close"><X size={20} /></button>
        </header>
        <div className="px-4 sm:px-6 pt-3 flex gap-2 border-b border-white/10">
          {([['media', `Photos & video (${media.length})`, Images], ['sat', `Satellite${sat ? ` (${panels.length})` : ''}`, Satellite]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 text-sm font-bold border-b-2 -mb-px flex items-center gap-1.5 ${tab === id ? 'border-calibrex-teal text-calibrex-teal' : 'border-transparent text-calibrex-muted hover:text-white'}`}><Icon size={14} /> {label}</button>
          ))}
          {loading && <span className="ml-auto self-center text-xs text-calibrex-teal flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Collecting from {target.urls.length} source{target.urls.length === 1 ? '' : 's'}…</span>}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
          {error && <div className="mb-4 text-sm text-calibrex-high flex gap-2"><AlertTriangle size={15} className="shrink-0" /> {error}</div>}
          {tab === 'media' && (
            media.length === 0 ? (
              <p className="py-12 text-center text-sm text-calibrex-muted">{loading ? 'Looking through the reports for photos and video…' : 'No photos or video were published with these reports. Check the Satellite tab for imagery of the area.'}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {media.map((m, i) => (
                  <MediaTile key={i} m={m} label={('alt' in m && m.alt) || m.from.title} onOpen={() => setLight(i)} className="aspect-[4/3]"
                    footer={<div className="mt-1 text-[11px] text-calibrex-muted truncate" title={m.from.title}>{m.from.source}{m.from.kind === 'social' ? ' · unverified' : ''}</div>} />
                ))}
              </div>
            )
          )}
          {tab === 'sat' && (
            !sat ? (
              <p className="py-12 text-center text-sm text-calibrex-muted">{loading ? 'Locating…' : 'No location could be identified for this report, so there is no satellite view.'}</p>
            ) : (
              <>
                <p className="text-xs text-calibrex-muted mb-3">{sat.place ? <b className="text-white">{sat.place}</b> : null} ({sat.lat.toFixed(2)}, {sat.lng.toFixed(2)}). {sat.precision}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {panels.map((p, i) => (
                    <figure key={p.id} className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
                      <button onClick={() => setLight(i)} className="block w-full aspect-square bg-black/50">
                        <img src={proxied(p.src)} alt={p.label} loading="lazy" onError={() => setBrokenSat(prev => new Set(prev).add(p.id))} className="w-full h-full object-cover" />
                      </button>
                      <figcaption className="p-3">
                        <div className="text-sm font-bold text-white">{p.label}</div>
                        <p className="text-xs text-calibrex-muted mt-1">{p.note}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <div className="mt-5">
                  <div className="text-sm font-bold text-white mb-2">Look closer (opens in a new tab)</div>
                  <div className="flex flex-wrap gap-2">
                    {sat.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded border border-white/15 text-xs text-calibrex-text hover:border-calibrex-teal flex items-center gap-1.5">{l.label} <ExternalLink size={11} /></a>)}
                  </div>
                </div>
              </>
            )
          )}
        </div>
      </div>
      {light !== null && entries.length > 0 && <div onClick={e => e.stopPropagation()}><MediaLightbox entries={entries} index={Math.min(light, entries.length - 1)} onIndex={setLight} onClose={() => setLight(null)} /></div>}
    </div>
  );
};

export default VisualCollection;
