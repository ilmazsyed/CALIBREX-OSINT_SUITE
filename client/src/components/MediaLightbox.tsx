import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ExternalLink, BookOpen, Satellite } from 'lucide-react';
import { CollectedMedia, SatellitePanel, proxied } from '../lib/visuals';
import { openReader, timeAgo } from '../lib/live';

export type LightboxEntry = { kind: 'media'; m: CollectedMedia } | { kind: 'sat'; p: SatellitePanel; place: string };

/** Full-screen viewer with previous/next for a set of pictures, videos or satellite panels. */
const MediaLightbox: React.FC<{ entries: LightboxEntry[]; index: number; onIndex: (i: number) => void; onClose: () => void }> = ({ entries, index, onIndex, onClose }) => {
  const e = entries[index];
  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
      if (ev.key === 'ArrowRight') onIndex((index + 1) % entries.length);
      if (ev.key === 'ArrowLeft') onIndex((index - 1 + entries.length) % entries.length);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [index, entries.length, onClose, onIndex]);
  if (!e) return null;

  let body: React.ReactNode;
  let original = '';
  if (e.kind === 'sat') {
    body = <img src={proxied(e.p.src)} alt={e.p.label} className="max-h-[70vh] max-w-full object-contain" />;
    original = e.p.src;
  } else {
    const m = e.m;
    if (m.type === 'image') { body = <img src={proxied(m.src)} alt={m.alt || m.from.title} className="max-h-[70vh] max-w-full object-contain" />; original = m.src; }
    else if (m.type === 'video') { body = <video src={m.src} poster={m.poster ? proxied(m.poster) : undefined} controls playsInline className="max-h-[70vh] max-w-full" />; original = m.src; }
    else if (m.type === 'embed') { body = <iframe src={m.src} title={m.from.title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="w-[min(92vw,960px)] aspect-video rounded" />; original = m.href || m.src; }
    else { body = (
      <a href={m.href} target="_blank" rel="noopener noreferrer" className="relative block">
        {m.poster && <img src={proxied(m.poster)} alt="Video still" className="max-h-[70vh] max-w-full object-contain" />}
        <span className="absolute inset-0 flex items-center justify-center"><span className="px-4 py-2 rounded-full bg-black/70 text-white text-sm font-bold">Play at source ↗</span></span>
      </a>); original = m.href; }
  }

  return (
    <div className="fixed inset-0 z-[140] bg-[#03070b] flex flex-col" role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-calibrex-muted">
        <span className="tabular-nums">{index + 1} / {entries.length}</span>
        <div className="flex items-center gap-2">
          {original && <a href={original} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded border border-white/20 text-white flex items-center gap-1.5 hover:border-calibrex-teal">Open original <ExternalLink size={13} /></a>}
          <button id="lightbox-close" onClick={onClose} className="p-2 text-white" aria-label="Close viewer"><X size={20} /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center gap-2 px-2 min-h-0">
        {entries.length > 1 && <button onClick={() => onIndex((index - 1 + entries.length) % entries.length)} className="p-2 rounded-full bg-white/10 text-white shrink-0" aria-label="Previous"><ChevronLeft size={22} /></button>}
        <div className="flex-1 flex items-center justify-center min-w-0">{body}</div>
        {entries.length > 1 && <button onClick={() => onIndex((index + 1) % entries.length)} className="p-2 rounded-full bg-white/10 text-white shrink-0" aria-label="Next"><ChevronRight size={22} /></button>}
      </div>
      <div className="px-4 sm:px-8 py-4 max-w-4xl mx-auto w-full">
        {e.kind === 'sat' ? (
          <>
            <div className="text-white font-bold flex items-center gap-2"><Satellite size={15} className="text-calibrex-teal" /> {e.p.label}{e.place ? ` · ${e.place}` : ''}</div>
            <p className="text-sm text-calibrex-muted mt-1">{e.p.note}</p>
          </>
        ) : (
          <>
            {'alt' in e.m && e.m.alt && <p className="text-sm text-calibrex-text mb-1">{e.m.alt}</p>}
            <div className="text-white font-bold leading-snug">{e.m.from.title}</div>
            <div className="text-xs text-calibrex-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{e.m.from.source}{e.m.from.published ? ` · ${timeAgo(e.m.from.published)}` : ''}</span>
              {e.m.from.kind === 'social' && <span className="text-calibrex-medium font-bold">SOCIAL · UNVERIFIED</span>}
              <button onClick={() => { onClose(); openReader({ url: e.m.from.url, title: e.m.from.title, source: e.m.from.source, kind: e.m.from.kind }); }} className="text-calibrex-teal font-bold flex items-center gap-1 hover:underline"><BookOpen size={12} /> Read story</button>
              <a href={e.m.from.url} target="_blank" rel="noopener noreferrer" className="text-calibrex-teal hover:underline">Source page ↗</a>
            </div>
            <p className="text-xs text-calibrex-muted mt-2">Images are shown as published by the source. Check dates and locations before relying on them: old or unrelated footage is often recirculated.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default MediaLightbox;
