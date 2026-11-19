import { deflateRawSync } from 'node:zlib';
import crypto from 'node:crypto';

const xml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n=0;n<256;n++) { let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1); table[n]=c>>>0; }
  return table;
})();
const crc32 = data => { let c=0xffffffff; for(const b of data)c=crcTable[(c^b)&0xff]^(c>>>8); return (c^0xffffffff)>>>0; };
const dosTime = date => {
  const d=new Date(date); const year=Math.max(1980,d.getFullYear());
  return {time:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date:((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};
};
function zip(entries) {
  const local=[],central=[]; let offset=0; const stamp=dosTime(new Date());
  for(const [name,value] of entries) {
    const filename=Buffer.from(name),raw=Buffer.from(value,'utf8'),compressed=deflateRawSync(raw),crc=crc32(raw);
    const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x0800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(stamp.time,10);h.writeUInt16LE(stamp.date,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(filename.length,26);
    local.push(h,filename,compressed);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(0x0314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x0800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(stamp.time,12);c.writeUInt16LE(stamp.date,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
    central.push(c,filename);offset+=h.length+filename.length+compressed.length;
  }
  const centralBytes=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralBytes.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,centralBytes,end]);
}
const runText = value => String(value ?? '').replace(/\*\*(.+?)\*\*/g,'$1').replace(/\[(E-[A-Za-z0-9_-]+)\]/g,'$1').trim();
function paragraphs(markdown) {
  const lines=String(markdown||'').replace(/\r/g,'').split('\n'),out=[];
  for(let i=0;i<lines.length;i++) {
    const line=lines[i].trim(); if(!line||line==='---')continue;
    const heading=line.match(/^(#{1,3})\s+(.*)$/);
    if(heading){const level=heading[1].length;out.push('<w:p><w:pPr><w:pStyle w:val="Heading'+level+'"/></w:pPr><w:r><w:t xml:space="preserve">'+xml(runText(heading[2]))+'</w:t></w:r></w:p>');continue;}
    if(/^[-*]\s+/.test(line)){out.push('<w:p><w:pPr><w:pStyle w:val="ListParagraph"/></w:pPr><w:r><w:t>• '+xml(runText(line.replace(/^[-*]\s+/,'')))+'</w:t></w:r></w:p>');continue;}
    if(/^\|/.test(line)){const cells=line.split('|').slice(1,-1).map(x=>x.trim());if(cells.every(x=>/^:?-{2,}:?$/.test(x)))continue;out.push('<w:p><w:r><w:t xml:space="preserve">'+xml(cells.join('   |   '))+'</w:t></w:r></w:p>');continue;}
    out.push('<w:p><w:r><w:t xml:space="preserve">'+xml(runText(line))+'</w:t></w:r></w:p>');
  }
  return out.join('');
}
export function renderInvestigationDocx({report,investigationId,caseRevision}={}) {
  if(!report||typeof report.content!=='string'||!report.content.trim())throw new Error('A saved report with content is required.');
  const title=xml(report.title||'Investigation report'),caseId=xml(investigationId||'Not recorded');
  const revision=xml(report.caseRevision??caseRevision??'Not recorded'),version=xml(report.version??'Not recorded');
  const hash=xml(report.contentHash||crypto.createHash('sha256').update(report.content).digest('hex'));
  const body=paragraphs(report.content);
  const document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+
    '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>CALIBREX | INVESTIGATION INTELLIGENCE REPORT</w:t></w:r></w:p>'+
    '<w:p><w:r><w:t>'+title+'</w:t></w:r></w:p>'+
    '<w:p><w:r><w:t>Case: '+caseId+' | Revision: '+revision+' | Report version: '+version+'</w:t></w:r></w:p>'+
    '<w:p><w:r><w:t>Content SHA-256: '+hash+'</w:t></w:r></w:p>'+body+
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'+
    '</w:body></w:document>';
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Noto Sans Bengali"/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style></w:styles>';
  const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const docRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  return zip([['[Content_Types].xml',types],['_rels/.rels',rels],['word/document.xml',document],['word/styles.xml',styles],['word/_rels/document.xml.rels',docRels]]);
}
