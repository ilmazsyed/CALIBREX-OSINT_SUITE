import React, { useMemo, useState } from 'react';
import ThreatCard from './ThreatCard';
import ThreatMap from './ThreatMap';
import IntelligenceFeed from './IntelligenceFeed';
import LiveStatusBar from './LiveStatusBar';
import { Threat, Stat } from '../types';
import { WifiOff, Loader2, Radar, ShieldAlert, Activity, Globe2 } from 'lucide-react';
import { LiveIntel, WIRE_KEYS } from '../lib/live';

interface DashboardProps {
  onGenerateReport: (title: string) => void;
  onShare: (title: string) => void;
  onInvestigate: (query: string) => void;
  onViewThreat: (threat: Threat) => void;
  threats: Threat[];
  hazards: Threat[];
  live: LiveIntel;
  isOffline?: boolean;
}

// Dashboard has two view modes: the full situational picture, and a Crisis
// filter (formerly the separate "Crisis Monitor" screen) — kinetic vectors,
// escalation read-out, war-room stream, and USGS quakes on the map.
const Dashboard: React.FC<DashboardProps> = ({ onGenerateReport, onShare, onInvestigate, onViewThreat, threats, hazards, live, isOffline }) => {
  const [mode, setMode] = useState<'all' | 'crisis'>('all');
  const [showHazards, setShowHazards] = useState(true);

  const allStats: Stat[] = useMemo(() => {
    const all = WIRE_KEYS.flatMap(k => live.feeds[k].items);
    return [
      { label: '🔴 Critical Alerts', value: all.filter(i => i.severity === 'CRITICAL').length, severity: 'CRITICAL' },
      { label: '📡 Active Wires', value: all.length, severity: 'MEDIUM' },
      { label: '⚖️ Financial Flags', value: live.feeds.FATF.items.length, severity: 'HIGH' },
      { label: '🌍 Strategic Axis', value: live.feeds.GLOBAL_AXIS.items.length, severity: 'LOW' },
    ];
  }, [live.feeds]);

  const crisisStats: Stat[] = useMemo(() => {
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

  const kineticThreats = useMemo(() => threats.filter(t => t.category === 'KINETIC' || t.severity === 'CRITICAL' || t.severity === 'HIGH'), [threats]);
  const critical = kineticThreats.filter(t => t.severity === 'CRITICAL').length;
  const escalation = critical >= 4 ? 'SEVERE' : critical >= 2 ? 'HIGH' : kineticThreats.length > 0 ? 'ELEVATED' : 'MONITORING';

  const crisis = mode === 'crisis';
  const stats = crisis ? crisisStats : allStats;
  const shownThreats = crisis ? kineticThreats : threats;
  const mapThreats = crisis ? (showHazards ? [...kineticThreats, ...hazards] : kineticThreats) : threats;
  const anyLoading = WIRE_KEYS.some(k => live.feeds[k].loading);

  const modeBtn = (id: 'all' | 'crisis', label: string, icon: React.ReactNode) => (
    <button onClick={() => setMode(id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
      mode === id ? (id === 'crisis' ? 'bg-calibrex-critical/15 border-calibrex-critical text-calibrex-critical' : 'bg-calibrex-teal/15 border-calibrex-teal text-calibrex-teal') : 'border-white/10 text-calibrex-muted hover:text-white'
    }`}>{icon} {label}</button>
  );

  return (
    <div className="p-3 sm:p-6 pb-12 overflow-x-hidden w-full">
      <LiveStatusBar live={live} isOffline={isOffline} />

      {/* Mode switch */}
      <div className="flex items-center gap-2 mb-4">
        {modeBtn('all', 'All Signals', <Globe2 size={13} />)}
        {modeBtn('crisis', 'Crisis', <ShieldAlert size={13} />)}
      </div>

      {/* Crisis header */}
      {crisis && (
        <div className="bg-calibrex-critical/5 border border-calibrex-critical/20 p-4 sm:p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden mb-6">
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-calibrex-dark rounded-2xl border border-calibrex-critical/40"><ShieldAlert size={28} className="text-calibrex-critical animate-pulse" /></div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-[0.2em] mb-1">Geopolitical Crisis Monitor</h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-calibrex-critical font-black uppercase tracking-widest bg-calibrex-critical/10 px-2 py-0.5 rounded border border-calibrex-critical/20">ESCALATION: {escalation}</span>
                <span className="text-[10px] text-white/40 font-mono uppercase">{critical} critical vectors · live</span>
              </div>
            </div>
          </div>
          <button onClick={() => onGenerateReport('Global Crisis Briefing')} className="px-6 py-3 bg-calibrex-critical hover:bg-white text-white hover:text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95 shrink-0 relative z-10">Generate Crisis Brief</button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((stat, idx) => (
          <div key={idx} className={`bg-calibrex-surface border border-white/5 rounded-xl p-3 sm:p-5 border-l-4 shadow-lg min-w-0 ${
              stat.severity === 'CRITICAL' ? 'border-l-calibrex-critical' : stat.severity === 'HIGH' ? 'border-l-calibrex-high' : 'border-l-calibrex-teal'
          }`}>
            <div className="text-calibrex-muted text-[9px] sm:text-[10px] uppercase font-black opacity-70 mb-1 truncate">{stat.label}</div>
            <div className={`text-xl sm:text-3xl font-black truncate tabular-nums ${stat.severity === 'CRITICAL' ? 'text-calibrex-critical' : 'text-calibrex-teal'}`}>
              {anyLoading && stat.value === 0 ? <Loader2 size={22} className="animate-spin opacity-60" /> : stat.value}
            </div>
            <div className="text-[8px] font-mono text-white/30 uppercase mt-1">{crisis ? 'headline count · last 24h' : 'last 24h · live'}</div>
          </div>
        ))}
      </div>

      {/* Main Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 lg:min-h-[600px] lg:h-[70vh]">
        <div className="lg:col-span-8 bg-calibrex-surface border border-white/5 rounded-xl shadow-2xl overflow-hidden relative min-h-[400px] lg:h-full">
          <ThreatMap threats={mapThreats} onInvestigate={onInvestigate} onViewThreat={onViewThreat} />
          {crisis && (
            <button onClick={() => setShowHazards(v => !v)} className={`absolute bottom-4 left-4 z-[450] flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${showHazards ? 'bg-calibrex-medium/20 border-calibrex-medium/40 text-calibrex-medium' : 'bg-black/60 border-white/10 text-white/60'}`}>
              <Activity size={12} /> USGS quakes {hazards.length}
            </button>
          )}
          {isOffline && (
            <div className="absolute top-4 right-4 z-[500] bg-calibrex-critical/20 border border-calibrex-critical/40 px-3 py-1.5 rounded backdrop-blur-sm flex items-center gap-2">
              <WifiOff size={14} className="text-calibrex-critical" />
              <span className="text-[10px] font-black text-calibrex-critical uppercase">Offline Archive</span>
            </div>
          )}
          {mapThreats.length === 0 && (
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
          {crisis
            ? <IntelligenceFeed live={live} onInvestigate={onInvestigate} isOffline={isOffline} wires={['KINETIC', 'REGIONAL']} title="War Room Stream" tone="critical" />
            : <IntelligenceFeed live={live} onInvestigate={onInvestigate} isOffline={isOffline} />}
        </div>
      </div>

      {/* Threat Cards Grid */}
      {shownThreats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {shownThreats.map(threat => (
            <ThreatCard key={threat.id} threat={threat} onGenerateReport={onGenerateReport} onShare={onShare} onInvestigate={onInvestigate} onWatch={onViewThreat} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
