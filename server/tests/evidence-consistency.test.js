import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidenceLedgerEntry, verifyEvidenceLedger } from '../intelligence.js';

const zero = '0'.repeat(64);

test('ledger verifies an unchanged current evidence item', () => {
  const evidence = { id: 'ev-1', type: 'url', value: 'https://example.org' };
  const entry = createEvidenceLedgerEntry({ investigationId: 'case-1', evidenceId: evidence.id, action: 'ADDED', at: 1000, actor: 'analyst-1', evidence }, zero, 1);
  const result = verifyEvidenceLedger([entry], [evidence]);
  assert.equal(result.valid, true);
  assert.equal(result.evidenceConsistency.valid, true);
  assert.deepEqual(result.evidenceConsistency.changed, []);
});

test('ledger detects evidence modified outside the ledger', () => {
  const original = { id: 'ev-1', type: 'url', value: 'https://example.org' };
  const tampered = { ...original, value: 'https://attacker.example' };
  const entry = createEvidenceLedgerEntry({ investigationId: 'case-1', evidenceId: original.id, action: 'ADDED', at: 1000, actor: 'analyst-1', evidence: original }, zero, 1);
  const result = verifyEvidenceLedger([entry], [tampered]);
  assert.equal(result.valid, false);
  assert.deepEqual(result.evidenceConsistency.changed, ['ev-1']);
});

test('ledger detects evidence missing from the current investigation', () => {
  const evidence = { id: 'ev-1', type: 'document', value: 'report.pdf' };
  const entry = createEvidenceLedgerEntry({ investigationId: 'case-1', evidenceId: evidence.id, action: 'ADDED', at: 1000, actor: 'analyst-1', evidence }, zero, 1);
  const result = verifyEvidenceLedger([entry], []);
  assert.equal(result.valid, false);
  assert.deepEqual(result.evidenceConsistency.missing, ['ev-1']);
});

test('a valid removal event requires the evidence to be absent', () => {
  const evidence = { id: 'ev-1', type: 'url', value: 'https://example.org' };
  const added = createEvidenceLedgerEntry({ investigationId: 'case-1', evidenceId: evidence.id, action: 'ADDED', at: 1000, actor: 'analyst-1', evidence }, zero, 1);
  const removed = createEvidenceLedgerEntry({ investigationId: 'case-1', evidenceId: evidence.id, action: 'REMOVED', at: 2000, actor: 'analyst-1', evidence }, added.hash, 2);
  const absent = verifyEvidenceLedger([added, removed], []);
  assert.equal(absent.valid, true);
  const present = verifyEvidenceLedger([added, removed], [evidence]);
  assert.equal(present.valid, false);
  assert.deepEqual(present.evidenceConsistency.removedPresent, ['ev-1']);
});

test('legacy evidence without a ledger event is reported as untracked, not falsely corrupted', () => {
  const result = verifyEvidenceLedger([], [{ id: 'legacy-1', value: 'legacy' }]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.evidenceConsistency.untracked, ['legacy-1']);
});
