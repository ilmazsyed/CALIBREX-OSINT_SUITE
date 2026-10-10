// Consolidated risk engine. Rolls every monitor up into one picture: a per-
// domain band/score, a weighted composite index, an India vs World split, a
// trend vs the previous sample, and a rolling history for sparklines.
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
const UNION_HOT = new RegExp('(' + Object.values(HOT).map(r => r.source).join('|') + ')', 'i');
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

const isHot = (i, re) => i.severity === 'CRITICAL' || re.test(i.title || '') || (i.summary && re.test(i.summary));
const isIndia = i => i.wire === 'INDIA' || i.wire === 'SATP' || /\b(india|indian|delhi|mumbai|bengaluru|kolkata|chennai|kashmir|manipur|modi|rbi|sensex|nifty|rupee)\b/i.test((i.title || '') + ' ' + (i.place || ''));

/** Share-of-hot score for a set of news items (same shape the client dashboards use). */
function scoreItems(items, hotRe) {
  const total = items.length;
  const hotItems = items.filter(i => isHot(i, hotRe));
  const hot = hotItems.length;
  const score = Math.round(clamp((hot / Math.max(total, 6)) * 170 + Math.min(hot, 6) * 2, 0, 100));
  const top = [...items].sort((a, b) => (SEV[b.severity] - SEV[a.severity]) || (b.published - a.published))[0] || null;
  return { score, band: band(score), hot, total, top: top ? { title: top.title, url: top.url, source: top.source, published: top.published } : null };
}

function marketsDomain() {
  const c = crisisSnapshot();
  const stress = (c.stress || []).slice();
  const topC = stress[0] || null;
  const score = topC ? topC.score : 0;
  return { score, band: band(score), hot: stress.filter(s => s.score >= 50).length, total: stress.length,
    top: topC ? { title: `${topC.country}: ${(topC.drivers || [])[0] || 'financial stress'}`, url: '', source: 'Markets', published: c.updatedAt } : null,
    extra: { countries: stress.slice(0, 6).map(s => ({ country: s.country, score: s.score, band: s.band })) } };
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
  const topTitle = kpScore >= milScore
    ? `Space weather: ${s.space?.kp?.level || 'quiet'} (Kp ${kp})`
    : `${mil} military aircraft tracked`;
  return { score, band: band(score), hot: (kp >= 6 ? 1 : 0) + (mil >= 30 ? 1 : 0), total: mil,
    top: { title: topTitle, url: '', source: 'Signals', published: s.updatedAt } };
}

// -------------------------------------------------------------- history state
const HISTORY_MAX = 288; // 24h at 5-min cadence
let history = [];        // [{ t, composite, security, cyber, ... }]
let prev = null;         // last sampled per-domain scores, for trend
let loaded = false;

async function ensureLoaded(store) {
  if (loaded) return;
  loaded = true;
  try {
    const saved = await store.getSetting('risk_history');
    if (Array.isArray(saved)) history = saved.slice(-HISTORY_MAX);
    if (history.length) { const last = history[history.length - 1]; prev = { ...last }; delete prev.t; delete prev.composite; }
  } catch { /* ignore */ }
}

function computeDomains() {
  const items = snapshot().items || [];
  const byWire = (wires, re) => scoreItems(items.filter(i => wires.includes(i.wire)), re);
  const domains = {
    security: byWire(WIRES_OF.security, HOT.security),
    cyber: byWire(WIRES_OF.cyber, HOT.cyber),
    business: byWire(WIRES_OF.business, HOT.business),
    government: byWire(WIRES_OF.government, HOT.government),
    politics: byWire(WIRES_OF.politics, HOT.politics),
    markets: marketsDomain(),
    chatter: chatterDomain(items),
    signals: signalsDomain(),
  };
  // India vs World over the news domains.
  const newsItems = items.filter(i => [...WIRES_OF.security, ...WIRES_OF.cyber, ...WIRES_OF.business, ...WIRES_OF.government, ...WIRES_OF.politics].includes(i.wire));
  const india = scoreItems(newsItems.filter(isIndia), UNION_HOT);
  const world = scoreItems(newsItems.filter(i => !isIndia(i)), UNION_HOT);
  return { domains, india, world, items };
}

function composite(domains) {
  let num = 0, den = 0;
  for (const [k, w] of Object.entries(WEIGHT)) { num += (domains[k]?.score || 0) * w; den += w; }
  const score = Math.round(clamp(num / den, 0, 100));
  return { score, band: band(score) };
}

const trendOf = (cur, was) => (was == null ? 'flat' : cur - was >= 4 ? 'up' : cur - was <= -4 ? 'down' : 'flat');

/** Full live risk picture for the API. */
export async function computeRisk(store) {
  await ensureLoaded(store);
  const { domains, india, world } = computeDomains();
  const comp = composite(domains);
  const crisisFeed = [];
  for (const [k, d] of Object.entries(domains)) if (d.top && (d.band === 'CRISIS' || d.band === 'STRESS')) crisisFeed.push({ domain: LABEL[k], key: k, view: VIEW[k], band: d.band, score: d.score, ...d.top });
  crisisFeed.sort((a, b) => b.score - a.score);
  const out = {
    updatedAt: snapshot().updatedAt,
    composite: { ...comp, trend: trendOf(comp.score, prev?.composite) },
    india: { ...india, trend: trendOf(india.score, prev?.india) },
    world: { ...world, trend: trendOf(world.score, prev?.world) },
    domains: Object.entries(domains).map(([key, d]) => ({
      key, label: LABEL[key], view: VIEW[key], score: d.score, band: d.band, hot: d.hot, total: d.total,
      trend: trendOf(d.score, prev?.[key]), top: d.top || null, extra: d.extra || null,
      spark: history.map(h => h[key] ?? 0),
    })),
    compositeSpark: history.map(h => h.composite ?? 0),
    history,
  };
  return out;
}

/** Sample one point into the rolling history (called each feed refresh). */
export async function sampleRisk(store) {
  try {
    await ensureLoaded(store);
    const { domains, india, world } = computeDomains();
    const comp = composite(domains);
    const point = { t: Date.now(), composite: comp.score, india: india.score, world: world.score };
    for (const k of Object.keys(domains)) point[k] = domains[k].score;
    history.push(point);
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    prev = { ...point }; delete prev.t;
    await store.setSetting('risk_history', history);
  } catch (e) { console.error('[risk] sample failed', e?.message); }
}
