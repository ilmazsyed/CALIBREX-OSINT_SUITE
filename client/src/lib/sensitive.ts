// Gated sensitive tools (breach exposure, etc.) + admin gate and audit.
import { api } from './api';

export interface Gate { enabled: boolean; acknowledgedBy: string | null; acknowledgedAt: number | null }
export interface Breach { name: string; domain: string; breachDate: string; pwnCount: number; dataClasses: string[]; verified: boolean }
export interface BreachResult { configured: boolean; email: string; breaches: Breach[]; count: number }
export interface SensitiveAudit { id: string; at: number; userId: string; email: string; tool: string; query: string }

export interface UsernameHit { site: string; url: string; exists: 'yes' | 'no' | 'unknown' }
export interface UsernameResult { username: string; valid: boolean; results: UsernameHit[]; found?: number }
export interface RedditPost { title: string; subreddit: string; author: string; url: string; created: number; score: number; comments: number }
export interface DarkHit { title: string; onion: string; description: string }

export const checkUsername = (u: string) => api<UsernameResult>('/socmint/username?u=' + encodeURIComponent(u));
export const searchReddit = (q: string) => api<{ query: string; posts: RedditPost[] }>('/socmint/reddit?q=' + encodeURIComponent(q));
export const searchDark = (q: string) => api<{ query: string; results: DarkHit[]; source: string }>('/darkweb/search?q=' + encodeURIComponent(q));

export const getGate = () => api<Gate>('/sensitive/gate');
export const setGate = (enabled: boolean, acknowledgment?: string) => api<Gate>('/admin/sensitive/gate', { method: 'PUT', body: { enabled, acknowledgment } });
export const getSensitiveAudit = () => api<{ entries: SensitiveAudit[] }>('/admin/sensitive/audit');
export const checkBreach = (email: string) => api<BreachResult>('/breach/check?email=' + encodeURIComponent(email));
