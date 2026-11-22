// Minimal, dependency-free Word Open XML package writer for investigation dossiers. 
  const xml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  const xml = value => String(value).replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch] || '')).replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]/g, '');
  const headings = new Set(['CASE DETAILS','INTELLIGENCE REQUIREMENT','RESEARCH QUESTIONS','HYPOTHESES','EVIDENCE REGISTER','ENTITY REGISTER','EVIDENCE RELATIONSHIPS','ANALYST NOTES','EVIDENCE INTEGRITY']);
  const paragraphs = text.split(/\r?\n/).map((line, index) => {
    const value = xml(line || ' ');
    const isTitle = index === 0;
    const isHeading = headings.has(line.trim());
    const props = isTitle ? '<w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>' : isHeading ? '<w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/></w:pPr>' : '';
    const run = isTitle ? '<w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="17354C"/></w:rPr>' : isHeading ? '<w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="B88A42"/></w:rPr>' : '<w:rPr><w:sz w:val="20"/></w:rPr>';
    return '<w:p>' + props + '<w:r>' + run + '<w:t xml:space="preserve">' + value + '</w:t></w:r></w:p>';
  }).join('');
  const files = [
    { name: '[Content_Types].xml', body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>' }
  ];
  const encoder = new TextEncoder();
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (view, at, value) => view.setUint16(at, value, true);
  const u32 = (view, at, value) => view.setUint32(at, value >>> 0, true);
  for (const file of files) {
    const name = encoder.encode(file.name), data = encoder.encode(file.body), crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length), lv = new DataView(local.buffer);
    u32(lv,0,0x04034b50); u16(lv,4,20); u16(lv,6,0x0800); u16(lv,8,0);
    u32(lv,14,crc); u32(lv,18,data.length); u32(lv,22,data.length); u16(lv,26,name.length);
    local.set(name,30); local.set(data,30+name.length); chunks.push(local);
    const dir = new Uint8Array(46 + name.length), dv = new DataView(dir.buffer);
    u32(dv,0,0x02014b50); u16(dv,4,20); u16(dv,6,20); u16(dv,8,0x0800); u16(dv,10,0);
    u32(dv,16,crc); u32(dv,20,data.length); u32(dv,24,data.length); u16(dv,28,name.length);
    u32(dv,42,offset); dir.set(name,46); central.push(dir); offset += local.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  u32(ev,0,0x06054b50); u16(ev,8,files.length); u16(ev,10,files.length); u32(ev,12,centralSize); u32(ev,16,offset);
  const parts = [...chunks, ...central, end];
  const archive = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { archive.set(part, cursor); cursor += part.length; }
  return new Blob([archive.buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}\n