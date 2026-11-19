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
 const input=(Array.isArray(tasks)?tasks:[]).slice(0,500);
 const cleanTasks=input.map((t,i)=>{
  const id=clean(t.id)||`task_${i+1}`;
  if(ids.has(id))errors.push({id,code:'DUPLICATE_TASK_ID'});ids.add(id);
  const title=clean(t.title);
  if(title.length<3)errors.push({id,code:'TASK_TITLE_REQUIRED'});
  const status=['OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED'].includes(t.status)?t.status:'OPEN';
  let dueAt=null;
  if(t.dueAt!=null&&t.dueAt!==''){
    dueAt=typeof t.dueAt==='string'&&!/^\\d+(?:\\.\\d+)?$/.test(t.dueAt)?Date.parse(t.dueAt):Number(t.dueAt);
    if(!Number.isFinite(dueAt)||dueAt<0||dueAt>8640000000000000)errors.push({id,code:'INVALID_DUE_DATE'});
  }
  const dependsOn=[...new Set((Array.isArray(t.dependsOn)?t.dependsOn:[]).map(String).map(x=>x.trim()).filter(Boolean))].slice(0,30);
  if(dependsOn.includes(id))errors.push({id,code:'SELF_DEPENDENCY'});
  return {id,title,description:clean(t.description),ownerId:clean(t.ownerId),status,
    priority:['LOW','NORMAL','HIGH','CRITICAL'].includes(t.priority)?t.priority:'NORMAL',
    dueAt:Number.isFinite(dueAt)?dueAt:null,dependsOn,
    createdAt:Number(t.createdAt)||Date.now(),updatedAt:Number(t.updatedAt)||Date.now()};
 });
 for(const t of cleanTasks)for(const dep of t.dependsOn)if(!ids.has(dep))errors.push({id:t.id,code:'UNKNOWN_DEPENDENCY',dependency:dep});
 const byId=new Map(cleanTasks.map(t=>[t.id,t])),visiting=new Set(),visited=new Set();
 function visit(id,path=[]){
  if(visiting.has(id)){errors.push({id,code:'DEPENDENCY_CYCLE',cycle:[...path,id]});return;}
  if(visited.has(id))return;
  visiting.add(id);
  for(const dep of byId.get(id)?.dependsOn||[])if(byId.has(dep))visit(dep,[...path,id]);
  visiting.delete(id);visited.add(id);
 }
 for(const task of cleanTasks)visit(task.id);
 const now=Date.now();
 return {valid:errors.length===0,tasks:cleanTasks,errors,summary:{
  total:cleanTasks.length,open:cleanTasks.filter(t=>t.status==='OPEN').length,
  inProgress:cleanTasks.filter(t=>t.status==='IN_PROGRESS').length,blocked:cleanTasks.filter(t=>t.status==='BLOCKED').length,
  done:cleanTasks.filter(t=>t.status==='DONE').length,
  overdue:cleanTasks.filter(t=>t.dueAt&&t.dueAt<now&&!['DONE','CANCELLED'].includes(t.status)).length,
  dueSoon:cleanTasks.filter(t=>t.dueAt&&t.dueAt>=now&&t.dueAt<=now+48*60*60*1000&&!['DONE','CANCELLED'].includes(t.status)).length
 }};
}

export function recordWorkflowTaskChanges(before=[],after=[],actor={},history=[]) {
 const oldMap=new Map((Array.isArray(before)?before:[]).map(t=>[String(t.id),t]));
 const newMap=new Map((Array.isArray(after)?after:[]).map(t=>[String(t.id),t]));
 const events=[],now=Date.now();
 for(const [id,task] of newMap){
  const old=oldMap.get(id);
  if(!old){events.push({id:`task_event_${now}_${events.length}`,taskId:id,action:'ADDED',title:clean(task.title),by:String(actor.id||''),role:String(actor.role||'analyst'),at:now,changedFields:Object.keys(task)});continue;}
  const changedFields=Object.keys(task).filter(key=>JSON.stringify(task[key])!==JSON.stringify(old[key]));
  if(changedFields.length)events.push({id:`task_event_${now}_${events.length}`,taskId:id,action:'UPDATED',title:clean(task.title),by:String(actor.id||''),role:String(actor.role||'analyst'),at:now,changedFields});
 }
 for(const [id,task] of oldMap)if(!newMap.has(id))events.push({id:`task_event_${now}_${events.length}`,taskId:id,action:'REMOVED',title:clean(task.title),by:String(actor.id||''),role:String(actor.role||'analyst'),at:now,changedFields:[]});
 return [...(Array.isArray(history)?history:[]),...events].slice(-200);
}
export const INVESTIGATION_WORKFLOW_STATES=STATES;
