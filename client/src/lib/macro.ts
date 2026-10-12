// Macroeconomic context — World Bank development indicators (annual).
import { api } from './api';

export interface MacroCountry { iso: string; country: string; indicators: Record<string, { value: number; year: string }> }
export interface MacroSnapshot { updatedAt: number; countries: MacroCountry[]; indicators: { key: string; label: string }[]; note: string }

export const getMacro = () => api<MacroSnapshot>('/macro');
