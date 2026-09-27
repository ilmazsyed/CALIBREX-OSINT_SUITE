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
import { startFeedLoop, snapshot, refresh, searchNews, corroborate } from './feeds.js';

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
if (process.env.DISABLE_FEEDS !== 'true') startFeedLoop();
app.listen(PORT, () => console.log(`Calibrex OSINT Studio listening on :${PORT}`));

export default app;
