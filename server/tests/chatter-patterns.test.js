import test from 'node:test';
import assert from 'node:assert/strict';
import { detectChatterPatterns } from '../feeds.js';

const now = Date.now();
const post = (id, authorId, title, offset = 0) => ({
  id, authorId, title, summary: title, kind: 'social', published: now + offset,
});

test('near-identical public posts from three distinct accounts are flagged as a review lead', () => {
  const items = [
    post('a', 'account-1', 'Port operations suspended after explosion at strategic terminal'),
    post('b', 'account-2', 'Port operations suspended after explosion at strategic terminal', 60_000),
    post('c', 'account-3', 'Port operations suspended after explosion at strategic terminal', 120_000),
  ];
  const clusters = detectChatterPatterns(items);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].pattern.accountCount, 3);
  assert.equal(items.every(x => x.chatterPattern?.accountCount === 3), true);
  assert.equal(clusters[0].pattern.match, 'near_duplicate_text');
});

test('two accounts do not trigger a chatter pattern', () => {
  const items = [
    post('a', 'account-1', 'Port operations suspended after explosion at strategic terminal'),
    post('b', 'account-2', 'Port operations suspended after explosion at strategic terminal', 60_000),
  ];
  assert.equal(detectChatterPatterns(items).length, 0);
});

test('posts outside the time window do not cluster', () => {
  const items = [
    post('a', 'account-1', 'Port operations suspended after explosion at strategic terminal'),
    post('b', 'account-2', 'Port operations suspended after explosion at strategic terminal', 31 * 60 * 1000),
    post('c', 'account-3', 'Port operations suspended after explosion at strategic terminal', 32 * 60 * 1000),
  ];
  assert.equal(detectChatterPatterns(items).length, 0);
});

test('independent wording is not falsely clustered', () => {
  const items = [
    post('a', 'account-1', 'Port operations suspended after explosion at strategic terminal'),
    post('b', 'account-2', 'Markets rally as central bank signals rate pause'),
    post('c', 'account-3', 'Weather alert issued for coastal communities'),
  ];
  assert.equal(detectChatterPatterns(items).length, 0);
});
