import React,{useEffect,useState} from 'react';
import {api} from '../lib/api';
import {BellRing,Plus,RefreshCw,Trash2,Save,ToggleLeft,ToggleRight} from 'lucide-react';

type Rule={id?:string;name:string;description?:string;enabled:boolean;categories:string[];keywords:string[];matchMode:'ANY'|'ALL';minSeverity:string;includeSocial:boolean};
type Preview={ruleId:string|null;ruleName:string;count:number;matches:{id:string;title:string;summary:string;url:string;source:string;kind:string;severity:string;published:number}[]};
const categories=['STRATEGIC','LOGISTICS_SUPPLY_CHAIN','MARKETS','GEOPOLITICS','SECURITY','CYBER','POLITICS','GOVERNANCE','CRISIS','OTHER'];
const fresh=():Rule=>({name:'',description:'',enabled:true,categories:[],keywords:[],matchMode:'ANY',minSeverity:'LOW',includeSocial:false});
const AlertRules:React.FC=()=>{
 const [rules,setRules]=useState<Rule[]>([]),[preview,setPreview]=useState<Preview[]>([]),[draft,setDraft]=useState<Rule>(fresh()),[selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=async()=>{setBusy(true);setError('');try{const r=await api<{rules:Rule[];preview:Preview[]}>('/intelligence/alert-rules');setRules(r.rules||[]);setPreview(r.preview||[]);}catch(e:any){setError(e.message||'Could not load alert rules');}finally{setBusy(false);}};
 useEffect(()=>{load();},[]);
 const edit=(r:Rule)=>{setSelected(r.id||null);setDraft({...r,categories:[...(r.categories||[])],keywords:[...(r.keywords||[])]});};
 const save=async()=>{setBusy(true);setError('');try{const path=selected?'/intelligence/alert-rules/'+encodeURIComponent(selected):'/intelligence/alert-rules';await api(path,{method:selected?'PUT':'POST',body:draft});setDraft(fresh());setSelected(null);await load();}catch(e:any){setError(e.message||'Save failed');}finally{setBusy(false);}};
 const remove=async(id:string)=>{if(!window.confirm('Delete this alert rule?'))return;try{await api('/intelligence/alert-rules/'+encodeURIComponent(id),{method:'DELETE'});if(selected===id){setSelected(null);setDraft(fresh());}await load();}catch(e:any){setError(e.message||'Delete failed');}};
 const toggleCategory=(v:string)=>setDraft(d=>({...d,categories:d.categories.includes(v)?d.categories.filter(x=>x!==v):[...d.categories,v]}));
 return <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5 text-white">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[.25em] text-calibrex-teal font-black">Intelligence operations</div><h2 className="text-2xl font-black flex items-center gap-2 mt-1"><BellRing size={22}/> Alert Rules</h2><p className="text-sm text-white/50 mt-1">Create explainable watch rules across collected intelligence.</p></div><button onClick={load} disabled={busy} className="px-3 py-2 rounded-lg border border-white/15 text-sm flex gap-2 items-center"><RefreshCw size={14}/> Refresh</button></header>
  {error&&<div className="text-sm text-red-300">{error}</div>}
  <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4">
   <section className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
    <div className="flex justify-between items-center"><h3 className="font-bold">Your rules <span className="text-white/40 text-xs">{rules.length}/100</span></h3><button onClick={()=>{setSelected(null);setDraft(fresh());}} className="text-xs px-3 py-2 rounded-lg bg-calibrex-teal text-calibrex-navy font-bold flex gap-1"><Plus size={14}/> New</button></div>
    {rules.length===0?<p className="text-xs text-white/40 py-5">No rules yet. Create a rule to monitor a topic or risk category.</p>:rules.map(r=><div key={r.id} className="border border-white/10 rounded-lg p-3 flex gap-2 items-start"><button onClick={()=>edit(r)} className="text-left flex-1 min-w-0"><div className="font-bold text-sm">{r.name}</div><div className="text-[10px] text-white/45 mt-1">{r.minSeverity}+ · {r.matchMode} keywords · {r.enabled?'Enabled':'Paused'}</div><div className="text-[10px] text-white/35 mt-1">{(r.keywords||[]).join(', ')||'All matching category items'}</div></button>{r.id&&<button onClick={()=>remove(r.id!)} className="p-2 text-red-300/70"><Trash2 size={15}/></button>}</div>)}
   </section>
   <section className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
    <h3 className="font-bold">{selected?'Edit alert rule':'Create alert rule'}</h3>
    <label className="block text-xs text-white/50">Rule name<input value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} maxLength={100} className="mt-1 w-full bg-black/30 border border-white/15 rounded-lg p-2 text-sm text-white"/></label>
    <label className="block text-xs text-white/50">Description<input value={draft.description||''} onChange={e=>setDraft(d=>({...d,description:e.target.value}))} maxLength={500} className="mt-1 w-full bg-black/30 border border-white/15 rounded-lg p-2 text-sm text-white"/></label>
    <label className="block text-xs text-white/50">Keywords (comma separated)<input value={draft.keywords.join(', ')} onChange={e=>setDraft(d=>({...d,keywords:e.target.value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,20)}))} className="mt-1 w-full bg-black/30 border border-white/15 rounded-lg p-2 text-sm text-white" placeholder="port closure, sanctions, cyber attack"/></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-xs text-white/50">Match<select value={draft.matchMode} onChange={e=>setDraft(d=>({...d,matchMode:e.target.value as 'ANY'|'ALL'}))} className="mt-1 w-full bg-black/30 border border-white/15 rounded-lg p-2 text-white"><option value="ANY">Any keyword</option><option value="ALL">All keywords</option></select></label><label className="text-xs text-white/50">Minimum severity<select value={draft.minSeverity} onChange={e=>setDraft(d=>({...d,minSeverity:e.target.value}))} className="mt-1 w-full bg-black/30 border border-white/15 rounded-lg p-2 text-white">{['LOW','MEDIUM','HIGH','CRITICAL'].map(x=><option key={x}>{x}</option>)}</select></label></div>
    <div><div className="text-xs text-white/50 mb-2">Categories (none = all)</div><div className="flex flex-wrap gap-1.5">{categories.map(x=><button key={x} onClick={()=>toggleCategory(x)} className={'text-[9px] px-2 py-1 rounded border '+(draft.categories.includes(x)?'border-calibrex-teal bg-calibrex-teal/15 text-calibrex-teal':'border-white/15 text-white/45')}>{x.replaceAll('_',' ')}</button>)}</div></div>
    <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={draft.includeSocial} onChange={e=>setDraft(d=>({...d,includeSocial:e.target.checked}))}/> Include unverified social posts</label>
    <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft(d=>({...d,enabled:e.target.checked}))}/> Rule enabled</label>
    <div className="flex gap-2"><button onClick={save} disabled={busy||draft.name.trim().length<3} className="px-4 py-2 rounded-lg bg-calibrex-teal text-calibrex-navy text-sm font-bold flex gap-2 items-center disabled:opacity-40"><Save size={14}/> Save rule</button><button onClick={()=>{setSelected(null);setDraft(fresh());}} className="px-4 py-2 rounded-lg border border-white/15 text-sm">Clear</button></div>
   </section>
  </div>
  <section className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3"><div className="flex justify-between"><h3 className="font-bold">Live rule matches</h3><span className="text-[10px] text-white/40">Current collection snapshot</span></div>
   {!preview.length?<p className="text-xs text-white/40">No matching observations for enabled rules.</p>:preview.map(p=><div key={p.ruleId||p.ruleName} className="border border-white/10 rounded-lg p-3"><div className="flex justify-between gap-2"><b className="text-sm">{p.ruleName}</b><span className="text-xs text-calibrex-gold">{p.count} matches</span></div><div className="mt-2 space-y-2">{p.matches.slice(0,8).map(m=><a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block text-xs text-white/75 hover:text-calibrex-teal"><span className="text-white/35">{m.severity} · {m.source} · </span>{m.title}</a>)}</div></div>)}
   <p className="text-[10px] text-white/35">Rule matches are triage candidates, not verified incidents. Social posts remain unverified unless independently corroborated.</p>
  </section>
 </div>;
};
export default AlertRules;
