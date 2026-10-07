// Election & Politics classification. Tags each POLITICS-wire item by country,
// area, power axis and type, detects the leaders and parties it mentions, and
// derives a transparent "news momentum" signal from coverage volume and tone.
//
// IMPORTANT: momentum is NOT an opinion poll or approval rating. It measures how
// a leader/party is being covered right now (how much, and how positive/
// negative the language is). The UI labels it as such and links out to real
// poll trackers. We never fabricate poll numbers or vote tallies.
import { LiveItem } from './live';
import { Band, bandOf } from './business';

const text = (i: LiveItem) => `${i.title} ${i.summary || ''} ${i.place?.name || ''}`.toLowerCase();

export type Area = 'South Asia' | 'East Asia' | 'Middle East & Gulf' | 'Europe' | 'North America' | 'Latin America' | 'Africa' | 'Oceania' | 'Global';
export type Axis = 'India' | 'US & West' | 'China' | 'Russia & Eurasia' | 'Gulf & OPEC' | 'Unaligned';
export type PolType = 'Upheaval & crisis' | 'Elections' | 'Leadership' | 'Polls & chatter' | 'Party & campaign';

const IN_RE = /\b(india|indian|new delhi|modi|rahul gandhi|\bbjp\b|congress party|lok sabha|kejriwal|mamata)\b/i;
export const isIndia = (i: LiveItem) => IN_RE.test(text(i));

interface Country { name: string; re: RegExp; area: Area; axis: Axis }
const COUNTRIES: Country[] = [
  { name: 'India', re: /\b(india|indian|new delhi|modi|lok sabha|\bbjp\b)\b/i, area: 'South Asia', axis: 'India' },
  { name: 'Pakistan', re: /\b(pakistan|islamabad|imran khan|shehbaz)\b/i, area: 'South Asia', axis: 'Unaligned' },
  { name: 'Bangladesh', re: /\b(bangladesh|dhaka|hasina|yunus)\b/i, area: 'South Asia', axis: 'Unaligned' },
  { name: 'Sri Lanka', re: /\b(sri lanka|colombo)\b/i, area: 'South Asia', axis: 'Unaligned' },
  { name: 'China', re: /\b(china|chinese|beijing|xi jinping)\b/i, area: 'East Asia', axis: 'China' },
  { name: 'Japan', re: /\b(japan|japanese|tokyo)\b/i, area: 'East Asia', axis: 'US & West' },
  { name: 'South Korea', re: /\b(south korea|seoul)\b/i, area: 'East Asia', axis: 'US & West' },
  { name: 'Taiwan', re: /\b(taiwan|taipei)\b/i, area: 'East Asia', axis: 'US & West' },
  { name: 'Indonesia', re: /\b(indonesia|jakarta)\b/i, area: 'East Asia', axis: 'Unaligned' },
  { name: 'United States', re: /\b(united states|\bu\.?s\.?\b|america|american|washington|white house|trump|biden)\b/i, area: 'North America', axis: 'US & West' },
  { name: 'United Kingdom', re: /\b(united kingdom|britain|british|\buk\b|london|starmer|sunak)\b/i, area: 'Europe', axis: 'US & West' },
  { name: 'France', re: /\b(france|french|paris|macron)\b/i, area: 'Europe', axis: 'US & West' },
  { name: 'Germany', re: /\b(germany|german|berlin|scholz|merz)\b/i, area: 'Europe', axis: 'US & West' },
  { name: 'Italy', re: /\b(italy|italian|rome|meloni)\b/i, area: 'Europe', axis: 'US & West' },
  { name: 'Russia', re: /\b(russia|russian|moscow|kremlin|putin)\b/i, area: 'Europe', axis: 'Russia & Eurasia' },
  { name: 'Ukraine', re: /\b(ukraine|ukrainian|kyiv|zelensky)\b/i, area: 'Europe', axis: 'US & West' },
  { name: 'Israel', re: /\b(israel|israeli|netanyahu)\b/i, area: 'Middle East & Gulf', axis: 'US & West' },
  { name: 'Iran', re: /\b(iran|iranian|tehran)\b/i, area: 'Middle East & Gulf', axis: 'Unaligned' },
  { name: 'Turkey', re: /\b(turkey|turkish|ankara|erdogan)\b/i, area: 'Middle East & Gulf', axis: 'Unaligned' },
  { name: 'Saudi Arabia', re: /\b(saudi|riyadh)\b/i, area: 'Middle East & Gulf', axis: 'Gulf & OPEC' },
  { name: 'Brazil', re: /\b(brazil|brasilia|lula|bolsonaro)\b/i, area: 'Latin America', axis: 'Unaligned' },
  { name: 'South Africa', re: /\b(south africa|pretoria|\banc\b)\b/i, area: 'Africa', axis: 'Unaligned' },
  { name: 'Australia', re: /\b(australia|canberra|albanese)\b/i, area: 'Oceania', axis: 'US & West' },
];
export function countryOf(i: LiveItem): string { const t = text(i); for (const c of COUNTRIES) if (c.re.test(t)) return c.name; return 'Other / multilateral'; }
export function areaOf(i: LiveItem): Area { const t = text(i); for (const c of COUNTRIES) if (c.re.test(t)) return c.area; return 'Global'; }
export function axisOf(i: LiveItem): Axis { const t = text(i); for (const c of COUNTRIES) if (c.re.test(t)) return c.axis; return 'Unaligned'; }

// ---- type ----
const TYPE_RULES: [PolType, RegExp][] = [
  ['Upheaval & crisis', /\b(coup|government collapse|constitutional crisis|political crisis|impeach\w*|no-confidence|ousted|steps down|resign\w*|dissolv\w*|protests?|unrest|power struggle|floor test|defection)\b/i],
  ['Elections', /\b(election\w*|\bpoll\b|\bvote\b|ballot|referendum|runoff|by-?election|constituency|counting|exit poll|results?)\b/i],
  ['Polls & chatter', /\b(opinion poll|approval rating|favou?rability|survey|forecast|projection|psepholog\w*|seat projection|voter (?:mood|sentiment)|poll of polls)\b/i],
  ['Leadership', /\b(prime minister|president|chancellor|premier|chief minister|cabinet|sworn in|takes office|leadership)\b/i],
];
export function typeOf(i: LiveItem): PolType { const t = text(i); for (const [p, re] of TYPE_RULES) if (re.test(t)) return p; return 'Party & campaign'; }

// ---- leaders & parties ----
export interface Figure { name: string; re: RegExp; country: string }
export const LEADERS: Figure[] = [
  { name: 'Narendra Modi', re: /\bmodi\b/i, country: 'India' },
  { name: 'Rahul Gandhi', re: /\brahul gandhi\b/i, country: 'India' },
  { name: 'Amit Shah', re: /\bamit shah\b/i, country: 'India' },
  { name: 'Arvind Kejriwal', re: /\bkejriwal\b/i, country: 'India' },
  { name: 'Mamata Banerjee', re: /\bmamata\b/i, country: 'India' },
  { name: 'Donald Trump', re: /\btrump\b/i, country: 'United States' },
  { name: 'Joe Biden', re: /\bbiden\b/i, country: 'United States' },
  { name: 'Vladimir Putin', re: /\bputin\b/i, country: 'Russia' },
  { name: 'Xi Jinping', re: /\bxi jinping\b/i, country: 'China' },
  { name: 'Volodymyr Zelensky', re: /\bzelensky\b/i, country: 'Ukraine' },
  { name: 'Benjamin Netanyahu', re: /\bnetanyahu\b/i, country: 'Israel' },
  { name: 'Keir Starmer', re: /\bstarmer\b/i, country: 'United Kingdom' },
  { name: 'Emmanuel Macron', re: /\bmacron\b/i, country: 'France' },
  { name: 'Recep Tayyip Erdogan', re: /\berdogan\b/i, country: 'Turkey' },
  { name: 'Luiz Inácio Lula', re: /\blula\b/i, country: 'Brazil' },
  { name: 'Shehbaz Sharif', re: /\b(shehbaz|sharif)\b/i, country: 'Pakistan' },
];
export const PARTIES: Figure[] = [
  { name: 'BJP', re: /\bbjp\b|bharatiya janata/i, country: 'India' },
  { name: 'Congress (INC)', re: /indian national congress|congress party|\binc\b/i, country: 'India' },
  { name: 'AAP', re: /\baap\b|aam aadmi/i, country: 'India' },
  { name: 'Trinamool (TMC)', re: /\btmc\b|trinamool/i, country: 'India' },
  { name: 'US Democrats', re: /\bdemocrats?\b|democratic party/i, country: 'United States' },
  { name: 'US Republicans', re: /\brepublicans?\b|\bgop\b/i, country: 'United States' },
  { name: 'UK Labour', re: /\blabour party\b|\blabour\b/i, country: 'United Kingdom' },
  { name: 'UK Conservatives', re: /\bconservatives?\b|\btories\b|\btory\b/i, country: 'United Kingdom' },
  { name: 'AfD (Germany)', re: /\bafd\b|alternative for germany/i, country: 'Germany' },
  { name: 'National Rally (France)', re: /national rally|\brassemblement\b|\brn\b|le pen/i, country: 'France' },
];

// ---- news momentum (NOT a poll) ----
const POS = /\b(win\w*|won|victory|landslide|surge\w*|gain\w*|\bleads?\b|ahead|boost\w*|rally|rallies|support\w*|sweep\w*|triumph|popular\w*|re-?elect\w*|momentum|strengthen\w*|comeback)\b/i;
const NEG = /\b(loses?|lost|losing|defeat\w*|setback|resign\w*|ousted|scandal\w*|corruption|\bprobe\b|protest\w*|backlash|unpopular|slump\w*|crisis|arrest\w*|charged|impeach\w*|no-confidence|quits|steps? down|declin\w*|trail\w*|behind|collapse\w*)\b/i;

export interface Momentum { name: string; country: string; mentions: number; sentiment: number; score: number; band: Band }
/** Momentum for one figure over the given items. sentiment in [-1,1]; score 5-95. */
export function momentumFor(fig: Figure, items: LiveItem[]): Momentum {
  const mine = items.filter(i => fig.re.test(`${i.title} ${i.summary || ''}`));
  let pos = 0, neg = 0;
  for (const i of mine) { const t = `${i.title} ${i.summary || ''}`; if (POS.test(t)) pos++; if (NEG.test(t)) neg++; }
  const sentiment = pos + neg ? (pos - neg) / (pos + neg) : 0;
  const score = Math.max(5, Math.min(95, Math.round(50 + sentiment * 45)));
  return { name: fig.name, country: fig.country, mentions: mine.length, sentiment, score, band: bandOf(100 - score) };
}
/** Rank figures by coverage, keep those actually mentioned. */
export function momentumBoard(figures: Figure[], items: LiveItem[], limit = 10): Momentum[] {
  return figures.map(f => momentumFor(f, items)).filter(m => m.mentions > 0).sort((a, b) => b.mentions - a.mentions).slice(0, limit);
}

// ---- elections ----
export const isElection = (i: LiveItem) => /\b(election\w*|\bpoll\b|\bvote\b|ballot|referendum|runoff|by-?election|counting|exit poll|results?)\b/i.test(text(i));
export type ElectionStage = 'Results & projections' | 'Campaign & upcoming';
export function electionStage(i: LiveItem): ElectionStage {
  return /\b(result\w*|won|wins?|counting|leads?|declared|landslide|exit poll|projected|forecast|sworn in|defeat\w*)\b/i.test(text(i)) ? 'Results & projections' : 'Campaign & upcoming';
}

// ---- significance + countrywise political stress ----
const SIGNIFICANT = /\b(election result\w*|wins? (?:the )?election|landslide|exit poll\w*|snap election|hung (?:parliament|assembly)|coalition|no-confidence|steps down|resign\w*|ousted|sworn in|impeach\w*|government (?:falls|collapse)|coup|defection|floor test|political crisis|protests?)\b/i;
export const isSignificant = (i: LiveItem) => SIGNIFICANT.test(`${i.title} ${i.summary || ''}`);

export interface CountryStress { country: string; score: number; band: Band; total: number; signif: number }
export function countryStress(items: LiveItem[], limit = 8): CountryStress[] {
  const groups = new Map<string, LiveItem[]>();
  for (const i of items) { const c = countryOf(i); if (c === 'Other / multilateral') continue; (groups.get(c) || groups.set(c, []).get(c)!).push(i); }
  const out: CountryStress[] = [];
  for (const [country, list] of groups) {
    const signif = list.filter(isSignificant).length;
    const score = Math.min(100, signif * 16 + Math.max(0, list.length - signif) * 3);
    out.push({ country, score, band: bandOf(score), total: list.length, signif });
  }
  return out.sort((a, b) => b.score - a.score || b.total - a.total).slice(0, limit);
}

export type { Band } from './business';
