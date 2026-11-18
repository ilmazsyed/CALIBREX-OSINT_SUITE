import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseSourceCandidate,validateCandidateMetadata,candidateDuplicate,prepareCandidateBatch,assessCandidateResponse,sourceActivationEligibility,transitionCandidate} from '../source-candidates.js';

const valid = (overrides = {}) => normaliseSourceCandidate({
 id:'candidate-one',name:'National statistics API',layer:'official',category:'statistics',
 region:'South Asia',country:'IN',endpoint:'https://example.gov.in/data.xml',
 accessMethod:'RSS/API',accessModel:'public-api',language:'en',cadenceMinutes:15,
 licence:'review-required',licenceEvidence:'Terms page requires review',
 provenance:'Discovered from official agency portal',...overrides
},overrides.id || 'candidate-one');

test('candidate metadata requires geography, provenance, access and licence evidence',()=>{
 assert.deepEqual(validateCandidateMetadata(valid()),[]);
 assert.ok(validateCandidateMetadata(valid({country:'India'})).some(x=>x.includes('ISO alpha-2')));
 assert.ok(validateCandidateMetadata(valid({licenceEvidence:''})).some(x=>x.includes('Licence')));
 assert.ok(validateCandidateMetadata(valid({provenance:''})).some(x=>x.includes('provenance')));
});

test('unsafe URLs and embedded secrets are rejected before validation',()=>{
 for(const endpoint of ['file:///etc/passwd','http://127.0.0.1/feed','https://user:pass@example.com/feed','https://example.com/feed?api_key=secret','https://example.com:8443/feed']){
  assert.ok(validateCandidateMetadata(valid({endpoint})).some(x=>x.includes('Endpoint')));
 }
});

test('duplicate detection canonicalises trailing slash and host case',()=>{
 const a=valid();
 assert.equal(candidateDuplicate([a],valid({id:'candidate-two',endpoint:'https://EXAMPLE.gov.in/data.xml/'})).id,a.id);
});

test('candidate lifecycle prevents activation before successful validation',()=>{
 const row=valid();
 assert.throws(()=>transitionCandidate(row,'active'),/Cannot move a pending_validation source/);
 const checked={...row,validation:{passed:true,checkedAt:Date.now(),httpStatus:200,contentType:'application/rss+xml',format:'rss-atom',itemsFound:1}};
 assert.equal(transitionCandidate(transitionCandidate(checked,'validated'),'active').status,'active');
 const discovered={...checked,status:'discovered'};
 assert.equal(transitionCandidate(transitionCandidate(discovered,'pending_validation'),'validated').status,'validated');
 const suspended={...checked,status:'suspended'};
 assert.equal(transitionCandidate(transitionCandidate(suspended,'pending_validation'),'validated').status,'validated');
 assert.throws(()=>transitionCandidate({...row,status:'rejected'},'active'),/Cannot move/);
});

test('only validated public RSS/Atom sources with confirmed open terms can activate',()=>{
 const row={...valid(),status:'validated',validation:{passed:true,format:'rss-atom',itemsFound:2}};
 assert.deepEqual(sourceActivationEligibility({...row,licence:'open'}),[]);
 assert.ok(sourceActivationEligibility({...row,licence:'review-required'}).some(x=>x.includes('licence')));
 assert.ok(sourceActivationEligibility({...row,layer:'geospatial',licence:'open'}).some(x=>x.includes('live feed adapter')));
 assert.ok(sourceActivationEligibility({...row,accessMethod:'REST API',licence:'open'}).some(x=>x.includes('RSS or Atom')));
});

test('bulk intake deduplicates against the active registry and within the same batch',()=>{
 const existing=valid();
 const rows=[
  {name:'New source',layer:'news',category:'wire',region:'Europe',country:'GB',endpoint:'https://new.example.org/rss',accessMethod:'RSS',accessModel:'public',language:'en',cadenceMinutes:10,licence:'open',licenceEvidence:'https://new.example.org/terms',provenance:'Official publisher directory'},
  {name:'Duplicate',layer:'news',category:'wire',region:'Europe',country:'GB',endpoint:'https://example.gov.in/data.xml/',accessMethod:'RSS',accessModel:'public',language:'en',cadenceMinutes:10,licence:'open',licenceEvidence:'terms checked',provenance:'Directory'},
  {name:'Invalid',layer:'news',category:'wire',region:'Europe',country:'GB',endpoint:'file:///etc/passwd',accessMethod:'RSS',accessModel:'public',language:'en',cadenceMinutes:10,licence:'open',licenceEvidence:'terms checked',provenance:'Directory'},
  {name:'Same batch duplicate',layer:'news',category:'wire',region:'Europe',country:'GB',endpoint:'https://new.example.org/rss/',accessMethod:'RSS',accessModel:'public',language:'en',cadenceMinutes:10,licence:'open',licenceEvidence:'terms checked',provenance:'Directory'},
 ];
 let seq=0;
 const result=prepareCandidateBatch([existing],rows,()=>`batch-${++seq}`);
 assert.equal(result.accepted.length,1);
 assert.equal(result.duplicates.length,2);
 assert.equal(result.rejected.length,1);
 assert.ok(result.accepted.every(x=>x.status==='pending_validation'));
});

test('query-based feeds remain distinct while parameter order and tracking tags are normalised',()=>{
 const base=valid({endpoint:'https://api.example.org/feed?country=IN&topic=security'});
 const same=valid({id:'same-query',endpoint:'https://API.example.org/feed/?topic=security&country=IN&utm_source=directory'});
 const different=valid({id:'different-query',endpoint:'https://api.example.org/feed?country=BD&topic=security'});
 assert.equal(candidateDuplicate([base],same).id,base.id);
 assert.equal(candidateDuplicate([base],different),undefined);
});

test('candidate response validation parses RSS/Atom payloads instead of trusting HTTP reachability',()=>{
 const candidate=valid({accessMethod:'RSS'});
 const xml='<?xml version="1.0"?><rss version="2.0"><channel><title>Agency</title><item><title>New circular</title><link>https://example.gov.in/circular/1</link><description>Official update</description></item></channel></rss>';
 const ok=assessCandidateResponse(candidate,{status:200,contentType:'application/rss+xml',body:xml,finalUrl:candidate.endpoint});
 assert.equal(ok.passed,true);
 assert.equal(ok.format,'rss-atom');
 assert.equal(ok.itemsFound,1);
 const html=assessCandidateResponse(candidate,{status:200,contentType:'text/html',body:'<html><body>Login page</body></html>'});
 assert.equal(html.passed,false);
 assert.equal(html.itemsFound,0);
 const empty=assessCandidateResponse(candidate,{status:200,contentType:'application/rss+xml',body:'<rss><channel><title>Empty</title></channel></rss>'});
 assert.equal(empty.passed,false);
});

test('HTML and JSON candidates are distinguished from RSS activation eligibility',()=>{
 const html=assessCandidateResponse(valid({accessMethod:'HTML listing'}),{status:200,contentType:'text/html',body:'<!doctype html><html><body><main>Official listing</main></body></html>'});
 assert.equal(html.passed,true);
 assert.equal(html.validationType,'reachability-only');
 assert.equal(html.format,'html');
 const json=assessCandidateResponse(valid({accessMethod:'REST API'}),{status:200,contentType:'application/json',body:JSON.stringify({features:[{id:1},{id:2}]})});
 assert.equal(json.passed,true);
 assert.equal(json.format,'json');
 assert.equal(json.itemsFound,2);
 const candidate={...valid({accessMethod:'HTML listing'}),status:'validated',validation:html,licence:'open'};
 assert.ok(sourceActivationEligibility(candidate).some(x=>x.includes('RSS/Atom')));
});
