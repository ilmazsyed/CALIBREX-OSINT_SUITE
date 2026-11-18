import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { createMcpRouter } from '../mcp.js';

const user = { id: 'user-1', email: 'analyst@example.test', status: 'active', role: 'user' };

function memoryStore() {
  const settings = new Map();
  const userData = new Map();
  return {
    async getSetting(key) { return settings.get(key) ?? null; },
    async setSetting(key, value) { settings.set(key, value); },
    async updateSetting(key, updater, fallback = null) {
      const next = await updater(settings.has(key) ? settings.get(key) : fallback);
      settings.set(key, next);
      return next;
    },
    async getUserData(uid, key) { return userData.get(uid + ':' + key) ?? null; },
    async setUserData(uid, key, value) { userData.set(uid + ':' + key, value); },
    async findUserById(id) { return id === user.id ? user : null; },
    async consumeRateLimit() { return { allowed: true, remaining: 100, resetAt: Date.now() + 60000 }; },
  };
}

test('MCP OAuth discovery, PKCE exchange, refresh rotation and authenticated tools', async t => {
  const previous = {
    enabled: process.env.MCP_ENABLED,
    publicUrl: process.env.PUBLIC_URL,
    mcpPublicUrl: process.env.MCP_PUBLIC_URL,
  };
  process.env.MCP_ENABLED = 'true';
  process.env.PUBLIC_URL = 'https://app.calibrex.org';
  delete process.env.MCP_PUBLIC_URL;

  const store = memoryStore();
  const app = express();
  app.use(express.json());
  app.use('/api', (req, res, next) => { req.user = user; next(); });
  app.use('/api', createMcpRouter({
    store,
    searchNews: async query => [{ title: 'Test lead', summary: query, url: 'https://example.test/source', source: 'Test' }],
    snapshot: () => ({ items: [] }),
    newId: () => crypto.randomUUID(),
    getInvestigations: async () => [],
    setInvestigations: async () => {},
    getWorkspaces: async () => [],
    getWorkspaceData: async () => ({ investigations: [], ledgers: {} }),
    updateWorkspaceData: async () => {},
    auditWorkspace: async () => {},
    appendEvidenceLedger: async () => {},
  }));

  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (previous.enabled === undefined) delete process.env.MCP_ENABLED; else process.env.MCP_ENABLED = previous.enabled;
    if (previous.publicUrl === undefined) delete process.env.PUBLIC_URL; else process.env.PUBLIC_URL = previous.publicUrl;
    if (previous.mcpPublicUrl === undefined) delete process.env.MCP_PUBLIC_URL; else process.env.MCP_PUBLIC_URL = previous.mcpPublicUrl;
  });

  const origin = 'http://127.0.0.1:' + server.address().port;
  const postForm = (path, body) => fetch(origin + path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    redirect: 'manual',
  });

  const resource = await fetch(origin + '/api/.well-known/oauth-protected-resource');
  assert.equal(resource.status, 200);
  assert.equal((await resource.json()).resource, 'https://app.calibrex.org/api/mcp');

  const registration = await fetch(origin + '/api/oauth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: 'Test assistant', redirect_uris: ['https://assistant.example.test/callback'] }),
  });
  assert.equal(registration.status, 201);
  const client = await registration.json();

  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const redirectUri = 'https://assistant.example.test/callback';
  const authorizeUrl = new URL(origin + '/api/oauth/authorize');
  for (const [key, value] of Object.entries({
    client_id: client.client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'cases:read intelligence:read',
    state: 'csrf-state',
  })) authorizeUrl.searchParams.set(key, value);

  const consent = await fetch(authorizeUrl);
  assert.equal(consent.status, 200);
  const html = await consent.text();
  const nonce = html.match(/name="nonce" value="([^"]+)"/)?.[1];
  assert.ok(nonce, 'consent form contains a one-time nonce');

  const approved = await postForm('/api/oauth/authorize', { nonce, decision: 'allow' });
  assert.equal(approved.status, 302);
  const callback = new URL(approved.headers.get('location'));
  assert.equal(callback.searchParams.get('state'), 'csrf-state');
  const code = callback.searchParams.get('code');
  assert.ok(code);

  const tokenResponse = await postForm('/api/oauth/token', {
    grant_type: 'authorization_code',
    code,
    client_id: client.client_id,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  assert.equal(tokenResponse.status, 200);
  const tokens = await tokenResponse.json();
  assert.ok(tokens.access_token);
  assert.ok(tokens.refresh_token);
  assert.equal(tokens.expires_in, 900);

  const init = await fetch(origin + '/api/mcp', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tokens.access_token, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }),
  });
  assert.equal(init.status, 200);
  assert.equal((await init.json()).result.serverInfo.name, 'Calibrex OSINT Studio');

  const refreshed = await postForm('/api/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: client.client_id,
  });
  assert.equal(refreshed.status, 200);
  const rotated = await refreshed.json();
  assert.notEqual(rotated.refresh_token, tokens.refresh_token);

  const replay = await postForm('/api/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: client.client_id,
  });
  assert.equal(replay.status, 400);

  const revoked = await postForm('/api/oauth/revoke', { token: rotated.access_token });
  assert.equal(revoked.status, 200);
  const revokedAccess = await fetch(origin + '/api/mcp', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + rotated.access_token, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }),
  });
  assert.equal(revokedAccess.status, 401);
  const revokedRefresh = await postForm('/api/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: rotated.refresh_token,
    client_id: client.client_id,
  });
  assert.equal(revokedRefresh.status, 400);
});
