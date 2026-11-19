import React, { useEffect, useRef } from 'react';
import L from '../lib/leaflet';
import world from '../lib/world.json';

type GeoEvidence = {
  id:string; title:string; assessment?:string; triage?:string;
  lat?:number|null; lon?:number|null; lng?:number|null; accuracyMeters?:number|null;
  url?:string; source?:string; geospatialContext?:any; locationMethod?:string;
};

const COLOURS:Record<string,string> = {
  FACT:'#36c9a0', CLAIM:'#f0b45a', ASSESSMENT:'#9a8cff', HYPOTHESIS:'#63a7e8', UNKNOWN:'#9aa7b2'
};

const InvestigationEvidenceMap:React.FC<{evidence:GeoEvidence[]}> = ({evidence}) => {
  const container=useRef<HTMLDivElement|null>(null);
  const map=useRef<L.Map|null>(null);
  const layer=useRef<L.LayerGroup|null>(null);
  const rows=evidence.filter(e=>e.lat!=null&&(e.lon!=null||e.lng!=null)&&Number.isFinite(Number(e.lat))&&Number.isFinite(Number(e.lon??e.lng))&&Math.abs(Number(e.lat))<=90&&Math.abs(Number(e.lon??e.lng))<=180);

  useEffect(()=>{
    if(!container.current||map.current)return;
    const instance=L.map(container.current,{center:[20,0],zoom:2,minZoom:1,maxZoom:12,worldCopyJump:true,attributionControl:false,zoomControl:true});
    L.geoJSON(world as any,{interactive:false,style:{color:'rgba(42,138,154,0.45)',weight:0.8,fillColor:'#10212c',fillOpacity:0.8} as any}).addTo(instance);
    layer.current=L.layerGroup().addTo(instance);
    map.current=instance;
    const timer=window.setTimeout(()=>instance.invalidateSize(),150);
    return ()=>{window.clearTimeout(timer);instance.remove();map.current=null;layer.current=null;};
  },[]);

  useEffect(()=>{
    const instance=map.current, group=layer.current;
    if(!instance||!group)return;
    group.clearLayers();
    const points:Array<[number,number]>=[];
    for(const item of rows){
      const lat=Number(item.lat),lon=Number(item.lon??item.lng),colour=COLOURS[item.assessment||'UNKNOWN']||COLOURS.UNKNOWN;
      points.push([lat,lon]);
      const marker=L.circleMarker([lat,lon],{radius:7,color:colour,weight:2,fillColor:colour,fillOpacity:0.9});
      const popup=document.createElement('div');
      const heading=document.createElement('strong');heading.textContent=item.title||'Untitled evidence';popup.appendChild(heading);
      const detail=document.createElement('div');detail.textContent=(item.assessment||'UNKNOWN')+' · '+(item.triage||'NEW')+' · '+lat.toFixed(5)+', '+lon.toFixed(5);popup.appendChild(detail);
      if(item.accuracyMeters!=null&&Number.isFinite(Number(item.accuracyMeters))){
        const accuracy=document.createElement('div');accuracy.textContent='Reported accuracy radius: '+Number(item.accuracyMeters).toLocaleString()+' m';popup.appendChild(accuracy);
        if(Number(item.accuracyMeters)>0&&Number(item.accuracyMeters)<=500000)L.circle([lat,lon],{radius:Number(item.accuracyMeters),color:colour,weight:1,opacity:0.5,fillOpacity:0.05,interactive:false}).addTo(group);
      }
      if(item.geospatialContext?.place){
        const place=document.createElement('div');place.textContent='Provider context: '+[item.geospatialContext.place.name,item.geospatialContext.place.state,item.geospatialContext.place.country].filter(Boolean).join(', ');popup.appendChild(place);
      }
      if(item.locationMethod){const method=document.createElement('div');method.textContent='Method: '+item.locationMethod;popup.appendChild(method);}
      if(item.source){const source=document.createElement('div');source.textContent='Source: '+item.source;popup.appendChild(source);}
      if(item.url){try{const u=new URL(item.url);if(u.protocol==='https:'||u.protocol==='http:'){const a=document.createElement('a');a.href=u.toString();a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open source';popup.appendChild(a);}}catch{}}
      marker.bindPopup(popup).addTo(group);
    }
    if(points.length===1)instance.setView(points[0],9);
    else if(points.length>1)instance.fitBounds(L.latLngBounds(points).pad(0.2),{maxZoom:9});
    else instance.setView([20,0],2);
  },[rows]);

  return <section className="rounded-xl border border-white/10 bg-black/20 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div><h3 className="text-xs font-black uppercase tracking-widest text-white/75">Investigation evidence map</h3><p className="text-[9px] text-white/35">Evidence coordinates and reported uncertainty radii · no inferred pins</p></div>
      <span className="text-[9px] text-white/45">{rows.length} mapped / {evidence.length} evidence records</span>
    </div>
    <div className="flex flex-wrap gap-3 mb-2">{Object.entries(COLOURS).map(([name,colour])=><span key={name} className="flex items-center gap-1 text-[8px] text-white/50"><i className="inline-block h-2 w-2 rounded-full" style={{background:colour}}/>{name}</span>)}</div>
    {rows.length?<div ref={container} className="h-[340px] w-full rounded-lg overflow-hidden border border-white/10 bg-[#0c1a24]"/>:<div className="h-24 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-[10px] text-white/35">No valid evidence coordinates to map yet.</div>}
    <p className="mt-2 text-[8px] text-white/30">Markers represent recorded evidence coordinates, not confirmed event locations. Accuracy circles use source-reported radii and are not independently verified.</p>
  </section>;
};
export default InvestigationEvidenceMap;
