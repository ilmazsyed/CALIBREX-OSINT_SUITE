# EXIF timestamp timezone handling

Calibrex now distinguishes timestamp values that carry an explicit timezone from camera-local EXIF values that do not.

- ISO timestamps ending in `Z` are normalised to UTC.
- ISO timestamps with an explicit numeric offset are converted to UTC and labelled `EXPLICIT_OFFSET`.
- EXIF `DateTimeOriginal` values in `YYYY:MM:DD HH:mm:ss` form are preserved as local wall-clock values when no `OffsetTimeOriginal` is present; the timezone is labelled `UNKNOWN`.
- When `OffsetTimeOriginal` is present, that offset is applied before conversion to UTC.
- GPSDateStamp + GPSTimeStamp are treated as UTC, per EXIF GPS time semantics.
- Invalid timestamps remain explicit errors; no timezone is guessed from the server or analyst location.

Investigation validation and reports expose the timezone certainty alongside the observation time. This avoids silently shifting a camera-local timestamp into UTC.
