import React, { useState, useMemo } from 'react';
import { Radio, Newspaper, Shield, Globe, Terminal, TrendingUp, Filter, Globe2, Landmark, ExternalLink, Loader2, RefreshCw, AlertTriangle, Swords, BookOpen, Images } from 'lucide-react';
import { LiveIntel, LiveItem, WireKey, WIRE_KEYS, timeAgo, openReader } from '../lib/live';
import { localPref, setLocalPref } from '../lib/api';
import { openVisuals, proxied, mediaThumb } from '../lib/visuals';

// "NEW" markers: reports published since the operator's previous visit, plus
// reports that arrive while this page is open.
const previousVisit = localPref<number>('feed_seen_at', 0);
const sessionStart = Date.now();
setLocalPref('feed_seen_at', sessionStart);
const firstSeen = new Map<string, number>();
function isNew(item: LiveItem) {
  if (!firstSeen.has(item.id)) firstSeen.set(item.id, Date.now());
  const arrivedLater = firstSeen.get(item.id)! - sessionStart > 30000;
  return arrivedLater || (previousVisit > 0 && item.published > previousVisit);
}

interface IntelligenceFeedProps {
  live: LiveIntel;
  onInvestigate: (query: string) => void;
  isOffline?: boolean;
  wires?: WireKey[];              // which wires this panel shows (default: all)
  title?: string;
  tone?: 'teal' | 'critical';
}

const WIRE_ICON: Record<WireKey, React.ReactNode> = {
  SATP: <Shield size={14} />,
  FATF: <TrendingUp size={14} />,
  REGIONAL: <Globe2 size={14} />,
  GLOBAL_AXIS: <Globe size={14} />,
  CYBER: <Terminal size={14} />,
  KINETIC: <Swords size={14} />,
};

const FILTERS: { id: 'ALL' | WireKey; label: string; icon: React.ReactNode }[] = [
  { id: 'ALL', label: 'All Wires', icon: <Radio size={12} /> },
  { id: 'SATP', label: 'SATP', icon: <Shield size={12} /> },
  { id: 'FATF', label: 'FATF/FATP', icon: <Landmark size={12} /> },
  { id: 'REGIONAL', label: 'Regional', icon: <Globe2 size={12} /> },
  { id: 'GLOBAL_AXIS', label: 'Power Axis', icon: <Globe size={12} /> },
  { id: 'CYBER', label: 'Cyber', icon: <Terminal size={12} /> },
  { id: 'KINETIC', label: 'Kinetic', icon: <Swords size={12} /> },
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'CRITICAL': return 'text-calibrex-critical border-calibrex-critical/30';
    case 'HIGH': return 'text-calibrex-high border-calibrex-high/30';
    case 'MEDIUM': return 'text-calibrex-medium border-calibrex-medium/30';
    case 'LOW': return 'text-calibrex-low border-calibrex-low/30';
    default: return 'text-white/50 border-white/10';
  }
};

const IntelligenceFeed: React.FC<IntelligenceFeedProps> = ({ live, onInvestigate, isOffline, wires = WIRE_KEYS, title = 'Live Intelligence Wires', tone = 'teal' }) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | WireKey>('ALL');
  const filters = FILTERS.filter(f => f.id === 'ALL' || wires.includes(f.id as WireKey));
  const shown: WireKey[] = activeFilter === 'ALL' ? wires : [activeFilter];

  const items: LiveItem[] = useMemo(() => {
    const seen = new Set<string>();
    return shown.flatMap(k => live.feeds[k].items)
      .sort((a, b) => b.published - a.published)
      .filter(i => { const k = i.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 80);
  }, [live.feeds, activeFilter, wires.join(',')]);

  const states = shown.map(k => live.feeds[k]);
  const loading = states.some(s => s.loading) && items.length === 0;
  const error = states.find(s => s.error && s.errorCode !== 'empty')?.error || null;
  const updatedAt = Math.max(0, ...states.map(s => s.updatedAt || 0)) || null;
  const refreshing = states.some(s => s.loading);

  return (
    <div className={`bg-calibrex-surface border rounded-xl shadow-2xl overflow-hidden flex flex-col h-full w-full ${tone === 'critical' ? 'border-calibrex-critical/20' : 'border-white/5'}`}>
      <div className={`p-3 sm:p-4 border-b shrink-0 ${tone === 'critical' ? 'bg-calibrex-critical/10 border-calibrex-critical/20' : 'bg-black/20 border-white/5'}`}>
        <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${tone === 'critical' ? 'text-calibrex-critical' : 'text-calibrex-gold'}`}>
                <Radio size={14} className={isOffline ? '' : 'animate-pulse'} /> {title}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              {isOffline
                ? <span className="text-[8px] font-black text-calibrex-critical uppercase">Offline Archive</span>
                : <span className="text-[8px] font-mono font-black text-calibrex-low border border-calibrex-low/30 bg-calibrex-low/10 px-1.5 py-0.5 rounded tracking-widest">LIVE</span>}
              <button onClick={live.refresh} disabled={isOffline || refreshing} title="Refresh wires now" className="text-white/40 hover:text-calibrex-teal disabled:opacity-30 p-0.5">
                {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              </button>
            </div>
        </div>

        {filters.length > 2 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            {filters.map(f => (
                <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all shrink-0 border ${
                        activeFilter === f.id
                        ? 'bg-calibrex-teal text-calibrex-navy border-calibrex-teal'
                        : 'bg-white/5 text-white/50 border-white/5 hover:border-white/20'
                    }`}
                >
                    {f.icon}
                    {f.label}
                    {f.id !== 'ALL' && <span className="opacity-60 tabular-nums">{live.feeds[f.id as WireKey].items.length}</span>}
                </button>
            ))}
        </div>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 bg-calibrex-high/10 border-b border-calibrex-high/20 text-[10px] text-calibrex-high font-bold flex items-start gap-2">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-calibrex-teal gap-3">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest">Pulling live wires…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-40 py-20 text-center px-4">
            <Filter size={40} className="mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">No signals in this band</p>
          </div>
        ) : (
          items.map((msg) => { const fresh = isNew(msg); return (
            <div
              key={msg.id}
              role="button"
              tabIndex={0}
              onClick={() => onInvestigate(msg.title)}
              onKeyDown={(e) => { if (e.key === 'Enter') onInvestigate(msg.title); }}
              className={`p-3 bg-black/20 rounded-lg border cursor-pointer hover:border-calibrex-teal/50 transition-all flex flex-col gap-1 group ${fresh ? 'border-calibrex-teal/40 cx-new' : 'border-white/5'}`}
              title="Open in Intelligence Research"
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-2 text-[9px] font-mono text-calibrex-teal uppercase tracking-tighter truncate min-w-0">
                  {fresh && <span className="px-1 rounded bg-calibrex-teal text-calibrex-navy font-black not-italic shrink-0">NEW</span>}
                  {WIRE_ICON[msg.wire] || <Newspaper size={14} />} <span className="truncate">{msg.source} • {msg.wire.replace('_', ' ')}</span>
                </div>
                <span className="text-[9px] text-white/40 font-mono shrink-0" title={new Date(msg.published).toLocaleString()}>
                  {new Date(msg.published).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {timeAgo(msg.published)}
                </span>
              </div>
              <div className="text-[11px] font-bold text-white uppercase leading-tight group-hover:text-calibrex-gold transition-colors">{msg.title}</div>
              {msg.kind === 'social' && <span className="self-start text-[8px] font-black px-1.5 py-0.5 rounded border border-calibrex-medium/40 text-calibrex-medium tracking-widest" title="Post from an OSINT social account. Unverified until confirmed by other sources.">SOCIAL · UNVERIFIED</span>}
              {msg.kind === 'official' && <span className="self-start text-[8px] font-black px-1.5 py-0.5 rounded border border-calibrex-low/40 text-calibrex-low tracking-widest">OFFICIAL</span>}
              {msg.media && msg.media[0] && mediaThumb(msg.media[0]) && (
                <img src={proxied(mediaThumb(msg.media[0]))} alt="" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} className="mt-1 w-full max-h-40 object-cover rounded border border-white/5" />
              )}
              {msg.summary && msg.kind !== 'social' && <p className="text-[11px] text-white/60 leading-snug line-clamp-2 normal-case">{msg.summary}</p>}
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border tracking-widest ${getSeverityColor(msg.severity)}`}>
                    {msg.wire.replace('_', ' ')} / {msg.severity}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); openVisuals({ title: msg.title, urls: [msg.url], place: msg.place?.name, lat: msg.place?.lat, lng: msg.place?.lng, preload: (msg.media || []).map(m => ({ ...m, from: { title: msg.title, source: msg.source, url: msg.url, published: msg.published, kind: msg.kind } })) }); }} className="text-[8px] font-black text-calibrex-gold hover:underline uppercase flex items-center gap-1" title="Photos, video and satellite imagery for this report">
                    <Images size={9} /> Visual intel{msg.media?.length ? ` (${msg.media.length})` : ''}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openReader({ url: msg.url, title: msg.title, source: msg.source, kind: msg.kind, published: msg.published }); }} className="text-[8px] font-black text-calibrex-teal hover:underline uppercase flex items-center gap-1" title="Read the full article here">
                    <BookOpen size={9} /> Read
                  </button>
                  <a href={msg.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[8px] font-black text-white/40 hover:text-calibrex-teal uppercase flex items-center gap-1">
                    Source <ExternalLink size={9} />
                  </a>
                  <span className="text-[8px] font-black text-white/30 uppercase group-hover:text-calibrex-teal transition-colors">Investigate {'>'}</span>
                </div>
              </div>
            </div>
          ); })
        )}
      </div>

      <div className="p-2 bg-black/40 border-t border-white/5 text-center shrink-0">
        <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest">
          {isOffline ? 'Offline cache' : 'Server pull every 5 min'} · {items.length} items · {items.filter(isNew).length} new · updated {timeAgo(updatedAt)}
        </p>
      </div>
    </div>
  );
};

export default IntelligenceFeed;
