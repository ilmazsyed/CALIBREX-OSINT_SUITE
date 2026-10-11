// Conflict Watch: geolocated conflict / unrest density from GDELT's open GEO
// 2.0 API (keyless). GDELT geocodes locations mentioned in global news in the
// last days; we focus the query on conflict, unrest and kinetic terms and plot
// the hottest locations. Observed reporting volume per place — not casualty
// counts, not a forecast.
const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 25000;
const REFRESH_MS = 30 * 60 * 1000;
// GDELT GEO's query parser is simpler than the DOC API's — keep the boolean
// short or it returns nothing. A compact conflict theme works reliably.
const QUERY = '(clashes OR militants OR airstrike OR shelling OR insurgents OR unrest)';
const URL = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(QUERY)}&format=GeoJSON&timespan=3d`;

const INDIA = /\bindia|kashmir|manipur|delhi|mumbai|bengal|assam|chhattisgarh|jharkhand|punjab\b/i;

async function getJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

const firstUrl = html => { const m = String(html || '').match(/href=["']?(https?:\/\/[^"'\s>]+)/i); return m ? m[1] : ''; };

/** Flatten a GDELT GEO GeoJSON feature to a located conflict point. */
export function toConflict(f) {
  const c = f?.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]), lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const p = f.properties || {};
  const name = String(p.name || '').trim();
  const count = Number(p.count) || 1;
  // Volume tiers → the app's severity bands (relative, within this feed).
  const severity = count >= 50 ? 'CRITICAL' : count >= 20 ? 'HIGH' : count >= 8 ? 'MEDIUM' : 'LOW';
  return {
    id: `${name}:${lat.toFixed(2)},${lng.toFixed(2)}`,
    title: name || 'Conflict activity',
    category: 'Conflict',
    categoryId: 'conflict',
    severity,
    lat, lng,
    date: Date.now(),
    magnitude: `${count} report${count === 1 ? '' : 's'}`,
    url: firstUrl(p.html),
    source: 'GDELT',
    india: INDIA.test(name),
    count,
  };
}

let state = { updatedAt: 0, refreshing: false, events: [], sources: { gdelt: { ok: false } } };

export async function refreshConflict() {
  state.refreshing = true;
  try {
    const json = await getJson(URL);
    const events = (json?.features || []).map(toConflict).filter(Boolean).sort((a, b) => b.count - a.count).slice(0, 300);
    state = { updatedAt: Date.now(), refreshing: false, events, sources: { gdelt: { ok: true } } };
  } catch (e) {
    state = { ...state, refreshing: false, sources: { gdelt: { ok: false, error: e.message } } };
    console.error('[conflict] refresh failed', e.message);
  }
  return state;
}

export function startConflictLoop() {
  refreshConflict();
  setInterval(refreshConflict, REFRESH_MS);
}

export function conflictSnapshot() {
  return { updatedAt: state.updatedAt, refreshing: state.refreshing, events: state.events, sources: state.sources };
}
