import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAhmia, onionFrom } from '../darkweb.js';

const V3 = 'a'.repeat(56); // a valid-length v3 onion label
const V3B = 'b'.repeat(56);

test('onionFrom: extracts the target from an Ahmia redirect href', () => {
  const href = `/search/redirect?search_term=india&redirect_url=${encodeURIComponent(`http://${V3}.onion/page`)}`;
  assert.equal(onionFrom(href), `http://${V3}.onion/page`);
});

test('onionFrom: handles a direct onion href and bare text', () => {
  assert.equal(onionFrom(`http://${V3}.onion/`), `http://${V3}.onion/`);
  assert.equal(onionFrom(`${V3}.onion`), `http://${V3}.onion`);
  assert.equal(onionFrom(''), '');
  assert.equal(onionFrom('/about'), '');
});

test('parseAhmia: parses the structured result markup', () => {
  const html = `
    <ol id="ahmia-results">
      <li class="result">
        <h4><a href="/search/redirect?redirect_url=${encodeURIComponent(`http://${V3}.onion/`)}">India Marketplace</a></h4>
        <cite>http://${V3}.onion/</cite>
        <p>Some indexed description about india.</p>
      </li>
      <li class="result">
        <h4><a href="/search/redirect?redirect_url=${encodeURIComponent(`http://${V3B}.onion/`)}">Second Site</a></h4>
        <cite>http://${V3B}.onion/</cite>
        <p>Another snippet.</p>
      </li>
    </ol>`;
  const r = parseAhmia(html);
  assert.equal(r.length, 2);
  assert.equal(r[0].title, 'India Marketplace');
  assert.equal(r[0].onion, `http://${V3}.onion/`);
  assert.match(r[0].description, /indexed description/);
});

test('parseAhmia: falls back to scanning anchors when the row markup changes', () => {
  // Simulates Ahmia dropping the li.result class — only anchors carry the onion.
  const html = `
    <div class="searchResults">
      <article><a href="http://${V3}.onion/">Leak Forum</a><span>desc</span></article>
      <article><a href="/r?redirect_url=${encodeURIComponent(`http://${V3B}.onion/x`)}">Paste Site</a></article>
    </div>`;
  const r = parseAhmia(html);
  assert.equal(r.length, 2);
  assert.equal(r[0].onion, `http://${V3}.onion/`);
  assert.equal(r[0].title, 'Leak Forum');
  assert.equal(r[1].onion, `http://${V3B}.onion/x`);
});

test('parseAhmia: de-dupes repeated onion hosts and returns [] for no onions', () => {
  const dup = `<ol><li><a href="http://${V3}.onion/a">One</a></li><li><a href="http://${V3}.onion/b">Dup</a></li></ol>`;
  assert.equal(parseAhmia(dup).length, 1);
  assert.deepEqual(parseAhmia('<html><body><p>nothing here</p></body></html>'), []);
});
