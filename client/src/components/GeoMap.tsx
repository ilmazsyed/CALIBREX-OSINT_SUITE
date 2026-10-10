import React, { useEffect, useRef } from 'react';
import L from '../lib/leaflet';
import world from '../lib/world.json';
import { GeoEvent } from '../lib/geoint';

const COLORS: Record<string, string> = { CRITICAL: '#ff4444', HIGH: '#ff9f45', MEDIUM: '#e9c46a', LOW: '#3ec9a7' };

/** Plots GEOINT natural events on the embedded (no external tiles) Leaflet map. */
const GeoMap: React.FC<{ events: GeoEvent[]; onPick?: (e: GeoEvent) => void }> = ({ events, onPick }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [20, 40], zoom: 2, minZoom: 1, worldCopyJump: true, attributionControl: false, zoomControl: false });
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
    for (const e of events) {
      if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng)) continue;
      const color = COLORS[e.severity] || COLORS.MEDIUM;
      const m = L.circleMarker([e.lat, e.lng], { radius: e.severity === 'CRITICAL' ? 7 : e.severity === 'HIGH' ? 5 : 4, color, weight: 1, fillColor: color, fillOpacity: 0.75 })
        .bindPopup(`<b>${e.title}</b><br>${e.category}${e.magnitude ? ` · ${e.magnitude}` : ''}${e.india ? ' · 🇮🇳 India' : ''}${e.url ? `<br><a href="${e.url}" target="_blank" rel="noopener noreferrer">source ↗</a>` : ''}`);
      if (pickRef.current) m.on('click', () => pickRef.current?.(e));
      m.addTo(layer);
    }
  }, [events]);

  return <div ref={containerRef} className="w-full h-[420px] rounded-lg overflow-hidden border border-white/10 bg-[#0c1a24]" />;
};

export default GeoMap;
