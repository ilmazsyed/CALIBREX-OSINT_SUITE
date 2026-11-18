import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {ROLE_PROFILES,validateStructuredAssessment,assessAssessmentQuality,roleAssessmentChecklist} from '../assessment.js';
import {validateInvestigation} from '../intelligence.js';

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


test('investigation evidence and notes receive stable non-empty IDs',()=>{
 const first=validateInvestigation({title:'Evidence identity test',evidence:[{title:'Lead A',source:'Analyst note',assessment:'CLAIM'}],notes:[{text:'Analyst observation'}]});
 assert.match(first.evidence[0].id,/^ev_[0-9a-f-]{36}$/);
 assert.match(first.notes[0].id,/^note_[0-9a-f-]{36}$/);
 assert.notEqual(first.evidence[0].id,first.notes[0].id);
 const second=validateInvestigation({...first,title:'Evidence identity test'});
 assert.equal(second.evidence[0].id,first.evidence[0].id);
 assert.equal(second.notes[0].id,first.notes[0].id);
});

test('source content snapshots receive SHA-256 while analyst-only notes are explicitly unverified',()=>{
 const captured='Full source article text captured at collection time.';
 const result=validateInvestigation({title:'Provenance test',evidence:[
  {title:'Captured source',url:'https://news.example/report',source:'News Example',contentSnapshot:captured},
  {title:'Analyst observation',url:'',source:'Analyst',notes:'Summary written by analyst'}
 ]});
 const [source,observation]=result.evidence;
 assert.equal(source.sha256,crypto.createHash('sha256').update(captured,'utf8').digest('hex'));
 assert.match(source.sha256,/^[a-f0-9]{64}$/);
 assert.equal(source.hashScope,'SOURCE_CONTENT_SNAPSHOT');
 assert.equal(source.provenanceStatus,'SOURCE_CAPTURED');
 assert.equal(observation.sha256,null);
 assert.equal(observation.provenanceStatus,'ANALYST_SUPPLIED_NO_EXTERNAL_SOURCE');
 assert.equal(observation.sourceIndependence,'UNKNOWN');
 assert.match(observation.recordSha256,/^[a-f0-9]{64}$/);
});

test('assessment quality does not award source diversity for unverified publisher labels',()=>{
 const unverified=assessAssessmentQuality({},[
  {id:'a',url:'https://one.example/a',source:'Publisher One',recordSha256:'a'.repeat(64)},
  {id:'b',url:'https://two.example/b',source:'Publisher Two',recordSha256:'b'.repeat(64)},
  {id:'c',url:'https://three.example/c',source:'Publisher Three',recordSha256:'c'.repeat(64)},
  {id:'d',url:'https://four.example/d',source:'Publisher Four',recordSha256:'d'.repeat(64)}
 ]);
 assert.equal(unverified.dimensions.sourceDiversity,0);
 const verified=assessAssessmentQuality({},[
  {id:'a',url:'https://one.example/a',sourceIndependence:'INDEPENDENT_VERIFIED',recordSha256:'a'.repeat(64)},
  {id:'b',url:'https://two.example/b',sourceIndependence:'INDEPENDENT_VERIFIED',recordSha256:'b'.repeat(64)},
  {id:'c',url:'https://three.example/c',sourceIndependence:'INDEPENDENT_VERIFIED',recordSha256:'c'.repeat(64)},
  {id:'d',url:'https://four.example/d',sourceIndependence:'INDEPENDENT_VERIFIED',recordSha256:'d'.repeat(64)}
 ]);
 assert.equal(verified.dimensions.sourceDiversity,100);
 assert.equal(verified.dimensions.evidenceIdentity,100);
 assert.equal(verified.dimensions.recordIntegrity,100);
});
