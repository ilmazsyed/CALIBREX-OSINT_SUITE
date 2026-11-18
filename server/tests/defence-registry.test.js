import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDefenceRecord, buildDefenceRegistry, upsertDefenceRegistryRecord } from '../defence-registry.js';

const base = { id: 'asset-1', name: 'Example naval platform', type: 'PLATFORM', country: 'IND',
  description: 'Publicly reported platform class', validFrom: '2024-01-01',
  evidence: [{ url: 'https://example.gov.in/report', publisher: 'Example Ministry', sourceType: 'OFFICIAL', publishedAt: '2024-02-01' }] };

test('validates a public-source defence reference and retains provenance', () => {
  const row = validateDefenceRecord(base);
  assert.equal(row.scope, 'OPEN_SOURCE_STRATEGIC_REFERENCE');
  assert.equal(row.evidence[0].publisher, 'Example Ministry');
  assert.equal(row.reviewRequired, true);
  assert.ok(row.missing.includes('valid-from date unknown') === false);
});

test('rejects malformed record identity and invalid temporal ranges', () => {
  assert.throws(() => validateDefenceRecord({ name: 'Missing type and id' }), /stable id/);
  assert.throws(() => validateDefenceRecord({ ...base, validFrom: '2025-01-01', validTo: '2024-01-01' }), /validTo/);
});

test('unsafe and missing source URLs do not count as evidence', () => {
  const row = validateDefenceRecord({ ...base, evidence: [{ url: 'javascript:alert(1)' }] });
  assert.equal(row.evidence.length, 0);
  assert.ok(row.missing.includes('no usable public source URL'));
  assert.equal(row.reviewRequired, true);
});

test('registry summaries distinguish record type, review state and missing temporal coverage', () => {
  const registry = buildDefenceRegistry([
    base,
    { id: 'exercise-1', name: 'Publicly announced exercise', type: 'EXERCISE', country: 'IND', state: 'UNVERIFIED', evidence: [] },
    { id: 'org-1', name: 'Example organisation', type: 'ORGANISATION', country: 'USA', parentId: 'missing-parent', validFrom: '2020-01-01', evidence: base.evidence }
  ], { country: 'IND' });
  assert.equal(registry.summary.total, 2);
  assert.equal(registry.summary.byType.PLATFORM, 1);
  assert.equal(registry.summary.byType.EXERCISE, 1);
  assert.equal(registry.summary.missingTemporalValidity, 1);
});

test('review state does not remove strategic-level limitations', () => {
  const row = validateDefenceRecord({ ...base, state: 'REVIEWED', confidence: 90 });
  assert.equal(row.reviewRequired, false);
  assert.ok(row.limitations.some(x => x.includes('not a validated current force disposition')));
});

test('incremental upsert preserves unrelated records and replaces a matching id', () => {
  const first = validateDefenceRecord(base);
  const other = validateDefenceRecord({ ...base, id: 'asset-2', name: 'Second platform' });
  const updated = upsertDefenceRegistryRecord([first, other], { ...base, name: 'Updated platform' });
  assert.equal(updated.length, 2);
  assert.equal(updated.find(x => x.id === 'asset-1').name, 'Updated platform');
  assert.equal(updated.find(x => x.id === 'asset-2').name, 'Second platform');
});

test('incremental upsert enforces the registry capacity', () => {
  const full = Array.from({ length: 500 }, (_, i) => validateDefenceRecord({ ...base, id: 'record-' + i }));
  assert.throws(() => upsertDefenceRegistryRecord(full, { ...base, id: 'new-record' }), /limited to 500/);
});
