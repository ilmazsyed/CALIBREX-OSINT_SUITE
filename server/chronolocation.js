// Chronolocation: sun position and shadow-to-time estimation for verifying when
// a photo was taken. Pure astronomy (no network, no keys). The core algorithm
// is the standard low-precision solar-position method (as used by SunCalc);
// azimuth is returned both in the raw south-based convention (for tests) and as
// a compass bearing from north.
const rad = Math.PI / 180;
const dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
const e = rad * 23.4397; // obliquity of the ecliptic

const toDays = date => date.valueOf() / dayMs - 0.5 + J1970 - J2000;
const solarMeanAnomaly = d => rad * (357.5291 + 0.98560028 * d);
const eclipticLongitude = M => M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
const declination = L => Math.asin(Math.sin(e) * Math.sin(L));
const rightAscension = L => Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
const siderealTime = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;

/** Raw solar position in radians, azimuth measured from SOUTH, clockwise. */
export function rawSunPosition(date, lat, lng) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(date);
  const M = solarMeanAnomaly(d), L = eclipticLongitude(M);
  const dec = declination(L), ra = rightAscension(L);
  const H = siderealTime(d, lw) - ra;
  return {
    azimuth: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)),
    altitude: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)),
  };
}

/** Friendly position: altitude in degrees, azimuth as a compass bearing (0=N, 90=E). */
export function sunPosition(date, lat, lng) {
  const p = rawSunPosition(date, lat, lng);
  return {
    altitudeDeg: p.altitude / rad,
    azimuthDeg: (p.azimuth / rad + 180 + 360) % 360, // south-based -> compass from north
  };
}

/**
 * Given a place, a UTC date and the compass bearing a shadow points toward,
 * return the UTC times that day when the sun would cast a shadow in that
 * direction (sun is opposite the shadow). A shadow bearing of S means the sun
 * is in the N. Returns candidates with the sun's elevation (longer shadows at
 * low elevation). Scans in 5-minute steps within the given tolerance.
 */
export function shadowToTimes(lat, lng, isoDay, shadowBearingDeg, { toleranceDeg = 6 } = {}) {
  const base = new Date(isoDay + 'T00:00:00Z');
  if (isNaN(base)) return { error: 'Invalid date (use YYYY-MM-DD).' };
  const wantSun = (Number(shadowBearingDeg) + 180 + 360) % 360; // sun is opposite the shadow
  const hits = [];
  for (let m = 0; m < 1440; m += 5) {
    const t = new Date(base.valueOf() + m * 60000);
    const { altitudeDeg, azimuthDeg } = sunPosition(t, lat, lng);
    if (altitudeDeg <= 1) continue; // sun below (or at) the horizon: no usable shadow
    let diff = Math.abs(azimuthDeg - wantSun); if (diff > 180) diff = 360 - diff;
    if (diff <= toleranceDeg) hits.push({ utc: t.toISOString().slice(11, 16), sunElevationDeg: Math.round(altitudeDeg), sunBearingDeg: Math.round(azimuthDeg) });
  }
  return { date: isoDay, lat, lng, shadowBearingDeg: Number(shadowBearingDeg), sunBearingDeg: Math.round(wantSun), candidates: hits, note: 'Times are UTC. Longer shadows mean lower sun elevation. Add the location’s UTC offset to read local time.' };
}
