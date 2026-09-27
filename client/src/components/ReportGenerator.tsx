import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, FileText, Trash2, ChevronRight, Zap, Sparkles, ShieldCheck, AlertCircle, FileSearch, Copy, Download, Archive, Check, X, Search, ExternalLink } from 'lucide-react';
import { IntelligenceNode, ReportVerification, ReportHistoryItem } from '../types';
import { saveFile, copyText, localPref } from '../lib/api';
import { corroborate } from '../lib/live';
import AiAssist from './AiAssist';

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

const fmt = (ms?: number | null) => ms ? new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'undated';

/** Build the executive report template from pinned reports. The analyst writes the judgement sections. */
function compileTemplate(title: string, category: string, nodes: IntelligenceNode[]): string {
  const sorted = [...nodes].sort((a, b) => (b.published || 0) - (a.published || 0));
  const outlets = new Set(sorted.map(n => n.source)).size;
  const corroborated = sorted.filter(n => n.verification?.status === 'CORROBORATED').length;
  const lines = [
    `${title.toUpperCase()}`,
    `Category: ${category} · Compiled ${fmt(Date.now())} · ${sorted.length} reports from ${outlets} outlets${corroborated ? ` · ${corroborated} corroborated` : ''}`,
    '',
    'EXECUTIVE SUMMARY',
    '[Write two or three sentences: what happened, where, and why it matters.]',
    '',
    'KEY REPORTING',
    ...sorted.map((n, i) => `${i + 1}. ${n.content} (${n.source}, ${fmt(n.published)})${n.verification ? ` [${n.verification.status}]` : ''}`),
    '',
    'DETAILED ANALYSIS',
    '[Actors, sequence of events, and how the reports above relate.]',
    '',
    'STRATEGIC IMPLICATIONS',
    '[Likely developments and indicators to watch.]',
    '',
    'SOURCES',
    ...sorted.map((n, i) => `[${i + 1}] ${n.source}: ${n.url || 'no link'}`),
  ];
  return lines.join('\n');
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ pinnedNodes, onProceedToDispatch, onRemoveNode, onArchiveReport, onGoResearch, isOffline, currentUser }) => {
  const [title, setTitle] = useState(draft.title);
  const [category, setCategory] = useState(draft.category);
  const [content, setContent] = useState<string | null>(draft.content);
  const [verification, setVerification] = useState<ReportVerification | null>(draft.verification);
  const [isVerifying, setIsVerifying] = useState(false);
  const [auditStage, setAuditStage] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef(false);

  useEffect(() => { draft.title = title; draft.category = category; draft.content = content; draft.verification = verification; },
    [title, category, content, verification]);
  useEffect(() => () => { abortRef.current = true; }, []);

  const handleCompile = () => {
    if (pinnedNodes.length === 0 || !title.trim()) return;
    setContent(compileTemplate(title, category, pinnedNodes));
    setVerification(null);
  };

  /** Corroboration audit: check each pinned report against current reporting from other outlets. */
  const handleAudit = async () => {
    if (isOffline || !content || isVerifying) return;
    setIsVerifying(true);
    setErrorMsg(null);
    abortRef.current = false;
    const nodes = pinnedNodes.slice(0, 8);
    const findings: string[] = [];
    const sources: { name: string; url: string }[] = [];
    let total = 0; let corroborated = 0; let limited = 0;
    try {
      for (let i = 0; i < nodes.length; i++) {
        if (abortRef.current) return;
        setAuditStage(`Checking report ${i + 1} of ${nodes.length}`);
        const r = await corroborate(nodes[i].content);
        total += r.score;
        if (r.status === 'CORROBORATED') corroborated++; else if (r.status === 'LIMITED') limited++;
        findings.push(`Report ${i + 1}: ${r.status.toLowerCase()} (${r.outlets} outlet${r.outlets === 1 ? '' : 's'}): ${nodes[i].content.slice(0, 90)}`);
        r.matches.slice(0, 2).forEach(m => { if (!sources.some(s => s.url === m.url)) sources.push({ name: `${m.source}: ${m.title}`, url: m.url }); });
      }
      const score = nodes.length ? Math.round(total / nodes.length) : 0;
      const verdict: ReportVerification['verdict'] = corroborated >= Math.ceil(nodes.length / 2) ? 'CORROBORATED' : corroborated + limited > 0 ? 'PARTIAL' : 'UNCORROBORATED';
      setVerification({
        score, verdict, findings, sources: sources.slice(0, 10), checkedAt: Date.now(),
        auditorLogic: `${corroborated} of ${nodes.length} reports are carried by three or more independent outlets; ${limited} by one or two.`,
      });
    } catch (e: any) {
      setErrorMsg(`Audit failed: ${e?.message || 'the news search could not be reached.'}`);
    } finally {
      setIsVerifying(false);
      setAuditStage('');
    }
  };

  // Optional AI draft from the pinned reports; sources keep the same numbering.
  const aiSources = () => pinnedNodes.slice(0, 25).map(n => ({ title: n.content, source: n.source, url: n.url, published: n.published }));
  const aiDraft = (
    <AiAssist
      task="report"
      label="Draft with AI"
      disabled={pinnedNodes.length === 0 || !title.trim() || isOffline}
      getInput={() => {
        if (!pinnedNodes.length) throw new Error('Pin at least one report first.');
        return { title, category, sources: aiSources() };
      }}
      onUse={text => {
        const src = aiSources();
        setContent(`${title.toUpperCase()}\nCategory: ${category} · AI-assisted draft from ${src.length} pinned reports\n\n${text}\n\nSOURCES\n${src.map((x, i) => `[${i + 1}] ${x.source}: ${x.title}${x.url ? ` ${x.url}` : ''}`).join('\n')}`);
        setVerification(null);
      }}
      useLabel="Put in report editor"
    />
  );

  const brand = () => {
    const st = localPref<any>('settings', null);
    return `CALIBREX OSINT STUDIO\nCLASSIFICATION: ${st?.classification || 'CONFIDENTIAL'}\nPREPARED BY: ${st?.role || 'Intelligence Analyst'}\n\n`;
  };

  const handleDownloadTxt = useCallback(async () => {
    if (!content) return;
    const ok = await saveFile(`${(title || 'report').replace(/\s+/g, '_')}_REPORT.txt`, brand() + content);
    if (!ok) setErrorMsg('The download could not start. Use Copy instead.');
  }, [content, title]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!content) return;
    if (await copyText(content)) { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }
    else setErrorMsg('Copy was blocked by the browser. Select the report text and copy it manually.');
  }, [content]);

  const handleArchiveReport = useCallback(() => {
    if (!content || !currentUser?.id) return;
    onArchiveReport({ id: Date.now().toString(), title, date: new Date().toLocaleDateString(), format: 'ARCHIVED', content, verification: verification || undefined, userId: currentUser.id });
    setArchiveSuccess(true);
    setTimeout(() => setArchiveSuccess(false), 2000);
  }, [content, currentUser, title, verification, onArchiveReport]);

  const verdictClass = (v: string) => v === 'CORROBORATED' ? 'bg-calibrex-low/10 border-calibrex-low text-calibrex-low' : v === 'PARTIAL' ? 'bg-calibrex-high/10 border-calibrex-high text-calibrex-high' : 'bg-calibrex-critical/10 border-calibrex-critical text-calibrex-critical';

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-24 relative z-10">
      {isVerifying && (
        <div className="fixed top-0 left-0 w-full h-1 bg-black/40 z-[120] overflow-hidden">
          <div className="h-full w-1/3 bg-calibrex-gold shadow-[0_0_10px_#c9a961] calibrex-indeterminate" />
          <div className="absolute top-2 right-4 text-[9px] font-mono text-calibrex-gold uppercase tracking-widest bg-black/80 px-2 py-1 rounded-md border border-white/10 flex items-center gap-2">
            <Loader2 size={10} className="animate-spin" /> AUDIT ENGINE · {auditStage}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-calibrex-critical/20 border border-calibrex-critical/40 p-4 rounded-xl mb-6 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <AlertCircle className="text-calibrex-critical" size={20} />
             <span className="text-[11px] font-black text-white">{errorMsg}</span>
           </div>
           <button onClick={() => setErrorMsg(null)} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
            <div className="bg-calibrex-surface backdrop-blur-md border border-white/5 rounded-2xl p-4 sm:p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                    <h3 className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em]">Source Intel Nodes</h3>
                    <span className="text-[10px] font-mono text-white/40">{pinnedNodes.length} BUFFERED</span>
                </div>
                <div className="space-y-4 max-h-[300px] lg:max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                    {pinnedNodes.length === 0 ? (
                        <div className="py-12 text-center flex flex-col items-center gap-4">
                          <p className="text-white/50 italic text-xs uppercase tracking-widest">No reports pinned yet.</p>
                          {onGoResearch && <button onClick={onGoResearch} className="px-4 py-2 bg-calibrex-teal/10 border border-calibrex-teal/30 text-calibrex-teal text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-calibrex-teal/20 flex items-center gap-2"><Search size={12} /> Open Intelligence Research</button>}
                        </div>
                    ) : pinnedNodes.map((node) => (
                        <div key={node.id} className="bg-black/40 border border-white/5 p-4 rounded-xl relative group hover:border-calibrex-teal/30 transition-all">
                            <button onClick={() => onRemoveNode(node.id)} title="Remove" className="absolute top-2 right-2 text-calibrex-critical opacity-60 hover:opacity-100 p-1 hover:bg-calibrex-critical/10 rounded"><Trash2 size={14} /></button>
                            <div className="text-[8px] font-mono text-calibrex-teal mb-1 uppercase tracking-tighter pr-6">{node.timestamp} | {node.source}</div>
                            <p className="text-[11px] leading-relaxed text-white/80">{node.content}</p>
                            {node.url && <a href={node.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-calibrex-teal hover:underline inline-flex items-center gap-1 mt-1">Open <ExternalLink size={9} /></a>}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
            <div className="bg-calibrex-surface backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                    <div className="p-3.5 bg-calibrex-teal/10 rounded-xl border border-calibrex-teal/20 text-calibrex-teal"><Zap size={24} /></div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-[0.1em]">Synthesis Pipeline</h2>
                        <p className="text-[10px] text-calibrex-muted uppercase font-mono tracking-[0.2em] opacity-60">Operational Dossier Compilation</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label htmlFor="report-title" className="block text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] mb-2.5">Dispatch Designation</label>
                        <input id="report-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter brief title..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
                    </div>
                    <div>
                        <label htmlFor="report-category" className="block text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] mb-2.5">Strategic Axis</label>
                        <select id="report-category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-calibrex-teal appearance-none">
                            <option>General Intelligence</option>
                            <option>Geopolitical Conflict</option>
                            <option>Financial Oversight</option>
                            <option>Cyber Infrastructure</option>
                        </select>
                    </div>
                </div>

                {!content ? (
                    <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4 bg-black/20 rounded-2xl border border-white/5 text-center group">
                        <Sparkles size={48} className="text-calibrex-teal mb-6 opacity-30 group-hover:opacity-50 transition-opacity duration-700" />
                        <button onClick={handleCompile} disabled={pinnedNodes.length === 0 || !title.trim()} className="px-10 py-4 bg-calibrex-teal/80 hover:bg-calibrex-teal text-calibrex-navy font-black text-[11px] uppercase tracking-[0.3em] rounded-xl transition-all disabled:opacity-30 shadow-2xl flex items-center gap-3 active:scale-95">
                            <Zap size={18} /> Compile Brief
                        </button>
                        <p className="text-[10px] text-white/60 uppercase tracking-widest mt-4">
                          {pinnedNodes.length === 0 ? 'Pin at least one report in Intelligence Research.' : !title.trim() ? 'Enter a dispatch designation to begin.' : `${pinnedNodes.length} report${pinnedNodes.length === 1 ? '' : 's'} ready. You write the analysis sections.`}
                        </p>
                        <div className="mt-6 w-full max-w-2xl text-left">{aiDraft}</div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <h4 className="text-[10px] font-black text-calibrex-gold uppercase tracking-widest flex items-center gap-2"><FileSearch size={14} /> Draft Dispatch (editable)</h4>
                            {verification ? (
                                <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${verdictClass(verification.verdict)}`}>
                                    <ShieldCheck size={12} /> {verification.verdict} • {verification.score}% SCORE
                                </div>
                            ) : (
                                <button onClick={handleAudit} disabled={isVerifying || isOffline || pinnedNodes.length === 0} className="px-4 py-1.5 bg-calibrex-gold/20 hover:bg-calibrex-gold border border-calibrex-gold/40 text-calibrex-gold hover:text-calibrex-navy text-[9px] font-black uppercase tracking-widest rounded-full transition-all flex items-center gap-2 disabled:opacity-40">
                                    {isVerifying ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                                    {isVerifying ? `${auditStage}…` : 'Run Corroboration Audit'}
                                </button>
                            )}
                        </div>

                        {verification && (
                          <div className="bg-black/30 border border-white/10 rounded-xl p-4 text-[11px] text-white/70 space-y-2">
                            <p className="italic">{verification.auditorLogic}</p>
                            <ul className="list-disc pl-5 space-y-1">{verification.findings.map((f, i) => <li key={i}>{f}</li>)}</ul>
                            {verification.sources && verification.sources.length > 0 && (
                              <div className="pt-2 border-t border-white/10 space-y-1">
                                <div className="text-[9px] font-mono text-white/50 uppercase tracking-widest">Matching reports · checked {verification.checkedAt ? new Date(verification.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                                {verification.sources.map((x, i) => <a key={i} href={x.url} target="_blank" rel="noopener noreferrer" className="block text-calibrex-teal hover:underline truncate">↗ {x.name}</a>)}
                              </div>
                            )}
                            <button onClick={() => { setVerification(null); handleAudit(); }} disabled={isVerifying || isOffline} className="mt-2 px-3 py-1.5 border border-calibrex-gold/30 text-calibrex-gold rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-calibrex-gold/10 disabled:opacity-40">Re-run audit</button>
                          </div>
                        )}

                        {aiDraft}

                        <textarea id="report-body" value={content} onChange={(e) => setContent(e.target.value)} spellCheck className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 sm:p-8 h-[360px] lg:h-[480px] custom-scrollbar font-sans leading-relaxed text-sm text-white/90 focus:outline-none focus:border-calibrex-teal resize-y" />

                        <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
                            <button onClick={handleCompile} disabled={pinnedNodes.length === 0} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-30">Rebuild From Buffer</button>
                            <button onClick={() => onProceedToDispatch({ title, category, content, verification: verification || undefined })} className="px-10 py-3 bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-xl hover:bg-white">
                                Open Dispatch Studio <ChevronRight size={14} />
                            </button>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/5 flex flex-wrap justify-center sm:justify-end gap-3 sm:gap-4">
                            <button onClick={handleDownloadTxt} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2"><Download size={14} /> TXT</button>
                            <button onClick={handleCopyToClipboard} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2">{copySuccess ? <Check size={14} /> : <Copy size={14} />} Copy</button>
                            <button onClick={handleArchiveReport} disabled={archiveSuccess} className="px-4 py-2 bg-calibrex-teal/10 hover:bg-calibrex-teal border border-calibrex-teal/30 text-calibrex-teal hover:text-calibrex-navy text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2">{archiveSuccess ? <Check size={14} /> : <Archive size={14} />} Archive</button>
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
