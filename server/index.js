// Calibrex OSINT Studio server: accounts, admin controls, live feeds API,
// and the built web client. Deploys to Render (see render.yaml).
import express from 'express';
import compression from 'compression';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createStore, newId } from './store.js';
import * as ent from './entitlements.js';
import { startFeedLoop, snapshot, refresh, searchNews, corroborate, onRefresh, setCustomFeeds, setDisabledSources, testFeed, registerProvider, WIRE_KEYS, WIRES, exportState, seedState } from './feeds.js';
import { PROVIDERS as FEED_PROVIDERS } from './providers.js';
import { BUILTIN_SOURCES, SOURCE_GROUPS, sourceHome } from './sources.js';
import { buildSourceNetwork } from './source-network.js';
import { normaliseSourceCandidate, validateCandidateMetadata, candidateDuplicate, prepareCandidateBatch, assessCandidateResponse, sourceActivationEligibility, transitionCandidate } from './source-candidates.js';
import { listSourceCandidateBatches, loadSourceCandidateBatch } from './source-candidate-batches.js';
import { readArticle, articleTexts, safeFetch, readBody } from './article.js';
import { satelliteFor, cleanMedia } from './visuals.js';
import { startMarketsLoop, marketsSnapshot, marketsSeries, onMarketsRefresh } from './markets.js';
import { refreshCrisis, deliverCrisis, crisisSnapshot } from './crisis.js';
import { startSignalsLoop, signalsSnapshot, onSignalsRefresh } from './signals.js';
import { computeRisk, sampleRisk } from './risk.js';
import { sampleInstability, instabilitySnapshot, loadInstabilityHistory, dumpInstabilityHistory } from './instability.js';
import { sampleCorrelations, correlationSnapshot } from './correlation.js';
import { worldmapSnapshot } from './worldmap.js';
import { satellites, satellitesUpdatedAt } from './satellites.js';
import { infrastructure } from './infrastructure.js';
import { startAisLoop, aisSnapshot } from './aisstream.js';
import { startMacroLoop, macroSnapshot } from './macro.js';
import { startDailyBriefLoop, dailyBriefSnapshot, generateDailyBrief } from './dailybrief.js';
import { startGeointLoop, geointSnapshot } from './geoint.js';
import { startConflictLoop, conflictSnapshot } from './conflict.js';
import { startMaritimeLoop, maritimeSnapshot } from './maritime.js';
import { startSanctionsLoop, sanctionsSnapshot, screen as screenSanctions } from './sanctions.js';
import { pivot as runPivot } from './pivot.js';
import { startEntityWatchLoop, runForUser as runEntityWatchForUser } from './entitywatch.js';
import { getGate, setGate, ensureGate, audit as auditSensitive, getAudit as getSensitiveAudit } from './sensitive.js';
import { checkUsername, redditSearch } from './socmint.js';
import { cleanAircraftWatches, runAircraftWatches } from './aircraftwatch.js';
import { searchLibrary } from './library.js';
import { analyzeChatter, chatterReport } from './chatter.js';
import { ensureVapid, pushPublicKey, subscribe as pushSubscribe, unsubscribe as pushUnsubscribe, pushToUser, pushCriticalAlerts, pushBusinessAlerts, pushGovAlerts, pushPoliticsAlerts, notifyDeploy, notifyAdminsOfSignup, notifyAdminsOfRequest, pushStats, pushDiagnostics } from './push.js';
import { cleanDelivery, redactDelivery, runDelivery, sendTest } from './notify.js';
import { recon, parseTarget } from './recon.js';
import { phoneLookup, usernameLinks, PLATFORM_COUNT } from './subject.js';
import { locate, locateCandidates } from './geo.js';
import { applyPlaceCandidates } from './intel-place-context.js';
import { PROVIDERS, encrypt, decrypt, openKey, startOpenRouter, finishOpenRouter, listModels, defaultModel, runTask, runAnalyze, friendlyAiError } from './ai.js';
import { generateSecret, verifyTotp, otpauthUri } from './totp.js';
import { cleanWatchlist, runWatchlists, runWatchlistFor, updateTrends, emailConfigured, MAX_TERMS } from './watch.js';
import { requestTelemetry, opsSnapshot } from './ops.js';
import { summariseCommercialAccounts } from './commercial.js';
import { workspaceRole, canWorkspace, normaliseWorkspaceMemberRole } from './workspace-access.js';
import { ROLE_WORKFLOWS, validateRoleAssessment } from './specialist-workflows.js';
import { assessDefenceCollection, assessCorporateRisk, assessSupplyChainRisk, assessGeopoliticalEnvironment, assessStrategicForesight } from './domain-analytic-engines.js';
import { collectSpecialistData, runSpecialistAssessment, mergeSpecialistWorkspace, filterSpecialistFeedItems, ingestSpecialistFeedSnapshot } from './specialist-operations.js';
import { DEFENCE_SOURCE_REGISTER, buildDefenceBrief } from './defence-intelligence.js';
import { DOMAIN_SOURCE_CATALOG, SPECIALIST_PACKS, normaliseObservation, buildCountryProfile, resolveEntityCandidates, clusterEventCandidates, evaluateWarningIndicator, createForecastRecord, scoreForecastOutcome } from './domain-intelligence.js';
import { detectIntelligencePatterns, buildEventCandidates, validateInvestigation, validateAlertRule, evaluateAlertRules, extractEntityCandidates, buildStixBundle, createEvidenceLedgerEntry, verifyEvidenceLedger, canonicalJson, validateRegistryEntity } from './intelligence.js';
import { mergeMonitorAlerts, transitionMonitorAlert, recordMonitorAlertFeedback, summariseMonitorAlertFeedback, recordMonitorAlertOutcome } from './intelligence-monitor.js';
import { assessCollectionFreshness } from './collection-freshness.js';
import { detectSocialDuplicateCandidates } from './social-duplication.js';
import { buildInvestigationGraph } from './intelligence-graph.js';
import { validateDefenceRecord, buildDefenceRegistry, upsertDefenceRegistryRecord } from './defence-registry.js';
import { createMcpRouter } from './mcp.js';
import { createReportVersion, transitionReportVersion } from './investigation-reports.js';
import { buildInvestigationReport } from './investigation-report-builder.js';
import { renderInvestigationPdf } from './investigation-pdf-renderer.js';
import { transitionInvestigationWorkflow, validateWorkflowTasks } from './investigation-workflow.js';
import { assessSourceReliability, assessSourceIndependence } from './source-reliability.js';
import { validateCoordinates, compareLocationClaims } from './geospatial-validation.js';
import { reverseGeocoder } from './reverse-geocode.js';
import { extractJpegExif, exifToGeospatialEvidence } from './exif-geospatial.js';
import { sanitiseGeospatialContext, attachGeospatialContext } from './geospatial-context.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const PROD = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  if (PROD) console.warn('[auth] SESSION_SECRET is not set; sessions will reset whenever the server restarts.');
  return crypto.randomBytes(32).toString('hex');
})();
const COOKIE = 'cx_session';
const SESSION_DAYS = 30;

const store = createStore();
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use(requestTelemetry);
// File analysis carries a base64 image/PDF, so it gets a larger body limit;
// body-parser marks req._body so the 1mb parser below then skips it.
app.use('/api/ai/analyze', express.json({ limit: '14mb' }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  // Media: pictures come through /api/media; video plays from its source; YouTube and Vimeo embed in privacy mode.
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; media-src 'self' https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});

// ---------------------------------------------------------------- sessions

const sign = v => crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url');
const sessionHash = token => crypto.createHash('sha256').update(token).digest('hex');

// New sessions use an opaque random bearer token whose hash and expiry live
// server-side. Legacy signed cookies remain readable until their normal expiry
// so this security upgrade does not force every existing user to sign in again.
async function issueSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const key = `session:${sessionHash(token)}`;
  const now = Date.now();
  await store.setUserData(userId, key, { createdAt: now, expiresAt: now + SESSION_DAYS * 86400000 });
  res.cookie(COOKIE, `${userId}.${token}`, {
    httpOnly: true, secure: PROD, sameSite: 'lax', maxAge: SESSION_DAYS * 86400000, path: '/',
  });
}
async function readSession(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  let parts;
  try { parts = decodeURIComponent(raw).split('.'); } catch { return null; }
  if (parts.length === 2) {
    const [id, token] = parts;
    if (!id || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const key = `session:${sessionHash(token)}`;
    const record = await store.getUserData(id, key);
    if (!record || !Number.isFinite(record.expiresAt) || Date.now() >= record.expiresAt) return null;
    const revokedBefore = Number(await store.getUserData(id, 'sessions_revoked_before')) || 0;
    if (Number(record.createdAt) <= revokedBefore) return null;
    return { id, key, legacy: false };
  }
  if (parts.length === 3) {
    const [id, issued, mac] = parts;
    const timestamp = Number(issued);
    if (!id || !Number.isFinite(timestamp) || timestamp > Date.now() + 60000 || Date.now() - timestamp > SESSION_DAYS * 86400000) return null;
    const expected = sign(`${id}.${issued}`);
    if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    const revokedBefore = Number(await store.getUserData(id, 'sessions_revoked_before')) || 0;
    if (timestamp <= revokedBefore) return null;
    return { id, key: null, legacy: true };
  }
  return null;
}

// ---- Licensing tiers ---------------------------------------------------------
// Every account has a plan: 'demo' (basic features only, the rest locked behind
// "Get License to Activate"), 'trial' (full access for 7 days, then auto-degraded
// to demo) or 'full' (licensed). Admins always have full access. Accounts that
// predate this system (no `tier` field) are grandfathered to full so nobody is
// locked out by the upgrade. Every change is written to a license audit log.
const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

/** The stored plan label ('demo' | 'trial' | 'full'). Admin & legacy → full. */
function storedPlan(u) {
  if (!u) return 'demo';
  if (u.role === 'admin') return 'full';
  return u.tier || 'full';
}
function trialActive(u) {
  return u?.tier === 'trial' && u.trial_ends_at && Date.now() < u.trial_ends_at;
}
function trialDaysLeft(u) {
  if (!trialActive(u)) return 0;
  return Math.max(0, Math.ceil((u.trial_ends_at - Date.now()) / 86400000));
}
/** The access the account effectively has right now: 'demo' or 'full'. */
function effectiveTier(u) {
  if (!u) return 'demo';
  if (u.role === 'admin') return 'full';
  if (!u.tier) return 'full';                        // legacy accounts → full
  if (u.tier === 'full') return 'full';
  if (u.tier === 'trial') return trialActive(u) ? 'full' : 'demo';
  return 'demo';
}
async function auditLicense(entry) {
  const log = (await store.getSetting('license_audit')) || [];
  log.unshift({ id: newId().slice(0, 12), at: Date.now(), ...entry });
  await store.setSetting('license_audit', log.slice(0, 3000));
}
/** Auto-degrade an expired trial to demo once, and log it. */
async function reconcileTrial(u) {
  if (u && u.tier === 'trial' && u.trial_ends_at && Date.now() >= u.trial_ends_at) {
    await store.updateUser(u.id, { tier: 'demo', trial_ends_at: null });
    u.tier = 'demo'; u.trial_ends_at = null;
    await auditLicense({ action: 'trial_expired', targetId: u.id, email: u.email, by: 'system', from: 'trial', to: 'demo' });
  }
}

const publicUser = u => u && ({
  id: u.id, email: u.email, name: u.name, org: u.org, role: u.role, status: u.status,
  createdAt: u.created_at, lastSeen: u.last_seen, visits: u.visits,
  plan: storedPlan(u), access: effectiveTier(u), trialEndsAt: u.trial_ends_at || null, trialDaysLeft: trialDaysLeft(u),
});

// ---- Subscription entitlements ----------------------------------------------
// The `tier` column now holds the plan id. Legacy accounts (tier null/'full', or
// an active 'trial') get all-access until an admin assigns a new plan.
const NEW_PLANS = ['demo', 'starter', 'professional', 'business', 'enterprise'];
const userPlan = u => (u && NEW_PLANS.includes(u.tier) ? u.tier : 'demo');
function isLegacyFull(u) {
  if (!u) return false;
  if (u.role === 'admin') return true;
  if (!u.tier || u.tier === 'full') return true;
  if (u.tier === 'trial') return trialActive(u);
  return false;
}
const loadEntitlement = async u => ent.normEntitlement(await store.getUserData(u.id, 'entitlement').catch(() => null));
// Admin-editable a-la-carte prices (defaults from the catalogue).
async function groupPrices() {
  const o = await store.getSetting('pricing');
  return { A: +o?.A || ent.GROUP_PRICE.A, B: +o?.B || ent.GROUP_PRICE.B, C: +o?.C || ent.GROUP_PRICE.C };
}
function planMonthlyWith(plan, prices, allow) {
  if (plan === 'demo') return 0;
  if (plan === 'enterprise') return null;              // custom / quote
  const a = allow || ent.PLANS[plan].allow;
  return a.A * prices.A + a.B * prices.B + a.C * prices.C;
}
function shapeEnt(u, e, prices) {
  const plan = userPlan(u);
  const legacyFull = isLegacyFull(u);
  const set = ent.entitledSet({ role: u.role, plan, legacyFull }, e);
  const allow = ent.allowanceFor(plan, e);
  const monthly = planMonthlyWith(plan, prices, allow);
  return {
    plan, allAccess: !!e.allAccess || legacyFull, billing: e.billing,
    allowance: allow,
    selected: e.selected, locked: e.locked, addons: e.addons, entAllow: e.entAllow,
    entitled: [...set], monthly, annual: ent.annualOf(monthly),
  };
}
const shapeUser = async u => (u ? { ...publicUser(u), entitlement: shapeEnt(u, await loadEntitlement(u), await groupPrices()) } : null);
async function auditEntitlement(entry) {
  const log = (await store.getSetting('entitlement_audit')) || [];
  log.unshift({ id: newId().slice(0, 12), at: Date.now(), ...entry });
  await store.setSetting('entitlement_audit', log.slice(0, 5000));
}
const lastSeenWrites = new Map();

async function loadUser(req, res, next) {
  const session = await readSession(req);
  if (session) {
    const id = session.id;
    const u = await store.findUserById(id);
    if (u) {
      await reconcileTrial(u);               // auto-degrade an expired trial
      req.user = u;
      req.session = session;
      const e = await loadEntitlement(u);
      req.ent = e;
      req.entitled = ent.entitledSet({ role: u.role, plan: userPlan(u), legacyFull: isLegacyFull(u) }, e);
      const now = Date.now();
      if (now - (lastSeenWrites.get(u.id) || 0) > 60000) {
        lastSeenWrites.set(u.id, now);
        store.updateUser(u.id, { last_seen: now }).catch(() => {});
      }
    }
  }
  next();
}
app.use('/api', (req, res, next) => loadUser(req, res, next).catch(next));

// Per-feature gating: a data endpoint maps to one sellable feature; a user who
// isn't entitled to it gets a clear "request access" 403. Admins and all-access
// / legacy-full users pass everything. Endpoints not listed here are baseline.
const PATH_FEATURE = [
  [/^\/markets/, 'markets'], [/^\/macro/, 'markets'],
  [/^\/signals/, 'signals'], [/^\/aircraft/, 'signals'],
  [/^\/maritime/, 'maritime'], [/^\/ais/, 'maritime'],
  [/^\/conflict/, 'conflict'], [/^\/instability/, ['conflict', 'exposure', 'copilot']], [/^\/correlations/, ['conflict', 'copilot']],
  [/^\/geoint/, 'geoint'],
  [/^\/worldmap/, ['worldmap', 'liveearth', 'exposure', 'copilot']],
  [/^\/satellites/, 'liveearth'],
  [/^\/infrastructure/, ['worldmap', 'liveearth', 'exposure']],
  [/^\/chatter/, 'chatter'],
  [/^\/trends/, 'trends'],
  [/^\/visuals/, 'visual-intel'], [/^\/media/, 'visual-intel'],
  [/^\/search/, 'research'], [/^\/verify/, 'research'],
  [/^\/subject/, 'subject-lookup'],
  [/^\/sanctions/, 'sanctions'],
  [/^\/socmint/, 'socmint'],
  [/^\/recon/, 'tools'], [/^\/library/, 'tools'],
  [/^\/pivot/, 'graph'], [/^\/entitywatch/, 'graph'],
];
app.use('/api', (req, res, next) => {
  if (!req.user) return next();                       // auth handled by route guards
  if (req.user.role === 'admin') return next();
  const m = PATH_FEATURE.find(([re]) => re.test(req.path));
  if (!m) return next();
  const feats = Array.isArray(m[1]) ? m[1] : [m[1]];
  if (req.entitled && feats.some(f => req.entitled.has(f))) return next();
  return res.status(403).json({
    error: "This feature isn't in your plan yet. Request access from Plans & Features.",
    code: 'feature_locked', feature: feats[0],
  });
});

async function providerContact() {
  return (await store.getSetting('provider_contact')) || '';
}
function requireActive(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue.', code: 'unauthenticated' });
  if (req.user.role === 'admin' || req.user.status === 'active') return next();
  providerContact().then(contact => res.status(403).json({
    code: req.user.status,
    error: req.user.status === 'suspended' ? 'Suspended by Calibrex. Contact your provider for re-access.' : 'Your account is awaiting activation.',
    contact,
  }));
}
function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ error: 'Administrator access required.', code: 'forbidden' });
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Shared fixed-window throttling: PostgreSQL coordinates multiple instances;
// the JSON file store fallback is suitable for a single instance only.
async function rateLimited(req) {
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
  const key = 'auth-ip:' + crypto.createHash('sha256').update(ip).digest('hex');
  return !(await store.consumeRateLimit(key, 15, 15 * 60000)).allowed;
}

// ---------------------------------------------------------------- auth

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/signup', wrap(async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim().slice(0, 80);
  const org = String(req.body.org || '').trim().slice(0, 120);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
  if (!name) return res.status(400).json({ error: 'Enter your operator name.' });
  if (await store.findUserByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
  // New sign-ups start as an active DEMO account: they can explore the basics
  // immediately and see every screen behind "Get License to Activate". An admin
  // promotes them to a 7-day trial or a full license.
  const user = {
    id: newId(), email, name, org,
    password_hash: await bcrypt.hash(password, 10),
    role: 'user', status: 'active', tier: 'demo', trial_ends_at: null,
    created_at: Date.now(), last_seen: Date.now(), visits: 1,
  };
  await store.createUser(user);
  await auditLicense({ action: 'signup', targetId: user.id, email: user.email, by: 'self', from: null, to: 'demo' });
  notifyAdminsOfSignup(store, user).catch(e => console.error('[signup] admin notify', e.message));
  await issueSession(res, user.id);
  res.status(201).json({ user: await shapeUser(user), contact: await providerContact() });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await store.findUserByEmail(email);
  const ok = user && await bcrypt.compare(String(req.body.password || ''), user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' });
  // Second factor, when the operator has enabled it.
  const totp = await store.getUserData(user.id, 'totp');
  if (totp?.enabled) {
    const code = String(req.body.totp || '').trim();
    if (!code) return res.status(401).json({ error: 'Enter your authenticator code.', code: 'totp_required' });
    let secret = ''; try { secret = decrypt(totp.secret); } catch { /* corrupt */ }
    if (!secret || !verifyTotp(secret, code)) return res.status(401).json({ error: 'That authenticator code is wrong or expired.', code: 'totp_invalid' });
  }
  await store.updateUser(user.id, { visits: (user.visits || 0) + 1, last_seen: Date.now() });
  await issueSession(res, user.id);
  res.json({ user: await shapeUser({ ...user, visits: (user.visits || 0) + 1 }), contact: await providerContact() });
}));

app.post('/api/auth/logout', wrap(async (req, res) => {
  if (req.session && !req.session.legacy) await store.setUserData(req.session.id, req.session.key, null);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}));

app.get('/api/auth/me', wrap(async (req, res) => {
  if (!req.user) return res.json({ user: null, contact: '' });
  res.json({ user: await shapeUser(req.user), contact: await providerContact() });
}));

// ---------------------------------------------------------------- subscription
// The feature catalogue, plans and live prices (so the client can render the
// pricing page and the feature picker). Available to any signed-in account.
app.get('/api/catalogue', requireActive, wrap(async (req, res) => {
  const prices = await groupPrices();
  const plans = ent.PLAN_ORDER.map(id => {
    const p = ent.PLANS[id];
    const monthly = planMonthlyWith(id, prices, p.allow);
    return { id, name: p.name, allow: p.allow, custom: !!p.custom, free: !!p.free, requireB: p.requireB || [], monthly, annual: ent.annualOf(monthly) };
  });
  res.json({ features: ent.FEATURES, groupPrice: prices, annualMonths: ent.ANNUAL_MONTHS, plans });
}));

// The caller's own entitlement.
app.get('/api/me/entitlement', requireActive, wrap(async (req, res) => {
  res.json({ entitlement: shapeEnt(req.user, req.ent, await groupPrices()) });
}));

// First feature selection within the plan allowance. Once confirmed it's locked
// — the user can't swap, only add on (a-la-carte) or request a plan upgrade.
app.post('/api/me/entitlement/select', requireActive, wrap(async (req, res) => {
  const e = req.ent;
  if (e.locked) return res.status(400).json({ error: 'Your selection is locked. Add features a-la-carte or request an upgrade.', code: 'selection_locked' });
  const plan = userPlan(req.user);
  const v = ent.validateSelection(plan, e, Array.isArray(req.body.features) ? req.body.features : []);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const next = { ...e, selected: v.clean, locked: true };
  await store.setUserData(req.user.id, 'entitlement', next);
  await auditEntitlement({ action: 'select', userId: req.user.id, email: req.user.email, by: 'self', detail: v.clean.join(', ') });
  res.json({ entitlement: shapeEnt(req.user, next, await groupPrices()) });
}));

// Request a locked feature (a-la-carte add-on) or a plan upgrade. The master
// admin approves from their dashboard; nothing unlocks until then.
app.post('/api/me/entitlement/request', requireActive, wrap(async (req, res) => {
  const featureId = req.body.featureId && ent.FEATURE_BY_ID[req.body.featureId] ? req.body.featureId : null;
  const plan = ent.PLAN_ORDER.includes(req.body.plan) ? req.body.plan : null;
  if (!featureId && !plan) return res.status(400).json({ error: 'Nothing to request.' });
  const note = String(req.body.note || '').slice(0, 300);
  const list = (await store.getSetting('feature_requests')) || [];
  // Collapse duplicate open requests for the same thing.
  const dup = list.find(r => r.status === 'pending' && r.userId === req.user.id && r.featureId === featureId && r.plan === plan);
  if (dup) return res.json({ ok: true, duplicate: true });
  const entry = {
    id: newId().slice(0, 12), at: Date.now(), status: 'pending',
    userId: req.user.id, email: req.user.email,
    kind: plan ? 'plan' : 'feature', featureId, plan,
    group: featureId ? ent.groupOf(featureId) : null, note,
  };
  list.unshift(entry);
  await store.setSetting('feature_requests', list.slice(0, 5000));
  await auditEntitlement({ action: 'request', userId: req.user.id, email: req.user.email, by: 'self', detail: plan ? `plan:${plan}` : `feature:${featureId}` });
  notifyAdminsOfRequest(store, req.user, entry).catch(() => {});
  res.json({ ok: true, request: entry });
}));

app.post('/api/auth/password', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue.' });
  const current = String(req.body.current || '');
  const next = String(req.body.next || '');
  if (!await bcrypt.compare(current, req.user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (next.length < 8) return res.status(400).json({ error: 'Use a new password of at least 8 characters.' });
  await store.updateUser(req.user.id, { password_hash: await bcrypt.hash(next, 10) });
  await store.setUserData(req.user.id, 'sessions_revoked_before', Date.now() - 1);
  await issueSession(res, req.user.id);
  res.json({ ok: true });
}));

// Two-factor auth (TOTP). The secret is stored encrypted; enabled only after a
// code proves the authenticator is set up.
app.get('/api/auth/2fa', requireActive, wrap(async (req, res) => {
  const t = await store.getUserData(req.user.id, 'totp');
  res.json({ enabled: !!t?.enabled });
}));
app.post('/api/auth/2fa/setup', requireActive, wrap(async (req, res) => {
  const secret = generateSecret();
  await store.setUserData(req.user.id, 'totp', { enabled: false, secret: encrypt(secret) });
  res.json({ secret, uri: otpauthUri(secret, req.user.email) });
}));
app.post('/api/auth/2fa/enable', requireActive, wrap(async (req, res) => {
  const t = await store.getUserData(req.user.id, 'totp');
  if (!t?.secret) return res.status(400).json({ error: 'Start setup first.' });
  let secret = ''; try { secret = decrypt(t.secret); } catch { /* */ }
  if (!secret || !verifyTotp(secret, String(req.body.code || ''))) return res.status(400).json({ error: 'That code is wrong or expired. Try the current one.' });
  await store.setUserData(req.user.id, 'totp', { enabled: true, secret: t.secret });
  res.json({ enabled: true });
}));
app.post('/api/auth/2fa/disable', requireActive, wrap(async (req, res) => {
  const t = await store.getUserData(req.user.id, 'totp');
  if (!t?.enabled) return res.json({ enabled: false });
  let secret = ''; try { secret = decrypt(t.secret); } catch { /* */ }
  if (!secret || !verifyTotp(secret, String(req.body.code || ''))) return res.status(400).json({ error: 'Enter a current authenticator code to turn off two-factor auth.' });
  await store.setUserData(req.user.id, 'totp', { enabled: false });
  res.json({ enabled: false });
}));

// Self-service profile editing. Core fields (name, org) are columns; extended
// fields live in the per-user 'profile' record. Every change is appended to a
// server-side audit the master admin can review.
const PROFILE_EXT = ['title', 'phone', 'location', 'bio'];
const cleanStr = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
async function appendProfileAudit(entry) {
  const log = (await store.getSetting('profile_audit')) || [];
  log.unshift(entry);
  await store.setSetting('profile_audit', log.slice(0, 1000));
}
app.get('/api/me/profile', requireActive, wrap(async (req, res) => {
  const ext = (await store.getUserData(req.user.id, 'profile')) || {};
  res.json({ user: publicUser(req.user), profile: ext });
}));
app.put('/api/me/profile', requireActive, wrap(async (req, res) => {
  const body = req.body || {};
  const current = (await store.getUserData(req.user.id, 'profile')) || {};
  const changes = [];
  const patch = {};
  if (typeof body.name === 'string') {
    const name = cleanStr(body.name, 80);
    if (name && name !== req.user.name) { patch.name = name; changes.push({ field: 'name', from: req.user.name || '', to: name }); }
  }
  if (typeof body.org === 'string') {
    const org = cleanStr(body.org, 120);
    if (org !== (req.user.org || '')) { patch.org = org; changes.push({ field: 'org', from: req.user.org || '', to: org }); }
  }
  const nextExt = { ...current };
  for (const f of PROFILE_EXT) {
    if (body[f] === undefined) continue;
    const val = cleanStr(body[f], f === 'bio' ? 500 : 120);
    if (val !== (current[f] || '')) { nextExt[f] = val; changes.push({ field: f, from: current[f] || '', to: val }); }
  }
  if (!changes.length) return res.json({ user: publicUser(req.user), profile: current, changed: 0 });
  if (Object.keys(patch).length) await store.updateUser(req.user.id, patch);
  await store.setUserData(req.user.id, 'profile', nextExt);
  await appendProfileAudit({ id: Date.now().toString(36), userId: req.user.id, email: req.user.email, name: patch.name || req.user.name, at: Date.now(), changes });
  const updated = { ...req.user, ...patch };
  res.json({ user: publicUser(updated), profile: nextExt, changed: changes.length });
}));
app.get('/api/admin/profile-audit', requireAdmin, wrap(async (req, res) => {
  res.json({ entries: (await store.getSetting('profile_audit')) || [] });
}));

// Screen-capture / screen-recording detections reported by the client. The
// web platform can't block a screenshot, but we log every detectable capture
// signal against the account so any leak is attributable and auditable.
app.post('/api/security/capture-event', requireActive, wrap(async (req, res) => {
  const kind = String(req.body?.kind || 'unknown').slice(0, 24);
  const view = String(req.body?.view || '').slice(0, 40);
  const log = (await store.getSetting('capture_audit')) || [];
  log.unshift({
    id: newId().slice(0, 12), at: Date.now(), kind, view,
    userId: req.user.id, email: req.user.email,
    ua: String(req.headers['user-agent'] || '').slice(0, 160),
    ip: req.ip,
  });
  await store.setSetting('capture_audit', log.slice(0, 5000));
  res.json({ ok: true });
}));
app.get('/api/admin/capture-audit', requireAdmin, wrap(async (req, res) => {
  res.json({ entries: (await store.getSetting('capture_audit')) || [] });
}));

// ---------------------------------------------------------------- live intel

app.get('/api/intel', requireActive, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const snap = snapshot();
  res.json({ ...snap, items: snap.items.slice(0, 600) });
});

let lastManualRefresh = 0;
app.post('/api/intel/refresh', requireActive, wrap(async (req, res) => {
  if (Date.now() - lastManualRefresh < 60000) return res.json({ ok: true, throttled: true });
  lastManualRefresh = Date.now();
  await refresh();
  res.json({ ok: true });
}));

app.get('/api/search', requireActive, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: 'Enter something to search for.' });
  const window = ['1d', '3d', '7d', '30d'].includes(String(req.query.window)) ? String(req.query.window) : '7d';
  try {
    res.json({ query: q, window, results: await searchNews(q, window), searchedAt: Date.now() });
  } catch (e) {
    res.status(502).json({ error: `The news search could not be reached (${e.message}). Try again in a moment.` });
  }
}));

app.post('/api/verify', requireActive, wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 600);
  if (!text) return res.status(400).json({ error: 'Nothing to verify.' });
  try {
    res.json(await corroborate(text));
  } catch (e) {
    res.status(502).json({ error: `The corroboration search could not be reached (${e.message}). Try again in a moment.` });
  }
}));

// ---------------------------------------------------------------- article reader

const readCalls = new Map();
app.get('/api/article', requireActive, wrap(async (req, res) => {
  const url = String(req.query.url || '').trim().slice(0, 2000);
  if (!url) return res.status(400).json({ error: 'No link to read.' });
  const now = Date.now();
  const recent = (readCalls.get(req.user.id) || []).filter(t => now - t < 10 * 60000);
  if (recent.length >= 80) return res.status(429).json({ error: 'Too many articles opened. Wait a few minutes.' });
  recent.push(now);
  readCalls.set(req.user.id, recent);
  try {
    res.json(await readArticle(url));
  } catch (e) {
    res.status(e.status === 400 ? 400 : 502).json({ error: e.message });
  }
}));

/**
 * After each refresh, read the full article behind the most serious new
 * reports: fills in a summary where the feed had none, places reports on the
 * map when only the article body names the location, and collects the
 * story's photos and video for Visual Intel. Results are cached by item id
 * and re-applied every refresh (items are rebuilt from the feeds each time).
 */
const enrichCache = new Map(); // item id -> { summary, place, placeCandidates, words, media } | null (unreadable)
function applyEnrichment(it, e) {
  if (!e) return;
  if (!it.summary && e.summary) it.summary = e.summary;
  if (!it.place && e.place) it.place = e.place;
  if (e.placeCandidates?.length) applyPlaceCandidates(it, e.placeCandidates);
  if (e.words) it.words = e.words;
  if (e.media?.length) it.media = cleanMedia([...(it.media || []), ...e.media], 6);
}
async function enrichTopItems(items) {
  for (const it of items) if (enrichCache.has(it.id)) applyEnrichment(it, enrichCache.get(it.id));
  const fresh = items.filter(i => i.kind !== 'social' && !enrichCache.has(i.id) && !/youtube\.com|youtu\.be|t\.me\//.test(i.url));
  const picks = [
    ...fresh.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH').slice(0, 14),
    ...fresh.filter(i => i.severity === 'MEDIUM' && i.place).slice(0, 8),
  ];
  for (let i = 0; i < picks.length; i += 4) {
    await Promise.all(picks.slice(i, i + 4).map(async it => {
      try {
        const a = await readArticle(it.url);
        const lead = a.paragraphs.slice(0, 4).join(' ');
        const placeText = lead.slice(0, 2400);
        const placeCandidates = locateCandidates(placeText, { limit: 8 });
        const e = { summary: (a.excerpt || lead).slice(0, 500), place: locate(placeText), placeCandidates, words: a.words, media: (a.media || []).slice(0, 6) };
        enrichCache.set(it.id, e);
        applyEnrichment(it, e);
      } catch { enrichCache.set(it.id, null); }
    }));
  }
  if (enrichCache.size > 6000) for (const k of [...enrichCache.keys()].slice(0, 2000)) enrichCache.delete(k);
}

// ---------------------------------------------------------------- visual intel

// Images are fetched through the server: keeps a strict content policy, avoids
// publishers blocking hot-linked images, and hides viewers' addresses.
const exifCalls = new Map();
app.get('/api/media/exif', requireActive, wrap(async (req, res) => {
  const url = String(req.query.u || '').slice(0, 3000);
  if (!url) return res.status(400).json({ error: 'Image URL is required.' });
  const now = Date.now();
  const recent = (exifCalls.get(req.user.id) || []).filter(t => now - t < 10 * 60 * 1000);
  if (recent.length >= 30) return res.status(429).json({ error: 'Image metadata extraction limit reached. Try again later.' });
  recent.push(now);
  exifCalls.set(req.user.id, recent);
  const { res: upstream } = await safeFetch(url, { headers: { Accept: 'image/jpeg' } });
  const type = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!upstream.ok || type !== 'image/jpeg') return res.status(415).json({ error: 'Only publicly accessible JPEG images are supported for EXIF extraction.' });
  const bytes = Buffer.from(await readBody(upstream, 12 * 1024 * 1024, { truncate: false, binary: true }));
  const parsed = extractJpegExif(bytes);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const evidence = exifToGeospatialEvidence(parsed, url, sha256, new Date().toISOString());
  res.set('Cache-Control', 'no-store');
  res.json({ ...parsed, evidence, image: { sha256, bytes: bytes.length, contentType: type }, attribution: 'Metadata extracted from the source image supplied by the analyst.', caveat: 'EXIF is editable and may be copied, stripped or misattributed; verify against independent sources.' });
}));

const mediaCalls = new Map();
app.get('/api/media', requireActive, wrap(async (req, res) => {
  const url = String(req.query.u || '').slice(0, 3000);
  const now = Date.now();
  const recent = (mediaCalls.get(req.user.id) || []).filter(t => now - t < 10 * 60000);
  if (recent.length >= 1500) return res.status(429).end();
  recent.push(now);
  mediaCalls.set(req.user.id, recent);
  try {
    const { res: up } = await safeFetch(url, { headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.5' } });
    const type = up.headers.get('content-type') || '';
    if (!up.ok || !/^image\/(jpeg|png|webp|gif|avif)/.test(type)) return res.status(415).end();
    const body = Buffer.from(await readBody(up, 12 * 1024 * 1024, { truncate: false, binary: true }));
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.send(body);
  } catch {
    res.status(502).end();
  }
}));

const toVisual = it => ({
  id: it.id, title: it.title, url: it.url, source: it.source, kind: it.kind || 'news', published: it.published,
  severity: it.severity, wire: it.wire, place: it.place?.name || null, media: it.media || [],
});

/** Everything visual from the current 48-hour window, newest first, plus satellite watch for top threats. */
app.get('/api/visuals', requireActive, (req, res) => {
  const snap = snapshot();
  const stories = snap.items.filter(i => i.media?.length).slice(0, 300).map(toVisual);
  const satellite = snap.threats.slice(0, 10).map(t => ({ threatId: t.id, title: t.title, severity: t.severity, ...satelliteFor(t.lat, t.lng, t.location) }));
  res.json({ updatedAt: snap.updatedAt, stories, satellite });
});

/** The visual collection for one story, alert or threat vector. */
app.post('/api/visuals/collect', requireActive, wrap(async (req, res) => {
  const urls = [...new Set((Array.isArray(req.body.urls) ? req.body.urls : []).map(String).filter(u => /^https?:\/\//.test(u)))].slice(0, 8);
  const title = String(req.body.title || '').slice(0, 300);
  const items = snapshot().items;
  const media = [];
  const add = (list, from) => list.forEach(m => media.push({ ...m, from }));
  for (const u of urls) {
    const it = items.find(i => i.url === u);
    if (it?.media?.length) add(it.media, { title: it.title, source: it.source, url: it.url, published: it.published, kind: it.kind });
  }
  // Read the articles themselves for their photos and video (cached, time-boxed).
  const readable = urls.filter(u => !/t\.me\/|bsky\.app\//.test(u)).slice(0, 6);
  await Promise.race([
    Promise.all(readable.map(async u => {
      try {
        const a = await readArticle(u);
        const it = items.find(i => i.url === u);
        add(a.media || [], { title: it?.title || a.title, source: it?.source || a.siteName, url: u, published: it?.published || a.published, kind: it?.kind || 'news' });
      } catch { /* unreadable */ }
    })),
    new Promise(r => setTimeout(r, 20000)),
  ]);
  const seen = new Set();
  const unique = media.filter(m => { const k = m.src || m.href || m.poster; if (!k || seen.has(k)) return false; seen.add(k); return true; });
  // Satellite: explicit coordinates, else the place the story names.
  let lat = Number(req.body.lat); let lng = Number(req.body.lng); let place = String(req.body.place || '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    const hit = locate(title) || urls.map(u => items.find(i => i.url === u)?.place).find(Boolean);
    lat = hit?.lat; lng = hit?.lng; place = place || hit?.name || '';
  }
  res.json({ title, media: unique.slice(0, 40), satellite: satelliteFor(lat, lng, place), searched: urls.length, collectedAt: Date.now() });
}));

// ---------------------------------------------------------------- infrastructure recon

// Domain / IP recon from public, keyless sources. For investigating the
// infrastructure behind a threat actor's site, not people.
const reconCalls = new Map();
app.post('/api/recon', requireActive, wrap(async (req, res) => {
  const target = String(req.body.target || '').slice(0, 300);
  if (!parseTarget(target)) return res.status(400).json({ error: 'Enter a domain (example.com) or an IP address. This tool looks up infrastructure, not people.' });
  const now = Date.now();
  const recent = (reconCalls.get(req.user.id) || []).filter(t => now - t < 10 * 60000);
  if (recent.length >= 30) return res.status(429).json({ error: 'Too many recon lookups. Wait a few minutes.' });
  recent.push(now);
  reconCalls.set(req.user.id, recent);
  try {
    res.json(await recon(target));
  } catch (e) {
    res.status(e.status === 400 ? 400 : 502).json({ error: e.message });
  }
}));

// ---------------------------------------------------------------- subject lookups (Phase 3)
// OFF BY DEFAULT. Requires: an admin master switch on, a per-user grant, an
// accepted usage agreement, a stated purpose + case reference, and within a
// daily limit. Every search is written to an immutable audit log.

const DEFAULT_AGREEMENT = [
  'Calibrex Subject Lookup — Acceptable Use Agreement',
  '1. You will use subject lookups only for a lawful, professional purpose (journalism, security, due diligence, fraud or threat investigation).',
  '2. You will not use them to stalk, harass, dox, intimidate or profile private individuals, or to target minors.',
  '3. For each search you provide a truthful purpose and case reference. You are the controller of the personal data you process and are responsible for compliance with the DPDP Act 2023 and any other law that applies to you.',
  '4. Results are unverified leads (candidate links and public metadata), not confirmations of identity. You will verify independently before acting.',
  '5. Each use is recorded with your identity, the query, the time and your acceptance of this agreement. The provider may audit use and may suspend or report misuse.',
].join('\n');

// A short, stable digest so a stored agreement has a comparable version id.
function agreementVersion(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 12);
}
const subjectDefaults = { enabled: false, dailyLimit: 25 };
async function subjectConfig() { return { ...subjectDefaults, ...((await store.getSetting('subject_config')) || {}) }; }
const subjectAccess = uid => store.getUserData(uid, 'subject_access').then(v => v || { allowed: false });
// Admin-editable agreement text; version is derived from the text itself.
async function subjectAgreement() {
  const stored = await store.getSetting('subject_agreement');
  const text = (stored && typeof stored.text === 'string' && stored.text.trim()) ? stored.text : DEFAULT_AGREEMENT;
  return { text, version: agreementVersion(text), updatedAt: stored?.updatedAt || null, updatedBy: stored?.updatedBy || null };
}

async function auditSubject(entry) {
  const log = (await store.getSetting('subject_audit')) || [];
  log.unshift(entry);
  await store.setSetting('subject_audit', log.slice(0, 3000));
}
async function usedToday(uid) {
  const since = new Date().setHours(0, 0, 0, 0);
  return ((await store.getSetting('subject_audit')) || []).filter(e => e.userId === uid && e.at >= since && (e.kind === 'phone' || e.kind === 'username')).length;
}

async function subjectState(user) {
  const cfg = await subjectConfig();
  const access = await subjectAccess(user.id);
  const allowed = user.role === 'admin' || access.allowed;
  const agreement = await subjectAgreement();
  return {
    enabled: cfg.enabled,
    allowed: cfg.enabled && allowed,
    agreementVersion: agreement.version,
    agreementText: agreement.text,
    dailyLimit: cfg.dailyLimit,
    usedToday: await usedToday(user.id),
    platformCount: PLATFORM_COUNT,
  };
}

// Gate shared by every lookup: switched on, granted, under the daily limit.
async function subjectGuard(req, res) {
  const st = await subjectState(req.user);
  if (!st.enabled) { res.status(403).json({ error: 'Subject lookups are switched off by your provider.', code: 'subject_off' }); return null; }
  if (!st.allowed) { res.status(403).json({ error: 'Subject lookups are not enabled for your account. Ask your provider for access.', code: 'subject_not_allowed' }); return null; }
  if (st.usedToday >= st.dailyLimit) { res.status(429).json({ error: `Daily lookup limit reached (${st.dailyLimit}). It resets at midnight.`, code: 'subject_limit' }); return null; }
  return st;
}
// Every lookup requires a fresh acceptance of the CURRENT agreement.
async function acceptanceOf(req, res) {
  const agreement = await subjectAgreement();
  if (req.body.accept !== true || req.body.agreementVersion !== agreement.version) {
    res.status(403).json({ error: 'You must read and accept the Acceptable Use Agreement for this lookup before it runs.', code: 'subject_accept_required', agreementVersion: agreement.version, agreementText: agreement.text });
    return null;
  }
  return agreement.version;
}
// Purpose + case reference are mandatory and recorded.
function purposeOf(req, res) {
  const purpose = String(req.body.purpose || '').trim();
  const caseRef = String(req.body.caseRef || '').trim().slice(0, 80);
  if (purpose.length < 8) { res.status(400).json({ error: 'State the investigative purpose (at least 8 characters). It is recorded in the audit log.' }); return null; }
  return { purpose: purpose.slice(0, 300), caseRef };
}

app.get('/api/subject/status', requireActive, wrap(async (req, res) => res.json(await subjectState(req.user))));

app.post('/api/subject/phone', requireActive, wrap(async (req, res) => {
  if (!await subjectGuard(req, res)) return;
  const meta = purposeOf(req, res); if (!meta) return;
  const acceptedVersion = await acceptanceOf(req, res); if (!acceptedVersion) return;
  const result = phoneLookup(req.body.number, req.body.country);
  if (!result.ok) return res.status(400).json({ error: result.error });
  await auditSubject({ id: newId().slice(0, 12), at: Date.now(), userId: req.user.id, email: req.user.email, kind: 'phone', query: result.e164, accepted: true, agreementVersion: acceptedVersion, ...meta });
  res.json({ result, usedToday: await usedToday(req.user.id) });
}));

app.post('/api/subject/username', requireActive, wrap(async (req, res) => {
  if (!await subjectGuard(req, res)) return;
  const meta = purposeOf(req, res); if (!meta) return;
  const acceptedVersion = await acceptanceOf(req, res); if (!acceptedVersion) return;
  const result = usernameLinks(req.body.username);
  if (!result.ok) return res.status(400).json({ error: result.error });
  await auditSubject({ id: newId().slice(0, 12), at: Date.now(), userId: req.user.id, email: req.user.email, kind: 'username', query: result.username, accepted: true, agreementVersion: acceptedVersion, ...meta });
  res.json({ result, usedToday: await usedToday(req.user.id) });
}));

// ---------------------------------------------------------------- per-user data

const DATA_KEYS = new Set(['history', 'research_log', 'settings', 'dismissed_alerts', 'push_prefs', 'briefs', 'profile', 'entity_watches', 'atlas_map_bookmarks']);
app.get('/api/me/data/:key', requireActive, wrap(async (req, res) => {
  if (!DATA_KEYS.has(req.params.key)) return res.status(404).json({ error: 'Unknown record.' });
  res.json({ value: await store.getUserData(req.user.id, req.params.key) });
}));
app.put('/api/me/data/:key', requireActive, wrap(async (req, res) => {
  if (!DATA_KEYS.has(req.params.key)) return res.status(404).json({ error: 'Unknown record.' });
  await store.setUserData(req.user.id, req.params.key, req.body.value ?? null);
  res.json({ ok: true });
}));


// ---------------------------------------------------------------- AI layer (optional)
// Each operator connects their own AI account. Keys are stored encrypted in
// user_data under 'ai_connection', which the generic data API never exposes.

const aiEnabled = async () => (await store.getSetting('ai_enabled')) !== false;
const getConn = userId => store.getUserData(userId, 'ai_connection');
const publicOrigin = req => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
const modelCache = new Map(); // userId -> { at, models }

async function modelsFor(userId, conn) {
  const hit = modelCache.get(userId);
  if (hit && hit.key === conn.key && Date.now() - hit.at < 10 * 60000) return hit.models;
  const models = await listModels(conn.provider, openKey(conn));
  modelCache.set(userId, { at: Date.now(), key: conn.key, models });
  return models;
}
async function saveConnection(userId, provider, key, family) {
  const models = await listModels(provider, key);
  if (!models.length) throw Object.assign(new Error('This account has no chat models available.'), { status: 400 });
  const conn = { provider, key: encrypt(key), model: defaultModel(provider, models, family), connectedAt: Date.now(), hint: key.slice(-4) };
  await store.setUserData(userId, 'ai_connection', conn);
  modelCache.set(userId, { at: Date.now(), key: conn.key, models });
  return conn;
}
const describeConn = c => c && ({ provider: c.provider, providerLabel: PROVIDERS[c.provider]?.label, model: c.model, connectedAt: c.connectedAt, hint: c.hint });

async function requireAi(req, res, next) {
  if (!await aiEnabled()) return res.status(403).json({ error: 'AI features are switched off by your provider.', code: 'ai_disabled' });
  next();
}

app.get('/api/ai/status', requireActive, wrap(async (req, res) => {
  res.json({ enabled: await aiEnabled(), connection: describeConn(await getConn(req.user.id)) });
}));

// Step 1 of the one-click flow: send the operator to OpenRouter to sign in and approve.
app.get('/api/ai/openrouter/start', requireActive, wrap(async (req, res) => {
  if (!await aiEnabled()) return res.redirect('/?ai=error&reason=' + encodeURIComponent('AI features are switched off by your provider.'));
  const family = ['Claude', 'ChatGPT', 'Gemini'].includes(req.query.family) ? req.query.family : 'Claude';
  const url = startOpenRouter(req.user.id, publicOrigin(req));
  res.cookie('cx_ai_family', family, { httpOnly: true, secure: PROD, sameSite: 'lax', maxAge: 20 * 60000, path: '/api/ai' });
  res.redirect(url);
}));

// Step 2: OpenRouter sends the operator back here with a one-time code.
app.get('/api/ai/openrouter/callback', wrap(async (req, res) => {
  const back = (ok, reason) => res.redirect(ok ? '/?ai=connected' : '/?ai=error&reason=' + encodeURIComponent(reason));
  if (!req.user) return back(false, 'Your session ended during sign-in. Sign in to Calibrex and connect again.');
  if (!req.query.code) return back(false, 'OpenRouter did not approve the connection.');
  try {
    const key = await finishOpenRouter(String(req.query.state || ''), String(req.query.code), req.user.id);
    const family = (req.headers.cookie || '').match(/cx_ai_family=(\w+)/)?.[1];
    await saveConnection(req.user.id, 'openrouter', key, family);
    res.clearCookie('cx_ai_family', { path: '/api/ai' });
    back(true);
  } catch (e) {
    back(false, friendlyAiError(e));
  }
}));

// Advanced: paste a key from Anthropic, OpenAI or Google.
app.post('/api/ai/key', requireActive, requireAi, wrap(async (req, res) => {
  const provider = String(req.body.provider || '');
  const key = String(req.body.key || '').trim();
  if (!['anthropic', 'openai', 'gemini', 'openrouter'].includes(provider)) return res.status(400).json({ error: 'Choose a provider.' });
  if (key.length < 20 || /\s/.test(key)) return res.status(400).json({ error: 'That does not look like an API key. Copy the whole key and paste it again.' });
  try {
    res.json({ connection: describeConn(await saveConnection(req.user.id, provider, key)) });
  } catch (e) {
    res.status(400).json({ error: e.status === 401 || e.status === 403 ? 'The provider rejected this key. Check you copied all of it and that it is active.' : friendlyAiError(e) });
  }
}));

app.get('/api/ai/models', requireActive, requireAi, wrap(async (req, res) => {
  const conn = await getConn(req.user.id);
  if (!conn) return res.status(400).json({ error: 'Connect an AI account first.' });
  try { res.json({ models: await modelsFor(req.user.id, conn), selected: conn.model }); }
  catch (e) { res.status(502).json({ error: friendlyAiError(e) }); }
}));

app.put('/api/ai/model', requireActive, requireAi, wrap(async (req, res) => {
  const conn = await getConn(req.user.id);
  if (!conn) return res.status(400).json({ error: 'Connect an AI account first.' });
  const model = String(req.body.model || '');
  const models = await modelsFor(req.user.id, conn).catch(() => []);
  if (models.length && !models.some(m => m.id === model)) return res.status(400).json({ error: 'That model is not available on your account.' });
  await store.setUserData(req.user.id, 'ai_connection', { ...conn, model });
  res.json({ connection: describeConn({ ...conn, model }) });
}));

app.delete('/api/ai', requireActive, wrap(async (req, res) => {
  await store.setUserData(req.user.id, 'ai_connection', null);
  modelCache.delete(req.user.id);
  res.json({ ok: true });
}));

const aiCalls = new Map();
app.post('/api/ai/generate', requireActive, requireAi, wrap(async (req, res) => {
  const conn = await getConn(req.user.id);
  if (!conn) return res.status(400).json({ error: 'Connect an AI account in Settings → AI Connection first.', code: 'ai_not_connected' });
  const now = Date.now();
  const recent = (aiCalls.get(req.user.id) || []).filter(t => now - t < 10 * 60000);
  if (recent.length >= 40) return res.status(429).json({ error: 'Too many AI requests. Wait a few minutes.' });
  recent.push(now);
  aiCalls.set(req.user.id, recent);
  const task = String(req.body.task || '');
  const input = { ...(req.body.input || {}) };
  try {
    // Ground the AI in the articles themselves, not just their headlines.
    if (task === 'article') {
      if (!input.text && input.url) input.text = (await readArticle(String(input.url))).text;
      if (!input.text) return res.status(400).json({ error: 'There is no article text to summarise.' });
    } else if (task !== 'copilot' && Array.isArray(input.sources) && input.sources.length) {
      // The copilot is grounded by its context block + source titles, so it
      // skips the heavy full-text fetch that bloats and slows the request.
      const texts = await articleTexts(input.sources.filter(x => x?.kind !== 'social').map(x => String(x?.url || '')), { max: task === 'verify' ? 5 : 6 });
      input.sources = input.sources.map(x => ({ ...x, text: texts.get(String(x?.url || '')) || '' }));
    }
    const text = await runTask(conn, task, input);
    res.json({ text, model: conn.model, provider: conn.provider, generatedAt: Date.now(), articlesRead: (input.sources || []).filter(x => x.text).length });
  } catch (e) {
    if (e.message === 'Unknown AI task.') return res.status(400).json({ error: e.message });
    console.error('[ai]', conn.provider, e.status || '', e.message);
    res.status(502).json({ error: friendlyAiError(e) });
  }
}));

// Analyse an uploaded image / PDF / text file (multimodal) and extract OSINT.
app.post('/api/ai/analyze', requireActive, requireAi, wrap(async (req, res) => {
  const conn = await getConn(req.user.id);
  if (!conn) return res.status(400).json({ error: 'Connect an AI account in Settings → AI Connection first.', code: 'ai_not_connected' });
  const now = Date.now();
  const recent = (aiCalls.get(req.user.id) || []).filter(t => now - t < 10 * 60000);
  if (recent.length >= 40) return res.status(429).json({ error: 'Too many AI requests. Wait a few minutes.' });
  recent.push(now); aiCalls.set(req.user.id, recent);
  const mime = String(req.body.mime || '').slice(0, 100);
  const dataB64 = String(req.body.dataB64 || '');
  const text = String(req.body.text || '');
  const note = String(req.body.note || '');
  if (!mime) return res.status(400).json({ error: 'No file type provided.' });
  if (dataB64.length > 18_000_000) return res.status(413).json({ error: 'That file is too large. Keep uploads under ~12 MB (downscale an image or split a PDF).' });
  try {
    const out = await runAnalyze(conn, { mime, dataB64, text, note });
    if (!out) throw new Error('The AI returned an empty answer. Try again.');
    res.json({ text: out, model: conn.model, provider: conn.provider, generatedAt: Date.now() });
  } catch (e) {
    console.error('[ai:analyze]', conn.provider, e.status || '', e.message);
    res.status(e.status === 400 ? 400 : 502).json({ error: e.status === 400 ? e.message : friendlyAiError(e) });
  }
}));

// ---------------------------------------------------------------- watchlists & notifications

app.get('/api/watchlist', requireActive, wrap(async (req, res) => {
  res.json({ watchlist: cleanWatchlist(await store.getUserData(req.user.id, 'watchlist')), emailAvailable: emailConfigured(), maxTerms: MAX_TERMS, email: req.user.email });
}));
app.put('/api/watchlist', requireActive, wrap(async (req, res) => {
  const watchlist = cleanWatchlist(req.body);
  await store.setUserData(req.user.id, 'watchlist', watchlist);
  // Check the current feed straight away so new terms show matches immediately.
  const added = await runWatchlistFor(store, req.user, snapshot().items).catch(() => 0);
  res.json({ watchlist, added });
}));

app.get('/api/notifications', requireActive, wrap(async (req, res) => {
  const items = (await store.getUserData(req.user.id, 'notifications')) || [];
  res.json({ items, unread: items.filter(n => !n.read).length });
}));
app.post('/api/notifications/read', requireActive, wrap(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? new Set(req.body.ids.map(String)) : null;
  const items = ((await store.getUserData(req.user.id, 'notifications')) || []).map(n => (!ids || ids.has(n.id) ? { ...n, read: true } : n));
  await store.setUserData(req.user.id, 'notifications', items);
  res.json({ ok: true, unread: items.filter(n => !n.read).length });
}));
app.delete('/api/notifications', requireActive, wrap(async (req, res) => {
  await store.setUserData(req.user.id, 'notifications', []);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- trends

app.get('/api/trends', requireActive, wrap(async (req, res) => {
  const t = (await store.getSetting('trends')) || { days: {} };
  const days = Object.entries(t.days || {}).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date));
  res.json({ days, updatedAt: t.updatedAt || null });
}));

// ---------------------------------------------------------------- admin

app.get('/api/admin/users', requireAdmin, wrap(async (req, res) => {
  const prices = await groupPrices();
  const users = await Promise.all((await store.listUsers()).map(async u => ({ ...publicUser(u), entitlement: shapeEnt(u, await loadEntitlement(u), prices) })));
  res.json({ users });
}));

app.patch('/api/admin/users/:id', requireAdmin, wrap(async (req, res) => {
  const target = await store.findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const patch = {};
  const logs = [];
  if (req.body.status !== undefined) {
    if (!['pending', 'active', 'suspended'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own status.' });
    patch.status = req.body.status;
    logs.push({ action: 'status_change', from: target.status, to: req.body.status });
  }
  if (req.body.role !== undefined) {
    if (!['user', 'admin'].includes(req.body.role)) return res.status(400).json({ error: 'Invalid role.' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role.' });
    patch.role = req.body.role;
    logs.push({ action: 'role_change', from: target.role, to: req.body.role });
  }
  // Legacy tier (demo/trial/full) still accepted; new subscription plans come
  // via `plan`. Changing the plan resets the locked first selection so the user
  // picks fresh within the new allowance (a-la-carte add-ons are kept).
  const entEdits = [];
  let curEnt = null;
  const ensureEnt = async () => (curEnt ||= await loadEntitlement(target));
  if (req.body.tier !== undefined) {
    if (!['demo', 'trial', 'full'].includes(req.body.tier)) return res.status(400).json({ error: 'Invalid tier.' });
    if (target.role === 'admin') return res.status(400).json({ error: 'Administrators always have full access.' });
    patch.tier = req.body.tier;
    patch.trial_ends_at = req.body.tier === 'trial' ? Date.now() + TRIAL_MS : null;
    logs.push({ action: 'tier_change', from: storedPlan(target), to: req.body.tier, trialEndsAt: patch.trial_ends_at });
  }
  if (req.body.plan !== undefined) {
    if (!ent.PLAN_ORDER.includes(req.body.plan)) return res.status(400).json({ error: 'Invalid plan.' });
    if (target.role === 'admin') return res.status(400).json({ error: 'Administrators always have full access.' });
    patch.tier = req.body.plan;
    patch.trial_ends_at = null;
    const e = await ensureEnt();
    curEnt = { ...e, selected: [], locked: false };          // fresh selection on the new plan
    if (req.body.plan === 'enterprise' && req.body.entAllow) curEnt.entAllow = { A: req.body.entAllow.A | 0, B: req.body.entAllow.B | 0, C: req.body.entAllow.C | 0 };
    entEdits.push(`plan:${req.body.plan}`);
    logs.push({ action: 'tier_change', from: storedPlan(target), to: req.body.plan, trialEndsAt: null });
  }
  if (req.body.allAccess !== undefined) { const e = await ensureEnt(); curEnt = { ...(curEnt || e), allAccess: !!req.body.allAccess }; entEdits.push(`allAccess:${!!req.body.allAccess}`); }
  if (req.body.entAllow && req.body.plan === undefined) { const e = await ensureEnt(); curEnt = { ...(curEnt || e), entAllow: { A: req.body.entAllow.A | 0, B: req.body.entAllow.B | 0, C: req.body.entAllow.C | 0 } }; entEdits.push('entAllow'); }
  if (Array.isArray(req.body.grantFeatures)) { const e = await ensureEnt(); const add = req.body.grantFeatures.filter(id => ent.FEATURE_BY_ID[id]); curEnt = { ...(curEnt || e), addons: [...new Set([...(curEnt || e).addons, ...add])] }; if (add.length) entEdits.push(`grant:${add.join(',')}`); }
  if (Array.isArray(req.body.revokeFeatures)) { const e = await ensureEnt(); const rm = new Set(req.body.revokeFeatures); const base = curEnt || e; curEnt = { ...base, addons: base.addons.filter(id => !rm.has(id)), selected: base.selected.filter(id => !rm.has(id)) }; entEdits.push(`revoke:${req.body.revokeFeatures.join(',')}`); }
  if (typeof req.body.name === 'string') patch.name = req.body.name.trim().slice(0, 80);
  if (typeof req.body.org === 'string') patch.org = req.body.org.trim().slice(0, 120);
  if (Object.keys(patch).length) await store.updateUser(target.id, patch);
  if (patch.status === 'suspended' || patch.role !== undefined) {
    await store.setUserData(target.id, 'sessions_revoked_before', Date.now());
  }
  if (curEnt) await store.setUserData(target.id, 'entitlement', ent.normEntitlement(curEnt));
  for (const l of logs) await auditLicense({ ...l, targetId: target.id, email: target.email, by: req.user.email });
  for (const d of entEdits) await auditEntitlement({ action: 'admin_edit', userId: target.id, email: target.email, by: req.user.email, detail: d });
  const fresh = { ...target, ...patch };
  res.json({ user: { ...publicUser(fresh), entitlement: shapeEnt(fresh, curEnt ? ent.normEntitlement(curEnt) : await loadEntitlement(target), await groupPrices()) } });
}));

// Feature / plan requests queue + decisions.
app.get('/api/admin/feature-requests', requireAdmin, wrap(async (req, res) => {
  res.json({ requests: (await store.getSetting('feature_requests')) || [] });
}));
app.post('/api/admin/feature-requests/:id', requireAdmin, wrap(async (req, res) => {
  const decision = req.body.decision === 'approved' ? 'approved' : req.body.decision === 'denied' ? 'denied' : null;
  if (!decision) return res.status(400).json({ error: 'Invalid decision.' });
  const list = (await store.getSetting('feature_requests')) || [];
  const r = list.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found.' });
  if (r.status !== 'pending') return res.status(400).json({ error: 'Already decided.' });
  r.status = decision; r.decidedBy = req.user.email; r.decidedAt = Date.now();
  if (decision === 'approved') {
    const target = await store.findUserById(r.userId);
    if (target) {
      const e = await loadEntitlement(target);
      if (r.kind === 'plan' && r.plan) {
        await store.updateUser(target.id, { tier: r.plan, trial_ends_at: null });
        await store.setUserData(target.id, 'entitlement', ent.normEntitlement({ ...e, selected: [], locked: false }));
      } else if (r.featureId) {
        await store.setUserData(target.id, 'entitlement', ent.normEntitlement({ ...e, addons: [...new Set([...e.addons, r.featureId])] }));
      }
      await auditEntitlement({ action: 'request_approved', userId: target.id, email: target.email, by: req.user.email, detail: r.plan ? `plan:${r.plan}` : `feature:${r.featureId}` });
    }
  } else {
    await auditEntitlement({ action: 'request_denied', userId: r.userId, email: r.email, by: req.user.email, detail: r.plan ? `plan:${r.plan}` : `feature:${r.featureId}` });
  }
  await store.setSetting('feature_requests', list.slice(0, 5000));
  res.json({ request: r });
}));
app.get('/api/admin/entitlement-audit', requireAdmin, wrap(async (req, res) => {
  res.json({ entries: (await store.getSetting('entitlement_audit')) || [] });
}));
app.get('/api/admin/pricing', requireAdmin, wrap(async (req, res) => res.json({ pricing: await groupPrices() })));
app.put('/api/admin/pricing', requireAdmin, wrap(async (req, res) => {
  const p = req.body || {};
  const next = { A: Math.max(0, +p.A || 0) || ent.GROUP_PRICE.A, B: Math.max(0, +p.B || 0) || ent.GROUP_PRICE.B, C: Math.max(0, +p.C || 0) || ent.GROUP_PRICE.C };
  await store.setSetting('pricing', next);
  await auditEntitlement({ action: 'pricing', userId: '-', email: '-', by: req.user.email, detail: JSON.stringify(next) });
  res.json({ pricing: next });
}));

app.get('/api/admin/license-audit', requireAdmin, wrap(async (req, res) => {
  res.json({ entries: (await store.getSetting('license_audit')) || [] });
}));

app.post('/api/admin/users/:id/password', requireAdmin, wrap(async (req, res) => {
  const target = await store.findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const password = String(req.body.password || '');
  if (password.length < 8) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
  await store.updateUser(target.id, { password_hash: await bcrypt.hash(password, 10) });
  await store.setUserData(target.id, 'sessions_revoked_before', Date.now());
  res.json({ ok: true });
}));

app.delete('/api/admin/users/:id', requireAdmin, wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
  await store.deleteUser(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/admin/contact', requireAdmin, wrap(async (req, res) => res.json({ contact: await providerContact() })));
app.put('/api/admin/contact', requireAdmin, wrap(async (req, res) => {
  const contact = String(req.body.contact || '').trim().slice(0, 300);
  await store.setSetting('provider_contact', contact);
  res.json({ contact });
}));

app.get('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
  res.json({ aiEnabled: await aiEnabled(), emailConfigured: emailConfigured() });
}));
app.put('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
  if (typeof req.body.aiEnabled === 'boolean') await store.setSetting('ai_enabled', req.body.aiEnabled);
  res.json({ aiEnabled: await aiEnabled(), emailConfigured: emailConfigured() });
}));

const SOURCE_TYPES = ['rss', 'search', 'telegram', 'bluesky', 'mastodon'];
function cleanFeeds(list) {
  return (Array.isArray(list) ? list : []).slice(0, 60).map(f => {
    const type = SOURCE_TYPES.includes(f.type) ? f.type : 'rss';
    return {
      id: String(f.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 16) || newId().slice(0, 8),
      name: String(f.name || '').trim().slice(0, 60),
      type,
      url: type === 'rss' ? String(f.url || '').trim().slice(0, 500) : '',
      handle: type === 'rss' || type === 'search' ? '' : String(f.handle || '').trim().replace(/^@/, '').slice(0, 120),
      query: type === 'search' ? String(f.query || '').trim().slice(0, 300) : '',
      category: ['STRATEGIC','LOGISTICS_SUPPLY_CHAIN','MARKETS','GEOPOLITICS','SECURITY','CYBER','POLITICS','GOVERNANCE','CRISIS','OTHER'].includes(f.category) ? f.category : 'OTHER',
      wire: WIRE_KEYS.includes(f.wire) ? f.wire : 'auto',
      kind: type === 'rss' || type === 'search' ? (['news', 'official', 'analysis'].includes(f.kind) ? f.kind : 'news') : 'social',
      fallbackWire: type === 'search' ? (f.fallbackWire || 'REGIONAL') : undefined,
    };
  }).filter(f => f.name && (f.type === 'rss' ? /^https?:\/\//i.test(f.url) : f.type === 'search' ? f.query.length >= 3 : /^[\w.@-]{2,}$/.test(f.handle) && (f.type !== 'mastodon' || f.handle.includes('@'))));
}

// Full source catalogue for the admin Sources panel: built-ins with on/off state and health.
app.get('/api/admin/catalogue', requireAdmin, wrap(async (req, res) => {
  const off = new Set((await store.getSetting('disabled_sources')) || []);
  const health = snapshot().sources;
  const gnews = Object.keys(WIRES).map(k => ({ id: `gnews-${k}`, name: `${WIRES[k].label} search`, group: 'Core threat wires', type: 'gnews', kind: 'news' }));
  const hazards = [
    { id: 'usgs', name: 'USGS earthquakes', group: 'Hazards', type: 'geojson', kind: 'official' },
    { id: 'gdacs', name: 'GDACS disaster alerts', group: 'Hazards', type: 'rss', kind: 'official' },
  ];
  const provs = FEED_PROVIDERS.map(p => ({ id: p.id, name: p.name, group: p.group, type: 'api', kind: p.kind }));
  const categoryByGroup = { 'Defence & military':'STRATEGIC', 'Maritime':'LOGISTICS_SUPPLY_CHAIN', 'Business & power':'MARKETS', 'Government & policy':'GOVERNANCE', 'Elections & politics':'POLITICS', 'Cyber':'CYBER', 'Crisis & advisories':'SECURITY', 'Chatter & deep web':'GEOPOLITICS', 'OSINT social accounts':'GEOPOLITICS', 'OSINT & analysis':'GEOPOLITICS', 'International news':'GEOPOLITICS', 'South Asia':'GEOPOLITICS', 'Indian news':'GOVERNANCE', 'India states & borders':'SECURITY', 'Europe':'GEOPOLITICS', 'Americas':'GEOPOLITICS', 'China & East Asia':'GEOPOLITICS', 'Middle East':'GEOPOLITICS', 'Core threat wires':'SECURITY', 'Hazards':'CRISIS' };
  const wireCategory = { BUSINESS:'MARKETS', GOV:'GOVERNANCE', POLITICS:'POLITICS', CYBER:'CYBER', FATF:'MARKETS', GLOBAL_AXIS:'GEOPOLITICS', REGIONAL:'GEOPOLITICS', SATP:'SECURITY', INDIA:'SECURITY', KINETIC:'STRATEGIC' };
  const list = [...gnews, ...BUILTIN_SOURCES, ...provs, ...hazards].map(src => ({
    id: src.id, name: src.name, group: src.group, type: src.type, kind: src.kind, category: src.category || wireCategory[src.id.replace('gnews-','')] || categoryByGroup[src.group] || 'OTHER', home: src.type === 'gnews' ? 'https://news.google.com' : src.type === 'api' ? '' : sourceHome(src),
    handle: src.handle || null, enabled: !off.has(src.id), health: health[src.id] || null,
  }));
  res.json({ groups: [...SOURCE_GROUPS, 'Hazards'], sources: list, customHealth: Object.fromEntries(Object.entries(health).filter(([k]) => k.startsWith('custom-'))) });
}));
app.get('/api/admin/source-intelligence', requireAdmin, wrap(async (req, res) => {
  const off = new Set((await store.getSetting('disabled_sources')) || []);
  const health = snapshot().sources || {};
  const custom = cleanFeeds(await store.getSetting('custom_feeds'));
  const activeCandidates = (await store.getSetting('source_candidates') || []).filter(x => x.status === 'active');
  const descriptors = [
    ...Object.keys(WIRES).map(k => ({ id: `gnews-${k}`, name: `${WIRES[k].label} search`, group: 'Core threat wires', kind: 'news' })),
    ...BUILTIN_SOURCES,
    ...FEED_PROVIDERS,
    { id: 'usgs', name: 'USGS earthquakes', group: 'Hazards', kind: 'official' },
    { id: 'gdacs', name: 'GDACS disaster alerts', group: 'Hazards', kind: 'official' },
    ...custom.map(f => {
      const candidate = activeCandidates.find(x => x.collectionFeedId === f.id);
      return {
        ...f, id: `custom-${f.id}`,
        group: candidate?.layer === 'official' ? 'Government & policy' : 'Custom sources',
        ...(candidate ? { region: candidate.region, country: candidate.country, coverage: candidate.subdivision ? 'subdivision' : 'country', accessModel: candidate.accessModel, licence: candidate.licence } : {}),
      };
    }),
  ];
  const fallbackDescriptors = Object.keys(health).filter(id => id.startsWith('fallback:')).map(id => {
    const original = BUILTIN_SOURCES.find(source => source.id === id.slice('fallback:'.length));
    return original ? { id, name: `${original.name} — public search fallback`, group: original.group, kind: original.kind || 'news', enabled: !off.has(original.id) } : null;
  }).filter(Boolean);
  descriptors.push(...fallbackDescriptors);
  const regionFor = group => ({
    'Indian news':'India', 'India states & borders':'India', 'South Asia':'South Asia',
    'Europe':'Europe', 'Americas':'Americas', 'China & East Asia':'China & East Asia',
    'Middle East':'Middle East', 'Core threat wires':'Global / specialist',
    'Defence & military':'Global / specialist', 'Maritime':'Global / specialist',
    'OSINT & analysis':'Global / specialist', 'Cyber':'Global / specialist',
    'Business & power':'Global / specialist', 'Government & policy':'Global / specialist',
    'Elections & politics':'Global / specialist', 'Crisis & advisories':'Global / specialist',
    'Chatter & deep web':'Global / specialist', 'OSINT social accounts':'Global / specialist',
    'Hazards':'Global / specialist', 'Custom sources':'Custom',
  }[group] || 'Unclassified');
  const now = Date.now();
  const rows = descriptors.map(src => {
    const h = health[src.id] || null;
    const lastSuccessAt = h?.lastSuccessAt || null;
    const ageMs = lastSuccessAt ? Math.max(0, now - lastSuccessAt) : null;
    const failures = h?.consecutiveFailures || 0;
    let status = 'unmeasured';
    if (h) {
      if (lastSuccessAt && ageMs <= 20 * 60 * 1000 && failures === 0) status = 'healthy';
      else if (lastSuccessAt && ageMs <= 2 * 60 * 60 * 1000) status = 'degraded';
      else if (h.state === 'error' && !lastSuccessAt) status = 'failed';
      else status = 'stale';
    }
    let score = null;
    if (h) {
      const freshness = ageMs === null ? 0 : ageMs <= 10*60*1000 ? 40 : ageMs <= 30*60*1000 ? 30 : ageMs <= 2*60*60*1000 ? 15 : 0;
      const successful = h.ok ? 25 : lastSuccessAt ? 10 : 0;
      const useful = h.count > 0 ? 20 : h.state === 'empty' ? 5 : 0;
      const stability = failures === 0 ? 15 : failures === 1 ? 8 : 0;
      score = freshness + successful + useful + stability;
    }
    return {
      id: src.id, name: src.name, group: src.group || 'Unclassified',
      region: regionFor(src.group), kind: src.kind || 'news',
      enabled: src.enabled === undefined ? !off.has(src.id) : src.enabled, status, score, count: h?.count || 0,
      lastCheckedAt: h?.checkedAt || h?.at || null, lastSuccessAt,
      ageMinutes: ageMs === null ? null : Math.round(ageMs / 60000),
      consecutiveFailures: failures, failureClass: h?.failureClass || null,
      retryAfter: h?.retryAfter || null, error: h?.error || null,
    };
  });
  const regions = [...new Set(rows.map(r => r.region))].map(region => {
    const items = rows.filter(r => r.region === region && r.enabled);
    const measured = items.filter(r => r.score !== null);
    return {
      region, configured: items.length, measured: measured.length,
      healthy: items.filter(r => r.status === 'healthy').length,
      degraded: items.filter(r => r.status === 'degraded').length,
      stale: items.filter(r => r.status === 'stale').length,
      failed: items.filter(r => r.status === 'failed').length,
      unmeasured: items.filter(r => r.status === 'unmeasured').length,
      averageScore: measured.length ? Math.round(measured.reduce((n,r) => n+r.score,0)/measured.length) : null,
      items: items.length ? Math.round(items.reduce((n,r) => n+r.count,0)) : 0,
    };
  }).sort((a,b) => a.region.localeCompare(b.region));
  const enabled = rows.filter(r => r.enabled);
  res.json({
    generatedAt: now,
    summary: {
      configured: enabled.length,
      measured: enabled.filter(r => r.score !== null).length,
      healthy: enabled.filter(r => r.status === 'healthy').length,
      degraded: enabled.filter(r => r.status === 'degraded').length,
      stale: enabled.filter(r => r.status === 'stale').length,
      failed: enabled.filter(r => r.status === 'failed').length,
      unmeasured: enabled.filter(r => r.status === 'unmeasured').length,
      averageScore: enabled.some(r => r.score !== null) ? Math.round(enabled.filter(r => r.score !== null).reduce((n,r) => n+r.score,0)/enabled.filter(r => r.score !== null).length) : null,
    },
    regions,
    sources: rows.sort((a,b) => (a.score ?? -1) - (b.score ?? -1) || a.name.localeCompare(b.name)),
    scoring: 'Transparent heuristic: freshness (40), successful fetch (25), non-empty content (20), failure stability (15). Unmeasured sources are not scored.',
  });
}));

// Governed source-candidate intake. Candidates are not collected until explicitly activated.
async function probeSourceCandidate(candidate) {
  const checkedAt = Date.now();
  try {
    const { res: response, url } = await safeFetch(candidate.endpoint, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, application/json, application/geo+json, text/html, */*' } });
    const contentType = response.headers.get('content-type') || 'unknown';
    const body = await readBody(response, 1024 * 1024, { truncate: false });
    return assessCandidateResponse(candidate, { status: response.status, contentType, body, finalUrl: url, checkedAt });
  } catch (error) {
    return { passed: false, checkedAt, validationType: 'transport', message: String(error.message || 'Endpoint validation failed.').slice(0, 500) };
  }
}

app.get('/api/admin/source-candidates', requireAdmin, wrap(async (req, res) => {
  const candidates = (await store.getSetting('source_candidates')) || [];
  res.json({ candidates, states: ['discovered','pending_validation','validated','active','rejected','suspended'] });
}));

app.post('/api/admin/source-candidates', requireAdmin, wrap(async (req, res) => {
  const candidates = (await store.getSetting('source_candidates')) || [];
  const candidate = normaliseSourceCandidate(req.body || {}, newId().slice(0, 24));
  const errors = validateCandidateMetadata(candidate);
  if (errors.length) return res.status(400).json({ error: 'Candidate metadata is incomplete.', errors });
  const duplicate = candidateDuplicate(candidates, candidate);
  if (duplicate) return res.status(409).json({ error: 'An endpoint with the same canonical URL is already registered.', duplicateId: duplicate.id });
  candidates.unshift(candidate);
  await store.setSetting('source_candidates', candidates.slice(0, 5000));
  res.status(201).json({ candidate });
}));

app.post('/api/admin/source-candidates/batch', requireAdmin, wrap(async (req, res) => {
  const incoming = req.body?.candidates;
  if (!Array.isArray(incoming) || incoming.length === 0) return res.status(400).json({ error: 'Provide a non-empty candidates array.' });
  if (incoming.length > 500) return res.status(413).json({ error: 'A batch may contain at most 500 candidates.' });
  const existing = (await store.getSetting('source_candidates')) || [];
  if (existing.length >= 12000) return res.status(409).json({ error: 'Candidate registry capacity reached (12,000). Export or curate existing records before adding more.' });
  const room = 12000 - existing.length;
  const result = prepareCandidateBatch(existing, incoming.slice(0, room), () => newId().slice(0, 24));
  const candidates = [...result.accepted, ...existing];
  await store.setSetting('source_candidates', candidates);
  res.status(200).json({
    imported: result.accepted.length,
    duplicates: result.duplicates.length,
    rejected: result.rejected.length + Math.max(0, incoming.length - room),
    results: { duplicates: result.duplicates, rejected: result.rejected },
    remainingCapacity: Math.max(0, 12000 - candidates.length),
    note: 'Imported records remain pending_validation and are excluded from collection until endpoint validation and explicit activation.',
  });
}));

app.get('/api/admin/source-candidates/batches', requireAdmin, wrap(async (_req, res) => {
  res.json({ batches: listSourceCandidateBatches() });
}));

app.post('/api/admin/source-candidates/batches/:batchId/import', requireAdmin, wrap(async (req, res) => {
  let batch;
  try { batch = loadSourceCandidateBatch(req.params.batchId); }
  catch (error) { return res.status(/ENOENT/.test(error.code || error.message) ? 404 : 400).json({ error: error.message || 'Unable to load source batch.' }); }
  const existing = (await store.getSetting('source_candidates')) || [];
  if (existing.length >= 12000) return res.status(409).json({ error: 'Candidate registry capacity reached (12,000).' });
  const room = 12000 - existing.length;
  const inputs = batch.candidates.slice(0, room);
  const result = prepareCandidateBatch(existing, inputs, () => newId().slice(0, 24));
  const candidates = [...result.accepted, ...existing];
  await store.setSetting('source_candidates', candidates);
  res.json({
    batch: String(batch.batch || req.params.batchId),
    imported: result.accepted.length,
    duplicates: result.duplicates.length,
    rejected: result.rejected.length + Math.max(0, batch.candidates.length - room),
    results: { duplicates: result.duplicates, rejected: result.rejected },
    remainingCapacity: Math.max(0, 12000 - candidates.length),
    note: 'Curated records are imported as pending_validation. They are not activated or counted healthy. Endpoint format validation and licence review remain required.',
  });
}));

app.post('/api/admin/source-candidates/:id/validate', requireAdmin, wrap(async (req, res) => {
  const candidates = (await store.getSetting('source_candidates')) || [];
  const index = candidates.findIndex(x => x.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Source candidate not found.' });
  const candidate = candidates[index];
  if (!['discovered','pending_validation','suspended','validated'].includes(candidate.status)) {
    return res.status(409).json({ error: `A ${candidate.status} candidate cannot be validated.` });
  }
  const errors = validateCandidateMetadata(candidate);
  if (errors.length) return res.status(400).json({ error: 'Candidate metadata is incomplete.', errors });
  const validation = await probeSourceCandidate(candidate);
  let updated = { ...candidate, validation, updatedAt: Date.now() };
  if (validation.passed && updated.status !== 'validated') {
    try {
      if (['discovered','suspended'].includes(updated.status)) updated = transitionCandidate(updated, 'pending_validation');
      updated = transitionCandidate(updated, 'validated');
    } catch { /* preserve the current state if lifecycle rules reject it */ }
  }
  candidates[index] = updated;
  await store.setSetting('source_candidates', candidates);
  res.status(validation.passed ? 200 : 422).json({ candidate: updated, validation });
}));

app.post('/api/admin/source-candidates/validate-batch', requireAdmin, wrap(async (req, res) => {
  const candidates = (await store.getSetting('source_candidates')) || [];
  const limit = Math.max(1, Math.min(25, Math.floor(Number(req.body?.limit) || 25)));
  const selected = candidates.filter(x => x.status === 'pending_validation').slice(0, limit);
  const results = [];
  // Keep network fan-out bounded. Each request also uses DNS-pinned SSRF-safe fetch.
  for (let offset = 0; offset < selected.length; offset += 5) {
    const group = selected.slice(offset, offset + 5);
    const checked = await Promise.all(group.map(async candidate => {
      const validation = await probeSourceCandidate(candidate);
      let updated = { ...candidate, validation, updatedAt: Date.now() };
      if (validation.passed) {
        try { updated = transitionCandidate(updated, 'validated'); } catch { /* keep pending if metadata/lifecycle checks fail */ }
      }
      const index = candidates.findIndex(x => x.id === candidate.id);
      if (index >= 0) candidates[index] = updated;
      return { id: candidate.id, name: candidate.name, passed: validation.passed, message: validation.message };
    }));
    results.push(...checked);
  }
  await store.setSetting('source_candidates', candidates);
  res.json({ checked: results.length, passed: results.filter(x => x.passed).length, failed: results.filter(x => !x.passed).length, results, remainingPending: candidates.filter(x => x.status === 'pending_validation').length });
}));

app.put('/api/admin/source-candidates/:id/status', requireAdmin, wrap(async (req, res) => {
  const candidates = (await store.getSetting('source_candidates')) || [];
  const index = candidates.findIndex(x => x.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Source candidate not found.' });
  const current = candidates[index];
  const next = String(req.body?.status || '');
  const details = next === 'rejected' ? { rejectionReason: String(req.body?.reason || '').slice(0, 500) } : {};
  let nextFeeds = null;
  if (next === 'active') {
    const eligibility = sourceActivationEligibility(current);
    if (eligibility.length) return res.status(409).json({ error: 'This candidate is not eligible for live collection.', errors: eligibility });
    const feeds = cleanFeeds(await store.getSetting('custom_feeds'));
    if (feeds.length >= 60) return res.status(409).json({ error: 'The custom feed capacity is full. Remove an unused feed before activation.' });
    if (feeds.some(feed => feed.url === current.endpoint)) return res.status(409).json({ error: 'This endpoint is already active as a custom feed.' });
    const feedId = 'sc' + current.id.replace(/[^a-z0-9]/gi, '').slice(0, 14);
    const feed = {
      id: feedId, name: current.name.slice(0, 60), type: 'rss', url: current.endpoint,
      category: current.layer === 'official' ? 'GOVERNANCE' : 'OTHER',
      wire: 'auto', kind: current.layer === 'official' ? 'official' : 'news',
    };
    nextFeeds = cleanFeeds([...feeds, feed]);
    if (!nextFeeds.some(x => x.id === feedId)) return res.status(400).json({ error: 'Candidate could not be converted to a supported live feed.' });
    details.collectionFeedId = feedId;
  } else if (current.status === 'active' && current.collectionFeedId) {
    const feeds = cleanFeeds(await store.getSetting('custom_feeds'));
    nextFeeds = feeds.filter(feed => feed.id !== current.collectionFeedId);
    details.collectionFeedId = null;
  }
  let updated;
  try { updated = transitionCandidate(current, next, details); }
  catch (error) { return res.status(409).json({ error: error.message }); }
  if (nextFeeds) {
    await store.setSetting('custom_feeds', nextFeeds);
    setCustomFeeds(nextFeeds);
  }
  candidates[index] = updated;
  await store.setSetting('source_candidates', candidates);
  res.json({ candidate: updated });
}));

// Full source network view: six intelligence layers, geographic coverage,
// per-source measured health, cadence and access/licensing review metadata.
app.get('/api/admin/source-network', requireAdmin, wrap(async (req, res) => {
  const off = new Set((await store.getSetting('disabled_sources')) || []);
  const health = snapshot().sources || {};
  const custom = cleanFeeds(await store.getSetting('custom_feeds'));
  const descriptors = [
    ...Object.keys(WIRES).map(k => ({ id: `gnews-${k}`, name: `${WIRES[k].label} search`, group: 'Core threat wires', type: 'gnews', kind: 'news' })),
    ...BUILTIN_SOURCES,
    ...FEED_PROVIDERS,
    { id: 'usgs', name: 'USGS earthquakes', group: 'Hazards', type: 'geojson', kind: 'official' },
    { id: 'gdacs', name: 'GDACS disaster alerts', group: 'Hazards', type: 'rss', kind: 'official' },
    ...custom.map(f => ({ ...f, id: `custom-${f.id}`, group: 'Custom sources' })),
  ];
  const fallbacks = Object.keys(health).filter(id => id.startsWith('fallback:')).map(id => {
    const original = BUILTIN_SOURCES.find(source => source.id === id.slice('fallback:'.length));
    return original ? { id, name: `${original.name} — public search fallback`, group: original.group, type: 'search', kind: original.kind || 'news' } : null;
  }).filter(Boolean);
  res.json(buildSourceNetwork([...descriptors, ...fallbacks], health, [...off]));
}));

app.put('/api/admin/catalogue', requireAdmin, wrap(async (req, res) => {
  const known = new Set([...Object.keys(WIRES).map(k => `gnews-${k}`), ...BUILTIN_SOURCES.map(x => x.id), ...FEED_PROVIDERS.map(p => p.id), 'usgs', 'gdacs']);
  const off = (Array.isArray(req.body.disabled) ? req.body.disabled : []).map(String).filter(id => known.has(id));
  await store.setSetting('disabled_sources', off);
  setDisabledSources(off);
  res.json({ disabled: off });
}));

app.get('/api/admin/feeds', requireAdmin, wrap(async (req, res) => {
  res.json({ feeds: cleanFeeds(await store.getSetting('custom_feeds')), wires: WIRE_KEYS });
}));
app.put('/api/admin/feeds', requireAdmin, wrap(async (req, res) => {
  const feeds = cleanFeeds(req.body.feeds);
  await store.setSetting('custom_feeds', feeds);
  setCustomFeeds(feeds);
  res.json({ feeds });
}));
app.post('/api/admin/feeds/test', requireAdmin, wrap(async (req, res) => {
  const [src] = cleanFeeds([{ ...req.body, name: req.body.name || 'test' }]);
  if (!src) return res.status(400).json({ error: req.body.type && req.body.type !== 'rss' ? 'Enter the account handle (Mastodon handles look like user@instance.social).' : 'Enter a feed address starting with http:// or https://' });
  try { res.json(await testFeed(src)); }
  catch (e) {
    const what = { search: 'search. Try simpler search words', rss: 'feed. Check the address points to an RSS or Atom feed', telegram: 'channel. Check it is a public channel name', bluesky: 'account. Check the handle', mastodon: 'account. Check the handle' }[src.type];
    res.status(400).json({ error: `Could not read that ${what} (${e.message}).` });
  }
}));

app.get('/api/admin/subject', requireAdmin, wrap(async (req, res) => {
  const cfg = await subjectConfig();
  const agreement = await subjectAgreement();
  const users = await store.listUsers();
  const access = await Promise.all(users.map(u => subjectAccess(u.id)));
  res.json({
    ...cfg,
    agreementText: agreement.text, agreementVersion: agreement.version, agreementUpdatedAt: agreement.updatedAt, agreementUpdatedBy: agreement.updatedBy,
    users: users.map((u, i) => ({ id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, allowed: u.role === 'admin' || !!access[i].allowed, isAdmin: u.role === 'admin' })),
  });
}));
app.put('/api/admin/subject', requireAdmin, wrap(async (req, res) => {
  const cur = await subjectConfig();
  const next = { ...cur };
  if (typeof req.body.enabled === 'boolean') next.enabled = req.body.enabled;
  if (Number.isFinite(req.body.dailyLimit)) next.dailyLimit = Math.max(1, Math.min(500, Math.floor(req.body.dailyLimit)));
  await store.setSetting('subject_config', next);
  const changes = [`enabled=${next.enabled}`, `dailyLimit=${next.dailyLimit}`];
  if (typeof req.body.agreementText === 'string') {
    const text = req.body.agreementText.trim().slice(0, 20000);
    if (text.length < 40) return res.status(400).json({ error: 'The agreement text is too short. Enter the full agreement (at least 40 characters).' });
    await store.setSetting('subject_agreement', { text, updatedAt: Date.now(), updatedBy: req.user.email });
    changes.push('agreement updated');
  }
  const agreement = await subjectAgreement();
  await auditSubject({ id: newId().slice(0, 12), at: Date.now(), userId: req.user.id, email: req.user.email, kind: 'config', query: changes.join(', '), purpose: 'admin changed subject-lookup settings', caseRef: '' });
  res.json({ ...next, agreementText: agreement.text, agreementVersion: agreement.version, agreementUpdatedAt: agreement.updatedAt, agreementUpdatedBy: agreement.updatedBy });
}));
app.put('/api/admin/subject/user/:id', requireAdmin, wrap(async (req, res) => {
  const target = await store.findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const allowed = req.body.allowed === true;
  await store.setUserData(target.id, 'subject_access', { allowed, grantedBy: req.user.email, at: Date.now() });
  await auditSubject({ id: newId().slice(0, 12), at: Date.now(), userId: req.user.id, email: req.user.email, kind: 'grant', query: target.email, purpose: `${allowed ? 'granted' : 'revoked'} subject-lookup access`, caseRef: '' });
  res.json({ id: target.id, allowed });
}));
app.get('/api/admin/subject/audit', requireAdmin, wrap(async (req, res) => {
  const log = (await store.getSetting('subject_audit')) || [];
  res.json({ entries: log.slice(0, 500) });
}));

// Full backup: download the entire dataset as JSON. Sensitive (contains
// password hashes and encrypted AI keys) — admin only, over the session.
app.get('/api/admin/backup', requireAdmin, wrap(async (req, res) => {
  const data = await store.dump();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Disposition', `attachment; filename="calibrex-backup-${stamp}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
}));

// Restore replaces the whole dataset. Guarded: the acting admin must remain
// present in the backup, or they would lock themselves out.
app.post('/api/admin/restore', requireAdmin, wrap(async (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data.users) || typeof data.settings !== 'object' || data.settings === null || typeof data.userData !== 'object' || data.userData === null) {
    return res.status(400).json({ error: 'That file is not a valid Calibrex backup.' });
  }
  if (data.users.length > 100000) return res.status(400).json({ error: 'Backup is too large.' });
  const me = data.users.find(u => u.id === req.user.id && u.role === 'admin');
  if (!me) return res.status(400).json({ error: 'This backup does not contain your admin account, so restoring it would lock you out. Restore a backup made from this workspace.' });
  await store.load({ users: data.users, settings: data.settings, userData: data.userData });
  res.json({ ok: true, users: data.users.length, settings: Object.keys(data.settings).length });
}));

app.get('/api/admin/sources', requireAdmin, (req, res) => {
  const s = snapshot();
  res.json({ updatedAt: s.updatedAt, sources: s.sources });
});

app.get('/api/markets', requireActive, (req, res) => res.json({ ...marketsSnapshot(), crisis: crisisSnapshot() }));
app.get('/api/markets/series/:id', requireActive, (req, res) => res.json({ id: req.params.id, series: marketsSeries(String(req.params.id).slice(0, 40)) }));
app.get('/api/signals', requireActive, (req, res) => res.json(signalsSnapshot()));

// GEOINT / Earth Watch — open natural-event geospatial feed (NASA EONET).
app.get('/api/geoint', requireActive, (req, res) => res.json(geointSnapshot()));

// Reverse geocoding is a contextual lookup, not verification of an event location.
// Nominatim requests are globally serialised/cached by the server and attributed.
const reverseGeoCalls = new Map();
app.get('/api/geoint/reverse-geocode', requireActive, wrap(async (req, res) => {
  const now = Date.now();
  const recent = (reverseGeoCalls.get(req.user.id) || []).filter(t => now - t < 10 * 60 * 1000);
  if (recent.length >= 30) return res.status(429).json({ error: 'Reverse-geocoding rate limit reached. Try again later.' });
  recent.push(now);
  reverseGeoCalls.set(req.user.id, recent);
  const result = await reverseGeocoder.lookup(req.query.lat, req.query.lon);
  res.set('Cache-Control', 'private, max-age=3600');
  res.json(result);
}));

// Conflict Watch — geolocated conflict/unrest density (GDELT GEO).
app.get('/api/conflict', requireActive, (req, res) => res.json(conflictSnapshot()));

// Maritime — live AIS vessel picture (AISStream), with sanctions + dark flags.
app.get('/api/maritime', requireActive, (req, res) => res.json(maritimeSnapshot()));

// Sanctions screening — match a name/entity against public OFAC lists.
app.get('/api/sanctions', requireActive, (req, res) => res.json(sanctionsSnapshot()));
app.get('/api/sanctions/screen', requireActive, (req, res) => res.json(screenSanctions(String(req.query.q || '').slice(0, 200))));

// Entity pivot / link-analysis transforms (public keyless sources).
app.get('/api/pivot', requireActive, wrap(async (req, res) => res.json(await runPivot(String(req.query.value || '').slice(0, 200), String(req.query.type || 'auto')))));

// Continuous entity-watch: re-check my watched entities now.
app.post('/api/entitywatch/run', requireActive, wrap(async (req, res) => res.json({ changed: await runEntityWatchForUser(store, req.user) })));

// Gated sensitive tools — OFF by default; admin opens the gate; every query audited.
app.get('/api/sensitive/gate', requireActive, wrap(async (req, res) => res.json(await getGate(store))));
app.put('/api/admin/sensitive/gate', requireAdmin, wrap(async (req, res) => res.json(await setGate(store, { enabled: !!req.body.enabled, acknowledgment: req.body.acknowledgment }, req.user))));
app.get('/api/admin/sensitive/audit', requireAdmin, wrap(async (req, res) => res.json({ entries: await getSensitiveAudit(store) })));
// Gated SOCMINT — cross-platform username presence + public Reddit search.
app.get('/api/socmint/username', requireActive, wrap(async (req, res) => {
  await ensureGate(store);
  const u = String(req.query.u || '').slice(0, 40).trim();
  if (!u) return res.status(400).json({ error: 'Enter a username.' });
  await auditSensitive(store, { user: req.user, tool: 'socmint:username', query: u });
  res.json(await checkUsername(u));
}));
app.get('/api/socmint/reddit', requireActive, wrap(async (req, res) => {
  await ensureGate(store);
  const q = String(req.query.q || '').slice(0, 120).trim();
  if (!q) return res.status(400).json({ error: 'Enter a search term.' });
  await auditSensitive(store, { user: req.user, tool: 'socmint:reddit', query: q });
  res.json(await redditSearch(q));
}));
// Consolidated risk picture across every monitor (Command dashboard).
app.get('/api/risk', requireActive, wrap(async (req, res) => res.json(await computeRisk(store))));
app.get('/api/instability', requireActive, (req, res) => res.json(instabilitySnapshot()));
app.get('/api/correlations', requireActive, (req, res) => res.json(correlationSnapshot()));
app.get('/api/worldmap', requireActive, (req, res) => res.json(worldmapSnapshot()));
app.get('/api/satellites', requireActive, wrap(async (req, res) => res.json({ updatedAt: satellitesUpdatedAt(), satellites: await satellites() })));
app.get('/api/infrastructure', requireActive, (req, res) => res.json({ items: infrastructure() }));
app.get('/api/ais', requireActive, (req, res) => res.json(aisSnapshot()));
app.get('/api/macro', requireActive, (req, res) => res.json(macroSnapshot()));
app.get('/api/daily-brief', requireActive, wrap(async (req, res) => res.json(await dailyBriefSnapshot(store))));
app.post('/api/admin/daily-brief/run', requireAdmin, wrap(async (req, res) => res.json(await generateDailyBrief(store, { push: req.body.push !== false }))));

app.get('/api/aircraft-watches', requireActive, wrap(async (req, res) => {
  res.json({ watches: cleanAircraftWatches(await store.getUserData(req.user.id, 'aircraft_watches')) });
}));
app.put('/api/aircraft-watches', requireActive, wrap(async (req, res) => {
  const watches = cleanAircraftWatches(req.body);
  await store.setUserData(req.user.id, 'aircraft_watches', watches);
  res.json({ watches });
}));

// Web Push (PWA notifications).
app.get('/api/push/key', requireActive, (req, res) => res.json({ key: pushPublicKey() }));
app.post('/api/push/subscribe', requireActive, wrap(async (req, res) => {
  const count = await pushSubscribe(store, req.user.id, req.body);
  res.json({ ok: true, devices: count });
}));
app.post('/api/push/unsubscribe', requireActive, wrap(async (req, res) => {
  await pushUnsubscribe(store, req.user.id, String(req.body?.endpoint || ''));
  res.json({ ok: true });
}));
app.post('/api/push/test', requireActive, wrap(async (req, res) => {
  const subs = (await store.getUserData(req.user.id, 'push_subs')) || [];
  const sent = await pushToUser(store, req.user, { title: 'Calibrex', body: 'Push notifications are working.', url: '/', tag: 'test' });
  res.json({ ok: sent > 0, devices: sent, registered: subs.length, ready: pushDiagnostics().ready });
}));

// Admin: is push actually working? VAPID state, how many devices are
// subscribed, and recent send outcomes (why delivery is or isn't happening).
app.get('/api/admin/push/health', requireAdmin, wrap(async (req, res) => {
  const users = await store.listUsers();
  let totalSubscriptions = 0, usersWithPush = 0;
  for (const u of users) {
    const s = (await store.getUserData(u.id, 'push_subs')) || [];
    if (s.length) { usersWithPush++; totalSubscriptions += s.length; }
  }
  res.json({ ...pushDiagnostics(), publicUrlSet: !!process.env.PUBLIC_URL, users: users.length, usersWithPush, totalSubscriptions, stats: pushStats() });
}));

// Admin: send a custom push notification to every registered device, or to a
// selected set of accounts. Also drops the message into each recipient's in-app
// inbox (so it's seen even without a subscribed device). Every send is logged.
app.post('/api/admin/push/broadcast', requireAdmin, wrap(async (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 120);
  const body = String(req.body.body || '').trim().slice(0, 400);
  // Relative default so the tap opens the app at whatever domain serves it; an
  // admin may still paste an absolute external link.
  const url = String(req.body.url || '').trim().slice(0, 300) || '/';
  const audience = req.body.audience === 'selected' ? 'selected' : 'all';
  const ids = Array.isArray(req.body.userIds) ? req.body.userIds.map(String) : [];
  const alsoInbox = req.body.alsoInbox !== false; // default on
  if (!title) return res.status(400).json({ error: 'Enter a notification title.' });
  if (audience === 'selected' && !ids.length) return res.status(400).json({ error: 'Select at least one account.' });

  const all = await store.listUsers();
  const targets = audience === 'selected' ? all.filter(u => ids.includes(u.id)) : all;

  let devices = 0, recipients = 0;
  const batch = `admin-${Date.now()}`;
  for (const u of targets) {
    const sent = await pushToUser(store, u, { title, body, url, tag: 'admin-broadcast' });
    if (sent > 0) recipients++;
    devices += sent;
    if (alsoInbox) {
      const existing = (await store.getUserData(u.id, 'notifications')) || [];
      const item = { id: `${batch}-${u.id.slice(0, 6)}`, title, body, url, source: 'Calibrex', severity: 'MEDIUM', at: Date.now(), read: false, admin: true };
      await store.setUserData(u.id, 'notifications', [item, ...existing].slice(0, 200));
    }
  }

  const entry = { id: newId().slice(0, 12), at: Date.now(), by: req.user.email, title, body, audience, targeted: targets.length, recipients, devices, inbox: alsoInbox };
  const log = (await store.getSetting('push_audit')) || [];
  log.unshift(entry);
  await store.setSetting('push_audit', log.slice(0, 1000));

  res.json({ ok: true, targeted: targets.length, recipients, devices });
}));

app.get('/api/admin/push/audit', requireAdmin, wrap(async (req, res) => {
  res.json({ entries: (await store.getSetting('push_audit')) || [] });
}));

// Social / Reddit chatter tracker.
app.get('/api/chatter', requireActive, (req, res) => res.json(analyzeChatter(snapshot().items)));
app.get('/api/chatter/duplicate-candidates', requireActive, (req,res) => {
 const report=detectSocialDuplicateCandidates(snapshot().items||[]);
 res.set('Cache-Control','no-store');res.json(report);
});
app.get('/api/chatter/report', requireActive, (req, res) => {
  const report = chatterReport(analyzeChatter(snapshot().items));
  res.json({ report, generatedAt: Date.now() });
});

// Intelligence analysis and user-scoped investigation workspace.
app.get('/api/intelligence/collection-freshness', requireActive, (req,res) => {
  const snap=snapshot(),now=Date.now();
  const report=assessCollectionFreshness(snap.items||[],{snapshotAt:snap.updatedAt,now});
  res.set('Cache-Control','no-store');
  res.json({...report,feedSnapshotAt:snap.updatedAt,refreshing:!!snap.refreshing,
    sourceCollection:Object.entries(snap.sources||{}).map(([id,h])=>({id,lastSuccessAt:h?.lastSuccessAt||null,lastCheckedAt:h?.checkedAt||h?.at||null,consecutiveFailures:h?.consecutiveFailures||0,state:h?.state||'unmeasured'}))});
});
app.get('/api/intelligence/source-health', requireActive, (req,res) => {
  const sources=snapshot().sources||{},now=Date.now();
  const rows=Object.entries(sources).map(([id,h])=>{
    const ageMs=h?.lastSuccessAt?Math.max(0,now-h.lastSuccessAt):null;
    const status=ageMs!==null&&ageMs<=20*60*1000&&!(h.consecutiveFailures||0)?'healthy':ageMs!==null&&ageMs<=2*60*60*1000?'degraded':h?.state==='error'&&!h?.lastSuccessAt?'failed':h?'stale':'unmeasured';
    return {id,status,lastCheckedAt:h?.checkedAt||h?.at||null,lastSuccessAt:h?.lastSuccessAt||null,ageMinutes:ageMs===null?null:Math.round(ageMs/60000),consecutiveFailures:h?.consecutiveFailures||0,failureClass:h?.failureClass||null,count:h?.count||0};
  }).sort((a,b)=>(a.status==='failed'?-1:0)-(b.status==='failed'?-1:0)||(b.ageMinutes??1e9)-(a.ageMinutes??1e9));
  res.set('Cache-Control','no-store');
  res.json({generatedAt:now,measured:rows.length,healthy:rows.filter(x=>x.status==='healthy').length,degraded:rows.filter(x=>x.status==='degraded').length,stale:rows.filter(x=>x.status==='stale').length,failed:rows.filter(x=>x.status==='failed').length,unmeasured:rows.filter(x=>x.status==='unmeasured').length,sources:rows,note:'Health describes the last collection attempt, not editorial reliability or completeness. An empty successful poll is not proof that a source has no relevant reporting.'});
});
app.get('/api/intelligence/patterns', requireActive, (req, res) => {
  const items = snapshot().items;
  res.set('Cache-Control', 'no-store');
  res.json({ patterns: detectIntelligencePatterns(items), generatedAt: Date.now(),
    note: 'Patterns are review leads only; they do not establish coordination, intent or truth.' });
});
app.get('/api/intelligence/event-candidates', requireActive, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ candidates: buildEventCandidates(snapshot().items), generatedAt: Date.now() });
});


const ALERT_RULES_KEY = 'intelligence_alert_rules';
const getAlertRules = async uid => (await store.getUserData(uid, ALERT_RULES_KEY)) || [];
app.get('/api/intelligence/alert-rules', requireActive, wrap(async (req,res) => {
  const rules=await getAlertRules(req.user.id);
  res.json({rules,preview:evaluateAlertRules(rules,snapshot().items),generatedAt:Date.now()});
}));
app.post('/api/intelligence/alert-rules', requireActive, wrap(async (req,res) => {
  const rules=await getAlertRules(req.user.id);
  if(rules.length>=100)return res.status(409).json({error:'Alert rule limit reached.'});
  let clean;try{clean=validateAlertRule(req.body||{});}catch(e){return res.status(400).json({error:e.message});}
  const rule={id:newId(),...clean,createdAt:Date.now(),updatedAt:Date.now(),createdBy:req.user.id};
  await store.setUserData(req.user.id,ALERT_RULES_KEY,[rule,...rules]);
  res.status(201).json({rule});
}));
app.put('/api/intelligence/alert-rules/:id', requireActive, wrap(async (req,res) => {
  const rules=await getAlertRules(req.user.id),i=rules.findIndex(x=>x.id===req.params.id);
  if(i<0)return res.status(404).json({error:'Alert rule not found.'});
  let clean;try{clean=validateAlertRule({...rules[i],...(req.body||{})});}catch(e){return res.status(400).json({error:e.message});}
  rules[i]={...rules[i],...clean,updatedAt:Date.now()};
  await store.setUserData(req.user.id,ALERT_RULES_KEY,rules);
  res.json({rule:rules[i]});
}));
app.delete('/api/intelligence/alert-rules/:id', requireActive, wrap(async (req,res) => {
  const rules=await getAlertRules(req.user.id),next=rules.filter(x=>x.id!==req.params.id);
  if(next.length===rules.length)return res.status(404).json({error:'Alert rule not found.'});
  await store.setUserData(req.user.id,ALERT_RULES_KEY,next);
  res.json({ok:true});
}));
app.get('/api/intelligence/alert-preview', requireActive, wrap(async (req,res) => {
  const rules=await getAlertRules(req.user.id);
  res.set('Cache-Control','no-store');
  res.json({alerts:evaluateAlertRules(rules,snapshot().items),generatedAt:Date.now(),
    note:'Rule matches are triage candidates, not verified incidents or truth assessments.'});
}));

const ENTITY_REGISTRY_KEY = 'cross_case_entity_registry';
const getEntityRegistry = async uid => (await store.getUserData(uid, ENTITY_REGISTRY_KEY)) || [];
async function entityScope(req,res,action='view') {
  const scope=await resolveWorkspace(req,res,action);if(!scope)return null;
  return {scope,items:scope.personal?await getEntityRegistry(req.user.id):(await getWorkspaceData(scope.id)).entities||[]};
}
async function mutateEntityRegistry(c,actor,mutator) {
  if(c.scope.personal){
    const items=await getEntityRegistry(actor), result=await mutator(items);
    if(result?.changed)await store.setUserData(actor,ENTITY_REGISTRY_KEY,result.items);
    return result;
  }
  let result;
  await updateWorkspaceData(c.scope.id,async data=>{
    data.entities||=[];
    result=await mutator(data.entities);
    if(result?.changed)data.entities=result.items;
  });
  if(result?.changed)await auditWorkspace(c.scope.id,actor,result.action||'entity_registry_updated',{});
  return result;
}
app.get('/api/entity-registry', requireActive, wrap(async (req,res)=>{
  const c=await entityScope(req,res);if(!c)return;res.set('Cache-Control','no-store');
  const items=c.scope.personal?c.items:(await getWorkspaceData(c.scope.id)).entities||[];
  res.json({entities:items.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))});
}));
app.post('/api/entity-registry', requireActive, wrap(async (req,res)=>{
  const c=await entityScope(req,res,'edit');if(!c)return;let entity;
  try{entity=validateRegistryEntity(req.body||{});}catch(e){return res.status(400).json({error:e.message});}
  const result=await mutateEntityRegistry(c,req.user.id,items=>{
    if(items.length>=2000)return {error:{status:409,message:'Cross-case entity registry limit reached.'}};
    if(items.some(x=>x.id===entity.id))return {error:{status:409,message:'Entity ID already exists.'}};
    return {changed:true,items:[entity,...items],action:'entity_created'};
  });
  if(result.error)return res.status(result.error.status).json({error:result.error.message});
  res.status(201).json({entity});
}));
app.put('/api/entity-registry/:id', requireActive, wrap(async (req,res)=>{
  const c=await entityScope(req,res,'edit');if(!c)return;let updated=null;
  const result=await mutateEntityRegistry(c,req.user.id,items=>{
    const index=items.findIndex(x=>x.id===req.params.id);if(index<0)return {error:{status:404,message:'Entity not found.'}};
    try{updated=validateRegistryEntity({...items[index],...(req.body||{})},items[index]);}
    catch(e){return {error:{status:400,message:e.message}};}
    const next=[...items];next[index]=updated;return {changed:true,items:next,action:'entity_updated'};
  });
  if(result.error)return res.status(result.error.status).json({error:result.error.message});
  res.json({entity:updated});
}));
app.post('/api/entity-registry/merge', requireActive, wrap(async (req,res)=>{
  const c=await entityScope(req,res,'edit');if(!c)return;
  const targetId=String(req.body?.targetId||''),sourceIds=[...new Set((Array.isArray(req.body?.sourceIds)?req.body.sourceIds:[]).map(String))].filter(x=>x!==targetId);
  let merged=null;
  const result=await mutateEntityRegistry(c,req.user.id,items=>{
    const target=items.find(x=>x.id===targetId),sources=items.filter(x=>sourceIds.includes(x.id));
    if(!target||!sourceIds.length||sources.length!==sourceIds.length)return {error:{status:400,message:'Choose an existing target and at least one existing source entity.'}};
    try{
      merged=validateRegistryEntity({...target,aliases:[...(target.aliases||[]),...sources.flatMap(x=>[x.name,...(x.aliases||[])])],sourceRefs:[...(target.sourceRefs||[]),...sources.flatMap(x=>x.sourceRefs||[])],notes:[target.notes,...sources.map(x=>x.notes).filter(Boolean)].filter(Boolean).join('\\n\\n[Analyst merge]\\n'),confidence:Math.max(target.confidence||0,...sources.map(x=>x.confidence||0)),resolution:target.resolution==='CONFIRMED'?'CONFIRMED':sources.some(x=>x.resolution==='CONFIRMED')?'CANDIDATE':target.resolution},target);
    }catch(e){return {error:{status:400,message:e.message}};}
    const next=items.filter(x=>!sourceIds.includes(x.id)).map(x=>x.id===targetId?merged:x);
    return {changed:true,items:next,action:'entities_merged'};
  });
  if(result.error)return res.status(result.error.status).json({error:result.error.message});
  res.json({entity:merged,mergedIds:sourceIds,note:'Analyst-directed merge.'});
}));
app.delete('/api/entity-registry/:id', requireActive, wrap(async (req,res)=>{
  const c=await entityScope(req,res,'edit');if(!c)return;
  const result=await mutateEntityRegistry(c,req.user.id,items=>{
    const next=items.filter(x=>x.id!==req.params.id);
    if(next.length===items.length)return {error:{status:404,message:'Entity not found.'}};
    return {changed:true,items:next,action:'entity_deleted'};
  });
  if(result.error)return res.status(result.error.status).json({error:result.error.message});
  res.json({ok:true});
}));

// Organisation workspaces: shared cases and entity register, isolated by workspace ID.
const WORKSPACES_KEY = 'corporate_workspaces';
const workspaceDataKey = id => `corporate_workspace_data:${id}`;
const workspaceAuditKey = id => `corporate_workspace_audit:${id}`;
const getWorkspaces = async () => (await store.getSetting(WORKSPACES_KEY)) || [];
const getWorkspaceData = async id => (await store.getSetting(workspaceDataKey(id))) || { investigations: [], entities: [], ledgers: {} };
const saveWorkspaceData = (id, data) => store.setSetting(workspaceDataKey(id), data);
const updateWorkspaceData = (id, updater) => store.updateSetting(workspaceDataKey(id), async current => {
  const data = current || { investigations: [], entities: [], ledgers: {} };
  await updater(data);
  return data;
}, { investigations: [], entities: [], ledgers: {} });
async function resolveWorkspace(req, res, action = 'view') {
  const selectors = [req.query.workspaceId, req.body?.workspaceId, req.headers['x-calibrex-workspace']]
    .filter(value => value != null && String(value).trim() !== '')
    .map(value => String(value).trim());
  if (new Set(selectors).size > 1) { res.status(400).json({ error: 'Conflicting workspace selectors.' }); return null; }
  const id = selectors[0] || '';
  if (!id) return { personal: true };
  const workspaces = await getWorkspaces();
  const workspace = workspaces.find(w => w.id === id && w.status === 'active');
  const role = workspaceRole(workspace, req.user.id);
  if (!workspace || !role) { res.status(404).json({ error: 'Workspace not found.' }); return null; }
  if (!canWorkspace(role, action)) { res.status(403).json({ error: 'Your workspace role does not permit this action.' }); return null; }
  return { personal: false, id, workspace, role };
}
async function auditWorkspace(id, actor, action, detail = {}) {
  await store.updateSetting(workspaceAuditKey(id), current => {
    const log = Array.isArray(current) ? current : [];
    log.unshift({ id: newId().slice(0,12), at: Date.now(), actor, action, detail });
    return log.slice(0,5000);
  }, []);
}
app.get('/api/workspaces', requireActive, wrap(async (req,res) => {
  const workspaces = (await getWorkspaces()).filter(w => w.status === 'active' && workspaceRole(w,req.user.id)).map(w => ({ id:w.id, name:w.name, slug:w.slug, role:workspaceRole(w,req.user.id), memberCount:w.members.length, createdAt:w.createdAt }));
  res.set('Cache-Control','no-store'); res.json({ workspaces });
}));
app.post('/api/workspaces', requireActive, wrap(async (req,res) => {
  const name = String(req.body?.name || '').trim().slice(0,100);
  if (name.length < 2) return res.status(400).json({ error:'Workspace name must be at least 2 characters.' });
  const id = newId(); const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || id.slice(0,8);
  const workspace = { id, name, slug, status:'active', ownerId:req.user.id, createdAt:Date.now(), members:[{ userId:req.user.id, email:req.user.email, name:req.user.name, role:'owner', joinedAt:Date.now() }] };
  let limitReached = false;
  await store.updateSetting(WORKSPACES_KEY, current => {
    const all = Array.isArray(current) ? current : [];
    const membershipCount = all.filter(w => w.status === 'active' && workspaceRole(w,req.user.id)).length;
    if (membershipCount >= 20) { limitReached = true; return all; }
    return [workspace,...all];
  }, []);
  if (limitReached) return res.status(409).json({ error:'Workspace membership limit reached.' });
  await saveWorkspaceData(id,{investigations:[],entities:[],ledgers:{}});
  await auditWorkspace(id,req.user.id,'workspace_created',{name});
  res.status(201).json({workspace:{id,name,slug,role:'owner',memberCount:1,createdAt:workspace.createdAt}});
}));
app.get('/api/workspaces/:id/members', requireActive, wrap(async (req,res) => {
  const workspaces=await getWorkspaces(), w=workspaces.find(x=>x.id===req.params.id);
  if(!w || !workspaceRole(w,req.user.id))return res.status(404).json({error:'Workspace not found.'});
  res.json({members:w.members.map(({userId,email,name,role,joinedAt})=>({userId,email,name,role,joinedAt}))});
}));
app.post('/api/workspaces/:id/members', requireActive, wrap(async (req,res) => {
  const email=String(req.body?.email||'').trim().toLowerCase(), role=['admin','analyst','viewer'].includes(req.body?.role)?req.body.role:'analyst';
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Enter a valid account email.'});
  const target=await store.findUserByEmail(email);
  if(!target || target.status!=='active')return res.status(404).json({error:'An existing active Calibrex account is required. Ask the user to register and activate their account first.'});
  let failure=null;
  await store.updateSetting(WORKSPACES_KEY, all => {
    const list=Array.isArray(all)?all:[], i=list.findIndex(x=>x.id===req.params.id), w=list[i];
    if(!w || !canWorkspace(workspaceRole(w,req.user.id),'manage')){failure={status:403,error:'Workspace owner or admin required.'};return list;}
    if(w.members.some(m=>m.userId===target.id)){failure={status:409,error:'This account is already a workspace member.'};return list;}
    if(w.members.length>=100){failure={status:409,error:'Workspace member limit reached.'};return list;}
    list[i]={...w,members:[...w.members,{userId:target.id,email:target.email,name:target.name,role,joinedAt:Date.now()}]};
    return list;
  }, []);
  if(failure)return res.status(failure.status).json({error:failure.error});
  await auditWorkspace(req.params.id,req.user.id,'member_added',{targetUserId:target.id,role});
  res.status(201).json({member:{userId:target.id,email:target.email,name:target.name,role}});
}));
app.patch('/api/workspaces/:id/members/:userId', requireActive, wrap(async (req,res) => {
  const role=req.body?.role;if(!['admin','analyst','viewer'].includes(role))return res.status(400).json({error:'Invalid workspace role.'});
  let failure=null;
  await store.updateSetting(WORKSPACES_KEY, all => {
    const list=Array.isArray(all)?all:[], i=list.findIndex(x=>x.id===req.params.id), w=list[i];
    if(!w || !canWorkspace(workspaceRole(w,req.user.id),'manage')){failure={status:403,error:'Workspace owner or admin required.'};return list;}
    const m=w.members.find(x=>x.userId===req.params.userId);
    if(!m){failure={status:404,error:'Member not found.'};return list;}
    if(m.role==='owner'){failure={status:400,error:'Transfer ownership before changing the owner role.'};return list;}
    list[i]={...w,members:w.members.map(x=>x.userId===req.params.userId?{...x,role}:x)};
    return list;
  }, []);
  if(failure)return res.status(failure.status).json({error:failure.error});
  await auditWorkspace(req.params.id,req.user.id,'member_role_changed',{targetUserId:req.params.userId,role});res.json({ok:true});
}));
app.delete('/api/workspaces/:id/members/:userId', requireActive, wrap(async (req,res) => {
  let failure=null;
  await store.updateSetting(WORKSPACES_KEY, all => {
    const list=Array.isArray(all)?all:[], i=list.findIndex(x=>x.id===req.params.id), w=list[i];
    if(!w || !canWorkspace(workspaceRole(w,req.user.id),'manage')){failure={status:403,error:'Workspace owner or admin required.'};return list;}
    if(req.params.userId===w.ownerId){failure={status:400,error:'Transfer ownership before removing the owner.'};return list;}
    if(!w.members.some(m=>m.userId===req.params.userId)){failure={status:404,error:'Member not found.'};return list;}
    list[i]={...w,members:w.members.filter(m=>m.userId!==req.params.userId)};
    return list;
  }, []);
  if(failure)return res.status(failure.status).json({error:failure.error});
  await auditWorkspace(req.params.id,req.user.id,'member_removed',{targetUserId:req.params.userId});res.json({ok:true});
}));
app.post('/api/workspaces/:id/transfer-owner', requireActive, wrap(async (req,res) => {
  const targetUserId=String(req.body?.userId||'').trim();
  if(!targetUserId)return res.status(400).json({error:'Choose a workspace member to receive ownership.'});
  let failure=null, transferred=false;
  await store.updateSetting(WORKSPACES_KEY, all => {
    const list=Array.isArray(all)?all:[], i=list.findIndex(x=>x.id===req.params.id), w=list[i];
    if(!w || w.status!=='active'){failure={status:404,error:'Workspace not found.'};return list;}
    if(w.ownerId!==req.user.id){failure={status:403,error:'Only the current workspace owner can transfer ownership.'};return list;}
    if(targetUserId===req.user.id){failure={status:400,error:'Choose another member.'};return list;}
    if(!w.members.some(m=>m.userId===targetUserId)){failure={status:404,error:'The new owner must already be a workspace member.'};return list;}
    list[i]={...w,ownerId:targetUserId,members:w.members.map(m=>m.userId===targetUserId?{...m,role:'owner'}:m.userId===req.user.id?{...m,role:'admin'}:m)};
    transferred=true;return list;
  }, []);
  if(failure)return res.status(failure.status).json({error:failure.error});
  if(transferred)await auditWorkspace(req.params.id,req.user.id,'ownership_transferred',{newOwnerUserId:targetUserId});
  res.json({ok:true,ownerUserId:targetUserId});
}));
app.get('/api/workspaces/:id/audit', requireActive, wrap(async (req,res) => {
  const all=await getWorkspaces(),w=all.find(x=>x.id===req.params.id);if(!w || !canWorkspace(workspaceRole(w,req.user.id),'manage'))return res.status(403).json({error:'Workspace owner or admin required.'});
  res.set('Cache-Control','no-store');res.json({entries:(await store.getSetting(workspaceAuditKey(w.id)))||[]});
}));

const INVESTIGATIONS_KEY = 'investigations';
const getInvestigations = async uid => (await store.getUserData(uid, INVESTIGATIONS_KEY)) || [];
const evidenceLedgerKey = id => `investigation_evidence_ledger:${id}`;
const appendEvidenceLedger = async (uid, investigationId, before = [], after = [], actor = '') => {
  const ledger = (await store.getUserData(uid, evidenceLedgerKey(investigationId))) || [];
  // Do not truncate a chain: doing so would destroy its verifiable root.
  if (ledger.length >= 5000) return { appended: 0, limitReached: true };
  const prior = new Map((before || []).map(e => [String(e.id), e]));
  const current = new Map((after || []).map(e => [String(e.id), e]));
  const changes = [];
  for (const evidence of after || []) {
    const old = prior.get(String(evidence.id));
    if (old && canonicalJson(old) === canonicalJson(evidence)) continue;
    changes.push({ evidence, action: old ? 'UPDATED' : 'ADDED' });
  }
  for (const evidence of before || []) {
    if (!current.has(String(evidence.id))) changes.push({ evidence, action: 'REMOVED' });
  }
  let head = ledger[ledger.length - 1]?.hash || '0'.repeat(64);
  const additions = [];
  for (const change of changes) {
    if (ledger.length + additions.length >= 5000) break;
    const entry = createEvidenceLedgerEntry({
      investigationId, evidenceId: change.evidence.id, action: change.action,
      at: Date.now(), actor, evidence: change.evidence
    }, head, ledger.length + additions.length + 1);
    additions.push(entry); head = entry.hash;
  }
  if (additions.length) await store.setUserData(uid, evidenceLedgerKey(investigationId), [...ledger, ...additions]);
  return { appended: additions.length, limitReached: ledger.length + additions.length >= 5000 };
};
app.get('/api/specialist-workflows', requireActive, (req,res)=>{
  res.set('Cache-Control','no-store');
  res.json({roles:ROLE_WORKFLOWS,scoreMeaning:'Targets and structural workflow requirements only; not validated capability scores.'});
});
app.post('/api/specialist-workflows/:role/validate', requireActive, (req,res)=>{
  try { res.set('Cache-Control','no-store'); res.json(validateRoleAssessment(String(req.params.role||'').toUpperCase(),req.body||{})); }
  catch(e) { res.status(400).json({error:e.message}); }
});
const DEFENCE_REGISTRY_KEY='defence_public_reference_registry_v1';
app.get('/api/defence-intelligence/registry', requireActive, wrap(async(req,res)=>{
 const saved=(await store.getUserData(req.user.id,DEFENCE_REGISTRY_KEY))||[];
 const registry=buildDefenceRegistry(saved);
 res.set('Cache-Control','no-store');res.json(registry);
}));
app.post('/api/defence-intelligence/registry/records', requireActive, wrap(async(req,res)=>{
 let records;
 try {
  records=await store.updateUserData(req.user.id,DEFENCE_REGISTRY_KEY,current=>upsertDefenceRegistryRecord(current,req.body?.record||{}),[]);
 } catch(e) {
  return res.status(400).json({error:e.message});
 }
 res.set('Cache-Control','no-store');res.status(201).json(buildDefenceRegistry(records));
}));
app.put('/api/defence-intelligence/registry', requireActive, wrap(async(req,res)=>{
 const incoming=Array.isArray(req.body?.records)?req.body.records:[];
 if(incoming.length>500)return res.status(400).json({error:'A maximum of 500 records may be submitted at once.'});
 let records;
 try{records=incoming.map(validateDefenceRecord);}catch(e){return res.status(400).json({error:e.message});}
 const byId=new Map(records.map(x=>[x.id,x]));
 const saved=await store.updateUserData(req.user.id,DEFENCE_REGISTRY_KEY,()=>[...byId.values()],[]);
 res.set('Cache-Control','no-store');res.json(buildDefenceRegistry(saved));
}));
app.get('/api/defence-intelligence/sources', requireActive, (req,res)=>{
  res.set('Cache-Control','no-store');
  res.json({sources:DEFENCE_SOURCE_REGISTER,scope:'OPEN_SOURCE_STRATEGIC_LEVEL',credentialsRequired:false,note:'Source register only; live collection is not implied.'});
});
app.post('/api/defence-intelligence/brief', requireActive, wrap(async (req,res)=>{
  const body=req.body||{};
  const brief=buildDefenceBrief({signals:Array.isArray(body.signals)?body.signals:[],indicators:Array.isArray(body.indicators)?body.indicators:[],windowDays:body.windowDays});
  res.set('Cache-Control','no-store');
  res.json(brief);
}));
const specialistRoleKeys = new Set(['DEFENCE_IW','CORPORATE_RISK','SUPPLY_CHAIN','GEOPOLITICAL','STRATEGIC']);
const specialistWorkspaceKey = role => 'specialist_ops_' + role;
function specialistRole(req,res){const role=String(req.params.role||'').toUpperCase();if(!specialistRoleKeys.has(role)){res.status(400).json({error:'Unknown specialist role.'});return null;}return role;}
app.get('/api/specialist-operations/:role', requireActive, wrap(async(req,res)=>{
 const role=specialistRole(req,res);if(!role)return;
 const ws=(await store.getUserData(req.user.id,specialistWorkspaceKey(role)))||{observations:[],collectionHistory:[],assessments:[]};
 res.set('Cache-Control','no-store');
 const all=ws.observations||[],activeKey=ws.activeInvestigationKey||null,active=activeKey?all.filter(x=>x.investigationKey===activeKey):[];
 res.json({role,workspace:{...ws,observations:active.slice(0,250),totalSavedObservations:all.length,historicalObservationCount:all.length-active.length},status:{monitorEnabled:ws.monitorEnabled===true,observationCount:active.length,totalSavedObservations:all.length,historicalObservationCount:all.length-active.length,collectionCount:(ws.collectionHistory||[]).length,assessmentCount:(ws.assessments||[]).length,lastCollectedAt:ws.collectionHistory?.at(-1)?.startedAt||null,updatedAt:ws.updatedAt||null}});
}));
app.post('/api/specialist-operations/:role/collect', requireActive, wrap(async(req,res)=>{
 const role=specialistRole(req,res);if(!role)return;
 // No per-user/per-role attempt cap for specialist collection.
 // Authentication remains required; upstream provider availability and quotas still apply.
 const country=String(req.body.country||'IND').toUpperCase();
 if(!/^[A-Z]{3}$/.test(country))return res.status(400).json({error:'Use a three-letter country code, such as IND.'});
 const snap=snapshot();
 const collected=await collectSpecialistData({role,searchNews,feedItems:filterSpecialistFeedItems(role,snap.items||[]),readArticle,country,focus:String(req.body.focus||'').slice(0,120),identifier:String(req.body.identifier||'').slice(0,120)});
 const key=specialistWorkspaceKey(role),existing=(await store.getUserData(req.user.id,key))||{};
 const workspace=mergeSpecialistWorkspace(existing,collected);
 workspace.activeInvestigationKey=collected.collection.investigationKey;workspace.subject={name:String(req.body.focus||'').trim().slice(0,180),identifier:String(req.body.identifier||'').trim().slice(0,120),country};
 await store.setUserData(req.user.id,key,workspace);
 res.set('Cache-Control','no-store');
 res.json({role,collection:collected.collection,status:{observationCount:workspace.observations.length,updatedAt:workspace.updatedAt},observations:collected.observations.slice(0,80)});
}));
app.post('/api/specialist-operations/:role/assess', requireActive, wrap(async(req,res)=>{
 const role=specialistRole(req,res);if(!role)return;
 const key=specialistWorkspaceKey(role),workspace=(await store.getUserData(req.user.id,key))||{};
 const activeKey=workspace.activeInvestigationKey,activeObservations=(workspace.observations||[]).filter(x=>activeKey&&x.investigationKey===activeKey);
 if(!activeObservations.length)return res.status(400).json({error:'Collect evidence for the current investigation before creating an assessment. Historical records are preserved separately.'});
 let assessment=runSpecialistAssessment(role,{observations:activeObservations,macroIndicators:workspace.macroIndicators,tradeFlows:workspace.tradeFlows,subject:workspace.subject||{},assumptions:Array.isArray(req.body.drivers)?req.body.drivers:[],scenarios:Array.isArray(req.body.scenarios)?req.body.scenarios:[],forecasts:Array.isArray(req.body.forecasts)?req.body.forecasts:[]});
 if(role==='DEFENCE_IW'){
  const signals=activeObservations.map(x=>({id:x.id,domain:x.eventType,claim:x.title,theme:x.theme,source:x.source,url:x.url,publishedAt:x.publishedAt,independenceGroup:x.sourceDomain||x.source,evidenceType:x.kind==='SOCIAL'?'SOCIAL_POST':'MEDIA_REPORT'}));
  assessment.defenceBrief=buildDefenceBrief({signals,indicators:[]});
  assessment.conflictWatch=conflictSnapshot();
 }
 if(role==='CORPORATE_RISK'&&workspace.subject?.name){
  assessment.officialSanctionsScreen=screenSanctions(workspace.subject.name);
 }
 if(role==='SUPPLY_CHAIN')assessment.liveMaritimeContext=maritimeSnapshot();
 if(role==='GEOPOLITICAL'){
  assessment.liveGeospatialEvents=geointSnapshot();
  assessment.conflictWatch=conflictSnapshot();
 }
 if(role==='STRATEGIC'){
  assessment.liveMacroContext=macroSnapshot();
  assessment.liveMarketContext=marketsSnapshot();
 }
 const analystReview={judgement:String(req.body.judgement||'').trim().slice(0,5000),confidence:['LOW','MEDIUM','HIGH'].includes(req.body.confidence)?req.body.confidence:'LOW',alternatives:String(req.body.alternatives||'').trim().slice(0,3000),implications:String(req.body.implications||'').trim().slice(0,3000),reviewDate:String(req.body.reviewDate||'').slice(0,30)};
 const record={id:crypto.randomUUID(),role,createdAt:Date.now(),observationCount:activeObservations.length,investigationKey:activeKey,subject:{...workspace.subject},assessment,analystReview};
 workspace.assessments=[record,...(workspace.assessments||[])].slice(0,100);workspace.updatedAt=Date.now();
 await store.setUserData(req.user.id,key,workspace);
 res.set('Cache-Control','no-store');res.json({record,workspaceStatus:{assessmentCount:workspace.assessments.length}});
}));
app.put('/api/specialist-operations/:role/monitor', requireActive, wrap(async(req,res)=>{
 const role=specialistRole(req,res);if(!role)return;
 const key=specialistWorkspaceKey(role),ws=(await store.getUserData(req.user.id,key))||{observations:[],collectionHistory:[],assessments:[]};
 ws.monitorEnabled=req.body.enabled===true;ws.updatedAt=Date.now();
 await store.setUserData(req.user.id,key,ws);
 res.set('Cache-Control','no-store');res.json({ok:true,role,monitorEnabled:ws.monitorEnabled,mode:'EXISTING_FEED_SNAPSHOT_ONLY',intervalMinutes:10});
}));

app.post('/api/specialist-operations/:role/clear', requireActive, wrap(async(req,res)=>{
 const role=specialistRole(req,res);if(!role)return;
 await store.setUserData(req.user.id,specialistWorkspaceKey(role),{observations:[],macroIndicators:[],tradeFlows:[],collectionHistory:[],assessments:[],updatedAt:Date.now()});
 res.json({ok:true,role});
}));

app.post('/api/specialist-analytics/:role', requireActive, wrap(async (req,res)=>{
  const body=req.body||{};
  const engines={DEFENCE_IW:assessDefenceCollection,CORPORATE_RISK:assessCorporateRisk,SUPPLY_CHAIN:assessSupplyChainRisk,GEOPOLITICAL:assessGeopoliticalEnvironment,STRATEGIC:assessStrategicForesight};
  const role=String(req.params.role||'').toUpperCase(),run=engines[role];
  if(!run)return res.status(400).json({error:'Unknown specialist role.'});
  const result=run(body);
  res.set('Cache-Control','no-store');
  res.json({...result,generatedAt:Date.now(),dataMode:'ANALYST_SUPPLIED_INPUT',liveIngestion:false});
}));

app.get('/api/domain-intelligence/catalog', requireActive, wrap(async (req,res)=>{
  res.set('Cache-Control','no-store');
  res.json({sources:DOMAIN_SOURCE_CATALOG,packs:SPECIALIST_PACKS,release:'R1-R2',credentialsRequired:false,note:'Catalogue describes available public/optional sources; it does not claim all sources are connected or polled live.'});
}));
app.post('/api/domain-intelligence/analyse', requireActive, wrap(async (req,res)=>{
  const body=req.body||{};
  const observations=(Array.isArray(body.observations)?body.observations:[]).slice(0,500).map(x=>normaliseObservation(x));
  const indicators=(Array.isArray(body.indicators)?body.indicators:[]).slice(0,300);
  const entities=(Array.isArray(body.entities)?body.entities:[]).slice(0,500);
  const countryCodes=[...new Set(observations.flatMap(x=>x.countryCodes))].slice(0,100);
  const countryProfiles=countryCodes.map(code=>buildCountryProfile(code,observations,indicators));
  const warnings=(Array.isArray(body.warningIndicators)?body.warningIndicators:[]).slice(0,200).map(evaluateWarningIndicator);
  const forecasts=(Array.isArray(body.forecasts)?body.forecasts:[]).slice(0,100).map(x=>x.outcome?scoreForecastOutcome(x,x.outcome):createForecastRecord(x));
  const entityCandidates=resolveEntityCandidates(entities), eventCandidates=clusterEventCandidates(observations);
  res.set('Cache-Control','no-store');
  res.json({observations,countryProfiles,entityCandidates,eventCandidates,warningIndicators:warnings,forecasts,summary:{observationCount:observations.length,countryCount:countryProfiles.length,entityCandidateCount:entityCandidates.length,eventCandidateCount:eventCandidates.length},caveats:['Entity and event matches are candidates, not confirmed links.','Missing observations remain unassessed.','No new provider credentials are required by this endpoint.']});
}));
app.get('/api/investigations', requireActive, wrap(async (req, res) => {
  const scope=await resolveWorkspace(req,res,'view');if(!scope)return;
  const items=scope.personal?await getInvestigations(req.user.id):(await getWorkspaceData(scope.id)).investigations;
  res.set('Cache-Control','no-store');res.json({investigations:items.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)),scope:scope.personal?'personal':{id:scope.id,name:scope.workspace.name,role:scope.role}});
}));
app.post('/api/investigations', requireActive, wrap(async (req, res) => {
  const scope=await resolveWorkspace(req,res,'edit');if(!scope)return;
  let clean;try{clean=validateInvestigation(req.body||{});}catch(e){return res.status(400).json({error:e.message});}
  const now=Date.now(),item={id:newId(),...clean,createdAt:now,updatedAt:now,createdBy:req.user.id,workspaceId:scope.personal?null:scope.id};
  if(scope.personal){
    const items=await getInvestigations(req.user.id);if(items.length>=1000)return res.status(409).json({error:'Investigation limit reached.'});
    await store.setUserData(req.user.id,INVESTIGATIONS_KEY,[item,...items]);await appendEvidenceLedger(req.user.id,item.id,[],item.evidence,req.user.id);
  } else {
    let limitReached=false;
    await updateWorkspaceData(scope.id,data=>{data.investigations||=[];if(data.investigations.length>=1000){limitReached=true;return;}data.investigations.unshift(item);});
    if(limitReached)return res.status(409).json({error:'Investigation limit reached.'});
    await auditWorkspace(scope.id,req.user.id,'investigation_created',{investigationId:item.id});
  }
  res.status(201).json({investigation:item});
}));
async function caseScope(req,res,action='view') {
  const scope=await resolveWorkspace(req,res,action);if(!scope)return null;
  const data=scope.personal?null:await getWorkspaceData(scope.id);
  const items=scope.personal?await getInvestigations(req.user.id):data.investigations;
  const index=items.findIndex(x=>x.id===req.params.id);if(index<0){res.status(404).json({error:'Investigation not found.'});return null;}
  return {scope,data,items,index,item:items[index]};
}
app.post('/api/investigations/:id/evidence/:evidenceId/geospatial-context', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res,'edit');if(!c)return;
  const evidence=(c.item.evidence||[]).find(e=>e.id===req.params.evidenceId);
  if(!evidence)return res.status(404).json({error:'Evidence item not found.'});
  const lat=evidence.lat??evidence.latitude,lon=evidence.lon??evidence.lng??evidence.longitude;
  if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon)))return res.status(400).json({error:'Evidence has no valid coordinates to resolve.'});
  const now=Date.now();
  const recent=(reverseGeoCalls.get(req.user.id)||[]).filter(t=>now-t<10*60*1000);
  if(recent.length>=30)return res.status(429).json({error:'Reverse-geocoding rate limit reached. Try again later.'});
  recent.push(now);reverseGeoCalls.set(req.user.id,recent);
  const lookup=await reverseGeocoder.lookup(lat,lon);
  const context=sanitiseGeospatialContext(lookup,req.user.id,now);
  const nextEvidence=attachGeospatialContext(c.item.evidence||[],req.params.evidenceId,context);
  let updated=null,failure=null;
  if(c.scope.personal){
    const {history:priorHistory=[],...priorSnapshot}=c.item;
    const revision={revision:(c.item.revision||1)+1,at:now,by:req.user.id,title:c.item.title,status:c.item.status,priority:c.item.priority,evidenceCount:nextEvidence.length,notesCount:(c.item.notes||[]).length,snapshot:priorSnapshot};
    updated={...c.item,evidence:nextEvidence,revision:revision.revision,history:[...priorHistory,revision].slice(-100),updatedAt:now};
    c.items[c.index]=updated;await store.setUserData(req.user.id,INVESTIGATIONS_KEY,c.items);
    await appendEvidenceLedger(req.user.id,c.item.id,c.item.evidence,nextEvidence,req.user.id);
  }else{
    await updateWorkspaceData(c.scope.id,async data=>{
      const index=(data.investigations||[]).findIndex(x=>x.id===c.item.id);
      if(index<0){failure='not_found';return;}
      const current=data.investigations[index];
      const evidenceUpdated=attachGeospatialContext(current.evidence||[],req.params.evidenceId,context);
      const {history:priorHistory=[],...priorSnapshot}=current;
      const revision={revision:(current.revision||1)+1,at:now,by:req.user.id,title:current.title,status:current.status,priority:current.priority,evidenceCount:evidenceUpdated.length,notesCount:(current.notes||[]).length,snapshot:priorSnapshot};
      updated={...current,evidence:evidenceUpdated,revision:revision.revision,history:[...priorHistory,revision].slice(-100),updatedAt:now};
      data.investigations[index]=updated;
      await appendSharedLedger(data,current.id,current.evidence,evidenceUpdated,req.user.id);
    });
    if(failure==='not_found')return res.status(404).json({error:'Investigation not found.'});
    await auditWorkspace(c.scope.id,req.user.id,'investigation_geospatial_context_saved',{investigationId:c.item.id,evidenceId:req.params.evidenceId,provider:context.provider});
  }
  res.json({investigation:updated,evidenceId:req.params.evidenceId,geospatialContext:context});
}));
app.patch('/api/investigations/:id/workflow', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res,'edit');if(!c)return;
  const actorRole=c.scope.personal?req.user.role:c.scope.role;
  const result=transitionInvestigationWorkflow(c.item,{to:req.body?.to,note:req.body?.note,taskId:req.body?.taskId},{id:req.user.id,role:actorRole});
  if(!result.ok)return res.status(result.error==='REVIEWER_ROLE_REQUIRED'?403:400).json(result);
  const updated={...result.caseRecord,updatedAt:Date.now()};
  if(c.scope.personal){c.items[c.index]=updated;await store.setUserData(req.user.id,INVESTIGATIONS_KEY,c.items);}
  else{
    await updateWorkspaceData(c.scope.id,data=>{const i=(data.investigations||[]).findIndex(x=>x.id===c.item.id);if(i>=0)data.investigations[i]=updated;});
    await auditWorkspace(c.scope.id,req.user.id,'investigation_workflow_transition',{investigationId:c.item.id,from:c.item.workflowStatus||'DRAFT',to:updated.workflowStatus});
  }
  res.json({investigation:updated,transition:updated.workflowHistory.at(-1)});
}));
app.put('/api/investigations/:id/tasks', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res,'edit');if(!c)return;
  const validated=validateWorkflowTasks(req.body?.tasks||[]);
  if(!validated.valid)return res.status(400).json({error:'Task validation failed.',details:validated.errors});
  const updated={...c.item,workflowTasks:validated.tasks,updatedAt:Date.now()};
  if(c.scope.personal){c.items[c.index]=updated;await store.setUserData(req.user.id,INVESTIGATIONS_KEY,c.items);}
  else{
    await updateWorkspaceData(c.scope.id,data=>{const i=(data.investigations||[]).findIndex(x=>x.id===c.item.id);if(i>=0)data.investigations[i]=updated;});
    await auditWorkspace(c.scope.id,req.user.id,'investigation_tasks_updated',{investigationId:c.item.id,taskCount:validated.tasks.length});
  }
  res.json({tasks:validated.tasks,summary:validated.summary});
}));
async function appendSharedLedger(data, investigationId, before=[], after=[], actor='') {
  data.ledgers ||= {};const ledger=data.ledgers[investigationId]||[];if(ledger.length>=5000)return;
  const prior=new Map(before.map(e=>[String(e.id),e])),current=new Map(after.map(e=>[String(e.id),e]));const changes=[];
  for(const e of after){const old=prior.get(String(e.id));if(old&&canonicalJson(old)===canonicalJson(e))continue;changes.push({evidence:e,action:old?'UPDATED':'ADDED'});}
  for(const e of before)if(!current.has(String(e.id)))changes.push({evidence:e,action:'REMOVED'});
  let head=ledger.at(-1)?.hash||'0'.repeat(64);
  for(const ch of changes){if(ledger.length>=5000)break;const entry=createEvidenceLedgerEntry({investigationId,evidenceId:ch.evidence.id,action:ch.action,at:Date.now(),actor,evidence:ch.evidence},head,ledger.length+1);ledger.push(entry);head=entry.hash;}
  data.ledgers[investigationId]=ledger;
}
const monitorAlertsKey = id => 'investigation_monitor_alerts:'+id;
app.put('/api/investigations/:id/monitoring', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res,'edit');if(!c)return;
  if(!c.scope.personal)return res.status(501).json({error:'Scheduled case monitoring is currently available for personal investigations. Workspace monitoring is being prepared with shared-workspace audit controls.'});
  const enabled=req.body?.enabled===true;
  const cadenceMinutes=[15,30,60,360].includes(Number(req.body?.cadenceMinutes))?Number(req.body.cadenceMinutes):60;
  const searches=(c.item.savedSearches||[]).slice(0,10);
  if(enabled&&!searches.length)return res.status(400).json({error:'Save at least one search to this investigation before enabling monitoring.'});
  const now=Date.now(),monitoring={...(c.item.monitoring||{}),enabled,cadenceMinutes,enabledAt:enabled?(c.item.monitoring?.enabledAt||now):null,nextRunAt:enabled?now:null,lastError:''};
  const updated={...c.item,monitoring,updatedAt:now};
  c.items[c.index]=updated;await store.setUserData(req.user.id,INVESTIGATIONS_KEY,c.items);
  res.set('Cache-Control','no-store');res.json({monitoring});
}));
app.get('/api/investigations/:id/monitor-alerts', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res);if(!c)return;
  const alerts=c.scope.personal?(await store.getUserData(req.user.id,monitorAlertsKey(c.item.id)))||[]:(c.data.monitorAlerts||{})[c.item.id]||[];
  res.set('Cache-Control','no-store');res.json({alerts:alerts.slice(0,500)});
}));
app.patch('/api/investigations/:id/monitor-alerts/:alertId', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res,'edit');if(!c)return;
  const key=monitorAlertsKey(c.item.id);
  if(!c.scope.personal)return res.status(501).json({error:'Workspace alert lifecycle is not yet enabled.'});
  const alerts=(await store.getUserData(req.user.id,key))||[],index=alerts.findIndex(x=>x.id===req.params.alertId);
  if(index<0)return res.status(404).json({error:'Monitoring alert not found.'});
  try{
   if(req.body?.status)alerts[index]=transitionMonitorAlert(alerts[index],String(req.body.status),req.user.id,String(req.body.note||''));
   if(req.body?.feedback)alerts[index]=recordMonitorAlertFeedback(alerts[index],String(req.body.feedback),req.user.id,String(req.body.feedbackNote||''));
   if(req.body?.outcome)alerts[index]=recordMonitorAlertOutcome(alerts[index],String(req.body.outcome),req.user.id,String(req.body.outcomeNote||''));
   if(!req.body?.status&&!req.body?.feedback&&!req.body?.outcome)return res.status(400).json({error:'Provide a status, feedback or outcome value.'});
  }catch(e){return res.status(400).json({error:e.message});}
  await store.setUserData(req.user.id,key,alerts);res.set('Cache-Control','no-store');res.json({alert:alerts[index]});
}));
app.get('/api/investigations/:id/monitor-alert-feedback', requireActive, wrap(async(req,res)=>{
 const c=await caseScope(req,res);if(!c)return;
 const alerts=c.scope.personal?(await store.getUserData(req.user.id,monitorAlertsKey(c.item.id)))||[]:(c.data.monitorAlerts||{})[c.item.id]||[];
 res.set('Cache-Control','no-store');res.json({summary:summariseMonitorAlertFeedback(alerts),alerts:alerts.filter(a=>a.feedback).slice(0,200)});
}));
app.get('/api/investigations/:id', requireActive, wrap(async (req,res)=>{const c=await caseScope(req,res);if(c)res.json({investigation:c.item});}));
app.get('/api/investigations/:id/history', requireActive, wrap(async (req,res)=>{const c=await caseScope(req,res);if(c)res.json({history:c.item.history||[]});}));
app.get('/api/investigations/:id/evidence-ledger', requireActive, wrap(async (req,res)=>{const c=await caseScope(req,res);if(!c)return;const entries=c.scope.personal?(await store.getUserData(req.user.id,evidenceLedgerKey(c.item.id)))||[]:(c.data.ledgers||{})[c.item.id]||[];res.set('Cache-Control','no-store');res.json({entries,verification:verifyEvidenceLedger(entries),caveat:'Application-level hash chain only. It is not WORM storage or independent timestamping.'});}));
app.get('/api/investigations/:id/evidence-ledger/verify', requireActive, wrap(async (req,res)=>{const c=await caseScope(req,res);if(!c)return;const entries=c.scope.personal?(await store.getUserData(req.user.id,evidenceLedgerKey(c.item.id)))||[]:(c.data.ledgers||{})[c.item.id]||[];res.set('Cache-Control','no-store');res.json({verification:verifyEvidenceLedger(entries)});}));
app.get('/api/investigations/:id/fusion', requireActive, wrap(async (req,res)=>{const c=await caseScope(req,res);if(!c)return;res.set('Cache-Control','no-store');res.json({entities:c.item.entities||[],relationships:c.item.relationships||[],entityCandidates:extractEntityCandidates(c.item),note:'Automatically extracted identifiers are unresolved candidates. Confirm identity and relationships using independent evidence.'});}));
app.get('/api/investigations/:id/graph', requireActive, wrap(async(req,res)=>{const c=await caseScope(req,res);if(!c)return;const graph=buildInvestigationGraph(c.item,{maxNodes:1200,maxEdges:3000});res.set('Cache-Control','no-store');res.json({investigationId:c.item.id,...graph});}));
app.get('/api/investigations/:id/stix', requireActive, wrap(async (req,res)=>{const c=await caseScope(req,res);if(!c)return;const bundle=buildStixBundle(c.item);if(!bundle.objects.length)return res.status(422).json({error:'No domain or IPv4 observables were found for a STIX export.'});res.set('Cache-Control','no-store');res.set('Content-Type','application/stix+json; charset=utf-8');res.set('Content-Disposition',`attachment; filename="calibrex-${c.item.id}-stix21.json"`);res.json(bundle);}));
app.put('/api/investigations/:id', requireActive, wrap(async (req,res)=>{
  const c=await caseScope(req,res,'edit');if(!c)return;
  let updated=null, failure=null;
  if(c.scope.personal){
    let clean;try{clean=validateInvestigation({...c.item,...(req.body||{})});}catch(e){return res.status(400).json({error:e.message});}
    const now=Date.now(),{history:priorHistory=[],...priorSnapshot}=c.item;
    const revision={revision:(c.item.revision||1)+1,at:now,by:req.user.id,title:c.item.title,status:c.item.status,priority:c.item.priority,evidenceCount:(c.item.evidence||[]).length,notesCount:(c.item.notes||[]).length,snapshot:priorSnapshot};
    updated={...c.item,...clean,revision:revision.revision,history:[...priorHistory,revision].slice(-100),updatedAt:now};
    c.items[c.index]=updated;await store.setUserData(req.user.id,INVESTIGATIONS_KEY,c.items);await appendEvidenceLedger(req.user.id,c.item.id,c.item.evidence,clean.evidence,req.user.id);
  } else {
    await updateWorkspaceData(c.scope.id,async data=>{
      const index=(data.investigations||[]).findIndex(x=>x.id===req.params.id);
      if(index<0){failure='not_found';return;}
      const current=data.investigations[index];let clean;
      try{clean=validateInvestigation({...current,...(req.body||{})});}catch(e){failure=e.message;return;}
      const now=Date.now(),{history:priorHistory=[],...priorSnapshot}=current;
      const revision={revision:(current.revision||1)+1,at:now,by:req.user.id,title:current.title,status:current.status,priority:current.priority,evidenceCount:(current.evidence||[]).length,notesCount:(current.notes||[]).length,snapshot:priorSnapshot};
      updated={...current,...clean,revision:revision.revision,history:[...priorHistory,revision].slice(-100),updatedAt:now};
      data.investigations[index]=updated;await appendSharedLedger(data,current.id,current.evidence,clean.evidence,req.user.id);
    });
    if(failure==='not_found')return res.status(404).json({error:'Investigation not found.'});
    if(failure)return res.status(400).json({error:failure});
    await auditWorkspace(c.scope.id,req.user.id,'investigation_updated',{investigationId:updated.id,revision:updated.revision});
  }
  res.json({investigation:updated});
}));
app.get('/api/investigations/:id/validation', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res);if(!c)return;
  const evidence=Array.isArray(c.item.evidence)?c.item.evidence.slice(0,300):[];
  const assessed=evidence.map(e=>{
    const source=assessSourceReliability(e,[]);
    const hasCoordinates=e.lat!==undefined||e.lon!==undefined||e.lng!==undefined;
    const geo=hasCoordinates?validateCoordinates(e):null;
    return {evidenceId:e.id,title:e.title||'Untitled evidence',assessment:e.assessment||'UNKNOWN',
      source:{score:source.score,band:source.band,host:source.host,historyConfidence:source.historyConfidence,factors:source.factors,caveats:source.caveats},
      geospatial:geo,geospatialContext:e.geospatialContext||null};
  });
  const independence=assessSourceIndependence(evidence);
  const locationClaims=evidence.filter(e=>e.lat!==undefined||e.lon!==undefined||e.lng!==undefined)
    .map(e=>({id:e.id,lat:e.lat,lon:e.lon??e.lng,accuracyMeters:e.accuracyMeters,claimedCountry:e.claimedCountry,resolvedCountry:e.resolvedCountry}));
  const locationComparison=compareLocationClaims(locationClaims);
  res.set('Cache-Control','no-store');
  res.json({investigationId:c.item.id,caseRevision:c.item.revision||1,assessedAt:new Date().toISOString(),
    evidence:assessed,sourceIndependence:independence,locationComparison,
    summary:{evidenceCount:evidence.length,sourceCount:assessed.length,geospatialCount:assessed.filter(x=>x.geospatial).length,
      invalidCoordinates:assessed.filter(x=>x.geospatial&&!x.geospatial.valid).length,
      geospatialWarnings:assessed.filter(x=>x.geospatial&&x.geospatial.warnings.length).length}});
}));
app.post('/api/investigations/:id/reports/generate', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res,'edit');if(!c)return;
  const versions=c.item.reportVersions||[];
  if(versions.length>=200)return res.status(409).json({error:'Report version limit reached (200).'});
  const ledgerEntries=c.scope.personal?(await store.getUserData(req.user.id,evidenceLedgerKey(c.item.id)))||[]:(c.data.ledgers||{})[c.item.id]||[];
  const generated=buildInvestigationReport(c.item,{title:req.body?.title,ledgerHead:ledgerEntries.at(-1)?.hash||null});
  let version;
  try{version=createReportVersion({input:{title:generated.title,content:generated.markdown},versions,actor:req.user.id});}
  catch(e){return res.status(400).json({error:e.message});}
  version={...version,reportType:'INVESTIGATION_INTELLIGENCE',format:'markdown',caseRevision:generated.caseRevision,
    evidenceLedgerHead:ledgerEntries.at(-1)?.hash||null,quality:generated.quality,generatedAt:generated.generatedAt};
  const updated={...c.item,reportVersions:[...versions,version],updatedAt:Date.now()};
  if(c.scope.personal){c.items[c.index]=updated;await store.setUserData(req.user.id,INVESTIGATIONS_KEY,c.items);}
  else{
    await updateWorkspaceData(c.scope.id,data=>{const i=(data.investigations||[]).findIndex(x=>x.id===c.item.id);if(i>=0)data.investigations[i]={...data.investigations[i],reportVersions:[...(data.investigations[i].reportVersions||[]),version],updatedAt:Date.now()};});
    await auditWorkspace(c.scope.id,req.user.id,'investigation_report_generated',{investigationId:c.item.id,reportId:version.id,version:version.version});
  }
  res.status(201).json({report:version,quality:generated.quality});
}));
app.get('/api/investigations/:id/reports', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res);if(!c)return;
  const reports=(c.item.reportVersions||[]).map(({content,...meta})=>({...meta,contentLength:content?.length||0}));
  res.set('Cache-Control','no-store');res.json({reports});
}));
app.get('/api/investigations/:id/reports/:reportId/export.txt', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res);if(!c)return;
  const report=(c.item.reportVersions||[]).find(x=>x.id===req.params.reportId);
  if(!report)return res.status(404).json({error:'Report version not found.'});
  const plain=String(report.content||'').replace(/^#{1,6}\s/gm,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/\[(E-[A-Za-z0-9_-]+)\]/g,'$1');
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename="calibrex-investigation-${c.item.id}-v${report.version}.txt"`);
  res.send(plain);
}));
app.get('/api/investigations/:id/reports/:reportId/export.pdf', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res);if(!c)return;
  const report=(c.item.reportVersions||[]).find(x=>x.id===req.params.reportId);
  if(!report)return res.status(404).json({error:'Report version not found.'});
  if(report.status!=='APPROVED')return res.status(409).json({error:'Only an approved, immutable report version can be exported as PDF.'});
  const pdf=renderInvestigationPdf({title:report.title,content:report.content,caseId:c.item.id,version:report.version,generatedAt:report.approvedAt||report.createdAt});
  const filename='calibrex-investigation-'+String(c.item.id).replace(/[^A-Za-z0-9_-]/g,'_')+'-v'+report.version+'.pdf';
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Length',pdf.length);
  res.setHeader('Content-Disposition','attachment; filename="'+filename+'"');
  res.setHeader('Cache-Control','no-store');
  res.send(pdf);
}));
app.get('/api/investigations/:id/reports/:reportId', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res);if(!c)return;
  const report=(c.item.reportVersions||[]).find(x=>x.id===req.params.reportId);
  if(!report)return res.status(404).json({error:'Report version not found.'});
  res.set('Cache-Control','no-store');res.json({report});
}));
app.post('/api/investigations/:id/reports', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res,'edit');if(!c)return;
  const versions=c.item.reportVersions||[];
  if(versions.length>=200)return res.status(409).json({error:'Report version limit reached (200). Archive this investigation before creating more versions.'});
  let version;try{version=createReportVersion({input:req.body||{},versions,actor:req.user.id});}catch(e){return res.status(400).json({error:e.message});}
  const updated={...c.item,reportVersions:[...versions,version],updatedAt:Date.now()};
  if(c.scope.personal){c.items[c.index]=updated;await store.setUserData(req.user.id,INVESTIGATIONS_KEY,c.items);}
  else{
    await updateWorkspaceData(c.scope.id,data=>{const i=(data.investigations||[]).findIndex(x=>x.id===c.item.id);if(i>=0)data.investigations[i]={...data.investigations[i],reportVersions:[...(data.investigations[i].reportVersions||[]),version],updatedAt:Date.now()};});
    await auditWorkspace(c.scope.id,req.user.id,'investigation_report_version_saved',{investigationId:c.item.id,reportId:version.id,version:version.version});
  }
  res.status(201).json({report:version});
}));
app.patch('/api/investigations/:id/reports/:reportId', requireActive, wrap(async(req,res)=>{
  const c=await caseScope(req,res,'edit');if(!c)return;
  const versions=c.item.reportVersions||[],index=versions.findIndex(x=>x.id===req.params.reportId);
  if(index<0)return res.status(404).json({error:'Report version not found.'});
  let changed;try{changed=transitionReportVersion(versions[index],req.body?.status,req.user.id);}catch(e){return res.status(400).json({error:e.message});}
  const next=[...versions];next[index]=changed;
  if(c.scope.personal){c.items[c.index]={...c.item,reportVersions:next,updatedAt:Date.now()};await store.setUserData(req.user.id,INVESTIGATIONS_KEY,c.items);}
  else{
    await updateWorkspaceData(c.scope.id,data=>{const i=(data.investigations||[]).findIndex(x=>x.id===c.item.id);if(i>=0)data.investigations[i]={...data.investigations[i],reportVersions:next,updatedAt:Date.now()};});
    await auditWorkspace(c.scope.id,req.user.id,'investigation_report_status_changed',{investigationId:c.item.id,reportId:changed.id,status:changed.status});
  }
  res.json({report:changed});
}));
app.delete('/api/investigations/:id', requireActive, wrap(async (req,res)=>{
  const c=await caseScope(req,res,'edit');if(!c)return;
  if(c.scope.personal){c.items.splice(c.index,1);await store.setUserData(req.user.id,INVESTIGATIONS_KEY,c.items);}
  else {
    let removed=false;
    await updateWorkspaceData(c.scope.id,data=>{const before=(data.investigations||[]).length;data.investigations=(data.investigations||[]).filter(x=>x.id!==req.params.id);removed=data.investigations.length!==before;});
    if(!removed)return res.status(404).json({error:'Investigation not found.'});
    await auditWorkspace(c.scope.id,req.user.id,'investigation_deleted',{investigationId:req.params.id});
  }
  res.json({ok:true});
}));

// Library: search/filter across the current ingest window.
app.get('/api/library', requireActive, (req, res) => {
  const wires = String(req.query.wires || '').split(',').map(s => s.trim()).filter(Boolean);
  const out = searchLibrary(snapshot().items, {
    q: String(req.query.q || '').slice(0, 200),
    wires,
    minSeverity: String(req.query.minSeverity || 'LOW'),
    source: String(req.query.source || '').slice(0, 80),
    from: Number(req.query.from) || 0,
    to: Number(req.query.to) || 0,
    limit: Number(req.query.limit) || 300,
  });
  res.json({ ...out, updatedAt: snapshot().updatedAt });
});

// External alert delivery (Telegram / webhook + geofences).
app.get('/api/alert-delivery', requireActive, wrap(async (req, res) => {
  res.json({ delivery: redactDelivery(await store.getUserData(req.user.id, 'alert_delivery')) });
}));
app.put('/api/alert-delivery', requireActive, wrap(async (req, res) => {
  // Merge: the client never sees the stored token, so keep it unless a new one is supplied.
  const existing = cleanDelivery(await store.getUserData(req.user.id, 'alert_delivery'));
  const incoming = req.body && typeof req.body === 'object' ? req.body : {};
  if (incoming.telegram && !String(incoming.telegram.botToken || '').trim() && existing.telegram) {
    incoming.telegram = { ...incoming.telegram, botToken: existing.telegram.botToken };
  }
  const cfg = cleanDelivery(incoming);
  await store.setUserData(req.user.id, 'alert_delivery', cfg);
  res.json({ delivery: redactDelivery(cfg) });
}));
app.post('/api/alert-delivery/test', requireActive, wrap(async (req, res) => {
  const stored = cleanDelivery(await store.getUserData(req.user.id, 'alert_delivery'));
  const incoming = req.body && typeof req.body === 'object' ? req.body : {};
  // Use the stored token if the client sent a masked/blank one.
  if (incoming.telegram && !String(incoming.telegram.botToken || '').trim() && stored.telegram) {
    incoming.telegram = { ...incoming.telegram, botToken: stored.telegram.botToken };
  }
  const cfg = Object.keys(incoming).length ? incoming : stored;
  try { await sendTest(cfg); res.json({ ok: true }); }
  catch (e) { res.status(502).json({ error: `Test delivery failed: ${e.message}` }); }
}));

app.get('/api/health', (req, res) => {
  const snap = snapshot();
  const ageMs = snap.updatedAt ? Date.now() - snap.updatedAt : null;
  res.json({ ok:true, feedsUpdatedAt:snap.updatedAt, feedAgeMs:ageMs, feedStale:ageMs == null || ageMs > 3 * 60 * 1000 });
});
app.get('/api/health/ready', wrap(async (req, res) => {
  const snap = snapshot();
  const ageMs = snap.updatedAt ? Date.now() - snap.updatedAt : null;
  const sources = Object.values(snap.sources || {});
  const database = await store.ping().then(()=>true).catch(()=>false);
  const ready = database && !!snap.updatedAt && ageMs < 10 * 60 * 1000;
  res.status(ready ? 200 : 503).json({
    ready, database:database?'ready':'unavailable',
    feed:{ updatedAt:snap.updatedAt, ageMs, refreshing:snap.refreshing },
    sources:{ total:sources.length, ok:sources.filter(x=>x.ok).length, cached:sources.filter(x=>x.state==='cached').length, failed:sources.filter(x=>x.state==='error').length }
  });
}));
// Commercial operations overview. Request counters are process-local diagnostics,
// not billable usage metering; never use them as invoice quantities.
app.get('/api/admin/commercial/overview', requireAdmin, wrap(async (req, res) => {
  const users = await store.listUsers();
  const requests = (await store.getSetting('feature_requests')) || [];
  const now = Date.now();
  const summary = summariseCommercialAccounts(users, requests, now);
  const telemetry = opsSnapshot();
  res.set('Cache-Control', 'no-store');
  res.json({
    sampledAt: now,
    ...summary,
    pricing: await groupPrices(),
    platform: { processUptimeSeconds: Math.floor(process.uptime()), requests: telemetry.totals, inFlight: telemetry.inFlight },
    limitations: ['Request counters are process-local and reset on restart.', 'This endpoint does not measure AI tokens, ingestion volume, storage, seats or billable usage.', 'Do not use these diagnostics to calculate invoices or claim an SLA.']
  });
}));

app.get('/api/admin/ops/health', requireAdmin, wrap(async (req,res) => {
  const snap=snapshot();
  const ageMs=snap.updatedAt ? Date.now()-snap.updatedAt : null;
  let sessionsPruned=null;
  try { sessionsPruned=await store.pruneExpiredSessions(); } catch(e) { console.error('[ops] session cleanup failed',e.message); }
  res.json({
    sampledAt:Date.now(), uptimeSeconds:Math.floor(process.uptime()), node:process.version,
    database:await store.ping().then(()=> 'ready').catch(()=> 'unavailable'),
    feed:{ updatedAt:snap.updatedAt, ageMs, stale:ageMs==null||ageMs>3*60*1000, refreshing:snap.refreshing },
    sources:Object.entries(snap.sources||{}).map(([id,v])=>({id,...v,lastSuccessAgeMs:v.lastSuccessAt?Date.now()-v.lastSuccessAt:null})),
    requests:opsSnapshot(), sessionsPruned,
    polling:{directRefreshMs:Math.max(60000,Number(process.env.DIRECT_REFRESH_MS)||60000), enrichmentRefreshMs:300000}
  });
}));

// OAuth discovery endpoints are rooted at the canonical issuer. The protected
// resource itself remains /api/mcp, and OAuth callbacks remain under /api/oauth.
const mcpIssuer = () => String(process.env.MCP_PUBLIC_URL || process.env.PUBLIC_URL || 'https://app.calibrex.org').replace(/\/$/, '');
const mcpScopes = ['intelligence:read', 'cases:read', 'cases:write'];
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  if (process.env.MCP_ENABLED !== 'true') return res.status(404).end();
  const issuer = mcpIssuer();
  res.set('Cache-Control', 'no-store').json({
    issuer,
    authorization_endpoint: issuer + '/api/oauth/authorize',
    token_endpoint: issuer + '/api/oauth/token',
    registration_endpoint: issuer + '/api/oauth/register',
    revocation_endpoint: issuer + '/api/oauth/revoke',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: mcpScopes,
  });
});
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  if (process.env.MCP_ENABLED !== 'true') return res.status(404).end();
  const issuer = mcpIssuer();
  res.set('Cache-Control', 'no-store').json({
    resource: issuer + '/api/mcp',
    authorization_servers: [issuer],
    scopes_supported: mcpScopes,
    bearer_methods_supported: ['header'],
  });
});
app.use('/api', createMcpRouter({
  store, searchNews, corroborate, readArticle, snapshot, marketsSnapshot, crisisSnapshot, signalsSnapshot, geointSnapshot, conflictSnapshot, maritimeSnapshot, sanctionsSnapshot, screenSanctions, macroSnapshot, instabilitySnapshot, correlationSnapshot, newId, getInvestigations,
  setInvestigations: (uid, items) => store.setUserData(uid, INVESTIGATIONS_KEY, items),
  getWorkspaces, getWorkspaceData, updateWorkspaceData, auditWorkspace, appendEvidenceLedger
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------------------------------------------------------------- web client

const DIST = path.resolve(__dirname, '../dist');
if (fs.existsSync(DIST)) {
  // The service worker must not be HTTP-cached, so updates ship on each deploy.
  app.get('/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.type('application/javascript'); res.sendFile(path.join(DIST, 'sw.js')); });
  app.get('/manifest.webmanifest', (req, res) => { res.type('application/manifest+json'); res.sendFile(path.join(DIST, 'manifest.webmanifest')); });
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
});

// ---------------------------------------------------------------- start

async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email) { console.warn('[auth] ADMIN_EMAIL is not set; no administrator account will be created.'); return; }
  const existing = await store.findUserByEmail(email);
  if (existing) {
    const patch = { role: 'admin', status: 'active' };
    const resetPassword = process.env.ADMIN_PASSWORD_RESET === 'true' && password.length >= 8;
    if (resetPassword) patch.password_hash = await bcrypt.hash(password, 10);
    await store.updateUser(existing.id, patch);
    if (resetPassword) await store.setUserData(existing.id, 'sessions_revoked_before', Date.now());
    return;
  }
  if (password.length < 8) { console.warn('[auth] ADMIN_PASSWORD must be at least 8 characters; administrator not created.'); return; }
  await store.createUser({
    id: newId(), email, name: process.env.ADMIN_NAME || 'Administrator', org: 'Calibrex Intel',
    password_hash: await bcrypt.hash(password, 10), role: 'admin', status: 'active', created_at: Date.now(), last_seen: null, visits: 0,
  });
  console.log(`[auth] Administrator account created for ${email}`);
}

await store.ready;
await store.pruneExpiredSessions().catch(e => console.error('[auth] session cleanup failed', e.message));
setInterval(() => store.pruneExpiredSessions().catch(e => console.error('[auth] session cleanup failed', e.message)), 6 * 60 * 60 * 1000).unref();
await bootstrapAdmin();
await ensureVapid(store).catch(e => console.error('[push] VAPID init failed', e.message));
notifyDeploy(store).catch(e => console.error('[push] deploy notice failed', e.message));
setCustomFeeds(cleanFeeds(await store.getSetting('custom_feeds')));
setDisabledSources((await store.getSetting('disabled_sources')) || []);
onRefresh(items => enrichTopItems(items));
onRefresh(items => runWatchlists(store, items));
onRefresh(items => updateTrends(store, items));
async function runIntelligenceRuleAlerts(items) {
  const users=await store.listUsers();
  for(const user of users){
    if(user.status!=='active'&&user.role!=='admin')continue;
    try{
      const rules=await getAlertRules(user.id);
      if(!rules.length)continue;
      const previews=evaluateAlertRules(rules,items);
      const seen=new Set((await store.getUserData(user.id,'intelligence_rule_alert_seen'))||[]);
      const notifications=(await store.getUserData(user.id,'notifications'))||[];
      const outgoing=[];
      for(const preview of previews){
        for(const item of preview.matches||[]){
          const key=`${preview.ruleId}:${item.id}`;
          if(!item.id||seen.has(key))continue;
          seen.add(key);
          const notification={id:newId(),title:`Alert rule: ${preview.ruleName}`,
            body:String(item.title||'New intelligence match').slice(0,220),url:item.url||'/',
            tag:'intelligence-rule',createdAt:Date.now(),read:false,
            severity:item.severity||'LOW',source:item.source||'',ruleId:preview.ruleId};
          notifications.unshift(notification);
          outgoing.push(notification);
          if(outgoing.length>=10)break;
        }
        if(outgoing.length>=10)break;
      }
      if(outgoing.length){
        await store.setUserData(user.id,'notifications',notifications.slice(0,200));
        await pushToUser(store,user,{title:outgoing.length===1?outgoing[0].title:`${outgoing.length} intelligence rule matches`,
          body:outgoing.slice(0,3).map(x=>x.body).join(' · '),url:outgoing[0].url,tag:'intelligence-rule'});
      }
      await store.setUserData(user.id,'intelligence_rule_alert_seen',[...seen].slice(-5000));
    }catch(e){console.error('[intelligence-rules] delivery failed',user.id,e.message);}
  }
}

onRefresh(items => runDelivery(store, items));
onRefresh(items => runIntelligenceRuleAlerts(items));
onRefresh(items => pushCriticalAlerts(store, items));
onRefresh(items => pushBusinessAlerts(store, items));
onRefresh(items => pushGovAlerts(store, items));
onRefresh(items => pushPoliticsAlerts(store, items));
onRefresh(() => sampleRisk(store));
onRefresh(() => { const s = sampleInstability(); store.setSetting('instability_history', dumpInstabilityHistory()).catch(() => {}); return s; });
onRefresh(() => sampleCorrelations());   // after instability, so its scores are fresh
// Restart persistence: reload the last feed snapshot on boot so a redeploy or
// crash never shows an empty app while the first refresh is still in flight,
// and re-save it after every refresh.
onRefresh(() => { store.setSetting('feed_snapshot', exportState()).catch(() => {}); });
onMarketsRefresh((snap, series) => { const events = refreshCrisis(snap, series); deliverCrisis(store, events); });
onSignalsRefresh(aircraft => runAircraftWatches(store, aircraft));
for (const p of FEED_PROVIDERS) registerProvider(p);
try { seedState(await store.getSetting('feed_snapshot')); } catch (e) { console.error('[feeds] seed failed', e.message); }
try { loadInstabilityHistory(await store.getSetting('instability_history')); } catch (e) { console.error('[instability] history load failed', e.message); }
if (process.env.DISABLE_FEEDS !== 'true') startFeedLoop();
if (process.env.DISABLE_MARKETS !== 'true') startMarketsLoop();
if (process.env.DISABLE_SIGNALS !== 'true') startSignalsLoop();
if (process.env.DISABLE_FEEDS !== 'true') startAisLoop();   // live AIS (no-op unless AISSTREAM_KEY set)
if (process.env.DISABLE_FEEDS !== 'true') startMacroLoop();
if (process.env.DISABLE_FEEDS !== 'true') startDailyBriefLoop(store);
if (process.env.DISABLE_GEOINT !== 'true') startGeointLoop();
if (process.env.DISABLE_CONFLICT !== 'true') startConflictLoop();
if (process.env.DISABLE_MARITIME !== 'true') startMaritimeLoop();
if (process.env.DISABLE_SANCTIONS !== 'true') startSanctionsLoop();
if (process.env.DISABLE_ENTITYWATCH !== 'true') startEntityWatchLoop(store);
async function runInvestigationMonitoring(){
 if(process.env.DISABLE_INVESTIGATION_MONITOR==='true')return;
 const users=await store.listUsers(),now=Date.now();
 for(const user of users){
  if(user.status!=='active'&&user.role!=='admin')continue;
  try{
   const cases=await getInvestigations(user.id);
   for(let index=0;index<cases.length;index++){
    const item=cases[index],m=item.monitoring||{};
    if(m.enabled!==true||Number(m.nextRunAt||0)>now)continue;
    const searches=(item.savedSearches||[]).slice(0,10);
    if(!searches.length)continue;
    const incoming=[];
    for(const search of searches){
     try{
      const hits=await searchNews(search.query,search.window);
      for(const hit of (hits||[]).slice(0,30)){
       const url=String(hit.url||'');if(!url)continue;
       const id=crypto.createHash('sha256').update(url.split('#')[0]).digest('hex');
       incoming.push({id,searchId:search.id,title:hit.title,url,source:hit.source,published:hit.published,matchedQuery:search.query,rationale:'Matched a saved case search. This is a collection lead, not a verified finding.'});
      }
     }catch(e){console.warn('[case-monitor] search failed',user.id,item.id,search.id,e.message);}
    }
    const key=monitorAlertsKey(item.id),old=(await store.getUserData(user.id,key))||[];
    const merged=mergeMonitorAlerts(old,incoming,now);
    if(merged.created){
     await store.setUserData(user.id,key,merged.alerts);
     const fresh=merged.alerts.filter(a=>a.firstSeenAt===now).slice(0,5);
     await pushToUser(store,user,{title:merged.created===1?'New case intelligence lead':merged.created+' new case intelligence leads',body:fresh[0]?.title||item.title,url:'/investigations',tag:'case-monitor-'+item.id});
    }else if(incoming.length)await store.setUserData(user.id,key,merged.alerts);
    cases[index]={...item,monitoring:{...m,lastRunAt:now,nextRunAt:now+Number(m.cadenceMinutes||60)*60000,lastError:''},updatedAt:now};
   }
   await store.setUserData(user.id,INVESTIGATIONS_KEY,cases);
  }catch(e){console.error('[case-monitor] user run failed',user.id,e.message);}
 }
}
async function captureSpecialistFeedsForMonitoredUsers(){
 if(process.env.DISABLE_SPECIALIST_MONITOR==='true')return;
 const users=await store.listUsers(),items=snapshot().items||[];
 for(const user of users){
  if(user.status!=='active'&&user.role!=='admin')continue;
  for(const role of specialistRoleKeys){
   try{
    const key=specialistWorkspaceKey(role),ws=(await store.getUserData(user.id,key))||{};
    if(ws.monitorEnabled!==true)continue;
    const ingested=ingestSpecialistFeedSnapshot({role,feedItems:filterSpecialistFeedItems(role,items),focus:ws.subject?.name||'',identifier:ws.subject?.identifier||'',country:ws.subject?.country||'IND'});
    if(!ingested.observations.length)continue;
    const merged=mergeSpecialistWorkspace(ws,ingested);
    merged.monitorEnabled=true;
    await store.setUserData(user.id,key,merged);
   }catch(e){console.warn('[specialist-monitor]',user.id,role,e.message);}
  }
 }
}
setInterval(()=>captureSpecialistFeedsForMonitoredUsers().catch(e=>console.error('[specialist-monitor]',e.message)),10*60*1000).unref();
setInterval(()=>runInvestigationMonitoring().catch(e=>console.error('[case-monitor]',e.message)),60*1000).unref();
setTimeout(()=>runInvestigationMonitoring().catch(e=>console.error('[case-monitor]',e.message)),120*1000).unref();
setTimeout(()=>captureSpecialistFeedsForMonitoredUsers().catch(e=>console.error('[specialist-monitor]',e.message)),90*1000).unref();

app.listen(PORT, () => console.log(`Calibrex OSINT Studio listening on :${PORT}`));

export default app;
