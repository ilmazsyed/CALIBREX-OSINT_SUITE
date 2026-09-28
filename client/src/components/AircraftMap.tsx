import React, { useEffect, useRef } from 'react';
import L from '../lib/leaflet';
import world from '../lib/world.json';
import { Aircraft } from '../lib/signals';

/** Plots ADS-B aircraft on an embedded (no external tiles) Leaflet map. */
const AircraftMap: React.FC<{ aircraft: Aircraft[] }> = ({ aircraft }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [25, 60], zoom: 3, minZoom: 2, worldCopyJump: true, attributionControl: false, zoomControl: false });
    mapRef.current = map;
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.geoJSON(world as any, { style: { color: 'rgba(42,138,154,0.35)', weight: 1, fillColor: '#0c1a24', fillOpacity: 0.6 } as any }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const a of aircraft) {
      if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) continue;
      const color = a.emergency ? '#ff4444' : a.mil ? '#c9a961' : '#2a8a9a';
      const r = a.emergency ? 6 : a.mil ? 5 : 3;
      L.circleMarker([a.lat, a.lng], { radius: r, color, weight: 1, fillColor: color, fillOpacity: a.emergency || a.mil ? 0.9 : 0.5 })
        .bindPopup(`<b>${a.callsign}</b>${a.mil ? ' · MIL' : ''}${a.emergency ? ` · ⚠ ${a.emergency}` : ''}<br>${a.tag || ''} ${a.altM != null ? `· ${a.altM.toLocaleString()} m` : ''}<br><a href="https://globe.adsbexchange.com/?icao=${encodeURIComponent(a.id)}" target="_blank" rel="noopener noreferrer">track ↗</a>`)
        .addTo(layer);
    }
  }, [aircraft]);

  return <div ref={containerRef} className="w-full h-[420px] rounded-lg overflow-hidden border border-white/10 bg-[#0c1a24]" />;
};

export default AircraftMap;
