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
