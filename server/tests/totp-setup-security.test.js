import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartTotpSetup } from '../totp.js';

test('allows first-time setup when no authenticator exists', () => {
  assert.equal(canStartTotpSetup(null), true);
  assert.equal(canStartTotpSetup(undefined), true);
});

test('allows setup to be restarted while an authenticator is not enabled', () => {
  assert.equal(canStartTotpSetup({ enabled: false, secret: 'pending-encrypted-secret' }), true);
});

test('refuses setup when an authenticator is already enabled', () => {
  assert.equal(canStartTotpSetup({ enabled: true, secret: 'encrypted-secret' }), false);
});
