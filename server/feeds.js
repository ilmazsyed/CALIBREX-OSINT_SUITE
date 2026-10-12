// Live OSINT feed engine: fetches public feeds server-side, normalises them,
// rates severity by keywords, places them on the map, and clusters threats.
// No AI involved anywhere.
import { XMLParser } from 'fast-xml-parser';
import { parseHTML } from 'linkedom';
import { locate } from './geo.js';
import { BUILTIN_SOURCES, sourceUrl } from './sources.js';
import { feedItemMedia, telegramMedia, blueskyMedia } from './visuals.js';
import { assertPublicUrl } from './article.js';

const REFRESH_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20000;
// A realistic browser UA — Google News and many publishers rate-limit (503) or
// block (403) obvious bot user-agents, which was knocking out most wires.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

export const WIRES = {
  INDIA: { label: 'India Watch', category: 'KINETIC',
    query: '(India OR Kashmir OR "Jammu and Kashmir" OR Manipur OR Chhattisgarh OR Naxal OR Maoist OR "Line of Control" OR LAC OR "Indian Army" OR "Indian Air Force" OR "Indian Navy" OR BSF OR CRPF OR NIA) (attack OR terror OR militant OR blast OR encounter OR clash OR infiltration OR ambush OR killed OR insurgent OR IED OR "security forces" OR raid OR arrested OR "cross-border" OR drone)' },
  SATP: { label: 'South Asia Terrorism', category: 'KINETIC',
    query: '(militant OR terrorist OR insurgent OR IED OR encounter OR "suicide attack") (Kashmir OR Pakistan OR Afghanistan OR Balochistan OR Manipur OR Chhattisgarh OR Bangladesh OR "Khyber Pakhtunkhwa")' },
  FATF: { label: 'Terror Finance / FATF', category: 'FINANCIAL',
    query: '(FATF OR "terror financing" OR "terrorist financing" OR "money laundering" OR OFAC OR "sanctions designation" OR hawala OR "crypto seized")' },
  REGIONAL: { label: 'Regional Security', category: 'OSINT',
    query: '(clashes OR insurgency OR "armed group" OR ceasefire OR militia OR junta OR "security forces") (Africa OR "Middle East" OR Sahel OR Myanmar OR Sudan OR Yemen OR Syria OR Somalia OR Congo OR Haiti)' },
  GLOBAL_AXIS: { label: 'Global Power Axis', category: 'OSINT',
    query: '(Pentagon OR NATO OR PLA OR Kremlin OR "Chinese navy" OR "Russian military" OR "Taiwan Strait" OR "South China Sea") (military OR drills OR deployment OR warships OR sanctions)' },
  CYBER: { label: 'Cyber Threats', category: 'CYBER',
    query: '(cyberattack OR ransomware OR "zero-day" OR "data breach" OR "state-sponsored hackers" OR "CISA warns" OR APT)' },
  KINETIC: { label: 'Kinetic / War Room', category: 'KINETIC',
    query: '(missile OR "drone strike" OR airstrike OR shelling OR invasion OR "naval blockade" OR coup OR "ballistic missile")' },
  // Business & economic power: M&A, distressed companies, tycoons/oligarchs, money
  // markets and their impact on economies and geopolitics. Shown in its own
  // Business Watch screen, not on the kinetic threat map.
  BUSINESS: { label: 'Business Watch', category: 'FINANCIAL',
    query: '(merger OR acquisition OR takeover OR buyout OR bankruptcy OR insolvency OR "distressed debt" OR layoffs OR IPO OR tycoon OR billionaire OR oligarch OR conglomerate OR "central bank" OR "stock market" OR "bond market") (economy OR markets OR company OR corporate OR business)' },
  // Government decisions, orders, statements and public releases across policy,
  // polity, elections, governance, defence, trade, environment, foreign affairs,
  // law & order, energy and crisis. Shown on the Government dashboard, not the map.
  GOV: { label: 'Government', category: 'OSINT',
    query: '("executive order" OR ordinance OR decree OR "cabinet approves" OR "government announces" OR "policy decision" OR sanctions OR parliament OR "prime minister" OR president OR ministry) (government OR official OR cabinet OR ministry OR policy)' },
  // Elections, parties, leaders and political upheaval worldwide. Its own
  // Election & Politics dashboard, not the kinetic threat map.
  POLITICS: { label: 'Elections & Politics', category: 'OSINT',
    query: '(election OR "exit poll" OR "opinion poll" OR "approval rating" OR vote OR referendum OR coalition OR "no-confidence" OR defection OR "political crisis" OR "ruling party" OR opposition OR campaign OR landslide) (party OR leader OR president OR "prime minister" OR government OR poll)' },
};
export const WIRE_KEYS = Object.keys(WIRES);

export const googleNewsUrl = (query, window = '1d') =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${window}`)}&hl=en-US&gl=US&ceid=US:en`;
const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';
const GDACS_URL = 'https://www.gdacs.org/xml/rss.xml';

// ---------------------------------------------------------------- severity

const CRIT = /\b(suicide (?:attack|bomb\w*|blast)|bombing|blast|massacre|invasion|invades|coup|ballistic missile|mass shooting|beheaded|hostages?)\b/i;
const HIGH = /\b(kill(?:s|ed|ing)?|dead|deaths?|attack(?:s|ed)?|strikes?|shelling|drone|explosion|abduct(?:s|ed)?|ransomware|zero-day|breach|hijack\w*|gunmen|ambush\w*|actively exploited)\b/i;
const MED = /\b(clash(?:es)?|arrest(?:s|ed)?|raid(?:s)?|sanction(?:s|ed)?|militants?|terror\w*|seiz(?:e|ed|ure)|launder\w*|exploit\w*|vulnerab\w*|drills?|warships?|troops|military bases?|deploy\w*|protests?|unrest)\b/i;

export function rateSeverity(title) {
  const m = title.match(/(\d{1,4})\s+(?:\w+\s+){0,3}(?:killed|dead|die|died|deaths|people killed|soldiers|civilians)/i)
    || title.match(/kill(?:s|ed)\s+(?:at least\s+)?(\d{1,4})/i);
  const count = m ? parseInt(m[1], 10) : 0;
  if (count >= 10 || CRIT.test(title)) return 'CRITICAL';
  if (count > 0 || HIGH.test(title)) return 'HIGH';
  if (MED.test(title)) return 'MEDIUM';
  return 'LOW';
}

const WIRE_RULES = [
  // India first: India geography, forces and major cities take priority over the broader South Asia wire.
  ['INDIA', /\b(Kashmir|Jammu|J&K|LoC|Line of Control|LAC|Galwan|Pahalgam|Pulwama|Srinagar|Pampore|Baramulla|Anantnag|Manipur|Chhattisgarh|Jharkhand|Naxal\w*|Maoist\w*|ULFA|BSF|CRPF|CISF|NIA|Indian Army|Indian Air Force|Indian Navy|New Delhi|Mumbai|Bengaluru|Kolkata|Hyderabad|Arunachal|Operation Sindoor)\b/i],
  ['CYBER', /\b(cyber\w*|ransomware|malware|hack(?:er|ers|ed|ing)?|zero-day|breach|phishing|botnet|APT\d*|CVE-\d+)\b/i],
  ['FATF', /\b(FATF|launder\w*|terror(?:ist)? financ\w*|sanction\w*|OFAC|hawala|illicit finance)\b/i],
  ['SATP', /\b(Kashmir|Jammu|J&K|LoC|Line of Control|Pakistan|Afghanistan|Balochistan|Manipur|Chhattisgarh|Bangladesh|Khyber|Waziristan|Taliban|TTP|BLA|Naxal\w*|Maoist\w*|ULFA|Lashkar|Jaish|Hizbul|NIA|infiltrat\w*|encounter|militan\w*|Operation Sindoor)\b/i],
  ['KINETIC', /\b(missile|airstrike|air strike|drone strike|shelling|invasion|blockade|coup|bombard\w*|rocket)\b/i],
  ['GLOBAL_AXIS', /\b(NATO|Pentagon|Kremlin|PLA|Taiwan|South China Sea|warships?|nuclear|military drills?)\b/i],
  ['REGIONAL', /\b(clash\w*|insurgen\w*|militia|junta|armed group|ceasefire|rebels?|security forces|attack\w*|killed)\b/i],
  // Non-kinetic wires last, so a threat story is never pulled into them. These
  // let the reliable direct feeds (BBC, The Hindu, ToI, …) fill the Business,
  // Government and Politics dashboards by keyword, independent of Google News /
  // GDELT search availability.
  ['POLITICS', /\b(election\w*|exit poll|opinion poll|by-election|assembly poll|ballot|vote count|campaign|constituency|coalition|opposition party|ruling party|BJP|Congress party|manifesto|defection|no-confidence|poll result|landslide|voters?)\b/i],
  ['BUSINESS', /\b(merger|acquisition|takeover|buyout|IPO|Sensex|Nifty|stock market|shares?|shareholder\w*|earnings|quarterly (?:profit|results|loss)|revenue|bankrupt\w*|insolven\w*|NCLT|layoffs?|job cuts|startup|funding round|valuation|GDP|inflation|interest rate|repo rate|central bank|\bRBI\b|bond yield|rupee|billionaire|tycoon|conglomerate|Adani|Ambani|Reliance Industries|\bTata\b)\b/i],
  ['GOV', /\b(cabinet|ministry|minister|parliament|Lok Sabha|Rajya Sabha|legislation|bill passed|ordinance|executive order|decree|gazette|Supreme Court|High Court|verdict|ruling|bureaucrat\w*|summit|diplomat\w*|foreign ministry|bilateral|treaty|\bMEA\b|\bPMO\b|policy)\b/i],
];
export function classifyWire(title) {
  for (const [wire, re] of WIRE_RULES) if (re.test(title)) return wire;
  return null;
}

// ---------------------------------------------------------------- parsing

// processEntities:false disables DTD/entity expansion — some feeds (WHO, CISA)
// declare thousands of entities and trip the parser's expansion-limit guard.
// We decode the standard entities ourselves in decode(), so nothing is lost.
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', removeNSPrefix: false, processEntities: false });
const text = v => (v == null ? '' : typeof v === 'object' ? String(v['#text'] ?? '') : String(v)).trim();
const arr = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
const decode = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Parse RSS 2.0, Atom or RDF into raw entries. */
export function parseFeedXml(xml) {
  const doc = parser.parse(xml);
  const entries = [];
  const rssItems = arr(doc?.rss?.channel?.item);
  const rdfItems = arr(doc?.['rdf:RDF']?.item);
  const atomItems = arr(doc?.feed?.entry);
  for (const it of [...rssItems, ...rdfItems]) {
    const desc = decode(text(it.description));
    const link = text(it.link) || text(it.guid);
    entries.push({
      media: feedItemMedia(it, text(it['content:encoded']) || text(it.description), link),
      title: decode(text(it.title)) || desc.slice(0, 220),
      link: text(it.link) || text(it.guid),
      date: text(it.pubDate) || text(it['dc:date']) || text(it['a10:updated']),
      source: text(it.source),
      summary: desc.slice(0, 600),
      lat: parseFloat(text(it['geo:lat']) || text(it['geo:Point']?.['geo:lat'])),
      lng: parseFloat(text(it['geo:long']) || text(it['geo:Point']?.['geo:long'])),
      alertLevel: text(it['gdacs:alertlevel']),
    });
  }
  for (const it of atomItems) {
    const links = arr(it.link);
    const href = (links.find(l => l?.['@_rel'] === 'alternate') || links[0])?.['@_href'] || text(it.link);
    entries.push({
      media: feedItemMedia(it, text(it.content) || text(it.summary), href),
      title: decode(text(it.title)),
      link: href,
      date: text(it.published) || text(it.updated),
      source: text(it.source?.title),
      summary: decode(text(it.summary) || text(it.content)).slice(0, 600),
    });
  }
  return entries.filter(e => e.title && e.link);
}

/** Parse the public web preview of a Telegram channel (t.me/s/<channel>). */
export function parseTelegram(html) {
  const { document } = parseHTML(html);
  const out = [];
  for (const m of document.querySelectorAll('.tgme_widget_message[data-post]')) {
    const body = m.querySelector('.tgme_widget_message_text');
    const t = (body?.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    out.push({
      title: t.slice(0, 220),
      summary: t.slice(0, 600),
      link: `https://t.me/${m.getAttribute('data-post')}`,
      date: m.querySelector('time[datetime]')?.getAttribute('datetime') || '',
      media: telegramMedia(m),
    });
  }
  return out.reverse(); // newest first
}

/** Parse Bluesky's public author feed (JSON), which, unlike its RSS, carries images and video. */
export function parseBlueskyFeed(json, handle) {
  const out = [];
  for (const f of json?.feed || []) {
    if (f.reason) continue; // skip reposts: keep the account's own reporting
    const p = f.post || {};
    const t = String(p.record?.text || '').replace(/\s+/g, ' ').trim();
    const rkey = String(p.uri || '').split('/').pop();
    const link = `https://bsky.app/profile/${p.author?.handle || handle}/post/${rkey}`;
    const media = blueskyMedia(p.embed, link);
    if (!t && !media.length) continue;
    out.push({ title: (t || 'Image post').slice(0, 220), summary: t.slice(0, 600), link, date: p.record?.createdAt || p.indexedAt || '', media });
  }
  return out;
}

// Items without a date (some government feeds) are dated when first seen.
const firstSeenAt = new Map();
function dateOf(e) {
  const t = Date.parse(e.date);
  if (Number.isFinite(t)) return t;
  if (!firstSeenAt.has(e.link)) firstSeenAt.set(e.link, Date.now());
  if (firstSeenAt.size > 5000) firstSeenAt.delete(firstSeenAt.keys().next().value);
  return firstSeenAt.get(e.link);
}

const SEV_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Prettify a scraped URL-slug title into readable text. Some sources (e.g. SATP
 * datasheet pages via `site:satp.org`) surface page slugs like
 * "OTHER-DATA-INDIA-UNNAO-ATTACKS-BORDER-FORCES_2026" instead of a headline.
 * Real headlines contain spaces and are returned unchanged.
 */
/** True when a title is a scraped URL slug (no spaces, hyphen/underscore-joined) rather than a headline. */
export const isSlugTitle = s => !!s && !/\s/.test(s) && /[-_]/.test(s) && String(s).length > 12;

export function cleanTitle(raw) {
  const s = String(raw || '').trim();
  if (!isSlugTitle(s)) return s;
  return s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    .toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
}

/** Normalise raw entries into wire items. Google News titles end in " - Outlet". */
export function toItems(entries, { wire, outlet, kind = 'news', sourceId, fallbackWire, dropSlugs = false } = {}) {
  const out = [];
  for (const e of entries) {
    let title = e.title;
    let source = e.source || outlet || '';
    if (!outlet) {
      // Google News appends " - Outlet" to every title.
      const dash = title.lastIndexOf(' - ');
      if (dash > 20) {
        const tail = title.slice(dash + 3).trim();
        if (!e.source || tail === e.source) { source = source || tail; title = title.slice(0, dash).trim(); }
      }
    }
    // Keep the feed's own summary when it adds something beyond the headline.
    let summary = outlet ? String(e.summary || '').trim() : '';
    if (summary && (summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 60)) && summary.length < title.length + 40)) summary = '';
    if (kind === 'social') { summary = String(e.summary || e.title || '').trim(); title = summary.slice(0, 220); }
    // Datasheet/slug pages (e.g. SATP's static database pages) aren't articles — drop when asked.
    if (dropSlugs && isSlugTitle(title)) continue;
    title = cleanTitle(title);
    const assigned = wire || classifyWire(title) || (summary ? classifyWire(summary.slice(0, 300)) : null) || fallbackWire;
    if (!assigned) continue;
    const sevTitle = rateSeverity(title);
    // The summary can raise the rating by at most one step, so a background paragraph cannot dominate.
    const sevSummary = summary ? rateSeverity(summary.slice(0, 300)) : 'LOW';
    const severity = SEV_ORDER[Math.max(SEV_ORDER.indexOf(sevTitle), Math.min(SEV_ORDER.indexOf(sevSummary), SEV_ORDER.indexOf(sevTitle) + 1))];
    out.push({
      id: assigned + '-' + hash(title.toLowerCase()),
      title,
      summary: summary.slice(0, 600),
      source: source || 'Wire',
      sourceId: sourceId || null,
      kind,
      url: e.link,
      published: dateOf(e),
      wire: assigned,
      severity,
      place: locate(title) || (summary ? locate(summary.slice(0, 300)) : null),
      media: (e.media || []).slice(0, 4),
    });
  }
  return out;
}

export function parseQuakes(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  return (data.features || []).map(f => ({
    id: f.id,
    mag: Number(f.properties?.mag) || 0,
    place: String(f.properties?.place || 'Unknown location'),
    time: Number(f.properties?.time) || 0,
    lat: f.geometry?.coordinates?.[1],
    lng: f.geometry?.coordinates?.[0],
    url: String(f.properties?.url || ''),
    tsunami: !!f.properties?.tsunami,
    alert: f.properties?.alert || null,
  })).filter(q => Number.isFinite(q.lat) && Number.isFinite(q.lng)).sort((a, b) => b.time - a.time);
}

// ---------------------------------------------------------------- fetching

const sleep = ms => new Promise(r => setTimeout(r, ms));

const FEED_HEADERS = {
  'User-Agent': UA,
  Accept: 'application/rss+xml, application/atom+xml, application/xml, application/json, text/xml, text/html;q=0.9, */*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

// Fetch with up to 2 retries on transient failures (429/5xx, timeouts, network
// resets). Permanent errors (404/403/401/410/400) fail fast — no point retrying.
async function fetchText(url) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {           // one retry on transient failures
    if (attempt) await sleep(400 + Math.floor(Math.random() * 400));
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: FEED_HEADERS });
      if (res.ok) return await res.text();
      if (!RETRY_STATUS.has(res.status)) throw new Error(`HTTP ${res.status}`); // permanent → stop
      lastErr = new Error(`HTTP ${res.status}`);                               // transient → retry
    } catch (e) {
      // Rethrow a permanent HTTP error; retry timeouts and network errors.
      if (/^HTTP (?!429|500|502|503|504)\d+/.test(String(e.message))) throw e;
      lastErr = e;
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

// Admin-managed extra sources: [{ id, name, type, url | handle, wire, kind }] where
// wire is a WIRE_KEYS entry or 'auto' (sort by keyword; unmatched items are dropped).
let customFeeds = [];
export function setCustomFeeds(list) { customFeeds = Array.isArray(list) ? list : []; }
// Built-in source ids the admin has switched off.
let disabled = new Set();
export function setDisabledSources(list) { disabled = new Set(Array.isArray(list) ? list : []); }

/** Fetch one source (any type) and return its items. */
export async function fetchSource(src) {
  const url = sourceUrl(src);
  if (!url) throw new Error('No address for this source.');
  let entries;
  if (src.type === 'bluesky') {
    const handle = String(src.handle || '').replace(/^@/, '');
    entries = parseBlueskyFeed(JSON.parse(await fetchText(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=30&filter=posts_no_replies`)), handle);
  } else {
    // Custom (admin-added) RSS and Mastodon sources point at an arbitrary host,
    // so hold them to the same public-internet check as the article reader.
    if (!src.trusted && (src.type === 'rss' || src.type === 'mastodon')) await assertPublicUrl(url);
    const body = await fetchText(url);
    entries = src.type === 'telegram' ? parseTelegram(body) : parseFeedXml(body);
  }
  const kind = src.kind || (['telegram', 'bluesky', 'mastodon'].includes(src.type) ? 'social' : 'news');
  // Google News results name their own outlet in the title, so no fixed outlet for searches.
  const outlet = src.type === 'search' ? undefined : kind === 'social' && src.handle ? `${src.name} (@${String(src.handle).replace(/^@/, '')})` : src.name;
  const fallbackWire = WIRE_KEYS.includes(src.fallbackWire) ? src.fallbackWire : undefined;
  return { entries, items: toItems(entries, { wire: WIRE_KEYS.includes(src.wire) ? src.wire : undefined, outlet, kind, sourceId: src.id, fallbackWire, dropSlugs: !!src.dropSlugs }) };
}

// Called with the snapshot items after every successful refresh.
const listeners = new Set();
export function onRefresh(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emitRefresh() {
  for (const fn of listeners) Promise.resolve().then(() => fn(state.items)).catch(e => console.error('[feeds] listener', e));
}

/** Fetch a source and report what it would contribute. Used to test custom sources. */
export async function testFeed(src) {
  const { entries, items } = await fetchSource({ name: 'test', ...src });
  return { entries: entries.length, items: items.length, sample: items.slice(0, 5).map(i => ({ title: i.title, wire: i.wire, severity: i.severity })) };
}

const state = {
  items: [],                 // all wire items, newest first
  quakes: [],
  disasters: [],             // GDACS alerts
  sources: {},               // id -> { ok, count, error, at }
  updatedAt: null,
  refreshing: false,
};

function dedupe(items) {
  const seen = new Map();
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 70);
    if (!seen.has(key)) seen.set(key, it);
  }
  return [...seen.values()];
}

// Providers are async functions that return already-normalised feed items
// (built with toItems). They run each refresh and merge into the feed, so a
// JSON/API source (Reddit, ransomware.live, GDELT, CISA KEV) gets the map,
// wires, watchlists, verify and visual-intel machinery for free.
const providers = [];
export function registerProvider(p) { providers.push(p); }

// ---- GDELT keyword search (datacenter-friendly; Google News blocks server IPs)
const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Translate a Google-News-style query to a GDELT DOC query. GDELT shares the
// (a OR b) / "phrase" syntax; map site:→domain:, drop when:, and cap each OR
// group to 8 alternatives so the query stays within GDELT's complexity limit.
export function toGdeltQuery(q) {
  let s = String(q || '').replace(/\bwhen:\S+/gi, ' ').replace(/\bsite:(\S+)/gi, 'domain:$1');
  s = s.replace(/\(([^()]*)\)/g, (_, inner) => {
    const parts = inner.split(/\s+OR\s+/i).map(x => x.trim()).filter(Boolean);
    return '(' + parts.slice(0, 8).join(' OR ') + ')';
  });
  return s.replace(/\s+/g, ' ').trim();
}

/** Map a GDELT DOC 2.0 articles payload to raw feed entries. */
export function gdeltDocEntries(json) {
  return (json?.articles || [])
    .filter(a => a.title && a.url)
    .map(a => ({
      title: decode(a.title),
      link: a.url,
      date: a.seendate ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}T${a.seendate.slice(9, 11)}:${a.seendate.slice(11, 13)}:00Z` : new Date().toISOString(),
      source: a.domain || '',
      summary: '',
      media: a.socialimage ? [{ type: 'image', url: a.socialimage }] : [],
    }));
}

/** Run a keyword query via GDELT DOC 2.0. Returns raw entries (possibly empty). */
// Single-attempt fetch (no retry) — used for GDELT, which rate-limits (429) and
// must not be retried in-cycle. A failure just skips this source for one cycle.
async function fetchOnce(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: FEED_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}

// Throws on failure (429 / HTML error / non-JSON) so the caller keeps last-good
// instead of wiping the source to zero. Returns [] only on a clean, genuinely
// empty result. Timespan widened to 3d so a bounded rotation still yields depth.
async function gdeltSearchEntries(query) {
  const q = toGdeltQuery(query);
  if (!q) return [];
  const url = `${GDELT_DOC}?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=60&sort=datedesc&timespan=3d&format=json`;
  const body = await fetchOnce(url);                    // throws on non-200 (e.g. 429)
  let json;
  try { json = JSON.parse(body); } catch { throw new Error('GDELT throttled'); }  // HTML error page
  return gdeltDocEntries(json);
}

// ---- NewsData.io: a reliable keyword-search backup that never rate-limits the
// way GDELT does. Free tier: 200 credits/day, q capped at 100 chars, ~12h
// delayed. So it is strictly a BACKUP for keyword breadth and the never-zero
// guarantee — the real-time layer is the direct publisher RSS feeds. Fires only
// when GDELT fails for a given query, and a hard daily cap protects the budget.
// Set NEWSDATA_API_KEY in the environment (Render) to enable it.
const NEWSDATA_URL = 'https://newsdata.io/api/1/latest';
const NEWSDATA_DAILY_CAP = 160;          // leave headroom under the 200/day free limit
let newsdataUsed = 0, newsdataDay = '';
export function newsdataUsage() { return { used: newsdataUsed, cap: NEWSDATA_DAILY_CAP, day: newsdataDay, enabled: !!process.env.NEWSDATA_API_KEY }; }

// Compress a long Google-News-style query into a <=100-char OR query of the most
// distinctive terms (NewsData does full-text search, so a few key terms suffice).
export function toNewsdataQuery(q) {
  const s = String(q || '');
  const phrases = s.match(/"[^"]+"/g) || [];
  const words = (s.replace(/"[^"]+"/g, ' ').match(/[A-Za-z][A-Za-z-]{2,}/g) || [])
    .filter(w => !/^(OR|AND|NOT|when|site|domain)$/i.test(w));
  const terms = [...new Set([...phrases, ...words])];
  let out = '';
  for (const t of terms) { const next = out ? `${out} OR ${t}` : t; if (next.length > 95) break; out = next; }
  return out;
}

/** Map a NewsData.io `latest` payload to raw feed entries. */
export function newsdataEntries(json) {
  return (json?.results || [])
    .filter(a => a.title && a.link)
    .map(a => ({
      title: decode(a.title),
      link: a.link,
      date: a.pubDate ? `${String(a.pubDate).replace(' ', 'T')}Z` : new Date().toISOString(),
      source: a.source_name || a.source_id || '',
      summary: decode(a.description || ''),
      media: a.image_url ? [{ type: 'image', url: a.image_url }] : [],
    }));
}

/** Query NewsData.io. Returns [] when disabled, out of budget, or on any error. */
async function newsdataSearchEntries(query) {
  const key = process.env.NEWSDATA_API_KEY;
  if (!key) return [];
  const today = new Date().toISOString().slice(0, 10);
  if (today !== newsdataDay) { newsdataDay = today; newsdataUsed = 0; }  // daily reset (UTC)
  if (newsdataUsed >= NEWSDATA_DAILY_CAP) return [];
  const q = toNewsdataQuery(query);
  if (!q) return [];
  newsdataUsed++;
  const url = `${NEWSDATA_URL}?apikey=${key}&language=en&q=${encodeURIComponent(q)}`;
  let json;
  try { json = JSON.parse(await fetchOnce(url)); } catch { return []; }
  if (json?.status !== 'success') return [];
  return newsdataEntries(json);
}

// ---- Google News RSS (best-effort). Free, no key, near-real-time, keyword —
// but Google blocks datacenter IPs, so it 503s from a server much of the time.
// Added purely as a BONUS tier: behind the never-wipe cache, it contributes on
// the cycles it happens to work and harmlessly fails (kept last-good) otherwise.
// Single-attempt (no retry) so we never hammer a blocking IP. Throws on failure.
async function googleNewsEntries(query) {
  const body = await fetchOnce(googleNewsUrl(query, '1d'));   // 503 from datacenter → throws
  return parseFeedXml(body);
}

// ---- Bing News RSS (best-effort). Free, no key, near-real-time, keyword. May
// or may not be reachable from a datacenter — same bonus-tier treatment as
// Google News; the admin health will show whether it ever delivers.
const BING_NEWS = 'https://www.bing.com/news/search';
async function bingNewsEntries(query) {
  const body = await fetchOnce(`${BING_NEWS}?q=${encodeURIComponent(query)}&format=rss&setlang=en`);
  return parseFeedXml(body);
}

// ---- Currents API: a commercial-use-OK keyed backup (fresher & bigger free
// quota than NewsData). Budget-capped; returns [] when disabled/out of budget/error.
const CURRENTS_URL = 'https://api.currentsapi.services/v1/search';
const CURRENTS_DAILY_CAP = 400;
let currentsUsed = 0, currentsDay = '';
export function currentsUsage() { return { used: currentsUsed, cap: CURRENTS_DAILY_CAP, day: currentsDay, enabled: !!process.env.CURRENTS_API_KEY }; }

/** Map a Currents API search payload to raw feed entries. */
export function currentsEntries(json) {
  return (json?.news || [])
    .filter(a => a.title && a.url)
    .map(a => ({
      title: decode(a.title),
      link: a.url,
      date: a.published ? String(a.published).replace(' ', 'T').replace(' ', '') : new Date().toISOString(),
      source: (() => { try { return new URL(a.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
      summary: decode(a.description || ''),
      media: a.image && a.image !== 'None' ? [{ type: 'image', url: a.image }] : [],
    }));
}

async function currentsSearchEntries(query) {
  const key = process.env.CURRENTS_API_KEY;
  if (!key) return [];
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentsDay) { currentsDay = today; currentsUsed = 0; }
  if (currentsUsed >= CURRENTS_DAILY_CAP) return [];
  const q = toNewsdataQuery(query);                      // compact keyword list works well here too
  if (!q) return [];
  currentsUsed++;
  const url = `${CURRENTS_URL}?keywords=${encodeURIComponent(q)}&language=en&apiKey=${key}`;
  let json;
  try { json = JSON.parse(await fetchOnce(url)); } catch { return []; }
  if (json?.status !== 'ok') return [];
  return currentsEntries(json);
}

// Items for one keyword wire/search — a resilient multi-provider cascade:
//   Tier 1 (free, real-time, best-effort, run in parallel): GDELT + Google News
//           + Bing News. Whatever returns items is merged.
//   Tier 2 (reliable keyed backups, budget-capped): Currents → NewsData, used
//           only when the whole free tier came up empty.
// Throws only when EVERYTHING failed (not one clean response), so the cycle
// keeps the source's last-good items. The 8 dashboards never depend on any of
// this — they fill in real time from the direct RSS feeds via classifyWire.
async function keywordItems(query, opts) {
  const settled = await Promise.allSettled([
    gdeltSearchEntries(query),
    googleNewsEntries(query),
    bingNewsEntries(query),
  ]);
  const entries = [];
  let anyResponded = false;
  for (const r of settled) {
    if (r.status === 'fulfilled') { anyResponded = true; if (r.value.length) entries.push(...r.value); }
  }
  if (entries.length) return toItems(entries, opts);     // free tier delivered

  const cur = await currentsSearchEntries(query);        // reliable backup #1
  if (cur.length) return toItems(cur, opts);
  const nd = await newsdataSearchEntries(query);         // reliable backup #2
  if (nd.length) return toItems(nd, opts);

  if (anyResponded) return [];                           // a provider responded cleanly, just empty
  throw new Error('all keyword providers failed');       // nothing responded → keep last-good
}

// Per-source item cache + health. state.items is rebuilt from every source's
// last-good items each cycle, so we can refresh GDELT sources a few at a time
// (to respect GDELT's rate limit) without the others flickering to empty.
//
// FOOLPROOF RULE: a source's cache is only REPLACED when a fetch actually
// yields items. A transient failure, a throttle (GDELT 429), a Cloudflare
// challenge page, or an unexpectedly empty parse never drops a dashboard to
// zero — the last-good items stand until they age out of the 48h window. This
// is the core of "fetch can never fail": individual sources come and go, but
// the aggregate feed only ever grows or ages, it never blanks.
const sourceItems = new Map();   // cacheId -> last-good items[]

/**
 * Record one source's fetch outcome into both the item cache and the health
 * map, without ever wiping last-good on a bad/empty fetch.
 *   result.items  -> success (replace cache only when non-empty)
 *   result.error  -> failure (keep cache; mark 'cached' if we have any)
 * `state` values: ok | cached | empty | error.
 */
function ingest(cacheId, healthId, result) {
  const prev = sourceItems.get(cacheId) || [];
  if (result.error) {
    state.sources[healthId] = { ok: prev.length > 0, count: prev.length, state: prev.length ? 'cached' : 'error', error: result.error, at: Date.now() };
    return;
  }
  const items = result.items || [];
  if (items.length) {
    sourceItems.set(cacheId, items);
    state.sources[healthId] = { ok: true, count: items.length, state: 'ok', error: null, at: Date.now() };
  } else {
    // Fetched cleanly but nothing parseable/new — hold last-good rather than blank.
    state.sources[healthId] = { ok: true, count: prev.length, state: prev.length ? 'cached' : 'empty', error: null, at: Date.now() };
  }
}

function commitItems() {
  const cutoff = Date.now() - 48 * 3600 * 1000;
  const merged = [];
  for (const items of sourceItems.values()) for (const it of items) if (it.published >= cutoff) merged.push(it);
  if (merged.length) state.items = dedupe(merged).sort((a, b) => b.published - a.published).slice(0, 1200);
  state.updatedAt = Date.now();
}

// ---- Restart persistence. The server saves a snapshot of the merged feed and
// reloads it on boot, so a redeploy or crash never shows an empty app while the
// first refresh is still in flight.
export function exportState() {
  return { items: state.items.slice(0, 600), quakes: state.quakes, disasters: state.disasters, updatedAt: state.updatedAt };
}
export function seedState(snap) {
  if (!snap || state.items.length) return;                 // only seed a cold start
  const items = Array.isArray(snap.items) ? snap.items.filter(i => i && i.title && i.published) : [];
  if (items.length) { sourceItems.set('restore', items); state.items = items; }
  if (Array.isArray(snap.quakes)) state.quakes = snap.quakes;
  if (Array.isArray(snap.disasters)) state.disasters = snap.disasters;
  state.updatedAt = snap.updatedAt || Date.now();
}

// GDELT allows roughly one request every ~5s; keep well inside that. The wire
// queries and the granular searches share ONE bounded, rotating pool so total
// GDELT load is capped per cycle (far fewer 429s). Over several cycles every
// query refreshes; the cache holds the rest. The 8 dashboards do not depend on
// this at all — they fill from the direct feeds via classifyWire — so GDELT is
// pure supplementary depth and its throttling can never empty a dashboard.
const GDELT_SPACING_MS = 5000;
const GDELT_PER_CYCLE = 10;
let gdeltCursor = 0;

/** The full live source list (built-ins the admin hasn't disabled + custom feeds). */
function allSources() {
  return [...BUILTIN_SOURCES.filter(src => !disabled.has(src.id)).map(src => ({ ...src, trusted: true })), ...customFeeds.map(f => ({ ...f, id: `custom-${f.id}` }))];
}

/** Fetch every direct RSS / social feed (not keyword searches) in parallel
 *  batches, keeping last-good on any failure. This is the real-time layer:
 *  publisher RSS updates within seconds-to-minutes of publication. */
async function pullDirect(all) {
  const direct = all.filter(x => x.type !== 'search');
  for (let i = 0; i < direct.length; i += 6) {
    await Promise.all(direct.slice(i, i + 6).map(async src => {
      try { const { items } = await fetchSource(src); ingest(`src:${src.id}`, src.id, { items }); }
      catch (e) { ingest(`src:${src.id}`, src.id, { error: e.message }); }
    }));
  }
}

// Fast loop: re-pull only the direct RSS feeds and republish, so breaking news
// shows on screen in near-real-time (~2 min) without touching the rate-limited
// GDELT/NewsData keyword layer. The heavy listeners (push, trends, risk) stay on
// the 5-min full refresh to avoid over-sampling.
let directRefreshing = false;
export async function refreshDirect() {
  if (state.refreshing || directRefreshing) return;
  directRefreshing = true;
  try {
    await pullDirect(allSources());
    commitItems();
  } finally { directRefreshing = false; }
}

export async function refresh() {
  if (state.refreshing) return;
  state.refreshing = true;
  try {
    const all = allSources();

    // 1) Direct RSS / social feeds (BBC, Al Jazeera, The Hindu, ToI, …) — these
    //    work fine from a server. Parallel batches; keep last-good on any failure.
    await pullDirect(all);
    // 2) API providers (Reddit, GDELT firehose, CISA KEV, ransomware.live).
    await Promise.all(providers.filter(p => !disabled.has(p.id)).map(async p => {
      try { const items = await p.run(); ingest(`prov:${p.id}`, p.id, { items }); }
      catch (e) { ingest(`prov:${p.id}`, p.id, { error: e.message }); }
    }));
    // 3) Hazards — keep last-good on failure (don't blank the map).
    if (!disabled.has('usgs')) try {
      const quakes = parseQuakes(await fetchText(USGS_URL));
      if (quakes.length) state.quakes = quakes;
      state.sources.usgs = { ok: true, count: state.quakes.length, state: quakes.length ? 'ok' : 'cached', error: null, at: Date.now() };
    } catch (e) { state.sources.usgs = { ok: state.quakes.length > 0, count: state.quakes.length, state: state.quakes.length ? 'cached' : 'error', error: e.message, at: Date.now() }; }
    if (!disabled.has('gdacs')) try {
      const disasters = parseFeedXml(await fetchText(GDACS_URL))
        .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng))
        .map(e => ({ id: hash(e.link), title: e.title, url: e.link, published: Date.parse(e.date) || Date.now(), lat: e.lat, lng: e.lng, level: (e.alertLevel || '').toLowerCase(), summary: e.summary }))
        .filter(d => Date.now() - d.published < 7 * 86400000)
        .slice(0, 60);
      if (disasters.length) state.disasters = disasters;
      state.sources.gdacs = { ok: true, count: state.disasters.length, state: disasters.length ? 'ok' : 'cached', error: null, at: Date.now() };
    } catch (e) { state.sources.gdacs = { ok: state.disasters.length > 0, count: state.disasters.length, state: state.disasters.length ? 'cached' : 'error', error: e.message, at: Date.now() }; }

    // Publish what we have (direct feeds + any cached GDELT) right away.
    commitItems();

    // 4) GDELT keyword sourcing — one bounded, rotating pool (wires + searches).
    const runKw = async (id, query, opts) => {
      try { const items = await keywordItems(query, opts); ingest(`src:${id}`, id, { items }); }
      catch (e) { ingest(`src:${id}`, id, { error: e.message }); }   // keep last-good
      await sleep(GDELT_SPACING_MS);
    };
    const searches = all.filter(x => x.type === 'search');
    const gdeltJobs = [
      ...WIRE_KEYS.filter(k => !disabled.has(`gnews-${k}`)).map(k => ({ id: `gnews-${k}`, query: WIRES[k].query, opts: { wire: k } })),
      ...searches.map(src => ({
        id: src.id, query: src.query, opts: {
          wire: WIRE_KEYS.includes(src.wire) ? src.wire : undefined,
          kind: src.kind || 'news', sourceId: src.id,
          fallbackWire: WIRE_KEYS.includes(src.fallbackWire) ? src.fallbackWire : undefined,
          dropSlugs: !!src.dropSlugs,
        },
      })),
    ];
    for (let i = 0; i < Math.min(GDELT_PER_CYCLE, gdeltJobs.length); i++) {
      const job = gdeltJobs[(gdeltCursor + i) % gdeltJobs.length];
      await runKw(job.id, job.query, job.opts);
    }
    gdeltCursor = gdeltJobs.length ? (gdeltCursor + GDELT_PER_CYCLE) % gdeltJobs.length : 0;
    commitItems();
  } finally {
    state.refreshing = false;
  }
  emitRefresh();
}

// Development/testing only: load items from a JSON file instead of the web.
// FEED_FIXTURE=path.json with { items: [{title, source, url, published, wire}], quakes: [...] }
async function loadFixture(file) {
  const fs = await import('fs');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  state.items = (data.items || []).map(e => {
    const title = e.title;
    return { id: e.wire + '-' + hash(title.toLowerCase()), title, summary: e.summary || '', kind: e.kind || 'news', sourceId: 'fixture', media: e.media || [], source: e.source, url: e.url, published: e.published || Date.now(), wire: e.wire, severity: rateSeverity(title), place: locate(title) };
  });
  state.quakes = data.quakes || [];
  state.disasters = data.disasters || [];
  state.sources = { fixture: { ok: true, count: state.items.length, error: null, at: Date.now() } };
  state.updatedAt = Date.now();
  emitRefresh();
}

const DIRECT_REFRESH_MS = 2 * 60 * 1000;   // near-real-time direct-RSS pulse
export function startFeedLoop() {
  if (process.env.FEED_FIXTURE) { loadFixture(process.env.FEED_FIXTURE).catch(e => console.error('[feeds] fixture', e)); return; }
  refresh().catch(err => console.error('[feeds] refresh failed', err));
  setInterval(() => refresh().catch(err => console.error('[feeds] refresh failed', err)), REFRESH_MS).unref();
  // Fast real-time pulse for the direct RSS backbone between full cycles.
  setInterval(() => refreshDirect().catch(err => console.error('[feeds] direct refresh failed', err)), DIRECT_REFRESH_MS).unref();
}

// ---------------------------------------------------------------- clustering

const SEV_RANK = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

// Indian states, union territories and the places/cities we track by name, so a
// threat clustered on an Indian location counts as India-facing even when its
// wire tag is a broader one (SATP, KINETIC, CYBER, …).
const IN_PLACES = /\b(India|Kashmir|Jammu|J&K|Ladakh|Srinagar|Pampore|Baramulla|Anantnag|Pahalgam|Pulwama|Kupwara|Punjab|Amritsar|Rajasthan|Gujarat|Kutch|Himachal|Uttarakhand|Sikkim|Arunachal|Assam|Manipur|Nagaland|Mizoram|Tripura|Meghalaya|West Bengal|Kolkata|Chhattisgarh|Jharkhand|Bihar|Odisha|Maharashtra|Mumbai|New Delhi|Delhi|Bengaluru|Bangalore|Hyderabad|Chennai|Pune|Imphal|Guwahati|Leh|Uri|Poonch|Rajouri|Gurez|Tawang)\b/i;
const isIndiaThreat = t => (t.wires || []).includes('INDIA') || IN_PLACES.test(t.location || '');

/** Group located items into threat vectors: one per place. */
export function clusterThreats(items, limit = 24) {
  const groups = new Map();
  for (const it of items) {
    // Business, government and politics items have their own screens and never plot as kinetic threats.
    if (!it.place || it.severity === 'LOW' || it.wire === 'BUSINESS' || it.wire === 'GOV' || it.wire === 'POLITICS') continue;
    const g = groups.get(it.place.name) || { place: it.place, items: [] };
    g.items.push(it);
    groups.set(it.place.name, g);
  }
  const threats = [...groups.values()].map(g => {
    const sorted = g.items.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.published - a.published);
    const lead = sorted[0];
    const severity = lead.severity;
    const wires = sorted.reduce((m, i) => (m[i.wire] = (m[i.wire] || 0) + 1, m), {});
    const topWire = Object.entries(wires).sort((a, b) => b[1] - a[1])[0][0];
    const outlets = new Set(sorted.map(i => i.source)).size;
    return {
      id: 'thr-' + hash(g.place.name),
      title: `${g.place.name}: ${lead.title}`.slice(0, 110),
      severity,
      category: WIRES[topWire]?.category || 'OSINT',
      location: g.place.name,
      lat: g.place.lat,
      lng: g.place.lng,
      summary: `${sorted.length} report${sorted.length === 1 ? '' : 's'} from ${outlets} outlet${outlets === 1 ? '' : 's'} in the last 48 hours. Latest: ${sorted.slice().sort((a, b) => b.published - a.published)[0].title}`,
      reports: sorted.length,
      outlets,
      latest: Math.max(...sorted.map(i => i.published)),
      wires: Object.keys(wires),
      sources: sorted.slice(0, 12).map(i => ({ title: i.title, url: i.url, source: i.source, published: i.published, severity: i.severity, kind: i.kind || 'news' })),
    };
  });
  const ranked = threats
    .filter(t => t.severity !== 'MEDIUM' || t.reports >= 2)
    .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.reports - a.reports);
  return balanceIndiaGlobal(ranked, limit);
}

/**
 * Weight the feed ~60% India-facing / 40% global while keeping global coverage.
 * India and global threats are each already ranked (severity, then reports); we
 * take the strongest ~60% India and ~40% global, and if either pool is short we
 * top up from the other so the feed is never starved. The combined set is
 * re-sorted by rank for display.
 */
export function balanceIndiaGlobal(ranked, limit = 24) {
  if (ranked.length <= limit) return ranked;
  const india = ranked.filter(isIndiaThreat);
  const global = ranked.filter(t => !isIndiaThreat(t));
  let nIndia = Math.round(limit * 0.6);
  let nGlobal = limit - nIndia;
  if (india.length < nIndia) { nGlobal += nIndia - india.length; nIndia = india.length; }
  if (global.length < nGlobal) { nIndia = Math.min(india.length, nIndia + (nGlobal - global.length)); nGlobal = global.length; }
  const picked = new Set([...india.slice(0, nIndia), ...global.slice(0, nGlobal)]);
  return ranked.filter(t => picked.has(t)).slice(0, limit);
}

export function buildAlerts(items, limit = 20) {
  const cutoff = Date.now() - 12 * 3600 * 1000;
  return items
    .filter(i => (i.severity === 'CRITICAL' || i.severity === 'HIGH') && i.published >= cutoff && i.kind !== 'social' && i.wire !== 'BUSINESS' && i.wire !== 'GOV' && i.wire !== 'POLITICS')
    .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.published - a.published)
    .slice(0, limit)
    .map(i => ({ id: 'al-' + i.id, message: i.title, summary: i.summary || '', severity: i.severity, published: i.published, url: i.url, source: i.source, place: i.place?.name || null }));
}

export function snapshot() {
  return {
    updatedAt: state.updatedAt,
    refreshing: state.refreshing,
    items: state.items,
    threats: clusterThreats(state.items),
    alerts: buildAlerts(state.items),
    quakes: state.quakes.slice(0, 80),
    disasters: state.disasters,
    sources: state.sources,
  };
}

// ---------------------------------------------------------------- search & corroboration

const STOP = new Set('a an the of in on at to for from by with and or but is are was were be been as that this these those it its into over after before about amid says said report reports new latest how why what who will would could may might has have had not no than more most'.split(' '));

export function keyTerms(textIn, max = 8) {
  const words = (textIn.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) || [])
    .filter(w => !STOP.has(w.toLowerCase()) && w.length > 2);
  const seen = new Set();
  const out = [];
  for (const w of words) {
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

export async function searchNews(query, window = '7d') {
  if (process.env.FEED_FIXTURE) {
    const terms = keyTerms(query.replace(/"/g, ''), 6).map(t => t.toLowerCase());
    return state.items.filter(i => terms.some(t => i.title.toLowerCase().includes(t)))
      .map(i => ({ id: hash(i.title), title: i.title, source: i.source, url: i.url, published: i.published, severity: i.severity, place: i.place }));
  }
  // Resilient multi-provider search: GDELT + Google News + Bing in parallel,
  // then Currents/NewsData as keyed backups — so corroboration still works even
  // when Google News 503s the server. Merge whatever responds.
  const settled = await Promise.allSettled([
    gdeltSearchEntries(query),
    googleNewsEntries(query),
    bingNewsEntries(query),
  ]);
  let entries = [];
  for (const r of settled) if (r.status === 'fulfilled' && r.value.length) entries.push(...r.value);
  if (!entries.length) entries = await currentsSearchEntries(query);
  if (!entries.length) entries = await newsdataSearchEntries(query);
  return dedupe(entries.map(e => {
    let title = e.title; let source = e.source;
    const dash = title.lastIndexOf(' - ');
    if (dash > 20) { source = source || title.slice(dash + 3).trim(); title = title.slice(0, dash).trim(); }
    return { id: hash(title), title, source: source || 'Web', url: e.link, published: Date.parse(e.date) || null, severity: rateSeverity(title), place: locate(title) };
  })).sort((a, b) => (b.published || 0) - (a.published || 0)).slice(0, 40);
}

/** Corroboration check: how many independent outlets report the same story right now. */
export async function corroborate(claim) {
  const terms = keyTerms(claim, 7);
  if (terms.length < 2) return { status: 'UNCORROBORATED', outlets: 0, score: 0, query: terms.join(' '), matches: [], note: 'Not enough specific terms to search for.' };
  const query = terms.join(' ');
  let results = await searchNews(query, '3d');
  if (results.length < 3 && terms.length > 4) results = [...results, ...await searchNews(terms.slice(0, 4).join(' '), '3d')];
  // Keep results that share enough key terms with the claim.
  const lower = terms.map(t => t.toLowerCase());
  const scored = results.map(r => {
    const t = r.title.toLowerCase();
    const hits = lower.filter(w => t.includes(w)).length;
    return { ...r, overlap: hits / lower.length };
  }).filter(r => r.overlap >= 0.34);
  const byOutlet = new Map();
  for (const r of scored) if (!byOutlet.has(r.source)) byOutlet.set(r.source, r);
  const matches = [...byOutlet.values()].sort((a, b) => b.overlap - a.overlap).slice(0, 10);
  const outlets = matches.length;
  const status = outlets >= 3 ? 'CORROBORATED' : outlets >= 1 ? 'LIMITED' : 'UNCORROBORATED';
  const score = Math.min(100, Math.round(outlets * 22 + (matches[0]?.overlap || 0) * 20));
  return {
    status, outlets, score, query, checkedAt: Date.now(),
    matches: matches.map(m => ({ title: m.title, url: m.url, source: m.source, published: m.published })),
    note: outlets >= 3 ? `${outlets} independent outlets are reporting matching stories in the last 3 days.`
      : outlets >= 1 ? `Only ${outlets} outlet${outlets === 1 ? '' : 's'} found reporting a matching story. Treat as unconfirmed.`
      : 'No matching reports found in the last 3 days.',
  };
}
