import { test } from 'node:test';
import assert from 'node:assert/strict';
import { camerasCatalogue } from '../cameras.js';

test('camera catalogue never leaks raw MJPEG source URLs to the client', () => {
  const cams = camerasCatalogue();
  assert.ok(cams.length > 0, 'catalogue should not be empty');
  for (const c of cams) {
    assert.ok(!('src' in c), `${c.id} must not expose its upstream src`);
    if (c.kind === 'mjpeg') {
      assert.equal(c.stream, `/api/camera/${c.id}`, 'MJPEG cams route through the same-origin proxy');
      assert.ok(!/^https?:/.test(c.stream), 'proxy path must be relative, not an upstream URL');
    }
  }
});

test('YouTube cameras carry a channel id and no upstream url', () => {
  const yt = camerasCatalogue().filter(c => c.kind === 'youtube');
  assert.ok(yt.length > 0, 'expected at least one live-TV camera');
  for (const c of yt) {
    assert.match(c.channel, /^UC[\w-]{20,}$/, `${c.id} should have a valid channel id`);
    assert.ok(!('stream' in c) && !('src' in c));
  }
});
