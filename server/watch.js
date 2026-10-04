import { pushToUser } from './push.js';
// Watchlists and trends. Both run after every feed refresh.
//  - Watchlists: each operator keeps up to 25 terms. New feed items that match
//    become in-app notifications and, if the operator opted in and the server
//    has RESEND_API_KEY, an email digest (at most one every 15 minutes).
//  - Trends: daily counts per wire, place and severity, kept for 90 days.

export const MAX_TERMS = 25;
const MAX_NOTIFICATIONS = 200;
const MAX_SEEN = 3000;
const MAX_NEW_PER_REFRESH = 25;
const EMAIL_EVERY_MS = 15 * 60000;
const SEV_RANK = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A term matches when every word in it starts a word in the headline. Quoted phrases must match exactly. */
export function termMatcher(term) {
  const parts = [];
  String(term).replace(/"([^"]+)"|(\S+)/g, (_, phrase, word) => { parts.push(phrase || word); return ''; });
  const res = parts.filter(Boolean).map(p => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(p)}`, 'iu'));
  return title => res.length > 0 && res.every(re => re.test(title));
}

export function cleanWatchlist(value) {
  const v = value && typeof value === 'object' ? value : {};
  const seen = new Set();
  const terms = (Array.isArray(v.terms) ? v.terms : [])
    .map(t => ({
      id: String(t.id || '').slice(0, 40) || Math.random().toString(36).slice(2, 10),
      term: String(t.term || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      createdAt: Number(t.createdAt) || Date.now(),
      minSeverity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(t.minSeverity) ? t.minSeverity : 'LOW',
    }))
    .filter(t => t.term.length >= 2 && !seen.has(t.term.toLowerCase()) && seen.add(t.term.toLowerCase()))
    .slice(0, MAX_TERMS);
  const email = ['off', 'all', 'high'].includes(v.email) ? v.email : 'off';
  return { terms, email };
}

/** Find items matching a watchlist that the operator has not been told about yet. */
export function matchWatchlist(watchlist, items, seenIds) {
  const out = [];
  const matchers = watchlist.terms.map(t => ({ t, test: termMatcher(t.term) }));
  for (const it of items) {
    if (seenIds.has(it.id)) continue;
    for (const { t, test } of matchers) {
      // Only news published after (or shortly before) the term was added.
      if (it.published < t.createdAt - 2 * 3600000) continue;
      if (SEV_RANK[it.severity] < SEV_RANK[t.minSeverity]) continue;
      if (test(it.summary ? `${it.title} ${it.summary}` : it.title)) { out.push({ item: it, term: t.term }); break; }
    }
  }
  return out.sort((a, b) => b.item.published - a.item.published).slice(0, MAX_NEW_PER_REFRESH);
}

const emailQueue = new Map(); // userId -> { matches: [], lastSent }

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Calibrex Alerts <onboarding@resend.dev>', to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

async function flushEmail(user, now = Date.now()) {
  const q = emailQueue.get(user.id);
  if (!q || !q.matches.length || now - q.lastSent < EMAIL_EVERY_MS) return;
  const matches = q.matches.splice(0);
  q.lastSent = now;
  const url = process.env.PUBLIC_URL || '';
  const rows = matches.slice(0, 30).map(n => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font:12px sans-serif;color:#6b7280;white-space:nowrap">${esc(n.severity)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font:14px sans-serif"><a href="${esc(n.url)}">${esc(n.title)}</a><br><span style="color:#6b7280;font-size:12px">${esc(n.source)} · matched “${esc(n.term)}”</span></td></tr>`).join('');
  const html = `<div style="max-width:640px"><h2 style="font:600 18px sans-serif">Calibrex watchlist: ${matches.length} new match${matches.length === 1 ? '' : 'es'}</h2><table style="border-collapse:collapse;width:100%">${rows}</table>${url ? `<p style="font:13px sans-serif"><a href="${esc(url)}">Open Calibrex</a> · change email alerts under Watchlists.</p>` : ''}</div>`;
  try {
    await sendEmail(user.email, `Calibrex: ${matches.length} new watchlist match${matches.length === 1 ? '' : 'es'}`, html);
  } catch (e) {
    console.error('[watch] email failed', e.message);
  }
}

/** Run one operator's watchlist against the given items. Returns the number of new matches. */
export async function runWatchlistFor(store, user, items) {
  const raw = await store.getUserData(user.id, 'watchlist');
  if (!raw) return 0;
  const wl = cleanWatchlist(raw);
  if (!wl.terms.length) return 0;
  const seenList = (await store.getUserData(user.id, 'watch_seen')) || [];
  const matches = matchWatchlist(wl, items, new Set(seenList));
  const now = Date.now();
  if (matches.length) {
    const fresh = matches.map(({ item, term }) => ({
      id: item.id, term, title: item.title, url: item.url, source: item.source,
      published: item.published, wire: item.wire, severity: item.severity, place: item.place?.name || null, at: now, read: false,
    }));
    const existing = (await store.getUserData(user.id, 'notifications')) || [];
    await store.setUserData(user.id, 'notifications', [...fresh, ...existing].slice(0, MAX_NOTIFICATIONS));
    await store.setUserData(user.id, 'watch_seen', [...fresh.map(f => f.id), ...seenList].slice(0, MAX_SEEN));
    const title = fresh.length === 1 ? `Watchlist: ${fresh[0].term}` : `Watchlist: ${fresh.length} new matches`;
    pushToUser(store, user, { title, body: fresh[0].title, url: process.env.PUBLIC_URL, tag: 'watch' }).catch(() => {});
    if (wl.email !== 'off' && emailConfigured()) {
      const wanted = wl.email === 'high' ? fresh.filter(f => SEV_RANK[f.severity] >= 2) : fresh;
      if (wanted.length) {
        const q = emailQueue.get(user.id) || { matches: [], lastSent: 0 };
        q.matches.push(...wanted);
        emailQueue.set(user.id, q);
      }
    }
  }
  await flushEmail(user, now);
  return matches.length;
}

/** Run every operator's watchlist against the latest items. */
export async function runWatchlists(store, items) {
  const users = (await store.listUsers()).filter(u => u.role === 'admin' || u.status === 'active');
  for (const user of users) {
    try { await runWatchlistFor(store, user, items); } catch (e) { console.error('[watch] user', user.id, e.message); }
  }
}

// ---------------------------------------------------------------- trends

const dayKey = t => new Date(t).toISOString().slice(0, 10);

export function summariseDay(items, day) {
  const out = { total: 0, wires: {}, places: {}, severity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } };
  for (const it of items) {
    if (dayKey(it.published) !== day) continue;
    out.total++;
    out.wires[it.wire] = (out.wires[it.wire] || 0) + 1;
    out.severity[it.severity] = (out.severity[it.severity] || 0) + 1;
    if (it.place?.name) out.places[it.place.name] = (out.places[it.place.name] || 0) + 1;
  }
  // Keep the 40 busiest places to bound storage.
  out.places = Object.fromEntries(Object.entries(out.places).sort((a, b) => b[1] - a[1]).slice(0, 40));
  return out;
}

/**
 * Recompute today and yesterday (UTC) from the current 48-hour item window and
 * store them. Both days are fully inside the window, so rerunning is safe;
 * older days are left as last computed.
 */
export async function updateTrends(store, items, now = Date.now()) {
  if (!items.length) return;
  const trends = (await store.getSetting('trends')) || { days: {} };
  const days = trends.days || {};
  for (const day of [dayKey(now), dayKey(now - 86400000)]) {
    const summary = summariseDay(items, day);
    if (summary.total === 0 && !days[day]) continue; // no data is not the same as zero reports
    // A thin window after a restart should never shrink a day already recorded.
    if (!days[day] || summary.total >= (days[day].total || 0)) days[day] = summary;
  }
  const cutoff = dayKey(now - 90 * 86400000);
  for (const d of Object.keys(days)) if (d < cutoff) delete days[d];
  await store.setSetting('trends', { days, updatedAt: now });
}
