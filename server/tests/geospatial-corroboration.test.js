import test from 'node:test';
import assert from 'node:assert/strict';
import { assessGeospatialCorroboration, validateEvidenceCoordinates, compareLocationClaims } from '../geospatial-validation.js';

test('classifies observations as consistent when uncertainty circles overlap within tolerance', () => {
  const result = assessGeospatialCorroboration([
    { id: 'a', lat: 22.5726, lon: 88.3639, accuracyMeters: 300 },
    { id: 'b', lat: 22.5730, lon: 88.3640, accuracyMeters: 300 }
  ]);
  assert.equal(result.comparisons[0].assessment, 'CONSISTENT_WITHIN_TOLERANCE');
  assert.equal(result.summary.consistent, 1);
});

test('flags conflict only when minimum possible separation exceeds threshold', () => {
  const result = assessGeospatialCorroboration([
    { id: 'a', lat: 22.5726, lon: 88.3639, accuracyMeters: 50 },
    { id: 'b', lat: 28.6139, lon: 77.2090, accuracyMeters: 50 }
  ]);
  assert.equal(result.comparisons[0].assessment, 'SPATIAL_CONFLICT');
  assert.equal(result.status, 'CONFLICTS_FOUND');
  assert.ok(result.comparisons[0].minimumSeparationMeters > 1000);
});

test('keeps comparison indeterminate when either accuracy radius is unknown', () => {
  const result = assessGeospatialCorroboration([
    { id: 'a', lat: 22.5726, lon: 88.3639, accuracyMeters: 10 },
    { id: 'b', lat: 28.6139, lon: 77.2090 }
  ]);
  assert.equal(result.comparisons[0].assessment, 'INDETERMINATE');
  assert.equal(result.comparisons[0].uncertaintyMeters, null);
  assert.equal(result.status, 'REVIEW_REQUIRED');
});

test('rejects malformed claims and supports a caller-defined tolerance', () => {
  const result = assessGeospatialCorroboration([
    { id: 'bad', lat: 95, lon: 10, accuracyMeters: 1 },
    { id: 'a', lat: 0, lon: 0, accuracyMeters: 20 },
    { id: 'b', lat: 0, lon: 0.0001, accuracyMeters: 20 }
  ], { consistencyThresholdMeters: 100 });
  assert.equal(result.invalidClaims, 1);
  assert.equal(result.validClaims, 2);
  assert.equal(result.comparisons[0].consistencyThresholdMeters, 100);
  assert.equal(result.comparisons[0].assessment, 'CONSISTENT_WITHIN_TOLERANCE');
});

test('compares claimed country and place against saved provider context',()=>{
  const result=validateEvidenceCoordinates({
    lat:22.5726,lon:88.3639,claimedCountry:'Bangladesh',claimedPlace:'Dhaka',
    geospatialContext:{
      provider:'OpenStreetMap Nominatim',
      recordedAt:'2026-11-19T10:00:00.000Z',
      recordedBy:'analyst-1',
      place:{name:'Kolkata',country:'India'},
      caveat:'Provider-derived context; not event verification.'
    }
  });
  assert.ok(result.warnings.includes('COUNTRY_MISMATCH'));
  assert.ok(result.warnings.includes('PLACE_NAME_MISMATCH'));
  assert.equal(result.placeContext.provider,'OpenStreetMap Nominatim');
  assert.equal(result.placeContext.country,'India');
});

test('does not invent claim mismatch when no claim or provider context exists',()=>{
  const result=validateEvidenceCoordinates({lat:22.5726,lon:88.3639});
  assert.deepEqual(result.warnings,[]);
  assert.equal(result.placeContext,null);
});

test('aggregate location comparison exposes provider place mismatches',()=>{
  const result=compareLocationClaims([{
    id:'e1',lat:22.5726,lon:88.3639,claimedCountry:'Bangladesh',claimedPlace:'Dhaka',
    geospatialContext:{provider:'OpenStreetMap Nominatim',place:{country:'India',name:'Kolkata'}}
  }]);
  assert.equal(result.status,'REVIEW_REQUIRED');
  assert.equal(result.claimWarnings.length,1);
  assert.ok(result.claimWarnings[0].warnings.includes('COUNTRY_MISMATCH'));
  assert.ok(result.claimWarnings[0].warnings.includes('PLACE_NAME_MISMATCH'));
});
