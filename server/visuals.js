// Visual intelligence: pictures, video and satellite imagery for stories.
//  - Media found in feeds (RSS media tags, Telegram and Bluesky posts, YouTube)
//  - Media found in articles (lead image, photos in the story, embedded video)
//  - Satellite views of the place a story is about (NASA GIBS daily imagery,
//    NASA fire detections, Esri reference imagery), all free and keyless.

const BAD_IMAGE = /(logo|icon|avatar|sprite|placeholder|spacer|pixel|1x1|blank|badge|emoji|favicon|author|profile[-_]?pic|share[-_]?button|\.svg(\?|$))/i;

/** Make a URL absolute and https-only; null if unusable. */
export function absUrl(src, base) {
  if (!src || typeof src !== 'string') return null;
  const s = src.trim();
  if (!s || s.startsWith('data:') || s.startsWith('blob:')) return null;
  try {
    const u = new URL(s.startsWith('//') ? 'https:' + s : s, base || undefined);
    return /^https?:$/.test(u.protocol) ? u.toString() : null;
  } catch { return null; }
}

/** YouTube / Vimeo URLs -> privacy-friendly embed + poster. */
export function videoEmbed(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { type: 'embed', src: `https://www.youtube-nocookie.com/embed/${yt[1]}`, poster: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`, href: `https://www.youtube.com/watch?v=${yt[1]}` };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { type: 'embed', src: `https://player.vimeo.com/video/${vm[1]}`, poster: null, href: `https://vimeo.com/${vm[1]}` };
  return null;
}

/** Normalise and de-duplicate media entries; drop logos and icons. */
export function cleanMedia(list, max = 12) {
  const seen = new Set();
  const out = [];
  for (const m of list) {
    if (!m) continue;
    const key = m.src || m.href || m.poster;
    if (!key || seen.has(key)) continue;
    if (m.type === 'image' && BAD_IMAGE.test(m.src)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= max) break;
  }
  return out;
}

const pickSrcset = srcset => {
  if (!srcset) return null;
  const best = srcset.split(',').map(p => p.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 })).sort((a, b) => b.w - a.w)[0];
  return best?.u || null;
};

/** Image attributes, including lazy-loading variants. */
export function imgSource(el, base) {
  const src = el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || el.getAttribute('data-original') ||
    pickSrcset(el.getAttribute('srcset') || el.getAttribute('data-srcset')) || el.getAttribute('src');
  return absUrl(src, base);
}

/** Media carried in an RSS/Atom item (fast-xml-parser object). */
export function feedItemMedia(it, rawHtml, link) {
  const list = [];
  const arr = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const groups = [it, ...arr(it['media:group'])];
  for (const g of groups) {
    for (const c of arr(g['media:content'])) {
      const url = absUrl(c?.['@_url']);
      const type = String(c?.['@_type'] || c?.['@_medium'] || '');
      if (!url) continue;
      if (/video/.test(type)) list.push(videoEmbed(url) || { type: 'video', src: url, poster: null });
      else if (!type || /image/.test(type)) list.push({ type: 'image', src: url, alt: '' });
    }
    for (const t of arr(g['media:thumbnail'])) {
      const url = absUrl(t?.['@_url']);
      if (url) list.push({ type: 'image', src: url, alt: '' });
    }
  }
  for (const e of arr(it.enclosure)) {
    const url = absUrl(e?.['@_url']);
    const type = String(e?.['@_type'] || '');
    if (url && /^image\//.test(type)) list.push({ type: 'image', src: url, alt: '' });
    if (url && /^video\//.test(type)) list.push({ type: 'video', src: url, poster: null });
  }
  // YouTube Atom entries.
  const vid = it['yt:videoId'];
  if (vid) list.unshift(videoEmbed(`https://youtu.be/${vid}`));
  // First pictures inside the item's HTML.
  if (rawHtml) {
    for (const m of String(rawHtml).matchAll(/<img[^>]+?(?:data-src|src)=["']([^"']+)["']/gi)) {
      const url = absUrl(m[1].replace(/&amp;/g, '&'), link);
      if (url) list.push({ type: 'image', src: url, alt: '' });
      if (list.length > 6) break;
    }
  }
  return cleanMedia(list, 4);
}

/** Media from a Telegram web-preview message element. */
export function telegramMedia(m) {
  const list = [];
  const bg = el => el?.getAttribute('style')?.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/)?.[1];
  for (const p of m.querySelectorAll('.tgme_widget_message_photo_wrap')) {
    const url = absUrl(bg(p));
    if (url) list.push({ type: 'image', src: url, alt: '' });
  }
  for (const v of m.querySelectorAll('.tgme_widget_message_video_player')) {
    const src = absUrl(v.querySelector('video')?.getAttribute('src'));
    const poster = absUrl(bg(v.querySelector('.tgme_widget_message_video_thumb')));
    if (src || poster) list.push(src ? { type: 'video', src, poster } : { type: 'image', src: poster, alt: 'Video still' });
  }
  return cleanMedia(list, 6);
}

/** Media from a Bluesky post embed (public API view objects). */
export function blueskyMedia(embed, postUrl) {
  if (!embed) return [];
  const t = embed.$type || '';
  if (t.startsWith('app.bsky.embed.recordWithMedia')) return blueskyMedia(embed.media, postUrl);
  if (t.startsWith('app.bsky.embed.images')) return cleanMedia((embed.images || []).map(i => ({ type: 'image', src: absUrl(i.fullsize || i.thumb), alt: i.alt || '' })), 6);
  // Bluesky video is HLS, which browsers cannot all play inline: show the still and link to the post.
  if (t.startsWith('app.bsky.embed.video')) return embed.thumbnail ? [{ type: 'external-video', poster: absUrl(embed.thumbnail), href: postUrl }] : [];
  if (t.startsWith('app.bsky.embed.external')) {
    const ex = embed.external || {};
    const v = videoEmbed(ex.uri || '');
    if (v) return [v];
    return ex.thumb ? [{ type: 'image', src: absUrl(ex.thumb), alt: ex.title || '' }] : [];
  }
  return [];
}

/**
 * Media on an article page. Call BEFORE Readability runs (it rewrites the
 * document); `contentHtml` is Readability's cleaned story HTML, if available.
 */
export function pageMedia(document, url) {
  const meta = n => document.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.getAttribute('content') || '';
  const list = [];
  const lead = absUrl(meta('og:image') || meta('og:image:url') || meta('twitter:image') || meta('twitter:image:src'), url);
  if (lead) list.push({ type: 'image', src: lead, alt: meta('og:image:alt') || '' });
  const ogVideo = absUrl(meta('og:video:secure_url') || meta('og:video:url') || meta('og:video'), url);
  if (ogVideo) list.push(videoEmbed(ogVideo) || (/\.(mp4|webm)(\?|$)/i.test(ogVideo) ? { type: 'video', src: ogVideo, poster: lead } : null));
  const root = document.querySelector('article, [itemprop="articleBody"], main') || document.body;
  if (root) {
    for (const f of root.querySelectorAll('iframe')) list.push(videoEmbed(absUrl(f.getAttribute('src') || f.getAttribute('data-src'), url)));
    for (const v of root.querySelectorAll('video')) {
      const src = absUrl(v.getAttribute('src') || v.querySelector('source')?.getAttribute('src'), url);
      if (src && !src.endsWith('.m3u8')) list.push({ type: 'video', src, poster: absUrl(v.getAttribute('poster'), url) });
    }
    for (const img of root.querySelectorAll('img')) {
      const w = parseInt(img.getAttribute('width') || '0', 10);
      if (w && w < 250) continue;
      const src = imgSource(img, url);
      if (!src) continue;
      const cap = img.closest('figure')?.querySelector('figcaption')?.textContent?.replace(/\s+/g, ' ').trim() || img.getAttribute('alt') || '';
      list.push({ type: 'image', src, alt: cap.slice(0, 200) });
    }
  }
  return cleanMedia(list, 12);
}

// ---------------------------------------------------------------- satellite

const day = offset => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

/** Free satellite views of a location, plus links to interactive viewers. */
export function satelliteFor(lat, lng, place = '') {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const box = (dLat) => {
    const dLng = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    return { s: +(lat - dLat).toFixed(4), n: +(lat + dLat).toFixed(4), w: +(lng - dLng).toFixed(4), e: +(lng + dLng).toFixed(4) };
  };
  const gibs = (layers, date, b, size = 900) =>
    `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layers}&STYLES=&CRS=EPSG:4326&BBOX=${b.s},${b.w},${b.n},${b.e}&WIDTH=${size}&HEIGHT=${size}&FORMAT=image/jpeg&TIME=${date}`;
  const esri = b => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${b.w},${b.s},${b.e},${b.n}&bboxSR=4326&imageSR=3857&size=900,900&format=jpg&f=image`;
  const wide = box(1.2);
  const mid = box(0.6);
  const near = box(0.08);
  const latest = day(1);
  const panels = [
    { id: 'viirs-latest', label: `NASA VIIRS true colour · ${latest}`, date: latest, src: gibs('VIIRS_NOAA20_CorrectedReflectance_TrueColor', latest, mid),
      note: 'Daily satellite pass (about 375 m per pixel). Shows smoke plumes, fire scars, floods, dust and cloud; too coarse for vehicles or buildings.' },
    { id: 'viirs-week', label: `Same area 7 days earlier · ${day(8)}`, date: day(8), src: gibs('VIIRS_NOAA20_CorrectedReflectance_TrueColor', day(8), mid),
      note: 'Compare with the latest pass to spot new smoke, burn scars or flooding.' },
    { id: 'fires', label: `Heat and fire detections · ${latest}`, date: latest, src: gibs('VIIRS_NOAA20_CorrectedReflectance_TrueColor,MODIS_Combined_Thermal_Anomalies_Day', latest, wide),
      note: 'Red/orange dots are thermal anomalies detected by NASA satellites: fires, explosions, flaring. Wider area.' },
    { id: 'esri', label: 'High-resolution reference imagery', date: null, src: esri(near),
      note: 'Esri World Imagery around the mapped point. Capture date varies (often months or years old): use it for terrain and layout, not current events.' },
  ];
  const links = [
    { label: 'NASA Worldview (daily imagery, any date)', url: `https://worldview.earthdata.nasa.gov/?v=${wide.w},${wide.s},${wide.e},${wide.n}&t=${latest}&l=VIIRS_NOAA20_CorrectedReflectance_TrueColor,MODIS_Combined_Thermal_Anomalies_Day,Coastlines_15m` },
    { label: 'NASA FIRMS fire map', url: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lng.toFixed(3)},${lat.toFixed(3)},9z` },
    { label: 'Sentinel Hub EO Browser (10 m Sentinel-2, free account)', url: `https://apps.sentinel-hub.com/eo-browser/?zoom=12&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}` },
    { label: 'Zoom Earth', url: `https://zoom.earth/maps/satellite/#view=${lat.toFixed(3)},${lng.toFixed(3)},10z` },
    { label: 'Google Maps satellite', url: `https://www.google.com/maps/@${lat.toFixed(5)},${lng.toFixed(5)},12000m/data=!3m1!1e3` },
  ];
  return { place, lat, lng, panels, links, precision: 'Map point is the centre of the place named in the report, not the exact incident location.' };
}
