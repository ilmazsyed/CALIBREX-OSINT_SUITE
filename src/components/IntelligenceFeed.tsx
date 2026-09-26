
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Radio, Newspaper, Shield, Globe, Terminal, Users, TrendingUp, Activity, Filter, Globe2, Landmark } from 'lucide-react';

interface FeedMessage {
  id: string;
  source: string;
  message: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  wireGroup: 'SATP' | 'FATF' | 'REGIONAL' | 'GLOBAL_AXIS' | 'FINANCIAL';
  timestamp?: string;
}

interface IntelligenceFeedProps {
  onInvestigate: (query: string) => void;
  isOffline?: boolean;
}

const IntelligenceFeed: React.FC<IntelligenceFeedProps> = ({ onInvestigate, isOffline }) => {
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [displayedMessages, setDisplayedMessages] = useState<FeedMessage[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const allFeedMessages: FeedMessage[] = useMemo(() => [
    // SATP (South Asia Terrorism Portal)
    { id: 'satp-1', source: 'SATP', wireGroup: 'SATP', message: 'SATP: Intercepted mobilization orders in Hindu Kush sectors. High readiness advised.', category: 'TERRORISM', severity: 'CRITICAL' },
    { id: 'satp-2', source: 'SATP', wireGroup: 'SATP', message: 'Infiltration attempts reported near Keran sector; tactical surveillance active.', category: 'BORDER', severity: 'HIGH' },
    { id: 'satp-3', source: 'SATP', wireGroup: 'SATP', message: 'TRF/LeT communication bursts detected across LoC monitoring nodes.', category: 'SIGINT', severity: 'HIGH' },
    { id: 'satp-4', source: 'SATP', wireGroup: 'SATP', message: 'Naxalite corridor movement detected in Red Corridor sectors.', category: 'INTERNAL', severity: 'MEDIUM' },

    // FATF / FATP (Financial)
    { id: 'fatf-1', source: 'FATF', wireGroup: 'FATF', message: 'FATF Grey List Update: Multiple entities in MENA region under enhanced monitoring.', category: 'COMPLIANCE', severity: 'HIGH' },
    { id: 'fatf-2', source: 'FATF', wireGroup: 'FATF', message: 'Massive shell-corp cluster identified in Panama linked to arms trafficking.', category: 'FINANCIAL', severity: 'CRITICAL' },
    { id: 'fatp-1', source: 'FATP', wireGroup: 'FINANCIAL', message: 'Terror-funding trail identified via unauthorized crypto-wallets in Southeast Asia.', category: 'T-FINANCE', severity: 'CRITICAL' },
    { id: 'fatp-2', source: 'FATP', wireGroup: 'FINANCIAL', message: 'Large scale Hawala transaction detected originating from Gulf financial hubs.', category: 'MONEY-LAUNDERING', severity: 'HIGH' },

    // REGIONAL (Continent/Country)
    { id: 'reg-eu', source: 'EU-SEC', wireGroup: 'REGIONAL', message: 'European Energy Grid: Malware probing detected on critical gas pipelines.', category: 'INFRASTRUCTURE', severity: 'HIGH' },
    { id: 'reg-asia', source: 'ASEAN', wireGroup: 'REGIONAL', message: 'South China Sea: Non-standard naval maneuvers by PLAN destroyer groups.', category: 'MARITIME', severity: 'MEDIUM' },
    { id: 'reg-africa', source: 'AU-INTEL', wireGroup: 'REGIONAL', message: 'Sahel Region: Militia surge reported near mineral processing facilities.', category: 'SECURITY', severity: 'HIGH' },
    { id: 'reg-usa', source: 'DHS-WIRE', wireGroup: 'REGIONAL', message: 'Cyber-Sabotage: Probing attempts on US Eastern Interconnect energy nodes.', category: 'CYBER', severity: 'MEDIUM' },

    // GLOBAL POWER AXIS
    { id: 'axis-us', source: 'AXIS-US', wireGroup: 'GLOBAL_AXIS', message: 'Pentagon elevates readiness for Pacific Carrier Strike Group 5.', category: 'MILITARY', severity: 'HIGH' },
    { id: 'axis-chn', source: 'AXIS-CHN', wireGroup: 'GLOBAL_AXIS', message: 'Beijing announces strategic partnership with Central Asian energy blocks.', category: 'DIPLOMACY', severity: 'MEDIUM' },
    { id: 'axis-rus', source: 'AXIS-RUS', wireGroup: 'GLOBAL_AXIS', message: 'Arctic Naval Maneuvering: Northern Fleet initiating winter deployment cycle.', category: 'MILITARY', severity: 'MEDIUM' },
    { id: 'axis-brics', source: 'AXIS-BRICS', wireGroup: 'GLOBAL_AXIS', message: 'BRICS Financial Hub: New alternative payment rail pilot initiated.', category: 'ECONOMIC', severity: 'LOW' },
  ], []);

  useEffect(() => {
    // Initial load and filter change
    const initialPool = activeFilter === 'ALL' 
      ? allFeedMessages 
      : allFeedMessages.filter(m => m.wireGroup === activeFilter || (activeFilter === 'FATF' && m.wireGroup === 'FINANCIAL'));
    
    setDisplayedMessages(initialPool.slice(0, 10).map(msg => ({
      ...msg,
      timestamp: isOffline ? 'ARCHIVE' : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    })));

    if (isOffline) return;

    const interval = setInterval(() => {
      const pool = activeFilter === 'ALL' 
        ? allFeedMessages 
        : allFeedMessages.filter(m => m.wireGroup === activeFilter || (activeFilter === 'FATF' && m.wireGroup === 'FINANCIAL'));
      
      if (pool.length === 0) return;

      const randomMessage = pool[Math.floor(Math.random() * pool.length)];
      setDisplayedMessages(prev => {
        const newMessage = {
          ...randomMessage,
          id: `${randomMessage.id}-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        // Keep the list manageable and scrolling
        return [...prev, newMessage].slice(-25);
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [activeFilter, allFeedMessages, isOffline]);

  // Handle scroll to bottom without jumping the entire page
  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      scrollContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  }, [displayedMessages]);

  const getSeverityColor = (severity: FeedMessage['severity']) => {
    switch (severity) {
      case 'CRITICAL': return 'text-calibrex-critical border-calibrex-critical/30';
      case 'HIGH': return 'text-calibrex-high border-calibrex-high/30';
      case 'MEDIUM': return 'text-calibrex-medium border-calibrex-medium/30';
      case 'LOW': return 'text-calibrex-low border-calibrex-low/30';
      default: return 'text-white/50 border-white/10';
    }
  };

  const getIconForCategory = (category: string) => {
    switch(category) {
      case 'SECURITY': case 'BORDER': return <Shield size={14} />;
      case 'CYBER': case 'SIGINT': return <Terminal size={14} />;
      case 'FINANCIAL': case 'ECONOMIC': case 'T-FINANCE': return <TrendingUp size={14} />;
      case 'GEOPOLITICAL': case 'DIPLOMACY': return <Globe size={14} />;
      case 'TERRORISM': return <Users size={14} />;
      case 'INFRASTRUCTURE': return <Activity size={14} />;
      default: return <Newspaper size={14} />;
    }
  }

  const filters = [
    { id: 'ALL', label: 'All Wires', icon: <Radio size={12} /> },
    { id: 'SATP', label: 'SATP', icon: <Shield size={12} /> },
    { id: 'FATF', label: 'FATF/FATP', icon: <Landmark size={12} /> },
    { id: 'REGIONAL', label: 'Regional', icon: <Globe2 size={12} /> },
    { id: 'GLOBAL_AXIS', label: 'Power Axis', icon: <Globe size={12} /> },
  ];

  return (
    <div className="bg-calibrex-surface border border-white/5 rounded-xl shadow-2xl overflow-hidden flex flex-col h-full w-full">
      <div className="p-3 sm:p-4 bg-black/20 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] flex items-center gap-2">
                <Radio size={14} className="animate-pulse" /> Live Intelligence Wires
            </h3>
            <span title="Scenario feed for demonstration. Not live reporting." className="text-[8px] font-mono font-black text-calibrex-medium/80 border border-calibrex-medium/30 bg-calibrex-medium/10 px-1.5 py-0.5 rounded tracking-widest">SIMULATED</span>
            {isOffline && <span className="text-[8px] font-black text-calibrex-critical uppercase">Offline Archive</span>}
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            {filters.map(f => (
                <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all shrink-0 border ${
                        activeFilter === f.id 
                        ? 'bg-calibrex-teal text-calibrex-navy border-calibrex-teal' 
                        : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'
                    }`}
                >
                    {f.icon}
                    {f.label}
                </button>
            ))}
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar"
      >
        {displayedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-10 py-20">
            <Filter size={48} className="mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">No signals in this band</p>
          </div>
        ) : (
          displayedMessages.map((msg, i) => (
            <div 
              key={msg.id} 
              onClick={() => onInvestigate(`Investigate Intelligence Wire: ${msg.message}`)}
              className="p-3 bg-black/20 rounded-lg border border-white/5 cursor-pointer hover:border-calibrex-teal/50 transition-all flex flex-col gap-1 group animate-in slide-in-from-bottom-1"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-[8px] font-mono text-calibrex-teal uppercase tracking-tighter truncate">
                  {getIconForCategory(msg.category)} {msg.source} • {msg.wireGroup}
                </div>
                <span className="text-[8px] text-white/20 font-mono shrink-0">{msg.timestamp}</span>
              </div>
              <div className="text-[11px] font-bold text-white uppercase leading-tight group-hover:text-calibrex-gold transition-colors">{msg.message}</div>
              <div className="flex items-center justify-between mt-2">
                <div className={`text-[7px] font-black px-1.5 py-0.5 rounded-full border tracking-widest ${getSeverityColor(msg.severity)}`}>
                    {msg.category} / {msg.severity}
                </div>
                <span className="text-[7px] font-black text-white/20 uppercase group-hover:text-calibrex-teal transition-colors">Tactical Detail {'>'}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-2 bg-black/40 border-t border-white/5 text-center shrink-0">
        <p className="text-[8px] font-mono text-white/20 uppercase tracking-widest">Neural Link Sync: {isOffline ? 'OFFLINE_CACHE' : 'ACTIVE_BANDWIDTH_88%'}</p>
      </div>
    </div>
  );
};

export default IntelligenceFeed;
