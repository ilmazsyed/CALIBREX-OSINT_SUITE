import test from 'node:test';
import assert from 'node:assert/strict';
import { listSourceCandidateBatches, loadSourceCandidateBatch } from '../source-candidate-batches.js';

test('curated source batch registry lists the South Asia seed with metadata only',()=>{
 const rows=listSourceCandidateBatches();
 const southAsia=rows.find(row=>row.id==='south-asia-official-2026-11');
 assert.ok(southAsia);
 assert.equal(southAsia.region,'South Asia');
 assert.equal(southAsia.candidateCount,15);
 assert.match(southAsia.policy,/pending_validation/);
 assert.ok(!('candidates' in southAsia));
});

test('curated source batch loader returns candidates and rejects path traversal',()=>{
 const batch=loadSourceCandidateBatch('south-asia-official-2026-11');
 assert.equal(batch.candidates.length,15);
 assert.throws(()=>loadSourceCandidateBatch('../source-candidates'),/Invalid source batch identifier/);
 assert.throws(()=>loadSourceCandidateBatch('missing-batch'),/ENOENT/);
});
