import React, { useState, useEffect } from 'react';
import { Threat } from '../types';
import { ArrowLeft, Radio, Shield, Globe, Clock, Terminal, Newspaper, MapPin, Search, ExternalLink, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { searchNews, SearchHit, timeAgo } from '../lib/live';

interface ThreatWireViewProps {
  threat: Threat;
  onBack: () => void;
  onGenerateReport: (title: string) => void;
  onInvestigate: (query: string) => void;
  isOffline?: boolean;
}

interface WireEntry { title: string; url: string; source: string; time: string; excerpt?: string; kind: 'wire' | 'search' }

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };

// Search results per threat, kept for this visit.
const searchCache = new Map<string, { hits: SearchHit[]; at: number }>();

const ThreatWireView: React.FC<ThreatWireViewProps> = ({ threat, onBack, onGenerateReport, onInvestigate, isOffline }) => {
  const [hits, setHits] = useState<SearchHit[]>(searchCache.get(threat.id)?.hits || []);
  const [searchedAt, setSearchedAt] = useState<number | null>(searchCache.get(threat.id)?.at || null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const runSearch = async () => {
    if (isOffline || searching) return;
    setSearching(true);
    setSearchError(null);
    try {
      const place = threat.location && threat.location !== 'Unknown' ? threat.location : '';
      const base = threat.title.replace(/^[^:]{2,30}:\s*/, '');
      const words = base.split(/\s+/).filter(w => w.length > 3).slice(0, 5).join(' ');
      const res = await searchNews(place ? `"${place}" ${words}` : words, '3d');
      setHits(res);
      const at = Date.now();
      setSearchedAt(at);
      searchCache.set(threat.id, { hits: res, at });
    } catch (e: any) {
      setSearchError(e?.message || 'Live search failed.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!searchCache.has(threat.id) && threat.category !== 'HAZARD') runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threat.id]);

  const entries: WireEntry[] = [
    ...(threat.sources || []).map(s => ({ title: s.title, url: s.url, source: s.source, time: new Date(s.published).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), kind: 'wire' as const })),
    ...hits.filter(h => !(threat.sources || []).some(s => s.url === h.url || s.title === h.title)).map(h => ({ title: h.title, url: h.url, source: h.source || hostOf(h.url), time: h.published ? new Date(h.published).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Web', kind: 'search' as const })),
  ];
  const corroboration = Math.min(100, ((threat.sources?.length || 0) + Math.min(hits.length, 5)) * 12);

  return (
    <div className="p-4 sm:p-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-20 max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 sm:mb-8 gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-calibrex-teal hover:text-white transition-colors group">
          <div className="p-2 rounded-full bg-calibrex-teal/10 group-hover:bg-calibrex-teal/20">
            <ArrowLeft size={20} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Return to Dashboard</span>
        </button>
        <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 w-full sm:w-auto">
          <button
            onClick={() => onInvestigate(threat.title.replace(/^[^:]{2,30}:\s*/, ''))}
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
              <Shield size={44} className={threat.severity === 'CRITICAL' ? 'animate-pulse' : ''} />
            </div>
            <div className="text-center md:text-left flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  threat.severity === 'CRITICAL' ? 'bg-calibrex-critical/20 text-calibrex-critical' : 'bg-calibrex-gold/20 text-calibrex-gold'
                }`}>
                  Priority: {threat.severity}
                </span>
                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin size={12} /> {threat.location || 'Global Sector'}
                </span>
                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                  <Globe size={12} /> {threat.category || 'Strategic'} Vector
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.1em] mb-2 sm:mb-3 break-words">{threat.title}</h1>
              <p className="text-calibrex-muted text-xs sm:text-sm leading-relaxed max-w-3xl italic">
                {threat.description || 'No summary available.'}
              </p>
            </div>
          </div>
        </div>

        {/* Live News Wire */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4 gap-3">
            <div className="flex items-center gap-3">
              <Radio size={18} className="text-calibrex-teal animate-pulse" />
              <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Live Intelligence Newswire</h2>
            </div>
            <button onClick={runSearch} disabled={searching || isOffline} className="flex items-center gap-2 text-[9px] font-mono text-white/50 hover:text-calibrex-teal uppercase disabled:opacity-40">
              {searching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {searching ? 'Searching news' : `News sweep ${timeAgo(searchedAt)}`}
            </button>
          </div>

          {searchError && (
            <div className="text-[11px] text-calibrex-high font-bold flex items-start gap-2"><AlertTriangle size={14} className="shrink-0" /> {searchError}</div>
          )}

          <div className="space-y-4">
            {entries.length === 0 && (
              <div className="text-center py-12 text-white/40 text-xs uppercase tracking-widest">
                {searching ? 'Sweeping news sources…' : 'No reports linked to this vector yet.'}
              </div>
            )}
            {entries.map((log, i) => (
              <div key={log.url + i} className="bg-calibrex-surface/50 border border-white/5 p-4 sm:p-5 rounded-xl hover:bg-calibrex-surface transition-all flex gap-4 sm:gap-5 group">
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-calibrex-teal group-hover:scale-110 transition-transform">
                    {log.kind === 'wire' ? <Newspaper size={18} /> : <Globe size={18} />}
                  </div>
                  <div className="h-full w-px bg-white/5 my-2"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-2 gap-3">
                    <span className="text-[10px] font-black text-calibrex-gold uppercase tracking-widest truncate">[{log.source}] {log.kind === 'wire' ? 'WIRE' : 'SEARCH'}</span>
                    <span className="text-[10px] font-mono text-white/40 flex items-center gap-1.5 shrink-0"><Clock size={10} /> {log.time}</span>
                  </div>
                  <p className="text-sm text-calibrex-text/90 leading-relaxed font-medium">{log.title}</p>
                  {log.excerpt && <p className="text-[11px] text-white/50 leading-relaxed mt-2 line-clamp-3">{log.excerpt}</p>}
                  <div className="mt-3 flex gap-4">
                    <button onClick={() => onInvestigate(log.title)} className="text-[9px] font-black uppercase text-calibrex-teal hover:underline flex items-center gap-1">
                      <Terminal size={10} /> Detail Trace
                    </button>
                    <a href={log.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black uppercase text-calibrex-teal hover:underline flex items-center gap-1">
                      <ExternalLink size={10} /> Open Source
                    </a>
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
                  <div className="text-xs sm:text-sm font-black text-calibrex-text">{detail.value}</div>
                </div>
              ))}
              <div>
                  <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 flex justify-between"><span>Source Corroboration</span><span className="tabular-nums">{entries.length} reports</span></div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2">
                    <div className={`h-full transition-all duration-1000 ${threat.severity === 'CRITICAL' ? 'bg-calibrex-critical shadow-[0_0_10px_#ff4444]' : 'bg-calibrex-gold'}`} style={{ width: `${corroboration}%` }} />
                  </div>
              </div>
            </div>
          </div>

          <div className="bg-calibrex-critical/10 border border-calibrex-critical/30 p-6 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Shield size={16} className="text-calibrex-critical" />
              <h3 className="text-xs font-black text-calibrex-critical uppercase tracking-[0.2em]">Risk Mitigation SOP</h3>
            </div>
            <p className="text-[11px] text-white/70 leading-relaxed font-medium mb-3 sm:mb-4">
              Open a research session on this {threat.category?.toLowerCase() || 'security'} vector to collect reporting on exposure, indicators to watch and response, then compile it into a brief.
            </p>
            <button
              onClick={() => onInvestigate(`${threat.location || ''} security response ${threat.category === 'CYBER' ? 'advisory' : 'measures'}`.trim())}
              className="w-full py-3 bg-calibrex-critical/20 hover:bg-calibrex-critical/30 border border-calibrex-critical/40 text-calibrex-critical text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
            >
              Initiate Counter-Ops Brief
            </button>
          </div>
        </div>
      </div>

      <div className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-white/5 flex flex-col items-center gap-2 opacity-40 text-center">
        <div className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.5em]">Calibrex OSINT Studio</div>
        <p className="text-[9px] font-mono">Assessed {threat.assessedAt ? new Date(threat.assessedAt).toLocaleString() : 'live'} from open sources. © Ilmaz Syed 2025.</p>
      </div>
    </div>
  );
};

export default ThreatWireView;
