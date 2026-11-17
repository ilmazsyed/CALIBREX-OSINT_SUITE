# Calibrex OSINT Studio — staging release gate

This checklist is mandatory before production rollout. Use an isolated staging environment; never point tests at production or use customer credentials.

## 1. Isolated staging configuration

- Separate staging URL, database/storage and test accounts. Use synthetic or scrubbed data.
- Match the production Node runtime (Node 20+).
- Configure verified PostgreSQL TLS and a private CA with `PGSSLROOTCERT` when needed.
- Use staging-only admin credentials and provider credentials with low spend limits.
- Keep publishing targets in draft/test mode. Disable external push, email, webhooks and public social posting unless they target test destinations.
- Keep sensitive subject-lookup gates disabled unless a controlled test requires them.
- Preserve existing provider configuration patterns. No new API keys are required for the credential-free public social collection model.

## 2. GitHub Actions staging smoke test

Configure repository/environment secrets:
- `STAGING_BASE_URL`: HTTPS staging origin, no trailing path.
- `STAGING_EMAIL`: dedicated active staging test account.
- `STAGING_PASSWORD`: staging account password.
- `STAGING_TOTP`: optional fresh TOTP code only when the test account requires it.

Run **Actions → Staging smoke test → Run workflow** against the isolated staging deployment. It checks the web shell, liveness/readiness, database/feed snapshot, login/session identity, entitlement, catalogue, authenticated intelligence snapshot, optional admin source diagnostics and logout revocation. It does not create content or send notifications.

A successful smoke test is necessary but not sufficient: it does not validate every source, AI provider, publishing workflow or load/security characteristic.

## 3. Manual acceptance

1. **Collection and freshness:** confirm source timestamps advance; direct-feed polling and provider/search enrichment run on their separate schedules; failures preserve last-good items and expose stale/error state.
2. **Source health:** inspect every failed, cached or empty source. Record stable source ID, publisher, endpoint, HTTP/error class, last attempt, last success, cached-item age and consecutive failures. Distinguish valid empty feeds from fetch/parser failures.
3. **Access restrictions:** 401/403 means restricted; 404/410 means endpoint maintenance; 429/5xx/timeouts require bounded backoff. Do not spoof clients, rotate identities, scrape around paywalls or bypass publisher controls. Mark inaccessible sources unavailable and document alternatives.
4. **Corroboration:** test independent reporting, syndicated copy, single-source claims, stale items and conflicting coverage. The current stronger label is based on independent publisher domains and readable article-body term matches; it is textual coverage evidence, not proof of truth.
5. **Evidence:** inspect original and resolved URLs, publisher/capture timestamps, article-read status and evidence fingerprints. Missing/paywalled article text is not confirmation.
6. **Social collection:** validate only the configured public connectors (Bluesky public feed, Telegram public channel previews, Mastodon RSS, existing Reddit integrations and configured RSS/search sources). Confirm canonical links, author/channel provenance, timestamps, rate-limit handling and unverified labels. Validate pattern leads with fixtures and ensure they do not establish attribution or coordination.
7. **X/Twitter:** no built-in X API collection, X scraping or X bearer-token requirement is part of this release. Do not add `X_BEARER_TOKEN` or enable undocumented X access. Any future X integration must be a separately reviewed, terms-compliant change.
8. **AI providers:** run a harmless, low-cost test through each provider already configured in the environment, especially Claude. Confirm saved settings, model selection, streaming/error handling and report/research synthesis. Do not expose or rotate existing credentials as part of this release.
9. **Publishing:** create a draft/test-only item, preview, save and revise it. Verify existing publish/rollback controls without sending to public destinations.
10. **Identity/licensing:** test roles, entitlements, plan gating, logout, password rotation, account suspension and admin revocation with dedicated test users.
11. **Operations:** check `/api/health`, `/api/health/ready` and admin operations health. Confirm database readiness, feed age, source last-success timestamps, request IDs and log redaction.
12. **Resilience:** restart staging, interrupt a test source/provider and verify last-good snapshot behavior. Demonstrate backup restore and rollback using disposable staging data.
13. **Security/performance:** run controlled concurrency/load tests, timeout and oversized-response tests, per-host concurrency tests, CSRF/CORS/security-header review, SSRF/redirect tests, secret scanning and dependency audits. Never run destructive tests against production.

## 4. Go/no-go criteria

Do not declare production-ready or deploy until all are true:

- CI typecheck, automated tests, production build and production dependency audit pass on the exact release SHA.
- Full dependency advisory report is reviewed; every high/critical finding is fixed or explicitly accepted with a documented mitigation and owner. A production-only clean audit is not a clean full-tree audit.
- Staging smoke test passes on the exact release SHA.
- Manual acceptance above is completed and recorded, including Claude/provider and publishing regression.
- Every failed/cached source is classified; restricted sources remain unavailable rather than bypassed.
- Backup restore and rollback are demonstrated.
- PR is synchronized with `main`, non-draft, mergeable and reviewed.
- Production deployment has a separate explicit approval and post-deploy health check.

A green CI run validates code checks only. It is not proof of successful staging or production operation.
