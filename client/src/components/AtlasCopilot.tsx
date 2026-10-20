import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Send, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';
import { ai, useAiStatus } from '../lib/features';
import { getWorldmap, MapPoint } from '../lib/worldmap';
import { getInstability } from '../lib/instability';
import { getCorrelations } from '../lib/correlation';
import { getCases } from '../lib/workbench';

const SUGGESTIONS = [
  'Assess disruption risk if shipping through the Strait of Hormuz is interrupted.',
  'What are the highest-instability regions right now, and why?',
  'Summarise the conflict signals near my active case.',
  'Where are conflict and maritime signals converging today?',
];

// Build the grounding context + citable sources from the live situation + the
// analyst's most recent case. Everything the copilot sees comes from here.
async function gatherEvidence() {
  const [w, inst, conv, cases] = await Promise.allSettled([getWorldmap(), getInstability(), getCorrelations(), getCases()]);
  const lines: string[] = [];
  const sources: { title: string; url: string; source: string; published?: number }[] = [];

  if (inst.status === 'fulfilled') {
    const top = inst.value.countries.slice(0, 6);
    lines.push('Country instability (observed signal 0-100): ' + top.map(c => `${c.country} ${c.score} (${c.band}, ${c.reports} reports)`).join('; '));
    for (const c of top) for (const s of (c.signals || []).slice(0, 2)) if (s.url) sources.push({ title: s.title, url: s.url, source: s.source, published: s.published });
  }
  if (conv.status === 'fulfilled') {
    const cs = (conv.value.convergences || []).slice(0, 5);
    if (cs.length) lines.push('Signal convergence (multiple streams stacking): ' + cs.map((c: any) => `${c.country} — ${c.streamCount} streams (${(c.streams || []).join(', ')})`).join('; '));
  }
  if (w.status === 'fulfilled') {
    const L = w.value.layers;
    const count = (k: string) => (L[k as keyof typeof L] || []).length;
    lines.push(`Live geolocated signals — conflict ${count('conflict')}, hotspots ${count('hotspots')}, fires ${count('fire')}, quakes ${count('quake')}, maritime ${count('maritime')}, vessels ${count('vessels')}, aircraft ${count('aircraft')}, outages ${count('outages')}.`);
    const notable: MapPoint[] = [...(L.conflict || []), ...(L.hotspots || [])].filter(p => p.severity === 'CRITICAL' || p.severity === 'HIGH').slice(0, 8);
    for (const p of notable) { if (p.url) sources.push({ title: p.title || 'event', url: p.url, source: p.source || 'wire', published: p.date }); }
    if (notable.length) lines.push('Notable high-severity events: ' + notable.map(p => `${p.title}${p.location ? ` (${p.location})` : ''}`).join('; '));
  }
  if (cases.status === 'fulfilled' && cases.value.length) {
    const c = cases.value[0];
    lines.push(`Analyst's active case "${c.name}" has ${c.items.length} pinned source(s): ` + c.items.slice(0, 10).map(it => it.title).join('; '));
    for (const it of c.items.slice(0, 12)) if (it.url) sources.push({ title: it.title, url: it.url, source: it.source, published: it.published || undefined });
  }

  // de-dupe sources by url
  const seen = new Set<string>();
  const uniq = sources.filter(s => s.url && !seen.has(s.url) && seen.add(s.url)).slice(0, 20);
  return { context: lines.join('\n'), sources: uniq };
}

interface Msg { role: 'you' | 'copilot'; text: string; model?: string; sources?: { title: string; url: string }[] }

const AtlasCopilot: React.FC = () => {
  const aiState = useAiStatus(true);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const ask = async (question: string) => {
    const text = question.trim(); if (!text || busy) return;
    setErr(null); setQ('');
    setMsgs(m => [...m, { role: 'you', text }]);
    setBusy(true);
    try {
      const { context, sources } = await gatherEvidence();
      const r = await ai.generate('copilot', { question: text, context, sources });
      setMsgs(m => [...m, { role: 'copilot', text: r.text, model: r.model, sources: sources.slice(0, 8).map(s => ({ title: s.title, url: s.url })) }]);
    } catch (e: any) {
      setErr(e?.message || 'The copilot could not answer. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto flex flex-col" style={{ minHeight: 'calc(100dvh - 11rem)' }}>
      <div className="mb-3">
        <div className="text-[10px] font-mono font-black text-calibrex-gold uppercase tracking-[0.25em] mb-0.5">Calibrex Atlas</div>
        <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Sparkles size={22} className="text-calibrex-gold" /> Atlas Copilot</h1>
        <p className="text-sm text-calibrex-muted mt-1">Ask about the live situation and your case. Answers come only from the evidence on hand, with sourced facts separated from inference. Observed signal — not a forecast.</p>
      </div>

      {!aiState.ready ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
          <Sparkles size={34} className="text-calibrex-gold" />
          <h2 className="text-lg font-black text-white">Connect your AI to use the Copilot</h2>
          <p className="text-sm text-calibrex-muted max-w-sm">The Copilot runs on your own AI account (Claude, ChatGPT or Gemini). Connect it once in Settings — your key is stored encrypted.</p>
          <button onClick={() => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'settings' }))} className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-calibrex-gold text-calibrex-navy text-[11px] font-black uppercase tracking-widest">Connect AI in Settings <ArrowRight size={14} /></button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Try asking</div>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => ask(s)} className="w-full text-left flex items-start gap-2 p-3 rounded-xl border border-white/10 bg-black/20 hover:border-calibrex-gold/40">
                    <Sparkles size={14} className="text-calibrex-gold shrink-0 mt-0.5" /><span className="text-[13px] text-white/85">{s}</span>
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              m.role === 'you' ? (
                <div key={i} className="flex justify-end"><div className="max-w-[85%] bg-calibrex-teal/15 border border-calibrex-teal/30 rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px] text-white">{m.text}</div></div>
              ) : (
                <div key={i} className="bg-calibrex-surface border border-white/10 rounded-2xl rounded-bl-md p-3.5">
                  <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-black text-calibrex-gold uppercase tracking-widest"><Sparkles size={12} /> Copilot{m.model ? ` · ${m.model}` : ''}</div>
                  <div className="text-[13px] text-white/90 whitespace-pre-wrap leading-relaxed">{m.text}</div>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/10">
                      <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Evidence used</div>
                      <div className="space-y-0.5">
                        {m.sources.map((s, j) => (
                          <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-calibrex-teal hover:text-white truncate">[{j + 1}] {s.title}</a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ))}
            {busy && <div className="flex items-center gap-2 text-[12px] text-calibrex-muted"><Loader2 size={14} className="animate-spin text-calibrex-gold" /> Reading the live situation and your case…</div>}
            {err && <div className="flex items-center gap-2 text-[12px] text-calibrex-critical"><AlertTriangle size={14} /> {err}</div>}
            <div ref={endRef} />
          </div>

          <form onSubmit={e => { e.preventDefault(); ask(q); }} className="mt-3 flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about the situation or your case…" className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-white/30" />
            <button type="submit" disabled={busy || !q.trim()} className="p-2 rounded-lg bg-calibrex-gold text-calibrex-navy disabled:opacity-40"><Send size={15} /></button>
          </form>
          <p className="mt-2 text-[10px] text-white/35 flex items-center gap-1.5"><ShieldCheck size={11} className="text-calibrex-teal" /> Runs on your connected AI. Grounded in live Calibrex evidence; facts are separated from inference.</p>
        </>
      )}
    </div>
  );
};

export default AtlasCopilot;
