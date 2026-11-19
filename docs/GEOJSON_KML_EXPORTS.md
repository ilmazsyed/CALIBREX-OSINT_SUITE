# Investigation GeoJSON and KML exports

The Investigation Report panel exposes two case-scoped downloads:

- `GET /api/investigations/:id/geospatial.geojson`
- `GET /api/investigations/:id/geospatial.kml`

Both endpoints use the normal investigation workspace access checks. Export includes only evidence records with valid coordinates; invalid or absent coordinates are omitted rather than guessed.

## Included properties

- Evidence ID, title, assessment and triage.
- Source name and source URL.
- Published, captured and observed timestamps, with timestamp timezone certainty.
- Reported accuracy radius in metres.
- Location method, metadata origin and source reference.
- Image/video SHA-256 and evidence record hash when present.
- Reverse-geocoded provider/place context when saved.
- Case ID, revision and export generation time in GeoJSON metadata.

GeoJSON coordinates follow RFC 7946 order: longitude, latitude. KML coordinates use longitude, latitude, altitude. KML ExtendedData retains the evidence metadata and provenance fields.

## Interpretation and limits

Features are recorded evidence coordinates, not independently verified event locations. Accuracy values are source-reported and not independently validated. The export is a transfer format, not a new verification step. Check the investigation ledger and report version separately when chain-of-custody review is required.
