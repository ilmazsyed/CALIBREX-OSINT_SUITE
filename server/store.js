// Persistence: PostgreSQL when DATABASE_URL is set (Render), otherwise a JSON
// file in ./data for local development.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const USER_FIELDS = ['id', 'email', 'name', 'org', 'password_hash', 'role', 'status', 'created_at', 'last_seen', 'visits'];

function pgStore(url) {
  let pool;
  const ready = (async () => {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
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
        visits INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
      CREATE TABLE IF NOT EXISTS user_data (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value JSONB NOT NULL,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, key)
      );`);
  })();
  const q = async (sql, params) => { await ready; return pool.query(sql, params); };
  const row = r => r && ({ ...r, created_at: Number(r.created_at), last_seen: r.last_seen == null ? null : Number(r.last_seen) });
  return {
    ready,
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
    async getUserData(userId, key) { return (await q('SELECT value FROM user_data WHERE user_id = $1 AND key = $2', [userId, key])).rows[0]?.value ?? null; },
    async setUserData(userId, key, value) {
      await q('INSERT INTO user_data (user_id, key, value, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at', [userId, key, JSON.stringify(value), Date.now()]);
    },
  };
}

function fileStore(dir) {
  const file = path.join(dir, 'db.json');
  fs.mkdirSync(dir, { recursive: true });
  let db = { users: [], settings: {}, userData: {} };
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* fresh */ }
  let timer = null;
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
    async getUserData(userId, key) { return clone(db.userData[userId]?.[key] ?? null); },
    async setUserData(userId, key, value) { (db.userData[userId] ||= {})[key] = clone(value); save(); },
  };
}

export function createStore() {
  return process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : fileStore(process.env.DATA_DIR || path.resolve('data'));
}

export const newId = () => crypto.randomUUID();
