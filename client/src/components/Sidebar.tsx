

import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, Search, FileText, Wrench, Siren, Settings, Wifi, WifiOff, Users, LogOut, Fingerprint, X, Eye, BarChart3, Images, UserSearch, LineChart, RadioTower, FolderOpen, MessagesSquare, Briefcase, Building2, Vote, Archive } from 'lucide-react';
import CalibrexLogo from './CalibrexLogo'; // Updated import path
import LensRail from './LensRail';
import { LiveIntel } from '../lib/live';

interface SidebarProps {
  currentView: ViewState | 'dev-registry';
  onNavigate: (view: ViewState | 'dev-registry') => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  currentUser: any;
  onLogout: () => void;
  onClose?: () => void;
  pendingCount?: number;
  watchUnread?: number;
  live?: LiveIntel;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOffline, onToggleOffline, currentUser, onLogout, onClose, pendingCount = 0, watchUnread = 0, live }) => {
  const navItems = [
    { id: 'dashboard', label: 'Security Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'visual-intel', label: 'Visual Intel', icon: <Images size={18} /> },
    { id: 'research', label: 'Intelligence Research', icon: <Search size={18} /> },
    { id: 'workbench', label: 'Workbench', icon: <FolderOpen size={18} /> },
    { id: 'watchlists', label: 'Watchlists', icon: <Eye size={18} /> },
    { id: 'trends', label: 'Trends', icon: <BarChart3 size={18} /> },
    { id: 'chatter', label: 'Chatter Tracker', icon: <MessagesSquare size={18} /> },
    { id: 'markets', label: 'Markets & Reserves', icon: <LineChart size={18} /> },
    { id: 'business', label: 'Business Watch', icon: <Briefcase size={18} /> },
    { id: 'government', label: 'Government', icon: <Building2 size={18} /> },
    { id: 'politics', label: 'Elections & Politics', icon: <Vote size={18} /> },
    { id: 'signals', label: 'Signals', icon: <RadioTower size={18} /> },
    { id: 'briefs', label: 'Briefs', icon: <Archive size={18} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={18} /> },
    { id: 'tools', label: 'OSINT Tools', icon: <Wrench size={18} /> },
    { id: 'subject-lookup', label: 'Subject Lookup', icon: <UserSearch size={18} /> },
    { id: 'alerts', label: 'Active Alerts', icon: <Siren size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ] as const;

  return (
    <div className="w-64 cx-glass border-r border-white/10 flex flex-col h-full overflow-y-auto shrink-0 shadow-2xl relative z-50">
      {/* Brand Logo Section */}
      <div className="p-6 border-b border-white/5 flex flex-col gap-3 relative" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
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
        {/* Mobile-only discovery rail — the richer lenses at the top of the "More" drawer. */}
        {live && (
          <div className="lg:hidden px-4 mb-4">
            <div className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] mb-2">Intelligence lenses</div>
            <LensRail live={live} variant="stack" onOpen={(v) => { onNavigate(v as ViewState); onClose?.(); }} />
          </div>
        )}
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
            <div>
              {item.icon}
            </div>
            <span className="flex-1">{item.label}</span>
            {item.id === 'watchlists' && watchUnread > 0 && <span className="text-[9px] font-black bg-calibrex-teal text-calibrex-navy px-1.5 py-0.5 rounded-full tabular-nums">{watchUnread}</span>}
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
                        <div className="w-10 h-10 rounded-xl bg-calibrex-teal/10 border border-calibrex-teal/20 flex items-center justify-center text-calibrex-teal shrink-0">
                            <Fingerprint size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[11px] font-black text-white uppercase truncate">{currentUser?.name || 'Unknown Operator'}</div>
                            <div className="text-[9px] font-mono text-calibrex-teal/60 truncate uppercase">{currentUser?.org || 'Independent'}</div>
                        </div>
                    </div>
                    
                    <div className="space-y-1 text-[9px] font-mono text-white/30 uppercase tracking-tighter mb-4">
                        <div className="flex justify-between">
                            <span>Clearance</span>
                            <span className="text-calibrex-gold font-black">{currentUser?.role === 'admin' ? 'Level V' : 'Level I'}</span>
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
            {currentUser?.role === 'admin' && (
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
                    {pendingCount > 0 && <span className="text-[9px] font-black bg-calibrex-gold/15 text-calibrex-gold border border-calibrex-gold/30 px-1.5 py-0.5 rounded-full">{pendingCount} NEW</span>}
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
