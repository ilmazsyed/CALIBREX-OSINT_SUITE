# Release 5 — Cross-domain acceptance and hardening

## Changes in this release
- Shared timestamp helper normalises Unix seconds and milliseconds and distinguishes FRESH, STALE, FUTURE_DATED and DATE_UNVERIFIED. News search, Library date filters and specialist observation publication timestamps use the helper.
- Deterministic article extraction tests cover publisher title, publisher name, publication metadata, readable body and missing-date behavior. Existing DNS pinning and SSRF tests remain in place.
- A labelled specialist relevance benchmark covers Defence, Corporate Risk, Supply Chain, Geopolitical and Strategic searches, including the PLA/plane false positive and geography-only partial matches.
- Defence tests cover syndicated-source grouping, independent source corroboration, and the rule that narrative volume cannot establish coordination or attribution.
- Staging smoke checks now cover all five workflow contracts, structural validation, private specialist workspace endpoints, optional live article extraction with SHA-256 provenance, and optional two-account workspace isolation.
- Optional full staging E2E collection/assessment can be enabled explicitly; it makes real public-source requests and is not run by ordinary CI.

## Five workstreams

### 1. Labelled relevance benchmarks
Automated labelled examples now cover all five specialist roles. They are regression fixtures, not a statistically representative production benchmark. Reported thresholds in the test are guardrails for this fixture only; do not present them as measured live precision/recall.

### 2. Date-field and staleness semantics
Publication time is normalised separately from capture time. Missing timestamps remain DATE_UNVERIFIED. Stale and future-dated records are explicitly classified. Market quote time, maritime event time, sanctions list update time and geospatial event time remain domain-specific and need provider-level freshness checks before being certified.

### 3. Article extraction and DNS
Unit tests cover deterministic HTML extraction and existing DNS validation/pinned lookup behavior. Live staging acceptance is conditional on STAGING_ARTICLE_URL, because the app cannot assume that an arbitrary publisher URL is readable, stable or not paywalled. A successful live read must return at least 60 words, capture time and a 64-character SHA-256 provenance hash.

### 4. Specialist workflow and tenant isolation
Staging smoke validates the workflow contract, incomplete-assessment gate and no-store workspace endpoint for all five roles. A two-account isolation test is available when STAGING_SECOND_EMAIL and STAGING_SECOND_PASSWORD are configured. Full collection and assessment across all five roles is explicitly opt-in via STAGING_RUN_SPECIALIST_E2E=true.

### 5. False positives, independence and contradictory evidence
Regression coverage now checks the known PLA/plane false positive, geographic-only partial matches, syndicated-source grouping and the non-attribution guardrail. Multi-source corroboration remains a lead, not proof. Collected claims remain unassessed until an analyst classifies evidence. The new review helper preserves supporting, contradicting and unassessed evidence separately; conflicting evidence is explicitly labelled for review, never silently collapsed into a single truth status.

## Running staging acceptance
Set STAGING_BASE_URL, STAGING_EMAIL and STAGING_PASSWORD in the environment. For live article extraction also set STAGING_ARTICLE_URL to a public article with readable body text. For tenant isolation set STAGING_SECOND_EMAIL and STAGING_SECOND_PASSWORD to a second existing staging account. To perform live collection and assessments for all five roles set STAGING_RUN_SPECIALIST_E2E=true; this uses public keyless search and may take several minutes.

Run: `node scripts/staging-smoke.mjs`

## Explicit limitations
- GitHub CI does not possess the user's Render staging credentials or prove live staging behavior.
- No new API keys or X bearer token are required or introduced.
- No private social content, classified data, guaranteed AIS coverage or comprehensive registry access is implied.
- Atlas has not been modified.
- PR remains unmerged; production has not been deployed.