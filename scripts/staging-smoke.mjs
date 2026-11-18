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
const freshness = await request('/api/intelligence/collection-freshness', { cookie });
expect(freshness.response.ok && Number.isFinite(freshness.data?.total) && Number.isFinite(freshness.data?.unverified) && typeof freshness.data?.note === 'string', 'collection freshness endpoint separates publication age and collection delay');
expect(Array.isArray(freshness.data?.items) && freshness.data.items.every(item => ['ITEM_CAPTURE','FEED_SNAPSHOT_PROXY'].includes(item.collectionTimestampType)), 'freshness rows label exact capture timestamps versus snapshot proxies');


const specialistRoles = ['DEFENCE_IW','CORPORATE_RISK','SUPPLY_CHAIN','GEOPOLITICAL','STRATEGIC'];
for (const role of specialistRoles) {
  const contract = await request('/api/specialist-workflows', { cookie });
  expect(contract.response.ok && contract.data?.roles?.[role], role + ' workflow contract is available');
  const validation = await request('/api/specialist-workflows/' + role + '/validate', { method:'POST', body:{}, cookie });
  expect(validation.response.ok && validation.data?.role === role && validation.data?.status === 'INCOMPLETE_REQUIRES_REVIEW', role + ' validation gate responds honestly to incomplete assessments');
  const workspace = await request('/api/specialist-operations/' + role, { cookie });
  expect(workspace.response.ok && workspace.data?.role === role && workspace.response.headers.get('cache-control') === 'no-store', role + ' private workspace endpoint responds without cache');
}

// Optional live article acceptance: configure a public publisher URL in staging
// secrets. Never use an arbitrary default URL that may change or be paywalled.
if (process.env.STAGING_ARTICLE_URL) {
  const article = await request('/api/article?url=' + encodeURIComponent(process.env.STAGING_ARTICLE_URL), { cookie });
  expect(article.response.ok && article.data?.words >= 60, 'live staging article reader captures readable article text');
  expect(/^[a-f0-9]{64}$/.test(article.data?.provenance?.sha256 || ''), 'article capture returns SHA-256 provenance');
  expect(!!article.data?.provenance?.capturedAt, 'article capture records capture timestamp');
} else {
  console.log('ARTICLE_ACCEPTANCE_SKIPPED: set STAGING_ARTICLE_URL to a public, readable article URL.');
}

// Optional second-account test proves per-user specialist workspace isolation.
// The second account must already exist in the staging environment.
if (process.env.STAGING_SECOND_EMAIL && process.env.STAGING_SECOND_PASSWORD) {
  const secondLogin = await request('/api/auth/login', { method:'POST', body:{ email:process.env.STAGING_SECOND_EMAIL, password:process.env.STAGING_SECOND_PASSWORD } });
  expect(secondLogin.response.ok, 'second staging account authenticates');
  const secondCookie = (secondLogin.response.headers.get('set-cookie') || '').split(';')[0];
  expect(secondCookie.includes('='), 'second account receives an independent session');
  const firstBefore = await request('/api/specialist-operations/DEFENCE_IW', { cookie });
  const secondBefore = await request('/api/specialist-operations/DEFENCE_IW', { cookie:secondCookie });
  expect(firstBefore.response.ok && secondBefore.response.ok, 'both accounts can read their own specialist workspace');
  const firstPrior = firstBefore.data?.workspace?.monitorEnabled === true;
  const secondPrior = secondBefore.data?.workspace?.monitorEnabled === true;
  await request('/api/specialist-operations/DEFENCE_IW/monitor', { method:'PUT', body:{enabled:false}, cookie:secondCookie });
  const enable = await request('/api/specialist-operations/DEFENCE_IW/monitor', { method:'PUT', body:{enabled:true}, cookie });
  expect(enable.response.ok && enable.data?.monitorEnabled === true, 'first account can set its private monitor preference');
  const isolated = await request('/api/specialist-operations/DEFENCE_IW', { cookie:secondCookie });
  expect(isolated.response.ok && isolated.data?.workspace?.monitorEnabled !== true, 'second account cannot read first account specialist monitor state');
  await request('/api/specialist-operations/DEFENCE_IW/monitor', { method:'PUT', body:{enabled:firstPrior}, cookie });
  await request('/api/specialist-operations/DEFENCE_IW/monitor', { method:'PUT', body:{enabled:secondPrior}, cookie:secondCookie });
  await request('/api/auth/logout', { method:'POST', cookie:secondCookie });
} else {
  console.log('TENANT_ISOLATION_SKIPPED: configure STAGING_SECOND_EMAIL and STAGING_SECOND_PASSWORD for the two-account test.');
}

// Explicit opt-in only: this performs real public collection for all five roles,
// then creates assessments where the collection returned usable evidence.
if (process.env.STAGING_RUN_SPECIALIST_E2E === 'true') {
  for (const role of specialistRoles) {
    const collected = await request('/api/specialist-operations/' + role + '/collect', {
      method:'POST', body:{ country:'IND', focus:process.env.STAGING_SPECIALIST_FOCUS || 'India public intelligence update' }, cookie
    });
    expect(collected.response.ok && collected.data?.role === role && !!collected.data?.collection, role + ' live public-source collection completes');
    if ((collected.data?.observations || []).length) {
      const assessment = await request('/api/specialist-operations/' + role + '/assess', {
        method:'POST', body:{ judgement:'Staging acceptance assessment; not an operational judgement.', confidence:'LOW', alternatives:'Test-only alternative explanations.', implications:'No operational implication; staging validation only.', reviewDate:new Date().toISOString().slice(0,10) }, cookie
      });
      expect(assessment.response.ok && assessment.data?.record?.role === role, role + ' assessment persists for analyst review');
    } else {
      console.log('ASSESSMENT_SKIPPED_' + role + ': collection returned no observations; no evidence was fabricated.');
    }
  }
}

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
