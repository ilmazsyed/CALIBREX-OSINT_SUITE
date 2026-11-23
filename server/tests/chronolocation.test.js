import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rawSunPosition, sunPosition, shadowToTimes } from '../chronolocation.js';

// Reference vector from the standard solar-position algorithm (SunCalc test):
test('rawSunPosition matches the reference vector', () => {
  const date = new Date('2013-03-05T00:00:00Z');
  const p = rawSunPosition(date, 50.5, 30.5);
  assert.ok(Math.abs(p.azimuth - (-2.5003175907168385)) < 1e-6, `azimuth ${p.azimuth}`);
  assert.ok(Math.abs(p.altitude - (-0.7000406838781611)) < 1e-6, `altitude ${p.altitude}`);
});

test('sunPosition returns compass bearing and degrees', () => {
  // Northern-hemisphere summer local noon-ish: sun high and roughly south.
  const p = sunPosition(new Date('2023-06-21T12:00:00Z'), 51.5, 0); // London ~solar noon
  assert.ok(p.altitudeDeg > 50, `altitude ${p.altitudeDeg}`);
  assert.ok(p.azimuthDeg > 120 && p.azimuthDeg < 240, `azimuth ${p.azimuthDeg}`);
});

test('shadowToTimes finds times the sun is opposite the shadow', () => {
  // A shadow pointing north (0) means the sun is in the south (~180) — midday.
  const r = shadowToTimes(51.5, 0, '2023-06-21', 0);
  assert.ok(Array.isArray(r.candidates) && r.candidates.length > 0);
  assert.ok(r.candidates.every(c => c.sunElevationDeg > 1));
  assert.equal(r.sunBearingDeg, 180);
  assert.deepEqual(shadowToTimes(0, 0, 'bad-date', 0).error, undefined === undefined ? shadowToTimes(0,0,'bad-date',0).error : null);
  assert.match(shadowToTimes(0, 0, 'bad-date', 0).error, /Invalid date/);
});
