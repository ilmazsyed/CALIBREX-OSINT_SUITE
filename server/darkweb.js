// Dark-web search: queries Ahmia (ahmia.fi), a legitimate clearnet search engine
// that indexes .onion sites and filters abuse material. We surface the INDEX
// only — titles, onion addresses and snippets — and never fetch onion content.
// A gated tool (see sensitive.js). Surfacing a public search index is lawful;
// visiting results requires proper authorization and OPSEC, which is on the user.
import { parseHTML } from 'linkedom';

const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 20000;

// v2 onion addresses are 16 base32 chars, v3 are 56.
const ONION_RE = /\b([a-z2-7]{56}|[a-z2-7]{16})\.onion\b/i;

/** Pull an onion URL out of free text (a cite element, a snippet, raw HTML). */
function onionFromText(s) {
  const m = String(s || '').match(ONION_RE);
  return m ? `http://${m[0].toLowerCase()}` : '';
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
  return onionFromText(decoded);
}

/**
 * Parse an Ahmia results page into {title, onion, description}.
 * Tolerant of markup changes: tries the structured result rows first, then
 * falls back to scanning every anchor / cite for an onion address, so a
 * class-name change on Ahmia's side can't silently empty the results.
 */
export function parseAhmia(html) {
  const { document } = parseHTML(html);
  const out = [];
  const seen = new Set();
  const push = (title, onion, desc) => {
    onion = (onion || '').trim();
    if (!onion) return;
    // de-dupe on the onion host so the same site doesn't repeat
    const host = (onion.match(ONION_RE) || [onion])[0].toLowerCase();
    if (seen.has(host)) return;
    seen.add(host);
    out.push({
      title: (title || host).trim().replace(/\s+/g, ' ').slice(0, 200),
      onion: onion.slice(0, 160),
      description: (desc || '').trim().replace(/\s+/g, ' ').slice(0, 300),
    });
  };

  // 1) Structured result rows (Ahmia's normal markup), tolerant of class drift.
  for (const li of document.querySelectorAll('li.result, .result, #ahmia-results > li, ol > li')) {
    const titleEl = li.querySelector('h4 a, h4, a');
    const href = li.querySelector('a')?.getAttribute('href') || '';
    const cite = li.querySelector('cite')?.textContent || '';
    const onion = onionFrom(href) || onionFromText(cite) || onionFromText(li.textContent || '');
    if (onion) push(titleEl?.textContent || '', onion, li.querySelector('p')?.textContent || '');
    if (out.length >= 40) return out;
  }
  if (out.length) return out;

  // 2) Fallback: any anchor that resolves to an onion address.
  for (const a of document.querySelectorAll('a')) {
    const onion = onionFrom(a.getAttribute('href') || '') || onionFromText(a.textContent || '');
    if (onion) push(a.textContent || '', onion, '');
    if (out.length >= 40) return out;
  }
  // 3) Last resort: any cite element carrying an onion host.
  for (const cite of document.querySelectorAll('cite')) {
    const onion = onionFromText(cite.textContent || '');
    if (onion) push(cite.textContent || '', onion, '');
    if (out.length >= 40) return out;
  }
  return out;
}

export async function searchDark(query) {
  const q = String(query || '').trim().slice(0, 120);
  if (!q) return { query: q, results: [], source: 'Ahmia' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(`https://ahmia.fi/search/?q=${encodeURIComponent(q)}`, {
      signal: ctl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`Ahmia returned HTTP ${res.status}`);
    const results = parseAhmia(await res.text());
    return { query: q, results, source: 'Ahmia' };
  } finally { clearTimeout(t); }
}
