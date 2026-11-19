import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeospatialEvidence } from '../geospatial-evidence.js';

test('normalizes EXIF DMS coordinates and hemispheres', () => {
  const r = normalizeGeospatialEvidence({ exif: {
    GPSLatitude: [22, 34, 12], GPSLatitudeRef: 'N',
    GPSLongitude: [88, 21, 36], GPSLongitudeRef: 'E',
    DateTimeOriginal: '2026-11-19T08:00:00Z', GPSHPositioningError: 12
  }, metadataOrigin: 'SOURCE_EXIF', metadataSource: 'https://example.test/photo.jpg' });
  assert.equal(r.valid, true);
  assert.ok(Math.abs(r.coordinates.lat - 22.57) < 0.001);
  assert.ok(Math.abs(r.coordinates.lon - 88.36) < 0.001);
  assert.equal(r.accuracyMeters, 12);
  assert.equal(r.metadata.origin, 'SOURCE_EXIF');
});

test('applies south and west hemisphere signs', () => {
  const r = normalizeGeospatialEvidence({ exif: {
    GPSLatitude: [33, 51, 0], GPSLatitudeRef: 'S',
    GPSLongitude: [151, 12, 0], GPSLongitudeRef: 'W'
  }});
  assert.equal(r.coordinates.lat < 0, true);
  assert.equal(r.coordinates.lon < 0, true);
});

test('rejects malformed coordinates and timestamps', () => {
  const r = normalizeGeospatialEvidence({ exif: {
    GPSLatitude: [91, 0, 0], GPSLatitudeRef: 'N',
    GPSLongitude: [181, 0, 0], GPSLongitudeRef: 'E',
    DateTimeOriginal: 'not-a-date'
  }});
  assert.equal(r.valid, false);
  assert.ok(r.errors.includes('LATITUDE_MISSING_OR_INVALID'));
  assert.ok(r.errors.includes('LONGITUDE_MISSING_OR_INVALID'));
  assert.ok(r.errors.includes('INVALID_OBSERVATION_TIMESTAMP'));
});

test('does not invent accuracy or authenticate metadata origin', () => {
  const r = normalizeGeospatialEvidence({ lat: 22.5, lon: 88.3, metadataOrigin: 'USER_SUPPLIED' });
  assert.equal(r.accuracyMeters, null);
  assert.ok(r.caveats.some(x => x.includes('not authenticated')));
});

test('preserves EXIF DateTimeOriginal as timezone-unknown when no offset is supplied',()=>{
  const r=normalizeGeospatialEvidence({lat:22.5,lon:88.3,exif:{DateTimeOriginal:'2026:11:19 12:00:00'}});
  assert.equal(r.valid,true);
  assert.equal(r.observedAt,'2026-11-19T12:00:00');
  assert.equal(r.observedAtTimezone,'UNKNOWN');
});

test('applies an explicit EXIF OffsetTimeOriginal without assuming local timezone',()=>{
  const r=normalizeGeospatialEvidence({lat:22.5,lon:88.3,exif:{DateTimeOriginal:'2026:11:19 12:00:00',OffsetTimeOriginal:'+05:30'}});
  assert.equal(r.valid,true);
  assert.equal(r.observedAt,'2026-11-19T06:30:00.000Z');
  assert.equal(r.observedAtTimezone,'EXPLICIT_OFFSET');
});

test('uses GPSDateStamp and GPSTimeStamp as UTC when DateTimeOriginal is absent',()=>{
  const r=normalizeGeospatialEvidence({lat:22.5,lon:88.3,exif:{GPSDateStamp:'2026:11:19',GPSTimeStamp:[8,15,30]}});
  assert.equal(r.valid,true);
  assert.equal(r.observedAt,'2026-11-19T08:15:30.000Z');
  assert.equal(r.observedAtTimezone,'UTC');
});
