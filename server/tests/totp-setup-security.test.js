import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartTotpSetup, generateSecret, matchingTotpCounter, totpCode } from '../totp.js';

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

test('matching TOTP counter identifies the accepted time step', () => {
  const secret = generateSecret();
  const now = 1_800_000_000_000;
  const counter = Math.floor(now / 30000);
  assert.equal(matchingTotpCounter(secret, totpCode(secret, now), 1, now), counter);
});

test('matching TOTP counter accepts bounded clock skew and rejects malformed codes', () => {
  const secret = generateSecret();
  const now = 1_800_000_000_000;
  const nextStep = Math.floor(now / 30000) + 1;
  assert.equal(matchingTotpCounter(secret, totpCode(secret, nextStep * 30000), 1, now), nextStep);
  assert.equal(matchingTotpCounter(secret, '12345', 1, now), null);
  assert.equal(matchingTotpCounter(secret, '1234567', 1, now), null);
});
