/** Resolve a canonical public origin without trusting production Host headers. */
export function getPublicOrigin({ configured = '', production = false, protocol = 'http', host = '' } = {}) {
  if (production && !String(configured).trim()) {
    throw new Error('PUBLIC_URL must be configured in production; refusing to derive OAuth and notification URLs from the request Host header.');
  }
  const candidate = String(configured).trim() || `${protocol}://${host}`;
  let url;
  try { url = new URL(candidate); }
  catch { throw new Error('PUBLIC_URL must be a valid absolute HTTP(S) origin.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PUBLIC_URL must contain only an HTTP(S) origin, without credentials, path, query or fragment.');
  }
  if (production && url.protocol !== 'https:') {
    throw new Error('PUBLIC_URL must use HTTPS in production.');
  }
  return url.origin;
}
