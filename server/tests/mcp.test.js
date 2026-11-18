import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { createMcpRouter } from '../mcp.js';
import { validateInvestigation } from '../intelligence.js';

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
  const seededCase = validateInvestigation({ id: 'case-integrity-1', title: 'Integrity fixture', evidence: [{ id: 'ev-integrity-1', title: 'Captured source', url: 'https://example.test/article', source: 'Example', contentSnapshot: 'Captured source text' }], notes: [{ text: 'Analyst note' }] });
  const app = express();
  app.use(express.json());
  app.use('/api', (req, res, next) => { if (req.method === 'GET' && req.path === '/oauth/authorize') req.user = user; next(); });
  app.use('/api', createMcpRouter({
    store,
    searchNews: async query => [{ title: 'Test lead', summary: query, url: 'https://example.test/source', source: 'Test', published: Date.now() }],
    corroborate: async claim => ({ status: 'LIMITED', claim, independentDomains: 1, matches: [] }),
    readArticle: async url => ({ title: 'Readable test article', siteName: 'Example', url, text: 'Public article text', provenance: { sha256: 'a'.repeat(64) } }),
    marketsSnapshot: () => ({ updatedAt: 100, groups: { FX: [{ id: 'USDINR', value: 83 }] }, sources: {} }),
    crisisSnapshot: () => ({ updatedAt: 100, events: [], stress: {} }),
    signalsSnapshot: () => ({ updatedAt: 100, aircraft: [{ id: 'A1' }], space: [], sources: {} }),
    geointSnapshot: () => ({ updatedAt: 100, events: [{ id: 'E1', category: 'hazard', lat: 1, lng: 2 }], byCategory: { hazard: 1 }, sources: {} }),
    conflictSnapshot: () => ({ items: [{ id: 'C1' }], locations: [] }),
    maritimeSnapshot: () => ({ news: [{ id: 'M1' }], events: [], vessels: [] }),
    sanctionsSnapshot: () => ({ updatedAt: 100, entries: [{ id: 'S1' }] }),
    screenSanctions: async query => ({ query, matches: [], screenedAt: 100 }),
    macroSnapshot: () => ({ updatedAt: 100 }),
    instabilitySnapshot: () => ({ updatedAt: 100 }),
    correlationSnapshot: () => ({ updatedAt: 100 }),
    snapshot: () => ({ items: [{ id: 's1', kind: 'social', title: 'Public test chatter', summary: 'Test public chatter sample', source: 'Example social', published: Date.now(), authorId: 'account-1' }], sources: { 'test-feed': { state: 'healthy', ok: true, count: 1, at: Date.now(), lastSuccessAt: Date.now(), consecutiveFailures: 0 } } }),
    newId: () => crypto.randomUUID(),
    getInvestigations: async () => [seededCase],
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

  const approved = await fetch(origin + '/api/oauth/authorize', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://assistant.example.test' }, body: new URLSearchParams({ nonce, decision: 'allow' }), redirect: 'manual' });
  assert.equal(approved.status, 200, 'approval returns a browser navigation page without relying on a cross-site session cookie');
  const approvalPage = await approved.text();
  const navigation = approvalPage.match(/http-equiv="refresh" content="0;url=([^"]+)"/);
  assert.ok(navigation, 'approval page provides an automatic browser redirect compatible with the app CSP');
  const callback = new URL(navigation[1].replace(/&amp;/g, '&'));
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

  const listResponse = await fetch(origin + '/api/mcp', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tokens.access_token, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'tools/list' }),
  });
  const listedTools = (await listResponse.json()).result.tools;
  const listed = listedTools.map(x => x.name);
  const casePrepare = listedTools.find(x => x.name === 'calibrex_prepare_case_change');
  for (const field of ['hypotheses','entities','relationships','assessment','savedSearches','monitoring','questions','priorityRequirements']) assert.ok(casePrepare.inputSchema.properties[field], 'case MCP schema exposes '+field);
  assert.ok(casePrepare.inputSchema.properties.evidence.items.properties.contentSnapshot, 'evidence schema accepts captured source text');
  assert.ok(casePrepare.inputSchema.properties.assessment.properties.keyJudgements, 'assessment schema exposes key judgements');
  assert.ok(casePrepare.inputSchema.properties.assessment.properties.alternativeHypotheses, 'assessment schema exposes alternatives');
  for (const name of ['calibrex_get_source_network','calibrex_get_collection_status','calibrex_collect_case_evidence','calibrex_read_article','calibrex_corroborate_claim','calibrex_analyze_social_chatter','calibrex_detect_social_patterns','calibrex_cluster_search_results','calibrex_extract_case_entities','calibrex_export_case_stix','calibrex_situational_picture','calibrex_geospatial_events','calibrex_market_crisis_indicators','calibrex_airspace_and_space_signals','calibrex_maritime_picture','calibrex_conflict_picture','calibrex_screen_sanctions']) assert.ok(listed.includes(name), 'MCP exposes '+name);

  const callTool = async (name, args={}) => {
    const response = await fetch(origin + '/api/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokens.access_token, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name, arguments: args } }),
    });
    return (await response.json()).result;
  };
  const sourceNetwork = await callTool('calibrex_get_source_network');
  assert.equal(sourceNetwork.structuredContent.layers.length, 6);
  assert.equal(sourceNetwork.structuredContent.target, 6000);
  assert.ok(sourceNetwork.structuredContent.configured > 100);
  assert.ok(sourceNetwork.structuredContent.candidateInventory.candidateCount >= 30);
  const filteredSources = await callTool('calibrex_get_source_network', { layer: 'news', includeSources: true, limit: 5 });
  assert.ok(filteredSources.structuredContent.sources.length <= 5);
  assert.ok(filteredSources.structuredContent.sources.every(source => source.layer === 'news'));
  const captured = await callTool('calibrex_collect_case_evidence', { query: 'port disruption', window: '7d', limit: 3 });
  assert.equal(captured.structuredContent.bodyCapturedCount, 1);
  assert.match(captured.structuredContent.results[0].evidence.sha256, /^[a-f0-9]{64}$/);
  assert.equal(captured.structuredContent.results[0].evidence.provenanceStatus, 'SOURCE_CAPTURED');
  const auditedCase = await callTool('calibrex_get_case', { caseId: 'case-integrity-1' });
  assert.equal(auditedCase.structuredContent.evidenceIntegrity.valid, true);
  assert.equal(auditedCase.structuredContent.evidenceIntegrity.contentSnapshotsCaptured, 1);
  assert.equal(auditedCase.structuredContent.overallIntegrity, true);
  const collection = await callTool('calibrex_get_collection_status');
  assert.equal(collection.structuredContent.sourceHealth[0].status, 'healthy');
  const article = await callTool('calibrex_read_article', { url: 'https://example.test/article' });
  assert.equal(article.structuredContent.text, 'Public article text');
  const corroboration = await callTool('calibrex_corroborate_claim', { claim: 'A sufficiently detailed test claim' });
  assert.equal(corroboration.structuredContent.status, 'LIMITED');
  const chatter = await callTool('calibrex_analyze_social_chatter');
  assert.equal(chatter.structuredContent.total, 1);
  const patterns = await callTool('calibrex_detect_social_patterns', { windowMinutes: 30, minAccounts: 3 });
  assert.equal(patterns.structuredContent.assessment, 'REVIEW_LEAD_ONLY');
  const clusters = await callTool('calibrex_cluster_search_results', { query: 'border security incident', window: '7d' });
  assert.equal(clusters.structuredContent.resultCount, 1);
  const picture = await callTool('calibrex_situational_picture');
  assert.equal(picture.structuredContent.geospatial.eventCount, 1);
  const geo = await callTool('calibrex_geospatial_events', { limit: 10 });
  assert.equal(geo.structuredContent.events[0].id, 'E1');
  const market = await callTool('calibrex_market_crisis_indicators');
  assert.equal(market.structuredContent.markets.groups.FX[0].id, 'USDINR');
  const air = await callTool('calibrex_airspace_and_space_signals');
  assert.equal(air.structuredContent.aircraft[0].id, 'A1');
  const maritime = await callTool('calibrex_maritime_picture');
  assert.equal(maritime.structuredContent.news[0].id, 'M1');
  const conflict = await callTool('calibrex_conflict_picture');
  assert.equal(conflict.structuredContent.items[0].id, 'C1');
  const sanctions = await callTool('calibrex_screen_sanctions', { query: 'Example Holdings' });
  assert.equal(sanctions.structuredContent.query, 'Example Holdings');

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
