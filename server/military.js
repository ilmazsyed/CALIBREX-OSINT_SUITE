// Military activity fusion. Pulls the military-flagged air picture, conflict
// events and vessel density near a point into one observed activity read, for
// the defense analyst. Open-source telemetry only — a lead, not confirmation of
// a military operation, and never attribution.
import { km } from './supplychain.js';

const band = s => (s >= 50 ? 'HIGH' : s >= 25 ? 'ELEVATED' : s >= 8 ? 'NOTABLE' : 'QUIET');

export function militaryActivity(lat, lng, layers, { radiusKm = 400 } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: 'Valid lat/lng required.' };
  const near = (pts, pred = () => true) => (pts || []).filter(p => typeof p.lat === 'number' && typeof p.lng === 'number' && pred(p) && km(lat, lng, p.lat, p.lng) <= radiusKm);

  const milAir = near(layers.aircraft, p => p.mil)
    .map(p => ({ callsign: p.title || 'unknown', tag: p.tag || '', emergency: /emergency|7700|7600/i.test(`${p.category || ''} ${p.severity || ''}`), distanceKm: Math.round(km(lat, lng, p.lat, p.lng)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const conflict = near(layers.conflict).map(p => ({ title: p.title || 'event', severity: p.severity || null, distanceKm: Math.round(km(lat, lng, p.lat, p.lng)) })).sort((a, b) => a.distanceKm - b.distanceKm);
  const vessels = near(layers.vessels);

  const score = Math.min(100, Math.round(milAir.length * 6 + conflict.length * 4 + Math.min(vessels.length, 40) * 0.3));
  return {
    lat, lng, radiusKm,
    militaryAircraft: milAir.slice(0, 25), militaryAircraftCount: milAir.length,
    conflictEvents: conflict.slice(0, 15), conflictCount: conflict.length,
    vesselDensity: vessels.length,
    activityScore: score, band: band(score),
    note: 'Open-source telemetry (ADS-B military flags, conflict reporting, AIS density). Vessel density is not naval classification. A lead for analysis, not confirmation of a military operation or attribution.',
    checkedAt: Date.now(),
  };
}
