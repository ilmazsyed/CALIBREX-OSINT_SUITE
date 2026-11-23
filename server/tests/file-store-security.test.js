import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore, createFileStore } from '../store.js';

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

test('file store migrates a shared Render mount into an app-owned private directory', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calibrex-render-mount-'));
  const mount = path.join(root, 'mount');
  fs.mkdirSync(mount, { mode: 0o775 });
  const legacy = path.join(mount, 'db.json');
  const fixture = {
    users: [{ id: 'preserved-user', email: 'preserved@example.invalid', name: 'Preserved', password_hash: 'hash', role: 'admin', status: 'active', created_at: 1 }],
    settings: { marker: 'preserve-me' },
    userData: { 'preserved-user': { profile: { name: 'Preserved' } } },
    rateLimits: {}
  };
  fs.writeFileSync(legacy, JSON.stringify(fixture), { mode: 0o644 });
  fs.chmodSync(legacy, 0o644);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  // Simulate Render's platform-owned mount root: force the same private-child
  // path that production selects when the mount itself is not owned by render.
  const store = createFileStore(mount, { forcePrivateDir: true });
  const privateDir = path.join(mount, 'calibrex-private');
  const privateDb = path.join(privateDir, 'db.json');
  assert.equal(fs.statSync(privateDir).mode & 0o777, 0o700);
  assert.equal(fs.statSync(privateDb).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(legacy), false, 'legacy copy is removed only after verified migration');
  assert.deepEqual(await store.findUserById('preserved-user'), fixture.users[0]);
  assert.equal(await store.getSetting('marker'), 'preserve-me');
  await store.setUserData('preserved-user', 'new-record', { ok: true });
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(fs.statSync(privateDb).mode & 0o777, 0o600, 'atomic replacements remain private');
  const backup = await store.dump();
  await store.setSetting('temporary-before-restore', true);
  await store.load(backup);
  assert.equal(await store.getSetting('temporary-before-restore'), null, 'restore replaces the expected dataset');
  assert.equal(fs.statSync(privateDb).mode & 0o777, 0o600, 'backup restore retains private file permissions');
  assert.equal(await store.ping(), true, 'restored private store remains ready');
  const reopened = createFileStore(mount, { forcePrivateDir: true });
  assert.deepEqual(await reopened.findUserById('preserved-user'), fixture.users[0], 'a restart reads the migrated private database');
});

test('file store does not overwrite a conflicting private database during migration', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calibrex-render-conflict-'));
  const mount = path.join(root, 'mount');
  fs.mkdirSync(mount);
  const fixture = { users: [], settings: {}, userData: {}, rateLimits: {} };
  fs.writeFileSync(path.join(mount, 'db.json'), JSON.stringify(fixture));
  const privateDir = path.join(mount, 'calibrex-private');
  fs.mkdirSync(privateDir, { mode: 0o700 });
  fs.writeFileSync(path.join(privateDir, 'db.json'), JSON.stringify({ ...fixture, settings: { different: true } }), { mode: 0o600 });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => createFileStore(mount, { forcePrivateDir: true }), /different legacy and private database files/);
  assert.equal(fs.existsSync(path.join(mount, 'db.json')), true, 'legacy database is preserved for manual recovery');
});

test('file-store readiness detects permission drift and recovers after repair', async t => {
  const { dir } = withDataDir(t);
  const store = createStore();
  await store.setSetting('health-check', true);
  await new Promise(resolve => setTimeout(resolve, 180));
  const file = path.join(dir, 'db.json');
  fs.chmodSync(file, 0o644);
  const insecure = await store.storageDiagnostics();
  assert.equal(insecure.permissionsSecure, false);
  await assert.rejects(store.ping(), /permissions are not secure/);
  fs.chmodSync(file, 0o600);
  assert.equal((await store.storageDiagnostics()).permissionsSecure, true);
  assert.equal(await store.ping(), true);
});
