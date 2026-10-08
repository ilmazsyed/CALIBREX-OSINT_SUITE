import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Copy, Check, Archive } from 'lucide-react';
import { copyText } from '../lib/api';
import { addBrief } from '../lib/briefs';
import AiAssist from './AiAssist';

interface Source { title: string; source: string; url: string; published?: number; summary?: string; kind?: string }
interface Props {
  open: boolean;
  onClose: () => void;
  domain: string;              // Security | Business | Government | Politics | Markets
  title: string;               // short title for the filed brief
  text: string;                // the deterministic brief body
  sources?: Source[];          // optional, for the AI brief
  accent?: 'gold' | 'teal';
}

/**
 * The Rapid Brief overlay, shared by every dashboard. Portalled to <body> so it
 * is never trapped by a screen's stacking/overflow context (the earlier
 * "nothing happens" bug). Shows the brief, then lets the operator File it to
 * Briefs (separate from Reports) or copy it; an AI brief is offered when AI is
 * connected.
 */
const RapidBriefModal: React.FC<Props> = ({ open, onClose, domain, title, text, sources = [], accent = 'gold' }) => {
  const [copied, setCopied] = useState(false);
  const [filed, setFiled] = useState(false);
  if (!open) return null;

  const ac = accent === 'teal' ? 'text-calibrex-teal' : 'text-calibrex-gold';
  const doCopy = () => { copyText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); };
  const doFile = () => { addBrief({ title, domain, text }).then(() => { setFiled(true); setTimeout(() => setFiled(false), 2500); }).catch(() => {}); };

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/75 cx-fade" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="cx-glass cx-pop w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
          <span className={`text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${ac}`}><FileText size={15} /> Rapid Brief · {domain}</span>
          <button onClick={onClose} aria-label="Close" className="text-calibrex-muted hover:text-white"><X size={20} /></button>
        </div>

        <pre className="text-[11px] text-white/85 leading-relaxed whitespace-pre-wrap font-mono bg-black/30 rounded-lg border border-white/5 p-3">{text}</pre>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button onClick={doFile} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 ${filed ? 'bg-calibrex-low/20 text-calibrex-low border border-calibrex-low/40' : 'bg-calibrex-gold text-calibrex-navy hover:bg-white'}`}>
            {filed ? <><Check size={13} /> Filed to Briefs</> : <><Archive size={13} /> File to Briefs</>}
          </button>
          <button onClick={doCopy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/15 text-white hover:bg-white/10">
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-white/10">
          <AiAssist task="brief" label="write an AI brief" getInput={() => {
            if (!sources.length) throw new Error('No reports to brief on yet.');
            return { title: `${domain} — ${title}`, sources: sources.slice(0, 8).map(s => ({ title: s.title, source: s.source, url: s.url, published: s.published, summary: s.summary, kind: s.kind })) };
          }} />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RapidBriefModal;
