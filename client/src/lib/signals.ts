/** Signals: public telemetry (aircraft, space weather, Wikipedia trending). */
import { api } from './api';

export interface Aircraft { id: string; callsign: string; tag: string; mil: boolean; lat: number; lng: number; altM: number | null; speedMs: number | null; heading: number | null; emergency: string | null }
export interface SwpcAlert { at: number; head: string }
export interface SignalsSnapshot {
  updatedAt: number | null; refreshing: boolean;
  aircraft: { region: string; aircraft: Aircraft[]; at: number | null; military?: number; surge?: { count: number; baseline: number | null; surging: boolean } };
  space: { kp: { kp: number; level: string; time: string } | null; alerts: SwpcAlert[] };
  wiki: { date: string | null; top: { title: string; views: number; url: string }[] };
  sources: Record<string, { ok: boolean; error: string | null; at: number }>;
}
export const getSignals = () => api<SignalsSnapshot>('/signals');

export interface AircraftWatch {
  id: string; kind: 'area' | 'callsign' | 'type' | 'emergency'; name?: string; milOnly?: boolean;
  lat?: number; lng?: number; radiusKm?: number; value?: string;
}
export const getAircraftWatches = () => api<{ watches: AircraftWatch[] }>('/aircraft-watches').then(r => r.watches);
export const saveAircraftWatches = (watches: AircraftWatch[]) => api<{ watches: AircraftWatch[] }>('/aircraft-watches', { method: 'PUT', body: watches }).then(r => r.watches);
