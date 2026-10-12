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

async function getText(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}

const INDIA = /\b(india|indian|delhi|mumbai|kashmir|assam|bengal|gujarat|kerala|tamil|andhra|odisha|bihar|punjab|rajasthan|himalaya|bay of bengal|arabian sea|nicobar|andaman)\b/i;

// ---- UCDP Georeferenced Event Dataset (armed-conflict events). Keyless public
// API. Cadence is monthly (the "candidate" version), so this is the structural
// conflict-event layer, not a real-time feed. Version is overridable because
// UCDP bumps it periodically; a stale version just 404s and is kept last-good.
const UCDP_VERSION = process.env.UCDP_VERSION || '24.1';
const UCDP = `https://ucdpapi.pcr.uu.se/api/gedevents/${UCDP_VERSION}?pagesize=1000`;

/** Flatten a UCDP GED record to the common event shape. */
export function ucdpToEvent(r) {
  const lat = Number(r.latitude), lng = Number(r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const deaths = Number(r.best) || 0;
  const a = String(r.side_a || '').trim(), b = String(r.side_b || '').trim();
  const who = a && b ? `${a} vs ${b}` : (a || b || r.conflict_name || 'Armed conflict');
  const title = `${who}${r.country ? ` — ${r.country}` : ''}${deaths ? ` (${deaths} killed)` : ''}`.slice(0, 150);
  return {
    id: `ucdp:${r.id}`,
    title,
    category: 'Armed conflict', categoryId: 'conflict',
    severity: deaths >= 25 ? 'CRITICAL' : deaths >= 5 ? 'HIGH' : deaths >= 1 ? 'MEDIUM' : 'LOW',
    lat, lng,
    date: Date.parse(r.date_end) || Date.parse(r.date_start) || Date.now(),
    magnitude: deaths ? `${deaths} killed` : null,
    url: 'https://ucdp.uu.se/',
    source: 'UCDP GED',
    india: INDIA.test(r.country || '') || INDIA.test(r.where_description || ''),
  };
}

// ---- NASA FIRMS active-fire detections (VIIRS, ~3h latency). Needs a free
// MAP_KEY (NASA_FIRMS_KEY). AOI bbox (W,S,E,N) and day count are overridable;
// default covers Africa/Europe/MENA/Asia — Calibrex's focus — to keep the CSV
// light. Capped to the strongest detections by fire radiative power.
const FIRMS_KEY = () => process.env.NASA_FIRMS_KEY || '';
const FIRMS_BBOX = process.env.FIRMS_BBOX || '-20,-40,150,60';
const FIRMS_DAYS = process.env.FIRMS_DAYS || '1';
const FIRMS_PRODUCT = process.env.FIRMS_PRODUCT || 'VIIRS_SNPP_NRT';
const firmsUrl = () => `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY()}/${FIRMS_PRODUCT}/${FIRMS_BBOX}/${FIRMS_DAYS}`;

/** Parse a FIRMS area CSV into fire events (keeps nominal/high confidence). */
export function firmsCsvToEvents(csv, cap = 1200) {
  const lines = String(csv || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(',').map(h => h.trim().toLowerCase());
  const ix = name => head.indexOf(name);
  const iLat = ix('latitude'), iLng = ix('longitude'), iFrp = ix('frp'), iConf = ix('confidence');
  const iDate = ix('acq_date'), iTime = ix('acq_time'), iSat = ix('satellite'), iDn = ix('daynight');
  if (iLat < 0 || iLng < 0) return [];
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const lat = Number(c[iLat]), lng = Number(c[iLng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const conf = iConf >= 0 ? String(c[iConf] || '').trim().toLowerCase() : 'n';
    if (conf === 'l' || conf === 'low') continue;               // drop low-confidence noise
    const frp = iFrp >= 0 ? Number(c[iFrp]) || 0 : 0;
    const acqDate = iDate >= 0 ? c[iDate] : '';
    const acqTime = iTime >= 0 ? String(c[iTime] || '').padStart(4, '0') : '0000';
    const when = acqDate ? Date.parse(`${acqDate}T${acqTime.slice(0, 2)}:${acqTime.slice(2)}:00Z`) : Date.now();
    out.push({
      id: `firms:${lat.toFixed(3)},${lng.toFixed(3)}:${acqDate}${acqTime}`,
      title: `Active fire — FRP ${frp.toFixed(0)} MW${iDn >= 0 && c[iDn] ? ` (${c[iDn] === 'D' ? 'day' : 'night'})` : ''}`,
      category: 'Active fire', categoryId: 'fire',
      severity: frp >= 100 ? 'HIGH' : frp >= 20 ? 'MEDIUM' : 'LOW',
      lat, lng,
      date: Number.isFinite(when) ? when : Date.now(),
      magnitude: `${frp.toFixed(0)} MW`,
      url: 'https://firms.modaps.eosdis.nasa.gov/map/',
      source: iSat >= 0 && c[iSat] ? `NASA FIRMS (${c[iSat]})` : 'NASA FIRMS',
      india: false,
    });
  }
  return out.sort((a, b) => (parseFloat(b.magnitude) || 0) - (parseFloat(a.magnitude) || 0)).slice(0, cap);
}

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

let state = { updatedAt: 0, refreshing: false, events: [], sources: { eonet: { ok: false }, usgs: { ok: false }, conflict: { ok: false }, fire: { ok: false } } };
const listeners = new Set();
export function onGeointRefresh(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Per-layer last-good cache, so one failing source never blanks the others.
const layerCache = { eonet: [], usgs: [], conflict: [], fire: [] };

export async function refreshGeoint() {
  state.refreshing = true;
  const firmsOn = !!FIRMS_KEY();
  const [eo, us, uc, fi] = await Promise.allSettled([
    getJson(EONET),
    getJson(USGS),
    getJson(UCDP),
    firmsOn ? getText(firmsUrl()) : Promise.reject(new Error('no key')),
  ]);

  const sources = {};
  const take = (res, map, key, label) => {
    if (res.status === 'fulfilled') {
      const evs = map(res.value);
      if (evs.length) layerCache[key] = evs;                 // never-wipe: replace only on data
      sources[key] = { ok: true, count: (evs.length ? evs : layerCache[key]).length, state: evs.length ? 'ok' : 'cached' };
    } else {
      const err = res.reason?.message || 'failed';
      sources[key] = { ok: layerCache[key].length > 0, count: layerCache[key].length, state: layerCache[key].length ? 'cached' : 'error', error: err };
      if (label !== 'FIRMS (no key)') console.error(`[geoint] ${label} refresh failed`, err);
    }
  };
  take(eo, v => (v?.events || []).map(eonetToEvent).filter(Boolean), 'eonet', 'EONET');
  take(us, v => (v?.features || []).map(usgsToEvent).filter(Boolean), 'usgs', 'USGS');
  take(uc, v => (v?.Result || v?.result || []).map(ucdpToEvent).filter(Boolean), 'conflict', 'UCDP');
  take(fi, v => firmsCsvToEvents(v), 'fire', firmsOn ? 'FIRMS' : 'FIRMS (no key)');

  const events = mergeEvents(layerCache.eonet, layerCache.usgs, layerCache.conflict, layerCache.fire);
  if (events.length === 0) state = { ...state, refreshing: false, sources };   // keep prior if everything is empty
  else state = { updatedAt: Date.now(), refreshing: false, events, sources };
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
