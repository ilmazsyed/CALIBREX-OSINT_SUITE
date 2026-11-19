// Conservative geospatial validation primitives. Coordinates are observations,
// not proof of an event's location. Conflicts are surfaced for analyst review.
const finite=n=>Number.isFinite(Number(n));
const normLon=n=>((Number(n)+540)%360)-180;
export function validateCoordinates(input={}) {
  const lat=Number(input.lat),lon=Number(input.lon??input.lng);
  const errors=[],warnings=[];
  if(!finite(input.lat)||lat < -90||lat > 90)errors.push('LATITUDE_OUT_OF_RANGE');
  if(!finite(input.lon??input.lng)||lon < -180||lon > 180)errors.push('LONGITUDE_OUT_OF_RANGE');
  const accuracy=input.accuracyMeters==null?null:Number(input.accuracyMeters);
  if(accuracy!==null&&(!Number.isFinite(accuracy)||accuracy<0))errors.push('INVALID_ACCURACY_RADIUS');
  if(input.claimedCountry&&input.resolvedCountry&&String(input.claimedCountry).toUpperCase()!==String(input.resolvedCountry).toUpperCase())warnings.push('COUNTRY_MISMATCH');
  if(input.claimedPlace&&input.resolvedPlace&&String(input.claimedPlace).toLowerCase()!==String(input.resolvedPlace).toLowerCase())warnings.push('PLACE_NAME_MISMATCH');
  if(input.sourceTimestamp&&input.eventTimestamp){
    const delta=Math.abs(Date.parse(input.sourceTimestamp)-Date.parse(input.eventTimestamp));
    if(Number.isFinite(delta)&&delta>7*86400000)warnings.push('EVENT_SOURCE_TIME_GAP_OVER_7_DAYS');
  }
  return {valid:errors.length===0,lat:errors.length?null:lat,lon:errors.length?null:normLon(lon),
    accuracyMeters:accuracy,errors,warnings,
    validationLevel:errors.length?'INVALID':warnings.length?'REVIEW_REQUIRED':'COORDINATE_FORMAT_VALID',
    caveat:'Coordinate format validation does not independently verify the place, imagery, sensor, or event attribution.'};
}
export function haversineDistanceMeters(a={},b={}) {
  const va=validateCoordinates(a),vb=validateCoordinates(b);
  if(!va.valid||!vb.valid)return null;
  const rad=x=>x*Math.PI/180,R=6371008.8;
  const dLat=rad(vb.lat-va.lat),dLon=rad(vb.lon-va.lon);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(va.lat))*Math.cos(rad(vb.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function compareLocationClaims(claims=[]) {
  const valid=claims.map(c=>({...c,validation:validateCoordinates(c)})).filter(c=>c.validation.valid);
  const conflicts=[];
  for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++){
    const distance=haversineDistanceMeters(valid[i],valid[j]);
    const tolerance=Math.max(1000,Number(valid[i].accuracyMeters)||0,Number(valid[j].accuracyMeters)||0);
    if(distance>tolerance)conflicts.push({leftId:valid[i].id||String(i),rightId:valid[j].id||String(j),distanceMeters:Math.round(distance),toleranceMeters:tolerance,code:'LOCATION_CLAIM_CONFLICT'});
  }
  return {validClaims:valid.length,invalidClaims:claims.length-valid.length,conflicts,
    status:conflicts.length?'CONFLICTS_FOUND':'NO_COORDINATE_CONFLICT_DETECTED',
    caveat:'No conflict detected is not confirmation of the event location; all claims still require provenance and contextual validation.'};
}
