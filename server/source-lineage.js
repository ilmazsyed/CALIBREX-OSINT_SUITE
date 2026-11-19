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
const normalizeText = value => text(value).toLowerCase()
  .normalize('NFKC')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/https?:\/\/\S+/g, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const fingerprint = value => {
  const normalized = normalizeText(value);
  return normalized.length >= 160 ? crypto.createHash('sha256').update(normalized).digest('hex') : '';
};
const tokens = value => {
  const words = normalizeText(value).split(' ').filter(Boolean);
  const shingles = new Set();
  for (let i = 0; i < words.length; i++) {
    shingles.add(words.slice(i, i + 3).join(' '));
  }
  return shingles;
};
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  return intersection / (a.size + b.size - intersection);
};
const inferredOrigin = record => {
  const body = text(record.contentSnapshot || record.articleText || record.bodyText || '');
  const explicitWire = /\\b(Reuters|Associated Press|AP News|Agence France-Presse|AFP|Press Trust of India|PTI|Asian News International|ANI|Xinhua|DPA|Bloomberg)\\b/i.exec(body);
  if (explicitWire && /\\b(according to|reported by|via|source:|courtesy of|with inputs from|\\(\\s*)\\s*$/i.test(body.slice(Math.max(0,explicitWire.index-80),explicitWire.index))) {
    return explicitWire[1].toLowerCase().replace(/\\s+/g,' ');
  }
  const release = /(?:press release|media release)\\s+(?:from|by|issued by)\\s+([\\p{L}0-9& .'-]{3,80})/iu.exec(body);
  return release ? 'press-release:' + release[1].trim().toLowerCase().replace(/\\s+/g,' ') : '';
};
const origin = record => {
  const explicit = text(record.upstreamOrigin || record.originalPublisher || record.syndicatedFrom || record.wireService || record.sourceAttribution).toLowerCase();
  return explicit ? 'declared:' + explicit : '';
};

export function analyzeSourceLineage(records = [], options = {}) {
  const maxRecords = Math.min(500, Math.max(1, Number(options.maxRecords) || 500));
  const rows = (Array.isArray(records) ? records : []).slice(0, maxRecords).map((record, index) => {
    const body = text(record?.contentSnapshot || record?.articleText || record?.bodyText || '');
    const title = text(record?.title).slice(0, 500);
    return {
      id: text(record?.id || 'record-' + index),
      title,
      source: text(record?.source).slice(0, 200),
      url: text(record?.url).slice(0, 2000),
      host: host(record?.url),
      canonicalUrl: canonicalUrl(record?.canonicalUrl || record?.url),
      origin: origin(record || {}),\n      inferredOrigin: inferredOrigin(record || {}),
      contentFingerprint: fingerprint(body),
      bodyShingles: body.length >= 240 ? tokens(body) : new Set(),
      titleShingles: title.length >= 24 ? tokens(title) : new Set(),
      publishedAt: record?.publishedAt || record?.published || null
    };
  });
  const candidates = new Map();
  const add = (a, b, reason, strength, score = null) => {
    if (a.id === b.id) return;
    const ids = [a.id, b.id].sort();
    const key = ids.join('::');
    const current = candidates.get(key) || { evidenceIds: ids, signals: [], reviewRequired: true, independentCorroboration: false };
    if (!current.signals.some(x => x.reason === reason)) current.signals.push({ reason, strength, ...(score === null ? {} : { score: Number(score.toFixed(3)) }) });
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
        add(group[i], group[j], field === 'canonicalUrl' ? 'SAME_CANONICAL_URL' : field === 'contentFingerprint' ? 'EXACT_CONTENT_FINGERPRINT' : field === 'inferredOrigin' ? 'SHARED_TEXT_ATTRIBUTION_CANDIDATE' : 'SHARED_DECLARED_UPSTREAM_ORIGIN', 'STRONG_CANDIDATE');
      }
    }
  };
  compareGroups('canonicalUrl');
  compareGroups('contentFingerprint');
  compareGroups('origin');\n  compareGroups('inferredOrigin');

  // Bounded pairwise near-duplicate detection. Similarity is a lead, never an attribution verdict.
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.host && b.host && a.host === b.host && a.canonicalUrl === b.canonicalUrl) continue;
      const bodyScore = jaccard(a.bodyShingles, b.bodyShingles);
      const titleScore = jaccard(a.titleShingles, b.titleShingles);
      if (bodyScore >= 0.72) add(a, b, 'NEAR_DUPLICATE_BODY', 'REVIEW_CANDIDATE', bodyScore);
      else if (titleScore >= 0.82 && bodyScore >= 0.35) add(a, b, 'SIMILAR_HEADLINE_AND_BODY', 'REVIEW_CANDIDATE', Math.min(titleScore, bodyScore));
    }
  }

  const links = [...candidates.values()].map(candidate => ({
    ...candidate,
    signals: candidate.signals.sort((a, b) => a.reason.localeCompare(b.reason))
  }));
  const knownOrigins = new Set(rows.map(row => row.origin).filter(Boolean));
  const unknownOriginCount = rows.filter(row => !row.origin).length;
  return {
    recordCount: rows.length,
    truncated: Array.isArray(records) && records.length > rows.length,
    knownDeclaredOriginCount: knownOrigins.size,
    unknownOriginCount,
    candidateRelationshipCount: links.length,
    candidateRelationships: links,
    records: rows.map(({ contentFingerprint, bodyShingles, titleShingles, ...row }) => ({ ...row, contentFingerprintPresent: !!contentFingerprint })),
    caveats: [
      'A candidate relationship is not proof of common ownership, copying or editorial coordination.',
      'Near-duplicate similarity is a review lead; quotations, common templates and shared public facts can produce similarity.',
      'Different publisher domains do not establish independent reporting.',
      'Missing upstream attribution is unknown, not evidence of independence.',
      'Exact text fingerprints identify identical normalized captured text only; paraphrases and shared underlying sources may remain undetected.',
      'Text-derived wire-service or press-release attribution is a lead only; analyst review is required before any relationship affects corroboration judgements.',
      'Similarity detection is bounded to the supplied records and does not discover upstream sources on the open web.'
    ]
  };
}
