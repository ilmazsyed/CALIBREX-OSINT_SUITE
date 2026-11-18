// Shared query relevance and freshness ranking for user-initiated intelligence searches.
// Relevance is a gate; recency orders the relevant evidence. This never scores truth.
const STOP = new Set('a an the of in on at to for from by with and or but is are was were be been as that this these those it its into over after before about amid says said report reports news latest how why what who will would could may might has have had not no than more most happening situation developments development update updates analysis'.split(' '));
const normal = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const terms = value => [...new Set(normal(value).split(/\s+/).filter(t => (t.length > 2 || /^[\p{L}\p{N}]{2,3}$/u.test(t)) && !STOP.has(t)))];
const timestamp = value => {
 const n = Number(value);
 if (!Number.isFinite(n) || n <= 0) return null;
 return n < 1e12 ? n * 1000 : n;
};
export function scoreQueryRelevance(item, query) {
 const q = normal(query), queryTerms = terms(query);
 if (!queryTerms.length) return { score: 1, matchedTerms: [], missingTerms: [], band: 'RELEVANT' };
 const title = normal(item?.title), body = normal([item?.summary,item?.text,item?.articleText,item?.description].filter(Boolean).join(' '));
 const all = title + ' ' + body;
 const matchedTerms = queryTerms.filter(t => all.split(' ').includes(t));
 const titleMatches = queryTerms.filter(t => title.split(' ').includes(t));
 const phrase = q.length >= 5 && (title.includes(q) || body.includes(q));
 const coverage = matchedTerms.length / queryTerms.length;
 const titleCoverage = titleMatches.length / queryTerms.length;
 const score = Math.min(1, coverage * .72 + titleCoverage * .18 + (phrase ? .1 : 0));
 const minimumMatches = queryTerms.length <= 2 ? 1 : Math.max(2, Math.ceil(queryTerms.length * .3));
 const relevant = phrase || matchedTerms.length >= minimumMatches && (coverage >= .3 || titleCoverage >= .25);
 return { score: Number(score.toFixed(3)), matchedTerms, missingTerms: queryTerms.filter(t => !matchedTerms.includes(t)), band: relevant ? (coverage >= .65 || phrase ? 'RELEVANT' : 'PARTIAL') : 'UNRELATED' };
}
export function rankQueryResults(items, query, window = '7d', now = Date.now()) {
 const days = ({'1d':1,'3d':3,'7d':7,'30d':30})[window] || 7;
 const cutoff = now - days * 86400000;
 const scored = (Array.isArray(items) ? items : []).map(item => {
  const relevance = scoreQueryRelevance(item, query);
  const publishedMs = timestamp(item?.published ?? item?.publishedAt ?? item?.date);
  const inWindow = publishedMs !== null && publishedMs >= cutoff && publishedMs <= now + 86400000;
  return { ...item, relevanceScore: relevance.score, relevanceBand: relevance.band, matchedTerms: relevance.matchedTerms, missingTerms: relevance.missingTerms, freshness: publishedMs === null ? 'DATE_UNVERIFIED' : inWindow ? 'IN_WINDOW' : publishedMs < cutoff ? 'OUT_OF_WINDOW' : 'FUTURE_DATED', _publishedMs: publishedMs };
 }).filter(item => item.relevanceBand !== 'UNRELATED' && item.freshness !== 'OUT_OF_WINDOW' && item.freshness !== 'FUTURE_DATED');
 return scored.sort((a,b) => (b._publishedMs || 0) - (a._publishedMs || 0) || b.relevanceScore - a.relevanceScore)
  .map(({_publishedMs,...item})=>item);
}
