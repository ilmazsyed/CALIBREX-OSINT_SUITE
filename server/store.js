// Persistence: PostgreSQL when DATABASE_URL is set (Render), otherwise a JSON
// file in ./data for local development.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const USER_FIELDS = ['id', 'email', 'name', 'org', 'password_hash', 'role', 'status', 'created_at', 'last_seen', 'visits', 'tier', 'trial_ends_at'];

export function postgresSslConfig(url, env = process.env) {
  // Local development can use a local PostgreSQL instance without TLS.
  let host = '';
  try { host = new URL(String(url)).hostname.replace(/^\[|\]$/g, '').toLowerCase(); } catch { /* invalid URLs remain TLS-verified */ }
  if (host === 'localhost' || host === '::1' || /^127\./.test(host)) return false;
  // Never disable certificate verification for a remote database. If the
  // provider uses a private CA, mount its PEM file and set PGSSLROOTCERT.
  const ssl = { rejectUnauthorized: true };
  if (env.PGSSLROOTCERT) ssl.ca = fs.readFileSync(env.PGSSLROOTCERT, 'utf8');
  return ssl;
}

function pgStore(url) {
  let pool;
  const ready = (async () => {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: url, ssl: postgresSslConfig(url) });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        org TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at BIGINT NOT NULL,
        last_seen BIGINT,
        visits INTEGER NOT NULL DEFAULT 0,
        tier TEXT,
        trial_ends_at BIGINT
      );
      -- Add licensing columns to databases created before tiers existed.
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at BIGINT;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
      CREATE TABLE IF NOT EXISTS user_data (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value JSONB NOT NULL,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, key)
      );
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY, window_start BIGINT NOT NULL, hits INTEGER NOT NULL, updated_at BIGINT NOT NULL
      );`);
  })();
  const q = async (sql, params) => { await ready; return pool.query(sql, params); };
  const row = r => r && ({ ...r, created_at: Number(r.created_at), last_seen: r.last_seen == null ? null : Number(r.last_seen), trial_ends_at: r.trial_ends_at == null ? null : Number(r.trial_ends_at) });
  return {
    ready,
    async ping() { await q('SELECT 1'); return true; },
    async findUserByEmail(email) { return row((await q('SELECT * FROM users WHERE email = $1', [email])).rows[0]); },
    async findUserById(id) { return row((await q('SELECT * FROM users WHERE id = $1', [id])).rows[0]); },
    async listUsers() { return (await q('SELECT * FROM users ORDER BY created_at DESC')).rows.map(row); },
    async createUser(u) {
      await q(`INSERT INTO users (${USER_FIELDS.join(',')}) VALUES (${USER_FIELDS.map((_, i) => '$' + (i + 1)).join(',')})`, USER_FIELDS.map(f => u[f]));
      return u;
    },
    async updateUser(id, patch) {
      const keys = Object.keys(patch).filter(k => USER_FIELDS.includes(k) && k !== 'id');
      if (!keys.length) return;
      await q(`UPDATE users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...keys.map(k => patch[k])]);
    },
    async deleteUser(id) { await q('DELETE FROM users WHERE id = $1', [id]); },
    async getSetting(key) { return (await q('SELECT value FROM settings WHERE key = $1', [key])).rows[0]?.value ?? null; },
    async setSetting(key, value) { await q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, JSON.stringify(value)]); },
    // Atomic read-modify-write for shared JSON settings. The row lock prevents
    // lost updates across application instances; callback must be side-effect free.
    async updateSetting(key, updater, fallback = null) {
      await ready;
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, JSON.stringify(fallback)]);
        const selected = await c.query('SELECT value FROM settings WHERE key = $1 FOR UPDATE', [key]);
        const current = selected.rows[0]?.value ?? fallback;
        const next = await updater(current);
        await c.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, JSON.stringify(next)]);
        await c.query('COMMIT');
        return next;
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
      finally { c.release(); }
    },
    async getUserData(userId, key) { return (await q('SELECT value FROM user_data WHERE user_id = $1 AND key = $2', [userId, key])).rows[0]?.value ?? null; },
    async setUserData(userId, key, value) {
      await q('INSERT INTO user_data (user_id, key, value, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at', [userId, key, JSON.stringify(value), Date.now()]);
    },
    async consumeRateLimit(key, limit, windowMs, now = Date.now()) {
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const result = await q(`INSERT INTO rate_limits (key, window_start, hits, updated_at) VALUES ($1,$2,1,$3)
        ON CONFLICT (key) DO UPDATE SET
          window_start = CASE WHEN rate_limits.window_start <> EXCLUDED.window_start THEN EXCLUDED.window_start ELSE rate_limits.window_start END,
          hits = CASE WHEN rate_limits.window_start <> EXCLUDED.window_start THEN 1 ELSE rate_limits.hits + 1 END,
          updated_at = EXCLUDED.updated_at
        WHERE rate_limits.window_start <> EXCLUDED.window_start OR rate_limits.hits < $4
        RETURNING hits`, [key, windowStart, now, limit]);
      const hits = result.rows[0]?.hits;
      return hits == null ? { allowed:false, remaining:0, resetAt:windowStart+windowMs }
        : { allowed:true, remaining:Math.max(0,limit-hits), resetAt:windowStart+windowMs };
    },
    async pruneExpiredSessions(now = Date.now()) {
      const result = await q("DELETE FROM user_data WHERE key LIKE 'session:%' AND (value = 'null'::jsonb OR ((value->>'expiresAt') ~ '^[0-9]+$' AND (value->>'expiresAt')::bigint <= $1))", [now]);
      await q('DELETE FROM rate_limits WHERE updated_at < $1', [now - 2 * 86400000]);
      return result.rowCount || 0;
    },
    // Full snapshot of the dataset for backup.
    async dump() {
      const users = (await q('SELECT * FROM users')).rows.map(row);
      const settings = Object.fromEntries((await q('SELECT key, value FROM settings')).rows.map(r => [r.key, r.value]));
      const userData = {};
      for (const r of (await q('SELECT user_id, key, value FROM user_data')).rows) (userData[r.user_id] ||= {})[r.key] = r.value;
      return { version: 1, exportedAt: Date.now(), users, settings, userData };
    },
    // Replace the entire dataset from a backup (transactional).
    async load(data) {
      await ready;
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query('DELETE FROM user_data'); await c.query('DELETE FROM users'); await c.query('DELETE FROM settings');
        for (const u of data.users || []) await c.query(`INSERT INTO users (${USER_FIELDS.join(',')}) VALUES (${USER_FIELDS.map((_, i) => '$' + (i + 1)).join(',')})`, USER_FIELDS.map(f => u[f]));
        for (const [key, value] of Object.entries(data.settings || {})) await c.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, JSON.stringify(value)]);
        for (const [uid, keys] of Object.entries(data.userData || {})) for (const [key, value] of Object.entries(keys)) await c.query('INSERT INTO user_data (user_id, key, value, updated_at) VALUES ($1, $2, $3, $4)', [uid, key, JSON.stringify(value), Date.now()]);
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    },
  };
}

function fileStore(dir) {
  const file = path.join(dir, 'db.json');
  fs.mkdirSync(dir, { recursive: true });
  let db = { users: [], settings: {}, userData: {} };
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* fresh */ }
  let timer = null;
  // Serialise mutations per key within this single-process development store.
  // Multi-process deployments must use PostgreSQL for cross-instance locking.
  const settingLocks = new Map();
  const updateSetting = async (key, updater, fallback = null) => {
    const previous = settingLocks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const tail = previous.then(() => gate);
    settingLocks.set(key, tail);
    await previous;
    try {
      const next = await updater(clone(db.settings[key] ?? fallback));
      db.settings[key] = clone(next);
      save();
      return clone(next);
    } finally {
      release();
      if (settingLocks.get(key) === tail) settingLocks.delete(key);
    }
  };
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, file);
    }, 100);
  };
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  return {
    ready: Promise.resolve(),
    async ping() { return true; },
    async findUserByEmail(email) { return clone(db.users.find(u => u.email === email)); },
    async findUserById(id) { return clone(db.users.find(u => u.id === id)); },
    async listUsers() { return clone([...db.users].sort((a, b) => b.created_at - a.created_at)); },
    async createUser(u) {
      if (db.users.some(x => x.email === u.email)) throw Object.assign(new Error('duplicate'), { code: '23505' });
      db.users.push(clone(u)); save(); return u;
    },
    async updateUser(id, patch) {
      const u = db.users.find(x => x.id === id);
      if (!u) return;
      for (const [k, v] of Object.entries(patch)) if (USER_FIELDS.includes(k) && k !== 'id') u[k] = v;
      save();
    },
    async deleteUser(id) { db.users = db.users.filter(u => u.id !== id); delete db.userData[id]; save(); },
    async getSetting(key) { return clone(db.settings[key] ?? null); },
    async setSetting(key, value) { db.settings[key] = clone(value); save(); },
    async updateSetting(key, updater, fallback = null) { return updateSetting(key, updater, fallback); },
    async getUserData(userId, key) { return clone(db.userData[userId]?.[key] ?? null); },
    async setUserData(userId, key, value) { (db.userData[userId] ||= {})[key] = clone(value); save(); },
    async consumeRateLimit(key, limit, windowMs, now = Date.now()) {
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const old = db.rateLimits?.[key];
      const hits = !old || old.windowStart !== windowStart ? 1 : old.hits + 1;
      if (hits > limit) return { allowed:false, remaining:0, resetAt:windowStart+windowMs };
      (db.rateLimits ||= {})[key] = { windowStart, hits, updatedAt:now };
      save();
      return { allowed:true, remaining:Math.max(0,limit-hits), resetAt:windowStart+windowMs };
    },
    async pruneExpiredSessions(now = Date.now()) {
      let removed = 0;
      for (const [uid, records] of Object.entries(db.userData || {})) {
        for (const [key, value] of Object.entries(records || {})) {
          if (key.startsWith('session:') && (!value || !Number.isFinite(value.expiresAt) || value.expiresAt <= now)) { delete records[key]; removed++; }
        }
        if (!Object.keys(records || {}).length) delete db.userData[uid];
      }
      let rateLimitsRemoved = 0;
      for (const [key, value] of Object.entries(db.rateLimits || {})) {
        if (value.updatedAt < now - 2*86400000) { delete db.rateLimits[key]; rateLimitsRemoved++; }
      }
      if (removed || rateLimitsRemoved) save();
      return removed;
    },
    async dump() { return { version: 1, exportedAt: Date.now(), users: clone(db.users), settings: clone(db.settings), userData: clone(db.userData), rateLimits: clone(db.rateLimits || {}) }; },
    async load(data) {
      db = { users: clone(data.users || []), settings: clone(data.settings || {}), userData: clone(data.userData || {}), rateLimits: clone(data.rateLimits || {}) };
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, file); // write immediately, not debounced
    },
  };
}

export function createStore() {
  return process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : fileStore(process.env.DATA_DIR || path.resolve('data'));
}

export const newId = () => crypto.randomUUID();
