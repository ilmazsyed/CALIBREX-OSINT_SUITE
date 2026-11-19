import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Video, Upload, Camera, Loader2, Trash2 } from 'lucide-react';

type Keyframe = {
  id:string; timestampSeconds:number; timecode:string; sha256:string;
  previewDataUrl:string; extractedAt:string; sourceUrl:string;
  visualNote:string; candidateLocation:{name:string;lat:number|null;lon:number|null;status:'UNVERIFIED'}|null;
};
type Props = { url:string; existing:any; onApply:(patch:any)=>void };

const MAX_FRAMES=6, MAX_PREVIEW_CHARS=80000;
const timecode=(seconds:number)=>{
  const s=Math.max(0,Math.floor(seconds)),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),r=s%60;
  return [h,m,r].map(n=>String(n).padStart(2,'0')).join(':');
};

const VideoKeyframeReview:React.FC<Props> = ({url,existing,onApply})=>{
  const videoRef=useRef<HTMLVideoElement|null>(null),fileRef=useRef<HTMLInputElement|null>(null);
  const [localUrl,setLocalUrl]=useState(''),[fileName,setFileName]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [visualNote,setVisualNote]=useState(''),[candidateName,setCandidateName]=useState('');
  const [candidateLat,setCandidateLat]=useState(''),[candidateLon,setCandidateLon]=useState('');
  const frames:Keyframe[]=useMemo(()=>Array.isArray(existing?.keyframes)?existing.keyframes.slice(0,MAX_FRAMES):[],[existing]);
  const source=localUrl||url;
  useEffect(()=>()=>{if(localUrl)URL.revokeObjectURL(localUrl);},[localUrl]);
  const selectFile=(file?:File)=>{
    if(!file)return;
    if(!/^video\/(mp4|quicktime|webm)$/i.test(file.type)&&! /\.(mp4|mov|webm)$/i.test(file.name)){setError('Choose an MP4, MOV or WebM video file.');return;}
    if(file.size>250*1024*1024){setError('Local review is limited to 250 MB per video.');return;}
    if(localUrl)URL.revokeObjectURL(localUrl);
    setLocalUrl(URL.createObjectURL(file));setFileName(file.name);setError('');
  };
  const capture=async()=>{
    const video=videoRef.current;
    if(!video||!Number.isFinite(video.currentTime)||video.readyState<2){setError('Wait until the video has loaded and a frame is visible.');return;}
    if(frames.length>=MAX_FRAMES){setError('This evidence item is limited to six saved keyframes.');return;}
    setBusy(true);setError('');
    try{
      const width=Math.min(480,video.videoWidth||480),height=Math.max(1,Math.round(width*(video.videoHeight||270)/(video.videoWidth||480)));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d');if(!context)throw new Error('Could not create frame canvas.');
      context.drawImage(video,0,0,width,height);
      const blob:Blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Frame capture failed. The source may block browser capture.')),'image/jpeg',0.55));
      const buffer=await blob.arrayBuffer();
      const digest=await crypto.subtle.digest('SHA-256',buffer);
      const sha256=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
      const reader=new FileReader();
      const previewDataUrl:string=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Could not encode the keyframe preview.'));reader.readAsDataURL(blob);});
      if(previewDataUrl.length>MAX_PREVIEW_CHARS)throw new Error('Preview exceeds the safe storage limit. Capture a simpler frame.');
      const lat=candidateLat.trim()===''?null:Number(candidateLat),lon=candidateLon.trim()===''?null:Number(candidateLon);
      if((lat!==null||lon!==null)&&(!Number.isFinite(lat)||!Number.isFinite(lon)||lat! < -90||lat! > 90||lon! < -180||lon! > 180))throw new Error('Candidate coordinates must be a valid latitude and longitude pair.');
      const frame:Keyframe={
        id:crypto.randomUUID(),timestampSeconds:Number(video.currentTime.toFixed(3)),timecode:timecode(video.currentTime),
        sha256,previewDataUrl,extractedAt:new Date().toISOString(),sourceUrl:localUrl?'LOCAL_UPLOAD':url,
        visualNote:visualNote.trim().slice(0,500),
        candidateLocation:candidateName.trim()||lat!==null||lon!==null?{name:candidateName.trim().slice(0,160),lat,lon,status:'UNVERIFIED'}:null
      };
      onApply({videoMetadata:{...(existing||{}),keyframes:[...frames,frame]}});
      setVisualNote('');setError('');
    }catch(e:any){setError(e.message||'Keyframe capture failed.');}
    finally{setBusy(false);}
  };
  const remove=(id:string)=>onApply({videoMetadata:{...(existing||{}),keyframes:frames.filter(f=>f.id!==id)}});
  if(!/^https?:\/\//i.test(url||'')&&!localUrl)return null;
  return <div className="mt-2 rounded border border-white/10 bg-black/20 p-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[9px] uppercase tracking-widest text-white/50">Visual keyframe review</span>
      <button type="button" onClick={()=>fileRef.current?.click()} className="text-[9px] font-bold text-calibrex-gold"><Upload size={10} className="inline mr-1"/>Use local video</button>
      <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm,.mov" className="hidden" onChange={e=>selectFile(e.target.files?.[0])}/>
    </div>
    {localUrl&&<div className="text-[9px] text-white/45 my-1">{fileName} · local browser review only</div>}
    <video ref={videoRef} key={source} src={source} crossOrigin={localUrl?'':'anonymous'} controls preload="metadata" className="mt-2 w-full max-h-56 rounded bg-black" onError={()=>setError('Video could not be loaded for browser frame capture. Try a local copy of the video.')}/>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
      <label className="text-[8px] text-white/45">Visual note<input value={visualNote} onChange={e=>setVisualNote(e.target.value)} maxLength={500} placeholder="Describe visible objects, landmarks, signage…" className="mt-1 w-full rounded bg-white/5 border border-white/10 p-2 text-[10px] text-white"/></label>
      <label className="text-[8px] text-white/45">Candidate location name<input value={candidateName} onChange={e=>setCandidateName(e.target.value)} maxLength={160} placeholder="Analyst hypothesis — not verified" className="mt-1 w-full rounded bg-white/5 border border-white/10 p-2 text-[10px] text-white"/></label>
      <label className="text-[8px] text-white/45">Candidate latitude<input value={candidateLat} onChange={e=>setCandidateLat(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded bg-white/5 border border-white/10 p-2 text-[10px] text-white"/></label>
      <label className="text-[8px] text-white/45">Candidate longitude<input value={candidateLon} onChange={e=>setCandidateLon(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded bg-white/5 border border-white/10 p-2 text-[10px] text-white"/></label>
    </div>
    <button type="button" onClick={capture} disabled={busy||frames.length>=MAX_FRAMES} className="mt-2 rounded border border-calibrex-teal/30 px-2 py-1 text-[9px] font-bold text-calibrex-teal disabled:opacity-40">
      {busy?<><Loader2 size={10} className="inline animate-spin mr-1"/>Capturing…</>:<><Camera size={10} className="inline mr-1"/>Save current frame ({frames.length}/{MAX_FRAMES})</>}
    </button>
    {!!frames.length&&<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">{frames.map(frame=><div key={frame.id} className="rounded border border-white/10 p-1">
      <img src={frame.previewDataUrl} alt={'Video keyframe at '+frame.timecode} className="w-full aspect-video object-contain rounded bg-black"/>
      <div className="flex justify-between items-center mt-1"><span className="text-[9px] text-white/70">{frame.timecode}</span><button type="button" onClick={()=>remove(frame.id)} className="text-red-300" aria-label="Remove keyframe"><Trash2 size={11}/></button></div>
      {frame.visualNote&&<p className="text-[8px] text-white/50 mt-1">{frame.visualNote}</p>}
      {frame.candidateLocation&&<p className="text-[8px] text-amber-200 mt-1">Unverified candidate: {frame.candidateLocation.name||'Coordinate candidate'}{frame.candidateLocation.lat!=null?' · '+frame.candidateLocation.lat+', '+frame.candidateLocation.lon:''}</p>}
      <p className="text-[7px] text-white/25 mt-1 break-all">SHA-256 {frame.sha256}</p>
    </div>)}</div>}
    {error&&<div className="mt-2 text-[9px] text-red-300">{error}</div>}
    <p className="mt-2 text-[8px] text-white/30">Frames are captured locally in your browser; only compressed previews and hashes are saved. Visual location candidates remain unverified and are not plotted as case evidence until separately corroborated.</p>
  </div>;
};
export default VideoKeyframeReview;
