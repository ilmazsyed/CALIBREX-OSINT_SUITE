import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../store.js';

test('atomic setting mutations preserve every concurrent update in file-store mode', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'calibrex-workspace-store-'));
  const priorDataDir = process.env.DATA_DIR;
  const priorDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.DATA_DIR = dir;
  try {
    const store = createStore();
    await Promise.all(Array.from({ length: 100 }, () =>
      store.updateSetting('workspace-counter', current => (current || 0) + 1, 0)
    ));
    assert.equal(await store.getSetting('workspace-counter'), 100);
    const snapshot = await store.dump();
    assert.equal(snapshot.settings['workspace-counter'], 100);
  } finally {
    if (priorDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = priorDataDir;
    if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = priorDatabaseUrl;
    await new Promise(resolve => setTimeout(resolve, 120));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
