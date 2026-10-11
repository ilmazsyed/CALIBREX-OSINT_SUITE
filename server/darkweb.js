// Dark-web search: queries public, clearnet .onion index engines and surfaces
// the INDEX only — titles, onion addresses, snippets and extracted indicators.
// Calibrex never fetches onion content. A gated tool (see sensitive.js):
// surfacing a public search index is lawful; visiting results requires a Tor
// browser, proper OPSEC and lawful authorization, which are the user's
// responsibility, and every query is logged.
//
// Sources (keyless, clearnet, no-JS HTML):
//   • Onion Search Engine (onionsearchengine.com) — primary; returns rich,
//     server-rendered results with titles and snippets.
//   • Ahmia (ahmia.fi) — kept as a best-effort fallback (it now returns a
//     JS/Tor-only shell to datacenter clients, so it usually yields nothing,
//     but costs little and recovers automatically if that changes).
//
// Each hit is enriched into something an investigator can act on without ever
// opening Tor: onion liveness (v3 current vs v2 dead), a category, and any
// crypto addresses / emails / PGP keys / clearnet domains / messaging handles
// found in the index text — each a pivot back into Calibrex's own tools.
import { parseHTML } from 'linkedom';
import { searchDirectory, SEARCH_ENGINES } from './darkweb-directory.js';

// A realistic browser UA — some engines serve a stripped page to obvious bots.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const TIMEOUT = 20000;

const SOURCES = [
  { id: 'Onion Search Engine', url: q => `https://onionsearchengine.com/search.php?q=${encodeURIComponent(q)}` },
  { id: 'Ahmia', url: q => `https://ahmia.fi/search/?q=${encodeURIComponent(q)}` },
];

// v2 onion labels are 16 base32 chars, v3 are 56.
const ONION_RE = /\b([a-z2-7]{56}|[a-z2-7]{16})\.onion\b/i;

// Engine self-links / utility links that must never be treated as results.
const SKIP_HREF = /report_page\.php|addurl|api_plans|api\.php|\/map\.php|donation|\/index\.php|\/search\.php|\/about|\/add\b|\/legal|\/privacy|\/terms|\/blacklist|torproject\.org|github\.com/i;
const CHROME_ONIONS = new Set([
  'juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion', // ahmia.fi itself
  'msydqstlz2kzerdg.onion', // legacy ahmia
]);

function onionHost(s) {
  const m = String(s || '').match(ONION_RE);
  return m ? m[0].toLowerCase() : '';
}
function onionUrlFromText(s) {
  const m = String(s || '').match(/\b(?:[a-z2-7]{56}|[a-z2-7]{16})\.onion(?:\/[^\s"'<>]*)?/i);
  return m ? `http://${m[0].toLowerCase()}` : '';
}

/** Extract the real .onion target from a href (redirect, direct, or param). */
export function onionFrom(href) {
  if (!href) return '';
  let decoded = href;
  try { decoded = decodeURIComponent(href); } catch { /* ignore */ }
  const m = href.match(/redirect_url=([^&]+)/) || decoded.match(/redirect_url=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  const direct = decoded.match(/https?:\/\/(?:www\.)?[a-z2-7]{16,56}\.onion[^\s"'<>]*/i);
  if (direct) return direct[0];
  return onionUrlFromText(decoded);
}

// ---- Enrichment --------------------------------------------------------------

const CATEGORY_RULES = [
  ['market', /\b(market|shop|store|vendor|escrow|cart|drugs?|cards?|dumps?|gun|weapon|pharma)\b/i],
  ['crypto', /\b(bitcoin|btc|monero|xmr|ethereum|wallet|mixer|tumbler|exchange|crypto)\b/i],
  ['leak', /\b(leak|breach|dump|database|stealer|combolist|hacked|ransom|ransomware|doxx?)\b/i],
  ['forum', /\b(forum|board|chan|community|discussion|thread)\b/i],
  ['wiki', /\b(wiki|directory|links?|index|catalog|list of)\b/i],
  ['email', /\b(mail|email|smtp|inbox|webmail|protonmail)\b/i],
  ['hosting', /\b(hosting|host|upload|file|share|pastebin|paste|drive)\b/i],
  ['search', /\b(search engine|search|lookup)\b/i],
  ['news', /\b(news|press|media|journal|blog|leaks? site)\b/i],
  ['privacy', /\b(privacy|security|anonymity|guides?|pgp|encryption)\b/i],
  ['social', /\b(chat|messenger|social|profile|username|threema|jabber)\b/i],
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
function enrich(title, onion, description, source, categoryOverride) {
  const host = onionHost(onion);
  if (!host) return null;
  const label = host.replace(/\.onion$/, '');
  const version = label.length >= 56 ? 'v3' : 'v2';
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  let t = clean(title);
  if (!t || onionHost(t) === host) t = host; // anchor text was just the url
  return {
    title: t.slice(0, 200),
    onion: onion.startsWith('http') ? onion.slice(0, 200) : `http://${host}`,
    host,
    description: clean(description).slice(0, 400),
    version,
    live: version === 'v3',           // v2 onions have been dead across Tor since Oct 2021
    category: categoryOverride || classify(`${t} ${description || ''} ${host}`),
    indicators: extractIndicators(`${t} ${description || ''}`),
    source: source || '',
  };
}

/** Enrich a curated directory entry (keeps its vetted category, flags it). */
function enrichDirectory(e) {
  const h = enrich(e.name, e.onion, e.description, 'Calibrex directory', e.category);
  if (h) h.curated = true;
  return h;
}

// ---- Parsing -----------------------------------------------------------------

/** Best-effort snippet: climb to a container and strip the title/onion/noise. */
function snippetFor(anchor, title, host) {
  let el = anchor;
  for (let i = 0; i < 4 && el; i++) {
    el = el.parentElement;
    if (!el) break;
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt.length > title.length + 12) {
      let s = txt.replace(/Report this result/ig, '').replace(/Onion Link/ig, '');
      if (title && title !== host) s = s.split(title).join(' ');
      s = s.replace(/https?:\/\/\S+/g, ' ').replace(new RegExp(host.replace(/\./g, '\\.'), 'ig'), ' ');
      s = s.replace(/\s+/g, ' ').trim();
      if (s.length > 15) return s;
    }
  }
  return '';
}

/**
 * Parse an onion-index results page into enriched hits. Markup-agnostic:
 * strips page chrome, then scans anchors that resolve to an onion address,
 * reading each anchor's text as the title and climbing to a container for the
 * snippet. Works across engines and survives class-name changes.
 */
export function parseResults(html, source) {
  const { document } = parseHTML(html);
  for (const el of document.querySelectorAll('header, footer, nav, script, style, form, aside')) {
    try { el.remove(); } catch { /* ignore */ }
  }
  const out = [];
  const seen = new Set();
  const add = (title, onion, desc) => {
    const h = enrich(title, onion, desc, source);
    if (!h || CHROME_ONIONS.has(h.host) || seen.has(h.host)) return;
    seen.add(h.host);
    out.push(h);
  };

  for (const a of document.querySelectorAll('a')) {
    const href = a.getAttribute('href') || '';
    if (SKIP_HREF.test(href)) continue;
    const onion = onionFrom(href) || onionUrlFromText(a.textContent || '');
    if (!onion) continue;
    const title = (a.textContent || '').trim();
    const host = onionHost(onion);
    add(title, onion, snippetFor(a, title, host));
    if (out.length >= 60) break;
  }

  // Legacy / alternate markup: structured result rows with a <cite> + <p>.
  if (!out.length) {
    for (const li of document.querySelectorAll('#ahmia-results li, li.result, .result, article')) {
      const a = li.querySelector('h4 a, h3 a, a');
      const onion = onionFrom(li.querySelector('a')?.getAttribute('href') || '')
        || onionUrlFromText(li.querySelector('cite')?.textContent || '')
        || onionUrlFromText(li.textContent || '');
      if (onion) add(a?.textContent || '', onion, li.querySelector('p')?.textContent || '');
      if (out.length >= 60) break;
    }
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

async function fetchSource(src, q) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(src.url(q), {
      signal: ctl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseResults(await res.text(), src.id);
  } finally { clearTimeout(t); }
}

export async function searchDark(query) {
  const q = String(query || '').trim().slice(0, 120);
  if (!q) return { query: q, results: [], sources: [], stats: summarise([]), note: '' };

  // Best-effort live engines (often blocked from datacenter IPs) + the always-
  // available curated directory. The directory guarantees useful, verified
  // results and keeps the screen from ever dead-ending on an empty list.
  const settled = await Promise.allSettled(SOURCES.map(s => fetchSource(s, q)));

  const seen = new Set();
  const results = [];
  const sources = [];
  const push = h => { if (h && !seen.has(h.host)) { seen.add(h.host); results.push(h); } };

  // 1) Live engines first (richest, most query-specific when reachable).
  let liveCount = 0;
  settled.forEach((r, i) => {
    const id = SOURCES[i].id;
    if (r.status === 'fulfilled') {
      sources.push({ id, ok: true, count: r.value.length });
      liveCount += r.value.length;
      for (const h of r.value) push(h);
    } else {
      sources.push({ id, ok: false, error: r.reason?.message || 'failed' });
    }
  });

  // 2) Curated directory matches (always available).
  const dir = searchDirectory(q).map(enrichDirectory).filter(Boolean);
  sources.push({ id: 'Calibrex directory', ok: true, count: dir.length });
  for (const h of dir) push(h);

  // 3) If still thin, surface the onion search engines as an actionable next
  //    step ("search this query yourself in Tor"), so it's never a dead end.
  let note = '';
  if (results.length < 3) {
    for (const e of SEARCH_ENGINES) push(enrichDirectory(e));
    if (liveCount === 0) {
      note = 'Live index engines returned nothing (they block datacenter servers). Showing Calibrex’s vetted directory plus onion search engines you can run this query through in Tor.';
    }
  }

  // Curated/live-matched first, then by liveness and indicator richness.
  results.sort((a, b) =>
    (Number(b.curated || 0) - Number(a.curated || 0)) ||
    ((b.live ? 1 : 0) - (a.live ? 1 : 0)) ||
    (b.indicators.count - a.indicators.count));

  const okLive = sources.filter(s => s.ok && s.id !== 'Calibrex directory' && s.count > 0).map(s => s.id);
  const source = [...okLive, 'Calibrex directory'].join(', ');
  return { query: q, results: results.slice(0, 80), source, sources, stats: summarise(results), note };
}
