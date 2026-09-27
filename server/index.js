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
import { startFeedLoop, snapshot, refresh, searchNews, corroborate, onRefresh, setCustomFeeds, testFeed, WIRE_KEYS } from './feeds.js';
import { PROVIDERS, encrypt, openKey, startOpenRouter, finishOpenRouter, listModels, defaultModel, runTask, friendlyAiError } from './ai.js';
import { cleanWatchlist, runWatchlists, runWatchlistFor, updateTrends, emailConfigured, MAX_TERMS } from './watch.js';

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
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});

// ---------------------------------------------------------------- sessions

const sign = v => crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url');
function issueSession(res, userId) {
  const payload = `${userId}.${Date.now()}`;
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: PROD, sameSite: 'lax', maxAge: SESSION_DAYS * 86400000, path: '/',
  });
}
function readSession(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const parts = decodeURIComponent(raw).split('.');
  if (parts.length !== 3) return null;
  const [id, issued, mac] = parts;
  const expected = sign(`${id}.${issued}`);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  if (Date.now() - Number(issued) > SESSION_DAYS * 86400000) return null;
  return id;
}

const publicUser = u => u && ({ id: u.id, email: u.email, name: u.name, org: u.org, role: u.role, status: u.status, createdAt: u.created_at, lastSeen: u.last_seen, visits: u.visits });
const lastSeenWrites = new Map();

async function loadUser(req, res, next) {
  const id = readSession(req);
  if (id) {
    const u = await store.findUserById(id);
    if (u) {
      req.user = u;
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

// Login / signup rate limit: 15 attempts per IP per 15 minutes.
const attempts = new Map();
function rateLimited(req) {
  const key = req.ip;
  const now = Date.now();
  const list = (attempts.get(key) || []).filter(t => now - t < 15 * 60000);
  list.push(now);
  attempts.set(key, list);
  return list.length > 15;
}

// ---------------------------------------------------------------- auth

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/signup', wrap(async (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim().slice(0, 80);
  const org = String(req.body.org || '').trim().slice(0, 120);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
  if (!name) return res.status(400).json({ error: 'Enter your operator name.' });
  if (await store.findUserByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
  const user = {
    id: newId(), email, name, org,
    password_hash: await bcrypt.hash(password, 10),
    role: 'user', status: 'pending', created_at: Date.now(), last_seen: Date.now(), visits: 1,
  };
  await store.createUser(user);
  issueSession(res, user.id);
  res.status(201).json({ user: publicUser(user), contact: await providerContact() });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await store.findUserByEmail(email);
  const ok = user && await bcrypt.compare(String(req.body.password || ''), user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' });
  await store.updateUser(user.id, { visits: (user.visits || 0) + 1, last_seen: Date.now() });
  issueSession(res, user.id);
  res.json({ user: publicUser({ ...user, visits: (user.visits || 0) + 1 }), contact: await providerContact() });
}));

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', wrap(async (req, res) => {
  if (!req.user) return res.json({ user: null, contact: '' });
  res.json({ user: publicUser(req.user), contact: await providerContact() });
}));

app.post('/api/auth/password', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue.' });
  const current = String(req.body.current || '');
  const next = String(req.body.next || '');
  if (!await bcrypt.compare(current, req.user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (next.length < 8) return res.status(400).json({ error: 'Use a new password of at least 8 characters.' });
  await store.updateUser(req.user.id, { password_hash: await bcrypt.hash(next, 10) });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- live intel

app.get('/api/intel', requireActive, (req, res) => {
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

// ---------------------------------------------------------------- per-user data

const DATA_KEYS = new Set(['history', 'research_log', 'settings', 'dismissed_alerts']);
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
  try {
    const text = await runTask(conn, task, req.body.input || {});
    res.json({ text, model: conn.model, provider: conn.provider, generatedAt: Date.now() });
  } catch (e) {
    if (e.message === 'Unknown AI task.') return res.status(400).json({ error: e.message });
    console.error('[ai]', conn.provider, e.status || '', e.message);
    res.status(502).json({ error: friendlyAiError(e) });
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
  res.json({ users: (await store.listUsers()).map(publicUser) });
}));

app.patch('/api/admin/users/:id', requireAdmin, wrap(async (req, res) => {
  const target = await store.findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const patch = {};
  if (req.body.status !== undefined) {
    if (!['pending', 'active', 'suspended'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own status.' });
    patch.status = req.body.status;
  }
  if (req.body.role !== undefined) {
    if (!['user', 'admin'].includes(req.body.role)) return res.status(400).json({ error: 'Invalid role.' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role.' });
    patch.role = req.body.role;
  }
  if (typeof req.body.name === 'string') patch.name = req.body.name.trim().slice(0, 80);
  if (typeof req.body.org === 'string') patch.org = req.body.org.trim().slice(0, 120);
  await store.updateUser(target.id, patch);
  res.json({ user: publicUser({ ...target, ...patch }) });
}));

app.post('/api/admin/users/:id/password', requireAdmin, wrap(async (req, res) => {
  const target = await store.findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const password = String(req.body.password || '');
  if (password.length < 8) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
  await store.updateUser(target.id, { password_hash: await bcrypt.hash(password, 10) });
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

function cleanFeeds(list) {
  return (Array.isArray(list) ? list : []).slice(0, 30).map(f => ({
    id: String(f.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 16) || newId().slice(0, 8),
    name: String(f.name || '').trim().slice(0, 60),
    url: String(f.url || '').trim().slice(0, 500),
    wire: WIRE_KEYS.includes(f.wire) ? f.wire : 'auto',
  })).filter(f => f.name && /^https?:\/\//i.test(f.url));
}
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
  const url = String(req.body.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Enter a feed address starting with http:// or https://' });
  try { res.json(await testFeed(url, String(req.body.wire || 'auto'))); }
  catch (e) { res.status(400).json({ error: `Could not read that feed (${e.message}). Check the address points to an RSS or Atom feed.` }); }
}));

app.get('/api/admin/sources', requireAdmin, (req, res) => {
  const s = snapshot();
  res.json({ updatedAt: s.updatedAt, sources: s.sources });
});

app.get('/api/health', (req, res) => res.json({ ok: true, feedsUpdatedAt: snapshot().updatedAt }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------------------------------------------------------------- web client

const DIST = path.resolve(__dirname, '../dist');
if (fs.existsSync(DIST)) {
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
    if (process.env.ADMIN_PASSWORD_RESET === 'true' && password.length >= 8) patch.password_hash = await bcrypt.hash(password, 10);
    await store.updateUser(existing.id, patch);
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
await bootstrapAdmin();
setCustomFeeds(cleanFeeds(await store.getSetting('custom_feeds')));
onRefresh(items => runWatchlists(store, items));
onRefresh(items => updateTrends(store, items));
if (process.env.DISABLE_FEEDS !== 'true') startFeedLoop();
app.listen(PORT, () => console.log(`Calibrex OSINT Studio listening on :${PORT}`));

export default app;
