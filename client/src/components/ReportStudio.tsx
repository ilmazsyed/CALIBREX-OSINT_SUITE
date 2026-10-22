import React, { useMemo, useState } from 'react';
import { FileText, Sparkles, Eye, Pencil, Download, Copy, Archive, Check, Plus, Trash2, HelpCircle, X, Search } from 'lucide-react';
import { IntelligenceNode, ReportHistoryItem } from '../types';
import { copyText, saveFile } from '../lib/api';
import AiAssist from './AiAssist';
import ReportDoc from './ReportDoc';
import {
  TEMPLATES, templateById, emptyReport, aiSchema, CONFIDENCE_LEVELS, ReportData,
} from '../lib/reportTemplates';

interface Props {
  pinnedNodes: IntelligenceNode[];
  onArchiveReport: (item: ReportHistoryItem) => void;
  onGoResearch?: () => void;
  isOffline?: boolean;
  currentUser: { id: string } | null;
}

const field = 'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-calibrex-teal';
const lbl = 'block text-[9px] font-black text-calibrex-gold uppercase tracking-[0.18em] mb-1.5';

function toPlainText(data: ReportData): string {
  const t = templateById(data.templateId);
  const L: string[] = [`${t.name.toUpperCase()}${data.tag ? ` · ${data.tag}` : ''}`];
  const meta = t.meta.map(m => data.meta[m.key]).filter(Boolean).join(' · '); if (meta) L.push(meta);
  L.push('');
  for (const b of t.layout) {
    if (b.type === 'section') { const d = t.sections.find(s => s.key === b.key)!; const v = data.sections[b.key!]; if (v?.trim()) { L.push(d.label.toUpperCase()); L.push(v.trim()); L.push(''); } }
    else if (b.type === 'table') { const d = t.tables.find(x => x.key === b.key)!; const rows = data.tables[b.key!] || []; if (rows.length) { L.push(d.title.toUpperCase()); for (const r of rows) L.push('- ' + d.cols.map(c => r[c.key] || '').filter(Boolean).join(' · ')); L.push(''); } }
    else if (b.type === 'confidence') { L.push('CONFIDENCE: ' + data.confidence); L.push(''); }
    else if (b.type === 'sources') { if (data.sources.length) { L.push('SOURCES'); data.sources.forEach((s, i) => L.push(`[${i + 1}] ${s.name}${s.url ? ` ${s.url}` : ''}`)); L.push(''); } }
  }
  L.push(`${data.classification}${data.preparedBy ? ` · Prepared by ${data.preparedBy}` : ''} · Generated ${new Date().toLocaleString()}`);
  return L.join('\n');
}

const ReportStudio: React.FC<Props> = ({ pinnedNodes, onArchiveReport, onGoResearch, isOffline, currentUser }) => {
  const [tid, setTid] = useState(TEMPLATES[0].id);
  const [data, setData] = useState<ReportData>(() => emptyReport(TEMPLATES[0]));
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [subject, setSubject] = useState('');
  const [guide, setGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const [archived, setArchived] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = useMemo(() => templateById(tid), [tid]);

  const switchTemplate = (id: string) => {
    const filled = Object.values(data.sections).some(Boolean) || Object.values(data.tables).some(r => r.length);
    if (filled && id !== tid && !confirm('Switch template? Your current draft will be cleared.')) return;
    setTid(id); setData(emptyReport(templateById(id))); setMode('edit');
  };

  const setMeta = (k: string, v: string) => setData(d => ({ ...d, meta: { ...d.meta, [k]: v } }));
  const setSection = (k: string, v: string) => setData(d => ({ ...d, sections: { ...d.sections, [k]: v } }));
  const addRow = (tk: string) => setData(d => ({ ...d, tables: { ...d.tables, [tk]: [...(d.tables[tk] || []), {}] } }));
  const setCell = (tk: string, i: number, ck: string, v: string) => setData(d => { const rows = [...(d.tables[tk] || [])]; rows[i] = { ...rows[i], [ck]: v }; return { ...d, tables: { ...d.tables, [tk]: rows } }; });
  const delRow = (tk: string, i: number) => setData(d => ({ ...d, tables: { ...d.tables, [tk]: (d.tables[tk] || []).filter((_, j) => j !== i) } }));
  const addSource = () => setData(d => ({ ...d, sources: [...d.sources, { name: '', url: '' }] }));
  const setSource = (i: number, k: 'name' | 'url', v: string) => setData(d => { const s = [...d.sources]; s[i] = { ...s[i], [k]: v }; return { ...d, sources: s }; });
  const delSource = (i: number) => setData(d => ({ ...d, sources: d.sources.filter((_, j) => j !== i) }));
  const pullSources = () => setData(d => {
    const have = new Set(d.sources.map(s => (s.url || s.name)));
    const add = pinnedNodes.filter(n => !have.has(n.url || n.content)).map(n => ({ name: `${n.source}: ${n.content.slice(0, 90)}`, url: n.url || '' }));
    return { ...d, sources: [...d.sources, ...add].slice(0, 40) };
  });

  const aiSources = () => [
    ...pinnedNodes.slice(0, 25).map(n => ({ title: n.content, source: n.source, url: n.url, published: n.published })),
  ];

  const applyAi = (text: string) => {
    try {
      const j = JSON.parse(text.replace(/^```(json)?/i, '').replace(/```$/,'').trim());
      setData(d => {
        const sections = { ...d.sections };
        if (j.sections) for (const s of t.sections) if (typeof j.sections[s.key] === 'string') sections[s.key] = j.sections[s.key];
        const tables = { ...d.tables };
        if (j.tables) for (const tb of t.tables) if (Array.isArray(j.tables[tb.key])) {
          tables[tb.key] = j.tables[tb.key].slice(0, 40).map((row: any) => {
            const r: Record<string, string> = {};
            for (const c of tb.cols) { let v = String(row?.[c.key] ?? '').slice(0, 300); if (c.kind === 'status' && c.options && v && !c.options.includes(v.toUpperCase())) { const hit = c.options.find(o => o.toUpperCase().startsWith(v.toUpperCase().slice(0, 4))); v = hit || v.toUpperCase(); } r[c.key] = c.kind === 'status' ? v.toUpperCase() : v; }
            return r;
          });
        }
        const conf = typeof j.confidence === 'string' && CONFIDENCE_LEVELS.includes(j.confidence.toUpperCase()) ? j.confidence.toUpperCase() : d.confidence;
        const sources = Array.isArray(j.sources) ? j.sources.slice(0, 40).map((s: any) => ({ name: String(s?.name || '').slice(0, 200), url: String(s?.url || '').slice(0, 400) })) : d.sources;
        return { ...d, sections, tables, confidence: conf, sources };
      });
      setErr(null); setMode('edit');
    } catch {
      setErr('The AI reply was not in the expected format. Try again, or fill the fields by hand.');
    }
  };

  const doPrint = () => { setMode('preview'); setTimeout(() => window.print(), 400); };
  const doCopy = async () => { if (await copyText(toPlainText(data))) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  const doTxt = () => saveFile(`${t.name.replace(/\s+/g, '_')}${data.tag ? '_' + data.tag.replace(/\s+/g, '_') : ''}.txt`, toPlainText(data));
  const doArchive = () => {
    if (!currentUser?.id) return;
    onArchiveReport({ id: Date.now().toString(), title: `${t.name}${data.tag ? ` · ${data.tag}` : ''}`, date: new Date().toLocaleDateString(), format: t.name.toUpperCase(), content: toPlainText(data), userId: currentUser.id });
    setArchived(true); setTimeout(() => setArchived(false), 1500);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-24">
      {/* template picker */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="cx-eyebrow">Report format</div>
        <button onClick={() => setGuide(true)} className="text-[10px] font-black uppercase tracking-widest text-calibrex-teal flex items-center gap-1.5 hover:text-white"><HelpCircle size={13} /> How reports work</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
        {TEMPLATES.map(tp => (
          <button key={tp.id} onClick={() => switchTemplate(tp.id)} className={`cx-card text-left rounded-xl p-3 border transition-all ${tid === tp.id ? 'border-calibrex-gold/60 ring-1 ring-calibrex-gold/40' : 'border-white/10 hover:border-white/25'}`}>
            <div className="font-display text-[12px] text-white leading-tight mb-1">{tp.name}</div>
            <div className="text-[10px] text-calibrex-muted leading-snug">{tp.blurb}</div>
          </button>
        ))}
      </div>

      {mode === 'preview' ? (
        <div>
          <div className="cx-no-print flex flex-wrap items-center justify-end gap-2 mb-3">
            <button onClick={() => setMode('edit')} className="px-4 py-2 rounded-lg border border-white/15 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Pencil size={14} /> Edit</button>
            <button onClick={doCopy} className="px-4 py-2 rounded-lg border border-white/15 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">{copied ? <Check size={14} /> : <Copy size={14} />} Copy</button>
            <button onClick={doTxt} className="px-4 py-2 rounded-lg border border-white/15 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Download size={14} /> TXT</button>
            <button onClick={doArchive} className="px-4 py-2 rounded-lg border border-white/15 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">{archived ? <Check size={14} /> : <Archive size={14} />} Archive</button>
            <button onClick={doPrint} className="px-5 py-2 rounded-lg bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Download size={14} /> Save as PDF</button>
          </div>
          <p className="cx-no-print text-[10px] text-white/40 mb-3 text-right">Save as PDF opens your device's print dialog → choose "Save as PDF". Keep "Background graphics" on for the dark theme.</p>
          <ReportDoc data={data} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* form */}
          <div className="lg:col-span-2 space-y-4">
            {err && <div className="bg-calibrex-critical/15 border border-calibrex-critical/40 text-[11px] text-white px-3 py-2 rounded-lg flex items-center justify-between"><span>{err}</span><button onClick={() => setErr(null)}><X size={14} /></button></div>}

            {/* tag + meta */}
            <div className="cx-card rounded-xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {t.tag && (
                  <div><label className={lbl}>{t.tag.label}</label><input className={field} value={data.tag} placeholder={t.tag.placeholder} onChange={e => setData(d => ({ ...d, tag: e.target.value }))} /></div>
                )}
                {t.meta.map(m => (
                  <div key={m.key}><label className={lbl}>{m.label}</label><input className={field} value={data.meta[m.key] || ''} placeholder={m.placeholder} onChange={e => setMeta(m.key, e.target.value)} /></div>
                ))}
              </div>
            </div>

            {/* AI fill */}
            <div className="cx-card rounded-xl p-4">
              <label className={lbl}><Sparkles size={11} className="inline mr-1" /> Draft with AI (optional)</label>
              <input className={field} value={subject} placeholder={`What is this ${t.name.toLowerCase()} about? e.g. "Port of Chennai congestion, past 12h"`} onChange={e => setSubject(e.target.value)} />
              <div className="mt-2 flex items-center gap-3">
                <AiAssist
                  task={'report_doc' as any}
                  label="Draft with AI"
                  disabled={!subject.trim() || isOffline}
                  getInput={() => { if (!subject.trim()) throw new Error('Describe the subject first.'); return { templateId: t.id, name: t.name, subject, schema: aiSchema(t), metaInfo: t.meta.map(m => `${m.label}: ${data.meta[m.key] || ''}`).join(' · '), sources: aiSources() }; }}
                  onUse={applyAi}
                  useLabel="Fill the report"
                />
                <span className="text-[10px] text-white/40">Grounds on your {pinnedNodes.length} pinned source{pinnedNodes.length === 1 ? '' : 's'}. You can edit everything after.</span>
              </div>
              {onGoResearch && <button onClick={onGoResearch} className="mt-2 text-[10px] font-black uppercase tracking-widest text-calibrex-teal flex items-center gap-1.5"><Search size={12} /> Pin sources in Research</button>}
            </div>

            {/* sections + tables, in layout order */}
            {t.layout.map((b, i) => {
              if (b.type === 'section') { const def = t.sections.find(s => s.key === b.key)!; return (
                <div key={i} className="cx-card rounded-xl p-4">
                  <label className={lbl}>{def.label}</label>
                  {def.hint && <p className="text-[10px] text-white/35 mb-1.5 -mt-0.5">{def.hint}</p>}
                  <textarea className={`${field} min-h-[80px] resize-y leading-relaxed`} value={data.sections[b.key!] || ''} onChange={e => setSection(b.key!, e.target.value)} />
                </div>
              ); }
              if (b.type === 'table') { const def = t.tables.find(x => x.key === b.key)!; const rows = data.tables[b.key!] || []; return (
                <div key={i} className="cx-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2"><label className={`${lbl} mb-0`}>{def.title}</label><button onClick={() => addRow(b.key!)} className="text-[10px] font-black uppercase tracking-widest text-calibrex-gold flex items-center gap-1"><Plus size={12} /> {def.addLabel}</button></div>
                  {def.note && <p className="text-[9px] text-white/30 mb-2 -mt-1">{def.note}</p>}
                  {rows.length === 0 ? <p className="text-[11px] text-white/35 italic py-2">No rows yet — add one, or let AI fill it.</p> : (
                    <div className="space-y-2">
                      {rows.map((r, ri) => (
                        <div key={ri} className="flex items-start gap-1.5">
                          <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${def.cols.length}, minmax(0,1fr))` }}>
                            {def.cols.map(c => c.kind === 'status' ? (
                              <select key={c.key} className={`${field} py-1.5 text-[11px]`} value={r[c.key] || ''} onChange={e => setCell(b.key!, ri, c.key, e.target.value)}>
                                <option value="">{c.label}…</option>
                                {(c.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input key={c.key} className={`${field} py-1.5 text-[11px]`} placeholder={c.label} value={r[c.key] || ''} onChange={e => setCell(b.key!, ri, c.key, e.target.value)} />
                            ))}
                          </div>
                          <button onClick={() => delRow(b.key!, ri)} className="text-calibrex-critical/70 hover:text-calibrex-critical p-1.5 shrink-0"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ); }
              if (b.type === 'confidence') return (
                <div key={i} className="cx-card rounded-xl p-4">
                  <label className={lbl}>Confidence</label>
                  <div className="flex gap-2">{CONFIDENCE_LEVELS.map(c => (
                    <button key={c} onClick={() => setData(d => ({ ...d, confidence: c }))} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${data.confidence === c ? 'bg-calibrex-gold/15 border-calibrex-gold/60 text-calibrex-gold' : 'border-white/10 text-white/50'}`}>{c}</button>
                  ))}</div>
                </div>
              );
              if (b.type === 'sources') return (
                <div key={i} className="cx-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2"><label className={`${lbl} mb-0`}>Sources</label><div className="flex gap-3">{pinnedNodes.length > 0 && <button onClick={pullSources} className="text-[10px] font-black uppercase tracking-widest text-calibrex-teal">Pull pinned</button>}<button onClick={addSource} className="text-[10px] font-black uppercase tracking-widest text-calibrex-gold flex items-center gap-1"><Plus size={12} /> Add</button></div></div>
                  {data.sources.length === 0 ? <p className="text-[11px] text-white/35 italic py-1">No sources yet.</p> : (
                    <div className="space-y-2">{data.sources.map((s, si) => (
                      <div key={si} className="flex items-center gap-1.5">
                        <input className={`${field} py-1.5 text-[11px] flex-1`} placeholder="Source name" value={s.name} onChange={e => setSource(si, 'name', e.target.value)} />
                        <input className={`${field} py-1.5 text-[11px] flex-1`} placeholder="URL (optional)" value={s.url || ''} onChange={e => setSource(si, 'url', e.target.value)} />
                        <button onClick={() => delSource(si)} className="text-calibrex-critical/70 hover:text-calibrex-critical p-1.5"><Trash2 size={13} /></button>
                      </div>
                    ))}</div>
                  )}
                </div>
              );
              return null;
            })}
          </div>

          {/* side: prepared-by + actions */}
          <div className="space-y-4">
            <div className="cx-card rounded-xl p-4 lg:sticky lg:top-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className={lbl}>Classification</label><input className={field} value={data.classification} onChange={e => setData(d => ({ ...d, classification: e.target.value }))} /></div>
                <div><label className={lbl}>Prepared by</label><input className={field} value={data.preparedBy} placeholder="Analyst" onChange={e => setData(d => ({ ...d, preparedBy: e.target.value }))} /></div>
              </div>
              <button onClick={() => setMode('preview')} className="w-full px-4 py-3 rounded-lg bg-calibrex-teal text-calibrex-navy text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-2"><Eye size={15} /> Preview & export</button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={doCopy} className="px-3 py-2 rounded-lg border border-white/15 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">{copied ? <Check size={13} /> : <Copy size={13} />} Copy</button>
                <button onClick={doArchive} className="px-3 py-2 rounded-lg border border-white/15 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">{archived ? <Check size={13} /> : <Archive size={13} />} Archive</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* guidance */}
      {guide && (
        <div className="cx-no-print fixed inset-0 z-[1300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setGuide(false)}>
          <div className="cx-card rounded-2xl p-6 max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="font-display text-base text-white">How reports work</h3><button onClick={() => setGuide(false)} className="text-white/50 hover:text-white"><X size={18} /></button></div>
            <ol className="space-y-3 text-[12px] text-white/80 leading-relaxed list-decimal pl-4">
              <li><b className="text-white">Pick a format</b> above — Intelligence Brief, Risk Brief, Supplier Assessment or Newsroom Story Sheet. Each has its own fixed structure.</li>
              <li><b className="text-white">Fill it two ways.</b> Type into the fields yourself, <i>or</i> describe the subject and tap <b className="text-calibrex-gold">Draft with AI</b> — it fills the sections and tables from your pinned sources. You can edit everything afterward either way.</li>
              <li><b className="text-white">Use the status words.</b> Timeline/evidence rows use a fixed vocabulary — <span className="text-calibrex-low">CONFIRMED / CORROBORATED / OBSERVED</span>, <span className="text-calibrex-gold">UNVERIFIED</span>, <span className="text-calibrex-critical">CONTRADICTS / NOT REPEATED</span> — so a reader instantly sees how solid each line is.</li>
              <li><b className="text-white">Set confidence honestly</b> (Low / Moderate / High) from how well your sources corroborate.</li>
              <li><b className="text-white">Preview & export.</b> Preview renders the branded document; <b className="text-calibrex-gold">Save as PDF</b> uses your device's print dialog (keep "Background graphics" on for the dark theme). You can also Copy, save TXT, or Archive it.</li>
            </ol>
            <p className="text-[11px] text-white/45 mt-4">Every report grounds on observed reporting and sources you provide — not a forecast. Label anything unconfirmed as UNVERIFIED.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportStudio;
