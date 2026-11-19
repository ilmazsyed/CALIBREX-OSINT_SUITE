import { validateCoordinates } from './geospatial-validation.js';

const text=(v,n=500)=>String(v??'').trim().slice(0,n);
const host=value=>{try{return new URL(String(value)).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}};
const date=value=>{const n=Number(value);if(Number.isFinite(n)&&n>0)return n;const d=Date.parse(value);return Number.isFinite(d)?d:null};

export function assessVisualGeolocation(review={}, options={}) {
 const candidate=review.candidate||{};
 const coordinate=validateCoordinates({lat:candidate.lat,lon:candidate.lon,accuracyMeters:candidate.accuracyMeters});
 const matches=(Array.isArray(review.matches)?review.matches:[]).slice(0,20).map((m,i)=>({
  id:text(m.id||'match-'+(i+1),100),landmark:text(m.landmark,240),matchType:['DISTINCTIVE_LANDMARK','ROAD_NETWORK','COASTLINE','TERRAIN','BUILT_ENVIRONMENT','OTHER'].includes(m.matchType)?m.matchType:'OTHER',
  referenceUrl:text(m.referenceUrl,1500),referenceHost:host(m.referenceUrl),provider:text(m.provider,160),
  imageryDate:text(m.imageryDate,40),sensor:text(m.sensor,120),resolutionMeters:Number.isFinite(Number(m.resolutionMeters))&&Number(m.resolutionMeters)>0?Number(m.resolutionMeters):null,
  visualRationale:text(m.visualRationale,1000),reviewedBy:text(m.reviewedBy||options.analystId,120),reviewedAt:date(m.reviewedAt)||null,
  sourceHash:/^[a-f0-9]{64}$/i.test(m.sourceHash||'')?m.sourceHash:null
 }));
 const usable=matches.filter(m=>m.landmark&&m.referenceUrl&&m.referenceHost&&m.provider&&m.imageryDate&&m.visualRationale);
 const groups=new Map();for(const m of usable){if(!groups.has(m.referenceHost))groups.set(m.referenceHost,[]);groups.get(m.referenceHost).push(m);}
 const independentHosts=[...groups.keys()];
 const candidateValid=coordinate.valid;
 const imageryProvenanceComplete=usable.length>0&&usable.every(m=>m.provider&&m.imageryDate&&m.sensor);
 const temporalEvidence=date(review.imageCapturedAt);
 const imageryDates=usable.map(m=>date(m.imageryDate)).filter(Boolean);
 const temporalContextAvailable=!!temporalEvidence&&imageryDates.length>0;
 const temporalDeltas=temporalContextAvailable?imageryDates.map(t=>Math.abs(t-temporalEvidence)/86400000):[];
 const temporalCompatible=temporalContextAvailable&&temporalDeltas.some(d=>d<=Number(review.temporalToleranceDays||30));
 const uncertaintyRecorded=candidateValid&&candidate.accuracyMeters!=null&&Number.isFinite(Number(candidate.accuracyMeters))&&Number(candidate.accuracyMeters)>0;
 const conflict=review.conflictStatus==='CONFLICT';
 const gates={
  validCandidateCoordinates:candidateValid,
  uncertaintyRadiusRecorded:uncertaintyRecorded,
  visualLandmarkRationale:usable.some(m=>m.visualRationale.length>=20),
  imageryProvenance:imageryProvenanceComplete,
  multipleReferenceDomains:independentHosts.length>=2,
  temporalContext:temporalCompatible,
  analystReview:usable.some(m=>m.reviewedBy&&m.reviewedAt)
 };
 const passed=Object.values(gates).filter(Boolean).length;
 const status=conflict?'CONFLICT_REVIEW_REQUIRED':passed===7?'MULTI_REFERENCE_VISUAL_REVIEW_RECORDED':passed>=4?'PARTIAL_VISUAL_REVIEW':'INSUFFICIENT_VISUAL_EVIDENCE';
 return {status,reviewRequired:status!=='INDEPENDENT_VISUAL_MATCHES_RECORDED',candidate: candidateValid?{name:text(candidate.name,200),lat:coordinate.lat,lon:coordinate.lon,accuracyMeters:Number(candidate.accuracyMeters),claimedPlace:text(candidate.claimedPlace,200),claimedCountry:text(candidate.claimedCountry,120)}:null,
  gates,gateCount:{passed,total:7},matches,referenceHosts:independentHosts,temporalDeltasDays:temporalDeltas.map(x=>Number(x.toFixed(2))),
  confidenceLabel:passed===7&&!conflict?'MULTI_REFERENCE_REVIEW_COMPLETE':passed>=4?'PARTIAL':'INSUFFICIENT',
  caveats:['This workflow records analyst visual comparison against independent imagery references; it does not automate landmark recognition.','Different reference domains do not prove independent ownership or independent imagery acquisition. Verify provider, sensor, acquisition date, resolution and licensing.','A completed review means the required review fields are recorded, not that the proposed location is objectively true.','Coordinate accuracy is analyst-reported uncertainty, not a statistical confidence interval.']
 };
}
