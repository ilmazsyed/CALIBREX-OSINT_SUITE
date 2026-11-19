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
