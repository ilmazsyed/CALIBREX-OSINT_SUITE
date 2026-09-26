
import React, { useEffect, useRef, useState } from 'react';
import L from '../lib/leafletHeat';
import { Threat } from '../types';
import world from '../lib/world.json';
import { Flame, Map as MapIcon, Zap, Activity, Shield } from 'lucide-react';

interface ThreatMapProps {
  threats: Threat[];
  onInvestigate?: (query: string) => void;
}

const ThreatMap: React.FC<ThreatMapProps> = ({ threats, onInvestigate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<any>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const onInvestigateRef = useRef(onInvestigate);

  useEffect(() => {
    onInvestigateRef.current = onInvestigate;
  }, [onInvestigate]);

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

    map.on('popupopen', (e) => {
      const container = e.popup.getElement();
      if (container) {
        const btn = container.querySelector('.map-investigate-btn');
        if (btn) {
          const handler = (ev: any) => {
            const query = ev.currentTarget.getAttribute('data-query');
            if (onInvestigateRef.current && query) {
              onInvestigateRef.current(query);
            }
          };
          btn.addEventListener('click', handler);
          (e.popup as any)._investigateHandler = handler; 
        }
      }
    });

    map.on('popupclose', (e) => {
      const container = e.popup.getElement();
      if (container && (e.popup as any)._investigateHandler) {
        const btn = container.querySelector('.map-investigate-btn');
        if (btn) btn.removeEventListener('click', (e.popup as any)._investigateHandler);
      }
    });

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
      if (threat.coordinates) {
        const color = threat.severity === 'CRITICAL' ? '#ff4444' : 
                     threat.severity === 'HIGH' ? '#ff9900' : 
                     threat.severity === 'MEDIUM' ? '#ffcc00' : '#44cc44';
        
        const customIcon = L.divIcon({
          className: 'osint-marker',
          html: `<div class="marker-pulse" style="color: ${color}"></div><div class="marker-pin" style="background-color: ${color}"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker(threat.coordinates, { icon: customIcon });
        marker.addTo(markersRef.current!);
        marker.on('click', () => map.flyTo(threat.coordinates!, 5, { duration: 1.2 }));

        const query = `Analyze tactical vector: ${threat.title} in ${threat.location}. Include SATP data and strategic implications.`;
        const escAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

        marker.bindPopup(`
          <div class="bg-calibrex-navy/95 backdrop-blur-xl p-5 border border-white/10 rounded-2xl shadow-2xl min-w-[280px]">
            <div class="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
              <div class="text-[9px] font-black text-calibrex-gold uppercase tracking-[0.2em]">${threat.severity} SIGNAL</div>
              <div class="w-2 h-2 rounded-full bg-calibrex-teal animate-pulse"></div>
            </div>
            <div class="text-base font-black text-white mb-4 uppercase leading-tight tracking-tight">${threat.title}</div>
            <div class="space-y-2 mb-6 bg-black/30 p-3 rounded-xl border border-white/5">
              ${threat.details.slice(0, 3).map(d => `
                <div class="flex justify-between text-[10px] items-center border-b border-white/5 pb-1 last:border-0 last:pb-0">
                  <span class="text-white/40 font-mono uppercase tracking-tighter">${d.label}</span>
                  <span class="text-white font-bold text-right">${d.value}</span>
                </div>
              `).join('')}
            </div>
            <button class="map-investigate-btn w-full bg-calibrex-gold hover:bg-white text-calibrex-navy px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg group" data-query="${escAttr(query)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="group-hover:rotate-12 transition-transform"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              Investigate
            </button>
          </div>
        `, { className: 'custom-osint-popup', closeButton: false, offset: [0, -5] });
      }
    });

  }, [threats, showHeatmap]);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative z-0 group bg-calibrex-dark">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      <div className="absolute top-4 left-4 z-[400] flex flex-col gap-3">
        <div className="bg-black/60 border border-calibrex-gold/20 backdrop-blur-md p-3 sm:p-4 rounded-2xl flex flex-col gap-1 shadow-2xl pointer-events-none">
          <div className="text-[8px] sm:text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em] mb-0.5 sm:mb-1">Active Signals</div>
          <div className="text-xl sm:text-2xl font-black text-white leading-none tracking-tighter">{threats.length}</div>
        </div>

        <button 
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`flex flex-col items-center justify-center w-full gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform active:scale-95 group ${
            showHeatmap 
            ? 'bg-calibrex-critical text-white border-calibrex-critical' 
            : 'bg-black/60 border-white/10 text-calibrex-gold hover:border-calibrex-gold/50'
          }`}
        >
          {showHeatmap ? <MapIcon size={20} className="sm:size-6" /> : <Flame size={20} className="sm:size-6 animate-pulse" />}
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] leading-none mt-1">Thermal</span>
        </button>
      </div>

      <div className="absolute bottom-4 right-4 z-[400] pointer-events-none">
        <div className="text-[8px] font-mono text-white/30 tracking-tighter bg-black/60 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/10 flex items-center gap-2">
          <Zap size={10} className="text-calibrex-teal" />
          UPLINK: SAT-NAV-88 | {showHeatmap ? 'MODE: THERMAL' : 'MODE: ACTIVE'}
        </div>
      </div>
    </div>
  );
};

export default ThreatMap;
