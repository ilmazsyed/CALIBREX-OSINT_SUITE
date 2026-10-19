// Satellite TLEs for the Live Earth 3D globe. The client propagates positions
// with SGP4 (satellite.js) — the server only proxies/caches CelesTrak.
import { api } from './api';

export interface Sat { name: string; tle1: string; tle2: string; group: string }
export const getSatellites = () => api<{ updatedAt: number; satellites: Sat[] }>('/satellites');
