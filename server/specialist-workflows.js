// Five-role analyst workflow contracts. These define structured questions and
// validation gates; they do not claim source coverage or analyst performance.
export const ROLE_WORKFLOWS = {
 DEFENCE_IW: {
  target:8.5, priority:'PRIMARY',
  workflow:['Strategic question and time horizon','Collection plan and source register','Claim decomposition','Source independence and corroboration','Capability / posture / exercise / information-environment assessment','Alternative explanations and deception checks','Indicators and warning thresholds','Key judgements with confidence','Implications and review triggers'],
  requiredOutputs:['key_judgements','evidence_for','evidence_against','alternative_hypotheses','indicators','source_quality','review_date'],
  qualityGates:['No intent judgement from a single indicator','Separate announcement, contract, delivery and operational availability','Deduplicate syndicated reporting','Distinguish source confidence from judgement confidence','Record gaps and collection bias','No tactical targeting or classified claims']
 },
 CORPORATE_RISK: {
  target:8.5, priority:'STANDARD',
  workflow:['Entity identity and jurisdiction','Corporate filings and control disclosures','Director / shareholder relationship graph','Litigation, regulatory and sanctions screening','Adverse media chronology','Counterparty and supply exposure','Contradiction and identity-resolution review','Risk judgement and monitoring triggers'],
  requiredOutputs:['entity_identifiers','filing_timeline','relationship_candidates','adverse_events','contradictions','risk_judgement','monitoring_triggers'],
  qualityGates:['No name-only identity match treated as confirmed','Separate directorship from beneficial ownership','Preserve filing date and source jurisdiction','Flag paid / unavailable registries','Record exculpatory evidence']
 },
 SUPPLY_CHAIN: {
  target:8.5, priority:'STANDARD',
  workflow:['Commodity and dependency definition','Supplier / buyer / facility mapping','Trade-flow baseline and reporting lag','Port / route / chokepoint exposure','Weather, conflict and regulatory disruption','Alternative sourcing and concentration','Lead-time and price transmission','Disruption scenarios and indicators'],
  requiredOutputs:['dependency_map','trade_baseline','route_exposure','supplier_concentration','disruption_events','scenario_impacts','indicators'],
  qualityGates:['Do not present aggregate trade data as shipment tracking','Label AIS coverage and latency','Separate scheduled, observed and inferred movement','Record single-source dependencies','Quantify uncertainty and reporting lag']
 },
 GEOPOLITICAL: {
  target:8.5, priority:'STANDARD',
  workflow:['Question, actors and geography','Event chronology and source provenance','Actor / institution relationship map','Conflict, diplomatic and policy signal fusion','Domestic political and economic context','Competing explanations','Escalation / de-escalation indicators','Scenario and implication assessment'],
  requiredOutputs:['actor_map','event_chronology','key_judgements','competing_explanations','indicators','scenarios'],
  qualityGates:['Do not infer causality from temporal correlation','Preserve event revisions and disputed claims','Separate official statements from independent reporting','Record geographic and temporal uncertainty']
 },
 STRATEGIC: {
  target:8.5, priority:'STANDARD',
  workflow:['Decision and forecast question','Baseline and structural drivers','Leading / coincident / lagging indicators','Dependencies and second-order effects','Alternative scenarios','Probability and confidence rationale','Warning indicators and signposts','Forecast archive and outcome review'],
  requiredOutputs:['baseline','drivers','scenarios','probabilities','signposts','forecast_archive','outcome_review'],
  qualityGates:['Every forecast has a horizon and timestamp','Probability is explicit and calibrated','Do not score unresolved outcomes','Preserve forecast revisions','Separate scenario plausibility from likelihood']
 }
};

export function validateRoleAssessment(role, assessment={}) {
 const spec=ROLE_WORKFLOWS[role];
 if(!spec) throw new Error('Unknown analyst role.');
 const outputs=spec.requiredOutputs;
 const missing=outputs.filter(k=>!(k in assessment)||assessment[k]===null||assessment[k]==='');
 const judgements=Array.isArray(assessment.key_judgements)?assessment.key_judgements:[];
 const judgementIssues=judgements.flatMap((j,i)=>{
  const issues=[];
  if(!String(j.judgement||'').trim())issues.push('judgement_text_missing');
  if(!['LOW','MEDIUM','HIGH'].includes(j.confidence))issues.push('confidence_missing');
  if(!Array.isArray(j.evidenceIds))issues.push('evidence_ids_missing');
  if(!Array.isArray(j.alternatives))issues.push('alternatives_missing');
  return issues.map(issue=>({index:i,issue}));
 });
 const completeness=outputs.length?Math.round((outputs.length-missing.length)/outputs.length*100):0;
 return {role,target:spec.target,priority:spec.priority,completenessPercent:completeness,
  status:missing.length||judgementIssues.length?'INCOMPLETE_REQUIRES_REVIEW':'STRUCTURALLY_COMPLETE_REQUIRES_ANALYST_REVIEW',
  missingOutputs:missing,judgementIssues,workflow:spec.workflow,qualityGates:spec.qualityGates,
  note:'Completeness measures presence of required fields only. It does not measure truth, accuracy, source reliability or forecast skill.'};
}
