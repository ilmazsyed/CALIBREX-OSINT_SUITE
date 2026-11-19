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
