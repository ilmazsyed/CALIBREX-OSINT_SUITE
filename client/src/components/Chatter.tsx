import React, { useEffect, useState } from 'react';
import { MessagesSquare, Loader2, RefreshCw, TrendingUp, Users, Search, FolderPlus, FileText, X, Copy, Download, Check, Flame } from 'lucide-react';
import { getChatter, getChatterReport, ChatterSnapshot } from '../lib/chatter';
import { addToCase } from '../lib/workbench';
import { timeAgo } from '../lib/live';
import { copyText, saveFile } from '../lib/api';

const Bars: React.FC<{ data: number[] }> = ({ data }) => {
  const max = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {data.map((v, i) => <div key={i} className="flex-1 bg-calibrex-teal/60 rounded-sm" style={{ height: `${Math.max(4, (v / max) * 100)}%` }} title={`${v}`} />)}
    </div>
  );
};

const Chatter: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [d, setD] = useState<ChatterSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => { setLoading(true); getChatter().then(x => { setD(x); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 5 * 60000); return () => clearInterval(t); }, []);

  const genReport = () => { setReportBusy(true); getChatterReport().then(r => setReport(r.report)).catch(e => setError(e.message)).finally(() => setReportBusy(false)); };
  const copyReport = async () => { if (report && await copyText(report)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  const downloadReport = () => report && saveFile(`calibrex_chatter_${new Date().toISOString().slice(0, 10)}.txt`, report);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><MessagesSquare size={20} className="text-calibrex-teal" /> Chatter Tracker</h2>
          <p className="text-sm text-calibrex-muted">Trending topics and volume across Reddit and OSINT social accounts{d ? ` · ${d.total} posts / 48h` : ''}. Unverified until corroborated.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={genReport} disabled={reportBusy || !d} className="px-3 py-2 rounded bg-calibrex-gold/15 border border-calibrex-gold/40 text-calibrex-gold text-sm flex items-center gap-1.5 disabled:opacity-50">{reportBusy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Report</button>
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh</button>
        </div>
      </div>

      {error && <p className="text-sm text-calibrex-critical">{error}</p>}

      {!d ? <div className="py-16 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div> : d.total === 0 ? (
        <p className="py-16 text-center text-sm text-calibrex-muted">No social chatter in the window yet. Reddit and social sources fill in as the server refreshes; some throttle cloud servers.</p>
      ) : (
        <>
          <section className="bg-calibrex-surface border border-white/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-black text-calibrex-gold uppercase tracking-widest">Volume · last 24h</span><span className="text-xs text-calibrex-muted">{d.recentCount} in last 12h</span></div>
            <Bars data={d.byHour.map(b => b.count)} />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
              <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3 flex items-center gap-2"><Flame size={15} /> Rising & trending</h3>
              <div className="flex flex-wrap gap-2">
                {d.terms.map(t => (
                  <button key={t.term} onClick={() => onInvestigate(t.term)} title="Investigate this topic" className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${t.rising ? 'bg-calibrex-gold/15 border-calibrex-gold/50 text-calibrex-gold' : 'border-white/10 text-calibrex-muted hover:text-white'}`}>
                    {t.rising && <TrendingUp size={11} />}{t.term}<span className="opacity-60 tabular-nums">{t.count}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={15} /> Most active communities</h3>
              <div className="space-y-1.5">
                {d.sources.map(s => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 text-sm text-white truncate">{s.name}</span>
                    <div className="flex-1 h-2 bg-white/5 rounded"><div className="h-2 rounded bg-calibrex-teal" style={{ width: `${(s.count / d.sources[0].count) * 100}%` }} /></div>
                    <span className="w-8 text-right text-xs tabular-nums text-calibrex-muted">{s.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section>
            <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest mb-3">Latest posts</h3>
            <div className="bg-calibrex-surface border border-white/10 rounded-lg overflow-hidden">
              {d.posts.map(p => (
                <div key={p.id} className="flex items-start gap-3 py-2.5 px-3 border-b border-white/5 hover:bg-white/5 group">
                  <div className="min-w-0 flex-1">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:text-calibrex-teal block line-clamp-2">{p.title}</a>
                    <div className="text-[11px] text-calibrex-muted mt-0.5">{p.source} · {timeAgo(p.published)}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onInvestigate(p.title)} title="Research" className="p-1 text-calibrex-gold hover:text-white"><Search size={14} /></button>
                    <button onClick={() => addToCase({ id: p.id, title: p.title, url: p.url, source: p.source, wire: p.wire, severity: p.severity as any, published: p.published })} title="Add to case" className="p-1 text-calibrex-teal hover:text-white"><FolderPlus size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {report !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 cx-fade" onClick={() => setReport(null)}>
          <div className="cx-glass cx-pop rounded-2xl w-full max-w-2xl p-5 shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2"><FileText size={17} className="text-calibrex-gold" /> Chatter report</h3>
              <button onClick={() => setReport(null)} className="text-calibrex-muted hover:text-white"><X size={18} /></button>
            </div>
            <pre className="flex-1 overflow-y-auto custom-scrollbar text-[12.5px] text-white/85 whitespace-pre-wrap font-sans leading-relaxed bg-black/30 rounded-lg p-4 border border-white/10">{report}</pre>
            <div className="flex gap-3 mt-4">
              <button onClick={copyReport} className="flex-1 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2">{copied ? <Check size={14} /> : <Copy size={14} />} Copy</button>
              <button onClick={downloadReport} className="px-4 py-2.5 rounded-lg border border-white/15 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2"><Download size={14} /> TXT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatter;
