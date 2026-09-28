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
  { sub: 'geopolitics', wire: 'GLOBAL_AXIS' },
  { sub: 'CredibleDefense', wire: 'GLOBAL_AXIS' },
  { sub: 'cybersecurity', wire: 'CYBER' },
  { sub: 'geopolitics2', wire: 'REGIONAL' },
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
async function pullGdelt() {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(GDELT_QUERY)}&mode=artlist&maxrecords=60&sort=datedesc&timespan=1d&format=json`;
  return toItems(gdeltEntries(await getJson(url)), { kind: 'news', sourceId: 'gdelt', fallbackWire: 'GLOBAL_AXIS' });
}

// ---------------------------------------------------------------- registration

export const PROVIDERS = [
  { id: 'reddit', name: 'Reddit chatter', group: 'Chatter & deep web', kind: 'social', run: pullReddit },
  { id: 'ransomware', name: 'Ransomware leak sites', group: 'Chatter & deep web', kind: 'analysis', run: pullRansomware },
  { id: 'cisa-kev', name: 'CISA exploited vulnerabilities', group: 'Cyber', kind: 'official', run: pullKev },
  { id: 'gdelt', name: 'GDELT global media', group: 'OSINT & analysis', kind: 'news', run: pullGdelt },
];
