import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { postgresSslConfig } from '../store.js';

test('remote PostgreSQL connections verify TLS certificates by default', () => {
  assert.deepEqual(postgresSslConfig('postgres://db.example.com/app', {}), {
    rejectUnauthorized: true,
  });
});

test('a configured private CA is passed to the PostgreSQL TLS client', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calibrex-ca-'));
  const caPath = path.join(dir, 'root.pem');
  try {
    fs.writeFileSync(caPath, 'test CA PEM');
    assert.deepEqual(postgresSslConfig('postgres://db.example.com/app', {
      PGSSLROOTCERT: caPath,
    }), { rejectUnauthorized: true, ca: 'test CA PEM' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('only explicit loopback hosts bypass TLS for local development', () => {
  assert.equal(postgresSslConfig('postgres://localhost/app', {}), false);
  assert.equal(postgresSslConfig('postgres://127.0.0.1/app', {}), false);
  assert.equal(postgresSslConfig('postgres://[::1]/app', {}), false);
  assert.deepEqual(postgresSslConfig('postgres://localhost.attacker.example/app', {}), {
    rejectUnauthorized: true,
  });
});
