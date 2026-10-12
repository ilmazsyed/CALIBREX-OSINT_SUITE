import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGdeltQuery, gdeltDocEntries } from '../feeds.js';

test('toGdeltQuery: maps site:→domain:, drops when:, caps OR groups to 8', () => {
  assert.equal(toGdeltQuery('site:satp.org'), 'domain:satp.org');
  assert.equal(toGdeltQuery('(India OR Kashmir) attack when:1d'), '(India OR Kashmir) attack');
  const capped = toGdeltQuery('(a OR b OR c OR d OR e OR f OR g OR h OR i OR j)');
  assert.equal(capped, '(a OR b OR c OR d OR e OR f OR g OR h)');
  assert.ok(toGdeltQuery('("drone strike" OR missile) (India OR Pakistan)').includes('"drone strike"'));
});

test('gdeltDocEntries: maps articles to feed entries with domain source + ISO date', () => {
  const e = gdeltDocEntries({ articles: [
    { title: 'Missile strike reported', url: 'https://x.com/a', domain: 'x.com', seendate: '20261012T093000Z', socialimage: 'https://x.com/i.jpg' },
    { title: '', url: 'https://y.com' },            // dropped: no title
  ] });
  assert.equal(e.length, 1);
  assert.equal(e[0].title, 'Missile strike reported');
  assert.equal(e[0].link, 'https://x.com/a');
  assert.equal(e[0].source, 'x.com');
  assert.equal(e[0].date, '2026-10-12T09:30:00Z');
  assert.deepEqual(e[0].media, [{ type: 'image', url: 'https://x.com/i.jpg' }]);
});
