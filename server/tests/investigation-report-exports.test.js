import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvestigationReportJson, renderInvestigationReportHtml, validateReportEvidenceReferences } from '../investigation-report-exports.js';

const report = {
  id: 'report-1', title: 'Port assessment', version: 2, status: 'APPROVED',
  content: '# CALIBREX Report\n\nA claim from <script>alert(1)</script>.',
  contentHash: 'a'.repeat(64), caseRevision: 7, evidenceLedgerHead: 'b'.repeat(64),
  approvedAt: '2026-11-20T00:00:00.000Z', approvedBy: 'reviewer-1', evidenceCount: 9
};

test('JSON export preserves immutable report metadata and exact content', () => {
  const output = buildInvestigationReportJson({ report, investigationId: 'case-1', caseRevision: 7, evidenceCount: 3 });
  assert.equal(output.schemaVersion, 1);
  assert.equal(output.report.content, report.content);
  assert.equal(output.report.contentHash, report.contentHash);
  assert.equal(output.report.caseRevision, 7);
  assert.equal(output.investigation.evidenceCount, 9);
  assert.equal(output.export.immutableSource, 'saved-report-version');
});

test('HTML export escapes report content and metadata', () => {
  const html = renderInvestigationReportHtml({ report, investigationId: '<img src=x>', caseRevision: 7 });
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /Content SHA-256/);
  assert.match(html, /report version: 2/i);
});

test('export builders reject missing report content', () => {
  assert.throws(() => buildInvestigationReportJson({ report: { content: '' } }), /content is required/i);
  assert.throws(() => renderInvestigationReportHtml({ report: null }), /content is required/i);
});

test('JSON and HTML exports preserve Bengali, Hindi and English Unicode text', () => {
  const multilingual = { ...report, content: '# বাংলা প্রতিবেদন\n\nहिन्दी निष्कर्ष — English assessment' };
  const json = buildInvestigationReportJson({ report: multilingual, investigationId: 'case-ml', caseRevision: 7 });
  const html = renderInvestigationReportHtml({ report: multilingual, investigationId: 'case-ml', caseRevision: 7 });
  assert.match(json.report.content, /বাংলা প্রতিবেদন/);
  assert.match(json.report.content, /हिन्दी निष्कर्ष/);
  assert.match(html, /বাংলা প্রতিবেদন/);
  assert.match(html, /हिन्दी निष्कर्ष/);
  assert.match(html, /English assessment/);
});

test('evidence citations resolve against the same case evidence snapshot', () => {
  const result=validateReportEvidenceReferences('Supported by [E-123456789abc]. Missing [E-ffffffffffff].', [{id:'123456789abc-extra'}]);
  assert.equal(result.valid,false);
  assert.equal(result.resolvedCount,1);
  assert.deepEqual(result.missing,['E-ffffffffffff']);
});
test('ambiguous evidence reference prefixes are rejected', () => {
  const result=validateReportEvidenceReferences('[E-123456789abc]', [{id:'123456789abc-a'},{id:'123456789abc-b'}]);
  assert.equal(result.valid,false);
  assert.equal(result.ambiguous.length,1);
});

test('HTML export renders semantic report headings, lists and evidence tables', () => {
  const html=renderInvestigationReportHtml({report:{...report,content:'# Executive overview\n\nA **key** finding.\n\n- First item\n- Second item\n\n| Ref | Status |\n|---|---|\n| [E-123] | CLAIM |'}});
  assert.match(html,/<h1>Executive overview<\/h1>/);
  assert.match(html,/<strong>key<\/strong>/);
  assert.match(html,/<ul>/);
  assert.match(html,/<table>/);
  assert.match(html,/<span class="evidence-ref">E-123<\/span>/);
});
