import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locationRisk, riskRegister, riskBand } from '../locationrisk.js';

const LAYERS = {
  conflict: [{ lat: 50.45, lng: 30.52, title: 'Shelling', severity: 'CRITICAL' }], // ~Kyiv
  outages: [{ lat: 50.5, lng: 30.6, title: 'Internet drop' }],
  vessels: [{ lat: 50.45, lng: 30.52, title: 'ignored' }], // weight 0
};

test('locationRisk scores nearby disruption with drivers', () => {
  const r = locationRisk(50.45, 30.52, LAYERS, { radiusKm: 250 });
  assert.ok(r.score > 0);
  assert.ok(['HIGH', 'ELEVATED', 'WATCH', 'LOW'].includes(r.band));
  assert.ok(r.drivers.some(d => /conflict/i.test(d.type)));
  assert.ok(r.nearby.length >= 2);
});

test('a far-away location scores LOW / quiet', () => {
  const r = locationRisk(-33.9, 151.2, LAYERS); // Sydney, far from Kyiv signals
  assert.equal(r.score, 0);
  assert.equal(r.band, 'LOW');
});

test('riskRegister sorts sites by score', () => {
  const reg = riskRegister([
    { id: 'a', name: 'Kyiv office', lat: 50.45, lng: 30.52 },
    { id: 'b', name: 'Sydney office', lat: -33.9, lng: 151.2 },
    { id: 'c', name: 'bad', lat: NaN, lng: 0 }, // dropped
  ], LAYERS);
  assert.equal(reg.count, 2);
  assert.equal(reg.sites[0].id, 'a', 'riskiest first');
  assert.ok(reg.sites[0].score >= reg.sites[1].score);
});

test('riskBand thresholds', () => {
  assert.equal(riskBand(70), 'HIGH');
  assert.equal(riskBand(40), 'ELEVATED');
  assert.equal(riskBand(5), 'LOW');
});
