import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseTimestamp, classifyTimestamp, comparePublicationRecency } from '../temporal.js';

test('normalises Unix seconds and millisecond timestamps to milliseconds',()=>{
 const now=Date.now();
 assert.equal(normaliseTimestamp(Math.floor(now/1000)),Math.floor(now/1000)*1000);
 assert.equal(normaliseTimestamp(now),now);\n assert.equal(normaliseTimestamp('2026-11-17T10:00:00Z'),Date.parse('2026-11-17T10:00:00Z'));
});

test('missing, stale, fresh and future dates remain distinct',()=>{
 const now=Date.now();
 assert.equal(classifyTimestamp(null,{now}).status,'DATE_UNVERIFIED');
 assert.equal(classifyTimestamp(now-10*86400000,{now,maxAgeMs:7*86400000}).status,'STALE');
 assert.equal(classifyTimestamp(now-3600000,{now,maxAgeMs:7*86400000}).status,'FRESH');
 assert.equal(classifyTimestamp(now+3*86400000,{now}).status,'FUTURE_DATED');
});

test('publication comparator sorts newest first and leaves undated records last',()=>{
 const rows=[null,1000,3000,2000].sort(comparePublicationRecency);
 assert.deepEqual(rows,[3000,2000,1000,null]);
});
