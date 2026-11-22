import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../store.js';

function withDataDir(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calibrex-store-security-'));
  const dir = path.join(root, 'data');
  const previousDataDir = process.env.DATA_DIR;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.DATA_DIR = dir;
  t.after(() => {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, dir };
}

test('file store uses private directory and database file permissions', async t => {
  const { dir } = withDataDir(t);
  const store = createStore();
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  await store.createUser({
    id: 'test-user', email: 'test@example.invalid', name: 'Test',
    password_hash: 'bcrypt-hash-placeholder', role: 'user', status: 'active', created_at: Date.now(),
  });
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(fs.statSync(path.join(dir, 'db.json')).mode & 0o777, 0o600);
});

test('file store refuses to silently reset a corrupt database', t => {
  const { dir } = withDataDir(t);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'db.json'), '{ this is not valid JSON');
  assert.throws(() => createStore(), /could not be loaded safely/);
});

test('file store refuses an unexpected database structure', t => {
  const { dir } = withDataDir(t);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ users: [], settings: [], userData: {} }));
  assert.throws(() => createStore(), /could not be loaded safely/);
});
