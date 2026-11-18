import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFENCE_SOURCE_REGISTER,corroborateDefenceSignals,assessDefencePosture,analyseInformationNarratives,evaluateDefenceIndicators,buildDefenceBrief} from '../defence-intelligence.js';
import {ROLE_WORKFLOWS,validateRoleAssessment} from '../specialist-workflows.js';

test('defence source register spans official, research and media-monitoring sources',()=>{
 assert.ok(DEFENCE_SOURCE_REGISTER.length>=10);
 assert.ok(DEFENCE_SOURCE_REGISTER.some(x=>x.id==='sipri-arms'));
});
test('syndicated sources are not counted as independent corroboration',()=>{
 const rows=[
  {id:'1',domain:'POSTURE',claim:'Joint exercise announced in region',source:'wire-a',independenceGroup:'wire-parent',evidenceType:'MEDIA_REPORT'},
  {id:'2',domain:'POSTURE',claim:'Joint exercise announced in region',source:'wire-b',independenceGroup:'wire-parent',evidenceType:'MEDIA_REPORT'}
 ];
 const out=corroborateDefenceSignals(rows);
 assert.equal(out[0].independentSourceGroups,1);
 assert.equal(out[0].status,'SINGLE_SOURCE_OR_SYNDICATED');
});
test('posture summary labels public-source limitations and never asserts readiness',()=>{
 const out=assessDefencePosture({signals:[{id:'1',domain:'EXERCISE',claim:'Exercise announced',publishedAt:Date.now(),countryCodes:['IN'],evidenceType:'OFFICIAL_STATEMENT'}]});
 assert.equal(out.signalCount,1);
 assert.match(out.judgements[0],/not a force-readiness assessment/i);
});
test('information narrative analytics leave attribution and coordination unassessed',()=>{
 const out=analyseInformationNarratives([{domain:'INFORMATION',theme:'Narrative A',claim:'Narrative A',source:'platform-a'},{domain:'INFORMATION',theme:'Narrative A',claim:'Narrative A',source:'platform-b'}]);
 assert.equal(out[0].attribution,'UNASSESSED');assert.equal(out[0].coordination,'UNASSESSED');
});
test('missing defence indicator values remain unassessed',()=>{
 assert.equal(evaluateDefenceIndicators([{id:'x',threshold:3}])[0].status,'UNASSESSED');
});
test('defence brief returns domain coverage and explicit collection limitations',()=>{
 const out=buildDefenceBrief({signals:[],indicators:[]});
 assert.equal(out.scope,'OPEN_SOURCE_STRATEGIC_LEVEL');
 assert.equal(out.domains.INFORMATION.label,'Information environment & influence narratives');
 assert.ok(out.limitations.length>=4);
});
test('all five role workflows have 8.5 target and distinct quality gates',()=>{
 for(const role of ['DEFENCE_IW','CORPORATE_RISK','SUPPLY_CHAIN','GEOPOLITICAL','STRATEGIC']){
  assert.equal(ROLE_WORKFLOWS[role].target,role==='DEFENCE_IW'?8.5:7.5);
  assert.ok(ROLE_WORKFLOWS[role].qualityGates.length>=4);
 }
});
test('workflow validation measures completeness, not accuracy',()=>{
 const result=validateRoleAssessment('DEFENCE_IW',{});
 assert.equal(result.completenessPercent,0);
 assert.match(result.note,/does not measure truth/i);
});

test('syndicated defence reports count as one independent source group',()=>{
 const rows=[
  {id:'a',domain:'POSTURE',claim:'Joint military exercise announced in the region',source:'Outlet A',url:'https://a.example/story',publishedAt:Date.now(),independenceGroup:'wire-service-x',evidenceType:'MEDIA_REPORT'},
  {id:'b',domain:'POSTURE',claim:'Joint military exercise announced in the region',source:'Outlet B',url:'https://b.example/story',publishedAt:Date.now(),independenceGroup:'wire-service-x',evidenceType:'MEDIA_REPORT'}
 ];
 const groups=corroborateDefenceSignals(rows);
 assert.equal(groups.length,1);
 assert.equal(groups[0].independentSourceGroups,1);
 assert.equal(groups[0].status,'SINGLE_SOURCE_OR_SYNDICATED');
});

test('independent publishers increase corroboration but do not prove a claim',()=>{
 const rows=['publisher-a','publisher-b','publisher-c'].map((domain,i)=>({
  id:'i'+i,domain:'EXERCISE',claim:'Joint naval exercise announced near Taiwan',
  source:domain,url:'https://'+domain+'.example/story',publishedAt:Date.now(),
  independenceGroup:domain,evidenceType:i===0?'DOCUMENT':'MEDIA_REPORT'
 }));
 const groups=corroborateDefenceSignals(rows);
 assert.equal(groups.length,1);
 assert.equal(groups[0].independentSourceGroups,3);
 assert.match(groups[0].warning,/does not prove/);
});

test('narrative frequency never assigns coordination or attribution',()=>{
 const rows=['a','b','c'].map((source,i)=>({
  id:'n'+i,domain:'INFORMATION',claim:'A repeated public narrative claim',
  theme:'public narrative',source,url:'https://'+source+'.example/post',
  publishedAt:Date.now()-i*60000,independenceGroup:source,evidenceType:'SOCIAL_POST'
 }));
 const brief=buildDefenceBrief({signals:rows,indicators:[]});
 assert.ok(brief.narratives.every(x=>x.attribution==='UNASSESSED'&&x.coordination==='UNASSESSED'));
});

test('claim review keeps supporting and contradictory evidence visible together',()=>{
 const review=reviewClaimEvidence({
  claim:'A port facility is closed',
  supporting:[{id:'s1',sourceDomain:'publisher-a'},{id:'s2',sourceDomain:'publisher-b'}],
  contradicting:[{id:'c1',sourceDomain:'official-port-authority'}],
  unassessed:[{id:'u1',sourceDomain:'social'}]
 });
 assert.equal(review.status,'CONFLICTING_EVIDENCE_REQUIRES_REVIEW');
 assert.equal(review.judgement,'NOT_ADJUDICATED');
 assert.deepEqual(review.evidence.supportingIds,['s1','s2']);
 assert.deepEqual(review.evidence.contradictingIds,['c1']);
 assert.deepEqual(review.evidence.unassessedIds,['u1']);
});

test('unreviewed collected claims remain unassessed rather than being counted as support',()=>{
 const review=reviewClaimEvidence({claim:'A public claim',unassessed:[{id:'lead-1',source:'Public feed'}]});
 assert.equal(review.status,'UNASSESSED');
 assert.deepEqual(review.evidence.supportingIds,[]);
 assert.deepEqual(review.evidence.unassessedIds,['lead-1']);
});
