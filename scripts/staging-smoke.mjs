const base = String(process.env.STAGING_BASE_URL || '').replace(/\/$/, '');
const email = process.env.STAGING_EMAIL;
const password = process.env.STAGING_PASSWORD;
const totp = process.env.STAGING_TOTP || '';
if (!base || !email || !password) throw new Error('Set STAGING_BASE_URL, STAGING_EMAIL and STAGING_PASSWORD as GitHub Actions secrets.');
const origin = new URL(base);
if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') throw new Error('Staging URL must use HTTPS (localhost is allowed for local smoke tests).');

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* HTML shell */ }
  return { response, data, text };
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
  console.log('PASS', message);
}

const home = await request('/');
expect(home.response.ok && /html/i.test(home.response.headers.get('content-type') || ''), 'staging web app serves HTML');
expect(home.response.headers.get('x-content-type-options') === 'nosniff', 'browser MIME sniffing is disabled');
if (origin.protocol === 'https:' && process.env.STAGING_EXPECT_HSTS === 'true') {
  expect(/max-age=31536000/.test(home.response.headers.get('strict-transport-security') || ''), 'deployed HTTPS responses advertise one-year HSTS');
} else if (origin.protocol === 'https:') {
  console.log('SKIP HSTS assertion until the updated staging build is deployed and STAGING_EXPECT_HSTS=true.');
}
const health = await request('/api/health');
expect(health.response.ok && health.data?.ok === true, 'liveness endpoint responds');
const ready = await request('/api/health/ready');
expect(ready.response.ok && ready.data?.ready === true && ready.data?.database === 'ready', 'readiness confirms database and fresh feed snapshot');

const login = await request('/api/auth/login', { method:'POST', body:{ email, password, ...(totp ? { totp } : {}) } });
expect(login.response.ok && !!login.data?.user, 'staging test account authenticates');
const setCookie = login.response.headers.get('set-cookie') || '';
const cookie = setCookie.split(';')[0];
expect(cookie.includes('='), 'login issues a session cookie');

const me = await request('/api/auth/me', { cookie });
expect(me.response.ok && me.data?.user?.email?.toLowerCase() === email.toLowerCase(), 'session identifies the expected staging account');
// Admin-only source diagnostics: optional for non-admin smoke accounts, but
// emits the exact failed/cached source IDs and failure classes when available.
if (me.data?.user?.role === 'admin') {
  const ops = await request('/api/admin/ops/health', { cookie });
  expect(ops.response.ok && Array.isArray(ops.data?.sources), 'admin source diagnostics endpoint responds');
  const unhealthy = ops.data.sources.filter(source => source.state === 'error' || source.state === 'cached');
  console.log('SOURCE_DIAGNOSTICS', JSON.stringify({
    sampledAt: new Date(ops.data.sampledAt || Date.now()).toISOString(),
    total: ops.data.sources.length,
    unhealthy: unhealthy.map(({ id, state, failureClass, consecutiveFailures, lastSuccessAgeMs, error }) => ({
      id, state, failureClass, consecutiveFailures, lastSuccessAgeMs,
      error: String(error || '').slice(0, 240),
    })),
  }));
} else {
  console.log('SOURCE_DIAGNOSTICS_SKIPPED: staging account is not an admin; no extra credentials required.');
}

const entitlement = await request('/api/me/entitlement', { cookie });
expect(entitlement.response.ok && !!entitlement.data?.entitlement, 'account entitlement endpoint responds');
const catalogue = await request('/api/catalogue', { cookie });
expect(catalogue.response.ok && Array.isArray(catalogue.data?.features), 'licensing catalogue endpoint responds');
const intel = await request('/api/intel', { cookie });
expect(intel.response.ok && Array.isArray(intel.data?.items) && intel.response.headers.get('cache-control') === 'no-store', 'authenticated live intelligence endpoint responds without cache');

const logout = await request('/api/auth/logout', { method:'POST', cookie });
expect(logout.response.ok && logout.data?.ok === true, 'logout endpoint responds');
const after = await request('/api/auth/me', { cookie });
expect(after.response.ok && after.data?.user === null, 'logout revokes the server-side session');

console.log(JSON.stringify({
  result:'PASS', checkedAt:new Date().toISOString(), base:origin.origin,
  feedUpdatedAt:health.data?.feedsUpdatedAt, feedAgeMs:health.data?.feedAgeMs,
  sourceHealth:ready.data?.sources,
  checks:['web','liveness','readiness/database','login','session','entitlement','licensing catalogue','intelligence snapshot','logout revocation']
}, null, 2));
