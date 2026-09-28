import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDelivery, redactDelivery, haversineKm, selectForDelivery, formatText } from '../notify.js';

test('cleanDelivery: keeps valid channels, bounds geofences, drops junk', () => {
  const c = cleanDelivery({
    minSeverity: 'CRITICAL',
    telegram: { botToken: '123:abc', chatId: '999' },
    webhook: { url: 'https://hooks.example.com/x' },
    geofences: [
      { name: 'Gulf', lat: 25, lng: 55, radiusKm: 300 },
      { name: 'bad', lat: 999, lng: 0, radiusKm: 10 },   // out of range
      { name: 'huge', lat: 0, lng: 0, radiusKm: 999999 }, // radius too large
    ],
  });
  assert.equal(c.enabled, true);
  assert.equal(c.minSeverity, 'CRITICAL');
  assert.equal(c.telegram.chatId, '999');
  assert.equal(c.webhook.url, 'https://hooks.example.com/x');
  assert.equal(c.geofences.length, 1);
  assert.equal(c.geofences[0].name, 'Gulf');
});

test('cleanDelivery: no channels => disabled; bad minSeverity falls back to HIGH', () => {
  const c = cleanDelivery({ minSeverity: 'LOW', telegram: { botToken: '', chatId: '' } });
  assert.equal(c.enabled, false);
  assert.equal(c.minSeverity, 'HIGH');
});

test('redactDelivery: never exposes the bot token', () => {
  const r = redactDelivery({ telegram: { botToken: 'secret:token', chatId: '5' }, webhook: { url: 'https://x.io/h' } });
  assert.equal(r.telegram.configured, true);
  assert.equal(r.telegram.chatId, '5');
  assert.equal('botToken' in r.telegram, false);
  assert.equal(JSON.stringify(r).includes('secret:token'), false);
});

test('haversineKm: known distance is roughly right', () => {
  const d = haversineKm(0, 0, 0, 1); // 1 deg lng at equator ~111 km
  assert.ok(Math.abs(d - 111) < 2);
});

const items = [
  { id: 'a', title: 'Strike near Dubai', kind: 'news', severity: 'CRITICAL', published: 3, place: { name: 'Dubai', lat: 25.2, lng: 55.3 } },
  { id: 'b', title: 'Strike in Chile', kind: 'news', severity: 'CRITICAL', published: 2, place: { name: 'Santiago', lat: -33.4, lng: -70.6 } },
  { id: 'c', title: 'Minor item', kind: 'news', severity: 'MEDIUM', published: 1, place: { name: 'Dubai', lat: 25.2, lng: 55.3 } },
  { id: 'd', title: 'social', kind: 'social', severity: 'CRITICAL', published: 4, place: null },
];

test('selectForDelivery: severity threshold, geofence, seen-set, drops social', () => {
  const cfg = cleanDelivery({ minSeverity: 'HIGH', webhook: { url: 'https://x.io/h' }, geofences: [{ name: 'Gulf', lat: 25.2, lng: 55.3, radiusKm: 300 }] });
  const picked = selectForDelivery(cfg, items, new Set());
  assert.deepEqual(picked.map(i => i.id), ['a']); // b out of fence, c below sev, d social
  assert.equal(selectForDelivery(cfg, items, new Set(['a'])).length, 0); // already sent
});

test('selectForDelivery: no geofence passes items regardless of location', () => {
  const cfg = cleanDelivery({ minSeverity: 'CRITICAL', webhook: { url: 'https://x.io/h' } });
  assert.deepEqual(selectForDelivery(cfg, items, new Set()).map(i => i.id), ['a', 'b']);
});

test('formatText: compact, includes place and stays bounded', () => {
  const txt = formatText([{ title: 'X', url: 'u', severity: 'HIGH', place: { name: 'Dubai' } }]);
  assert.match(txt, /CALIBREX alert: 1 new report/);
  assert.match(txt, /Dubai/);
});
