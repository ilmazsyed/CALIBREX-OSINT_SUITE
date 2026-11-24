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
  /** Entity dossier: Wikidata/Wikipedia profile + OpenSanctions + OFAC screening. */
  entityProfile: (q: string) => api<{ query: string; profile: any; sanctions: any[]; sanctionsUnavailable: string | null; flagged: boolean; caveat: string }>(`/entity/profile?q=${encodeURIComponent(q)}`),
  /** Chronolocation: candidate UTC times a shadow of the given bearing would occur. */
  shadowTimes: (lat: number, lng: number, date: string, bearing: number) =>
    api<{ date: string; sunBearingDeg: number; candidates: { utc: string; sunElevationDeg: number; sunBearingDeg: number }[]; note: string; error?: string }>(`/verify/shadow?lat=${lat}&lng=${lng}&date=${encodeURIComponent(date)}&bearing=${bearing}`),
  /** Supply-chain: live port/chokepoint disruption board. */
  supplyPorts: (radius = 300) => api<{ radiusKm: number; nodes: { id: string; name: string; type: string; country: string; score: number; status: string; signalCount: number; nearby: any[] }[]; updatedAt: number }>(`/supplychain/ports?radius=${radius}`),
  /** Supply-chain: score disruption along a lane (array of {lat,lng,name?}). */
  supplyLane: (waypoints: { lat: number; lng: number; name?: string }[]) => api<any>('/supplychain/lane', { body: { waypoints } }),
  /** Risk register: the user's saved sites scored by live disruption. */
  riskRegister: () => api<{ sites: { id: string; name: string; place: string; score: number; band: string; drivers: { type: string; count: number }[] }[]; count: number }>('/risk/register'),
  /** Run the AI investigation agent; streams NDJSON events to onEvent. */
  agent: async (question: string, context: string, onEvent: (e: any) => void, signal?: AbortSignal) => {
    const res = await fetch('/api/ai/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, context }), credentials: 'same-origin', signal });
    if (!res.ok || !res.body) { let msg = 'The investigation could not start.'; try { msg = (await res.json()).error || msg; } catch { /* */ } throw new Error(msg); }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) { try { onEvent(JSON.parse(line)); } catch { /* partial */ } } }
    }
  },
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
export interface SourceCandidateInput {
  name: string; layer: string; category: string; region: string; country?: string | null; subdivision?: string;
  endpoint: string; accessMethod: string; accessModel: string; language: string; cadenceMinutes: number;
  licence: string; licenceEvidence: string; provenance: string; authRequired?: boolean; authNotes?: string;
  independenceGroup?: string;
}
export interface SourceCandidateBatch { id: string; batch: string; region: string; candidateCount: number; createdAt: string; policy: string; }
export interface SourceCandidate extends SourceCandidateInput {
  id: string; status: string; createdAt: number; updatedAt: number;
  validation: { passed: boolean; checkedAt: number; httpStatus?: number; contentType?: string; validationType?: string; format?: string; itemsFound?: number | null; finalUrl?: string; responseBytes?: number; message: string } | null;
  rejectionReason: string | null;
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
  sourceCandidates: () => api<{ candidates: SourceCandidate[]; states: string[] }>('/admin/source-candidates'),
  sourceCandidateBatches: () => api<{ batches: SourceCandidateBatch[] }>('/admin/source-candidates/batches'),
  importCuratedSourceCandidateBatch: (batchId: string) => api<{ batch: string; imported: number; duplicates: number; rejected: number; remainingCapacity: number; results: { duplicates: { index: number; name: string; duplicateId: string }[]; rejected: { index: number; name: string | null; errors: string[] }[] }; note: string }>(`/admin/source-candidates/batches/${encodeURIComponent(batchId)}/import`, { method: 'POST' }),
  addSourceCandidate: (candidate: SourceCandidateInput) => api<{ candidate: SourceCandidate }>('/admin/source-candidates', { method: 'POST', body: candidate }),
  batchSourceCandidates: (candidates: SourceCandidateInput[]) => api<{ imported: number; duplicates: number; rejected: number; remainingCapacity: number; results: { duplicates: { index: number; name: string; duplicateId: string }[]; rejected: { index: number; name: string | null; errors: string[] }[] }; note: string }>('/admin/source-candidates/batch', { method: 'POST', body: { candidates } }),
  validateSourceCandidate: (id: string) => api<{ candidate: SourceCandidate; validation: NonNullable<SourceCandidate['validation']> }>(`/admin/source-candidates/${encodeURIComponent(id)}/validate`, { method: 'POST' }),
  validateSourceCandidateBatch: (limit = 25) => api<{ checked: number; passed: number; failed: number; remainingPending: number; results: { id: string; name: string; passed: boolean; message: string }[] }>('/admin/source-candidates/validate-batch', { method: 'POST', body: { limit } }),
  updateSourceCandidateStatus: (id: string, status: string, reason?: string) => api<{ candidate: SourceCandidate }>(`/admin/source-candidates/${encodeURIComponent(id)}/status`, { method: 'PUT', body: { status, reason } }),
  commercialOverview: () => api<CommercialOverview>('/admin/commercial/overview'),
  setDisabled: (disabled: string[]) => api<{ disabled: string[] }>('/admin/catalogue', { method: 'PUT', body: { disabled } }),
  backup: () => api<{ version: number; exportedAt: number; users: unknown[]; settings: Record<string, unknown>; userData: Record<string, unknown> }>('/admin/backup'),
  restore: (data: unknown) => api<{ ok: boolean; users: number; settings: number }>('/admin/restore', { body: data }),
};
