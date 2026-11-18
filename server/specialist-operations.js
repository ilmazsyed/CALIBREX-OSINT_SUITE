// Operational collection and assessment orchestration for the five specialist roles.
// Collection is public-source only, bounded, rate-limited, provenance-preserving and
// persisted per operator. It reuses existing keyless feeds/search; no credentials added.
import crypto from 'node:crypto';
import { normaliseObservation } from './domain-intelligence.js';
import { assessDefenceCollection, assessCorporateRisk, assessSupplyChainRisk, assessGeopoliticalEnvironment, assessStrategicForesight } from './domain-analytic-engines.js';

export const SPECIALIST_COLLECTION_PLANS = {
 DEFENCE_IW: [
  'military defence procurement armed forces exercises deployments official statements',
  'military cyber advisories nuclear arms control strategic stability',
  'India defence ministry armed forces navy air force military exercises'
 ],
 CORPORATE_RISK: [
  'company corporate filings regulatory action sanctions litigation insolvency',
  'director shareholder ownership disclosure merger acquisition investigation',
  'company adverse media fraud enforcement competition regulator'
 ],
 SUPPLY_CHAIN: [
  'shipping port disruption maritime chokepoint supply chain logistics',
  'commodity trade flows supplier disruption freight route congestion',
  'India exports imports trade disruption shipping port'
 ],
 GEOPOLITICAL: [
  'geopolitical conflict diplomatic sanctions border tensions foreign policy',
  'election political instability protest ceasefire escalation international relations',
  'India neighbourhood security diplomacy regional geopolitics'
 ],
 STRATEGIC: [
  'macroeconomic policy energy security technology strategic dependencies',
  'central bank inflation trade policy industrial strategy technology adoption',
  'India economic outlook energy trade technology policy'
 ]
};
export function filterSpecialistFeedItems(role,items=[]){
 const patterns={
  DEFENCE_IW:/defence|military|army|navy|air force|missile|exercise|drill|nuclear|cyber|armed forces|security|border|warship|procurement|fighter|submarine|strategic/i,
  CORPORATE_RISK:/company|corporate|director|shareholder|filing|regulator|sanction|court|lawsuit|fraud|insolv|bankrupt|merger|acquisition|business/i,
  SUPPLY_CHAIN:/port|shipping|vessel|maritime|strait|canal|commodity|trade|export|import|supplier|logistics|freight|supply chain/i,
  GEOPOLITICAL:/geopolit|conflict|war|border|diplomat|sanction|election|protest|ceasefire|government|foreign policy|military|treaty/i,
  STRATEGIC:/econom|inflation|central bank|energy|technology|semiconductor|trade|industrial|policy|gdp|growth|strategic/i
 };
 const re=patterns[String(role||'').toUpperCase()];
 return aSafe(items).filter(x=>re&&re.test(String(x.title||'')+' '+String(x.summary||''))).slice(0,250);
}
const ROLE_RUNNERS={DEFENCE_IW:assessDefenceCollection,CORPORATE_RISK:assessCorporateRisk,SUPPLY_CHAIN:assessSupplyChainRisk,GEOPOLITICAL:assessGeopoliticalEnvironment,STRATEGIC:assessStrategicForesight};
const clamp=(v,n=1000)=>String(v??'').trim().slice(0,n);
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const timeoutFetch=async(url,ms=12000)=>{
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),ms);
 try{const res=await fetch(url,{signal:ctl.signal,headers:{'User-Agent':'Calibrex-OSINT-Studio/1.0','Accept':'application/json'}});if(!res.ok)throw new Error('HTTP '+res.status);return res;}
 finally{clearTimeout(timer);}
};
function classifyDomain(role,item){
 const t=(item.title+' '+(item.text||'')).toLowerCase();
 if(role==='DEFENCE_IW'){
  if(/cyber|ransomware|vulnerability|zero.day|cve-/.test(t))return 'CYBER';
  if(/nuclear|iaea|arms control|missile test|strategic stability/.test(t))return 'NUCLEAR';
  if(/exercise|drill|manoeuvre|joint training/.test(t))return 'EXERCISE';
  if(/procurement|contract|arms transfer|fighter|frigate|submarine|missile system/.test(t))return 'CAPABILITY';
  if(/propaganda|narrative|disinformation|influence operation/.test(t))return 'INFORMATION';
  return 'POSTURE';
 }
 if(role==='CORPORATE_RISK')return /sanction|litigation|court|regulator|fraud|insolv|bankrupt/.test(t)?'REGULATORY':'CORPORATE';
 if(role==='SUPPLY_CHAIN')return /port|vessel|shipping|maritime|strait|canal|route/.test(t)?'LOGISTICS':/commodity|export|import|trade|supplier/.test(t)?'TRADE':'DISRUPTION';
 if(role==='GEOPOLITICAL')return /election|parliament|protest|coalition|government/.test(t)?'POLITICAL':/sanction|diplomat|treaty|summit|foreign ministry/.test(t)?'DIPLOMATIC':'CONFLICT';
 return /energy|oil|gas|power/.test(t)?'ENERGY':/technology|ai|semiconductor|chip/.test(t)?'TECHNOLOGY':/trade|export|import/.test(t)?'TRADE':'MACRO';
}
function isOfficial(url,source){
 const h=(()=>{try{return new URL(url).hostname.toLowerCase()}catch{return ''}})();
 return /(^|\.)(gov|gov\.in|mil|int)$/.test(h.split('.').slice(-1)[0]||'')||/\.gov\.|\.gov\.in$|\.mil$|\.int$/.test(h)||/official|government|ministry|department|agency/i.test(source||'');
}
function toObservation(role,item,article=null){
 const url=clamp(article?.url||item.url,2048),source=clamp(article?.siteName||item.source||'Unknown publisher',180);
 const title=clamp(article?.title||item.title,500),text=clamp(article?.text||'',12000);
 const capturedAt=Date.now(),publishedAt=Number(item.published)||Number(article?.published)||null;
 const social=/reddit\.com|t\.me|bsky\.app|x\.com|twitter\.com/i.test(url);
 const eventType=classifyDomain(role,{title,text});
 const sourceType=social?'SOCIAL_OR_COMMUNITY':isOfficial(url,source)?'OFFICIAL_PUBLIC_SOURCE':'OPEN_MEDIA';
 const evidenceType=social?'SOCIAL_POST':isOfficial(url,source)?'OFFICIAL_STATEMENT':'MEDIA_REPORT';
 const id='sp_'+hash([role,url,title,publishedAt].join('|')).slice(0,24);
 return normaliseObservation({id,url,title,text,source,provider:sourceType,publishedAt,capturedAt,kind:social?'SOCIAL':'NEWS',eventType,assessment:social?'CLAIM':'CLAIM',licence:'SOURCE_TERMS_APPLY',countryCodes:[],theme:eventType});
}
async function collectWorldBank(country='IND'){
 const codes=['NY.GDP.MKTP.KD.ZG','FP.CPI.TOTL.ZG','NE.EXP.GNFS.ZS','NE.IMP.GNFS.ZS','FI.RES.TOTL.CD'];
 const rows=await Promise.all(codes.map(async code=>{
  try{const r=await timeoutFetch('https://api.worldbank.org/v2/country/'+encodeURIComponent(country)+'/indicator/'+encodeURIComponent(code)+'?format=json&mrv=5&per_page=5');const j=await r.json();return (j?.[1]||[]).filter(x=>x.value!==null).map(x=>({id:code+'_'+x.date,countryCode:country,name:code,value:Number(x.value),period:String(x.date),source:'World Bank',unit:'indicator'}));}catch{return [];}
 }));
 return rows.flat();
}
async function collectComtrade(country='IND'){
 // Public preview endpoint; unavailable/limited responses are recorded as a source gap.
 const year=String(new Date().getUTCFullYear()-1);
 const out=[];
 for(const flowCode of ['M','X']){
  try{
   const url='https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode='+encodeURIComponent(({IND:'699',USA:'842',CHN:'156',GBR:'826',RUS:'643',PAK:'586'})[country]||'699')+'&period='+year+'&cmdCode=TOTAL&flowCode='+flowCode+'&partnerCode=0&partner2Code=0&motCode=0&aggregateBy=6&breakdownMode=classic';
   const r=await timeoutFetch(url,10000),j=await r.json();
   for(const x of (j.data||[]).slice(0,100))out.push({partnerId:String(x.partnerDesc||x.partnerCode||'Partner'),partner:String(x.partnerDesc||'Partner'),value:Number(x.primaryValue)||Number(x.netWgt)||0,currency:'USD',period:year,flow:flowCode==='M'?'IMPORT':'EXPORT',source:'UN Comtrade',sourceCode:x.cmdCode,reporter:x.reporterDesc});
  }catch{/* API limits or preview unavailability do not become zero trade. */}
 }
 return out;
}

export function ingestSpecialistFeedSnapshot({role,feedItems=[]}={}){
 const key=String(role||'').toUpperCase();
 if(!SPECIALIST_COLLECTION_PLANS[key])throw new Error('Unknown specialist role.');
 const filtered=filterSpecialistFeedItems(key,feedItems);
 const observations=filtered.map(x=>toObservation(key,x));
 return {role:key,observations,collection:{startedAt:Date.now(),queryCount:0,successfulQueries:0,failedQueries:0,results:observations.length,articleBodies:0,feedSnapshotItems:feedItems.length,sourceMode:'AUTOMATIC_EXISTING_FEED_CAPTURE',credentialsRequired:false,gaps:['Automatic capture uses the existing shared feed snapshot only; it does not independently poll sources.']}};
}

export async function collectSpecialistData({role,searchNews,feedItems=[],readArticle,country='IND'}={}){
 const key=String(role||'').toUpperCase(),queries=SPECIALIST_COLLECTION_PLANS[key];
 if(!queries)throw new Error('Unknown specialist role.');
 if(typeof searchNews!=='function')throw new Error('Search provider is unavailable.');
 const settled=await Promise.allSettled(queries.map(q=>searchNews(q,'7d')));
 const hits=[];
 for(const r of settled)if(r.status==='fulfilled')hits.push(...(r.value||[]));
 const seen=new Set(),unique=[];
 for(const x of [...hits,...feedItems]){
  const url=clamp(x.url,2048),title=clamp(x.title,500);if(!url||!title)continue;
  const id=hash(url+'|'+title);if(seen.has(id))continue;seen.add(id);unique.push({...x,url,title});
 }
 unique.sort((a,b)=>(Number(b.published)||0)-(Number(a.published)||0));
 const articleCandidates=unique.filter(x=>x.url).slice(0,10);
 const articleResults=await Promise.allSettled(articleCandidates.map(x=>readArticle?readArticle(x.url):Promise.reject(new Error('No article reader'))));
 const articleByUrl=new Map();
 articleResults.forEach((r,i)=>{if(r.status==='fulfilled')articleByUrl.set(articleCandidates[i].url,r.value);});
 const observations=unique.slice(0,160).map(x=>toObservation(key,x,articleByUrl.get(x.url)));
 const errors=settled.filter(x=>x.status==='rejected').length;
 let macroIndicators=[],tradeFlows=[];
 if(key==='STRATEGIC'||key==='SUPPLY_CHAIN'){
  [macroIndicators,tradeFlows]=await Promise.all([collectWorldBank(country),key==='SUPPLY_CHAIN'?collectComtrade(country):Promise.resolve([])]);
 }
 return {role:key,observations,macroIndicators,tradeFlows,collection:{startedAt:Date.now(),queryCount:queries.length,successfulQueries:queries.length-errors,failedQueries:errors,results:observations.length,articleBodies:articleByUrl.size,feedSnapshotItems:feedItems.length,sourceMode:'PUBLIC_OPEN_WEB_AND_EXISTING_FEEDS',credentialsRequired:false,country,adapters:{worldBank:macroIndicators.length?'CONNECTED':'UNAVAILABLE_OR_EMPTY',unComtrade:key==='SUPPLY_CHAIN'?(tradeFlows.length?'CONNECTED':'UNAVAILABLE_OR_LIMITED'):'NOT_REQUESTED'},gaps:['Search results and publisher accessibility vary by region and time','Social/community content is unverified and not representative','No private registry, classified feed or guaranteed real-time telemetry is included']}};
}
export function runSpecialistAssessment(role,{observations=[],macroIndicators=[],tradeFlows=[],assumptions=[],scenarios=[],forecasts=[]}={}){
 const key=String(role||'').toUpperCase(),runner=ROLE_RUNNERS[key];if(!runner)throw new Error('Unknown specialist role.');
 const rows=aSafe(observations),events=rows.map(x=>({id:x.id,title:x.title,text:x.text,url:x.url,source:x.source,sourceDomain:x.sourceDomain,publishedAt:x.publishedAt,eventAt:x.publishedAt,type:x.eventType,eventType:x.eventType,status:x.evidenceType==='OFFICIAL_STATEMENT'?'UNVERIFIED':'UNVERIFIED',assessment:x.assessment,confidence:'LOW'}));
 if(key==='DEFENCE_IW')return runner({signals:rows.map(x=>({id:x.id,domain:x.eventType,claim:x.title,source:x.source,url:x.url,publishedAt:x.publishedAt,independenceGroup:x.sourceDomain||x.source,evidenceType:x.kind==='SOCIAL'?'SOCIAL_POST':'MEDIA_REPORT'})),claims:rows.slice(0,80).map(x=>({id:x.id,claim:x.title,status:'UNASSESSED',evidenceFor:[x],evidenceAgainst:[],alternatives:[],confidence:'LOW'}))});
 if(key==='CORPORATE_RISK')return runner({entities:[],events,filings:[],identityCandidates:[],sanctions:rows.filter(x=>/sanction/i.test(x.title)),litigation:rows.filter(x=>/litigation|court|lawsuit/i.test(x.title)),ownership:[]});
 if(key==='SUPPLY_CHAIN')return runner({suppliers:[],tradeFlows,events,disruptions:rows.filter(x=>/disrupt|closure|strike|blockade|delay/i.test(x.title)),routes:[],});
 if(key==='GEOPOLITICAL')return runner({events,actors:[],indicators:[],claims:rows.slice(0,100).map(x=>({claim:x.title,status:'UNVERIFIED',counterEvidence:[],url:x.url,source:x.source}))});
 return runner({drivers:assumptions,scenarios,indicators:[],forecasts,macroIndicators});
}
function aSafe(v){return Array.isArray(v)?v.slice(0,1000):[];}
export function mergeSpecialistWorkspace(existing={},incoming={}){
 const map=new Map();
 for(const x of [...aSafe(existing.observations),...aSafe(incoming.observations)])map.set(x.id,x);
 const observations=[...map.values()].sort((x,y)=>(Number(y.capturedAt)||0)-(Number(x.capturedAt)||0)).slice(0,1000);
 return {observations,macroIndicators:incoming.macroIndicators?.length?incoming.macroIndicators:(existing.macroIndicators||[]),tradeFlows:incoming.tradeFlows?.length?incoming.tradeFlows:(existing.tradeFlows||[]),collectionHistory:[...(existing.collectionHistory||[]),incoming.collection].filter(Boolean).slice(-100),assessments:existing.assessments||[],monitorEnabled:existing.monitorEnabled===true,updatedAt:Date.now()};
}
