# Calibrex OSINT Studio — Commercial Readiness

**Status: pre-commercial / controlled pilot candidate only.** This document is a release framework, not a certification or claim that every control is implemented.

## Product promise

Calibrex OSINT Studio is an open-source intelligence operations workspace for collecting public-source information, monitoring developing events, reviewing public chatter, analysing markets and infrastructure signals, managing investigations, and producing source-linked intelligence outputs.

It is not a classified intelligence system, a communications interception product, a trading terminal, a guaranteed real-time feed, or an automated truth/attribution engine.

## Release gates

### Gate A — exact-build quality
- [ ] CI passes on the exact release SHA: tests, typecheck, production build, dependency audit.
- [ ] Full dependency advisory report reviewed; unresolved high/critical findings have documented mitigation, owner and due date.
- [ ] No secrets, customer data, staging credentials or production data in repository, logs, fixtures or screenshots.
- [ ] Release branch is reviewed, mergeable and synchronized with main.

### Gate B — staging acceptance
- [ ] Isolated staging uses a separate database and synthetic accounts.
- [ ] Staging smoke test passes on the exact release SHA.
- [ ] Every configured source is classified as measured healthy, degraded, stale, failed, empty-valid, restricted or unmeasured.
- [ ] Claude, OpenAI, Gemini and OpenRouter pathways already configured are regression-tested without changing credentials.
- [ ] Draft-only publishing workflow is tested; no public post is sent.
- [ ] Restart, source outage, provider outage, backup restore and rollback are demonstrated.
- [ ] Load and security tests are performed only in staging.

### Gate C — customer data and identity
The current application stores investigations and related evidence under individual user IDs. That provides per-user separation; it is **not** shared organisation workspaces or a complete tenant-membership model. Do not sell collaborative multi-user workspaces until organisation membership, role enforcement, tenant-scoped data access, invitations, offboarding and cross-tenant isolation tests are implemented.

- [ ] Organisation/workspace model and membership lifecycle implemented.
- [ ] Tenant-scoped access applied consistently to every customer-owned resource.
- [ ] Cross-tenant negative tests cover investigations, evidence, reports, watchlists, alerts, saved searches, exports and uploaded files.
- [ ] Admin support access is audited and least-privilege.
- [ ] Customer data export and deletion workflows are tested.

### Gate D — commercial operations
- [ ] Plan entitlements are tested server-side, not only hidden in the UI.
- [ ] Contract, invoice, payment-reconciliation and tax workflows have named owners.
- [ ] Trial start/end, conversion, suspension, renewal and cancellation are tested.
- [ ] Seat counts and usage limits are measured and enforced.
- [ ] Customer onboarding, support escalation, incident communication and service status processes are ready.
- [ ] Pricing and SLA claims are approved by the business owner.

### Gate E — pilot acceptance
- [ ] A pilot customer has a defined use case, success criteria, named administrator and data-handling agreement.
- [ ] Pilot users complete onboarding without developer intervention.
- [ ] At least one complete workflow is demonstrated: monitor → detect → investigate → corroborate → brief.
- [ ] Customer feedback and defects are recorded.
- [ ] No unresolved critical security, data isolation or evidence-integrity defect remains.

## Launch classification

- **Internal alpha:** developers and trusted internal users only.
- **Design-partner pilot:** named customers, controlled scope, explicit limitations and human support.
- **Paid pilot:** signed pilot terms, approved pricing, operational monitoring and customer acceptance criteria.
- **General availability:** all release gates closed, including organisation tenancy, support, legal, security and billing controls.

A green CI build is not a staging acceptance, security certification or proof of production readiness.
