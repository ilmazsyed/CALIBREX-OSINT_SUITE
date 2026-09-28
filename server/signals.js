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

// ---------------------------------------------------------------- aircraft (ADS-B / OpenSky)

// Default region of interest: South Asia, the Gulf and the Middle East.
const AIR_BBOX = { lamin: 5, lamax: 45, lomin: 40, lomax: 100 };
const EMERGENCY = { 7500: 'hijack', 7600: 'radio failure', 7700: 'general emergency' };

/** Parse an OpenSky /states/all response into aircraft rows. */
export function parseOpenSky(json, max = 250) {
  const out = [];
  for (const s of json?.states || []) {
    const [icao24, callsign, country, , , lng, lat, , onGround, velocity, heading, , , geoAlt, squawk] = s;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || onGround) continue;
    out.push({
      id: icao24,
      callsign: (callsign || '').trim() || '—',
      country: country || '',
      lat, lng,
      altM: Number.isFinite(geoAlt) ? Math.round(geoAlt) : null,
      speedMs: Number.isFinite(velocity) ? Math.round(velocity) : null,
      heading: Number.isFinite(heading) ? Math.round(heading) : null,
      emergency: EMERGENCY[squawk] || null,
    });
  }
  // Emergencies first, then by altitude, capped.
  return out.sort((a, b) => (b.emergency ? 1 : 0) - (a.emergency ? 1 : 0) || (b.altM || 0) - (a.altM || 0)).slice(0, max);
}
async function pullAircraft() {
  const { lamin, lamax, lomin, lomax } = AIR_BBOX;
  const json = await getJson(`https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`);
  return { region: 'South Asia · Gulf · Middle East', aircraft: parseOpenSky(json), at: (json?.time || 0) * 1000 || Date.now() };
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
