// Built-in source catalogue. Admins can switch any of these off and add
// their own (RSS/Atom feeds, Telegram channels, Bluesky or Mastodon accounts).
//
// type:  gnews (Google News search wire) | search (Google News query) | rss | telegram | bluesky | mastodon
// kind:  news | official | analysis | social   (social posts are shown as unverified claims)
// wire:  fixed wire for every item, or undefined to sort by keyword

export const SOURCE_GROUPS = ['Google News wires', 'International news', 'Indian news', 'South Asia', 'Defence & military', 'OSINT & analysis', 'Cyber', 'Crisis & advisories', 'Chatter & deep web', 'OSINT social accounts'];

export const BUILTIN_SOURCES = [
  // Google News wires are generated from WIRES in feeds.js (ids gnews-<WIRE>).

  // Crisis, humanitarian and official advisories (part of the deep-intel bundle).
  { id: 'reliefweb', name: 'ReliefWeb (UN OCHA)', group: 'Crisis & advisories', type: 'rss', kind: 'official', fallbackWire: 'REGIONAL', url: 'https://reliefweb.int/updates/rss.xml' },
  { id: 'who-don', name: 'WHO Disease Outbreak News', group: 'Crisis & advisories', type: 'rss', kind: 'official', fallbackWire: 'REGIONAL', url: 'https://www.who.int/feeds/entity/csr/don/en/rss.xml' },
  { id: 'us-travel', name: 'US State Dept travel advisories', group: 'Crisis & advisories', type: 'rss', kind: 'official', fallbackWire: 'REGIONAL', url: 'https://travel.state.gov/_res/rss/TAsTWs.xml' },

  { id: 'bbc-world', name: 'BBC World', group: 'International news', type: 'rss', kind: 'news', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'aljazeera', name: 'Al Jazeera', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw-world', name: 'DW', group: 'International news', type: 'rss', kind: 'news', url: 'https://rss.dw.com/rdf/rss-en-world' },
  { id: 'france24', name: 'France 24', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.france24.com/en/rss' },

  { id: 'thehindu', name: 'The Hindu', group: 'Indian news', type: 'rss', kind: 'news', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { id: 'toi', name: 'Times of India', group: 'Indian news', type: 'rss', kind: 'news', url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms' },
  { id: 'hindustantimes', name: 'Hindustan Times', group: 'Indian news', type: 'rss', kind: 'news', url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml' },
  { id: 'ndtv', name: 'NDTV', group: 'Indian news', type: 'rss', kind: 'news', url: 'https://feeds.feedburner.com/ndtvnews-india-news' },
  { id: 'indianexpress', name: 'The Indian Express', group: 'Indian news', type: 'rss', kind: 'news', url: 'https://indianexpress.com/section/india/feed/' },
  { id: 'theprint', name: 'ThePrint', group: 'Indian news', type: 'rss', kind: 'news', url: 'https://theprint.in/category/india/feed/' },
  { id: 'greaterkashmir', name: 'Greater Kashmir', group: 'Indian news', type: 'rss', kind: 'news', url: 'https://www.greaterkashmir.com/feed/' },
  // India Today's OSINT team publishes on indiatoday.in without a feed of its own, so this is a Google News search limited to that site.
  { id: 'indiatoday-osint', name: 'India Today OSINT team', group: 'Indian news', type: 'search', kind: 'analysis', fallbackWire: 'REGIONAL',
    query: 'site:indiatoday.in (OSINT OR "open-source intelligence" OR "satellite images" OR "satellite imagery" OR geolocated OR "OSINT team")' },
  { id: 'pib', name: 'PIB (Govt. of India releases)', group: 'Indian news', type: 'rss', kind: 'official', url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3' },

  { id: 'dawn', name: 'Dawn (Pakistan)', group: 'South Asia', type: 'rss', kind: 'news', url: 'https://www.dawn.com/feeds/home' },
  // SATP publishes no feed and its website timeline lags by weeks, so it is followed three ways.
  { id: 'satp-youtube', name: 'SATP videos (South Asia Terrorism Portal)', group: 'South Asia', type: 'rss', kind: 'analysis', fallbackWire: 'SATP', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCz-7gxwNP3FHiuXLoxgpE9g' },
  { id: 'satp-site', name: 'SATP website (via Google News)', group: 'South Asia', type: 'search', kind: 'analysis', fallbackWire: 'SATP', query: 'site:satp.org', dropSlugs: true },
  { id: 'satp-cited', name: 'Reports citing SATP data', group: 'South Asia', type: 'search', kind: 'news', fallbackWire: 'SATP', query: '"South Asia Terrorism Portal"' },
  { id: 'southasianvoices', name: 'South Asian Voices (Stimson)', group: 'South Asia', type: 'rss', kind: 'analysis', url: 'https://southasianvoices.org/feed/' },

  { id: 'idrw', name: 'IDRW (Indian Defence Research Wing)', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://idrw.org/feed/' },
  { id: 'livefist', name: 'Livefist Defence', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://www.livefistdefence.com/feed/' },
  { id: 'theprint-defence', name: 'ThePrint Defence', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://theprint.in/category/defence/feed/' },
  { id: 'navalnews', name: 'Naval News', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://www.navalnews.com/feed/' },
  { id: 'breakingdefense', name: 'Breaking Defense', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://breakingdefense.com/feed/' },
  { id: 'twz', name: 'The War Zone', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://www.twz.com/feed' },
  { id: 'defensenews', name: 'Defense News', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml' },
  // Order-of-battle (ORBAT) reporting: unit moves, deployments and force structure.
  { id: 'orbat-search', name: 'ORBAT & force deployments (news search)', group: 'Defence & military', type: 'search', kind: 'analysis', fallbackWire: 'GLOBAL_AXIS',
    query: '("order of battle" OR ORBAT OR "satellite images show" OR "troop buildup" OR "forward deployed") (PLA OR "Indian Army" OR "Pakistan Army" OR IAF OR PLAN OR brigade OR airbase)' },

  { id: 'bellingcat', name: 'Bellingcat', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://www.bellingcat.com/feed/' },
  { id: 'crisisgroup', name: 'International Crisis Group', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://www.crisisgroup.org/rss' },
  { id: 'longwarjournal', name: 'Long War Journal', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://www.longwarjournal.org/feed' },
  { id: 'warontherocks', name: 'War on the Rocks', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://warontherocks.com/feed/' },
  { id: 'thediplomat', name: 'The Diplomat', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://thediplomat.com/feed/' },
  { id: 'acled', name: 'ACLED (conflict data)', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://acleddata.com/feed/' },
  { id: 'ctc', name: 'CTC Sentinel (West Point)', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://ctc.westpoint.edu/feed/' },
  { id: 'jamestown', name: 'Jamestown Foundation', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://jamestown.org/feed/' },

  { id: 'cisa', name: 'CISA advisories', group: 'Cyber', type: 'rss', kind: 'official', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', wire: 'CYBER' },
  { id: 'bleeping', name: 'BleepingComputer', group: 'Cyber', type: 'rss', kind: 'news', url: 'https://www.bleepingcomputer.com/feed/', wire: 'CYBER' },
  { id: 'thehackernews', name: 'The Hacker News', group: 'Cyber', type: 'rss', kind: 'news', url: 'https://feeds.feedburner.com/TheHackersNews', wire: 'CYBER' },
  { id: 'therecord', name: 'The Record', group: 'Cyber', type: 'rss', kind: 'news', url: 'https://therecord.media/feed', wire: 'CYBER' },

  { id: 'bsky-bellingcat', name: 'Bellingcat', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'bellingcat.com' },
  { id: 'bsky-eliothiggins', name: 'Eliot Higgins', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'eliothiggins.bsky.social' },
  { id: 'bsky-geoconfirmed', name: 'GeoConfirmed', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'geoconfirmed.org' },
  { id: 'bsky-osinttechnical', name: 'OSINTtechnical', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'osinttechnical.bsky.social' },
  { id: 'bsky-detresfa', name: 'Damien Symon (satellite imagery, South Asia)', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'detresfa.bsky.social' },
  { id: 'bsky-jaidevjamwal', name: 'Jaidev Jamwal (PLA ORBAT)', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'jaidevjamwal.bsky.social' },
  { id: 'bsky-isw', name: 'Institute for the Study of War', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'thestudyofwar.bsky.social' },
  { id: 'bsky-ralee85', name: 'Rob Lee (military analyst)', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'ralee85.bsky.social' },
  { id: 'bsky-shashj', name: 'Shashank Joshi (The Economist defence)', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'shashj.bsky.social' },
  { id: 'tg-osintdefender', name: 'OSINTdefender', group: 'OSINT social accounts', type: 'telegram', kind: 'social', handle: 'osintdefender' },
  { id: 'tg-osintlive', name: 'OSINT feed (mirror of X accounts)', group: 'OSINT social accounts', type: 'telegram', kind: 'social', handle: 'osintlive' },
];

/** Where to fetch a source from. */
export function sourceUrl(src) {
  const handle = String(src.handle || '').trim().replace(/^@/, '');
  switch (src.type) {
    case 'bluesky': return `https://bsky.app/profile/${encodeURIComponent(handle)}/rss`;
    case 'telegram': return `https://t.me/s/${encodeURIComponent(handle.replace(/^https?:\/\/t\.me\/(s\/)?/, ''))}`;
    case 'mastodon': {
      // user@instance -> https://instance/@user.rss
      const [user, host] = handle.split('@');
      return host ? `https://${host}/@${encodeURIComponent(user)}.rss` : '';
    }
    case 'search': return src.query ? `https://news.google.com/rss/search?q=${encodeURIComponent(`${src.query} when:3d`)}&hl=en-IN&gl=IN&ceid=IN:en` : '';
    default: return src.url;
  }
}

/** Public link to the account/site, for display. */
export function sourceHome(src) {
  const handle = String(src.handle || '').replace(/^@/, '');
  if (src.type === 'bluesky') return `https://bsky.app/profile/${handle}`;
  if (src.type === 'telegram') return `https://t.me/${handle}`;
  if (src.type === 'mastodon') { const [u, h] = handle.split('@'); return h ? `https://${h}/@${u}` : ''; }
  if (src.type === 'search') return `https://news.google.com/search?q=${encodeURIComponent(src.query || '')}`;
  try { return new URL(src.url).origin; } catch { return ''; }
}
