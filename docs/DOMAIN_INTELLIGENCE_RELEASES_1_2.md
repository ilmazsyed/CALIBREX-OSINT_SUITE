# Domain Intelligence Foundation — Releases 1 and 2

## What is delivered

This release adds a shared, deterministic intelligence foundation that can serve all five specialist workspaces rather than five disconnected products.

### Release 1 — public-source foundation
- A source catalogue covering defence, corporate, supply-chain, geopolitical and strategic intelligence.
- Explicit access, credential, cadence, coverage and commercial-use caveats for each source.
- Five specialist domain packs with entity types, event taxonomies, warning indicators and known coverage limits.
- A common observation normaliser retaining source URL, publisher/domain, capture and publication times, country codes, evidence classification, licence metadata and a content hash.
- Country profiles assembled only from supplied observations and indicator records.
- No mandatory new API credentials. Public datasets/APIs are described as adapters; this release does not imply every provider is already being polled live.

### Release 2 — intelligence fusion and foresight
- Entity resolution candidate generation using external identifiers, domains and name similarity. No automatic identity merge.
- Similar-event candidate clustering with provenance and review status. Similarity is not event confirmation.
- Warning-indicator evaluation with explicit UNASSESSED state when observations are missing.
- Forecast ledger with timestamped probability, horizon, rationale, indicators and outcome scoring. Brier scoring is only applied to resolved YES/NO outcomes.
- Five packs share the same evidence and review discipline.

## Source adapters and operating model

The catalogue is designed for public, optional licensed and customer-supplied datasets. Connectors should implement the same normalised observation shape. Existing feed credentials and provider settings remain unchanged. X bearer tokens and new mandatory secrets are not required.

Recommended first ingest order:
1. UCDP, GDELT and ReliefWeb for conflict, event and humanitarian signals.
2. World Bank, IMF and UN Comtrade for country, macro and trade baselines.
3. SEC EDGAR and public Companies House search; India MCA21 portal/document inspection is represented accurately as portal access, not an unrestricted bulk API.
4. SIPRI military expenditure and arms-transfer datasets, subject to their licence terms.
5. India DG Shipping public advisories and notices. Do not assume MMDAC raw live monitoring feeds are public.
6. Optional later licensed AIS, vessel history, freight, ownership, litigation, credit and specialist defence datasets.

## Five specialist packs

| Pack | Core analytical focus | Typical warning questions |
|---|---|---|
| Defence / Information Environment | posture, exercises, official statements, public air/maritime observations, cyber advisories, narrative shifts | Is reported activity changing, and is it independently corroborated? |
| Corporate Risk | filings, directors, ownership disclosures, sanctions, regulation, litigation, insolvency, adverse media | Has the counterparty's legal, control or operating risk materially changed? |
| Supply Chain | suppliers, ports, routes, trade dependencies, commodities, hazards and chokepoints | Which dependency or route is exposed, and what evidence shows disruption? |
| Geopolitical | states and actors, conflict events, diplomacy, sanctions, elections, instability and disasters | What changed, where, and what competing explanations remain? |
| Strategic / Foresight | macro indicators, trade concentration, structural dependencies, policy and technology shifts, scenarios | Which leading indicators would invalidate or strengthen each scenario? |

## Analyst safeguards
- Fact, claim, assessment, hypothesis and unknown remain distinct.
- Source diversity is not the same as source independence.
- Name similarity, event similarity and common URLs generate candidates only.
- Missing data is UNASSESSED, never silently interpreted as zero or safe.
- A warning trigger is a threshold condition, not proof of an event.
- Forecast probabilities are analyst-entered and must be evaluated against later outcomes.
- Public-source coverage cannot provide classified ORBAT, complete military telemetry, comprehensive beneficial ownership, private shipment tracking or assured live AIS.

## Verification
Run `npm test` and `npm run typecheck`. The module is deliberately independent of the UI/API layer so the existing product can adopt it incrementally without changing Atlas or existing provider credentials. A production rollout still requires endpoint/UI integration, provider-specific ingestion jobs, staging data checks, access-control review and analyst acceptance testing.
