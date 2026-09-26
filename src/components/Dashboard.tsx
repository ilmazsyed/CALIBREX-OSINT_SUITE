
import React, { useState, useEffect, useMemo } from 'react';
import ThreatCard from './ThreatCard';
import ThreatMap from './ThreatMap';
import IntelligenceFeed from './IntelligenceFeed';
import { Threat, Stat } from '../types';
import { Activity, Globe, Zap, Shield, Target, Radio, Search, Info, TrendingUp, WifiOff } from 'lucide-react';

interface DashboardProps {
  onGenerateReport: (title: string) => void;
  onShare: (message: string) => void;
  onInvestigate: (query: string) => void;
  onViewThreat: (threat: Threat) => void;
  threats: Threat[];
  isOffline?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onGenerateReport, onShare, onInvestigate, onViewThreat, threats, isOffline }) => {
  const stats: Stat[] = [
    { label: '🔴 Critical Alerts', value: 21, severity: 'CRITICAL' },
    { label: '📡 Active Wires', value: 894, severity: 'MEDIUM' },
    { label: '⚖️ Financial Flags', value: 112, severity: 'HIGH' },
    { label: '🌍 Strategic Axis', value: 15, severity: 'LOW' }, 
  ];

  return (
    <div className="p-3 sm:p-6 pb-12 overflow-x-hidden w-full">
      {/* Responsive Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((stat, idx) => (
          <div key={idx} className={`bg-calibrex-surface border border-white/5 rounded-xl p-3 sm:p-5 border-l-4 shadow-lg min-w-0 ${
              stat.severity === 'CRITICAL' ? 'border-l-calibrex-critical' : 
              stat.severity === 'HIGH' ? 'border-l-calibrex-high' : 'border-l-calibrex-teal'
          }`}>
            <div className="text-calibrex-muted text-[8px] sm:text-[10px] uppercase font-black opacity-60 mb-1 truncate">{stat.label}</div>
            <div className={`text-xl sm:text-3xl font-black truncate ${stat.severity === 'CRITICAL' ? 'text-calibrex-critical' : 'text-calibrex-teal'}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 lg:min-h-[600px] lg:h-[70vh]">
        <div className="lg:col-span-8 bg-calibrex-surface border border-white/5 rounded-xl shadow-2xl overflow-hidden relative min-h-[400px] lg:h-full">
          <ThreatMap threats={threats} onInvestigate={onInvestigate} />
          {isOffline && (
            <div className="absolute top-4 right-4 z-[40] bg-calibrex-critical/20 border border-calibrex-critical/40 px-3 py-1.5 rounded backdrop-blur-sm flex items-center gap-2">
              <WifiOff size={14} className="text-calibrex-critical" />
              <span className="text-[10px] font-black text-calibrex-critical uppercase">Offline Archive</span>
            </div>
          )}
        </div>
        <div className="lg:col-span-4 min-h-[450px] lg:h-full overflow-hidden">
            <IntelligenceFeed onInvestigate={onInvestigate} isOffline={isOffline} />
        </div>
      </div>

      {/* Threat Cards Grid */}
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
    </div>
  );
};

export default Dashboard;
