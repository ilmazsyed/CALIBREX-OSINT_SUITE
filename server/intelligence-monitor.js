// Persistent, case-scoped monitoring helpers. Alerts are leads for analyst review.
export const ALERT_STATES = ['NEW','ACKNOWLEDGED','INVESTIGATING','DISMISSED','CLOSED'];
export function validateMonitorAlert(input={}) {
  const status=ALERT_STATES.includes(input.status)?input.status:'NEW';
  return {
    id:String(input.id||'').slice(0,120),
    searchId:String(input.searchId||'').slice(0,80),
    title:String(input.title||'').slice(0,300),
    url:String(input.url||'').slice(0,2000),
    source:String(input.source||'').slice(0,160),
    published:Number(input.published)||null,
    firstSeenAt:Number(input.firstSeenAt)||Date.now(),
    lastSeenAt:Number(input.lastSeenAt)||Date.now(),
    status,
    matchedQuery:String(input.matchedQuery||'').slice(0,300),
    rationale:String(input.rationale||'').slice(0,500),
    feedback:ALERT_FEEDBACK.includes(input.feedback)?input.feedback:null,feedbackAt:Number(input.feedbackAt)||null,
    feedbackHistory:Array.isArray(input.feedbackHistory)?input.feedbackHistory.slice(-30).map(x=>({feedback:ALERT_FEEDBACK.includes(x.feedback)?x.feedback:'NO_ACTION',at:Number(x.at)||Date.now(),by:String(x.by||'').slice(0,120),note:String(x.note||'').slice(0,500)})):[],
    outcome:ALERT_OUTCOMES.includes(input.outcome)?input.outcome:null,outcomeAt:Number(input.outcomeAt)||null,
    outcomeHistory:Array.isArray(input.outcomeHistory)?input.outcomeHistory.slice(-30).map(x=>({outcome:ALERT_OUTCOMES.includes(x.outcome)?x.outcome:'UNRESOLVED',at:Number(x.at)||Date.now(),by:String(x.by||'').slice(0,120),note:String(x.note||'').slice(0,500)})):[],
    history:Array.isArray(input.history)?input.history.slice(-20).map(x=>({status:ALERT_STATES.includes(x.status)?x.status:'NEW',at:Number(x.at)||Date.now(),by:String(x.by||'').slice(0,120),note:String(x.note||'').slice(0,500)})):[ ]
  };
}
export function mergeMonitorAlerts(existing=[], incoming=[], now=Date.now()) {
  const map=new Map((existing||[]).map(x=>[String(x.id),validateMonitorAlert(x)]));
  let created=0, refreshed=0;
  for(const raw of incoming||[]){
    const item=validateMonitorAlert({...raw,firstSeenAt:now,lastSeenAt:now});
    if(!item.id)continue;
    const old=map.get(item.id);
    if(old){map.set(item.id,{...old,lastSeenAt:now,title:item.title||old.title,url:item.url||old.url,source:item.source||old.source,published:item.published||old.published});refreshed++;}
    else {map.set(item.id,item);created++;}
  }
  return {alerts:[...map.values()].sort((a,b)=>b.lastSeenAt-a.lastSeenAt).slice(0,1000),created,refreshed};
}
export function transitionMonitorAlert(alert, status, actor, note='') {
  if(!ALERT_STATES.includes(status))throw new Error('Invalid alert state.');
  const current=validateMonitorAlert(alert);
  if(['CLOSED','DISMISSED'].includes(current.status)&&status!==current.status)throw new Error('Closed or dismissed alerts must be reopened explicitly by an administrator.');
  const history=[...(current.history||[]),{status,at:Date.now(),by:String(actor||'').slice(0,120),note:String(note||'').slice(0,500)}].slice(-20);
  return {...current,status,history};
}

export const ALERT_FEEDBACK = ['USEFUL','NOT_USEFUL','DUPLICATE','NO_ACTION'];
export function recordMonitorAlertFeedback(alert, feedback, actor, note='') {
  if(!ALERT_FEEDBACK.includes(feedback)) throw new Error('Invalid alert feedback.');
  const current=validateMonitorAlert(alert);
  const history=[...(current.feedbackHistory||[]),{feedback,at:Date.now(),by:String(actor||'').slice(0,120),note:String(note||'').slice(0,500)}].slice(-30);
  return {...current,feedback,feedbackAt:Date.now(),feedbackHistory:history};
}
export function summariseMonitorAlertFeedback(alerts=[]) {
  const counts={USEFUL:0,NOT_USEFUL:0,DUPLICATE:0,NO_ACTION:0};
  for(const alert of alerts||[]) if(counts[alert.feedback]!==undefined)counts[alert.feedback]++;
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  const outcomes={RELEVANT_TO_CASE:0,NOT_RELEVANT_TO_CASE:0,DUPLICATE_OF_EXISTING:0,UNRESOLVED:0};
  const states={NEW:0,ACKNOWLEDGED:0,INVESTIGATING:0,DISMISSED:0,CLOSED:0};
  for(const alert of alerts||[]){if(outcomes[alert.outcome]!==undefined)outcomes[alert.outcome]++;if(states[alert.status]!==undefined)states[alert.status]++;}
  return {total,counts,outcomes,states,usefulRate:total?Number((counts.USEFUL/total).toFixed(3)):null,
    note:'Analyst feedback and case relevance outcomes measure workflow usefulness and analyst disposition, not factual truth or source credibility.'};
}

export const ALERT_OUTCOMES = ['RELEVANT_TO_CASE','NOT_RELEVANT_TO_CASE','DUPLICATE_OF_EXISTING','UNRESOLVED'];
export function recordMonitorAlertOutcome(alert, outcome, actor, note='') {
  if(!ALERT_OUTCOMES.includes(outcome)) throw new Error('Invalid investigation outcome.');
  const current=validateMonitorAlert(alert);
  const history=[...(current.outcomeHistory||[]),{outcome,at:Date.now(),by:String(actor||'').slice(0,120),note:String(note||'').slice(0,500)}].slice(-30);
  return {...current,outcome,outcomeAt:Date.now(),outcomeHistory:history};
}
