// Cross-stream correlation engine. Surfaces places where SIGNALS FROM DIFFERENT
// STREAMS are converging right now — e.g. heavy conflict reporting + a cluster
// of active fires + seismic activity all on the same country. Converging
// multi-stream activity is what analysts watch for before a story breaks.
//
// HONESTY: this reports OBSERVED co-occurrence across streams, not causation or
// a forecast. Two streams lighting up together is a prompt to look, not a claim
// that one caused the other.
import { snapshot } from './feeds.js';
import { geointSnapshot } from './geoint.js';
import { computeInstability, COUNTRIES, nearestCountry } from './instability.js';

const DAY = 86400000;
const centroid = name => COUNTRIES.find(c => c.name === name);

/** Compute current cross-stream convergences. Pure over the live snapshots. */
export function computeCorrelations(now = Date.now()) {
  const items = snapshot().items || [];
  const geo = geointSnapshot().events || [];
  const inst = computeInstability(items, now);

  const byCountry = new Map();
  const add = (country, stream, weight, detail) => {
    if (!country) return;
    const c = byCountry.get(country) || { country, streams: new Set(), score: 0, details: [] };
    c.streams.add(stream);
    c.score += weight;
    if (detail) c.details.push(detail);
    byCountry.set(country, c);
  };

  // Stream 1 — news/instability reporting.
  for (const c of inst) if (c.score >= 15) add(c.country, 'news', c.score / 10, { stream: 'news', text: c.signals[0]?.title || `${c.reports} instability reports`, weight: c.score });

  // Streams 2-4 — geo events (conflict / fire / quake / other natural), last 2 days.
  for (const e of geo) {
    if (now - e.date > 2 * DAY) continue;
    const country = (e.categoryId === 'conflict' && COUNTRIES.find(c => c.re.test(e.title))?.name) || nearestCountry(e.lat, e.lng);
    if (!country) continue;
    const stream = e.categoryId === 'conflict' ? 'conflict' : e.categoryId === 'fire' ? 'fire' : e.categoryId === 'earthquakes' ? 'quake' : 'natural';
    const w = e.severity === 'CRITICAL' ? 3 : e.severity === 'HIGH' ? 2 : 1;
    add(country, stream, w, { stream, text: e.title, severity: e.severity, weight: w });
  }

  const out = [];
  for (const c of byCountry.values()) {
    if (c.streams.size < 2) continue;                 // a convergence needs ≥2 distinct streams
    const cc = centroid(c.country);
    out.push({
      country: c.country,
      lat: cc?.lat ?? null, lng: cc?.lng ?? null,
      streams: [...c.streams],
      streamCount: c.streams.size,
      score: Math.round(c.score),
      details: c.details.sort((a, b) => (b.weight || 0) - (a.weight || 0)).slice(0, 6),
    });
  }
  return out.sort((a, b) => b.streamCount - a.streamCount || b.score - a.score);
}

let state = { updatedAt: 0, convergences: [] };
export function sampleCorrelations(now = Date.now()) {
  state = { updatedAt: now, convergences: computeCorrelations(now) };
  return state;
}
export function correlationSnapshot() {
  return {
    updatedAt: state.updatedAt,
    convergences: state.convergences,
    note: 'Observed co-occurrence of signals from different streams on the same country — a prompt to investigate, not a forecast or a causal claim.',
  };
}
