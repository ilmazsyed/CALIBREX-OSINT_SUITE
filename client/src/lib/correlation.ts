// Cross-stream correlation — observed co-occurrence of signals (not a forecast).
import { api } from './api';

export interface ConvergenceDetail { stream: string; text: string; severity?: string; weight?: number }
export interface Convergence {
  country: string; lat: number | null; lng: number | null;
  streams: string[]; streamCount: number; score: number; details: ConvergenceDetail[];
}
export interface CorrelationSnapshot { updatedAt: number; convergences: Convergence[]; note: string }

export const getCorrelations = () => api<CorrelationSnapshot>('/correlations');
