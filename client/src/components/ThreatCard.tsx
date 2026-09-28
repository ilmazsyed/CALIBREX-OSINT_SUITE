import React, { useState } from 'react';
import { Threat } from '../types';
import { Activity, ExternalLink, FileText, ChevronDown, ChevronUp, Search, Images, FolderPlus } from 'lucide-react';
import { openVisuals } from '../lib/visuals';
import { addToCase } from '../lib/workbench';

interface ThreatCardProps {
  threat: Threat;
  onGenerateReport: (threatName: string) => void;
  onShare: (threatName: string) => void;
  onInvestigate: (query: string) => void;
  onWatch?: (threat: Threat) => void;
}

const ThreatCard: React.FC<ThreatCardProps> = ({ threat, onGenerateReport, onShare, onInvestigate, onWatch }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getBorderColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'border-l-calibrex-critical';
      case 'HIGH': return 'border-l-calibrex-high';
      case 'MEDIUM': return 'border-l-calibrex-medium';
      case 'LOW': return 'border-l-calibrex-low';
      default: return 'border-l-gray-500';
    }
  };

  const getBadgeColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500/20 text-calibrex-critical';
      case 'HIGH': return 'bg-orange-500/20 text-calibrex-high';
      case 'MEDIUM': return 'bg-yellow-500/20 text-calibrex-medium';
      case 'LOW': return 'bg-green-500/20 text-calibrex-low';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getIndicatorColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-calibrex-critical shadow-[0_0_8px_#ff4444]';
      case 'HIGH': return 'bg-calibrex-high shadow-[0_0_8px_#ff9900]';
      case 'MEDIUM': return 'bg-calibrex-medium shadow-[0_0_8px_#ffcc00]';
      case 'LOW': return 'bg-calibrex-low shadow-[0_0_8px_#44cc44]';
      default: return 'bg-gray-500';
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If user clicked a button specifically, don't trigger the general card action
    if ((e.target as HTMLElement).closest('button')) return;
    if (onWatch) onWatch(threat);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const visibleDetails = threat.details.slice(0, 3);
  const hiddenDetails = threat.details.slice(3);

  return (
    <div 
      onClick={handleCardClick}
      className={`bg-calibrex-surface backdrop-blur-md border border-white/5 rounded-xl p-3 sm:p-4 border-l-4 ${getBorderColor(threat.severity)} shadow-lg hover:shadow-2xl hover:bg-white/5 transition-all flex flex-col h-full group cursor-pointer relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Activity size={14} className="text-calibrex-teal animate-pulse" />
      </div>

      <div className="flex justify-between items-start mb-2 sm:mb-3">
        <div className="flex items-start gap-2 pr-2 min-w-0">
          <div className={`w-1 h-4 sm:h-5 shrink-0 rounded-full mt-0.5 transition-all duration-300 group-hover:scale-y-110 ${getIndicatorColor(threat.severity)}`}></div>
          <h3 className="font-bold text-[13px] sm:text-sm text-calibrex-text line-clamp-2 uppercase tracking-tight group-hover:text-calibrex-gold transition-colors">{threat.title}</h3>
        </div>
        <span className={`text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded uppercase tracking-wider shrink-0 ${getBadgeColor(threat.severity)}`}>
          {threat.severity}
        </span>
      </div>
      
      {/* Primary Details (Always Visible) */}
      <div className="space-y-1 sm:space-y-2 mb-1">
        {visibleDetails.map((detail, idx) => (
          <div key={idx} className="flex justify-between text-[10px] sm:text-xs">
            <span className="text-calibrex-muted font-medium truncate max-w-[50%]">{detail.label}:</span>
            <span className="text-calibrex-teal font-semibold text-right truncate pl-2">{detail.value}</span>
          </div>
        ))}
      </div>

      {/* Expandable Section */}
      <div 
        className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0'}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-1 sm:space-y-2 mb-3">
            {hiddenDetails.map((detail, idx) => (
              <div key={idx} className="flex justify-between text-[10px] sm:text-xs">
                <span className="text-calibrex-muted font-medium truncate max-w-[50%]">{detail.label}:</span>
                <span className="text-calibrex-teal font-semibold text-right truncate pl-2">{detail.value}</span>
              </div>
            ))}
          </div>

          {threat.description && (
            <div className="border-t border-white/5 pt-2 mt-2">
              <p className="text-[10px] sm:text-xs text-calibrex-muted leading-relaxed italic opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                {threat.description}
              </p>
            </div>
          )}
          {threat.sources && threat.sources.length > 0 && (
            <div className="border-t border-white/5 pt-2 mt-2 space-y-1.5">
              <div className="text-[9px] font-black text-white/40 uppercase tracking-widest">Sources ({threat.sources.length})</div>
              {threat.sources.slice(0, 5).map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-start gap-1.5 text-[10px] text-calibrex-teal hover:underline leading-snug">
                  <ExternalLink size={10} className="shrink-0 mt-0.5" />
                  <span><span className="font-bold">{s.source}</span>: {s.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Collapsed Preview (Visible only when not expanded and has extra content) */}
      {!isExpanded && threat.description && (
        <p className="text-[10px] sm:text-xs text-calibrex-muted mb-3 line-clamp-2 italic opacity-50 mt-2 border-t border-white/5 pt-2">
          {threat.description}
        </p>
      )}

      <button 
        onClick={toggleExpand}
        className={`text-[9px] sm:text-[10px] text-calibrex-teal hover:text-white font-bold uppercase tracking-widest flex items-center gap-1 mb-4 transition-all w-fit px-1 rounded hover:bg-calibrex-teal/10 ${isExpanded ? 'mt-2' : ''}`}
      >
        {isExpanded ? (
          <><ChevronUp size={14} className="animate-bounce" /> Less Details</>
        ) : (
          <><ChevronDown size={14} /> More Details</>
        )}
      </button>

      <div className="flex flex-col gap-2 pt-2 border-t border-white/5 mt-auto">
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            onInvestigate(`Perform deep analysis on ${threat.title} in ${threat.location || 'this sector'}`); 
          }}
          className="w-full bg-calibrex-gold hover:bg-white text-calibrex-navy text-[10px] font-black py-2.5 rounded uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
        >
          <Search size={14} /> Investigate
        </button>
        <div className="flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onGenerateReport(threat.title); }}
              className="flex-1 bg-calibrex-teal/80 hover:bg-calibrex-teal text-calibrex-navy text-[9px] sm:text-[10px] font-black py-2 rounded uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
            >
              <FileText size={12} /> Brief
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShare(threat.title); }}
              className="flex-1 bg-transparent border border-calibrex-teal/30 text-calibrex-teal hover:bg-calibrex-teal/10 text-[9px] sm:text-[10px] font-black py-2 rounded uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={12} /> Share
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); addToCase({ id: threat.id, title: threat.title, url: threat.sources?.[0]?.url || '', source: threat.sources?.[0]?.source || 'Threat cluster', wire: threat.category, severity: threat.severity, published: threat.assessedAt, place: threat.location || null }); }}
              className="bg-transparent border border-calibrex-gold/30 text-calibrex-gold hover:bg-calibrex-gold/10 text-[9px] sm:text-[10px] font-black py-2 px-2.5 rounded uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
              title="Add to a case"
            >
              <FolderPlus size={12} />
            </button>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); openVisuals({ title: threat.title, urls: (threat.sources || []).map(s => s.url).slice(0, 8), lat: threat.coordinates?.[0], lng: threat.coordinates?.[1], place: threat.location, severity: threat.severity }); }}
          className="w-full border border-calibrex-gold/40 text-calibrex-gold hover:bg-calibrex-gold/10 text-[9px] sm:text-[10px] font-black py-2 rounded uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
          title="Photos, video and satellite imagery for this threat"
        >
          <Images size={12} /> Visual intel
        </button>
      </div>
    </div>
  );
};

export default ThreatCard;