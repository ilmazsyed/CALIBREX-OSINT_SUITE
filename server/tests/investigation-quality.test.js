import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInvestigationQuality } from '../investigation-quality.js';

test('keeps different publisher domains as review leads, not independent corroboration',()=>{
 const result=assessInvestigationQuality({evidence:[
  {id:'a',url:'https://publisher-a.example/story',title:'Claim A'},
  {id:'b',url:'https://publisher-b.example/story',title:'Claim B'}
 ],relationships:[{id:'r1',from:'a',to:'b',type:'CORROBORATES',rationale:'Both outlets appear to describe the same public event.'}]});
 assert.equal(result.corroboration.candidateRelationships.length,1);
 assert.equal(result.corroboration.candidateRelationships[0].countsAsIndependentCorroboration,false);
 assert.equal(result.corroboration.candidateRelationships[0].status,'INDEPENDENCE_REVIEW_RECORDED');
 assert.equal(result.corroboration.sourceIndependence.independenceStatus,'NOT_ESTABLISHED');
});

test('contradictions are explicitly analyst-recorded, not silently inferred',()=>{
 const result=assessInvestigationQuality({evidence:[{id:'a',title:'Report A'},{id:'b',title:'Report B'}],
  relationships:[{id:'r2',from:'a',to:'b',type:'CONTRADICTS',assessment:'OBSERVED',rationale:'Conflicting reported date.'}]});
 assert.equal(result.contradictions.count,1);
 assert.equal(result.contradictions.items[0].reviewRequired,true);
 assert.equal(result.contradictions.items[0].status,'ANALYST_FLAGGED_CONTRADICTION');
});

test('surfaces structured casualty and event-time differences as review candidates, never confirmed contradictions',()=>{
 const result=assessInvestigationQuality({evidence:[
  {id:'a',title:'Encounter in Kulgam leaves 3 injured',eventTimestamp:'2026-11-19T10:00:00Z'},
  {id:'b',title:'Encounter in Kulgam leaves 7 injured',eventTimestamp:'2026-11-19T20:00:00Z'}
 ]});
 assert.ok(result.potentialDiscrepancies.count>=2);
 assert.ok(result.potentialDiscrepancies.items.every(x=>x.status==='CANDIDATE_REQUIRES_ANALYST_REVIEW'&&x.countsAsContradiction===false));
 assert.ok(result.potentialDiscrepancies.items.some(x=>x.type==='CONFLICTING_REPORTED_FIGURES'));
 assert.ok(result.potentialDiscrepancies.items.some(x=>x.type==='EVENT_TIMESTAMP_DISAGREEMENT'));
});
