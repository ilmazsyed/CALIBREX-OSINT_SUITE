// Article reader: fetches a story page and extracts its main text, so the app
// can work from full articles rather than headlines alone.
//  - Google News links are resolved to the publisher's URL first.
//  - Only public http(s) addresses are fetched (private and local networks are refused).
//  - Results are cached in memory for 6 hours.
import dns from 'dns/promises';
import net from 'net';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { pageMedia } from './visuals.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const CACHE_MS = 6 * 3600000;
const cache = new Map(); // url -> { at, value | error }

// ---------------------------------------------------------------- network safety

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return privateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

export async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw Object.assign(new Error('That is not a valid web address.'), { status: 400 }); }
  if (!/^https?:$/.test(u.protocol)) throw Object.assign(new Error('Only http and https links can be read.'), { status: 400 });
  if (u.port && !['80', '443'].includes(u.port)) throw Object.assign(new Error('That address uses a port the reader does not open.'), { status: 400 });
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map(a => a.address);
  if (!addrs.length || addrs.some(privateIp)) throw Object.assign(new Error('That address is not on the public internet.'), { status: 400 });
  return u;
}

/** GET with manual redirects so every hop is checked. */
export async function safeFetch(url, opts = {}, hops = 0) {
  if (hops > 5) throw new Error('Too many redirects.');
  await assertPublicUrl(url);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'en', ...(opts.headers || {}) } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      return safeFetch(new URL(res.headers.get('location'), url).toString(), opts, hops + 1);
    }
    return { res, url };
  } finally {
    clearTimeout(t);
  }
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
    cache.set(rawUrl, { at: Date.now(), value: article });
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
