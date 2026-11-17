# Enterprise Readiness and Security Hardening

Status: active engineering work. This document distinguishes implemented controls from release gates that still require code changes and validation.

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
- Direct RSS/social source polling now defaults to one minute. Set `DIRECT_REFRESH_MS` to a larger value to reduce upstream load; the minimum is 60 seconds.
- API/provider enrichment and rotating keyword searches remain on their separate five-minute cycle.
- GitHub Actions CI runs dependency installation, TypeScript checks, tests and a production build for pull requests and hardening-branch pushes.

## Release gates — must be completed before calling the product enterprise-ready

### P0 — network and identity security

- [x] Pin validated DNS results to the outbound socket for the article reader, media proxy, and admin-added RSS/Mastodon sources; validate every redirect and block private, loopback, link-local, multicast, reserved and metadata ranges across IPv4 and IPv6.
- [x] Add controlled DNS/HTTP harness tests for mixed public/private answers, private destinations and redirect revalidation.
- [ ] Add live-network timeout, oversized-response and per-host concurrency tests.
- [ ] Enforce strict outbound timeouts, response-size limits, content-type allowlists and per-host concurrency limits.
- [x] New sessions use server-side opaque tokens; logout and account suspension revoke sessions. Legacy signed cookies are retained for compatibility and account suspension revokes them too.
- [x] Revoke sessions on password change, admin password reset and role/status changes; periodically clean expired session records.
- [ ] Add end-to-end login/logout/suspension integration tests.
- [x] Move login/signup throttling to an atomic shared PostgreSQL fixed-window store (file-store mode remains single-instance).
- [ ] Add account-aware abuse controls without creating an easy account-lockout denial of service.
- [ ] Review cookie flags, CSRF protections, CORS, security headers, password reset, signup and admin bootstrap.
- [ ] Verify PostgreSQL TLS and document private-CA configuration. Never set `rejectUnauthorized: false` in production.
- [ ] Add dependency, secret and static security scanning to CI.

### P1 — intelligence integrity

- [x] Corroboration now counts distinct publisher domains and collapses near-identical syndicated headlines; its status explicitly does not prove the claim.
- [ ] Distinguish original reporting from separately researched confirmation using article-body evidence.
- [ ] Preserve source URL, publisher, collection time, publisher timestamp, fetch status and evidence hash.
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
