import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceRetryDelay, sourceFailureClass, gdeltBackoffMs } from '../feeds.js';

test('blocked publisher feeds are classified and cooled down without bypassing access controls', () => {
  assert.equal(sourceFailureClass('HTTP 403'), 'access_restricted');
  assert.equal(sourceRetryDelay('HTTP 403'), 6 * 60 * 60 * 1000);
  assert.equal(sourceFailureClass('HTTP 401'), 'access_restricted');
});

test('missing feed endpoints receive a longer repair cooldown', () => {
  assert.equal(sourceFailureClass('HTTP 404'), 'endpoint_missing');
  assert.equal(sourceRetryDelay('HTTP 404'), 24 * 60 * 60 * 1000);
  assert.equal(sourceRetryDelay('HTTP 410'), 24 * 60 * 60 * 1000);
});

test('rate limits and transient outages use bounded backoff', () => {
  assert.equal(sourceFailureClass('HTTP 429'), 'rate_limited');
  assert.equal(sourceRetryDelay('HTTP 429', 2), 10 * 60 * 1000);
  assert.equal(sourceFailureClass('HTTP 503'), 'upstream_unavailable');
  assert.equal(sourceRetryDelay('network timeout', 20), 15 * 60 * 1000);
});

test('successful sources do not receive a failure cooldown', () => {
  assert.equal(sourceFailureClass('invalid XML feed'), 'feed_invalid');
  assert.equal(sourceRetryDelay('connection reset', 1), 30 * 1000);
});

test('GDELT provider backoff grows after rate limits and remains bounded', () => {
  assert.equal(gdeltBackoffMs(1), 2 * 60 * 1000);
  assert.equal(gdeltBackoffMs(2), 4 * 60 * 1000);
  assert.equal(gdeltBackoffMs(20), 30 * 60 * 1000);
});
