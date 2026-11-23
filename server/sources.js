// Built-in source catalogue. Admins can switch any of these off and add
// their own (RSS/Atom feeds, Telegram channels, Bluesky or Mastodon accounts).
//
// type:  gnews (Google News search wire) | search (Google News query) | rss | telegram | bluesky | mastodon
// kind:  news | official | analysis | social   (social posts are shown as unverified claims)
// wire:  fixed wire for every item, or undefined to sort by keyword

export const SOURCE_GROUPS = ['Core threat wires', 'International news', 'Indian news', 'India states & borders', 'South Asia', 'Europe', 'Americas', 'China & East Asia', 'Middle East', 'Defence & military', 'Maritime', 'OSINT & analysis', 'Cyber', 'Business & power', 'Government & policy', 'Elections & politics', 'Crisis & advisories', 'Chatter & deep web', 'OSINT social accounts'];

// Security-incident terms reused across the India per-state border searches.
const IN_SEC = '(attack OR terror OR militant OR encounter OR infiltration OR IED OR blast OR ambush OR killed OR firing OR clash OR arrest OR seized OR smuggling OR intruder OR drone OR "ceasefire violation" OR "cross-border" OR insurgent OR Naxal OR Maoist OR BSF OR "security forces")';

export const BUILTIN_SOURCES = [
  // Google News wires are generated from WIRES in feeds.js (ids gnews-<WIRE>).

  // Crisis, humanitarian and official advisories (part of the deep-intel bundle).
  { id: 'reliefweb', name: 'ReliefWeb (UN OCHA)', group: 'Crisis & advisories', type: 'rss', kind: 'official', fallbackWire: 'REGIONAL', url: 'https://reliefweb.int/updates/rss.xml' },
  { id: 'who-don', name: 'WHO (health emergencies & news)', group: 'Crisis & advisories', type: 'rss', kind: 'official', fallbackWire: 'REGIONAL', url: 'https://www.who.int/rss-feeds/news-english.xml' },
  { id: 'us-travel', name: 'US State Dept travel advisories', group: 'Crisis & advisories', type: 'rss', kind: 'official', fallbackWire: 'REGIONAL', url: 'https://travel.state.gov/_res/rss/TAsTWs.xml' },

  { id: 'bbc-world', name: 'BBC World', group: 'International news', type: 'rss', kind: 'news', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'aljazeera', name: 'Al Jazeera', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw-world', name: 'DW', group: 'International news', type: 'rss', kind: 'news', url: 'https://rss.dw.com/rdf/rss-en-world' },
  { id: 'france24', name: 'France 24', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.france24.com/en/rss' },
  // Additional reliable direct feeds (datacenter-friendly; verified). Grouped by
  // their `group` field, so they appear in the right admin section regardless of
  // position here. Items sort into wires by keyword; fallbackWire pins a feed's
  // uncategorised items to its home dashboard.
  { id: 'guardian-world', name: 'The Guardian (World)', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.theguardian.com/world/rss' },
  { id: 'nyt-world', name: 'New York Times (World)', group: 'International news', type: 'rss', kind: 'news', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { id: 'npr-world', name: 'NPR (World)', group: 'International news', type: 'rss', kind: 'news', url: 'https://feeds.npr.org/1004/rss.xml' },
  // Business & power
  { id: 'bbc-business', name: 'BBC Business', group: 'Business & power', type: 'rss', kind: 'news', fallbackWire: 'BUSINESS', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { id: 'guardian-business', name: 'The Guardian (Business)', group: 'Business & power', type: 'rss', kind: 'news', fallbackWire: 'BUSINESS', url: 'https://www.theguardian.com/business/rss' },
  { id: 'economictimes', name: 'The Economic Times', group: 'Business & power', type: 'rss', kind: 'news', fallbackWire: 'BUSINESS', url: 'https://economictimes.indiatimes.com/rssfeedsdefault.cms' },
  { id: 'business-standard', name: 'Business Standard', group: 'Business & power', type: 'rss', kind: 'news', fallbackWire: 'BUSINESS', url: 'https://www.business-standard.com/rss/home_page_top_stories.rss' },
  { id: 'livemint', name: 'Mint (LiveMint)', group: 'Business & power', type: 'rss', kind: 'news', fallbackWire: 'BUSINESS', url: 'https://www.livemint.com/rss/news' },
  // Elections & politics
  { id: 'bbc-politics', name: 'BBC Politics', group: 'Elections & politics', type: 'rss', kind: 'news', fallbackWire: 'POLITICS', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml' },
  { id: 'guardian-politics', name: 'The Guardian (Politics)', group: 'Elections & politics', type: 'rss', kind: 'news', fallbackWire: 'POLITICS', url: 'https://www.theguardian.com/politics/rss' },
  // Cyber
  { id: 'krebs', name: 'Krebs on Security', group: 'Cyber', type: 'rss', kind: 'analysis', fallbackWire: 'CYBER', url: 'https://krebsonsecurity.com/feed/' },
  { id: 'darkreading', name: 'Dark Reading', group: 'Cyber', type: 'rss', kind: 'news', fallbackWire: 'CYBER', url: 'https://www.darkreading.com/rss.xml' },
  { id: 'securityweek', name: 'SecurityWeek', group: 'Cyber', type: 'rss', kind: 'news', fallbackWire: 'CYBER', url: 'https://www.securityweek.com/feed/' },
  // South Asia
  { id: 'express-tribune', name: 'The Express Tribune (Pakistan) — indexed feed', group: 'South Asia', type: 'search', kind: 'news', query: 'site:tribune.com.pk Pakistan news' },
  // Regional desks (Middle East, Africa, SE Asia) — verified, datacenter-friendly.
  // Additional real-time direct RSS feeds (reliable, datacenter-friendly, no key,
  // no blocking) — the highest-value way to add genuine real-time coverage. If
  // any URL is stale it simply contributes nothing (never-wipe cache) and shows
  // in the admin health panel as never-delivered, to be swapped.
  { id: 'skynews-world', name: 'Sky News (World)', group: 'International news', type: 'rss', kind: 'news', url: 'https://feeds.skynews.com/feeds/rss/world.xml' },
  { id: 'euronews', name: 'Euronews', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.euronews.com/rss?level=theme&name=news' },
  { id: 'cbc-world', name: 'CBC (World)', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.cbc.ca/webfeed/rss/rss-world' },
  { id: 'abc-intl', name: 'ABC News (International)', group: 'International news', type: 'rss', kind: 'news', url: 'https://abcnews.go.com/abcnews/internationalheadlines' },
  { id: 'scmp', name: 'South China Morning Post', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.scmp.com/rss/91/feed' },
  { id: 'kyodo', name: 'Kyodo News — indexed feed', group: 'China & East Asia', type: 'search', kind: 'news', query: 'site:english.kyodonews.net Japan Asia' },
  { id: 'anadolu', name: 'Anadolu Agency', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.aa.com.tr/en/rss/default?cat=world' },
  { id: 'jpost', name: 'The Jerusalem Post', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.jpost.com/rss/rssfeedsheadlines.aspx' },
  // India real-time desks
  { id: 'news18', name: 'News18 (India) — indexed feed', group: 'Indian news', type: 'search', kind: 'news', query: 'site:news18.com India news' },
  { id: 'scroll', name: 'Scroll.in — indexed feed', group: 'Indian news', type: 'search', kind: 'news', query: 'site:scroll.in India news' },
  { id: 'thewire', name: 'The Wire', group: 'Indian news', type: 'rss', kind: 'news', url: 'https://thewire.in/feed' },
  { id: 'zeenews', name: 'Zee News — indexed feed', group: 'Indian news', type: 'search', kind: 'news', query: 'site:zeenews.india.com India news' },
  // Defence real-time
  { id: 'defenseone', name: 'Defense One', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://www.defenseone.com/rss/all/' },
  { id: 'eurasiantimes', name: 'The EurAsian Times — indexed feed', group: 'Defence & military', type: 'search', kind: 'news', query: 'site:eurasiantimes.com defence geopolitics' },
  // Business real-time
  { id: 'moneycontrol', name: 'Moneycontrol — indexed feed', group: 'Business & power', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: 'site:moneycontrol.com markets business India' },
  { id: 'cnbc-intl', name: 'CNBC (International)', group: 'Business & power', type: 'rss', kind: 'news', fallbackWire: 'BUSINESS', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362' },

  { id: 'times-of-israel', name: 'The Times of Israel — indexed feed', group: 'Middle East', type: 'search', kind: 'news', query: 'site:timesofisrael.com Israel Middle East' },
  { id: 'middle-east-eye', name: 'Middle East Eye', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.middleeasteye.net/rss' },
  { id: 'arab-news', name: 'Arab News', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.arabnews.com/rss.xml' },
  { id: 'allafrica', name: 'AllAfrica', group: 'International news', type: 'rss', kind: 'news', fallbackWire: 'REGIONAL', url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf' },
  { id: 'cna', name: 'Channel News Asia', group: 'International news', type: 'rss', kind: 'news', url: 'https://www.channelnewsasia.com/rssfeeds/8395986' },

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

  // Elections, parties, leaders and political upheaval. Weighted 50/50 India /
  // world; all route to the POLITICS wire and surface on the Election & Politics
  // dashboard (leader/party momentum, election tracker, chatter).
  { id: 'pol-in-elections', name: 'India: elections & results', group: 'Elections & politics', type: 'search', kind: 'news', wire: 'POLITICS',
    query: '(India OR Indian) (election OR "assembly polls" OR "Lok Sabha" OR bypoll OR "Election Commission" OR "exit poll" OR "vote count" OR "poll result" OR candidate OR constituency OR campaign)' },
  { id: 'pol-in-parties', name: 'India: parties & alliances', group: 'Elections & politics', type: 'search', kind: 'news', wire: 'POLITICS',
    query: '(BJP OR Congress OR "INDIA bloc" OR AAP OR TMC OR DMK OR NDA OR "Shiv Sena" OR RJD OR "political alliance" OR defection OR "floor test") (India OR Indian)' },
  { id: 'pol-in-leaders', name: 'India: leaders & upheaval', group: 'Elections & politics', type: 'search', kind: 'news', wire: 'POLITICS',
    query: '(Modi OR "Rahul Gandhi" OR "Amit Shah" OR Kejriwal OR Mamata OR "chief minister" OR opposition OR "political crisis" OR resignation OR "cabinet reshuffle" OR "approval rating") (India OR Indian)' },
  { id: 'pol-in-chatter', name: 'India: political chatter & surveys', group: 'Elections & politics', type: 'search', kind: 'analysis', wire: 'POLITICS',
    query: '(India OR Indian) ("opinion poll" OR survey OR "voter mood" OR "political analysis" OR "seat projection" OR "popularity" OR "approval rating" OR psephology)' },
  { id: 'pol-in-states', name: 'India: state & regional politics', group: 'Elections & politics', type: 'search', kind: 'news', wire: 'POLITICS',
    query: '(India OR Indian) ("state election" OR "assembly election" OR Governor OR "President\'s rule" OR "regional party" OR coalition OR "by-election" OR "local body")' },

  { id: 'pol-world-elections', name: 'World: elections & results', group: 'Elections & politics', type: 'search', kind: 'news', wire: 'POLITICS',
    query: '(election OR "general election" OR "presidential election" OR referendum OR runoff OR "vote count" OR "election result" OR "exit poll" OR ballot OR "snap election")' },
  { id: 'pol-world-leaders', name: 'World: leaders & approval', group: 'Elections & politics', type: 'search', kind: 'news', wire: 'POLITICS',
    query: '(Trump OR Biden OR Putin OR "Xi Jinping" OR Zelensky OR Netanyahu OR Starmer OR Macron OR Erdogan OR Lula OR "approval rating" OR "favourability") (president OR "prime minister" OR leader OR poll)' },
  { id: 'pol-world-parties', name: 'World: parties & movements', group: 'Elections & politics', type: 'search', kind: 'news', wire: 'POLITICS',
    query: '(Democrats OR Republicans OR Labour OR Conservatives OR "far-right" OR populist OR "ruling party" OR opposition OR coalition OR "no-confidence" OR "party leader")' },
  { id: 'pol-world-upheaval', name: 'World: political upheaval & crises', group: 'Elections & politics', type: 'search', kind: 'news', wire: 'POLITICS',
    query: '("political crisis" OR "government collapse" OR "snap election" OR impeachment OR "ousted" OR "steps down" OR protests OR coalition OR "constitutional crisis" OR "power struggle")' },
  { id: 'pol-world-chatter', name: 'World: polls, forecasts & chatter', group: 'Elections & politics', type: 'search', kind: 'analysis', wire: 'POLITICS',
    query: '("opinion poll" OR "approval rating" OR "poll of polls" OR "election forecast" OR "projection" OR psephology OR "voter sentiment" OR "political analysis")' },

  { id: 'dawn', name: 'Dawn (Pakistan)', group: 'South Asia', type: 'rss', kind: 'news', url: 'https://www.dawn.com/feeds/home' },
  // SATP publishes no feed and its website timeline lags by weeks, so it is followed three ways.
  { id: 'satp-youtube', name: 'SATP videos (South Asia Terrorism Portal)', group: 'South Asia', type: 'rss', kind: 'analysis', fallbackWire: 'SATP', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCz-7gxwNP3FHiuXLoxgpE9g' },
  { id: 'satp-site', name: 'SATP website (via Google News)', group: 'South Asia', type: 'search', kind: 'analysis', fallbackWire: 'SATP', query: 'site:satp.org', dropSlugs: true },
  { id: 'satp-cited', name: 'Reports citing SATP data', group: 'South Asia', type: 'search', kind: 'news', fallbackWire: 'SATP', query: '"South Asia Terrorism Portal"' },
  { id: 'southasianvoices', name: 'South Asian Voices (Stimson)', group: 'South Asia', type: 'rss', kind: 'analysis', url: 'https://southasianvoices.org/feed/' },

  { id: 'idrw', name: 'IDRW (Indian Defence Research Wing)', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://idrw.org/feed/' },
  { id: 'livefist', name: 'Livefist Defence', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://www.livefistdefence.com/feed/' },
  { id: 'theprint-defence', name: 'ThePrint Defence', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://theprint.in/category/defence/feed/' },
  { id: 'navalnews', name: 'Naval News — indexed feed', group: 'Defence & military', type: 'search', kind: 'news', fallbackWire: 'GLOBAL_AXIS', query: 'site:navalnews.com naval defence fleet' },
  { id: 'breakingdefense', name: 'Breaking Defense', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://breakingdefense.com/feed/' },
  { id: 'twz', name: 'The War Zone', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://www.twz.com/feed' },
  { id: 'defensenews', name: 'Defense News', group: 'Defence & military', type: 'rss', kind: 'news', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml' },
  // Order-of-battle (ORBAT) reporting: unit moves, deployments and force structure.
  { id: 'orbat-search', name: 'ORBAT & force deployments (news search)', group: 'Defence & military', type: 'search', kind: 'analysis', fallbackWire: 'GLOBAL_AXIS',
    query: '("order of battle" OR ORBAT OR "satellite images show" OR "troop buildup" OR "forward deployed") (PLA OR "Indian Army" OR "Pakistan Army" OR IAF OR PLAN OR brigade OR airbase)' },

  // Dedicated maritime desks (reliable, keyless RSS) — shipping, naval,
  // chokepoints, shadow-fleet and port news. fallbackWire GLOBAL_AXIS keeps
  // them in the feed; the Maritime monitor surfaces them by keyword.
  { id: 'gcaptain', name: 'gCaptain', group: 'Maritime', type: 'rss', kind: 'news', fallbackWire: 'GLOBAL_AXIS', url: 'https://gcaptain.com/feed/' },
  { id: 'maritime-exec', name: 'The Maritime Executive — indexed feed', group: 'Maritime', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: 'site:maritime-executive.com shipping maritime ports' },
  { id: 'splash247', name: 'Splash247', group: 'Maritime', type: 'rss', kind: 'news', fallbackWire: 'GLOBAL_AXIS', url: 'https://splash247.com/feed/' },
  { id: 'marineinsight', name: 'Marine Insight', group: 'Maritime', type: 'rss', kind: 'news', fallbackWire: 'GLOBAL_AXIS', url: 'https://www.marineinsight.com/feed/' },
  // Shadow-fleet / sanctions-evasion & chokepoint reporting via the keyword cascade.
  { id: 'maritime-shadow', name: 'Shadow fleet & sanctions-evasion shipping', group: 'Maritime', type: 'search', kind: 'analysis', fallbackWire: 'GLOBAL_AXIS',
    query: '("shadow fleet" OR "dark fleet" OR "ship-to-ship" OR "STS transfer" OR "sanctioned tanker" OR "oil tanker" OR "flag of convenience" OR "AIS spoofing" OR "going dark") (sanctions OR Russia OR Iran OR evasion OR seized OR detained OR crude)' },
  { id: 'maritime-chokepoints', name: 'Chokepoints & maritime security', group: 'Maritime', type: 'search', kind: 'news', fallbackWire: 'GLOBAL_AXIS',
    query: '(Hormuz OR Malacca OR "Bab-el-Mandeb" OR "Red Sea" OR "Gulf of Aden" OR "Suez" OR "South China Sea" OR "Taiwan Strait") (vessel OR tanker OR ship OR Houthi OR drone OR attack OR seized OR hijack OR escort OR naval)' },

  { id: 'bellingcat', name: 'Bellingcat', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://www.bellingcat.com/feed/' },
  { id: 'crisisgroup', name: 'International Crisis Group', group: 'OSINT & analysis', type: 'search', kind: 'analysis', fallbackWire: 'REGIONAL', query: '"International Crisis Group" OR "Crisis Group report"' },
  { id: 'longwarjournal', name: 'Long War Journal', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://www.longwarjournal.org/feed' },
  { id: 'warontherocks', name: 'War on the Rocks', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://warontherocks.com/feed/' },
  { id: 'thediplomat', name: 'The Diplomat', group: 'OSINT & analysis', type: 'rss', kind: 'analysis', url: 'https://thediplomat.com/feed/' },
  { id: 'acled', name: 'ACLED (conflict data)', group: 'OSINT & analysis', type: 'search', kind: 'analysis', fallbackWire: 'REGIONAL', query: '"ACLED" OR "Armed Conflict Location" OR "conflict event data"' },
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
  // Verified official primary sources. RSS endpoints are documented by the
  // publishers; source availability is still monitored at runtime.
  { id: 'rbi-official', name: 'Reserve Bank of India — releases & notifications', group: 'Business & power', category: 'MARKETS', type: 'rss', kind: 'official', fallbackWire: 'BUSINESS', url: 'https://rbi.org.in/pressreleases_rss.xml' },
  { id: 'rbi-notifications', name: 'Reserve Bank of India — notifications', group: 'Business & power', category: 'MARKETS', type: 'rss', kind: 'official', fallbackWire: 'BUSINESS', url: 'https://rbi.org.in/notifications_rss.xml' },
  { id: 'sebi-official', name: 'SEBI — releases, circulars & orders', group: 'Business & power', category: 'MARKETS', type: 'rss', kind: 'official', fallbackWire: 'BUSINESS', url: 'https://www.sebi.gov.in/sebirss.xml' },
  { id: 'pib-defence', name: 'PIB — Defence Ministry releases', group: 'Defence & military', category: 'STRATEGIC', type: 'rss', kind: 'official', fallbackWire: 'GLOBAL_AXIS', url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=20' },
  { id: 'pib-commerce', name: 'PIB — Commerce & Industry releases', group: 'Business & power', category: 'LOGISTICS_SUPPLY_CHAIN', type: 'rss', kind: 'official', fallbackWire: 'BUSINESS', url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=5' },
  { id: 'imo-briefings', name: 'International Maritime Organization — press briefings', group: 'Maritime', category: 'LOGISTICS_SUPPLY_CHAIN', type: 'search', kind: 'official', fallbackWire: 'BUSINESS', query: 'site:imo.org/en/MediaCentre/PressBriefings maritime shipping safety security' },
  { id: 'wto-news', name: 'World Trade Organization — news', group: 'Business & power', category: 'LOGISTICS_SUPPLY_CHAIN', type: 'rss', kind: 'official', fallbackWire: 'BUSINESS', url: 'https://www.wto.org/library/rss/latest_news_e.xml' },
  { id: 'unctad-maritime', name: 'UNCTAD — maritime trade & transport', group: 'Maritime', category: 'LOGISTICS_SUPPLY_CHAIN', type: 'search', kind: 'official', fallbackWire: 'BUSINESS', query: 'site:unctad.org maritime transport trade port shipping logistics' },
  { id: 'unsc-sanctions', name: 'UN Security Council — sanctions', group: 'Crisis & advisories', category: 'GEOPOLITICS', type: 'search', kind: 'official', fallbackWire: 'FATF', query: 'site:main.un.org/securitycouncil/sanctions sanctions committee listing' },

  { id: 'imf-portwatch', name: 'IMF PortWatch — trade disruption signals', group: 'Maritime', category: 'LOGISTICS_SUPPLY_CHAIN', type: 'search', kind: 'official', fallbackWire: 'BUSINESS', query: 'site:portwatch.imf.org port calls maritime trade disruption chokepoint' },
  { id: 'oecd-ais-trade', name: 'OECD — AIS maritime trade indicators', group: 'Maritime', category: 'LOGISTICS_SUPPLY_CHAIN', type: 'search', kind: 'official', fallbackWire: 'BUSINESS', query: 'site:oecd.org AIS vessel tracking maritime trade ports chokepoints' },
  { id: 'unctad-trade-news', name: 'UNCTAD — global trade & supply chains', group: 'Business & power', category: 'LOGISTICS_SUPPLY_CHAIN', type: 'search', kind: 'official', fallbackWire: 'BUSINESS', query: 'site:unctad.org/unctad-news shipping supply chains trade logistics investment' },
  { id: 'india-dgft-trade', name: 'India DGFT — trade notices & export controls', group: 'Government & policy', category: 'LOGISTICS_SUPPLY_CHAIN', type: 'search', kind: 'official', fallbackWire: 'BUSINESS', query: 'site:dgft.gov.in trade notice export import notification public notice' },
  { id: 'india-shipping-ministry', name: 'India Ministry of Ports, Shipping & Waterways', group: 'Maritime', category: 'LOGISTICS_SUPPLY_CHAIN', type: 'search', kind: 'official', fallbackWire: 'BUSINESS', query: 'site:shipmin.gov.in ports shipping waterways port infrastructure shipping policy' },
  { id: 'nato-official', name: 'NATO — official statements & deployments', group: 'Defence & military', category: 'STRATEGIC', type: 'search', kind: 'official', fallbackWire: 'GLOBAL_AXIS', query: 'site:nato.int/en/news NATO statement exercise deployment defence' },


  // -----------------------------------------------------------------------
  // Regional intelligence expansion. Search feeds are public Google News RSS
  // queries constrained to named publishers/topics; no credentials required.
  // They complement direct feeds and are not represented as official sources.
  // Locale parameters keep regional search results from defaulting to India.
  // India & Indian Ocean
  { id: 'region-india-politics', name: 'India — politics & institutions', group: 'Indian news', region: 'India', type: 'search', kind: 'news', query: '(India OR Indian) (Parliament OR Supreme Court OR Election Commission OR state government OR cabinet)', hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  { id: 'region-india-security', name: 'India — internal security & counter-terror', group: 'India states & borders', region: 'India', type: 'search', kind: 'news', query: '(India OR Kashmir OR Manipur OR Chhattisgarh) (terrorism OR insurgency OR NIA OR police OR security forces OR border)', hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  { id: 'region-india-defence', name: 'India — defence procurement & military', group: 'Defence & military', region: 'India', type: 'search', kind: 'news', query: '(Indian Army OR Indian Navy OR Indian Air Force OR DRDO OR Ministry of Defence) (exercise OR procurement OR missile OR ship OR aircraft OR contract)', hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  { id: 'region-india-economy', name: 'India — economy, markets & regulation', group: 'Business & power', region: 'India', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: '(India OR Indian) (RBI OR SEBI OR rupee OR inflation OR trade OR investment OR manufacturing OR exports)', hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  { id: 'region-india-energy', name: 'India — energy, power & infrastructure', group: 'Business & power', region: 'India', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: '(India OR Indian) (oil OR gas OR coal OR electricity OR power grid OR refinery OR renewable energy OR infrastructure)', hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  // South Asia: Pakistan, Bangladesh, Nepal, Sri Lanka, Afghanistan, Bhutan, Myanmar
  { id: 'region-pakistan', name: 'Pakistan — politics, security & economy', group: 'South Asia', region: 'South Asia', type: 'search', kind: 'news', query: '(Pakistan OR Islamabad OR Karachi OR Lahore OR Balochistan OR Khyber Pakhtunkhwa) (politics OR military OR security OR economy OR protest OR border)', hl: 'en-PK', gl: 'PK', ceid: 'PK:en' },
  { id: 'region-pakistan-security', name: 'Pakistan — militancy & border security', group: 'South Asia', region: 'South Asia', type: 'search', kind: 'news', query: '(Pakistan OR Balochistan OR Khyber Pakhtunkhwa OR Waziristan) (TTP OR BLA OR militant OR attack OR insurgency OR border)', hl: 'en-PK', gl: 'PK', ceid: 'PK:en' },
  { id: 'region-bangladesh', name: 'Bangladesh — politics & security', group: 'South Asia', region: 'South Asia', type: 'search', kind: 'news', query: '(Bangladesh OR Dhaka OR Chittagong) (government OR election OR politics OR police OR border OR unrest OR economy)', hl: 'en-BD', gl: 'BD', ceid: 'BD:en' },
  { id: 'region-nepal', name: 'Nepal — politics, economy & China/India ties', group: 'South Asia', region: 'South Asia', type: 'search', kind: 'news', query: '(Nepal OR Kathmandu) (government OR parliament OR China OR India OR border OR hydropower OR economy)', hl: 'en-NP', gl: 'NP', ceid: 'NP:en' },
  { id: 'region-sri-lanka', name: 'Sri Lanka — politics, ports & economy', group: 'South Asia', region: 'South Asia', type: 'search', kind: 'news', query: '(Sri Lanka OR Colombo OR Hambantota) (government OR economy OR debt OR port OR China OR India OR security)', hl: 'en-LK', gl: 'LK', ceid: 'LK:en' },
  { id: 'region-afghanistan', name: 'Afghanistan — Taliban, security & humanitarian', group: 'South Asia', region: 'South Asia', type: 'search', kind: 'news', query: '(Afghanistan OR Kabul OR Kandahar) (Taliban OR security OR sanctions OR humanitarian OR border OR Pakistan)', hl: 'en-AF', gl: 'AF', ceid: 'AF:en' },
  { id: 'region-myanmar', name: 'Myanmar — conflict & regional security', group: 'South Asia', region: 'South Asia', type: 'search', kind: 'news', query: '(Myanmar OR Burma OR Yangon OR Rakhine OR Sagaing) (junta OR resistance OR conflict OR airstrike OR border OR ASEAN)', hl: 'en-MM', gl: 'MM', ceid: 'MM:en' },
  // Europe: institutions, defence, conflict, finance, energy and strategic industry
  { id: 'region-eu-institutions', name: 'Europe — EU institutions & policy', group: 'Europe', region: 'Europe', type: 'search', kind: 'news', query: '(European Union OR European Commission OR European Parliament OR Brussels) (sanctions OR regulation OR trade OR policy OR summit)', hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  { id: 'region-europe-security', name: 'Europe — security, intelligence & terrorism', group: 'Europe', region: 'Europe', type: 'search', kind: 'news', query: '(Europe OR European) (terrorism OR intelligence OR espionage OR sabotage OR security service OR hybrid warfare)', hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  { id: 'region-ukraine', name: 'Ukraine — war, diplomacy & reconstruction', group: 'Europe', region: 'Europe', type: 'search', kind: 'news', query: '(Ukraine OR Kyiv OR Donbas OR Crimea) (war OR strike OR drone OR diplomacy OR sanctions OR reconstruction)', hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  { id: 'region-russia', name: 'Russia — Kremlin, military & sanctions', group: 'Europe', region: 'Europe', type: 'search', kind: 'news', query: '(Russia OR Kremlin OR Moscow) (military OR sanctions OR intelligence OR energy OR economy OR foreign policy)', hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  { id: 'region-europe-defence', name: 'Europe — NATO, defence & military industry', group: 'Defence & military', region: 'Europe', type: 'search', kind: 'news', query: '(NATO OR European defence OR Germany OR France OR Poland OR Baltic states) (military spending OR procurement OR exercise OR deployment OR arms industry)', hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  { id: 'region-europe-energy', name: 'Europe — energy, industry & supply chains', group: 'Business & power', region: 'Europe', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: '(Europe OR EU) (energy security OR gas OR electricity OR manufacturing OR supply chain OR critical minerals OR ports)', hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  // Americas: United States, Canada and Latin America
  { id: 'region-us-government', name: 'United States — government, Congress & policy', group: 'Americas', region: 'Americas', type: 'search', kind: 'news', query: '(United States OR US OR Washington) (White House OR Congress OR Senate OR Supreme Court OR federal agency OR executive order)', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  { id: 'region-us-security', name: 'United States — national security & intelligence', group: 'Americas', region: 'Americas', type: 'search', kind: 'news', query: '(United States OR Pentagon OR FBI OR DHS OR CISA) (national security OR intelligence OR cyberattack OR terrorism OR defence)', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  { id: 'region-us-markets', name: 'United States — markets, technology & industry', group: 'Americas', region: 'Americas', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: '(United States OR US) (Federal Reserve OR Wall Street OR semiconductor OR AI industry OR energy OR trade policy)', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  { id: 'region-canada', name: 'Canada — politics, security & resources', group: 'Americas', region: 'Americas', type: 'search', kind: 'news', query: '(Canada OR Ottawa OR Toronto OR Vancouver) (government OR security OR energy OR mining OR trade OR Arctic)', hl: 'en-CA', gl: 'CA', ceid: 'CA:en' },
  { id: 'region-latin-america', name: 'Latin America — politics & security', group: 'Americas', region: 'Americas', type: 'search', kind: 'news', query: '(Latin America OR Brazil OR Mexico OR Argentina OR Colombia OR Venezuela) (election OR government OR security OR cartel OR economy OR protest)', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  { id: 'region-latam-trade', name: 'Latin America — trade, energy & critical minerals', group: 'Americas', region: 'Americas', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: '(Brazil OR Chile OR Argentina OR Peru OR Mexico) (lithium OR copper OR oil OR gas OR trade OR mining OR ports)', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  // China & East Asia: political, military, economic and technology signals
  { id: 'region-china-politics', name: 'China — CCP, government & policy', group: 'China & East Asia', region: 'China & East Asia', type: 'search', kind: 'news', query: '(China OR Beijing OR CCP OR Chinese government) (policy OR Politburo OR leadership OR legislation OR diplomacy)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-china-military', name: 'China — PLA, Taiwan Strait & South China Sea', group: 'China & East Asia', region: 'China & East Asia', type: 'search', kind: 'news', query: '(China OR PLA OR Taiwan Strait OR South China Sea) (military OR naval OR aircraft OR missile OR exercise OR coast guard)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-china-economy', name: 'China — economy, property & finance', group: 'China & East Asia', region: 'China & East Asia', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: '(China OR Chinese) (economy OR property crisis OR exports OR trade OR yuan OR banking OR debt OR stimulus)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-china-tech', name: 'China — semiconductors, AI & technology', group: 'China & East Asia', region: 'China & East Asia', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: '(China OR Chinese) (semiconductor OR chip OR AI OR technology OR export controls OR rare earths)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-taiwan', name: 'Taiwan — cross-strait & security', group: 'China & East Asia', region: 'China & East Asia', type: 'search', kind: 'news', query: '(Taiwan OR Taipei) (China OR cross-strait OR defence OR election OR semiconductor OR coast guard)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-japan-korea', name: 'Japan & South Korea — security & industry', group: 'China & East Asia', region: 'China & East Asia', type: 'search', kind: 'news', query: '(Japan OR South Korea OR Seoul OR Tokyo) (defence OR North Korea OR China OR semiconductor OR trade OR shipbuilding)', hl: 'en', gl: 'US', ceid: 'US:en' },
  // Middle East: conflict, Gulf, Iran, Israel/Palestine, shipping and energy
  { id: 'region-middle-east', name: 'Middle East — regional politics & security', group: 'Middle East', region: 'Middle East', type: 'search', kind: 'news', query: '("Middle East" OR Levant OR Gulf) (security OR diplomacy OR conflict OR sanctions OR intelligence)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-iran', name: 'Iran — state, nuclear programme & sanctions', group: 'Middle East', region: 'Middle East', type: 'search', kind: 'news', query: '(Iran OR Tehran) (nuclear OR sanctions OR IRGC OR diplomacy OR military OR oil)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-israel-palestine', name: 'Israel & Palestine — conflict and diplomacy', group: 'Middle East', region: 'Middle East', type: 'search', kind: 'news', query: '(Israel OR Palestine OR Gaza OR West Bank) (ceasefire OR military OR hostages OR diplomacy OR humanitarian)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-gulf', name: 'Gulf states — GCC, energy & investment', group: 'Middle East', region: 'Middle East', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: '(Saudi Arabia OR UAE OR Qatar OR Kuwait OR Bahrain OR Oman) (oil OR gas OR investment OR sovereign wealth OR security OR diplomacy)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-red-sea', name: 'Red Sea, Yemen & maritime security', group: 'Middle East', region: 'Middle East', type: 'search', kind: 'news', query: '(Red Sea OR Yemen OR Bab el-Mandeb OR Suez Canal) (shipping OR Houthi OR attack OR vessel OR maritime security)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-iraq-syria-lebanon', name: 'Iraq, Syria & Lebanon — conflict and security', group: 'Middle East', region: 'Middle East', type: 'search', kind: 'news', query: '(Iraq OR Syria OR Lebanon) (militia OR security OR airstrike OR sanctions OR government OR border)', hl: 'en', gl: 'US', ceid: 'US:en' },
  // Cross-regional strategic and non-traditional intelligence
  { id: 'region-global-cyber', name: 'Global — cyber incidents & threat actors', group: 'Cyber', region: 'Global', type: 'search', kind: 'analysis', fallbackWire: 'CYBER', query: '(ransomware OR cyberattack OR data breach OR zero-day OR APT OR critical infrastructure) (India OR Europe OR America OR China OR Middle East OR Asia)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-global-maritime', name: 'Global — maritime chokepoints & port disruption', group: 'Maritime', region: 'Global', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: '(Strait of Hormuz OR Malacca Strait OR Suez Canal OR Panama Canal OR Bab el-Mandeb OR Indian Ocean) (shipping OR port OR vessel OR disruption OR security)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-global-energy', name: 'Global — energy, commodities & sanctions', group: 'Business & power', region: 'Global', type: 'search', kind: 'news', fallbackWire: 'BUSINESS', query: '(oil OR LNG OR gas OR uranium OR rare earths OR critical minerals) (sanctions OR supply chain OR export OR price OR disruption)', hl: 'en', gl: 'US', ceid: 'US:en' },
  { id: 'region-global-disasters', name: 'Global — disasters & humanitarian emergencies', group: 'Crisis & advisories', region: 'Global', type: 'search', kind: 'official', fallbackWire: 'REGIONAL', query: '(earthquake OR cyclone OR flood OR wildfire OR famine OR humanitarian emergency) (India OR South Asia OR Europe OR Americas OR China OR Middle East)', hl: 'en', gl: 'US', ceid: 'US:en' },


  // Multilingual regional search desks. Search-language configuration is explicit;
  // social posts and translated coverage are still treated as claims, not proof.
  { id: 'lang-india-hindi', name: 'Hindi — India national & regional news', group: 'Indian news', region: 'India', type: 'search', kind: 'news', query: '(भारत OR इंडिया) (सरकार OR चुनाव OR सुरक्षा OR सेना OR अर्थव्यवस्था OR विदेश नीति)', hl: 'hi', gl: 'IN', ceid: 'IN:hi' },
  { id: 'lang-india-bengali', name: 'Bengali — Bengal, Bangladesh & regional affairs', group: 'South Asia', region: 'South Asia', type: 'search', kind: 'news', query: '(বাংলা OR পশ্চিমবঙ্গ OR বাংলাদেশ) (রাজনীতি OR নির্বাচন OR নিরাপত্তা OR অর্থনীতি OR সীমান্ত)', hl: 'bn', gl: 'IN', ceid: 'IN:bn' },
  { id: 'lang-pakistan-urdu', name: 'Urdu — Pakistan & regional security', group: 'South Asia', region: 'South Asia', type: 'search', kind: 'news', query: '(پاکستان OR افغانستان OR کشمیر) (سیاست OR فوج OR سلامتی OR معیشت OR سرحد)', hl: 'ur', gl: 'PK', ceid: 'PK:ur' },
  { id: 'lang-bangladesh-bengali', name: 'Bengali — Bangladesh politics & security', group: 'South Asia', region: 'South Asia', type: 'search', kind: 'news', query: '(বাংলাদেশ OR ঢাকা OR চট্টগ্রাম) (সরকার OR নির্বাচন OR রাজনীতি OR নিরাপত্তা OR অর্থনীতি)', hl: 'bn', gl: 'BD', ceid: 'BD:bn' },
  { id: 'lang-middle-east-arabic', name: 'Arabic — Middle East regional intelligence', group: 'Middle East', region: 'Middle East', type: 'search', kind: 'news', query: '(الشرق الأوسط OR الخليج OR إيران OR إسرائيل OR فلسطين) (سياسة OR أمن OR حرب OR عقوبات OR اقتصاد)', hl: 'ar', gl: 'SA', ceid: 'SA:ar' },
  { id: 'lang-iran-persian', name: 'Persian — Iran & regional affairs', group: 'Middle East', region: 'Middle East', type: 'search', kind: 'news', query: '(ایران OR تهران) (سیاست OR امنیت OR هسته‌ای OR تحریم OR اقتصاد)', hl: 'fa', gl: 'IR', ceid: 'IR:fa' },
  { id: 'lang-china-simplified', name: 'Chinese — mainland policy, PLA & economy', group: 'China & East Asia', region: 'China & East Asia', type: 'search', kind: 'news', query: '(中国 OR 中共 OR 解放军 OR 台湾 OR 南海) (政策 OR 军事 OR 经济 OR 科技 OR 安全)', hl: 'zh-CN', gl: 'CN', ceid: 'CN:zh-Hans' },
  { id: 'lang-taiwan-traditional', name: 'Traditional Chinese — Taiwan Strait & East Asia', group: 'China & East Asia', region: 'China & East Asia', type: 'search', kind: 'news', query: '(台灣 OR 中國 OR 南海) (國防 OR 軍事 OR 政策 OR 經濟 OR 半導體)', hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  { id: 'lang-europe-french', name: 'French — Europe, Africa & diplomacy', group: 'Europe', region: 'Europe', type: 'search', kind: 'news', query: '(Europe OR France OR Ukraine OR Sahel) (sécurité OR défense OR diplomatie OR sanctions OR économie)', hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  { id: 'lang-europe-german', name: 'German — Europe, defence & industry', group: 'Europe', region: 'Europe', type: 'search', kind: 'news', query: '(Europa OR Deutschland OR Ukraine) (Sicherheit OR Verteidigung OR Energie OR Wirtschaft OR Sanktionen)', hl: 'de', gl: 'DE', ceid: 'DE:de' },
  { id: 'lang-europe-russian', name: 'Russian — Russia, Ukraine & Eurasia', group: 'Europe', region: 'Europe', type: 'search', kind: 'news', query: '(Россия OR Украина OR Евразия) (безопасность OR армия OR политика OR санкции OR экономика)', hl: 'ru', gl: 'RU', ceid: 'RU:ru' },
  { id: 'lang-americas-spanish', name: 'Spanish — Latin America & hemispheric affairs', group: 'Americas', region: 'Americas', type: 'search', kind: 'news', query: '(América Latina OR México OR Brasil OR Argentina OR Venezuela) (seguridad OR política OR defensa OR economía OR comercio)', hl: 'es', gl: 'MX', ceid: 'MX:es' },

  // --- Added batch: regional gov + news, environment, and advisories ---
  { id: 'gdacs', name: 'GDACS (global disaster alerts)', group: 'Crisis & advisories', type: 'rss', kind: 'official', fallbackWire: 'REGIONAL', url: 'https://www.gdacs.org/xml/rss.xml' },
  { id: 'govuk', name: 'UK Government announcements', group: 'Government & policy', type: 'rss', kind: 'official', fallbackWire: 'REGIONAL', url: 'https://www.gov.uk/government/announcements.atom' },
  { id: 'thehindu-national', name: 'The Hindu (National)', group: 'Indian news', type: 'rss', kind: 'news', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { id: 'kathmandupost', name: 'The Kathmandu Post (Nepal)', group: 'South Asia', type: 'rss', kind: 'news', url: 'https://kathmandupost.com/rss' },
  { id: 'dailystar-bd', name: 'The Daily Star (Bangladesh)', group: 'South Asia', type: 'rss', kind: 'news', url: 'https://www.thedailystar.net/frontpage/rss.xml' },
  { id: 'colombogazette', name: 'Colombo Gazette (Sri Lanka)', group: 'South Asia', type: 'rss', kind: 'news', url: 'https://colombogazette.com/feed/' },
  { id: 'kyivindependent', name: 'The Kyiv Independent', group: 'Europe', type: 'rss', kind: 'news', url: 'https://kyivindependent.com/feed/' },
  { id: 'scmp-news', name: 'South China Morning Post', group: 'China & East Asia', type: 'rss', kind: 'news', url: 'https://www.scmp.com/rss/91/feed' },
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
    case 'search': return src.query ? `https://news.google.com/rss/search?q=${encodeURIComponent(`${src.query} when:3d`)}&hl=${encodeURIComponent(src.hl || 'en-IN')}&gl=${encodeURIComponent(src.gl || 'IN')}&ceid=${encodeURIComponent(src.ceid || 'IN:en')}` : '';
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
  if (src.type === 'x') return 'https://x.com/search?q=' + encodeURIComponent(src.query || '');
  try { return new URL(src.url).origin; } catch { return ''; }
}
