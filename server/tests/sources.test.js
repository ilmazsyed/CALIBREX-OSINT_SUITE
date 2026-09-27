import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTelegram, parseFeedXml, toItems, buildAlerts } from '../feeds.js';
import { extractArticle, assertPublicUrl } from '../article.js';
import { sourceUrl, BUILTIN_SOURCES } from '../sources.js';

test('telegram: parses the public channel preview, newest first', () => {
  const html = `<html><body>
    <div class="tgme_widget_message" data-post="osintlive/100"><div class="tgme_widget_message_text">Drone strike hits fuel depot in Kharkiv overnight</div><a class="tgme_widget_message_date"><time datetime="2026-09-27T10:00:00+00:00"></time></a></div>
    <div class="tgme_widget_message" data-post="osintlive/101"><div class="tgme_widget_message_text">Missile attack reported near <b>Odesa</b> port</div><a class="tgme_widget_message_date"><time datetime="2026-09-27T11:00:00+00:00"></time></a></div>
  </body></html>`;
  const e = parseTelegram(html);
  assert.equal(e.length, 2);
  assert.equal(e[0].link, 'https://t.me/osintlive/101');
  assert.equal(e[0].title, 'Missile attack reported near Odesa port');
  assert.equal(Date.parse(e[0].date), Date.parse('2026-09-27T11:00:00Z'));
});

test('bluesky: posts without titles use the post text, marked social', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>@geoconfirmed.org</title>
    <item><link>https://bsky.app/profile/geoconfirmed.org/post/1</link><description>GeoConfirmed: airstrike on a convoy near Khan Younis, geolocated.</description><pubDate>${new Date().toUTCString()}</pubDate></item>
  </channel></rss>`;
  const entries = parseFeedXml(xml);
  const items = toItems(entries, { outlet: 'GeoConfirmed (@geoconfirmed.org)', kind: 'social', sourceId: 'bsky-geoconfirmed' });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'social');
  assert.equal(items[0].place.name, 'Gaza');
  assert.match(items[0].title, /airstrike on a convoy/);
  // Social posts never raise alerts on their own.
  assert.equal(buildAlerts([{ ...items[0], severity: 'CRITICAL' }]).length, 0);
});

test('summaries help sort and place outlet items; undated items get a stable first-seen date', () => {
  const entries = [{ title: 'Security review meeting held', link: 'https://x/1', date: '', summary: 'Officials discussed infiltration along the LoC in Kupwara after an encounter.' }];
  const [a] = toItems(entries, { outlet: 'PIB', kind: 'official' });
  assert.equal(a.wire, 'SATP');
  assert.equal(a.place.name, 'Kashmir');
  const [b] = toItems(entries, { outlet: 'PIB', kind: 'official' });
  assert.equal(a.published, b.published);
});

test('article extraction pulls the story text and metadata', () => {
  const para = 'Security forces said the attack began at dawn when gunmen opened fire on a checkpoint outside the town. ';
  const html = `<html><head><title>Attack on checkpoint</title><meta property="og:site_name" content="Example News"><meta property="article:published_time" content="2026-09-27T08:00:00Z"></head>
    <body><nav>Home | World | Sport</nav><article><h1>Attack on checkpoint</h1>${Array.from({ length: 8 }, (_, i) => `<p>${para}Paragraph ${i + 1}.</p>`).join('')}</article><footer>Subscribe now</footer></body></html>`;
  const a = extractArticle(html, 'https://example.com/story');
  assert.equal(a.siteName, 'Example News');
  assert.equal(a.published, Date.parse('2026-09-27T08:00:00Z'));
  assert.ok(a.words > 100);
  assert.ok(a.paragraphs.length >= 8);
  assert.ok(!a.text.includes('Subscribe now'));
});

test('reader refuses private and non-web addresses', async () => {
  for (const bad of ['http://127.0.0.1/', 'http://10.0.0.5/x', 'http://[::1]/', 'file:///etc/passwd', 'http://169.254.169.254/latest', 'https://example.com:8443/']) {
    await assert.rejects(assertPublicUrl(bad), undefined, bad);
  }
});

test('source catalogue: unique ids and valid addresses', () => {
  const ids = BUILTIN_SOURCES.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of BUILTIN_SOURCES) assert.match(sourceUrl(s), /^https:\/\//, s.id);
  assert.equal(sourceUrl({ type: 'mastodon', handle: 'user@infosec.exchange' }), 'https://infosec.exchange/@user.rss');
  assert.equal(sourceUrl({ type: 'telegram', handle: 'https://t.me/s/osintlive' }), 'https://t.me/s/osintlive');
});

test('India Today OSINT: Google News search limited to indiatoday.in, keeps untagged stories', () => {
  const src = BUILTIN_SOURCES.find(s => s.id === 'indiatoday-osint');
  const url = sourceUrl(src);
  assert.match(decodeURIComponent(url), /site:indiatoday\.in .*OSINT.* when:3d/);
  const items = toItems([{ title: 'OSINT: Satellite images show new airstrip near the border - India Today', link: 'https://news.google.com/rss/articles/x', date: new Date().toUTCString(), source: 'India Today' }],
    { kind: 'analysis', sourceId: src.id, fallbackWire: src.fallbackWire });
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'India Today');
  assert.equal(items[0].title, 'OSINT: Satellite images show new airstrip near the border');
  assert.equal(items[0].wire, 'REGIONAL');
});

test('SATP and ORBAT sources: searches and YouTube feed file untagged items under the right wire', () => {
  const yt = BUILTIN_SOURCES.find(s => s.id === 'satp-youtube');
  const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Weekly assessment: the security situation</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc"/><published>${new Date().toISOString()}</published></entry></feed>`;
  const [item] = toItems(parseFeedXml(xml), { outlet: yt.name, kind: yt.kind, fallbackWire: yt.fallbackWire });
  assert.equal(item.wire, 'SATP');
  assert.equal(item.url, 'https://www.youtube.com/watch?v=abc');
  for (const id of ['satp-site', 'satp-cited', 'orbat-search']) assert.match(sourceUrl(BUILTIN_SOURCES.find(s => s.id === id)), /^https:\/\/news\.google\.com\/rss\/search\?q=/);
});
