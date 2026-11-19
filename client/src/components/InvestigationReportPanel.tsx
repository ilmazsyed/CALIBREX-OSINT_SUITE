import React, { useMemo, useRef, useState } from 'react';
import { Download, FileUp, FileText, Printer, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';

type Evidence = { id:string; type?:string; title?:string; url?:string; source?:string; published?:number|null; capturedAt?:number; assessment?:string; triage?:string; notes?:string };
type Props = { investigation:any };

const stamp=(v:any)=>v?new Date(v).toLocaleString():'Not recorded';
const esc=(v:any)=>String(v??'').trim();

function compileCaseReport(c:any) {
  const evidence:Evidence[]=Array.isArray(c.evidence)?c.evidence:[];
  const notes=Array.isArray(c.notes)?c.notes:[];
  const entities=Array.isArray(c.entities)?c.entities:[];
  const relationships=Array.isArray(c.relationships)?c.relationships:[];
  const hypotheses=Array.isArray(c.hypotheses)?c.hypotheses:[];
  const assessment=c.assessment||{};
  const lines:string[]=[
    '# '+(esc(c.title)||'Untitled Investigation'),
    '',
    '**CALIBREX OSINT STUDIO** · INVESTIGATION REPORT',
    '',
    '| Report metadata | Value |',
    '|---|---|',
    '| Case ID | '+esc(c.id||'Not assigned')+' |',
    '| Case status | '+esc(c.status||'OPEN')+' |',
    '| Priority | '+esc(c.priority||'NORMAL')+' |',
    '| Case revision | '+esc(c.revision||1)+' |',
    '| Created | '+stamp(c.createdAt)+' |',
    '| Last updated | '+stamp(c.updatedAt)+' |',
    '| Report generated | '+new Date().toLocaleString()+' |',
    '',
    '> **Analytical caveat:** This report is compiled from records currently saved in the investigation. Inclusion does not independently verify a claim. Assessments and source classifications are preserved as recorded.',
    '',
    '## 1. Executive summary',
    esc(c.objective)||'No investigation objective has been recorded.',
    '',
    '## 2. Scope, questions and collection',
    '### Investigation tags',
    (Array.isArray(c.tags)&&c.tags.length?c.tags.map((x:string)=>'- '+x).join('\n'):'- No tags recorded'),
    '',
    '### Key questions',
    (Array.isArray(c.questions)&&c.questions.length?c.questions.map((x:string,i:number)=>(i+1)+'. '+x).join('\n'):'No investigation questions recorded.'),
    '',
    '## 3. Key findings and evidence register',
    evidence.length?evidence.map((e,i)=>[
      '### E'+(i+1)+': '+(esc(e.title)||'Untitled evidence item'),
      '- Evidence ID: '+esc(e.id),
      '- Assessment: **'+esc(e.assessment||'UNKNOWN')+'**',
      '- Triage: '+esc(e.triage||'NEW'),
      '- Source: '+esc(e.source||'Not specified'),
      '- URL: '+(esc(e.url)||'Not supplied'),
      '- Published: '+stamp(e.published),
      '- Captured: '+stamp(e.capturedAt),
      '- Type: '+esc(e.type||'Not specified'),
      '- Analyst notes: '+(esc(e.notes)||'No analyst notes.'),
      ''
    ].join('\n')).join('\n'):'No evidence items have been recorded.',
    '',
    '## 4. Entity profiles',
    entities.length?entities.map((e:any,i:number)=>[
      '### '+(i+1)+'. '+(esc(e.name)||'Unnamed entity'),
      '- Type: '+esc(e.type||'OTHER'),
      '- Resolution: '+esc(e.resolution||'UNRESOLVED'),
      '- Confidence: '+(e.confidence??'Not assessed'),
      '- Supporting evidence IDs: '+((e.sourceEvidenceIds||[]).join(', ')||'None linked'),
      '- Notes: '+(esc(e.notes)||'None'),
      ''
    ].join('\n')).join('\n'):'No entities recorded.',
    '',
    '## 5. Relationships',
    relationships.length?relationships.map((r:any,i:number)=>[
      (i+1)+'. '+esc(r.from)+' — '+esc(r.type||'RELATED_TO')+' — '+esc(r.to),
      '- Assessment: '+esc(r.assessment||'UNKNOWN'),
      '- Rationale: '+(esc(r.rationale)||'Not supplied'),
      '- Supporting evidence IDs: '+((r.sourceEvidenceIds||[]).join(', ')||'None linked')
    ].join('\n')).join('\n\n'):'No relationships recorded.',
    '',
    '## 6. Hypotheses and competing explanations',
    hypotheses.length?hypotheses.map((h:any,i:number)=>[
      (i+1)+'. **'+esc(h.status||'UNASSESSED')+'** — '+esc(h.text),
      '- Supporting evidence IDs: '+((h.evidenceIds||[]).join(', ')||'None linked')
    ].join('\n')).join('\n\n'):'No hypotheses recorded.',
    '',
    '## 7. Analyst assessment',
    '### Key judgements',
    (assessment.keyJudgements||[]).map((x:string)=>'- '+x).join('\n')||'No key judgements recorded.',
    '',
    '### Assumptions',
    (assessment.assumptions||[]).map((x:string)=>'- '+x).join('\n')||'No assumptions recorded.',
    '',
    '### Alternative hypotheses',
    (assessment.alternativeHypotheses||[]).map((x:string)=>'- '+x).join('\n')||'No alternative hypotheses recorded.',
    '',
    '### Indicators and scenarios',
    (assessment.indicators||[]).map((x:string)=>'- '+x).join('\n')||'No indicators recorded.',
    (assessment.scenarios||[]).map((x:string)=>'- '+x).join('\n')||'',
    '',
    '## 8. Analyst notes',
    notes.length?notes.map((n:any,i:number)=>[
      (i+1)+'. '+stamp(n.createdAt),
      esc(n.text)
    ].join('\n')).join('\n\n'):'No analyst notes recorded.',
    '',
    '## 9. Intelligence gaps and limitations',
    '- Missing or unlinked evidence should be treated as an intelligence gap.',
    '- Source reliability and information credibility require analyst review.',
    '- Entity matches and relationships are not proof of identity or causation.',
    '- This report reflects the saved case revision shown above.',
    '',
    '## 10. Sources and references',
    evidence.length?evidence.map((e,i)=>'['+(i+1)+'] '+(esc(e.source)||'Unspecified source')+' — '+(esc(e.title)||'Untitled')+' — '+(esc(e.url)||'No URL')+' — Evidence ID: '+esc(e.id)).join('\n'):'No source references recorded.',
    '',
    '---',
    '**CALIBREX OSINT STUDIO** · Generated from the investigation record.',
    'Classification: '+esc(c.classification||'CONFIDENTIAL')+' · Handle in accordance with your organisation’s information-handling policy.'
  ];
  return lines.join('\n');
}

const InvestigationReportPanel:React.FC<Props>=({investigation})=>{
 const [content,setContent]=useState('');
 const [message,setMessage]=useState('');
 const [fileName,setFileName]=useState('');
 const inputRef=useRef<HTMLInputElement>(null);
 const generated=useMemo(()=>compileCaseReport(investigation),[investigation]);
 const generate=()=>{setContent(generated);setMessage('Report compiled from the current saved investigation record. Review and edit before distribution.');setFileName('');};
 const download=(ext:'txt'|'md')=>{
   if(!content.trim())return;
   const blob=new Blob([content],{type:'text/plain;charset=utf-8'});
   const url=URL.createObjectURL(blob);const a=document.createElement('a');
   a.href=url;a.download=(String(investigation.title||'investigation').replace(/[^a-z0-9-_]+/gi,'_')+'_report.'+ext);a.click();URL.revokeObjectURL(url);
 };
 const ingest=(file?:File)=>{
   if(!file)return;
   const reader=new FileReader();
   reader.onload=()=>{const text=String(reader.result||'');if(!text.trim()){setMessage('The selected file is empty or could not be read.');return;}setContent(prev=>prev.trim()?prev+'\n\n--- INGESTED REPORT: '+file.name+' ---\n\n'+text:text);setFileName(file.name);setMessage('Report content ingested into the editor. It has not been independently verified or automatically merged into case evidence.');};
   reader.onerror=()=>setMessage('Could not read the selected file.');
   reader.readAsText(file);
 };
 const print=()=>{
   if(!content.trim())return;
   const w=window.open('','_blank');
   if(!w){setMessage('Popup blocked. Allow popups to create the PDF print view.');return;}
   const safe=content.split('\\n').map(line=>line.replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]||ch)).replace(/\\*\\*(.*?)\\*\\*/g,'<strong>$1</strong>'));
   const body=safe.map(line=>line.startsWith('# ') ? '<h1>'+line.slice(2)+'</h1>' : line.startsWith('## ') ? '<h2>'+line.slice(3)+'</h2>' : line.startsWith('### ') ? '<h3>'+line.slice(4)+'</h3>' : line.startsWith('> ') ? '<blockquote>'+line.slice(2)+'</blockquote>' : line.startsWith('- ') ? '<p class="bullet">• '+line.slice(2)+'</p>' : /^\\d+\\. /.test(line) ? '<p class="bullet">'+line+'</p>' : /^\\|[-| ]+\\|$/.test(line) ? '' : line.startsWith('|') ? '<p class="meta">'+line.replace(/^\\||\\|$/g,'').split('|').join('　·　')+'</p>' : line==='---' ? '<hr>' : line.trim() ? '<p>'+line+'</p>' : '').join('');
   w.document.write('<!doctype html><html><head><title>Calibrex Investigation Report</title><style>@page{size:A4;margin:20mm}body{font:10.5pt/1.6 Arial,sans-serif;color:#17212b}header{border-bottom:4px solid #bd8a35;padding-bottom:12px;margin-bottom:24px}header strong{letter-spacing:.18em;color:#152c40}h1{font-size:23pt;margin:0 0 18px;color:#152c40}h2{font-size:15pt;margin:24px 0 8px;border-bottom:1px solid #d6dce1;padding-bottom:5px;color:#152c40;page-break-after:avoid}h3{font-size:11pt;margin:15px 0 4px;page-break-after:avoid}p{margin:4px 0 8px;overflow-wrap:anywhere}.bullet{padding-left:12px}.meta{font-size:9pt;color:#425466}blockquote{border-left:3px solid #bd8a35;padding:8px 12px;background:#f5f3ee;margin:12px 0}hr{border:0;border-top:1px solid #ccd2d8;margin:20px 0}footer{margin-top:30px;border-top:1px solid #ccc;padding-top:8px;font-size:8pt;color:#65717c}</style></head><body><header><strong>CALIBREX</strong><div>OSINT STUDIO · INVESTIGATION REPORT</div></header>'+body+'<footer>CALIBREX OSINT STUDIO · Generated investigation report</footer><script>window.onload=()=>window.print()<\\/script></body></html>');
   w.document.close();
 };
 return <section className="rounded-xl border border-calibrex-gold/30 bg-black/25 p-4 sm:p-5 space-y-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-sm flex items-center gap-2"><FileText size={16} className="text-calibrex-gold"/> Investigation report engine</h3><p className="text-[10px] text-white/45 mt-1">Compile a case dossier, ingest an existing text report, edit the narrative and export.</p></div><span className="text-[9px] uppercase tracking-widest text-calibrex-gold border border-calibrex-gold/25 rounded px-2 py-1">Calibrex branded</span></div>
  <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} className="rounded-lg bg-calibrex-teal text-calibrex-navy px-3 py-2 text-xs font-black flex items-center gap-2"><RefreshCw size={14}/> Generate from investigation</button><button type="button" onClick={()=>inputRef.current?.click()} className="rounded-lg border border-white/15 px-3 py-2 text-xs flex items-center gap-2"><FileUp size={14}/> Ingest TXT / MD</button><input ref={inputRef} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" className="hidden" onChange={e=>ingest(e.target.files?.[0])}/></div>
  {fileName&&<p className="text-[10px] text-white/45">Ingested file: {fileName}</p>}
  {message&&<p className="text-[10px] text-calibrex-gold">{message}</p>}
  <div className="rounded-lg border border-white/10 bg-black/30 p-3"><div className="flex items-center justify-between gap-2 mb-2"><label className="text-[10px] uppercase tracking-widest text-white/55 font-bold">Editable report draft</label><span className="text-[9px] text-white/30">{content.length.toLocaleString()} characters</span></div><textarea value={content} onChange={e=>setContent(e.target.value)} rows={18} placeholder="Generate a report from this investigation, or ingest an existing TXT/MD report. You can also write the report manually here." className="w-full resize-y bg-transparent text-xs text-white/85 leading-relaxed font-mono outline-none placeholder:text-white/25"/></div>
  <div className="flex flex-wrap gap-2"><button type="button" disabled={!content.trim()} onClick={()=>download('txt')} className="rounded-lg border border-white/15 px-3 py-2 text-xs flex items-center gap-2 disabled:opacity-30"><Download size={14}/> Download TXT</button><button type="button" disabled={!content.trim()} onClick={()=>download('md')} className="rounded-lg border border-white/15 px-3 py-2 text-xs flex items-center gap-2 disabled:opacity-30"><Download size={14}/> Download Markdown</button><button type="button" disabled={!content.trim()} onClick={print} className="rounded-lg bg-calibrex-gold text-calibrex-navy px-3 py-2 text-xs font-black flex items-center gap-2 disabled:opacity-30"><Printer size={14}/> Export PDF</button></div>
  <p className="text-[9px] text-white/35 flex items-start gap-2"><ShieldCheck size={12} className="shrink-0 mt-0.5"/> Evidence classifications, source references and uncertainty are carried into the report. PDF export uses the browser print dialog; choose “Save as PDF”. Reports are drafts until reviewed and approved by an analyst.</p>
 </section>;
};
export default InvestigationReportPanel;
