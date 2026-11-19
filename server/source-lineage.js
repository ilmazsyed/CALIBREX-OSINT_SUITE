import crypto from 'node:crypto';

const text = value => String(value ?? '').trim();
const host = value => {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
};
const canonicalUrl = value => {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid|ref|source)$/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch { return ''; }
};
const fingerprint = value => {
  const normalized = text(value).toLowerCase().replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  return normalized.length >= 160 ? crypto.createHash('sha256').update(normalized).digest('hex') : '';
};
const origin = record => {
  const explicit = text(record.upstreamOrigin || record.originalPublisher || record.syndicatedFrom || record.wireService || record.sourceAttribution).toLowerCase();
  return explicit ? 'declared:' + explicit : '';
};

export function analyzeSourceLineage(records = []) {
  const rows = (Array.isArray(records) ? records : []).slice(0, 500).map((record, index) => ({
    id: text(record?.id || 'record-' + index),
    title: text(record?.title).slice(0, 500),
    source: text(record?.source).slice(0, 200),
    url: text(record?.url).slice(0, 2000),
    host: host(record?.url),
    canonicalUrl: canonicalUrl(record?.canonicalUrl || record?.url),
    origin: origin(record || {}),
    contentFingerprint: fingerprint(record?.contentSnapshot || record?.articleText || record?.bodyText || ''),
    publishedAt: record?.publishedAt || record?.published || null
  }));
  const candidates = new Map();
  const add = (a, b, reason, strength) => {
    if (a.id === b.id) return;
    const ids = [a.id, b.id].sort();
    const key = ids.join('::');
    const current = candidates.get(key) || { evidenceIds: ids, signals: [], reviewRequired: true, independentCorroboration: false };
    if (!current.signals.some(x => x.reason === reason)) current.signals.push({ reason, strength });
    candidates.set(key, current);
  };
  const compareGroups = field => {
    const groups = new Map();
    for (const row of rows) {
      const key = row[field];
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    for (const group of groups.values()) {
      for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
        add(group[i], group[j], field === 'canonicalUrl' ? 'SAME_CANONICAL_URL' : field === 'contentFingerprint' ? 'EXACT_CONTENT_FINGERPRINT' : 'SHARED_DECLARED_UPSTREAM_ORIGIN', 'STRONG_CANDIDATE');
      }
    }
  };
  compareGroups('canonicalUrl');
  compareGroups('contentFingerprint');
  compareGroups('origin');
  const links = [...candidates.values()].map(candidate => ({
    ...candidate,
    signals: candidate.signals.sort((a, b) => a.reason.localeCompare(b.reason))
  }));
  const knownOrigins = new Set(rows.map(row => row.origin).filter(Boolean));
  const unknownOriginCount = rows.filter(row => !row.origin).length;
  return {
    recordCount: rows.length,
    knownDeclaredOriginCount: knownOrigins.size,
    unknownOriginCount,
    candidateRelationshipCount: links.length,
    candidateRelationships: links,
    records: rows.map(({ contentFingerprint, ...row }) => ({ ...row, contentFingerprintPresent: !!contentFingerprint })),
    caveats: [
      'A candidate relationship is not proof of common ownership, copying or editorial coordination.',
      'Different publisher domains do not establish independent reporting.',
      'Missing upstream attribution is unknown, not evidence of independence.',
      'Exact text fingerprints identify identical captured text only; paraphrases and shared underlying sources may remain undetected.',
      'Analyst review is required before any relationship affects corroboration judgements.'
    ]
  };
}
