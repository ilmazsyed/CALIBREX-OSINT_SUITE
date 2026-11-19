const esc = value => String(value ?? '');
const htmlEscape = value => esc(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export function buildInvestigationReportJson({ report, investigationId, caseRevision, evidenceCount = 0 } = {}) {
  if (!report || typeof report.content !== 'string' || !report.content.trim()) {
    throw new Error('A saved report with content is required.');
  }
  return {
    schema: 'https://calibrex.org/schemas/investigation-report/v1',
    schemaVersion: 1,
    product: 'Calibrex OSINT Studio',
    report: {
      id: report.id || null,
      title: esc(report.title || 'Investigation report'),
      version: Number(report.version) || null,
      status: esc(report.status || 'UNKNOWN'),
      format: 'markdown',
      content: report.content,
      contentHash: esc(report.contentHash || ''),
      generatedAt: report.generatedAt || report.createdAt || null,
      approvedAt: report.approvedAt || null,
      approvedBy: report.approvedBy || null,
      caseRevision: Number(report.caseRevision ?? caseRevision) || null,
      evidenceLedgerHead: report.evidenceLedgerHead || null,
      quality: report.quality || null
    },
    investigation: {
      id: esc(investigationId || ''),
      revision: Number(caseRevision) || null,
      evidenceCount: Math.max(0, Number(evidenceCount) || 0)
    },
    export: {
      generatedAt: new Date().toISOString(),
      format: 'application/json',
      immutableSource: 'saved-report-version'
    }
  };
}

function inlineMarkdown(value) {
  let out=htmlEscape(value);
  out=out.replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>');
  out=out.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  out=out.replace(/(^|[^*])\*([^*]+)\*/g,'$1<em>$2</em>');
  out=out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>'<a href="'+htmlEscape(url)+'" rel="noopener noreferrer">'+label+'</a>');
  out=out.replace(/\[(E-[A-Za-z0-9_-]+)\]/g,'<span class="evidence-ref">$1</span>');
  return out;
}
function markdownToHtml(markdown) {
  const lines=String(markdown||'').replace(/\r/g,'').split('\n'),out=[];
  let paragraph=[],listType=null,tableRows=[];
  const flushParagraph=()=>{if(paragraph.length){out.push('<p>'+paragraph.map(inlineMarkdown).join('<br>')+'</p>');paragraph=[];}};
  const flushList=()=>{if(listType){out.push('<'+listType+'>'+tableRows.map(x=>'<li>'+inlineMarkdown(x)+'</li>').join('')+'</'+listType+'>');tableRows=[];listType=null;}};
  const flushTable=()=>{if(tableRows.length){out.push('<div class="table-wrap"><table>'+tableRows.map((row,i)=>'<tr>'+row.map(cell=>'<'+(i===0?'th':'td')+'>'+inlineMarkdown(cell)+'</'+(i===0?'th':'td')+'>').join('')+'</tr>').join('')+'</table></div>');tableRows=[];}};
  for(const raw of lines){
    const line=raw.trim();
    if(!line){flushParagraph();flushList();flushTable();continue;}
    if(line==='---'){flushParagraph();flushList();flushTable();out.push('<hr>');continue;}
    const h=line.match(/^(#{1,6})\s+(.*)$/);
    if(h){flushParagraph();flushList();flushTable();const n=h[1].length;out.push('<h'+n+'>'+inlineMarkdown(h[2])+'</h'+n+'>');continue;}
    if(/^\|/.test(line)){
      flushParagraph();flushList();
      const cells=line.split('|').slice(1,-1).map(x=>x.trim());
      if(cells.every(x=>/^:?-{2,}:?$/.test(x)))continue;
      tableRows.push(cells);continue;
    }
    const li=line.match(/^[-*]\s+(.*)$/);
    if(li){flushParagraph();flushTable();if(listType!=='ul'){flushList();listType='ul';}tableRows.push(li[1]);continue;}
    const ordered=line.match(/^\d+[.)]\s+(.*)$/);
    if(ordered){flushParagraph();flushTable();if(listType!=='ol'){flushList();listType='ol';}tableRows.push(ordered[1]);continue;}
    flushList();flushTable();paragraph.push(line);
  }
  flushParagraph();flushList();flushTable();return out.join('\n');
}
export function renderInvestigationReportHtml({ report, investigationId, caseRevision } = {}) {
  if (!report || typeof report.content !== 'string' || !report.content.trim()) {
    throw new Error('A saved report with content is required.');
  }
  const title=htmlEscape(report.title||'Investigation report');
  const caseId=htmlEscape(investigationId||'Not recorded');
  const revision=htmlEscape(report.caseRevision??caseRevision??'Not recorded');
  const version=htmlEscape(report.version??'Not recorded');
  const hash=htmlEscape(report.contentHash||'Not recorded');
  const content=markdownToHtml(report.content);
  return '<!doctype html>\\n<html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="robots" content="noindex,nofollow"><title>'+title+' | Calibrex</title>'+
    '<style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#eef1f5;color:#17212b;font:15px/1.65 Inter,Arial,sans-serif}header,main,footer{max-width:980px;margin:auto}header{padding:32px 40px 20px;border-bottom:3px solid #b51f2b;background:#101c2b;color:#fff}.brand{font-size:12px;letter-spacing:.16em;font-weight:700;color:#e7bd69}h1{font-size:25px;line-height:1.2;margin:10px 0}.meta{font-size:12px;color:#cbd5df;display:flex;gap:18px;flex-wrap:wrap}main{background:#fff;padding:34px 40px;min-height:70vh}main h1,main h2,main h3{line-height:1.25;margin:1.5em 0 .5em;color:#17212b}main h1{font-size:24px}main h2{font-size:20px}main h3{font-size:17px}p{margin:.65em 0}a{color:#145d91;overflow-wrap:anywhere}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #d7dde5;padding:7px;text-align:left;vertical-align:top}th{background:#edf1f5}.evidence-ref{font-weight:700;color:#8d1e2b;white-space:nowrap}code{background:#eef1f5;padding:2px 4px;border-radius:3px}hr{border:0;border-top:1px solid #d7dde5;margin:24px 0}footer{padding:18px 40px 30px;color:#586575;font-size:11px}@media(max-width:640px){header,main,footer{padding-left:18px;padding-right:18px}}@media print{body{background:#fff}header{background:#101c2b!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}main{padding:22px 0}footer{padding:16px 0}a{color:inherit;text-decoration:none}}</style></head><body>'+
    '<header><div class="brand">CALIBREX | INTELLIGENCE. EVIDENCE. CLARITY.</div><h1>'+title+'</h1>'+
    '<div class="meta"><span>Case: '+caseId+'</span><span>Revision: '+revision+'</span><span>Report version: '+version+'</span></div></header>'+
    '<main>'+content+'</main><footer>Controlled intelligence product · Verify report approval and evidence ledger status before external reliance.<br>Content SHA-256: '+hash+'</footer></body></html>';
}
