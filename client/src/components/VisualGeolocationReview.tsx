import React,{useMemo,useState} from 'react';
import {api} from '../lib/api';
import {MapPin,Plus,Save,Search,ShieldCheck,AlertTriangle} from 'lucide-react';

type Match={id:string;landmark:string;matchType:string;referenceUrl:string;provider:string;imageryDate:string;sensor:string;resolutionMeters:string;visualRationale:string;reviewedBy:string;reviewedAt:string};
const emptyMatch=():Match=>({id:crypto.randomUUID(),landmark:'',matchType:'DISTINCTIVE_LANDMARK',referenceUrl:'',provider:'',imageryDate:'',sensor:'',resolutionMeters:'',visualRationale:'',reviewedBy:'',reviewedAt:''});
const VisualGeolocationReview:React.FC<{evidence:any;onApply:(patch:any)=>void}> = ({evidence,onApply})=>{
 const existing=evidence.visualGeolocationReview||{};
 const [name,setName]=useState(existing.candidate?.name||'');
 const [lat,setLat]=useState(existing.candidate?.lat==null?'':String(existing.candidate.lat));
 const [lon,setLon]=useState(existing.candidate?.lon==null?'':String(existing.candidate.lon));
 const [accuracy,setAccuracy]=useState(existing.candidate?.accuracyMeters==null?'':String(existing.candidate.accuracyMeters));
 const [captured,setCaptured]=useState(existing.imageCapturedAt||'');
 const [tolerance,setTolerance]=useState(String(existing.temporalToleranceDays||30));
 const [matches,setMatches]=useState<Match[]>(Array.isArray(existing.matches)&&existing.matches.length?existing.matches.map((m:any)=>({...emptyMatch(),...m})):[]);
 const [placeBusy,setPlaceBusy]=useState(false),[placeError,setPlaceError]=useState(''),[place,setPlace]=useState<any>(null);
 const [saved,setSaved]=useState(false);
 const gates=useMemo(()=>({
  'Candidate coordinates':Number.isFinite(Number(lat))&&Number(lat)>=-90&&Number(lat)<=90&&Number.isFinite(Number(lon))&&Number(lon)>=-180&&Number(lon)<=180,
  'Uncertainty radius':Number(accuracy)>0,
  'Visual landmark rationale':matches.some(m=>m.landmark.trim()&&m.visualRationale.trim().length>=20),
  'Imagery provenance':matches.some(m=>m.provider.trim()&&m.imageryDate&&m.sensor.trim()&&m.referenceUrl.trim()),
  'Two reference domains':new Set(matches.map(m=>{try{return new URL(m.referenceUrl).hostname.replace(/^www\\./,'').toLowerCase()}catch{return ''}}).filter(Boolean)).size>=2,
  'Temporal context':!!captured&&matches.some(m=>m.imageryDate&&Math.abs(Date.parse(m.imageryDate)-Date.parse(captured))<=Number(tolerance)*86400000),
  'Analyst review':matches.some(m=>m.visualRationale.trim().length>=20&&m.reviewedAt)
 }),[lat,lon,accuracy,matches,captured,tolerance]);
 const count=Object.values(gates).filter(Boolean).length;
 const reverse=async()=>{if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))){setPlaceError('Enter valid candidate coordinates first.');return;}setPlaceBusy(true);setPlaceError('');try{const r=await api<any>('/geoint/reverse-geocode?lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon));setPlace(r);setName(name||r.place?.name||r.displayName||'');}catch(e:any){setPlaceError(e.message||'Place lookup failed.');}finally{setPlaceBusy(false);}};
 const update=(id:string,patch:Partial<Match>)=>setMatches(rows=>rows.map(m=>m.id===id?{...m,...patch}:m));
 const save=()=>{
  const review={candidate:{name,lat:Number(lat),lon:Number(lon),accuracyMeters:Number(accuracy),claimedPlace:place?.place?.name||place?.displayName||'',claimedCountry:place?.place?.country||''},
   imageCapturedAt:captured,temporalToleranceDays:Number(tolerance)||30,
   matches:matches.map(m=>({...m,resolutionMeters:m.resolutionMeters?Number(m.resolutionMeters):null,reviewedBy:m.reviewedBy||'current-analyst',reviewedAt:m.reviewedAt||new Date().toISOString()}))};
  onApply({visualGeolocationReview:review});setSaved(true);
 };
 const refs=new Set(matches.map(m=>{try{return new URL(m.referenceUrl).hostname.replace(/^www\\./,'').toLowerCase()}catch{return ''}}).filter(Boolean));
 return <section className="mt-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.03] p-3 space-y-3">
  <div className="flex items-center justify-between gap-2"><div><h4 className="text-[10px] uppercase tracking-widest font-bold text-sky-200">Visual geolocation workbench</h4><p className="text-[8px] text-white/35">Analyst-led landmark matching · reference provenance · coordinate uncertainty</p></div><span className="text-[9px] text-white/55">{count}/7 review gates</span></div>
  {evidence.url&&/^https?:\\/\\//i.test(evidence.url)&&<img src={evidence.url} alt="Source image for visual geolocation review" className="max-h-40 max-w-full rounded border border-white/10 object-contain"/>}
  <div className="grid grid-cols-2 gap-2">
   <label className="text-[8px] text-white/45">Candidate place<input value={name} onChange={e=>setName(e.target.value)} placeholder="Landmark / locality" className="mt-1 w-full rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/></label>
   <label className="text-[8px] text-white/45">Image capture date<input type="date" value={captured} onChange={e=>setCaptured(e.target.value)} className="mt-1 w-full rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/></label>
   <label className="text-[8px] text-white/45">Candidate latitude<input value={lat} onChange={e=>setLat(e.target.value)} placeholder="e.g. 22.5726" className="mt-1 w-full rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/></label>
   <label className="text-[8px] text-white/45">Candidate longitude<input value={lon} onChange={e=>setLon(e.target.value)} placeholder="e.g. 88.3639" className="mt-1 w-full rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/></label>
   <label className="text-[8px] text-white/45">Uncertainty radius (metres)<input type="number" min="1" value={accuracy} onChange={e=>setAccuracy(e.target.value)} placeholder="e.g. 250" className="mt-1 w-full rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/></label>
   <label className="text-[8px] text-white/45">Temporal tolerance (days)<input type="number" min="1" max="365" value={tolerance} onChange={e=>setTolerance(e.target.value)} className="mt-1 w-full rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/></label>
  </div>
  <button type="button" onClick={reverse} disabled={placeBusy} className="rounded border border-sky-300/30 px-2 py-1 text-[9px] text-sky-200 disabled:opacity-40">{placeBusy?'Resolving place…':<><MapPin size={10} className="inline mr-1"/>Reverse-geocode candidate</>}</button>
  {place&&<p className="text-[8px] text-white/50">Provider context: {place.displayName||place.place?.name||'Resolved place'} · {place.provider||'provider not reported'} · contextual only, not verification</p>}
  {placeError&&<p className="text-[8px] text-amber-200">{placeError}</p>}
  <div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-white/65">Independent visual references · {matches.length}</span><button type="button" onClick={()=>setMatches(v=>[...v,emptyMatch()])} className="text-[9px] text-sky-200"><Plus size={11} className="inline"/> Add reference</button></div>
  {matches.map((m,i)=><div key={m.id} className="rounded border border-white/10 p-2 space-y-2">
   <div className="text-[8px] uppercase text-white/40">Reference {i+1}</div>
   <input value={m.landmark} onChange={e=>update(m.id,{landmark:e.target.value})} placeholder="Visible landmark / feature identified" className="w-full rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/>
   <input value={m.referenceUrl} onChange={e=>update(m.id,{referenceUrl:e.target.value})} placeholder="Independent imagery / reference URL" className="w-full rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/>
   <div className="grid grid-cols-2 gap-2">
    <input value={m.provider} onChange={e=>update(m.id,{provider:e.target.value})} placeholder="Provider / archive" className="rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/>
    <input value={m.sensor} onChange={e=>update(m.id,{sensor:e.target.value})} placeholder="Sensor / imagery type" className="rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/>
    <input type="date" value={m.imageryDate} onChange={e=>update(m.id,{imageryDate:e.target.value})} className="rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/>
    <input type="number" min="0.01" value={m.resolutionMeters} onChange={e=>update(m.id,{resolutionMeters:e.target.value})} placeholder="Resolution (m)" className="rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/>
   </div>
   <select value={m.matchType} onChange={e=>update(m.id,{matchType:e.target.value})} className="rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"><option value="DISTINCTIVE_LANDMARK">Distinctive landmark</option><option value="ROAD_NETWORK">Road network</option><option value="COASTLINE">Coastline</option><option value="TERRAIN">Terrain</option><option value="BUILT_ENVIRONMENT">Built environment</option><option value="OTHER">Other</option></select>
   <textarea value={m.visualRationale} onChange={e=>update(m.id,{visualRationale:e.target.value})} placeholder="Explain the visual match: orientation, shape, relative positions, distinctive features, why alternatives were excluded…" rows={2} className="w-full rounded bg-black/40 border border-white/10 p-2 text-[10px] text-white"/>
   <div className="text-[8px] text-white/35">Reference host: {(()=>{try{return new URL(m.referenceUrl).hostname}catch{return 'not set'}})()}</div>
  </div>)}
  <div className="grid grid-cols-2 gap-1">{Object.entries(gates).map(([label,ok])=><div key={label} className="text-[8px] flex items-center gap-1 text-white/55">{ok?<ShieldCheck size={10} className="text-emerald-400"/>:<AlertTriangle size={10} className="text-amber-400"/>}{label}</div>)}</div>
  <button type="button" onClick={save} disabled={!name.trim()||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))} className="rounded bg-sky-500/20 border border-sky-300/30 px-3 py-2 text-[9px] font-bold text-sky-100 disabled:opacity-40"><Save size={11} className="inline mr-1"/>Save visual geolocation review</button>
  {saved&&<p className="text-[8px] text-emerald-300">Review saved to the investigation draft. Save the investigation to persist it.</p>}
  <p className="text-[8px] text-white/30">A complete gate checklist means provenance and analyst review fields are recorded. It does not prove the proposed location. Distinct domains may share upstream imagery or ownership. No automated landmark recognition is claimed.</p>
 </section>;
};
export default VisualGeolocationReview;
