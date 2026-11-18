import test from 'node:test';
import assert from 'node:assert/strict';
import { listSourceCandidateBatches, loadSourceCandidateBatch } from '../source-candidate-batches.js';
import { prepareCandidateBatch } from '../source-candidates.js';

test('curated source batch registry lists the South Asia seed with metadata only',()=>{
 const rows=listSourceCandidateBatches();
 const southAsia=rows.find(row=>row.id==='south-asia-official-2026-11');
 assert.ok(southAsia);
 assert.equal(southAsia.region,'South Asia');
 assert.equal(southAsia.candidateCount,22);
 assert.match(southAsia.policy,/pending_validation/);
 assert.ok(!('candidates' in southAsia));
});

test('curated source batch loader returns candidates and rejects path traversal',()=>{
 const batch=loadSourceCandidateBatch('south-asia-official-2026-11');
 assert.equal(batch.candidates.length,22);
 assert.throws(()=>loadSourceCandidateBatch('../source-candidates'),/Invalid source batch identifier/);
 assert.throws(()=>loadSourceCandidateBatch('missing-batch'),/ENOENT/);
});

test('regional expansion batches are discoverable and contain expected geographic scopes',()=>{
 const rows=listSourceCandidateBatches();
 const expected=[
  ['india-central-official-2026-11','South Asia',6],
  ['west-bengal-official-2026-11','South Asia',5],
  ['global-multilateral-2026-11','Global / multilateral',5],
 ];
 for(const [id,region,count] of expected){
  const meta=rows.find(row=>row.id===id);
  assert.ok(meta,id);
  assert.equal(meta.region,region);
  assert.equal(meta.candidateCount,count);
  const loaded=loadSourceCandidateBatch(id);
  assert.equal(loaded.candidates.length,count);
  assert.match(loaded.policy,/pending_validation/);
 }
});


test('global sector expansion batch adds vetted discovery candidates without claiming activation',()=>{
 const batch=loadSourceCandidateBatch('global-sector-apis-2026-11');
 assert.equal(batch.candidates.length,14);
 assert.match(batch.policy,/No endpoint is claimed healthy or activated/);
 const layers=new Set(batch.candidates.map(row=>row.layer));
 for(const layer of ['official','geospatial','mobility','economic']) assert.ok(layers.has(layer),layer);
 assert.ok(batch.candidates.every(row=>row.licence && row.licenceEvidence && row.provenance && row.endpoint));
 assert.ok(batch.candidates.some(row=>row.authRequired===true),'credentialed sources are explicitly identified');
 assert.ok(batch.candidates.some(row=>row.licence==='restricted'),'commercial sources remain restricted candidates');
});


test('global sector candidates satisfy metadata gates and remain pending validation',()=>{
 const batch=loadSourceCandidateBatch('global-sector-apis-2026-11');
 const prepared=prepareCandidateBatch([],batch.candidates,(_index)=>'candidate-test-'+_index);
 assert.equal(prepared.accepted.length,14);
 assert.equal(prepared.rejected.length,0);
 assert.equal(prepared.duplicates.length,0);
 assert.ok(prepared.accepted.every(row=>row.status==='pending_validation'));
 assert.ok(prepared.accepted.some(row=>row.licence==='restricted'&&row.authRequired));
});
