// Built-in source catalogue. Admins can switch any of these off and add
// their own (RSS/Atom feeds, Telegram channels, Bluesky or Mastodon accounts).
//
// type:  gnews (Google News search wire) | search (Google News query) | rss | telegram | bluesky | mastodon
// kind:  news | official | analysis | social   (social posts are shown as unverified claims)
// wire:  fixed wire for every item, or undefined to sort by keyword

export const SOURCE_GROUPS = ['Google News wires', 'International news', 'Indian news', 'India states & borders', 'South Asia', 'Defence & military', 'OSINT & analysis', 'Cyber', 'Business & power', 'Government & policy', 'Crisis & advisories', 'Chatter & deep web', 'OSINT social accounts'];

// Security-incident terms reused across the India per-state border searches.
const IN_SEC = '(attack OR terror OR militant OR encounter OR infiltration OR IED OR blast OR ambush OR killed OR firing OR clash OR arrest OR seized OR smuggling OR intruder OR drone OR "ceasefire violation" OR "cross-border" OR insurgent OR Naxal OR Maoist OR BSF OR "security forces")';

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

  // India per-state security, weighted to the states that share international borders.
  { id: 'in-jk', name: 'J&K / Ladakh (Pakistan · China border)', group: 'India states & borders', type: 'search', kind: 'news', fallbackWire: 'INDIA',
    query: `(Kashmir OR "Jammu and Kashmir" OR Ladakh OR Pulwama OR Baramulla OR Anantnag OR Kupwara OR Uri OR Poonch OR Rajouri OR "Line of Control" OR LoC OR LAC OR Galwan OR Pangong OR Kargil OR Srinagar) ${IN_SEC}` },
  { id: 'in-punjab-raj', name: 'Punjab · Rajasthan (Pakistan west border)', group: 'India states & borders', type: 'search', kind: 'news', fallbackWire: 'INDIA',
    query: `(Punjab OR Amritsar OR Ferozepur OR Pathankot OR Gurdaspur OR Tarn Taran OR Rajasthan OR Jaisalmer OR Barmer OR "Sri Ganganagar") ${IN_SEC}` },
  { id: 'in-gujarat', name: 'Gujarat (Pakistan maritime · Sir Creek)', group: 'India states & borders', type: 'search', kind: 'news', fallbackWire: 'INDIA',
    query: `(Gujarat OR Kutch OR "Sir Creek" OR Kandla OR Okha OR Jakhau) (BSF OR "coast guard" OR Pakistan OR maritime OR smuggling OR boat OR intruder OR drone OR drugs)` },
  { id: 'in-himachal-uk', name: 'Himachal · Uttarakhand (China border)', group: 'India states & borders', type: 'search', kind: 'news', fallbackWire: 'INDIA',
    query: `(Himachal OR Kinnaur OR Uttarakhand OR Chamoli OR Pithoragarh OR Lipulekh OR Barahoti OR Niti OR Mana) (China OR border OR ITBP OR incursion OR LAC OR village)` },
  { id: 'in-sikkim-arunachal', name: 'Sikkim · Arunachal (China border NE)', group: 'India states & borders', type: 'search', kind: 'news', fallbackWire: 'INDIA',
    query: `(Sikkim OR "Nathu La" OR Doklam OR Arunachal OR Tawang OR Yangtse OR Kibithu OR Bumla OR Anjaw) (China OR PLA OR LAC OR incursion OR clash OR border OR road)` },
  { id: 'in-assam-bengal', name: 'Assam · Bengal · Tripura (Bangladesh border)', group: 'India states & borders', type: 'search', kind: 'news', fallbackWire: 'INDIA',
    query: `(Assam OR Meghalaya OR Tripura OR Agartala OR "West Bengal" OR Siliguri OR "Cooch Behar" OR Malda OR Dhubri OR Karimganj) (Bangladesh OR BSF OR infiltration OR smuggling OR border OR ULFA OR "fake currency" OR cattle)` },
  { id: 'in-northeast', name: 'Manipur · Nagaland · Mizoram (Myanmar border)', group: 'India states & borders', type: 'search', kind: 'news', fallbackWire: 'INDIA',
    query: `(Manipur OR Imphal OR Churachandpur OR Moreh OR Nagaland OR Dimapur OR Mizoram OR Aizawl OR Champhai) (Myanmar OR militant OR insurgent OR ambush OR "Assam Rifles" OR ethnic OR Kuki OR Meitei OR border OR drugs OR extortion)` },
  { id: 'in-naxal', name: 'Naxal / LWE belt (Chhattisgarh · Jharkhand · Odisha)', group: 'India states & borders', type: 'search', kind: 'news', fallbackWire: 'INDIA',
    query: `(Chhattisgarh OR Bastar OR Sukma OR Dantewada OR Bijapur OR Jharkhand OR Odisha OR Gadchiroli) (Naxal OR Maoist OR encounter OR IED OR "security forces" OR CRPF OR DRG OR killed OR surrender)` },
  { id: 'in-hinterland', name: 'India hinterland terror & NIA cases', group: 'India states & borders', type: 'search', kind: 'news', fallbackWire: 'INDIA',
    query: `(Delhi OR Mumbai OR "Uttar Pradesh" OR Bengaluru OR Hyderabad OR Ahmedabad OR Kerala OR "Tamil Nadu") ("terror plot" OR "terror module" OR NIA OR ISIS OR "suspected terrorist" OR blast OR arrested OR radicalisation OR "sleeper cell")` },

  // Business & economic power — mergers, distressed companies, tycoons/oligarchs,
  // money markets and their impact on economies and geopolitics. Weighted 50/50
  // India / global: five India searches and five global ones. All route to the
  // BUSINESS wire and surface on the Business Watch screen.
  { id: 'biz-in-giants', name: 'India business giants & conglomerates', group: 'Business & power', type: 'search', kind: 'news', wire: 'BUSINESS',
    query: '(Reliance OR Adani OR Tata OR Ambani OR Birla OR Mahindra OR Infosys OR "Jio" OR Vedanta OR "JSW" OR Wipro OR "Bajaj") (deal OR acquisition OR merger OR investment OR expansion OR profit OR loss OR stake OR "market cap" OR chairman OR strategy)' },
  { id: 'biz-in-ma', name: 'India M&A, IPOs & deals', group: 'Business & power', type: 'search', kind: 'news', wire: 'BUSINESS',
    query: '(India OR Indian) (merger OR acquisition OR takeover OR buyout OR IPO OR "stake sale" OR "private equity" OR "venture capital" OR "fund raise" OR delisting)' },
  { id: 'biz-in-distress', name: 'India distressed firms & failures', group: 'Business & power', type: 'search', kind: 'news', wire: 'BUSINESS',
    query: '(India OR Indian) (bankruptcy OR insolvency OR IBC OR NCLT OR default OR "debt crisis" OR layoffs OR shutdown OR fraud OR scam OR "ED raid" OR "SEBI probe" OR bailout)' },
  { id: 'biz-in-markets', name: 'India money markets & RBI', group: 'Business & power', type: 'search', kind: 'news', wire: 'BUSINESS',
    query: '(Sensex OR Nifty OR RBI OR rupee OR SEBI OR "Indian stock market" OR "bond yield" OR inflation OR "repo rate" OR FPI) (India OR Indian OR Mumbai)' },
  { id: 'biz-in-tycoons', name: 'India tycoons & their influence', group: 'Business & power', type: 'search', kind: 'news', wire: 'BUSINESS',
    query: '(Indian billionaire OR Indian tycoon OR Indian magnate OR promoter OR "business family") (wealth OR influence OR politics OR lobbying OR regulator OR controversy OR decision OR empire)' },

  { id: 'biz-gl-ma', name: 'Global M&A & megadeals', group: 'Business & power', type: 'search', kind: 'news', wire: 'BUSINESS',
    query: '(merger OR acquisition OR takeover OR buyout OR "megadeal" OR "leveraged buyout" OR "antitrust" OR "deal collapse") (global OR corporate OR company OR billion)' },
  { id: 'biz-gl-distress', name: 'Global distressed & bankruptcies', group: 'Business & power', type: 'search', kind: 'news', wire: 'BUSINESS',
    query: '(bankruptcy OR insolvency OR "distressed debt" OR default OR "Chapter 11" OR collapse OR layoffs OR bailout OR liquidation OR "credit crisis") (company OR corporate OR economy OR bank)' },
  { id: 'biz-gl-tycoons', name: 'Global tycoons & oligarchs', group: 'Business & power', type: 'search', kind: 'news', wire: 'BUSINESS',
    query: '(Musk OR Bezos OR Buffett OR "Jack Ma" OR oligarch OR billionaire OR tycoon OR magnate OR mogul OR "sovereign wealth") (decision OR influence OR power OR politics OR economy OR fortune OR empire OR stake)' },
  { id: 'biz-gl-markets', name: 'Global money markets & central banks', group: 'Business & power', type: 'search', kind: 'news', wire: 'BUSINESS',
    query: '("Federal Reserve" OR "central bank" OR "interest rate" OR "stock market" OR "bond market" OR inflation OR recession OR currency OR "Wall Street" OR IPO) (economy OR markets OR global)' },
  { id: 'biz-gl-power', name: 'Business, geopolitics & global power', group: 'Business & power', type: 'search', kind: 'news', wire: 'BUSINESS',
    query: '(sanctions OR "export controls" OR "energy giant" OR OPEC OR Aramco OR "trade war" OR "supply chain" OR semiconductor OR "chip war") (company OR corporate OR economy OR geopolitics OR influence)' },

  // Government decisions, orders, statements and public releases — official
  // actions across policy, polity, elections, defence, trade, environment,
  // foreign affairs, law & order, energy and crisis. Weighted 50/50 India /
  // world; all route to the GOV wire and surface on the Government dashboard.
  { id: 'gov-in-orders', name: 'India: cabinet, orders & gazette', group: 'Government & policy', type: 'search', kind: 'official', wire: 'GOV',
    query: '(India OR Indian OR "Government of India") ("Union Cabinet" OR "Cabinet approves" OR ordinance OR notification OR gazette OR "executive order" OR "policy" OR scheme OR PIB OR "Rashtrapati Bhavan")' },
  { id: 'gov-in-parliament', name: 'India: parliament, polity & elections', group: 'Government & policy', type: 'search', kind: 'news', wire: 'GOV',
    query: '(India OR Indian) (Parliament OR "Lok Sabha" OR "Rajya Sabha" OR bill OR "Supreme Court" OR "Election Commission" OR "poll" OR "Model Code" OR "no-confidence" OR Governor OR "President\'s rule")' },
  { id: 'gov-in-foreign', name: 'India: foreign affairs & diplomacy', group: 'Government & policy', type: 'search', kind: 'official', wire: 'GOV',
    query: '(India OR Indian) (MEA OR "External Affairs" OR Jaishankar OR bilateral OR summit OR treaty OR "joint statement" OR "state visit" OR QUAD OR BRICS OR G20 OR SCO)' },
  { id: 'gov-in-security', name: 'India: defence, home & national security', group: 'Government & policy', type: 'search', kind: 'official', wire: 'GOV',
    query: '(India OR Indian) ("Defence Ministry" OR "Ministry of Defence" OR "Rajnath Singh" OR "Home Ministry" OR "Amit Shah" OR NSA OR "national security" OR "border" OR procurement OR "defence deal")' },
  { id: 'gov-in-econ', name: 'India: economy, energy & food policy', group: 'Government & policy', type: 'search', kind: 'news', wire: 'GOV',
    query: '(India OR Indian) (budget OR RBI OR tariff OR subsidy OR "MSP" OR "food security" OR "fuel price" OR "crude oil" OR "power sector" OR "energy policy" OR disinvestment OR GST)' },

  { id: 'gov-world-orders', name: 'World: executive orders & decrees', group: 'Government & policy', type: 'search', kind: 'official', wire: 'GOV',
    query: '("executive order" OR decree OR ordinance OR "royal decree" OR "state of emergency" OR "presidential order" OR "cabinet decision" OR sanctions OR "export controls")' },
  { id: 'gov-world-foreign', name: 'World: foreign affairs, UN & alliances', group: 'Government & policy', type: 'search', kind: 'official', wire: 'GOV',
    query: '("state department" OR "foreign ministry" OR "UN Security Council" OR "United Nations" OR NATO OR "European Union" OR summit OR treaty OR "joint statement" OR diplomatic OR ceasefire)' },
  { id: 'gov-world-elections', name: 'World: elections, polity & leadership', group: 'Government & policy', type: 'search', kind: 'news', wire: 'GOV',
    query: '(election OR referendum OR parliament OR "prime minister" OR president OR coalition OR "no-confidence" OR impeachment OR "cabinet reshuffle" OR inauguration)' },
  { id: 'gov-world-crisis', name: 'World: governance crisis & law and order', group: 'Government & policy', type: 'search', kind: 'news', wire: 'GOV',
    query: '("martial law" OR curfew OR "state of emergency" OR coup OR "government collapse" OR resignation OR protests OR unrest OR crackdown OR "constitutional crisis")' },
  { id: 'gov-world-econ', name: 'World: economy, energy & food security', group: 'Government & policy', type: 'search', kind: 'news', wire: 'GOV',
    query: '("central bank" OR budget OR tariff OR "trade deal" OR subsidy OR "energy policy" OR "oil output" OR OPEC OR "crude oil" OR "food security" OR "price cap" OR embargo) (government OR policy OR minister)' },

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
