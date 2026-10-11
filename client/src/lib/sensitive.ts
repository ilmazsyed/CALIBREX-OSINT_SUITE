// Gated sensitive tools (breach exposure, etc.) + admin gate and audit.
import { api } from './api';

export interface Gate { enabled: boolean; acknowledgedBy: string | null; acknowledgedAt: number | null }
export interface Breach { name: string; domain: string; breachDate: string; pwnCount: number; dataClasses: string[]; verified: boolean }
export interface BreachResult { configured: boolean; email: string; breaches: Breach[]; count: number }
export interface SensitiveAudit { id: string; at: number; userId: string; email: string; tool: string; query: string }

export const getGate = () => api<Gate>('/sensitive/gate');
export const setGate = (enabled: boolean, acknowledgment?: string) => api<Gate>('/admin/sensitive/gate', { method: 'PUT', body: { enabled, acknowledgment } });
export const getSensitiveAudit = () => api<{ entries: SensitiveAudit[] }>('/admin/sensitive/audit');
export const checkBreach = (email: string) => api<BreachResult>('/breach/check?email=' + encodeURIComponent(email));
