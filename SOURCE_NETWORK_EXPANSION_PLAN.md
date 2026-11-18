# Calibrex Global Source Intelligence Network

## Objective

Build a catalogue of at least 6,000 distinct source records: 1,000 in each of six intelligence layers. The target is a programme requirement, not a claim that the current deployment already contains 6,000 healthy sources.

## Six layers and targets

| Layer | Target | Coverage |
|---|---:|---|
| Government & official records | 1,000 | Ministries, regulators, legislatures, courts, gazettes, procurement, sanctions, multilateral bodies |
| News, web & open publications | 1,000 | National and regional newsrooms, specialist desks, think tanks, research and public web publications |
| Public social & digital activity | 1,000 | Public social accounts, channels, forums, community reporting and public discussion spaces |
| Geospatial & earth observation | 1,000 | Satellite catalogues, imagery services, mapping, weather, hazards, land use and environment |
| Transport, maritime, aviation & space | 1,000 | Vessel/AIS, ports, aviation, navigation, logistics, launch and orbital datasets |
| Economic, corporate & trade intelligence | 1,000 | Company registries, filings, tenders, contracts, trade, commodity, financial and supply-chain datasets |

## Geographic hierarchy

Use region -> country/territory -> state/province where applicable -> source category -> source record. Global and multilateral sources live in a separate Global / multilateral group and are not copied into country totals to inflate coverage.

The initial region taxonomy includes South Asia, East Asia, Southeast Asia, Central Asia, Middle East, Europe, Africa, North America, Latin America & Caribbean, Oceania and Global / multilateral. Country codes use ISO 3166-1 alpha-2 where available. Country attribution must be evidence-based; unknown or multi-country coverage remains explicitly unknown/multi-region.

## Source record requirements

Every candidate should carry:
- stable unique ID and canonical name;
- layer, category, region, country/territory and geographic coverage scope;
- canonical endpoint and access method (RSS/Atom, public API, public web search, public social feed, licensed API/dataset);
- publisher/provider identity and original source homepage;
- language(s), publication cadence and expected collection cadence;
- licence/terms reference and permitted uses (collection, storage, analysis, redistribution);
- authentication and quota requirements, without storing secrets in catalogue files;
- discovery date, validation date, last checked, last successful collection and last useful item;
- operational health, failure class, retry time and last-good-data reference;
- separate editorial/source credibility assessment and analyst notes.

## Activation and health policy

A discovered source is a candidate, not a live feed. It must pass endpoint reachability, protocol/parser, useful-content, provenance, access/terms, quota, duplication and SSRF checks before activation. The source must not be labelled healthy until successful ingestion is measured in the running environment.

Health states:
- Healthy: recent successful collection within the source's expected cadence, no current failure streak.
- Degraded: partial/intermittent failure or freshness outside normal cadence but within recovery window.
- Stale: last successful collection is too old for its expected cadence.
- Failed: endpoint is invalid/inaccessible or has no successful history and a confirmed failure.
- Unverified: no successful health measurement yet.
- Disabled: deliberately not collected; retain its underlying measured state separately.

Technical health is not editorial reliability. Reliability assessment is separate and should consider correction history, transparency, primary-source status, independence, ownership, methodology and analyst review. Syndicated copies do not count as independent corroboration.

## Collection and cost controls

Do not poll all sources every minute. Use source-specific schedules, conditional requests (ETag/Last-Modified), jitter, bounded concurrency, exponential backoff, circuit breakers, quota-aware polling and provider terms. Keep a last-good cache and never erase useful intelligence because a source temporarily fails. Search-index fallback is a separate source record and must not conceal failure of the original endpoint.

## Rollout sequence

1. Source registry schema, region/layer taxonomy, admin coverage dashboard and validation gates.
2. India and South Asia: official, regulatory, state-level, news, research, social and commercial sources.
3. East/Southeast/Central Asia and Middle East.
4. Europe, Africa, Americas and Oceania.
5. Global multilateral, satellite, geospatial, transport, aviation, maritime and space datasets.
6. Corporate, financial, procurement, trade and supply-chain sources.
7. Load, resilience, licensing, quality and analyst acceptance.

Each batch is a reviewed pull request. Merge only with all CI checks green. Production health must be verified after deployment; CI alone does not prove live source health.

## Current implementation baseline

The initial implementation adds:
- six 1,000-record layer targets;
- geographic region/country taxonomy;
- source classification and expected collection cadence;
- health states based on measured last-success timestamps;
- admin API `/api/admin/source-network`;
- admin dashboard with layer progress, region/country coverage and per-source access/licence metadata;
- automated tests for taxonomy, targets and health-state behaviour.

The existing built-in catalogue is not yet 6,000 records. Current entries are surfaced honestly as configured, healthy, degraded, failed or unverified. No source is added merely to meet a numeric target.
