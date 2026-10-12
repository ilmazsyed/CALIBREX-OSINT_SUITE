// Continuous entity-watch: periodically re-runs the pivot for each watched
// entity and notifies the operator when NEW connections appear. Turns a
// one-shot investigation into ongoing monitoring — the thing scan-once tools
// can't do. Reuses the per-user notification inbox and push.
import { pivot } from './pivot.js';
import { pushToUser } from './push.js';

const REFRESH_MS = 6 * 60 * 60 * 1000; // every 6h — gentle on the public sources
const GAP_MS = 600;                    // space pivots out
const MAX_IDS = 600;
const MAX_NOTIF = 100;
const PUBLIC = () => '/'; // relative: opens the app at whatever domain serves it

/** New ids present now that weren't in the previous set. */
export function newIds(prev, curr) {
  const seen = new Set(prev || []);
  return curr.filter(id => !seen.has(id));
}

/** Run one user's watches; returns how many gained new connections. */
export async function runForUser(store, user) {
  const watches = await store.getUserData(user.id, 'entity_watches');
  if (!Array.isArray(watches) || !watches.length) return 0;
  const notifs = [];
  let changed = 0;
  for (const w of watches) {
    try {
      const r = await pivot(w.value, w.type || 'auto');
      const ids = r.nodes.map(n => n.id);
      w.lastRun = Date.now();
      if (!Array.isArray(w.lastIds) || w.lastIds.length === 0) { w.lastIds = ids.slice(0, MAX_IDS); continue; } // baseline, no alert
      const fresh = newIds(w.lastIds, ids);
      w.lastIds = [...new Set([...w.lastIds, ...ids])].slice(0, MAX_IDS);
      if (fresh.length) {
        changed++;
        notifs.push({ id: `ew-${w.id}-${Date.now()}`, title: `${w.label || w.value}: ${fresh.length} new connection${fresh.length === 1 ? '' : 's'}`,
          url: PUBLIC(), source: 'Entity watch', severity: 'MEDIUM', at: Date.now(), read: false, term: w.label || w.value });
      }
    } catch { /* source unreachable this cycle — try again next time */ }
    await new Promise(res => setTimeout(res, GAP_MS));
  }
  await store.setUserData(user.id, 'entity_watches', watches);
  if (notifs.length) {
    const existing = (await store.getUserData(user.id, 'notifications')) || [];
    await store.setUserData(user.id, 'notifications', [...notifs, ...existing].slice(0, MAX_NOTIF));
    const title = notifs.length === 1 ? notifs[0].title : `Entity watch: ${notifs.length} updates`;
    pushToUser(store, user, { title, body: notifs[0].title, url: '/?view=graph', tag: 'entitywatch' }).catch(() => {});
  }
  return changed;
}

export async function runEntityWatches(store) {
  const users = (await store.listUsers()).filter(u => u.role === 'admin' || u.status === 'active');
  for (const u of users) { try { await runForUser(store, u); } catch (e) { console.error('[entitywatch] user failed', e?.message); } }
}

export function startEntityWatchLoop(store) {
  setTimeout(() => runEntityWatches(store).catch(() => {}), 60000);
  setInterval(() => runEntityWatches(store).catch(() => {}), REFRESH_MS);
}
