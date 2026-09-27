// Live OSINT feed engine: fetches public feeds server-side, normalises them,
// rates severity by keywords, places them on the map, and clusters threats.
// No AI involved anywhere.
import { XMLParser } from 'fast-xml-parser';
import { parseHTML } from 'linkedom';
import { locate } from './geo.js';
import { BUILTIN_SOURCES, sourceUrl } from './sources.js';
import { feedItemMedia, telegramMedia, blueskyMedia } from './visuals.js';

const REFRESH_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20000;
const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0; +https://github.com/ilmazsyed/CALIBREX-OSINT_SUITE)';

export const WIRES = {
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
  ['CYBER', /\b(cyber\w*|ransomware|malware|hack(?:er|ers|ed|ing)?|zero-day|breach|phishing|botnet|APT\d*|CVE-\d+)\b/i],
  ['FATF', /\b(FATF|launder\w*|terror(?:ist)? financ\w*|sanction\w*|OFAC|hawala|illicit finance)\b/i],
  ['SATP', /\b(Kashmir|Jammu|J&K|LoC|Line of Control|Pakistan|Afghanistan|Balochistan|Manipur|Chhattisgarh|Bangladesh|Khyber|Waziristan|Taliban|TTP|BLA|Naxal\w*|Maoist\w*|ULFA|Lashkar|Jaish|Hizbul|NIA|infiltrat\w*|encounter|militan\w*|Operation Sindoor)\b/i],
  ['KINETIC', /\b(missile|airstrike|air strike|drone strike|shelling|invasion|blockade|coup|bombard\w*|rocket)\b/i],
  ['GLOBAL_AXIS', /\b(NATO|Pentagon|Kremlin|PLA|Taiwan|South China Sea|warships?|nuclear|military drills?)\b/i],
  ['REGIONAL', /\b(clash\w*|insurgen\w*|militia|junta|armed group|ceasefire|rebels?|security forces|attack\w*|killed)\b/i],
];
export function classifyWire(title) {
  for (const [wire, re] of WIRE_RULES) if (re.test(title)) return wire;
  return null;
}

// ---------------------------------------------------------------- parsing

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', removeNSPrefix: false });
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

/** Normalise raw entries into wire items. Google News titles end in " - Outlet". */
export function toItems(entries, { wire, outlet, kind = 'news', sourceId, fallbackWire } = {}) {
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

async function fetchText(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, application/json, text/xml, */*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    const body = await fetchText(url);
    entries = src.type === 'telegram' ? parseTelegram(body) : parseFeedXml(body);
  }
  const kind = src.kind || (['telegram', 'bluesky', 'mastodon'].includes(src.type) ? 'social' : 'news');
  // Google News results name their own outlet in the title, so no fixed outlet for searches.
  const outlet = src.type === 'search' ? undefined : kind === 'social' && src.handle ? `${src.name} (@${String(src.handle).replace(/^@/, '')})` : src.name;
  const fallbackWire = WIRE_KEYS.includes(src.fallbackWire) ? src.fallbackWire : undefined;
  return { entries, items: toItems(entries, { wire: WIRE_KEYS.includes(src.wire) ? src.wire : undefined, outlet, kind, sourceId: src.id, fallbackWire }) };
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

export async function refresh() {
  if (state.refreshing) return;
  state.refreshing = true;
  const collected = [];
  const note = (id, ok, count, error) => { state.sources[id] = { ok, count, error: error || null, at: Date.now() }; };
  try {
    // Google News wires (staggered to stay polite).
    for (const key of WIRE_KEYS) {
      if (disabled.has(`gnews-${key}`)) continue;
      try {
        const xml = await fetchText(googleNewsUrl(WIRES[key].query));
        const items = toItems(parseFeedXml(xml), { wire: key });
        collected.push(...items);
        note(`gnews-${key}`, true, items.length);
      } catch (e) { note(`gnews-${key}`, false, 0, e.message); }
      await sleep(800);
    }
    // Outlets, analysis sites, official feeds, social accounts and admin-added sources.
    const all = [...BUILTIN_SOURCES.filter(src => !disabled.has(src.id)), ...customFeeds.map(f => ({ ...f, id: `custom-${f.id}` }))];
    // Google News searches go one at a time, like the wires, so Google is not flooded.
    for (const src of all.filter(x => x.type === 'search')) {
      try {
        const { items } = await fetchSource(src);
        collected.push(...items);
        note(src.id, true, items.length);
      } catch (e) { note(src.id, false, 0, e.message); }
      await sleep(800);
    }
    const sources = all.filter(x => x.type !== 'search');
    for (let i = 0; i < sources.length; i += 6) {
      await Promise.all(sources.slice(i, i + 6).map(async src => {
        try {
          const { items } = await fetchSource(src);
          collected.push(...items);
          note(src.id, true, items.length);
        } catch (e) { note(src.id, false, 0, e.message); }
      }));
    }
    // Hazards.
    if (!disabled.has('usgs')) try {
      state.quakes = parseQuakes(await fetchText(USGS_URL));
      note('usgs', true, state.quakes.length);
    } catch (e) { note('usgs', false, 0, e.message); }
    if (!disabled.has('gdacs')) try {
      state.disasters = parseFeedXml(await fetchText(GDACS_URL))
        .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng))
        .map(e => ({ id: hash(e.link), title: e.title, url: e.link, published: Date.parse(e.date) || Date.now(), lat: e.lat, lng: e.lng, level: (e.alertLevel || '').toLowerCase(), summary: e.summary }))
        .filter(d => Date.now() - d.published < 7 * 86400000)
        .slice(0, 60);
      note('gdacs', true, state.disasters.length);
    } catch (e) { note('gdacs', false, 0, e.message); }

    if (collected.length) {
      const cutoff = Date.now() - 48 * 3600 * 1000;
      state.items = dedupe(collected.filter(i => i.published >= cutoff)).sort((a, b) => b.published - a.published).slice(0, 1200);
    }
    state.updatedAt = Date.now();
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

export function startFeedLoop() {
  if (process.env.FEED_FIXTURE) { loadFixture(process.env.FEED_FIXTURE).catch(e => console.error('[feeds] fixture', e)); return; }
  refresh().catch(err => console.error('[feeds] refresh failed', err));
  setInterval(() => refresh().catch(err => console.error('[feeds] refresh failed', err)), REFRESH_MS).unref();
}

// ---------------------------------------------------------------- clustering

const SEV_RANK = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

/** Group located items into threat vectors: one per place. */
export function clusterThreats(items, limit = 24) {
  const groups = new Map();
  for (const it of items) {
    if (!it.place || it.severity === 'LOW') continue;
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
  return threats
    .filter(t => t.severity !== 'MEDIUM' || t.reports >= 2)
    .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.reports - a.reports)
    .slice(0, limit);
}

export function buildAlerts(items, limit = 20) {
  const cutoff = Date.now() - 12 * 3600 * 1000;
  return items
    .filter(i => (i.severity === 'CRITICAL' || i.severity === 'HIGH') && i.published >= cutoff && i.kind !== 'social')
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
  const xml = await fetchText(googleNewsUrl(query, window));
  const entries = parseFeedXml(xml);
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
