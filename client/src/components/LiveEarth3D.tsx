import React, { useEffect, useRef, useState } from 'react';
import * as satellite from 'satellite.js';
import { Globe2, Loader2, Crosshair, Layers, X, ArrowRight, ExternalLink, Radio, Satellite } from 'lucide-react';
import { getWorldmap, MapPoint, LayerId } from '../lib/worldmap';
import { getSatellites } from '../lib/satellites';
import { openReader, timeAgo } from '../lib/live';

// Cesium is ~5MB — load it (and its stylesheet) on demand the first time the 3D
// view opens, so it never weighs on first paint. Keyless: no Cesium ion.
declare global { interface Window { Cesium?: any; CESIUM_BASE_URL?: string } }
let cesiumPromise: Promise<any> | null = null;
function loadCesium(): Promise<any> {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (cesiumPromise) return cesiumPromise;
  cesiumPromise = new Promise((resolve, reject) => {
    window.CESIUM_BASE_URL = '/cesium/';
    if (!document.getElementById('cesium-css')) {
      const l = document.createElement('link'); l.id = 'cesium-css'; l.rel = 'stylesheet'; l.href = '/cesium/Widgets/widgets.css'; document.head.appendChild(l);
    }
    const s = document.createElement('script'); s.src = '/cesium/Cesium.js'; s.async = true;
    s.onload = () => (window.Cesium ? resolve(window.Cesium) : reject(new Error('Cesium missing')));
    s.onerror = () => reject(new Error('Cesium failed to load'));
    document.head.appendChild(s);
  });
  return cesiumPromise;
}

const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const LAYER_COLOR: Record<string, string> = {
  hotspots: '#e9c46a', conflict: '#ff4d4d', fire: '#ff7a1a', quake: '#ffb020',
  natural: '#39b0c4', maritime: '#48cae4', vessels: '#5ad1a5', aircraft: '#cfe8ff',
  outages: '#b57edc', convergence: '#ffd166',
};
const LAYER_LABEL: Record<string, string> = {
  aircraft: 'Aircraft', vessels: 'Vessels', fire: 'Fires', quake: 'Quakes',
  conflict: 'Conflict', hotspots: 'Hotspots', maritime: 'Maritime', natural: 'Natural',
  outages: 'Outages', convergence: 'Convergence',
};
// Start lean and readable: aircraft + conflict (satellites are always on). The
// user turns on more from the Layers panel.
const DEFAULT_ON: Record<string, boolean> = { aircraft: true, vessels: false, fire: false, quake: false, conflict: true, hotspots: false, maritime: false, natural: false, outages: false, convergence: false };
// Short description of what each dot type is, shown in the legend.
const LAYER_WHAT: Record<string, string> = {
  aircraft: 'Planes flying now (ADS-B)', vessels: 'Ships at sea (AIS)', fire: 'Active wildfires (NASA)',
  quake: 'Recent earthquakes (USGS)', conflict: 'Armed-conflict events', hotspots: 'Threat hotspots from the wire',
  maritime: 'Shipping incidents & chokepoints', natural: 'Natural events (NASA EONET)', outages: 'Internet outages (IODA)',
  convergence: 'Where multiple streams stack up',
};

const FILTERS = ['none', 'nvg', 'thermal', 'scan'] as const;
type Filter = typeof FILTERS[number];
const FILTER_LABEL: Record<Filter, string> = { none: 'Daylight', nvg: 'Night vision', thermal: 'Thermal', scan: 'Scanline' };

// Cesium post-process fragment shaders (modern GLSL: `in` + out_FragColor + texture()).
const SHADERS: Record<Exclude<Filter, 'none'>, string> = {
  nvg: `uniform sampler2D colorTexture; in vec2 v_textureCoordinates; void main(){ vec4 c=texture(colorTexture,v_textureCoordinates); float l=dot(c.rgb,vec3(0.299,0.587,0.114)); vec2 d=v_textureCoordinates-0.5; float vig=smoothstep(0.85,0.15,length(d)); float n=fract(sin(dot(v_textureCoordinates*vec2(1234.5,6789.1),vec2(12.9898,78.233)))*43758.5453)*0.06; out_FragColor=vec4(vec3(0.05,1.0,0.15)*((l*1.4)+n)*vig,1.0); }`,
  thermal: `uniform sampler2D colorTexture; in vec2 v_textureCoordinates; void main(){ vec4 c=texture(colorTexture,v_textureCoordinates); float l=dot(c.rgb,vec3(0.299,0.587,0.114)); vec3 cold=vec3(0.0,0.0,0.3); vec3 warm=vec3(1.0,0.85,0.2); vec3 hot=vec3(1.0,0.2,0.1); vec3 col=mix(cold,warm,smoothstep(0.2,0.7,l)); col=mix(col,hot,smoothstep(0.7,1.0,l)); out_FragColor=vec4(col,1.0); }`,
  scan: `uniform sampler2D colorTexture; in vec2 v_textureCoordinates; void main(){ vec4 c=texture(colorTexture,v_textureCoordinates); float s=sin(v_textureCoordinates.y*900.0)*0.05; vec2 d=v_textureCoordinates-0.5; float vig=smoothstep(1.1,0.2,length(d)); out_FragColor=vec4((c.rgb-s)*vig,1.0); }`,
};

const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

interface Props { onInvestigate?: (q: string) => void }

// Clicking a point shows exactly what it is (no jump to search). onInvestigate
// is accepted for API symmetry with the other views but intentionally unused.
const LiveEarth3D: React.FC<Props> = () => {
  const host = useRef<HTMLDivElement>(null);
  const czRef = useRef<any>(null);
  const viewerRef = useRef<any>(null);
  const sourcesRef = useRef<Record<string, any>>({});
  const satSourceRef = useRef<any>(null);
  const satRecsRef = useRef<{ rec: any; entity: any }[]>([]);
  const stageRef = useRef<any>(null);
  const [webgl] = useState(hasWebGL);
  const [status, setStatus] = useState('Loading the 3D globe…');
  const [ready, setReady] = useState(false);
  const [lite, setLite] = useState(false);
  const [layers, setLayers] = useState<Record<string, boolean>>(DEFAULT_ON);
  const [filter, setFilter] = useState<Filter>('none');
  const [sel, setSel] = useState<{ title: string; kind: string; rows: [string, string][]; url?: string; follow?: boolean } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [, setNowTick] = useState(0);        // re-renders the "synced Xs ago" label

  // keep the "synced ago" label fresh without re-rendering the globe
  useEffect(() => { const t = setInterval(() => setNowTick(n => n + 1), 15000); return () => clearInterval(t); }, []);

  // ---- init (once) ----------------------------------------------------------
  useEffect(() => {
    if (!webgl || !host.current) return;
    let destroyed = false;
    const mobile = matchMedia('(max-width: 820px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
    setLite(mobile);
    let tick: any, liveT: any, satT: any, handler: any;

    (async () => {
      let Cz: any;
      try { Cz = await loadCesium(); } catch { if (!destroyed) setStatus('Could not load the 3D globe. Use the 2D map instead.'); return; }
      if (destroyed || !host.current) return;
      czRef.current = Cz;
      Cz.Ion.defaultAccessToken = '';

      let viewer: any;
      try {
        const esri = new Cz.UrlTemplateImageryProvider({ url: ESRI, maximumLevel: 18, credit: 'Imagery © Esri, Maxar, Earthstar' });
        viewer = new Cz.Viewer(host.current, {
          baseLayer: new Cz.ImageryLayer(esri, {}),
          baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
          navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false,
          infoBox: false, selectionIndicator: false, requestRenderMode: true, maximumRenderTimeChange: Infinity,
          terrainProvider: new Cz.EllipsoidTerrainProvider(),
        });
      } catch { if (!destroyed) setStatus('This device could not start the 3D globe.'); return; }
      viewerRef.current = viewer;

      const s = viewer.scene;
      s.globe.maximumScreenSpaceError = mobile ? 6 : 2;
      viewer.resolutionScale = mobile ? 0.7 : 1;
      s.fog.enabled = !mobile;
      s.skyAtmosphere.show = !mobile;
      s.globe.showGroundAtmosphere = !mobile;
      s.globe.enableLighting = false;
      s.screenSpaceCameraController.minimumZoomDistance = 500;
      viewer.camera.setView({ destination: Cz.Cartesian3.fromDegrees(78, 20, 14_000_000) });

      handler = new Cz.ScreenSpaceEventHandler(s.canvas);
      handler.setInputAction((ev: any) => {
        const picked = s.pick(ev.position);
        const e: any = picked?.id;
        if (e && e._cx) {
          let cx = e._cx;
          if (e._sat && e._pos) cx = { ...cx, rows: [...cx.rows, ['Position', `${e._pos.lat.toFixed(2)}, ${e._pos.lon.toFixed(2)}`], ['Altitude', `${Math.round(e._pos.alt)} km`]] };
          setSel(cx);
          if (cx.follow) { viewer.trackedEntity = e; setTracking(true); }
        } else setSel(null);
      }, Cz.ScreenSpaceEventType.LEFT_CLICK);

      try { await loadLive(mobile); if (!destroyed) await loadSats(mobile); } catch { /* keep what loaded */ }
      if (destroyed) return;
      setReady(true); setStatus('');

      tick = setInterval(() => { if (!destroyed) stepSats(); }, mobile ? 2500 : 1500);
      liveT = setInterval(() => { if (!destroyed) loadLive(mobile).catch(() => {}); }, 45_000);
      satT = setInterval(() => { if (!destroyed) loadSats(mobile).catch(() => {}); }, 10 * 60_000);
    })();

    return () => {
      destroyed = true;
      clearInterval(tick); clearInterval(liveT); clearInterval(satT);
      try { handler?.destroy(); } catch { /* */ }
      try { const v = viewerRef.current; if (v && !v.isDestroyed()) v.destroy(); } catch { /* */ }
      viewerRef.current = null; sourcesRef.current = {}; satRecsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl]);

  // ---- layer visibility ------------------------------------------------------
  useEffect(() => {
    for (const [id, ds] of Object.entries(sourcesRef.current)) (ds as any).show = !!layers[id];
    viewerRef.current?.scene.requestRender();
  }, [layers]);

  // ---- sensor filter ---------------------------------------------------------
  useEffect(() => {
    const v = viewerRef.current, Cz = czRef.current; if (!v || !Cz) return;
    if (stageRef.current) { try { v.scene.postProcessStages.remove(stageRef.current); } catch { /* */ } stageRef.current = null; }
    if (filter !== 'none') { try { stageRef.current = v.scene.postProcessStages.add(new Cz.PostProcessStage({ fragmentShader: SHADERS[filter] })); } catch { /* */ } }
    v.scene.requestRender();
  }, [filter, ready]);

  // ---- data loaders ----------------------------------------------------------
  async function loadLive(mobile: boolean) {
    const Cz = czRef.current, viewer = viewerRef.current; if (!Cz || !viewer) return;
    const snap = await getWorldmap();
    const cap: Record<string, number> = mobile
      ? { aircraft: 150, vessels: 150, fire: 200, quake: 150 }
      : { aircraft: 500, vessels: 500, fire: 600, quake: 400 };
    for (const [id, pts] of Object.entries(snap.layers) as [LayerId, MapPoint[]][]) {
      if (!LAYER_COLOR[id]) continue;
      let ds = sourcesRef.current[id];
      if (!ds) { ds = new Cz.CustomDataSource(id); sourcesRef.current[id] = ds; viewer.dataSources.add(ds); ds.show = !!layers[id]; }
      ds.entities.removeAll();
      for (const p of (pts || []).slice(0, cap[id] || 300)) {
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
        const mil = id === 'aircraft' && p.mil;
        const e = ds.entities.add({
          position: Cz.Cartesian3.fromDegrees(p.lng, p.lat, id === 'aircraft' ? 10_000 : 0),
          point: { pixelSize: id === 'aircraft' ? 7 : 6, color: Cz.Color.fromCssColorString(mil ? '#ff5d5d' : LAYER_COLOR[id]), outlineColor: Cz.Color.BLACK.withAlpha(0.6), outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        });
        const rows: [string, string][] = [['Type', LAYER_LABEL[id] + (mil ? ' · military' : '')]];
        if (p.location) rows.push(['Location', p.location]);
        if (p.magnitude) rows.push(['Magnitude', p.magnitude]);
        if (p.severity) rows.push(['Severity', p.severity]);
        if (p.mmsi) rows.push(['MMSI', p.mmsi]);
        if (p.category) rows.push(['Category', p.category]);
        if (typeof p.reports === 'number') rows.push(['Reports', String(p.reports)]);
        if (typeof p.streamCount === 'number') rows.push(['Converging streams', `${p.streamCount}${p.streams?.length ? ` · ${p.streams.join(', ')}` : ''}`]);
        if (p.source) rows.push(['Source', p.source]);
        rows.push(['Coordinates', `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`]);
        if (p.date) rows.push(['Seen', timeAgo(p.date)]);
        e._cx = { title: p.title || LAYER_LABEL[id] || id, kind: id, rows, url: p.url || '', follow: id === 'aircraft' || id === 'vessels' };
      }
    }
    setLastSync(snap.updatedAt || Date.now());
    viewer.scene.requestRender();
  }

  async function loadSats(mobile: boolean) {
    const Cz = czRef.current, viewer = viewerRef.current; if (!Cz || !viewer) return;
    const { satellites: sats } = await getSatellites();
    let ds = satSourceRef.current;
    if (!ds) { ds = new Cz.CustomDataSource('satellites'); satSourceRef.current = ds; viewer.dataSources.add(ds); }
    ds.entities.removeAll(); satRecsRef.current = [];
    for (const sx of sats.slice(0, mobile ? 120 : 260)) {
      try {
        const rec = satellite.twoline2satrec(sx.tle1, sx.tle2);
        const e = ds.entities.add({ position: Cz.Cartesian3.fromDegrees(0, 0, 400_000), point: { pixelSize: 4, color: Cz.Color.fromCssColorString('#7ee8ff'), disableDepthTestDistance: Number.POSITIVE_INFINITY } });
        e._cx = { title: sx.name, kind: 'sat', rows: [['Type', 'Satellite'], ['Catalogue', sx.group], ['Track', 'Live orbital position (SGP4)']], follow: true };
        e._sat = true;
        satRecsRef.current.push({ rec, entity: e });
      } catch { /* bad TLE */ }
    }
    stepSats();
  }

  function stepSats() {
    const Cz = czRef.current, viewer = viewerRef.current; if (!Cz || !viewer || !satRecsRef.current.length) return;
    const now = new Date(); const gmst = satellite.gstime(now);
    for (const s of satRecsRef.current) {
      try {
        const pv: any = satellite.propagate(s.rec, now);
        if (!pv || !pv.position) continue;
        const g = satellite.eciToGeodetic(pv.position, gmst);
        const lon = satellite.degreesLong(g.longitude), lat = satellite.degreesLat(g.latitude);
        s.entity.position = new Cz.ConstantPositionProperty(Cz.Cartesian3.fromDegrees(lon, lat, g.height * 1000));
        s.entity._pos = { lat, lon, alt: g.height };
      } catch { /* skip */ }
    }
    viewer.scene.requestRender();
  }

  const stopFollow = () => { const v = viewerRef.current, Cz = czRef.current; if (v && Cz) { v.trackedEntity = undefined; v.camera.flyTo({ destination: Cz.Cartesian3.fromDegrees(78, 20, 14_000_000), duration: 1.2 }); } setTracking(false); };

  // ---- WebGL fallback --------------------------------------------------------
  if (!webgl) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center py-24">
        <Globe2 size={34} className="mx-auto text-calibrex-teal mb-3" />
        <h1 className="text-lg font-black text-white">3D globe unavailable on this device</h1>
        <p className="text-sm text-calibrex-muted mt-2">Your browser can’t run WebGL, which the 3D globe needs. Use the 2D Global Situation map instead — it has the same live layers.</p>
        <button onClick={() => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'worldmap' }))} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy text-[11px] font-black uppercase tracking-widest">Open 2D map <ArrowRight size={14} /></button>
      </div>
    );
  }

  const layerIds = Object.keys(LAYER_LABEL);
  return (
    <div className="relative w-full" style={{ height: 'calc(100dvh - 8.5rem)', minHeight: 420 }}>
      <div ref={host} className="absolute inset-0 rounded-xl overflow-hidden bg-black cx-cesium" />

      {status && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-calibrex-dark/90 rounded-xl z-20">
          <Loader2 className="animate-spin text-calibrex-teal" size={26} /><p className="text-[12px] text-calibrex-muted px-6 text-center">{status}</p>
          {status.includes('Could not') && <button onClick={() => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'worldmap' }))} className="px-4 py-2 rounded-lg bg-calibrex-teal text-calibrex-navy text-[10px] font-black uppercase tracking-widest">Open 2D map</button>}
        </div>
      )}

      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/55 backdrop-blur text-calibrex-teal text-[11px] font-black uppercase tracking-widest border border-white/10"><Globe2 size={14} /> Live Earth 3D{lite && <span className="text-[8px] text-white/40 ml-1">lite</span>}</span>
        <button onClick={() => window.dispatchEvent(new CustomEvent('cx:navigate', { detail: 'worldmap' }))} className="px-2.5 py-1.5 rounded-lg bg-black/55 backdrop-blur border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest">2D</button>
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <div className="flex gap-1.5">
          <select value={filter} onChange={e => setFilter(e.target.value as Filter)} aria-label="Sensor view" className="bg-black/60 backdrop-blur border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none">
            {FILTERS.map(f => <option key={f} value={f}>{FILTER_LABEL[f]}</option>)}
          </select>
          <button onClick={() => setShowLayers(v => !v)} className={`px-2.5 py-1.5 rounded-lg backdrop-blur border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${showLayers ? 'bg-calibrex-teal text-calibrex-navy border-calibrex-teal' : 'bg-black/60 text-white/80 border-white/10'}`}><Layers size={13} /> Layers</button>
        </div>
        {showLayers && (
          <div className="w-60 bg-black/75 backdrop-blur border border-white/10 rounded-xl p-2 space-y-0.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="px-2 py-1 text-[9px] font-black text-white/35 uppercase tracking-widest">Layers · tap to toggle</div>
            {layerIds.map(id => (
              <button key={id} onClick={() => setLayers(l => ({ ...l, [id]: !l[id] }))} className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left">
                <span className="w-3 h-3 rounded-sm shrink-0 mt-0.5" style={{ background: layers[id] ? LAYER_COLOR[id] : 'transparent', border: `1px solid ${LAYER_COLOR[id]}` }} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[11px] font-bold ${layers[id] ? 'text-white' : 'text-white/45'}`}>{LAYER_LABEL[id]} <span className="text-[8px] font-black uppercase text-white/30">· ~45s</span></span>
                  <span className="block text-[9px] text-white/35 leading-tight">{LAYER_WHAT[id]}</span>
                </span>
              </button>
            ))}
            <div className="flex items-start gap-2 px-2 py-1.5 border-t border-white/5 mt-1">
              <span className="w-3 h-3 rounded-sm shrink-0 mt-0.5" style={{ background: '#7ee8ff' }} />
              <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold text-white">Satellites <span className="text-[8px] font-black uppercase text-calibrex-low/90">· live</span></span><span className="block text-[9px] text-white/35">Always on · orbits move in real time</span></span>
            </div>
          </div>
        )}
      </div>

      {/* legend of visible layers + live/snapshot status */}
      {ready && !sel && (
        <div className="absolute bottom-3 left-3 z-10 max-w-[70%] bg-black/55 backdrop-blur border border-white/10 rounded-xl px-3 py-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1">
            {layerIds.filter(id => layers[id]).map(id => (
              <span key={id} className="inline-flex items-center gap-1.5 text-[10px] text-white/70"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: LAYER_COLOR[id] }} />{LAYER_LABEL[id]}</span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[10px] text-white/70"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#7ee8ff' }} />Satellites</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-white/40 font-mono">
            <Radio size={10} className="text-calibrex-low" /> satellites live · other points refresh ~45s{lastSync ? ` · synced ${timeAgo(lastSync)}` : ''}
          </div>
        </div>
      )}

      {tracking && (
        <button onClick={stopFollow} className="absolute top-20 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest shadow-lg"><Crosshair size={13} /> Following · tap to release</button>
      )}

      {/* selected point — shows exactly what it is, no search jump */}
      {sel && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-96 z-10 bg-black/80 backdrop-blur border border-white/10 rounded-xl p-3.5">
          <div className="flex items-start gap-2.5 mb-2.5">
            {sel.kind === 'sat' ? <Satellite size={16} className="text-[#7ee8ff] shrink-0 mt-0.5" /> : <span className="w-3.5 h-3.5 rounded-sm shrink-0 mt-1" style={{ background: LAYER_COLOR[sel.kind] || '#cfe8ff' }} />}
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-black text-white leading-tight break-words">{sel.title}</div>
            </div>
            <button onClick={() => setSel(null)} className="text-white/40 hover:text-white shrink-0"><X size={16} /></button>
          </div>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-[12px]">
            {sel.rows.map(([k, v], i) => (
              <React.Fragment key={i}>
                <dt className="text-white/40 font-mono text-[10px] uppercase tracking-wider pt-0.5 whitespace-nowrap">{k}</dt>
                <dd className="text-white/85 break-words">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
          {sel.url && (
            <button onClick={() => openReader({ url: sel.url!, title: sel.title, source: 'Live Earth' })} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-calibrex-teal text-calibrex-navy text-[10px] font-black uppercase tracking-widest"><ExternalLink size={13} /> Open the source report</button>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveEarth3D;
