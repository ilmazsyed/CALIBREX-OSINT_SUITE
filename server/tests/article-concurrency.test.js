import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireHostSlot } from '../article.js';

test('outbound requests are limited per publisher host and queued fairly', async () => {
  const releaseA = await acquireHostSlot('publisher.example');
  const releaseB = await acquireHostSlot('publisher.example');
  let thirdGranted = false;
  const third = acquireHostSlot('publisher.example').then(release => { thirdGranted = true; return release; });
  await Promise.resolve();
  assert.equal(thirdGranted, false, 'third same-host request waits while two slots are active');
  releaseA();
  const releaseC = await third;
  assert.equal(thirdGranted, true, 'queued request receives the released slot');
  releaseB();
  releaseC();
});

test('publisher host queues are bounded to prevent unbounded memory growth', async () => {
  const releases = [await acquireHostSlot('queue-limit.example'), await acquireHostSlot('queue-limit.example')];
  const waiting = Array.from({ length: 12 }, () => acquireHostSlot('queue-limit.example'));
  await assert.rejects(acquireHostSlot('queue-limit.example'), /temporarily at its request limit/);
  releases.forEach(release => release());
  await Promise.all(waiting.map(async pending => { const release = await pending; release(); }));
});

test('different publisher hosts have independent concurrency slots', async () => {
  const releaseA = await acquireHostSlot('first.example');
  const releaseB = await acquireHostSlot('second.example');
  releaseA();
  releaseB();
});
