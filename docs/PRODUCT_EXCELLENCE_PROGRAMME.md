# Calibrex OSINT Studio — Product Excellence Programme

**Objective:** evolve OSINT Studio from a broad OSINT application into a dependable intelligence operations platform for corporate security, supply-chain risk, geopolitical analysis, defence research, investigations and journalism.

This is an engineering programme and acceptance framework, not a claim that planned controls are already delivered. Work is sequenced around trust, analyst utility and operational reliability before adding more surface area.

## Product principles

1. **Evidence before assertion.** Every material assessment links to source records, collection time, publication time, provenance and known limitations.
2. **Analyst remains accountable.** Algorithms surface candidates, explain signals and preserve alternatives; they do not autonomously identify people, attribute attacks or declare claims true.
3. **Freshness is visible.** A source that is stale, degraded, restricted or unavailable must never look live.
4. **One investigation, one coherent workspace.** Collection, triage, entity resolution, timelines, geospatial context, assessment, tasking and dissemination should share the same case context.
5. **Secure by default.** Tenant boundaries, least privilege, approval gates, auditability and data lifecycle controls are server-enforced.
6. **Progressive complexity.** Individual users get a useful guided experience without managing API keys. Enterprise users retain advanced provider credentials, API access, governance and custom entitlements.
7. **Provider neutrality.** Preserve existing Claude, OpenAI, Gemini/OpenRouter and publishing integrations. MCP is an additional interface, not a replacement.

## Priority 0 — Release integrity and production truth

- Run CI on the exact release SHA; retain completed test evidence.
- Keep verification runs from being silently cancelled by newer pushes.
- Add a manual workflow-dispatch path for controlled verification.
- Run staging smoke tests against production-like persistence.
- Record deployment SHA, migration status, source health and rollback target.
- Publish a release manifest: build, tests, dependency findings, known limitations and deployment state.

**Acceptance:** a release cannot be marked verified unless tests, typecheck, build, dependency review and staging smoke all report explicit results for the same SHA.

## Priority 1 — Intelligence workbench (core differentiator)

Build one case-centred workflow:
- Intelligence requirements and priority intelligence requirements (PIRs).
- Saved searches and source subscriptions attached to a case.
- Evidence inbox with duplicate/syndication grouping and analyst triage.
- Entity register with aliases, identifiers, source references and analyst-approved merges.
- Event timeline with time-zone-aware publication/collection timestamps.
- Link analysis and geospatial layers that open the underlying evidence.
- Structured assessments: key judgements, confidence, assumptions, alternatives, indicators and review dates.
- Tasks, owners, due dates, review/approval and case activity history.
- One-click brief generation with evidence footnotes and explicit caveats.

**Acceptance:** a user can go from requirement → collection → triage → corroboration → assessment → review → brief without copying records between modules.

## Priority 2 — Collection quality and source intelligence

- Source registry with ownership, source class, licence/terms note, geographic/topic coverage and configured cadence.
- Per-source freshness, success rate, latency, empty-valid vs failure state, throttling and last-good timestamp.
- Syndication and common-origin detection so copied stories do not count as independent corroboration.
- Language-aware deduplication and clustering across English, Bengali, Hindi and other configured languages.
- Query quality feedback: relevant/irrelevant labels, saved analyst corrections and benchmark sets.
- Source reliability and information credibility kept as separate, explainable analyst judgements.
- Coverage-gap reporting by region, language, domain and time window.

**Acceptance:** every alert and brief shows its evidence base, source independence caveat and collection freshness; source-health failures are observable and testable.

## Priority 3 — Alerting and early warning

- Rule builder for entity, event, geography, topic, severity, source class and time-window combinations.
- Baseline-aware anomaly detection with minimum sample sizes and seasonality controls.
- Alert explanation: what changed, why it triggered, which sources support it and what could invalidate it.
- Deduplication, grouping, suppression windows, escalation policies and acknowledgement.
- Delivery adapters with retries, idempotency, delivery receipts and dead-letter visibility.
- Alert quality metrics: precision samples, false-positive labels, time-to-detect and analyst acknowledgement.
- Human approval for external notifications and consequential actions.

**Acceptance:** alert replay tests demonstrate deterministic triggers, no duplicate sends, visible failures and auditable acknowledgement.

## Priority 4 — Cross-domain intelligence fusion

Unify existing news, chatter, markets, macro, sanctions, cyber, maritime, aviation, space, conflict, geospatial and infrastructure observations in a common observation model.

- Common entities, events, locations, indicators, source references and time semantics.
- Relationship types distinguish observed, asserted, inferred and analyst-confirmed links.
- Correlation views explain temporal/spatial co-occurrence without claiming causation.
- Scenario indicators and warning matrices for corporate, supply-chain, geopolitical and defence profiles.
- Domain adapters remain bounded by provider coverage, source terms and known latency.
- STIX 2.1 for cyber-relevant exchange; do not force every geopolitical or market observation into a cyber schema.

**Acceptance:** a fused picture can be traced back to the exact underlying observations and can be filtered by source, domain, geography and time.

## Priority 5 — Enterprise security, governance and scale

- Move collaborative workspaces, cases, evidence, alerts and audit events to transactional PostgreSQL-backed records.
- Enforce tenant scope in repository/data-access functions, not just route/UI filters.
- Complete negative cross-tenant tests for every read, write, export, search and background job.
- Define membership invitation, role change, offboarding, ownership transfer and support-access workflows.
- Use append-only audit events and externally anchored evidence-ledger checkpoints for higher-assurance deployments.
- Add retention, legal hold, export, deletion, backup and restore workflows.
- Add rate limits, per-tenant quotas, job queues, idempotency and back-pressure.
- Add observability for request latency, collection lag, provider errors, queue depth and alert delivery.
- Complete independent penetration test and privacy/legal review before regulated or sensitive deployments.

**Acceptance:** tenant-isolation matrix, restore drill, load/soak report, security test report and data lifecycle evidence are approved for the target deployment.

## Priority 6 — Analyst experience and onboarding

- Role-based home screens: journalist, corporate risk, supply chain, geopolitical, cyber and defence.
- Guided mission builder with plain-language requirements and preconfigured workflows.
- Unified command palette and global search across cases, entities, evidence, alerts and reports.
- Saved workspaces, configurable dashboards and keyboard-first triage.
- Responsive mobile analyst mode for reading, alert acknowledgement, notes and evidence capture.
- Explain every score and label in context; avoid opaque “AI confidence” numbers.
- In-product Academy with scenario-based exercises and sample datasets.
- Guided empty states and actionable source/provider error messages.

**Acceptance:** new pilot analysts complete a defined end-to-end workflow without developer intervention.

## Priority 7 — Interoperability and ecosystem

- Stable, versioned public API with OpenAPI contract and scoped API keys for enterprise plans.
- MCP resources/tools with least-privilege scopes, pagination, bounded outputs and clear error contracts.
- Webhooks for approved event delivery with signing, retries and replay protection.
- Import/export for CSV, JSON, PDF, STIX 2.1 and selected case formats.
- TAXII/MISP connectors only after explicit integration, licensing and security validation.
- Preserve optional BYO-provider keys and no-key sign-in integrations for individual/small users.

**Acceptance:** contract tests cover API/MCP compatibility, auth scopes, pagination, throttling and versioning.

## Product scorecard

Track these measures continuously; do not substitute feature counts for product quality:

- Collection freshness and source availability by source class.
- Query relevance and analyst-labelled precision.
- Duplicate/syndicated story rate.
- Alert precision sample, false-positive rate and time-to-acknowledge.
- Evidence completeness and percentage of judgements with supporting and contradicting evidence.
- Time from requirement to reviewed brief.
- Case collaboration and task completion.
- Cross-tenant negative-test coverage.
- API/MCP availability, p95 latency, error rate and throttling.
- Restore success and recovery time.
- Pilot analyst onboarding completion and weekly retained usage.

## Non-goals and safety boundaries

- No private-message interception, access-control bypass, covert surveillance or collection of protected personal data.
- No autonomous person identification, guilt determination, attack attribution or sanctions determination.
- No presentation of ADS-B/AIS, social posts, market correlations or geospatial clusters as independently verified facts.
- No claim of real-time completeness, classified-grade coverage, security certification or guaranteed SLA without evidence.
- No new mandatory API keys for ordinary users; no removal or regression of existing AI-provider or publishing integrations.

## Immediate engineering sequence

1. Stabilise exact-SHA CI and staging release evidence.
2. Audit the existing case, evidence and workspace persistence paths; design transactional tenant-scoped repositories and migrations.
3. Deliver the unified case-centred analyst workflow using existing modules.
4. Upgrade source-quality and syndication analysis.
5. Upgrade alert lifecycle and delivery observability.
6. Add enterprise load, isolation, recovery and security validation.
7. Refine guided UX and onboarding from pilot analyst testing.
