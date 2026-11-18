import test from 'node:test';
import assert from 'node:assert/strict';
import { assessObservationQuality, rankIntelligenceItems } from '../intelligence-quality.js';

test('relevance outweighs freshness enough to keep unrelated breaking items below direct matches', () => {
  const now = Date.parse('2026-11-18T10:00:00Z');
  const ranked = rankIntelligenceItems([{ title: 'Unrelated celebrity announcement', published: now }, { title: 'Kolkata port closure disrupts container shipping', published: now - 8 * 3600000, url: 'https://port.example/news/1' }], { query: 'Kolkata port shipping disruption', now, halfLifeHours: 24 });
  assert.match(ranked[0].title, /Kolkata port/); assert.equal(ranked[0].intelligenceQuality.rank, 1);
});
test('unknown publication time is not silently treated as fresh', () => {
  const q = assessObservationQuality({ title: 'Port closure', capturedAt: Date.parse('2026-11-18T09:00:00Z') }, { query: 'port closure', now: Date.parse('2026-11-18T10:00:00Z') });
  assert.equal(q.publishedAt, null); assert.equal(q.freshness, 25); assert.ok(q.metadataGaps.includes('publication time unavailable')); assert.equal(q.nextAction, 'VERIFY_METADATA');
});
test('future timestamps are flagged for verification', () => {
  const now = Date.parse('2026-11-18T10:00:00Z'); const q = assessObservationQuality({ title: 'Port closure', published: now + 3600000 }, { query: 'port closure', now });
  assert.equal(q.futureSkew, true); assert.ok(q.metadataGaps.some(x => x.includes('future'))); assert.equal(q.nextAction, 'VERIFY_METADATA');
});
test('social observations carry a corroboration action', () => {
  const q = assessObservationQuality({ title: 'Factory fire reported', kind: 'social', published: Date.parse('2026-11-18T09:30:00Z') }, { query: 'factory fire', now: Date.parse('2026-11-18T10:00:00Z') });
  assert.equal(q.nextAction, 'CORROBORATE_BEFORE_RELIANCE'); assert.match(q.rankingNote, /do not establish accuracy/);
});
test('ranking is stable for equal scores', () => {
  const ranked = rankIntelligenceItems([{ title: 'A', published: 1000 }, { title: 'B', published: 1000 }], { now: 2000 });
  assert.deepEqual(ranked.map(x => x.title), ['A', 'B']); assert.deepEqual(ranked.map(x => x.intelligenceQuality.rank), [1, 2]);
});
