import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield, Network, Radio, Globe, Pin, PinOff, Trash2, ListChecks,
  ShieldCheck, Send, ChevronDown, ChevronUp, BarChart3, ExternalLink,
  History, Plus, Archive, X, Loader2, Activity, Zap, Square
} from 'lucide-react';
import { IntelligenceNode } from '../types';
import { askClaudeJSON, aiMessage, loadRecord, saveRecord } from '../lib/claude';

interface ResearchProps {
    uid: string | null;
    initialQuery?: { q: string; n: number };
    pinnedNodes: IntelligenceNode[];
    onTogglePin: (node: IntelligenceNode) => void;
    onClearPins: () => void;
    onProceedToReport: () => void;
    isOffline?: boolean;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
    timestamp: string;
    isNode?: boolean;
    isError?: boolean;
    verification?: IntelligenceNode['verification'];
}

interface ResearchSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    timestamp: number;
}

interface AiReply {
    context: string;
    intelSnippet: string;
    verification: { score: number; status: string; sources: { name: string; url: string }[]; logic: string };
}

// Survives switching screens (the component unmounts on navigation).
const live = {
  sessionId: Date.now().toString(),
  messages: [] as ChatMessage[],
  lastHandledQuery: 0,
  pending: null as Promise<void> | null,
};

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Research: React.FC<ResearchProps> = ({ uid, initialQuery, pinnedNodes, onTogglePin, onClearPins, onProceedToReport, isOffline }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessagesState] = useState<ChatMessage[]>(live.messages);
  const [isAiLoading, setIsAiLoading] = useState(!!live.pending);
  const [elapsed, setElapsed] = useState(0);
  const [expandedVerification, setExpandedVerification] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [activeSessionId, setActiveSessionIdState] = useState<string>(live.sessionId);
  const [researchLog, setResearchLog] = useState<ResearchSession[]>([]);
  const [logLoaded, setLogLoaded] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const setMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    live.messages = typeof updater === 'function' ? (updater as any)(live.messages) : updater;
    if (mounted.current) setMessagesState(live.messages);
  }, []);
  const setActiveSessionId = (id: string) => { live.sessionId = id; setActiveSessionIdState(id); };

  useEffect(() => {
    mounted.current = true;
    // A request started before navigating away finishes in the background.
    if (live.pending) live.pending.finally(() => { if (mounted.current) { setMessagesState(live.messages); setIsAiLoading(false); } });
    return () => { mounted.current = false; };
  }, []);

  // Load archive
  useEffect(() => {
    let alive = true;
    loadRecord<ResearchSession[]>(uid, 'research_log', []).then(log => {
      if (!alive) return;
      if (Array.isArray(log)) setResearchLog(log);
      setLogLoaded(true);
    });
    return () => { alive = false; };
  }, [uid]);

  // Persist session changes
  useEffect(() => {
    if (!logLoaded || messages.length === 0) return;
    const timer = setTimeout(() => {
      setResearchLog(prev => {
        const idx = prev.findIndex(s => s.id === activeSessionId);
        let next = [...prev];
        if (idx !== -1) {
          next[idx] = { ...next[idx], messages };
        } else {
          const title = messages.find(m => m.role === 'user')?.content.slice(0, 60) || 'New Investigation';
          next = [{ id: activeSessionId, title, messages, timestamp: Date.now() }, ...next];
        }
        next = next.slice(0, 25);
        saveRecord(uid, 'research_log', next);
        return next;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [messages, activeSessionId, logLoaded, uid]);

  // Auto-scroll
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isAiLoading]);

  useEffect(() => {
    if (!isAiLoading) { setElapsed(0); return; }
    const t0 = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [isAiLoading]);

  const handleResearchTurn = useCallback(async (textQuery?: string) => {
    if (isOffline || live.pending) return;
    const userInput = (textQuery || query).trim();
    if (!userInput) return;

    const history = live.messages.filter(m => !m.isError).slice(-6);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userInput, timestamp: clock() }]);
    setQuery('');
    setIsAiLoading(true);
    const ctl = new AbortController();
    abortRef.current = ctl;

    const transcript = history.map(m => `${m.role === 'user' ? 'ANALYST' : 'DIRECTOR'}: ${m.content}`).join('\n');
    const prompt =
`You are a Senior OSINT Director inside the Calibrex OSINT Studio. Provide tactical, open-source intelligence analysis.
You have no live web access: rely on your training knowledge, say when information may be out of date, and never invent specific incidents, figures or quotes.
${transcript ? `\nCONVERSATION SO FAR:\n${transcript}\n` : ''}
NEW ANALYST QUERY: ${userInput}

Reply with only a JSON object of this shape:
{"context": "2-4 short paragraphs of tactical analysis, plain text",
 "intelSnippet": "one self-contained key finding in 1-3 sentences, suitable to pin into an executive report",
 "verification": {"score": 0-100 confidence in the finding,
   "status": "VERIFIED" | "UNVERIFIED" | "CONFLICTING",
   "sources": [{"name": "source name", "url": "https://..."}] (up to 4 well-known public reference sources whose URLs you are sure exist, e.g. an organisation's homepage),
   "logic": "one or two sentences explaining the confidence rating"}}`;

    const run = (async () => {
      try {
        const parsed = await askClaudeJSON<AiReply>(prompt, { signal: ctl.signal, fresh: true });
        const now = Date.now();
        const v = parsed?.verification;
        setMessages(prev => [...prev,
          { id: (now + 1).toString(), role: 'ai', content: String(parsed?.context || ''), timestamp: clock() },
          { id: (now + 2).toString(), role: 'ai', content: String(parsed?.intelSnippet || ''), timestamp: clock(), isNode: true,
            verification: v ? {
              score: Math.max(0, Math.min(100, Number(v.score) || 0)),
              status: (['VERIFIED', 'UNVERIFIED', 'CONFLICTING'].includes(v.status) ? v.status : 'UNVERIFIED') as any,
              sources: Array.isArray(v.sources) ? v.sources.filter(s => s && /^https:\/\//.test(String(s.url))).slice(0, 4).map(s => ({ name: String(s.name), url: String(s.url) })) : [],
              logic: String(v.logic || ''),
            } : undefined }
        ].filter(m => m.content));
      } catch (e: any) {
        if (e?.code !== 'cancelled') {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', isError: true, content: `LINK FAILURE: ${aiMessage(e)}`, timestamp: clock() }]);
        }
      } finally {
        live.pending = null;
        abortRef.current = null;
        if (mounted.current) setIsAiLoading(false);
      }
    })();
    live.pending = run;
  }, [query, isOffline, setMessages]);

  // Investigations launched from other screens (map, cards, feeds, alerts).
  useEffect(() => {
    if (initialQuery && initialQuery.n > live.lastHandledQuery && initialQuery.q) {
        live.lastHandledQuery = initialQuery.n;
        if (live.pending) return;
        setActiveSessionId(Date.now().toString());
        setMessages([]);
        handleResearchTurn(initialQuery.q.replace(/\s\[Ref: \d+\]$/, ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery?.n]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-57px)] min-h-[520px] overflow-hidden w-full relative z-10">
      {isAiLoading && (
        <div className="absolute top-0 left-0 w-full h-1 bg-black/40 z-[120] overflow-hidden">
          <div className="h-full w-1/3 bg-calibrex-teal shadow-[0_0_10px_#2a8a9a] calibrex-indeterminate" />
          <div className="absolute top-2 right-4 text-[9px] font-mono text-calibrex-teal uppercase tracking-widest bg-black/80 px-2 py-1 rounded-md backdrop-blur-md border border-white/10 flex items-center gap-2">
            <Loader2 size={10} className="animate-spin" />
            SYNTHESIS IN PROGRESS · {elapsed}s
          </div>
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
            <button onClick={() => { if (live.pending) return; setActiveSessionId(Date.now().toString()); setMessages([]); setQuery(''); if (window.innerWidth < 1024) setShowArchive(false); }} className="w-full py-2 bg-calibrex-teal/10 hover:bg-calibrex-teal/20 border border-calibrex-teal/30 rounded-lg text-calibrex-teal text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all active:scale-95"><Plus size={14} /> New Investigation</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {researchLog.length === 0 ? (
                <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                  <History size={32} />
                  <span className="text-[8px] font-black uppercase tracking-widest">No Archival Logs</span>
                </div>
              ) : researchLog.map((session) => (
                  <div key={session.id} onClick={() => { if (live.pending) return; setActiveSessionId(session.id); setMessages(session.messages); if(window.innerWidth < 1024) setShowArchive(false); }} className={`p-3 rounded-lg border cursor-pointer transition-all group relative ${session.id === activeSessionId ? 'bg-calibrex-teal/10 border-calibrex-teal/40' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                    <div className="text-[8px] font-mono text-white/30 uppercase truncate">ID: {session.id.slice(-6)} • {new Date(session.timestamp).toLocaleDateString()}</div>
                    <div className="text-[10px] text-white/80 font-bold line-clamp-2 uppercase mt-1 tracking-tight">{session.title}</div>
                  </div>
              ))}
          </div>
      </div>

      <div className="flex-1 flex flex-col border-r border-white/5 bg-calibrex-dark/60 backdrop-blur-md h-full overflow-hidden min-w-0">
          <div className="p-4 border-b border-white/5 bg-black/40 flex items-center justify-between shrink-0">
              <button onClick={() => setShowArchive(true)} className="lg:hidden p-2 bg-white/5 border border-white/10 rounded-lg text-calibrex-teal"><History size={16} /></button>
              <h3 className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] flex items-center gap-2"><Shield size={12}/> Analysis Stream</h3>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-calibrex-critical' : 'bg-calibrex-teal animate-pulse'}`}></div>
                <span className="text-[9px] text-white/40 font-mono uppercase hidden xs:inline">{isOffline ? 'Offline' : 'Uplink Established'}</span>
              </div>
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {messages.length === 0 && !isAiLoading && (
                  <div className="h-full flex flex-col items-center justify-center opacity-50 text-center px-6">
                      <Network size={32} className="mb-4 text-calibrex-teal" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white">Awaiting OSINT Parameters</p>
                      <p className="text-[10px] text-white/60 mt-2 max-w-xs normal-case">Ask about a region, group, vessel, company or event. Pin the captured insights, then compile them into an executive brief.</p>
                  </div>
              )}
              {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                      <div className={`max-w-[95%] sm:max-w-[85%] p-3 sm:p-4 rounded-xl text-xs leading-relaxed group relative ${msg.role === 'user' ? 'bg-calibrex-teal/10 border border-calibrex-teal/30 text-white' : msg.isNode ? 'bg-calibrex-gold/5 border border-calibrex-gold/30 text-calibrex-text' : 'bg-calibrex-surface-light border border-white/5 text-calibrex-text'}`}>
                          {msg.isNode && (
                              <div className="flex items-center justify-between mb-2 gap-2">
                                  <span className="text-[8px] font-black text-calibrex-gold uppercase tracking-widest">Captured Insight</span>
                                  <button title={pinnedNodes.some(n => n.content === msg.content) ? 'Unpin from buffer' : 'Pin to Intelligence Buffer'} onClick={() => onTogglePin({ id: msg.id, content: msg.content, timestamp: msg.timestamp, source: 'CALIBREX-AI', pinned: true, verification: msg.verification })} className={`p-1.5 rounded-md transition-all ${pinnedNodes.some(n => n.content === msg.content) ? 'bg-calibrex-gold text-calibrex-navy' : 'bg-white/5 text-calibrex-gold hover:bg-white/10'}`}>
                                      {pinnedNodes.some(n => n.content === msg.content) ? <><PinOff size={12} /></> : <Pin size={12} />}
                                  </button>
                              </div>
                          )}
                          <div className="text-[8px] opacity-40 font-mono mb-1 uppercase tracking-tighter">{msg.role} | {msg.timestamp}</div>
                          <div className={`whitespace-pre-wrap ${msg.isError ? 'text-calibrex-critical font-bold' : ''}`}>{msg.content}</div>
                          {msg.isNode && msg.verification && (
                            <button onClick={() => setExpandedVerification(expandedVerification === msg.id ? null : msg.id)} className="mt-3 w-full py-1.5 border border-dashed border-white/10 rounded-lg text-[8px] font-black text-white/30 uppercase tracking-widest hover:bg-white/5 flex items-center justify-center gap-2 transition-colors">
                                {expandedVerification === msg.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                {expandedVerification === msg.id ? 'Close Audit' : 'Neural Audit'}
                            </button>
                          )}
                          {expandedVerification === msg.id && msg.verification && (
                            <div className="mt-3 p-3 bg-black/40 border border-white/10 rounded-lg text-[10px] space-y-3 animate-in fade-in slide-in-from-top-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-black uppercase tracking-widest ${msg.verification.status === 'VERIFIED' ? 'text-calibrex-low' : msg.verification.status === 'CONFLICTING' ? 'text-calibrex-critical' : 'text-calibrex-medium'}`}>{msg.verification.status}</span>
                                <span className="font-mono text-white/60 tabular-nums">CONFIDENCE {Math.round(msg.verification.score)}%</span>
                              </div>
                              <div className="h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-calibrex-teal" style={{ width: `${msg.verification.score}%` }} /></div>
                              <p className="italic text-white/70 leading-relaxed">{msg.verification.logic}</p>
                              <p className="text-[8px] font-mono text-white/40 uppercase tracking-widest">AI-assessed reference sources · not live-verified</p>
                              <div className="grid grid-cols-1 gap-2">
                                {msg.verification.sources.map((s, i) => (
                                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className="text-calibrex-teal font-bold hover:underline truncate flex items-center gap-2 bg-white/5 p-1.5 rounded border border-white/5">
                                    <ExternalLink size={10} /> {s.name}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                  </div>
              ))}
              {isAiLoading && (
                  <div className="flex justify-start">
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 w-24 flex gap-1 backdrop-blur-md">
                        <div className="w-1.5 h-1.5 rounded-full bg-calibrex-teal animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-calibrex-teal animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-calibrex-teal animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                  </div>
              )}
          </div>

          <div className="xl:hidden px-4 py-2 border-t border-white/5 bg-black/30 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-black text-white/70 uppercase tracking-widest"><ListChecks size={14} className="text-calibrex-gold" /> Buffer <span className="bg-calibrex-gold text-calibrex-navy px-1.5 py-0.5 rounded text-[10px]">{pinnedNodes.length}</span></div>
              <button onClick={onProceedToReport} disabled={pinnedNodes.length === 0} className="px-3 py-2 bg-calibrex-gold hover:bg-white text-calibrex-navy font-black text-[9px] uppercase tracking-widest rounded-lg transition-all disabled:opacity-30">Compile Executive Brief</button>
          </div>
          <div className="p-4 bg-black/40 border-t border-white/5 shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); handleResearchTurn(); }} className="relative flex gap-2">
                  <input id="research-query" type="text" value={query} onChange={(e) => setQuery(e.target.value)} disabled={isAiLoading || isOffline} placeholder={isOffline ? "TERMINAL OFFLINE" : "Analyze tactical vector..."} className="flex-1 bg-black/20 border border-white/10 rounded-lg pl-4 pr-4 py-3.5 text-xs text-white focus:outline-none focus:border-calibrex-teal placeholder:text-white/20 disabled:opacity-50 transition-all" />
                  {isAiLoading ? (
                    <button type="button" onClick={() => abortRef.current?.abort()} title="Stop synthesis" className="p-3.5 bg-calibrex-critical/10 hover:bg-calibrex-critical/20 text-calibrex-critical rounded-lg transition-all active:scale-95 shadow-lg">
                      <Square size={18} />
                    </button>
                  ) : (
                    <button type="submit" disabled={!query.trim() || isOffline} title="Send query" className="p-3.5 bg-calibrex-teal/10 hover:bg-calibrex-teal/20 text-calibrex-teal rounded-lg transition-all disabled:opacity-30 active:scale-95 shadow-lg">
                      <Send size={18} />
                    </button>
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
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-8">
                  <Pin size={32} className="mb-4" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">Buffer Status: Empty. Pin insights from Analysis Stream.</p>
                </div>
              ) : pinnedNodes.map((node) => (
                  <div key={node.id} className="bg-white/5 border border-white/5 p-3 rounded-lg relative group hover:border-calibrex-gold/30 transition-all">
                      <button onClick={() => onTogglePin(node)} className="absolute top-2 right-2 opacity-60 hover:opacity-100 group-hover:opacity-100 text-calibrex-critical p-1 hover:bg-calibrex-critical/10 rounded transition-all"><Trash2 size={12} /></button>
                      <div className="text-[8px] font-mono text-calibrex-teal uppercase mb-1">{node.timestamp}</div>
                      <p className="text-[10px] text-white/80 line-clamp-3 leading-relaxed">{node.content}</p>
                  </div>
              ))}
          </div>
          <div className="p-4 bg-black/40 border-t border-white/5 space-y-2">
              <button onClick={onProceedToReport} disabled={pinnedNodes.length === 0} className="w-full py-4 bg-calibrex-gold hover:bg-white text-calibrex-navy font-black text-[10px] uppercase tracking-widest rounded-lg shadow-xl active:scale-95 transition-all disabled:opacity-30">Compile Executive Brief</button>
              <button onClick={onClearPins} disabled={pinnedNodes.length === 0} className="w-full py-2 text-white/20 hover:text-white/40 text-[8px] font-black uppercase tracking-widest transition-colors">Clear Local Buffer</button>
          </div>
      </div>
    </div>
  );
};

export default Research;
