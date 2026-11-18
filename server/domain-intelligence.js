// Shared country, entity and event intelligence foundation for Release 1/2.
// Deterministic, provenance-preserving and keyless. This module never asserts identity,
// intent or truth; candidate links and warning triggers require analyst review.
import crypto from 'node:crypto';

const arr=(v,n=500)=>Array.isArray(v)?v.slice(0,n):[];
const str=(v,n=1000)=>String(v??'').trim().slice(0,n);
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const uniq=v=>[...new Set(v.filter(Boolean))];
const host=u=>{try{return new URL(u).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}};

export const DOMAIN_SOURCE_CATALOG=[
 {id:'sipri-milex',domain:'DEFENCE',name:'SIPRI Military Expenditure Database',url:'https://www.sipri.org/databases/milex',access:'PUBLIC_DOWNLOAD',credential:'NONE',cadence:'ANNUAL',coverage:'Country military expenditure time series',commercial:'Check SIPRI terms; commercial use may require a licence'},
 {id:'sipri-arms',domain:'DEFENCE',name:'SIPRI Arms Transfers Database',url:'https://www.sipri.org/databases/armstransfers',access:'PUBLIC_DOWNLOAD',credential:'NONE',cadence:'ANNUAL',coverage:'Major conventional arms transfers',commercial:'Check SIPRI terms; commercial use may require authorisation'},
 {id:'ucdp',domain:'GEOPOLITICAL',name:'UCDP datasets',url:'https://ucdp.uu.se/downloads/',access:'PUBLIC_DOWNLOAD',credential:'NONE',cadence:'PER_RELEASE',coverage:'Georeferenced organised violence and conflict events',commercial:'Review dataset licence and attribution'},
 {id:'gdelt',domain:'GEOPOLITICAL',name:'GDELT',url:'https://www.gdeltproject.org/',access:'PUBLIC_DATA',credential:'NONE',cadence:'NEAR_REAL_TIME',coverage:'Global news and event signals',commercial:'Review dataset and downstream source terms'},
 {id:'world-bank',domain:'STRATEGIC',name:'World Bank Indicators',url:'https://data.worldbank.org/',access:'PUBLIC_API',credential:'NONE',cadence:'VARIES',coverage:'Country and development indicators',commercial:'Check individual indicator metadata'},
 {id:'imf',domain:'STRATEGIC',name:'IMF Data API',url:'https://data.imf.org/en/Resource-Pages/IMF-API',access:'PUBLIC_API',credential:'NONE_OR_PORTAL',cadence:'VARIES',coverage:'Macroeconomic and financial indicators',commercial:'Check dataset-specific terms'},
 {id:'un-comtrade',domain:'SUPPLY_CHAIN',name:'UN Comtrade API',url:'https://comtradeapi.un.org/',access:'PUBLIC_API',credential:'OPTIONAL_FOR_LIMITS',cadence:'MONTHLY_OR_ANNUAL',coverage:'Reported international merchandise trade',commercial:'Check API terms and rate limits'},
 {id:'mca',domain:'CORPORATE',name:'India MCA21',url:'https://www.mca.gov.in/',access:'PUBLIC_PORTAL',credential:'PORTAL_ACCOUNT_OR_PAYMENT',cadence:'AS_FILED',coverage:'Company master data and paid document inspection',commercial:'Respect portal terms; not a bulk open beneficial-ownership feed'},
 {id:'sec-edgar',domain:'CORPORATE',name:'SEC EDGAR APIs',url:'https://www.sec.gov/search-filings/edgar-application-programming-interfaces',access:'PUBLIC_API',credential:'NONE',cadence:'NEAR_REAL_TIME',coverage:'US filings, submissions and XBRL company facts',commercial:'Follow SEC fair-access and user-agent requirements'},
 {id:'companies-house',domain:'CORPORATE',name:'UK Companies House',url:'https://find-and-update.company-information.service.gov.uk/',access:'PUBLIC_PORTAL',credential:'NONE_FOR_SEARCH',cadence:'AS_FILED',coverage:'UK company records and filings',commercial:'Check API and reuse terms'},
 {id:'dg-shipping',domain:'SUPPLY_CHAIN',name:'India DG Shipping / MMDAC',url:'https://dgma.gov.in/nautical-wing/nw-mmdac-dgcomm-center',access:'OFFICIAL_PORTAL',credential:'ACCESS_RESTRICTED_OR_UNPUBLISHED',cadence:'VARIES',coverage:'Official maritime monitoring context and advisories',commercial:'Do not assume raw live feeds are public'},
 {id:'reliefweb',domain:'GEOPOLITICAL',name:'ReliefWeb API',url:'https://api.reliefweb.int/v1/disasters',access:'PUBLIC_API',credential:'APPNAME_HEADER',cadence:'ONGOING',coverage:'Humanitarian emergencies and disaster reporting',commercial:'Follow API terms and attribution'}
];

export const SPECIALIST_PACKS={
 DEFENCE_IW:{label:'Defence & Information Environment',entities:['state','armed_force','unit_as_reported','platform','exercise','official_spokesperson','narrative_theme'],events:['exercise_announcement','procurement_or_transfer','posture_statement','air_or_maritime_observation','cyber_advisory','information_narrative_shift'],indicators:['exercise_frequency','official_alert_level','reported_platform_activity','narrative_velocity','independent_source_corroboration'],limits:['No classified order of battle or comprehensive military telemetry','Public aircraft and maritime observations are incomplete and may be delayed']},
 CORPORATE_RISK:{label:'Corporate Intelligence & Risk',entities:['company','director','shareholder_as_filed','subsidiary','regulator','court_case','facility','domain'],events:['filing_change','director_change','ownership_disclosure','sanction','regulatory_action','litigation','insolvency_notice','adverse_media'],indicators:['filing_status_change','director_or_control_change','sanctions_match_review','regulatory_action_count','adverse_media_acceleration'],limits:['Public filings do not establish ultimate beneficial ownership in every jurisdiction','Name matches are candidates, not verified identity']},
 SUPPLY_CHAIN:{label:'Logistics & Supply Chain',entities:['supplier','buyer','port','terminal','vessel','route','commodity','facility','chokepoint'],events:['port_advisory','route_disruption','weather_hazard','trade_flow_change','supplier_notice','freight_shock'],indicators:['port_closure_duration','route_risk_change','trade_flow_deviation','supplier_concentration','commodity_price_change'],limits:['No guaranteed live AIS, shipment tracking, freight or private supplier data','Trade statistics are lagged and reported at aggregate levels']},
 GEOPOLITICAL:{label:'Geopolitical Intelligence',entities:['state','government','political_actor','armed_group_as_reported','international_organisation','treaty','sanctions_regime'],events:['conflict_event','diplomatic_statement','sanctions_change','election_transition','protest_or_unrest','policy_change','disaster'],indicators:['conflict_event_rate','diplomatic_signal_change','sanctions_scope_change','protest_frequency','leadership_transition'],limits:['Event datasets may be delayed, incomplete or revised','Event correlation is not proof of causation']},
 STRATEGIC:{label:'Strategic Intelligence & Foresight',entities:['country','sector','technology','commodity','policy','market','dependency'],events:['macro_release','trade_dependency_shift','regulatory_inflection','technology_adoption','demographic_change','market_structure_change'],indicators:['growth_inflation_deviation','trade_concentration','dependency_index','policy_lead_indicator','technology_adoption_rate'],limits:['Scenarios are conditional futures, not predictions','Forecast quality requires archived forecasts and outcome scoring']}
};

export function normaliseObservation(input={}, opts={}) {
 const url=str(input.url,2048), published=num(input.publishedAt??input.published);
 const captured=num(input.capturedAt)||Date.now();
 const source=str(input.source||input.publisher||host(url),180);
 const content=str(input.text||input.summary||input.title,8000);
 const id=str(input.id,120)||'obs_'+hash([url,source,published,content].join('|')).slice(0,24);
 return {id,source,sourceDomain:host(url),url,kind:str(input.kind||'report',40).toUpperCase(),
  title:str(input.title,500),text:content,publishedAt:published,capturedAt:captured,
  countryCodes:uniq(arr(input.countryCodes,50).map(x=>str(x,3).toUpperCase()).filter(x=>/^[A-Z]{2,3}$/.test(x))),
  entityRefs:uniq(arr(input.entityRefs,100).map(x=>str(x,120))),
  eventType:str(input.eventType||'UNCLASSIFIED',80).toUpperCase(),
  assessment:['FACT','CLAIM','ASSESSMENT','HYPOTHESIS','UNKNOWN'].includes(input.assessment)?input.assessment:'CLAIM',
  licence:str(input.licence||opts.defaultLicence||'UNSPECIFIED',120),
  provenance:{provider:str(input.provider||source,180),retrievedAt:captured,originalUrl:url,contentHash:hash(content)}
 };
}

export function buildCountryProfile(code, observations=[], indicators=[]) {
 const country=str(code,3).toUpperCase();
 if(!/^[A-Z]{2,3}$/.test(country)) throw new Error('Country code must be ISO-like alpha-2 or alpha-3.');
 const obs=arr(observations).filter(x=>arr(x.countryCodes).includes(country));
 const rows=arr(indicators).filter(x=>str(x.countryCode,3).toUpperCase()===country);
 const byDomain={};
 for(const x of obs){const d=str(x.domain||x.category||'GENERAL',60).toUpperCase();(byDomain[d]??=[]).push(x.id);}
 return {countryCode:country,observationCount:obs.length,indicatorCount:rows.length,
  latestObservationAt:obs.reduce((m,x)=>Math.max(m,num(x.publishedAt)||num(x.capturedAt)||0),0)||null,
  sourceDomains:Object.keys(byDomain).sort(),evidenceByDomain:byDomain,
  indicators:rows.map(x=>({id:x.id,name:x.name,value:num(x.value),unit:str(x.unit,40),period:str(x.period,40),source:str(x.source,180)})),
  caveats:['Country profile is bounded by supplied observations and indicator coverage.','Absence of a record is not evidence that an event did not occur.']};
}

function tokens(v){return new Set((str(v,2000).toLowerCase().replace(/\b(ltd|limited|inc|incorporated|corp|corporation|company|co|plc|llc|llp)\b/g,' ').match(/[\p{L}\p{N}]{3,}/gu)||[]));}
function jaccard(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let n=0;for(const t of A)if(B.has(t))n++;return n/(A.size+B.size-n);}
export function resolveEntityCandidates(entities=[], threshold=0.72) {
 const xs=arr(entities,1000), out=[];
 for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++){
  const a=xs[i],b=xs[j]; if(str(a.type,40)!==str(b.type,40))continue;
  const na=str(a.name,300),nb=str(b.name,300);
  const score=jaccard(na,nb);
  const sameId=Boolean(a.externalId&&b.externalId&&a.externalId===b.externalId);
  const sameDomain=Boolean(a.domain&&b.domain&&str(a.domain,200).toLowerCase()===str(b.domain,200).toLowerCase());
  if(sameId||sameDomain||score>=threshold)out.push({id:'link_'+hash([a.id,b.id].sort().join('|')).slice(0,20),leftId:str(a.id,120),rightId:str(b.id,120),score:sameId?1:sameDomain?0.99:score,reason:sameId?'SAME_EXTERNAL_ID':sameDomain?'SAME_DOMAIN':'NAME_SIMILARITY',status:'CANDIDATE_REQUIRES_HUMAN_REVIEW',autoMerged:false});
 }
 return out;
}

export function clusterEventCandidates(observations=[], threshold=0.35) {
 const xs=arr(observations,1000).filter(x=>str(x.title||x.text,30));
 const groups=[];
 for(const item of xs){const textValue=item.title||item.text;let group=groups.find(g=>g.some(x=>jaccard(x.title||x.text,textValue)>=threshold));if(!group)groups.push(group=[]);group.push(item);}
 return groups.filter(g=>g.length>1).map(g=>({id:'event_'+hash(g.map(x=>x.id).sort().join('|')).slice(0,20),
  status:'CANDIDATE_REQUIRES_REVIEW',observationIds:g.map(x=>x.id),sourceDomains:uniq(g.map(x=>x.sourceDomain||host(x.url))),count:g.length,
  firstSeen:Math.min(...g.map(x=>num(x.publishedAt)||num(x.capturedAt)||Date.now())),
  lastSeen:Math.max(...g.map(x=>num(x.publishedAt)||num(x.capturedAt)||Date.now())),
  caveat:'Text similarity suggests a review cluster; verify event identity, chronology, geography and source independence.'}));
}

export function evaluateWarningIndicator(indicator={}) {
 const op=['GT','GTE','LT','LTE','EQ','CHANGED'].includes(indicator.operator)?indicator.operator:'GT';
 const threshold=num(indicator.threshold), observed=num(indicator.observed);
 let triggered=false, assessed=false;
 if(op==='CHANGED'){assessed=typeof indicator.changed==='boolean';triggered=indicator.changed===true;}
 else if(threshold!==null&&observed!==null){assessed=true;triggered=op==='GT'?observed>threshold:op==='GTE'?observed>=threshold:op==='LT'?observed<threshold:op==='LTE'?observed<=threshold:observed===threshold;}
 return {id:str(indicator.id,100),name:str(indicator.name,180),status:!assessed?'UNASSESSED':triggered?'TRIGGERED':'NOT_TRIGGERED',
  threshold,observed,operator:op,unit:str(indicator.unit,40),sourceEvidenceIds:uniq(arr(indicator.sourceEvidenceIds,100).map(x=>str(x,120))),
  checkedAt:Date.now(),note:!assessed?'No observed value; do not infer absence.':triggered?'Threshold condition met; analyst review required.':'Threshold condition not met.'};
}

export function createForecastRecord(input={}) {
 const question=str(input.question,1000);if(question.length<8)throw new Error('Forecast question is required.');
 const horizon=num(input.horizonAt);if(!horizon||horizon<=Date.now())throw new Error('Forecast horizon must be in the future.');
 const probability=num(input.probability);
 if(probability===null||probability<0||probability>100)throw new Error('Probability must be between 0 and 100.');
 return {id:'fc_'+crypto.randomUUID(),question,forecastAt:Date.now(),horizonAt:horizon,probability,
  confidenceBand:['LOW','MEDIUM','HIGH'].includes(input.confidenceBand)?input.confidenceBand:'MEDIUM',
  rationale:str(input.rationale,3000),indicators:arr(input.indicators,50).map(x=>str(x,300)),
  status:'OPEN',outcome:null,scoredAt:null,
  note:'Analyst probability is recorded as supplied; this record does not validate the forecast.'};
}
export function scoreForecastOutcome(forecast={}, outcome={}) {
 const observed=['YES','NO','PARTIAL','UNRESOLVED'].includes(outcome.result)?outcome.result:'UNRESOLVED';
 const p=num(forecast.probability);
 const brier=observed==='YES'&&p!==null?(p/100-1)**2:observed==='NO'&&p!==null?(p/100)**2:null;
 return {...forecast,status:observed==='UNRESOLVED'?'UNRESOLVED':'SCORED',
  outcome:{result:observed,notes:str(outcome.notes,2000),recordedAt:Date.now()},
  brierScore:brier,scoredAt:Date.now(),
  note:'Brier score is available only for resolved binary YES/NO outcomes; PARTIAL and UNRESOLVED are not forced into binary scores.'};
}
