import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInvestigationReport} from '../investigation-report-builder.js';

test('builds a report from case evidence with traceable evidence references',()=>{
 const r=buildInvestigationReport({id:'case-1',title:'Port disruption',objective:'Assess reported port closure',revision:3,
  evidence:[{id:'evidence-1234567890',title:'Port authority notice',source:'Port Authority',url:'https://port.example/notice',assessment:'CLAIM',provenanceStatus:'SOURCE_LINK_ONLY',capturedAt:1763500000000}],
  notes:[{id:'n1',text:'Check vessel movements',createdAt:1763500100000}],
  questions:['Is the terminal closed?']},{ledgerHead:'a'.repeat(64)});
 assert.match(r.markdown,/CALIBREX \| INVESTIGATION INTELLIGENCE REPORT/);
 assert.match(r.markdown,/E-evidence-123/);
 assert.match(r.markdown,/Source reliability assessment/);
 assert.match(r.markdown,/Evidence ledger head/);
 assert.equal(r.evidenceCount,1);assert.equal(r.caseRevision,3);assert.equal(r.quality.requiresAnalystReview,true);
 assert.match(r.plainText,/Port disruption/);
});
test('reports missing evidence and unlinked judgement gaps without inventing findings',()=>{
 const r=buildInvestigationReport({id:'empty',title:'Empty case',evidence:[],notes:[],assessment:{keyJudgements:[]}});
 assert.equal(r.evidenceCount,0);assert.ok(r.quality.gaps.some(x=>x.includes('No evidence')));
 assert.match(r.markdown,/No structured key judgements recorded/);
});
test('keeps geospatial checks cautious and flags malformed coordinates',()=>{
 const r=buildInvestigationReport({title:'Geo test',evidence:[{id:'g1',title:'Location claim',lat:999,lon:20,assessment:'CLAIM'}]});
 assert.match(r.markdown,/INVALID/);assert.match(r.markdown,/coordinate/);
});

test('reports analyst keyframe notes and marks visual location candidates unverified',()=>{
 const r=buildInvestigationReport({id:'video-case',title:'Video review',evidence:[{
  id:'clip-1',title:'Source clip',assessment:'CLAIM',videoSha256:'a'.repeat(64),
  videoMetadata:{keyframes:[{id:'frame-1',timecode:'00:00:12',timestampSeconds:12,sha256:'b'.repeat(64),visualNote:'Blue sign at junction',candidateLocation:{name:'Possible Kolkata',lat:22.57,lon:88.36,status:'UNVERIFIED'}}]}
 }]});
 assert.match(r.markdown,/Video keyframe review/);
 assert.match(r.markdown,/Blue sign at junction/);
 assert.match(r.markdown,/Possible Kolkata/);
 assert.match(r.markdown,/UNVERIFIED/);
});

test('includes source capture status, fingerprints and failed capture gaps',()=>{
 const report=buildInvestigationReport({title:'Capture QA',evidence:[
  {id:'captured-1',title:'Captured report',url:'https://example.org/a',assessment:'CLAIM',provenanceStatus:'SOURCE_CAPTURED',captureStatus:'CAPTURED',sha256:'a'.repeat(64),sourceCaptureSha256:'b'.repeat(64),sourceCaptureAt:1763596800000},
  {id:'failed-2',title:'Unavailable report',url:'https://example.org/b',assessment:'CLAIM',provenanceStatus:'SOURCE_UNAVAILABLE',captureStatus:'UNAVAILABLE',captureError:'Publisher denied access.'}
 ]});
 assert.match(report.markdown,/Source capture and provenance integrity/);
 assert.match(report.markdown,/CAPTURED/);
 assert.match(report.markdown,/UNAVAILABLE/);
 assert.match(report.markdown,/Publisher denied access/);
 assert.ok(report.quality.gaps.some(x=>x.includes('capture attempts failed')));
});
