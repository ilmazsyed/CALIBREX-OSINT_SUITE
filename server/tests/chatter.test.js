import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeChatter, chatterReport } from '../chatter.js';

const now = 1_700_000_000_000;
const h = n => now - n * 3600000;
const post = (id, title, source, ago) => ({ id, title, summary: '', kind: 'social', source, wire: 'REGIONAL', severity: 'MEDIUM', url: `https://x/${id}`, published: h(ago) });

const items = [
  post('1', 'Drone strike reported near the border', 'Reddit r/worldnews', 1),
  post('2', 'Another drone strike overnight, border tension rising', 'Reddit r/geopolitics', 2),
  post('3', 'Drone footage of the border strike', 'Bluesky @osint', 3),
  post('4', 'Drone activity continues at the border', 'Reddit r/worldnews', 4),
  post('5', 'Old economics thread about inflation', 'Reddit r/Economics', 40), // older than 12h
  { id: '6', title: 'A news article, not social', kind: 'news', source: 'Reuters', wire: 'REGIONAL', severity: 'LOW', url: 'u', published: h(1) },
];

test('analyzeChatter: counts only social, ranks terms, flags rising, tallies sources', () => {
  const a = analyzeChatter(items, now);
  assert.equal(a.total, 5);            // 5 social, the news item excluded
  const drone = a.terms.find(t => t.term === 'drone');
  assert.equal(drone.count, 4);
  assert.equal(drone.rising, true);    // all 4 within last 12h
  const border = a.terms.find(t => t.term === 'border');
  assert.ok(border && border.count >= 4);
  assert.equal(a.sources[0].name, 'Reddit r/worldnews'); // most active (2 posts)
  assert.equal(a.byHour.length, 24);
});

test('chatterReport: readable brief with the top themes and posts', () => {
  const r = chatterReport(analyzeChatter(items, now));
  assert.match(r, /SOCIAL CHATTER REPORT/i);
  assert.match(r, /drone/);
  assert.match(r, /MOST ACTIVE COMMUNITIES/);
  assert.match(r, /unverified/i);
});
