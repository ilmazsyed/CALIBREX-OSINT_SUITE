// Crisis & Stress Engine: turn raw market series into detected, plain-language
// events (crashes, corrections, records, unusual moves, yield inversion) and a
// per-country financial-stress score. Events feed the Markets UI and, through
// the same delivery channels as feed alerts, Telegram / webhooks.
import { cleanDelivery, deliverItems } from './notify.js';
import { pushToUser } from './push.js';

const SEV_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

// ---------------------------------------------------------------- maths

export const stdev = a => { if (a.length < 2) return 0; const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const returns = c => c.slice(1).map((v, i) => c[i] ? (v - c[i]) / c[i] : 0);

/** Analyse one instrument's series and return its single most significant event, or null. */
export function analyzeQuote(q, series) {
  const closes = (series || []).map(s => s.close).filter(Number.isFinite);
  if (closes.length < 30) return null;
  const last = closes[closes.length - 1];
  const win = closes.slice(-252);
  const max = Math.max(...win), min = Math.min(...win);
  const hasRange = min > 0 && max / min - 1 > 0.02; // ignore flat/near-flat series
  const ddHigh = max ? last / max - 1 : 0;      // drawdown from 12-month high
  const rets = returns(closes.slice(-120));
  const vol = stdev(rets);
  const z = vol ? rets[rets.length - 1] / vol : 0;
  const equity = q.category === 'Indices';
  const fx = q.category === 'Forex';
  const asOf = q.asOf || new Date().toISOString().slice(0, 10);

  const signals = [];
  if (equity && ddHigh <= -0.2) signals.push(['bear', 'CRITICAL', `${q.label} is in bear-market territory — ${(ddHigh * 100).toFixed(0)}% below its 12-month high`]);
  else if (equity && ddHigh <= -0.1) signals.push(['correction', 'HIGH', `${q.label} is in a correction — ${(ddHigh * 100).toFixed(0)}% below its 12-month high`]);
  if (equity && hasRange && last <= min * 1.001) signals.push(['low52', 'HIGH', `${q.label} hit a 12-month low`]);
  if (fx && hasRange && last >= max * 0.999) signals.push(['ccy_low', 'HIGH', `${q.label.replace('USD / ', '')} fell to a 12-month low against the US dollar`]);
  if (Math.abs(z) >= 3) signals.push(['zmove', z <= -3 ? 'HIGH' : 'MEDIUM', `${q.label} moved ${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(1)}% — a ${Math.abs(z).toFixed(1)}σ daily move`]);
  if (equity && hasRange && last >= max * 0.999) signals.push(['high52', 'MEDIUM', `${q.label} hit a 12-month high`]);
  if (!signals.length) return null;

  signals.sort((a, b) => SEV_RANK[b[1]] - SEV_RANK[a[1]]);
  const [kind, severity, message] = signals[0];
  return { id: `${q.id}:${kind}:${asOf}`, kind, severity, label: q.label, changePct: q.changePct, message, at: Date.now(), investigate: `${q.label} ${q.changePct < 0 ? 'fall drop selloff' : 'surge rally record'}` };
}

/** All market events this cycle (per-instrument + yield-curve), most severe first. */
export function detectEvents(quotes, seriesMap, yields) {
  const events = [];
  for (const q of quotes || []) { const e = analyzeQuote(q, seriesMap?.[q.id]); if (e) events.push(e); }
  if (yields?.inverted) events.push({ id: `yield:inverted:${yields.asOf}`, kind: 'yield', severity: 'HIGH', label: 'US yield curve', changePct: 0, message: `US 10Y–2Y yield curve is inverted (${yields.spread10y2y}%) — a classic recession lead indicator`, at: Date.now(), investigate: 'US yield curve inversion recession' });
  return events.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || Math.abs(b.changePct) - Math.abs(a.changePct));
}

// ---------------------------------------------------------------- country stress index

// Country → its main equity index id and USD/local FX id (from the markets universe).
const COUNTRIES = [
  { country: 'United States', index: 'spx', fx: null },
  { country: 'India', index: 'nifty', fx: 'usdinr' },
  { country: 'Japan', index: 'nkx', fx: 'usdjpy' },
  { country: 'China', index: 'shc', fx: 'usdcny' },
  { country: 'United Kingdom', index: 'ftse', fx: 'usdgbp' },
  { country: 'Brazil', index: 'bvp', fx: 'usdbrl' },
  { country: 'Turkey', index: null, fx: 'usdtry' },
  { country: 'South Korea', index: 'kospi', fx: 'usdkrw' },
  { country: 'South Africa', index: null, fx: 'usdzar' },
];
const band = s => s >= 75 ? 'CRISIS' : s >= 50 ? 'STRESS' : s >= 25 ? 'ELEVATED' : 'CALM';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 0–100 financial-stress score per country from equity drawdown + currency depreciation. */
export function countryStress(seriesMap) {
  const out = [];
  for (const c of COUNTRIES) {
    const drivers = [];
    let score = 0;
    const idx = seriesMap?.[c.index]?.map(s => s.close).filter(Number.isFinite);
    if (idx && idx.length >= 30) {
      const win = idx.slice(-252); const dd = Math.max(...win) ? idx[idx.length - 1] / Math.max(...win) - 1 : 0;
      const eq = clamp(-dd * 250, 0, 50); // -20% dd => 50 pts
      if (eq >= 5) { score += eq; drivers.push(`equities ${(dd * 100).toFixed(0)}% off 12-mo high`); }
    }
    const fx = seriesMap?.[c.fx]?.map(s => s.close).filter(Number.isFinite);
    if (fx && fx.length >= 30) {
      const win = fx.slice(-252); const lo = Math.min(...win); const depr = lo ? fx[fx.length - 1] / lo - 1 : 0; // USD/local up = weaker local
      const cur = clamp(depr * 250, 0, 50); // +20% depreciation => 50 pts
      if (cur >= 5) { score += cur; drivers.push(`currency ${(depr * 100).toFixed(0)}% off 12-mo strong`); }
    }
    if (drivers.length) out.push({ country: c.country, score: Math.round(clamp(score, 0, 100)), band: band(score), drivers });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- state + delivery

const state = { updatedAt: null, events: [], stress: [] };
export function crisisSnapshot() { return { updatedAt: state.updatedAt, events: state.events.slice(0, 40), stress: state.stress }; }

/** Recompute from a markets snapshot + series; returns the freshly-detected events. */
export function refreshCrisis(snapshot, seriesMap) {
  const quotes = Object.values(snapshot.groups || {}).flat();
  const events = detectEvents(quotes, seriesMap, snapshot.yields);
  state.events = events;
  state.stress = countryStress(seriesMap);
  state.updatedAt = Date.now();
  return events;
}

const MAX_SEEN = 1000;
/**
 * Notify operators of new crisis events (deduped per user):
 *  - Push (HIGH+ events) fires whenever the user has push enabled — no Telegram needed.
 *  - Telegram/webhook delivery fires only when the user configured it, at their minSeverity.
 */
export async function deliverCrisis(store, events) {
  if (!events.length) return;
  const users = (await store.listUsers()).filter(u => u.role === 'admin' || u.status === 'active');
  const url = process.env.PUBLIC_URL || 'https://example.org';
  for (const user of users) {
    try {
      const cfg = cleanDelivery(await store.getUserData(user.id, 'alert_delivery'));
      const subs = (await store.getUserData(user.id, 'push_subs')) || [];
      if (!cfg.enabled && !subs.length) continue; // no channel at all
      const seen = new Set((await store.getUserData(user.id, 'crisis_sent')) || []);
      const unseen = events.filter(e => !seen.has(e.id));
      if (!unseen.length) continue;

      // Telegram / webhook — respects the operator's configured threshold.
      if (cfg.enabled) {
        const minRank = SEV_RANK[cfg.minSeverity] ?? 2;
        const forDelivery = unseen.filter(e => (SEV_RANK[e.severity] ?? 0) >= minRank);
        if (forDelivery.length) {
          const items = forDelivery.map(e => ({ id: e.id, title: `MARKETS: ${e.message}`, url, source: 'Calibrex Markets', severity: e.severity, wire: 'MARKETS', published: e.at, place: null }));
          await deliverItems(cfg, items, `user ${user.id} (crisis)`);
        }
      }
      // Push — HIGH+ events, independent of Telegram/webhook.
      if (subs.length) {
        const forPush = unseen.filter(e => (SEV_RANK[e.severity] ?? 0) >= SEV_RANK.HIGH);
        if (forPush.length) pushToUser(store, user, { title: forPush.length === 1 ? 'Market signal' : `${forPush.length} market signals`, body: forPush[0].message, url, tag: 'markets' }).catch(() => {});
      }
      await store.setUserData(user.id, 'crisis_sent', [...unseen.map(e => e.id), ...seen].slice(0, MAX_SEEN));
    } catch (e) { console.error('[crisis] user', user.id, e.message); }
  }
}
