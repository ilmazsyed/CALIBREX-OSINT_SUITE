// Article reader: fetches a story page and extracts its main text, so the app
// can work from full articles rather than headlines alone.
//  - Google News links are resolved to the publisher's URL first.
//  - Only public http(s) addresses are fetched (private and local networks are refused).
//  - Results are cached in memory for 6 hours.
import dns from 'dns/promises';
import net from 'net';
import crypto from 'crypto';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { pageMedia } from './visuals.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const CACHE_MS = 6 * 3600000;
const cache = new Map(); // url -> { at, value | error }

// Bound concurrent outbound requests per publisher. This prevents a burst of
// investigations from opening an unbounded number of sockets to one host.
const MAX_PER_HOST = 2;
const MAX_QUEUED_PER_HOST = 12;
const hostSlots = new Map();

export async function acquireHostSlot(host) {
  const key = String(host || '').toLowerCase();
  let slot = hostSlots.get(key);
  if (!slot) { slot = { active: 0, waiters: [] }; hostSlots.set(key, slot); }
  const releaseFor = state => {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = state.waiters.shift();
      if (next) next(releaseFor(state));
      else state.active = Math.max(0, state.active - 1);
      if (state.active === 0 && state.waiters.length === 0) hostSlots.delete(key);
    };
  };
  if (slot.active < MAX_PER_HOST) {
    slot.active += 1;
    return releaseFor(slot);
  }
  if (slot.waiters.length >= MAX_QUEUED_PER_HOST) {
    throw new Error('This publisher is temporarily at its request limit. Try again shortly.');
  }
  return new Promise(resolve => slot.waiters.push(resolve));
}

// ---------------------------------------------------------------- network safety

const BLOCKED_NETWORKS = new net.BlockList();
for (const [subnet, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) BLOCKED_NETWORKS.addSubnet(subnet, prefix, 'ipv4');
for (const [subnet, prefix] of [
  ['::', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48],
  ['100::', 64], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7],
  ['fe80::', 10], ['ff00::', 8],
]) BLOCKED_NETWORKS.addSubnet(subnet, prefix, 'ipv6');

export function privateIp(ip) {
  const family = net.isIP(ip);
  if (!family) return true;
  if (family === 4) return BLOCKED_NETWORKS.check(ip, 'ipv4');
  const lower = ip.toLowerCase();
  // IPv4-mapped IPv6 addresses must be checked against IPv4 ranges. Node's
  // BlockList treats IPv4 as mapped internally, so blocking ::ffff:0:0/96
  // would accidentally reject every IPv4 destination.
  if (lower.startsWith('::ffff:')) {
    const tail = lower.slice(7);
    if (tail.includes('.')) return privateIp(tail);
    const words = tail.split(':');
    if (words.length !== 2 || words.some(w => !/^[0-9a-f]{1,4}$/.test(w))) return true;
    const value = (parseInt(words[0], 16) * 65536) + parseInt(words[1], 16);
    return privateIp([value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.'));
  }
  return BLOCKED_NETWORKS.check(ip, 'ipv6');
}

export async function resolvePublicTarget(raw, lookup = dns.lookup) {
  let url;
  try { url = new URL(raw); } catch { throw Object.assign(new Error('That is not a valid web address.'), { status: 400 }); }
  if (!/^https?:$/.test(url.protocol)) throw Object.assign(new Error('Only http and https links can be read.'), { status: 400 });
  if (url.username || url.password) throw Object.assign(new Error('Links containing embedded credentials are not accepted.'), { status: 400 });
  if (url.port && !['80', '443'].includes(url.port)) throw Object.assign(new Error('That address uses a port the reader does not open.'), { status: 400 });
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host)
    ? [{ address: host, family: net.isIP(host) }]
    : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(a => privateIp(a.address))) {
    throw Object.assign(new Error('That address is not on the public internet.'), { status: 400 });
  }
  return { url, host, addresses };
}

export async function assertPublicUrl(raw) {
  return (await resolvePublicTarget(raw)).url;
}

/** GET with manual redirects so every hop is checked. */
export async function safeFetch(url, opts = {}, hops = 0, lookup = dns.lookup, requestImpl = null) {
  if (hops > 5) throw new Error('Too many redirects.');
  const target = await resolvePublicTarget(url, lookup);
  const releaseSlot = await acquireHostSlot(target.host);
  let released = false;
  let deadline = null;
  const releaseOnce = () => { if (!released) { released = true; if (deadline) clearTimeout(deadline); releaseSlot(); } };
  const address = target.addresses[0];
  const transport = target.url.protocol === 'https:' ? https : http;
  let response;
  try {
    response = await new Promise((resolve, reject) => {
      const request = requestImpl || transport.request.bind(transport);
      let settled = false;
      const req = request(target.url, {
        method: opts.method || 'GET',
        headers: { 'User-Agent': UA, 'Accept-Language': 'en', ...(opts.headers || {}) },
        // Pin the socket to the already-validated DNS answer. TLS still verifies
        // the certificate against the original hostname (not the pinned IP).
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
        ...(target.url.protocol === 'https:' && !net.isIP(target.host) ? { servername: target.host } : {}),
      }, incoming => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
        }
        incoming.once('end', releaseOnce);
        incoming.once('close', releaseOnce);
        incoming.once('error', releaseOnce);
        settled = true;
        resolve({ status: incoming.statusCode || 502, statusText: incoming.statusMessage, headers, body: Readable.toWeb(incoming), ok: (incoming.statusCode || 502) >= 200 && (incoming.statusCode || 502) < 300, _incoming: incoming });
      });
      // Enforce both an inactivity timeout and an absolute request/body deadline.
      req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('The publisher took too long to respond.')));
      deadline = setTimeout(() => req.destroy(new Error('The publisher exceeded the total response time limit.')), TIMEOUT_MS);
      deadline.unref?.();
      req.on('error', error => { releaseOnce(); if (!settled) reject(error); });
      if (opts.body != null) req.write(opts.body);
      req.end();
    });
  } catch (error) {
    releaseOnce();
    throw error;
  }
  if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
    // Redirect bodies are irrelevant; drain and free the host slot before
    // acquiring a slot for the next, independently validated hop.
    response._incoming.resume();
    releaseOnce();
    return safeFetch(new URL(response.headers.get('location'), target.url).toString(), opts, hops + 1, lookup, requestImpl);
  }
  const { _incoming, ...res } = response;
  return { res, url: target.url.toString() };
}

export async function readBody(res, maxBytes = MAX_BYTES, { truncate = true, binary = false } = {}) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { reader.cancel().catch(() => {}); if (!truncate) throw new Error('File too large.'); break; }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks);
  return binary ? buf : buf.toString('utf8');
}

// ---------------------------------------------------------------- Google News links

const isGoogleNews = u => /^https?:\/\/news\.google\.com\/(rss\/)?(articles|read)\//.test(u);

/**
 * Google News RSS links point at news.google.com, not the publisher. Resolve
 * them with the same two requests the Google News page itself makes.
 */
export async function resolveGoogleNews(url) {
  const id = new URL(url).pathname.split('/').pop();
  const { res } = await safeFetch(`https://news.google.com/rss/articles/${id}`);
  const html = await readBody(res);
  const sig = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sig || !ts) throw new Error('Google News did not reveal the original link.');
  const inner = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts), sig]);
  const body = 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]]));
  const { res: r2 } = await safeFetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
  });
  const text = await readBody(r2);
  const chunk = text.split('\n\n')[1];
  const decoded = JSON.parse(JSON.parse(chunk)[0][2])[1];
  if (!/^https?:\/\//.test(decoded)) throw new Error('Google News returned an unexpected link.');
  return decoded;
}

// ---------------------------------------------------------------- extraction

const clean = s => String(s || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

/** Extract the readable article from an HTML page. */
export function extractArticle(html, url) {
  const { document } = parseHTML(html);
  const meta = n => document.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.getAttribute('content') || '';
  const media = pageMedia(document, url); // before Readability rewrites the page
  const published = Date.parse(meta('article:published_time') || meta('og:published_time') || meta('date') || meta('pubdate') || document.querySelector('time[datetime]')?.getAttribute('datetime') || '') || null;
  let parsed = null;
  try { parsed = new Readability(document, { charThreshold: 300 }).parse(); } catch { /* fall through */ }
  let paragraphs = [];
  if (parsed?.content) {
    const { document: body } = parseHTML(`<div>${parsed.content}</div>`);
    paragraphs = [...body.querySelectorAll('p, li, h2, h3, blockquote')].map(p => clean(p.textContent)).filter(p => p.length > 1);
  }
  if (!paragraphs.length && parsed?.textContent) paragraphs = clean(parsed.textContent).split(/\n+/).filter(Boolean);
  const text = paragraphs.join('\n\n').slice(0, 30000);
  return {
    url,
    title: clean(parsed?.title || meta('og:title') || document.title),
    siteName: clean(parsed?.siteName || meta('og:site_name')) || new URL(url).hostname.replace(/^www\./, ''),
    byline: clean(parsed?.byline),
    published,
    excerpt: clean(parsed?.excerpt || meta('og:description') || meta('description')).slice(0, 400),
    image: meta('og:image') || null,
    paragraphs: text ? text.split('\n\n') : [],
    text,
    words: text ? text.split(/\s+/).length : 0,
    media,
  };
}

/** Fetch and extract an article. Throws with a readable message on failure. */
export async function readArticle(rawUrl) {
  const hit = cache.get(rawUrl);
  if (hit && Date.now() - hit.at < CACHE_MS) { if (hit.error) throw new Error(hit.error); return hit.value; }
  try {
    let url = rawUrl;
    if (isGoogleNews(url)) {
      try { url = await resolveGoogleNews(url); } catch (e) { throw new Error(`Could not open this Google News link (${e.message}). Use "Open original" instead.`); }
    }
    const { res, url: finalUrl } = await safeFetch(url);
    if (!res.ok) throw new Error(res.status === 403 || res.status === 401 ? 'The publisher blocks automated reading. Use "Open original".' : `The page returned HTTP ${res.status}.`);
    const type = res.headers.get('content-type') || '';
    if (!/html|xml/.test(type)) throw new Error('That link is not a web page (it may be a PDF or video). Use "Open original".');
    const article = extractArticle(await readBody(res), finalUrl);
    if (article.words < 60) throw new Error('Little readable text on that page (it may be paywalled, a video, or built with scripts). Use "Open original".');
    // Forensic provenance: a tamper-evident fingerprint of exactly what was
    // captured, at capture time. Re-hashing the same text later yields the same
    // digest; any later alteration of the source no longer matches this record.
    const capturedAt = Date.now();
    const canonical = `${finalUrl}\n${article.title}\n${article.text}`;
    article.provenance = {
      sha256: crypto.createHash('sha256').update(canonical, 'utf8').digest('hex'),
      capturedAt,
      capturedAtIso: new Date(capturedAt).toISOString(),
      url: finalUrl,
      bytes: Buffer.byteLength(article.text, 'utf8'),
      algorithm: 'sha256',
    };
    cache.set(rawUrl, { at: capturedAt, value: article });
    if (cache.size > 400) cache.delete(cache.keys().next().value);
    return article;
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'The publisher took too long to respond.' : e.message;
    cache.set(rawUrl, { at: Date.now() - CACHE_MS + 10 * 60000, error: msg }); // retry failures after 10 minutes
    throw Object.assign(new Error(msg), { status: e.status });
  }
}

/** Best-effort: article text for a list of sources, within a time budget. */
export async function articleTexts(urls, { max = 6, budgetMs = 15000, chars = 2500 } = {}) {
  const out = new Map();
  const deadline = new Promise(r => setTimeout(r, budgetMs));
  await Promise.race([
    Promise.all(urls.filter(Boolean).slice(0, max).map(async u => {
      try { const a = await readArticle(u); out.set(u, a.text.slice(0, chars)); } catch { /* skip unreadable */ }
    })),
    deadline,
  ]);
  return out;
}
