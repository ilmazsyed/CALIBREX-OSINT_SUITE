/** Social / Reddit chatter tracker. */
import { api } from './api';

export interface ChatterTerm { term: string; count: number; recent: number; rising: boolean }
export interface ChatterSource { name: string; count: number }
export interface ChatterPost { id: string; title: string; url: string; source: string; wire: string; published: number; severity: string }
export interface ChatterSnapshot {
  updatedAt: number; total: number; recentCount: number;
  terms: ChatterTerm[]; sources: ChatterSource[]; byHour: { t: number; count: number }[]; posts: ChatterPost[];
}
export const getChatter = () => api<ChatterSnapshot>('/chatter');
export const getChatterReport = () => api<{ report: string; generatedAt: number }>('/chatter/report');
