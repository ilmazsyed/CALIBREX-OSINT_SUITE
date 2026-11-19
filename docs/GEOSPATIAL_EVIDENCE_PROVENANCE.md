# Geospatial evidence provenance

Calibrex can normalize decimal coordinates and EXIF-style GPS metadata into a common geospatial observation for investigation reporting.

## Supported inputs
- Decimal latitude/longitude fields.
- EXIF GPSLatitude/GPSLongitude degree-minute-second arrays with hemisphere references.
- EXIF DateTimeOriginal and GPSHPositioningError.
- Analyst-declared metadata origin and source reference.

## Interpretation safeguards
- A valid coordinate pair confirms only that the values are structurally valid.
- Metadata origin is recorded as declared; it is not cryptographically authenticated.
- EXIF metadata may be edited, stripped, copied or misattributed.
- Missing accuracy is left unknown; the system does not invent a precision radius.
- Invalid timestamps and malformed coordinate values are surfaced as errors.
- Reports preserve the metadata origin, source reference, observed time and caveats.

This feature does not perform reverse geocoding, satellite image matching, device attribution or independent verification of an event location. Those require separately sourced adapters and analyst review.
