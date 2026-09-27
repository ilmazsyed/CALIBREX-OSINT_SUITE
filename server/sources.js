// Built-in source catalogue. Admins can switch any of these off and add
// their own (RSS/Atom feeds, Telegram channels, Bluesky or Mastodon accounts).
//
// type:  gnews (Google News search wire) | search (Google News query) | rss | telegram | bluesky | mastodon
// kind:  news | official | analysis | social   (social posts are shown as unverified claims)
// wire:  fixed wire for every item, or undefined to sort by keyword

export const SOURCE_GROUPS = ['Google News wires', 'International news', 'Indian news', 'South Asia', 'OSINT & analysis', 'Cyber', 'OSINT social accounts'];

export const BUILTIN_SOURCES = [
  // Google News wires are generated from WIRES in feeds.js (ids gnews-<WIRE>).

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

  { id: 'bellingcat', name: 'Bellingcat', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://www.bellingcat.com/feed/' },
  { id: 'crisisgroup', name: 'International Crisis Group', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://www.crisisgroup.org/rss' },
  { id: 'longwarjournal', name: 'Long War Journal', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://www.longwarjournal.org/feed' },
  { id: 'warontherocks', name: 'War on the Rocks', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://warontherocks.com/feed/' },
  { id: 'thediplomat', name: 'The Diplomat', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://thediplomat.com/feed/' },

  { id: 'cisa', name: 'CISA advisories', group: 'Cyber', type: 'rss', kind: 'official', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', wire: 'CYBER' },
  { id: 'bleeping', name: 'BleepingComputer', group: 'Cyber', type: 'rss', kind: 'news', url: 'https://www.bleepingcomputer.com/feed/', wire: 'CYBER' },
  { id: 'thehackernews', name: 'The Hacker News', group: 'Cyber', type: 'rss', kind: 'news', url: 'https://feeds.feedburner.com/TheHackersNews', wire: 'CYBER' },
  { id: 'therecord', name: 'The Record', group: 'Cyber', type: 'rss', kind: 'news', url: 'https://therecord.media/feed', wire: 'CYBER' },

  { id: 'bsky-bellingcat', name: 'Bellingcat', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'bellingcat.com' },
  { id: 'bsky-eliothiggins', name: 'Eliot Higgins', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'eliothiggins.bsky.social' },
  { id: 'bsky-geoconfirmed', name: 'GeoConfirmed', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'geoconfirmed.org' },
  { id: 'bsky-osinttechnical', name: 'OSINTtechnical', group: 'OSINT social accounts', type: 'bluesky', kind: 'social', handle: 'osinttechnical.bsky.social' },
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
