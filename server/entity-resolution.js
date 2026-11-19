// Conservative cross-source matching suggestions. Never merges entities or
// treats a candidate relationship as corroboration.
const clean=(v,n=500)=>String(v??'').normalize('NFKC').trim().slice(0,n);
const normalise=v=>clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const tokens=v=>new Set(normalise(v).split(' ').filter(x=>x.length>1));
const jaccard=(a,b)=>{const x=tokens(a),y=tokens(b);if(!x.size||!y.size)return 0;let n=0;for(const t of x)if(y.has(t))n++;return n/(x.size+y.size-n);};
function editSimilarity(a,b){
 const x=normalise(a),y=normalise(b);if(!x||!y)return 0;if(x===y)return 1;
 if(Math.abs(x.length-y.length)>Math.max(x.length,y.length)*0.35)return 0;
 let prev=Array.from({length:y.length+1},(_,i)=>i);
 for(let i=1;i<=x.length;i++){const cur=[i];for(let j=1;j<=y.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(x[i-1]===y[j-1]?0:1));prev=cur;}
 return 1-prev[y.length]/Math.max(x.length,y.length);
}
const variants=e=>[e?.name,...(Array.isArray(e?.aliases)?e.aliases:[])].map(normalise).filter(x=>x.length>=4);
export function buildEntityIdentityCandidates(entities=[],limit=250){
 const rows=(Array.isArray(entities)?entities:[]).slice(0,500),out=[];
 for(let i=0;i<rows.length&&out.length<limit;i++)for(let j=i+1;j<rows.length&&out.length<limit;j++){
  const a=rows[i],b=rows[j],ta=String(a.type||'OTHER').toUpperCase(),tb=String(b.type||'OTHER').toUpperCase();
  if(!a.id||!b.id||a.id===b.id||ta!==tb||ta==='OTHER')continue;
  const av=variants(a),bv=variants(b);let score=0,matched='';
  for(const x of av)for(const y of bv){const exact=x===y?1:0.0,sim=Math.max(exact,editSimilarity(x,y),jaccard(x,y));if(sim>score){score=sim;matched=exact?'EXACT_NORMALISED_ALIAS':'FUZZY_NAME_SIMILARITY';}}
  if(score<0.86)continue;
  out.push({leftId:String(a.id),rightId:String(b.id),similarity:Number(score.toFixed(3)),signal:matched,
   leftName:clean(a.name,180),rightName:clean(b.name,180),entityType:ta,
   status:'MACHINE_SUGGESTED',reviewRequired:true,autoMerged:false,
   limitation:'Name/alias similarity is a candidate identity lead only. It does not establish that two records refer to the same person or organisation.'});
 }
 return out.sort((a,b)=>b.similarity-a.similarity).slice(0,limit);
}
function canonical(value){try{const u=new URL(String(value));if(!['http:','https:'].includes(u.protocol))return '';u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(k))u.searchParams.delete(k);return u.toString();}catch{return '';}}
function host(value){try{return new URL(value).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}
function distance(a,b){
 const rad=x=>x*Math.PI/180,R=6371000,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
 const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function buildEvidenceCorrelationCandidates(evidence=[],limit=250){
 const rows=(Array.isArray(evidence)?evidence:[]).slice(0,500),out=[];
 for(let i=0;i<rows.length&&out.length<limit;i++)for(let j=i+1;j<rows.length&&out.length<limit;j++){
  const a=rows[i],b=rows[j];if(!a.id||!b.id||a.id===b.id)continue;
  const ua=canonical(a.url),ub=canonical(b.url),sameUrl=!!ua&&ua===ub;
  const titleScore=jaccard(a.title,b.title);
  const ta=Number(a.eventTimestamp||a.published||a.capturedAt),tb=Number(b.eventTimestamp||b.published||b.capturedAt);
  const timeHours=Number.isFinite(ta)&&Number.isFinite(tb)&&ta>0&&tb>0?Math.abs(ta-tb)/3600000:null;
  const timeNear=timeHours!==null&&timeHours<=24;
  const la=Number(a.lat),loa=Number(a.lon??a.lng),lb=Number(b.lat),lob=Number(b.lon??b.lng);
  const hasGeo=[la,loa,lb,lob].every(Number.isFinite)&&Math.abs(la)<=90&&Math.abs(lb)<=90&&Math.abs(loa)<=180&&Math.abs(lob)<=180;
  const distanceMeters=hasGeo?Math.round(distance({lat:la,lon:loa},{lat:lb,lon:lob})):null;
  const geoNear=distanceMeters!==null&&distanceMeters<=10000;
  const signals=[];
  if(sameUrl)signals.push('SAME_CANONICAL_URL');
  if(titleScore>=0.72)signals.push('SIMILAR_TITLE');
  if(timeNear)signals.push('TEMPORALLY_PROXIMATE');
  if(geoNear)signals.push('GEOGRAPHICALLY_PROXIMATE');
  const strong=sameUrl||(signals.length>=2&&(titleScore>=0.72||timeNear&&geoNear));
  if(!strong)continue;
  const ha=host(a.url),hb=host(b.url);
  out.push({leftId:String(a.id),rightId:String(b.id),signals,titleSimilarity:Number(titleScore.toFixed(3)),
   timeDeltaHours:timeHours===null?null:Number(timeHours.toFixed(2)),distanceMeters,
   sourceHosts:[ha,hb].filter(Boolean),independenceAssessment:sameUrl?'SAME_SOURCE_URL':ha&&hb&&ha===hb?'SAME_PUBLISHER_HOST':ha&&hb?'DIFFERENT_HOSTS_NOT_VERIFIED':'UNKNOWN',
   independentCorroboration:false,status:'MACHINE_SUGGESTED',reviewRequired:true,
   limitation:'Correlation signals prioritise review only. Shared publishers, syndication, timing and proximity do not prove independent corroboration or a shared event.'});
 }
 return out.sort((a,b)=>b.signals.length-a.signals.length||b.titleSimilarity-a.titleSimilarity).slice(0,limit);
}
