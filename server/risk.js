// Consolidated risk engine. Rolls every monitor up into one picture: a per-
// domain band/score (overall, India and World), a weighted composite index for
// each of those three scopes, a trend vs the previous sample, and a rolling
// history for sparklines.
//
// Honesty: every score is an aggregation of OBSERVED reporting volume and
// severity across the live wires — not a prediction or a probability. The API
// labels it as such; nothing here invents a number.
import { snapshot } from './feeds.js';
import { crisisSnapshot } from './crisis.js';
import { signalsSnapshot } from './signals.js';
import { analyzeChatter } from './chatter.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const band = s => (s >= 75 ? 'CRISIS' : s >= 50 ? 'STRESS' : s >= 25 ? 'ELEVATED' : 'CALM');
const SEV = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

// Per-domain "hot" matchers — the words that mark an item as an escalation.
const HOT = {
  security: /\b(killed|dead|deaths|attack|strike|missile|clash(?:es)?|blast|explosion|war|invasion|coup|militant|terror|ambush|shelling|offensive|airstrike|infiltrat)\b/i,
  cyber: /\b(ransomware|breach|breached|hacked|zero-day|exploit|outage|leak(?:ed)?|malware|ddos|compromis|data theft|stolen data)\b/i,
  business: /\b(bankrupt\w*|insolven\w*|collapse|default|layoffs?|plunge|crash|rout|sell-?off|slump|crisis|downgrade|fraud|probe|bailout|write-?down|distress)\b/i,
  government: /\b(emergency|sanction\w*|coup|martial law|ban|crackdown|resign\w*|ousted|dissolve\w*|decree|shutdown|impeach\w*|expel\w*|strike down|state of emergency)\b/i,
  politics: /\b(crisis|upheaval|no-confidence|collapse|resign\w*|ousted|coup|unrest|protest\w*|riot\w*|defect\w*|snap election|landslide|turmoil|boycott)\b/i,
};
const WIRES_OF = {
  security: ['INDIA', 'SATP', 'REGIONAL', 'GLOBAL_AXIS', 'KINETIC'],
  cyber: ['CYBER'],
  business: ['BUSINESS'],
  government: ['GOV'],
  politics: ['POLITICS'],
};
const WEIGHT = { security: 1.4, cyber: 1.1, business: 1.0, government: 1.2, politics: 1.0, markets: 1.1, chatter: 0.6, signals: 0.6 };
const LABEL = { security: 'Security', cyber: 'Cyber', business: 'Business', government: 'Government', politics: 'Politics', markets: 'Markets', chatter: 'Chatter', signals: 'Signals' };
const VIEW = { security: 'dashboard', cyber: 'signals', business: 'business', government: 'government', politics: 'politics', markets: 'markets', chatter: 'chatter', signals: 'signals' };
const SCOPES = ['all', 'india', 'world'];
// Chatter and Signals are global instruments — they contribute the same reading
// to every scope.
const GLOBAL_DOMAINS = new Set(['chatter', 'signals']);

const isHot = (i, re) => i.severity === 'CRITICAL' || re.test(i.title || '') || (i.summary && re.test(i.summary));
const isIndia = i => i.wire === 'INDIA' || i.wire === 'SATP' || /\b(india|indian|delhi|mumbai|bengaluru|kolkata|chennai|hyderabad|kashmir|manipur|modi|rbi|sensex|nifty|rupee|new delhi)\b/i.test((i.title || '') + ' ' + (i.place || ''));

/** Pick a clean hero headline: real article, not a social post or stub. */
function pickTop(items) {
  const good = items.filter(i => i.kind !== 'social' && i.url && i.title && i.title.length > 20 && !/^@|^RT\b/i.test(i.title));
  const pool = good.length ? good : items.filter(i => i.kind !== 'social' && i.title && i.title.length > 10);
  const top = [...pool].sort((a, b) => (SEV[b.severity] - SEV[a.severity]) || (b.published - a.published))[0];
  return top ? { title: top.title, url: top.url || '', source: top.source, published: top.published } : null;
}

/** Share-of-hot score for a set of news items. */
function scoreItems(items, hotRe) {
  const total = items.length;
  const hot = items.filter(i => isHot(i, hotRe)).length;
  const score = Math.round(clamp((hot / Math.max(total, 6)) * 170 + Math.min(hot, 6) * 2, 0, 100));
  return { score, band: band(score), hot, total, top: pickTop(items) };
}

/** A news domain scored overall, and split into India vs World. */
function newsScoped(items, wires, hotRe) {
  const sub = items.filter(i => wires.includes(i.wire));
  return { all: scoreItems(sub, hotRe), india: scoreItems(sub.filter(isIndia), hotRe), world: scoreItems(sub.filter(i => !isIndia(i)), hotRe) };
}

/** Markets, from the financial-stress engine, split India vs World by country. */
function marketsScoped() {
  const c = crisisSnapshot();
  const stress = c.stress || [];
  const mk = list => {
    const top = list[0] || null;
    const score = top ? top.score : 0;
    return { score, band: band(score), hot: list.filter(s => s.score >= 50).length, total: list.length,
      top: top ? { title: `${top.country}: ${(top.drivers || [])[0] || 'financial stress'}`, url: '', source: 'Markets', published: c.updatedAt } : null,
      extra: { countries: list.slice(0, 6).map(s => ({ country: s.country, score: s.score, band: s.band })) } };
  };
  return { all: mk(stress), india: mk(stress.filter(s => /india/i.test(s.country))), world: mk(stress.filter(s => !/india/i.test(s.country))) };
}

function chatterDomain(items) {
  const a = analyzeChatter(items);
  const rising = (a.terms || []).filter(t => t.rising);
  const recentShare = a.total ? a.recentCount / a.total : 0;
  const score = Math.round(clamp(rising.length * 10 + recentShare * 60, 0, 100));
  const t = rising[0] || (a.terms || [])[0] || null;
  return { score, band: band(score), hot: rising.length, total: a.total || 0,
    top: t ? { title: `“${t.term}” — ${t.count} mentions${t.rising ? ', rising' : ''}`, url: '', source: 'Chatter', published: a.updatedAt } : null };
}

function signalsDomain() {
  const s = signalsSnapshot();
  const kp = s.space?.kp?.kp || 0;
  const mil = s.aircraft?.military || 0;
  const kpScore = kp >= 8 ? 90 : kp >= 7 ? 70 : kp >= 6 ? 50 : kp >= 5 ? 30 : 10;
  const milScore = clamp(mil * 1.4, 0, 70);
  const score = Math.round(clamp(Math.max(kpScore, milScore), 0, 100));
  const topTitle = kpScore >= milScore ? `Space weather: ${s.space?.kp?.level || 'quiet'} (Kp ${kp})` : `${mil} military aircraft tracked`;
  return { score, band: band(score), hot: (kp >= 6 ? 1 : 0) + (mil >= 30 ? 1 : 0), total: mil,
    top: { title: topTitle, url: '', source: 'Signals', published: s.updatedAt } };
}

const globalScoped = d => ({ all: d, india: d, world: d });

// -------------------------------------------------------------- history state
const HISTORY_MAX = 288; // 24h at 5-min cadence
let history = [];        // [{ t, composite, india, world, security, ... }]
let prev = null;         // last sampled scores, for trend
let loaded = false;

async function ensureLoaded(store) {
  if (loaded) return;
  loaded = true;
  try {
    const saved = await store.getSetting('risk_history');
    if (Array.isArray(saved)) history = saved.slice(-HISTORY_MAX);
    if (history.length) { prev = { ...history[history.length - 1] }; delete prev.t; }
  } catch { /* ignore */ }
}

function computeDomains() {
  const items = snapshot().items || [];
  return {
    security: newsScoped(items, WIRES_OF.security, HOT.security),
    cyber: newsScoped(items, WIRES_OF.cyber, HOT.cyber),
    business: newsScoped(items, WIRES_OF.business, HOT.business),
    government: newsScoped(items, WIRES_OF.government, HOT.government),
    politics: newsScoped(items, WIRES_OF.politics, HOT.politics),
    markets: marketsScoped(),
    chatter: globalScoped(chatterDomain(items)),
    signals: globalScoped(signalsDomain()),
  };
}

function composite(domains, scope) {
  let num = 0, den = 0;
  for (const [k, w] of Object.entries(WEIGHT)) { num += (domains[k]?.[scope]?.score || 0) * w; den += w; }
  const score = Math.round(clamp(num / den, 0, 100));
  return { score, band: band(score) };
}

const trendOf = (cur, was) => (was == null ? 'flat' : cur - was >= 4 ? 'up' : cur - was <= -4 ? 'down' : 'flat');

/** Full live risk picture for the API, scope-aware (Global / India / World). */
export async function computeRisk(store) {
  await ensureLoaded(store);
  const domains = computeDomains();
  const comp = {};
  for (const sc of SCOPES) { const c = composite(domains, sc); comp[sc] = { ...c, trend: trendOf(c.score, prev?.[sc === 'all' ? 'composite' : sc]) }; }
  return {
    updatedAt: snapshot().updatedAt,
    composite: comp, // { all:{score,band,trend}, india:{...}, world:{...} }
    domains: Object.entries(domains).map(([key, d]) => ({
      key, label: LABEL[key], view: VIEW[key], global: GLOBAL_DOMAINS.has(key),
      trend: trendOf(d.all.score, prev?.[key]),
      spark: history.map(h => h[key] ?? 0),
      all: d.all, india: d.india, world: d.world,
    })),
    compositeSpark: history.map(h => h.composite ?? 0),
    indiaSpark: history.map(h => h.india ?? 0),
    worldSpark: history.map(h => h.world ?? 0),
    history,
  };
}

/** Sample one point into the rolling history (called each feed refresh). */
export async function sampleRisk(store) {
  try {
    await ensureLoaded(store);
    const domains = computeDomains();
    const point = { t: Date.now(), composite: composite(domains, 'all').score, india: composite(domains, 'india').score, world: composite(domains, 'world').score };
    for (const k of Object.keys(domains)) point[k] = domains[k].all.score;
    history.push(point);
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    prev = { ...point }; delete prev.t;
    await store.setSetting('risk_history', history);
  } catch (e) { console.error('[risk] sample failed', e?.message); }
}
