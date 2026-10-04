
import React, { useEffect, useRef, useState } from 'react';
import { openVisuals } from '../lib/visuals';
import L from '../lib/leafletHeat';
import { Threat } from '../types';
import world from '../lib/world.json';
import { Flame, Map as MapIcon, Zap, X, Search, Images, FileText, ExternalLink } from 'lucide-react';

interface ThreatMapProps {
  threats: Threat[];
  onInvestigate?: (query: string) => void;
  onViewThreat?: (threat: Threat) => void;
}

const ThreatMap: React.FC<ThreatMapProps> = ({ threats, onInvestigate, onViewThreat }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<any>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selected, setSelected] = useState<Threat | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 3,
      minZoom: 2,
      maxZoom: 8,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
      keyboard: false, // Leaflet focuses the map on mousedown, which scrolls the page and swallows marker clicks
    });

    mapInstanceRef.current = map;

    // Embedded basemap: artifact pages cannot load external map tiles.
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.geoJSON(world as any, {
      interactive: false,
      style: { color: 'rgba(42,138,154,0.45)', weight: 0.8, fillColor: '#0f1c2b', fillOpacity: 1 },
    }).addTo(map);
    for (let lat = -60; lat <= 80; lat += 20) L.polyline([[lat, -180], [lat, 180]], { color: 'rgba(42,138,154,0.08)', weight: 1, interactive: false }).addTo(map);
    for (let lng = -180; lng <= 180; lng += 30) L.polyline([[-85, lng], [85, lng]], { color: 'rgba(42,138,154,0.08)', weight: 1, interactive: false }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);

    // Initial stabilization delay
    const resizeTimeout = setTimeout(() => map.invalidateSize(), 200);

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersRef.current) return;

    markersRef.current.clearLayers();

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const getIntensity = (severity: string) => {
      switch (severity) {
        case 'CRITICAL': return 1.0;
        case 'HIGH': return 0.8;
        case 'MEDIUM': return 0.5;
        default: return 0.3;
      }
    };

    const heatData = threats
      .filter(t => t.coordinates)
      .map(t => [t.coordinates![0], t.coordinates![1], getIntensity(t.severity)]);

    if (showHeatmap && heatData.length > 0) {
      // @ts-ignore
      heatLayerRef.current = (L as any).heatLayer(heatData, {
        radius: 35,
        blur: 20,
        maxZoom: 10,
        gradient: { 0.2: '#2a8a9a', 0.5: '#ffcc00', 1.0: '#ff4444' }
      }).addTo(map);
    }

    threats.forEach(threat => {
      if (!threat.coordinates) return;
      const hazard = threat.category === 'HAZARD';
      const color = hazard ? '#ffcc00' : threat.severity === 'CRITICAL' ? '#ff4444' :
                   threat.severity === 'HIGH' ? '#ff9900' :
                   threat.severity === 'MEDIUM' ? '#ffcc00' : '#44cc44';

      const customIcon = L.divIcon({
        className: 'osint-marker',
        html: hazard
          ? `<div class="marker-pin" style="background-color: transparent; border: 2px solid ${color}; width: 14px; height: 14px"></div>`
          : `<div class="marker-pulse" style="color: ${color}"></div><div class="marker-pin" style="background-color: ${color}"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker(threat.coordinates, { icon: customIcon });
      marker.addTo(markersRef.current!);
      marker.on('click', () => setSelected(threat));
    });

  }, [threats, showHeatmap]);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative z-0 group bg-calibrex-dark">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      <div className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 z-[350] flex items-start gap-2 sm:flex-col">
        <div className="bg-black/60 border border-calibrex-gold/20 backdrop-blur-md px-2.5 py-1.5 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col leading-none shadow-2xl pointer-events-none">
          <div className="text-[7px] sm:text-[10px] font-black text-calibrex-gold uppercase tracking-[0.15em] sm:mb-1">Active</div>
          <div className="text-base sm:text-2xl font-black text-white leading-none tracking-tighter">{threats.length}</div>
        </div>

        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          aria-label="Toggle thermal heatmap"
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 sm:p-4 rounded-xl sm:rounded-2xl border backdrop-blur-md shadow-2xl transition-all active:scale-95 ${
            showHeatmap ? 'bg-calibrex-critical text-white border-calibrex-critical' : 'bg-black/60 border-white/10 text-calibrex-gold hover:border-calibrex-gold/50'
          }`}
        >
          {showHeatmap ? <MapIcon size={16} className="sm:size-6" /> : <Flame size={16} className="sm:size-6 animate-pulse" />}
          <span className="hidden sm:block text-[10px] font-black uppercase tracking-[0.2em] leading-none mt-1">Thermal</span>
        </button>
      </div>

      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-[350] pointer-events-none">
        <div className="text-[7px] sm:text-[8px] font-mono text-white/30 tracking-tighter bg-black/60 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl backdrop-blur-md border border-white/10 flex items-center gap-1.5">
          <Zap size={9} className="text-calibrex-teal" />
          {showHeatmap ? 'THERMAL' : 'LIVE PLOT'}
        </div>
      </div>

      {/* Threat detail — a separate viewport overlay (bottom sheet on phones), never clipped by the map. */}
      {selected && (() => {
        const t = selected;
        const hazard = t.category === 'HAZARD';
        const query = hazard
          ? `Impact assessment: ${t.title} (${t.location})`
          : `Analyze tactical vector: ${t.title} in ${t.location}. Include actors, recent incidents and strategic implications.`;
        return (
          <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/70 cx-fade" onClick={() => setSelected(null)}>
            <div onClick={e => e.stopPropagation()} className="cx-glass cx-pop w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[88vh] overflow-y-auto custom-scrollbar shadow-2xl" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
              <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
                <span className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em]">{hazard ? 'USGS Hazard' : `${t.severity} Signal`}</span>
                <button onClick={() => setSelected(null)} aria-label="Close" className="text-calibrex-muted hover:text-white"><X size={20} /></button>
              </div>
              <h3 className="text-base font-black text-white uppercase leading-tight tracking-tight mb-2.5 break-words">{t.title}</h3>
              {t.description && <p className="text-xs text-white/70 leading-relaxed mb-3">{t.description}</p>}
              <div className="bg-black/30 rounded-xl border border-white/5 p-3 mb-3 space-y-1.5">
                {t.details.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex justify-between gap-3 text-[11px] items-center border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-white/40 font-mono uppercase tracking-tighter shrink-0">{d.label}</span>
                    <span className="text-white font-bold text-right">{d.value}</span>
                  </div>
                ))}
              </div>
              {(t.sources || []).length > 0 && (
                <div className="space-y-1.5 mb-4">
                  {(t.sources || []).slice(0, 4).map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 text-[11px] text-calibrex-teal hover:underline"><ExternalLink size={11} className="shrink-0 mt-0.5" /><span className="min-w-0 break-words">{s.source}: {s.title}</span></a>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => { onInvestigate?.(query); setSelected(null); }} className="flex-1 bg-calibrex-gold hover:bg-white text-calibrex-navy px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 shadow-lg"><Search size={14} /> Investigate</button>
                {!hazard && <button onClick={() => { onViewThreat?.(t); setSelected(null); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"><FileText size={14} /> Threat Wire</button>}
              </div>
              <button onClick={() => { openVisuals({ title: t.title, urls: (t.sources || []).map(x => x.url).slice(0, 8), lat: t.coordinates?.[0], lng: t.coordinates?.[1], place: t.location, severity: t.severity }); setSelected(null); }} className="mt-2 w-full border border-calibrex-gold/50 text-calibrex-gold hover:bg-calibrex-gold/10 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"><Images size={14} /> Visual intel: photos &amp; satellite</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ThreatMap;
