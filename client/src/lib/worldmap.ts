// Unified Global Situation Map — all geolocated streams in one layered payload.
import { api } from './api';

export interface MapPoint {
  lat: number; lng: number;
  title?: string; severity?: string; category?: string; source?: string; url?: string;
  magnitude?: string; location?: string; reports?: number; india?: boolean;
  tag?: string; mil?: boolean; streams?: string[]; streamCount?: number; score?: number; date?: number; mmsi?: string;
}
export type LayerId = 'hotspots' | 'conflict' | 'fire' | 'quake' | 'natural' | 'maritime' | 'aircraft' | 'convergence' | 'vessels';
export interface WorldmapSnapshot {
  updatedAt: number;
  layers: Record<LayerId, MapPoint[]>;
  counts: Record<LayerId, number>;
  note: string;
}

export const getWorldmap = () => api<WorldmapSnapshot>('/worldmap');
