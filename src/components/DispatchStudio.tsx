import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Copy, Check, Download, Radio, ShieldCheck, Lock, Zap, History, Loader2, WifiOff, FileDown, ShieldAlert } from 'lucide-react';
import { ReportHistoryItem, ReportVerification } from '../types';
import { saveFile, copyText, dossierHtml } from '../lib/claude';

interface DispatchStudioProps {
  reportData: { title: string; category: string; content: string; verification?: ReportVerification };
  history: ReportHistoryItem[];
  onFinalize: (item: ReportHistoryItem) => void;
  onNotify?: (msg: string) => void;
  isOffline?: boolean;
}

// Remember which reports already played the uplink sequence / were released.
const seen = new Set<string>();
const released = new Set<string>();

const DispatchStudio: React.FC<DispatchStudioProps> = ({ reportData, history, onFinalize, onNotify, isOffline }) => {
  const reportKey = reportData.title + '|' + reportData.content.length;
  const [copySuccess, setCopySuccess] = useState(false);
  const [isFinalized, setIsFinalized] = useState(released.has(reportKey));
  const [transmissionStatus, setTransmissionStatus] = useState<'receiving' | 'decrypting' | 'ready'>(seen.has(reportKey) ? 'ready' : 'receiving');
  const [progress, setProgress] = useState(0);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authProgress, setAuthProgress] = useState(0);
  const channel = useMemo(() => Math.random().toString(16).slice(2, 8).toUpperCase(), []);

  const authTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authStartRef = useRef(0);

  useEffect(() => {
    if (isOffline) {
      setTransmissionStatus('ready');
      setProgress(100);
      return;
    }

    if (transmissionStatus === 'ready') { seen.add(reportKey); return; }
    const intervalId = setInterval(() => {
      setProgress(prev => {
        const next = prev + 5;
        if (next >= 100) {
          if (transmissionStatus === 'receiving') {
            setTransmissionStatus('decrypting');
            return 0;
          } else {
            setTransmissionStatus('ready');
            return 100;
          }
        }
        return next;
      });
    }, 80);
    return () => clearInterval(intervalId);
  }, [transmissionStatus, isOffline, reportKey]);

  useEffect(() => () => { if (authTimerRef.current) clearInterval(authTimerRef.current); }, []);

  const handleDownloadTxt = async () => {
    const brandedContent = `CALIBREX OSINT STUDIO\nTITLE: ${reportData.title}\nCATEGORY: ${reportData.category}\n\n${reportData.content}`;
    const ok = await saveFile(`${reportData.title.replace(/\s+/g, '_')}_DISPATCH.txt`, brandedContent);
    if (!ok) onNotify?.('Download unavailable in this viewer. Use Copy instead.');
  };

  const handleCopyToClipboard = async () => {
    if (await copyText(reportData.content)) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } else onNotify?.('Copy was blocked by this viewer. Select the text and copy it manually.');
  };

  const handleDossier = async () => {
    const html = dossierHtml(reportData.title, reportData.content, {
      CATEGORY: reportData.category,
      DATE: new Date().toLocaleDateString(),
      ...(reportData.verification ? { AUDIT: `${reportData.verification.verdict} (${reportData.verification.score}% confidence)` } : {}),
    });
    const ok = await saveFile(`${reportData.title.replace(/\s+/g, '_')}_DOSSIER.html`, html);
    if (!ok) onNotify?.('Download unavailable in this viewer. Use Copy instead.');
  };

  const finalizeDispatch = () => {
    if (released.has(reportKey)) return;
    released.add(reportKey);
    setIsFinalized(true);
    setIsAuthorizing(false);
    onFinalize({
        id: Date.now().toString(),
        title: reportData.title,
        date: new Date().toLocaleDateString(),
        format: 'NEWS-WIRE',
        content: reportData.content,
        verification: reportData.verification,
        userId: 'temp-user-id' // App.tsx overrides with the session ID
    });
  };

  // Hold for ~3 seconds to release. Letting go early cancels.
  const HOLD_MS = 3000;
  const startAuthorization = () => {
    if (isOffline || isFinalized || authTimerRef.current) return;
    setIsAuthorizing(true);
    setAuthProgress(0);
    authStartRef.current = Date.now();
    authTimerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - authStartRef.current) / HOLD_MS) * 100);
      setAuthProgress(pct);
      if (pct >= 100) {
        clearInterval(authTimerRef.current!);
        authTimerRef.current = null;
        finalizeDispatch();
      }
    }, 50);
  };

  const cancelAuthorization = () => {
    if (!authTimerRef.current) return;
    clearInterval(authTimerRef.current);
    authTimerRef.current = null;
    setIsAuthorizing(false);
    setAuthProgress(0);
  };

  if (transmissionStatus !== 'ready') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-calibrex-dark/95 backdrop-blur-3xl animate-in fade-in">
        <div className="w-full max-w-sm space-y-12 text-center">
          <div className="relative inline-block group">
             <div className="absolute inset-0 bg-calibrex-teal/30 blur-3xl rounded-full animate-pulse group-hover:bg-calibrex-teal/50 transition-all"></div>
             <Radio size={72} className="text-calibrex-teal mx-auto animate-bounce relative z-10" />
          </div>
          <div className="space-y-4">
            <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.3em] sm:tracking-[0.4em] leading-tight">{transmissionStatus === 'receiving' ? 'Establishing Tactical Uplink' : 'Signal Decryption'}</h3>
            <p className="text-[10px] font-mono text-calibrex-teal/50 uppercase tracking-[0.3em]">Channel: {channel}-OSINT</p>
          </div>
          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5 shadow-inner">
             <div className="h-full bg-calibrex-teal shadow-[0_0_15px_#2a8a9a] transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-calibrex-dark/40 backdrop-blur-sm p-4 sm:p-6 lg:p-10 relative pb-24 min-h-full">
      {isAuthorizing && (
        <div className="fixed top-0 left-0 w-full h-1 bg-black/40 z-[200]">
          <div className="h-full bg-calibrex-critical shadow-[0_0_10px_#ff4444] transition-all duration-300" style={{ width: `${authProgress}%` }} />
          <div className="absolute top-2 right-4 text-[8px] font-mono text-calibrex-critical uppercase tracking-widest bg-black/80 px-2 py-1 rounded-md backdrop-blur-md border border-calibrex-critical/20 flex items-center gap-2">
            <Loader2 size={10} className="animate-spin" />
            HOLD TO RELEASE: {Math.round(authProgress)}%
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 xl:grid-cols-4 gap-6 sm:gap-10 min-w-0">
          <div className="xl:col-span-3 space-y-8 min-w-0">
            <div className={`bg-[#0b131c]/90 border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-12 lg:p-16 shadow-2xl relative overflow-hidden min-h-[400px] sm:min-h-[600px]`}>
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(42,138,154,0.03),rgba(201,169,97,0.02),rgba(42,138,154,0.03))] bg-[size:100%_4px,5px_100%] z-[60] opacity-40"></div>
              
              <article className="max-w-3xl mx-auto space-y-10 lg:space-y-14 relative z-10">
                  <header className="space-y-8">
                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-white/50 uppercase tracking-[0.2em] bg-white/5 px-5 py-2.5 rounded-full border border-white/5 w-fit backdrop-blur-md">
                      <span className="text-calibrex-teal font-black">DATELINE:</span> {new Date().toLocaleDateString()}
                      {reportData.verification && (
                        <>
                          <span className="opacity-20">/</span>
                          <span className={`font-black flex items-center gap-2 ${reportData.verification.verdict === 'VERIFIED' ? 'text-calibrex-low' : reportData.verification.verdict === 'CAUTION' ? 'text-calibrex-high' : 'text-calibrex-critical'}`}>{reportData.verification.verdict === 'VERIFIED' ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />} AUDIT: {reportData.verification.verdict}</span>
                        </>
                      )}
                    </div>
                    <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black text-white uppercase tracking-tight leading-[0.9] drop-shadow-lg break-words">
                        {reportData.title}
                    </h1>
                    <div className="flex items-center gap-4 p-5 bg-calibrex-gold/10 border border-calibrex-gold/30 rounded-2xl w-fit shadow-lg backdrop-blur-md">
                       <Zap size={20} className="text-calibrex-gold" />
                       <span className="text-xs font-black text-calibrex-gold uppercase tracking-[0.3em]">{reportData.category}</span>
                    </div>
                  </header>
                  <div className="font-sans text-base sm:text-lg lg:text-xl text-white/90 select-text leading-relaxed whitespace-pre-wrap first-letter:text-6xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:text-calibrex-gold first-letter:leading-none">
                    {reportData.content}
                  </div>
              </article>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-calibrex-surface/80 border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl space-y-8 backdrop-blur-xl sticky top-6">
              <h3 className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] border-b border-white/5 pb-4">Protocol Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={handleCopyToClipboard} className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border bg-white/5 border-white/10 text-white hover:bg-white/10 transition-all active:scale-95 group">
                   {copySuccess ? <Check size={24} className="text-calibrex-low" /> : <Copy size={24} className="text-white/40 group-hover:text-white transition-colors" />}
                   <span className="text-[9px] font-black uppercase tracking-widest">Copy</span>
                 </button>
                 <button onClick={handleDownloadTxt} className="flex flex-col items-center justify-center gap-3 p-5 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl transition-all active:scale-95 group">
                   <Download size={24} className="text-white/40 group-hover:text-white transition-colors" />
                   <span className="text-[9px] font-black uppercase tracking-widest">TXT</span>
                 </button>
                 <button onClick={handleDossier} className="flex flex-col items-center justify-center gap-3 p-5 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl transition-all active:scale-95 group col-span-2">
                   <FileDown size={24} className="text-white/40 group-hover:text-white transition-colors" />
                   <span className="text-[9px] font-black uppercase tracking-widest">Download Print Dossier</span>
                 </button>
              </div>

              {!isFinalized && (
                <div className="pt-6 border-t border-white/10 space-y-6">
                   <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] text-center flex items-center justify-center gap-2">
                      Identity Clearance Required 
                      {isOffline && (
                        <span className="flex items-center gap-1 text-calibrex-critical ml-2">
                          <WifiOff size={12} /> OFFLINE
                        </span>
                      )}
                   </div>
                   <button 
                     onPointerDown={(e) => { e.preventDefault(); startAuthorization(); }}
                     onPointerUp={cancelAuthorization}
                     onPointerLeave={cancelAuthorization}
                     onPointerCancel={cancelAuthorization}
                     onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); startAuthorization(); } }}
                     onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') cancelAuthorization(); }}
                     onContextMenu={(e) => e.preventDefault()}
                     disabled={isOffline}
                     style={{ touchAction: 'none', userSelect: 'none' }}
                     className={`w-full py-5 rounded-2xl font-black text-[12px] uppercase tracking-[0.4em] transition-all relative overflow-hidden flex items-center justify-center gap-3 shadow-2xl active:scale-95
                       ${isOffline 
                         ? 'bg-calibrex-critical/20 border border-calibrex-critical/40 text-calibrex-critical opacity-50 cursor-not-allowed'
                         : 'bg-calibrex-teal border border-calibrex-teal text-calibrex-navy hover:bg-white hover:border-white'
                       }
                     `}
                   >
                     {isAuthorizing && (
                       <div className="absolute inset-y-0 left-0 bg-white opacity-40 transition-all" style={{ width: `${authProgress}%` }} />
                     )}
                     <Lock size={18} />
                     <span className="relative">{isOffline ? 'SYSTEM OFFLINE' : isAuthorizing ? 'RELEASING...' : 'Hold to Dispatch'}</span>
                   </button>
                </div>
              )}
              {isFinalized && (
                 <div className="p-6 border border-calibrex-low/30 bg-calibrex-low/10 rounded-2xl flex items-center gap-5 animate-in slide-in-from-bottom-2">
                    <ShieldCheck className="text-calibrex-low" size={32} />
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black text-calibrex-low uppercase tracking-widest leading-none">Dispatch Released</span>
                        <span className="text-[9px] text-white/50 uppercase font-mono mt-1">Committed to Report History</span>
                    </div>
                 </div>
              )}
            </div>
            
            <div className="bg-calibrex-surface/80 border border-white/10 rounded-[2rem] p-8 shadow-2xl backdrop-blur-xl">
                 <h3 className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] mb-6 flex items-center gap-3"><History size={16} /> Audit Summary</h3>
                 <div className="space-y-5">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-black">Confidence Index</span>
                        <span className="text-xs font-black text-calibrex-teal">{reportData.verification ? `${reportData.verification.score}%` : 'NOT AUDITED'}</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-calibrex-teal shadow-[0_0_10px_#2a8a9a]" style={{ width: `${reportData.verification?.score || 0}%` }}></div>
                    </div>
                    {!reportData.verification && <p className="text-[10px] text-white/40 leading-relaxed">Run the AI Audit in the Report Generator to score this dispatch.</p>}
                    <div className="flex justify-between text-[10px] uppercase tracking-widest font-black pt-2 border-t border-white/5">
                        <span className="text-white/50">Archived dispatches</span>
                        <span className="text-white/80 tabular-nums">{history.length}</span>
                    </div>
                 </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default DispatchStudio;
