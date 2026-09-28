/** Markets & Reserves data from the server. */
import { api } from './api';

export interface Quote {
  id: string; label: string; category: string; region: string | null; unit: string; dp: number;
  value: number; change: number; changePct: number; spark: number[]; asOf: string; source: string;
}
export interface Reserve { code: string; country: string; usd: number; year: string | null }
export interface YieldPoint { label: string; years: number; pct: number }
export interface Yields { asOf: string; points: YieldPoint[]; spread10y2y: number | null; inverted: boolean }
export interface MarketsSnapshot {
  updatedAt: number | null; refreshing: boolean;
  groups: Record<string, Quote[]>;
  reserves: Reserve[];
  yields: Yields | null;
  sources: Record<string, { ok: boolean; error: string | null; at: number }>;
}
export interface SeriesPoint { date: string; close: number }

export const getMarkets = () => api<MarketsSnapshot>('/markets');
export const getSeries = (id: string) => api<{ id: string; series: SeriesPoint[] }>(`/markets/series/${encodeURIComponent(id)}`);

/** Flatten all quotes and rank by absolute daily move — the movers board. */
export function movers(groups: Record<string, Quote[]>): Quote[] {
  return Object.values(groups).flat().filter(q => Number.isFinite(q.changePct)).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}
