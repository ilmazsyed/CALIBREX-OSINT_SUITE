import React, { useState } from 'react';
import { api } from '../lib/api';
import { Video, Loader2 } from 'lucide-react';

const VideoEvidenceAction: React.FC<{url:string;onApply:(patch:any)=>void}> = ({url,onApply}) => {
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState<any>(null);
  const [error,setError]=useState('');
  const [applied,setApplied]=useState(false);
  const extract=async()=>{
    setLoading(true);setError('');setApplied(false);
    try{setResult(await api<any>('/media/video-metadata?u='+encodeURIComponent(url)));}
    catch(e:any){setError(e.message||'Could not extract video metadata.');}
    finally{setLoading(false);}
  };
  const apply=()=>{
    if(!result?.metadataFound)return;
    const patch:any={
      metadataOrigin:'SOURCE_VIDEO_CONTAINER',metadataSource:url,
      videoSha256:result.video?.sha256||null,
      sourceTimestamp:result.creationTime||null,
      locationMethod:result.location?'VIDEO_ISO6709':'VIDEO_CONTAINER_METADATA',
      videoMetadata:{containerCreationTime:result.creationTime||null,locationRaw:result.locationRaw||null,locationStandard:result.locationStandard||null}
    };
    if(result.location){patch.lat=result.location.lat;patch.lon=result.location.lon;}
    onApply(patch);setApplied(true);
  };
  if(!/^https?:\/\//i.test(url||''))return null;
  return <div className="mt-2 rounded border border-white/10 bg-black/20 p-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] uppercase tracking-widest text-white/45">Video metadata · MP4 / QuickTime</span>
      <button type="button" onClick={extract} disabled={loading} className="text-[9px] font-bold text-calibrex-gold hover:underline disabled:opacity-50">
        {loading?<><Loader2 size={10} className="inline animate-spin mr-1"/>Extracting…</>:<><Video size={10} className="inline mr-1"/>Extract metadata</>}
      </button>
    </div>
    {result&&<div className="mt-2 text-[9px] text-white/60">
      {result.metadataFound?<>
        <div>{result.location?('ISO 6709 GPS '+result.location.lat.toFixed(5)+', '+result.location.lon.toFixed(5)):'No embedded location'} · {result.creationTime||'No container creation time'}</div>
        <div className="text-white/35 mt-1">SHA-256 {result.video?.sha256?.slice(0,20)}… · {result.video?.bytes} bytes</div>
        <button type="button" onClick={apply} disabled={applied} className="mt-2 rounded border border-calibrex-teal/30 px-2 py-1 text-[9px] font-bold text-calibrex-teal disabled:opacity-50">{applied?'Metadata attached to draft':'Attach metadata to evidence'}</button>
      </>:<span>No supported capture-time or location tags found.</span>}
    </div>}
    {error&&<div className="mt-1 text-[9px] text-red-300">{error}</div>}
    <div className="mt-1 text-[8px] text-white/30">Container creation time may not be camera capture time. Embedded location tags can be edited or copied; no video frames are analysed.</div>
  </div>;
};
export default VideoEvidenceAction;
