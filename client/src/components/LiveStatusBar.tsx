import React from 'react';
import { Loader2, RefreshCw, AlertTriangle, Radio, MapPin } from 'lucide-react';
import { LiveIntel, WIRE_KEYS, timeAgo } from '../lib/live';

const LiveStatusBar: React.FC<{ live: LiveIntel; isOffline?: boolean }> = ({ live, isOffline }) => {
  const total = WIRE_KEYS.reduce((n, k) => n + live.feeds[k].items.length, 0);
  const down = live.connected === false;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {live.error && (
        <div className="bg-calibrex-high/10 border border-calibrex-high/30 rounded-xl px-4 py-3 text-[11px] text-calibrex-high font-bold flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {live.error}
        </div>
      )}
      <div className="bg-black/30 border border-white/5 rounded-xl px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-mono uppercase tracking-wider">
        <span className={`flex items-center gap-2 font-black ${isOffline ? 'text-calibrex-critical' : down ? 'text-calibrex-high' : 'text-calibrex-low'}`}>
          <Radio size={12} className={!isOffline && !down ? 'animate-pulse' : ''} />
          {isOffline ? 'Offline archive' : down ? 'Live feeds unavailable' : 'Live OSINT'}
        </span>
        <span className="text-white/50">Feeds pulled <span className="text-white/80">{timeAgo(live.updatedAt)}</span> · every 5 min</span>
        <span className="text-white/50 flex items-center gap-1.5">
          <MapPin size={11} className="text-calibrex-gold" />
          <span className="text-white/80 tabular-nums">{live.threats.length}</span> located vectors · <span className="text-white/80 tabular-nums">{total}</span> reports (48h)
        </span>
        <div className="flex gap-2 ml-auto">
          <button onClick={live.refresh} disabled={isOffline || live.refreshing} className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/10 text-white/70 hover:text-calibrex-teal hover:border-calibrex-teal/40 disabled:opacity-40">
            {live.refreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Refresh feeds
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveStatusBar;
