// Conflict Watch: geolocated conflict/unrest hotspots, derived from Calibrex's
// own live security wires (India, South Asia terrorism, kinetic, regional and
// global-power-axis news) — the same geolocated items that feed the threat map.
// No external dependency, no key: hotspots are places ranked by how many
// conflict reports mention them right now. Observed reporting volume per place,
// not casualty counts, not a forecast.
import { snapshot } from './feeds.js';

const WIRES = ['INDIA', 'SATP', 'KINETIC', 'REGIONAL', 'GLOBAL_AXIS'];
const SEV_RANK = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
const INDIA = /\b(india|indian|kashmir|jammu|manipur|chhattisgarh|jharkhand|assam|punjab|delhi|mumbai|bengaluru|kolkata|chennai|naxal|maoist)\b/i;

export function conflictSnapshot() {
  const snap = snapshot();
  const items = (snap.items || []).filter(i => WIRES.includes(i.wire) && i.place && Number.isFinite(i.place.lat) && Number.isFinite(i.place.lng));
  const byPlace = new Map();
  for (const i of items) {
    const key = i.place.name;
    const g = byPlace.get(key) || { name: key, lat: i.place.lat, lng: i.place.lng, count: 0, maxSev: 0, latest: null, india: false };
    g.count++;
    g.maxSev = Math.max(g.maxSev, SEV_RANK[i.severity] || 0);
    if (!g.latest || (i.published || 0) > (g.latest.published || 0)) g.latest = { title: i.title, url: i.url, source: i.source, published: i.published || 0 };
    if (i.wire === 'INDIA' || i.wire === 'SATP' || INDIA.test(key)) g.india = true;
    byPlace.set(key, g);
  }
  const events = [...byPlace.values()].map(g => {
    const severity = (g.maxSev >= 3 && g.count >= 3) ? 'CRITICAL'
      : (g.maxSev >= 3 || g.count >= 4) ? 'HIGH'
      : (g.maxSev >= 2 || g.count >= 2) ? 'MEDIUM' : 'LOW';
    return {
      id: `${g.name}:${g.lat.toFixed(2)},${g.lng.toFixed(2)}`,
      title: g.name, category: 'Conflict', categoryId: 'conflict', severity,
      lat: g.lat, lng: g.lng, date: g.latest?.published || snap.updatedAt || Date.now(),
      magnitude: `${g.count} report${g.count === 1 ? '' : 's'}`,
      url: g.latest?.url || '', source: g.latest?.source || 'Wire', india: g.india, count: g.count,
    };
  }).sort((a, b) => b.count - a.count || SEV_RANK[b.severity] - SEV_RANK[a.severity]).slice(0, 300);
  return { updatedAt: snap.updatedAt, refreshing: false, events, sources: { feed: { ok: (snap.items || []).length > 0 } } };
}

// Conflict is computed on demand from the live feed — no separate loop needed.
export function startConflictLoop() { /* no-op */ }
