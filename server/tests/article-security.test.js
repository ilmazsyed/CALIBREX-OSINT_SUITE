import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicUrl, privateIp } from '../article.js';

test('blocks non-public IPv4 destinations', () => {
  for (const ip of [
    '0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1',
    '169.254.169.254', '172.16.0.1', '192.168.1.1',
    '198.18.0.1', '224.0.0.1', '255.255.255.255',
  ]) assert.equal(privateIp(ip), true, ip);
});

test('blocks non-public and special-purpose IPv6 destinations', () => {
  for (const ip of [
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::a9fe:a9fe', 'fc00::1',
    'fe80::1', 'ff02::1', '2001:db8::1', '2002::1',
  ]) assert.equal(privateIp(ip), true, ip);
});

test('allows representative public unicast addresses', () => {
  assert.equal(privateIp('8.8.8.8'), false);
  assert.equal(privateIp('1.1.1.1'), false);
  assert.equal(privateIp('2606:4700:4700::1111'), false);
});

test('rejects loopback, credential-bearing and non-HTTP article URLs', async () => {
  await assert.rejects(assertPublicUrl('http://127.0.0.1/'), /public internet/);
  await assert.rejects(assertPublicUrl('http://169.254.169.254/latest/meta-data/'), /public internet/);
  await assert.rejects(assertPublicUrl('file:///etc/passwd'), /Only http and https/);
  await assert.rejects(assertPublicUrl('https://user:pass@example.com/'), /embedded credentials/);
  await assert.rejects(assertPublicUrl('https://example.com:8443/'), /port the reader does not open/);
});
