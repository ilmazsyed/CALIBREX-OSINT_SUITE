# Calibrex OSINT Studio 9.0 — Coordinated Engineering Release

**Branch:** `release/osint-studio-9.0`  
**Base:** `main`  
**Release class:** coordinated engineering release candidate  
**Production policy:** no production deployment or credential/configuration changes from this branch.

## Release objective

Deliver a defensible, evidence-led intelligence production workflow from collection through verification, investigation, assessment, geospatial review and controlled dissemination. A 9/10 score is an acceptance target, not a pre-awarded product rating.

## Baseline already present on main

The following capabilities have landed and must be extended rather than reimplemented:

- Investigation report builder with executive overview, key judgements, methodology, evidence register, source reliability context, geospatial validation, source-independence relationship notes, contradictions, visual geolocation review, timeline, hypotheses, gaps and integrity caveats.
- Versioned report drafts with SHA-256 content hashes and DRAFT / APPROVED / WITHDRAWN transitions.
- Server-rendered branded PDF with evidence annexures and a schematic coordinate index.
- Case-specific evidence maps, optional NASA GIBS imagery overlay, GeoJSON and KML exports.
- Entity/evidence correlation candidates, unified case timeline, analyst-reviewed visual geolocation, and multimodal visual landmark leads.
- Module-level end-to-end acceptance coverage for validation, graph, report, GIS exports, report approval and PDF rendering.

These capabilities do not establish external source truth, independent geolocation, enterprise certification, production availability or full operational readiness.

## Workstreams and completion criteria

### P0 — Report production

1. Preserve the exact case revision and ledger head used to generate each report.
2. Add structured JSON and safe HTML exports from the same canonical report model.
3. Add DOCX export only with an approved, maintained document-generation dependency and regression coverage; do not hand-roll an incomplete OOXML package.
4. Validate every evidence reference against the report's case snapshot; flag missing, stale or unresolved references.
5. Add report completeness diagnostics for missing judgements, unlinked evidence, unassessed sources, unresolved contradictions, geospatial caveats and omitted annexure items.
6. Verify Unicode output for Bengali, Hindi and English in PDF and DOCX; do not silently replace unsupported glyphs.
7. Ensure report revision, approval state, content hash, generation metadata and export format are visible in the artifact.

### P0 — Source independence and corroboration quality

1. Normalize publisher URLs and canonical article identifiers.
2. Detect exact/near-duplicate article text and headline similarity as candidate clusters.
3. Preserve wire-service, press-release, quoted-source and upstream attribution signals.
4. Distinguish publisher domain diversity from independent origin diversity.
5. Represent unknown lineage explicitly; never count unknown as independent.
6. Explain every cluster signal and let analysts accept/reject candidate relationships.
7. Keep analyst adjudication, source reliability and claim confidence as separate concepts.
8. Do not automatically promote a claim to corroborated based only on outlet count or domain count.

### P1 — Geospatial Studio

1. Consolidate case evidence, event observations, imagery context and analyst location candidates into one map workspace.
2. Display coordinate method, precision/uncertainty, timestamp certainty, source/provider, acquisition date and attribution.
3. Separate recorded evidence coordinates from inferred/candidate locations.
4. Add dated imagery comparison and provenance metadata where the provider/licence permits.
5. Add location review queues for conflicts, missing provenance, stale imagery and weak reference diversity.
6. Keep GeoJSON/KML coordinate order, timestamps and evidence references regression-tested.
7. Make source availability, provider limits, licensing and missing imagery explicit.

### P1 — Entity intelligence graph

1. Provide analyst-filterable person, organisation, location, event, vessel, aircraft and infrastructure nodes where supported by evidence.
2. Show edge type, direction, provenance, evidence references, time bounds and confidence/verification status.
3. Distinguish confirmed analyst-recorded relationships from algorithmic candidates.
4. Support graph-to-evidence navigation and export of a documented JSON graph.
5. Prevent candidate entity merges from mutating source evidence or case assessments.

### P1 — Investigation UX

1. Provide one investigation workspace for evidence, entities, timeline, map, assessment, tasks and reports.
2. Make save state, revision, ledger validity, validation warnings and approval requirements visible.
3. Provide report library, preview, version comparison and export history.
4. Reduce approval friction without bypassing role permissions or audit events.
5. Preserve mobile usability and keyboard accessibility for critical workflows.

### P0 — Release assurance

1. Run dependency audit, server tests, typecheck and production client build on the exact candidate SHA.
2. Run end-to-end report/GIS/graph export tests and negative tests for invalid or missing evidence.
3. Test case revision locking, report snapshot consistency and immutable approved versions.
4. Test role matrix and cross-workspace access for cases, evidence, reports, graph and exports.
5. Test ledger tampering detection, restart persistence and backup/restore in isolated staging.
6. Run staged concurrency and soak tests with documented workload, latency and error budgets.
7. Verify source freshness, outage, recovery and cached-last-good behavior.
8. Verify rollback and post-deploy health checks in staging before any production release decision.

## Merge and deployment policy

- All implementation changes must land through reviewable pull requests targeting this release branch or a documented feature branch.
- CI must pass on the exact PR head before merge.
- Do not merge failing or unreviewed changes.
- Do not deploy this branch to production automatically.
- Production release requires a separate explicit approval after staging acceptance.
- Record exact commit SHAs and test artifacts in the release evidence.

## Public rating policy

Do not describe Calibrex as independently audited, certified, fully verified or 9/10 until the acceptance matrix is completed and reviewed. Public claims must distinguish implemented capabilities, measured test results and remaining limitations.

## Exit criteria

The release is eligible for a 9/10 reassessment only when every P0 gate passes, all P1 workstreams meet their defined acceptance criteria or have explicitly approved scope exclusions, staging acceptance is documented, and a reviewer can reproduce the test results from the release SHA.
