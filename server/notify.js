// External alert delivery. After each feed refresh, push new high-severity
// reports to an operator's Telegram chat and/or an outbound webhook, optionally
// restricted to one or more geofences (a point + radius). In-app alerts are
// unaffected; this is an additive outbound channel.
//
//  - Telegram: fixed host api.telegram.org, operator supplies bot token + chat id.
//  - Webhook:  operator supplies an https URL; re-checked by the SSRF guard on
//              every send, exactly like the article reader and custom feeds.
import { assertPublicUrl } from './article.js';

const SEV_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const MAX_PER_REFRESH = 10;
const MAX_SEEN = 2000;
const TIMEOUT = 15000;

// ---------------------------------------------------------------- config

/** Sanitise an operator's delivery settings into a safe, bounded shape. */
export function cleanDelivery(value) {
  const v = value && typeof value === 'object' ? value : {};
  const tg = v.telegram && typeof v.telegram === 'object' ? v.telegram : null;
  const telegram = tg && String(tg.botToken || '').trim() && String(tg.chatId || '').trim()
    ? { botToken: String(tg.botToken).trim().slice(0, 120), chatId: String(tg.chatId).trim().slice(0, 40) }
    : null;
  const wh = v.webhook && typeof v.webhook === 'object' ? v.webhook : null;
  const webhook = wh && /^https?:\/\//i.test(String(wh.url || '').trim())
    ? { url: String(wh.url).trim().slice(0, 500) }
    : null;
  const geofences = (Array.isArray(v.geofences) ? v.geofences : [])
    .map(g => ({
      id: String(g.id || '').slice(0, 40) || Math.random().toString(36).slice(2, 10),
      name: String(g.name || 'Area').trim().slice(0, 60),
      lat: Number(g.lat), lng: Number(g.lng), radiusKm: Number(g.radiusKm),
    }))
    .filter(g => Number.isFinite(g.lat) && Math.abs(g.lat) <= 90 && Number.isFinite(g.lng) && Math.abs(g.lng) <= 180 && g.radiusKm > 0 && g.radiusKm <= 20000)
    .slice(0, 20);
  const minSeverity = ['MEDIUM', 'HIGH', 'CRITICAL'].includes(v.minSeverity) ? v.minSeverity : 'HIGH';
  const enabled = v.enabled !== false && !!(telegram || webhook);
  return { enabled, minSeverity, telegram, webhook, geofences };
}

/** Never return the bot token to the client; report only whether one is set. */
export function redactDelivery(d) {
  const c = cleanDelivery(d);
  return {
    enabled: c.enabled, minSeverity: c.minSeverity,
    telegram: c.telegram ? { configured: true, chatId: c.telegram.chatId } : null,
    webhook: c.webhook ? { url: c.webhook.url } : null,
    geofences: c.geofences,
  };
}

// ---------------------------------------------------------------- geo

const R = 6371; // km
export function haversineKm(aLat, aLng, bLat, bLng) {
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** True when the item passes the geofences (no fences = pass all located or not). */
function inGeofences(item, geofences) {
  if (!geofences.length) return true;
  const p = item.place;
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false; // fenced feeds want a location
  return geofences.some(g => haversineKm(p.lat, p.lng, g.lat, g.lng) <= g.radiusKm);
}

/** Select the new items an operator should be pushed, given their config and seen set. */
export function selectForDelivery(cfg, items, seen) {
  const minRank = SEV_RANK[cfg.minSeverity] ?? 2;
  return items
    .filter(it => it.kind !== 'social' && (SEV_RANK[it.severity] ?? 0) >= minRank && !seen.has(it.id) && inGeofences(it, cfg.geofences))
    .sort((a, b) => b.published - a.published)
    .slice(0, MAX_PER_REFRESH);
}

// ---------------------------------------------------------------- dispatch

async function post(url, body, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
    return true;
  } finally { clearTimeout(t); }
}

export function formatText(matches) {
  const line = m => `• [${m.severity}] ${m.title}${m.place?.name ? ` — ${m.place.name}` : ''}\n${m.url}`;
  return `CALIBREX alert: ${matches.length} new report${matches.length === 1 ? '' : 's'}\n\n${matches.map(line).join('\n\n')}`.slice(0, 3800);
}

async function sendTelegram(tg, matches) {
  await post(`https://api.telegram.org/bot${encodeURIComponent(tg.botToken)}/sendMessage`,
    { chat_id: tg.chatId, text: formatText(matches), disable_web_page_preview: true });
}

async function sendWebhook(hook, matches) {
  await assertPublicUrl(hook.url); // refuses private IPs / odd ports on every send
  await post(hook.url, {
    source: 'calibrex', at: Date.now(),
    alerts: matches.map(m => ({ id: m.id, title: m.title, url: m.url, source: m.source, severity: m.severity, wire: m.wire, published: m.published, place: m.place || null })),
  });
}

/** Deliver one operator's new alerts. Returns count sent; records failures without throwing. */
export async function runDeliveryFor(store, user, items) {
  const cfg = cleanDelivery(await store.getUserData(user.id, 'alert_delivery'));
  if (!cfg.enabled) return 0;
  const seen = new Set((await store.getUserData(user.id, 'alert_sent')) || []);
  const matches = selectForDelivery(cfg, items, seen);
  if (!matches.length) return 0;

  const results = await Promise.allSettled([
    cfg.telegram ? sendTelegram(cfg.telegram, matches) : Promise.resolve(),
    cfg.webhook ? sendWebhook(cfg.webhook, matches) : Promise.resolve(),
  ]);
  results.filter(r => r.status === 'rejected').forEach(r => console.error('[notify] user', user.id, r.reason?.message || r.reason));

  // Mark as sent even on partial failure, so a broken channel does not spam the working one on every cycle.
  const sent = [...matches.map(m => m.id), ...seen].slice(0, MAX_SEEN);
  await store.setUserData(user.id, 'alert_sent', sent);
  return matches.length;
}

/** Run delivery for every active operator after a refresh. */
export async function runDelivery(store, items) {
  const users = (await store.listUsers()).filter(u => u.role === 'admin' || u.status === 'active');
  for (const user of users) {
    try { await runDeliveryFor(store, user, items); } catch (e) { console.error('[notify] user', user.id, e.message); }
  }
}

/** Send a one-off test message with the current config (used by the settings page). */
export async function sendTest(cfg) {
  const c = cleanDelivery(cfg);
  if (!c.telegram && !c.webhook) throw new Error('Add a Telegram chat or a webhook first.');
  const sample = [{ id: 'test', title: 'Calibrex test alert — delivery is working.', url: process.env.PUBLIC_URL || 'https://example.org', source: 'Calibrex', severity: 'HIGH', wire: 'TEST', published: Date.now(), place: null }];
  if (c.telegram) await sendTelegram(c.telegram, sample);
  if (c.webhook) await sendWebhook(c.webhook, sample);
  return true;
}
