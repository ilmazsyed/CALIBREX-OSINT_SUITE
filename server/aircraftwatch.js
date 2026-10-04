// Aircraft watches: per-operator rules over the live ADS-B picture. Each refresh,
// match current aircraft against an operator's watches and, on new matches, raise
// in-app notifications and push through the same delivery channels as feed alerts.
//   - area:      military (or any) aircraft within a radius of a point (an airbase)
//   - callsign:  a callsign prefix (e.g. RCH for US mil airlift)
//   - type:      an aircraft type/registration substring (e.g. RC135)
//   - emergency: any emergency squawk (7500/7600/7700)
import { haversineKm } from './notify.js';
import { cleanDelivery, deliverItems } from './notify.js';
import { pushToUser } from './push.js';

const MAX_WATCHES = 30;
const MAX_SEEN = 3000;

export function cleanAircraftWatches(value) {
  const list = Array.isArray(value) ? value : (value && Array.isArray(value.watches) ? value.watches : []);
  return list.map(w => {
    const kind = ['area', 'callsign', 'type', 'emergency'].includes(w.kind) ? w.kind : null;
    if (!kind) return null;
    const base = { id: String(w.id || '').slice(0, 40) || Math.random().toString(36).slice(2, 10), kind, name: String(w.name || '').trim().slice(0, 60), milOnly: !!w.milOnly };
    if (kind === 'area') {
      const lat = Number(w.lat), lng = Number(w.lng), radiusKm = Number(w.radiusKm);
      if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180 || !(radiusKm > 0) || radiusKm > 2000) return null;
      return { ...base, lat, lng, radiusKm };
    }
    if (kind === 'callsign' || kind === 'type') {
      const value = String(w.value || '').trim().toUpperCase().slice(0, 12);
      if (value.length < 2) return null;
      return { ...base, value };
    }
    return base; // emergency
  }).filter(Boolean).slice(0, MAX_WATCHES);
}

/** Return matches: [{ watch, aircraft: [...] }] for aircraft a watch newly covers. */
export function matchAircraftWatches(watches, aircraft) {
  const out = [];
  for (const w of watches) {
    let hits = aircraft;
    if (w.milOnly) hits = hits.filter(a => a.mil);
    if (w.kind === 'area') hits = hits.filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lng) && haversineKm(a.lat, a.lng, w.lat, w.lng) <= w.radiusKm);
    else if (w.kind === 'callsign') hits = hits.filter(a => String(a.callsign || '').toUpperCase().startsWith(w.value));
    else if (w.kind === 'type') hits = hits.filter(a => String(a.tag || '').toUpperCase().includes(w.value));
    else if (w.kind === 'emergency') hits = hits.filter(a => a.emergency);
    if (hits.length) out.push({ watch: w, aircraft: hits });
  }
  return out;
}

const label = w => w.name || (w.kind === 'area' ? `${w.lat.toFixed(2)},${w.lng.toFixed(2)} (${w.radiusKm}km)` : w.kind === 'emergency' ? 'emergency squawk' : w.value);

/** Evaluate one operator's aircraft watches; raise notifications + delivery for new hits. */
export async function runAircraftWatchesFor(store, user, aircraft) {
  const watches = cleanAircraftWatches(await store.getUserData(user.id, 'aircraft_watches'));
  if (!watches.length) return 0;
  const matches = matchAircraftWatches(watches, aircraft);
  if (!matches.length) return 0;
  const seen = new Set((await store.getUserData(user.id, 'aircraft_seen')) || []);
  const now = Date.now();
  const fresh = [];
  for (const { watch, aircraft: hits } of matches) {
    for (const a of hits) {
      const key = `${watch.id}:${a.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fresh.push({ key, watch, a });
    }
  }
  if (!fresh.length) return 0;

  const notifs = fresh.slice(0, 40).map(({ watch, a }) => ({
    id: `air-${watch.id}-${a.id}-${now}`,
    title: `Aircraft watch "${label(watch)}": ${a.callsign}${a.mil ? ' [MIL]' : ''}${a.emergency ? ` ⚠ ${a.emergency}` : ''}${a.tag && a.tag !== 'MIL' ? ` (${a.tag})` : ''}`,
    url: `https://globe.adsbexchange.com/?icao=${encodeURIComponent(a.id)}`,
    source: 'Calibrex Aircraft', published: now, wire: 'AIRCRAFT',
    severity: a.emergency ? 'CRITICAL' : 'HIGH', place: null, at: now, read: false,
  }));
  const existing = (await store.getUserData(user.id, 'notifications')) || [];
  await store.setUserData(user.id, 'notifications', [...notifs, ...existing].slice(0, 200));
  await store.setUserData(user.id, 'aircraft_seen', [...seen].slice(-MAX_SEEN));

  const cfg = cleanDelivery(await store.getUserData(user.id, 'alert_delivery'));
  if (cfg.enabled) await deliverItems(cfg, notifs, `user ${user.id} (aircraft)`).catch(() => {});
  pushToUser(store, user, { title: 'Aircraft watch', body: notifs[0].title.replace(/^Aircraft watch /, ''), url: process.env.PUBLIC_URL, tag: 'aircraft' }).catch(() => {});
  return fresh.length;
}

export async function runAircraftWatches(store, aircraft) {
  if (!aircraft?.length) return;
  const users = (await store.listUsers()).filter(u => u.role === 'admin' || u.status === 'active');
  for (const user of users) {
    try { await runAircraftWatchesFor(store, user, aircraft); } catch (e) { console.error('[aircraft] user', user.id, e.message); }
  }
}
