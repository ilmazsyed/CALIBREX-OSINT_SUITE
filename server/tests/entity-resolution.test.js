import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEntityIdentityCandidates, buildEvidenceCorrelationCandidates } from '../entity-resolution.js';

test('suggests a fuzzy same-type entity identity candidate without merging records',()=>{
 const candidates=buildEntityIdentityCandidates([
  {id:'p1',name:'Jonathon Smith',aliases:['Jonathan Smith'],type:'PERSON'},
  {id:'p2',name:'Jonathan Smyth',type:'PERSON'},
  {id:'o1',name:'Jonathan Smith Logistics',type:'ORGANIZATION'}
 ]);
 assert.equal(candidates.length,1);
 assert.equal(candidates[0].leftId,'p1');
 assert.equal(candidates[0].rightId,'p2');
 assert.equal(candidates[0].status,'MACHINE_SUGGESTED');
 assert.equal(candidates[0].autoMerged,false);
});

test('does not match different entity types or unrelated names',()=>{
 const candidates=buildEntityIdentityCandidates([
  {id:'p',name:'Alex Morgan',type:'PERSON'},
  {id:'o',name:'Alex Morgan',type:'ORGANIZATION'},
  {id:'p2',name:'Completely Different',type:'PERSON'}
 ]);
 assert.equal(candidates.length,0);
});

test('correlates evidence using multiple time and geography signals',()=>{
 const candidates=buildEvidenceCorrelationCandidates([
  {id:'a',title:'Port fire reported',url:'https://a.example/story',published:1000000,lat:22.57,lon:88.36},
  {id:'b',title:'Port incident update',url:'https://b.example/update',published:1000000+3600000,lat:22.571,lon:88.361}
 ]);
 assert.equal(candidates.length,1);
 assert.ok(candidates[0].signals.includes('TEMPORALLY_PROXIMATE'));
 assert.ok(candidates[0].signals.includes('GEOGRAPHICALLY_PROXIMATE'));
 assert.equal(candidates[0].independentCorroboration,false);
 assert.equal(candidates[0].independenceAssessment,'DIFFERENT_HOSTS_NOT_VERIFIED');
});

test('flags shared URL as a dependent source candidate, not independent corroboration',()=>{
 const candidates=buildEvidenceCorrelationCandidates([
  {id:'a',title:'Story',url:'https://example.test/story?utm_source=x'},
  {id:'b',title:'Republished story',url:'https://example.test/story'}
 ]);
 assert.equal(candidates.length,1);
 assert.equal(candidates[0].independenceAssessment,'SAME_SOURCE_URL');
 assert.equal(candidates[0].independentCorroboration,false);
});

test('does not create candidates from temporal proximity alone',()=>{
 const candidates=buildEvidenceCorrelationCandidates([
  {id:'a',title:'Unrelated first report',published:1000000},
  {id:'b',title:'Unrelated second report',published:1000000+1000}
 ]);
 assert.equal(candidates.length,0);
});
