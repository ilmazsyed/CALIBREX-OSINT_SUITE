import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeedXml, parseTelegram, parseBlueskyFeed, toItems } from '../feeds.js';
import { extractArticle } from '../article.js';
import { satelliteFor, videoEmbed, cleanMedia } from '../visuals.js';

test('RSS media tags, enclosures and inline pictures become item media', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
    <item><title>Missile strike damages port in Odesa</title><link>https://ex.com/a</link><pubDate>${new Date().toUTCString()}</pubDate>
      <media:content url="https://cdn.ex.com/port.jpg" medium="image"/><media:thumbnail url="https://cdn.ex.com/logo.png"/>
      <enclosure url="https://cdn.ex.com/clip.mp4" type="video/mp4"/></item>
    <item><title>Drone attack on refinery near Kharkiv</title><link>https://ex.com/b</link>
      <description><![CDATA[<p><img src="/img/fire.jpg" width="800"> Smoke rose over the plant.</p>]]></description></item>
  </channel></rss>`;
  const entries = parseFeedXml(xml);
  assert.deepEqual(entries[0].media.map(m => m.type), ['image', 'video']); // logo dropped
  assert.equal(entries[1].media[0].src, 'https://ex.com/img/fire.jpg');
  const items = toItems(entries, { outlet: 'Ex' });
  assert.equal(items[0].media[0].src, 'https://cdn.ex.com/port.jpg');
});

test('YouTube Atom entries become privacy-mode embeds', () => {
  const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015"><entry><yt:videoId>dQw4w9WgXcQ</yt:videoId><title>Briefing</title><link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/><published>${new Date().toISOString()}</published></entry></feed>`;
  const [e] = parseFeedXml(xml);
  assert.equal(e.media[0].type, 'embed');
  assert.equal(e.media[0].src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(videoEmbed('https://youtu.be/dQw4w9WgXcQ').poster, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
});

test('Telegram photos and videos are picked up from the channel preview', () => {
  const html = `<div class="tgme_widget_message" data-post="ch/5"><a class="tgme_widget_message_photo_wrap" style="width:100px;background-image:url('https://cdn4.telesco.pe/file/a.jpg')"></a>
    <div class="tgme_widget_message_video_player"><i class="tgme_widget_message_video_thumb" style="background-image:url('https://cdn4.telesco.pe/file/t.jpg')"></i><video src="https://cdn4.telesco.pe/file/v.mp4"></video></div>
    <div class="tgme_widget_message_text">Explosion filmed near the airbase</div><time datetime="2026-09-27T10:00:00+00:00"></time></div>`;
  const [e] = parseTelegram(html);
  assert.deepEqual(e.media, [{ type: 'image', src: 'https://cdn4.telesco.pe/file/a.jpg', alt: '' }, { type: 'video', src: 'https://cdn4.telesco.pe/file/v.mp4', poster: 'https://cdn4.telesco.pe/file/t.jpg' }]);
});

test('Bluesky posts carry images and video stills; reposts are skipped', () => {
  const json = { feed: [
    { post: { uri: 'at://did:plc:x/app.bsky.feed.post/abc', author: { handle: 'geoconfirmed.org' }, record: { text: 'Geolocated strike in Khan Younis', createdAt: new Date().toISOString() },
      embed: { $type: 'app.bsky.embed.images#view', images: [{ thumb: 'https://cdn.bsky.app/t.jpg', fullsize: 'https://cdn.bsky.app/f.jpg', alt: 'Crater' }] } } },
    { post: { uri: 'at://did:plc:x/app.bsky.feed.post/def', author: { handle: 'geoconfirmed.org' }, record: { text: 'Video of convoy' }, embed: { $type: 'app.bsky.embed.video#view', thumbnail: 'https://video.bsky.app/th.jpg', playlist: 'https://video.bsky.app/p.m3u8' } } },
    { reason: { $type: 'app.bsky.feed.defs#reasonRepost' }, post: { uri: 'at://x/app.bsky.feed.post/zzz', record: { text: 'repost' } } },
  ] };
  const e = parseBlueskyFeed(json, 'geoconfirmed.org');
  assert.equal(e.length, 2);
  assert.equal(e[0].link, 'https://bsky.app/profile/geoconfirmed.org/post/abc');
  assert.deepEqual(e[0].media[0], { type: 'image', src: 'https://cdn.bsky.app/f.jpg', alt: 'Crater' });
  assert.equal(e[1].media[0].type, 'external-video');
});

test('articles yield lead image, captioned photos and embedded video', () => {
  const para = 'Security forces said the attack began at dawn when gunmen opened fire on a checkpoint outside the town. ';
  const html = `<html><head><meta property="og:image" content="https://news.ex/lead.jpg"></head><body><article>
    ${Array.from({ length: 6 }, () => `<p>${para}</p>`).join('')}
    <figure><img data-src="/photos/scene.jpg" src="data:image/gif;base64,R0l"><figcaption>The scene after the attack</figcaption></figure>
    <img src="/icons/share.png" width="24"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></article></body></html>`;
  const a = extractArticle(html, 'https://news.ex/story');
  assert.deepEqual(a.media.map(m => m.type), ['image', 'embed', 'image']);
  assert.equal(a.media[2].src, 'https://news.ex/photos/scene.jpg');
  assert.equal(a.media[2].alt, 'The scene after the attack');
});

test('satellite views for a place: NASA daily imagery, fire detections, reference imagery, viewer links', () => {
  const s = satelliteFor(31.83, 70.9, 'Dera Ismail Khan');
  assert.equal(s.panels.length, 4);
  assert.match(s.panels[0].src, /^https:\/\/gibs\.earthdata\.nasa\.gov\/wms\/epsg4326\/best\/wms\.cgi\?.*LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor.*BBOX=31\.23,/);
  assert.match(s.panels[2].src, /MODIS_Combined_Thermal_Anomalies_Day/);
  assert.match(s.panels[3].src, /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/export\?bbox=70\.8/);
  assert.ok(s.links.every(l => l.url.startsWith('https://')));
  assert.equal(satelliteFor(NaN, 1), null);
  assert.equal(cleanMedia([{ type: 'image', src: 'https://a/x.jpg' }, { type: 'image', src: 'https://a/x.jpg' }]).length, 1);
});
