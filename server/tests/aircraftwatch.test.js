import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAircraftWatches, matchAircraftWatches } from '../aircraftwatch.js';
import { detectMilSurge } from '../signals.js';

const aircraft = [
  { id: 'a1', callsign: 'RCH451', tag: 'C17', mil: true, lat: 25.3, lng: 55.4, emergency: null },
  { id: 'a2', callsign: 'UAL22', tag: 'B738', mil: false, lat: 25.25, lng: 55.35, emergency: null },
  { id: 'a3', callsign: 'FORCE1', tag: 'RC135', mil: true, lat: 50, lng: 30, emergency: null },
  { id: 'a4', callsign: 'HELP9', tag: 'B739', mil: false, lat: 10, lng: 10, emergency: 'general emergency' },
];

test('cleanAircraftWatches: sanitises and drops invalid entries', () => {
  const w = cleanAircraftWatches([
    { kind: 'area', name: 'Al Dhafra', lat: 24.25, lng: 54.55, radiusKm: 100, milOnly: true },
    { kind: 'area', lat: 999, lng: 0, radiusKm: 50 },     // bad lat
    { kind: 'callsign', value: 'RCH' },
    { kind: 'callsign', value: 'x' },                       // too short
    { kind: 'emergency' },
    { kind: 'nonsense' },                                   // bad kind
  ]);
  assert.equal(w.length, 3);
  assert.deepEqual(w.map(x => x.kind), ['area', 'callsign', 'emergency']);
  assert.equal(w[0].milOnly, true);
});

test('matchAircraftWatches: area (mil only), callsign, type, emergency', () => {
  const area = matchAircraftWatches([{ id: 'w', kind: 'area', lat: 25.3, lng: 55.4, radiusKm: 50, milOnly: true }], aircraft);
  assert.deepEqual(area[0].aircraft.map(a => a.id), ['a1']); // a2 is civil (milOnly), others far

  const cs = matchAircraftWatches([{ id: 'w', kind: 'callsign', value: 'RCH' }], aircraft);
  assert.deepEqual(cs[0].aircraft.map(a => a.id), ['a1']);

  const ty = matchAircraftWatches([{ id: 'w', kind: 'type', value: 'RC135' }], aircraft);
  assert.deepEqual(ty[0].aircraft.map(a => a.id), ['a3']);

  const em = matchAircraftWatches([{ id: 'w', kind: 'emergency' }], aircraft);
  assert.deepEqual(em[0].aircraft.map(a => a.id), ['a4']);
});

test('detectMilSurge: flags a spike over the rolling baseline', () => {
  assert.equal(detectMilSurge(30, [10, 10, 10, 10, 10, 10]).surging, true);
  assert.equal(detectMilSurge(11, [10, 10, 10, 10, 10, 10]).surging, false);
  assert.equal(detectMilSurge(30, [10, 10]).baseline, null); // not enough history yet
});
