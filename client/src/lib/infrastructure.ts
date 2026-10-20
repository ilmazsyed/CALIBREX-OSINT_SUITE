// Strategic infrastructure — ports, airports, maritime chokepoints and energy
// terminals. Curated, keyless (served from the Calibrex server).
import { api } from './api';

export type InfraType = 'chokepoint' | 'port' | 'airport' | 'energy';
export interface InfraItem { id: string; name: string; type: InfraType; lat: number; lng: number; country: string; note: string }

export const getInfrastructure = () => api<{ items: InfraItem[] }>('/infrastructure');

export const INFRA_COLOR: Record<InfraType, string> = { chokepoint: '#e9c46a', port: '#48cae4', airport: '#5ad1a5', energy: '#ff9f45' };
export const INFRA_LABEL: Record<InfraType, string> = { chokepoint: 'Chokepoints', port: 'Ports', airport: 'Airports', energy: 'Energy' };

/** Haversine distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, toR = (d: number) => d * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
