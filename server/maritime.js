// Maritime intelligence (reliable, keyless): maritime incident and sanctions
// news from Calibrex's own live wires, geolocated like the threat map, plus the
// sanctioned-vessel registry from the OFAC lists. No live AIS WebSocket — this
// survives redeploys and needs no key. The shadow-fleet / sanctions story
// without the operational fragility of a vessel firehose.
import { snapshot } from './feeds.js';
import { sanctionedVessels } from './sanctions.js';

const MARITIME = /\b(vessel|tanker|ship(?:s|ping|ment|yard)?|cargo|freighter|bulk carrier|container ship|oil tanker|crude carrier|dhow|trawler|flotilla|port of|seaport|harbou?r|strait|hormuz|malacca|suez|bab[- ]?el[- ]?mandeb|red sea|gulf of aden|south china sea|shadow fleet|ship[- ]to[- ]ship|sts transfer|maritime|naval|navy|coast ?guard|warship|frigate|destroyer|submarine|piracy|pirate|houthi)\b/i;
const INDIA = /\b(india|indian|mumbai|chennai|kochi|visakhapatnam|kolkata|kandla|mundra|paradip|andaman|lakshadweep|arabian sea|bay of bengal|indian navy|indian coast guard)\b/i;

export function maritimeSnapshot() {
  const snap = snapshot();
  const items = (snap.items || []).filter(i => MARITIME.test(i.title) || (i.summary && MARITIME.test(i.summary)));
  const news = items.slice(0, 150).map(i => ({
    id: i.id, title: i.title, source: i.source, url: i.url, published: i.published || 0, severity: i.severity,
    place: i.place?.name || null, lat: i.place?.lat ?? null, lng: i.place?.lng ?? null,
    india: INDIA.test(i.title) || (i.summary ? INDIA.test(i.summary) : false) || i.wire === 'INDIA',
  }));
  const events = news.filter(n => Number.isFinite(n.lat) && Number.isFinite(n.lng));
  const vessels = sanctionedVessels();
  return {
    updatedAt: snap.updatedAt,
    news, events, vessels: vessels.slice(0, 1200),
    counts: { news: news.length, mapped: events.length, sanctioned: vessels.length, india: news.filter(n => n.india).length },
    sources: { feed: { ok: (snap.items || []).length > 0 }, sanctions: { count: vessels.length } },
  };
}

// Derived on demand from the live feed + sanctions lists — no loop needed.
export function startMaritimeLoop() { /* no-op */ }
