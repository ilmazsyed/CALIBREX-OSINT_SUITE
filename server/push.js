// Web Push (PWA notifications). VAPID keys come from env, else a pair is
// generated once and persisted in settings, so push works with no manual setup.
// Each operator's device subscriptions live in their per-user data.
import webpush from 'web-push';

let publicKey = null;
let ready = false;
let vapidSubject = null;
let vapidSource = 'generated';

// web-push rejects a subject that is not a mailto: or an http(s) URL — a bad
// PUBLIC_URL would otherwise throw and silently disable ALL push. Normalise it.
function normalizeSubject(s) {
  if (!s || !String(s).trim()) return 'https://calibrex.app';
  s = String(s).trim();
  if (/^mailto:/i.test(s) || /^https?:\/\//i.test(s)) return s;
  return s.includes('@') ? `mailto:${s}` : `https://${s}`;
}

export async function ensureVapid(store) {
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) { vapidSource = 'env'; }
  else {
    const saved = await store.getSetting('vapid');
    if (saved?.publicKey && saved?.privateKey) { pub = saved.publicKey; priv = saved.privateKey; vapidSource = 'stored'; }
    else { const k = webpush.generateVAPIDKeys(); pub = k.publicKey; priv = k.privateKey; await store.setSetting('vapid', k); vapidSource = 'generated'; }
  }
  let subject = normalizeSubject(process.env.VAPID_SUBJECT || (process.env.ADMIN_EMAIL ? `mailto:${process.env.ADMIN_EMAIL}` : process.env.PUBLIC_URL));
  try { webpush.setVapidDetails(subject, pub, priv); }
  catch (e) {
    console.error('[push] VAPID subject rejected, using fallback:', subject, e.message);
    subject = 'mailto:admin@calibrex.app';
    webpush.setVapidDetails(subject, pub, priv);
  }
  vapidSubject = subject;
  publicKey = pub;
  ready = true;
  console.log(`[push] VAPID ready (subject=${subject}, keys=${vapidSource})`);
}

export const pushPublicKey = () => publicKey;
export const pushReady = () => ready;

// Lightweight delivery stats so operators can see whether push is actually
// going out and why it fails (exposed to admins via /api/admin/push/health).
const stats = { sent: 0, failed: 0, byStatus: {}, lastError: null, lastSentAt: null };
export const pushStats = () => ({ ...stats, byStatus: { ...stats.byStatus } });
export const pushDiagnostics = () => ({ ready, subject: vapidSubject, hasPublicKey: !!publicKey, keySource: vapidSource });

// Per-user push channel preferences (default on). Stored under the user_data
// key 'push_prefs' as { threats, business, government, markets } booleans; a
// channel is off only when explicitly set to false.
export async function channelOn(store, userId, channel) {
  const prefs = (await store.getUserData(userId, 'push_prefs')) || {};
  return prefs[channel] !== false;
}

const MAX_SUBS = 20;
const cleanSub = s => (s && typeof s.endpoint === 'string' && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string')
  ? { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, at: Date.now() } : null;

export async function subscribe(store, userId, sub) {
  const c = cleanSub(sub);
  if (!c) throw Object.assign(new Error('Invalid push subscription.'), { status: 400 });
  const list = (await store.getUserData(userId, 'push_subs')) || [];
  const next = [c, ...list.filter(x => x.endpoint !== c.endpoint)].slice(0, MAX_SUBS);
  await store.setUserData(userId, 'push_subs', next);
  return next.length;
}

export async function unsubscribe(store, userId, endpoint) {
  const list = (await store.getUserData(userId, 'push_subs')) || [];
  await store.setUserData(userId, 'push_subs', list.filter(x => x.endpoint !== endpoint));
}

const CRIT_SEEN = 2000;
/**
 * After each feed refresh, push NEW critical-severity reports to every operator
 * who has push enabled — independent of watchlists or Telegram config. One
 * notification per refresh per user (summarised), deduped per item.
 */
export async function pushCriticalAlerts(store, items) {
  if (!ready) return;
  const cutoff = Date.now() - 12 * 3600000;
  const crit = (items || []).filter(i => i.severity === 'CRITICAL' && i.kind !== 'social' && i.wire !== 'BUSINESS' && i.wire !== 'GOV' && i.wire !== 'POLITICS' && i.published >= cutoff);
  if (!crit.length) return;
  const users = (await store.listUsers()).filter(u => u.role === 'admin' || u.status === 'active');
  const url = process.env.PUBLIC_URL || '/';
  for (const user of users) {
    try {
      const subs = (await store.getUserData(user.id, 'push_subs')) || [];
      if (!subs.length || !(await channelOn(store, user.id, 'threats'))) continue;
      const seen = new Set((await store.getUserData(user.id, 'push_crit_sent')) || []);
      const fresh = crit.filter(i => !seen.has(i.id)).sort((a, b) => b.published - a.published);
      if (!fresh.length) continue;
      const top = fresh[0];
      await pushToUser(store, user, {
        title: fresh.length === 1 ? 'Critical alert' : `${fresh.length} critical alerts`,
        body: top.title + (top.place?.name ? ` — ${top.place.name}` : ''),
        url, tag: 'critical',
      });
      await store.setUserData(user.id, 'push_crit_sent', [...fresh.map(i => i.id), ...seen].slice(0, CRIT_SEEN));
    } catch (e) { console.error('[push] critical', user.id, e.message); }
  }
}

/**
 * On boot, push a one-time "new version" notice to every operator with push
 * enabled, so they know to reopen the app and pick up the fresh build. The PWA
 * already updates itself on next launch (network-first HTML shell) — this is
 * just the prompt to relaunch.
 *
 * Fires once per deploy, not per restart: we key off the deploy identity
 * (Render's git commit, else the app version) and store the last one notified,
 * so a plain container restart of the same build is silent. The first boot
 * after this ships only records the baseline — it does not notify.
 */
export async function notifyDeploy(store) {
  if (!ready) return;
  const version = process.env.RENDER_GIT_COMMIT || process.env.DEPLOY_VERSION || process.env.npm_package_version || null;
  if (!version) return; // no deploy identity (local dev) — nothing to key off
  const prev = await store.getSetting('deploy_notified');
  if (prev === version) return;             // same build restarting — stay quiet
  await store.setSetting('deploy_notified', version);
  if (!prev) return;                         // first run: record baseline, don't notify
  const users = (await store.listUsers()).filter(u => u.role === 'admin' || u.status === 'active');
  const url = process.env.PUBLIC_URL || '/';
  for (const user of users) {
    try {
      const subs = (await store.getUserData(user.id, 'push_subs')) || [];
      if (!subs.length) continue;
      await pushToUser(store, user, {
        title: 'Calibrex updated',
        body: 'A new version is available — reopen the app to update.',
        url, tag: 'deploy',
      });
    } catch (e) { console.error('[push] deploy', user.id, e.message); }
  }
}

// High-impact business events worth a push: failures/distress, shocks, big
// deals and regulatory action. Business items are mostly low-severity by the
// kinetic rater, so we gate the push on these terms rather than on severity.
const BIZ_SIGNIFICANT = /\b(bankrupt\w*|insolven\w*|liquidat\w*|wound up|default(?:s|ed|ing)?|collapse\w*|bailout|chapter 11|shut(?:s|ting)? down|shutdown|mass layoffs?|job cuts|lay(?:s|ing)? off|fraud|scam|ponzi|embezzl\w*|money laundering|raid(?:s|ed)?|\bprobe\b|crash\w*|plunge\w*|tumbl\w*|wiped out|\brout\b|crisis|downgrad\w*|delist\w*|sanction\w*|\bbans?\b|mega-?deal|hostile takeover|takeover bid|record (?:deal|acquisition|merger|buyout)|buys? out|acquir\w*)\b/i;
/** Does this business item clear the bar for a push notification? */
export const isSignificantBusiness = i =>
  i.wire === 'BUSINESS' && i.kind !== 'social' && BIZ_SIGNIFICANT.test(`${i.title} ${i.summary || ''}`);

const BIZ_SEEN = 2000;
/**
 * Push NEW significant business events (M&A, distress/failures, market shocks,
 * regulatory action) to every operator who has push enabled. One summarised
 * notification per refresh per user, deduped per item. Business never plots on
 * the threat map — this is a notification-only channel.
 */
export async function pushBusinessAlerts(store, items) {
  if (!ready) return;
  const cutoff = Date.now() - 12 * 3600000;
  const biz = (items || []).filter(i => isSignificantBusiness(i) && i.published >= cutoff);
  if (!biz.length) return;
  const users = (await store.listUsers()).filter(u => u.role === 'admin' || u.status === 'active');
  const url = process.env.PUBLIC_URL || '/';
  for (const user of users) {
    try {
      const subs = (await store.getUserData(user.id, 'push_subs')) || [];
      if (!subs.length || !(await channelOn(store, user.id, 'business'))) continue;
      const seen = new Set((await store.getUserData(user.id, 'push_biz_sent')) || []);
      const fresh = biz.filter(i => !seen.has(i.id)).sort((a, b) => b.published - a.published);
      if (!fresh.length) continue;
      const top = fresh[0];
      await pushToUser(store, user, {
        title: fresh.length === 1 ? 'Business alert' : `${fresh.length} business alerts`,
        body: top.title + (top.place?.name ? ` — ${top.place.name}` : ''),
        url, tag: 'business',
      });
      await store.setUserData(user.id, 'push_biz_sent', [...fresh.map(i => i.id), ...seen].slice(0, BIZ_SEEN));
    } catch (e) { console.error('[push] business', user.id, e.message); }
  }
}

// High-impact government actions worth a push: emergencies, orders, sanctions,
// coups, crises and major foreign-policy moves.
const GOV_SIGNIFICANT = /\b(state of emergency|martial law|\bcoup\b|executive order|ordinance|decree|sanction\w*|embargo|\bban(?:s|ned|ning)?\b|mobiliz\w*|ceasefire|airstrike|nuclear|evacuat\w*|curfew|crackdown|impeach\w*|no-confidence|government collapse|resign\w*|dissolv\w*|war declar\w*|emergency declar\w*|border clos\w*|treaty|summit)\b/i;
/** Does this government item clear the bar for a push notification? */
export const isSignificantGov = i =>
  i.wire === 'GOV' && i.kind !== 'social' && GOV_SIGNIFICANT.test(`${i.title} ${i.summary || ''}`);

const GOV_SEEN = 2000;
/**
 * Push NEW high-impact government actions (emergencies, executive orders,
 * sanctions, coups, crises, major foreign-policy moves) to every operator with
 * push enabled. One summarised notification per refresh per user, deduped.
 * Government never plots on the threat map — this is a notification-only channel.
 */
export async function pushGovAlerts(store, items) {
  if (!ready) return;
  const cutoff = Date.now() - 12 * 3600000;
  const gov = (items || []).filter(i => isSignificantGov(i) && i.published >= cutoff);
  if (!gov.length) return;
  const users = (await store.listUsers()).filter(u => u.role === 'admin' || u.status === 'active');
  const url = process.env.PUBLIC_URL || '/';
  for (const user of users) {
    try {
      const subs = (await store.getUserData(user.id, 'push_subs')) || [];
      if (!subs.length || !(await channelOn(store, user.id, 'government'))) continue;
      const seen = new Set((await store.getUserData(user.id, 'push_gov_sent')) || []);
      const fresh = gov.filter(i => !seen.has(i.id)).sort((a, b) => b.published - a.published);
      if (!fresh.length) continue;
      const top = fresh[0];
      await pushToUser(store, user, {
        title: fresh.length === 1 ? 'Government alert' : `${fresh.length} government alerts`,
        body: top.title + (top.place?.name ? ` — ${top.place.name}` : ''),
        url, tag: 'government',
      });
      await store.setUserData(user.id, 'push_gov_sent', [...fresh.map(i => i.id), ...seen].slice(0, GOV_SEEN));
    } catch (e) { console.error('[push] government', user.id, e.message); }
  }
}

// High-impact political events worth a push: results, leadership changes,
// government falls, snap elections, major upheaval.
const POL_SIGNIFICANT = /\b(election result\w*|wins? (?:the )?election|landslide|exit poll\w*|poll result\w*|vote count|snap election|hung (?:parliament|assembly)|coalition (?:collapse|deal|talks)|no-confidence|steps down|resign\w*|ousted|sworn in|takes office|impeach\w*|government (?:falls|collapse)|defection|floor test|political crisis)\b/i;
/** Does this politics item clear the bar for a push notification? */
export const isSignificantPolitics = i =>
  i.wire === 'POLITICS' && i.kind !== 'social' && POL_SIGNIFICANT.test(`${i.title} ${i.summary || ''}`);

const POL_SEEN = 2000;
/**
 * Push NEW high-impact political events (election results, leadership changes,
 * government falls, snap elections, major upheaval) to operators with push on
 * and the "politics" channel enabled. One summarised notification per refresh.
 */
export async function pushPoliticsAlerts(store, items) {
  if (!ready) return;
  const cutoff = Date.now() - 12 * 3600000;
  const pol = (items || []).filter(i => isSignificantPolitics(i) && i.published >= cutoff);
  if (!pol.length) return;
  const users = (await store.listUsers()).filter(u => u.role === 'admin' || u.status === 'active');
  const url = process.env.PUBLIC_URL || '/';
  for (const user of users) {
    try {
      const subs = (await store.getUserData(user.id, 'push_subs')) || [];
      if (!subs.length || !(await channelOn(store, user.id, 'politics'))) continue;
      const seen = new Set((await store.getUserData(user.id, 'push_pol_sent')) || []);
      const fresh = pol.filter(i => !seen.has(i.id)).sort((a, b) => b.published - a.published);
      if (!fresh.length) continue;
      const top = fresh[0];
      await pushToUser(store, user, {
        title: fresh.length === 1 ? 'Politics alert' : `${fresh.length} politics alerts`,
        body: top.title + (top.place?.name ? ` — ${top.place.name}` : ''),
        url, tag: 'politics',
      });
      await store.setUserData(user.id, 'push_pol_sent', [...fresh.map(i => i.id), ...seen].slice(0, POL_SEEN));
    } catch (e) { console.error('[push] politics', user.id, e.message); }
  }
}

/**
 * A new operator requested access — alert every administrator immediately so
 * they can activate (or reject) the pending account. Always on, independent of
 * the per-channel content toggles; it's an operational account notice.
 */
export async function notifyAdminsOfSignup(store, newUser) {
  if (!ready) return;
  const admins = (await store.listUsers()).filter(u => u.role === 'admin');
  const url = process.env.PUBLIC_URL || '/';
  for (const admin of admins) {
    try {
      const subs = (await store.getUserData(admin.id, 'push_subs')) || [];
      if (!subs.length) continue;
      await pushToUser(store, admin, {
        title: 'New access request',
        body: `${newUser.name || newUser.email}${newUser.org ? ` · ${newUser.org}` : ''} is awaiting activation.`,
        url, tag: 'signup',
      });
    } catch (e) { console.error('[push] signup', admin.id, e.message); }
  }
}

/** Send one notification to all of a user's devices; prune dead subscriptions. */
export async function pushToUser(store, user, { title, body, url, tag }) {
  if (!ready) return 0;
  const list = (await store.getUserData(user.id, 'push_subs')) || [];
  if (!list.length) return 0;
  const payload = JSON.stringify({ title, body: body || '', url: url || process.env.PUBLIC_URL || '/', tag });
  const dead = [];
  await Promise.all(list.map(async sub => {
    try { await webpush.sendNotification(sub, payload); stats.sent++; stats.lastSentAt = Date.now(); }
    catch (e) {
      const code = e.statusCode || 0;
      stats.failed++; stats.byStatus[code] = (stats.byStatus[code] || 0) + 1;
      stats.lastError = { code, message: String(e.body || e.message || '').slice(0, 160), at: Date.now() };
      // 404/410 = gone, 400/403 = subscription/key mismatch — all permanently
      // dead, so prune them (the device must re-subscribe). Log anything else.
      if ([400, 403, 404, 410].includes(code)) dead.push(sub.endpoint);
      else console.error('[push] send failed', code, stats.lastError.message);
    }
  }));
  if (dead.length) await store.setUserData(user.id, 'push_subs', list.filter(x => !dead.includes(x.endpoint)));
  return list.length - dead.length;
}
