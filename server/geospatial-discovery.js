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
 return {origin:{lat:valid.lat,lon:valid.lon},radiusMeters:radius,results:rows.sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,300),sourceCount:new Set(rows.map(r=>r.source)).size,generatedAt:new Date().toISOString(),caveat:'Feed coverage depends on provider publication, geocoding and refresh cadence. No result does not mean no event occurred.'};
}
