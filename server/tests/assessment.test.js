import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLE_PROFILES,validateStructuredAssessment,assessAssessmentQuality,roleAssessmentChecklist} from '../assessment.js';

const evidence=[{id:'e1',url:'https://a.example/story',source:'A',assessment:'CLAIM'},{id:'e2',url:'https://b.example/story',source:'B',assessment:'CLAIM'}];
test('provides five distinct role profiles and workflows',()=>{
 assert.equal(Object.keys(ROLE_PROFILES).length,5);
 for(const role of Object.keys(ROLE_PROFILES)) assert.equal(roleAssessmentChecklist(role).workflow.length,8);
});
test('validates key judgements and constrains evidence references to case evidence',()=>{
 const a=validateStructuredAssessment({role:'DEFENCE_IW',keyJudgements:[{title:'Escalation risk',statement:'Force posture suggests elevated risk',confidence:70,evidenceForIds:['e1','not-in-case'],evidenceAgainstIds:['e2']}]},evidence);
 assert.equal(a.keyJudgements[0].confidenceLevel,'MODERATE');
 assert.deepEqual(a.keyJudgements[0].evidenceForIds,['e1']);
 assert.deepEqual(a.keyJudgements[0].evidenceAgainstIds,['e2']);
});
test('evaluates numeric and change indicators without inventing data',()=>{
 const a=validateStructuredAssessment({indicators:[{name:'Port delay index',operator:'GTE',threshold:5,observed:7},{name:'AIS anomaly',operator:'CHANGED',changed:true}]},evidence);
 assert.equal(a.indicators[0].status,'TRIGGERED');
 assert.equal(a.indicators[1].status,'TRIGGERED');
 const missing=validateStructuredAssessment({indicators:[{name:'Unknown',operator:'GT',threshold:5}]},evidence);
 assert.equal(missing.indicators[0].status,'UNASSESSED');
});
test('keeps alternative hypotheses, assumptions and scenarios explicit',()=>{
 const a=validateStructuredAssessment({assumptions:['Port remains operational'],alternativeHypotheses:[{title:'Weather disruption',explanation:'Storm could explain delays'}],scenarios:[{title:'Prolonged closure',description:'Terminal closed for more than 72 hours',likelihood:'MEDIUM',impact:'HIGH'}]},evidence);
 assert.equal(a.assumptions.length,1);assert.equal(a.alternativeHypotheses.length,1);assert.equal(a.scenarios[0].impact,'HIGH');
});
test('quality score is completeness only and lists gaps',()=>{
 const q=assessAssessmentQuality({keyJudgements:[{title:'J1',statement:'Claim',confidence:40,evidenceForIds:['e1']}],assumptions:['A'],alternativeHypotheses:[{title:'Alt',explanation:'Other'}],indicators:[{name:'I'}],scenarios:[{title:'S',description:'Scenario'}]},evidence);
 assert.ok(q.score>0);assert.ok(q.score<=100);assert.match(q.caveats[0],/not analytical accuracy/);assert.ok(Array.isArray(q.missing));
});
test('invalid role safely falls back to geopolitical profile',()=>{
 assert.equal(validateStructuredAssessment({role:'UNKNOWN'}).role,'GEOPOLITICAL');
});

test('quality calculation leaves an empty indicator unassessed',()=>{ const a=validateStructuredAssessment({indicators:[{name:'Unmeasured',operator:'GT',threshold:10}]},evidence); assert.equal(a.indicators[0].status,'UNASSESSED'); });
