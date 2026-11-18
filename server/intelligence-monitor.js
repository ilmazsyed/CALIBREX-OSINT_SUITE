// Persistent, case-scoped monitoring helpers. Alerts are leads for analyst review.
export const ALERT_STATES = ['NEW','ACKNOWLEDGED','INVESTIGATING','CLOSED'];
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
    history:Array.isArray(input.history)?input.history.slice(-20).map(x=>({status:ALERT_STATES.includes(x.status)?x.status:'NEW',at:Number(x.at)||Date.now(),by:String(x.by||'').slice(0,120),note:String(x.note||'').slice(0,500)})):[]
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
  if(current.status==='CLOSED'&&status!=='CLOSED')throw new Error('Closed alerts must be reopened explicitly by an administrator.');
  const history=[...(current.history||[]),{status,at:Date.now(),by:String(actor||'').slice(0,120),note:String(note||'').slice(0,500)}].slice(-20);
  return {...current,status,history};
}
