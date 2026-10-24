import React, { useRef, useState } from 'react';
import { X, UploadCloud, Loader2, Sparkles, FolderPlus, Copy, Check, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { ai, useAiStatus, shortModel } from '../lib/features';
import { copyText } from '../lib/api';
import { addToCase } from '../lib/workbench';
import { navigateTo } from './AiAssist';

/**
 * Upload your own image or document in Investigate and have the connected AI
 * pull OSINT out of it — what it shows, entities, locations, dates, claims to
 * verify and next steps. Images are downscaled in the browser before upload;
 * text files are read locally; PDFs go to vision-capable models (Claude/Gemini).
 */
const TEXT_RE = /\.(txt|md|markdown|csv|tsv|json|log)$/i;

async function imageToB64(file: File, max = 1280): Promise<{ mime: string; dataB64: string }> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    return { mime: 'image/jpeg', dataB64: dataUrl.split(',')[1] };
  } catch {
    return rawB64(file);
  }
}
function rawB64(file: File): Promise<{ mime: string; dataB64: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result || ''); resolve({ mime: file.type || 'application/octet-stream', dataB64: s.split(',')[1] || '' }); };
    r.onerror = reject; r.readAsDataURL(file);
  });
}
function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = reject; r.readAsText(file); });
}

const FileAnalyze: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { status, ready } = useAiStatus();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [meta, setMeta] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);

  const pick = (f: File | null) => {
    setErr(null); setResult(null); setFile(f);
    if (f && f.type.startsWith('image/')) { const u = URL.createObjectURL(f); setPreview(u); } else setPreview('');
  };

  const analyze = async () => {
    if (!file) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const isImage = file.type.startsWith('image/');
      const isText = TEXT_RE.test(file.name) || file.type.startsWith('text/') || file.type === 'application/json';
      let payload: { mime: string; dataB64?: string; text?: string; note?: string };
      if (isImage) { const { mime, dataB64 } = await imageToB64(file); payload = { mime, dataB64, note }; }
      else if (isText) { payload = { mime: 'text/plain', text: (await readText(file)).slice(0, 30000), note }; }
      else { const { mime, dataB64 } = await rawB64(file); payload = { mime: mime || 'application/pdf', dataB64, note }; }
      const r = await ai.analyzeFile(payload);
      setResult(r.text);
      setMeta(`${shortModel(r.model)} · ${new Date(r.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e: any) {
      setErr(e?.message || 'The analysis failed.');
    } finally { setBusy(false); }
  };

  const doCopy = async () => { if (result && await copyText(result)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  const doAdd = () => {
    if (!result) return;
    addToCase({ id: 'file-' + Date.now().toString(36), title: note.trim() || file?.name || 'File analysis', url: '', source: 'File analysis', place: null } as any);
    setAdded(true); setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="cx-card rounded-2xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div><div className="cx-eyebrow mb-0.5">Investigate</div><h2 className="font-display text-base text-white">Analyze a file or image</h2></div>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>

        {!status?.enabled ? (
          <p className="text-[12px] text-white/60 py-6 text-center">AI is switched off for this workspace.</p>
        ) : !ready ? (
          <div className="py-6 text-center">
            <p className="text-[12px] text-white/70 mb-3">Connect Claude, Gemini or ChatGPT to read files and images.</p>
            <button onClick={() => { onClose(); navigateTo('settings'); }} className="px-4 py-2 rounded-lg bg-calibrex-teal text-calibrex-navy text-[10px] font-black uppercase tracking-widest">Connect an AI</button>
          </div>
        ) : (
          <>
            <input ref={inputRef} type="file" accept="image/*,.pdf,.txt,.md,.csv,.tsv,.json,.log,application/pdf" className="hidden" onChange={e => pick(e.target.files?.[0] || null)} />
            {!file ? (
              <button onClick={() => inputRef.current?.click()} className="w-full border-2 border-dashed border-white/15 rounded-xl py-10 flex flex-col items-center gap-2 text-white/60 hover:border-calibrex-teal/50 hover:text-white transition-all">
                <UploadCloud size={30} className="text-calibrex-teal" />
                <span className="text-[12px] font-bold">Choose an image, PDF or text file</span>
                <span className="text-[10px] text-white/40">Photos, screenshots, maps, documents · up to ~12 MB</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-black/30 border border-white/10 rounded-xl p-3 mb-3">
                {preview ? <img src={preview} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" /> : <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center shrink-0">{file.type.startsWith('image/') ? <ImageIcon size={22} className="text-calibrex-teal" /> : <FileText size={22} className="text-calibrex-gold" />}</div>}
                <div className="min-w-0 flex-1"><div className="text-[12px] font-bold text-white truncate">{file.name}</div><div className="text-[10px] text-white/40">{(file.size / 1024).toFixed(0)} KB · {file.type || 'file'}</div></div>
                <button onClick={() => inputRef.current?.click()} className="text-[10px] font-black uppercase tracking-widest text-calibrex-teal shrink-0">Change</button>
              </div>
            )}

            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Anything specific to look for? (optional)" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-calibrex-teal mt-3" />

            {err && <div className="mt-3 bg-calibrex-critical/15 border border-calibrex-critical/40 text-[11px] text-white px-3 py-2 rounded-lg flex items-start gap-2"><AlertCircle size={14} className="shrink-0 mt-0.5 text-calibrex-critical" />{err}</div>}

            <button onClick={analyze} disabled={!file || busy} className="w-full mt-3 px-4 py-2.5 rounded-lg bg-calibrex-gold text-calibrex-navy text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <><Loader2 size={15} className="animate-spin" /> Analyzing…</> : <><Sparkles size={15} /> Analyze with AI</>}
            </button>
            <p className="text-[10px] text-white/35 mt-2">The file is sent to your connected AI provider for analysis.</p>

            {result && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between mb-2"><span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">{meta}</span>
                  <div className="flex gap-2">
                    <button onClick={doCopy} className="text-[10px] font-black uppercase tracking-widest text-white/70 flex items-center gap-1">{copied ? <Check size={12} /> : <Copy size={12} />} Copy</button>
                    <button onClick={doAdd} className="text-[10px] font-black uppercase tracking-widest text-calibrex-gold flex items-center gap-1">{added ? <Check size={12} /> : <FolderPlus size={12} />} Add to case</button>
                  </div>
                </div>
                <div className="text-[12.5px] text-white/85 leading-relaxed whitespace-pre-wrap bg-black/25 border border-white/10 rounded-xl p-3.5">{result}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FileAnalyze;
