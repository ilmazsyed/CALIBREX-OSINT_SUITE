import React, { useState } from 'react';
import { Play, ImageOff } from 'lucide-react';
import { Media, mediaThumb, proxied } from '../lib/visuals';

/** Square thumbnail for a picture or video; hides itself if the image cannot be loaded. */
const MediaTile: React.FC<{ m: Media; label?: string; onOpen: () => void; className?: string; children?: React.ReactNode; footer?: React.ReactNode; hideBroken?: boolean }> = ({ m, label, onOpen, className = '', children, footer, hideBroken = true }) => {
  const [broken, setBroken] = useState(false);
  const thumb = mediaThumb(m);
  if (broken && hideBroken) return null;
  const isVideo = m.type !== 'image';
  return (
    <div className="min-w-0">
    <button type="button" onClick={onOpen} className={`visual-tile group relative block w-full overflow-hidden rounded-lg bg-black/40 border border-white/10 hover:border-calibrex-teal focus-visible:border-calibrex-teal ${className}`} title={label}>
      {thumb && !broken ? (
        <img src={proxied(thumb)} alt={label || ''} loading="lazy" onError={() => setBroken(true)} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      ) : (
        <span className="w-full h-full flex items-center justify-center text-calibrex-muted">{isVideo ? <Play size={28} /> : <ImageOff size={24} />}</span>
      )}
      {isVideo && <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-black flex items-center gap-1"><Play size={10} fill="currentColor" /> VIDEO</span>}
      {children}
    </button>
    {footer}
    </div>
  );
};

export default MediaTile;
