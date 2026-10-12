// Unified Global Situation Map: aggregates every geolocated stream the platform
// already produces into ONE layered snapshot, so the client can render a single
// world map with toggleable layers (the WorldMonitor-style situational view).
// No new data — it joins existing in-memory snapshots, so it is cheap and
// inherits every stream's fail-proof last-good behaviour.
import { snapshot } from './feeds.js';
import { geointSnapshot } from './geoint.js';
import { maritimeSnapshot } from './maritime.js';
import { signalsSnapshot } from './signals.js';
import { correlationSnapshot } from './correlation.js';
import { aisSnapshot } from './aisstream.js';

const pt = (lat, lng, extra) => ({ lat: Number(lat), lng: Number(lng), ...extra });
const ok = p => Number.isFinite(p.lat) && Number.isFinite(p.lng);

export function worldmapSnapshot() {
  const feed = snapshot();
  const geo = geointSnapshot().events || [];
  const mar = maritimeSnapshot();
  const sig = signalsSnapshot();
  const conv = correlationSnapshot();

  const geoByCat = id => geo.filter(e => e.categoryId === id)
    .map(e => pt(e.lat, e.lng, { title: e.title, severity: e.severity, url: e.url, source: e.source, category: e.category, magnitude: e.magnitude, date: e.date }));

  const layers = {
    hotspots: (feed.threats || []).map(t => pt(t.lat, t.lng, { title: t.title, severity: t.severity, category: t.category, location: t.location, reports: t.reports, india: (t.wires || []).includes('INDIA') })).filter(ok),
    conflict: geoByCat('conflict').filter(ok),
    fire: geoByCat('fire').filter(ok),
    quake: geoByCat('earthquakes').filter(ok),
    outages: geoByCat('outage').filter(ok),
    natural: geo.filter(e => !['conflict', 'fire', 'earthquakes', 'outage'].includes(e.categoryId))
      .map(e => pt(e.lat, e.lng, { title: e.title, severity: e.severity, url: e.url, source: e.source, category: e.category, magnitude: e.magnitude, date: e.date })).filter(ok),
    maritime: (mar.events || []).map(n => pt(n.lat, n.lng, { title: n.title, severity: n.severity, source: n.source, url: n.url, india: n.india, category: 'Maritime' })).filter(ok),
    aircraft: (sig.aircraft?.aircraft || []).map(a => pt(a.lat, a.lng, { title: a.callsign, tag: a.tag, mil: a.mil, severity: a.mil ? 'HIGH' : 'LOW', category: a.mil ? 'Military aircraft' : 'Aircraft' })).filter(ok).slice(0, 600),
    vessels: (aisSnapshot().vessels || []).map(v => pt(v.lat, v.lng, { title: v.name, tag: v.sog ? `${v.sog.toFixed(0)} kn` : '', severity: 'LOW', category: 'Vessel (AIS)', mmsi: v.mmsi })).filter(ok).slice(0, 2500),
    convergence: (conv.convergences || []).filter(c => c.lat != null && c.lng != null)
      .map(c => pt(c.lat, c.lng, { title: c.country, streams: c.streams, streamCount: c.streamCount, score: c.score, severity: c.streamCount >= 3 ? 'CRITICAL' : 'HIGH', category: 'Convergence' })),
  };

  const counts = Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, v.length]));
  return { updatedAt: feed.updatedAt, layers, counts, note: 'A unified view of every geolocated stream — observed reporting and sensor data, not a forecast.' };
}
