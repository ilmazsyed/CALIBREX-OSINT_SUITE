// Maritime intelligence — live AIS vessel picture (AISStream).
import { api } from './api';

export interface Vessel {
  mmsi: number; name: string; lat: number; lng: number; sog: number | null; cog: number | null;
  type: string; dest: string; flag: string; sanctioned?: boolean; dark?: boolean; lastSeen: number;
}
export interface MaritimeSnapshot {
  updatedAt: number; connected: boolean; configured: boolean; lastError?: string | null; messages?: number; sample?: string | null;
  counts: { total: number; sanctioned: number; dark: number; india: number };
  vessels: Vessel[];
}

export const getMaritime = () => api<MaritimeSnapshot>('/maritime');
