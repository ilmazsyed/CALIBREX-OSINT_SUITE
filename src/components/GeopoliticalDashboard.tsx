
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ThreatCard from './ThreatCard';
import ThreatMap from './ThreatMap';
import { Threat, Stat } from '../types';
import { 
  ShieldAlert, Bomb, Radio, Flag, Anchor, Terminal, Globe, Zap, Users
} from 'lucide-react';

interface GeopoliticalDashboardProps {
  onGenerateReport: (title: string) => void;
  onShare: (message: string) => void;
  onInvestigate: (query: string) => void;
  onViewThreat: (threat: Threat) => void;
  threats: Threat[];
  isOffline?: boolean;
}

const WarRoomFeed = ({ onInvestigate, isOffline }: { onInvestigate: (msg: string) => void, isOffline?: boolean }) => {
    const [logs, setLogs] = useState<{msg: string, source: string, time: string, severity: string, category: string}[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const kineticEvents = useMemo(() => [
        { msg: "BREAKING: Multi-domain invasion force crossing eastern border sectors. Heavy artillery reported.", source: "INTEL-OPS", severity: "CRITICAL", category: "INVASION" },
        { msg: "SATP: Intercepted mobilization orders for splinter militia cells in the Hindu Kush region.", source: "SATP-MONITOR", severity: "HIGH", category: "TERRORISM" },
        { msg: "NAV-WATCH: Destroyer cluster detected maintaining blockade configuration in the Red Sea.", source: "NAV-COM", severity: "HIGH", category: "MARITIME" },
        { msg: "COUP-ALERT: Unusual military formation surrounding the capital's presidential palace in Sahel sector.", source: "HUMINT-FIELD", severity: "CRITICAL", category: "INSTABILITY" },
        { msg: "CYBER-ATTACK: State-sponsored group targeting Ukraine's energy infrastructure.", source: "NSA-CISA", severity: "CRITICAL", category: "CYBER-WARFARE" },
        { msg: "REUTERS-GEOPOL: China announces new naval exercises in contested South China Sea waters.", source: "NEWSWIRE", severity: "HIGH", category: "GEOPOLITICAL" },
        { msg: "AP-SECURITY: North Korea test-fire detected. Ballistic trajectory confirmed.", source: "NEWSWIRE", severity: "CRITICAL", category: "MISSILE-TEST" },
    ], []);

    useEffect(() => {
        const initialCount = isOffline ? 15 : 8;
        const shuffledEvents = [...kineticEvents].sort(() => 0.5 - Math.random());
        setLogs(shuffledEvents.slice(0, initialCount).map(e => ({
            ...e, 
            time: isOffline ? "ARCHIVE" : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        })));

        if (isOffline) return;

        const interval = setInterval(() => {
            const randomEvent = kineticEvents[Math.floor(Math.random() * kineticEvents.length)];
            setLogs(prev => {
                const newLog = { ...randomEvent, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
                return [...prev, newLog].slice(-30);
            });
        }, 5000);

        return () => clearInterval(interval);
    }, [isOffline, kineticEvents]);

    useEffect(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
    }, [logs]);

    const getIcon = (cat: string) => {
        switch(cat) {
            case 'INVASION': return <Bomb size={14} />;
            case 'TERRORISM': return <Users size={14} />;
            case 'MARITIME': return <Anchor size={14} />;
            case 'CYBER-WARFARE': return <Terminal size={14} />;
            case 'MISSILE-TEST': return <Zap size={14} />;
            default: return <Radio size={14} />;
        }
    }

    return (
        <div className="bg-calibrex-dark/80 border border-calibrex-critical/20 rounded-xl flex flex-col h-full shadow-2xl overflow-hidden min-h-[400px]">
            <div className="p-3 bg-calibrex-critical/10 border-b border-calibrex-critical/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-calibrex-critical">
                    <Radio size={14} className="animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">War Room Stream</span>
                </div>
                <span title="Scenario feed for demonstration. Not live reporting." className="text-[8px] font-mono font-black text-calibrex-medium/80 border border-calibrex-medium/30 bg-calibrex-medium/10 px-1.5 py-0.5 rounded tracking-widest">SIMULATED</span>
            </div>
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {logs.map((log, i) => (
                    <div key={i} onClick={() => onInvestigate(log.msg)} className={`p-3 rounded border-l-2 bg-black/40 hover:bg-calibrex-critical/5 transition-all cursor-pointer group flex flex-col gap-1 ${log.severity === 'CRITICAL' ? 'border-l-calibrex-critical' : 'border-l-calibrex-teal'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                                {getIcon(log.category)}
                                <span className="text-[9px] font-mono text-white/40">[{log.source}]</span>
                            </div>
                            <span className="text-[8px] text-white/20">{log.time}</span>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed text-white/80 group-hover:text-calibrex-critical transition-colors">{log.msg}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const GeopoliticalDashboard: React.FC<GeopoliticalDashboardProps> = ({ 
  onGenerateReport, onShare, onInvestigate, onViewThreat, threats, isOffline 
}) => {
  const stats: Stat[] = [
    { label: '💥 Active Invasions', value: 4, severity: 'CRITICAL' },
    { label: '⚠️ Coup Watchlist', value: 7, severity: 'HIGH' },
    { label: '🚀 Tactical Deployment', value: 142, severity: 'MEDIUM' },
    { label: '⚓ Naval Blockades', value: 2, severity: 'HIGH' },
  ];

  const kineticThreats = useMemo(() => threats.filter(t => 
    t.severity === 'CRITICAL' || t.severity === 'HIGH' || t.id.includes('pak') || t.id.includes('rus')
  ), [threats]);

  return (
    <div className="p-4 sm:p-6 pb-24 w-full flex flex-col min-h-full space-y-6">
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
                <span className="text-[10px] text-calibrex-critical font-black uppercase tracking-widest bg-calibrex-critical/10 px-2 py-0.5 rounded border border-calibrex-critical/20">DEFCON 2 ACTIVE</span>
                <span className="text-[10px] text-white/30 font-mono uppercase">Global Kinetic Awareness Layer</span>
            </div>
          </div>
        </div>
        <button onClick={() => onGenerateReport("Global Crisis Briefing")} className="px-8 py-3 bg-calibrex-critical hover:bg-white text-white hover:text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95 shrink-0 relative z-10">Generate Crisis Brief</button>
      </div>

      {/* Stats Cluster */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {stats.map((stat, i) => (
          <div key={i} className="bg-calibrex-surface border border-white/5 rounded-xl p-5 border-l-4 border-l-calibrex-critical shadow-lg group hover:bg-white/5 transition-all">
            <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 group-hover:text-white/60 truncate">{stat.label}</div>
            <div className="text-3xl font-black text-calibrex-critical">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Main Grid: Fixes overlap by defining heights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 h-auto lg:h-[600px]">
        <div className="lg:col-span-8 bg-calibrex-surface border border-white/5 rounded-2xl p-1 shadow-2xl h-[400px] lg:h-full relative overflow-hidden">
          <ThreatMap threats={kineticThreats} onInvestigate={onInvestigate} />
        </div>
        <div className="lg:col-span-4 h-[450px] lg:h-full overflow-hidden">
          <WarRoomFeed onInvestigate={onInvestigate} isOffline={isOffline} />
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
