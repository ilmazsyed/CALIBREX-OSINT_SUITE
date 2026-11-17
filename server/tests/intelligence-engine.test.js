import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyObservation, detectIntelligencePatterns, scoreIntelligenceAlert, buildEventCandidates, validateInvestigation } from '../intelligence.js';

const t=Date.now();
const post=(id,authorId,title,offset=0,url='')=>({id,authorId,title,kind:'social',published:t+offset,url});

test('detects near-similar public chatter from distinct authors as a review lead',()=>{
 const items=[post('a','1','Port terminal operations suspended following major incident'),post('b','2','Port terminal operations suspended following major incident',60000),post('c','3','Port terminal operations suspended following major incident',120000)];
 const patterns=detectIntelligencePatterns(items);
 assert.ok(patterns.some(x=>x.type==='SIMILAR_TEXT_BURST'&&x.accountCount===3));
 assert.equal(patterns[0].assessment,'REVIEW_LEAD_ONLY');
});
test('detects shared public URL burst despite different wording',()=>{
 const items=[post('a','1','I am reading this port update now',0,'https://example.com/story?utm_source=x'),post('b','2','Interesting update for shipping',60000,'https://example.com/story'),post('c','3','More information here',120000,'https://example.com/story#top')];
 assert.ok(detectIntelligencePatterns(items).some(x=>x.type==='SHARED_URL_BURST'));
});
test('does not flag two authors or a time-separated burst',()=>{
 assert.equal(detectIntelligencePatterns([post('a','1','Port operations suspended following incident'),post('b','2','Port operations suspended following incident',60000)]).length,0);
 assert.equal(detectIntelligencePatterns([post('a','1','Port operations suspended following incident'),post('b','2','Port operations suspended following incident',31*60000),post('c','3','Port operations suspended following incident',32*60000)]).length,0);
});
test('keeps alert dimensions separate and explains priority is not truth',()=>{
 const x=scoreIntelligenceAlert({severity:'HIGH',confidence:30,relevance:80,urgency:70,independentSources:2});
 assert.equal(x.confidence,30);assert.equal(x.severity,'HIGH');assert.match(x.explanation,/not a probability/);
});
test('event candidates are explicitly review-only',()=>{
 const x=buildEventCandidates([{title:'Port terminal suspends operations after incident'},{title:'Port terminal suspends operations after incident'}]);
 assert.equal(x[0].status,'CANDIDATE_REQUIRES_REVIEW');
});
test('investigation validator bounds and classifies evidence',()=>{
 const x=validateInvestigation({title:'Port disruption',evidence:[{id:'e1',url:'https://example.com/a',assessment:'FACT',sha256:'a'.repeat(64)}]});
 assert.equal(x.evidence[0].assessment,'FACT');assert.equal(x.evidence[0].url,'https://example.com/a');
 assert.throws(()=>validateInvestigation({title:'x'}));
});
test('observation provenance labels social content unverified',()=>{
 assert.equal(classifyObservation({kind:'social'}).verification,'UNVERIFIED');
 assert.equal(classifyObservation({kind:'official'}).verification,'SOURCE_PRIMARY');
});
