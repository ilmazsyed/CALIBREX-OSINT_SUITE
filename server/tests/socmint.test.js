import test from 'node:test';
import assert from 'node:assert/strict';
import { rankRedditPosts } from '../socmint.js';

test('Reddit chatter rejects incidental matches and orders relevant posts newest first', () => {
  const rows = rankRedditPosts([
    { title: 'PLA announces military exercise near Taiwan', created: 1000 },
    { title: 'Russian military plane crashes in Siberia', created: 3000 },
    { title: 'PLA military exercise: regional response', created: 2000 },
  ], 'PLA military exercise');
  assert.deepEqual(rows.map(x => x.created), [2000, 1000]);
  assert.ok(rows.every(x => x.relevanceBand !== 'UNRELATED'));
});

test('Reddit relevance checks title and post body', () => {
  const rows = rankRedditPosts([
    { title: 'Discussion thread', summary: 'Reports say China is conducting naval exercises', created: 1000 },
    { title: 'Unrelated sports thread', summary: 'Local football results', created: 2000 },
  ], 'China naval exercises');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].relevanceBand, 'RELEVANT');
});
