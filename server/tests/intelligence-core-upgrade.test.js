import test from 'node:test';
import assert from 'node:assert/strict';
import {assessSourceReliability,assessSourceIndependence} from '../source-reliability.js';
import {validateCoordinates,haversineDistanceMeters,compareLocationClaims} from '../geospatial-validation.js';
import {transitionInvestigationWorkflow,validateWorkflowTasks} from '../investigation-workflow.js';

test('source reliability explains factors and never calls score truth probability',()=>{
 const a=assessSourceReliability({url:'https://agency.gov/report',sourceType:'OFFICIAL',provenanceStatus:'SOURCE_CAPTURED',contentSnapshot:'captured',publishedAt:'2026-11-19T10:00:00Z',collectedAt:'2026-11-19T11:00:00Z'},[]);
 assert.ok(a.score>=0&&a.score<=100);assert.equal(a.band,'HIGH');assert.equal(a.reviewedRecords,0);
 assert.ok(a.factors.some(f=>f.name==='provenance'));assert.ok(a.caveats.some(x=>x.includes('not claim truth probability')));
});
test('source history influences reliability only after adjudication',()=>{
 const none=assessSourceReliability({url:'https://example.org',sourceType:'NEWS'},[]);
 const history=assessSourceReliability({url:'https://example.org',sourceType:'NEWS'},Array.from({length:12},()=>({outcome:'CONFIRMED'})));
 assert.ok(history.score>none.score);assert.equal(history.historyConfidence,'ESTABLISHED_HISTORY');
});
test('source independence groups same publisher host and discloses caveat',()=>{
 const x=assessSourceIndependence([{id:'1',url:'https://www.a.test/x'},{id:'2',url:'https://a.test/y'},{id:'3',url:'https://b.test/z'}]);
 assert.equal(x.independentGroupCount,2);assert.ok(x.caveat.includes('do not prove independent ownership'));
});
test('coordinate validation rejects missing and out-of-range values',()=>{
 assert.equal(validateCoordinates({lat:null,lon:0}).valid,false);
 assert.equal(validateCoordinates({lat:91,lon:0}).valid,false);
 assert.equal(validateCoordinates({lat:22.5,lon:88.3}).valid,true);
});
test('haversine handles dateline proximity',()=>{
 const d=haversineDistanceMeters({lat:0,lon:179.9},{lat:0,lon:-179.9});
 assert.ok(d>20000&&d<23000);
});
test('competing geospatial claims are flagged, not resolved',()=>{
 const r=compareLocationClaims([{id:'a',lat:22.5,lon:88.3},{id:'b',lat:28.6,lon:77.2}]);
 assert.equal(r.conflicts.length,1);assert.equal(r.status,'CONFLICTS_FOUND');
});
test('workflow enforces state transitions and reviewer approval',()=>{
 const a=transitionInvestigationWorkflow({}, {to:'COLLECTING'}, {id:'u',role:'analyst'});
 assert.equal(a.ok,true);
 const b=transitionInvestigationWorkflow(a.caseRecord,{to:'TRIAGE'},{id:'u',role:'analyst'});
 const c=transitionInvestigationWorkflow({...b.caseRecord,workflowStatus:'REVIEW'},{to:'APPROVED'},{id:'u',role:'analyst'});
 assert.equal(c.ok,false);assert.equal(c.error,'REVIEWER_ROLE_REQUIRED');
 const d=transitionInvestigationWorkflow({...b.caseRecord,workflowStatus:'REVIEW'},{to:'APPROVED'},{id:'r',role:'reviewer'});
 assert.equal(d.ok,true);assert.equal(d.caseRecord.workflowHistory.length,1);
});
test('task validation reports unknown dependencies and invalid due dates',()=>{
 const r=validateWorkflowTasks([{id:'a',title:'Collect'},{id:'b',title:'Verify',dependsOn:['missing'],dueAt:'bad'}]);
 assert.equal(r.valid,false);assert.ok(r.errors.some(e=>e.code==='UNKNOWN_DEPENDENCY'));assert.ok(r.errors.some(e=>e.code==='INVALID_DUE_DATE'));
});
