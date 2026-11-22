import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicOrigin } from '../public-origin.js';

test('production uses the configured HTTPS origin, never the request Host header', () => {
  assert.equal(getPublicOrigin({ configured: 'https://app.calibrex.org/', production: true, protocol: 'https', host: 'attacker.example' }), 'https://app.calibrex.org');
});

test('production refuses to derive callback origins from an untrusted Host header', () => {
  assert.throws(() => getPublicOrigin({ production: true, protocol: 'https', host: 'attacker.example' }), /PUBLIC_URL must be configured/);
});

test('production rejects non-HTTPS public origins', () => {
  assert.throws(() => getPublicOrigin({ configured: 'http://app.calibrex.org', production: true }), /must use HTTPS/);
});

test('rejects credentials, paths, queries and fragments', () => {
  for (const configured of [
    'https://user:pass@app.calibrex.org',
    'https://app.calibrex.org/subpath',
    'https://app.calibrex.org?next=evil',
    'https://app.calibrex.org#fragment',
  ]) assert.throws(() => getPublicOrigin({ configured, production: true }));
});

test('development can derive an origin from its local request host', () => {
  assert.equal(getPublicOrigin({ protocol: 'http', host: 'localhost:3000' }), 'http://localhost:3000');
});
