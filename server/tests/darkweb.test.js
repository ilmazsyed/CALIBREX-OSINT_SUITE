import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResults, onionFrom, extractIndicators, classify, summarise } from '../darkweb.js';

const V3 = 'a'.repeat(56);  // valid-length v3 onion label
const V3B = 'b'.repeat(56);
const V2 = 'c'.repeat(16);  // legacy v2 label
const AHMIA = 'juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion';

test('onionFrom: redirect, direct, www and bare-text extraction', () => {
  assert.equal(onionFrom(`/r?redirect_url=${encodeURIComponent(`http://${V3}.onion/p`)}`), `http://${V3}.onion/p`);
  assert.equal(onionFrom(`http://${V3}.onion/`), `http://${V3}.onion/`);
  assert.equal(onionFrom(`http://www.${V3}.onion/x`), `http://www.${V3}.onion/x`);
  assert.equal(onionFrom(`${V3}.onion`), `http://${V3}.onion`);
  assert.equal(onionFrom(''), '');
});

test('parseResults: reads Onion Search Engine style rows with titles + snippets', () => {
  const html = `
    <header><a href="https://onionsearchengine.com/index.php">home</a></header>
    <div class="results">
      <div class="result">
        <h3>Onion Link <a href="http://${V3}.onion/">MixTum Bitcoin Mixer Tumbler</a></h3>
        <a href="http://${V3}.onion/">${V3}.onion</a>
        <span>Mix your coins now. Clearnet mirror at mixtum.io</span>
        <a href="https://onionsearchengine.com/report_page.php?url=${V3}.onion">Report this result</a>
      </div>
      <div class="result">
        <h3>Onion Link <a href="http://${V2}.onion/">Old Legacy Wiki Directory</a></h3>
        <span>A directory of links.</span>
      </div>
    </div>`;
  const r = parseResults(html, 'Onion Search Engine');
  assert.equal(r.length, 2);
  assert.equal(r[0].title, 'MixTum Bitcoin Mixer Tumbler');
  assert.equal(r[0].onion, `http://${V3}.onion/`);
  assert.equal(r[0].category, 'crypto');
  assert.equal(r[0].version, 'v3');
  assert.equal(r[0].live, true);
  assert.ok(/mixtum\.io/.test(r[0].description) || r[0].indicators.clearnet.includes('mixtum.io'));
  assert.equal(r[1].version, 'v2');
  assert.equal(r[1].live, false);
  assert.equal(r[1].category, 'wiki');
});

test('parseResults: skips engine self-links and chrome onions, de-dupes by host', () => {
  const html = `
    <footer><a href="http://${AHMIA}/">Ahmia onion</a></footer>
    <a href="http://${V3}.onion/a">Alpha</a>
    <a href="http://${V3}.onion/b">Alpha dup path</a>
    <a href="https://onionsearchengine.com/report_page.php?url=${V3B}.onion">Report this result</a>`;
  const r = parseResults(html, 'x');
  // AHMIA chrome excluded; V3 de-duped to one; report_page link ignored
  assert.equal(r.length, 1);
  assert.equal(r[0].host, `${V3}.onion`);
  assert.ok(!r.some(h => h.host === AHMIA));
});

test('parseResults: falls back to legacy ahmia rows when no anchors resolve', () => {
  const html = `<ol id="ahmia-results"><li class="result"><cite>http://${V3}.onion/</cite><p>desc</p></li></ol>`;
  const r = parseResults(html, 'Ahmia');
  assert.equal(r.length, 1);
  assert.equal(r[0].host, `${V3}.onion`);
});

test('extractIndicators: wallets, emails, PGP, domains, handles; no ETH/PGP collision', () => {
  const text = 'mail vendor@example.com PGP ABCDEF0123456789ABCDEF0123456789ABCDEF01 ' +
    'btc 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 eth 0x52908400098527886E0F7030069857D2E4169EE7 ' +
    'mirror example-leaks.org tg @darkvendor';
  const ind = extractIndicators(text);
  assert.ok(ind.btc.length >= 1);
  assert.deepEqual(ind.emails, ['vendor@example.com']);
  assert.equal(ind.eth.length, 1);
  assert.equal(ind.pgp.length, 1); // the ETH 0x hash must NOT count as PGP
  assert.ok(ind.clearnet.includes('example-leaks.org'));
  assert.ok(ind.telegram.some(t => t.includes('darkvendor')));
});

test('classify + summarise', () => {
  assert.equal(classify('bitcoin mixer tumbler'), 'crypto');
  assert.equal(classify('random text'), 'other');
  assert.deepEqual(
    summarise([{ live: true, indicators: { count: 2 } }, { live: false, indicators: { count: 0 } }, { live: true, indicators: { count: 1 } }]),
    { total: 3, live: 2, dead: 1, withIndicators: 2 },
  );
});
