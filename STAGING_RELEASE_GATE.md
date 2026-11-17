# Calibrex staging release gate

This is a staging-only verification procedure. Do not use production customer credentials or point the staging workflow at the production host.

## 1. Provision an isolated staging deployment

- Use a separate staging URL, database, object storage bucket and provider/API keys.
- Restore a scrubbed copy of production data, or seed synthetic accounts. Do not copy live password hashes or customer secrets into staging.
- Set the same Node major version as CI (Node 20 or newer).
- Set `DATABASE_URL` with verified TLS. If the database uses a private CA, mount the CA and set `PGSSLROOTCERT`.
- Set a staging-only `ADMIN_EMAIL` and `ADMIN_PASSWORD`; never reuse the production admin secret.
- Configure Claude/Anthropic and any other providers with staging-only keys and low spend limits.
- Keep publishing targets in draft/test mode. Disable outbound push, email, webhooks and public social posting unless they point to test destinations.
- Configure `PUBLIC_URL` to the staging origin and keep sensitive SOCMINT gates disabled unless a controlled test requires them.

## 2. Configure GitHub Actions secrets

Add these repository or environment secrets before running **Actions → Staging smoke test → Run workflow**:

- `STAGING_BASE_URL`: HTTPS staging origin, no trailing path.
- `STAGING_EMAIL`: dedicated active staging test account.
- `STAGING_PASSWORD`: staging test account password.
- `STAGING_TOTP`: optional TOTP code only if the test account has two-factor authentication enabled; generate a fresh code immediately before the run.

The smoke test checks the web shell, liveness, database/feed readiness, login, session identity, entitlement, feature catalogue, live intelligence snapshot and server-side logout revocation. It never creates content or sends notifications.

## 3. Manual release acceptance

Run these checks in staging after the smoke test passes:

1. **Collection:** confirm source timestamps advance, direct-feed attempts run at the configured one-minute interval, enrichment remains on its separate five-minute interval, and upstream failures preserve last-good items with visible stale/error state.
2. **Verification:** test a known multi-source event, a syndicated wire story, a single-source claim, a stale story and conflicting coverage. Confirm only three or more independent publisher domains with readable article-body term matches can receive the current `CORROBORATED` label. This is textual coverage evidence, not a determination of truth.
3. **Evidence:** open each matched publisher link; check final URL, capture time, publisher timestamp and SHA-256 evidence hash. Preserve original source URLs and do not treat missing/paywalled article text as confirmation.
4. **Claude and other providers:** run one harmless, low-cost test prompt per configured provider. Confirm existing model selection, streaming/error handling and saved provider settings still work. Do not use customer data.
5. **Publishing:** create a draft/test-only item, preview it, save it, revise it, and verify the existing publish/rollback controls without sending it to public destinations.
6. **Identity and licensing:** verify user roles, entitlements, plan feature gating, logout, password rotation and admin role/status revocation with test accounts.
7. **Operations:** check `/api/health`, `/api/health/ready` and the admin operations health endpoint. Confirm database readiness, feed age, source last-success timestamps, request IDs and absence of secrets in logs.
8. **Resilience:** stop one feed/provider, restart the staging service, and verify last-good snapshot restoration. Test backup restore using a disposable staging database before considering a production migration.
9. **Load and security:** run controlled concurrency/load tests, CSRF/CORS/security-header review, SSRF redirect and oversized-response tests, and dependency audit. Do not run destructive tests against production.

## 4. Source-health acceptance (required)

The staging smoke test can pass while individual publisher sources fail. Do not treat the aggregate readiness endpoint as proof that every source is healthy.

For every source shown as failed, cached or empty:
- Record its stable source ID, publisher, configured endpoint, HTTP/error class, last successful fetch, last attempted fetch, cached-item age and consecutive failure count.
- Treat HTTP 401/403 as access-restricted. Do not rotate identities, spoof clients, scrape around paywalls or otherwise bypass publisher controls. Use a documented publisher-provided feed/API or mark the source unavailable.
- Treat HTTP 404/410 as an endpoint-maintenance issue. Verify the publisher's current public feed documentation before changing the endpoint; do not guess replacement URLs.
- Treat HTTP 429 and 5xx/timeouts as transient. Apply bounded per-source backoff and preserve last-good items with a visible stale marker.
- Distinguish a valid empty feed from a failed fetch and from a parser failure. "No items yet" must not be presented as a successful live source without a last-success timestamp.
- Confirm that source-level status and retry timing are visible to an administrator and that failures do not silently become healthy merely because cached items exist.

The current observed staging sample contained 148 sources, 138 marked healthy, 4 cached and 10 failed. Screenshots identified 403/404 examples but did not expose all ten source IDs. Re-run the live source inventory after deployment and reconcile every failed source. Some publisher feeds may legitimately remain unavailable; production acceptance requires transparent classification and a documented alternative/accepted risk, not bypassing access restrictions.

## X / social chatter staging checks

- Configure `X_BEARER_TOKEN` as a server-side Render secret before enabling the built-in X streams. Never add it to client variables, source files or chat.
- Confirm the X developer project has Recent Search access and sufficient quota for six query streams. Recent Search is a rolling seven-day window, not a full historical archive.
- Confirm 200 responses, author IDs, timestamps and canonical post URLs are retained; verify 401/403/429 are surfaced as restricted/rate-limited and back off rather than retrying aggressively.
- Confirm near-duplicate posts from at least three distinct authors inside 30 minutes display the CHATTER PATTERN review label, while two authors, unrelated posts and posts outside the window do not.
- Confirm social posts remain marked UNVERIFIED and do not independently raise alerts or get promoted to confirmed facts.
- Review X developer terms, permitted use, retention and deletion obligations before production activation.

## 5. Go/no-go rule

No production rollout until:
- dependency audit reports zero high/critical advisories and all remaining advisories have an explicit accepted-risk record;
- CI typecheck, tests and production build pass on the exact release commit;
- staging smoke test and all manual acceptance checks pass;
- backup restore and rollback are demonstrated;
- a reviewer approves the PR and a separate deployment approval is recorded.

A green CI run validates code checks only. It is not proof of successful staging or production operation.
