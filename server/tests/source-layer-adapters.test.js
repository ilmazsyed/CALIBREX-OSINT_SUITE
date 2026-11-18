import test from 'node:test';
import assert from 'node:assert/strict';
import { blueskyEntries, eonetEntries, openSkyEntries, worldBankEntries, PROVIDERS } from '../providers.js';

test('Bluesky public search maps posts to public permalink and preserves public engagement metrics', () => {
  const rows = blueskyEntries({ posts: [{
    uri: 'at://did:plc:abc/app.bsky.feed.post/xyz',
    indexedAt: '2026-11-18T12:00:00Z',
    author: { handle: 'reporter.example' },
    record: { text: 'Public post about regional security', createdAt: '2026-11-18T11:59:00Z' },
    likeCount: 12, repostCount: 3, replyCount: 2,
  }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].link, 'https://bsky.app/profile/reporter.example/post/xyz');
  assert.equal(rows[0].authorId, 'reporter.example');
  assert.equal(rows[0].metrics.likes, 12);
});

test('NASA EONET uses latest available event geometry and keeps the official event link', () => {
  const rows = eonetEntries({ events: [{
    id: 'EONET_123', title: 'Wildfire event', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_123',
    categories: [{ title: 'Wildfires' }],
    geometry: [{ date: '2026-11-17', coordinates: [80.1, 22.2] }, { date: '2026-11-18', coordinates: [81.2, 23.3] }],
  }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, '2026-11-18');
  assert.match(rows[0].summary, /23.300, 81.200/);
  assert.equal(rows[0].link, 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_123');
});

test('OpenSky parser rejects grounded/invalid aircraft and caps emitted observations', () => {
  const valid = ['abc123','AI101','India',1731931200,1731931200,88.3,22.5,10000,false,220,180,0,null,null,null,false,0];
  const grounded = [...valid]; grounded[8] = true;
  const invalid = [...valid]; invalid[5] = null;
  const rows = openSkyEntries({ states: [valid, grounded, invalid, ...Array.from({length:60},(_,i)=>[...valid.slice(0,1), 'FL'+i, ...valid.slice(2)])] }, 10);
  assert.equal(rows.length, 10);
  assert.match(rows[0].title, /AI101/);
  assert.match(rows[0].summary, /88.300, 22.500/);
});

test('World Bank parser keeps latest numeric annual observations by country and indicator', () => {
  const payloads = {
    'NY.GDP.MKTP.KD.ZG': [null, [
      { country: { value: 'India' }, countryiso3code: 'IND', date: '2022', value: 7.2 },
      { country: { value: 'India' }, countryiso3code: 'IND', date: '2023', value: 8.2 },
      { country: { value: 'India' }, countryiso3code: 'IND', date: '2024', value: null },
      { country: { value: 'Nepal' }, countryiso3code: 'NPL', date: '2023', value: 3.9 },
    ]],
    'FP.CPI.TOTL.ZG': [null, [
      { country: { value: 'India' }, countryiso3code: 'IND', date: '2023', value: 5.6 },
    ]],
  };
  const rows = worldBankEntries(payloads);
  assert.equal(rows.length, 3);
  assert.ok(rows.some(row => row.title.includes('India 8.20% in 2023')));
  assert.ok(rows.some(row => row.title.includes('consumer price inflation: India 5.60%')));
  assert.ok(!rows.some(row => row.title.includes('2024')));
});

test('four keyless providers declare the correct intelligence layers and review metadata', () => {
  const ids = ['bluesky-public','nasa-eonet','opensky-south-asia','world-bank-open-data'];
  for (const id of ids) {
    const provider = PROVIDERS.find(row => row.id === id);
    assert.ok(provider, id);
    assert.ok(['social','geospatial','mobility','economic'].includes(provider.layer));
    assert.ok(provider.accessModel.includes('public'));
    assert.ok(provider.licence.toLowerCase().includes('review'));
    assert.equal(typeof provider.run, 'function');
  }
});
