import React, { useState } from 'react';
import { api } from '../lib/api';
import { Camera, Loader2 } from 'lucide-react';

const ExifEvidenceAction: React.FC<{url:string;onApply:(patch:any)=>void}> = ({url,onApply}) => {
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState<any>(null);
  const [error,setError]=useState('');
  const [applied,setApplied]=useState(false);
  const extract=async()=>{
    setLoading(true);setError('');setApplied(false);
    try{const r=await api<any>('/media/exif?u='+encodeURIComponent(url));setResult(r);}
    catch(e:any){setError(e.message||'Could not extract image metadata.');}
    finally{setLoading(false);}
  };
  const apply=()=>{
    if(!result?.metadataFound)return;
    const m=result.metadata||{},coords=result.evidence?.decimalCoordinates;
    const patch:any={
      metadataOrigin:'SOURCE_EXIF',metadataSource:url,imageSha256:result.image?.sha256||null,
      locationMethod:coords?.lat!=null&&coords?.lon!=null?'EXIF_GPS':'EXIF_METADATA',
      exif:{
        GPSLatitude:m.gpsLatitude||null,GPSLatitudeRef:m.gpsLatitudeRef||'',
        GPSLongitude:m.gpsLongitude||null,GPSLongitudeRef:m.gpsLongitudeRef||'',
        DateTimeOriginal:m.dateTimeOriginal||'',OffsetTimeOriginal:m.offsetTimeOriginal||'',
        GPSHPositioningError:m.gpsHPositioningError??null,GPSDateStamp:m.gpsDateStamp||'',
        GPSTimeStamp:m.gpsTimeStamp||null
      }
    };
    if(coords?.lat!=null&&coords?.lon!=null){patch.lat=coords.lat;patch.lon=coords.lon;}
    if(Number.isFinite(result.evidence?.accuracyMeters))patch.accuracyMeters=result.evidence.accuracyMeters;
    onApply(patch);setApplied(true);
  };
  if(!/^https?:\/\//i.test(url||''))return null;
  return <div className="mt-2 rounded border border-white/10 bg-black/20 p-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] uppercase tracking-widest text-white/45">Image metadata · JPEG</span>
      <button type="button" onClick={extract} disabled={loading} className="text-[9px] font-bold text-calibrex-gold hover:underline disabled:opacity-50">
        {loading?<><Loader2 size={10} className="inline animate-spin mr-1"/>Extracting…</>:<><Camera size={10} className="inline mr-1"/>Extract EXIF</>}
      </button>
    </div>
    {result&&<div className="mt-2 text-[9px] text-white/60">
      {result.metadataFound?<>
        <div>{result.evidence?.decimalCoordinates?.lat!=null?('GPS '+result.evidence.decimalCoordinates.lat.toFixed(5)+', '+result.evidence.decimalCoordinates.lon.toFixed(5)):'No usable GPS coordinates'} · {result.evidence?.capturedAt||'No capture timestamp'}</div>
        <div className="text-white/35 mt-1">SHA-256 {result.image?.sha256?.slice(0,20)}… · {result.image?.bytes} bytes</div>
        <button type="button" onClick={apply} disabled={applied} className="mt-2 rounded border border-calibrex-teal/30 px-2 py-1 text-[9px] font-bold text-calibrex-teal disabled:opacity-50">{applied?'Metadata attached to draft':'Attach metadata to evidence'}</button>
      </>:<span>No EXIF metadata found in this JPEG.</span>}
    </div>}
    {error&&<div className="mt-1 text-[9px] text-red-300">{error}</div>}
    <div className="mt-1 text-[8px] text-white/30">EXIF can be edited or copied. Extracted fields remain analyst-reviewed leads, not proof of capture location or time.</div>
  </div>;
};
export default ExifEvidenceAction;
