// Deterministic, provenance-preserving projection of a case into an analyst graph.
// Explicit analyst relationships and machine-suggested candidates are different edge classes.
const list = (value, max = 1000) => Array.isArray(value) ? value.slice(0, max) : [];
const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const stableId = value => clean(value, 120).replace(/[^a-zA-Z0-9._:-]/g, '_');
const canonicalUrl = value => {
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return ''; }
};
const tokens = value => new Set((clean(value, 1200).normalize('NFKC').toLowerCase().match(/[\\p{L}\\p{N}]{3,}/gu) || []));
const overlap = (a, b) => {
  const left = tokens(a), right = tokens(b);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common++;
  return common / (left.size + right.size - common);
};

/**
 * Build a bounded graph view. No entity resolution or event identity is inferred.
 * Candidate edges are review leads and never count as corroboration.
 */
export function buildInvestigationGraph(input = {}, options = {}) {
  const maxNodes = Math.max(50, Math.min(3000, Number(options.maxNodes) || 1200));
  const maxEdges = Math.max(100, Math.min(6000, Number(options.maxEdges) || 3000));
  const nodes = new Map(), edges = new Map();
  const addNode = node => {
    if (!node.id || nodes.size >= maxNodes || nodes.has(node.id)) return;
    nodes.set(node.id, node);
  };
  const addEdge = edge => {
    if (!edge.id || edges.size >= maxEdges || edges.has(edge.id)) return;
    if (!nodes.has(edge.source) || !nodes.has(edge.target) || edge.source === edge.target) return;
    edges.set(edge.id, edge);
  };
  const entities = list(input.entities, 500);
  const evidence = list(input.evidence, 500);
  const hypotheses = list(input.hypotheses, 100);
  const requirements = list(input.priorityRequirements, 100);
  const evidenceIds = new Set(evidence.map(x => stableId(x.id)).filter(Boolean));
  const entityIds = new Set(entities.map(x => stableId(x.id)).filter(Boolean));

  for (const entity of entities) {
    const id = stableId(entity.id);
    if (!id) continue;
    addNode({ id: 'entity:' + id, type: 'ENTITY', label: clean(entity.name, 180) || 'Unnamed entity',
      entityType: clean(entity.type, 40).toUpperCase() || 'OTHER',
      resolution: ['UNRESOLVED', 'CANDIDATE', 'CONFIRMED'].includes(entity.resolution) ? entity.resolution : 'UNRESOLVED',
      confidence: Math.max(0, Math.min(100, Number(entity.confidence) || 0)),
      sourceEvidenceIds: list(entity.sourceEvidenceIds, 100).map(stableId).filter(x => evidenceIds.has(x)),
      notes: clean(entity.notes, 500) });
    for (const evidenceId of list(entity.sourceEvidenceIds, 100).map(stableId)) {
      if (evidenceIds.has(evidenceId)) addEdge({ id: 'entity-evidence:' + id + ':' + evidenceId,
        source: 'entity:' + id, target: 'evidence:' + evidenceId, type: 'SUPPORTED_BY',
        status: 'EXPLICIT_REFERENCE', reviewRequired: false });
    }
  }
  for (const item of evidence) {
    const id = stableId(item.id);
    if (!id) continue;
    addNode({ id: 'evidence:' + id, type: 'EVIDENCE', label: clean(item.title, 220) || 'Untitled evidence',
      evidenceType: clean(item.type, 40), assessment: clean(item.assessment, 30) || 'CLAIM',
      triage: clean(item.triage, 30) || 'NEW', url: canonicalUrl(item.url) || null,
      source: clean(item.source, 120), publishedAt: Number(item.published) || null,
      capturedAt: Number(item.capturedAt) || null, sha256: /^[a-f0-9]{64}$/i.test(item.sha256 || '') ? item.sha256 : null });
  }
  for (const relationship of list(input.relationships, 1000)) {
    const from = stableId(relationship.from), to = stableId(relationship.to);
    const source = entityIds.has(from) ? 'entity:' + from : evidenceIds.has(from) ? 'evidence:' + from : '';
    const target = entityIds.has(to) ? 'entity:' + to : evidenceIds.has(to) ? 'evidence:' + to : '';
    if (!source || !target) continue;
    const type = ['CORROBORATES', 'CONTRADICTS', 'RELATED_TO', 'SAME_EVENT', 'POSSIBLE_DUPLICATE', 'ASSOCIATED_WITH'].includes(relationship.type) ? relationship.type : 'RELATED_TO';
    addEdge({ id: 'relationship:' + stableId(relationship.id || from + ':' + to + ':' + type),
      source, target, type, status: 'ANALYST_RECORDED',
      assessment: ['OBSERVED', 'ASSESSED', 'HYPOTHESIS', 'UNKNOWN'].includes(relationship.assessment) ? relationship.assessment : 'UNKNOWN',
      rationale: clean(relationship.rationale, 800),
      sourceEvidenceIds: list(relationship.sourceEvidenceIds, 100).map(stableId).filter(x => evidenceIds.has(x)),
      reviewRequired: true });
  }
  for (let i = 0; i < hypotheses.length; i++) {
    const hypothesis = hypotheses[i], id = stableId(hypothesis.id || 'hypothesis-' + i);
    addNode({ id: 'hypothesis:' + id, type: 'HYPOTHESIS', label: clean(hypothesis.text, 220) || 'Unspecified hypothesis',
      status: ['SUPPORTED', 'CONTRADICTED', 'UNRESOLVED'].includes(hypothesis.status) ? hypothesis.status : 'UNRESOLVED',
      reviewRequired: true });
    for (const evidenceId of list(hypothesis.evidenceIds, 100).map(stableId)) if (evidenceIds.has(evidenceId))
      addEdge({ id: 'hypothesis-evidence:' + id + ':' + evidenceId, source: 'hypothesis:' + id,
        target: 'evidence:' + evidenceId, type: 'REFERENCES', status: 'EXPLICIT_REFERENCE', reviewRequired: false });
  }
  for (let i = 0; i < requirements.length; i++) {
    const requirement = requirements[i], id = stableId(requirement.id || 'pir-' + i);
    addNode({ id: 'pir:' + id, type: 'PIR', label: clean(requirement.title || requirement.question, 220) || 'Priority requirement',
      priority: clean(requirement.priority, 20).toUpperCase() || 'NORMAL',
      status: clean(requirement.status, 20).toUpperCase() || 'ACTIVE' });
  }

  // Conservative candidate links: exact canonical URL or high lexical title overlap.
  // These are explicitly non-corroborating and require analyst review.
  const rows = evidence.filter(x => stableId(x.id) && clean(x.title, 220));
  let candidateCount = 0;
  for (let i = 0; i < rows.length && candidateCount < 250; i++) {
    for (let j = i + 1; j < rows.length && candidateCount < 250; j++) {
      const left = rows[i], right = rows[j];
      const sameUrl = canonicalUrl(left.url) && canonicalUrl(left.url) === canonicalUrl(right.url);
      const score = overlap(left.title, right.title);
      if (!sameUrl && score < 0.82) continue;
      const a = stableId(left.id), b = stableId(right.id);
      addEdge({ id: 'candidate:' + a + ':' + b, source: 'evidence:' + a, target: 'evidence:' + b,
        type: sameUrl ? 'SHARED_SOURCE_CANDIDATE' : 'SIMILAR_TITLE_CANDIDATE',
        status: 'MACHINE_SUGGESTED', similarity: Number(score.toFixed(3)),
        independentCorroboration: false, reviewRequired: true,
        limitation: 'Candidate relationship only. Does not establish same event, copying, source independence, coordination or truth.' });
      candidateCount++;
    }
  }
  const nodeList = [...nodes.values()], edgeList = [...edges.values()];
  return { schemaVersion: 1, generatedAt: Date.now(), nodes: nodeList, edges: edgeList,
    summary: { nodeCount: nodeList.length, edgeCount: edgeList.length,
      entityCount: nodeList.filter(x => x.type === 'ENTITY').length,
      evidenceCount: nodeList.filter(x => x.type === 'EVIDENCE').length,
      hypothesisCount: nodeList.filter(x => x.type === 'HYPOTHESIS').length,
      pirCount: nodeList.filter(x => x.type === 'PIR').length,
      analystRecordedEdges: edgeList.filter(x => x.status === 'ANALYST_RECORDED').length,
      candidateEdges: edgeList.filter(x => x.status === 'MACHINE_SUGGESTED').length,
      truncated: entities.length + evidence.length + hypotheses.length + requirements.length > maxNodes || edgeList.length >= maxEdges },
    limitations: ['Graph projection is case-scoped and bounded; it is not a global entity-resolution database.',
      'Machine-suggested edges are review leads and never independent corroboration.',
      'Entity identity, event identity, attribution and relationship truth require analyst validation.'] };
}
