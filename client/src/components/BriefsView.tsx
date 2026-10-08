import React, { useEffect, useState } from 'react';
import { Archive, Copy, Check, Download, Trash2, FileText, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Brief, listBriefs, deleteBrief } from '../lib/briefs';
import { copyText, saveFile } from '../lib/api';
import { navigateTo } from './AiAssist';

const DOMAIN_CLS: Record<string, string> = {
  Security: 'text-calibrex-critical border-calibrex-critical/40',
  Business: 'text-calibrex-gold border-calibrex-gold/40',
  Government: 'text-calibrex-teal border-calibrex-teal/40',
  Politics: 'text-calibrex-gold border-calibrex-gold/40',
  Markets: 'text-calibrex-high border-calibrex-high/40',
};

const BriefsView: React.FC<{ onNotify?: (m: string) => void }> = ({ onNotify }) => {
  const [briefs, setBriefs] = useState<Brief[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = () => listBriefs().then(setBriefs).catch(() => setBriefs([]));
  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener('cx:briefs', h);
    return () => window.removeEventListener('cx:briefs', h);
  }, []);

  const copy = (b: Brief) => copyText(b.text).then(ok => { if (ok) { setCopiedId(b.id); setTimeout(() => setCopiedId(null), 1500); } });
  const download = (b: Brief) => saveFile(`${b.title.replace(/[^\w]+/g, '_').slice(0, 40)}_BRIEF.txt`, b.text);
  const remove = (b: Brief) => { deleteBrief(b.id).then(() => { refresh(); onNotify?.('Brief deleted.'); }); };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Archive size={22} className="text-calibrex-gold" /> Briefs</h1>
          <p className="text-[11px] sm:text-xs text-calibrex-muted mt-1 max-w-2xl">Rapid Briefs you've filed from any dashboard. Open one to read it, copy or download it, or carry it into a compiled report. Separate from Reports.</p>
        </div>
        <button onClick={() => navigateTo('reports')} className="flex items-center gap-1.5 border border-calibrex-teal/40 text-calibrex-teal hover:bg-calibrex-teal/10 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest"><FileText size={14} /> Compile in Reports</button>
      </div>

      {briefs === null ? (
        <div className="flex justify-center py-20 text-calibrex-gold"><Loader2 className="animate-spin" /></div>
      ) : briefs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 opacity-50 text-center px-4">
          <Archive size={40} className="mb-4" />
          <p className="text-[11px] font-black uppercase tracking-widest">No briefs filed yet</p>
          <p className="text-[11px] mt-2 max-w-sm">Open any dashboard, tap <b>Rapid Brief</b>, then <b>File to Briefs</b> — it lands here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {briefs.map(b => {
            const isOpen = openId === b.id;
            return (
              <div key={b.id} className="bg-calibrex-surface border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  <button onClick={() => setOpenId(isOpen ? null : b.id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                    {isOpen ? <ChevronDown size={15} className="shrink-0 text-white/40" /> : <ChevronRight size={15} className="shrink-0 text-white/40" />}
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-white truncate">{b.title || 'Untitled brief'}</span>
                      <span className="block text-[10px] font-mono text-white/40">{b.date}</span>
                    </span>
                  </button>
                  <span className={`shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${DOMAIN_CLS[b.domain] || 'text-white/60 border-white/20'}`}>{b.domain}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => copy(b)} title="Copy" className="p-1.5 rounded text-calibrex-muted hover:text-white">{copiedId === b.id ? <Check size={14} /> : <Copy size={14} />}</button>
                    <button onClick={() => download(b)} title="Download" className="p-1.5 rounded text-calibrex-muted hover:text-white"><Download size={14} /></button>
                    <button onClick={() => remove(b)} title="Delete" className="p-1.5 rounded text-calibrex-critical/70 hover:text-calibrex-critical"><Trash2 size={14} /></button>
                  </div>
                </div>
                {isOpen && <pre className="text-[11px] text-white/80 leading-relaxed whitespace-pre-wrap font-mono bg-black/30 border-t border-white/5 p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">{b.text}</pre>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BriefsView;
