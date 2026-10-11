// Gated sensitive tools (breach exposure, etc.) + admin gate and audit.
import { api } from './api';

export interface Gate { enabled: boolean; acknowledgedBy: string | null; acknowledgedAt: number | null }
export interface SensitiveAudit { id: string; at: number; userId: string; email: string; tool: string; query: string }

export interface UsernameHit { site: string; url: string; exists: 'yes' | 'no' | 'unknown' }
export interface UsernameResult { username: string; valid: boolean; results: UsernameHit[]; found?: number }
export interface RedditPost { title: string; subreddit: string; author: string; url: string; created: number; score: number; comments: number }
export interface DarkIndicators { btc: string[]; xmr: string[]; eth: string[]; emails: string[]; pgp: string[]; clearnet: string[]; telegram: string[]; count: number }
export interface DarkHit { title: string; onion: string; host: string; description: string; version: 'v2' | 'v3'; live: boolean; category: string; indicators: DarkIndicators }
export interface DarkStats { total: number; live: number; dead: number; withIndicators: number }

export const checkUsername = (u: string) => api<UsernameResult>('/socmint/username?u=' + encodeURIComponent(u));
export const searchReddit = (q: string) => api<{ query: string; posts: RedditPost[] }>('/socmint/reddit?q=' + encodeURIComponent(q));
export const searchDark = (q: string) => api<{ query: string; results: DarkHit[]; source: string; stats: DarkStats }>('/darkweb/search?q=' + encodeURIComponent(q));

export const getGate = () => api<Gate>('/sensitive/gate');
export const setGate = (enabled: boolean, acknowledgment?: string) => api<Gate>('/admin/sensitive/gate', { method: 'PUT', body: { enabled, acknowledgment } });
export const getSensitiveAudit = () => api<{ entries: SensitiveAudit[] }>('/admin/sensitive/audit');
