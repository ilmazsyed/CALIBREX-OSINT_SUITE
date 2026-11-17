# Corporate workspace staging validation

This runbook validates tenant isolation and PostgreSQL write serialization before enabling corporate customer access.

## 1. Automated checks

Run:

```bash
npm ci
npm run typecheck
npm test
```

The HTTP integration suite starts an isolated local server and checks:
- workspace A cannot list workspace B's investigations;
- guessed case IDs cannot read, update, delete, inspect evidence ledgers or export STIX across workspace boundaries;
- workspace entity registries remain tenant-scoped;
- personal investigations do not appear in corporate queries, and corporate cases do not appear in personal queries;
- viewer roles are read-only and cannot manage members;
- removed members lose access on their next request;
- conflicting workspace selectors are rejected.

The file-store concurrency test is only a single-process development-store check. It is not evidence of multi-instance production safety.

## 2. PostgreSQL concurrency check

Against a disposable PostgreSQL database using the same PostgreSQL major version and TLS policy as staging:

```bash
DATABASE_URL='postgresql://…' node --test server/tests/workspace-postgres.integration.test.js
```

This runs 80 concurrent increments against one settings row and verifies that all mutations are retained. The test creates and deletes a uniquely named test setting. Use a dedicated disposable test database, not a production database.

For staging, run this test from a trusted runner with the staging database connection supplied through the runner's protected environment. Do not commit database URLs or certificates.

## 3. API-level staging checks

Deploy the feature branch only to an isolated staging environment with a disposable database and test accounts. Execute the HTTP integration test against that deployment as an external black-box test, or repeat the same requests using separate test accounts:

1. Create two organisations and at least three active users.
2. Create a workspace and investigation in each organisation.
3. Attempt cross-workspace list, read, update and delete requests using guessed IDs.
4. Attempt cross-workspace entity registry reads and mutations, evidence-ledger reads and STIX exports.
5. Add a viewer, verify read access and verify create/update/delete/member-management requests are denied.
6. Remove the viewer and verify the next request is denied.
7. Verify a user's personal investigations never appear in a workspace listing and vice versa.
8. Send conflicting `workspaceId` query and `x-calibrex-workspace` header values; expect HTTP 400.
9. Transfer workspace ownership to an existing member; verify the new owner can manage members and the previous owner is downgraded to admin.
10. Run concurrent case edits, entity updates and member changes from separate application instances; verify no lost writes or inconsistent membership.

Record the deployment SHA, database engine/version, test account IDs, test results and timestamps in the release record. Never use real customer data for this test.

## 4. Release gate

Do not enable customer-facing corporate workspaces until all of the following are true:
- CI passes on the exact release commit.
- PostgreSQL concurrency test passes against the staging database.
- Cross-tenant negative tests pass against the deployed staging API.
- Member removal and role changes are verified from a separate session.
- Backup/restore and organisation export/deletion procedures are tested.
- Independent security review has no unresolved critical/high tenant-isolation findings.

## Limitations

The current implementation stores workspace records and shared workspace data as JSONB settings records, rather than normalised tenant tables with foreign keys. PostgreSQL row locking serialises mutations to each settings key, but it does not make a sequence of writes across different keys a single transaction. Workspace creation and audit logging still span separate settings rows. A database failure between those operations can leave partial state. A future migration to dedicated workspace, membership, investigation, entity and audit tables with transactional foreign keys is recommended before high-volume enterprise use.

This runbook is a validation procedure, not a security certification. Evidence ledgers remain application-level hash chains, not WORM storage or independent timestamping.


## 5. Deployed two-tenant gate

Run the **Corporate workspace staging gate** workflow manually on the feature branch. It performs black-box requests against the deployed staging URL using two distinct active test accounts. It checks cross-tenant investigation and evidence/STIX access, entity registry isolation, viewer restrictions, member removal, personal/corporate separation and conflicting scope selectors.

Required GitHub Actions secrets:
- `STAGING_BASE_URL`
- `STAGING_EMAIL_A` and `STAGING_PASSWORD_A` (or reuse existing `STAGING_EMAIL` and `STAGING_PASSWORD` for A)
- `STAGING_EMAIL_B` and `STAGING_PASSWORD_B`
- Optional `STAGING_TOTP_A` and `STAGING_TOTP_B`
- `STAGING_TEST_DATABASE_URL`: a dedicated disposable PostgreSQL test database, never the production database

The staging isolation script creates two uniquely named workspaces and test records. The current API does not expose workspace deletion, so use a dedicated staging environment and periodically reset its test data. The PostgreSQL test writes and deletes a unique row in the `settings` table.

A passing workflow proves the tested API behaviours for that deployment and those accounts. It does not prove multi-key transaction atomicity, disaster recovery, WORM evidence retention, or independent security certification.
