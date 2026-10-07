/**
 * Live OSINT data from the Calibrex server. The server pulls every source
 * itself (Google News wires, international and Indian outlets, OSINT and
 * analysis sites, OSINT social accounts, USGS, GDACS) every 5 minutes; the
 * page polls it every minute.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { api, localPref, setLocalPref } from './api';

const POLL_MS = 60 * 1000;

export type WireKey = 'INDIA' | 'SATP' | 'FATF' | 'REGIONAL' | 'GLOBAL_AXIS' | 'CYBER' | 'KINETIC' | 'BUSINESS';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Place { name: string; lat: number; lng: number }

export interface LiveItem {
  id: string;
  title: string;
  source: string;
  url: string;
  published: number;
  wire: WireKey;
  severity: Severity;
  place: Place | null;
  summary?: string;
  kind?: 'news' | 'official' | 'analysis' | 'social';
  sourceId?: string | null;
  words?: number;
  media?: import('./visuals').Media[];
}

export interface FeedState {
  items: LiveItem[];
  updatedAt: number | null;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
}

export interface Quake { id: string; mag: number; place: string; time: number; lat: number; lng: number; url: string; tsunami: boolean; alert: string | null }
export interface Disaster { id: string; title: string; url: string; published: number; lat: number; lng: number; level: string; summary: string }

export interface ServerThreat {
  id: string;
  title: string;
  severity: Severity;
  category: 'OSINT' | 'KINETIC' | 'CYBER' | 'FINANCIAL';
  location: string;
  lat: number;
  lng: number;
  summary: string;
  reports: number;
  outlets: number;
  latest: number;
  wires: WireKey[];
  sources: { title: string; url: string; source: string; published: number; severity: Severity; kind?: string }[];
}

export interface ServerAlert { id: string; message: string; severity: Severity; published: number; url: string; source: string; place: string | null }

export const WIRES: Record<WireKey, { label: string }> = {
  INDIA: { label: 'India Watch' },
  SATP: { label: 'South Asia Terrorism' },
  FATF: { label: 'Terror Finance / FATF' },
  REGIONAL: { label: 'Regional Security' },
  GLOBAL_AXIS: { label: 'Global Power Axis' },
  CYBER: { label: 'Cyber Threats' },
  KINETIC: { label: 'Kinetic / War Room' },
  BUSINESS: { label: 'Business Watch' },
};
export const WIRE_KEYS = Object.keys(WIRES) as WireKey[];

export interface LiveIntel {
  feeds: Record<WireKey, FeedState>;
  quakes: FeedState & { quakes: Quake[] };
  disasters: Disaster[];
  threats: ServerThreat[];
  alerts: ServerAlert[];
  updatedAt: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  refreshing: boolean;
  connected: boolean | null;
}

interface Snapshot {
  updatedAt: number | null;
  refreshing: boolean;
  items: LiveItem[];
  threats: ServerThreat[];
  alerts: ServerAlert[];
  quakes: Quake[];
  disasters: Disaster[];
}

function toFeeds(snap: Snapshot | null, loading: boolean, error: string | null): Record<WireKey, FeedState> {
  return Object.fromEntries(WIRE_KEYS.map(k => [k, {
    items: (snap?.items || []).filter(i => i.wire === k),
    updatedAt: snap?.updatedAt || null,
    loading,
    error,
    errorCode: error ? 'server' : null,
  }])) as Record<WireKey, FeedState>;
}

/** Keeps the live picture current while `active` (system online). */
export function useLiveIntel(active: boolean): LiveIntel {
  const [snap, setSnap] = useState<Snapshot | null>(() => localPref<Snapshot | null>('intel_cache', null));
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const s = await api<Snapshot>('/intel');
      if (!alive.current) return;
      setSnap(s);
      setError(s.updatedAt ? null : 'The server is pulling the first round of feeds. This takes up to a minute after a restart.');
      if (s.updatedAt) setLocalPref('intel_cache', { ...s, items: s.items.slice(0, 250) });
    } catch (e: any) {
      if (alive.current) setError(e?.message || 'Live feeds are unavailable.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!active) { setLoading(false); return () => { alive.current = false; }; }
    load();
    // Poll faster until the server has its first snapshot.
    const t = setInterval(() => load(), snap?.updatedAt ? POLL_MS : 15000);
    return () => { alive.current = false; clearInterval(t); };
  }, [active, load, !!snap?.updatedAt]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await api('/intel/refresh', { body: {} }); } catch { /* shown by load */ }
    await load();
    setRefreshing(false);
  }, [load]);

  return {
    feeds: toFeeds(snap, loading && !snap, error),
    quakes: { items: [], quakes: snap?.quakes || [], updatedAt: snap?.updatedAt || null, loading: loading && !snap, error, errorCode: null },
    disasters: snap?.disasters || [],
    threats: snap?.threats || [],
    alerts: snap?.alerts || [],
    updatedAt: snap?.updatedAt || null,
    loading: loading && !snap,
    error,
    refresh,
    refreshing,
    connected: error && !snap?.updatedAt ? false : true,
  };
}

// ---------------------------------------------------------------- search & verification

export interface SearchHit { id: string; title: string; source: string; url: string; published: number | null; severity: Severity; place: Place | null }

export async function searchNews(q: string, window: '1d' | '3d' | '7d' | '30d' = '7d', signal?: AbortSignal): Promise<SearchHit[]> {
  const r = await api<{ results: SearchHit[] }>(`/search?q=${encodeURIComponent(q)}&window=${window}`, { signal });
  return r.results;
}

export interface Corroboration {
  status: 'CORROBORATED' | 'LIMITED' | 'UNCORROBORATED';
  outlets: number;
  score: number;
  query: string;
  note: string;
  checkedAt: number;
  matches: { title: string; url: string; source: string; published: number | null }[];
}

export async function corroborate(text: string, signal?: AbortSignal): Promise<Corroboration> {
  return api<Corroboration>('/verify', { body: { text }, signal });
}

export function timeAgo(ms: number | null | undefined): string {
  if (!ms) return '—';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export interface Article {
  url: string; title: string; siteName: string; byline: string; published: number | null;
  excerpt: string; image: string | null; paragraphs: string[]; text: string; words: number;
}
export const readArticle = (url: string) => api<Article>(`/article?url=${encodeURIComponent(url)}`);

export interface ReadTarget { url: string; title: string; source?: string; kind?: string; published?: number | null }
/** Open the in-app article reader from anywhere. */
export const openReader = (t: ReadTarget) => window.dispatchEvent(new CustomEvent('cx:read', { detail: t }));
