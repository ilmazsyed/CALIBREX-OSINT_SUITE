import test from 'node:test';
import assert from 'node:assert/strict';
import { locate, locateCandidates } from '../geo.js';

test('ranks a specific city above a country-level mention', () => {
  const candidates = locateCandidates('Officials in Kolkata said India is monitoring the situation.');
  assert.equal(candidates[0].name, 'Kolkata');
  assert.equal(candidates[0].rank, 1);
  assert.equal(candidates[0].matchType, 'PLACE_NAME');
  assert.equal(candidates[0].caveat.includes('not been independently resolved'), true);
});

test('preserves multiple distinct place candidates and matched aliases', () => {
  const candidates = locateCandidates('Talks between India and Bangladesh were held in Dhaka.');
  assert.ok(candidates.some(c => c.name === 'Dhaka' && c.matchedAlias.toLowerCase().includes('dhaka')));
  assert.ok(candidates.some(c => c.name === 'India'));
  assert.ok(candidates.some(c => c.name === 'Bangladesh'));
  assert.ok(candidates.every((c, i) => c.rank === i + 1));
});

test('limits candidate count and supports the legacy locate return shape', () => {
  const candidates = locateCandidates('India, Bangladesh, Nepal and Pakistan', { limit: 2 });
  assert.equal(candidates.length, 2);
  const legacy = locate('Kolkata, India');
  assert.deepEqual(Object.keys(legacy).sort(), ['lat', 'lng', 'name']);
  assert.equal(legacy.name, 'Kolkata');
});

test('returns no candidates for text without a gazetteer match', () => {
  assert.deepEqual(locateCandidates('A generic statement with no location'), []);
  assert.equal(locate(''), null);
});
