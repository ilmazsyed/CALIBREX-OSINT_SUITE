import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyObservation, detectIntelligencePatterns, scoreIntelligenceAlert, buildEventCandidates, validateInvestigation, validateAlertRule, evaluateAlertRules, extractEntityCandidates, buildStixBundle, createEvidenceLedgerEntry, verifyEvidenceLedger } from '../intelligence.js';

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

test('alert rules validate bounds and evaluate keyword/category/severity filters',()=>{
 const rule=validateAlertRule({name:'Port disruption',categories:['LOGISTICS_SUPPLY_CHAIN'],keywords:['port','closure'],matchMode:'ANY',minSeverity:'HIGH'});
 const items=[
  {id:'1',title:'Port closure reported',category:'LOGISTICS_SUPPLY_CHAIN',severity:'HIGH',kind:'news'},
  {id:'2',title:'Port update',category:'LOGISTICS_SUPPLY_CHAIN',severity:'LOW',kind:'news'},
  {id:'3',title:'Port closure rumour',category:'LOGISTICS_SUPPLY_CHAIN',severity:'CRITICAL',kind:'social'}
 ];
 const matches=evaluateAlertRules([{...rule,id:'r1'}],items);
 assert.equal(matches.length,1);assert.equal(matches[0].count,1);assert.equal(matches[0].matches[0].id,'1');
});
test('alert rules exclude social posts unless explicitly enabled',()=>{
 const rule=validateAlertRule({name:'Social signal',keywords:['border'],includeSocial:false});
 const result=evaluateAlertRules([rule],[{id:'s',title:'Border update',kind:'social',severity:'HIGH'}]);
 assert.equal(result.length,0);
 assert.throws(()=>validateAlertRule({name:'x'}));
});


test('investigation model preserves unresolved entities and claim relationships',()=>{
 const x=validateInvestigation({title:'Cross-border logistics',entities:[{id:'e1',name:'example.com',type:'DOMAIN',resolution:'UNRESOLVED',confidence:0,sourceEvidenceIds:['src1']}],relationships:[{id:'r1',from:'src1',to:'src2',type:'CONTRADICTS',assessment:'ASSESSED',rationale:'Different reported dates'}]});
 assert.equal(x.entities[0].resolution,'UNRESOLVED');
 assert.equal(x.relationships[0].type,'CONTRADICTS');
 assert.equal(x.relationships[0].assessment,'ASSESSED');
});
test('entity candidate extraction finds technical identifiers without asserting identity',()=>{
 const found=extractEntityCandidates({evidence:[{id:'src1',title:'Investigate https://www.example.com/path and @public_handle #PortWatch'}]});
 assert.ok(found.some(x=>x.name==='example.com'&&x.type==='DOMAIN'&&x.resolution==='UNRESOLVED'));
 assert.ok(found.some(x=>x.name==='@public_handle'&&x.type==='ACCOUNT'));
 assert.ok(found.every(x=>x.resolution==='UNRESOLVED'));
});

test('STIX export contains only unresolved domain and IPv4 indicators',()=>{
 const bundle=buildStixBundle({evidence:[{id:'d',title:'Domain https://example.com/path'},{id:'ip',title:'Observed address 8.8.8.8'}]});
 assert.equal(bundle.type,'bundle');
 assert.equal(bundle.objects.length,2);
 assert.ok(bundle.objects.every(x=>x.type==='indicator'&&x.spec_version==='2.1'&&x.confidence===0));
 assert.ok(bundle.objects.some(x=>x.pattern.includes('domain-name:value')));
 assert.ok(bundle.objects.some(x=>x.pattern.includes('ipv4-addr:value')));
});

test('evidence ledger verifies canonical chained records and detects tampering',()=>{
 const first=createEvidenceLedgerEntry({investigationId:'case1',evidenceId:'ev1',action:'ADDED',at:100,actor:'analyst',evidence:{id:'ev1',title:'Source A'}});
 const second=createEvidenceLedgerEntry({investigationId:'case1',evidenceId:'ev2',action:'ADDED',at:200,actor:'analyst',evidence:{title:'Source B',id:'ev2'}},first.hash,2);
 assert.equal(verifyEvidenceLedger([first,second]).valid,true);
 const altered={...second,evidenceDigest:'f'.repeat(64)};
 assert.equal(verifyEvidenceLedger([first,altered]).valid,false);
 assert.ok(verifyEvidenceLedger([first,altered]).errors.some(x=>x.reason==='ENTRY_HASH_MISMATCH'));
});
test('evidence ledger detects broken links, sequence gaps and removals as explicit actions',()=>{
 const first=createEvidenceLedgerEntry({investigationId:'case1',evidenceId:'ev1',action:'REMOVED',evidence:{id:'ev1'}});
 assert.equal(first.action,'REMOVED');
 const second=createEvidenceLedgerEntry({investigationId:'case1',evidenceId:'ev2',evidence:{id:'ev2'}},'f'.repeat(64),3);
 const result=verifyEvidenceLedger([first,second]);
 assert.equal(result.valid,false);
 assert.ok(result.errors.some(x=>x.reason==='PREVIOUS_HASH_MISMATCH'));
 assert.ok(result.errors.some(x=>x.reason==='SEQUENCE_GAP'));
});
