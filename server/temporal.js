// Explicit timestamp semantics shared by user-facing intelligence surfaces.
// Values are normalised to milliseconds; missing dates are never presented as current.
export function normaliseTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}
export function classifyTimestamp(value, { now = Date.now(), maxAgeMs = 7 * 86400000, futureToleranceMs = 86400000 } = {}) {
  const timestamp = normaliseTimestamp(value);
  if (timestamp === null) return { timestamp: null, status: 'DATE_UNVERIFIED', ageMs: null };
  const ageMs = now - timestamp;
  if (ageMs < -futureToleranceMs) return { timestamp, status: 'FUTURE_DATED', ageMs };
  if (ageMs > maxAgeMs) return { timestamp, status: 'STALE', ageMs };
  return { timestamp, status: 'FRESH', ageMs };
}
export function comparePublicationRecency(a, b) {
  return (normaliseTimestamp(b) || 0) - (normaliseTimestamp(a) || 0);
}
