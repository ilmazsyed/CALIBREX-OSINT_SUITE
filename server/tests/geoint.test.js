import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eonetToEvent, usgsToEvent, mergeEvents } from '../geoint.js';

test('eonetToEvent: flattens a Point geometry and grades by category', () => {
  const ev = eonetToEvent({
    id: 'EONET_123',
    title: 'Wildfire - California',
    categories: [{ id: 'wildfires', title: 'Wildfires' }],
    geometry: [{ type: 'Point', coordinates: [-120.5, 38.2], date: '2026-10-01T00:00:00Z' }],
    sources: [{ id: 'InciWeb', url: 'https://inciweb.example/1' }],
  });
  assert.equal(ev.id, 'eonet:EONET_123');
  assert.equal(ev.category, 'Wildfires');
  assert.equal(ev.severity, 'HIGH');
  assert.equal(ev.lat, 38.2);
  assert.equal(ev.lng, -120.5);
  assert.equal(ev.source, 'InciWeb');
  assert.equal(ev.url, 'https://inciweb.example/1');
});

test('eonetToEvent: uses the last geometry and a representative vertex for polygons', () => {
  const ev = eonetToEvent({
    id: 'EONET_P',
    title: 'Severe Storm',
    categories: [{ id: 'severeStorms', title: 'Severe Storms' }],
    geometry: [
      { type: 'Point', coordinates: [10, 10], date: '2026-09-01T00:00:00Z' },
      { type: 'Polygon', coordinates: [[[72.8, 19.0], [73, 19], [73, 19.2]]], date: '2026-10-02T00:00:00Z' },
    ],
  });
  assert.equal(ev.lat, 19.0);
  assert.equal(ev.lng, 72.8);
  assert.equal(ev.india, false); // India is keyed off the title, and "Severe Storm" has no India token
});

test('eonetToEvent: rejects events with no usable geometry or title', () => {
  assert.equal(eonetToEvent({ id: 'x', title: 'No geom', geometry: [] }), null);
  assert.equal(eonetToEvent({ id: 'x', title: '', geometry: [{ type: 'Point', coordinates: [1, 2], date: 'now' }] }), null);
});

test('usgsToEvent: maps a feature and grades severity by magnitude', () => {
  const big = usgsToEvent({
    id: 'us7000abc',
    properties: { mag: 6.4, place: '12km S of Somewhere', time: 1760000000000, url: 'https://earthquake.usgs.gov/e/1', title: 'M 6.4 - 12km S of Somewhere' },
    geometry: { coordinates: [142.1, 38.3, 29] },
  });
  assert.equal(big.id, 'usgs:us7000abc');
  assert.equal(big.category, 'Earthquakes');
  assert.equal(big.severity, 'CRITICAL');
  assert.equal(big.magnitude, 'M6.4');
  assert.equal(big.lat, 38.3);
  assert.equal(big.lng, 142.1);
  assert.equal(big.source, 'USGS');

  const mid = usgsToEvent({ id: 'b', properties: { mag: 4.6, place: 'x', time: 1, url: 'u' }, geometry: { coordinates: [0, 0] } });
  assert.equal(mid.severity, 'MEDIUM');
});

test('usgsToEvent: flags India by place string, rejects bad coordinates', () => {
  const ind = usgsToEvent({ id: 'i', properties: { mag: 5.1, place: '50km NE of Kashmir', time: 1, url: 'u' }, geometry: { coordinates: [74.9, 34.1] } });
  assert.equal(ind.india, true);
  assert.equal(ind.severity, 'HIGH');
  assert.equal(usgsToEvent({ id: 'z', properties: { mag: 5 }, geometry: { coordinates: [null, 'x'] } }), null);
  assert.equal(usgsToEvent({ id: 'z', properties: { mag: 5 }, geometry: {} }), null);
});

test('mergeEvents: de-dupes by id across sources and sorts newest first', () => {
  const a = [{ id: 'eonet:1', date: 100 }, { id: 'usgs:2', date: 300 }];
  const b = [{ id: 'usgs:2', date: 300 }, { id: 'usgs:3', date: 200 }];
  const merged = mergeEvents(a, b);
  assert.deepEqual(merged.map(e => e.id), ['usgs:2', 'usgs:3', 'eonet:1']);
  assert.equal(merged.length, 3);
});
