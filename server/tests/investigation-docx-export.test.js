import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { renderInvestigationDocx } from '../investigation-docx-export.js';

const report={title:'বাংলা ও हिन्दी assessment',version:3,status:'APPROVED',caseRevision:12,contentHash:'c'.repeat(64),content:'# Executive summary\n\nবাংলা প্রতিবেদন এবং हिन्दी निष्कर्ष.\n\n- Evidence item [E-123]\n\n## Findings\nA <script> string must be encoded as text.'};
function unzipTextEntries(buffer) {
  const out={};let offset=0;
  while(offset+30<buffer.length&&buffer.readUInt32LE(offset)===0x04034b50){
    const method=buffer.readUInt16LE(offset+8),size=buffer.readUInt32LE(offset+18),nameLen=buffer.readUInt16LE(offset+26),extraLen=buffer.readUInt16LE(offset+28);
    const name=buffer.toString('utf8',offset+30,offset+30+nameLen),start=offset+30+nameLen+extraLen,data=buffer.subarray(start,start+size);
    out[name]=(method===8?inflateRawSync(data):data).toString('utf8');offset=start+size;
  }
  return out;
}
test('DOCX export is a valid OOXML zip with multilingual report text and revision metadata',()=>{
 const buffer=renderInvestigationDocx({report,investigationId:'case-12',caseRevision:12});
 assert.equal(buffer.readUInt32LE(0),0x04034b50);
 const entries=unzipTextEntries(buffer);
 assert.ok(entries['[Content_Types].xml']);
 assert.match(entries['word/document.xml'],/বাংলা প্রতিবেদন/);
 assert.match(entries['word/document.xml'],/हिन्दी निष्कर्ष/);
 assert.match(entries['word/document.xml'],/Revision: 12/);
 assert.match(entries['word/document.xml'],/&lt;script&gt;/);
});
test('DOCX export rejects missing report content',()=>assert.throws(()=>renderInvestigationDocx({report:{content:''}}),/content is required/i));
