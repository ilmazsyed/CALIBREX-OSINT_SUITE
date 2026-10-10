// Sanctions screening against public OFAC consolidated lists.
import { api } from './api';

export interface SanctionMatch { name: string; type: string; program: string; list: string; score: number }
export interface SanctionStatus { updatedAt: number; counts: Record<string, number>; total: number; sources: Record<string, { ok: boolean; error?: string }> }
export interface ScreenResult { query: string; updatedAt: number; total: number; matches: SanctionMatch[] }

export const getSanctionsStatus = () => api<SanctionStatus>('/sanctions');
export const screenSanctions = (q: string) => api<ScreenResult>('/sanctions/screen?q=' + encodeURIComponent(q));
