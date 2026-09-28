import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchLibrary } from '../library.js';

const day = 86400000;
const now = Date.now();
const items = [
  { id: '1', title: 'Missile strike on Kharkiv', summary: 'shelling overnight', source: 'Reuters', kind: 'news', url: 'u1', published: now - 1 * day, wire: 'KINETIC', severity: 'CRITICAL', place: { name: 'Kharkiv', lat: 50, lng: 36.2 } },
  { id: '2', title: 'Ransomware hits hospital', summary: '', source: 'BleepingComputer', kind: 'news', url: 'u2', published: now - 2 * day, wire: 'CYBER', severity: 'HIGH', place: null },
  { id: '3', title: 'Local council meeting', summary: 'budget talks', source: 'Local Paper', kind: 'news', url: 'u3', published: now - 3 * day, wire: 'REGIONAL', severity: 'LOW', place: null },
  { id: '4', title: 'Reddit chatter about strike', summary: 'unverified', source: 'Reddit', kind: 'social', url: 'u4', published: now - 5 * day, wire: 'KINETIC', severity: 'MEDIUM', place: null },
];

test('searchLibrary: full-text needs every word, sorts newest first', () => {
  const r = searchLibrary(items, { q: 'strike' });
  assert.deepEqual(r.results.map(x => x.id), ['1', '4']);
  assert.equal(r.total, 2);
});

test('searchLibrary: wire + minSeverity + source filters', () => {
  assert.deepEqual(searchLibrary(items, { wires: ['CYBER'] }).results.map(x => x.id), ['2']);
  assert.deepEqual(searchLibrary(items, { minSeverity: 'HIGH' }).results.map(x => x.id), ['1', '2']);
  assert.deepEqual(searchLibrary(items, { source: 'reuters' }).results.map(x => x.id), ['1']);
});

test('searchLibrary: date range and limit', () => {
  const r = searchLibrary(items, { from: now - 2.5 * day, to: now });
  assert.deepEqual(r.results.map(x => x.id), ['1', '2']);
  assert.equal(searchLibrary(items, { limit: 1 }).results.length, 1);
});
