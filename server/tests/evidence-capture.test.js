import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArticleEvidenceRecord } from '../evidence-capture.js';
import { validateInvestigation } from '../intelligence.js';

test('captured article evidence retains content hash and source provenance',()=>{
 const body='A sufficiently long public source article body for a capture test.';
 const record=buildArticleEvidenceRecord({url:'https://example.org/story?utm_source=test#top',
  article:{url:'https://example.org/story',title:'Test report',siteName:'Example',published:1763596800000,text:body,
   provenance:{sha256:'a'.repeat(64),capturedAt:1763596800000,capturedAtIso:'2026-11-20T00:00:00.000Z',url:'https://example.org/story',bytes:body.length}},
  sourceType:'MEDIA',assessment:'CLAIM',analystId:'analyst-1',capturedAt:1763596801000});
 assert.equal(record.url,'https://example.org/story?utm_source=test');
 assert.equal(record.contentSnapshot,body);
 assert.equal(record.captureStatus,'CAPTURED');
 assert.equal(record.provenanceStatus,'SOURCE_CAPTURED');
 assert.match(record.sha256,/^[a-f0-9]{64}$/);
 assert.equal(record.sourceCaptureSha256,'a'.repeat(64));
 assert.equal(record.assessment,'CLAIM');
});

test('failed article capture preserves a URL-only evidence record and explicit failure status',()=>{
 const record=buildArticleEvidenceRecord({url:'https://publisher.example/paywall',captureError:'Publisher blocks automated reading.',capturedAt:1763596801000});
 assert.equal(record.contentSnapshot,null);
 assert.equal(record.sha256,null);
 assert.equal(record.captureStatus,'UNAVAILABLE');
 assert.equal(record.provenanceStatus,'SOURCE_UNAVAILABLE');
 assert.match(record.captureError,/blocks automated reading/);
});

test('invalid URL schemes are rejected before evidence is created',()=>{
 assert.throws(()=>buildArticleEvidenceRecord({url:'file:///etc/passwd'}),/HTTP or HTTPS/);
});

test('investigation validation preserves explicit failed capture provenance',()=>{
 const record=buildArticleEvidenceRecord({url:'https://publisher.example/paywall',captureError:'Publisher denied access.'});
 const saved=validateInvestigation({title:'Capture failure',evidence:[record]}).evidence[0];
 assert.equal(saved.captureStatus,'UNAVAILABLE');
 assert.equal(saved.provenanceStatus,'SOURCE_UNAVAILABLE');
 assert.match(saved.captureError,/denied access/);
});
