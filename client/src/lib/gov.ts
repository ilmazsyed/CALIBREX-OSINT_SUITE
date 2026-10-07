// Government dashboard classification. Every GOV-wire item is tagged by policy
// domain, country, geopolitical area and alliance/bloc, so official decisions,
// orders and statements can be sliced India vs world, by country, area and by
// alliance (UN, NATO, EU, G7/G20, BRICS, QUAD, SCO…), with a countrywise stress
// meter built from the same tags.
import { LiveItem } from './live';
import { Band, bandOf } from './business';

const text = (i: LiveItem) => `${i.title} ${i.summary || ''} ${i.place?.name || ''}`.toLowerCase();

export type Area = 'South Asia' | 'East Asia' | 'Middle East & Gulf' | 'Europe' | 'North America' | 'Latin America' | 'Africa' | 'Oceania' | 'Global';

// ---- policy domains (first match wins) ----
export type Domain =
  | 'Foreign affairs & geopolitics' | 'Defence & military' | 'Elections & polity' | 'Law & order'
  | 'Crisis & unrest' | 'Disasters & relief' | 'Economy & fiscal' | 'Trade & commerce'
  | 'Energy & oil' | 'Food security' | 'Environment & climate' | 'Industry & infrastructure'
  | 'Democracy & rights' | 'Governance & orders';

const DOMAIN_RULES: [Domain, RegExp][] = [
  ['Crisis & unrest', /\b(coup|martial law|state of emergency|government collapse|constitutional crisis|impeach\w*|no-confidence|resign\w*|crackdown|curfew|uprising|mutiny)\b/i],
  ['Disasters & relief', /\b(disaster|earthquake|flood\w*|cyclone|hurricane|wildfire|drought|evacuat\w*|relief|famine|epidemic|pandemic|outbreak)\b/i],
  ['Defence & military', /\b(defen[cs]e|military|army|navy|air force|missile|troops|war\b|mobiliz\w*|procurement|arms deal|nuclear|border|ceasefire|deployment)\b/i],
  ['Foreign affairs & geopolitics', /\b(foreign min\w*|external affairs|state department|diplomat\w*|embassy|summit|treaty|bilateral|joint statement|sanction\w*|\bun\b|united nations|nato|security council|geopolit\w*)\b/i],
  ['Elections & polity', /\b(election\w*|\bpoll\b|referendum|parliament|congress|senate|lok sabha|rajya sabha|coalition|ballot|voting|inauguration|cabinet reshuffle)\b/i],
  ['Law & order', /\b(law and order|police|arrest\w*|riot\w*|protest\w*|unrest|violence|shutdown|ban\b|crackdown|detain\w*|sedition)\b/i],
  ['Energy & oil', /\b(crude oil|oil output|opec|fuel price|petrol|diesel|gas price|power sector|electricity|energy policy|grid|refinery|pipeline)\b/i],
  ['Food security', /\b(food security|foodgrain|wheat|rice export|\bmsp\b|ration|procurement price|famine|agricultur\w*|farm\w*)\b/i],
  ['Environment & climate', /\b(climate|emission\w*|carbon|environment\w*|pollution|cop\d+|renewable|deforest\w*|wildlife)\b/i],
  ['Trade & commerce', /\b(tariff\w*|trade deal|export\w*|import\w*|customs|\bwto\b|free trade|embargo|commerce|supply chain)\b/i],
  ['Economy & fiscal', /\b(budget|fiscal|central bank|interest rate|gdp|deficit|subsidy|disinvest\w*|\bgst\b|tax\w*|stimulus|\brbi\b|\bfed\b)\b/i],
  ['Industry & infrastructure', /\b(infrastructure|manufactur\w*|industr\w*|highway|railway|port\b|semiconductor|factory|project approval)\b/i],
  ['Democracy & rights', /\b(human rights|press freedom|civil liberties|free speech|minorit\w*|judiciary|supreme court|verdict|ruling|constitution)\b/i],
  ['Governance & orders', /\b(executive order|ordinance|decree|gazette|notification|cabinet approves|policy|scheme|reform|bill\b|regulation|mandate)\b/i],
];
export function domainOf(i: LiveItem): Domain {
  const t = text(i);
  for (const [d, re] of DOMAIN_RULES) if (re.test(t)) return d;
  return 'Governance & orders';
}

// ---- countries (name, matcher, area) ----
interface Country { name: string; re: RegExp; area: Area }
const COUNTRIES: Country[] = [
  { name: 'India', re: /\b(india|indian|new delhi|modi|lok sabha|rajya sabha)\b/i, area: 'South Asia' },
  { name: 'Pakistan', re: /\b(pakistan|islamabad|pakistani)\b/i, area: 'South Asia' },
  { name: 'Bangladesh', re: /\b(bangladesh|dhaka)\b/i, area: 'South Asia' },
  { name: 'Sri Lanka', re: /\b(sri lanka|colombo)\b/i, area: 'South Asia' },
  { name: 'Nepal', re: /\b(nepal|kathmandu)\b/i, area: 'South Asia' },
  { name: 'Afghanistan', re: /\b(afghanistan|kabul|taliban)\b/i, area: 'South Asia' },
  { name: 'China', re: /\b(china|chinese|beijing|xi jinping)\b/i, area: 'East Asia' },
  { name: 'Japan', re: /\b(japan|japanese|tokyo)\b/i, area: 'East Asia' },
  { name: 'South Korea', re: /\b(south korea|seoul)\b/i, area: 'East Asia' },
  { name: 'North Korea', re: /\b(north korea|pyongyang|kim jong)\b/i, area: 'East Asia' },
  { name: 'Taiwan', re: /\b(taiwan|taipei)\b/i, area: 'East Asia' },
  { name: 'Myanmar', re: /\b(myanmar|burma|naypyidaw)\b/i, area: 'East Asia' },
  { name: 'Indonesia', re: /\b(indonesia|jakarta)\b/i, area: 'East Asia' },
  { name: 'United States', re: /\b(united states|\bu\.?s\.?\b|america|american|washington|white house|pentagon|biden|trump)\b/i, area: 'North America' },
  { name: 'Canada', re: /\b(canada|canadian|ottawa)\b/i, area: 'North America' },
  { name: 'United Kingdom', re: /\b(united kingdom|britain|british|\buk\b|london|downing street)\b/i, area: 'Europe' },
  { name: 'France', re: /\b(france|french|paris|macron)\b/i, area: 'Europe' },
  { name: 'Germany', re: /\b(germany|german|berlin)\b/i, area: 'Europe' },
  { name: 'Russia', re: /\b(russia|russian|moscow|kremlin|putin)\b/i, area: 'Europe' },
  { name: 'Ukraine', re: /\b(ukraine|ukrainian|kyiv|zelensky)\b/i, area: 'Europe' },
  { name: 'Israel', re: /\b(israel|israeli|jerusalem|netanyahu)\b/i, area: 'Middle East & Gulf' },
  { name: 'Iran', re: /\b(iran|iranian|tehran)\b/i, area: 'Middle East & Gulf' },
  { name: 'Saudi Arabia', re: /\b(saudi|riyadh)\b/i, area: 'Middle East & Gulf' },
  { name: 'UAE', re: /\b(uae|emirates|abu dhabi|dubai)\b/i, area: 'Middle East & Gulf' },
  { name: 'Qatar', re: /\b(qatar|doha)\b/i, area: 'Middle East & Gulf' },
  { name: 'Turkey', re: /\b(turkey|turkish|ankara|erdogan)\b/i, area: 'Middle East & Gulf' },
  { name: 'Egypt', re: /\b(egypt|cairo)\b/i, area: 'Africa' },
  { name: 'Nigeria', re: /\b(nigeria|abuja)\b/i, area: 'Africa' },
  { name: 'South Africa', re: /\b(south africa|pretoria|johannesburg)\b/i, area: 'Africa' },
  { name: 'Brazil', re: /\b(brazil|brasilia|lula)\b/i, area: 'Latin America' },
  { name: 'Australia', re: /\b(australia|canberra)\b/i, area: 'Oceania' },
];
export function countryOf(i: LiveItem): string {
  const t = text(i);
  for (const c of COUNTRIES) if (c.re.test(t)) return c.name;
  return 'Other / multilateral';
}
export function areaOf(i: LiveItem): Area {
  const t = text(i);
  for (const c of COUNTRIES) if (c.re.test(t)) return c.area;
  return 'Global';
}
export const isIndia = (i: LiveItem) => /\b(india|indian|new delhi|lok sabha|rajya sabha|modi)\b/i.test(text(i));

// ---- alliances / blocs (an item can touch several) ----
export const ALLIANCES = ['UN', 'NATO', 'EU', 'G7', 'G20', 'BRICS', 'QUAD', 'SCO', 'ASEAN', 'GCC', 'OPEC', 'African Union'] as const;
export type Alliance = typeof ALLIANCES[number];
const ALLIANCE_RULES: [Alliance, RegExp][] = [
  ['UN', /\b(united nations|\bun\b|security council|unsc|general assembly|\bwho\b|unesco)\b/i],
  ['NATO', /\bnato\b/i],
  ['EU', /\b(european union|\beu\b|european commission|brussels|eurozone)\b/i],
  ['G7', /\bg-?7\b/i],
  ['G20', /\bg-?20\b/i],
  ['BRICS', /\bbrics\b/i],
  ['QUAD', /\bquad\b/i],
  ['SCO', /\b(sco|shanghai cooperation)\b/i],
  ['ASEAN', /\basean\b/i],
  ['GCC', /\b(gcc|gulf cooperation)\b/i],
  ['OPEC', /\bopec\b/i],
  ['African Union', /\b(african union|\bau\b summit)\b/i],
];
export function alliancesOf(i: LiveItem): Alliance[] {
  const t = text(i);
  return ALLIANCE_RULES.filter(([, re]) => re.test(t)).map(([a]) => a);
}

// ---- significance + document detection ----
const SIGNIFICANT = /\b(executive order|ordinance|decree|state of emergency|martial law|coup|sanction\w*|\bban\b|war\b|mobiliz\w*|ceasefire|treaty|impeach\w*|no-confidence|resign\w*|dissolv\w*|verdict|ruling|emergency|evacuat\w*|airstrike|nuclear|embargo|crackdown|curfew|summit|bill passed|ordains)\b/i;
export const isSignificant = (i: LiveItem) => SIGNIFICANT.test(`${i.title} ${i.summary || ''}`);
/** Official releases are themselves the document; link to them prominently. */
export const isDocument = (i: LiveItem) => i.kind === 'official';

// ---- countrywise stress ----
export interface CountryStress { country: string; score: number; band: Band; total: number; signif: number }
export function countryStress(items: LiveItem[], limit = 8): CountryStress[] {
  const groups = new Map<string, LiveItem[]>();
  for (const i of items) {
    const c = countryOf(i);
    if (c === 'Other / multilateral') continue;
    (groups.get(c) || groups.set(c, []).get(c)!).push(i);
  }
  const out: CountryStress[] = [];
  for (const [country, list] of groups) {
    const signif = list.filter(isSignificant).length;
    const score = Math.min(100, signif * 16 + Math.max(0, list.length - signif) * 3);
    out.push({ country, score, band: bandOf(score), total: list.length, signif });
  }
  return out.sort((a, b) => b.score - a.score || b.total - a.total).slice(0, limit);
}

export { bandOf } from './business';
export type { Band } from './business';
