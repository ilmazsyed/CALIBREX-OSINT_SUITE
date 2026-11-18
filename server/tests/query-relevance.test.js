import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreQueryRelevance, rankQueryResults } from '../query-relevance.js';

test('query relevance rejects incidental word overlap and preserves exact acronym matching',()=>{
 const plane={title:'Russian military plane crashes in Siberia'};
 assert.equal(scoreQueryRelevance(plane,'China PLA military exercises').band,'UNRELATED');
 assert.notEqual(scoreQueryRelevance({title:'PLA conducts military exercises near Taiwan'},'China PLA military exercises').band,'UNRELATED');
});

test('recency is the primary ordering among relevant results',()=>{
 const now=Date.now();
 const rows=rankQueryResults([
  {title:'China military exercise update',published:now-5*86400000},
  {title:'China military exercise near Taiwan',published:now-3600000}
 ],'China military exercise','7d',now);
 assert.equal(rows.length,2);
 assert.ok(rows[0].published>rows[1].published);
});

test('requested search window excludes stale and future-dated matches',()=>{
 const now=Date.now();
 const rows=rankQueryResults([
  {title:'China military exercise today',published:now-3600000},
  {title:'China military exercise old',published:now-20*86400000},
  {title:'China military exercise future',published:now+5*86400000}
 ],'China military exercise','7d',now);
 assert.equal(rows.length,1);
 assert.equal(rows[0].freshness,'IN_WINDOW');
});

test('unrelated results are excluded even when they are newer',()=>{
 const now=Date.now();
 const rows=rankQueryResults([
  {title:'Russian plane crash in Siberia',published:now},
  {title:'China announces naval exercise',published:now-3600000}
 ],'China naval exercise','7d',now);
 assert.equal(rows.length,1);
 assert.match(rows[0].title,/China/);
});
