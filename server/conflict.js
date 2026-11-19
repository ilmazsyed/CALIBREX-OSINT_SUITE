// Conflict Watch: conservative public-reporting clusters.
// A cluster is a group of similar reports about a gazetteer place and time window,
// not a verified incident, exact geolocation, casualty count or operational picture.
import { snapshot } from './feeds.js';

const WIRES = ['INDIA', 'SATP', 'KINETIC', 'REGIONAL', 'GLOBAL_AXIS'];
const SEV_RANK = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
const SEV_NAME = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const INDIA = /\\b(india|indian|kashmir|jammu|manipur|chhattisgarh|jharkhand|assam|punjab|delhi|mumbai|bengaluru|kolkata|chennai|naxal|maoist)\\b/i;
const WINDOW_MS = 48 * 60 * 60 * 1000;
const STOP = new Set('the and for with from near after amid says said reports report attack attacks security forces killed dead injured in on of to a an'.split(' '));

export function eventHeadlineSimilarity(a, b) {
  const tokens = value => new Set(String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').split(/\\s+/).filter(x => x.length > 2 && !STOP.has(x)));
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const token of A) if (B.has(token)) common++;
  return common / (A.size + B.size - common);
}

export function clusterConflictReports(items = [], now = Date.now()) {
  const ordered = [...items].filter(i => i?.place?.name && Number.isFinite(i.place.lat) && Number.isFinite(i.place.lng))
    .sort((a,b) => (Number(a.published)||0) - (Number(b.published)||0));
  const clusters = [];
  for (const item of ordered) {
    const published = Number(item.published) || null;
    let cluster = [...clusters].reverse().find(g => {
      if (g.name !== item.place.name) return false;
      const withinWindow = !published || !g.latestPublished || Math.abs(published - g.latestPublished) <= WINDOW_MS;
      return withinWindow && g.items.some(existing => eventHeadlineSimilarity(existing.title, item.title) >= 0.34);
    });
    if (!cluster) {
      cluster = { name:item.place.name, lat:item.place.lat, lng:item.place.lng, items:[], latestPublished:published };
      clusters.push(cluster);
    }
    cluster.items.push(item);
    cluster.latestPublished = Math.max(cluster.latestPublished || 0, published || 0) || null;
  }
  return clusters.map(g => {
    const reports = g.items.length;
    const sources = new Set(g.items.map(i => {
      try { return new URL(i.url).hostname.toLowerCase().replace(/^www\\./,''); } catch { return String(i.source || 'unknown').toLowerCase(); }
    }));
    const maxSeverity = Math.max(0, ...g.items.map(i => SEV_RANK[i.severity] ?? 0));
    const latest = [...g.items].sort((a,b) => (Number(b.published)||0) - (Number(a.published)||0))[0];
    return {
      id: `${g.name}:${Math.round(g.lat*1000)},${Math.round(g.lng*1000)}:${Math.round((g.latestPublished||now)/WINDOW_MS)}:${eventHeadlineSimilarity(g.items[0]?.title,g.items.at(-1)?.title).toFixed(2)}`,
      title: g.items[0]?.title || g.name, location: g.name, category:'Conflict', categoryId:'conflict',
      severity: SEV_NAME[maxSeverity], severityBasis:'HIGHEST_SOURCE_HEADLINE_CLASSIFICATION',
      lat:g.lat, lng:g.lng, locationPrecision:'GAZETTEER_PLACE_CENTROID',
      geolocationConfidence:'LOW_UNVERIFIED', date:latest?.published || now,
      magnitude:`${reports} report${reports===1?'':'s'} · ${sources.size} publisher domain${sources.size===1?'':'s'}`,
      url:latest?.url||'', source:latest?.source||'Wire', india:g.items.some(i=>i.wire==='INDIA'||i.wire==='SATP'||INDIA.test(g.name)),
      reportCount:reports, publisherDomainCount:sources.size, eventClusterStatus:'CANDIDATE_NOT_VERIFIED',
      reports:g.items.map(i=>({id:i.id||null,title:i.title,url:i.url,source:i.source,published:i.published||null,severity:i.severity||'LOW'})),
      caveats:['Reports are grouped by gazetteer place, time proximity and headline similarity; this is not proof they describe one incident.',
        'Publisher domains are not necessarily independent sources; syndication and shared upstream reporting require review.',
        'Coordinates identify the named place centroid, not the incident location.',
        'Severity reflects the highest source headline keyword classification, not analyst-verified impact.']
    };
  }).sort((a,b)=>b.reportCount-a.reportCount || SEV_RANK[b.severity]-SEV_RANK[a.severity]).slice(0,300);
}

export function conflictSnapshot() {
  const snap = snapshot();
  const items = (snap.items || []).filter(i => WIRES.includes(i.wire) && i.place && Number.isFinite(i.place.lat) && Number.isFinite(i.place.lng));
  const events = clusterConflictReports(items);
  return { updatedAt:snap.updatedAt, refreshing:false, events, sources:{feed:{ok:(snap.items||[]).length>0}} };
}

// Conflict is computed on demand from the live feed — no separate loop needed.
export function startConflictLoop() { /* no-op */ }
