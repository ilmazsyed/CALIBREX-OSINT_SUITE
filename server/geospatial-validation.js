// Conservative geospatial validation primitives. Coordinates are observations,
// not proof of an event's location. Conflicts are surfaced for analyst review.
const finite=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n));
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
  const assessed=claims.map(c=>({...c,validation:validateCoordinates({
    ...c,
    resolvedCountry:c.resolvedCountry||c.geospatialContext?.place?.country,
    resolvedPlace:c.resolvedPlace||c.geospatialContext?.place?.name
  })}));
  const valid=assessed.filter(c=>c.validation.valid);
  const conflicts=[];
  for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++){
    const distance=haversineDistanceMeters(valid[i],valid[j]);
    const tolerance=Math.max(1000,Number(valid[i].accuracyMeters)||0,Number(valid[j].accuracyMeters)||0);
    if(distance>tolerance)conflicts.push({leftId:valid[i].id||String(i),rightId:valid[j].id||String(j),distanceMeters:Math.round(distance),toleranceMeters:tolerance,code:'LOCATION_CLAIM_CONFLICT'});
  }
  const claimWarnings=assessed.filter(c=>c.validation.warnings.length).map(c=>({
    evidenceId:c.id||null,warnings:c.validation.warnings,
    claimedCountry:c.claimedCountry||null,resolvedCountry:c.resolvedCountry||c.geospatialContext?.place?.country||null,
    claimedPlace:c.claimedPlace||null,resolvedPlace:c.resolvedPlace||c.geospatialContext?.place?.name||null,
    provider:c.geospatialContext?.provider||null
  }));
  return {validClaims:valid.length,invalidClaims:assessed.length-valid.length,conflicts,claimWarnings,
    status:conflicts.length?'CONFLICTS_FOUND':claimWarnings.length?'REVIEW_REQUIRED':'NO_COORDINATE_CONFLICT_DETECTED',
    caveat:'Coordinate and provider-place discrepancies are review flags, not truth determinations. No conflict detected is not confirmation of an event location.'};
}


// Compare location observations using their reported uncertainty radii.
// Unknown accuracy remains unknown; it is never silently treated as zero.
export function assessGeospatialCorroboration(claims = [], options = {}) {
  const threshold = Number.isFinite(Number(options.consistencyThresholdMeters))
    ? Math.max(0, Number(options.consistencyThresholdMeters)) : 1000;
  const normalized = claims.map((claim, index) => ({
    ...claim,
    _index: index,
    validation: validateCoordinates(claim)
  }));
  const valid = normalized.filter(claim => claim.validation.valid);
  const invalid = normalized.filter(claim => !claim.validation.valid);
  const comparisons = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const left = valid[i], right = valid[j];
      const distance = haversineDistanceMeters(left, right);
      const leftRadius = left.accuracyMeters == null ? null : Number(left.accuracyMeters);
      const rightRadius = right.accuracyMeters == null ? null : Number(right.accuracyMeters);
      const accuracyKnown = leftRadius !== null && rightRadius !== null &&
        Number.isFinite(leftRadius) && leftRadius >= 0 &&
        Number.isFinite(rightRadius) && rightRadius >= 0;
      const uncertaintyMeters = accuracyKnown ? leftRadius + rightRadius : null;
      const minimumSeparationMeters = accuracyKnown ? Math.max(0, distance - uncertaintyMeters) : null;
      const maximumSeparationMeters = accuracyKnown ? distance + uncertaintyMeters : null;
      let assessment = 'INDETERMINATE';
      if (accuracyKnown && minimumSeparationMeters > threshold) assessment = 'SPATIAL_CONFLICT';
      else if (accuracyKnown && maximumSeparationMeters <= threshold) assessment = 'CONSISTENT_WITHIN_TOLERANCE';
      comparisons.push({
        leftId: left.id || String(left._index),
        rightId: right.id || String(right._index),
        distanceMeters: Math.round(distance),
        leftAccuracyMeters: leftRadius,
        rightAccuracyMeters: rightRadius,
        uncertaintyMeters: uncertaintyMeters === null ? null : Math.round(uncertaintyMeters),
        minimumSeparationMeters: minimumSeparationMeters === null ? null : Math.round(minimumSeparationMeters),
        maximumSeparationMeters: maximumSeparationMeters === null ? null : Math.round(maximumSeparationMeters),
        consistencyThresholdMeters: threshold,
        accuracyKnown,
        assessment,
        caveat: accuracyKnown
          ? 'Reported accuracy radii are treated as bounds for comparison, not independently verified confidence intervals.'
          : 'At least one observation lacks a usable accuracy radius; spatial agreement or conflict cannot be established from distance alone.'
      });
    }
  }
  const conflicts = comparisons.filter(item => item.assessment === 'SPATIAL_CONFLICT');
  const indeterminate = comparisons.filter(item => item.assessment === 'INDETERMINATE');
  const consistent = comparisons.filter(item => item.assessment === 'CONSISTENT_WITHIN_TOLERANCE');
  return {
    validClaims: valid.length,
    invalidClaims: invalid.length,
    comparisons,
    summary: { conflicts: conflicts.length, consistent: consistent.length, indeterminate: indeterminate.length },
    status: conflicts.length ? 'CONFLICTS_FOUND' : indeterminate.length ? 'REVIEW_REQUIRED' : 'NO_CONFLICT_DETECTED',
    caveat: 'No detected conflict does not verify an event location. Accuracy values and source provenance require independent assessment.'
  };
}


// Validate a stored evidence coordinate against analyst claims and any saved
// provider-derived place context. Provider context remains attributed and is
// never promoted to independently verified truth.
export function validateEvidenceCoordinates(evidence = {}) {
  const context = evidence.geospatialContext && typeof evidence.geospatialContext === 'object'
    ? evidence.geospatialContext : null;
  const result = validateCoordinates({
    lat: evidence.lat ?? evidence.latitude,
    lon: evidence.lon ?? evidence.lng ?? evidence.longitude,
    accuracyMeters: evidence.accuracyMeters,
    claimedCountry: evidence.claimedCountry,
    resolvedCountry: evidence.resolvedCountry || context?.place?.country,
    claimedPlace: evidence.claimedPlace,
    resolvedPlace: evidence.resolvedPlace || context?.place?.name,
    sourceTimestamp: evidence.sourceTimestamp || evidence.exif?.DateTimeOriginal,
    eventTimestamp: evidence.eventTimestamp
  });
  return {
    ...result,
    placeContext: context ? {
      provider: context.provider || 'Unspecified provider',
      recordedAt: context.recordedAt || null,
      recordedBy: context.recordedBy || null,
      country: context.place?.country || null,
      place: context.place?.name || null,
      caveat: context.caveat || 'Provider-derived place context is not independent event-location verification.'
    } : null
  };
}
