import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTarget } from '../recon.js';

test('parseTarget: recognises domains and IPs, extracts host from a URL, rejects junk', () => {
  assert.deepEqual(parseTarget('Example.COM'), { kind: 'domain', value: 'example.com' });
  assert.deepEqual(parseTarget('https://sub.example.co.uk/path?x=1'), { kind: 'domain', value: 'sub.example.co.uk' });
  assert.deepEqual(parseTarget('8.8.8.8'), { kind: 'ipv4', value: '8.8.8.8' });
  assert.deepEqual(parseTarget('[2001:4860:4860::8888]'), { kind: 'ipv6', value: '2001:4860:4860::8888' });
  assert.equal(parseTarget('not a domain'), null);
  assert.equal(parseTarget('john@example.com'), null); // an email is not an infrastructure target
  assert.equal(parseTarget(''), null);
  assert.equal(parseTarget('localhost'), null);
});
