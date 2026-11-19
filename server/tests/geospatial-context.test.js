import test from 'node:test';
import assert from 'node:assert/strict';
import { attachGeospatialContext, sanitiseGeospatialContext } from '../geospatial-context.js';

const result = {
  coordinates: { lat: 22.57, lon: 88.36 },
  displayName: 'Kolkata, West Bengal, India',
  place: { name: 'Kolkata', state: 'West Bengal', country: 'India', countryCode: 'IN' },
  feature: { category: 'place', type: 'city', osmType: 'relation', osmId: 123 },
  provider: 'tampered-provider', sourceUrl: 'https://evil.test',
  licence: 'ODbL'
};

test('sanitises reverse geocoder context and pins provider identity', () => {
  const context = sanitiseGeospatialContext(result, 'analyst-1', 1000);
  assert.equal(context.provider, 'OpenStreetMap Nominatim');
  assert.equal(context.sourceUrl, 'https://nominatim.openstreetmap.org/reverse');
  assert.equal(context.place.name, 'Kolkata');
  assert.equal(context.recordedAt, new Date(1000).toISOString());
  assert.equal(context.recordedBy, 'analyst-1');
});

test('rejects missing or invalid coordinates', () => {
  assert.throws(() => sanitiseGeospatialContext({}, 'a'));
  assert.throws(() => sanitiseGeospatialContext({ coordinates: { lat: 91, lon: 0 } }, 'a'));
});

test('attaches context to only the selected evidence record', () => {
  const items = [{ id: 'e1', title: 'A' }, { id: 'e2', title: 'B' }];
  const context = sanitiseGeospatialContext(result, 'analyst-1');
  const updated = attachGeospatialContext(items, 'e2', context);
  assert.equal(updated[0].geospatialContext, undefined);
  assert.equal(updated[1].geospatialContext.place.name, 'Kolkata');
});

test('rejects unknown evidence ids', () => {
  assert.throws(() => attachGeospatialContext([{ id: 'e1' }], 'missing', {}), /not found/);
});
