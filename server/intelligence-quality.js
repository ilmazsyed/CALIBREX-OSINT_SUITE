// Relevance and freshness ranking for intelligence observations.
// Ranking is a triage aid. It is not a truth, credibility, or attribution score.
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const STOP = new Set('the and for with from that this have has was were are but not you your about after before into over under says said report reports news today latest'.split(' '));
const terms = value => [...new Set((String(value || '').normalize('NFKC').toLowerCase().match(/[\\p{L}\\p{N}]{2,}/gu) || []).filter(x => !STOP.has(x)))];
const timestamp = value => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};
const domain = value => { try { return new URL(value).hostname.toLowerCase().replace(/^www\\./, ''); } catch { return ''; } };
export function assessObservationQuality(item = {}, options = {}) {
  const now = timestamp(options.now) ?? Date.now();
  const publishedAt = timestamp(item.publishedAt ?? item.published ?? item.published_at);
  const capturedAt = timestamp(item.capturedAt ?? item.captured_at) ?? now;
  const futureSkew = publishedAt !== null && publishedAt > now + 5 * 60 * 1000;
  const ageMs = publishedAt === null ? null : Math.max(0, now - Math.min(publishedAt, now));
  const halfLifeHours = clamp(Number(options.halfLifeHours) || 24, 1, 24 * 30);
  const freshness = ageMs === null ? 25 : Math.round(100 * Math.pow(0.5, ageMs / (halfLifeHours * 3600000)));
  const queryTerms = terms(options.query);
  const haystack = terms([item.title, item.summary, item.text, item.description, item.category, item.source].filter(Boolean).join(' '));
  const hay = new Set(haystack);
  const matchedTerms = queryTerms.filter(term => hay.has(term));
  const relevance = queryTerms.length ? Math.round(100 * matchedTerms.length / queryTerms.length) : 50;
  const sourceType = String(item.sourceType || item.kind || 'unknown').toLowerCase();
  const sourceTypeLabel = ({official:'Official / primary origin',primary:'Official / primary origin',news:'News publisher',social:'Public social observation',market:'Market data',sensor:'Sensor / telemetry'})[sourceType] || 'Unclassified source';
  const publisherDomain = domain(String(item.url || ''));
  const hasDirectSource = /^https?:\\/\\//i.test(String(item.url || ''));
  const missing = [];
  if (!publishedAt) missing.push('publication time unavailable');
  if (!hasDirectSource) missing.push('original source URL unavailable');
  if (!item.title && !item.summary && !item.text) missing.push('descriptive content unavailable');
  if (futureSkew) missing.push('publication timestamp is in the future; verify source clock');
  const ageHours = ageMs === null ? null : Math.round(ageMs / 360000) / 10;
  const nextAction = relevance < 20 ? 'REFINE_SEARCH' : !publishedAt || futureSkew ? 'VERIFY_METADATA' : freshness < 15 ? 'CHECK_FOR_UPDATE' : sourceType === 'social' ? 'CORROBORATE_BEFORE_RELIANCE' : 'OPEN_SOURCE_AND_TRIAGE';
  return { relevance, freshness, matchedTerms, queryTermCount: queryTerms.length, publishedAt, capturedAt, ageHours, futureSkew, publisherDomain, sourceType, sourceTypeLabel, metadataGaps: missing, nextAction, rankingNote: 'Triage ranking only. Freshness and query overlap do not establish accuracy, source credibility, independence or truth.' };
}
export function rankIntelligenceItems(items = [], options = {}) {
  const rows = (Array.isArray(items) ? items : []).slice(0, 1000).map((item, index) => {
    const quality = assessObservationQuality(item, options);
    const priority = Math.round(quality.relevance * 0.55 + quality.freshness * 0.45);
    return { ...item, intelligenceQuality: { ...quality, priority, rank: null }, _index: index };
  });
  rows.sort((a, b) => b.intelligenceQuality.priority - a.intelligenceQuality.priority || (b.intelligenceQuality.publishedAt || 0) - (a.intelligenceQuality.publishedAt || 0) || a._index - b._index);
  return rows.map((item, index) => { const { _index, ...clean } = item; return { ...clean, intelligenceQuality: { ...clean.intelligenceQuality, rank: index + 1 } }; });
}
