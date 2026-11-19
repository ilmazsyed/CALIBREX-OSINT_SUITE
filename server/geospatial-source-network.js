// Geospatial source network: a truthful inventory of operational feeds,
// conditional integrations and reference layers. It never labels a catalogue
// entry as live unless the underlying collector reports a successful refresh.
const SOURCE_DEFS = [
  {id:'nasa-eonet',name:'NASA EONET',category:'natural-events',kind:'live-api',coverage:'Global',cadence:'Provider updates; polled every 10 minutes',data:'Wildfires, storms, floods, volcanoes and other natural events',url:'https://eonet.gsfc.nasa.gov/',collector:'geoint',healthKey:'eonet',limitations:['Selective event catalogue; not every hazard is represented.']},
  {id:'usgs-earthquakes',name:'USGS Earthquake Hazards Program',category:'seismic',kind:'live-api',coverage:'Global',cadence:'USGS live GeoJSON feed; polled every 10 minutes',data:'Earthquake events (current configured magnitude threshold: M4.5+)',url:'https://earthquake.usgs.gov/earthquakes/feed/',collector:'geoint',healthKey:'usgs',limitations:['Magnitude threshold and seismic network coverage affect inclusion.']},
  {id:'ioda-outages',name:'Georgia Tech IODA',category:'connectivity',kind:'live-api',coverage:'Country-level global coverage where supported',cadence:'Polled every 10 minutes',data:'Internet outage and connectivity disruption events',url:'https://ioda.inetintel.cc.gatech.edu/',collector:'geoint',healthKey:'outage',limitations:['Country-level locations are approximate; event schema and coverage vary.']},
  {id:'ucdp-ged',name:'Uppsala Conflict Data Program GED',category:'conflict',kind:'periodic-api',coverage:'Global',cadence:'Periodic dataset release',data:'Georeferenced organised-violence events',url:'https://ucdp.uu.se/downloads/',collector:'geoint',healthKey:'conflict',limitations:['Lagged research dataset; not real-time reporting.']},
  {id:'acled',name:'ACLED',category:'conflict',kind:'credentialed-api',coverage:'Global, subject to account access',cadence:'Provider updates; collector refreshes every 10 minutes',data:'Geocoded political violence and protest events',url:'https://acleddata.com/',collector:'geoint',healthKey:'acled',limitations:['Requires ACLED credentials; licensing and permitted use apply.']},
  {id:'nasa-firms',name:'NASA FIRMS VIIRS',category:'fire-detections',kind:'credentialed-api',coverage:'Configured area of interest; default spans Africa, Europe, MENA and Asia',cadence:'Near-real-time satellite detections; collector refreshes every 10 minutes',data:'Active-fire detections and fire radiative power',url:'https://firms.modaps.eosdis.nasa.gov/',collector:'geoint',healthKey:'fire',limitations:['Requires a NASA FIRMS MAP_KEY; nominal latency is around 3 hours; detections are not ground confirmation.']},
  {id:'adsb-lol',name:'adsb.lol ADS-B',category:'aircraft',kind:'live-api',coverage:'Configured point radii over South Asia, Gulf and Iraq plus global military feed',cadence:'Collector refreshes every 5 minutes',data:'Public aircraft transponder positions and emergency squawks',url:'https://adsb.lol/',collector:'signals',healthKey:'aircraft',limitations:['Coverage depends on receiver network; military feed is incomplete; aircraft identity and intent are not verified.']},
  {id:'opensky',name:'OpenSky Network',category:'aircraft',kind:'best-effort-api',coverage:'Best-effort South Asia bounding box',cadence:'Queried as a fallback during aircraft refresh',data:'Aircraft state vectors',url:'https://opensky-network.org/',collector:'signals',healthKey:'aircraft',limitations:['Anonymous access is restricted and may be rate-limited or blocked; not an independent guaranteed feed.']},
  {id:'aisstream',name:'AISStream',category:'maritime',kind:'credentialed-stream',coverage:'Configured maritime bounding boxes',cadence:'Live WebSocket; positions expire after 2 hours',data:'AIS vessel position reports',url:'https://aisstream.io/',collector:'ais',healthKey:'ais',limitations:['Requires AISSTREAM_KEY; AIS can be missing, spoofed, delayed or switched off; not a complete maritime picture.']},
  {id:'nasa-gibs',name:'NASA GIBS / Worldview imagery',category:'earth-imagery',kind:'imagery-service',coverage:'Global, sensor/layer dependent',cadence:'Sensor-specific revisit and publication',data:'Satellite browse imagery and temporal overlays',url:'https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs',limitations:['Resolution, clouds and revisit constrain interpretation; browse imagery is not live high-resolution surveillance.']},
  {id:'esri-reference',name:'Esri World Imagery',category:'earth-imagery',kind:'reference-imagery',coverage:'Global, provider-dependent',cadence:'Provider-managed; acquisition dates vary by tile',data:'High-resolution reference basemap imagery',url:'https://www.arcgis.com/',limitations:['Archival/reference imagery; do not infer current conditions or acquisition date without metadata.']},
  {id:'openstreetmap',name:'OpenStreetMap',category:'basemap',kind:'reference-data',coverage:'Global, contributor-dependent',cadence:'Community edits',data:'Roads, buildings, ports, infrastructure and place context',url:'https://www.openstreetmap.org/',limitations:['Completeness and positional accuracy vary; ODbL attribution/share-alike obligations apply.']},
  {id:'geonames',name:'GeoNames',category:'gazetteer',kind:'reference-data',coverage:'Global',cadence:'Daily database updates',data:'Place names and geographic reference points',url:'https://www.geonames.org/',limitations:['Gazetteer matches are contextual candidates, not proof of an incident location.']},
  {id:'natural-earth',name:'Natural Earth',category:'boundaries',kind:'reference-data',coverage:'Global',cadence:'Static periodic releases',data:'Administrative boundaries and cartographic context',url:'https://www.naturalearthdata.com/',limitations:['Small-scale cartographic data; not suitable for precision geolocation.']},
];
const asTime = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
function collectorState(def, snapshots, configured) {
  if (def.kind === 'reference-data' || def.kind === 'reference-imagery') return {status:'reference',available:true,updatedAt:null,count:null};
  if (def.kind === 'imagery-service') return {status:'imagery_layer',available:true,updatedAt:null,count:null};
  if (def.id === 'acled' && !configured.acled) return {status:'configuration_required',available:false,updatedAt:null,count:0};
  if (def.id === 'nasa-firms' && !configured.firms) return {status:'configuration_required',available:false,updatedAt:null,count:0};
  if (def.id === 'aisstream' && !configured.ais) return {status:'configuration_required',available:false,updatedAt:null,count:0};
  const snap = snapshots[def.collector] || {};
  const health = snap.sources?.[def.healthKey] || {};
  const count = def.id === 'adsb-lol' || def.id === 'opensky' ? (snap.aircraft?.aircraft?.length || 0)
    : def.id === 'aisstream' ? (snap.count || 0)
    : def.id === 'ucdp-ged' ? (snap.sources?.conflict?.count || 0)
    : (health.count ?? null);
  const updatedAt = asTime(health.at) || asTime(snap.updatedAt) || asTime(snap.aircraft?.at);
  // OpenSky is only a best-effort fallback in the shared aircraft collector;
  // the aggregate snapshot cannot prove which provider supplied a given row.
  if (def.id === 'opensky') return {status:'best_effort',available:count > 0,updatedAt,count};
  if (health.ok === true || (def.id === 'aisstream' && snap.connected && count > 0)) return {status:'active',available:true,updatedAt,count};
  if (health.state === 'cached' || (health.ok === true && count === 0)) return {status:'cached',available:count > 0,updatedAt,count};
  if (health.state === 'error') return {status:'degraded',available:count > 0,updatedAt,count,error:health.error || null};
  return {status:'not_confirmed',available:false,updatedAt,count};
}
export function geospatialSourceNetwork({geoint={},signals={},ais={},env=process.env,now=Date.now()}={}) {
  const snapshots={geoint,signals,ais};
  const configured={acled:!!(env.ACLED_EMAIL&&env.ACLED_PASSWORD),firms:!!env.NASA_FIRMS_KEY,ais:!!env.AISSTREAM_KEY};
  const sources=SOURCE_DEFS.map(def=>{
    const runtime=collectorState(def,snapshots,configured);
    const ageMs=runtime.updatedAt==null?null:Math.max(0,now-runtime.updatedAt);
    return {...def,...runtime,ageMs,stale:ageMs!=null&&ageMs>30*60*1000,
      provenance:{provider:def.name,providerUrl:def.url,collector:def.collector||null,healthKey:def.healthKey||null},
      interpretation:'A source status describes collector reachability or reference availability, not the truth or completeness of any observation.'};
  });
  const counts={total:sources.length,active:sources.filter(s=>s.status==='active').length,cached:sources.filter(s=>s.status==='cached').length,configuredRequired:sources.filter(s=>s.status==='configuration_required').length,reference:sources.filter(s=>['reference','imagery_layer'].includes(s.status)).length,degraded:sources.filter(s=>s.status==='degraded').length,notConfirmed:sources.filter(s=>s.status==='not_confirmed').length};
  return {generatedAt:new Date(now).toISOString(),counts,sources,coverageNote:'Coverage is provider- and sensor-dependent. A configured source may still return no observations for a region or time window. No result is not evidence that no event occurred.',statusDefinitions:{active:'Collector reports a successful recent refresh.',cached:'Last-good data is being retained after an empty or failed refresh.',configuration_required:'Integration is implemented but credentials are not configured.',degraded:'Collector reports an error; cached observations may remain available.',not_confirmed:'No successful collector state is currently confirmed.',reference:'Reference dataset or imagery, not a live event feed.',imagery_layer:'Imagery layer is catalogued in the product; this registry does not perform an independent provider uptime check.',best_effort:'Fallback provider with restricted or uncertain anonymous access.'}};
}
export const GEOSPATIAL_SOURCE_DEFINITIONS = SOURCE_DEFS;
