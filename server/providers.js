// JSON/API feed providers. Each returns normalised feed items (via toItems),
// so they flow through the map, wires, watchlists, verify and visual-intel
// like any other source. All sources are free and keyless.
import { toItems } from './feeds.js';

const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0; +https://github.com/ilmazsyed/CALIBREX-OSINT_SUITE)';
const TIMEOUT = 20000;

async function getJson(url, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

// ---------------------------------------------------------------- Reddit chatter

// Public subreddits to watch. Reddit is social chatter: flagged unverified.
export const REDDIT_SUBS = [
  { sub: 'worldnews', wire: 'REGIONAL' },
  { sub: 'news', wire: 'REGIONAL' },
  { sub: 'geopolitics', wire: 'GLOBAL_AXIS' },
  { sub: 'CredibleDefense', wire: 'GLOBAL_AXIS' },
  { sub: 'LessCredibleDefence', wire: 'GLOBAL_AXIS' },
  { sub: 'worldevents', wire: 'REGIONAL' },
  { sub: 'cybersecurity', wire: 'CYBER' },
  { sub: 'Economics', wire: 'FATF' },
  { sub: 'OSINT', wire: 'REGIONAL' },
];

/** Turn a subreddit's new.json listing into raw feed entries. */
export function redditEntries(json, sub) {
  return (json?.data?.children || [])
    .map(c => c.data)
    .filter(d => d && d.title && !d.stickied)
    .map(d => ({
      title: `r/${sub}: ${d.title}`,
      link: `https://www.reddit.com${d.permalink}`,
      date: new Date((d.created_utc || 0) * 1000).toUTCString(),
      summary: String(d.selftext || '').slice(0, 600),
    }));
}
async function pullReddit() {
  const out = [];
  for (const { sub, wire } of REDDIT_SUBS) {
    try {
      const json = await getJson(`https://www.reddit.com/r/${encodeURIComponent(sub)}/new.json?limit=25&raw_json=1`);
      out.push(...toItems(redditEntries(json, sub), { outlet: `Reddit r/${sub}`, kind: 'social', sourceId: 'reddit', fallbackWire: wire }));
    } catch { /* one sub failing does not sink the rest */ }
  }
  return out;
}

// ---------------------------------------------------------------- ransomware / leak-site tracker

/** ransomware.live recent victims → feed entries. Clear-web view of dark-web leak posts. */
export function ransomwareEntries(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter(r => r && (r.victim || r.post_title))
    .map(r => {
      const group = r.group_name || r.group || 'unknown group';
      const victim = r.victim || r.post_title;
      const when = r.discovered || r.published || r.attackdate || '';
      return {
        title: `Ransomware leak: ${group} names ${victim}`,
        link: r.url || r.screenshot || (r.website ? `https://${String(r.website).replace(/^https?:\/\//, '')}` : `https://www.ransomware.live/#/group/${encodeURIComponent(String(group).toLowerCase())}`),
        date: when ? new Date(when.replace(' ', 'T') + (/[zZ]|\+/.test(when) ? '' : 'Z')).toUTCString() : new Date().toUTCString(),
        summary: `${group} added ${victim} to its dark-web leak site${r.activity ? ` (${r.activity})` : ''}${r.country ? `. Country: ${r.country}` : ''}.`,
      };
    });
}
async function pullRansomware() {
  const rows = await getJson('https://api.ransomware.live/recentvictims');
  return toItems(ransomwareEntries(rows), { outlet: 'ransomware.live', kind: 'analysis', sourceId: 'ransomware', wire: 'CYBER' });
}

// ---------------------------------------------------------------- CISA Known Exploited Vulnerabilities

/** Recent additions to CISA's Known Exploited Vulnerabilities catalog → entries. */
export function kevEntries(json, sinceDays = 21) {
  const cutoff = Date.now() - sinceDays * 86400000;
  return (json?.vulnerabilities || [])
    .filter(v => v.dateAdded && Date.parse(v.dateAdded) >= cutoff)
    .map(v => ({
      title: `KEV: ${v.cveID} — ${v.vendorProject} ${v.product} actively exploited`,
      link: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(v.cveID)}`,
      date: new Date(v.dateAdded).toUTCString(),
      summary: `${v.vulnerabilityName || ''}. ${v.shortDescription || ''} Action due ${v.dueDate || 'n/a'}.`.trim(),
    }));
}
async function pullKev() {
  const json = await getJson('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
  return toItems(kevEntries(json), { outlet: 'CISA KEV', kind: 'official', sourceId: 'cisa-kev', wire: 'CYBER' });
}

// ---------------------------------------------------------------- GDELT global media

const GDELT_QUERY = '(clash OR airstrike OR "drone strike" OR militants OR insurgency OR coup OR mobilization OR "border tension" OR missile OR ceasefire OR sanctions)';
/** GDELT DOC 2.0 artlist → entries (global media firehose, filtered to security themes). */
export function gdeltEntries(json) {
  return (json?.articles || [])
    .filter(a => a.title && a.url)
    .map(a => ({
      title: a.title,
      link: a.url,
      date: a.seendate ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}T${a.seendate.slice(9, 11)}:${a.seendate.slice(11, 13)}:00Z` : new Date().toUTCString(),
      source: a.domain,
      summary: '',
    }));
}
let gdeltProviderFailures = 0;
let gdeltProviderRetryAfter = 0;
export function gdeltProviderBackoffMs(failures = 1) {
  return Math.min(30 * 60 * 1000, 5 * 60 * 1000 * (2 ** Math.max(0, failures - 1)));
}
async function pullGdelt() {
  if (Date.now() < gdeltProviderRetryAfter) throw new Error('HTTP 429 (GDELT circuit open; retry deferred)');
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(GDELT_QUERY)}&mode=artlist&maxrecords=60&sort=datedesc&timespan=1d&format=json`;
  try {
    const items = toItems(gdeltEntries(await getJson(url)), { kind: 'news', sourceId: 'gdelt', fallbackWire: 'GLOBAL_AXIS' });
    gdeltProviderFailures = 0;
    gdeltProviderRetryAfter = 0;
    return items;
  } catch (error) {
    const message = String(error?.message || error);
    if (/429|HTTP 5\d\d/i.test(message)) {
      gdeltProviderFailures += 1;
      gdeltProviderRetryAfter = Date.now() + gdeltProviderBackoffMs(gdeltProviderFailures);
    }
    throw error;
  }
}


/* ---------------------------------------------------------------- public social search: Bluesky
 * Public search endpoint; no bearer token or user account required.
 * Posts are discovery leads, not verified reporting.
 */
export function blueskyEntries(json) {
  return (json?.posts || []).filter(post => post?.record?.text && post?.uri).map(post => {
    const handle = post.author?.handle || 'unknown';
    const rkey = String(post.uri).split('/').pop();
    return {
      title: post.record.text,
      link: `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${encodeURIComponent(rkey)}`,
      date: post.indexedAt || post.record.createdAt,
      source: `Bluesky @${handle}`,
      authorId: handle,
      summary: post.record.text,
      metrics: { likes: Number(post.likeCount || 0), reposts: Number(post.repostCount || 0), replies: Number(post.replyCount || 0) },
    };
  });
}
async function pullBluesky() {
  const queries = ['geopolitics', 'cybersecurity', 'South Asia'];
  const settled = await Promise.allSettled(queries.map(q =>
    getJson(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=20&sort=latest`)
  ));
  const entries = [];
  let responded = 0;
  for (const result of settled) {
    if (result.status === 'fulfilled') { responded++; entries.push(...blueskyEntries(result.value)); }
  }
  if (!responded) throw new Error('Bluesky public search unavailable');
  const seen = new Set();
  return toItems(entries.filter(e => !seen.has(e.link) && seen.add(e.link)), {
    outlet: 'Bluesky public search', kind: 'social', sourceId: 'bluesky-public', fallbackWire: 'GEOPOLITICS',
  });
}

/* ---------------------------------------------------------------- geospatial: NASA EONET
 * NASA's open Earth Observatory Natural Event Tracker API.
 */
export function eonetEntries(json) {
  return (json?.events || []).flatMap(event => {
    const geometry = [...(event.geometry || [])].reverse().find(g => Array.isArray(g?.coordinates));
    const coordinates = geometry?.coordinates;
    const point = Array.isArray(coordinates) && coordinates.length >= 2 && Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]))
      ? `Coordinates: ${Number(coordinates[1]).toFixed(3)}, ${Number(coordinates[0]).toFixed(3)}` : '';
    const categories = (event.categories || []).map(c => c.title).filter(Boolean).join(', ');
    return [{
      title: `NASA EONET: ${event.title || 'Unclassified natural event'}`,
      link: event.link || `https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(event.id || '')}`,
      date: geometry?.date || event.geometry?.[0]?.date || new Date().toISOString(),
      source: 'NASA EONET',
      summary: [categories, point, event.description || 'Open natural-event observation'].filter(Boolean).join(' · ').slice(0, 600),
    }];
  });
}
async function pullEonet() {
  const json = await getJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100');
  return toItems(eonetEntries(json), { outlet: 'NASA EONET', kind: 'official', sourceId: 'nasa-eonet', fallbackWire: 'REGIONAL' });
}

/* ---------------------------------------------------------------- mobility: OpenSky Network
 * Anonymous state-vector access is rate-limited and may be unavailable.
 * This adapter is intentionally restricted to a South Asia bounding box and
 * caps emitted records; it is not a substitute for licensed flight tracking.
 */
export function openSkyEntries(json, limit = 40) {
  const states = (json?.states || []).filter(row =>
    Array.isArray(row) && row.length >= 9 && Number.isFinite(Number(row[5])) &&
    Number.isFinite(Number(row[6])) && row[8] !== true
  );
  return states.slice(0, Math.max(1, Math.min(100, limit))).map(row => {
    const icao = String(row[0] || '').toLowerCase();
    const callsign = String(row[1] || '').trim() || icao.toUpperCase();
    const country = String(row[2] || 'Unknown origin');
    const altitude = Number.isFinite(Number(row[7])) ? Math.round(Number(row[7])) : null;
    const speed = Number.isFinite(Number(row[9])) ? Math.round(Number(row[9])) : null;
    return {
      title: `OpenSky aircraft ${callsign} airborne — origin ${country}`,
      link: `https://opensky-network.org/aircraft-profile?icao24=${encodeURIComponent(icao)}`,
      date: row[4] ? new Date(Number(row[4]) * 1000).toISOString() : new Date().toISOString(),
      source: 'OpenSky Network',
      summary: [`Position ${Number(row[6]).toFixed(3)}, ${Number(row[5]).toFixed(3)}`, altitude == null ? '' : `barometric altitude ${altitude} m`, speed == null ? '' : `ground speed ${speed} m/s`].filter(Boolean).join(' · '),
    };
  });
}
async function pullOpenSky() {
  const url = 'https://opensky-network.org/api/states/all?lamin=5&lomin=60&lamax=38&lomax=100';
  const json = await getJson(url);
  return toItems(openSkyEntries(json), { outlet: 'OpenSky Network · South Asia snapshot', kind: 'analysis', sourceId: 'opensky-south-asia', fallbackWire: 'LOGISTICS_SUPPLY_CHAIN' });
}

/* ---------------------------------------------------------------- economic: World Bank Open Data
 * Public indicators; no API key. Values are attributed to country and year.
 */
export function worldBankEntries(payloads) {
  const entries = [];
  for (const [indicator, label] of [['NY.GDP.MKTP.KD.ZG', 'GDP growth'], ['FP.CPI.TOTL.ZG', 'consumer price inflation']]) {
    const payload = payloads?.[indicator];
    const rows = Array.isArray(payload?.[1]) ? payload[1] : [];
    const latest = new Map();
    for (const row of rows) {
      const value = Number(row?.value);
      const country = row?.country?.value;
      const code = row?.countryiso3code;
      if (!country || !code || !Number.isFinite(value) || !/^\\d{4}$/.test(String(row.date || ''))) continue;
      const previous = latest.get(code);
      if (!previous || Number(row.date) > Number(previous.date)) latest.set(code, row);
    }
    for (const row of latest.values()) {
      const value = Number(row.value);
      entries.push({
        title: `World Bank ${label}: ${row.country.value} ${value.toFixed(2)}% in ${row.date}`,
        link: `https://api.worldbank.org/v2/country/${encodeURIComponent(row.countryiso3code)}/indicator/${indicator}?format=json`,
        date: `${row.date}-12-31T00:00:00Z`,
        source: 'World Bank Open Data',
        summary: `${label} reported at ${value.toFixed(2)} percent for ${row.country.value} in ${row.date}. Annual indicator; publication may lag the current date.`,
      });
    }
  }
  return entries;
}
async function pullWorldBank() {
  const indicators = ['NY.GDP.MKTP.KD.ZG', 'FP.CPI.TOTL.ZG'];
  const payloads = {};
  const settled = await Promise.allSettled(indicators.map(async indicator => {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&date=2021:2025&per_page=2000`;
    payloads[indicator] = await getJson(url);
  }));
  if (!settled.some(result => result.status === 'fulfilled')) throw new Error('World Bank indicators unavailable');
  return toItems(worldBankEntries(payloads), { outlet: 'World Bank Open Data', kind: 'official', sourceId: 'world-bank-open-data', fallbackWire: 'BUSINESS' });
}

// ---------------------------------------------------------------- registration

export const PROVIDERS = [
  { id: 'reddit', name: 'Reddit chatter', group: 'Chatter & deep web', kind: 'social', run: pullReddit },
  { id: 'ransomware', name: 'Ransomware leak sites', group: 'Chatter & deep web', kind: 'analysis', run: pullRansomware },
  { id: 'cisa-kev', name: 'CISA exploited vulnerabilities', group: 'Cyber', kind: 'official', run: pullKev },
  { id: 'gdelt', name: 'GDELT global media', group: 'OSINT & analysis', kind: 'news', run: pullGdelt },
  { id: 'bluesky-public', name: 'Bluesky public social search', group: 'OSINT social accounts', kind: 'social', layer: 'social', region: 'Global / multilateral', coverage: 'multi-region', accessModel: 'public unauthenticated API', licence: 'provider terms review required', run: pullBluesky },
  { id: 'nasa-eonet', name: 'NASA Earth Observatory events', group: 'Hazards', kind: 'official', layer: 'geospatial', region: 'Global / multilateral', coverage: 'multi-region', accessModel: 'public unauthenticated API', licence: 'NASA data policy review required', run: pullEonet },
  { id: 'opensky-south-asia', name: 'OpenSky South Asia aircraft snapshot', group: 'Maritime', kind: 'analysis', layer: 'mobility', region: 'South Asia', coverage: 'regional', accessModel: 'public rate-limited API', licence: 'OpenSky terms review required', run: pullOpenSky },
  { id: 'world-bank-open-data', name: 'World Bank macroeconomic indicators', group: 'Business & power', kind: 'official', layer: 'economic', region: 'Global / multilateral', coverage: 'multi-region', accessModel: 'public unauthenticated API', licence: 'World Bank data terms review required', run: pullWorldBank },
];
