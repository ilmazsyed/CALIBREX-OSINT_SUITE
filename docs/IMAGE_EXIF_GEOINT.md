# Image EXIF GEOINT extraction

The Investigation Studio evidence editor can extract metadata from a publicly accessible JPEG, PNG or WebP URL using the authenticated `GET /api/media/exif?u=<url>` endpoint.

## Extracted fields
- GPS latitude and longitude in EXIF degree/minute/second form, with hemisphere references.
- Decimal coordinates when the GPS values are structurally valid.
- GPS horizontal positioning error when present.
- DateTimeOriginal, OffsetTimeOriginal, GPS date and GPS time where present.
- SHA-256 of the fetched image bytes, source URL, fetch time and content length.

## Safeguards
- The endpoint uses the existing safe-fetch path, accepts JPEG, PNG and WebP containers, and caps downloads at 12 MB.
- Requests are rate-limited per user.
- The parser is bounded and dependency-free; malformed TIFF/EXIF structures are not treated as usable coordinates.
- EXIF fields are attached to evidence only after the analyst selects **Attach metadata to evidence**.
- Raw EXIF values, source URL and image hash are preserved through investigation validation and record hashing.

## Interpretation
EXIF metadata is editable, can be copied from another image, and can be stripped or misattributed. DateTimeOriginal may have no timezone; GPS time is UTC when present. The extracted values are leads for corroboration, not proof of capture location, device identity or capture time.
