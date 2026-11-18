/** Client side of the optional AI layer, watchlists, notifications and trends. */
import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

// ---------------------------------------------------------------- AI

export type AiProvider = 'openrouter' | 'anthropic' | 'openai' | 'gemini';
export type AiFamily = 'Claude' | 'ChatGPT' | 'Gemini';
export interface AiConnection { provider: AiProvider; providerLabel: string; model: string; connectedAt: number; hint: string }
export interface AiStatus { enabled: boolean; connection: AiConnection | null }
export interface AiModel { id: string; name: string; family: string }
export type AiTask = 'report' | 'report_doc' | 'research' | 'threat' | 'verify' | 'brief' | 'article' | 'test' | 'dossier' | 'copilot';
export interface AiSourceIn { title: string; source?: string; url?: string; published?: number | null; kind?: string; summary?: string }
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
    api<{ text: string; model: string; provider: string; generatedAt: number; articlesRead?: number }>('/ai/generate', { body: { task, input } }),
  /** Analyse an uploaded image / PDF / text file (multimodal) for OSINT. */
  analyzeFile: (payload: { mime: string; dataB64?: string; text?: string; note?: string }) =>
    api<{ text: string; model: string; provider: string; generatedAt: number }>('/ai/analyze', { body: payload }),
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

export type SourceType = 'rss' | 'search' | 'telegram' | 'bluesky' | 'mastodon';
export interface CustomFeed { id: string; name: string; type: SourceType; url: string; handle: string; query?: string; wire: string; kind: string; category?: string }
export interface SourceHealth { ok: boolean; count: number; error: string | null; at: number; state?: 'ok' | 'cached' | 'empty' | 'error'; lastSuccessAt?: number | null; lastErrorAt?: number | null; consecutiveFailures?: number; failureClass?: 'access_restricted' | 'endpoint_missing' | 'rate_limited' | 'upstream_unavailable' | 'feed_invalid' | 'fetch_error' | null; retryAfter?: number | null }
export interface CatalogueSource { id: string; name: string; group: string; type: string; kind: string; category?: string | null; home: string; handle: string | null; enabled: boolean; health: SourceHealth | null }
export interface SourceIntelligenceRow {
  id: string; name: string; group: string; region: string; kind: string; enabled: boolean;
  status: 'healthy' | 'degraded' | 'stale' | 'failed' | 'unmeasured';
  score: number | null; count: number; lastCheckedAt: number | null; lastSuccessAt: number | null;
  ageMinutes: number | null; consecutiveFailures: number; failureClass: string | null;
  retryAfter: number | null; error: string | null;
}
export interface SourceIntelligenceRegion {
  region: string; configured: number; measured: number; healthy: number; degraded: number;
  stale: number; failed: number; unmeasured: number; averageScore: number | null; items: number;
}
export interface SourceIntelligenceReport {
  generatedAt: number;
  summary: { configured: number; measured: number; healthy: number; degraded: number; stale: number; failed: number; unmeasured: number; averageScore: number | null };
  regions: SourceIntelligenceRegion[];
  sources: SourceIntelligenceRow[];
  scoring: string;
}
export interface SourceNetworkLayer {
  id: string; label: string; target: number; description: string; configured: number; enabled: number;
  healthy: number; degraded: number; stale: number; failed: number; unverified: number; remaining: number;
}
export interface SourceNetworkRegion {
  id: string; region: string; countries: string[]; configured: number; healthy: number; unverified: number;
}
export interface SourceNetworkRecord {
  id: string; name: string; layer: string; layerLabel: string; group: string; region: string;
  country: string | null; coverage: string; countryName: string | null; type: string; kind: string;
  enabled: boolean; cadenceMinutes: number; health: string; lastCheckedAt: number | null;
  lastSuccessAt: number | null; consecutiveFailures: number; failureClass: string | null;
  itemCount: number; measured: boolean; accessModel: string; licence: string;
}
export interface SourceNetworkReport {
  generatedAt: number; target: number; configured: number; healthy: number; unverified: number;
  layers: SourceNetworkLayer[]; regions: SourceNetworkRegion[]; sources: SourceNetworkRecord[];
  qualityPolicy: string;
}
export type CommercialOverview = {
  sampledAt: number;
  accounts: { total: number; plans: Record<string, number>; statuses: Record<string, number>; trialsActive: number; trialsExpired: number };
  licensing: { pendingRequests: number; recentRequests: { id: string; at: number; status: string; kind: string; plan?: string; featureId?: string; userId: string }[] };
  pricing: { A: number; B: number; C: number };
  platform: { processUptimeSeconds: number; requests: { requests: number; errors: number }; inFlight: number };
  limitations: string[];
};

export const adminExtra = {
  settings: () => api<{ aiEnabled: boolean; emailConfigured: boolean }>('/admin/settings'),
  setAiEnabled: (aiEnabled: boolean) => api<{ aiEnabled: boolean; emailConfigured: boolean }>('/admin/settings', { method: 'PUT', body: { aiEnabled } }),
  feeds: () => api<{ feeds: CustomFeed[]; wires: string[] }>('/admin/feeds'),
  saveFeeds: (feeds: CustomFeed[]) => api<{ feeds: CustomFeed[] }>('/admin/feeds', { method: 'PUT', body: { feeds } }),
  testFeed: (src: Partial<CustomFeed>) => api<{ entries: number; items: number; sample: { title: string; wire: string; severity: string }[] }>('/admin/feeds/test', { body: src }),
  catalogue: () => api<{ groups: string[]; sources: CatalogueSource[]; customHealth: Record<string, SourceHealth> }>('/admin/catalogue'),
  sourceIntelligence: () => api<SourceIntelligenceReport>('/admin/source-intelligence'),
  sourceNetwork: () => api<SourceNetworkReport>('/admin/source-network'),
  commercialOverview: () => api<CommercialOverview>('/admin/commercial/overview'),
  setDisabled: (disabled: string[]) => api<{ disabled: string[] }>('/admin/catalogue', { method: 'PUT', body: { disabled } }),
  backup: () => api<{ version: number; exportedAt: number; users: unknown[]; settings: Record<string, unknown>; userData: Record<string, unknown> }>('/admin/backup'),
  restore: (data: unknown) => api<{ ok: boolean; users: number; settings: number }>('/admin/restore', { body: data }),
};
