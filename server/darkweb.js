// Dark-web search: queries Ahmia (ahmia.fi), a legitimate clearnet search engine
// that indexes .onion sites and filters abuse material. We surface the INDEX
// only — titles, onion addresses and snippets — and never fetch onion content.
// A gated tool (see sensitive.js). Surfacing a public search index is lawful;
// visiting results requires proper authorization and OPSEC, which is on the user.
import { parseHTML } from 'linkedom';

const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 20000;

/** Extract the real .onion target from an Ahmia redirect href. */
function onionFrom(href) {
  if (!href) return '';
  try {
    const m = href.match(/redirect_url=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch { /* ignore */ }
  const direct = href.match(/https?:\/\/[a-z2-7]{16,56}\.onion[^\s"']*/i);
  return direct ? direct[0] : '';
}

/** Parse an Ahmia results page into {title, onion, description}. */
export function parseAhmia(html) {
  const { document } = parseHTML(html);
  const out = [];
  for (const li of document.querySelectorAll('li.result, .result')) {
    const a = li.querySelector('h4 a, a');
    if (!a) continue;
    const title = (a.textContent || '').trim();
    const onion = onionFrom(a.getAttribute('href') || '');
    const desc = (li.querySelector('p')?.textContent || '').trim().slice(0, 300);
    if (title && onion) out.push({ title: title.slice(0, 200), onion, description: desc });
    if (out.length >= 40) break;
  }
  return out;
}

export async function searchDark(query) {
  const q = String(query || '').trim().slice(0, 120);
  if (!q) return { query: q, results: [], source: 'Ahmia' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(`https://ahmia.fi/search/?q=${encodeURIComponent(q)}`, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const results = parseAhmia(await res.text());
    return { query: q, results, source: 'Ahmia' };
  } finally { clearTimeout(t); }
}
