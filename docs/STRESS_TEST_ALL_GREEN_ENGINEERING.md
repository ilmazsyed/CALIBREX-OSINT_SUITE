# Stress-test remediation: all-green analyst workflow

## Visual geolocation
The Investigation Studio now provides an analyst-led visual geolocation review attached to each evidence record. The analyst records a candidate coordinate and uncertainty radius, the visible landmark/feature, two or more imagery/reference URLs, provider, sensor, acquisition date, resolution, visual matching rationale and review timestamp. Reverse geocoding supplies attributed place context only. The validation endpoint reports seven explicit gates and a bounded review status.

A completed checklist means the required review metadata is present. It does not prove the location, imagery independence, or objective truth. This release does not claim automated AI landmark recognition or computer-vision matching. Candidate coordinates remain separate from the evidence coordinate until an analyst deliberately promotes them through the normal case workflow.

## Corroboration and contradictions
Corroboration is surfaced only for explicit analyst-recorded CORROBORATES relationships. Same publisher hosts and declared ownership/syndication groups are distinguished from different hosts. Different domains never automatically count as independent sources. Contradictions are shown from explicit CONTRADICTS relationships with rationale and assessment status. Automated semantic contradiction detection is not claimed.

## Timeline reconstruction
The shared quality engine keeps publication, source/media metadata, case collection, analyst event time and relative video offsets separate. Timestamps without an explicit timezone remain marked unknown. Relative video offsets are never converted into absolute dates. Chronological ordering is not causality.

## Geospatial discovery
The case-centred discovery endpoint filters current public GEOINT feed events by radius and freshness and returns a curated global source register covering NASA EONET, USGS earthquakes, UCDP GED, GDELT, NASA GIBS, OpenStreetMap, GeoNames and Natural Earth. The register describes sources and caveats; it does not imply every source was queried for the selected coordinates. Provider cadence, coverage and geocoding limit results.

## Acceptance semantics
- Green visual-review status means all seven review gates are recorded, not objectively verified location.
- Green corroboration means an analyst has documented and reviewed relationships; independent sourcing still needs human verification.
- Green contradiction workflow means recorded contradictions are visible and assessed; it does not guarantee every semantic conflict was discovered.
- Green timeline means available timestamp classes are reconstructed without inventing missing time or timezone data.
- Green geospatial discovery means the public feeds and source register are queryable; no-result is not proof of absence.

The automated tests cover these distinctions and the report builder includes the findings and limitations. Staging tests with real imagery and independently sourced case material remain necessary before claiming operational accuracy.
