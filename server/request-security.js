/**
 * Same-origin guard for API mutations.
 *
 * SameSite=Lax cookies reduce CSRF exposure, but do not protect against
 * same-site sibling subdomains. Enforce the browser Origin/Referer boundary
 * on unsafe API methods. Requests without browser provenance headers remain
 * available for server-to-server clients that authenticate independently.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sameOriginMutationGuard(req, res, next) {
  if (SAFE_METHODS.has(String(req.method || 'GET').toUpperCase())) return next();

  const fetchSite = String(req.get?.('sec-fetch-site') || req.headers?.['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    return res.status(403).json({ error: 'Cross-site API mutations are not permitted.', code: 'cross_site_request' });
  }

  const origin = req.get?.('origin') || req.headers?.origin;
  const referer = req.get?.('referer') || req.headers?.referer;
  const provenance = origin || referer;
  if (!provenance) return next();

  let suppliedOrigin;
  try {
    suppliedOrigin = new URL(provenance).origin;
  } catch {
    return res.status(403).json({ error: 'Invalid request origin.', code: 'invalid_request_origin' });
  }

  const host = req.get?.('host') || req.headers?.host;
  if (!host || suppliedOrigin !== `${req.protocol}://${host}`) {
    return res.status(403).json({ error: 'Requests must originate from this application.', code: 'origin_mismatch' });
  }
  return next();
}
