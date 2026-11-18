import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseSourceCandidate,validateCandidateMetadata,candidateDuplicate,sourceActivationEligibility,transitionCandidate} from '../source-candidates.js';

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
 const checked={...row,validation:{passed:true,checkedAt:Date.now(),httpStatus:200,contentType:'application/rss+xml'}};
 assert.equal(transitionCandidate(transitionCandidate(checked,'validated'),'active').status,'active');
 assert.throws(()=>transitionCandidate({...row,status:'rejected'},'active'),/Cannot move/);
});

test('only validated public RSS/Atom sources with confirmed open terms can activate',()=>{
 const row={...valid(),status:'validated',validation:{passed:true}};
 assert.deepEqual(sourceActivationEligibility({...row,licence:'open'}),[]);
 assert.ok(sourceActivationEligibility({...row,licence:'review-required'}).some(x=>x.includes('licence')));
 assert.ok(sourceActivationEligibility({...row,layer:'geospatial',licence:'open'}).some(x=>x.includes('live feed adapter')));
 assert.ok(sourceActivationEligibility({...row,accessMethod:'REST API',licence:'open'}).some(x=>x.includes('RSS or Atom')));
});
