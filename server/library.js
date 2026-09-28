// Library: search and filter across everything currently ingested (the live
// item window held in memory), so an analyst can answer "show me everything on
// X" instead of only browsing the latest cycle. Pure over a supplied item list.
const SEV_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

/** Every whitespace-separated word in the query must appear (substring, case-insensitive). */
function makeMatcher(q) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  if (!words.length) return () => true;
  return hay => { const h = hay.toLowerCase(); return words.every(w => h.includes(w)); };
}

/**
 * Filter + sort ingested items.
 * @param {Array} items feed snapshot items
 * @param {object} opts { q, wires: string[], minSeverity, source, from, to, limit }
 */
export function searchLibrary(items, opts = {}) {
  const { q = '', wires = [], minSeverity = 'LOW', source = '', from = 0, to = 0, limit = 300 } = opts;
  const match = makeMatcher(q);
  const wireSet = Array.isArray(wires) && wires.length ? new Set(wires) : null;
  const minRank = SEV_RANK[minSeverity] ?? 0;
  const src = String(source || '').toLowerCase().trim();
  const fromMs = Number(from) || 0;
  const toMs = Number(to) || 0;

  const results = (items || []).filter(it => {
    if (wireSet && !wireSet.has(it.wire)) return false;
    if ((SEV_RANK[it.severity] ?? 0) < minRank) return false;
    if (src && !String(it.source || '').toLowerCase().includes(src)) return false;
    if (fromMs && it.published < fromMs) return false;
    if (toMs && it.published > toMs) return false;
    return match(it.summary ? `${it.title} ${it.summary}` : it.title);
  });

  results.sort((a, b) => b.published - a.published);
  return {
    total: results.length,
    results: results.slice(0, Math.min(Number(limit) || 300, 500)).map(it => ({
      id: it.id, title: it.title, summary: it.summary || '', source: it.source, sourceId: it.sourceId || null,
      kind: it.kind, url: it.url, published: it.published, wire: it.wire, severity: it.severity,
      place: it.place ? { name: it.place.name, lat: it.place.lat, lng: it.place.lng } : null,
    })),
  };
}
