# OSINT Studio Intelligence Architecture — implementation baseline

This branch adds a first implementation layer for structured intelligence analysis. It is intentionally conservative: algorithms create candidates and review leads, never autonomous factual findings or attribution.

## Architecture

1. **Collection adapters** retain the original source item and provenance.
2. **Observation normalisation** labels source kind, category, domain, canonical URL and published/capture times.
3. **Pattern analysis** evaluates similar-text bursts, repeated URL sharing and hashtag bursts across distinct public author IDs and a bounded time window.
4. **Event candidate grouping** creates review-only groups from textual similarity. Analysts must confirm event identity, chronology, geography and source independence.
5. **Alert prioritisation** preserves severity, confidence, relevance, urgency and source support as separate dimensions. Priority is an operational queueing aid, not a truth probability.
6. **Investigation records** are per-user records with research questions, hypotheses, evidence and notes. The first API version uses existing user-scoped storage to avoid schema migrations and cross-tenant leakage.

## Evidence semantics

- FACT: directly established by the cited evidence.
- CLAIM: an assertion made by a source.
- ASSESSMENT: an analyst interpretation.
- HYPOTHESIS: an explanation being tested.
- UNKNOWN: a question that remains unresolved.

Evidence URLs are canonicalised and SHA-256 values are accepted only as syntactically valid fingerprints. A hash does not prove source authenticity or truth. Capture time and publication time remain separate.

## Social pattern semantics

- SIMILAR_TEXT_BURST: near-similar text from distinct author IDs.
- SHARED_URL_BURST: distinct authors sharing a canonical public URL.
- HASHTAG_BURST: distinct authors using the same hashtag in a bounded time window.

These are indicators for review. They do not establish coordination, common control, automation, malicious intent, identity, or truth. Account metadata must be collected only where the platform API and applicable law permit it. No private messages, protected posts, access-control bypass or covert collection is supported.

## API

Authenticated routes:
- GET /api/investigations
- POST /api/investigations
- GET /api/investigations/:id
- PUT /api/investigations/:id
- DELETE /api/investigations/:id
- GET /api/intelligence/patterns
- GET /api/intelligence/event-candidates

Records are isolated by authenticated user. The current version does not yet provide team sharing, immutable evidence storage, database-level audit events, or a graph database. Those remain release milestones.

## Standards and interoperability

For cyber threat intelligence interchange, design future export/import around OASIS STIX 2.1 and TAXII rather than inventing a proprietary cyber IOC format. STIX 2.1 models intelligence as linked objects and relationships, including observations and sightings. This is a cyber-intelligence interchange standard, not a universal schema for every market, geopolitical or logistics observation. Preserve a richer internal cross-domain model and map cyber-relevant subsets to STIX. See https://docs.oasis-open.org/cti/stix/v2.1/os/stix-v2.1-os.html.

## Production gates still required

- PostgreSQL-backed first-class investigations/evidence with migrations and transactional audit history.
- Team and tenant authorization tests before collaboration is enabled.
- Durable evidence capture, retention controls and legal review of platform/source licences.
- Semantic and multilingual models evaluated against a human-labelled benchmark.
- False-positive, precision/recall and drift measurement.
- Source-independence and syndication detection.
- UI integration for cases, graph, timeline, pattern review and alert explanations.
- Queueing, quotas, retention and observability under load.
- Staging tests with real API credentials, including X, and all existing provider/publishing/licensing regressions.

Do not describe the current pattern detectors as AI attribution or the investigation endpoints as a complete enterprise case-management system.


### Configurable alert rules and investigation revision history

- Alert rules are stored per authenticated user and can be created, edited, enabled/paused and deleted. Rules filter by intelligence category, minimum severity, keyword ANY/ALL logic and an explicit opt-in for unverified social observations.
- The live preview endpoint evaluates enabled rules against the current collection snapshot. Matches are triage candidates, not verified incidents; outbound push/webhook delivery is not implied by rule matching.
- Investigation updates retain up to 100 prior revisions per case with the prior case snapshot, actor user ID, timestamp and evidence/note counts. This is application-level revision history, not tamper-proof/WORM evidence custody or an independent audit ledger.


## Case-level entity and claim fusion update

Investigation records now support a bounded entity register and typed evidence relationships. Entity candidates extracted from evidence are deliberately limited to technical/public identifiers (domains, IPv4 addresses, email addresses, public account handles and hashtags); people and organisation names are not automatically resolved. Extracted candidates remain UNRESOLVED until an analyst reviews them and links source evidence.

Evidence relationships can be marked CORROBORATES, CONTRADICTS, RELATED_TO, SAME_EVENT, POSSIBLE_DUPLICATE or ASSOCIATED_WITH, with an assessment state and rationale. These are analyst-authored links; no relationship is inferred as fact.

A case-level fusion endpoint exposes saved entities, relationships and unresolved extracted candidates. The Investigation Studio can invoke the connected AI provider for multilingual synthesis across Bengali, Hindi and English. The synthesis is source-grounded and must cite numbered records; translation variants and narrative clusters remain analyst aids, not identity resolution or truth verification.

A conservative STIX 2.1 export endpoint is available for domain and IPv4 observables only. Exported indicators have zero confidence and explicit unresolved/review labels. This is not full STIX/TAXII support, does not export a complete case graph, and does not connect to a TAXII server or MISP instance.


## Evidence integrity and cross-case entity registry

Investigation evidence additions, edits and removals now append per-case SHA-256 ledger entries. Each entry includes the evidence digest, actor, timestamp, sequence number and previous-entry hash. Authenticated endpoints return the ledger and verify the chain; the Investigation Studio exposes a verification action.

This is application-level tamper evidence only. The ledger is stored in the same account data store as the case and is not WORM/immutable storage, independently timestamped, externally anchored or protected from an administrator who can rewrite both the ledger and its hashes. Ledgers are not truncated; appends stop at the 5,000-entry cap to preserve the chain root.

A per-account cross-case entity registry supports bounded entity records, aliases, confidence, source references and analyst-directed merges. Similar names remain separate by default; the UI lets an analyst publish case entities into the registry and merge selected records with the first selected record as the target. This is not a multi-user workspace or global cross-tenant graph. Registry records remain user-scoped.

The STIX 2.1 export now includes domain-name and IPv4 SCOs, observed-data objects, unresolved indicators, based-on relationships and a report object. Observation timestamps represent export time where source first-seen times are unavailable. This remains a limited case export, not TAXII transport, MISP interoperability, a full entity graph export or a maliciousness/attribution assertion.
