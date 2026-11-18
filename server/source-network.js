/**
 * Calibrex Source Intelligence Network.
 *
 * This is the metadata and quality-control foundation for the 6,000+ source
 * programme. It deliberately does not manufacture catalogue entries: only
 * real configured sources are returned. Discovery candidates must be reviewed
 * and validated before they become active sources.
 */
export const SOURCE_LAYERS = [
  { id: 'official', label: 'Government & official records', target: 1000, description: 'Government portals, regulators, courts, procurement, sanctions and multilateral institutions.' },
  { id: 'news', label: 'News, web & open publications', target: 1000, description: 'Newsrooms, specialist publications, think tanks, research and public web sources.' },
  { id: 'social', label: 'Public social & digital activity', target: 1000, description: 'Public social posts, channels, forums and community reporting; leads remain unverified.' },
  { id: 'geospatial', label: 'Geospatial & earth observation', target: 1000, description: 'Satellite, mapping, weather, hazards, land-use and environmental datasets.' },
  { id: 'mobility', label: 'Transport, maritime, aviation & space', target: 1000, description: 'Public and licensed vessel, aviation, port, navigation and orbital datasets.' },
  { id: 'economic', label: 'Economic, corporate & trade intelligence', target: 1000, description: 'Company filings, procurement, trade, markets, commodities and supply-chain datasets.' },
];

export const SOURCE_REGIONS = [
  { id: 'south-asia', label: 'South Asia', countries: ['AF','BD','BT','IN','MV','NP','PK','LK'] },
  { id: 'east-asia', label: 'East Asia', countries: ['CN','JP','KP','KR','MN','TW'] },
  { id: 'southeast-asia', label: 'Southeast Asia', countries: ['BN','ID','KH','LA','MM','MY','PH','SG','TH','TL','VN'] },
  { id: 'central-asia', label: 'Central Asia', countries: ['KZ','KG','TJ','TM','UZ'] },
  { id: 'middle-east', label: 'Middle East', countries: ['AE','BH','CY','EG','IR','IQ','IL','JO','KW','LB','OM','PS','QA','SA','SY','TR','YE'] },
  { id: 'europe', label: 'Europe', countries: ['AL','AD','AT','BA','BE','BG','BY','CH','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','HU','IE','IS','IT','LI','LT','LU','LV','MC','MD','ME','MK','MT','NL','NO','PL','PT','RO','RS','RU','SE','SI','SK','SM','UA','VA','XK'] },
  { id: 'africa', label: 'Africa', countries: ['AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','CV','DJ','DZ','EG','ER','ET','GA','GH','GM','GN','GQ','GW','KE','KM','LR','LS','LY','MA','MG','ML','MR','MU','MW','MZ','NA','NE','NG','RW','SC','SD','SL','SN','SO','SS','ST','SZ','TD','TG','TN','TZ','UG','ZA','ZM','ZW'] },
  { id: 'north-america', label: 'North America', countries: ['CA','MX','US'] },
  { id: 'latin-america-caribbean', label: 'Latin America & Caribbean', countries: ['AG','AR','BB','BO','BR','BS','BZ','CL','CO','CR','CU','DM','DO','EC','GD','GT','GY','HN','HT','JM','KN','LC','NI','PA','PE','PY','SR','SV','TT','UY','VC','VE'] },
  { id: 'oceania', label: 'Oceania', countries: ['AU','FJ','FM','KI','MH','NR','NZ','PG','PW','SB','TO','TV','VU','WS'] },
  { id: 'global', label: 'Global / multilateral', countries: [] },
];

const GROUP_LAYER = {
  'Core threat wires': 'news', 'International news': 'news', 'Indian news': 'news',
  'India states & borders': 'news', 'South Asia': 'news', Europe: 'news',
  Americas: 'news', 'China & East Asia': 'news', 'Middle East': 'news',
  'Defence & military': 'news', 'OSINT & analysis': 'news',
  Cyber: 'news', 'Elections & politics': 'news',
  'OSINT social accounts': 'social', 'Chatter & deep web': 'social',
  'Government & policy': 'official', 'Crisis & advisories': 'official',
  'Business & power': 'economic', Maritime: 'mobility', Hazards: 'geospatial',
};

const GROUP_REGION = {
  'Indian news': 'South Asia', 'India states & borders': 'South Asia',
  'South Asia': 'South Asia', Europe: 'Europe', Americas: 'North America',
  'China & East Asia': 'East Asia', 'Middle East': 'Middle East',
  'Core threat wires': 'Global / multilateral',
  'Defence & military': 'Global / multilateral', Maritime: 'Global / multilateral',
  'OSINT & analysis': 'Global / multilateral', Cyber: 'Global / multilateral',
  'Business & power': 'Global / multilateral', 'Government & policy': 'Global / multilateral',
  'Elections & politics': 'Global / multilateral', 'Crisis & advisories': 'Global / multilateral',
  'Chatter & deep web': 'Global / multilateral', 'OSINT social accounts': 'Global / multilateral',
  Hazards: 'Global / multilateral',
};

const COUNTRY_BY_ID = {
  'bbc-world': 'GB', 'guardian-world': 'GB', 'guardian-business': 'GB',
  'bbc-business': 'GB', 'bbc-politics': 'GB', 'guardian-politics': 'GB',
  'dw-world': 'DE', france24: 'FR', 'nyt-world': 'US', 'npr-world': 'US',
  'skynews-world': 'GB', 'cbc-world': 'CA', 'abc-intl': 'US',
  'thehindu': 'IN', toi: 'IN', hindustantimes: 'IN', ndtv: 'IN',
  indianexpress: 'IN', theprint: 'IN', greaterkashmir: 'IN', pib: 'IN',
  news18: 'IN', scroll: 'IN', thewire: 'IN', zeenews: 'IN',
  dawn: 'PK', 'express-tribune': 'PK', kyodo: 'JP', scmp: 'HK',
  'times-of-israel': 'IL', 'arab-news': 'SA', allafrica: 'ZA',
  'cna': 'SG', 'lang-india-bengali': 'IN', 'lang-bangladesh-bengali': 'BD',
  'lang-pakistan-urdu': 'PK', 'lang-middle-east-arabic': 'SA',
  'lang-iran-persian': 'IR', 'lang-china-simplified': 'CN',
  'lang-taiwan-traditional': 'TW', 'lang-europe-french': 'FR',
  'lang-europe-german': 'DE', 'lang-europe-russian': 'RU',
  'lang-americas-spanish': 'MX',
};

const REGION_BY_COUNTRY = new Map(SOURCE_REGIONS.flatMap(r => r.countries.map(code => [code, r.label])));
const MULTI_REGION_GROUPS = new Set([
  'Core threat wires','International news','Defence & military','Maritime',
  'OSINT & analysis','Cyber','Business & power','Government & policy',
  'Elections & politics','Crisis & advisories','Chatter & deep web',
  'OSINT social accounts','Hazards',
]);

export function sourceLayer(source) {
  if (SOURCE_LAYERS.some(layer => layer.id === source?.layer)) return source.layer;
  if (source?.group === 'Hazards') return 'geospatial';
  if (source?.kind === 'official') return 'official';
  if (source?.type === 'api') {
    if (['cisa-kev'].includes(source.id)) return 'official';
    if (['reddit','ransomware'].includes(source.id)) return 'social';
    if (['gdelt'].includes(source.id)) return 'news';
  }
  if (source?.kind === 'social' || ['telegram','bluesky','mastodon','x'].includes(source?.type)) return 'social';
  return GROUP_LAYER[source?.group] || (source?.kind === 'official' ? 'official' : 'news');
}

export function sourceGeography(source) {
  const country = source?.country || COUNTRY_BY_ID[source?.id] || null;
  const region = source?.region || (country ? REGION_BY_COUNTRY.get(country) : null) || GROUP_REGION[source?.group] || 'Global / multilateral';
  return {
    region,
    country,
    coverage: source?.coverage || (country ? 'country' : MULTI_REGION_GROUPS.has(source?.group) ? 'multi-region' : 'regional'),
    countryName: country || (region === 'Global / multilateral' ? 'MULTI' : null),
  };
}

export function expectedCadenceMinutes(source) {
  if (source?.type === 'search' || source?.type === 'api' || source?.type === 'gnews') return 5;
  if (source?.type === 'rss' || source?.type === 'telegram' || source?.type === 'bluesky' || source?.type === 'mastodon') return 1;
  return 15;
}

export function sourceHealthStatus(health, now = Date.now(), cadenceMinutes = 5) {
  if (!health) return 'unverified';
  const lastSuccess = Number(health.lastSuccessAt || 0);
  const failures = Number(health.consecutiveFailures || 0);
  if (!lastSuccess) return health.state === 'error' ? 'failed' : 'unverified';
  const age = Math.max(0, now - lastSuccess);
  const cadence = Math.max(1, cadenceMinutes) * 60_000;
  if (failures === 0 && age <= cadence * 4) return 'healthy';
  if (age <= Math.max(cadence * 24, 2 * 60 * 60 * 1000)) return 'degraded';
  return 'stale';
}

export function buildSourceNetwork(sourceDescriptors, healthMap = {}, disabledIds = [], now = Date.now()) {
  const disabled = new Set(disabledIds);
  const sources = sourceDescriptors.map(source => {
    const layer = sourceLayer(source);
    const geo = sourceGeography(source);
    const health = healthMap[source.id] || null;
    const cadenceMinutes = expectedCadenceMinutes(source);
    return {
      id: source.id, name: source.name, layer, layerLabel: SOURCE_LAYERS.find(x => x.id === layer)?.label || 'Other',
      group: source.group || 'Unclassified', region: geo.region, country: geo.country,
      coverage: geo.coverage, countryName: geo.countryName,
      type: source.type || 'unknown', kind: source.kind || 'news',
      enabled: !disabled.has(source.id), cadenceMinutes,
      health: sourceHealthStatus(health, now, cadenceMinutes),
      lastCheckedAt: health?.checkedAt || health?.at || null,
      lastSuccessAt: health?.lastSuccessAt || null,
      consecutiveFailures: health?.consecutiveFailures || 0,
      failureClass: health?.failureClass || null,
      itemCount: health?.count || 0,
      measured: Boolean(health?.checkedAt || health?.at || health?.lastSuccessAt),
      accessModel: source.accessModel || (source.type === 'api' ? 'provider-api' : source.type === 'search' ? 'public-indexed-search' : 'public-feed'),
      licence: source.licence || 'review-required',
    };
  });
  const layers = SOURCE_LAYERS.map(layer => {
    const rows = sources.filter(source => source.layer === layer.id);
    const enabled = rows.filter(source => source.enabled);
    return {
      ...layer, configured: rows.length, enabled: enabled.length,
      healthy: enabled.filter(x => x.health === 'healthy').length,
      degraded: enabled.filter(x => x.health === 'degraded').length,
      stale: enabled.filter(x => x.health === 'stale').length,
      failed: enabled.filter(x => x.health === 'failed').length,
      unverified: enabled.filter(x => x.health === 'unverified').length,
      remaining: Math.max(0, layer.target - rows.length),
    };
  });
  const regions = SOURCE_REGIONS.map(region => {
    const rows = sources.filter(source => source.region === region.label && source.enabled);
    return {
      id: region.id, region: region.label, countries: region.countries,
      configured: rows.length, healthy: rows.filter(x => x.health === 'healthy').length,
      unverified: rows.filter(x => x.health === 'unverified').length,
    };
  });
  return {
    generatedAt: now,
    target: SOURCE_LAYERS.reduce((sum, layer) => sum + layer.target, 0),
    configured: sources.length,
    healthy: sources.filter(x => x.enabled && x.health === 'healthy').length,
    unverified: sources.filter(x => x.enabled && x.health === 'unverified').length,
    layers, regions, sources,
    qualityPolicy: 'A source is not healthy until a recent successful fetch is measured. Technical health is not editorial credibility. Candidates remain inactive until endpoint, provenance, access and licence checks pass.',
  };
}
