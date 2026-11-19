export const GEOSPATIAL_SOURCE_REGISTER=[
 {id:'nasa-eonet',name:'NASA Earth Observatory Natural Event Tracker',url:'https://eonet.gsfc.nasa.gov/',coverage:'Global',data:'Wildfires, storms, floods, volcanoes and natural events',cadence:'Near real time / provider updates',access:'Public API',caveat:'Event coverage is selective and depends on event reporting.'},
 {id:'usgs-earthquakes',name:'USGS Earthquake Hazards Program',url:'https://earthquake.usgs.gov/earthquakes/feed/',coverage:'Global',data:'Instrumentally recorded earthquakes',cadence:'Continuous feed',access:'Public GeoJSON feeds',caveat:'Magnitude threshold and network coverage affect inclusion.'},
 {id:'ucdp-ged',name:'Uppsala Conflict Data Program GED',url:'https://ucdp.uu.se/downloads/',coverage:'Global',data:'Georeferenced organised violence events',cadence:'Periodic release',access:'Public dataset',caveat:'Lagged dataset; not real-time.'},
 {id:'gdelt',name:'GDELT Project',url:'https://www.gdeltproject.org/',coverage:'Global',data:'Geolocated news and event reporting signals',cadence:'Near real time',access:'Public data',caveat:'News-derived locations can be ambiguous and duplicated.'},
 {id:'nasa-gibs',name:'NASA EOSDIS Global Imagery Browse Services',url:'https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs',coverage:'Global',data:'Satellite browse imagery',cadence:'Sensor-specific revisit and publication',access:'Public tile services',caveat:'Clouds, spatial resolution and revisit cadence constrain interpretation.'},
 {id:'openstreetmap',name:'OpenStreetMap',url:'https://www.openstreetmap.org/',coverage:'Global, contributor-dependent',data:'Roads, buildings, landmarks and geographic context',cadence:'Continuous community edits',access:'Open data with ODbL attribution/share-alike obligations',caveat:'Completeness and positional accuracy vary by place; not imagery.'},
 {id:'geonames',name:'GeoNames',url:'https://www.geonames.org/',coverage:'Global',data:'Place names and gazetteer context',cadence:'Daily database updates',access:'Public download / web services',caveat:'Gazetteer matches do not verify an event location.'},
 {id:'natural-earth',name:'Natural Earth',url:'https://www.naturalearthdata.com/',coverage:'Global',data:'Administrative boundaries and cartographic context',cadence:'Static periodic releases',access:'Public domain',caveat:'Small-scale cartographic data, not precision geolocation.'}
];

import { haversineDistanceMeters, validateCoordinates } from './geospatial-validation.js';

export function discoverGeospatialSources({origin={},radiusKm=100,events=[],evidence=[],maxAgeDays=30}={}) {
 const valid=validateCoordinates(origin);
 if(!valid.valid)throw new Error('A valid latitude and longitude are required for geospatial source discovery.');
 const radius=Math.max(1,Math.min(2000,Number(radiusKm)||100))*1000,cutoff=Date.now()-Math.max(1,Math.min(365,Number(maxAgeDays)||30))*86400000;
 const rows=[];
 for(const [index,item] of [...(Array.isArray(events)?events:[]),...(Array.isArray(evidence)?evidence:[])].entries()){
  const lat=Number(item.lat??item.latitude),lon=Number(item.lon??item.lng??item.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
  const distance=haversineDistanceMeters(valid,{lat,lon});
  if(distance===null||distance>radius)continue;
  const rawDate=item.date??item.published??item.publishedAt??item.capturedAt,at=rawDate==null?null:(Number.isFinite(Number(rawDate))?Number(rawDate):Date.parse(rawDate));
  if(Number.isFinite(at)&&at<cutoff)continue;
  rows.push({id:String(item.id||'geo-'+index),title:String(item.title||item.name||'Geospatial observation').slice(0,240),source:String(item.source||'Unspecified source').slice(0,120),url:String(item.url||'').slice(0,1200),lat,lon,distanceMeters:Math.round(distance),observedAt:Number.isFinite(at)?new Date(at).toISOString():null,category:String(item.category||item.categoryId||'UNCLASSIFIED'),severity:String(item.severity||'UNKNOWN'),origin:Array.isArray(evidence)&&evidence.includes(item)?'CASE_EVIDENCE':'PUBLIC_GEOINT_FEED',caveat:'Proximity is a discovery filter, not proof of relevance, event identity or causation.'});
 }
 return {origin:{lat:valid.lat,lon:valid.lon},radiusMeters:radius,results:rows.sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,300),sourceCount:new Set(rows.map(r=>r.source)).size,sourceRegister:GEOSPATIAL_SOURCE_REGISTER,generatedAt:new Date().toISOString(),caveat:'Feed coverage depends on provider publication, geocoding and refresh cadence. The register lists relevant global sources; it does not claim each source has been queried for this location. No result does not mean no event occurred.'};
}
