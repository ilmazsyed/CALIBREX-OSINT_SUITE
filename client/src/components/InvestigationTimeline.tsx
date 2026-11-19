import React, { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, FileText, StickyNote, Video, Workflow } from 'lucide-react';

type Entry={id:string;kind:'evidence'|'workflow'|'task'|'note'|'frame';title:string;detail:string;at:number|null;relative?:string;source?:string};
const toMillis=(value:any):number|null=>{
 if(value==null||value==='')return null;
 const n=Number(value);
 if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
 const parsed=Date.parse(String(value));
 return Number.isFinite(parsed)?parsed:null;
};
const stamp=(value:number|null)=>value==null?'Time not recorded':new Date(value).toLocaleString();

const InvestigationTimeline:React.FC<{investigation:any}> = ({investigation})=>{
 const [filter,setFilter]=useState('ALL');
 const entries=useMemo(()=>{
  const out:Entry[]=[];
  for(const e of investigation?.evidence||[]){
   const ref=e.id||e.title||'evidence';
   const published=toMillis(e.published),sourceTime=toMillis(e.sourceTimestamp),collected=toMillis(e.capturedAt);
   if(published)out.push({id:'pub:'+ref,kind:'evidence',title:'Source published: '+(e.title||'Evidence'),detail:(e.source||'Unspecified source')+' · '+(e.assessment||'UNKNOWN')+' · '+(e.triage||'NEW'),at:published,source:e.url});
   if(sourceTime)out.push({id:'src-time:'+ref,kind:'evidence',title:'Source metadata time: '+(e.title||'Evidence'),detail:'Timestamp supplied by source or media metadata; timezone interpretation must be reviewed',at:sourceTime,source:e.url});
   if(collected)out.push({id:'collected:'+ref,kind:'evidence',title:'Evidence added to case: '+(e.title||'Evidence'),detail:(e.source||'Unspecified source')+' · record '+String(e.recordSha256||e.sha256||'hash unavailable').slice(0,16),at:collected,source:e.url});
   for(const frame of e.videoMetadata?.keyframes||[])out.push({id:'frame:'+ref+':'+frame.id,kind:'frame',title:'Video keyframe: '+(e.title||'Source video'),detail:frame.visualNote||'No analyst visual note',at:null,relative:'Video offset '+(frame.timecode||Number(frame.timestampSeconds||0).toFixed(2)+'s')+' · SHA-256 '+String(frame.sha256||'not recorded').slice(0,16)});
  }
  for(const n of investigation?.notes||[])out.push({id:'note:'+n.id,kind:'note',title:'Analyst note',detail:String(n.text||'').slice(0,220),at:toMillis(n.createdAt)});
  for(const w of investigation?.workflowHistory||[])out.push({id:'workflow:'+w.id,kind:'workflow',title:'Workflow: '+(w.from||'?')+' → '+(w.to||'?'),detail:[w.actorRole,w.actorId,w.note].filter(Boolean).join(' · ')||'Workflow transition',at:toMillis(w.at)});
  for(const t of investigation?.workflowTasks||[])if(t.dueAt)out.push({id:'due:'+t.id,kind:'task',title:'Task due: '+(t.title||t.id),detail:(t.status||'OPEN')+' · '+(t.priority||'NORMAL')+' · owner '+(t.ownerId||'unassigned'),at:toMillis(t.dueAt)});
  for(const t of investigation?.workflowTaskHistory||[])out.push({id:'task-event:'+t.id,kind:'task',title:'Task '+String(t.action||'change').toLowerCase()+': '+(t.title||t.taskId),detail:[t.role,t.changedFields?.join(', ')].filter(Boolean).join(' · '),at:toMillis(t.at)});
  return out.sort((a,b)=>{
   if(a.at==null&&b.at==null)return a.id.localeCompare(b.id);
   if(a.at==null)return 1;if(b.at==null)return -1;return a.at-b.at;
  });
 },[investigation]);
 const visible=filter==='ALL'?entries:entries.filter(e=>e.kind===filter.toLowerCase());
 const counts={ALL:entries.length,EVIDENCE:entries.filter(e=>e.kind==='evidence').length,WORKFLOW:entries.filter(e=>e.kind==='workflow').length,TASK:entries.filter(e=>e.kind==='task').length,NOTE:entries.filter(e=>e.kind==='note').length,FRAME:entries.filter(e=>e.kind==='frame').length};
 const icons:any={evidence:FileText,workflow:Workflow,task:CalendarClock,note:StickyNote,frame:Video};
 const colours:any={evidence:'text-calibrex-teal',workflow:'text-calibrex-gold',task:'text-amber-300',note:'text-white/60',frame:'text-sky-300'};
 return <section className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xs font-black uppercase tracking-widest text-white/75">Investigation timeline</h3><p className="text-[9px] text-white/35 mt-1">Source dates, collection events, analyst activity, task deadlines and video offsets</p></div><span className="text-[9px] text-white/40">{entries.length} events</span></div>
  <div className="flex flex-wrap gap-1">{Object.entries(counts).map(([name,count])=><button key={name} type="button" onClick={()=>setFilter(name)} className={'rounded border px-2 py-1 text-[8px] '+(filter===name?'border-calibrex-teal/50 text-calibrex-teal bg-calibrex-teal/10':'border-white/10 text-white/45')}>{name} · {count}</button>)}</div>
  {!visible.length?<div className="rounded border border-dashed border-white/10 p-5 text-center text-[10px] text-white/35">No timeline events in this category yet.</div>:<div className="max-h-[420px] overflow-y-auto pr-1"><div className="relative space-y-2">{visible.map((entry,i)=>{const Icon=icons[entry.kind]||Clock3;return <div key={entry.id} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-2">
   <div className={'mt-0.5 '+colours[entry.kind]}><Icon size={13}/></div>
   <div className="min-w-0 flex-1"><div className="text-[10px] font-semibold text-white/80">{entry.title}</div><div className="text-[9px] text-white/45 mt-1 break-words">{entry.detail}</div><div className="text-[8px] text-white/30 mt-1">{entry.relative||stamp(entry.at)}</div>{entry.source&&<div className="text-[8px] text-calibrex-teal/70 mt-1 truncate">{entry.source}</div>}</div>
  </div>;})}</div></div>}
  <p className="text-[8px] text-white/30">Publication time, source metadata time and case collection time are separate events. Video frame offsets are relative to the clip, not absolute timestamps. Timeline order does not establish causality.</p>
 </section>;
};
export default InvestigationTimeline;
