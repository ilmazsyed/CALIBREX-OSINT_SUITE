// Library: search and filter across everything currently ingested (the live
// item window held in memory), so an analyst can answer "show me everything on
// X" instead of only browsing the latest cycle. Pure over a supplied item list.
import { scoreQueryRelevance } from './query-relevance.js';
import { normaliseTimestamp } from './temporal.js';
const SEV_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

/**
 * Filter + rank ingested items.
 * @param {Array} items feed snapshot items
 * @param {object} opts { q, wires: string[], minSeverity, source, from, to, limit }
 *
 * Query matching is whole-token and relevance-gated. Recency is the primary
 * ordering among matches; a missing publication date is retained and labelled.
 */
export function searchLibrary(items, opts = {}) {
  const { q = '', wires = [], minSeverity = 'LOW', source = '', from = 0, to = 0, limit = 300 } = opts;
  const query = String(q || '').trim();
  const wireSet = Array.isArray(wires) && wires.length ? new Set(wires) : null;
  const minRank = SEV_RANK[minSeverity] ?? 0;
  const src = String(source || '').toLowerCase().trim();
  const fromMs = Number(from) || 0;
  const toMs = Number(to) || 0;

  const results = (items || []).filter(it => {
    if (wireSet && !wireSet.has(it.wire)) return false;
    if ((SEV_RANK[it.severity] ?? 0) < minRank) return false;
    if (src && !String(it.source || '').toLowerCase().includes(src)) return false;
    const published = normaliseTimestamp(it.published) || 0;
    if (fromMs && (!published || published < fromMs)) return false;
    if (toMs && (!published || published > toMs)) return false;
    return true;
  }).map(it => {
    const relevance = query ? scoreQueryRelevance(it, query) : { score: 1, matchedTerms: [], missingTerms: [], band: 'RELEVANT' };
    const published = normaliseTimestamp(it.published);
    return {
      ...it,
      relevanceScore: relevance.score,
      relevanceBand: relevance.band,
      matchedTerms: relevance.matchedTerms,
      missingTerms: relevance.missingTerms,
      freshness: published ? 'DATED' : 'DATE_UNVERIFIED',
      _published: published,
    };
  }).filter(it => it.relevanceBand !== 'UNRELATED');

  results.sort((a, b) => (b._published || 0) - (a._published || 0) || b.relevanceScore - a.relevanceScore);
  return {
    total: results.length,
    results: results.slice(0, Math.min(Number(limit) || 300, 500)).map(({ _published, ...it }) => ({
      id: it.id, title: it.title, summary: it.summary || '', source: it.source, sourceId: it.sourceId || null,
      kind: it.kind, url: it.url, published: it.published || null, wire: it.wire, severity: it.severity,
      place: it.place ? { name: it.place.name, lat: it.place.lat, lng: it.place.lng } : null,
      relevanceScore: it.relevanceScore, relevanceBand: it.relevanceBand,
      matchedTerms: it.matchedTerms, missingTerms: it.missingTerms, freshness: it.freshness,
    })),
  };
}
