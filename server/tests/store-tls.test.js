import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresSslConfig } from '../store.js';

test('remote PostgreSQL connections verify TLS certificates by default', () => {
  assert.deepEqual(postgresSslConfig('postgres://db.example.com/app', {}), {
    rejectUnauthorized: true,
  });
});

test('a configured private CA is passed to the PostgreSQL TLS client', () => {
  const ssl = postgresSslConfig('postgres://db.example.com/app', {
    PGSSLROOTCERT: new URL('./fixtures/test-ca.pem', import.meta.url).pathname,
  });
  // The path is intentionally nonexistent: configuration must fail closed.
  assert.fail('Expected missing CA file to throw, got ' + JSON.stringify(ssl));
});

test('only explicit loopback hosts bypass TLS for local development', () => {
  assert.equal(postgresSslConfig('postgres://localhost/app', {}), false);
  assert.equal(postgresSslConfig('postgres://127.0.0.1/app', {}), false);
  assert.equal(postgresSslConfig('postgres://[::1]/app', {}), false);
  assert.deepEqual(postgresSslConfig('postgres://localhost.attacker.example/app', {}), {
    rejectUnauthorized: true,
  });
});
