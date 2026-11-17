import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../store.js';

test('file store rate limits enforce a fixed window and reset cleanly', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'calibrex-store-'));
  const old=process.env.DATA_DIR, oldDb=process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.DATA_DIR=dir;
  try {
    const store=createStore();
    const start=1_800_000_000_000;
    assert.equal((await store.consumeRateLimit('test',2,60000,start)).allowed,true);
    assert.equal((await store.consumeRateLimit('test',2,60000,start+1)).allowed,true);
    assert.equal((await store.consumeRateLimit('test',2,60000,start+2)).allowed,false);
    assert.equal((await store.consumeRateLimit('test',2,60000,start+60000)).allowed,true);
  } finally {
    if(old===undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR=old;
    if(oldDb!==undefined) process.env.DATABASE_URL=oldDb;
    setTimeout(()=>fs.rmSync(dir,{recursive:true,force:true}),250);
  }
});

test('expired and revoked session records are pruned', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'calibrex-session-'));
  const old=process.env.DATA_DIR, oldDb=process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.DATA_DIR=dir;
  try {
    const store=createStore();
    await store.createUser({id:'u1',email:'u@example.test',name:'Test',password_hash:'x',role:'user',status:'active',created_at:1});
    await store.setUserData('u1','session:expired',{createdAt:1,expiresAt:100});
    await store.setUserData('u1','session:valid',{createdAt:1,expiresAt:1000});
    const removed=await store.pruneExpiredSessions(100);
    assert.equal(removed,1);
    assert.equal(await store.getUserData('u1','session:expired'),null);
    assert.deepEqual(await store.getUserData('u1','session:valid'),{createdAt:1,expiresAt:1000});
  } finally {
    if(old===undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR=old;
    if(oldDb!==undefined) process.env.DATABASE_URL=oldDb;
    setTimeout(()=>fs.rmSync(dir,{recursive:true,force:true}),250);
  }
});
