import test from 'node:test';
import assert from 'node:assert/strict';
import { summariseCommercialAccounts } from '../commercial.js';

test('commercial overview counts legacy, plans, statuses and trial lifecycle', () => {
  const users = [
    { tier: 'starter', status: 'active' },
    { tier: 'professional', status: 'pending' },
    { tier: 'trial', trial_ends_at: 2000, status: 'active' },
    { tier: 'trial', trial_ends_at: 900, status: 'suspended' },
    { tier: null, status: 'active' },
  ];
  const result = summariseCommercialAccounts(users, [], 1000);
  assert.equal(result.accounts.total, 5);
  assert.equal(result.accounts.plans.starter, 1);
  assert.equal(result.accounts.plans.professional, 1);
  assert.equal(result.accounts.plans.legacy, 1);
  assert.equal(result.accounts.trialsActive, 1);
  assert.equal(result.accounts.trialsExpired, 1);
  assert.equal(result.accounts.statuses.active, 3);
  assert.equal(result.accounts.statuses.pending, 1);
  assert.equal(result.accounts.statuses.suspended, 1);
});

test('commercial overview exposes only a bounded, minimal licensing request summary', () => {
  const requests = Array.from({ length: 25 }, (_, i) => ({ id: String(i), at: i, status: i === 0 ? 'pending' : 'closed', kind: 'plan', plan: 'business', userId: 'u1', email: 'private@example.com', note: 'private note' }));
  const result = summariseCommercialAccounts([], requests);
  assert.equal(result.licensing.pendingRequests, 1);
  assert.equal(result.licensing.recentRequests.length, 20);
  assert.equal('email' in result.licensing.recentRequests[0], false);
  assert.equal('note' in result.licensing.recentRequests[0], false);
});
