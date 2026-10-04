import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeedXml, toItems, parseQuakes, clusterThreats, buildAlerts, rateSeverity, classifyWire, keyTerms, cleanTitle } from '../feeds.js';
import { locate } from '../geo.js';

test('cleanTitle: prettifies URL-slug titles, leaves real headlines alone', () => {
  assert.equal(cleanTitle('OTHER-DATA-INDIA-UNNAO-ATTACKS-BORDER-FORCES_2026'), 'Other Data India Unnao Attacks Border Forces 2026');
  assert.equal(cleanTitle('Missile strike reported near the border'), 'Missile strike reported near the border'); // has spaces → unchanged
  assert.equal(cleanTitle('COVID-19'), 'COVID-19'); // short → unchanged
  assert.equal(cleanTitle('nospacesbutnoseparators'), 'nospacesbutnoseparators'); // not a slug → unchanged
});

test('toItems applies the slug sanitizer to item titles', () => {
  const [item] = toItems([{ title: 'INDIA-BORDER-SECURITY-FORCE-DATA_2026', link: 'https://satp.org/x', date: '' }], { outlet: 'SATP', wire: 'SATP' });
  assert.equal(item.title, 'India Border Security Force Data 2026');
});

test('toItems dropSlugs drops datasheet slug pages but keeps real headlines', () => {
  const entries = [
    { title: 'OTHER-DATA-INDIA-BORDER-FORCES_2026', link: 'https://satp.org/d', date: '' },
    { title: 'Security forces foil infiltration bid in Kashmir', link: 'https://satp.org/n', date: '' },
  ];
  const items = toItems(entries, { outlet: 'SATP', wire: 'SATP', dropSlugs: true });
  assert.equal(items.length, 1);
  assert.match(items[0].title, /infiltration bid in Kashmir/);
});

const GNEWS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>"q" - Google News</title>
<item><title>Suicide attack at checkpoint kills 12 in Dera Ismail Khan - Dawn</title><link>https://news.google.com/rss/articles/AAA?oc=5</link><guid isPermaLink="false">AAA</guid><pubDate>Sat, 26 Sep 2026 17:20:30 GMT</pubDate><description>&lt;a href="x"&gt;Suicide attack&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Dawn&lt;/font&gt;</description><source url="https://www.dawn.com">Dawn</source></item>
<item><title>Militants attack police post in North Waziristan - Geo News</title><link>https://news.google.com/rss/articles/BBB?oc=5</link><pubDate>Sat, 26 Sep 2026 15:00:00 GMT</pubDate><source url="https://www.geo.tv">Geo News</source></item>
<item><title>Two killed in suspected militant attack in Senapati, Manipur - Northeast Today</title><link>https://news.google.com/rss/articles/CCC?oc=5</link><pubDate>Sat, 26 Sep 2026 14:00:00 GMT</pubDate><source url="https://x">Northeast Today</source></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>X</title>
<entry><title>Ransomware gang breaches European hospital network</title><link rel="alternate" href="https://example.com/a"/><published>2026-09-26T10:00:00Z</published><summary>Details</summary></entry></feed>`;

const RDF = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<item rdf:about="https://dw.com/1"><title>Russian drone strike hits Odesa port</title><link>https://dw.com/1</link><dc:date>2026-09-26T09:00:00Z</dc:date></item></rdf:RDF>`;

const GDACS = `<?xml version="1.0"?><rss xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#" xmlns:gdacs="http://www.gdacs.org"><channel>
<item><title>Orange earthquake alert in Indonesia</title><link>https://www.gdacs.org/report.aspx?eventid=1</link><pubDate>${new Date().toUTCString()}</pubDate><geo:Point><geo:lat>-8.2</geo:lat><geo:long>120.3</geo:long></geo:Point><gdacs:alertlevel>Orange</gdacs:alertlevel></item></channel></rss>`;

test('parses Google News RSS and strips the outlet suffix', () => {
  const items = toItems(parseFeedXml(GNEWS), { wire: 'SATP' });
  assert.equal(items.length, 3);
  assert.equal(items[0].title, 'Suicide attack at checkpoint kills 12 in Dera Ismail Khan');
  assert.equal(items[0].source, 'Dawn');
  assert.equal(items[0].severity, 'CRITICAL');
  assert.equal(items[0].place.name, 'Dera Ismail Khan');
  assert.equal(items[1].place.name, 'Khyber Pakhtunkhwa');
  assert.equal(items[2].place.name, 'Manipur');
});

test('parses Atom and RDF, classifies outlet items into wires', () => {
  const atom = toItems(parseFeedXml(ATOM), { outlet: 'Test' });
  assert.equal(atom[0].wire, 'CYBER');
  assert.equal(atom[0].url, 'https://example.com/a');
  const rdf = toItems(parseFeedXml(RDF), { outlet: 'DW' });
  assert.equal(rdf[0].wire, 'KINETIC');
  assert.equal(rdf[0].place.name, 'Odesa');
  assert.equal(rdf[0].source, 'DW');
});

test('outlet items with no security keywords are dropped', () => {
  const xml = `<rss><channel><item><title>Dolly Parton estate dispute continues</title><link>https://x/1</link></item></channel></rss>`;
  assert.equal(toItems(parseFeedXml(xml), { outlet: 'BBC' }).length, 0);
});

test('parses GDACS geo points', () => {
  const e = parseFeedXml(GDACS)[0];
  assert.equal(e.lat, -8.2);
  assert.equal(e.lng, 120.3);
  assert.equal(e.alertLevel, 'Orange');
});

test('parses USGS GeoJSON', () => {
  const q = parseQuakes({ features: [{ id: 'us1', properties: { mag: 6.1, place: 'Near X', time: 1, url: 'u' }, geometry: { coordinates: [120, -8, 10] } }] });
  assert.equal(q[0].lat, -8);
  assert.equal(q[0].mag, 6.1);
});

test('gazetteer prefers specific places and avoids partial words', () => {
  assert.equal(locate('Chinese warships drill near Taiwan Strait').name, 'Taiwan Strait');
  assert.equal(locate('Nigeria army repels Boko Haram raid').name, 'Borno');
  assert.equal(locate('Floods in Niger displace thousands').name, 'Niger');
  assert.equal(locate('South Sudan president dissolves government').name, 'South Sudan');
  assert.equal(locate('Why us?'), null);
  assert.equal(locate('US strikes Houthi targets').name, 'Sanaa');
});

test('severity and wire rules', () => {
  assert.equal(rateSeverity('Four militants killed, 11 workers abducted'), 'HIGH');
  assert.equal(rateSeverity('Attack kills 13 at checkpoint'), 'CRITICAL');
  assert.equal(rateSeverity('Summit opens in Geneva'), 'LOW');
  assert.equal(classifyWire('FATF grey list review'), 'FATF');
  // India takes priority over SATP for India geography; Pakistan stays SATP.
  assert.equal(classifyWire('Encounter in Pulwama, two militants killed'), 'INDIA');
  assert.equal(classifyWire('Security forces foil infiltration in Kashmir'), 'INDIA');
  assert.equal(classifyWire('Blast kills 12 in Quetta, Balochistan'), 'SATP');
});

test('clusters threats by place and builds alerts', () => {
  const now = Date.now();
  const items = [
    { id: '1', title: 'Blast kills 12 in Quetta', source: 'A', url: 'u1', published: now, wire: 'SATP', severity: 'CRITICAL', place: locate('Quetta') },
    { id: '2', title: 'Gunmen attack convoy near Quetta', source: 'B', url: 'u2', published: now - 1000, wire: 'SATP', severity: 'HIGH', place: locate('Quetta') },
    { id: '3', title: 'Talks in Geneva', source: 'C', url: 'u3', published: now, wire: 'REGIONAL', severity: 'LOW', place: locate('Geneva') },
  ];
  const t = clusterThreats(items);
  assert.equal(t.length, 1);
  assert.equal(t[0].location, 'Balochistan');
  assert.equal(t[0].reports, 2);
  assert.equal(t[0].outlets, 2);
  assert.equal(t[0].severity, 'CRITICAL');
  assert.equal(buildAlerts(items).length, 2);
});

test('key terms drop stop words', () => {
  assert.deepEqual(keyTerms('Reports allege the UAE ransom payments are feeding al-Qaeda in the Sahel'), ['allege', 'UAE', 'ransom', 'payments', 'feeding', 'al-Qaeda', 'Sahel']);
});
