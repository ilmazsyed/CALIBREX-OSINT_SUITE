import { test } from 'node:test';
import assert from 'node:assert/strict';

// Configure the cap before importing the module (it reads env at load).
process.env.OUTBOUND_HOST_CONCURRENCY = '3';
const { withHostConcurrency } = await import('../article.js');

test('per-host concurrency never exceeds the cap', async () => {
  let active = 0, peak = 0;
  const task = () => new Promise(r => { active++; peak = Math.max(peak, active); setTimeout(() => { active--; r('ok'); }, 5); });
  const out = await Promise.all(Array.from({ length: 12 }, () => withHostConcurrency('a.example', task)));
  assert.equal(out.length, 12);
  assert.ok(peak <= 3, `peak ${peak} should be <= 3`);
});

test('different hosts run in parallel (not serialised by one gate)', async () => {
  let active = 0, peak = 0;
  const task = () => new Promise(r => { active++; peak = Math.max(peak, active); setTimeout(() => { active--; r(); }, 10); });
  await Promise.all(['h1', 'h2', 'h3', 'h4'].map(h => withHostConcurrency(h, task)));
  assert.ok(peak >= 2, 'multiple hosts should overlap');
});

test('bounded waiter queue sheds load instead of growing unbounded', async () => {
  let releaseAll;
  const barrier = new Promise(r => { releaseAll = r; });  // all tasks hold until released
  const slow = () => barrier;
  const inflight = [];
  for (let i = 0; i < 3 + 64; i++) inflight.push(withHostConcurrency('shed.example', slow).catch(e => e));
  let rejected = null;
  try { await withHostConcurrency('shed.example', slow); } catch (e) { rejected = e; }
  assert.ok(rejected && /Too many concurrent/.test(rejected.message), 'the over-limit request should be rejected');
  releaseAll();                                           // let the 3 active + 64 queued all drain
  await Promise.allSettled(inflight);
});
