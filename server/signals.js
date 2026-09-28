// Signals: public telemetry layers that aren't news-shaped.
//   - Aircraft: ADS-B transponder positions (OpenSky Network, keyless, rate-limited)
//   - Space weather: NOAA SWPC planetary K-index and alerts (affects GPS/HF radio)
//   - Trending: most-read English Wikipedia articles yesterday (public attention)
// These are OPEN, legally broadcast transponders and public metrics — not the
// interception of any private, cellular or protected communication.
const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 20000;
const REFRESH_MS = 5 * 60 * 1000;

async function getJson(url, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

// ---------------------------------------------------------------- aircraft (ADS-B / adsb.lol)

// OpenSky removed anonymous access (OAuth2-only, tiny credit quota, blocks
// datacenter IPs), so we use adsb.lol — free, keyless, ODbL — which works from
// cloud servers and also exposes a global military-aircraft feed.
const EMERGENCY = { 7500: 'hijack', 7600: 'radio failure', 7700: 'general emergency' };
const KT_TO_MS = 0.514444;
const FT_TO_M = 0.3048;

// Regional coverage: point queries (max 250nm radius each) over the dense hubs.
const AIR_POINTS = [
  { lat: 28.6, lon: 77.2, r: 250 }, // Delhi — N India / Pakistan
  { lat: 25.2, lon: 55.3, r: 250 }, // Dubai — the Gulf
  { lat: 33.3, lon: 44.4, r: 250 }, // Baghdad — the Levant / Iraq
];

/** Parse an adsb.lol v2 response (`ac` array, readsb fields) into aircraft rows. */
export function parseAdsb(json, { mil = false } = {}) {
  const out = [];
  for (const a of json?.ac || json?.aircraft || []) {
    if (a.lat == null || a.lon == null) continue; // Number(null) is 0 — guard first
    const lat = Number(a.lat), lng = Number(a.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (a.alt_baro === 'ground') continue; // on the ground
    const alt = Number(a.alt_baro ?? a.alt_geom);
    const gs = Number(a.gs);
    const track = Number(a.track ?? a.true_heading);
    const squawk = parseInt(a.squawk, 10);
    const emergency = EMERGENCY[squawk] || (a.emergency && a.emergency !== 'none' ? String(a.emergency) : null);
    out.push({
      id: String(a.hex || a.r || `${lat},${lng}`).trim(),
      callsign: String(a.flight || a.r || '').trim() || '—',
      tag: mil ? 'MIL' : (a.t ? String(a.t) : (a.r ? String(a.r) : '')), // type code or registration
      mil,
      lat, lng,
      altM: Number.isFinite(alt) ? Math.round(alt * FT_TO_M) : null,
      speedMs: Number.isFinite(gs) ? Math.round(gs * KT_TO_MS) : null,
      heading: Number.isFinite(track) ? Math.round(track) : null,
      emergency,
    });
  }
  return out;
}

/** Merge rows from several queries, de-duplicate by hex, emergencies & military first. */
export function mergeAircraft(lists, max = 250) {
  const byId = new Map();
  for (const row of lists.flat()) {
    const prev = byId.get(row.id);
    // Keep the military-flagged copy if the same craft appears in both feeds.
    if (!prev || (row.mil && !prev.mil)) byId.set(row.id, prev ? { ...prev, mil: true, tag: 'MIL' } : row);
  }
  return [...byId.values()]
    .sort((a, b) => (b.emergency ? 1 : 0) - (a.emergency ? 1 : 0) || (b.mil ? 1 : 0) - (a.mil ? 1 : 0) || (b.altM || 0) - (a.altM || 0))
    .slice(0, max);
}

async function pullAircraft() {
  const points = await Promise.all(AIR_POINTS.map(p =>
    getJson(`https://api.adsb.lol/v2/point/${p.lat}/${p.lon}/${p.r}`).then(j => parseAdsb(j)).catch(() => [])));
  const mil = await getJson('https://api.adsb.lol/v2/mil').then(j => parseAdsb(j, { mil: true })).catch(() => []);
  const aircraft = mergeAircraft([...points, mil]);
  if (aircraft.length === 0 && mil.length === 0 && points.every(p => p.length === 0)) throw new Error('No ADS-B data this cycle.');
  return { region: 'South Asia · Gulf · Middle East (+ global military)', aircraft, at: Date.now(), military: aircraft.filter(a => a.mil).length };
}

// ---------------------------------------------------------------- space weather (NOAA SWPC)

/** Latest planetary K-index (geomagnetic activity, 0–9) from the SWPC product. */
export function parseKp(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const last = rows[rows.length - 1];
  const kp = parseFloat(last[1]);
  if (!Number.isFinite(kp)) return null;
  const level = kp >= 8 ? 'G4+ severe storm' : kp >= 7 ? 'G3 strong storm' : kp >= 6 ? 'G2 moderate storm' : kp >= 5 ? 'G1 minor storm' : 'quiet';
  return { kp, level, time: last[0] };
}
/** Recent SWPC alerts (warnings/watches), newest first. */
export function parseSwpcAlerts(rows, sinceDays = 3) {
  const cutoff = Date.now() - sinceDays * 86400000;
  return (Array.isArray(rows) ? rows : [])
    .map(a => {
      const msg = String(a.message || '');
      const head = msg.split('\n').map(l => l.trim()).find(l => /^(WARNING|WATCH|ALERT|SUMMARY|EXTENDED)/i.test(l)) || msg.split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
      return { at: Date.parse(a.issue_datetime + 'Z') || Date.parse(a.issue_datetime) || 0, head: head.slice(0, 160) };
    })
    .filter(a => a.at >= cutoff && a.head)
    .sort((a, b) => b.at - a.at)
    .slice(0, 12);
}
async function pullSpace() {
  const [kpRows, alerts] = await Promise.all([
    getJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json').catch(() => []),
    getJson('https://services.swpc.noaa.gov/products/alerts.json').catch(() => []),
  ]);
  return { kp: parseKp(kpRows), alerts: parseSwpcAlerts(alerts) };
}

// ---------------------------------------------------------------- Wikipedia trending

const WIKI_SKIP = /^(Main_Page|Special:|Wikipedia:|Portal:|Help:|Category:|Template:|-)/;
/** Most-read English Wikipedia articles for a day, minus perennial/utility pages. */
export function parseWikiTop(json, max = 25) {
  const arts = json?.items?.[0]?.articles || [];
  return arts.filter(a => a.article && !WIKI_SKIP.test(a.article))
    .slice(0, max)
    .map(a => ({ title: a.article.replace(/_/g, ' '), views: a.views, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(a.article)}` }));
}
async function pullWiki() {
  const d = new Date(Date.now() - 36 * 3600000); // yesterday (UTC, with margin for publish lag)
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
  return { date: url.slice(-10), top: parseWikiTop(await getJson(url)) };
}

// ---------------------------------------------------------------- orchestration

const state = { updatedAt: null, refreshing: false, aircraft: { region: '', aircraft: [], at: null }, space: { kp: null, alerts: [] }, wiki: { date: null, top: [] }, sources: {} };

export async function refreshSignals() {
  if (state.refreshing) return;
  state.refreshing = true;
  const note = (id, ok, error) => { state.sources[id] = { ok, error: error || null, at: Date.now() }; };
  try {
    try { state.aircraft = await pullAircraft(); note('aircraft', true); } catch (e) { note('aircraft', false, e.message); }
    try { state.space = await pullSpace(); note('space', true); } catch (e) { note('space', false, e.message); }
    try { state.wiki = await pullWiki(); note('wiki', true); } catch (e) { note('wiki', false, e.message); }
    state.updatedAt = Date.now();
  } finally { state.refreshing = false; }
}

async function loadFixture(file) {
  const fs = await import('fs');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(state, d, { updatedAt: Date.now(), sources: { fixture: { ok: true, error: null, at: Date.now() } } });
}

export function startSignalsLoop() {
  if (process.env.SIGNALS_FIXTURE) { loadFixture(process.env.SIGNALS_FIXTURE).catch(e => console.error('[signals] fixture', e)); return; }
  refreshSignals().catch(e => console.error('[signals] refresh failed', e));
  setInterval(() => refreshSignals().catch(e => console.error('[signals] refresh failed', e)), REFRESH_MS).unref();
}

export function signalsSnapshot() {
  return { updatedAt: state.updatedAt, refreshing: state.refreshing, aircraft: state.aircraft, space: state.space, wiki: state.wiki, sources: state.sources };
}
