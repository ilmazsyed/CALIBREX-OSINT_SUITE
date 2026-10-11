// GEOINT / Earth Watch: open natural-event geospatial intelligence from two
// free, keyless, public feeds —
//   • NASA EONET (Earth Observatory Natural Event Tracker): wildfires, volcanoes,
//     severe storms, floods, landslides, dust, ice and more.
//   • USGS earthquakes (M4.5+, past 30 days): the global seismic record.
// Two independent sources means the screen stays populated even if one feed is
// briefly unreachable. Every event carries a source link back to the reporting
// agency. No private or restricted data.
const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 20000;
const REFRESH_MS = 10 * 60 * 1000;
const EONET = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=500';
const USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson';

// EONET category → severity weight (matches the app's bands).
const SEV_BY_CAT = {
  wildfires: 'HIGH', volcanoes: 'HIGH', severeStorms: 'HIGH', floods: 'HIGH',
  landslides: 'HIGH', earthquakes: 'CRITICAL', seaLakeIce: 'MEDIUM', drought: 'MEDIUM',
  dustHaze: 'MEDIUM', manmade: 'MEDIUM', snow: 'LOW', waterColor: 'LOW', tempExtremes: 'MEDIUM',
};

async function getJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

const INDIA = /\b(india|indian|delhi|mumbai|kashmir|assam|bengal|gujarat|kerala|tamil|andhra|odisha|bihar|punjab|rajasthan|himalaya|bay of bengal|arabian sea|nicobar|andaman)\b/i;

/** Flatten an EONET event to its most recent located point. */
export function eonetToEvent(ev) {
  const geoms = Array.isArray(ev.geometry) ? ev.geometry : [];
  const g = geoms[geoms.length - 1];
  if (!g || !g.coordinates) return null;
  let lng, lat;
  if (g.type === 'Point') { [lng, lat] = g.coordinates; }
  else { // Polygon / other — use the first vertex as a representative point
    let c = g.coordinates;
    while (Array.isArray(c[0])) c = c[0];
    [lng, lat] = c;
  }
  lat = Number(lat); lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const cat = ev.categories?.[0] || {};
  const title = String(ev.title || '').trim();
  if (!title) return null;
  return {
    id: `eonet:${ev.id}`,
    title,
    category: cat.title || 'Event',
    categoryId: cat.id || 'other',
    severity: SEV_BY_CAT[cat.id] || 'MEDIUM',
    lat, lng,
    date: Date.parse(g.date) || Date.now(),
    magnitude: g.magnitudeValue != null ? `${g.magnitudeValue} ${g.magnitudeUnit || ''}`.trim() : null,
    url: ev.sources?.[0]?.url || ev.link || '',
    source: ev.sources?.[0]?.id || 'EONET',
    india: INDIA.test(title),
  };
}

/** Severity band for an earthquake by magnitude. */
function quakeSeverity(mag) {
  if (mag >= 6) return 'CRITICAL';
  if (mag >= 5) return 'HIGH';
  if (mag >= 4) return 'MEDIUM';
  return 'LOW';
}

/** Flatten a USGS GeoJSON earthquake feature to the same event shape. */
export function usgsToEvent(f) {
  const p = f?.properties || {};
  const coords = f?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]); const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const mag = Number(p.mag);
  const place = String(p.place || '').trim();
  const title = String(p.title || (place ? `M ${p.mag} — ${place}` : `M ${p.mag} earthquake`)).trim();
  return {
    id: `usgs:${f.id}`,
    title,
    category: 'Earthquakes',
    categoryId: 'earthquakes',
    severity: Number.isFinite(mag) ? quakeSeverity(mag) : 'MEDIUM',
    lat, lng,
    date: Number(p.time) || Date.now(),
    magnitude: Number.isFinite(mag) ? `M${mag.toFixed(1)}` : null,
    url: p.url || '',
    source: 'USGS',
    india: INDIA.test(place) || INDIA.test(title),
  };
}

/** Merge events from several sources, drop dupes by id, newest first. */
export function mergeEvents(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const e of (list || [])) {
      if (!e || seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  }
  return out.sort((a, b) => b.date - a.date);
}

let state = { updatedAt: 0, refreshing: false, events: [], sources: { eonet: { ok: false }, usgs: { ok: false } } };
const listeners = new Set();
export function onGeointRefresh(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function refreshGeoint() {
  state.refreshing = true;
  const [eo, us] = await Promise.allSettled([getJson(EONET), getJson(USGS)]);

  const sources = { eonet: { ok: false }, usgs: { ok: false } };
  let eonetEvents = [];
  let usgsEvents = [];

  if (eo.status === 'fulfilled') {
    eonetEvents = (eo.value?.events || []).map(eonetToEvent).filter(Boolean);
    sources.eonet = { ok: true, count: eonetEvents.length };
  } else {
    sources.eonet = { ok: false, error: eo.reason?.message || 'failed' };
    console.error('[geoint] EONET refresh failed', sources.eonet.error);
  }

  if (us.status === 'fulfilled') {
    usgsEvents = (us.value?.features || []).map(usgsToEvent).filter(Boolean);
    sources.usgs = { ok: true, count: usgsEvents.length };
  } else {
    sources.usgs = { ok: false, error: us.reason?.message || 'failed' };
    console.error('[geoint] USGS refresh failed', sources.usgs.error);
  }

  const events = mergeEvents(eonetEvents, usgsEvents);
  // Keep the previous events if both feeds failed this cycle, so the screen
  // doesn't flip to empty on a transient outage.
  if (events.length === 0 && !sources.eonet.ok && !sources.usgs.ok) {
    state = { ...state, refreshing: false, sources };
  } else {
    state = { updatedAt: Date.now(), refreshing: false, events, sources };
  }
  for (const fn of listeners) { try { fn(state); } catch { /* ignore */ } }
  return state;
}

export function startGeointLoop() {
  refreshGeoint();
  setInterval(refreshGeoint, REFRESH_MS);
}

export function geointSnapshot() {
  const byCategory = {};
  for (const e of state.events) byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  return { updatedAt: state.updatedAt, refreshing: state.refreshing, events: state.events, byCategory, sources: state.sources };
}
