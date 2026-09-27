
import React, { useEffect } from 'react';
import CalibrexLogo from './CalibrexLogo';
import { Loader2 } from 'lucide-react';

interface LaunchPageProps {
  onFinish: () => void;
}

const LaunchPage: React.FC<LaunchPageProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 3000); // Display splash screen for 3 seconds
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 bg-[#050a0f] flex flex-col items-center justify-center z-[1000] animate-in fade-in duration-700">
      <CalibrexLogo size={120} className="mb-8" />
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-[0.5em] uppercase mb-2 animate-pulse">CALIBREX</h1>
        <p className="text-[10px] text-calibrex-teal font-black tracking-[0.3em] uppercase">OSINT Studio Terminal</p>
      </div>
      <div className="max-w-xs w-full mt-8 flex items-center justify-center gap-3">
        <Loader2 className="animate-spin text-calibrex-teal" size={16} />
        <span className="text-[9px] font-mono text-calibrex-teal/40 uppercase">LOADING INTERFACE...</span>
      </div>
    </div>
  );
};

export default LaunchPage;