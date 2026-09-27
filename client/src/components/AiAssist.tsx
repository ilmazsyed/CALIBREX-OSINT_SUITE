import React, { useState } from 'react';
import { Sparkles, Loader2, Copy, X } from 'lucide-react';
import { ai, useAiStatus, AiTask, shortModel } from '../lib/features';
import { copyText } from '../lib/api';

/** Ask the app shell to switch screens (used by the "connect AI" hint). */
export const navigateTo = (view: string) => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: view }));

interface Props {
  task: AiTask;
  label: string;
  /** Builds the request input when clicked; throw to show a message instead. */
  getInput: () => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Optional: offer a button that hands the text back (e.g. into the report editor). */
  onUse?: (text: string) => void;
  useLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Optional AI helper. Hidden when the owner has AI switched off; shows a
 * one-line prompt to connect when the operator has not connected an AI yet.
 */
const AiAssist: React.FC<Props> = ({ task, label, getInput, onUse, useLabel = 'Use this', disabled, className = '' }) => {
  const { status, ready } = useAiStatus();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [meta, setMeta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!status?.enabled) return null;
  if (!ready) {
    return (
      <button type="button" onClick={() => navigateTo('settings')} className={`text-xs text-calibrex-muted hover:text-calibrex-teal flex items-center gap-1.5 ${className}`} title="Optional: connect Claude, ChatGPT or Gemini in Settings">
        <Sparkles size={13} /> Connect an AI in Settings to {label.toLowerCase()}
      </button>
    );
  }

  const run = async () => {
    setBusy(true); setError(null); setText(null);
    try {
      const input = await getInput();
      const r = await ai.generate(task, input);
      setText(r.text);
      setMeta(`${shortModel(r.model)} · ${new Date(r.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e: any) {
      setError(e?.message || 'The AI request failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <button type="button" onClick={run} disabled={busy || disabled} className="ai-assist-btn inline-flex items-center gap-2 px-3 py-2 rounded border border-calibrex-gold/40 bg-calibrex-gold/10 text-calibrex-gold text-xs font-black uppercase tracking-wider hover:bg-calibrex-gold/20 disabled:opacity-50" title="Uses your connected AI account and only the sources shown here">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {busy ? 'Working…' : label}
      </button>
      {error && <div role="alert" className="mt-2 text-sm text-calibrex-critical">{error}</div>}
      {text && (
        <div className="ai-result mt-3 p-4 rounded-lg border border-calibrex-gold/30 bg-black/30">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-calibrex-gold flex items-center gap-1.5"><Sparkles size={12} /> AI draft · {meta}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => copyText(text).then(ok => { setCopied(ok); setTimeout(() => setCopied(false), 1500); })} className="p-1.5 rounded text-calibrex-muted hover:text-white" title="Copy"><Copy size={14} /></button>
              <button type="button" onClick={() => setText(null)} className="p-1.5 rounded text-calibrex-muted hover:text-white" title="Close"><X size={14} /></button>
            </div>
          </div>
          <div className="text-sm text-calibrex-text whitespace-pre-wrap leading-relaxed">{text}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {onUse && <button type="button" onClick={() => onUse(text)} className="px-3 py-1.5 rounded bg-calibrex-gold text-calibrex-navy text-xs font-black">{useLabel}</button>}
            <span className="text-xs text-calibrex-muted">{copied ? 'Copied.' : 'Numbers in [brackets] refer to the sources listed. Check before you publish.'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiAssist;
