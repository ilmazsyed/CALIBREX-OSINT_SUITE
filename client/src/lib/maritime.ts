// Maritime intelligence (keyless): geolocated maritime incident/sanctions news
// from the live wires + the sanctioned-vessel registry (OFAC).
import { api } from './api';

export interface MaritimeNews {
  id: string; title: string; source: string; url: string; published: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; place: string | null; lat: number | null; lng: number | null; india: boolean;
}
export interface SanctionedVessel {
  name: string; program: string; list: string;
  imo?: string; flag?: string; vesselType?: string; tonnage?: string; grt?: string; owner?: string; callSign?: string;
}
export interface MaritimeSnapshot {
  updatedAt: number; news: MaritimeNews[]; events: MaritimeNews[]; vessels: SanctionedVessel[];
  counts: { news: number; mapped: number; sanctioned: number; india: number };
  sources: Record<string, { ok?: boolean; count?: number }>;
}

export const getMaritime = () => api<MaritimeSnapshot>('/maritime');
