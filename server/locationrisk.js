// Location & asset risk scoring. A per-location score from live disruption
// signals nearby, so an analyst can see which of their sites are most exposed
// right now. Observed signal intensity within a radius — not a forecast.
import { km } from './supplychain.js';

const WEIGHT = { conflict: 3, hotspots: 2.5, maritime: 1.5, outages: 2, fire: 1.5, quake: 1.2, natural: 1.3, convergence: 2, vessels: 0, aircraft: 0 };
const LABEL = { conflict: 'Armed conflict', hotspots: 'Threat hotspot', maritime: 'Maritime incident', outages: 'Internet outage', fire: 'Active fire', quake: 'Earthquake', natural: 'Natural hazard', convergence: 'Stream convergence' };
export const riskBand = s => (s >= 60 ? 'HIGH' : s >= 35 ? 'ELEVATED' : s >= 15 ? 'WATCH' : 'LOW');

/** Score one location from live layers within radiusKm. */
export function locationRisk(lat, lng, layers, { radiusKm = 250 } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: 'Valid lat/lng required.' };
  const drivers = {};
  const nearby = [];
  let score = 0;
  for (const [id, pts] of Object.entries(layers || {})) {
    const w = WEIGHT[id]; if (!w) continue;
    for (const p of pts || []) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
      const d = km(lat, lng, p.lat, p.lng);
      if (d > radiusKm) continue;
      const sev = (p.severity || '').toUpperCase();
      const mult = sev === 'CRITICAL' ? 1.6 : sev === 'HIGH' ? 1.3 : 1;
      const prox = d < 75 ? 1.3 : d < 150 ? 1.1 : 1;
      score += w * mult * prox;
      drivers[id] = (drivers[id] || 0) + 1;
      nearby.push({ layer: id, label: LABEL[id] || id, title: p.title || LABEL[id] || id, severity: p.severity || null, distanceKm: Math.round(d), url: p.url || '' });
    }
  }
  score = Math.min(100, Math.round(score));
  return {
    lat, lng, score, band: riskBand(score), radiusKm,
    drivers: Object.entries(drivers).map(([k, n]) => ({ type: LABEL[k] || k, count: n })).sort((a, b) => b.count - a.count),
    nearby: nearby.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8),
    note: 'Observed disruption near this point, not a forecast. A quiet score is not a guarantee of safety.',
  };
}

/** Score a list of sites ({name,lat,lng,place?}) into a sorted risk register. */
export function riskRegister(sites, layers, opts = {}) {
  const rows = (sites || []).filter(s => Number.isFinite(s?.lat) && Number.isFinite(s?.lng)).map(s => {
    const r = locationRisk(s.lat, s.lng, layers, opts);
    return { id: s.id || `${s.lat},${s.lng}`, name: s.name || s.place || `${s.lat.toFixed(2)},${s.lng.toFixed(2)}`, place: s.place || '', lat: s.lat, lng: s.lng, score: r.score, band: r.band, drivers: r.drivers, nearby: r.nearby };
  });
  return { sites: rows.sort((a, b) => b.score - a.score), updatedAt: Date.now(), count: rows.length };
}
