// Normalize geospatial metadata into an auditable observation.
// Metadata is never treated as proof of location; callers must preserve its origin.
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const clean = value => String(value ?? '').trim().slice(0, 500);

function dmsToDecimal(value, ref, axis) {
  if (finite(value)) {
    const n = Number(value);
    if ((axis === 'lat' && Math.abs(n) > 90) || (axis === 'lon' && Math.abs(n) > 180)) return null;
    return n;
  }
  if (!Array.isArray(value) || value.length !== 3 || !value.every(finite)) return null;
  const [degrees, minutes, seconds] = value.map(Number);
  if (degrees < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null;
  const limit = axis === 'lat' ? 90 : 180;
  if (degrees > limit || (degrees === limit && (minutes > 0 || seconds > 0))) return null;
  const sign = ['S', 'W'].includes(String(ref || '').toUpperCase()) ? -1 : 1;
  if (ref && ![axis === 'lat' ? 'N' : 'E', axis === 'lat' ? 'S' : 'W'].includes(String(ref).toUpperCase())) return null;
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

function parseTimestamp(value) {
  if (value == null || value === '') return { value: null, valid: null };
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? { value: new Date(ms).toISOString(), valid: true } : { value: null, valid: false };
}

// Accepts decimal coordinates or EXIF-style GPSLatitude/GPSLongitude DMS.
// origin describes where metadata came from; this function does not authenticate it.
export function normalizeGeospatialEvidence(input = {}) {
  const meta = input.geospatialMetadata || input.exif || input.metadata || {};
  const latRaw = input.lat ?? input.latitude ?? meta.latitude ?? meta.GPSLatitude;
  const lonRaw = input.lon ?? input.lng ?? input.longitude ?? meta.longitude ?? meta.GPSLongitude;
  const latRef = input.latRef ?? meta.GPSLatitudeRef;
  const lonRef = input.lonRef ?? meta.GPSLongitudeRef;
  const lat = dmsToDecimal(latRaw, latRef, 'lat');
  const lon = dmsToDecimal(lonRaw, lonRef, 'lon');
  const errors = [];
  if (lat === null) errors.push('LATITUDE_MISSING_OR_INVALID');
  if (lon === null) errors.push('LONGITUDE_MISSING_OR_INVALID');
  const rawTime = input.observedAt ?? input.capturedAt ?? meta.DateTimeOriginal ?? meta.timestamp;
  const timestamp = parseTimestamp(rawTime);
  if (timestamp.valid === false) errors.push('INVALID_OBSERVATION_TIMESTAMP');
  const accuracy = input.accuracyMeters ?? meta.accuracyMeters ?? meta.GPSHPositioningError ?? null;
  const accuracyMeters = finite(accuracy) && Number(accuracy) >= 0 ? Number(accuracy) : null;
  if (accuracy != null && accuracyMeters === null) errors.push('INVALID_ACCURACY_RADIUS');
  const origin = clean(input.metadataOrigin || meta.origin || input.provenance || 'UNSPECIFIED');
  const sourceReference = clean(input.metadataSource || meta.source || input.url || '');
  return {
    valid: errors.length === 0,
    coordinates: lat !== null && lon !== null ? { lat, lon } : null,
    observedAt: timestamp.value,
    accuracyMeters,
    metadata: { origin, sourceReference, fieldsUsed: [
      latRaw != null ? 'latitude' : null, lonRaw != null ? 'longitude' : null,
      rawTime != null ? 'timestamp' : null, accuracy != null ? 'accuracy' : null
    ].filter(Boolean) },
    errors,
    caveats: [
      'Metadata origin is analyst-declared and is not authenticated by this normalizer.',
      'EXIF coordinates and timestamps can be edited, stripped, copied, or misattributed.',
      'A valid coordinate pair does not independently establish where an event occurred.'
    ]
  };
}
