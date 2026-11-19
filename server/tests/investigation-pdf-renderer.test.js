import test from 'node:test';
import assert from 'node:assert/strict';
import {renderInvestigationPdf} from '../investigation-pdf-renderer.js';

test('renders a valid branded PDF with report metadata and multiple pages',()=>{
 const body=Array.from({length:180},(_,i)=>'Evidence item '+i+' records a source-linked observation and analyst caveat.').join('\n\n');
 const pdf=renderInvestigationPdf({title:'Test report',content:'# CALIBREX | INVESTIGATION REPORT\n\n## Executive overview\n\n'+body,caseId:'case-123',version:4,generatedAt:Date.UTC(2026,0,1)});
 const text=pdf.toString('latin1');
 assert.ok(text.startsWith('%PDF-1.4'));
 assert.ok(text.includes('/Type /Catalog'));
 assert.ok(text.includes('/BaseFont /Helvetica-Bold'));
 assert.ok(text.includes('CALIBREX'));
 assert.ok(text.includes('case-123'));
 assert.ok(text.includes('/Count '));
 assert.ok(text.endsWith('%%EOF'));
});

test('escapes PDF string delimiters and tolerates unsupported Unicode',()=>{
 const pdf=renderInvestigationPdf({content:'## Test (safe) \\ content\n\nUnsupported glyph: 🛰️'});
 const text=pdf.toString('latin1');
 assert.ok(text.includes('Test \\(safe\\)'));
 assert.ok(text.includes('Unsupported glyph:'));
});

test('includes structured evidence annexure and schematic coordinate plot',()=>{
 const pdf=renderInvestigationPdf({
  content:'# Case report\\n\\n## Findings\\n\\nA sourced claim.',
  caseId:'geo-case',version:2,
  evidence:[{id:'e1',title:'Port observation',assessment:'CLAIM',triage:'REVIEWED',source:'Port Authority',url:'https://example.test/notice',lat:22.57,lon:88.36,accuracyMeters:25,sha256:'a'.repeat(64),recordSha256:'b'.repeat(64)}],
  geojson:{features:[
   {type:'Feature',geometry:{type:'Point',coordinates:[88.36,22.57]},properties:{title:'Port observation',assessment:'CLAIM'}},
   {type:'Feature',geometry:{type:'Point',coordinates:[88.4,22.6]},properties:{title:'Second observation',assessment:'FACT'}}
  ]}
 });
 const text=pdf.toString('latin1');
 assert.ok(text.includes('Annexure A'));
 assert.ok(text.includes('Port Authority'));
 assert.ok(text.includes('Evidence coordinate plot'));
 assert.ok(text.includes('Longitude'));
 assert.ok(text.includes('Latitude'));
 assert.ok(text.includes('Evidence record SHA-256'));
 assert.match(text,/\/Count 2/);
});
