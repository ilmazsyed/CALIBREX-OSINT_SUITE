// Country Instability Index — observed instability-signal intensity (not a forecast).
import { api } from './api';

export interface InstabilitySignal { title: string; url: string; source: string; published: number; severity: string }
export interface InstabilityCountry {
  country: string; lat: number; lng: number;
  score: number; band: 'SEVERE' | 'HIGH' | 'ELEVATED' | 'LOW';
  reports: number; delta24h: number; signals: InstabilitySignal[];
}
export interface InstabilitySnapshot {
  updatedAt: number;
  countries: InstabilityCountry[];
  note: string;
}

export const getInstability = () => api<InstabilitySnapshot>('/instability');
