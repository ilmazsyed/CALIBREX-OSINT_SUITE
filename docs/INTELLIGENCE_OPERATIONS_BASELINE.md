# Calibrex Intelligence Operations — Industry Deployment Baseline

## Purpose
Calibrex OSINT Studio collects, organises, correlates and assesses open-source observations. It is an analyst-support system, not an autonomous attribution engine, classified source, flight-safety system, investment adviser or legal determination tool.

## End-to-end analyst workflow
1. Define the intelligence requirement, geography, time window, entities, decision owner and confidence threshold.
2. Collect from configured public feeds, news search, safe article extraction, social/community feeds, geospatial events, market/macro indicators, aircraft/space signals, maritime observations and sanctions datasets.
3. Preserve original URLs, source identity, published/collected timestamps, extraction limitations and evidence IDs. Treat source content as untrusted input.
4. Extract candidate entities, locations, dates, indicators and relationships. Keep unresolved candidates unresolved; do not silently merge identities.
5. Cluster similar reporting and compare independent publishers, time windows and domains. Similarity, co-occurrence and correlation are leads, not proof of causation or coordination.
6. Assess alternative hypotheses, source reliability, evidence quality, gaps, confidence and disconfirming evidence.
7. Monitor explicit watchlists and alert rules; distinguish threshold triggers from verified incidents. Record delivery and acknowledgement.
8. Disseminate evidence-linked briefs, timelines, maps and STIX exports with caveats, confidence, sources and review history.
9. Review forecast outcomes, false positives, missed events, source outages and collection gaps.

## MCP capability surface
MCP is an authenticated client interface over existing Calibrex services. Availability depends on granted OAuth scopes and deployment configuration.

**Collection and analysis:** `calibrex_search_intelligence`, `calibrex_get_collection_status`, `calibrex_read_article`, `calibrex_corroborate_claim`, `calibrex_analyze_social_chatter`, `calibrex_detect_social_patterns`, `calibrex_cluster_search_results`.

**Cross-domain observations:** `calibrex_situational_picture`, `calibrex_geospatial_events`, `calibrex_market_crisis_indicators`, `calibrex_airspace_and_space_signals`, `calibrex_maritime_picture`, `calibrex_conflict_picture`, `calibrex_screen_sanctions`.

**Investigations and evidence:** `calibrex_list_workspaces`, `calibrex_list_cases`, `calibrex_get_case`, `calibrex_prepare_case_change`, `calibrex_confirm_case_change`, `calibrex_extract_case_entities`, `calibrex_export_case_stix`.

Existing AI-provider credentials and publisher integrations remain separate and are not replaced by MCP.

## Analyst tradecraft
- Separate observation, source assertion, analyst inference and assessment.
- Record source and collection timestamps separately; expose stale or missing data.
- Copied syndication and repeated posts are not independent corroboration.
- Social similarity does not prove coordinated behaviour, common ownership or intent.
- Geospatial clusters are not confirmed incident counts or territorial-control assessments.
- AIS/ADS-B can be delayed, incomplete, spoofed or misattributed.
- Sanctions matches are potential matches only; resolve identity and current status against authoritative lists.
- Market correlations do not establish causality.
- Preserve dissenting evidence and alternative explanations.

## Security and governance acceptance
Before enterprise activation:
- Verify OAuth redirect allowlists, PKCE, token rotation/revocation, rate limits and least-privilege scopes.
- Test cross-tenant access for cases, workspaces, ledgers, watchlists, reports and exports.
- Verify viewer/analyst/admin/owner permissions on every read/write path.
- Test SSRF protections including redirects, private/link-local/metadata addresses, oversized responses and unsupported protocols.
- Encrypt secrets at rest; never return or log credentials; document rotation.
- Define retention, deletion, legal hold, backup, restore and incident response contractually.
- Audit privileged access, approvals, exports, source configuration and alert routing.
- Apply tenant/account quotas; process-local diagnostics are not billable usage metering.
- Complete independent penetration testing and privacy review before regulated or sensitive customer deployments.

## Production release gates
1. CI dependency audit, typecheck, automated tests and production build pass.
2. Staging smoke test against production-like persistence.
3. Tenant-isolation and role-matrix tests, including negative cases.
4. SSRF, injection, XSS, CSRF, OAuth replay and rate-limit tests.
5. Load/soak tests with documented concurrency, latency and failure budgets.
6. Restore drill and evidence-ledger integrity verification.
7. Source freshness, outage and recovery checks; stale data visible.
8. Alert delivery, retry and dead-letter tests.
9. Analyst acceptance of investigations, evidence and report exports.
10. Runbook, support escalation, monitoring and rollback owner assigned.

## Release boundary
The repository includes live collection and specialist domain modules, investigation workspaces, evidence-ledger support, watch/alert mechanisms, and MCP access to selected read-only domain snapshots plus approval-gated case changes. MCP exposes existing engines; it does not create new licensed data entitlements or guarantee coverage.

Source licensing/geographic completeness, social platform constraints, formal SLA/uptime, independent security certification, tested tenant-scale performance, contractual retention/deletion guarantees, automated billing metering and customer-specific incident response remain deployment-specific or require validation. Do not market them as delivered until evidenced.

## Verification commands
```bash
npm ci --include=dev
npm audit --omit=dev --audit-level=low
npm run typecheck
npm test
npm run build
node scripts/staging-smoke.mjs
```
