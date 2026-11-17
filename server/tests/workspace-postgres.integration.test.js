import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../store.js';

test('PostgreSQL settings row locks preserve concurrent workspace mutations', {
  skip: !process.env.DATABASE_URL ? 'Set DATABASE_URL to run the PostgreSQL integration test.' : false,
}, async () => {
  const store=createStore();
  await store.ready;
  const key='test:workspace-atomic:'+crypto.randomUUID();
  try {
    await store.setSetting(key,0);
    await Promise.all(Array.from({length:80},()=>store.updateSetting(key,current=>Number(current||0)+1,0)));
    assert.equal(await store.getSetting(key),80);
  } finally {
    const {default:pg}=await import('pg');
    const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
    try{await pool.query('DELETE FROM settings WHERE key=$1',[key]);}finally{await pool.end();}
  }
});
