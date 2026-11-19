# Intelligence Core Upgrade — engineering specification

## Purpose
Raise the reliability and defensibility of Calibrex OSINT Studio across source assessment, geospatial validation, reporting and workflow execution. The first implementation slice adds deterministic, dependency-free backend primitives. They are deliberately conservative: no algorithm turns a source score, coordinate, workflow status or AI summary into proof.

## Implemented in this branch
- `server/source-reliability.js`: explainable factor-based source reliability context, adjudicated history, temporal/provenance signals and cautious source-independence clustering.
- `server/geospatial-validation.js`: coordinate bounds, accuracy metadata, country/place/time discrepancy flags, haversine distance and competing-location detection.
- `server/investigation-workflow.js`: explicit case state machine, reviewer-only approval, bounded transition history and task validation.

These modules are intentionally pure and isolated pending integration with the existing API and UI. They do not yet change production routes or persisted case schemas.

## Required integration work
### Source reliability
1. Persist source identity, ownership group, syndication group, source type, collection method, capture timestamp and correction history.
2. Show factor explanations and data gaps beside every score; never display it as claim confidence.
3. Add analyst adjudication actions (confirmed, refuted, corrected, unresolved) with rationale and evidence IDs.
4. Detect common upstream sources, syndicated wire copy, shared press releases and quote-chain dependence before counting corroboration.
5. Recalculate on new adjudications; retain score version and assessment timestamp.

### Geospatial validation
1. Keep claimed location, resolved location, coordinates, accuracy radius, method, analyst and supporting evidence separate.
2. Add reverse-geocoding provider adapters with cache, rate limits and provider attribution.
3. Add image/video keyframe workflows: EXIF extraction, landmark/terrain matching, weather/shadow consistency and reverse-image search references.
4. Treat geolocation as a hypothesis until independently reviewed; show competing candidates and uncertainty radius.
5. Do not infer sensitive subject identity or precise private-person whereabouts.

### Reporting
1. One canonical report model consumed by PDF, TXT and future DOCX/HTML renderers.
2. Sections: executive summary, key judgements, scope/method, timeline, evidence register, source reliability, geospatial findings, entity/relationship graph, alternative hypotheses, contradictions, gaps, limitations and recommendations.
3. Every factual sentence must link to evidence IDs; unsupported narrative must be labelled assessment or hypothesis.
4. Preserve report version, author, reviewer, generated-at time, case revision and evidence-ledger head.
5. Add report quality gates: broken references, uncited claims, stale evidence, unresolved contradictions, missing limitations and unapproved status.
6. STIX remains a cyber-intelligence interchange export, not the human-readable investigation report.

### Workflow execution
1. Integrate state machine with existing authenticated case routes and user/team authorization.
2. Add tasks, owners, due dates, dependencies, checklists, run logs and retry-safe job IDs.
3. Require reviewer approval for finalisation and externally consequential actions.
4. Make each automated collection run reproducible: query, sources, time window, adapter/version, results, errors and evidence IDs.
5. Enforce per-tenant quotas, cancellation, backoff, idempotency and audit events.

## Release gates
- Unit tests for boundary coordinates, antimeridian distance, timestamp anomalies, source-history sparsity, syndication caveats, invalid transitions, reviewer permissions and task dependency errors.
- Integration tests for tenant isolation, authorization, case revision/ledger linkage, report evidence citations and PDF/TXT parity.
- No score may be labelled probability of truth or accuracy without a separately validated statistical model and benchmark.
- No deployment claim until CI, staging smoke tests and regression suites pass.
