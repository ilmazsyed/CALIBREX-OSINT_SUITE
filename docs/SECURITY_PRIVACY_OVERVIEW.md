# Security and Privacy Overview

This document describes intended controls and known boundaries for customer review. It is not a penetration-test report, compliance attestation, legal opinion or security certification.

## Data and collection principles

- The platform is designed around publicly accessible sources and configured provider integrations.
- It does not claim access to private messages, private groups, cellular or radio interception, or restricted content.
- It does not require an X bearer token for the built-in public-source baseline.
- Retrieved text and social content are untrusted data; instructions found inside them must not be followed by AI workflows.
- Source claims, analyst inference, corroboration and unknowns should remain distinguishable.

## Existing technical controls to validate at release

- PostgreSQL TLS certificate verification for remote databases.
- Opaque revocable sessions with server-side expiry.
- Request throttling and request IDs.
- Outbound fetch restrictions, DNS pinning and redirect validation.
- Last-good source snapshots and bounded retry/backoff.
- Application audit and evidence hash-chain verification.
- Secret and sensitive-data redaction in request telemetry.

These controls require staging verification and independent review. An application-level hash chain is not WORM storage or legal chain of custody.

## Customer data boundaries

Corporate workspaces support shared investigations, evidence ledgers and entity registers with owner/admin/analyst/viewer roles. PostgreSQL-backed workspace settings now expose atomic read-modify-write operations using row locks; local JSON development storage serialises mutations only within one process and is not suitable for multi-instance production. Membership is authoritative in the workspace record, so member removal and role changes affect subsequent authorization checks without relying on a second per-user membership index. Investigation, entity-registry and audit mutations use the atomic update path. A concurrency regression test covers the local store implementation. These changes are not a substitute for PostgreSQL staging tests, API-level cross-tenant penetration tests, independent security review or load testing. Ownership transfer, invitation acceptance, organisation-level export/deletion and full tenant-isolation integration tests remain outstanding.

## Customer responsibilities

- Use only lawful, authorised monitoring purposes.
- Do not submit credentials, private records or sensitive personal data unless the deployment and contract explicitly support the use.
- Review AI-generated analysis before acting on it.
- Verify important claims against original sources.
- Configure retention and access according to internal policy.

## Required before general availability

- Independent penetration test and remediation record.
- Data-flow inventory and retention schedule.
- Privacy notice, terms, acceptable-use policy and customer DPA where required.
- Incident response plan and customer notification process.
- Backup encryption, restore test and documented RPO/RTO.
- Access review, admin audit and offboarding tests.
- Applicable legal review for India and target markets.
