// Entity intelligence: keyless public-source enrichment for a person or org.
// Combines a Wikidata/Wikipedia profile with OpenSanctions screening and the
// built-in OFAC screen, so analysts (and the AI agent) can resolve "who/what is
// this" from public records. All network calls go through the hardened safeFetch
// (DNS-pinned, SSRF-blocked, timeout + per-host concurrency) and fail soft.
import { safeFetch, readBody } from './article.js';
import { screen as ofacScreen } from './sanctions.js';

async function jsonGet(url, { timeoutMax = 2_000_000 } = {}) {
  const { res } = await safeFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
  const body = await readBody(res, timeoutMax, { truncate: true });
  return JSON.parse(body);
}

// ---- pure parsers (unit-tested) -------------------------------------------
export function parseWikidataSearch(json) {
  return (json?.search || []).slice(0, 6).map(s => ({
    id: s.id, label: s.label || '', description: s.description || '',
    url: s.concepturi || (s.id ? `https://www.wikidata.org/wiki/${s.id}` : ''),
  })).filter(x => x.id);
}
export function parseWikipediaSummary(json) {
  if (!json || json.type === 'disambiguation') return null;
  return {
    title: json.title || '', summary: (json.extract || '').slice(0, 1200),
    url: json.content_urls?.desktop?.page || json.content_urls?.mobile?.page || '',
    thumbnail: json.thumbnail?.source || '',
  };
}
export function parseOpenSanctions(json) {
  return (json?.results || []).slice(0, 8).map(r => {
    const p = r.properties || {};
    const first = k => Array.isArray(p[k]) ? p[k][0] : p[k];
    return {
      name: r.caption || first('name') || '', type: r.schema || 'Entity',
      topics: (p.topics || []).slice(0, 6),
      countries: (p.country || []).slice(0, 4),
      datasets: (r.datasets || []).slice(0, 8),
      program: (p.program || []).slice(0, 3).join(', '),
      score: typeof r.score === 'number' ? Math.round(r.score * 100) : null,
      list: 'OpenSanctions', id: r.id || '',
    };
  }).filter(x => x.name);
}

// ---- network wrappers (fail soft) -----------------------------------------
export async function wikidataProfile(name) {
  try {
    const search = parseWikidataSearch(await jsonGet(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=6&search=${encodeURIComponent(name)}`));
    if (!search.length) return null;
    const top = search[0];
    let wiki = null;
    try { wiki = parseWikipediaSummary(await jsonGet(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top.label || name)}`)); } catch { /* no page */ }
    return { label: top.label, description: top.description, wikidataUrl: top.url, wikipedia: wiki, alternates: search.slice(1, 4) };
  } catch { return null; }
}
export async function openSanctionsSearch(name) {
  try { return parseOpenSanctions(await jsonGet(`https://api.opensanctions.org/search/default?limit=8&q=${encodeURIComponent(name)}`)); }
  catch (e) { return { unavailable: true, reason: e.status === 401 || e.status === 403 ? 'OpenSanctions requires an API key for this deployment.' : 'OpenSanctions is unreachable.' }; }
}

/** Unified entity dossier from public records. */
export async function entityProfile(name) {
  const q = String(name || '').trim().slice(0, 200);
  if (q.length < 2) return { query: q, error: 'Name too short.' };
  const [profile, openSanc] = await Promise.all([wikidataProfile(q), openSanctionsSearch(q)]);
  let ofac = { matches: [] };
  try { ofac = ofacScreen(q); } catch { /* */ }
  const sanctions = [
    ...(Array.isArray(openSanc) ? openSanc : []),
    ...(ofac.matches || []).map(m => ({ ...m, countries: [], topics: [], datasets: [m.list] })),
  ];
  return {
    query: q,
    profile: profile || null,
    sanctions,
    sanctionsUnavailable: openSanc && openSanc.unavailable ? openSanc.reason : null,
    flagged: sanctions.length > 0,
    checkedAt: Date.now(),
    caveat: 'Public-source enrichment. A name match is a lead to verify, not a determination; confirm identity and context before acting.',
  };
}
