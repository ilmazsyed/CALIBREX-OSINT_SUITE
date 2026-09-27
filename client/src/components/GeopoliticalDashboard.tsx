
import React, { useMemo, useState } from 'react';
import ThreatCard from './ThreatCard';
import ThreatMap from './ThreatMap';
import IntelligenceFeed from './IntelligenceFeed';
import LiveStatusBar, { AssessmentStatus } from './LiveStatusBar';
import { Threat, Stat } from '../types';
import { ShieldAlert, Activity } from 'lucide-react';
import { LiveIntel } from '../lib/live';

interface GeopoliticalDashboardProps {
  onGenerateReport: (title: string) => void;
  onShare: (message: string) => void;
  onInvestigate: (query: string) => void;
  onViewThreat: (threat: Threat) => void;
  threats: Threat[];
  hazards: Threat[];
  live: LiveIntel;
  assessment: AssessmentStatus;
  isOffline?: boolean;
}

const GeopoliticalDashboard: React.FC<GeopoliticalDashboardProps> = ({ 
  onGenerateReport, onShare, onInvestigate, onViewThreat, threats, hazards, live, assessment, isOffline
}) => {
  const [showHazards, setShowHazards] = useState(true);
  const stats: Stat[] = useMemo(() => {
    const pool = [...live.feeds.KINETIC.items, ...live.feeds.REGIONAL.items];
    const seen = new Set<string>();
    const uniq = pool.filter(i => { const k = i.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
    const count = (re: RegExp) => uniq.filter(i => re.test(i.title)).length;
    return [
      { label: '💥 Strike Reports', value: count(/\b(missile|airstrikes?|air strikes?|drone strikes?|shelling|bombard\w*|rocket)\b/i), severity: 'CRITICAL' },
      { label: '⚠️ Coup / Unrest', value: count(/\b(coup|junta|mutiny|unrest|uprising|martial law|state of emergency)\b/i), severity: 'HIGH' },
      { label: '🚀 Tactical Deployment', value: count(/\b(deploy\w*|troops|mobili[sz]\w*|drills?|exercises?|build-?up)\b/i), severity: 'MEDIUM' },
      { label: '⚓ Maritime Incidents', value: count(/\b(naval|navy|warships?|blockade|vessels?|tanker|maritime|coast guard|strait)\b/i), severity: 'HIGH' },
    ];
  }, [live.feeds]);

  const kineticThreats = useMemo(() => threats.filter(t =>
    t.category === 'KINETIC' || t.severity === 'CRITICAL' || t.severity === 'HIGH'
  ), [threats]);
  const critical = kineticThreats.filter(t => t.severity === 'CRITICAL').length;
  const escalation = critical >= 4 ? 'SEVERE' : critical >= 2 ? 'HIGH' : kineticThreats.length > 0 ? 'ELEVATED' : 'MONITORING';

  return (
    <div className="p-4 sm:p-6 pb-24 w-full flex flex-col min-h-full space-y-6">
      <LiveStatusBar live={live} assessment={assessment} isOffline={isOffline} />
      {/* Tactical Header */}
      <div className="bg-calibrex-critical/5 border border-calibrex-critical/20 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-calibrex-critical/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="p-4 bg-calibrex-dark rounded-2xl border border-calibrex-critical/40 shadow-inner">
            <ShieldAlert size={32} className="text-calibrex-critical animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-[0.2em] mb-1">Geopolitical Monitor</h2>
            <div className="flex items-center gap-3">
                <span className="text-[10px] text-calibrex-critical font-black uppercase tracking-widest bg-calibrex-critical/10 px-2 py-0.5 rounded border border-calibrex-critical/20">ESCALATION: {escalation}</span>
                <span className="text-[10px] text-white/40 font-mono uppercase">{critical} critical vectors · live</span>
            </div>
          </div>
        </div>
        <button onClick={() => onGenerateReport("Global Crisis Briefing")} className="px-8 py-3 bg-calibrex-critical hover:bg-white text-white hover:text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95 shrink-0 relative z-10">Generate Crisis Brief</button>
      </div>

      {/* Stats Cluster */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {stats.map((stat, i) => (
          <div key={i} className="bg-calibrex-surface border border-white/5 rounded-xl p-5 border-l-4 border-l-calibrex-critical shadow-lg group hover:bg-white/5 transition-all">
            <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 group-hover:text-white/60 truncate">{stat.label}</div>
            <div className="text-3xl font-black text-calibrex-critical tabular-nums">{stat.value}</div>
            <div className="text-[8px] font-mono text-white/30 uppercase mt-1">headline count · last 24h</div>
          </div>
        ))}
      </div>

      {/* Main Grid: Fixes overlap by defining heights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 h-auto lg:h-[600px]">
        <div className="lg:col-span-8 bg-calibrex-surface border border-white/5 rounded-2xl p-1 shadow-2xl h-[400px] lg:h-full relative overflow-hidden">
          <ThreatMap threats={showHazards ? [...kineticThreats, ...hazards] : kineticThreats} onInvestigate={onInvestigate} onViewThreat={onViewThreat} />
          <button onClick={() => setShowHazards(v => !v)} className={`absolute bottom-4 left-4 z-[450] flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${showHazards ? 'bg-calibrex-medium/20 border-calibrex-medium/40 text-calibrex-medium' : 'bg-black/60 border-white/10 text-white/60'}`}>
            <Activity size={12} /> USGS quakes {hazards.length}
          </button>
        </div>
        <div className="lg:col-span-4 h-[450px] lg:h-full overflow-hidden">
          <IntelligenceFeed live={live} onInvestigate={onInvestigate} isOffline={isOffline} wires={['KINETIC', 'REGIONAL']} title="War Room Stream" tone="critical" />
        </div>
      </div>

      {/* Primary Threat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 shrink-0">
        {kineticThreats.map(t => (
          <ThreatCard key={t.id} threat={t} onGenerateReport={onGenerateReport} onShare={onShare} onInvestigate={onInvestigate} onWatch={onViewThreat} />
        ))}
      </div>
    </div>
  );
};

export default GeopoliticalDashboard;
