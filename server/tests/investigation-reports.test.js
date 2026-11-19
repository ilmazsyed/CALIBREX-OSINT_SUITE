import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportVersion, transitionReportVersion, validateReportDraft } from '../investigation-reports.js';

test('creates sequential, content-hashed report versions', () => {
  const first = createReportVersion({ input: { title: 'Initial', content: 'Finding A' }, actor: 'analyst-1', versions: [], now: 100 });
  const second = createReportVersion({ input: { title: 'Revised', content: 'Finding B' }, actor: 'analyst-2', versions: [first], now: 200 });
  assert.equal(first.version, 1); assert.equal(second.version, 2);
  assert.notEqual(first.contentHash, second.contentHash); assert.equal(first.status, 'DRAFT');
});

test('requires content and enforces a one megabyte limit', () => {
  assert.throws(() => validateReportDraft({ content: '  ' }), /required/);
  assert.throws(() => validateReportDraft({ content: 'x'.repeat(900 * 1024 + 1) }), /900 KB/);
});

test('approval records reviewer and prevents downgrading approved versions', () => {
  const draft = createReportVersion({ input: { content: 'Report' }, actor: 'analyst-1', now: 10 });
  const approved = transitionReportVersion(draft, 'APPROVED', 'reviewer-1', 20);
  assert.equal(approved.approvedBy, 'reviewer-1'); assert.equal(approved.approvedAt, 20);
  assert.throws(() => transitionReportVersion(approved, 'DRAFT', 'reviewer-1', 30), /cannot be changed/);
});
