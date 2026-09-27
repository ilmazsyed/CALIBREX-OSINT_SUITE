/** Client side of the optional AI layer, watchlists, notifications and trends. */
import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

// ---------------------------------------------------------------- AI

export type AiProvider = 'openrouter' | 'anthropic' | 'openai' | 'gemini';
export type AiFamily = 'Claude' | 'ChatGPT' | 'Gemini';
export interface AiConnection { provider: AiProvider; providerLabel: string; model: string; connectedAt: number; hint: string }
export interface AiStatus { enabled: boolean; connection: AiConnection | null }
export interface AiModel { id: string; name: string; family: string }
export type AiTask = 'report' | 'research' | 'threat' | 'verify' | 'brief' | 'test';
export interface AiSource { title: string; source?: string; url?: string; published?: number | null }

let cached: AiStatus | null = null;
const subs = new Set<(s: AiStatus | null) => void>();
let inflight: Promise<AiStatus | null> | null = null;

export function reloadAiStatus(): Promise<AiStatus | null> {
  inflight = api<AiStatus>('/ai/status')
    .then(s => { cached = s; return s; })
    .catch(() => cached)
    .finally(() => { subs.forEach(fn => fn(cached)); inflight = null; });
  return inflight;
}

/** Shared AI connection status; every component sees the same value. */
export function useAiStatus(autoload = true) {
  const [status, setStatus] = useState<AiStatus | null>(cached);
  useEffect(() => {
    subs.add(setStatus);
    if (autoload && !cached && !inflight) reloadAiStatus();
    return () => { subs.delete(setStatus); };
  }, []);
  return { status, ready: !!status?.enabled && !!status?.connection, reload: reloadAiStatus };
}

export const ai = {
  connectKey: (provider: AiProvider, key: string) => api<{ connection: AiConnection }>('/ai/key', { body: { provider, key } }),
  models: () => api<{ models: AiModel[]; selected: string }>('/ai/models'),
  setModel: (model: string) => api<{ connection: AiConnection }>('/ai/model', { method: 'PUT', body: { model } }),
  disconnect: () => api('/ai', { method: 'DELETE' }),
  generate: (task: AiTask, input: Record<string, unknown>) =>
    api<{ text: string; model: string; provider: string; generatedAt: number }>('/ai/generate', { body: { task, input } }),
  /** Full-page navigation: the server redirects to OpenRouter's sign-in page. */
  startOneClick: (family: AiFamily) => { window.location.href = `/api/ai/openrouter/start?family=${family}`; },
};

/** Plain model name for display, e.g. "anthropic/claude-opus-5" -> "claude-opus-5". */
export const shortModel = (id?: string) => (id || '').replace(/^[a-z-]+\//, '');

// ---------------------------------------------------------------- watchlists & notifications

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface WatchTerm { id: string; term: string; createdAt: number; minSeverity: Severity }
export interface Watchlist { terms: WatchTerm[]; email: 'off' | 'all' | 'high' }
export interface Notification {
  id: string; term: string; title: string; url: string; source: string; published: number;
  wire: string; severity: Severity; place: string | null; at: number; read: boolean;
}

export const watch = {
  get: () => api<{ watchlist: Watchlist; emailAvailable: boolean; maxTerms: number; email: string }>('/watchlist'),
  save: (w: Watchlist) => api<{ watchlist: Watchlist; added: number }>('/watchlist', { method: 'PUT', body: w }),
  notifications: () => api<{ items: Notification[]; unread: number }>('/notifications'),
  markRead: (ids?: string[]) => api<{ unread: number }>('/notifications/read', { body: ids ? { ids } : {} }),
  clear: () => api('/notifications', { method: 'DELETE' }),
};

/** Poll notifications every minute while signed in. */
export function useNotifications(active: boolean) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(() => watch.notifications().then(r => { setItems(r.items); setUnread(r.unread); }).catch(() => {}), []);
  useEffect(() => {
    if (!active) return;
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [active, load]);
  const markRead = useCallback(async (ids?: string[]) => {
    setItems(prev => prev.map(n => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread(u => (ids ? Math.max(0, u - ids.length) : 0));
    await watch.markRead(ids).catch(() => {});
    load();
  }, [load]);
  const clear = useCallback(async () => { setItems([]); setUnread(0); await watch.clear().catch(() => {}); }, []);
  return { items, unread, reload: load, markRead, clear };
}

// ---------------------------------------------------------------- trends

export interface TrendDay { date: string; total: number; wires: Record<string, number>; places: Record<string, number>; severity: Record<Severity, number> }
export const trends = { get: () => api<{ days: TrendDay[]; updatedAt: number | null }>('/trends') };

// ---------------------------------------------------------------- admin extras

export interface CustomFeed { id: string; name: string; url: string; wire: string }
export const adminExtra = {
  settings: () => api<{ aiEnabled: boolean; emailConfigured: boolean }>('/admin/settings'),
  setAiEnabled: (aiEnabled: boolean) => api<{ aiEnabled: boolean; emailConfigured: boolean }>('/admin/settings', { method: 'PUT', body: { aiEnabled } }),
  feeds: () => api<{ feeds: CustomFeed[]; wires: string[] }>('/admin/feeds'),
  saveFeeds: (feeds: CustomFeed[]) => api<{ feeds: CustomFeed[] }>('/admin/feeds', { method: 'PUT', body: { feeds } }),
  testFeed: (url: string, wire: string) => api<{ entries: number; items: number; sample: { title: string; wire: string; severity: string }[] }>('/admin/feeds/test', { body: { url, wire } }),
};
