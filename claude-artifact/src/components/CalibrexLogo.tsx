
import React from 'react';

interface CalibrexLogoProps {
  size?: number;
  className?: string;
  isOffline?: boolean; // Added for potential future dynamic styling
}

const CalibrexLogo: React.FC<CalibrexLogoProps> = ({ size = 64, className = "", isOffline = false }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_15px_rgba(42,138,154,0.5)]">
      <path d="M16 28 L24 38 L32 24 L40 38 L48 28" stroke="#c9a961" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="28" r="1.5" fill="#c9a961" />
      <circle cx="32" cy="24" r="1.5" fill="#c9a961" />
      <circle cx="48" cy="28" r="1.5" fill="#c9a961" />
      <path d="M48 48 A 22 22 0 1 1 48 16" stroke={isOffline ? "#ff4444" : "#2a8a9a"} strokeWidth="5" strokeLinecap="round" className="animate-[dash_2s_ease-in-out_infinite]" />
      <circle cx="48" cy="16" r="2.5" fill="white" />
      <circle cx="48" cy="48" r="2.5" fill="white" />
    </svg>
    <style>{`
      @keyframes dash {
        0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
        50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
        100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
      }
    `}</style>
  </div>
);

export default CalibrexLogo;
