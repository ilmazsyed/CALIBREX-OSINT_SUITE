# Calibrex OSINT Studio — Enterprise Security Posture

**Document status:** Internal working document, 23 November 2026.  
**Assurance level:** Engineering self-assessment only. This is not a penetration-test report, certification, legal opinion, or contractual security commitment.

## 1. Confirmed application controls

The following controls are present in the engineering codebase and have automated coverage or staging evidence as noted:

- Authentication uses server-side opaque session tokens stored as hashes. Logout and account suspension revoke sessions; password and role/status changes also trigger revocation.
- TOTP MFA is supported. Enrollment/replay protections are implemented, but MFA is not yet mandatory for privileged administrators.
- Unsafe browser API mutations enforce same-origin checks and reject cross-site Fetch Metadata requests.
- API responses default to `Cache-Control: no-store`, unless a route explicitly opts into caching.
- Production callback URLs require a configured HTTPS `PUBLIC_URL`; production does not trust an arbitrary incoming Host header.
- Article-reader outbound requests validate public DNS results, pin the socket to the validated address, revalidate redirects, and reject private/reserved address ranges. The reader applies request/body limits and bounded per-publisher concurrency.
- Evidence records include source/capture provenance and SHA-256 fingerprints. The case evidence ledger is tamper-evident against case-data drift, but is not independent immutable storage.
- Backup restore protections exclude/revoke session material and prevent rollback of TOTP replay counters.
- File-store mode restricts directory and database file permissions. This is not encryption at rest.
- PostgreSQL TLS certificate verification is enabled by default in the production connection path; private CA configuration is supported.

## 2. Recent validation evidence

- GitHub Actions run 1172 passed on commit `0916b7316aca21304bce33b072595a345197d5d6`: dependency audits, TypeScript, automated tests, production build and authenticated staging smoke test.
- Test result on that commit: 182 passed, zero failed, one PostgreSQL integration test skipped because CI did not have `DATABASE_URL`.
- Staging smoke test confirmed web shell, nosniff, liveness/readiness, database/feed snapshot, login/session identity, admin source diagnostics, entitlement, catalogue, intelligence endpoint, logout and session revocation.
- That staging run observed 217 sources, 215 healthy, four cached, zero hard failures. Source health is time-varying; examples of degraded sources included Breaking Defense (403) and GDELT (429).
- HSTS assertion was skipped because the updated staging deployment and `STAGING_EXPECT_HSTS=true` were not confirmed.
- A later commit adds a DOCX archive-integrity test; that exact head still requires a fresh CI result.

## 3. Items that must not be represented as completed

Until evidence is obtained, do not claim any of the following:

- Independent penetration testing or external security certification.
- SOC 2, ISO 27001, or any other compliance certification.
- Verified encryption at rest for database volumes, persistent disks, backups or exported reports.
- WORM/immutable evidence retention or independent timestamping.
- Mandatory MFA for all privileged users.
- Verified production Render environment configuration, branch protection or deployment approval controls.
- Verified data residency or a contractual retention/deletion schedule.
- 24x7 security operations, external alerting or a tested incident-response SLA.

## 4. Customer data and processing — decisions required

Before making customer-facing commitments, document and approve:

1. **Hosting and residency:** Render service region, database region, persistent disk region, backup region, subprocessors and any cross-border transfers.
2. **Data categories:** account identifiers, workspace/case records, analyst notes, evidence URLs/content, uploaded files, investigation exports, authentication data, audit logs and provider settings.
3. **AI processing:** which customer-supplied material is sent to each enabled AI provider, provider retention/training terms, region, access controls and customer opt-out options. Do not assume all configured providers share identical terms.
4. **Retention:** default retention by data category, customer-configurable retention, legal holds, backup expiry and treatment of deleted cases in backups.
5. **Deletion:** authenticated customer request, workspace/case deletion, backup expiry, provider-side deletion where applicable, and a documented completion record.
6. **Source licensing:** publisher/feed terms, permitted storage and redistribution, attribution requirements, caching windows, and customer export rights. Restricted/paywalled sources must remain restricted.
7. **Access controls:** tenant isolation, least-privilege roles, privileged access, support access approvals and administrative audit trails.
8. **Incident response:** severity definitions, triage owner, containment, evidence preservation, customer notification decision process, regulatory assessment and post-incident review.

## 5. Release blockers and owners

| Requirement | Current state | Required evidence |
|---|---|---|
| Production secrets/configuration | Unverified | Owner-reviewed Render environment checklist; never paste secret values into chat or tickets |
| Branch protection | Unverified | Screenshot/export of ruleset requiring CI and review; verify direct pushes are blocked |
| Independent penetration test | Outstanding | Scoped report covering tenant isolation, auth/session, CSRF, SSRF and restore |
| Restore drill | Outstanding | Isolated restore record, data-integrity checks and proof old sessions remain revoked |
| Encryption at rest | Unverified | Hosting/database/storage provider configuration and backup encryption evidence |
| Mandatory privileged MFA | Not enabled | Tested enrollment, recovery and break-glass procedure |
| Evidence anchoring | Not immutable | WORM/object-lock or independent external anchoring design and verification |
| HSTS | Code implemented; live staging check pending | HTTPS response header from updated staging deployment |
| DOCX exports | Code added; exact-head CI and app-level acceptance pending | CI archive test and Word/LibreOffice/iOS validation |

## 6. Safe customer-facing wording

Until the outstanding evidence is complete, describe Calibrex as having **implemented application-level security controls with staging validation in progress**. Do not describe it as independently audited, certified, production-penetration-tested, WORM-backed, encrypted at rest, or compliant with a named framework.

This document is a control inventory and decision register. It does not replace a DPA, privacy notice, retention schedule, subprocessor list, incident-response plan or customer contract.
