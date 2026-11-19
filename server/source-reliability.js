// Explainable source reliability assessment. This scores the source record's
// demonstrated collection quality, not the truth of an individual claim.
// No source is permanently trusted; scores are time-bounded and evidence-led.
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const arr=v=>Array.isArray(v)?v:[];
const str=(v,n=500)=>String(v??'').trim().slice(0,n);
const hostOf=value=>{try{return new URL(value).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}};
const validDate=v=>{const n=Date.parse(v);return Number.isFinite(n)?n:null};

export function assessSourceReliability(source={}, history=[]) {
  const factors=[];
  const add=(name,weight,score,reason)=>factors.push({name,weight,score:clamp(score),reason});
  const url=str(source.url,2000), host=hostOf(url);
  const rawSourceType=str(source.sourceType||source.type||'UNKNOWN',60).toUpperCase();
  const sourceType=({OFFICIAL_STATEMENT:'OFFICIAL',OFFICIAL_PUBLIC_SOURCE:'OFFICIAL',GOVERNMENT_RELEASE:'OFFICIAL',MEDIA_REPORT:'NEWS',OPEN_MEDIA:'NEWS',NEWS_ARTICLE:'NEWS',SOCIAL_POST:'SOCIAL',SOCIAL_OR_COMMUNITY:'SOCIAL',RESEARCH_REPORT:'RESEARCH'})[rawSourceType]||rawSourceType;
  const provenance=str(source.provenanceStatus||'UNKNOWN',60).toUpperCase();
  const captured=Boolean(source.contentSnapshot||source.captureHash||source.sha256);
  add('provenance',25,provenance==='SOURCE_CAPTURED'?100:captured?75:provenance==='ANALYST_SUPPLIED_NO_EXTERNAL_SOURCE'?10:25,
    provenance==='SOURCE_CAPTURED'?'Source content capture is recorded':captured?'A capture fingerprint exists but capture completeness is unclear':'No independently captured source content is recorded');
  const primary=['OFFICIAL','PRIMARY','GOVERNMENT','REGULATORY','COURT','SENSOR_PRIMARY'].includes(sourceType);
  const secondary=['NEWS','MEDIA','RESEARCH','NGO','ACADEMIC'].includes(sourceType);
  add('sourceNature',15,primary?90:secondary?70:sourceType==='SOCIAL'?35:45,
    primary?'Classified as a primary/official source':secondary?'Classified as a secondary/research source':'Source nature requires analyst review');
  const published=validDate(source.publishedAt??source.published), collected=validDate(source.collectedAt??source.capturedAt);
  const ageHours=published&&collected?Math.max(0,(collected-published)/3600000):null;
  add('temporalIntegrity',15,ageHours===null?35:ageHours<0?10:ageHours<=24?100:ageHours<=168?85:ageHours<=720?65:40,
    ageHours===null?'Publication/collection timestamps are incomplete':ageHours<0?'Publication timestamp is later than collection time':`Publication age at collection: ${Math.round(ageHours)} hours`);
  const prior=arr(history).filter(x=>x&&typeof x==='object');
  const resolved=prior.filter(x=>['CONFIRMED','REFUTED','CORRECTED'].includes(String(x.outcome||'').toUpperCase()));
  const accuracy=resolved.length?resolved.filter(x=>String(x.outcome).toUpperCase()==='CONFIRMED').length/resolved.length*100:null;
  add('historicalPerformance',25,accuracy===null?50:accuracy,
    accuracy===null?'Insufficient adjudicated history; neutral prior applied':`${resolved.length} adjudicated records; ${Math.round(accuracy)}% confirmed`);
  const corrections=prior.filter(x=>String(x.outcome||'').toUpperCase()==='CORRECTED').length;
  add('correctionRecord',10,prior.length?clamp(100-(corrections/prior.length)*100):50,
    prior.length?`${corrections} corrections among ${prior.length} reviewed records`:'No correction history available');
  const domain=host?35:0;
  add('identityAndDomain',10,domain,host?`Canonical publisher domain: ${host}`:'No valid source URL/domain');
  const score=Math.round(factors.reduce((s,f)=>s+f.weight*f.score/100,0));
  const confidence=resolved.length>=10?'ESTABLISHED_HISTORY':resolved.length>=3?'EMERGING_HISTORY':'LIMITED_HISTORY';
  return {score,band:score>=80?'HIGH':score>=60?'MODERATE':score>=40?'LOW':'VERY_LOW',
    historyConfidence:confidence,reviewedRecords:resolved.length,host:host||null,factors,
    caveats:['This is source-level reliability context, not claim truth probability.','Primary-source status does not guarantee accuracy or completeness.','Independent corroboration and claim-specific evidence remain necessary.'],
    assessedAt:new Date().toISOString(),version:1};
}

export function assessSourceIndependence(records=[]) {
  const groups=new Map();
  for(const [index,record] of arr(records).entries()){
    const host=hostOf(record.url), domain=publisherDomain(host), explicit=str(record.ownershipGroup||record.syndicationGroup||'',200).toLowerCase();
    const key=explicit?'group:'+explicit:domain?'domain:'+domain:'unknown:'+str(record.id||index,100);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(str(record.id,100));
  }
  const clusters=[...groups].map(([group,ids])=>({group,recordIds:ids,independentCount:1}));
  return {clusters,distinctPublisherGroupCount:clusters.length,independentGroupCount:0,independenceStatus:'NOT_ESTABLISHED',recordCount:arr(records).length,
    caveat:'Domain and declared syndication groups are dependency candidates only. No independent reporting relationship is verified by hostname grouping; inspect upstream attribution, ownership and sourcing before counting corroboration.'};
}
