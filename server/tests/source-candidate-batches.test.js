import test from 'node:test';
import assert from 'node:assert/strict';
import { listSourceCandidateBatches, loadSourceCandidateBatch } from '../source-candidate-batches.js';

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
