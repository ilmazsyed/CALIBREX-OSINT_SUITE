import { assessSourceIndependence } from './source-reliability.js';

const arr=(v,n=500)=>Array.isArray(v)?v.slice(0,n):[];
const str=(v,n=500)=>String(v??'').trim().slice(0,n);
const millis=v=>{if(v==null||v==='')return null;const n=Number(v);if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;const d=Date.parse(v);return Number.isFinite(d)?d:null;};
const host=v=>{try{return new URL(String(v)).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}};

const STOPWORDS=new Set('the and for with from after amid says said report reports news in on of to a an was were is are near during'.split(' '));
const titleTokens=value=>new Set((String(value||'').toLowerCase().normalize('NFKC').match(/[\\p{L}\\p{N}]{3,}/gu)||[]).filter(x=>!STOPWORDS.has(x)));
const titleSimilarity=(a,b)=>{const A=titleTokens(a),B=titleTokens(b);if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/(A.size+B.size-n);};
const casualtyClaim=e=>{const value=[e.title,e.summary,e.contentSnapshot,e.notes].filter(Boolean).join(' ').slice(0,12000);const m=/\\b(\\d{1,5})\\s+(?:people\\s+)?(killed|dead|deaths?|injured|wounded|arrested|missing)\\b/i.exec(value);return m?{value:Number(m[1]),metric:m[2].toLowerCase().replace(/s$/,'')}:null;};
const eventMillis=e=>millis(e.eventTimestamp??e.sourceTimestamp??null);
function detectPotentialDiscrepancies(evidence=[]) {
 const findings=[];
 for(let i=0;i<evidence.length;i++)for(let j=i+1;j<evidence.length;j++){
  const a=evidence[i],b=evidence[j],similarity=titleSimilarity(a.title,b.title);
  if(similarity<0.35)continue;
  const base={evidenceIds:[a.id,b.id],titleSimilarity:Number(similarity.toFixed(3)),status:'CANDIDATE_REQUIRES_ANALYST_REVIEW',countsAsContradiction:false};
  const ca=casualtyClaim(a),cb=casualtyClaim(b);
  if(ca&&cb&&ca.metric===cb.metric&&ca.value!==cb.value)findings.push({...base,type:'CONFLICTING_REPORTED_FIGURES',metric:ca.metric,values:[{evidenceId:a.id,value:ca.value},{evidenceId:b.id,value:cb.value}],caveat:'Different reported figures may reflect different update times, definitions or scopes; not a verified contradiction.'});
  const ta=eventMillis(a),tb=eventMillis(b);
  if(ta&&tb&&Math.abs(ta-tb)>6*3600000)findings.push({...base,type:'EVENT_TIMESTAMP_DISAGREEMENT',timestamps:[{evidenceId:a.id,value:ta},{evidenceId:b.id,value:tb}],differenceHours:Math.round(Math.abs(ta-tb)/3600000),caveat:'Event-time fields may use different timezones or refer to different stages; inspect original context.'});
  const la=str(a.claimedPlace||a.resolvedPlace,160).toLowerCase(),lb=str(b.claimedPlace||b.resolvedPlace,160).toLowerCase();
  if(la&&lb&&la!==lb)findings.push({...base,type:'LOCATION_CLAIM_DISAGREEMENT',locations:[{evidenceId:a.id,value:la},{evidenceId:b.id,value:lb}],caveat:'Place names may refer to nearby areas, administrative regions or different event stages; verify independently.'});
 }
 return findings.slice(0,200);
}

export function assessInvestigationQuality(caseRecord={}) {
 const evidence=arr(caseRecord.evidence,500),relationships=arr(caseRecord.relationships,1000);
 const byId=new Map(evidence.map(e=>[String(e.id),e]));
 const independence=assessSourceIndependence(evidence);
 const corroboration=[];
 for(const relation of relationships.filter(r=>r.type==='CORROBORATES')){
  const a=byId.get(String(relation.from)),b=byId.get(String(relation.to));
  if(!a||!b)continue;
  const ha=host(a.url),hb=host(b.url),sameHost=!!ha&&ha===hb;
  const explicitShared=String(a.syndicationGroup||a.ownershipGroup||'').trim()&&String(a.syndicationGroup||a.ownershipGroup)===String(b.syndicationGroup||b.ownershipGroup);
  const independent=!!ha&&!!hb&&!sameHost&&!explicitShared;
  corroboration.push({relationshipId:relation.id||null,evidenceIds:[a.id,b.id],sourceHosts:[ha,hb].filter(Boolean),independence:independent?'DIFFERENT_HOSTS_NOT_VERIFIED':sameHost?'SAME_PUBLISHER_HOST':explicitShared?'SHARED_GROUP':'UNKNOWN',analystRationale:str(relation.rationale),status:independent&&str(relation.rationale).length>=20?'INDEPENDENCE_REVIEW_RECORDED':'CORROBORATION_REVIEW_REQUIRED',countsAsIndependentCorroboration:false,caveat:'Different hosts and analyst rationale are not proof of independent sourcing. Check upstream attribution, syndication and ownership.'});
 }
 const contradictions=relationships.filter(r=>r.type==='CONTRADICTS').map(r=>{
  const a=byId.get(String(r.from)),b=byId.get(String(r.to));
  return {relationshipId:r.id||null,leftEvidenceId:a?.id||r.from,rightEvidenceId:b?.id||r.to,leftTitle:str(a?.title),rightTitle:str(b?.title),rationale:str(r.rationale),status:r.assessment==='ASSESSED'?'ANALYST_ASSESSED_CONTRADICTION':'ANALYST_FLAGGED_CONTRADICTION',reviewRequired:true};
 });
 const events=[];
 for(const e of evidence){
  const candidates=[
   ['PUBLISHED',e.published??e.publishedAt,'Source publication timestamp'],
   ['SOURCE_METADATA',e.sourceTimestamp??e.exif?.DateTimeOriginal??e.videoMetadata?.containerCreationTime,'Source/media metadata timestamp'],
   ['CAPTURED',e.capturedAt,'Case collection timestamp'],
   ['EVENT_TIME',e.eventTimestamp,'Analyst-attributed event timestamp']
  ];
  for(const [kind,value,label] of candidates){const at=millis(value);if(at)events.push({id:String(e.id)+':'+kind,evidenceId:e.id,title:str(e.title,200),kind,label,at,source:str(e.source||e.url,300),timezoneCertainty:kind==='SOURCE_METADATA'&&typeof value==='string'&&!/(Z|[+-]\\d\\d:?\\d\\d)$/.test(value)?'UNKNOWN':'AS_RECORDED'});}
  for(const frame of arr(e.videoMetadata?.keyframes,6))events.push({id:String(e.id)+':frame:'+frame.id,evidenceId:e.id,title:str(e.title,200)+' · video frame',kind:'VIDEO_OFFSET',label:'Relative clip offset; not an absolute timestamp',offsetSeconds:Number(frame.timestampSeconds)||0,at:null,visualNote:str(frame.visualNote),timezoneCertainty:'NOT_APPLICABLE'});
  for(const match of arr(e.visualGeolocationReview?.matches,20)){
   const imageryAt=millis(match.imageryDate);
   if(imageryAt)events.push({id:String(e.id)+':imagery:'+match.id,evidenceId:e.id,title:str(e.title,200)+' · reference imagery',kind:'IMAGERY_ACQUISITION',label:str(match.provider)+' / '+str(match.sensor),at:imageryAt,source:str(match.referenceUrl,300),timezoneCertainty:'AS_RECORDED'});
   const reviewedAt=millis(match.reviewedAt);
   if(reviewedAt)events.push({id:String(e.id)+':visual-review:'+match.id,evidenceId:e.id,title:str(e.title,200)+' · visual comparison',kind:'ANALYST_REVIEW',label:str(match.landmark),at:reviewedAt,source:str(match.referenceUrl,300),timezoneCertainty:'AS_RECORDED'});
  }
 }
 for(const note of arr(caseRecord.notes,200)){const at=millis(note.createdAt);events.push({id:'note:'+note.id,evidenceId:note.evidenceId||'',title:'Analyst note',kind:'ANALYST_NOTE',label:str(note.text,220),at,source:'Case analyst',timezoneCertainty:'AS_RECORDED'});}
 for(const relation of relationships){const at=millis(relation.createdAt);events.push({id:'relationship:'+relation.id,evidenceId:relation.from||'',title:'Evidence relationship recorded',kind:'RELATIONSHIP',label:str(relation.type)+' · '+str(relation.rationale,200),at,source:'Analyst recorded',timezoneCertainty:'AS_RECORDED'});}
 events.sort((a,b)=>a.at==null?1:b.at==null?-1:a.at-b.at);
 const dated=events.filter(e=>e.at!=null);
 const distinctTimes=new Set(dated.map(e=>Math.floor(e.at/60000))).size;
 const timeline={events,datedEventCount:dated.length,undatedRelativeEventCount:events.length-dated.length,distinctMinuteBuckets:distinctTimes,coverage:dated.length>=2?'MULTI_EVENT_CHRONOLOGY':dated.length===1?'SINGLE_DATED_EVENT':'NO_DATED_EVENTS',caveat:'Publication, metadata, event and collection times are distinct. Timezone-unknown metadata is not silently converted. Sequence does not establish causation.'};
 const potentialDiscrepancies=detectPotentialDiscrepancies(evidence);
 return {corroboration:{candidateRelationships:corroboration,analystRecordedCount:corroboration.length,reviewRequiredCount:corroboration.filter(x=>x.status!=='INDEPENDENCE_REVIEW_RECORDED').length,sourceIndependence:independence,caveat:'Corroboration is only recorded where an analyst explicitly links evidence. Different domains do not establish independent sourcing.'},contradictions:{items:contradictions,count:contradictions.length,coverage:contradictions.length?'ANALYST_FLAGGED_CONTRADICTIONS':'NO_ANALYST_CONTRADICTIONS_RECORDED',caveat:'Analyst-recorded contradictions are distinct from automatically detected candidate discrepancies. Automated candidates require human review.'},potentialDiscrepancies:{items:potentialDiscrepancies,count:potentialDiscrepancies.length,coverage:potentialDiscrepancies.length?'STRUCTURED_CANDIDATES_FOUND':'NO_STRUCTURED_CANDIDATES',caveat:'Candidates use conservative title similarity and structured field differences. They are not semantic proof or verified contradictions.'},timeline};
}
