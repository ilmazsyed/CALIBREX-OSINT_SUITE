import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupe } from '../feeds.js';

test('identical social text from different authors is preserved for chatter analysis', () => {
  const items = [
    { id: '1', title: 'Port closure reported at strategic terminal', kind: 'social', authorId: 'acct-a' },
    { id: '2', title: 'Port closure reported at strategic terminal', kind: 'social', authorId: 'acct-b' },
    { id: '3', title: 'Port closure reported at strategic terminal', kind: 'social', authorId: 'acct-c' },
  ];
  assert.equal(dedupe(items).length, 3);
});

test('duplicate non-social headlines remain collapsed', () => {
  const items = [
    { id: '1', title: 'Central bank holds interest rates', kind: 'news' },
    { id: '2', title: 'Central bank holds interest rates', kind: 'news' },
  ];
  assert.equal(dedupe(items).length, 1);
});
