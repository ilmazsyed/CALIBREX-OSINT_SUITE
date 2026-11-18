import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicTarget } from '../article.js';

test('public hostname resolver accepts an array of valid public addresses', async () => {
  const result = await resolvePublicTarget('https://example.com/story', async () => [
    { address: '93.184.216.34', family: 4 }
  ]);
  assert.equal(result.addresses[0].address, '93.184.216.34');
});

test('public hostname resolver normalises a single valid address record', async () => {
  const result = await resolvePublicTarget('https://example.com/story', async () => ({
    address: '93.184.216.34', family: 4
  }));
  assert.equal(result.addresses.length, 1);
});

test('public hostname resolver rejects malformed DNS records with an actionable error', async () => {
  await assert.rejects(
    () => resolvePublicTarget('https://example.com/story', async () => [{ family: 4 }]),
    /did not resolve to a valid public IP address/
  );
});

test('public hostname resolver rejects private DNS destinations', async () => {
  await assert.rejects(
    () => resolvePublicTarget('https://example.com/story', async () => [
      { address: '192.168.1.10', family: 4 }
    ]),
    /not on the public internet/
  );
});

import { createPinnedLookup } from '../article.js';

test('pinned DNS callback returns the array shape required by Node when all=true', () => {
  const lookup = createPinnedLookup({ address: '93.184.216.34', family: 4 });
  lookup('example.com', { all: true }, (error, records) => {
    assert.ifError(error);
    assert.deepEqual(records, [{ address: '93.184.216.34', family: 4 }]);
  });
});

test('pinned DNS callback returns scalar address for ordinary Node lookup', () => {
  const lookup = createPinnedLookup({ address: '93.184.216.34', family: 4 });
  lookup('example.com', {}, (error, address, family) => {
    assert.ifError(error);
    assert.equal(address, '93.184.216.34');
    assert.equal(family, 4);
  });
});
