// Dependency-free, server-side PDF renderer for approved investigation reports.
// Uses the standard PDF Type 1 Helvetica fonts; unsupported glyphs are safely replaced.
const PAGE_W=595.28,PAGE_H=841.89,LEFT=54,RIGHT=54,TOP=62,BOTTOM=58;
const clean=s=>String(s??'').replace(/\r/g,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
 .replace(/[\u2022]/g,'-').replace(/[^\x20-\xFF]/g,'?');
const pdfString=s=>clean(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const wrap=(s,max)=>{const words=clean(s).split(/\s+/);const out=[];let line='';for(const word of words){if(!word)continue;if((line?line.length+1:0)+word.length>max&&line){out.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)out.push(line);return out.length?out:[''];};
function parseMarkdown(markdown){
 const rows=[];let inTable=false;
 for(const raw of String(markdown||'').split(/\r?\n/)){
  const line=raw.trim();
  if(!line){inTable=false;rows.push({type:'space'});continue;}
  if(/^\|?\s*:?-{2,}/.test(line)&&line.includes('|'))continue;
  if(line.startsWith('|')){inTable=true;const cells=line.replace(/^\||\|$/g,'').split('|').map(x=>x.trim().replace(/\*\*/g,''));rows.push({type:'table',text:cells.join('   |   ')});continue;}
  inTable=false;
  if(/^#{1,6}\s/.test(line)){const n=line.match(/^#+/)[0].length;rows.push({type:n===1?'title':n<=3?'heading':'subheading',text:line.replace(/^#{1,6}\s*/,'').replace(/\*\*/g,'')});}
  else if(/^---+$/.test(line))rows.push({type:'rule'});
  else if(/^>\s?/.test(line))rows.push({type:'quote',text:line.replace(/^>\s?/,'').replace(/\*\*/g,'')});
  else rows.push({type:'body',text:line.replace(/\*\*/g,'').replace(/\[([^\]]+)\]/g,'$1')});
 }
 return rows;
}
export function renderInvestigationPdf({title='Investigation Report',content='',caseId='',version=1,generatedAt=Date.now()}={}){
 const parsed=parseMarkdown(content),pages=[];let current=[],y=PAGE_H-TOP;
 const addPage=()=>{current=[];pages.push(current);y=PAGE_H-TOP;};
 addPage();
 for(const row of parsed){
  if(row.type==='space'){y-=7;continue;}
  if(row.type==='rule'){if(y< BOTTOM+18)addPage();current.push({kind:'rule',y});y-=15;continue;}
  const styles={title:{size:20,font:'F2',color:'0.08 0.16 0.24',leading:27,max:48},heading:{size:13,font:'F2',color:'0.08 0.16 0.24',leading:19,max:72},subheading:{size:10.5,font:'F2',color:'0.18 0.25 0.32',leading:15,max:88},quote:{size:9,font:'F1',color:'0.30 0.34 0.38',leading:14,max:88},table:{size:7.5,font:'F1',color:'0.16 0.20 0.24',leading:11,max:105},body:{size:9,font:'F1',color:'0.12 0.16 0.20',leading:14,max:96}};
  const st=styles[row.type]||styles.body;const lines=wrap(row.text,st.max);
  const need=lines.length*st.leading+(row.type==='heading'?6:0);
  if(y-need<BOTTOM)addPage();
  for(let i=0;i<lines.length;i++){current.push({kind:'text',text:lines[i],x:row.type==='quote'?LEFT+10:LEFT,y,size:st.size,font:st.font,color:st.color});y-=st.leading;}
  if(row.type==='heading')y-=5;
 }
 const objects=[];const add=o=>(objects.push(o),objects.length);
 const catalogId=add('');const pagesId=add('');const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');const font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const pageIds=[];
 for(let i=0;i<pages.length;i++){
  let stream='';stream+='q 0.07 0.16 0.25 rg 0 0 '+PAGE_W+' 8 re f Q\n';
  stream+='BT /F2 10 Tf 0.07 0.16 0.25 rg '+LEFT+' '+(PAGE_H-34)+' Td (CALIBREX) Tj ET\n';
  stream+='BT /F1 7 Tf 0.42 0.45 0.48 rg '+(LEFT+74)+' '+(PAGE_H-34)+' Td (OSINT STUDIO  |  INVESTIGATION REPORT) Tj ET\n';
  stream+='q 0.72 0.53 0.20 RG 1.5 w '+LEFT+' '+(PAGE_H-43)+' m '+(PAGE_W-RIGHT)+' '+(PAGE_H-43)+' l S Q\n';
  for(const item of pages[i]){
   if(item.kind==='rule'){stream+='q 0.72 0.53 0.20 RG 0.6 w '+LEFT+' '+item.y+' m '+(PAGE_W-RIGHT)+' '+item.y+' l S Q\n';continue;}
   stream+='BT /'+item.font+' '+item.size+' Tf '+item.color+' rg 1 0 0 1 '+item.x+' '+item.y+' Tm ('+pdfString(item.text)+') Tj ET\n';
  }
  stream+='BT /F1 7 Tf 0.42 0.45 0.48 rg '+LEFT+' 30 Td (Case '+pdfString(caseId)+'  |  Version '+Number(version||1)+'  |  '+pdfString(new Date(generatedAt).toISOString())+') Tj ET\n';
  stream+='BT /F1 7 Tf 0.42 0.45 0.48 rg '+(PAGE_W-RIGHT-55)+' 30 Td ('+(i+1)+' / '+pages.length+') Tj ET\n';
  const streamId=add('<< /Length '+Buffer.byteLength(stream,'latin1')+' >>\nstream\n'+stream+'endstream');
  const pageId=add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 '+PAGE_W+' '+PAGE_H+'] /Resources << /Font << /F1 '+font1+' 0 R /F2 '+font2+' 0 R >> >> /Contents '+streamId+' 0 R >>');
  pageIds.push(pageId);
 }
 objects[catalogId-1]='<< /Type /Catalog /Pages '+pagesId+' 0 R >>';
 objects[pagesId-1]='<< /Type /Pages /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] /Count '+pageIds.length+' >>';
 let pdf='%PDF-1.4\n%CALIBREX\n',offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf,'latin1'));pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const xref=Buffer.byteLength(pdf,'latin1');pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+(objects.length+1)+' /Root '+catalogId+' 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 return Buffer.from(pdf,'latin1');
}
