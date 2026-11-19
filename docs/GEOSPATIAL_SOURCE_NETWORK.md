# Geospatial Source Network

The authenticated endpoint `GET /api/geospatial/sources` exposes the source registry and operational status for Calibrex's geospatial layers. It is entitlement-gated under GEOINT and is intentionally marked `Cache-Control: no-store`.

## Status semantics

- `active`: the corresponding collector reports a successful refresh.
- `cached`: last-good observations are retained while the latest pull is empty or failed.
- `configuration_required`: the integration exists but required credentials are absent.
- `degraded`: the collector reports an error; cached observations may remain.
- `not_confirmed`: no successful runtime collector state is confirmed.
- `reference`: contextual dataset only, not a live event feed.
- `service_available`: imagery service/layer availability, not a live event feed.
- `best_effort`: fallback provider with restricted or uncertain anonymous access.

A source being active proves only that the collector reached the provider and parsed a response. It does not prove the truth, completeness, independence or operational significance of individual observations.

## Registered sources

| Source | Role | Runtime state |
|---|---|---|
| NASA EONET | Natural-event catalogue | Existing GEOINT collector |
| USGS Earthquake Hazards | M4.5+ earthquake feed | Existing GEOINT collector |
| Georgia Tech IODA | Country-level connectivity outages | Existing GEOINT collector |
| UCDP GED | Georeferenced organised violence | Existing periodic dataset collector |
| ACLED | Conflict/protest event data | Requires `ACLED_EMAIL` and `ACLED_PASSWORD` |
| NASA FIRMS VIIRS | Active-fire detections | Requires `NASA_FIRMS_KEY` |
| adsb.lol | Public ADS-B aircraft positions | Existing Signals collector |
| OpenSky Network | Aircraft-state fallback | Best effort; anonymous access is restricted |
| AISStream | Live AIS positions | Requires `AISSTREAM_KEY` |
| NASA GIBS / Worldview | Satellite browse imagery | Imagery layer, not event feed |
| Esri World Imagery | Reference imagery | Archival/reference; tile acquisition dates vary |
| OpenStreetMap | Basemap and infrastructure context | Reference data; ODbL obligations |
| GeoNames | Gazetteer | Reference data |
| Natural Earth | Boundaries/cartographic context | Reference data |

## Operational caveats

- Provider cadence and spatial coverage vary. Polling cadence is not a guarantee of provider publication latency.
- AIS can be absent, delayed, spoofed or switched off. Do not infer a complete maritime picture.
- ADS-B depends on receiver coverage and aircraft transponder use; military coverage is incomplete.
- NASA FIRMS detections are satellite observations, not ground confirmation.
- EONET, IODA and conflict datasets have different event definitions and location precision.
- Gazetteer points, country centroids and reference imagery must not be represented as verified incident coordinates.
- A zero-result query is not evidence that no event occurred.
- Provider links and attribution are retained in the response. Licensing/terms must be checked before commercial redistribution or bulk caching.

## API response

The response includes `generatedAt`, aggregate `counts`, per-source `status`, `available`, `updatedAt`, `ageMs`, `stale`, `count`, `limitations`, and a `provenance` object. Missing timestamps remain null; they are never fabricated.
