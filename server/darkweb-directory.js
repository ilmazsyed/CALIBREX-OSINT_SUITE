// Curated directory of well-known, lawful .onion services — a reliable,
// keyless baseline for Dark Web Search that works from any server IP (no live
// engine to be blocked). These are public, widely-published hidden services:
// mirrors of mainstream news and public institutions, privacy/security tools,
// whistleblowing (SecureDrop) and onion search engines. Index entries only —
// Calibrex never fetches them. Operators should still verify any address
// against the organisation's clearnet site before use (onion phishing clones
// exist). Abuse/market content is deliberately NOT curated here; those surface
// only from the live engines when reachable.
export const DIRECTORY = [
  // Onion search engines (also the actionable fallback for any query)
  { name: 'DuckDuckGo (onion)', onion: 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/', category: 'search', description: 'Privacy-respecting web search over Tor.', tags: ['search', 'engine', 'privacy'] },
  { name: 'Ahmia', onion: 'http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion/', category: 'search', description: 'Clearnet-indexed Tor hidden-service search engine (filters abuse material).', tags: ['search', 'engine', 'index', 'onion'] },
  { name: 'Haystak', onion: 'http://haystak5njsmn2hqkewecpaxetahtwhsbsa64jom2k22z5afxhnpxfid.onion/', category: 'search', description: 'Large Tor hidden-service search index.', tags: ['search', 'engine', 'index', 'onion'] },

  // News & public-interest
  { name: 'BBC News (onion)', onion: 'https://www.bbcnewsd73hkzno2ini43t4gblxvycyac5aw4gnv7t2rccijh7745uqd.onion/', category: 'news', description: 'Official BBC News Tor mirror.', tags: ['news', 'media', 'press', 'bbc'] },
  { name: 'The New York Times (onion)', onion: 'https://www.nytimesn7cgmftshazwhfgzm37qxb44r64ytbb2dj3x62d2lljsciiyd.onion/', category: 'news', description: 'Official NYTimes Tor mirror.', tags: ['news', 'media', 'press', 'nyt'] },
  { name: 'ProPublica (onion)', onion: 'https://p53lf57qovyuvwsc6xnrppyply3vtqm7l6pcobkmyqsiofyeznfu5uqd.onion/', category: 'news', description: 'Investigative journalism; first major news site with an onion service.', tags: ['news', 'media', 'press', 'investigative', 'leak'] },

  // Whistleblowing / secure drop
  { name: 'SecureDrop (Freedom of the Press)', onion: 'http://sdolvtfhatvsysc6l34d65ymdwxcujausv7k5jk4cy5ttzhjoi6fzvyd.onion/', category: 'leak', description: 'Directory of SecureDrop instances for secure, anonymous whistleblowing to newsrooms.', tags: ['securedrop', 'whistleblower', 'leak', 'journalism', 'tips'] },

  // Government / institutions
  { name: 'CIA (onion)', onion: 'http://ciadotgov4sjwlzihbbgxnqg3xiyrg7so2r2o3lt5wz5ypk4sxyjstad.onion/', category: 'other', description: 'Official U.S. Central Intelligence Agency Tor site.', tags: ['government', 'intelligence', 'gov', 'cia', 'tips'] },

  // Privacy / security tools
  { name: 'Privacy Guides', onion: 'http://www.xoe4vn5uwdztif6goazfbmogh6wh5jc4up35bqdflu6bkdc5cas5vjqd.onion/', category: 'privacy', description: 'Independent privacy & security tool recommendations and guides.', tags: ['privacy', 'security', 'guides', 'opsec'] },
  { name: 'Tor Project', onion: 'http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion/', category: 'privacy', description: 'The Tor Project — official site and software.', tags: ['tor', 'privacy', 'anonymity', 'software'] },
  { name: 'Whonix', onion: 'http://dds6qkxpwdeubwucdiaord2xgbbeyds25rbsgr73tbfpqpt4a6vjwsyd.onion/', category: 'privacy', description: 'Anonymity-focused operating system documentation.', tags: ['privacy', 'anonymity', 'os', 'security'] },
  { name: 'Qubes OS', onion: 'http://qubesosfasa4zl44o4tws22di6kepyzfeqv3tg4e3ztknltfxqrymdad.onion/', category: 'privacy', description: 'Security-oriented operating system.', tags: ['privacy', 'security', 'os'] },
  { name: 'Mullvad VPN', onion: 'http://o54hon2e2vj6c7m3aqqu6uyece65by3vgoxxhlqlsvkmacw6a7m7kiad.onion/', category: 'privacy', description: 'Privacy-focused VPN provider.', tags: ['vpn', 'privacy', 'anonymity'] },
  { name: 'Riseup', onion: 'http://vww6ybal4bd7szmgncyruucpgfkqahzddi37ktceo3ah7ngmcopnpyyd.onion/', category: 'email', description: 'Activist-oriented email and communication tools.', tags: ['email', 'mail', 'privacy', 'activist'] },

  // Secure email / social
  { name: 'Proton Mail (onion)', onion: 'https://protonmailrmez3lotccipshtkleegetolb73fuirgj7r4o4vfu7ozyd.onion/', category: 'email', description: 'Encrypted email provider Tor site.', tags: ['email', 'mail', 'encrypted', 'proton'] },
  { name: 'Facebook (onion)', onion: 'https://www.facebookwkhpilnemxj7asaniu7vnjjbiltxjqhye3mhbshg7kx5tfyd.onion/', category: 'social', description: 'Official Facebook Tor service.', tags: ['social', 'facebook', 'profile'] },
];

/** The onion search engines — the actionable fallback for any query. */
export const SEARCH_ENGINES = DIRECTORY.filter(e => e.category === 'search');

/** Token-match a query against the directory. Returns entries, best match first. */
export function searchDirectory(query) {
  const tokens = String(query || '').toLowerCase().split(/[^a-z0-9.]+/).filter(t => t.length > 1);
  if (!tokens.length) return [];
  const scored = [];
  for (const e of DIRECTORY) {
    const hay = `${e.name} ${e.description} ${e.category} ${(e.tags || []).join(' ')}`.toLowerCase();
    let score = 0;
    for (const t of tokens) if (hay.includes(t)) score++;
    if (score > 0) scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score).map(x => x.e);
}
