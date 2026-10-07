import { test } from 'node:test';
import assert from 'node:assert/strict';
import { termMatcher, cleanWatchlist, matchWatchlist, summariseDay, updateTrends, runWatchlistFor } from '../watch.js';

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-for-ai-encryption';
const { encrypt, decrypt, buildPrompt, defaultModel } = await import('../ai.js');

const item = (title, extra = {}) => ({ id: 'X-' + title.length + title.slice(0, 5), title, source: 'Wire', url: 'https://e.x/' + encodeURIComponent(title), published: Date.now(), wire: 'KINETIC', severity: 'HIGH', place: null, ...extra });

test('termMatcher: every word must start a word; quotes match phrases', () => {
  assert.equal(termMatcher('Houthi')('Houthis fire missile at ship'), true);
  assert.equal(termMatcher('thi')('Houthis fire missile'), false);
  assert.equal(termMatcher('ransomware hospital')('Hospital hit by ransomware gang'), true);
  assert.equal(termMatcher('ransomware hospital')('Ransomware gang hits school'), false);
  assert.equal(termMatcher('"Port Sudan"')('Drone strike near Port Sudan airport'), true);
  assert.equal(termMatcher('"Port Sudan"')('Sudan port closed'), false);
  assert.equal(termMatcher('a.b')('aXb news'), false); // regex characters are literal
});

test('cleanWatchlist: trims, dedupes, caps and defaults', () => {
  const wl = cleanWatchlist({ terms: [{ term: '  Gaza  ' }, { term: 'gaza' }, { term: 'x' }, { term: 'Kyiv', minSeverity: 'NOPE' }], email: 'weird' });
  assert.deepEqual(wl.terms.map(t => t.term), ['Gaza', 'Kyiv']);
  assert.equal(wl.terms[1].minSeverity, 'LOW');
  assert.equal(wl.email, 'off');
  assert.equal(cleanWatchlist({ terms: Array.from({ length: 40 }, (_, i) => ({ term: 'term' + i })) }).terms.length, 25);
  assert.deepEqual(cleanWatchlist(null), { terms: [], email: 'off' });
});

test('matchWatchlist: respects severity floor, seen ids and term age', () => {
  const now = Date.now();
  const wl = cleanWatchlist({ terms: [{ term: 'Kyiv', createdAt: now, minSeverity: 'HIGH' }] });
  const items = [
    item('Missile strike on Kyiv kills 3', { id: 'a', severity: 'HIGH' }),
    item('Kyiv hosts trade fair', { id: 'b', severity: 'LOW' }),
    item('Old Kyiv attack report', { id: 'c', severity: 'CRITICAL', published: now - 5 * 3600000 }),
    item('Kyiv blast', { id: 'd', severity: 'CRITICAL' }),
  ];
  assert.deepEqual(matchWatchlist(wl, items, new Set(['d'])).map(m => m.item.id), ['a']);
});

function memoryStore(users) {
  const data = new Map(); const settings = new Map();
  return {
    async listUsers() { return users; },
    async getUserData(u, k) { return data.get(u + ':' + k) ?? null; },
    async setUserData(u, k, v) { data.set(u + ':' + k, v); },
    async getSetting(k) { return settings.get(k) ?? null; },
    async setSetting(k, v) { settings.set(k, v); },
  };
}

test('runWatchlistFor: stores notifications once per item', async () => {
  const user = { id: 'u1', email: 'a@b.c', role: 'user', status: 'active' };
  const store = memoryStore([user]);
  await store.setUserData('u1', 'watchlist', { terms: [{ term: 'Sahel', createdAt: Date.now() }] });
  const items = [item('Attack in the Sahel region', { id: 's1' }), item('Unrelated story', { id: 'z' })];
  assert.equal(await runWatchlistFor(store, user, items), 1);
  assert.equal(await runWatchlistFor(store, user, items), 0);
  const notes = await store.getUserData('u1', 'notifications');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].term, 'Sahel');
  assert.equal(notes[0].read, false);
});

test('trends: summarise and update today/yesterday without shrinking', async () => {
  const now = Date.parse('2026-09-27T12:00:00Z');
  const items = [
    item('A', { published: now - 3600000, wire: 'CYBER', severity: 'HIGH', place: { name: 'Kyiv' } }),
    item('B', { published: now - 7200000, wire: 'CYBER', severity: 'LOW', place: null }),
    item('C', { published: now - 26 * 3600000, wire: 'KINETIC', severity: 'CRITICAL', place: { name: 'Gaza' } }),
  ];
  const d = summariseDay(items, '2026-09-27');
  assert.equal(d.total, 2);
  assert.equal(d.wires.CYBER, 2);
  assert.equal(d.places.Kyiv, 1);
  assert.equal(d.severity.HIGH, 1);
  const store = memoryStore([]);
  await updateTrends(store, items, now);
  let t = await store.getSetting('trends');
  assert.equal(t.days['2026-09-27'].total, 2);
  assert.equal(t.days['2026-09-26'].total, 1);
  await updateTrends(store, items.slice(0, 1), now); // thinner window after a restart
  t = await store.getSetting('trends');
  assert.equal(t.days['2026-09-27'].total, 2);
});

test('business push: fires on significant events only, never on benign business news', async () => {
  const { isSignificantBusiness } = await import('../push.js');
  const biz = (title, extra = {}) => ({ wire: 'BUSINESS', kind: 'news', title, summary: '', ...extra });
  assert.equal(isSignificantBusiness(biz('Giant conglomerate files for bankruptcy')), true);
  assert.equal(isSignificantBusiness(biz('Tycoon launches hostile takeover bid for rival')), true);
  assert.equal(isSignificantBusiness(biz('Shares plunge as lender faces debt crisis')), true);
  assert.equal(isSignificantBusiness(biz('Company opens new office in Pune')), false);           // benign
  assert.equal(isSignificantBusiness(biz('Bank collapses', { kind: 'social' })), false);           // social never pushes
  assert.equal(isSignificantBusiness({ wire: 'KINETIC', kind: 'news', title: 'Market crash' }), false); // only BUSINESS wire
});

test('government push: fires on high-impact actions only', async () => {
  const { isSignificantGov } = await import('../push.js');
  const gov = (title, extra = {}) => ({ wire: 'GOV', kind: 'news', title, summary: '', ...extra });
  assert.equal(isSignificantGov(gov('President declares state of emergency')), true);
  assert.equal(isSignificantGov(gov('Cabinet signs executive order on sanctions')), true);
  assert.equal(isSignificantGov(gov('Military coup topples government')), true);
  assert.equal(isSignificantGov(gov('Minister opens new public library')), false);           // benign
  assert.equal(isSignificantGov(gov('Coup attempt', { kind: 'social' })), false);              // social never pushes
  assert.equal(isSignificantGov({ wire: 'BUSINESS', kind: 'news', title: 'sanctions' }), false); // only GOV wire
});

test('deploy notice: fires once per build, silent on baseline and restart', async () => {
  const { ensureVapid, notifyDeploy } = await import('../push.js');
  const store = memoryStore([]); // no users → no actual sends, just version keying
  await ensureVapid(store);
  const saved = process.env.RENDER_GIT_COMMIT;
  try {
    process.env.RENDER_GIT_COMMIT = 'commit-aaa';
    await notifyDeploy(store);                                   // first boot: record baseline only
    assert.equal(await store.getSetting('deploy_notified'), 'commit-aaa');
    await notifyDeploy(store);                                   // same build restarting: no change
    assert.equal(await store.getSetting('deploy_notified'), 'commit-aaa');
    process.env.RENDER_GIT_COMMIT = 'commit-bbb';
    await notifyDeploy(store);                                   // new deploy: advances, would notify
    assert.equal(await store.getSetting('deploy_notified'), 'commit-bbb');
  } finally {
    if (saved === undefined) delete process.env.RENDER_GIT_COMMIT; else process.env.RENDER_GIT_COMMIT = saved;
  }
});

test('ai: keys round-trip through encryption and are not stored in clear', () => {
  const blob = encrypt('sk-test-123456789');
  assert.ok(!blob.includes('sk-test'));
  assert.equal(decrypt(blob), 'sk-test-123456789');
});

test('ai: prompts number sources and reject unknown tasks', () => {
  const { prompt } = buildPrompt('research', { query: 'Sahel', sources: [{ title: 'One', source: 'BBC', url: 'https://b' }, { title: 'Two', source: 'DW' }] });
  assert.match(prompt, /\[1\] One \(BBC\) https:\/\/b/);
  assert.match(prompt, /\[2\] Two \(DW\)/);
  assert.throws(() => buildPrompt('hack', {}), /Unknown AI task/);
});

test('ai: default model prefers Claude Opus 5', () => {
  assert.equal(defaultModel('anthropic', [{ id: 'claude-sonnet-4-5' }, { id: 'claude-opus-5' }]), 'claude-opus-5');
  assert.equal(defaultModel('openrouter', [{ id: 'openai/gpt-5' }, { id: 'anthropic/claude-opus-5' }], 'Claude'), 'anthropic/claude-opus-5');
  assert.equal(defaultModel('openrouter', [{ id: 'openai/gpt-5-mini' }, { id: 'openai/gpt-5' }], 'ChatGPT'), 'openai/gpt-5');
});
