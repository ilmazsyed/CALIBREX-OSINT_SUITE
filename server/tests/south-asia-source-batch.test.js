import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliseSourceCandidate, validateCandidateMetadata, candidateDuplicate } from '../source-candidates.js';

const batch = JSON.parse(readFileSync(new URL('../../data/source-candidate-batches/south-asia-official-2026-11.json', import.meta.url), 'utf8'));

test('South Asia official batch contains only metadata-complete public source candidates', () => {
  assert.equal(batch.region, 'South Asia');
  assert.equal(batch.candidateCount, 22);
  assert.equal(batch.candidates.length, 22);
  const ids = new Set();
  const endpoints = new Set();
  for (const [index, input] of batch.candidates.entries()) {
    const row = normaliseSourceCandidate(input, `south-asia-${index + 1}`);
    assert.deepEqual(validateCandidateMetadata(row), [], row.name);
    assert.equal(row.status, 'pending_validation');
    assert.equal(row.licence, 'review-required');
    assert.equal(row.region, 'South Asia');
    assert.ok(['IN','LK','PK','BD','NP'].includes(row.country));
    assert.ok(!row.endpoint.includes('@'));
    assert.ok(!/[?&](api[_-]?key|token|secret)=/i.test(row.endpoint));
    assert.ok(!ids.has(row.id));
    assert.ok(!endpoints.has(row.endpoint));
    ids.add(row.id);
    endpoints.add(row.endpoint);
  }
});

test('South Asia batch does not duplicate endpoints within itself', () => {
  const seen = [];
  for (const [index, input] of batch.candidates.entries()) {
    const row = normaliseSourceCandidate(input, `south-asia-${index + 1}`);
    assert.equal(candidateDuplicate(seen, row), undefined, row.name);
    seen.push(row);
  }
});

test('official publisher independence groups prevent counting sibling feeds as independent corroboration', () => {
  const rbi = batch.candidates.filter(row => row.independenceGroup === 'Reserve Bank of India');
  const cbsl = batch.candidates.filter(row => row.independenceGroup === 'Central Bank of Sri Lanka');
  assert.equal(rbi.length, 5);
  assert.equal(cbsl.length, 3);
  assert.equal(batch.candidates.filter(row => row.country === 'NP').length, 3);
  assert.equal(batch.candidates.filter(row => row.country === 'BD').length, 3);
  assert.equal(batch.candidates.filter(row => row.accessMethod === 'HTML listing').length, 11);
  assert.ok(rbi.every(row => row.independenceGroup === 'Reserve Bank of India'));
  assert.ok(cbsl.every(row => row.independenceGroup === 'Central Bank of Sri Lanka'));
});

test('South Asia additions retain country and source independence attribution',()=>{
 const byCountry=Object.groupBy(batch.candidates,row=>row.country);
 assert.equal(byCountry.BD.length,3);
 assert.equal(byCountry.PK.length,3);
 assert.equal(byCountry.NP.length,3);
 assert.equal(byCountry.LK.length,6);
 assert.ok(batch.candidates.every(row=>row.status===undefined || row.status==='pending_validation'));
});
