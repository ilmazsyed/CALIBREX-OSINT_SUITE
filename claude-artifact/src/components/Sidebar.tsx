

import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, Search, FileText, Wrench, ClipboardList, Siren, Settings, Wifi, WifiOff, Info, Swords, Radio, User, Users, Shield, LogOut, Fingerprint, X } from 'lucide-react';
import CalibrexLogo from './CalibrexLogo'; // Updated import path

interface SidebarProps {
  currentView: ViewState | 'dev-registry';
  onNavigate: (view: ViewState | 'dev-registry') => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  currentUser: any;
  onLogout: () => void;
  onClose?: () => void;
  onlineCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOffline, onToggleOffline, currentUser, onLogout, onClose, onlineCount = 0 }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'geopolitical', label: 'Crisis Monitor', icon: <Swords size={18} /> },
    { id: 'research', label: 'Intelligence Research', icon: <Search size={18} /> },
    { id: 'report-gen', label: 'Report Generator', icon: <FileText size={18} /> },
    { id: 'dispatch-studio', label: 'Dispatch Studio', icon: <Radio size={18} /> },
    { id: 'tools', label: 'OSINT Tools', icon: <Wrench size={18} /> },
    { id: 'history', label: 'Report History', icon: <ClipboardList size={18} /> },
    { id: 'alerts', label: 'Active Alerts', icon: <Siren size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
    { id: 'info', label: 'Platform Info', icon: <Info size={18} /> },
  ] as const;

  return (
    <div className="w-64 bg-calibrex-navy/70 backdrop-blur-xl border-r border-white/5 flex flex-col h-full overflow-y-auto shrink-0 shadow-2xl relative z-50">
      {/* Brand Logo Section */}
      <div className="p-6 border-b border-white/5 flex flex-col gap-3 relative">
        {onClose && <button onClick={onClose} aria-label="Close menu" className="absolute top-4 right-3 text-white lg:hidden p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>}
        <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex-shrink-0">
                <CalibrexLogo size={40} isOffline={isOffline} /> {/* Using the shared component */}
            </div>
            <div>
                <h1 className="text-2xl font-black text-white tracking-wide leading-none">CALIBREX</h1>
                <p className="text-[10px] text-calibrex-teal font-bold tracking-[0.2em] mt-1">OSINT STUDIO</p>
            </div>
        </div>
      </div>

      <div className="flex-1 py-4 overflow-y-auto custom-scrollbar">
        <div className="px-4 mb-2 text-[10px] font-black text-calibrex-muted opacity-40 uppercase tracking-[0.2em]">
            Intelligence Nodes
        </div>
        {navItems.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(item.id); } }}
            onClick={() => onNavigate(item.id)}
            className={`
              px-4 py-2.5 cursor-pointer border-l-[3px] transition-all duration-200 flex items-center gap-3 text-[13px] font-bold mb-0.5
              ${currentView === item.id 
                ? 'bg-calibrex-teal/10 border-calibrex-teal text-calibrex-teal' 
                : 'border-transparent text-calibrex-muted hover:bg-white/5 hover:text-white'}
            `}
          >
            <div className={`${item.id === 'geopolitical' && currentView !== 'geopolitical' ? 'text-calibrex-critical animate-pulse' : ''}`}>
              {item.icon}
            </div>
            <span>{item.label}</span>
          </div>
        ))}

        {/* Account & Admin Section */}
        <div className="mt-8">
            <div className="px-4 mb-3 text-[10px] font-black text-calibrex-muted opacity-40 uppercase tracking-[0.2em]">
                Identity & Access
            </div>
            
            {/* User Identity Card */}
            <div className="px-4 mb-4">
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 group hover:border-calibrex-teal/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        {currentUser?.avatarUrl
                            ? <img src={currentUser.avatarUrl} alt="" className="w-10 h-10 rounded-xl border border-calibrex-teal/20 shrink-0" />
                            : <div className="w-10 h-10 rounded-xl bg-calibrex-teal/10 border border-calibrex-teal/20 flex items-center justify-center text-calibrex-teal shrink-0">
                                <Fingerprint size={20} />
                              </div>}
                        <div className="min-w-0">
                            <div className="text-[11px] font-black text-white uppercase truncate">{currentUser?.name || 'Unknown Operator'}</div>
                            <div className="text-[9px] font-mono text-calibrex-teal/60 truncate uppercase">{currentUser?.org || 'Independent'}</div>
                        </div>
                    </div>
                    
                    <div className="space-y-1 text-[9px] font-mono text-white/30 uppercase tracking-tighter mb-4">
                        <div className="flex justify-between">
                            <span>Clearance</span>
                            <span className="text-calibrex-gold font-black">{currentUser?.isMaster ? 'Level V' : 'Level I'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Status</span>
                            <span className="text-calibrex-low">Active</span>
                        </div>
                    </div>

                    <button 
                        onClick={onLogout}
                        className="w-full py-2 bg-calibrex-critical/10 border border-calibrex-critical/20 text-calibrex-critical text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-calibrex-critical/20 transition-all flex items-center justify-center gap-2"
                    >
                        <LogOut size={12} /> Terminate
                    </button>
                </div>
            </div>

            {/* Developer Registry Tab (Conditional) */}
            {currentUser?.isMaster && (
                <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('dev-registry'); } }}
                    onClick={() => onNavigate('dev-registry')}
                    className={`
                    px-4 py-2.5 cursor-pointer border-l-[3px] transition-all duration-200 flex items-center gap-3 text-[13px] font-bold mb-0.5
                    ${currentView === 'dev-registry' 
                        ? 'bg-calibrex-gold/10 border-calibrex-gold text-calibrex-gold' 
                        : 'border-transparent text-calibrex-gold/60 hover:bg-calibrex-gold/5 hover:text-calibrex-gold'}
                    `}
                >
                    <Users size={18} />
                    <span className="flex-1">User Management</span>
                    {onlineCount > 0 && <span className="text-[9px] font-black bg-calibrex-low/15 text-calibrex-low border border-calibrex-low/30 px-1.5 py-0.5 rounded-full">{onlineCount} LIVE</span>}
                </div>
            )}
        </div>
      </div>
      
      {/* Footer Info / Status Toggle */}
      <div className="p-4 border-t border-white/5 bg-black/20 mt-auto">
        <button 
          onClick={onToggleOffline}
          className={`w-full flex items-center justify-between p-2 rounded border transition-all duration-300 group ${
            isOffline 
            ? 'bg-calibrex-critical/10 border-calibrex-critical/30 hover:bg-calibrex-critical/20' 
            : 'bg-calibrex-low/10 border-calibrex-low/30 hover:bg-calibrex-low/20'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-calibrex-critical' : 'bg-calibrex-low animate-pulse'}`}></div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${isOffline ? 'text-calibrex-critical' : 'text-calibrex-low'}`}>
              {isOffline ? 'Offline' : 'Online'}
            </span>
          </div>
          {isOffline ? <WifiOff size={14} className="text-calibrex-critical" /> : <Wifi size={14} className="text-calibrex-low" />}
        </button>
        <div className="text-[9px] text-center font-mono text-white/10 uppercase tracking-[0.2em] mt-3">
            Ilmaz Syed 2025
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
