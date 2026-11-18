import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMAIN_SOURCE_CATALOG,SPECIALIST_PACKS,normaliseObservation,buildCountryProfile,resolveEntityCandidates,clusterEventCandidates,evaluateWarningIndicator,createForecastRecord,scoreForecastOutcome} from '../domain-intelligence.js';

test('catalogue covers all five specialist domains with access caveats',()=>{
 assert.ok(DOMAIN_SOURCE_CATALOG.length>=10);
 for(const role of ['DEFENCE_IW','CORPORATE_RISK','SUPPLY_CHAIN','GEOPOLITICAL','STRATEGIC'])assert.ok(SPECIALIST_PACKS[role].events.length);
 assert.equal(DOMAIN_SOURCE_CATALOG.find(x=>x.id==='mca').access,'PUBLIC_PORTAL');
});
test('normalises observations and preserves provenance and claim status',()=>{
 const x=normaliseObservation({url:'https://www.example.com/a',title:'Port closure',publishedAt:123,assessment:'CLAIM',countryCodes:['in']});
 assert.equal(x.sourceDomain,'example.com');assert.equal(x.assessment,'CLAIM');assert.equal(x.countryCodes[0],'IN');assert.equal(x.provenance.originalUrl,x.url);assert.equal(x.provenance.contentHash.length,64);
});
test('country profile is bounded by supplied observations and indicators',()=>{
 const p=buildCountryProfile('IN',[{id:'e1',countryCodes:['IN'],domain:'TRADE',capturedAt:100}], [{id:'i1',countryCode:'IN',name:'Exports',value:10}]);
 assert.equal(p.observationCount,1);assert.equal(p.indicatorCount,1);assert.deepEqual(p.sourceDomains,['TRADE']);
});
test('entity resolution proposes candidates and never auto merges',()=>{
 const links=resolveEntityCandidates([{id:'1',type:'COMPANY',name:'Acme Industries Ltd'},{id:'2',type:'COMPANY',name:'Acme Industries Limited'}]);
 assert.equal(links.length,1);assert.equal(links[0].autoMerged,false);assert.equal(links[0].status,'CANDIDATE_REQUIRES_HUMAN_REVIEW');
});
test('event clustering groups similar records but keeps review status',()=>{
 const groups=clusterEventCandidates([{id:'a',title:'Port terminal closes after severe storm',sourceDomain:'a.test',publishedAt:1},{id:'b',title:'Severe storm closes port terminal',sourceDomain:'b.test',publishedAt:2}]);
 assert.equal(groups.length,1);assert.equal(groups[0].status,'CANDIDATE_REQUIRES_REVIEW');
});
test('warning indicators do not turn missing observations into negatives',()=>{
 assert.equal(evaluateWarningIndicator({name:'X',threshold:5}).status,'UNASSESSED');
 assert.equal(evaluateWarningIndicator({name:'X',operator:'GTE',threshold:5,observed:5}).status,'TRIGGERED');
});
test('forecast records require a future horizon and score only resolved binary outcomes',()=>{
 const f=createForecastRecord({question:'Will the port remain closed?',horizonAt:Date.now()+86400000,probability:70});
 const yes=scoreForecastOutcome(f,{result:'YES'});
 assert.ok(yes.brierScore!==null);assert.equal(scoreForecastOutcome(f,{result:'PARTIAL'}).brierScore,null);
});
