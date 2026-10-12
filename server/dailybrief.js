// Scheduled daily situation brief. Assembled deterministically from the live
// data (always works, no key, no cost), with optional AI polish if an admin has
// connected an AI provider. Stored for retrieval, and pushed to every account.
//
// HONESTY: the brief is a digest of OBSERVED reporting and sensor data, not a
// forecast. The AI-polished version is explicitly instructed to stay on-source.
import { snapshot } from './feeds.js';
import { computeInstability } from './instability.js';
import { correlationSnapshot } from './correlation.js';
import { geointSnapshot } from './geoint.js';
import { pushToUser } from './push.js';
import { runTask } from './ai.js';

const BRIEF_HOUR = Number(process.env.DAILY_BRIEF_HOUR || 6);   // UTC hour to fire

/** Build the deterministic brief text from the current snapshots. */
export function assembleBrief(now = Date.now()) {
  const snap = snapshot();
  const items = snap.items || [];
  const alerts = (snap.alerts || []).slice(0, 8);
  const inst = computeInstability(items, now).slice(0, 8);
  const conv = (correlationSnapshot().convergences || []).slice(0, 5);
  const outages = (geointSnapshot().events || []).filter(e => e.categoryId === 'outage').slice(0, 5);

  const L = [];
  L.push(`CALIBREX DAILY SITUATION BRIEF`);
  L.push(new Date(now).toUTCString());
  L.push('Observed reporting and sensor data, last 24–72h. Not a forecast.');
  L.push('');
  L.push('TOP ALERTS');
  if (alerts.length) alerts.forEach((a, i) => L.push(`${i + 1}. [${a.severity}] ${a.message}${a.place ? ` — ${a.place}` : ''} (${a.source})`));
  else L.push('· none in window');
  L.push('');
  L.push('COUNTRY INSTABILITY (observed signal intensity)');
  if (inst.length) inst.forEach((c, i) => L.push(`${i + 1}. ${c.country}: ${c.score}/100 ${c.band}${c.delta24h ? ` (${c.delta24h > 0 ? '+' : ''}${c.delta24h} 24h)` : ''}`));
  else L.push('· insufficient data');
  if (conv.length) { L.push(''); L.push('CROSS-STREAM CONVERGENCE'); conv.forEach(c => L.push(`· ${c.country}: ${c.streamCount} streams (${c.streams.join(', ')})`)); }
  if (outages.length) { L.push(''); L.push('INTERNET OUTAGES'); outages.forEach(o => L.push(`· ${o.title}`)); }
  return L.join('\n');
}

/** Best-effort AI polish using the first admin with a connected AI provider. */
async function aiPolish(store) {
  try {
    if ((await store.getSetting('ai_enabled')) === false) return null;
    const admins = (await store.listUsers()).filter(u => u.role === 'admin');
    const snap = snapshot();
    const sources = (snap.alerts || []).slice(0, 12).map(a => ({ title: a.message, source: a.source, url: a.url, published: a.published, summary: a.summary }));
    if (!sources.length) return null;
    for (const u of admins) {
      const conn = await store.getUserData(u.id, 'ai_connection');
      if (!conn || !conn.key) continue;
      try { return await runTask(conn, 'brief', { title: 'Global daily situation', sources }); }
      catch { /* try next admin */ }
    }
  } catch { /* fall back to deterministic */ }
  return null;
}

export async function generateDailyBrief(store, { push = true, now = Date.now() } = {}) {
  const base = assembleBrief(now);
  const polished = await aiPolish(store);
  const text = polished ? `${polished}\n\n— — —\n${base}` : base;
  const brief = { date: new Date(now).toISOString().slice(0, 10), generatedAt: now, ai: !!polished, text };
  await store.setSetting('daily_brief', brief);
  if (push) {
    const title = 'Daily Situation Brief';
    const body = (text.split('\n').find(l => /^\d+\.\s/.test(l)) || 'Your daily global situation brief is ready.').slice(0, 140);
    for (const u of await store.listUsers()) {
      try { await pushToUser(store, u, { title, body, url: '/?view=briefs', tag: 'daily-brief' }); } catch { /* ignore */ }
      try {
        const inbox = (await store.getUserData(u.id, 'notifications')) || [];
        await store.setUserData(u.id, 'notifications', [{ id: `brief-${brief.date}-${u.id.slice(0, 6)}`, title, body, url: '/?view=briefs', source: 'Calibrex', severity: 'LOW', at: now, read: false }, ...inbox].slice(0, 200));
      } catch { /* ignore */ }
    }
  }
  return brief;
}

export async function dailyBriefSnapshot(store) {
  return (await store.getSetting('daily_brief')) || { date: null, generatedAt: 0, ai: false, text: '' };
}

/** Fire once per day at BRIEF_HOUR (UTC). Checks hourly; survives restarts. */
export function startDailyBriefLoop(store) {
  const tick = async () => {
    try {
      const now = new Date();
      if (now.getUTCHours() < BRIEF_HOUR) return;
      const today = now.toISOString().slice(0, 10);
      const existing = await store.getSetting('daily_brief');
      if (existing && existing.date === today) return;          // already done today
      await generateDailyBrief(store, { now: Date.now() });
      console.log('[dailybrief] generated for', today);
    } catch (e) { console.error('[dailybrief] tick failed', e.message); }
  };
  setTimeout(tick, 60000);                                       // once shortly after boot
  setInterval(tick, 60 * 60 * 1000).unref();                     // hourly
}
