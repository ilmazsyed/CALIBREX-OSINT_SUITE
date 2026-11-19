# MP4 / QuickTime GEOINT metadata

The Investigation Studio can inspect publicly accessible MP4 and QuickTime video containers via `GET /api/media/video-metadata?u=<url>`.

## Supported metadata
- Movie-header (`mvhd`) creation time, when present.
- Embedded QuickTime `©xyz` ISO 6709 location string, when present.
- Decimal latitude/longitude and optional altitude parsed from valid ISO 6709 coordinates.
- SHA-256 of the fetched video bytes, source URL, fetch time and content length.

## Limits and safeguards
- The endpoint uses the SSRF-safe fetch path, accepts MP4/QuickTime content types, caps downloads at 50 MB and rate-limits requests per user.
- It reads container atoms only; it does not decode video frames, extract audio, or visually geolocate footage.
- Container creation time may describe file/movie-header creation, not camera capture time.
- Embedded location tags are editable, can be copied, and may be absent even when a video depicts a known place.
- Analysts explicitly attach metadata to evidence; the video hash and metadata are preserved through investigation validation and record hashing.
