import React,{useEffect,useState} from 'react';
import {api} from '../lib/api';
import {RefreshCw,ShieldCheck,AlertTriangle,Link2} from 'lucide-react';

type LineageRecord={id:string;title?:string;source?:string;host?:string;url?:string};
type Candidate={evidenceIds:string[];signals:{reason:string;strength:string;score?:number}[];reviewRequired:boolean;independentCorroboration:boolean};
type Review={id:string;evidenceIds:string[];decision:'ACCEPTED'|'REJECTED';rationale:string;reviewedAt:number;reviewedBy:string};
type Result={records:LineageRecord[];candidateRelationships:Candidate[];reviews:Review[];unknownOriginCount:number;knownDeclaredOriginCount:number;caveats:string[]};

const SourceLineagePanel:React.FC<{investigationId:string;workspaceId?:string}>=({investigationId,workspaceId})=>{
 const [data,setData]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const scoped=(path:string)=>workspaceId?path+'?workspaceId='+encodeURIComponent(workspaceId):path;
 const load=async()=>{setBusy(true);setError('');try{setData(await api<Result>(scoped('/investigations/'+encodeURIComponent(investigationId)+'/source-lineage')));}catch(e:any){setError(e.message||'Could not load source lineage.');}finally{setBusy(false);}};
 useEffect(()=>{load();},[investigationId,workspaceId]);
 const decide=async(candidate:Candidate,decision:'ACCEPTED'|'REJECTED')=>{
  const rationale=window.prompt((decision==='ACCEPTED'?'Why do you accept this lineage association?':'Why do you reject this candidate association?')+' Include the source comparison or reasoning.');
  if(!rationale)return;
  setBusy(true);setError('');setMessage('');
  try{await api(scoped('/investigations/'+encodeURIComponent(investigationId)+'/source-lineage/reviews'),{method:'POST',body:{evidenceIds:candidate.evidenceIds,decision,rationale}});setMessage('Analyst decision recorded in the case revision history. Evidence records were not changed.');await load();}
  catch(e:any){setError(e.message||'Could not save lineage review.');setBusy(false);}
 };
 const byId=new Map((data?.records||[]).map(r=>[r.id,r]));
 return <section className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-sm flex items-center gap-2"><Link2 size={15} className="text-calibrex-teal"/> Source lineage & independence review</h3><p className="text-[10px] text-white/40 mt-1">Detect repeated URLs, copied text, similar articles and declared or text-attributed upstream sources. Candidates are not proof.</p></div><button onClick={load} disabled={busy} className="text-[10px] rounded border border-white/15 px-3 py-2"><RefreshCw size={12} className="inline mr-1"/>{busy?'Checking…':'Refresh'}</button></div>
  {error&&<p className="text-xs text-red-300">{error}</p>}{message&&<p className="text-[10px] text-calibrex-teal">{message}</p>}
  {data&&<><div className="grid grid-cols-2 gap-2"><div className="rounded border border-white/10 p-2"><div className="text-[9px] text-white/40">Declared upstream origins</div><div className="text-lg font-black">{data.knownDeclaredOriginCount}</div></div><div className="rounded border border-white/10 p-2"><div className="text-[9px] text-white/40">Unknown origin records</div><div className="text-lg font-black">{data.unknownOriginCount}</div></div></div>
  {!data.candidateRelationships.length?<p className="text-[10px] text-white/40">No lineage candidates detected in the current captured evidence.</p>:<div className="space-y-2 max-h-72 overflow-y-auto">{data.candidateRelationships.map(candidate=>{const a=byId.get(candidate.evidenceIds[0]),b=byId.get(candidate.evidenceIds[1]);const prior=data.reviews.find(r=>r.evidenceIds.slice().sort().join('::')===candidate.evidenceIds.slice().sort().join('::'));return <div key={candidate.evidenceIds.join('::')} className="rounded border border-white/10 p-2 space-y-2"><div className="text-[10px] text-white/75"><strong>{a?.title||candidate.evidenceIds[0]}</strong> <span className="text-white/35">↔</span> <strong>{b?.title||candidate.evidenceIds[1]}</strong></div><div className="text-[9px] text-white/40">{[a?.source,a?.host].filter(Boolean).join(' · ')} ↔ {[b?.source,b?.host].filter(Boolean).join(' · ')}</div><div className="flex flex-wrap gap-1">{candidate.signals.map(signal=><span key={signal.reason} className="rounded bg-white/5 px-2 py-1 text-[8px] text-white/55">{signal.reason}{signal.score!=null?' · '+Math.round(signal.score*100)+'%':''}</span>)}</div>{prior?<div className="text-[9px] text-calibrex-teal">Reviewed: {prior.decision} · {new Date(prior.reviewedAt).toLocaleString()}</div>:<div className="flex gap-2"><button disabled={busy} onClick={()=>decide(candidate,'ACCEPTED')} className="text-[9px] rounded border border-calibrex-teal/30 text-calibrex-teal px-2 py-1">Accept association</button><button disabled={busy} onClick={()=>decide(candidate,'REJECTED')} className="text-[9px] rounded border border-white/15 px-2 py-1">Reject candidate</button></div>}</div>})}</div>}
  <div className="rounded border border-amber-400/15 bg-amber-400/5 p-2 text-[9px] text-white/55"><AlertTriangle size={11} className="inline mr-1 text-amber-300"/>A review decision records an analyst's lineage assessment only. It does not establish factual truth or independent corroboration.</div>
  {data.reviews.length>0&&<div className="text-[9px] text-white/40"><ShieldCheck size={11} className="inline mr-1"/> {data.reviews.length} analyst lineage review(s) recorded.</div>}
  </>}
 </section>;
};
export default SourceLineagePanel;
