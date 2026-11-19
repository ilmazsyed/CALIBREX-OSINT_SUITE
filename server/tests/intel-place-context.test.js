import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPlaceCandidates } from '../intel-place-context.js';

test('attaches multiple candidates and chooses the strongest only when place is absent', () => {
  const item = { id: 'story-1' };
  const candidates = [
    { name: 'India', lat: 22.5, lng: 79, priority: 2, rank: 2 },
    { name: 'Kolkata', lat: 22.57, lng: 88.36, priority: 3, rank: 1 }
  ];
  applyPlaceCandidates(item, candidates);
  assert.equal(item.place.name, 'Kolkata');
  assert.equal(item.placeCandidates.length, 2);
});

test('preserves an explicit source place instead of replacing it with lexical candidates', () => {
  const item = { place: { name: 'Dhaka', lat: 23.81, lng: 90.41 } };
  applyPlaceCandidates(item, [{ name: 'Kolkata', lat: 22.57, lng: 88.36, priority: 3 }]);
  assert.equal(item.place.name, 'Dhaka');
  assert.equal(item.placeCandidates[0].name, 'Kolkata');
});

test('filters malformed candidates and handles empty inputs safely', () => {
  const item = {};
  applyPlaceCandidates(item, [{ name: 'Bad', lat: 'NaN', lng: 1 }, null]);
  assert.deepEqual(item.placeCandidates, []);
  assert.equal(item.place, undefined);
});
