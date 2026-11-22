# Enterprise Readiness and Security Hardening

Status: active engineering work. This document distinguishes implemented controls from release gates that still require code changes and validation.

## Audit status — 22 November 2026

**Current assessment:** 8.0/10 code-and-staging readiness (provisional; not an independent certification). Production release readiness remains conditional on the release gates below.

### Merged security remediations on `hardening/enterprise-readiness`

- [x] Production startup fails closed if `SESSION_SECRET` is missing.
- [x] CI blocks on high/critical advisories in the full dependency tree and on low-or-higher production dependency advisories.
- [x] CI actions are pinned to immutable commit SHAs; Dependabot weekly npm and GitHub Actions updates are configured.
- [x] Unsafe API mutations enforce same-origin Origin/Referer checks and reject cross-site Fetch Metadata requests.
- [x] API responses default to `Cache-Control: no-store`, while explicit route cache policies remain respected.
- [x] Production OAuth/public callback URLs require configured HTTPS `PUBLIC_URL`; production no longer trusts the incoming Host header.
- [x] File-store directory/database permissions are restricted to 0700/0600; malformed or unreadable existing stores fail closed instead of silently appearing empty.
- [x] Evidence-ledger verification compares the latest ledger digest with current case evidence and detects changed, missing and reappearing-removed evidence.
- [x] An enabled TOTP authenticator cannot be overwritten without the verified disable flow.
- [x] TOTP time-step counters are consumed atomically; accepted codes cannot be replayed across login, enable and disable.
- [x] Backup exports omit session records; restore strips injected sessions, revokes prior sessions, renews the restoring administrator's session and prevents rollback of TOTP counters or live rate limits.
- [x] CI includes optional authenticated staging smoke tests and runs them when the staging secrets are configured.
- [x] Workspace isolation, CSRF and MFA flows have automated HTTP integration coverage.

### Staging verification

The authenticated staging smoke test ran successfully: **12/12 checks passed** for web shell, liveness, database readiness, login, session identity, admin diagnostics, entitlement, catalogue, intelligence endpoint, logout and session revocation.

The staging diagnostics reported 179 intelligence sources, with three degraded/cached items at the time of the run:
- Breaking Defense: HTTP 403 / access restricted; cached data retained.
- GDELT: HTTP 429 / rate limited; circuit breaker open.
- GDACS: cached response.

These are upstream source-health conditions, not evidence of an application compromise. They remain in the reliability queue.

**Deployment boundary:** these changes were merged into the staging engineering branch. No production deployment, production database mutation or production restore was performed as part of this audit.

### Remaining release gates

**P0 — must be verified before production release**
- [ ] Verify live Render environment values: `PUBLIC_URL`, `SESSION_SECRET`, `AI_ENCRYPTION_KEY`, database URL/TLS and persistent-disk ownership/permissions. The repository connection cannot inspect production secrets.
- [ ] Verify branch protection / rulesets require the green CI workflow and prevent direct pushes. The connected GitHub integration did not grant access to branch-protection settings.
- [ ] Run an independent, scoped penetration test against the isolated staging deployment, including cross-tenant access, auth/session, CSRF, SSRF and restore workflows.
- [ ] Confirm no production deployment occurs until the above checks and a restore drill pass.

**P1 — enterprise assurance**
- [ ] Make MFA mandatory for privileged administrators after a safe enrollment/recovery flow is implemented. TOTP is currently supported but optional.
- [ ] Add WORM or external cryptographic anchoring for evidence ledgers. The current hash chain detects case-evidence drift but is not immutable storage or independent timestamping.
- [ ] Confirm at-rest encryption for persistent storage and backups at the hosting/database layer. File permissions are not encryption.
- [ ] Add account-aware authentication abuse controls without creating an account-lockout denial-of-service vector.
- [ ] Add live-network timeout, oversized-response and per-host concurrency tests.
- [ ] Add CodeQL/static analysis and repository secret scanning, subject to GitHub repository permissions.
- [ ] Load-test concurrent users, feed refreshes, article extraction, AI requests and large investigations.
- [ ] Conduct a restore drill on an isolated staging copy and verify old sessions remain revoked.

**P2 — product completeness and operational quality**
- [ ] Investigate the reported PDF/DOCX/HTML download workflow end-to-end. The current report builder exposes browser print-to-PDF and TXT paths; DOCX/HTML downloads are not established by the code reviewed here.
- [ ] Improve upstream source resilience for the 403/429/cached sources without bypassing publisher access controls.
- [ ] Add durable job queues, scheduler backlog metrics and external alerting.
- [ ] Document data retention, deletion, data residency, source licensing and customer security commitments.

---

## Operating principles

1. Preserve the current product, Claude integration, other AI providers, publishing workflows, user data, licensing and entitlements.
2. Make changes on a dedicated branch and release through reviewed pull requests.
3. Do not claim a control is production-ready until automated tests and deployment verification pass.
4. Keep collection, provider publication time and display time distinct. A polling interval is not a guarantee that a publisher has published or that a provider is available.
5. Preserve last-good intelligence during upstream outages and visibly label stale or incomplete source data.

## Changes in this branch

- Remote PostgreSQL TLS now verifies server certificates by default.
- Article-reader, media-proxy and custom RSS/Mastodon requests now pin the socket to a validated public DNS address, verify TLS against the original hostname, revalidate each redirect, and reject IPv4/IPv6 special-purpose, loopback, link-local, mapped and NAT64 destinations.
- New login sessions use random opaque tokens stored as hashes server-side; logout revokes the current token, and suspending an account revokes its active sessions. Legacy signed cookies remain supported during migration but are also invalidated by account-wide suspension.
- Local TLS bypass is restricted to explicit loopback hosts only.
- Private database CA certificates can be supplied with `PGSSLROOTCERT`.
- Direct RSS/social source polling now defaults to one minute.
- Per-source failure circuit breaker classifies restricted (401/403), missing endpoints (404/410), rate limits, upstream outages and invalid feeds; applies bounded retry cooldowns and preserves last-good items without attempting to bypass publisher access controls.
- CI now audits production dependencies as a blocking low-or-higher gate and the full dependency tree as a blocking high/critical gate. The current staging CI run passed both gates. Dependabot weekly updates are configured, and CI actions are pinned to immutable commit SHAs. Keep reviewing each Dependabot PR through the same CI gate. Set `DIRECT_REFRESH_MS` to a larger value to reduce upstream load; the minimum is 60 seconds.
- API/provider enrichment and rotating keyword searches remain on their separate five-minute cycle.
- GitHub Actions CI runs dependency installation, TypeScript checks, tests and a production build for pull requests and hardening-branch pushes.

## Release gates — must be completed before calling the product enterprise-ready

### P0 — network and identity security

- [x] Pin validated DNS results to the outbound socket for the article reader, media proxy, and admin-added RSS/Mastodon sources; validate every redirect and block private, loopback, link-local, multicast, reserved and metadata ranges across IPv4 and IPv6.
- [x] Add controlled DNS/HTTP harness tests for mixed public/private answers, private destinations and redirect revalidation.
- [ ] Add live-network timeout, oversized-response and per-host concurrency tests.
- [x] Add per-source failure classification and bounded retry cooldowns for blocked, missing, rate-limited and transiently unavailable publishers; preserve last-good items and do not bypass access restrictions.
- [ ] Enforce strict outbound timeouts, response-size limits, content-type allowlists and per-host concurrency limits.
- [x] New sessions use server-side opaque tokens; logout and account suspension revoke sessions. Legacy signed cookies are retained for compatibility and account suspension revokes them too.
- [x] Revoke sessions on password change, admin password reset and role/status changes; periodically clean expired session records.
- [ ] Add end-to-end login/logout/suspension integration tests.
- [x] Move login/signup throttling to an atomic shared PostgreSQL fixed-window store (file-store mode remains single-instance).
- [ ] Add account-aware abuse controls without creating an easy account-lockout denial of service.
- [ ] Review cookie flags, CSRF protections, CORS, security headers, password reset, signup and admin bootstrap.
- [ ] Verify PostgreSQL TLS and document private-CA configuration. Never set `rejectUnauthorized: false` in production.
- [x] Add a CI dependency-advisory report and a controlled dependency-remediation workflow; release remains blocked until the audit is clean.
- [ ] Add secret and static security scanning to CI.
- [x] Separate production dependency audit from full build-tool audit reporting; the 11 high build-tool findings remain visible and are not reported as zero.
- [x] Treat retrieved source/article/document text as untrusted data in AI prompts; serialise source records and article/document text as JSON data and explicitly reject embedded instructions. Regression tests cover source and article prompt boundaries.

### P1 — intelligence integrity

- [x] Corroboration counts distinct publisher domains and collapses near-identical syndicated headlines.
- [x] Corroboration fetches a bounded sample of original articles and only allows the stronger CORROBORATED status when at least three independent publisher domains have readable article-body term matches.
- [x] Results distinguish headline-only from article-body evidence and expose resolved publisher URL, publisher timestamp, capture time and SHA-256 evidence fingerprint.
- [ ] Distinguish original reporting from separately researched confirmation using semantic claim/contradiction analysis and analyst review.
- [ ] Preserve full fetch-status/error provenance for every candidate, including failed/paywalled article reads.
- [ ] Treat all retrieved text and media metadata as untrusted input to AI; isolate it from system instructions and require source-grounded citations.
- [ ] Separate event severity, source reliability, claim confidence, geographic precision and analyst assessment.
- [ ] Label social posts and single-source claims as unverified; do not promote keyword matches to confirmed incidents.
- [ ] Add regression fixtures for duplicates, wire copy, conflicting reports, stale sources and malicious prompt-injection text.

### P1 — reliability and operations

- [x] Add liveness/readiness endpoints, source freshness summaries, request IDs, structured request logs and admin operations telemetry.
- [ ] Add scheduler/queue backlog metrics and external alerting.
- [ ] Add structured logs, request IDs, metrics, alerting and redaction of credentials, tokens and sensitive lookup values.
- [ ] Make scheduled collection single-flight across multiple instances, with bounded concurrency, backoff and jitter.
- [ ] Add durable jobs/queues for longer investigations and provider retries.
- [ ] Test backup restoration, migration rollback and data retention.
- [ ] Load-test concurrent users, feed refreshes, article extraction and AI requests.

### P2 — enterprise capability

- [ ] Tenant isolation tests for every user-owned object and API.
- [ ] RBAC with least privilege and auditable administrative actions.
- [ ] Case management, evidence bundles, analyst annotations and export controls.
- [ ] Corporate registry, ownership, adverse-media and sanctions coverage with source licensing and update cadence documented.
- [ ] API keys/service accounts, usage limits, tenant-level quotas and integration documentation.
- [ ] Deployment options, data residency, retention policy and customer security documentation.

## Freshness semantics

The one-minute direct-feed polling schedule is a best-effort collection interval. It does not guarantee minute-level event detection because source publishers, feed caches, provider APIs and network conditions determine when an item becomes available. API enrichment and rotating keyword searches have their own five-minute cycle. The client polls the latest snapshot every minute, prevents overlapping requests, pauses while hidden and refreshes on return. Admin operations telemetry exposes source-level last-success timestamps and stale/error state; a user-facing source-health panel still needs product integration.

## Verification commands

Run before every release:

```sh
npm ci --include=dev
npm run typecheck
npm test
npm run build
```

Then verify in staging with production-like environment variables, run security tests against the deployed service, exercise restore from backup, and confirm that existing Claude connections, publishing, accounts and entitlements continue to work.


## Staging release gate

A manual GitHub Actions workflow and `STAGING_RELEASE_GATE.md` provide an isolated staging smoke test and acceptance checklist. The smoke test requires repository secrets `STAGING_BASE_URL`, `STAGING_EMAIL` and `STAGING_PASSWORD` (plus optional `STAGING_TOTP`). It validates the web shell, liveness/readiness, database, login/session, entitlement, catalogue, intelligence snapshot and logout revocation. Staging has not been run until those secrets point to a real isolated staging deployment and the workflow reports success.


## Release-readiness execution log — 23 November 2026

### Verified on report-export PR head `c4434a7a1efb680b6d2051556dacdbda5785df78`

- [x] GitHub Actions CI completed successfully: dependency audits, TypeScript typecheck, automated tests and production client build.
- [x] Authenticated staging smoke test actually ran against the isolated Render staging deployment (not skipped): web shell, nosniff header, liveness, readiness/database/feed snapshot, login, session cookie and identity, admin source diagnostics, entitlement, catalogue, authenticated intelligence endpoint, logout and server-side session revocation all passed.
- [x] Test suite result: 179 passed, 0 failed, 1 skipped. The skipped test requires `DATABASE_URL` for PostgreSQL concurrency integration coverage.
- [ ] HSTS assertion remains unverified on the deployed staging build; CI explicitly skipped it because `STAGING_EXPECT_HSTS` was not enabled.
- [ ] Production secrets/configuration, branch protection, independent penetration test and isolated restore drill remain external release gates.

### Source health observed in that staging run

217 sources were reported; 213 were healthy and six had cached/degraded state (the health counters are overlapping, not a partition). Examples included Euronews HTTP 406, Breaking Defense HTTP 403, GDELT HTTP 429, and transient fetch errors for Ransomware.com. The endpoint reported zero hard-failed sources because last-good cached data was retained. These observations are point-in-time and must be rechecked before release.

### Report export implementation status

PR #112 adds a Calibrex-branded investigation dossier with HTML and TXT downloads and browser print-to-PDF. DOCX is not implemented. The PR head CI and staging smoke test passed, but no manual iOS/PWA download acceptance has been recorded. This PR is not a production deployment and should not be described as such.

### Execution discipline

Do not mark a P0/P1/P2 item complete solely because a code change exists. Mark it complete only after the corresponding automated test or operational evidence is recorded. Keep production deployment separate and require explicit approval after all P0 gates pass.


### P1/P0 engineering change in progress — publisher request pressure

- [x] Add a per-publisher outbound request semaphore to the article reader: maximum two active requests per host and a bounded queue of twelve waiting requests; excess work fails with a retryable user-facing message rather than growing memory without bound.
- [x] Enforce an absolute 15-second outbound request/body deadline in addition to the socket inactivity timeout; release the publisher slot on response completion, close or request failure.
- [x] Add unit regression coverage for the concurrency ceiling, queue bound/fairness and independent host pools.
- [ ] Await CI on the exact branch head and review the test output before treating this control as verified.
- [ ] Still required: integration tests for request timeout/slow body, oversized payloads, content-type enforcement across every outbound consumer, redirect/body cleanup and concurrent real-network behavior. The existing article reader already applies a 15-second request timeout and 4 MB body read cap; those controls need broader tests and endpoint-by-endpoint review.


### Investigation report export expansion — implementation pending CI/manual acceptance

- [x] Implement an OOXML Word document generator for the investigation dossier (DOCX); it packages a real WordprocessingML document rather than renaming HTML.
- [x] Restrict report evidence hyperlinks to HTTP(S) and add `noopener noreferrer` to generated links.
- [x] Register the print-window load handler before writing the report document to avoid missing a fast load event.
- [x] Add an automated ZIP central-directory/local-header/CRC regression test for the generated DOCX package, including Unicode and XML escaping.
- [ ] Confirm the DOCX package regression test passes in CI, then open sample files in Microsoft Word and LibreOffice and confirm long reports render correctly.
- [ ] Verify TXT/HTML/DOCX downloads and print-to-PDF on desktop Safari/Chrome and iOS/PWA; this requires a real browser/device session.
- [ ] Await CI for the latest branch head; do not merge until it passes.

- [x] Add an internal enterprise security posture/data-handling register that explicitly separates verified application controls from unverified hosting, residency, retention, at-rest encryption, certification and contractual commitments. This is an internal evidence register, not a customer-facing compliance claim.