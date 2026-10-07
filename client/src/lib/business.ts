// Business Watch classification. Every BUSINESS-wire item is tagged along four
// lenses — India vs global, geopolitical area, power axis, and theme — from its
// title/summary/place, so the screen can show it at world, India, area and axis
// level with a 50/50 India/global weighting.
import { LiveItem } from './live';

export type Area = 'South Asia' | 'East Asia' | 'Middle East & Gulf' | 'Europe' | 'North America' | 'Latin America' | 'Africa' | 'Global';
export type Axis = 'India' | 'US & West' | 'China' | 'Russia & Eurasia' | 'Gulf & OPEC' | 'Unaligned';
export type Theme = 'M&A & deals' | 'Distress & failures' | 'Tycoons & oligarchs' | 'Money markets' | 'Insider chatter' | 'Business intel';

const text = (i: LiveItem) => `${i.title} ${i.summary || ''} ${i.place?.name || ''}`.toLowerCase();

const IN_RE = /\b(india|indian|kashmir|mumbai|delhi|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|gujarat|reliance|adani|tata|ambani|birla|mahindra|infosys|wipro|vedanta|jsw|bajaj|jio|sensex|nifty|\brbi\b|rupee|sebi|\bnclt\b|\bibc\b)\b/i;

/** India-facing when the place or the text points at India / Indian business. */
export function isIndia(i: LiveItem): boolean {
  return i.wire === 'INDIA' || IN_RE.test(text(i));
}

const AREA_RULES: [Area, RegExp][] = [
  ['South Asia', /\b(india|indian|pakistan|bangladesh|sri lanka|nepal|south asia|mumbai|delhi|karachi|dhaka)\b/i],
  ['East Asia', /\b(china|chinese|beijing|shanghai|hong kong|taiwan|japan|japanese|tokyo|korea|korean|seoul|alibaba|tencent|evergrande|\byuan\b|\byen\b)\b/i],
  ['Middle East & Gulf', /\b(saudi|aramco|uae|emirates|dubai|abu dhabi|qatar|kuwait|bahrain|oman|opec|gulf|israel|turkey|turkish|iran)\b/i],
  ['Europe', /\b(europe|european|\beu\b|britain|british|uk|london|germany|german|france|french|italy|spain|swiss|switzerland|ecb|euro\b)\b/i],
  ['North America', /\b(united states|\bu\.?s\.?\b|america|american|wall street|new york|nasdaq|\bdow\b|\bfed\b|federal reserve|canada|silicon valley|washington)\b/i],
  ['Latin America', /\b(brazil|brazilian|mexico|mexican|argentina|chile|colombia|latin america|sao paulo)\b/i],
  ['Africa', /\b(africa|african|nigeria|south africa|egypt|kenya|ethiopia|johannesburg)\b/i],
];
export function areaOf(i: LiveItem): Area {
  const t = text(i);
  for (const [area, re] of AREA_RULES) if (re.test(t)) return area;
  return 'Global';
}

const AXIS_RULES: [Axis, RegExp][] = [
  ['India', IN_RE],
  ['China', /\b(china|chinese|beijing|xi jinping|\byuan\b|\bpboc\b|alibaba|tencent|huawei|evergrande|jack ma)\b/i],
  ['Russia & Eurasia', /\b(russia|russian|kremlin|moscow|putin|gazprom|rosneft|ruble|oligarch)\b/i],
  ['Gulf & OPEC', /\b(saudi|aramco|opec|uae|abu dhabi|qatar|kuwait|sovereign wealth|\bpif\b|gulf)\b/i],
  ['US & West', /\b(united states|\bu\.?s\.?\b|america|american|wall street|nasdaq|\bdow\b|\bfed\b|federal reserve|europe|european|\beu\b|\becb\b|london|germany|musk|bezos|buffett|blackrock|silicon valley)\b/i],
];
export function axisOf(i: LiveItem): Axis {
  const t = text(i);
  for (const [axis, re] of AXIS_RULES) if (re.test(t)) return axis;
  return 'Unaligned';
}

const THEME_RULES: [Theme, RegExp][] = [
  ['Distress & failures', /\b(bankrupt\w*|insolven\w*|distress\w*|default\w*|collapse\w*|liquidat\w*|layoff\w*|shutdown|bailout|debt crisis|fraud|scam|probe|chapter 11|\bnclt\b|\bibc\b)\b/i],
  ['M&A & deals', /\b(merger|acquisition|acquire\w*|takeover|buyout|\bm&a\b|stake sale|ipo|delisting|private equity|venture capital|megadeal|antitrust)\b/i],
  ['Tycoons & oligarchs', /\b(billionaire|tycoon|magnate|mogul|oligarch|promoter|chairman|\bceo\b|founder|wealth|fortune|empire|musk|bezos|buffett|ambani|adani|jack ma)\b/i],
  ['Money markets', /\b(stock market|stocks|shares|bond|yield|interest rate|repo rate|inflation|recession|currency|rupee|dollar|\bfed\b|central bank|\brbi\b|\becb\b|sensex|nifty|wall street)\b/i],
  ['Insider chatter', /\b(sources say|in talks|mulls|weighs|explores|considering|reportedly|rumou?r|insider|leak\w*|said to)\b/i],
];
export function themeOf(i: LiveItem): Theme {
  const t = text(i);
  for (const [theme, re] of THEME_RULES) if (re.test(t)) return theme;
  return 'Business intel';
}

// High-impact events, mirroring the server's business-push gate.
const SIGNIFICANT = /\b(bankrupt\w*|insolven\w*|liquidat\w*|default\w*|collapse\w*|bailout|chapter 11|shutdown|mass layoffs?|job cuts|lay(?:s|ing)? off|fraud|scam|ponzi|embezzl\w*|money laundering|raid(?:s|ed)?|\bprobe\b|crash\w*|plunge\w*|tumbl\w*|wiped out|\brout\b|crisis|downgrad\w*|delist\w*|sanction\w*|mega-?deal|hostile takeover|takeover bid|buyout)\b/i;
export const isSignificant = (i: LiveItem) => SIGNIFICANT.test(`${i.title} ${i.summary || ''}`);

// Market/credit shocks — the sharp end of distress, used for the crisis meter.
const SHOCK = /\b(crash\w*|plunge\w*|tumbl\w*|\brout\b|sell-?off|meltdown|wiped out|downgrad\w*|default\w*|collapse\w*|\bcrisis\b|bank run)\b/i;
export const isShock = (i: LiveItem) => SHOCK.test(`${i.title} ${i.summary || ''}`);

export type Band = 'CALM' | 'ELEVATED' | 'STRESS' | 'CRISIS';
export const bandOf = (score: number): Band => score >= 75 ? 'CRISIS' : score >= 50 ? 'STRESS' : score >= 25 ? 'ELEVATED' : 'CALM';

export interface Stress { score: number; band: Band; drivers: string[]; distress: number; shocks: number; deals: number; total: number }

/**
 * A 0–100 "business stress" read for a set of items: weighted by failures/
 * distress, market shocks and heavy deal activity. Heuristic and transparent —
 * a read on where economic pressure is building, not investment advice.
 */
export function stressOf(items: LiveItem[]): Stress {
  const distress = items.filter(i => themeOf(i) === 'Distress & failures').length;
  const shocks = items.filter(isShock).length;
  const deals = items.filter(i => themeOf(i) === 'M&A & deals').length;
  const score = Math.min(100, distress * 12 + shocks * 9 + Math.max(0, deals - 2) * 2);
  const drivers: string[] = [];
  if (distress) drivers.push(`${distress} distress/failure${distress > 1 ? 's' : ''}`);
  if (shocks) drivers.push(`${shocks} market shock${shocks > 1 ? 's' : ''}`);
  if (deals) drivers.push(`${deals} major deal${deals > 1 ? 's' : ''}`);
  if (!drivers.length) drivers.push('routine business flow');
  return { score, band: bandOf(score), drivers, distress, shocks, deals, total: items.length };
}

/**
 * Weight a ranked (newest-first) list ~50/50 India / global, topping up from the
 * surplus side when the other is short so neither view is starved.
 */
export function balance5050<T>(items: T[], isIndiaItem: (x: T) => boolean, limit: number): T[] {
  if (items.length <= limit) return items;
  const india = items.filter(isIndiaItem);
  const global = items.filter(x => !isIndiaItem(x));
  let nIndia = Math.round(limit * 0.5);
  let nGlobal = limit - nIndia;
  if (india.length < nIndia) { nGlobal += nIndia - india.length; nIndia = india.length; }
  if (global.length < nGlobal) { nIndia = Math.min(india.length, nIndia + (nGlobal - global.length)); nGlobal = global.length; }
  const picked = new Set<T>([...india.slice(0, nIndia), ...global.slice(0, nGlobal)]);
  return items.filter(x => picked.has(x));
}
