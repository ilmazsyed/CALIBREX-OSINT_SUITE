# GEOINT reverse geocoding

Calibrex exposes an authenticated endpoint:

`GET /api/geoint/reverse-geocode?lat=<latitude>&lon=<longitude>`

It uses the OpenStreetMap Nominatim reverse endpoint to return a human-readable place hierarchy, feature type, OSM object reference and source attribution.

## Operational safeguards
- Latitude and longitude are range-validated before a provider request.
- Requests are serialised with a minimum 1.1-second interval to respect the public Nominatim service policy.
- Successful lookups are cached in process memory for 24 hours.
- The authenticated route is limited to 30 requests per user per 10 minutes.
- The provider hostname is fixed; caller input cannot select a remote URL.
- Provider errors and empty results are not cached.
- The result includes OpenStreetMap contributor attribution and licence metadata.

## Interpretation
Reverse geocoding maps coordinates to the provider's best matching feature. It does not verify that an event occurred there, authenticate the coordinates, or establish the source's independence. The original coordinate pair is retained in the response. Analysts must cite the coordinate's originating evidence separately.

## Availability
This uses the public Nominatim service, which is rate-limited and best-effort. It is not a guaranteed production SLA. For sustained enterprise volume, configure a contracted geocoding provider or a self-hosted Nominatim instance.
