
import React, { useState, useEffect, useMemo } from 'react';
import { Threat } from '../types';
import { ArrowLeft, Radio, Shield, Globe, Clock, Terminal, Newspaper, Share2, Printer, MapPin, Search } from 'lucide-react';

interface ThreatWireViewProps {
  threat: Threat;
  onBack: () => void;
  onGenerateReport: (title: string) => void;
  onInvestigate: (query: string) => void;
}

const ThreatWireView: React.FC<ThreatWireViewProps> = ({ threat, onBack, onGenerateReport, onInvestigate }) => {
  const [wireLogs, setWireLogs] = useState<{msg: string, time: string, source: string}[]>([]);

  const mockLogs = useMemo(() => {
    const safeTitle = (threat?.title || 'Target').toLowerCase();
    const safeLocation = threat?.location || 'the region';
    const safeCategory = threat?.category || 'local';
    
    return [
      { msg: `URGENT: Surveillance nodes in ${safeLocation} reporting significant escalation in ${safeCategory} vectors.`, source: 'CORE-INTEL' },
      { msg: `OSINT synthesis confirms unusual pattern of movement consistent with ${safeTitle} operational parameters.`, source: 'CALIBREX-AI' },
      { msg: `Agency intercept: Encrypted comms burst detected between known splinter cells and regional command centers.`, source: 'SIGINT-BETA' },
      { msg: `SATP Update: Conflict logs updated to include tactical shifts near high-value critical infrastructure.`, source: 'SATP' },
      { msg: `Field dispatch: Informant reports suggest a transition from reconnaissance to active probing phases.`, source: 'HUMINT' },
      { msg: `Global wire monitor: Breaking news outlets reporting increased tension in maritime and cyber sectors.`, source: 'REUTERS-OSINT' },
      { msg: `Technical Audit: Regional grid logs show multiple non-standard access requests from foreign-originating IPs.`, source: 'CYBER-SEC' },
    ];
  }, [threat]);

  useEffect(() => {
    // Generate initial logs with randomized timestamps
    const initial = mockLogs.map((log, i) => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - (i * 12));
        return { ...log, time: d.toLocaleTimeString() };
    });
    setWireLogs(initial);
  }, [mockLogs]);

  if (!threat) return null;

  return (
    <div className="p-4 sm:p-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-20 max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div className="flex flex-col xs:flex-row items-center justify-between mb-6 sm:mb-8 gap-3 xs:gap-0">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-calibrex-teal hover:text-white transition-colors group"
        >
          <div className="p-2 rounded-full bg-calibrex-teal/10 group-hover:bg-calibrex-teal/20">
            <ArrowLeft size={20} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Return to Dashboard</span>
        </button>
        <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 w-full xs:w-auto">
          <button 
            onClick={() => onInvestigate(`Deep investigation into vector: ${threat.title}`)}
            className="px-4 py-2 bg-calibrex-teal/20 border border-calibrex-teal/40 text-calibrex-teal text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-calibrex-teal/30 transition-all flex items-center justify-center gap-2"
          >
            <Search size={14} /> Start Research
          </button>
          <button 
            onClick={() => onGenerateReport(threat.title)}
            className="px-4 py-2 bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-white transition-all shadow-lg"
          >
            Draft Field Dispatch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Threat Context Header */}
        <div className="lg:col-span-3 bg-calibrex-surface border border-calibrex-gold/20 p-6 sm:p-8 rounded-2xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-calibrex-gold/5 rounded-full -mr-32 sm:-mr-48 -mt-32 sm:-mt-48 blur-3xl pointer-events-none"></div>
          <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative z-10">
            <div className={`p-4 sm:p-6 rounded-2xl border-2 flex items-center justify-center bg-black/40 ${
                threat.severity === 'CRITICAL' ? 'border-calibrex-critical text-calibrex-critical' : 'border-calibrex-gold text-calibrex-gold'
            }`}>
              <Shield size={40} sm:size={48} className={threat.severity === 'CRITICAL' ? 'animate-pulse' : ''} />
            </div>
            <div className="text-center md:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  threat.severity === 'CRITICAL' ? 'bg-calibrex-critical/20 text-calibrex-critical' : 'bg-calibrex-gold/20 text-calibrex-gold'
                }`}>
                  Priority: {threat.severity}
                </span>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin size={12} /> {threat.location || 'Global Sector'}
                </span>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <Globe size={12} /> {threat.category || 'Strategic'} Vector
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.1em] mb-2 sm:mb-3">{threat.title}</h1>
              <p className="text-calibrex-muted text-xs sm:text-sm leading-relaxed max-w-3xl italic">
                {threat.description || 'Continuous monitoring of metadata bursts and field intelligence confirms an evolving threat architecture within this tactical sector.'}
              </p>
            </div>
          </div>
        </div>

        {/* Live News Wire */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
            <div className="flex items-center gap-3">
              <Radio size={16} sm:size={20} className="text-calibrex-teal animate-pulse" />
              <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Live Intelligence Newswire</h2>
            </div>
            <div className="flex items-center gap-2"><span title="Scenario feed for demonstration. Not live reporting." className="text-[8px] font-mono font-black text-calibrex-medium/80 border border-calibrex-medium/30 bg-calibrex-medium/10 px-1.5 py-0.5 rounded tracking-widest">SIMULATED</span><span className="text-[9px] font-mono text-white/30 hidden sm:inline">SYNC: FIELD-DATA-V9.4</span></div>
          </div>

          <div className="space-y-4">
            {wireLogs.map((log, i) => (
              <div 
                key={i} 
                className="bg-calibrex-surface/50 border border-white/5 p-4 sm:p-5 rounded-xl hover:bg-calibrex-surface transition-all flex gap-4 sm:gap-5 group animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/40 flex items-center justify-center text-calibrex-teal group-hover:scale-110 transition-transform">
                    {log.source === 'SATP' ? <Shield size={16} sm:size={18} /> : 
                     log.source === 'HUMINT' ? <Globe size={16} sm:size={18} /> :
                     log.source.includes('CYBER') ? <Terminal size={16} sm:size={18} /> :
                     <Newspaper size={16} sm:size={18} />}
                  </div>
                  <div className="h-full w-px bg-white/5 my-2"></div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-calibrex-gold uppercase tracking-widest">[{log.source}]</span>
                    <span className="text-[10px] font-mono text-white/20 flex items-center gap-1.5"><Clock size={10} /> {log.time}</span>
                  </div>
                  <p className="text-sm text-calibrex-text/90 leading-relaxed font-medium">
                    {log.msg}
                  </p>
                  <div className="mt-3 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onInvestigate(`Deep trace for event: ${log.msg}`)}
                      className="text-[8px] font-black uppercase text-calibrex-teal hover:underline flex items-center gap-1"
                    >
                      <Terminal size={10} /> Detail Trace
                    </button>
                    <button className="text-[8px] font-black uppercase text-calibrex-teal hover:underline flex items-center gap-1">
                      <Share2 size={10} /> Distribute
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tactical Parameters Sidebar */}
        <div className="space-y-6">
          <div className="bg-calibrex-surface border border-calibrex-surface-light p-6 rounded-2xl shadow-xl">
            <h3 className="text-xs font-black text-calibrex-gold uppercase tracking-[0.2em] mb-4 sm:mb-6 border-b border-white/5 pb-3">Operational Metadata</h3>
            <div className="space-y-4 sm:space-y-5">
              {threat.details?.map((detail, idx) => (
                <div key={idx} className="group">
                  <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 group-hover:text-calibrex-teal transition-colors">{detail.label}</div>
                  <div className="text-xs sm:text-sm font-black text-calibrex-text group-hover:translate-x-1 transition-transform">{detail.value}</div>
                </div>
              ))}
              <div>
                  <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Vector Integrity</div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2">
                    <div 
                      className={`h-full transition-all duration-1000 ${threat.severity === 'CRITICAL' ? 'bg-calibrex-critical shadow-[0_0_10px_#ff4444]' : 'bg-calibrex-gold'}`} 
                      style={{ width: threat.severity === 'CRITICAL' ? '92%' : '74%' }}
                    />
                  </div>
              </div>
            </div>
          </div>

          <div className="bg-calibrex-critical/10 border border-calibrex-critical/30 p-6 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Shield size={16} className="text-calibrex-critical" />
              <h3 className="text-xs font-black text-calibrex-critical uppercase tracking-[0.2em]">Risk Mitigation SOP</h3>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed font-medium mb-3 sm:mb-4">
              Deployment of countermeasures recommended for identified {threat.category || 'local'} vulnerabilities. Continuous SAT-SYNC required for real-time thermal monitoring.
            </p>
            <button 
              onClick={() => onInvestigate(`Crisis mitigation brief for vector: ${threat.title}`)}
              className="w-full py-3 bg-calibrex-critical/20 hover:bg-calibrex-critical/30 border border-calibrex-critical/40 text-calibrex-critical text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
            >
              Initiate Counter-Ops Brief
            </button>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-white/5 flex flex-col items-center gap-2 opacity-30 text-center">
        <div className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.5em]">Calibrex OSINT Studio</div>
        <p className="text-[8px] font-mono">Special Investigative dispatch synthesized for secure terminal access. © Ilmaz Syed 2025.</p>
      </div>
    </div>
  );
};

export default ThreatWireView;