// Web Push (PWA notifications). VAPID keys come from env, else a pair is
// generated once and persisted in settings, so push works with no manual setup.
// Each operator's device subscriptions live in their per-user data.
import webpush from 'web-push';

let publicKey = null;
let ready = false;

export async function ensureVapid(store) {
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const saved = await store.getSetting('vapid');
    if (saved?.publicKey && saved?.privateKey) { pub = saved.publicKey; priv = saved.privateKey; }
    else { const k = webpush.generateVAPIDKeys(); pub = k.publicKey; priv = k.privateKey; await store.setSetting('vapid', k); }
  }
  const subject = process.env.VAPID_SUBJECT || (process.env.ADMIN_EMAIL ? `mailto:${process.env.ADMIN_EMAIL}` : (process.env.PUBLIC_URL || 'https://calibrex.app'));
  webpush.setVapidDetails(subject, pub, priv);
  publicKey = pub;
  ready = true;
}

export const pushPublicKey = () => publicKey;
export const pushReady = () => ready;

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

/** Send one notification to all of a user's devices; prune dead subscriptions. */
export async function pushToUser(store, user, { title, body, url, tag }) {
  if (!ready) return 0;
  const list = (await store.getUserData(user.id, 'push_subs')) || [];
  if (!list.length) return 0;
  const payload = JSON.stringify({ title, body: body || '', url: url || process.env.PUBLIC_URL || '/', tag });
  const dead = [];
  await Promise.all(list.map(async sub => {
    try { await webpush.sendNotification(sub, payload); }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) dead.push(sub.endpoint); }
  }));
  if (dead.length) await store.setUserData(user.id, 'push_subs', list.filter(x => !dead.includes(x.endpoint)));
  return list.length - dead.length;
}
