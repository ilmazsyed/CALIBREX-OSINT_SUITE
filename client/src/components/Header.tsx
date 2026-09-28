
import React, { useEffect, useState } from 'react';
import { Menu, ShieldCheck, HelpCircle } from 'lucide-react';
import CalibrexLogo from './CalibrexLogo';
import { openGuide } from './GuidePopup';

interface HeaderProps {
  onToggleSidebar?: () => void;
  threatLevel?: number;
  alertCount?: number;
  onOpenAlerts?: () => void;
  bell?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, threatLevel = 1, alertCount = 0, onOpenAlerts, bell }) => {
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateDate = () => {
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      };
      setCurrentDate(new Date().toLocaleDateString('en-US', options));
    };

    updateDate();
    const timer = setInterval(updateDate, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="cx-glass-header p-3 px-4 sm:px-6 flex justify-between items-center border-b border-white/5 shadow-lg z-50">
      <div className="flex items-center gap-3 sm:gap-4 flex-1">
        {/* Hamburger Menu for Mobile */}
        <button 
          onClick={onToggleSidebar}
          className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors text-calibrex-teal"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        <div className="shrink-0 flex items-center gap-4">
           {/* Mobile Branding - Visible on Tablet and Mobile */}
           <div className="lg:hidden flex items-center gap-3">
                <CalibrexLogo size={32} /> {/* Using the shared component */}
                <div className="hidden min-[420px]:flex flex-col">
                    <span className="text-base font-black text-white leading-none tracking-tight">CALIBREX</span>
                    <span className="text-[8px] text-calibrex-teal font-black tracking-widest uppercase">OSINT STUDIO</span>
                </div>
           </div>
           
           {/* Desktop Branding */}
           <div className="hidden lg:block">
               <div className="text-[10px] sm:text-xs font-black text-calibrex-teal tracking-widest uppercase">
                   Mission Control
               </div>
               <div className="text-sm sm:text-lg font-black text-calibrex-text leading-none mt-0.5 tracking-tight">
                   INTELLIGENCE HUB
               </div>
           </div>
           
           <div className="h-8 w-px bg-white/10 mx-2 hidden lg:block"></div>
           
           <div className="hidden lg:block">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-calibrex-teal opacity-50" />
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Live OSINT uplink</span>
              </div>
           </div>
        </div>
      </div>
      
      <div className="flex gap-2 sm:gap-4 text-xs items-center ml-2">
        <div className="hidden xl:block text-calibrex-muted text-[10px] font-mono opacity-60 uppercase tracking-tighter mr-2">{currentDate}</div>
        
        <button onClick={() => openGuide('guide')} title="Guide & platform overview" aria-label="Open guide" className="p-1.5 rounded-lg text-calibrex-muted hover:text-calibrex-teal hover:bg-white/5 transition-colors shrink-0">
          <HelpCircle size={18} />
        </button>
        {bell}
        <button onClick={onOpenAlerts} title={`${alertCount} active alert${alertCount === 1 ? '' : 's'} · level computed from live critical threat vectors`} className="flex items-center gap-2 bg-calibrex-critical/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-calibrex-critical/30 shrink-0 shadow-inner backdrop-blur-sm hover:bg-calibrex-critical/20 transition-colors">
          <span className="w-1.5 h-1.5 rounded-full bg-calibrex-critical animate-pulse shadow-[0_0_8px_#ff4444]"></span>
          <span className="text-calibrex-critical font-black uppercase tracking-tighter text-[9px] sm:text-[10px]"><span className="hidden sm:inline">THREAT: </span>LVL {threatLevel}</span>
          {alertCount > 0 && <span className="text-[9px] font-black bg-calibrex-critical text-white rounded-full px-1.5 tabular-nums">{alertCount}</span>}
        </button>
      </div>
    </div>
  );
};

export default Header;