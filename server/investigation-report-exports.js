const esc = value => String(value ?? '');
const htmlEscape = value => esc(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export function buildInvestigationReportJson({ report, investigationId, caseRevision, evidenceCount = 0 } = {}) {
  if (!report || typeof report.content !== 'string' || !report.content.trim()) {
    throw new Error('A saved report with content is required.');
  }
  return {
    schema: 'https://calibrex.org/schemas/investigation-report/v1',
    schemaVersion: 1,
    product: 'Calibrex OSINT Studio',
    report: {
      id: report.id || null,
      title: esc(report.title || 'Investigation report'),
      version: Number(report.version) || null,
      status: esc(report.status || 'UNKNOWN'),
      format: 'markdown',
      content: report.content,
      contentHash: esc(report.contentHash || ''),
      generatedAt: report.generatedAt || report.createdAt || null,
      approvedAt: report.approvedAt || null,
      approvedBy: report.approvedBy || null,
      caseRevision: Number(report.caseRevision ?? caseRevision) || null,
      evidenceLedgerHead: report.evidenceLedgerHead || null,
      quality: report.quality || null
    },
    investigation: {
      id: esc(investigationId || ''),
      revision: Number(caseRevision) || null,
      evidenceCount: Math.max(0, Number(evidenceCount) || 0)
    },
    export: {
      generatedAt: new Date().toISOString(),
      format: 'application/json',
      immutableSource: 'saved-report-version'
    }
  };
}

export function renderInvestigationReportHtml({ report, investigationId, caseRevision } = {}) {
  if (!report || typeof report.content !== 'string' || !report.content.trim()) {
    throw new Error('A saved report with content is required.');
  }
  const title = htmlEscape(report.title || 'Investigation report');
  const content = htmlEscape(report.content);
  const caseId = htmlEscape(investigationId || 'Not recorded');
  const revision = htmlEscape(report.caseRevision ?? caseRevision ?? 'Not recorded');
  const version = htmlEscape(report.version ?? 'Not recorded');
  const hash = htmlEscape(report.contentHash || 'Not recorded');
  return '<!doctype html>\n' +
    '<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>' + title + ' | Calibrex</title>' +
    '<style>' +
    ':root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#eef1f5;color:#17212b;font:15px/1.6 Inter,Arial,sans-serif}' +
    'header,main,footer{max-width:980px;margin:auto}header{padding:32px 40px 20px;border-bottom:3px solid #b51f2b;background:#101c2b;color:#fff}' +
    '.brand{font-size:12px;letter-spacing:.16em;font-weight:700;color:#e7bd69}h1{font-size:25px;line-height:1.2;margin:10px 0}' +
    '.meta{font-size:12px;color:#cbd5df;display:flex;gap:18px;flex-wrap:wrap}main{background:#fff;padding:34px 40px;min-height:70vh}' +
    'pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;color:#263442;margin:0}' +
    'footer{padding:18px 40px 30px;color:#586575;font-size:11px} @media(max-width:640px){header,main,footer{padding-left:18px;padding-right:18px}}' +
    '@media print{body{background:#fff}header{background:#101c2b!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}main{padding:22px 0}footer{padding:16px 0}}' +
    '</style></head><body><header><div class="brand">CALIBREX | INTELLIGENCE. EVIDENCE. CLARITY.</div>' +
    '<h1>' + title + '</h1><div class="meta"><span>Case: ' + caseId + '</span><span>Revision: ' + revision +
    '</span><span>Report version: ' + version + '</span></div></header><main><pre>' + content +
    '</pre></main><footer>Controlled intelligence product · Verify report approval and evidence ledger status before external reliance.<br>Content SHA-256: ' +
    hash + '</footer></body></html>';
}
