import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../store.js';

test('file store serialises concurrent per-user data updates without lost writes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calibrex-store-'));
  const previousDir = process.env.DATA_DIR;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.DATA_DIR = dir;
  try {
    const store = createStore();
    await Promise.all(Array.from({ length: 40 }, (_, i) =>
      store.updateUserData('user-1', 'registry', current => [...(current || []), i], [])
    ));
    const values = await store.getUserData('user-1', 'registry');
    assert.equal(values.length, 40);
    assert.deepEqual([...values].sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => i));
    await new Promise(resolve => setTimeout(resolve, 150));
  } finally {
    if (previousDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDir;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
