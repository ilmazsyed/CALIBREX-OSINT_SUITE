import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_SOURCES, sourceUrl, sourceHome } from '../sources.js';

test('built-in collection does not require or configure X API sources', () => {
  assert.equal(BUILTIN_SOURCES.some(source => source.type === 'x'), false);
  assert.equal(BUILTIN_SOURCES.some(source => /x public chatter/i.test(source.name)), false);
});

test('public social connectors resolve without provider credentials', () => {
  const bluesky = BUILTIN_SOURCES.find(source => source.type === 'bluesky');
  const telegram = BUILTIN_SOURCES.find(source => source.type === 'telegram');
  assert.ok(bluesky && sourceUrl(bluesky).startsWith('https://'));
  assert.ok(telegram && sourceUrl(telegram).startsWith('https://'));
  assert.ok(sourceHome(bluesky).startsWith('https://bsky.app/'));
});

test('public search and RSS sources remain configured', () => {
  assert.ok(BUILTIN_SOURCES.some(source => source.type === 'rss'));
  assert.ok(BUILTIN_SOURCES.some(source => source.type === 'search'));
});
