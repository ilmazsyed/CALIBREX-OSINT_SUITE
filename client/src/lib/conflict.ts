// Conflict Watch — geolocated conflict/unrest density (GDELT GEO).
import { api } from './api';
import { GeoEvent } from './geoint';

export interface ConflictEvent extends GeoEvent { count: number }
export interface ConflictSnapshot {
  updatedAt: number;
  refreshing: boolean;
  events: ConflictEvent[];
  sources: Record<string, { ok: boolean; error?: string }>;
}

export const getConflict = () => api<ConflictSnapshot>('/conflict');
