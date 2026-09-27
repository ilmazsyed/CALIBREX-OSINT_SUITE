import React, { useMemo } from 'react';
import ThreatCard from './ThreatCard';
import ThreatMap from './ThreatMap';
import IntelligenceFeed from './IntelligenceFeed';
import LiveStatusBar from './LiveStatusBar';
import { Threat, Stat } from '../types';
import { WifiOff, Loader2, Radar } from 'lucide-react';
import { LiveIntel, WIRE_KEYS } from '../lib/live';

interface DashboardProps {
  onGenerateReport: (title: string) => void;
  onShare: (title: string) => void;
  onInvestigate: (query: string) => void;
  onViewThreat: (threat: Threat) => void;
  threats: Threat[];
  live: LiveIntel;
  isOffline?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onGenerateReport, onShare, onInvestigate, onViewThreat, threats, live, isOffline }) => {
  const stats: Stat[] = useMemo(() => {
    const all = WIRE_KEYS.flatMap(k => live.feeds[k].items);
    return [
      { label: '🔴 Critical Alerts', value: all.filter(i => i.severity === 'CRITICAL').length, severity: 'CRITICAL' },
      { label: '📡 Active Wires', value: all.length, severity: 'MEDIUM' },
      { label: '⚖️ Financial Flags', value: live.feeds.FATF.items.length, severity: 'HIGH' },
      { label: '🌍 Strategic Axis', value: live.feeds.GLOBAL_AXIS.items.length, severity: 'LOW' },
    ];
  }, [live.feeds]);
  const anyLoading = WIRE_KEYS.some(k => live.feeds[k].loading);

  return (
    <div className="p-3 sm:p-6 pb-12 overflow-x-hidden w-full">
      <LiveStatusBar live={live} isOffline={isOffline} />

      {/* Responsive Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((stat, idx) => (
          <div key={idx} className={`bg-calibrex-surface border border-white/5 rounded-xl p-3 sm:p-5 border-l-4 shadow-lg min-w-0 ${
              stat.severity === 'CRITICAL' ? 'border-l-calibrex-critical' :
              stat.severity === 'HIGH' ? 'border-l-calibrex-high' : 'border-l-calibrex-teal'
          }`}>
            <div className="text-calibrex-muted text-[9px] sm:text-[10px] uppercase font-black opacity-70 mb-1 truncate">{stat.label}</div>
            <div className={`text-xl sm:text-3xl font-black truncate tabular-nums ${stat.severity === 'CRITICAL' ? 'text-calibrex-critical' : 'text-calibrex-teal'}`}>
              {anyLoading && stat.value === 0 ? <Loader2 size={22} className="animate-spin opacity-60" /> : stat.value}
            </div>
            <div className="text-[8px] font-mono text-white/30 uppercase mt-1">last 24h · live</div>
          </div>
        ))}
      </div>

      {/* Main Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 lg:min-h-[600px] lg:h-[70vh]">
        <div className="lg:col-span-8 bg-calibrex-surface border border-white/5 rounded-xl shadow-2xl overflow-hidden relative min-h-[400px] lg:h-full">
          <ThreatMap threats={threats} onInvestigate={onInvestigate} onViewThreat={onViewThreat} />
          {isOffline && (
            <div className="absolute top-4 right-4 z-[500] bg-calibrex-critical/20 border border-calibrex-critical/40 px-3 py-1.5 rounded backdrop-blur-sm flex items-center gap-2">
              <WifiOff size={14} className="text-calibrex-critical" />
              <span className="text-[10px] font-black text-calibrex-critical uppercase">Offline Archive</span>
            </div>
          )}
          {threats.length === 0 && (
            <div className="absolute inset-0 z-[450] flex items-center justify-center pointer-events-none">
              <div className="bg-black/70 border border-white/10 rounded-2xl px-6 py-4 text-center backdrop-blur-md max-w-xs">
                {live.loading
                  ? <><Loader2 size={22} className="animate-spin text-calibrex-teal mx-auto mb-2" /><p className="text-[10px] font-black text-white uppercase tracking-widest">Pulling live feeds…</p></>
                  : <><Radar size={22} className="text-calibrex-teal mx-auto mb-2" /><p className="text-[10px] font-black text-white/80 uppercase tracking-widest">{live.error || 'No located threat vectors in the current feeds.'}</p></>}
              </div>
            </div>
          )}
        </div>
        <div className="lg:col-span-4 min-h-[450px] h-[520px] lg:h-full overflow-hidden">
            <IntelligenceFeed live={live} onInvestigate={onInvestigate} isOffline={isOffline} />
        </div>
      </div>

      {/* Threat Cards Grid */}
      {threats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {threats.map(threat => (
            <ThreatCard
              key={threat.id}
              threat={threat}
              onGenerateReport={onGenerateReport}
              onShare={onShare}
              onInvestigate={onInvestigate}
              onWatch={onViewThreat}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
