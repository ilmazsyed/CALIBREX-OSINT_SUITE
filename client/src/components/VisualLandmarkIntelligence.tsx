import React,{useState} from 'react';
import {api} from '../lib/api';
import {Eye,Upload,MapPin,Loader2,AlertTriangle,CheckCircle2,ExternalLink} from 'lucide-react';

type Result=any;
const VisualLandmarkIntelligence:React.FC<{onResult:(result:Result)=>void;onSelect:(candidate:any)=>void}> = ({onResult,onSelect})=>{
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result>(null),[fileName,setFileName]=useState('');
 const analyse=async(file?:File)=>{
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Choose a JPEG, PNG or WebP image.');return;}
  if(file.size>12*1024*1024){setError('Image must be 12 MB or smaller.');return;}
  setBusy(true);setError('');setResult(null);setFileName(file.name);
  try{
   const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Could not read the selected image.'));reader.readAsDataURL(file);});
   const comma=dataUrl.indexOf(',');const dataB64=comma>=0?dataUrl.slice(comma+1):'';
   const out=await api<Result>('/geoint/visual-analyze',{method:'POST',body:{mime:file.type,dataB64,analystContext:'Identify only visible visual clues. Do not infer a location without distinctive evidence.'}});
   setResult(out);onResult(out);
  }catch(e:any){setError(e.message||'Visual analysis failed.');}
  finally{setBusy(false);}
 };
 return <section className="rounded-lg border border-violet-400/20 bg-violet-400/[0.035] p-3 space-y-3">
  <div className="flex items-center gap-2"><Eye size={14} className="text-violet-200"/><div><h4 className="text-[10px] uppercase tracking-widest font-bold text-violet-100">AI visual landmark intelligence</h4><p className="text-[8px] text-white/40">Multimodal scene analysis · landmark leads · OpenStreetMap gazetteer candidates</p></div></div>
  <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-violet-300/30 p-3 text-[9px] text-violet-100 hover:bg-violet-300/5"><Upload size={14}/><span>{busy?'Analysing image…':fileName||'Upload source image for visual analysis'}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={e=>analyse(e.target.files?.[0])}/></label>
  {busy&&<div className="flex items-center gap-2 text-[9px] text-white/50"><Loader2 size={12} className="animate-spin"/>Vision model analysing visual features and named landmark clues…</div>}
  {error&&<p className="text-[9px] text-amber-200">{error}</p>}
  {result&&<div className="space-y-2">
   <div className="flex items-center gap-2 text-[9px] text-emerald-200"><CheckCircle2 size={11}/>Scene analysis complete · {result.modelProvider} / {result.model}</div>
   <p className="text-[10px] text-white/75">{result.scene?.sceneDescription||'No scene description returned.'}</p>
   <div className="flex flex-wrap gap-1">{(result.scene?.visibleFeatures||[]).map((f:any,i:number)=><span key={i} className="rounded bg-white/5 px-2 py-1 text-[8px] text-white/60">{f.feature} · {f.distinctiveness}</span>)}</div>
   {!!result.scene?.textObserved?.length&&<div><div className="text-[8px] uppercase text-white/40">Visible text</div>{result.scene.textObserved.map((t:any,i:number)=><div key={i} className="text-[9px] text-white/65">“{t.text}” · {t.locationInImage}</div>)}</div>}
   <div className="text-[8px] uppercase tracking-wider text-white/45">Named landmark candidates · search leads only</div>
   {(result.landmarkCandidates||[]).length?result.landmarkCandidates.map((c:any,i:number)=><div key={i} className="rounded border border-white/10 p-2 space-y-1">
    <div className="flex items-start justify-between gap-2"><div className="text-[10px] font-semibold text-white/85">{c.name||c.disambiguationQuery}</div><span className="text-[8px] text-violet-200">{c.searchStatus}</span></div>
    <p className="text-[8px] text-white/55">{c.visualRationale}</p>
    {c.locations?.map((p:any,j:number)=><div key={j} className="flex items-center justify-between gap-2 border-t border-white/5 pt-1"><div className="text-[8px] text-white/55">{p.displayName} · {p.lat.toFixed(5)}, {p.lon.toFixed(5)}</div><button type="button" onClick={()=>onSelect({name:p.name||c.name,lat:p.lat,lon:p.lon,displayName:p.displayName,provider:'OpenStreetMap Nominatim',placeId:p.placeId,visualRationale:c.visualRationale,landmark:c.name})} className="shrink-0 rounded border border-violet-300/30 px-2 py-1 text-[8px] text-violet-100"><MapPin size={9} className="inline mr-1"/>Use candidate</button></div>)}
    {c.searchStatus==='NO_MATCH'&&<p className="text-[8px] text-amber-200">No gazetteer result. Do not create coordinates from this name alone.</p>}
   </div>):<p className="text-[9px] text-white/45">No distinctive named landmark could be proposed from this image.</p>}
   {!!result.geolocationLimitations?.length&&<div className="text-[8px] text-amber-100/70"><AlertTriangle size={10} className="inline mr-1"/>Limitations: {result.geolocationLimitations.join(' · ')}</div>}
   <p className="text-[8px] text-white/30">{result.caveats?.join(' ')}</p>
   <div className="text-[8px] text-white/30">Engine: {result.engine} · {new Date(result.generatedAt).toLocaleString()}</div>
  </div>}
 </section>;
};
export default VisualLandmarkIntelligence;
