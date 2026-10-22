// Single source of truth for Atlas map layers — one canonical colour per layer,
// shared by BOTH the 2D Global Situation map and the 3D Live Earth globe, so a
// dot means the same thing (and shows the same colour) no matter which view you
// are in. Colours are hand-picked to be clearly distinct on a dark basemap.
import { MapPoint } from './worldmap';
import { InfraItem, INFRA_COLOR } from './infrastructure';
import { timeAgo } from './live';

export interface LayerMeta { id: string; label: string; color: string; what: string; }

// Distinct hues, one per layer. Severity is shown by SIZE + a ring (see maps),
// never by recolouring — so colour always identifies the layer, not the urgency.
export const LAYER_META: Record<string, LayerMeta> = {
  conflict:    { id: 'conflict',    label: 'Armed conflict',    color: '#ff5252', what: 'Reported armed-conflict events — strikes, clashes, shelling.' },
  hotspots:    { id: 'hotspots',    label: 'Threat hotspots',   color: '#ff4081', what: 'Places the intelligence wire is lighting up — clustered threat reporting.' },
  fire:        { id: 'fire',        label: 'Active fires',      color: '#ff9800', what: 'Active fires and thermal anomalies detected from orbit (NASA).' },
  natural:     { id: 'natural',     label: 'Natural events',    color: '#ffd54f', what: 'Storms, floods, volcanoes and other natural hazards (NASA EONET).' },
  quake:       { id: 'quake',       label: 'Earthquakes',       color: '#b388ff', what: 'Recent earthquakes, strongest first (USGS).' },
  outages:     { id: 'outages',     label: 'Internet outages',  color: '#7c4dff', what: 'Sudden drops in internet connectivity, often a sign of unrest or disaster (IODA).' },
  maritime:    { id: 'maritime',    label: 'Maritime',          color: '#00bcd4', what: 'Shipping incidents and strategic maritime chokepoints.' },
  vessels:     { id: 'vessels',     label: 'Vessels',           color: '#69f0ae', what: 'Ships currently at sea, by AIS transponder.' },
  aircraft:    { id: 'aircraft',    label: 'Aircraft',          color: '#40c4ff', what: 'Aircraft currently in flight, by ADS-B transponder.' },
  convergence: { id: 'convergence', label: 'Convergence',       color: '#ffffff', what: 'Where several independent streams stack on one place — worth a closer look.' },
  infra:       { id: 'infra',       label: 'Infrastructure',    color: '#e9bd78', what: 'Strategic ports, airports, chokepoints and energy nodes.' },
  sat:         { id: 'sat',         label: 'Satellites',        color: '#64ffda', what: 'Live satellite positions, propagated in real time (SGP4).' },
};

// Severity accents (used for the ring/badge, not the dot's base colour).
export const SEVERITY_COLOR: Record<string, string> = { CRITICAL: '#ff3b3b', HIGH: '#ff9f45', MEDIUM: '#ffd23f', LOW: '#3ec9a7' };
export const SEVERITY_LABEL: Record<string, string> = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

export const layerColor = (id: string): string => LAYER_META[id]?.color || '#cfe8ff';
export const layerLabel = (id: string): string => LAYER_META[id]?.label || id;
export const layerWhat = (id: string): string => LAYER_META[id]?.what || '';

// Dot radius by severity (keeps colour = layer, size = urgency).
export function severityRadius(sev: string | undefined, base: number): number {
  const s = (sev || '').toUpperCase();
  if (s === 'CRITICAL') return base + 3;
  if (s === 'HIGH') return base + 1.5;
  if (s === 'LOW') return base - 0.5;
  return base;
}

// ---- Rich, human-readable detail ------------------------------------------
export interface AtlasDetail {
  layer: string; label: string; color: string;
  title: string; summary: string; context: string;
  severity?: string; facts: [string, string][];
  url?: string; source?: string; lat?: number; lng?: number; place?: string; published?: number;
  follow?: boolean; investigate: string;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Turn a raw map point into a card a human can actually act on. */
export function detailFromPoint(id: string, p: MapPoint): AtlasDetail {
  const meta = LAYER_META[id] || LAYER_META.hotspots;
  const mil = id === 'aircraft' && p.mil;
  const place = p.location || '';
  const sev = (p.severity || '').toUpperCase();
  const when = p.date ? timeAgo(p.date) : '';

  let summary: string;
  switch (id) {
    case 'aircraft': summary = `${mil ? 'Military' : 'Civil'} aircraft${p.title ? ` “${p.title}”` : ''} in flight${place ? ` over ${place}` : ''} right now.`; break;
    case 'vessels': summary = `Vessel${p.title ? ` “${p.title}”` : ''} under way${place ? ` near ${place}` : ''}${p.mmsi ? ` (MMSI ${p.mmsi})` : ''}.`; break;
    case 'fire': summary = `Active fire / thermal anomaly${place ? ` near ${place}` : ''}${when ? `, detected ${when}` : ''}.`; break;
    case 'quake': summary = `Magnitude ${p.magnitude || '—'} earthquake${place ? ` near ${place}` : ''}${when ? `, ${when}` : ''}.`; break;
    case 'conflict': summary = `Armed-conflict event${place ? ` in ${place}` : ''}${when ? `, reported ${when}` : ''}.`; break;
    case 'hotspots': summary = `Threat hotspot${place ? ` in ${place}` : ''}${typeof p.reports === 'number' ? ` — ${p.reports} corroborating report${p.reports === 1 ? '' : 's'}` : ''}.`; break;
    case 'maritime': summary = `Maritime ${p.category || 'incident'}${place ? ` near ${place}` : ''}.`; break;
    case 'natural': summary = `${p.category || 'Natural event'}${place ? ` near ${place}` : ''}${when ? `, ${when}` : ''}.`; break;
    case 'outages': summary = `Internet connectivity drop${place ? ` in ${place}` : ''}${when ? `, ${when}` : ''}.`; break;
    case 'convergence': summary = `${p.streamCount || 'Several'} intelligence streams converging${place ? ` on ${place}` : ''}${p.streams?.length ? `: ${p.streams.join(', ')}` : ''}.`; break;
    default: summary = p.title || meta.label;
  }

  const facts: [string, string][] = [];
  if (place) facts.push(['Location', place]);
  if (p.magnitude) facts.push(['Magnitude', p.magnitude]);
  if (p.category && id !== 'natural') facts.push(['Category', p.category]);
  if (typeof p.reports === 'number') facts.push(['Corroboration', `${p.reports} report${p.reports === 1 ? '' : 's'}`]);
  if (typeof p.streamCount === 'number') facts.push(['Streams', `${p.streamCount}${p.streams?.length ? ` · ${p.streams.join(', ')}` : ''}`]);
  if (p.mmsi) facts.push(['MMSI', p.mmsi]);
  if (mil) facts.push(['Flag', 'Military aircraft']);
  if (when) facts.push(['When', when]);
  facts.push(['Coordinates', `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`]);
  if (p.source) facts.push(['Reported by', p.source]);

  const investigate = [p.title, place].filter(Boolean).join(' ').trim() || `${meta.label}${place ? ` ${place}` : ''}`;
  return {
    layer: id, label: meta.label, color: meta.color,
    title: p.title || meta.label, summary, context: meta.what,
    severity: sev || undefined, facts,
    url: p.url || '', source: p.source || meta.label,
    lat: p.lat, lng: p.lng, place, published: p.date,
    follow: id === 'aircraft' || id === 'vessels', investigate,
  };
}

export function detailFromInfra(it: InfraItem): AtlasDetail {
  const meta = LAYER_META.infra;
  return {
    layer: 'infra', label: meta.label, color: INFRA_COLOR[it.type] || meta.color,
    title: it.name, summary: `${cap(it.type)}${it.country ? ` in ${it.country}` : ''}.${it.note ? ` ${it.note}` : ''}`.trim(),
    context: meta.what, facts: [
      ['Asset type', cap(it.type)], ['Country', it.country],
      ...(it.note ? [['Why it matters', it.note] as [string, string]] : []),
      ['Coordinates', `${it.lat.toFixed(3)}, ${it.lng.toFixed(3)}`],
    ],
    lat: it.lat, lng: it.lng, place: it.country, source: `Infrastructure · ${it.type}`,
    investigate: `${it.name} ${it.country}`.trim(),
  };
}

export function detailFromSat(name: string, group: string, lat: number, lng: number, alt: number): AtlasDetail {
  const meta = LAYER_META.sat;
  return {
    layer: 'sat', label: meta.label, color: meta.color,
    title: name, summary: `Satellite “${name}” — live orbital position over ${lat.toFixed(1)}, ${lng.toFixed(1)} at ${Math.round(alt)} km altitude.`,
    context: meta.what, facts: [
      ['Catalogue', group], ['Sub-point', `${lat.toFixed(2)}, ${lng.toFixed(2)}`],
      ['Altitude', `${Math.round(alt)} km`], ['Tracking', 'Live (SGP4)'],
    ],
    lat, lng, source: `Satellite · ${group}`, follow: true, investigate: name,
  };
}
