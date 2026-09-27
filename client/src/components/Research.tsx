import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Network, Pin, PinOff, Trash2, ListChecks, ShieldCheck, Send, ChevronDown, ChevronUp,
  ExternalLink, History, Plus, Archive, X, Loader2, Square, Search, MapPin, BookOpen, Images,
} from 'lucide-react';
import { IntelligenceNode } from '../types';
import { loadRecord, saveRecord } from '../lib/api';
import { searchNews, corroborate, SearchHit, Corroboration, timeAgo, openReader } from '../lib/live';
import AiAssist from './AiAssist';
import { openVisuals } from '../lib/visuals';

interface ResearchProps {
  initialQuery?: { q: string; n: number };
  pinnedNodes: IntelligenceNode[];
  onTogglePin: (node: IntelligenceNode) => void;
  onClearPins: () => void;
  onProceedToReport: () => void;
  isOffline?: boolean;
}

type Window = '1d' | '3d' | '7d' | '30d';

interface ResearchSession {
  id: string;
  title: string;
  query: string;
  window: Window;
  results: SearchHit[];
  timestamp: number;
  checks?: Record<string, Corroboration>;
}

// Survives switching screens (the component unmounts on navigation).
const live = { session: null as ResearchSession | null, lastHandledQuery: 0 };

const WINDOWS: { id: Window; label: string }[] = [
  { id: '1d', label: '24h' }, { id: '3d', label: '3 days' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' },
];

const sevColor = (s: string) => s === 'CRITICAL' ? 'text-calibrex-critical border-calibrex-critical/30' : s === 'HIGH' ? 'text-calibrex-high border-calibrex-high/30' : s === 'MEDIUM' ? 'text-calibrex-medium border-calibrex-medium/30' : 'text-calibrex-low border-calibrex-low/30';
const checkColor = (s: string) => s === 'CORROBORATED' ? 'text-calibrex-low' : s === 'LIMITED' ? 'text-calibrex-medium' : 'text-calibrex-critical';

const Research: React.FC<ResearchProps> = ({ initialQuery, pinnedNodes, onTogglePin, onClearPins, onProceedToReport, isOffline }) => {
  const [query, setQuery] = useState('');
  const [windowSel, setWindowSel] = useState<Window>('7d');
  const [session, setSessionState] = useState<ResearchSession | null>(live.session);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [researchLog, setResearchLog] = useState<ResearchSession[]>([]);
  const [logLoaded, setLogLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const setSession = (s: ResearchSession | null) => { live.session = s; setSessionState(s); };

  useEffect(() => {
    let alive = true;
    loadRecord<ResearchSession[]>('research_log', []).then(log => {
      if (!alive) return;
      if (Array.isArray(log)) setResearchLog(log);
      setLogLoaded(true);
    });
    return () => { alive = false; abortRef.current?.abort(); };
  }, []);

  const persist = useCallback((s: ResearchSession) => {
    setResearchLog(prev => {
      const next = [s, ...prev.filter(x => x.id !== s.id)].slice(0, 30);
      saveRecord('research_log', next);
      return next;
    });
  }, []);

  const runSearch = useCallback(async (q: string, w: Window = windowSel) => {
    const text = q.trim();
    if (!text || isOffline) return;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setLoading(true);
    setError(null);
    setQuery('');
    try {
      const results = await searchNews(text, w, ctl.signal);
      const s: ResearchSession = { id: Date.now().toString(), title: text.slice(0, 80), query: text, window: w, results, timestamp: Date.now(), checks: {} };
      setSession(s);
      if (logLoaded) persist(s);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || 'The search failed. Try again.');
    } finally {
      setLoading(false);
    }
  }, [windowSel, isOffline, logLoaded, persist]);

  // Searches launched from other screens (map, cards, feeds, alerts).
  useEffect(() => {
    if (initialQuery && initialQuery.n > live.lastHandledQuery && initialQuery.q) {
      live.lastHandledQuery = initialQuery.n;
      runSearch(initialQuery.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery?.n]);

  const check = async (hit: SearchHit) => {
    if (checking || isOffline || !session) return;
    setChecking(hit.id);
    try {
      const r = await corroborate(hit.title);
      const next = { ...session, checks: { ...(session.checks || {}), [hit.id]: r } };
      setSession(next);
      persist(next);
      setExpanded(hit.id);
    } catch (e: any) {
      setError(e?.message || 'The corroboration check failed. Try again.');
    } finally {
      setChecking(null);
    }
  };

  const nodeFor = (hit: SearchHit): IntelligenceNode => {
    const c = session?.checks?.[hit.id];
    return {
      id: hit.id,
      content: hit.title,
      source: hit.source,
      url: hit.url,
      published: hit.published,
      timestamp: hit.published ? new Date(hit.published).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
      pinned: true,
      verification: c ? { score: c.score, status: c.status, sources: c.matches.map(m => ({ name: `${m.source}: ${m.title}`, url: m.url })), logic: c.note, checkedAt: c.checkedAt } : undefined,
    };
  };
  const isPinned = (hit: SearchHit) => pinnedNodes.some(n => n.id === hit.id || n.content === hit.title);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100dvh-121px)] lg:h-[calc(100vh-57px)] min-h-[480px] overflow-hidden w-full relative z-10">
      {loading && (
        <div className="absolute top-0 left-0 w-full h-1 bg-black/40 z-[120] overflow-hidden">
          <div className="h-full w-1/3 bg-calibrex-teal shadow-[0_0_10px_#2a8a9a] calibrex-indeterminate" />
        </div>
      )}

      {showArchive && <div className="fixed inset-0 bg-black/80 z-[100] lg:hidden" onClick={() => setShowArchive(false)} />}

      <div className={`${showArchive ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} fixed inset-y-0 left-0 w-[85%] sm:w-[300px] lg:relative lg:w-[280px] transition-transform duration-300 bg-[#050a0f] border-r border-white/5 flex flex-col h-full shrink-0 z-[110] lg:z-10`}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Archive size={12} className="text-calibrex-teal" /> Signal Archive
              </h3>
              <button onClick={() => setShowArchive(false)} className="lg:hidden text-white/40"><X size={20} /></button>
          </div>
          <div className="p-3 border-b border-white/5">
            <button onClick={() => { setSession(null); setQuery(''); if (window.innerWidth < 1024) setShowArchive(false); }} className="w-full py-2 bg-calibrex-teal/10 hover:bg-calibrex-teal/20 border border-calibrex-teal/30 rounded-lg text-calibrex-teal text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all active:scale-95"><Plus size={14} /> New Investigation</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {researchLog.length === 0 ? (
                <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                  <History size={32} />
                  <span className="text-[8px] font-black uppercase tracking-widest">No Archival Logs</span>
                </div>
              ) : researchLog.map((s) => (
                  <div key={s.id} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSession(s); }} onClick={() => { setSession(s); if (window.innerWidth < 1024) setShowArchive(false); }} className={`p-3 rounded-lg border cursor-pointer transition-all ${s.id === session?.id ? 'bg-calibrex-teal/10 border-calibrex-teal/40' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                    <div className="text-[8px] font-mono text-white/40 uppercase truncate">{new Date(s.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {s.results.length} results</div>
                    <div className="text-[10px] text-white/80 font-bold line-clamp-2 uppercase mt-1 tracking-tight">{s.title}</div>
                  </div>
              ))}
          </div>
      </div>

      <div className="flex-1 flex flex-col border-r border-white/5 bg-calibrex-dark/60 backdrop-blur-md h-full overflow-hidden min-w-0">
          <div className="p-4 border-b border-white/5 bg-black/40 flex items-center justify-between shrink-0 gap-3">
              <button onClick={() => setShowArchive(true)} className="lg:hidden p-2 bg-white/5 border border-white/10 rounded-lg text-calibrex-teal"><History size={16} /></button>
              <h3 className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] flex items-center gap-2 truncate"><Search size={12}/> {session ? `Results: ${session.query}` : 'Analysis Stream'}</h3>
              <div className="flex gap-1 shrink-0">
                {WINDOWS.map(w => (
                  <button key={w.id} onClick={() => { setWindowSel(w.id); if (session) runSearch(session.query, w.id); }} className={`px-2 py-1 rounded text-[9px] font-black uppercase ${windowSel === w.id ? 'bg-calibrex-teal text-calibrex-navy' : 'bg-white/5 text-white/50 hover:text-white'}`}>{w.label}</button>
                ))}
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {error && <div className="text-[11px] text-calibrex-critical font-bold">{error}</div>}
              {!session && !loading && (
                  <div className="h-full flex flex-col items-center justify-center opacity-60 text-center px-6">
                      <Network size={32} className="mb-4 text-calibrex-teal" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white">Awaiting OSINT Parameters</p>
                      <p className="text-[11px] text-white/70 mt-2 max-w-sm normal-case">Search live news for a region, group, vessel, company or event. Pin the reports you need, check how widely each is corroborated, then compile an executive brief.</p>
                  </div>
              )}
              {loading && !session && <div className="py-16 text-center text-calibrex-teal text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Searching live news…</div>}
              {session && session.results.length === 0 && !loading && (
                <div className="py-16 text-center text-white/50 text-xs">No reports found for “{session.query}” in this time window. Try fewer words or a longer window.</div>
              )}
              {session && session.results.length > 0 && (
                <AiAssist
                  key={session.id}
                  task="research"
                  label="Summarise with AI"
                  getInput={() => ({ query: session.query, sources: session.results.slice(0, 20).map(h => ({ title: h.title, source: h.source, url: h.url, published: h.published })) })}
                  className="mb-1"
                />
              )}
              {session?.results.map(hit => {
                const c = session.checks?.[hit.id];
                return (
                  <div key={hit.id} className="p-3 sm:p-4 rounded-xl bg-calibrex-surface-light border border-white/5 hover:border-calibrex-teal/30 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[9px] font-mono text-calibrex-teal uppercase tracking-tighter mb-1 flex flex-wrap gap-x-2">
                          <span>{hit.source}</span>
                          {hit.published && <span className="text-white/40">{new Date(hit.published).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {timeAgo(hit.published)}</span>}
                          {hit.place && <span className="text-white/50 flex items-center gap-1"><MapPin size={9} />{hit.place.name}</span>}
                        </div>
                        <a href={hit.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-white hover:text-calibrex-gold leading-snug">{hit.title}</a>
                      </div>
                      <button title={isPinned(hit) ? 'Unpin from buffer' : 'Pin to Intelligence Buffer'} onClick={() => onTogglePin(nodeFor(hit))} className={`p-1.5 rounded-md transition-all shrink-0 ${isPinned(hit) ? 'bg-calibrex-gold text-calibrex-navy' : 'bg-white/5 text-calibrex-gold hover:bg-white/10'}`}>
                        {isPinned(hit) ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border tracking-widest ${sevColor(hit.severity)}`}>{hit.severity}</span>
                      <button onClick={() => openVisuals({ title: hit.title, urls: [hit.url], place: hit.place?.name, lat: hit.place?.lat, lng: hit.place?.lng })} className="text-[9px] font-black text-calibrex-gold uppercase flex items-center gap-1 hover:underline" title="Photos, video and satellite imagery"><Images size={10} /> Visual intel</button>
                      <button onClick={() => openReader({ url: hit.url, title: hit.title, source: hit.source, published: hit.published })} className="text-[9px] font-black text-calibrex-teal uppercase flex items-center gap-1 hover:underline" title="Read the full article here"><BookOpen size={10} /> Read</button>
                      <a href={hit.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-white/50 hover:text-calibrex-teal uppercase flex items-center gap-1">Open <ExternalLink size={9} /></a>
                      {c ? (
                        <button onClick={() => setExpanded(expanded === hit.id ? null : hit.id)} className={`text-[9px] font-black uppercase flex items-center gap-1 ${checkColor(c.status)}`}>
                          {expanded === hit.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />} {c.status} · {c.outlets} outlets
                        </button>
                      ) : (
                        <button onClick={() => check(hit)} disabled={!!checking || isOffline} className="text-[9px] font-black text-calibrex-gold uppercase flex items-center gap-1 hover:underline disabled:opacity-40">
                          {checking === hit.id ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />} Verify
                        </button>
                      )}
                    </div>
                    {c && expanded === hit.id && (
                      <div className="mt-3 p-3 bg-black/40 border border-white/10 rounded-lg text-[10px] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-black uppercase tracking-widest ${checkColor(c.status)}`}>{c.status}</span>
                          <span className="font-mono text-white/60 tabular-nums">SCORE {c.score}%</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-calibrex-teal" style={{ width: `${c.score}%` }} /></div>
                        <p className="text-white/70">{c.note}</p>
                        <p className="text-[9px] font-mono text-white/40 uppercase">Searched “{c.query}” · {new Date(c.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        {c.matches.map((m, i) => (
                          <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-calibrex-teal hover:underline"><ExternalLink size={10} className="shrink-0 mt-0.5" /><span><b>{m.source}</b>: {m.title}</span></a>
                        ))}
                        {c.matches.length > 0 && (
                          <AiAssist task="verify" label="Explain with AI" getInput={() => ({ claim: hit.title, sources: c.matches.map(m => ({ title: m.title, source: m.source, url: m.url, published: m.published })) })} />
                        )}
                        <button onClick={() => { const next = { ...session, checks: { ...(session.checks || {}) } }; delete next.checks![hit.id]; setSession(next); check(hit); }} disabled={!!checking} className="text-[9px] font-black text-calibrex-gold uppercase hover:underline disabled:opacity-40">Re-check now</button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          <div className="xl:hidden px-4 py-2 border-t border-white/5 bg-black/30 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-black text-white/70 uppercase tracking-widest"><ListChecks size={14} className="text-calibrex-gold" /> Buffer <span className="bg-calibrex-gold text-calibrex-navy px-1.5 py-0.5 rounded text-[10px]">{pinnedNodes.length}</span></div>
              <button onClick={onProceedToReport} disabled={pinnedNodes.length === 0} className="px-3 py-2 bg-calibrex-gold hover:bg-white text-calibrex-navy font-black text-[9px] uppercase tracking-widest rounded-lg transition-all disabled:opacity-30">Compile Executive Brief</button>
          </div>
          <div className="p-4 bg-black/40 border-t border-white/5 shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); runSearch(query); }} className="relative flex gap-2">
                  <input id="research-query" type="text" value={query} onChange={(e) => setQuery(e.target.value)} disabled={isOffline} placeholder={isOffline ? 'TERMINAL OFFLINE' : 'Search live news: group, place, vessel, company, event…'} className="flex-1 bg-black/20 border border-white/10 rounded-lg pl-4 pr-4 py-3.5 text-xs text-white focus:outline-none focus:border-calibrex-teal placeholder:text-white/30 disabled:opacity-50 transition-all" />
                  {loading ? (
                    <button type="button" onClick={() => { abortRef.current?.abort(); setLoading(false); }} title="Stop search" className="p-3.5 bg-calibrex-critical/10 hover:bg-calibrex-critical/20 text-calibrex-critical rounded-lg"><Square size={18} /></button>
                  ) : (
                    <button type="submit" disabled={!query.trim() || isOffline} title="Search" className="p-3.5 bg-calibrex-teal/10 hover:bg-calibrex-teal/20 text-calibrex-teal rounded-lg disabled:opacity-30"><Send size={18} /></button>
                  )}
              </form>
          </div>
      </div>

      <div className="hidden xl:flex w-[320px] bg-black/60 border-l border-white/5 flex-col h-full shrink-0 relative">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2"><ListChecks size={14} className="text-calibrex-gold" /><h3 className="text-[10px] font-black text-white uppercase tracking-widest">Intelligence Buffer</h3></div>
              <span className="bg-calibrex-gold text-calibrex-navy px-1.5 py-0.5 rounded text-[10px] font-black">{pinnedNodes.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {pinnedNodes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-40 text-center px-8">
                  <Pin size={32} className="mb-4" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">Buffer empty. Pin reports from the results.</p>
                </div>
              ) : pinnedNodes.map((node) => (
                  <div key={node.id} className="bg-white/5 border border-white/5 p-3 rounded-lg relative group hover:border-calibrex-gold/30 transition-all">
                      <button onClick={() => onTogglePin(node)} title="Remove" className="absolute top-2 right-2 opacity-60 hover:opacity-100 text-calibrex-critical p-1 hover:bg-calibrex-critical/10 rounded"><Trash2 size={12} /></button>
                      <div className="text-[8px] font-mono text-calibrex-teal uppercase mb-1 pr-6">{node.source} · {node.timestamp}</div>
                      <p className="text-[10px] text-white/80 line-clamp-3 leading-relaxed">{node.content}</p>
                      {node.verification && <div className={`text-[8px] font-black uppercase mt-1 ${checkColor(node.verification.status)}`}>{node.verification.status}</div>}
                  </div>
              ))}
          </div>
          <div className="p-4 bg-black/40 border-t border-white/5 space-y-2">
              <button onClick={onProceedToReport} disabled={pinnedNodes.length === 0} className="w-full py-4 bg-calibrex-gold hover:bg-white text-calibrex-navy font-black text-[10px] uppercase tracking-widest rounded-lg shadow-xl active:scale-95 transition-all disabled:opacity-30">Compile Executive Brief</button>
              <button onClick={onClearPins} disabled={pinnedNodes.length === 0} className="w-full py-2 text-white/40 hover:text-white/60 text-[8px] font-black uppercase tracking-widest transition-colors">Clear Local Buffer</button>
          </div>
      </div>
    </div>
  );
};

export default Research;
