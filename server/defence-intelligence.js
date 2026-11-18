// Defence & Information Warfare analytic layer.
// Open-source, strategic-level analysis only. It does not identify targets,
// recommend force employment, infer intent from a single signal, or claim classified coverage.
import crypto from 'node:crypto';

const list=(v,n=500)=>Array.isArray(v)?v.slice(0,n):[];
const text=(v,n=1200)=>String(v??'').trim().slice(0,n);
const number=v=>Number.isFinite(Number(v))?Number(v):null;
const unique=v=>[...new Set(v.filter(Boolean))];
const digest=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const dateValue=v=>{const n=typeof v==='number'?v:Date.parse(v);return Number.isFinite(n)?n:null;};

export const DEFENCE_SOURCE_REGISTER=[
 {id:'mod-press',name:'India Ministry of Defence / PIB releases',url:'https://pib.gov.in/',type:'OFFICIAL_STATEMENT',access:'PUBLIC',cadence:'AS_PUBLISHED',use:'Official policy, procurement, exercise and deployment announcements',caveat:'Official statements are attributable claims, not independent verification.'},
 {id:'indian-navy',name:'Indian Navy',url:'https://indiannavy.nic.in/',type:'OFFICIAL_STATEMENT',access:'PUBLIC',cadence:'AS_PUBLISHED',use:'Navy statements, exercises and maritime advisories',caveat:'Not a comprehensive operational activity feed.'},
 {id:'indian-airforce',name:'Indian Air Force',url:'https://indianairforce.nic.in/',type:'OFFICIAL_STATEMENT',access:'PUBLIC',cadence:'AS_PUBLISHED',use:'Official air-force releases and institutional information',caveat:'No live aircraft telemetry.'},
 {id:'sipri-milex',name:'SIPRI Military Expenditure',url:'https://www.sipri.org/databases/milex',type:'RESEARCH_DATASET',access:'PUBLIC_DOWNLOAD',cadence:'ANNUAL',use:'Long-run expenditure trends',caveat:'Review licensing before commercial redistribution.'},
 {id:'sipri-arms',name:'SIPRI Arms Transfers',url:'https://www.sipri.org/databases/armstransfers',type:'RESEARCH_DATASET',access:'PUBLIC_DOWNLOAD',cadence:'PER_RELEASE',use:'Major conventional arms transfer trends',caveat:'Not a real-time delivery tracker; review licensing.'},
 {id:'un-register',name:'UN Register of Conventional Arms',url:'https://www.un.org/disarmament/convarms/register/',type:'OFFICIAL_DATASET',access:'PUBLIC',cadence:'ANNUAL',use:'State-reported arms transfer information',caveat:'Reporting coverage and timing vary by state.'},
 {id:'iaea',name:'IAEA News Centre',url:'https://www.iaea.org/newscenter',type:'OFFICIAL_STATEMENT',access:'PUBLIC',cadence:'AS_PUBLISHED',use:'Nuclear safety, safeguards and official updates',caveat:'Use original IAEA material and preserve exact scope.'},
 {id:'nato',name:'NATO Newsroom',url:'https://www.nato.int/cps/en/natohq/news.htm',type:'OFFICIAL_STATEMENT',access:'PUBLIC',cadence:'AS_PUBLISHED',use:'Alliance policy, exercises and official statements',caveat:'Official alliance perspective; seek independent corroboration.'},
 {id:'ukraine-mod',name:'Ukraine Ministry of Defence',url:'https://www.mil.gov.ua/en/',type:'OFFICIAL_STATEMENT',access:'PUBLIC',cadence:'AS_PUBLISHED',use:'Official statements and public releases',caveat:'Conflict claims require independent corroboration.'},
 {id:'ucdp',name:'UCDP',url:'https://ucdp.uu.se/downloads/',type:'CONFLICT_DATASET',access:'PUBLIC_DOWNLOAD',cadence:'PER_RELEASE',use:'Retrospective organised-violence event data',caveat:'Historical/revised dataset, not a live tactical picture.'},
 {id:'acled',name:'ACLED',url:'https://acleddata.com/',type:'CONFLICT_DATASET',access:'REGISTRATION_OR_TERMS',cadence:'PER_RELEASE',use:'Geocoded political violence and protest event research',caveat:'Check access, licence and permitted commercial use.'},
 {id:'gdelt',name:'GDELT',url:'https://www.gdeltproject.org/',type:'MEDIA_MONITORING',access:'PUBLIC',cadence:'NEAR_REAL_TIME',use:'Global media event and narrative discovery',caveat:'Media volume is not event truth; duplicate syndication is common.'}
];

const DOMAINS={
 POSTURE:{label:'Force posture & readiness signals',fields:['official_exercise_notice','public_deployment_statement','readiness_policy_change','force_structure_announcement'],guardrail:'Use public, strategic-level statements; do not infer exact readiness or tactical location.'},
 CAPABILITY:{label:'Defence capability & procurement',fields:['contract_award','arms_transfer_report','platform_induction','retirement_or_refit','industrial_capacity'],guardrail:'Separate announcement, contract, delivery, induction and operational availability.'},
 EXERCISE:{label:'Exercises & military diplomacy',fields:['exercise_announcement','participating_services_as_reported','stated_objectives','partner_participation','schedule_window'],guardrail:'An exercise is not proof of imminent hostilities.'},
 INFORMATION:{label:'Information environment & influence narratives',fields:['narrative_theme','claim_variant','amplification_velocity','cross_platform_presence','attribution_status'],guardrail:'Do not attribute coordinated behaviour or state sponsorship without strong independent evidence.'},
 NUCLEAR:{label:'Nuclear, strategic stability & arms control',fields:['official_doctrine_statement','arms_control_change','safeguards_update','strategic_dialogue','test_announcement'],guardrail:'Use authoritative statements; do not infer weapon status or intent from ambiguous imagery.'},
 CYBER:{label:'Cybersecurity & military information assurance',fields:['official_advisory','vulnerability_disclosure','incident_claim','service_impact_statement','mitigation_guidance'],guardrail:'Focus on defensive awareness and public advisories; no exploit or intrusion guidance.'}
};

function sourceKey(item){
 const explicit=text(item.sourceId||item.publisher||item.source,180).toLowerCase();
 const url=text(item.url,2048);
 let host='';try{host=new URL(url).hostname.toLowerCase().replace(/^www\\./,'')}catch{}
 return explicit||host||'unknown';
}
function normaliseSignal(x={}){
 const timestamp=dateValue(x.publishedAt??x.timestamp);
 const source=sourceKey(x);
 const url=text(x.url,2048);
 const claim=text(x.claim||x.title||x.summary,1600);
 const category=Object.hasOwn(DOMAINS,text(x.domain,30).toUpperCase())?text(x.domain,30).toUpperCase():'POSTURE';
 return {id:text(x.id,120)||'ds_'+digest([source,url,claim,timestamp].join('|')).slice(0,20),
  domain:category,kind:text(x.kind||'UNCLASSIFIED',80).toUpperCase(),claim,theme:text(x.theme||'',220),source,url,
  sourceType:text(x.sourceType||'UNASSESSED',60).toUpperCase(),
  publishedAt:timestamp,countryCodes:unique(list(x.countryCodes,30).map(v=>text(v,3).toUpperCase()).filter(v=>/^[A-Z]{2,3}$/.test(v))),
  evidenceType:['OFFICIAL_STATEMENT','DOCUMENT','DATASET','MEDIA_REPORT','SOCIAL_POST','IMAGE_OR_VIDEO','ANALYST_NOTE'].includes(x.evidenceType)?x.evidenceType:'ANALYST_NOTE',
  independenceGroup:text(x.independenceGroup||source,180).toLowerCase(),
  assessment:['FACT','CLAIM','ASSESSMENT','HYPOTHESIS','UNKNOWN'].includes(x.assessment)?x.assessment:'CLAIM',
  confidence:['LOW','MEDIUM','HIGH'].includes(x.confidence)?x.confidence:'LOW',
  capturedAt:Date.now()};
}

export function corroborateDefenceSignals(input=[]){
 const signals=list(input,1000).map(normaliseSignal);
 const buckets=new Map();
 for(const s of signals){const k=digest([s.domain,s.kind,s.claim.toLowerCase().replace(/[^\\p{L}\\p{N} ]/gu,' ').replace(/\\s+/g,' ').slice(0,220)].join('|')).slice(0,18);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(s);}
 return [...buckets.values()].filter(g=>g.length>1).map(g=>{
  const independent=unique(g.map(x=>x.independenceGroup));
  const official=g.filter(x=>x.evidenceType==='OFFICIAL_STATEMENT').length;
  const direct=g.filter(x=>['DOCUMENT','DATASET'].includes(x.evidenceType)).length;
  const confidence=independent.length>=3&&direct>0?'HIGH':independent.length>=2?'MEDIUM':'LOW';
  return {id:'cor_'+digest(g.map(x=>x.id).sort().join('|')).slice(0,18),signalIds:g.map(x=>x.id),
   independentSourceGroups:independent.length,sourceGroups:independent,
   officialStatementCount:official,directEvidenceCount:direct,confidence,
   status:independent.length>=2?'MULTI_SOURCE_REVIEW':'SINGLE_SOURCE_OR_SYNDICATED',
   warning:'Syndicated reports count as one source group when they share an independenceGroup. Corroboration does not prove the underlying claim.'};
 });
}

export function assessDefencePosture(input={}){
 const signals=list(input.signals,1000).map(normaliseSignal);
 const windowDays=Math.max(1,Math.min(365,number(input.windowDays)||30));
 const since=Date.now()-windowDays*86400000;
 const recent=signals.filter(s=>s.publishedAt!==null&&s.publishedAt>=since);
 const corroboration=corroborateDefenceSignals(recent);
 const byDomain={};
 for(const s of recent)(byDomain[s.domain]??=[]).push(s.id);
 const countries=unique(recent.flatMap(s=>s.countryCodes));
 const official=recent.filter(s=>s.evidenceType==='OFFICIAL_STATEMENT').length;
 const direct=recent.filter(s=>['DOCUMENT','DATASET'].includes(s.evidenceType)).length;
 const independent=unique(recent.map(s=>s.independenceGroup)).length;
 const confidence=direct>0&&independent>=3?'MEDIUM':independent>=2?'LOW':'LOW';
 return {windowDays,signalCount:recent.length,countryCodes:countries,domainCoverage:Object.fromEntries(Object.entries(byDomain).map(([k,v])=>[k,v.length])),
  evidenceMix:{officialStatements:official,directDocumentsOrDatasets:direct,independentSourceGroups:independent},
  corroboration,assessmentConfidence:confidence,
  judgements:['This is a public-source activity summary, not a force-readiness assessment.','A rise in reporting volume may reflect media attention or collection changes rather than a real-world posture change.','No signal is interpreted as confirmation of intent, capability or imminence.']};
}

export function analyseInformationNarratives(input=[]){
 const rows=list(input,1000).map(normaliseSignal).filter(x=>x.domain==='INFORMATION'||x.kind.includes('NARRATIVE'));
 const themes=new Map();
 for(const s of rows){const key=text(s.theme||s.claim,220).toLowerCase();if(!key)continue;if(!themes.has(key))themes.set(key,[]);themes.get(key).push(s);}
 return [...themes.entries()].map(([theme,items])=>{
  const times=items.map(x=>x.publishedAt).filter(Boolean).sort((a,b)=>a-b);
  const sources=unique(items.map(x=>x.independenceGroup));
  return {id:'nar_'+digest(theme).slice(0,18),theme,mentionCount:items.length,independentSourceGroups:sources.length,
   firstObservedAt:times[0]||null,lastObservedAt:times.at(-1)||null,
   velocityPerDay:times.length>1?Math.round((items.length/Math.max(1,(times.at(-1)-times[0])/86400000))*100)/100:null,
   platforms:unique(items.map(x=>sourceKey(x))),signalIds:items.map(x=>x.id),
   attribution:'UNASSESSED',coordination:'UNASSESSED',
   caveat:'Frequency and cross-platform presence do not establish coordination, authenticity, reach or state attribution.'};
 }).sort((a,b)=>b.mentionCount-a.mentionCount);
}

export function evaluateDefenceIndicators(input=[]){
 return list(input,300).map(x=>{
  const observed=number(x.observed),threshold=number(x.threshold);
  const op=['GT','GTE','LT','LTE','EQ'].includes(x.operator)?x.operator:'GT';
  const valid=observed!==null&&threshold!==null;
  const triggered=valid&&(op==='GT'?observed>threshold:op==='GTE'?observed>=threshold:op==='LT'?observed<threshold:op==='LTE'?observed<=threshold:observed===threshold);
  return {id:text(x.id,100),name:text(x.name,180),status:!valid?'UNASSESSED':triggered?'TRIGGERED':'NOT_TRIGGERED',
   observed,threshold,operator:op,unit:text(x.unit,40),evidenceIds:unique(list(x.evidenceIds,100).map(v=>text(v,120))),
   reviewRequired:true,missingDataIsNotNegative:true};
 });
}

export function buildDefenceBrief(input={}){
 const signals=list(input.signals,1000).map(normaliseSignal);
 const posture=assessDefencePosture({signals,windowDays:input.windowDays});
 const narratives=analyseInformationNarratives(signals);
 const indicators=evaluateDefenceIndicators(input.indicators);
 const domains=Object.fromEntries(Object.entries(DOMAINS).map(([k,v])=>[k,{label:v.label,availableFields:v.fields,guardrail:v.guardrail,observedSignals:signals.filter(s=>s.domain===k).length}]));
 return {generatedAt:Date.now(),scope:'OPEN_SOURCE_STRATEGIC_LEVEL',domains,posture,narratives,indicators,
  sourceRegister:DEFENCE_SOURCE_REGISTER,
  limitations:['No new API credentials or paid feeds are assumed.','Catalogue entries are not proof of live ingestion.','No classified order of battle, live force telemetry or tactical targeting is provided.','All claims, source independence and judgements require analyst review.']};
}

/**
 * Analyst-directed claim/evidence reconciliation. Evidence is never classified
 * as supporting or contradicting automatically; callers must supply reviewed
 * buckets. Conflicting evidence stays explicit and is never averaged away.
 */
export function reviewClaimEvidence({claim='',supporting=[],contradicting=[],unassessed=[]}={}) {
 const rows=value=>Array.isArray(value)?value.slice(0,200):[];
 const ids=value=>[...new Set(rows(value).map(x=>String(x?.id||'').trim()).filter(Boolean))];
 const groups=value=>[...new Set(rows(value).map(x=>String(x?.independenceGroup||x?.sourceDomain||x?.source||'unknown').toLowerCase()).filter(Boolean))];
 const supportIds=ids(supporting),againstIds=ids(contradicting),unknownIds=ids(unassessed);
 const status=supportIds.length&&againstIds.length?'CONFLICTING_EVIDENCE_REQUIRES_REVIEW'
  :supportIds.length?'SUPPORTING_EVIDENCE_REQUIRES_REVIEW'
  :againstIds.length?'CONTRADICTING_EVIDENCE_REQUIRES_REVIEW':'UNASSESSED';
 return {
  claim:String(claim||'').trim().slice(0,1000),status,judgement:'NOT_ADJUDICATED',
  evidence:{supportingIds:supportIds,contradictingIds:againstIds,unassessedIds:unknownIds},
  independentSourceGroups:{supporting:groups(supporting).length,contradicting:groups(contradicting).length},
  caveat:'Only analyst-reviewed evidence buckets are reflected here. This status does not establish truth, falsity, intent or source reliability.'
 };
}
