import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, FileText, Trash2, ChevronRight, Zap, Sparkles, ShieldCheck, AlertCircle, FileSearch, Copy, Download, Archive, Check, X, Square, Search } from 'lucide-react';
import { IntelligenceNode, ReportVerification, ReportHistoryItem } from '../types';
import { askClaude, askClaudeJSON, aiMessage, saveFile, copyText, plainText } from '../lib/claude';

interface ReportGeneratorProps {
  pinnedNodes: IntelligenceNode[];
  onProceedToDispatch: (compiledReport: { title: string; category: string; content: string; verification?: ReportVerification }) => void;
  onRemoveNode: (id: string) => void;
  onArchiveReport: (item: ReportHistoryItem) => void;
  onGoResearch?: () => void;
  isOffline?: boolean;
  currentUser: { id: string } | null;
}

// The draft survives switching screens.
const draft = {
  title: '',
  category: 'General Intelligence',
  content: null as string | null,
  verification: null as ReportVerification | null,
};

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ pinnedNodes, onProceedToDispatch, onRemoveNode, onArchiveReport, onGoResearch, isOffline, currentUser }) => {
  const [title, setTitle] = useState(draft.title);
  const [category, setCategory] = useState(draft.category);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [compiledContent, setCompiledContent] = useState<string | null>(draft.content);
  const [streamText, setStreamText] = useState('');
  const [verification, setVerification] = useState<ReportVerification | null>(draft.verification);
  const [copySuccess, setCopySuccess] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { draft.title = title; draft.category = category; draft.content = compiledContent; draft.verification = verification; },
    [title, category, compiledContent, verification]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const busy = isCompiling || isVerifying;
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const t0 = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const handleCompile = async () => {
    if (isOffline || pinnedNodes.length === 0 || !title.trim() || isCompiling) return;

    setIsCompiling(true);
    setErrorMsg(null);
    setVerification(null);
    setCompiledContent(null);
    setStreamText('');
    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
        const sourceText = pinnedNodes.slice(0, 20).map((n, i) => `[NODE ${i + 1}] ${n.content}`).join('\n\n');
        const text = await askClaude(
`As an Intelligence Coordinator, synthesize these source nodes into a formal executive report.
TITLE: ${title}
CATEGORY: ${category}
SOURCES:
${sourceText}

Write three sections with these exact headings on their own lines: EXECUTIVE SUMMARY, DETAILED ANALYSIS, STRATEGIC IMPLICATIONS.
Use plain text only (no Markdown symbols such as # or *). Base every claim on the source nodes; mark anything inferred as an assessment.`,
          { onText: setStreamText, signal: ctl.signal, fresh: true }
        );
        setCompiledContent(plainText(text));
    } catch (e: any) {
        if (e?.code !== 'cancelled') setErrorMsg(aiMessage(e));
    } finally {
        setIsCompiling(false);
        setStreamText('');
        abortRef.current = null;
    }
  };

  const handleRunFactCheck = async () => {
    if (isOffline || !compiledContent || isVerifying) return;

    setIsVerifying(true);
    setErrorMsg(null);
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
        const sourceText = pinnedNodes.slice(0, 20).map(n => `SOURCE: ${n.content}`).join('\n');
        const parsed = await askClaudeJSON<ReportVerification>(
`You are an intelligence auditor. Fact-check the REPORT strictly against the RAW SOURCES: flag claims the sources do not support.
RAW SOURCES:
${sourceText || '(none)'}

REPORT:
${compiledContent}

Reply with only JSON: {"score": 0-100, "verdict": "VERIFIED" | "CAUTION" | "UNRELIABLE", "findings": ["short finding", ...up to 5], "auditorLogic": "one or two sentences"}`,
          { signal: ctl.signal, fresh: true }
        );
        setVerification({
          score: Math.max(0, Math.min(100, Math.round(Number(parsed?.score) || 0))),
          verdict: (['VERIFIED', 'CAUTION', 'UNRELIABLE'].includes(parsed?.verdict) ? parsed.verdict : 'CAUTION') as ReportVerification['verdict'],
          findings: Array.isArray(parsed?.findings) ? parsed.findings.map(String).slice(0, 5) : [],
          auditorLogic: String(parsed?.auditorLogic || ''),
        });
    } catch (e: any) {
        if (e?.code !== 'cancelled') setErrorMsg(`Auditor Link Failure: ${aiMessage(e)}`);
    } finally {
        setIsVerifying(false);
        abortRef.current = null;
    }
  };

  const handleDownloadTxt = useCallback(async () => {
    if (!compiledContent) return;
    const brandedContent = `CALIBREX OSINT STUDIO\nTITLE: ${title}\nCATEGORY: ${category}\n\n${compiledContent}`;
    const ok = await saveFile(`${(title || 'report').replace(/\s+/g, '_')}_REPORT.txt`, brandedContent);
    if (!ok) setErrorMsg('Download unavailable in this viewer. Use Copy instead.');
  }, [compiledContent, title, category]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!compiledContent) return;
    if (await copyText(compiledContent)) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    } else setErrorMsg('Copy was blocked by this viewer. Select the report text and copy it manually.');
  }, [compiledContent]);

  const handleArchiveReport = useCallback(() => {
    if (!compiledContent || !currentUser?.id) return;
    const item: ReportHistoryItem = {
      id: Date.now().toString(),
      title: title,
      date: new Date().toLocaleDateString(),
      format: 'ARCHIVED',
      content: compiledContent,
      verification: verification || undefined,
      userId: currentUser.id,
    };
    onArchiveReport(item);
    setArchiveSuccess(true);
    setTimeout(() => setArchiveSuccess(false), 2000);
  }, [compiledContent, currentUser, title, verification, onArchiveReport]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-24 relative z-10">
      {busy && (
        <div className="fixed top-0 left-0 w-full h-1 bg-black/40 z-[120] overflow-hidden">
          <div className="h-full w-1/3 bg-calibrex-gold shadow-[0_0_10px_#c9a961] calibrex-indeterminate" />
          <div className="absolute top-2 right-4 text-[9px] font-mono text-calibrex-gold uppercase tracking-widest bg-black/80 px-2 py-1 rounded-md backdrop-blur-md border border-white/10 flex items-center gap-2">
            <Loader2 size={10} className="animate-spin" />
            {isVerifying ? 'AUDIT ENGINE' : 'SYNTHESIS ENGINE'} · {elapsed}s
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-calibrex-critical/20 border border-calibrex-critical/40 p-4 rounded-xl mb-6 flex items-center justify-between animate-in slide-in-from-top-4">
           <div className="flex items-center gap-3">
             <AlertCircle className="text-calibrex-critical" size={20} />
             <span className="text-[10px] font-black text-white uppercase tracking-widest">{errorMsg}</span>
           </div>
           <button onClick={() => setErrorMsg(null)} className="text-white/40 hover:text-white transition-colors"><X size={16} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
            <div className="bg-calibrex-surface backdrop-blur-md border border-white/5 rounded-2xl p-4 sm:p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                    <h3 className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em]">Source Intel Nodes</h3>
                    <span className="text-[10px] font-mono text-white/30">{pinnedNodes.length} BUFFERED</span>
                </div>
                <div className="space-y-4 max-h-[300px] lg:max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                    {pinnedNodes.length === 0 ? (
                        <div className="py-12 text-center flex flex-col items-center gap-4">
                          <p className="text-white/40 italic text-xs uppercase tracking-widest">No intelligence nodes buffered. Pin insights from research.</p>
                          {onGoResearch && <button onClick={onGoResearch} className="px-4 py-2 bg-calibrex-teal/10 border border-calibrex-teal/30 text-calibrex-teal text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-calibrex-teal/20 flex items-center gap-2"><Search size={12} /> Open Intelligence Research</button>}
                        </div>
                    ) : (
                        pinnedNodes.map((node) => (
                            <div key={node.id} className="bg-black/40 border border-white/5 p-4 rounded-xl relative group backdrop-blur-sm animate-in fade-in hover:border-calibrex-teal/30 transition-all">
                                <button onClick={() => onRemoveNode(node.id)} title="Remove node" className="absolute top-2 right-2 text-calibrex-critical opacity-60 hover:opacity-100 group-hover:opacity-100 transition-opacity p-1 hover:bg-calibrex-critical/10 rounded">
                                    <Trash2 size={14} />
                                </button>
                                <div className="text-[8px] font-mono text-calibrex-teal mb-1 uppercase tracking-tighter">{node.timestamp} | {node.source}</div>
                                <p className="text-[10px] leading-relaxed text-white/70">{node.content}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
            <div className="bg-calibrex-surface backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                    <div className="p-3.5 bg-calibrex-teal/10 rounded-xl border border-calibrex-teal/20 text-calibrex-teal shadow-inner">
                        <Zap size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-[0.1em]">Synthesis Pipeline</h2>
                        <p className="text-[10px] text-calibrex-muted uppercase font-mono tracking-[0.2em] opacity-50">Operational Dossier Compilation v3.0</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] mb-2.5">Dispatch Designation</label>
                        <input id="report-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter brief title..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-calibrex-teal transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] mb-2.5">Strategic Axis</label>
                        <select id="report-category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-calibrex-teal appearance-none transition-all">
                            <option>General Intelligence</option>
                            <option>Geopolitical Conflict</option>
                            <option>Financial Oversight</option>
                            <option>Cyber Infrastructure</option>
                        </select>
                    </div>
                </div>

                {!compiledContent ? (
                    isCompiling ? (
                      <div className="space-y-4">
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 sm:p-10 h-[300px] lg:h-[450px] overflow-y-auto custom-scrollbar font-sans leading-relaxed text-sm text-white/80 whitespace-pre-wrap shadow-inner">
                          {streamText ? plainText(streamText) : <span className="text-calibrex-teal font-mono text-xs uppercase tracking-widest flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Correlating signal…</span>}
                        </div>
                        <div className="flex justify-end">
                          <button onClick={() => abortRef.current?.abort()} className="px-6 py-3 bg-calibrex-critical/10 border border-calibrex-critical/30 text-calibrex-critical text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 hover:bg-calibrex-critical/20"><Square size={12} /> Stop Synthesis</button>
                        </div>
                      </div>
                    ) : (
                    <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4 bg-black/20 rounded-2xl border border-white/5 backdrop-blur-sm group text-center">
                        <Sparkles size={48} className="text-calibrex-teal mb-6 opacity-30 group-hover:opacity-50 transition-opacity duration-700" />
                        <button onClick={handleCompile} disabled={pinnedNodes.length === 0 || !title.trim() || isOffline} className="px-10 py-4 bg-calibrex-teal/80 hover:bg-calibrex-teal text-calibrex-navy font-black text-[11px] uppercase tracking-[0.3em] rounded-xl transition-all disabled:opacity-30 shadow-2xl flex items-center gap-3 active:scale-95">
                            <Zap size={18} /> Initiate Synthesis
                        </button>
                        <p className="text-[10px] text-white/50 uppercase tracking-widest mt-4">
                          {isOffline ? 'Terminal offline. Bring the system online to synthesize.' : pinnedNodes.length === 0 ? 'Pin at least one insight in Intelligence Research.' : !title.trim() ? 'Enter a dispatch designation to begin.' : `${pinnedNodes.length} node${pinnedNodes.length === 1 ? '' : 's'} ready for synthesis.`}
                        </p>
                    </div>
                    )
                ) : (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <h4 className="text-[10px] font-black text-calibrex-gold uppercase tracking-widest flex items-center gap-2">
                                <FileSearch size={14} /> Synthesized Dispatch
                            </h4>
                            <div className="flex gap-2">
                                {verification ? (
                                    <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${
                                        verification.verdict === 'VERIFIED' ? 'bg-calibrex-low/10 border-calibrex-low text-calibrex-low' :
                                        verification.verdict === 'CAUTION' ? 'bg-calibrex-high/10 border-calibrex-high text-calibrex-high' :
                                        'bg-calibrex-critical/10 border-calibrex-critical text-calibrex-critical'
                                    }`}>
                                        <ShieldCheck size={12} /> {verification.verdict} • {verification.score}% CONFIDENCE
                                    </div>
                                ) : (
                                    <button onClick={handleRunFactCheck} disabled={isVerifying || isOffline} className="px-4 py-1.5 bg-calibrex-gold/20 hover:bg-calibrex-gold border border-calibrex-gold/40 text-calibrex-gold hover:text-calibrex-navy text-[9px] font-black uppercase tracking-widest rounded-full transition-all flex items-center gap-2 active:scale-95">
                                        {isVerifying ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                                        Run AI Audit
                                    </button>
                                )}
                            </div>
                        </div>

                        {verification && (verification.findings.length > 0 || verification.auditorLogic) && (
                          <div className="bg-black/30 border border-white/10 rounded-xl p-4 text-[11px] text-white/70 space-y-2">
                            {verification.auditorLogic && <p className="italic">{verification.auditorLogic}</p>}
                            {verification.findings.length > 0 && <ul className="list-disc pl-5 space-y-1">{verification.findings.map((f, i) => <li key={i}>{f}</li>)}</ul>}
                          </div>
                        )}
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 sm:p-10 h-[300px] lg:h-[450px] overflow-y-auto custom-scrollbar font-sans leading-relaxed text-sm text-white/90 whitespace-pre-wrap relative shadow-inner select-text">
                             {compiledContent}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
                            <button onClick={handleCompile} disabled={isOffline || pinnedNodes.length === 0} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-30">Re-Synthesize</button>
                            <button onClick={() => onProceedToDispatch({ title, category, content: compiledContent!, verification: verification || undefined })} className="px-10 py-3 bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-xl hover:bg-white transition-all active:scale-95">
                                Open Dispatch Studio <ChevronRight size={14} />
                            </button>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/5 flex flex-wrap justify-center sm:justify-end gap-3 sm:gap-4">
                            <button onClick={handleDownloadTxt} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 active:scale-95"><Download size={14} /> TXT</button>
                            <button onClick={handleCopyToClipboard} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 active:scale-95">{copySuccess ? <Check size={14} /> : <Copy size={14} />} Copy</button>
                            <button onClick={handleArchiveReport} disabled={archiveSuccess} className="px-4 py-2 bg-calibrex-teal/10 hover:bg-calibrex-teal border border-calibrex-teal/30 text-calibrex-teal hover:text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 active:scale-95">{archiveSuccess ? <Check size={14} /> : <Archive size={14} />} Archive</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;
