import React, { useState } from 'react';
import { X, ExternalLink, FolderPlus, Check, Search, MapPin, Crosshair, Satellite } from 'lucide-react';
import { AtlasDetail, SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/maplayers';
import { openReader } from '../lib/live';
import { addToCase } from '../lib/workbench';

/**
 * One detail card, shared by the 2D map and the 3D globe, so a tapped signal
 * reads the same everywhere. It leads with a plain-language summary of WHAT the
 * signal is and WHY it matters, then the hard facts, then real actions:
 * add to a case, open the source, investigate the subject, or open the spot on
 * a map. Nothing here jumps the user somewhere unexpected — every action is a
 * deliberate tap.
 */
interface Props {
  detail: AtlasDetail;
  onClose: () => void;
  onInvestigate?: (q: string) => void;
  following?: boolean;
  onStopFollow?: () => void;
}

const AtlasDetailCard: React.FC<Props> = ({ detail: d, onClose, onInvestigate, following, onStopFollow }) => {
  const [added, setAdded] = useState(false);
  const sev = (d.severity || '').toUpperCase();
  const sevColor = SEVERITY_COLOR[sev];

  const add = () => {
    addToCase({
      id: 'atlas-' + Date.now().toString(36),
      title: d.title,
      url: d.url || (d.lat != null ? `https://www.google.com/maps?q=${d.lat},${d.lng}` : 'https://app.calibrex.org'),
      source: d.source || 'Calibrex Atlas',
      severity: (d.severity as any) || undefined,
      place: d.place || null,
      published: d.published,
    });
    setAdded(true);
  };

  return (
    <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-[22rem] z-[1200] cx-card rounded-xl p-3.5 shadow-2xl">
      {/* header: layer chip + severity + close */}
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest"
          style={{ background: `${d.color}22`, color: d.color, border: `1px solid ${d.color}66` }}>
          {d.layer === 'sat' ? <Satellite size={11} /> : <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />}
          {d.label}
        </span>
        {sevColor && (
          <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest" style={{ background: `${sevColor}22`, color: sevColor, border: `1px solid ${sevColor}66` }}>
            {SEVERITY_LABEL[sev] || sev}
          </span>
        )}
        <button onClick={onClose} className="ml-auto text-white/40 hover:text-white shrink-0"><X size={16} /></button>
      </div>

      {/* headline + plain-language summary */}
      <div className="text-[15px] font-black text-white leading-tight break-words mb-1">{d.title}</div>
      <p className="text-[12px] text-white/80 leading-snug mb-2.5">{d.summary}</p>

      {/* hard facts */}
      {d.facts.length > 0 && (
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[12px] mb-2.5">
          {d.facts.map(([k, v], i) => (
            <React.Fragment key={i}>
              <dt className="text-white/40 font-mono text-[10px] uppercase tracking-wider pt-0.5 whitespace-nowrap">{k}</dt>
              <dd className="text-white/85 break-words">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}

      {/* what this layer is */}
      {d.context && <p className="text-[10.5px] text-white/40 leading-snug border-t border-white/10 pt-2 mb-2.5">{d.context}</p>}

      {/* actions */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={add}
          className={`flex-1 min-w-[7rem] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${added ? 'bg-calibrex-low/20 text-calibrex-low border border-calibrex-low/40' : 'bg-calibrex-gold text-calibrex-navy'}`}>
          {added ? <><Check size={13} /> Added to case</> : <><FolderPlus size={13} /> Add to case</>}
        </button>
        {onInvestigate && (
          <button onClick={() => onInvestigate(d.investigate)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-calibrex-teal/40 text-calibrex-teal text-[10px] font-black uppercase tracking-widest">
            <Search size={13} /> Investigate
          </button>
        )}
        {d.url && (
          <button onClick={() => openReader({ url: d.url!, title: d.title, source: d.source || 'Atlas' })} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 text-white/80 text-[10px] font-black uppercase tracking-widest">
            <ExternalLink size={13} /> Source
          </button>
        )}
        {d.lat != null && d.lng != null && (
          <a href={`https://www.google.com/maps?q=${d.lat},${d.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 text-white/80 text-[10px] font-black uppercase tracking-widest">
            <MapPin size={13} /> Map
          </a>
        )}
        {following && onStopFollow && (
          <button onClick={onStopFollow} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-calibrex-gold/15 border border-calibrex-gold/40 text-calibrex-gold text-[10px] font-black uppercase tracking-widest">
            <Crosshair size={13} /> Release
          </button>
        )}
      </div>
    </div>
  );
};

export default AtlasDetailCard;
