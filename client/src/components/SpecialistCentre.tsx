import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,AlertTriangle,BookOpen,CheckCircle2,ChevronDown,Database,Loader2,Play,RefreshCw,Shield,Trash2} from 'lucide-react';
import {api} from '../lib/api';

type Role='DEFENCE_IW'|'CORPORATE_RISK'|'SUPPLY_CHAIN'|'GEOPOLITICAL'|'STRATEGIC';
type Observation={id:string;title:string;source:string;url:string;publishedAt:number|null;capturedAt:number;eventType:string;kind:string;text?:string};
type Workspace={observations:Observation[];collectionHistory:any[];assessments:any[];macroIndicators?:any[];tradeFlows?:any[];monitorEnabled?:boolean};
const ROLES:{id:Role;label:string;target:string;description:string}[]=[
 {id:'DEFENCE_IW',label:'Defence & Information Warfare',target:'8.5 target',description:'Posture, capability, exercises, information environment, nuclear stability and defensive cyber.'},
 {id:'CORPORATE_RISK',label:'Corporate Intelligence & Risk',target:'7.5 minimum',description:'Corporate events, regulatory exposure, sanctions leads, litigation and identity-resolution gaps.'},
 {id:'SUPPLY_CHAIN',label:'Supply Chain & Logistics',target:'7.5 minimum',description:'Trade partners, route exposure, ports, disruptions and concentration signals.'},
 {id:'GEOPOLITICAL',label:'Geopolitical Intelligence',target:'7.5 minimum',description:'Conflict, diplomacy, political change, disputed claims and escalation indicators.'},
 {id:'STRATEGIC',label:'Strategic Intelligence & Foresight',target:'7.5 minimum',description:'Macro drivers, energy and technology shifts, scenarios and forecast signposts.'}
];
const date=(v:number|null|undefined)=>v?new Date(v).toLocaleString():'Date unavailable';
const pretty=(v:any)=>JSON.stringify(v,null,2);
const SpecialistCentre:React.FC=()=>{
 const [role,setRole]=useState<Role>('DEFENCE_IW');
 const [workspace,setWorkspace]=useState<Workspace>({observations:[],collectionHistory:[],assessments:[]});
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState<'collect'|'assess'|'clear'|'monitor'|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [country,setCountry]=useState('IND');\n const [monitorEnabled,setMonitorEnabled]=useState(false);
 const selected=ROLES.find(x=>x.id===role)!;
 const latest=workspace.assessments?.[0];
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{const r=await api<{workspace:Workspace;status:{monitorEnabled:boolean}}>(`/specialist-operations/${role}`);setWorkspace(r.workspace||{observations:[],collectionHistory:[],assessments:[]});setMonitorEnabled(r.status?.monitorEnabled===true);}
  catch(e:any){setError(e.message||'Could not load the analyst workspace.');}
  finally{setLoading(false);}
 },[role]);
 useEffect(()=>{load();},[load]);
 const collect=async()=>{
  setBusy('collect');setError('');setNotice('');
  try{const r=await api<{collection:any;observations:Observation[];status:any}>(`/specialist-operations/${role}/collect`,{body:{country}});
   setNotice(`Collection complete: ${r.collection.results} observations, ${r.collection.articleBodies} article bodies captured.`);
   await load();
  }catch(e:any){setError(e.message||'Collection failed.');}
  finally{setBusy(null);}
 };
 const assess=async()=>{
  setBusy('assess');setError('');setNotice('');
  try{const r=await api<{record:any}>(`/specialist-operations/${role}/assess`,{body:{}});
   setNotice('Assessment saved to your private analyst workspace.');await load();
  }catch(e:any){setError(e.message||'Assessment failed.');}
  finally{setBusy(null);}
 };
 const toggleMonitor=async()=>{
  const next=!monitorEnabled;setBusy('monitor');setError('');setNotice('');
  try{const r=await api<{monitorEnabled:boolean}>(`/specialist-operations/${role}/monitor`,{method:'PUT',body:{enabled:next}});setMonitorEnabled(r.monitorEnabled);setNotice(r.monitorEnabled?'Automatic capture enabled: matching existing live-feed items are saved every 10 minutes.':'Automatic capture disabled.');}
  catch(e:any){setError(e.message||'Could not update monitoring.');}
  finally{setBusy(null);}
 };
 const clear=async()=>{
  if(!window.confirm('Clear this role’s saved observations and assessments?'))return;
  setBusy('clear');setError('');setNotice('');
  try{await api(`/specialist-operations/${role}/clear`,{body:{}});setNotice('Workspace cleared.');await load();}
  catch(e:any){setError(e.message||'Could not clear workspace.');}
  finally{setBusy(null);}
 };
 const counts=useMemo(()=>({sources:new Set(workspace.observations.map(x=>x.source)).size,lanes:new Set(workspace.observations.map(x=>x.eventType)).size}),[workspace]);
 return <div className="p-4 md:p-7 space-y-6 max-w-[1500px] mx-auto">
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
   <div><div className="text-[10px] font-black tracking-[.25em] uppercase text-calibrex-teal mb-2">Calibrex / Intelligence Operations</div><h1 className="text-2xl md:text-3xl font-black text-white">Specialist Intelligence Centre</h1><p className="text-sm text-calibrex-muted mt-2 max-w-3xl">Collect open-source reporting, preserve evidence provenance, generate structured assessments and retain your work in a private analyst workspace.</p></div>
   <div className="flex gap-2 flex-wrap"><span className="px-3 py-2 rounded-xl border border-calibrex-teal/20 bg-calibrex-teal/5 text-xs text-calibrex-teal font-bold"><Activity size={14} className="inline mr-1"/> Public-source collection</span><span className="px-3 py-2 rounded-xl border border-white/10 text-xs text-white/50">No new API keys</span></div>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
   {ROLES.map(x=><button key={x.id} onClick={()=>setRole(x.id)} className={`text-left p-3 rounded-xl border transition-all ${role===x.id?'border-calibrex-teal/50 bg-calibrex-teal/10':'border-white/10 bg-white/[.025] hover:bg-white/[.05]'}`}>
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-white">{x.label}</span>{role===x.id&&<CheckCircle2 size={15} className="text-calibrex-teal"/>}</div>
    <div className="text-[10px] text-calibrex-teal mt-2 font-bold">{x.target}</div>
   </button>)}
  </div>
  <section className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5">
   <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
    <div className="max-w-2xl"><h2 className="text-lg font-bold text-white">{selected.label}</h2><p className="text-sm text-calibrex-muted mt-1">{selected.description}</p><p className="text-[11px] text-white/35 mt-2">Collection searches existing live feeds and public web sources. Article bodies are captured where publishers permit access. Missing data remains unassessed.</p></div>
    <div className="flex flex-wrap gap-2 items-center">
     <label className="text-[11px] text-white/50">Country <select value={country} onChange={e=>setCountry(e.target.value.toUpperCase())} className="ml-2 bg-black/50 border border-white/10 rounded-lg px-2 py-2 text-white"><option value="IND">India (IND)</option><option value="USA">United States (USA)</option><option value="CHN">China (CHN)</option><option value="GBR">United Kingdom (GBR)</option><option value="RUS">Russia (RUS)</option><option value="PAK">Pakistan (PAK)</option></select></label>
     <button disabled={!!busy} onClick={collect} className="px-4 py-2.5 rounded-xl bg-calibrex-teal text-calibrex-navy font-black text-xs disabled:opacity-50">{busy==='collect'?<Loader2 className="inline animate-spin mr-1" size={14}/>:<RefreshCw className="inline mr-1" size={14}/>}Collect sources</button>
     <button disabled={!!busy||!workspace.observations.length} onClick={assess} className="px-4 py-2.5 rounded-xl border border-calibrex-gold/30 bg-calibrex-gold/10 text-calibrex-gold font-bold text-xs disabled:opacity-40">{busy==='assess'?<Loader2 className="inline animate-spin mr-1" size={14}/>:<Play className="inline mr-1" size={14}/>}Run assessment</button>
    </div>
   </div>
   {(error||notice)&&<div className={`mt-4 rounded-xl px-3 py-2 text-xs ${error?'bg-red-500/10 text-red-300 border border-red-500/20':'bg-calibrex-teal/10 text-calibrex-teal border border-calibrex-teal/20'}`}>{error||notice}</div>}
  </section>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
   {[['Observations',workspace.observations.length],['Publishers',counts.sources],['Analytic lanes',counts.lanes],['Saved assessments',workspace.assessments?.length||0]].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div><div className="text-2xl font-black text-white mt-1 tabular-nums">{value}</div></div>)}
  </div>
  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
   <section className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
    <div className="p-4 border-b border-white/10 flex items-center justify-between"><h3 className="text-sm font-bold text-white"><Database size={15} className="inline mr-2 text-calibrex-teal"/>Collected evidence</h3><button onClick={load} className="text-white/40 hover:text-white" title="Refresh"><RefreshCw size={14}/></button></div>
    <div className="max-h-[520px] overflow-y-auto divide-y divide-white/5">
     {loading?<div className="p-8 text-center text-white/40"><Loader2 className="animate-spin inline mr-2" size={16}/>Loading workspace</div>:workspace.observations.length?workspace.observations.slice(0,100).map(x=><div key={x.id} className="p-3 hover:bg-white/[.025]"><a href={x.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:text-calibrex-teal font-medium">{x.title}</a><div className="mt-1 text-[10px] text-white/40 flex flex-wrap gap-x-2"><span>{x.source}</span><span>{x.eventType}</span><span>{date(x.publishedAt)}</span></div>{x.text&&<p className="mt-2 text-xs text-white/55 line-clamp-3">{x.text.slice(0,420)}</p>}</div>):<div className="p-8 text-center text-white/35 text-sm">No observations yet. Run collection to populate this workspace.</div>}
    </div>
   </section>
   <section className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
    <div className="p-4 border-b border-white/10 flex items-center justify-between"><h3 className="text-sm font-bold text-white"><BookOpen size={15} className="inline mr-2 text-calibrex-gold"/>Latest assessment</h3><span className="text-[10px] text-white/35">{latest?date(latest.createdAt):'Not run'}</span></div>
    {latest?<div className="p-4 space-y-3"><div className="flex items-center gap-2 text-xs text-calibrex-teal"><CheckCircle2 size={14}/> Saved analyst assessment · {latest.observationCount} observations</div><pre className="text-[11px] leading-relaxed text-white/70 whitespace-pre-wrap break-words max-h-[450px] overflow-y-auto">{pretty(latest.assessment)}</pre></div>:<div className="p-8 text-center text-white/35 text-sm">Collect observations, then run an assessment. It will be saved here for later review.</div>}
   </section>
  </div>
  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/35 border-t border-white/10 pt-4"><div><AlertTriangle size={13} className="inline mr-1 text-calibrex-gold"/>Open-source intelligence is incomplete. Social posts and media claims are leads, not verified facts. No classified or tactical intelligence is produced.</div><button onClick={clear} disabled={!!busy} className="text-white/35 hover:text-red-300 disabled:opacity-40"><Trash2 size={13} className="inline mr-1"/>Clear this role workspace</button></div>
 </div>;
};
export default SpecialistCentre;
