import React, { useMemo, useState } from 'react';
import { Download, FileText, Printer, Code2, CheckCircle2, AlertTriangle } from 'lucide-react';

type CaseRecord = {
  id: string; title: string; objective?: string; status?: string; priority?: string;
  tags?: string[]; questions?: string[]; hypotheses?: any[]; evidence?: any[];
  entities?: any[]; relationships?: any[]; notes?: any[]; createdAt?: number; updatedAt?: number;
};
type Props = { investigation: CaseRecord; ledger?: any };

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const date = (v?: number | null) => v ? new Date(v).toLocaleString() : 'Not recorded';
const filename = (s: string) => (s || 'investigation').normalize('NFKD').replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 70) || 'investigation';

function reportHtml(c: CaseRecord, ledger: any) {
  const evidence = c.evidence || [], entities = c.entities || [], relationships = c.relationships || [], hypotheses = c.hypotheses || [], notes = c.notes || [];
  const section = (title: string, body: string) => body ? `<section><h2>${esc(title)}</h2>${body}</section>` : '';
  const list = (xs: any[], render: (x:any)=>string) => xs.length ? `<ul>${xs.map(x=>`<li>${render(x)}</li>`).join('')}</ul>` : '<p class="muted">None recorded.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.title)} — Calibrex Investigation Report</title><style>
  *{box-sizing:border-box}body{font:14px/1.55 Arial,Helvetica,sans-serif;color:#18212b;margin:0;background:#eef1f4}.page{max-width:900px;margin:24px auto;background:#fff;padding:44px 52px;box-shadow:0 8px 30px #10203018}.brand{border-bottom:4px solid #b88a42;padding-bottom:18px;margin-bottom:28px}.brand strong{font-size:13px;letter-spacing:3px;color:#142d43}.brand small{display:block;color:#687582;margin-top:5px;letter-spacing:1px}.eyebrow{font-size:10px;letter-spacing:2px;color:#9a7336;font-weight:bold;text-transform:uppercase}h1{font-size:28px;margin:8px 0;color:#142d43}h2{font-size:15px;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #d9dee3;padding-bottom:7px;color:#17354c;margin:28px 0 12px}p{margin:6px 0}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:20px 0}.meta div{background:#f4f6f8;padding:10px;border-left:3px solid #c39a55}.meta b{display:block;font-size:9px;color:#687582;letter-spacing:1px;text-transform:uppercase}.muted{color:#7a8792;font-style:italic}table{width:100%;border-collapse:collapse;font-size:12px;margin:10px 0}th,td{padding:8px;border:1px solid #d9dee3;text-align:left;vertical-align:top}th{background:#eef2f5;color:#17354c}li{margin:6px 0;overflow-wrap:anywhere}.footer{border-top:1px solid #d9dee3;margin-top:36px;padding-top:12px;color:#77838d;font-size:10px}.warning{background:#fff8e8;border:1px solid #ead6a7;padding:10px;font-size:11px;color:#6b5426;margin-top:18px}@media print{body{background:#fff}.page{margin:0;max-width:none;padding:20mm;box-shadow:none}section{break-inside:avoid}h2{break-after:avoid}}@media(max-width:600px){.page{margin:0;padding:24px 18px}.meta{grid-template-columns:1fr}}
  </style></head><body><main class="page"><header class="brand"><strong>CALIBREX</strong><small>OSINT STUDIO · INVESTIGATION REPORT</small></header><div class="eyebrow">Case dossier · ${esc(c.id)}</div><h1>${esc(c.title || 'Untitled investigation')}</h1><p>${esc(c.objective || 'No intelligence requirement recorded.')}</p><div class="meta"><div><b>Case status</b>${esc(c.status || 'OPEN')}</div><div><b>Priority</b>${esc(c.priority || 'NORMAL')}</div><div><b>Created</b>${esc(date(c.createdAt))}</div><div><b>Last updated</b>${esc(date(c.updatedAt))}</div><div><b>Evidence records</b>${evidence.length}</div><div><b>Case revision</b>${esc((c as any).revision || 1)}</div></div>
  ${section('Research questions',list(c.questions||[],x=>esc(x)))}
  ${section('Hypotheses',list(hypotheses,x=>`<b>${esc(x.text)}</b> — ${esc(x.status||'UNASSESSED')} <span class="muted">(${(x.evidenceIds||[]).length} linked evidence IDs)</span>`))}
  ${section('Evidence register',evidence.length?`<table><thead><tr><th>Evidence</th><th>Assessment</th><th>Source</th><th>Captured</th><th>Analyst notes</th></tr></thead><tbody>${evidence.map(e=>`<tr><td>${esc(e.title||e.id)}<br><small>${esc(e.type)}</small></td><td>${esc(e.assessment||'UNKNOWN')}</td><td>${esc(e.source)}${e.url?`<br><a href="${esc(e.url)}">${esc(e.url)}</a>`:''}</td><td>${esc(date(e.capturedAt))}</td><td>${esc(e.notes)}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">No evidence recorded.</p>')}
  ${section('Entity register',list(entities,x=>`<b>${esc(x.name)}</b> — ${esc(x.type)} / ${esc(x.resolution)} · Confidence ${esc(x.confidence ?? 'n/a')}%<br><span class="muted">${esc(x.notes)}</span>`))}
  ${section('Evidence relationships',list(relationships,x=>`<b>${esc(x.type)}</b>: ${esc(x.from)} → ${esc(x.to)} — ${esc(x.assessment)}<br>${esc(x.rationale)}`))}
  ${section('Analyst notes',list(notes,x=>`${esc(x.text)} <span class="muted">— ${esc(date(x.createdAt))}</span>`))}
  ${section('Evidence integrity',`<p>${ledger?.verification ? (ledger.verification.valid ? 'Evidence ledger chain verified at report generation.' : 'Evidence ledger verification reported a failure.') : 'Ledger verification status was not available when this report was generated.'}</p><p class="muted">${esc(ledger?.caveat || 'Application-level hash chain only; not WORM storage or independent timestamping.')}</p>`)}
  <div class="warning">Analyst product, not a finding of fact. Claims, source records, automated extraction and hypotheses must be independently assessed. Preserve original source material and chain-of-custody records separately.</div><footer class="footer">CALIBREX OSINT STUDIO · Generated ${esc(new Date().toLocaleString())} · Case ID ${esc(c.id)}<br>Handle according to your organisation's classification and retention policy.</footer></main></body></html>`;
}

function reportText(c: CaseRecord, ledger: any) {
  const lines = ['CALIBREX OSINT STUDIO — INVESTIGATION REPORT', c.title || 'Untitled investigation', '', 'CASE DETAILS', `ID: ${c.id}`, `Status: ${c.status || 'OPEN'}`, `Priority: ${c.priority || 'NORMAL'}`, `Created: ${date(c.createdAt)}`, `Updated: ${date(c.updatedAt)}`, '', 'INTELLIGENCE REQUIREMENT', c.objective || 'Not recorded', '', 'RESEARCH QUESTIONS', ...(c.questions||[]).map(x=>'- '+x), '', 'HYPOTHESES', ...(c.hypotheses||[]).map(x=>`- [${x.status||'UNASSESSED'}] ${x.text} (evidence: ${(x.evidenceIds||[]).join(', ')})`), '', 'EVIDENCE REGISTER'];
  for (const e of c.evidence||[]) lines.push(`- ${e.title||e.id} | ${e.assessment||'UNKNOWN'} | ${e.source||''} | ${e.url||''} | captured ${date(e.capturedAt)}`, e.notes||'');
  lines.push('', 'ENTITY REGISTER', ...(c.entities||[]).map(x=>`- ${x.name} | ${x.type} | ${x.resolution} | confidence ${x.confidence ?? 'n/a'} | ${x.notes||''}`), '', 'EVIDENCE RELATIONSHIPS', ...(c.relationships||[]).map(x=>`- ${x.from} --${x.type}--> ${x.to} [${x.assessment}] ${x.rationale||''}`), '', 'ANALYST NOTES', ...(c.notes||[]).map(x=>`- ${x.text} (${date(x.createdAt)})`), '', 'EVIDENCE INTEGRITY', ledger?.verification ? (ledger.verification.valid?'Ledger chain verified.':'Ledger verification failed.') : 'Verification status unavailable.', ledger?.caveat || 'Application-level hash chain only; not WORM storage or independent timestamping.', '', 'CAVEAT: Analyst product, not a finding of fact. Claims and hypotheses require independent assessment.', `Generated: ${new Date().toLocaleString()}` );
  return lines.join('\n');
}

const InvestigationReportExport: React.FC<Props> = ({ investigation, ledger }) => {
  const [message,setMessage]=useState('');
  const html=useMemo(()=>reportHtml(investigation,ledger),[investigation,ledger]);
  const text=useMemo(()=>reportText(investigation,ledger),[investigation,ledger]);
  const base=filename(investigation.title);
  const download=(data:string,name:string,type:string)=>{
    try { const url=URL.createObjectURL(new Blob([data],{type})); const a=document.createElement('a'); a.href=url; a.download=name; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),5000); setMessage('Download requested. Check your browser downloads.'); }
    catch { setMessage('Download could not start in this browser. Try Print / Save as PDF.'); }
  };
  const print=()=>{
    const w=window.open('','_blank');
    if(!w){setMessage('The print window was blocked. Allow pop-ups for this site and try again.');return;}
    w.document.open();w.document.write(html);w.document.close();
    w.onload=()=>{w.focus();w.print();};
    setMessage('Print dialog opened. Choose Save as PDF.');
  };
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={()=>download(text,`calibrex-${base}.txt`,'text/plain;charset=utf-8')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-white hover:border-calibrex-teal/50"><FileText size={14}/> TXT</button>
    <button type="button" onClick={()=>download(html,`calibrex-${base}.html`,'text/html;charset=utf-8')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-white hover:border-calibrex-teal/50"><Code2 size={14}/> HTML</button>
    <button type="button" onClick={print} className="inline-flex items-center gap-1.5 rounded-lg bg-calibrex-teal px-3 py-2 text-xs font-bold text-calibrex-navy"><Printer size={14}/> PDF / Print</button>
    {message&&<span role="status" className="w-full text-[10px] text-white/55">{message}</span>}
    <span className="w-full text-[10px] text-white/35">PDF uses your browser's print dialog. DOCX export is not yet implemented; this control does not create a renamed HTML file.</span>
  </div>;
};
export default InvestigationReportExport;
