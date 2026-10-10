// GEOINT / Earth Watch — open natural-event geospatial feed (NASA EONET).
import { api } from './api';

export interface GeoEvent {
  id: string;
  title: string;
  category: string;
  categoryId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  lat: number;
  lng: number;
  date: number;
  magnitude: string | null;
  url: string;
  source: string;
  india: boolean;
}

export interface GeointSnapshot {
  updatedAt: number;
  refreshing: boolean;
  events: GeoEvent[];
  byCategory: Record<string, number>;
  sources: Record<string, { ok: boolean; error?: string }>;
}

export const getGeoint = () => api<GeointSnapshot>('/geoint');
