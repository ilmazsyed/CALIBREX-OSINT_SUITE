import { assessSourceIndependence } from './source-reliability.js';

const arr=(v,n=500)=>Array.isArray(v)?v.slice(0,n):[];
const str=(v,n=500)=>String(v??'').trim().slice(0,n);
const millis=v=>{if(v==null||v==='')return null;const n=Number(v);if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;const d=Date.parse(v);return Number.isFinite(d)?d:null;};
const host=v=>{try{return new URL(String(v)).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}};

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
 return {corroboration:{candidateRelationships:corroboration,analystRecordedCount:corroboration.length,reviewRequiredCount:corroboration.filter(x=>x.status!=='INDEPENDENCE_REVIEW_RECORDED').length,sourceIndependence:independence,caveat:'Corroboration is only recorded where an analyst explicitly links evidence. Different domains do not establish independent sourcing.'},contradictions:{items:contradictions,count:contradictions.length,coverage:contradictions.length?'ANALYST_FLAGGED_CONTRADICTIONS':'NO_ANALYST_CONTRADICTIONS_RECORDED',caveat:'Automated semantic contradiction detection is not claimed. Analysts must record and assess opposing evidence relationships.'},timeline};
}
