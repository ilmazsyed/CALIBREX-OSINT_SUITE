import { test } from 'node:test';
import assert from 'node:assert/strict';
import { militaryActivity } from '../military.js';

const LAYERS = {
  aircraft: [
    { lat: 50.1, lng: 30.1, title: 'FORTE11', mil: true, tag: 'RQ-4' },
    { lat: 50.2, lng: 30.2, title: 'CIVIL123', mil: false }, // civil, excluded
  ],
  conflict: [{ lat: 50.3, lng: 30.3, title: 'Shelling', severity: 'HIGH' }],
  vessels: [{ lat: 50.1, lng: 30.1, title: 'cargo' }, { lat: 50.1, lng: 30.1, title: 'cargo2' }],
};

test('militaryActivity counts only military aircraft and nearby conflict', () => {
  const r = militaryActivity(50.2, 30.2, LAYERS, { radiusKm: 400 });
  assert.equal(r.militaryAircraftCount, 1, 'only the mil aircraft');
  assert.equal(r.militaryAircraft[0].callsign, 'FORTE11');
  assert.equal(r.conflictCount, 1);
  assert.equal(r.vesselDensity, 2);
  assert.ok(r.activityScore > 0);
  assert.ok(['HIGH', 'ELEVATED', 'NOTABLE', 'QUIET'].includes(r.band));
});

test('far-away point is QUIET', () => {
  const r = militaryActivity(-33.9, 151.2, LAYERS);
  assert.equal(r.militaryAircraftCount, 0);
  assert.equal(r.band, 'QUIET');
});

test('rejects bad coords', () => {
  assert.match(militaryActivity(NaN, 0, LAYERS).error, /lat\/lng/);
});
