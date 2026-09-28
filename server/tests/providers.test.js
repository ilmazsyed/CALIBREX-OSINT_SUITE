import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redditEntries, ransomwareEntries, kevEntries, gdeltEntries } from '../providers.js';
import { parseOpenSky, parseKp, parseSwpcAlerts, parseWikiTop } from '../signals.js';

test('reddit: maps listing to entries, drops stickied', () => {
  const json = { data: { children: [
    { data: { title: 'Missile strike reported', permalink: '/r/x/1', created_utc: 1790000000, selftext: 'body' } },
    { data: { title: 'Pinned rules', permalink: '/r/x/2', created_utc: 1790000001, stickied: true } },
  ] } };
  const e = redditEntries(json, 'worldnews');
  assert.equal(e.length, 1);
  assert.equal(e[0].title, 'r/worldnews: Missile strike reported');
  assert.equal(e[0].link, 'https://www.reddit.com/r/x/1');
});

test('ransomware.live: victim + group into a leak entry', () => {
  const e = ransomwareEntries([{ victim: 'ACME Corp', group_name: 'LockBit', discovered: '2026-09-27 10:00:00', country: 'US' }]);
  assert.equal(e.length, 1);
  assert.match(e[0].title, /LockBit names ACME Corp/);
  assert.match(e[0].summary, /dark-web leak site/);
});

test('CISA KEV: only recent additions', () => {
  const recent = new Date().toISOString().slice(0, 10);
  const json = { vulnerabilities: [
    { cveID: 'CVE-2026-1', vendorProject: 'Acme', product: 'Web', vulnerabilityName: 'RCE', dateAdded: recent },
    { cveID: 'CVE-2000-1', vendorProject: 'Old', product: 'Thing', dateAdded: '2000-01-01' },
  ] };
  const e = kevEntries(json);
  assert.equal(e.length, 1);
  assert.match(e[0].title, /CVE-2026-1.*actively exploited/);
  assert.match(e[0].link, /nvd\.nist\.gov\/vuln\/detail\/CVE-2026-1/);
});

test('GDELT: artlist to entries with parsed date', () => {
  const e = gdeltEntries({ articles: [{ title: 'Clashes erupt', url: 'https://x/1', seendate: '20260928T101500Z', domain: 'x.com' }] });
  assert.equal(e[0].title, 'Clashes erupt');
  assert.equal(e[0].source, 'x.com');
  assert.match(e[0].date, /^2026-09-28T10:15:00Z$/);
});

test('OpenSky: airborne only, emergency squawk flagged and sorted first', () => {
  const json = { states: [
    ['a1', 'IAF01  ', 'India', 0, 0, 77, 28, 0, false, 250, 90, 0, null, 10000, '7700'],
    ['b2', 'CIV22', 'India', 0, 0, 78, 29, 0, false, 200, 80, 0, null, 9000, '1200'],
    ['c3', 'GND', 'India', 0, 0, 79, 30, 0, true, 0, 0, 0, null, 0, '1000'],
  ] };
  const a = parseOpenSky(json);
  assert.equal(a.length, 2); // grounded dropped
  assert.equal(a[0].emergency, 'general emergency'); // emergency first
  assert.equal(a[0].callsign, 'IAF01');
});

test('space weather: Kp level and recent alerts', () => {
  const kp = parseKp([['time', 'Kp'], ['2026-09-28 09:00', '6.3']]);
  assert.equal(kp.kp, 6.3);
  assert.match(kp.level, /G2/);
  const alerts = parseSwpcAlerts([{ issue_datetime: new Date().toISOString().replace('T', ' ').slice(0, 19), message: 'Space Weather Message\nWARNING: Geomagnetic K-index of 6 expected\nmore' }]);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].head, /^WARNING/);
});

test('wikipedia: filters utility pages', () => {
  const top = parseWikiTop({ items: [{ articles: [
    { article: 'Main_Page', views: 9e6 }, { article: 'Special:Search', views: 5e6 },
    { article: 'Operation_Sindoor', views: 120000 }, { article: 'Iran', views: 90000 },
  ] }] });
  assert.deepEqual(top.map(t => t.title), ['Operation Sindoor', 'Iran']);
  assert.equal(top[0].url, 'https://en.wikipedia.org/wiki/Operation_Sindoor');
});
