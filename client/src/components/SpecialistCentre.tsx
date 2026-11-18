import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,AlertTriangle,BookOpen,CheckCircle2,ChevronDown,Database,Loader2,Play,RefreshCw,Shield,Trash2,Info} from 'lucide-react';
import {api} from '../lib/api';

type Role='DEFENCE_IW'|'CORPORATE_RISK'|'SUPPLY_CHAIN'|'GEOPOLITICAL'|'STRATEGIC';
type Observation={id:string;title:string;source:string;url:string;publishedAt:number|null;capturedAt:number;eventType:string;kind:string;text?:string;relevanceScore?:number;relevanceBand?:'RELEVANT'|'PARTIAL'|'UNRELATED';relevanceReasons?:string[];articleBodyCaptured?:boolean;articleReadStatus?:'CAPTURED'|'HEADLINE_ONLY';articleReadError?:string|null;investigationKey?:string};
type Workspace={observations:Observation[];totalSavedObservations?:number;historicalObservationCount?:number;collectionHistory:any[];assessments:any[];macroIndicators?:any[];tradeFlows?:any[];monitorEnabled?:boolean;subject?:{name?:string;identifier?:string;country?:string}};
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
 const [country,setCountry]=useState('IND');
 const [horizon,setHorizon]=useState('90 days');
 const [focus,setFocus]=useState('');
 const [identifier,setIdentifier]=useState('');
 const [judgement,setJudgement]=useState('');
 const [confidence,setConfidence]=useState('LOW');
 const [alternatives,setAlternatives]=useState('');
 const [implications,setImplications]=useState('');
 const [reviewDate,setReviewDate]=useState('');
 const [driverNames,setDriverNames]=useState('');
 const [scenarioOne,setScenarioOne]=useState('');
 const [scenarioTwo,setScenarioTwo]=useState('');
 const [scenarioOneProbability,setScenarioOneProbability]=useState('60');
 const [scenarioTwoProbability,setScenarioTwoProbability]=useState('40');
 const planningInputs=useMemo(()=>role==='STRATEGIC'?{
  assumptions:driverNames.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((name,i)=>({id:`driver-${i+1}`,name,direction:'UNCERTAIN',impact:'UNASSESSED',confidence:'LOW'})),
  scenarios:[scenarioOne,scenarioTwo].map((name,i)=>({id:`scenario-${i+1}`,name:name.trim(),description:name.trim(),probability:Number(i===0?scenarioOneProbability:scenarioTwoProbability),horizon,assumptions:[],signposts:[]})).filter(x=>x.name)
 }: {},[role,driverNames,scenarioOne,scenarioTwo,scenarioOneProbability,scenarioTwoProbability,horizon]);
 const [monitorEnabled,setMonitorEnabled]=useState(false);
 const selected=ROLES.find(x=>x.id===role)!;
 const latest=workspace.assessments?.[0];
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{const r=await api<{workspace:Workspace;status:{monitorEnabled:boolean}}>(`/specialist-operations/${role}`);setWorkspace(r.workspace||{observations:[],collectionHistory:[],assessments:[]});setMonitorEnabled(r.status?.monitorEnabled===true);setFocus(r.workspace?.subject?.name||'');setIdentifier(r.workspace?.subject?.identifier||'');setCountry(r.workspace?.subject?.country||'IND');}
  catch(e:any){setError(e.message||'Could not load the analyst workspace.');}
  finally{setLoading(false);}
 },[role]);
 useEffect(()=>{load();},[load]);
 const collect=async()=>{
  setBusy('collect');setError('');setNotice('');
  try{const r=await api<{collection:any;observations:Observation[];status:any}>(`/specialist-operations/${role}/collect`,{body:{country,focus,identifier}});
   setNotice(`Collection complete: ${r.collection.results} ${r.collection.results===1?'observation':'observations'} for this investigation. Full articles captured: ${r.collection.articleBodies}; headline-only: ${r.collection.results-r.collection.articleBodies}. ${r.collection.excludedUnrelated||0} unrelated results excluded.`);
   await load();
  }catch(e:any){setError(e.message||'Collection failed.');}
  finally{setBusy(null);}
 };
 const assess=async()=>{
  setBusy('assess');setError('');setNotice('');
  try{const r=await api<{record:any}>(`/specialist-operations/${role}/assess`,{body:{judgement,confidence,alternatives,implications,reviewDate,...planningInputs}});
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
 return <div className="p-4 md:p-7 space-y-5 max-w-[1500px] mx-auto">
  <header className="space-y-3">
   <div className="flex items-center gap-2 text-[10px] font-black tracking-[.22em] uppercase text-calibrex-teal"><Activity size={14}/> Calibrex / Intelligence Operations</div>
   <div><h1 className="text-2xl md:text-3xl font-black text-white">Specialist Intelligence</h1><p className="text-sm text-calibrex-muted mt-2 max-w-3xl">A guided workbench to collect public evidence, assess a situation and save an intelligence judgement. Choose a specialist area to begin.</p></div>
   <div className="flex flex-wrap gap-2"><span className="px-3 py-2 rounded-xl border border-calibrex-teal/20 bg-calibrex-teal/5 text-xs text-calibrex-teal font-bold"><Activity size={14} className="inline mr-1"/>Public-source collection</span><span className="px-3 py-2 rounded-xl border border-white/10 text-xs text-white/55">Uses existing integrations · No new API keys</span></div>
  </header>
  <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2" aria-label="Choose an intelligence area">
   {ROLES.map(x=><button key={x.id} onClick={()=>setRole(x.id)} aria-pressed={role===x.id} className={`text-left p-3 md:p-4 rounded-xl border transition-colors min-h-[104px] ${role===x.id?'border-calibrex-teal/60 bg-calibrex-teal/10':'border-white/10 bg-white/[.025] hover:bg-white/[.05]'}`}>
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-white">{x.label}</span>{role===x.id&&<CheckCircle2 size={16} className="text-calibrex-teal"/>}</div>
    <div className="text-[10px] text-calibrex-teal mt-2 font-bold">{x.id==='DEFENCE_IW'?'Defence analysis':x.id==='CORPORATE_RISK'?'Company risk review':x.id==='SUPPLY_CHAIN'?'Trade and route exposure':x.id==='GEOPOLITICAL'?'Regional situation analysis':'Scenarios and forecasts'}</div>
   </button>)}
  </section>
  <section className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5 space-y-4">
   <div><div className="text-[10px] font-bold uppercase tracking-wider text-calibrex-teal">Selected workspace</div><h2 className="text-lg md:text-xl font-bold text-white mt-1">{selected.label}</h2><p className="text-sm text-calibrex-muted mt-1">{selected.description}</p><p className="text-xs text-white/40 mt-2">Start with a subject or intelligence question. Collection searches existing public feeds and web sources; article access varies by publisher.</p></div>
   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[2fr_1.2fr_1fr] gap-3">
    <label className="text-xs font-semibold text-white/65">{role==='CORPORATE_RISK'?'Company or organisation':role==='SUPPLY_CHAIN'?'Commodity, supplier or route':role==='GEOPOLITICAL'?'Region, actor or issue':role==='STRATEGIC'?'Strategic question':'Country, theatre or security issue'}<input value={focus} onChange={e=>{setFocus(e.target.value);if(/\\bbangladesh\\b/i.test(e.target.value))setCountry('BGD');}} placeholder={role==='CORPORATE_RISK'?'Enter company name':role==='SUPPLY_CHAIN'?'e.g. semiconductor imports, Port of Mundra':role==='GEOPOLITICAL'?'e.g. Red Sea security, India–China relations':role==='STRATEGIC'?'e.g. How could energy prices affect our business?':'e.g. Indian Ocean, border posture, air exercises'} maxLength={160} className="mt-1.5 w-full bg-black/40 border border-white/15 rounded-xl px-3 py-3 text-sm text-white placeholder:text-white/30 focus:border-calibrex-teal/60 outline-none"/></label>
    <label className="text-xs font-semibold text-white/65">Additional identifier <span className="text-white/35">· optional</span><input value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder={role==='CORPORATE_RISK'?'Registration number or website':'Actor, programme, supplier or reference'} maxLength={120} className="mt-1.5 w-full bg-black/40 border border-white/15 rounded-xl px-3 py-3 text-sm text-white placeholder:text-white/30 focus:border-calibrex-teal/60 outline-none"/></label>
    <label className="text-xs font-semibold text-white/65">Primary country<select value={country} onChange={e=>setCountry(e.target.value)} className="mt-1.5 w-full bg-black/40 border border-white/15 rounded-xl px-3 py-3 text-sm text-white"><option value="IND">India</option><option value="BGD">Bangladesh</option><option value="USA">United States</option><option value="CHN">China</option><option value="GBR">United Kingdom</option><option value="RUS">Russia</option><option value="PAK">Pakistan</option></select></label>
   </div>
   <div className="flex flex-col sm:flex-row gap-2">
    <button disabled={!!busy||!focus.trim()} onClick={collect} className="flex-1 px-4 py-3 rounded-xl bg-calibrex-teal text-calibrex-navy font-black text-sm disabled:opacity-40">{busy==='collect'?<><Loader2 className="inline animate-spin mr-2" size={16}/>Collecting public evidence…</>:<><RefreshCw className="inline mr-2" size={16}/>1. Collect evidence</>}</button>
    <button disabled={!!busy||!workspace.observations.length} onClick={assess} className="flex-1 px-4 py-3 rounded-xl border border-calibrex-gold/40 bg-calibrex-gold/10 text-calibrex-gold font-bold text-sm disabled:opacity-40">{busy==='assess'?<><Loader2 className="inline animate-spin mr-2" size={16}/>Preparing assessment…</>:<><Play className="inline mr-2" size={16}/>2. Create assessment</>}</button>
    <button disabled={!!busy} onClick={toggleMonitor} className={`px-4 py-3 rounded-xl border text-xs font-bold disabled:opacity-40 ${monitorEnabled?'border-calibrex-teal/40 bg-calibrex-teal/10 text-calibrex-teal':'border-white/15 text-white/65'}`}>{monitorEnabled?'Auto-capture is ON':'Enable auto-capture'}</button>
   </div>
   <p className="text-[11px] text-white/40"><Info size={13} className="inline mr-1"/>Social and community content is treated as an unverified lead. Missing information remains unassessed; no new API credentials are required.</p>
   {(error||notice)&&<div role="status" className={`rounded-xl px-3 py-3 text-sm ${error?'bg-red-500/10 text-red-300 border border-red-500/20':'bg-calibrex-teal/10 text-calibrex-teal border border-calibrex-teal/20'}`}>{error||notice}</div>}
  </section>
  {Boolean(workspace.historicalObservationCount)&&<div className="rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-xs text-white/55">{workspace.historicalObservationCount} older evidence records are preserved in this role’s workspace and kept separate from the current investigation.</div>}
  <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
   {[['Current investigation',workspace.observations.length,'Evidence matched to this investigation'],['Distinct publishers',counts.sources,'Different source publishers'],['Evidence categories',counts.lanes,'Analytic lanes represented'],['Saved assessments',(workspace.assessments||[]).filter((x:any)=>!x.investigationKey||x.investigationKey===workspace.observations[0]?.investigationKey).length,'Reviews for this investigation']].map(([label,value,help])=><div key={String(label)} className="rounded-xl border border-white/10 bg-white/[.025] p-3 md:p-4"><div className="text-[10px] uppercase tracking-wider text-white/45">{label}</div><div className="text-2xl md:text-3xl font-black text-white mt-1 tabular-nums">{value}</div><div className="text-[10px] text-white/35 mt-1">{help}</div></div>)}
  </section>
  {role==='STRATEGIC'&&<section className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
   <div><h3 className="text-sm font-bold text-white">Scenario planning <span className="text-white/35 font-normal">· optional</span></h3><p className="text-xs text-white/45 mt-1">Describe the forces that could change the situation and two possible outcomes. These are analyst estimates, not automated predictions.</p></div>
   <label className="block text-xs text-white/65">Key drivers <span className="text-white/35">— one per line</span><textarea value={driverNames} onChange={e=>setDriverNames(e.target.value)} rows={3} placeholder={"Energy prices rising\nRegional instability\nNew trade restrictions"} className="mt-1 w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white placeholder:text-white/25"/></label>
   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <label className="block text-xs text-white/65">Possible outcome 1<input value={scenarioOne} onChange={e=>setScenarioOne(e.target.value)} placeholder="Supply disruption continues" className="mt-1 w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white placeholder:text-white/25"/></label>
    <label className="block text-xs text-white/65">Likelihood estimate (%)<input type="number" min="0" max="100" value={scenarioOneProbability} onChange={e=>setScenarioOneProbability(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white"/></label>
    <label className="block text-xs text-white/65">Possible outcome 2<input value={scenarioTwo} onChange={e=>setScenarioTwo(e.target.value)} placeholder="Trade routes stabilise" className="mt-1 w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white placeholder:text-white/25"/></label>
    <label className="block text-xs text-white/65">Likelihood estimate (%)<input type="number" min="0" max="100" value={scenarioTwoProbability} onChange={e=>setScenarioTwoProbability(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white"/></label>
   </div>
   <label className="block text-xs text-white/65">Planning horizon<select value={horizon} onChange={e=>setHorizon(e.target.value)} className="mt-1 w-full md:w-64 bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white"><option>30 days</option><option>90 days</option><option>6 months</option><option>1 year</option><option>3 years</option></select></label>
   <p className="text-[11px] text-white/35">If you enter two outcomes, their likelihood estimates must total 100%.</p>
  </section>}
  <section className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5 space-y-3">
   <div><h3 className="text-sm font-bold text-white">Analyst review <span className="text-white/35 font-normal">· after reviewing the evidence</span></h3><p className="text-xs text-white/45 mt-1">The system organises evidence. You provide the judgement, confidence and decision implications.</p></div>
   <label className="block text-xs text-white/65">Key judgement<textarea value={judgement} onChange={e=>setJudgement(e.target.value)} placeholder="What do you assess is happening, and why?" rows={3} className="mt-1 w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white placeholder:text-white/25"/></label>
   <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    <label className="text-xs text-white/65">Confidence<select value={confidence} onChange={e=>setConfidence(e.target.value)} className="block mt-1 w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
    <label className="text-xs text-white/65">Next review date<input type="date" value={reviewDate} onChange={e=>setReviewDate(e.target.value)} className="block mt-1 w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white"/></label>
    <label className="text-xs text-white/65">Decision implications<textarea value={implications} onChange={e=>setImplications(e.target.value)} rows={2} placeholder="What decisions could this affect?" className="block mt-1 w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white placeholder:text-white/25"/></label>
   </div>
   <label className="block text-xs text-white/65">Alternative explanations<textarea value={alternatives} onChange={e=>setAlternatives(e.target.value)} rows={2} placeholder="What else could explain the evidence?" className="mt-1 w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white placeholder:text-white/25"/></label>
  </section>
  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
   <section className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
    <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-white"><Database size={15} className="inline mr-2 text-calibrex-teal"/>Evidence collected</h3><p className="text-[10px] text-white/40 mt-1">Open original sources to verify context.</p></div><button onClick={load} disabled={loading} className="text-white/50 hover:text-white p-2" title="Refresh evidence"><RefreshCw size={15}/></button></div>
    <div className="max-h-[560px] overflow-y-auto divide-y divide-white/5">
     {loading?<div className="p-8 text-center text-white/40"><Loader2 className="animate-spin inline mr-2" size={16}/>Loading your workspace…</div>:workspace.observations.length?workspace.observations.slice(0,100).map(x=><article key={x.id} className="p-3 hover:bg-white/[.025]"><a href={x.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:text-calibrex-teal font-semibold">{x.title}</a><div className="mt-1 text-[10px] text-white/45 flex flex-wrap gap-x-2"><span>{x.source}</span><span>· {x.eventType}</span><span>· {date(x.publishedAt)}</span><span className={x.relevanceBand==='RELEVANT'?'text-calibrex-teal':x.relevanceBand==='PARTIAL'?'text-calibrex-gold':'text-white/35'}>· {x.relevanceBand==='RELEVANT'?'Direct match':x.relevanceBand==='PARTIAL'?'Partial match':'Relevance unscored'}</span><span className={x.articleBodyCaptured?'text-calibrex-teal':'text-calibrex-gold'}>· {x.articleBodyCaptured?'Full article captured':'Headline/metadata only'}</span></div>{x.relevanceReasons?.length>0&&<p className="mt-1 text-[10px] text-white/35">{x.relevanceReasons.join(' · ')}</p>}{x.articleReadError&&<p className="mt-1 text-[10px] text-calibrex-gold/80">Article not captured: {x.articleReadError}</p>}{x.text&&<p className="mt-2 text-xs leading-relaxed text-white/55 line-clamp-4">{x.text.slice(0,500)}</p>}</article>):<div className="p-8 text-center"><Database size={24} className="mx-auto text-white/25"/><p className="text-sm text-white/65 mt-3">No evidence collected yet</p><p className="text-xs text-white/35 mt-1">Enter your intelligence question above and select “Collect evidence”.</p></div>}
    </div>
   </section>
   <section className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
    <div className="p-4 border-b border-white/10"><h3 className="text-sm font-bold text-white"><BookOpen size={15} className="inline mr-2 text-calibrex-gold"/>Latest assessment</h3><p className="text-[10px] text-white/40 mt-1">{latest?date(latest.createdAt):'Your saved assessments will appear here.'}</p></div>
    {latest?<div className="p-4 space-y-3"><div className="flex items-center gap-2 text-xs text-calibrex-teal"><CheckCircle2 size={14}/>Saved assessment · {latest.observationCount||0} evidence items reviewed</div>{latest.analystReview?.judgement?<div className="rounded-xl border border-calibrex-teal/20 bg-calibrex-teal/5 p-3"><div className="text-[10px] uppercase tracking-wider text-calibrex-teal font-bold">Analyst judgement · {latest.analystReview.confidence||'Not recorded'} confidence</div><p className="text-sm text-white mt-2 whitespace-pre-wrap">{latest.analystReview.judgement}</p>{latest.analystReview.alternatives&&<p className="text-xs text-white/55 mt-2">Alternative explanations: {latest.analystReview.alternatives}</p>}{latest.analystReview.implications&&<p className="text-xs text-white/55 mt-2">Decision implications: {latest.analystReview.implications}</p>}</div>:<p className="text-xs text-white/45">No analyst judgement was recorded for this assessment.</p>}
     <div className="rounded-xl bg-white/[.03] p-3"><div className="text-[10px] text-white/40 uppercase tracking-wider">Assessment area</div><div className="text-sm font-semibold text-white mt-1">{selected.label}</div><div className="text-xs text-white/45 mt-1">{latest.observationCount||0} evidence items · {date(latest.createdAt)}</div></div>
     <p className="text-xs text-white/45">Saved in your private workspace. Verify important claims against linked source material before acting.</p>
    </div>:<div className="p-8 text-center"><BookOpen size={24} className="mx-auto text-white/25"/><p className="text-sm text-white/65 mt-3">No assessment saved yet</p><p className="text-xs text-white/35 mt-1">Collect evidence first, then create an assessment.</p></div>}
   </section>
  </div>
  <section className="rounded-xl border border-white/10 bg-white/[.02] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="text-[11px] text-white/45 leading-relaxed"><AlertTriangle size={14} className="inline mr-1 text-calibrex-gold"/>Open-source coverage is incomplete. Social and media claims are leads until corroborated. No classified or tactical intelligence is produced.</div><button onClick={clear} disabled={!!busy} className="shrink-0 text-xs text-white/40 hover:text-red-300 disabled:opacity-40"><Trash2 size={13} className="inline mr-1"/>Clear this workspace</button></section>
 </div>;
};
export default SpecialistCentre;
