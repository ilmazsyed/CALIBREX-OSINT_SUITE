// Structured intelligence assessment primitives. Scores measure workflow completeness,
// never the probability that a claim is true. Analyst judgement remains explicit.
import crypto from 'node:crypto';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const list=(v,max)=>Array.isArray(v)?v.slice(0,max):[];
const text=(v,max=2000)=>String(v??'').trim().slice(0,max);
const ROLES=['DEFENCE_IW','CORPORATE_RISK','SUPPLY_CHAIN','GEOPOLITICAL','STRATEGIC'];
export const ROLE_PROFILES={
 DEFENCE_IW:{label:'Defence Intelligence / Information Environment',domains:['force posture','military activity','information environment','cyber','maritime and air activity'],indicators:['exercise or mobilisation activity','force posture change','air or maritime anomaly','official warning or advisory','narrative velocity change']},
 CORPORATE_RISK:{label:'Corporate Intelligence / Risk',domains:['counterparty','ownership and control','sanctions and regulation','litigation and insolvency','cyber and operational exposure'],indicators:['sanctions or regulatory action','director or ownership change','adverse media escalation','insolvency or credit stress','supplier control failure']},
 SUPPLY_CHAIN:{label:'Logistics / Supply Chain Risk',domains:['supplier dependency','port and route disruption','geopolitical exposure','weather and hazards','commodity and freight exposure'],indicators:['port or terminal closure','chokepoint disruption','supplier concentration increase','freight or commodity shock','weather or hazard warning']},
 GEOPOLITICAL:{label:'Geopolitical Intelligence',domains:['state and non-state actors','diplomacy and alignment','security escalation','political stability','economic statecraft'],indicators:['military posture change','diplomatic rupture','sanctions or export control change','leadership or election transition','protest or instability escalation']},
 STRATEGIC:{label:'Strategic Intelligence / Foresight',domains:['structural trends','strategic dependencies','policy and regulation','technology and markets','scenarios and warning'],indicators:['leading indicator threshold crossed','strategic dependency concentration','policy inflection','technology adoption acceleration','scenario trigger observed']}
};
const ID=()=> 'asmt_'+crypto.randomUUID();
function evidenceIds(v,allowed){return list(v,100).map(String).filter(id=>allowed.has(id));}
export function validateStructuredAssessment(input={}, evidence=[]) {
 const allowed=new Set(list(evidence,300).map(e=>String(e?.id||'')).filter(Boolean));
 const role=ROLES.includes(input.role)?input.role:'GEOPOLITICAL';
 const judgements=list(input.keyJudgements,30).map(j=>({
  id:text(j.id,100)||ID(),title:text(j.title,180),statement:text(j.statement,3000),
  confidence:clamp(Number(j.confidence)||0,0,100),
  confidenceLevel:(Number(j.confidence)>=80?'HIGH':Number(j.confidence)>=55?'MODERATE':Number(j.confidence)>=30?'LOW':'VERY_LOW'),
  status:['CURRENT','SUPERSEDED','WITHDRAWN'].includes(j.status)?j.status:'CURRENT',
  evidenceForIds:evidenceIds(j.evidenceForIds,allowed),evidenceAgainstIds:evidenceIds(j.evidenceAgainstIds,allowed),
  assumptions:list(j.assumptions,20).map(x=>text(x,500)).filter(Boolean),
  implications:text(j.implications,2000),reviewedAt:Number(j.reviewedAt)||Date.now(),
  reviewDueAt:Number(j.reviewDueAt)||null
 })).filter(j=>j.title&&j.statement);
 const assumptions=list(input.assumptions,50).map(x=>text(x,700)).filter(Boolean);
 const alternatives=list(input.alternativeHypotheses,20).map(a=>({
  id:text(a.id,100)||ID(),title:text(a.title,180),explanation:text(a.explanation,2000),
  confidence:clamp(Number(a.confidence)||0,0,100),evidenceForIds:evidenceIds(a.evidenceForIds,allowed),
  evidenceAgainstIds:evidenceIds(a.evidenceAgainstIds,allowed),status:['LIVE','TESTED','REJECTED'].includes(a.status)?a.status:'LIVE'
 })).filter(a=>a.title&&a.explanation);
 const indicators=list(input.indicators,100).map(i=>{
  const operator=['GT','GTE','LT','LTE','EQ','CHANGED'].includes(i.operator)?i.operator:'GT';
  const threshold=i.threshold===null||i.threshold===undefined||i.threshold===''?null:(Number.isFinite(Number(i.threshold))?Number(i.threshold):null);
  const observed=i.observed===null||i.observed===undefined||i.observed===''?null:(Number.isFinite(Number(i.observed))?Number(i.observed):null);
  let triggered=false;
  if(operator==='GT')triggered=threshold!==null&&observed!==null&&observed>threshold;
  if(operator==='GTE')triggered=threshold!==null&&observed!==null&&observed>=threshold;
  if(operator==='LT')triggered=threshold!==null&&observed!==null&&observed<threshold;
  if(operator==='LTE')triggered=threshold!==null&&observed!==null&&observed<=threshold;
  if(operator==='EQ')triggered=threshold!==null&&observed!==null&&observed===threshold;
  if(operator==='CHANGED')triggered=i.changed===true;
  return {id:text(i.id,100)||ID(),name:text(i.name,180),category:text(i.category,80)||'GENERAL',
   baseline:text(i.baseline,500),operator,threshold,observed,unit:text(i.unit,40),
   status:triggered?'TRIGGERED':(['WATCH','NOT_TRIGGERED','UNASSESSED'].includes(i.status)?i.status:'UNASSESSED'),
   rationale:text(i.rationale,1000),sourceEvidenceIds:evidenceIds(i.sourceEvidenceIds,allowed),
   lastCheckedAt:Number(i.lastCheckedAt)||null,owner:text(i.owner,120)};
 }).filter(i=>i.name);
 const scenarios=list(input.scenarios,20).map(s=>({
  id:text(s.id,100)||ID(),title:text(s.title,180),description:text(s.description,2500),
  likelihood:['LOW','MEDIUM','HIGH','VERY_HIGH','UNASSESSED'].includes(s.likelihood)?s.likelihood:'UNASSESSED',
  impact:['LOW','MEDIUM','HIGH','SEVERE','UNASSESSED'].includes(s.impact)?s.impact:'UNASSESSED',
  triggers:list(s.triggers,20).map(x=>text(x,400)).filter(Boolean),
  indicators:list(s.indicators,30).map(String).filter(id=>indicators.some(i=>i.id===id)),
  assumptions:list(s.assumptions,20).map(x=>text(x,400)).filter(Boolean),
  responseOptions:list(s.responseOptions,20).map(x=>text(x,500)).filter(Boolean)
 })).filter(s=>s.title&&s.description);
 return {role,keyJudgements:judgements,assumptions,alternativeHypotheses:alternatives,indicators,scenarios,
  updatedAt:Number(input.updatedAt)||Date.now(),reviewCycleDays:clamp(Number(input.reviewCycleDays)||30,1,365)};
}

// Completeness score: tells a supervisor whether an assessment is well-formed.
// It is deliberately not a confidence, accuracy, threat, or truth score.
export function assessAssessmentQuality(assessment={}, evidence=[]) {
 const a=validateStructuredAssessment(assessment,evidence);
 const ev=list(evidence,300);
 const domains=new Set(ev.map(e=>{try{return new URL(e.url).hostname.replace(/^www\\./,'');}catch{return '';}}).filter(Boolean));
 const verifiedGroups=new Set(ev.filter(e=>e.sourceIndependence==='INDEPENDENT_VERIFIED').map(e=>String(e.ownershipGroup||e.syndicationGroup||e.url||e.id)).filter(Boolean));
 const idCoverage=ev.length?ev.filter(e=>String(e.id||'').trim()).length/ev.length:0;
 const recordHashCoverage=ev.length?ev.filter(e=>/^[a-f0-9]{64}$/i.test(String(e.recordSha256||''))).length/ev.length:0;
 const sourceSnapshotCoverage=ev.length?ev.filter(e=>e.contentSnapshot&&/^[a-f0-9]{64}$/i.test(String(e.sha256||''))).length/ev.length:0;
 const dimensions={
  keyJudgements:a.keyJudgements.length?100:0,
  evidenceLinkage:a.keyJudgements.length?Math.round(a.keyJudgements.reduce((n,j)=>n+(j.evidenceForIds.length+j.evidenceAgainstIds.length>0?1:0),0)/a.keyJudgements.length*100):0,
  alternativeAnalysis:a.alternativeHypotheses.length?100:0,
  assumptions:a.assumptions.length?100:0,
  indicators:a.indicators.length?100:0,
  scenarioCoverage:a.scenarios.length?100:0,
  sourceDiversity:Math.min(100,verifiedGroups.size*25),
  evidenceBase:Math.min(100,ev.length*20),
  evidenceIdentity:Math.round(idCoverage*100),
  recordIntegrity:Math.round(recordHashCoverage*100),
  sourceCapture:Math.round(sourceSnapshotCoverage*100)
 };
 const score=Math.round(Object.values(dimensions).reduce((x,y)=>x+y,0)/Object.keys(dimensions).length);
 return {score,dimensions,label:score>=85?'WELL_STRUCTURED':score>=65?'DEVELOPING':score>=40?'PARTIAL':'INCOMPLETE',
  caveats:['Completeness is not analytical accuracy or probability of truth.','Publisher-domain count is descriptive only; source diversity credits only analyst-verified independent source groups.','Record hashes prove stored-record integrity; only contentSnapshot hashes fingerprint captured source text.','Claims and facts require analyst validation.'],
  evidenceCount:ev.length,distinctPublisherDomains:domains.size,verifiedIndependentSourceGroups:verifiedGroups.size,claimCount:ev.filter(e=>e.assessment==='CLAIM').length,
  missing:Object.entries(dimensions).filter(([,v])=>v<100).map(([k])=>k)};
}

export function roleAssessmentChecklist(role) {
 const key=ROLES.includes(role)?role:'GEOPOLITICAL';
 const profile=ROLE_PROFILES[key];
 return {role:key,...profile,workflow:['Define the decision or warning question','Record source-linked observations','Separate fact, claim, assessment, hypothesis and unknown','Compare independent sources and record contradictions','Write key judgements with confidence and evidence for/against','Test alternative hypotheses and assumptions','Monitor indicators and review triggers','Record implications, options and review date']};
}
