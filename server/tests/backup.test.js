import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

test('file store: dump then load round-trips the whole dataset', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-'));
  process.env.DATA_DIR = dir; delete process.env.DATABASE_URL;
  const { createStore, newId } = await import('../store.js?backup1');
  const s = createStore();
  await s.ready;
  const admin = { id: newId(), email: 'a@b.c', name: 'Admin', org: '', password_hash: 'H', role: 'admin', status: 'active', created_at: Date.now(), last_seen: null, visits: 1 };
  await s.createUser(admin);
  await s.setSetting('provider_contact', 'call us');
  await s.setSetting('totp_last_counter:' + admin.id, 0);
  await s.consumeRateLimit('auth-ip:restore-test', 1, 60000, Date.now());
  await s.setUserData(admin.id, 'history', [{ id: 1, title: 'x' }]);
  await s.setUserData(admin.id, 'session:before-backup', { createdAt: Date.now(), expiresAt: Date.now() + 86400000 });

  const dump = await s.dump();
  assert.equal(dump.users.length, 1);
  assert.equal(dump.settings.provider_contact, 'call us');
  assert.equal(dump.rateLimits, undefined);
  assert.deepEqual(dump.userData[admin.id].history, [{ id: 1, title: 'x' }]);
  assert.equal(dump.userData[admin.id]['session:before-backup'], undefined);

  // Even a crafted legacy backup must not be able to reintroduce session tokens.
  dump.userData[admin.id]['session:crafted-resurrection'] = { createdAt: Date.now(), expiresAt: Date.now() + 86400000 };
  await s.setUserData(admin.id, 'session:after-backup', { createdAt: Date.now(), expiresAt: Date.now() + 86400000 });

  // Wipe and restore from the dump.
  await s.load({ users: [], settings: {}, userData: {} });
  assert.equal((await s.listUsers()).length, 0);
  await s.load(dump);
  assert.equal((await s.findUserByEmail('a@b.c')).name, 'Admin');
  assert.equal(await s.getSetting('provider_contact'), 'call us');
  assert.deepEqual(await s.getUserData(admin.id, 'history'), [{ id: 1, title: 'x' }]);
  assert.equal(await s.getUserData(admin.id, 'session:before-backup'), null);
  assert.equal(await s.getUserData(admin.id, 'session:after-backup'), null);
  assert.equal(await s.getUserData(admin.id, 'session:crafted-resurrection'), null);
  assert.ok(Number(await s.getSetting('totp_last_counter:' + admin.id)) >= Math.floor(Date.now() / 30000));
  assert.equal((await s.consumeRateLimit('auth-ip:restore-test', 1, 60000, Date.now())).allowed, true);
  assert.ok(Number(await s.getUserData(admin.id, 'sessions_revoked_before')) > 0);
  // Restore writes immediately (not debounced), so the file on disk is current.
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
  assert.equal(onDisk.users[0].email, 'a@b.c');
});
