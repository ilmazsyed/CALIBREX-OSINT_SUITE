/** Markets & Reserves data from the server. */
import { api } from './api';

export interface Quote {
  id: string; label: string; category: string; unit: string; dp: number;
  value: number; change: number; changePct: number; spark: number[]; asOf: string; source: string;
}
export interface Reserve { code: string; country: string; usd: number; year: string | null }
export interface MarketsSnapshot {
  updatedAt: number | null; refreshing: boolean;
  groups: Record<string, Quote[]>;
  reserves: Reserve[];
  sources: Record<string, { ok: boolean; error: string | null; at: number }>;
}
export const getMarkets = () => api<MarketsSnapshot>('/markets');
