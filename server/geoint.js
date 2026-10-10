// GEOINT / Earth Watch: open natural-event geospatial intelligence from NASA's
// EONET (Earth Observatory Natural Event Tracker) — wildfires, volcanoes, severe
// storms, floods, landslides, dust, ice and more. EONET is a free, keyless,
// public NASA API; every event carries a source link back to the reporting
// agency. No private or restricted data.
const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 20000;
const REFRESH_MS = 10 * 60 * 1000;
const EONET = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=500';

// Category → severity weight + display colour family (matches the app's bands).
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

const INDIA = /\b(india|indian|delhi|mumbai|kashmir|assam|bengal|gujarat|kerala|tamil|andhra|odisha|bihar|punjab|rajasthan|himalaya|bay of bengal|arabian sea)\b/i;

/** Flatten an EONET event to its most recent located point. */
function toEvent(ev) {
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
  return {
    id: ev.id,
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

let state = { updatedAt: 0, refreshing: false, events: [], sources: { eonet: { ok: false } } };
const listeners = new Set();
export function onGeointRefresh(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function refreshGeoint() {
  state.refreshing = true;
  try {
    const json = await getJson(EONET);
    const events = (json?.events || []).map(toEvent).filter(Boolean).sort((a, b) => b.date - a.date);
    state = { updatedAt: Date.now(), refreshing: false, events, sources: { eonet: { ok: true } } };
    for (const fn of listeners) { try { fn(state); } catch { /* ignore */ } }
  } catch (e) {
    state = { ...state, refreshing: false, sources: { eonet: { ok: false, error: e.message } } };
    console.error('[geoint] refresh failed', e.message);
  }
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
