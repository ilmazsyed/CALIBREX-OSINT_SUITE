// Public-source, strategic-level defence reference records.
// This is an evidence register, not a live order-of-battle or operational tracking feed.
const TYPES = new Set(['ORGANISATION', 'UNIT', 'PLATFORM', 'INSTALLATION', 'EXERCISE', 'PROCUREMENT', 'CAPABILITY', 'EVENT']);
const STATES = new Set(['UNVERIFIED', 'CANDIDATE', 'REVIEWED', 'CONTRADICTED', 'ARCHIVED']);
const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const list = (value, max = 30) => Array.isArray(value) ? value.slice(0, max) : [];
const timestamp = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};
const safeUrl = value => {
  try { const u = new URL(String(value)); return ['https:', 'http:'].includes(u.protocol) ? u.toString() : ''; }
  catch { return ''; }
};

/** Validate one source-backed, strategic-level public reference record. */
export function validateDefenceRecord(input = {}) {
  const id = clean(input.id, 120);
  const name = clean(input.name, 200);
  const type = clean(input.type, 32).toUpperCase();
  if (!id || !name || !TYPES.has(type)) throw new Error('A stable id, name and supported defence record type are required.');
  const evidence = list(input.evidence, 40).map((item, index) => ({
    id: clean(item?.id || 'source-' + index, 120),
    url: safeUrl(item?.url),
    publisher: clean(item?.publisher, 160),
    sourceType: ['OFFICIAL', 'RESEARCH', 'MEDIA', 'SOCIAL', 'DATASET', 'OTHER'].includes(String(item?.sourceType).toUpperCase()) ? String(item.sourceType).toUpperCase() : 'OTHER',
    publishedAt: timestamp(item?.publishedAt),
    capturedAt: timestamp(item?.capturedAt),
    note: clean(item?.note, 500)
  })).filter(x => x.url);
  const state = STATES.has(String(input.state).toUpperCase()) ? String(input.state).toUpperCase() : 'UNVERIFIED';
  const validFrom = timestamp(input.validFrom), validTo = timestamp(input.validTo);
  if (validFrom && validTo && validTo < validFrom) throw new Error('validTo cannot precede validFrom.');
  const country = clean(input.country, 3).toUpperCase();
  return {
    id, name, type, country: /^[A-Z]{2,3}$/.test(country) ? country : null,
    parentId: clean(input.parentId, 120) || null,
    aliases: [...new Set(list(input.aliases, 20).map(x => clean(x, 120)).filter(Boolean))],
    description: clean(input.description, 1200),
    attributes: Object.fromEntries(Object.entries(input.attributes && typeof input.attributes === 'object' && !Array.isArray(input.attributes) ? input.attributes : {})
      .slice(0, 30).map(([key, value]) => [clean(key, 60), clean(value, 300)]).filter(([key]) => key)),
    state, confidence: Math.max(0, Math.min(100, Number(input.confidence) || 0)),
    validFrom, validTo, observedAt: timestamp(input.observedAt),
    evidence,
    missing: [
      ...(!country ? ['country not specified'] : []),
      ...(!evidence.length ? ['no usable public source URL'] : []),
      ...(!validFrom ? ['valid-from date unknown'] : []),
      ...(!input.description ? ['description not supplied'] : [])
    ],
    reviewRequired: state !== 'REVIEWED' || evidence.length === 0,
    scope: 'OPEN_SOURCE_STRATEGIC_REFERENCE',
    limitations: ['Public-source record only; not a validated current force disposition.',
      'No tactical location, readiness, targeting or operational availability is inferred.']
  };
}

/** Build a time-aware catalogue summary without filling missing values. */
export function buildDefenceRegistry(records = [], options = {}) {
  const rows = list(records, 2000).map(row => validateDefenceRecord(row));
  const byId = new Map();
  for (const row of rows) byId.set(row.id, row);
  const filtered = options.country ? rows.filter(x => x.country === clean(options.country, 3).toUpperCase()) : rows;
  const ordered = filtered.sort((a, b) => (b.observedAt || b.validFrom || 0) - (a.observedAt || a.validFrom || 0));
  return {
    schemaVersion: 1, generatedAt: Date.now(), records: ordered,
    summary: {
      total: ordered.length,
      byType: Object.fromEntries([...TYPES].map(type => [type, ordered.filter(x => x.type === type).length])),
      byState: Object.fromEntries([...STATES].map(state => [state, ordered.filter(x => x.state === state).length])),
      sourceBacked: ordered.filter(x => x.evidence.length > 0).length,
      reviewRequired: ordered.filter(x => x.reviewRequired).length,
      missingTemporalValidity: ordered.filter(x => !x.validFrom).length,
      unresolvedParentReferences: ordered.filter(x => x.parentId && !byId.has(x.parentId)).length
    },
    limitations: ['Record counts are catalogue coverage, not force strength or readiness.',
      'A reviewed record is an analyst-reviewed source record, not an independently certified fact.',
      'Absence from this registry is not evidence that a capability, unit or installation does not exist.']
  };
}

/** Merge one validated record into a bounded registry, preserving unrelated entries. */
export function upsertDefenceRegistryRecord(current = [], input = {}) {
  const existing = list(current, 500).map(validateDefenceRecord);
  const incoming = validateDefenceRecord(input);
  const records = new Map(existing.map(row => [row.id, row]));
  if (!records.has(incoming.id) && records.size >= 500) throw new Error('The registry is limited to 500 records.');
  records.set(incoming.id, incoming);
  return [...records.values()];
}
