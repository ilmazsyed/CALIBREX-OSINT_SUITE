import crypto from 'crypto';

export function validateReportDraft(input) {
  const content = typeof input?.content === 'string' ? input.content : '';
  if (!content.trim()) throw new Error('Report content is required.');
  if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) throw new Error('Report content exceeds the 1 MB limit.');
  const title = String(input?.title || 'Investigation report').trim().slice(0, 180) || 'Investigation report';
  return { title, content };
}

export function createReportVersion({ input, versions = [], actor, now = Date.now() }) {
  const { title, content } = validateReportDraft(input);
  const version = versions.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
  return { id: crypto.randomUUID(), version, title, content,
    contentHash: crypto.createHash('sha256').update(content, 'utf8').digest('hex'),
    status: 'DRAFT', createdAt: now, createdBy: actor, approvedAt: null, approvedBy: null };
}

export function transitionReportVersion(report, status, actor, now = Date.now()) {
  const next = String(status || '').toUpperCase();
  if (!['DRAFT', 'APPROVED', 'WITHDRAWN'].includes(next)) throw new Error('Unsupported report status.');
  if (report.status === 'WITHDRAWN' && next !== 'WITHDRAWN') throw new Error('Withdrawn report versions cannot be reopened; save a new version.');
  if (report.status === 'APPROVED' && next === 'DRAFT') throw new Error('Approved reports cannot be changed back to drafts; save a new version.');
  return { ...report, status: next,
    approvedAt: next === 'APPROVED' ? (report.approvedAt || now) : null,
    approvedBy: next === 'APPROVED' ? (report.approvedBy || actor) : null,
    withdrawnAt: next === 'WITHDRAWN' ? now : null,
    withdrawnBy: next === 'WITHDRAWN' ? actor : null };
}
