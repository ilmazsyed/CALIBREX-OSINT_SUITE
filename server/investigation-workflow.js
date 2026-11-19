// Explicit, auditable case workflow state machine. Transitions are validated;
// completion never implies that findings are true or that evidence is sufficient.
const STATES=['DRAFT','COLLECTING','TRIAGE','ANALYSIS','REVIEW','APPROVED','CLOSED','REOPENED'];
const NEXT={
 DRAFT:['COLLECTING','CLOSED'],COLLECTING:['TRIAGE','DRAFT','CLOSED'],
 TRIAGE:['COLLECTING','ANALYSIS','CLOSED'],ANALYSIS:['COLLECTING','REVIEW'],
 REVIEW:['ANALYSIS','APPROVED'],APPROVED:['CLOSED','REOPENED'],
 CLOSED:['REOPENED'],REOPENED:['COLLECTING','TRIAGE','ANALYSIS']
};
const clean=v=>String(v??'').trim().slice(0,500);
export function transitionInvestigationWorkflow(caseRecord={},command={},actor={}) {
 const current=STATES.includes(caseRecord.workflowStatus)?caseRecord.workflowStatus:'DRAFT';
 const target=String(command.to||'').toUpperCase();
 if(!STATES.includes(target))return {ok:false,error:'INVALID_TARGET_STATE',allowed: NEXT[current]||[]};
 if(!(NEXT[current]||[]).includes(target))return {ok:false,error:'TRANSITION_NOT_ALLOWED',from:current,to:target,allowed:NEXT[current]||[]};
 const role=String(actor.role||'analyst').toLowerCase();
 if(target==='APPROVED'&&!['reviewer','supervisor','admin','owner'].includes(role))return {ok:false,error:'REVIEWER_ROLE_REQUIRED'};
 const now=Number(command.at)||Date.now();
 const event={id:`wf_${now}_${Math.random().toString(36).slice(2,9)}`,from:current,to:target,
   actorId:clean(actor.id),actorRole:role,at:now,note:clean(command.note),taskId:clean(command.taskId)};
 return {ok:true,caseRecord:{...caseRecord,workflowStatus:target,workflowUpdatedAt:now,
   workflowHistory:[...(Array.isArray(caseRecord.workflowHistory)?caseRecord.workflowHistory:[]).slice(-199),event]}};
}
export function validateWorkflowTasks(tasks=[]) {
 const ids=new Set(),errors=[];
 const cleanTasks=(Array.isArray(tasks)?tasks:[]).slice(0,500).map((t,i)=>{
  const id=clean(t.id)||`task_${i+1}`;
  if(ids.has(id))errors.push({id,code:'DUPLICATE_TASK_ID'});ids.add(id);
  const status=['OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED'].includes(t.status)?t.status:'OPEN';
  const dueAt=t.dueAt==null?null:Number(t.dueAt);
  if(dueAt!==null&&!Number.isFinite(dueAt))errors.push({id,code:'INVALID_DUE_DATE'});
  return {id,title:clean(t.title),description:clean(t.description),ownerId:clean(t.ownerId),
    status,priority:['LOW','NORMAL','HIGH','CRITICAL'].includes(t.priority)?t.priority:'NORMAL',
    dueAt:Number.isFinite(dueAt)?dueAt:null,dependsOn:(Array.isArray(t.dependsOn)?t.dependsOn:[]).map(String).filter(x=>ids.has(x)||x!==id).slice(0,30)};
 });
 for(const t of cleanTasks)for(const dep of t.dependsOn)if(!ids.has(dep))errors.push({id:t.id,code:'UNKNOWN_DEPENDENCY',dependency:dep});
 return {valid:errors.length===0,tasks:cleanTasks,errors,summary:{
  total:cleanTasks.length,open:cleanTasks.filter(t=>t.status==='OPEN').length,
  inProgress:cleanTasks.filter(t=>t.status==='IN_PROGRESS').length,blocked:cleanTasks.filter(t=>t.status==='BLOCKED').length,
  done:cleanTasks.filter(t=>t.status==='DONE').length,overdue:cleanTasks.filter(t=>t.dueAt&&t.dueAt<Date.now()&&!['DONE','CANCELLED'].includes(t.status)).length}};
}
export const INVESTIGATION_WORKFLOW_STATES=STATES;
