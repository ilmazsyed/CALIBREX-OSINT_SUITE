import React from 'react';
import { Loader2, RefreshCw, Sparkles, AlertTriangle, Radio } from 'lucide-react';
import { LiveIntel, WIRE_KEYS, timeAgo } from '../lib/live';

export interface AssessmentStatus {
  analyzing: boolean;
  assessedAt: number | null;
  basis: number;
  error: string | null;
  onReanalyze: () => void;
}

const LiveStatusBar: React.FC<{ live: LiveIntel; assessment: AssessmentStatus; isOffline?: boolean }> = ({ live, assessment, isOffline }) => {
  const feeds = WIRE_KEYS.map(k => live.feeds[k]);
  const updated = Math.max(0, ...feeds.map(f => f.updatedAt || 0)) || null;
  const refreshing = feeds.some(f => f.loading);
  const denied = live.connected === false;
  const firstError = feeds.find(f => f.error && f.errorCode !== 'empty')?.error;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {denied && firstError && (
        <div className="bg-calibrex-high/10 border border-calibrex-high/30 rounded-xl px-4 py-3 text-[11px] text-calibrex-high font-bold flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {firstError}
        </div>
      )}
      <div className="bg-black/30 border border-white/5 rounded-xl px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-mono uppercase tracking-wider">
        <span className={`flex items-center gap-2 font-black ${isOffline ? 'text-calibrex-critical' : denied ? 'text-calibrex-high' : 'text-calibrex-low'}`}>
          <Radio size={12} className={!isOffline && !denied ? 'animate-pulse' : ''} />
          {isOffline ? 'Offline archive' : denied ? 'Live feeds unavailable' : 'Live OSINT'}
        </span>
        <span className="text-white/50">Wires updated <span className="text-white/80">{timeAgo(updated)}</span> · auto every 5 min</span>
        <span className="text-white/50 flex items-center gap-1.5">
          <Sparkles size={11} className="text-calibrex-gold" />
          Threat assessment{' '}
          <span className="text-white/80">{assessment.analyzing ? 'running…' : assessment.assessedAt ? `${timeAgo(assessment.assessedAt)} · ${assessment.basis} reports` : 'pending'}</span>
        </span>
        <div className="flex gap-2 ml-auto">
          <button onClick={live.refresh} disabled={isOffline || refreshing} className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/10 text-white/70 hover:text-calibrex-teal hover:border-calibrex-teal/40 disabled:opacity-40">
            {refreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Refresh wires
          </button>
          <button onClick={assessment.onReanalyze} disabled={isOffline || assessment.analyzing} className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-calibrex-gold/30 text-calibrex-gold hover:bg-calibrex-gold/10 disabled:opacity-40">
            {assessment.analyzing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Re-assess
          </button>
        </div>
      </div>
      {assessment.error && !assessment.analyzing && (
        <div className="text-[10px] text-calibrex-critical font-bold px-1">{assessment.error}</div>
      )}
    </div>
  );
};

export default LiveStatusBar;
