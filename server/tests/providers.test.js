import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redditEntries, ransomwareEntries, kevEntries, gdeltEntries, gdeltProviderBackoffMs, mastodonEntries, noaaSpaceWeatherEntries, celestrakEntries, worldBankEntries, WORLD_BANK_INDICATORS } from '../providers.js';
import { parseKp, parseSwpcAlerts, parseWikiTop } from '../signals.js';

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

test('GDELT collection provider backs off after repeated upstream throttling', () => {
  assert.equal(gdeltProviderBackoffMs(1), 5 * 60 * 1000);
  assert.equal(gdeltProviderBackoffMs(2), 10 * 60 * 1000);
  assert.equal(gdeltProviderBackoffMs(20), 30 * 60 * 1000);
});

test('Mastodon public timeline parser strips markup and retains attribution',()=>{
 const rows=mastodonEntries([{url:'https://mastodon.social/@analyst/123',content:'<p>Port activity <strong>reported</strong> near coast &amp; shipping lane</p>',created_at:'2026-11-19T10:00:00Z',account:{acct:'analyst@mastodon.social'}}]);
 assert.equal(rows.length,1);
 assert.match(rows[0].title,/Port activity reported/);
 assert.match(rows[0].summary,/coast & shipping lane/);
 assert.equal(rows[0].source,'Mastodon @analyst@mastodon.social');
});

test('NOAA SWPC parser preserves alert issue time and public source link',()=>{
 const rows=noaaSpaceWeatherEntries([{issue_datetime:'2026-11-19 10:30:00',message:'ALERT: Geomagnetic storm watch\\nDetails for operators'}]);
 assert.equal(rows.length,1);
 assert.match(rows[0].title,/NOAA SWPC: ALERT/);
 assert.equal(rows[0].date,'2026-11-19T10:30:00Z');
 assert.match(rows[0].link,/swpc.noaa.gov/);
});

test('CelesTrak parser requires catalogue identity and emits orbital context',()=>{
 const rows=celestrakEntries([
  {OBJECT_NAME:'ISS (ZARYA)',NORAD_CAT_ID:25544,EPOCH:'2026-11-19T00:00:00Z',INCLINATION:51.6,APOGEE:420,PERIGEE:415},
  {OBJECT_NAME:'missing id'},
 ],10);
 assert.equal(rows.length,1);
 assert.match(rows[0].title,/ISS \\(ZARYA\\).*25544/);
 assert.match(rows[0].summary,/inclination 51.60°/);
 assert.match(rows[0].summary,/apogee 420 km/);
});

test('World Bank parser handles multiple economic indicators and latest country values',()=>{
 const row=(date,value)=>({date,value,country:{value:'India'},countryiso3code:'IND'});
 const data=worldBankEntries({
  'NY.GDP.MKTP.KD.ZG':[{},[row('2022',6.5),row('2024',7.1)]],
  'BX.KLT.DINV.WD.GD.ZS':[{},[row('2023',1.2)]],
  'SL.UEM.TOTL.ZS':[{},[row('2024',4.2)]],
 });
 assert.equal(WORLD_BANK_INDICATORS.length,8);
 assert.equal(data.length,3);
 assert.ok(data.some(x=>/GDP growth: India 7.10/.test(x.title)));
 assert.ok(data.some(x=>/foreign direct investment/i.test(x.title)));
 assert.ok(data.some(x=>/Unemployment/.test(x.title)));
});
