// Dark-web search: queries Ahmia (ahmia.fi), a legitimate clearnet search engine
// that indexes .onion sites and filters abuse material. We surface the INDEX
// only — titles, onion addresses, snippets and extracted indicators — and never
// fetch onion content. A gated tool (see sensitive.js). Surfacing a public search
// index is lawful; visiting results requires proper authorization and OPSEC,
// which is on the user.
//
// Each hit is enriched into something an investigator can act on without ever
// opening Tor: onion liveness (v3 current vs v2 dead), a category, last-seen,
// and any crypto addresses / emails / PGP keys / clearnet domains / messaging
// handles found in the title and snippet — each a pivot back into Calibrex's
// own research and link-analysis tools.
import { parseHTML } from 'linkedom';

// A realistic browser UA — Ahmia serves a stripped page to obvious bots.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const TIMEOUT = 20000;

// v2 onion labels are 16 base32 chars, v3 are 56.
const ONION_RE = /\b([a-z2-7]{56}|[a-z2-7]{16})\.onion\b/i;
const ONION_RE_G = /\b([a-z2-7]{56}|[a-z2-7]{16})\.onion\b/ig;

// Ahmia's own services and common chrome — never real search results.
const CHROME_ONIONS = new Set([
  'juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion', // ahmia.fi itself
  'msydqstlz2kzerdg.onion', // legacy ahmia
]);

function onionHost(s) {
  const m = String(s || '').match(ONION_RE);
  return m ? m[0].toLowerCase() : '';
}
function onionUrlFromText(s) {
  const h = onionHost(s);
  return h ? `http://${h}` : '';
}

/** Extract the real .onion target from an Ahmia href (redirect or direct). */
export function onionFrom(href) {
  if (!href) return '';
  let decoded = href;
  try { decoded = decodeURIComponent(href); } catch { /* ignore */ }
  const m = href.match(/redirect_url=([^&]+)/) || decoded.match(/redirect_url=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  const direct = decoded.match(/https?:\/\/[a-z2-7]{16,56}\.onion[^\s"']*/i);
  if (direct) return direct[0];
  return onionUrlFromText(decoded);
}

// ---- Enrichment --------------------------------------------------------------

const CATEGORY_RULES = [
  ['market', /\b(market|shop|store|vendor|escrow|cart|buy|sell|drugs?|cards?|dumps?)\b/i],
  ['crypto', /\b(bitcoin|btc|monero|xmr|ethereum|wallet|mixer|tumbler|exchange|crypto)\b/i],
  ['leak', /\b(leak|breach|dump|database|stealer|combolist|hacked|ransom|ransomware)\b/i],
  ['forum', /\b(forum|board|chan|community|discussion|thread)\b/i],
  ['wiki', /\b(wiki|directory|links?|index|list of)\b/i],
  ['email', /\b(mail|email|smtp|inbox|webmail|protonmail)\b/i],
  ['hosting', /\b(hosting|host|upload|file|share|pastebin|paste)\b/i],
  ['search', /\b(search|engine|find|lookup)\b/i],
  ['news', /\b(news|press|media|journal|blog|leaks? site)\b/i],
  ['social', /\b(chat|messenger|social|profile|username)\b/i],
];
export function classify(text) {
  const s = String(text || '');
  for (const [name, re] of CATEGORY_RULES) if (re.test(s)) return name;
  return 'other';
}

const IND = {
  btc: /\b(?:bc1[ac-hj-np-z02-9]{11,58}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g,
  xmr: /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g,
  eth: /\b0x[a-fA-F0-9]{40}\b/g,
  email: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}\b/gi,
  pgp: /\b[0-9A-Fa-f]{40}\b/g, // 160-bit PGP fingerprint
  telegram: /(?:t\.me\/|(?:^|\s)@)[A-Za-z0-9_]{4,32}/g,
};
const CLEARNET = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|co|ru|cn|me|info|biz|xyz|to|cc|site|online|tech|app|dev|gov|edu|uk|de|fr|in|pk|ir|su)\b/gi;

function uniq(arr, cap = 8) { return [...new Set(arr)].slice(0, cap); }

/** Pull actionable indicators out of a title + snippet. */
export function extractIndicators(text) {
  const s = String(text || '');
  const ind = {
    btc: uniq(s.match(IND.btc) || []),
    xmr: uniq(s.match(IND.xmr) || []),
    eth: uniq(s.match(IND.eth) || []),
    emails: uniq(s.match(IND.email) || []),
    pgp: uniq((s.match(IND.pgp) || []).filter(h => !/^0x/i.test(h))),
    clearnet: uniq((s.match(CLEARNET) || []).filter(d => !/\.onion$/i.test(d)).map(d => d.toLowerCase())),
    telegram: uniq((s.match(IND.telegram) || []).map(t => t.trim())),
  };
  ind.count = Object.values(ind).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
  return ind;
}

/** Build an enriched hit from raw title / onion / description. */
function enrich(title, onion, description) {
  const host = onionHost(onion);
  if (!host) return null;
  const label = host.replace(/\.onion$/, '');
  const version = label.length >= 56 ? 'v3' : 'v2';
  const text = `${title || ''} ${description || ''} ${host}`;
  return {
    title: (title || host).trim().replace(/\s+/g, ' ').slice(0, 200),
    onion: onion.startsWith('http') ? onion.slice(0, 200) : `http://${host}`,
    host,
    description: (description || '').trim().replace(/\s+/g, ' ').slice(0, 400),
    version,
    live: version === 'v3',           // v2 onions have been dead across Tor since Oct 2021
    category: classify(text),
    indicators: extractIndicators(`${title || ''} ${description || ''}`),
  };
}

// ---- Parsing -----------------------------------------------------------------

/**
 * Parse an Ahmia results page into enriched hits. Strips page chrome
 * (header/footer/nav/scripts) and Ahmia's own onion first, so we only surface
 * real search results, then reads each result row for title / cite / snippet.
 * Falls back to scanning anchors if the row markup is unfamiliar.
 */
export function parseAhmia(html) {
  const { document } = parseHTML(html);
  // Drop non-result regions so the site's own onion / nav links never leak in.
  for (const el of document.querySelectorAll('header, footer, nav, script, style, form, aside')) {
    try { el.remove(); } catch { /* ignore */ }
  }

  const out = [];
  const seen = new Set();
  const add = (title, onion, desc) => {
    const h = enrich(title, onion, desc);
    if (!h || CHROME_ONIONS.has(h.host) || seen.has(h.host)) return;
    seen.add(h.host);
    out.push(h);
  };

  // 1) Structured result rows (Ahmia's results container + common variants).
  for (const li of document.querySelectorAll('#ahmia-results li, li.result, .result, .search-result, ol > li, article')) {
    const a = li.querySelector('h4 a, h3 a, h2 a, a');
    const href = li.querySelector('a')?.getAttribute('href') || '';
    const cite = li.querySelector('cite')?.textContent || '';
    const onion = onionFrom(href) || onionUrlFromText(cite) || onionUrlFromText(li.textContent || '');
    if (onion) add(a?.textContent || '', onion, li.querySelector('p')?.textContent || '');
    if (out.length >= 50) return out;
  }
  if (out.length) return out;

  // 2) Fallback: any anchor that resolves to an onion address.
  for (const a of document.querySelectorAll('a')) {
    const onion = onionFrom(a.getAttribute('href') || '') || onionUrlFromText(a.textContent || '');
    if (onion) add(a.textContent || '', onion, '');
    if (out.length >= 50) return out;
  }
  // 3) Last resort: onion hosts appearing anywhere in the (de-chromed) body.
  if (!out.length) {
    const body = document.body?.textContent || '';
    for (const m of body.matchAll(ONION_RE_G)) add('', `http://${m[0].toLowerCase()}`, '');
  }
  return out;
}

/** Roll up stats over a result set for the UI header. */
export function summarise(results) {
  return {
    total: results.length,
    live: results.filter(r => r.live).length,
    dead: results.filter(r => !r.live).length,
    withIndicators: results.filter(r => r.indicators?.count > 0).length,
  };
}

export async function searchDark(query) {
  const q = String(query || '').trim().slice(0, 120);
  if (!q) return { query: q, results: [], source: 'Ahmia', stats: summarise([]) };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(`https://ahmia.fi/search/?q=${encodeURIComponent(q)}`, {
      signal: ctl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`Ahmia returned HTTP ${res.status}`);
    const results = parseAhmia(await res.text());
    return { query: q, results, source: 'Ahmia', stats: summarise(results) };
  } finally { clearTimeout(t); }
}
