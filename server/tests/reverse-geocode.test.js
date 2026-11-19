import test from 'node:test';
import assert from 'node:assert/strict';
import { createReverseGeocoder, normaliseReverseGeocodeResult } from '../reverse-geocode.js';

const sample = {
  display_name: 'Kolkata, West Bengal, India',
  category: 'place', type: 'city', osm_type: 'relation', osm_id: 123,
  licence: 'Data © OpenStreetMap contributors, ODbL 1.0',
  address: { city: 'Kolkata', state: 'West Bengal', country: 'India', country_code: 'in', postcode: '700001' }
};

test('normalises place hierarchy and preserves provider attribution', () => {
  const result = normaliseReverseGeocodeResult(sample, { lat: 22.57, lon: 88.36 });
  assert.equal(result.place.name, 'Kolkata');
  assert.equal(result.place.state, 'West Bengal');
  assert.equal(result.place.countryCode, 'IN');
  assert.equal(result.provider, 'OpenStreetMap Nominatim');
  assert.match(result.attribution, /OpenStreetMap contributors/);
  assert.match(result.caveat, /not independent proof/);
});

test('rejects invalid coordinate inputs before making a request', async () => {
  let called = false;
  const geocoder = createReverseGeocoder({ fetchImpl: async () => { called = true; } });
  await assert.rejects(() => geocoder.lookup(91, 0), { status: 400 });
  await assert.rejects(() => geocoder.lookup(0, -181), { status: 400 });
  assert.equal(called, false);
});

test('uses provider response and caches successful results', async () => {
  let calls = 0;
  const geocoder = createReverseGeocoder({
    fetchImpl: async url => {
      calls++;
      assert.equal(new URL(url).hostname, 'nominatim.openstreetmap.org');
      return { ok: true, json: async () => sample };
    },
    now: () => 100000,
    sleep: async () => {},
    minIntervalMs: 0
  });
  const first = await geocoder.lookup(22.57, 88.36);
  const second = await geocoder.lookup(22.57, 88.36);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(calls, 1);
});

test('does not cache provider errors or unusable results', async () => {
  let calls = 0;
  const geocoder = createReverseGeocoder({
    fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ error: 'Unable to geocode' }) }; },
    now: () => 100000, sleep: async () => {}, minIntervalMs: 0
  });
  await assert.rejects(() => geocoder.lookup(1, 2), { status: 404 });
  await assert.rejects(() => geocoder.lookup(1, 2), { status: 404 });
  assert.equal(calls, 2);
});

test('serialises provider requests and applies the minimum request interval', async () => {
  let now = 100000, calls = 0, sleeps = 0;
  const geocoder = createReverseGeocoder({
    fetchImpl: async () => { calls++; return { ok: true, json: async () => sample }; },
    now: () => now,
    sleep: async ms => { sleeps++; now += ms; },
    minIntervalMs: 1100
  });
  await Promise.all([geocoder.lookup(22.57, 88.36), geocoder.lookup(22.58, 88.36)]);
  assert.equal(calls, 2);
  assert.equal(sleeps, 1);
});
