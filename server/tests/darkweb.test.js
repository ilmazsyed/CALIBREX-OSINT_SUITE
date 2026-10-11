import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAhmia, onionFrom, extractIndicators, classify, summarise } from '../darkweb.js';

const V3 = 'a'.repeat(56);  // valid-length v3 onion label
const V3B = 'b'.repeat(56);
const V2 = 'c'.repeat(16);  // legacy v2 label
const AHMIA = 'juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion';

test('onionFrom: extracts the target from an Ahmia redirect href and direct links', () => {
  const href = `/search/redirect?search_term=x&redirect_url=${encodeURIComponent(`http://${V3}.onion/page`)}`;
  assert.equal(onionFrom(href), `http://${V3}.onion/page`);
  assert.equal(onionFrom(`http://${V3}.onion/`), `http://${V3}.onion/`);
  assert.equal(onionFrom(`${V3}.onion`), `http://${V3}.onion`);
  assert.equal(onionFrom(''), '');
});

test('parseAhmia: enriches structured rows with version, liveness and category', () => {
  const html = `
    <header><p>Ahmia on Tor: http://${AHMIA}/</p></header>
    <ol id="ahmia-results">
      <li class="result">
        <h4><a href="/search/redirect?redirect_url=${encodeURIComponent(`http://${V3}.onion/`)}">Alpha Market</a></h4>
        <cite>http://${V3}.onion/</cite>
        <p>Buy and sell with escrow.</p>
      </li>
      <li class="result">
        <h4><a href="/search/redirect?redirect_url=${encodeURIComponent(`http://${V2}.onion/`)}">Old Legacy Forum</a></h4>
        <cite>http://${V2}.onion/</cite>
        <p>Legacy discussion board.</p>
      </li>
    </ol>
    <footer><a href="http://${AHMIA}/">Ahmia</a></footer>`;
  const r = parseAhmia(html);
  assert.equal(r.length, 2);
  // Ahmia's own onion in header/footer must never appear
  assert.ok(!r.some(h => h.host === AHMIA));
  assert.equal(r[0].title, 'Alpha Market');
  assert.equal(r[0].version, 'v3');
  assert.equal(r[0].live, true);
  assert.equal(r[0].category, 'market');
  assert.equal(r[1].version, 'v2');
  assert.equal(r[1].live, false);
  assert.equal(r[1].category, 'forum');
});

test('parseAhmia: falls back to anchors but still strips Ahmia chrome', () => {
  const html = `
    <nav><a href="http://${AHMIA}/">home</a></nav>
    <div class="searchResults">
      <article><a href="http://${V3}.onion/">Leak DB</a></article>
      <article><a href="/r?redirect_url=${encodeURIComponent(`http://${V3B}.onion/x`)}">Paste Site</a></article>
    </div>`;
  const r = parseAhmia(html);
  assert.equal(r.length, 2);
  assert.ok(!r.some(h => h.host === AHMIA));
  assert.equal(r[0].host, `${V3}.onion`);
  assert.equal(r[1].onion, `http://${V3B}.onion/x`);
});

test('extractIndicators: pulls wallets, emails, PGP, domains and handles', () => {
  const text = 'Contact vendor@example.com PGP ABCDEF0123456789ABCDEF0123456789ABCDEF01 ' +
    'pay to 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 or bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq ' +
    'mirror at example-leaks.org tg @darkvendor';
  const ind = extractIndicators(text);
  assert.ok(ind.btc.length >= 1);
  assert.deepEqual(ind.emails, ['vendor@example.com']);
  assert.equal(ind.pgp[0], 'ABCDEF0123456789ABCDEF0123456789ABCDEF01');
  assert.ok(ind.clearnet.includes('example-leaks.org'));
  assert.ok(ind.telegram.some(t => t.includes('darkvendor')));
  assert.ok(ind.count >= 5);
});

test('extractIndicators: does not treat an ETH 0x hash as a PGP fingerprint', () => {
  const ind = extractIndicators('wallet 0x52908400098527886E0F7030069857D2E4169EE7 here');
  assert.equal(ind.eth.length, 1);
  assert.equal(ind.pgp.length, 0);
});

test('classify + summarise roll up correctly', () => {
  assert.equal(classify('bitcoin mixer tumbler'), 'crypto');
  assert.equal(classify('random text'), 'other');
  const s = summarise([
    { live: true, indicators: { count: 2 } },
    { live: false, indicators: { count: 0 } },
    { live: true, indicators: { count: 1 } },
  ]);
  assert.deepEqual(s, { total: 3, live: 2, dead: 1, withIndicators: 2 });
});
