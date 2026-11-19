# Investigation release acceptance

The release acceptance suite verifies the complete analyst workflow at module level:

1. Validate a case and preserve source provenance, evidence hashes, geospatial coordinates and media metadata.
2. Validate task ownership, due dates and status data.
3. Build the investigation graph without promoting candidate links to corroboration.
4. Generate a human-readable report with evidence references, keyframe notes and explicit unverified-location caveats.
5. Export GeoJSON and KML with coordinate order, source metadata and evidence references.
6. Create and approve an immutable report version.
7. Render a branded PDF containing the report, evidence annexure and schematic coordinate plot.

This suite validates application logic and artifact generation. It does not prove external provider availability, production deployment, legal admissibility, independent truth of evidence or browser-specific remote-video CORS behavior. Those require staging and operational acceptance tests.
