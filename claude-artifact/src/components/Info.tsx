
import React from 'react';
import { Shield, Target, Cpu, User, Copyright, Award, BookOpen, Fingerprint } from 'lucide-react';

const InfoPage: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Hero Section */}
      <div className="bg-calibrex-surface border border-calibrex-surface-light rounded-xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-calibrex-teal/5 rounded-full -mr-24 sm:-mr-32 -mt-24 sm:-mt-32 blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 relative z-10 text-center md:text-left">
          <div className="p-3 sm:p-4 bg-calibrex-navy rounded-2xl border border-calibrex-gold/20 shadow-inner">
            <Shield size={40} sm:size={48} className="text-calibrex-gold" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-calibrex-gold uppercase tracking-[0.2em] mb-2">Platform Overview</h2>
            <p className="text-calibrex-muted text-xs sm:text-sm leading-relaxed max-w-2xl">
              Calibrex is engineered as the industry's premier Open-Source Intelligence (OSINT) suite. Built for the modern tactical environment, it transforms fragmented metadata into high-fidelity intelligence narratives.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Usage & Capabilities */}
        <div className="bg-calibrex-surface border border-calibrex-surface-light rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
            <Target size={20} className="text-calibrex-teal" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Core Capabilities</h3>
          </div>
          <ul className="space-y-3 text-xs text-calibrex-muted leading-relaxed">
            <li className="flex gap-2">
              <span className="text-calibrex-teal font-black">01</span>
              <span>Live monitoring of six open-source intelligence wires (Google News searches refreshed every 5 minutes) plus the USGS real-time earthquake feed.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-calibrex-teal font-black">02</span>
              <span>Claude clusters live reports into located threat vectors, drafts briefs and executive reports, and cites every source it used.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-calibrex-teal font-black">03</span>
              <span>Dedicated wires for South Asia terrorism (SATP-style coverage) and terror finance / FATF, AML and sanctions reporting.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-calibrex-teal font-black">04</span>
              <span>Live verification: claims are checked against fresh web search results, with a confidence score and the evidence links.</span>
            </li>
          </ul>
        </div>

        {/* Curation & Catering */}
        <div className="bg-calibrex-surface border border-calibrex-surface-light rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
            <User size={20} className="text-calibrex-gold" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Catering To</h3>
          </div>
          <p className="text-xs text-calibrex-muted mb-4 leading-relaxed">
            Calibrex is the choice of mavericks in the field. Our platform caters specifically to:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {['Intelligence Analysts', 'Defense Journalists', 'Security Professionals', 'Forensic Auditors', 'Private Investigators', 'Human Terrain Analysts'].map((group, i) => (
              <div key={i} className="bg-black/20 p-2 rounded border border-white/5 flex items-center gap-2">
                <div className="w-1 h-1 bg-calibrex-gold rounded-full"></div>
                <span className="text-[10px] font-bold text-white/80">{group}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tech Specification */}
      <div className="bg-calibrex-surface border border-calibrex-surface-light rounded-xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
          <Cpu size={20} className="text-calibrex-teal" />
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Technical Architecture</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-[10px] font-black text-calibrex-teal uppercase mb-2 tracking-tighter">Neural Engine</h4>
            <p className="text-[11px] text-calibrex-muted font-mono leading-tight">
              Analysis, research, briefs and audits run on Claude through each operator's own Claude account. Live data arrives through the Parallel Search connector (web search and page fetch).
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-black text-calibrex-teal uppercase mb-2 tracking-tighter">Data Integrity</h4>
            <p className="text-[11px] text-calibrex-muted font-mono leading-tight">
              The last live pull is cached on your device, so Offline mode keeps showing the latest archive without new requests. Reports and research logs are stored privately per operator.
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-black text-calibrex-teal uppercase mb-2 tracking-tighter">Visualization Layer</h4>
            <p className="text-[11px] text-calibrex-muted font-mono leading-tight">
              Leaflet map with an embedded world basemap, threat markers placed from reported locations, USGS quake markers and a thermal density overlay.
            </p>
          </div>
        </div>
      </div>

      {/* Founder Bio Section */}
      <div className="bg-gradient-to-br from-calibrex-navy to-calibrex-dark border border-calibrex-gold/30 rounded-xl p-6 sm:p-8 shadow-2xl relative">
        <div className="absolute top-4 right-4 text-calibrex-gold/10">
          <Award size={80} sm:size={120} />
        </div>
        <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start relative z-10 text-center md:text-left">
          <div className="shrink-0 w-full md:w-auto">
             <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-calibrex-gold/20 border-2 border-calibrex-gold flex items-center justify-center shadow-[0_0_20px_rgba(201,169,97,0.2)] mx-auto md:mx-0">
                <User size={40} sm:size={48} className="text-calibrex-gold" />
             </div>
             <div className="mt-4">
                <div className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em]">Founder</div>
                <div className="text-sm font-black text-white">Ilmaz Syed</div>
             </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <BookOpen size={16} className="text-calibrex-gold" />
              <h3 className="text-xs font-black text-calibrex-gold uppercase tracking-[0.2em]">The Maverick's Vision</h3>
            </div>
            <p className="text-xs text-calibrex-muted leading-relaxed italic border-l-2 border-calibrex-gold/30 pl-4">
              "Calibrex isn't just a dashboard; it's a testament to field-honed credibility. We've taken the chaos of raw data and forged it into a precision instrument for those who stand on the front lines of information warfare."
            </p>
            <p className="text-xs text-calibrex-text leading-relaxed">
              Certified in Open-Source Intelligence (OSINT) from the <strong>Basel Institute on Governance</strong>, Ilmaz Syed leverages his defense journalism background—covering operations, human terrain analysis, and border tensions—to pioneer Calibrex. He holds full rights, copyright, and patents over the innovative OSINT app and idea, stamping it with authentic field-honed credibility for security professionals and investigators. Ilmaz’s maverick approach transforms raw intel into actionable narratives.
            </p>
          </div>
        </div>
      </div>

      {/* Footer / Copyright */}
      <div className="flex flex-col items-center justify-center pt-6 sm:pt-8 border-t border-white/5 space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 opacity-40">
           <div className="flex items-center gap-2">
             <Fingerprint size={16} />
             <span className="text-[10px] font-black uppercase tracking-widest">AUTHENTIC OSINT</span>
           </div>
           <div className="flex items-center gap-2">
             <Shield size={16} />
             <span className="text-[10px] font-black uppercase tracking-widest">FIELD READY</span>
           </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.3em] flex items-center justify-center gap-2">
            <Copyright size={10} /> Copyright & Patent Ilmaz Syed 2025
          </p>
          <p className="text-[8px] text-calibrex-muted font-mono uppercase opacity-30">
            ALL RIGHTS RESERVED | SECURITY CLEARANCE LEVEL: V REQUIRED
          </p>
        </div>
      </div>
    </div>
  );
};

export default InfoPage;