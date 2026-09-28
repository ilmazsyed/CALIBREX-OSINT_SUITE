import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAdsb, mergeAircraft } from '../signals.js';

const sample = {
  ac: [
    { hex: 'abc123', flight: 'AIC101  ', t: 'B77W', r: 'VT-ALP', lat: 28.7, lon: 77.1, alt_baro: 35000, gs: 480, track: 90, squawk: '2000' },
    { hex: 'def456', flight: 'PANIC1', t: 'C130', lat: 25.1, lon: 55.2, alt_baro: 22000, gs: 300, track: 180, squawk: '7700' },
    { hex: 'ground1', flight: 'TAXI', lat: 24.0, lon: 54.0, alt_baro: 'ground', gs: 5, track: 0, squawk: '1200' },
    { hex: 'nogeo', flight: 'BAD', lat: null, lon: null, alt_baro: 10000 },
  ],
};

test('parseAdsb maps readsb fields, drops grounded and position-less aircraft', () => {
  const rows = parseAdsb(sample);
  assert.equal(rows.length, 2, 'ground + null-position rows are excluded');
  const air = rows.find(r => r.id === 'abc123');
  assert.equal(air.callsign, 'AIC101');
  assert.equal(air.tag, 'B77W');
  assert.equal(air.mil, false);
  assert.equal(air.altM, Math.round(35000 * 0.3048)); // feet -> metres
  assert.equal(air.speedMs, Math.round(480 * 0.514444)); // knots -> m/s
});

test('parseAdsb flags emergency squawks and military feed', () => {
  const emerg = parseAdsb(sample).find(r => r.id === 'def456');
  assert.equal(emerg.emergency, 'general emergency');
  const mil = parseAdsb({ ac: [{ hex: 'mil01', flight: 'RCH123', t: 'C17', lat: 30, lon: 60, alt_baro: 30000, gs: 450, track: 45, squawk: '1234' }] }, { mil: true });
  assert.equal(mil[0].mil, true);
  assert.equal(mil[0].tag, 'MIL');
});

test('mergeAircraft de-duplicates by hex, keeps military flag, sorts emergencies first', () => {
  const civ = parseAdsb(sample); // abc123 (normal), def456 (emergency)
  const mil = parseAdsb({ ac: [{ hex: 'abc123', flight: 'AIC101', lat: 28.7, lon: 77.1, alt_baro: 35000, gs: 480, track: 90 }] }, { mil: true });
  const merged = mergeAircraft([civ, mil]);
  assert.equal(merged.length, 2, 'the shared hex collapses to one row');
  assert.equal(merged[0].id, 'def456', 'emergency sorts to the top');
  assert.equal(merged.find(r => r.id === 'abc123').mil, true, 'military flag is preserved on merge');
});
