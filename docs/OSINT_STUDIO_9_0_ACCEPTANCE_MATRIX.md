# Calibrex OSINT Studio 9.0 — Acceptance Matrix

This matrix is the release evidence register. Status must be updated only from test output or reviewed implementation evidence. A merged PR alone is not proof of production readiness.

| ID | Area | Acceptance test | Required evidence | Initial status |
|---|---|---|---|---|
| REP-01 | Report snapshot | Generate report from a fixed case revision and verify revision and ledger head are embedded | Automated test + artifact inspection | NOT RUN |
| REP-02 | Evidence citations | Every report evidence reference resolves to an item in the same snapshot | Automated positive/negative tests | NOT RUN |
| REP-03 | JSON export | Export canonical structured report with metadata, sections, references and caveats | Schema validation + round-trip test | PASS — export builder regression test passed in CI run 44615200888 |
| REP-04 | HTML export | Render escaped, self-contained HTML; malicious evidence text cannot execute | XSS regression test + output inspection | PASS — escaping regression test passed in CI run 44615200888; multilingual fixture added, awaiting exact-head CI |
| REP-05 | DOCX export | Generate valid OOXML document with Unicode and report metadata | Open/parse test + Bengali/Hindi/English fixtures | NOT RUN |
| REP-06 | PDF export | Verify pagination, annexures, hashes, map index and multilingual glyph coverage | PDF parser + visual inspection | PARTIAL — PDF renderer exists; Bengali/Hindi glyph acceptance and visual inspection not established |
| SRC-01 | Syndication | Cluster exact and near-duplicate articles while retaining original URLs | Synthetic fixture suite | PARTIAL — canonical URL, exact fingerprint, 3-token shingle Jaccard near-duplicate candidates and bounded pairwise workload tests added; exact-head CI pending; upstream web discovery and human adjudication remain unimplemented |
| SRC-02 | Upstream origin | Detect and display wire, press-release and quoted-source lineage where observable | Fixture suite + analyst review | NOT RUN |
| SRC-03 | Independence | Unknown lineage never counted as independent; domain count never substitutes for origin count | Unit tests | PASS — unknown origin remains explicitly unknown in CI run 44615200888; analyst adjudication remains separate |
| SRC-04 | Analyst adjudication | Accept/reject candidate lineage without mutating evidence records | Integration test + audit event | NOT RUN |
| GEO-01 | Provenance | Every mapped observation shows method, provider, source and timestamp certainty | UI/API test | PARTIAL — evidence map and metadata support exist |
| GEO-02 | Uncertainty | Candidate coordinates remain visually distinct from recorded evidence coordinates | UI regression test | PARTIAL — candidate review safeguards exist |
| GEO-03 | Imagery | Imagery layer displays date, sensor, provider, attribution and availability caveats | Provider fixture + UI test | PARTIAL — NASA GIBS overlay exists |
| GEO-04 | GIS export | GeoJSON/KML preserve coordinate order, evidence IDs, timestamps and uncertainty | Automated schema/fixture tests | PARTIAL — export modules exist |
| ENT-01 | Graph provenance | Every edge resolves to source evidence and relationship type | Graph integrity tests | PARTIAL — graph generation exists |
| ENT-02 | Candidate safety | Candidate links and entity matches do not silently merge entities | Negative integration tests | PARTIAL — candidate-only matching exists |
| UX-01 | Save/revision | Save, reload and resume case without losing notes, evidence or revision history | Browser E2E test | NOT RUN |
| UX-02 | Approvals | Unauthorized roles cannot approve; authorized actions are audited | Role matrix E2E test | NOT RUN |
| UX-03 | Report library | Analyst can find, preview, compare and export report versions | Browser E2E test | NOT RUN |
| SEC-01 | Tenant isolation | Cross-workspace reads/writes denied for all case and report resources | Negative API suite | NOT RUN |
| SEC-02 | Integrity | Tampering with evidence or ledger head is detected | Tamper test | PARTIAL — ledger verification exists; release-scale test required |
| OPS-01 | Persistence | Restart and restore preserve case, report, ledger and source-health state | Staging drill | NOT RUN |
| OPS-02 | Load/soak | Documented concurrent analyst workload completes within agreed latency/error budget | Staging test report | NOT RUN |
| OPS-03 | Source resilience | Failed sources retain last-good data and visibly report stale/degraded status | Fault-injection test | NOT RUN |
| REL-01 | Exact SHA CI | Dependency audit, tests, typecheck and production build pass on release candidate SHA | CI run URL and SHA | NOT RUN |
| REL-02 | Staging | Smoke, security, persistence, rollback and analyst acceptance pass on same SHA | Staging sign-off | NOT RUN |
| REL-03 | Production approval | Explicit release decision recorded after staging | Release approval record | NOT RUN |

## Status definitions

- **PASS:** reproducible evidence exists for the exact release SHA.
- **PARTIAL:** capability exists but the stated acceptance test is incomplete.
- **FAIL:** test ran and failed.
- **NOT RUN:** no qualifying evidence exists.
- **BLOCKED:** cannot be tested because a documented dependency is unavailable.

Never convert PARTIAL or NOT RUN into PASS based on a feature description, code merge or successful unrelated CI run.
