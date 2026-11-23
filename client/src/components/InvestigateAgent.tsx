import React, { useRef, useState } from 'react';
import { X, Sparkles, Loader2, Search, Globe, FileText, ShieldCheck, Radar, Square, Download, RotateCcw, AlertCircle } from 'lucide-react';
import { ai, useAiStatus, shortModel } from '../lib/features';
import { navigateTo } from './AiAssist';
import ReportDoc from './ReportDoc';
import { templateById, emptyReport, ReportData } from '../lib/reportTemplates';

/**
 * AI investigation agent — the user's own model runs a tool-use loop (Calibrex
 * search, its own web search, article reading, corroboration, sanctions) and
 * compiles a finished Intelligence Brief, streamed live. Runs on the user's key;
 * additive — the brief is a normal, reviewable/exportable report artifact.
 */
type Ev = { type: string; tool?: string; args?: any; summary?: string; text?: string; data?: any; error?: string; model?: string };

const TOOL_ICON: Record<string, React.ReactNode> = {
  search_intelligence: <Search size={13} />, web_search: <Globe size={13} />, read_article: <FileText size={13} />,
  corroborate_claim: <ShieldCheck size={13} />, screen_sanctions: <Radar size={13} />, compile_intelligence_brief: <FileText size={13} />,
};
const TOOL_LABEL: Record<string, string> = {
  search_intelligence: 'Searching Calibrex feeds', web_search: 'Searching the web', read_article: 'Reading a page',
  corroborate_claim: 'Corroborating a claim', screen_sanctions: 'Screening sanctions', compile_intelligence_brief: 'Compiling the brief',
};

function briefToReport(b: any): ReportData {
  const t = templateById('intel-brief');
  const d = emptyReport(t);
  d.tag = b.tag || '';
  d.sections = { bottomLine: b.bottomLine || '', assessment: b.assessment || '', whatWouldChange: b.whatWouldChange || '', indicators: b.indicators || '', limits: b.limits || '' };
  d.tables = { timeline: Array.isArray(b.timeline) ? b.timeline.map((r: any) => ({ time: r.time || '', event: r.event || '', source: r.source || '', status: String(r.status || '').toUpperCase() })) : [] };
  d.confidence = ['LOW', 'MODERATE', 'HIGH'].includes(String(b.confidence || '').toUpperCase()) ? String(b.confidence).toUpperCase() : 'MODERATE';
  d.sources = Array.isArray(b.sources) ? b.sources.map((s: any) => ({ name: s.name || '', url: s.url || '' })) : [];
  d.preparedBy = 'AI investigation'; d.classification = 'OSINT';
  return d;
}

const InvestigateAgent: React.FC<{ onClose: () => void; initialQuestion?: string }> = ({ onClose, initialQuestion = '' }) => {
  const { status, ready } = useAiStatus();
  const [question, setQuestion] = useState(initialQuestion);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<Ev[]>([]);
  const [brief, setBrief] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const push = (e: Ev) => { setEvents(ev => [...ev, e]); setTimeout(() => logRef.current?.scrollTo({ top: 1e9 }), 0); };

  const run = async () => {
    if (!question.trim() || running) return;
    setRunning(true); setErr(null); setEvents([]); setBrief(null);
    const ctl = new AbortController(); abortRef.current = ctl;
    try {
      await ai.agent(question.trim(), '', (e: Ev) => {
        if (e.type === 'open') setModel(e.model || '');
        else if (e.type === 'brief') setBrief(e.data);
        else if (e.type === 'error') setErr(e.error || 'The investigation failed.');
        else if (e.type !== 'done') push(e);
      }, ctl.signal);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setErr(e?.message || 'The investigation could not run.');
    } finally { setRunning(false); abortRef.current = null; }
  };
  const stop = () => { abortRef.current?.abort(); setRunning(false); };
  const reset = () => { setBrief(null); setEvents([]); setErr(null); };

  return (
    <div className="fixed inset-0 z-[1300] bg-calibrex-dark/95 backdrop-blur-sm flex flex-col">
      <div className="cx-no-print flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 shrink-0">
        <div><div className="cx-eyebrow mb-0.5">Investigate with AI</div><h2 className="font-display text-base text-white">AI Investigation</h2></div>
        <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          {!status?.enabled ? (
            <p className="text-[13px] text-white/60 py-10 text-center">AI is switched off for this workspace.</p>
          ) : !ready ? (
            <div className="py-10 text-center">
              <p className="text-[13px] text-white/70 mb-3">Connect Claude, Gemini or ChatGPT to run an AI investigation on your own key.</p>
              <button onClick={() => { onClose(); navigateTo('settings'); }} className="px-4 py-2 rounded-lg bg-calibrex-teal text-calibrex-navy text-[11px] font-black uppercase tracking-widest">Connect an AI</button>
            </div>
          ) : (
            <>
              {/* prompt */}
              <div className="cx-no-print cx-card rounded-xl p-4 mb-4">
                <label className="block text-[9px] font-black text-calibrex-gold uppercase tracking-[0.18em] mb-1.5"><Sparkles size={11} className="inline mr-1" /> What should I investigate?</label>
                <textarea value={question} onChange={e => setQuestion(e.target.value)} disabled={running} rows={2}
                  placeholder="e.g. What's happening with shipping in the Red Sea this week, and how corroborated is it?"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-calibrex-teal resize-y disabled:opacity-60" />
                <div className="mt-2 flex items-center gap-3">
                  {running ? (
                    <button onClick={stop} className="px-4 py-2 rounded-lg bg-calibrex-critical/15 border border-calibrex-critical/40 text-calibrex-critical text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5"><Square size={13} /> Stop</button>
                  ) : (
                    <button onClick={run} disabled={!question.trim()} className="px-5 py-2 rounded-lg bg-calibrex-gold text-calibrex-navy text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"><Sparkles size={14} /> Investigate</button>
                  )}
                  <span className="text-[10px] text-white/40">Runs on your connected AI {model && `· ${shortModel(model)}`} — including its own web search. Review everything it produces.</span>
                </div>
              </div>

              {err && <div className="cx-no-print bg-calibrex-critical/15 border border-calibrex-critical/40 text-[12px] text-white px-3 py-2 rounded-lg mb-4 flex items-start gap-2"><AlertCircle size={15} className="shrink-0 mt-0.5 text-calibrex-critical" />{err}</div>}

              {/* live step log */}
              {(running || events.length > 0) && (
                <div ref={logRef} className="cx-no-print cx-card rounded-xl p-3 mb-4 max-h-56 overflow-y-auto custom-scrollbar space-y-1.5">
                  {events.map((e, i) => (
                    e.type === 'thought' ? (
                      <p key={i} className="text-[11.5px] text-white/55 italic leading-snug px-1">{e.text}</p>
                    ) : e.type === 'step' ? (
                      <div key={i} className="flex items-center gap-2 text-[11.5px] text-calibrex-teal"><span className="text-calibrex-teal">{TOOL_ICON[e.tool!] || <Radar size={13} />}</span><span className="font-bold">{TOOL_LABEL[e.tool!] || e.tool}</span><span className="text-white/40 truncate">{e.args?.query || e.args?.claim || e.args?.url || e.args?.name || ''}</span></div>
                    ) : e.type === 'result' ? (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-white/45 pl-5">↳ {e.summary}</div>
                    ) : null
                  ))}
                  {running && <div className="flex items-center gap-2 text-[11px] text-calibrex-gold pl-1"><Loader2 size={12} className="animate-spin" /> working…</div>}
                </div>
              )}

              {/* final brief */}
              {brief && (
                <>
                  <div className="cx-no-print flex items-center justify-end gap-2 mb-3">
                    <button onClick={reset} className="px-4 py-2 rounded-lg border border-white/15 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><RotateCcw size={13} /> New</button>
                    <button onClick={() => window.print()} className="px-5 py-2 rounded-lg bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Download size={14} /> Save as PDF</button>
                  </div>
                  <ReportDoc data={briefToReport(brief)} />
                  <p className="cx-no-print text-[10px] text-white/35 mt-3 text-center">AI-compiled from observed reporting and the sources shown — review before use. Not a forecast.</p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvestigateAgent;
