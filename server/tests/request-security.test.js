import test from 'node:test';
import assert from 'node:assert/strict';
import { sameOriginMutationGuard, apiNoStore } from '../request-security.js';

function invoke({ method = 'POST', protocol = 'https', host = 'app.calibrex.org', headers = {} } = {}) {
  let nextCalled = false;
  let response = null;
  const req = {
    method, protocol, headers,
    get(name) { return name.toLowerCase() === 'host' ? host : headers[name.toLowerCase()]; },
  };
  const res = {
    status(code) { response = { status: code }; return this; },
    json(body) { response = { ...response, body }; return this; },
  };
  sameOriginMutationGuard(req, res, () => { nextCalled = true; });
  return { nextCalled, response };
}

test('allows safe methods without origin metadata', () => {
  assert.equal(invoke({ method: 'GET' }).nextCalled, true);
  assert.equal(invoke({ method: 'OPTIONS' }).nextCalled, true);
});

test('allows same-origin mutation requests', () => {
  assert.equal(invoke({ headers: { origin: 'https://app.calibrex.org' } }).nextCalled, true);
});

test('rejects cross-origin mutation from a sibling subdomain', () => {
  const result = invoke({ headers: { origin: 'https://evil.calibrex.org' } });
  assert.equal(result.nextCalled, false);
  assert.equal(result.response.status, 403);
  assert.equal(result.response.body.code, 'origin_mismatch');
});

test('rejects cross-site fetch metadata even without an Origin header', () => {
  const result = invoke({ headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(result.nextCalled, false);
  assert.equal(result.response.body.code, 'cross_site_request');
});

test('rejects malformed Origin headers', () => {
  const result = invoke({ headers: { origin: 'null' } });
  assert.equal(result.nextCalled, false);
  assert.equal(result.response.body.code, 'invalid_request_origin');
});

test('checks Referer when Origin is absent', () => {
  assert.equal(invoke({ headers: { referer: 'https://app.calibrex.org/settings' } }).nextCalled, true);
  const result = invoke({ headers: { referer: 'https://attacker.example/launch' } });
  assert.equal(result.nextCalled, false);
  assert.equal(result.response.status, 403);
});

test('allows server-to-server mutations without browser provenance headers', () => {
  assert.equal(invoke({ headers: {} }).nextCalled, true);
});

test('API responses default to no-store', () => {
  let header = null;
  let nextCalled = false;
  const res = {
    hasHeader(name) { return name === 'Cache-Control' && header !== null; },
    setHeader(name, value) { if (name === 'Cache-Control') header = value; },
  };
  apiNoStore({}, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(header, 'no-store');
});

test('explicit route cache policy is preserved', () => {
  let header = 'private, max-age=86400';
  const res = {
    hasHeader(name) { return name === 'Cache-Control' && header !== null; },
    setHeader(name, value) { if (name === 'Cache-Control') header = value; },
  };
  apiNoStore({}, res, () => {});
  assert.equal(header, 'private, max-age=86400');
});
