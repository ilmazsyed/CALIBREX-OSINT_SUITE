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
