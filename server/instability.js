// Country Instability Index (CII): a per-country score derived from OBSERVED
// reporting intensity across the live wires — conflict, security, governance,
// political and economic stress signals, weighted by severity and recency.
//
// HONESTY: this is a measure of observed signal intensity, NOT a forecast or a
// probability. It says "a lot of severe instability reporting is converging on
// this country right now", not "this country will destabilise". The API labels
// it as such and nothing here invents a number.
import { snapshot } from './feeds.js';

const DAY = 86400000;
const WINDOW_MS = 3 * DAY;
const SEV = { CRITICAL: 4, HIGH: 3, MEDIUM: 1.6, LOW: 0.6 };
// Wires that speak to instability carry more weight than routine business/news.
const WIRE_W = { KINETIC: 1.5, SATP: 1.4, INDIA: 1.2, REGIONAL: 1.3, GLOBAL_AXIS: 1.1, GOV: 1.0, POLITICS: 1.1, FATF: 0.9, CYBER: 0.7, BUSINESS: 0.6 };
// Words that mark genuine instability (vs ordinary coverage).
const HOT = /\b(kill(?:ed|s|ing)?|dead|deaths?|massacre|attack\w*|strike\w*|missile|airstrike|shelling|clash\w*|blast|bomb\w*|explosion|war|invasion|offensive|coup|militant\w*|terror\w*|ambush|insurgen\w*|unrest|riot\w*|protest\w*|crackdown|martial law|"state of emergency"|curfew|ceasefire|displac\w*|refugee|famine|collapse|overthrow|junta|mutiny|secession|sanction\w*|default|hyperinflation|currency crisis)\b/i;

// Curated geopolitically significant countries: display name, lat, lng, and an
// alias regex (name + demonym + capital + key hotspots). Focused but broad.
const C = (name, lat, lng, re) => ({ name, lat, lng, re: new RegExp(`\\b(?:${re})\\b`, 'i') });
const COUNTRIES = [
  C('India', 22.5, 79, 'India|Indian|New Delhi|Mumbai|Kashmir|Manipur|Naxal|Maoist'),
  C('Pakistan', 30.4, 69.3, 'Pakistan|Pakistani|Islamabad|Karachi|Lahore|Balochistan|Waziristan|Khyber Pakhtunkhwa|TTP'),
  C('Afghanistan', 33.9, 67.7, 'Afghanistan|Afghan|Kabul|Kandahar|Taliban|ISKP'),
  C('Bangladesh', 23.7, 90.4, 'Bangladesh|Bangladeshi|Dhaka'),
  C('Sri Lanka', 7.9, 80.8, 'Sri Lanka|Sri Lankan|Colombo'),
  C('Myanmar', 21.9, 95.9, 'Myanmar|Burma|Burmese|Yangon|Naypyidaw|junta|Rohingya|Rakhine'),
  C('China', 35.9, 104, 'China|Chinese|Beijing|PLA|Xinjiang|Uyghur'),
  C('Taiwan', 23.7, 121, 'Taiwan|Taiwanese|Taipei|Taiwan Strait'),
  C('Russia', 61.5, 105, 'Russia|Russian|Moscow|Kremlin|Putin'),
  C('Ukraine', 48.4, 31.2, 'Ukraine|Ukrainian|Kyiv|Kharkiv|Donetsk|Zaporizhzhia'),
  C('Israel', 31.5, 34.9, 'Israel|Israeli|Tel Aviv|Jerusalem|IDF|Gaza|West Bank'),
  C('Palestine', 31.9, 35.2, 'Palestine|Palestinian|Gaza|Hamas|Ramallah'),
  C('Lebanon', 33.9, 35.9, 'Lebanon|Lebanese|Beirut|Hezbollah'),
  C('Syria', 34.8, 38.9, 'Syria|Syrian|Damascus|Aleppo|Idlib'),
  C('Iran', 32.4, 53.7, 'Iran|Iranian|Tehran|IRGC'),
  C('Iraq', 33.2, 43.7, 'Iraq|Iraqi|Baghdad|Mosul'),
  C('Yemen', 15.5, 48.5, 'Yemen|Yemeni|Sanaa|Houthi|Aden'),
  C('Saudi Arabia', 23.9, 45.1, 'Saudi Arabia|Saudi|Riyadh'),
  C('Turkey', 39, 35.2, 'Turkey|Turkish|Ankara|Istanbul|Erdogan'),
  C('Egypt', 26.8, 30.8, 'Egypt|Egyptian|Cairo|Sinai'),
  C('Libya', 26.3, 17.2, 'Libya|Libyan|Tripoli|Benghazi'),
  C('Sudan', 12.9, 30.2, 'Sudan|Sudanese|Khartoum|Darfur|RSF'),
  C('South Sudan', 6.9, 31.3, 'South Sudan|Juba'),
  C('Ethiopia', 9.1, 40.5, 'Ethiopia|Ethiopian|Addis Ababa|Tigray|Amhara'),
  C('Somalia', 5.2, 46.2, 'Somalia|Somali|Mogadishu|al-Shabaab|Shabaab'),
  C('Nigeria', 9.1, 8.7, 'Nigeria|Nigerian|Abuja|Lagos|Boko Haram'),
  C('Mali', 17.6, -4, 'Mali|Malian|Bamako|Wagner'),
  C('Burkina Faso', 12.2, -1.6, 'Burkina Faso|Ouagadougou'),
  C('Niger', 17.6, 8.1, 'Niger\\b|Nigerien|Niamey'),
  C('DR Congo', -4, 21.8, 'DR Congo|DRC|Democratic Republic of the Congo|Kinshasa|Goma|M23'),
  C('Mozambique', -18.7, 35.5, 'Mozambique|Cabo Delgado|Maputo'),
  C('Venezuela', 6.4, -66.6, 'Venezuela|Venezuelan|Caracas|Maduro'),
  C('Haiti', 19, -72.3, 'Haiti|Haitian|Port-au-Prince'),
  C('Colombia', 4.6, -74.3, 'Colombia|Colombian|Bogota|ELN|FARC'),
  C('Mexico', 23.6, -102.5, 'Mexico|Mexican|cartel|Sinaloa|CJNG'),
  C('North Korea', 40.3, 127.5, 'North Korea|North Korean|Pyongyang|DPRK'),
  C('South Korea', 36.5, 127.8, 'South Korea|South Korean|Seoul'),
  C('Japan', 36.2, 138.3, 'Japan|Japanese|Tokyo'),
  C('Philippines', 12.9, 121.8, 'Philippines|Philippine|Filipino|Manila'),
  C('Indonesia', -0.8, 113.9, 'Indonesia|Indonesian|Jakarta'),
  C('Thailand', 15.9, 101, 'Thailand|Thai|Bangkok'),
  C('United States', 39.8, -98.6, 'United States|U\\.?S\\.?A?|America|American|Washington'),
  C('United Kingdom', 54, -2, 'United Kingdom|Britain|British|London'),
  C('France', 46.6, 2.2, 'France|French|Paris'),
  C('Germany', 51.2, 10.4, 'Germany|German|Berlin'),
  C('Armenia', 40.1, 45, 'Armenia|Armenian|Yerevan|Nagorno-Karabakh'),
  C('Azerbaijan', 40.1, 47.6, 'Azerbaijan|Azerbaijani|Baku'),
  C('Georgia (country)', 42.3, 43.4, 'Tbilisi|Georgian government|Republic of Georgia'),
];

let history = [];                 // [{ t, scores: { country: score } }]
const HISTORY_MAX = 400;

const band = s => (s >= 70 ? 'SEVERE' : s >= 45 ? 'HIGH' : s >= 22 ? 'ELEVATED' : 'LOW');

/** Compute the index from the current feed items. Pure over its input. */
export function computeInstability(items, now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  const agg = new Map();           // name -> { raw, lead:[{w,title,url,source,published}] }
  for (const it of items || []) {
    if (!it || (it.published || 0) < cutoff) continue;
    const text = `${it.title} ${it.summary || ''}`;
    const sev = SEV[it.severity] ?? 0.6;
    const wireW = WIRE_W[it.wire] ?? 0.8;
    const hot = HOT.test(text) ? 1 : 0.25;                 // non-instability coverage counts little
    const recency = Math.max(0.2, 1 - (now - (it.published || now)) / WINDOW_MS);
    const w = sev * wireW * hot * recency;
    if (w <= 0) continue;
    for (const c of COUNTRIES) {
      if (!c.re.test(text)) continue;
      const a = agg.get(c.name) || { raw: 0, lead: [] };
      a.raw += w;
      a.lead.push({ w, title: it.title, url: it.url, source: it.source, published: it.published, severity: it.severity });
      agg.set(c.name, a);
    }
  }
  const K = 14;                    // saturation constant → smooth 0..100 curve
  const list = [];
  for (const c of COUNTRIES) {
    const a = agg.get(c.name);
    if (!a) continue;
    const score = Math.min(100, Math.round(100 * (1 - Math.exp(-a.raw / K))));
    if (score < 1) continue;
    const lead = a.lead.sort((x, y) => y.w - x.w).slice(0, 4)
      .map(s => ({ title: s.title, url: s.url, source: s.source, published: s.published, severity: s.severity }));
    list.push({ country: c.name, lat: c.lat, lng: c.lng, score, band: band(score), reports: a.lead.length, signals: lead });
  }
  return list.sort((a, b) => b.score - a.score);
}

let state = { updatedAt: 0, countries: [] };

/** Recompute from the live feed and record a sample for 24h deltas. */
export function sampleInstability(now = Date.now()) {
  const items = snapshot().items || [];
  const countries = computeInstability(items, now);
  // 24h delta: compare against the sample closest to 24h ago.
  const past = history.find(h => now - h.t >= DAY) || history[0];
  for (const c of countries) c.delta24h = past ? c.score - (past.scores[c.country] || 0) : 0;
  history.push({ t: now, scores: Object.fromEntries(countries.map(c => [c.country, c.score])) });
  if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
  state = { updatedAt: now, countries };
  return state;
}

export function instabilitySnapshot() {
  return {
    updatedAt: state.updatedAt,
    countries: state.countries,
    note: 'Observed instability-signal intensity across the live wires over the last 72 hours — not a forecast or probability.',
  };
}

// Seed/restore the 24h history across restarts (optional; wired from index.js).
export function loadInstabilityHistory(h) { if (Array.isArray(h)) history = h.slice(-HISTORY_MAX); }
export function dumpInstabilityHistory() { return history; }
