// Supply-chain disruption scoring. Pure functions over the live worldmap layers
// and the strategic infrastructure dataset: a port/chokepoint status board, and
// disruption scoring along a user-defined shipping/supply lane. Observed signal
// intensity, not a forecast.
const R = 6371;
export function km(aLat, aLng, bLat, bLng) {
  const toR = d => d * Math.PI / 180;
  const dLat = toR(bLat - aLat), dLng = toR(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Disruption weight per layer (higher = more disruptive to logistics).
const WEIGHT = { conflict: 3, maritime: 2.5, outages: 2, hotspots: 2, fire: 1, natural: 1.5, quake: 1, vessels: 0, aircraft: 0, convergence: 2 };
const band = s => (s >= 60 ? 'HIGH' : s >= 30 ? 'ELEVATED' : s >= 10 ? 'WATCH' : 'NORMAL');

function nearbySignals(lat, lng, layers, radiusKm) {
  const hits = [];
  for (const [id, pts] of Object.entries(layers || {})) {
    if (!WEIGHT[id]) continue;
    for (const p of pts || []) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
      const d = km(lat, lng, p.lat, p.lng);
      if (d <= radiusKm) hits.push({ layer: id, title: p.title || id, severity: p.severity || null, distanceKm: Math.round(d), url: p.url || '' });
    }
  }
  return hits;
}
function scoreSignals(hits) {
  let s = 0;
  for (const h of hits) {
    const w = WEIGHT[h.layer] || 0;
    const sev = (h.severity || '').toUpperCase();
    const mult = sev === 'CRITICAL' ? 1.6 : sev === 'HIGH' ? 1.3 : 1;
    const prox = h.distanceKm < 100 ? 1.2 : 1; // closer = worse
    s += w * mult * prox;
  }
  return Math.min(100, Math.round(s));
}

/** Port / chokepoint status board: live disruption near each strategic node. */
export function portBoard(infrastructure, layers, { radiusKm = 300, types = ['port', 'chokepoint', 'energy'] } = {}) {
  const nodes = (infrastructure || []).filter(n => types.includes(n.type)).map(n => {
    const hits = nearbySignals(n.lat, n.lng, layers, radiusKm);
    const score = scoreSignals(hits);
    return { id: n.id, name: n.name, type: n.type, country: n.country, lat: n.lat, lng: n.lng, score, status: band(score), nearby: hits.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 6), signalCount: hits.length };
  });
  return { radiusKm, nodes: nodes.sort((a, b) => b.score - a.score), updatedAt: Date.now() };
}

/** Sample a segment into intermediate points ~every stepKm. */
function sampleSegment(a, b, stepKm = 120) {
  const dist = km(a.lat, a.lng, b.lat, b.lng);
  const n = Math.max(1, Math.round(dist / stepKm));
  const pts = [];
  for (let i = 0; i <= n; i++) { const f = i / n; pts.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }); }
  return pts;
}

/** Score disruption along a lane (array of {lat,lng,name?} waypoints). */
export function scoreLane(waypoints, infrastructure, layers, { corridorKm = 250 } = {}) {
  const wps = (waypoints || []).filter(w => Number.isFinite(w?.lat) && Number.isFinite(w?.lng));
  if (wps.length < 2) return { error: 'A lane needs at least two waypoints.' };
  const chokepoints = (infrastructure || []).filter(n => n.type === 'chokepoint');
  const segments = [];
  const seenSig = new Set();
  let worst = 0;
  const passedChokepoints = new Map();
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i], b = wps[i + 1];
    const samples = sampleSegment(a, b);
    const segHits = [];
    for (const s of samples) {
      for (const h of nearbySignals(s.lat, s.lng, layers, corridorKm)) {
        const key = `${h.layer}:${h.title}:${h.distanceKm}`;
        if (seenSig.has(key)) continue; seenSig.add(key); segHits.push(h);
      }
      for (const cp of chokepoints) { if (km(s.lat, s.lng, cp.lat, cp.lng) <= corridorKm && !passedChokepoints.has(cp.id)) passedChokepoints.set(cp.id, cp.name); }
    }
    const score = scoreSignals(segHits);
    worst = Math.max(worst, score);
    segments.push({ from: a.name || `${a.lat.toFixed(1)},${a.lng.toFixed(1)}`, to: b.name || `${b.lat.toFixed(1)},${b.lng.toFixed(1)}`, lengthKm: Math.round(km(a.lat, a.lng, b.lat, b.lng)), score, status: band(score), topSignals: segHits.sort((x, y) => (WEIGHT[y.layer] || 0) - (WEIGHT[x.layer] || 0)).slice(0, 5) });
  }
  const overall = Math.min(100, Math.round(worst * 0.7 + (segments.reduce((s, x) => s + x.score, 0) / segments.length) * 0.3));
  return {
    corridorKm, overall, status: band(overall), segments,
    chokepointsOnRoute: [...passedChokepoints.values()],
    note: 'Observed disruption near the route — not a forecast. Score reflects live conflict, maritime, outage and hazard signals in the corridor.',
    updatedAt: Date.now(),
  };
}
