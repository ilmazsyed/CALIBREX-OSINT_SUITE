/**
 * Live OSINT data layer.
 *
 * Artifact pages cannot fetch the web themselves, so every live read goes
 * through the viewer's "Parallel Search" connector (web_search / web_fetch)
 * via the artifact `mcp` capability. Sources:
 *   - Google News RSS searches (one per intelligence wire), last 24 hours
 *   - USGS real-time earthquake feed (GeoJSON)
 *   - Parallel web search for research and claim verification
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { cap, askClaudeJSON, localPref, setLocalPref } from './claude';

export const CONNECTOR = 'Parallel Search';
const REFRESH_MS = 5 * 60 * 1000;

let sessionId: string = localPref('parallel_session', '');
if (!sessionId) {
  sessionId = 'calibrex-' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  setLocalPref('parallel_session', sessionId);
}

// ---------------------------------------------------------------- types

export type WireKey = 'SATP' | 'FATF' | 'REGIONAL' | 'GLOBAL_AXIS' | 'CYBER' | 'KINETIC';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface LiveItem {
  id: string;
  title: string;
  source: string;
  url: string;
  published: number;   // epoch ms
  wire: WireKey;
  severity: Severity;
}

export interface FeedState {
  items: LiveItem[];
  updatedAt: number | null;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
}

export interface Quake {
  id: string;
  mag: number;
  place: string;
  time: number;
  lat: number;
  lng: number;
  url: string;
  tsunami: boolean;
  alert: string | null;
}

export interface SearchHit { url: string; title: string; published: string | null; excerpt: string }

export const WIRES: Record<WireKey, { label: string; query: string; category: string }> = {
  SATP: {
    label: 'South Asia Terrorism',
    category: 'TERRORISM',
    query: '(militant OR terrorist OR insurgent OR IED OR encounter OR "suicide attack") (Kashmir OR Pakistan OR Afghanistan OR Balochistan OR Manipur OR Chhattisgarh OR Bangladesh OR "Khyber Pakhtunkhwa")',
  },
  FATF: {
    label: 'Terror Finance / FATF',
    category: 'FINANCIAL',
    query: '(FATF OR "terror financing" OR "terrorist financing" OR "money laundering" OR OFAC OR "sanctions designation" OR hawala OR "crypto seized")',
  },
  REGIONAL: {
    label: 'Regional Security',
    category: 'REGIONAL',
    query: '(clashes OR insurgency OR "armed group" OR ceasefire OR militia OR junta OR "security forces") (Africa OR "Middle East" OR Sahel OR Myanmar OR Sudan OR Yemen OR Syria OR Somalia OR Congo OR Haiti)',
  },
  GLOBAL_AXIS: {
    label: 'Global Power Axis',
    category: 'GEOPOLITICAL',
    query: '(Pentagon OR NATO OR PLA OR Kremlin OR "Chinese navy" OR "Russian military" OR "Taiwan Strait" OR "South China Sea") (military OR drills OR deployment OR warships OR sanctions)',
  },
  CYBER: {
    label: 'Cyber Threats',
    category: 'CYBER',
    query: '(cyberattack OR ransomware OR "zero-day" OR "data breach" OR "state-sponsored hackers" OR "CISA warns" OR APT)',
  },
  KINETIC: {
    label: 'Kinetic / War Room',
    category: 'KINETIC',
    query: '(missile OR "drone strike" OR airstrike OR shelling OR invasion OR "naval blockade" OR coup OR "ballistic missile")',
  },
};

export const WIRE_KEYS = Object.keys(WIRES) as WireKey[];

export function googleNewsUrl(query: string, window = '1d') {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${window}`)}&hl=en-US&gl=US&ceid=US:en`;
}

export const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';

// ---------------------------------------------------------------- parsing

const CRIT = /\b(suicide (?:attack|bomb|blast)|bombing|blast|massacre|invasion|invades|coup|ballistic missile|mass shooting|beheaded|hostages?)\b/i;
const HIGH = /\b(kill(?:s|ed|ing)?|dead|deaths?|attack(?:s|ed)?|strikes?|shelling|drone|explosion|abduct(?:s|ed)?|ransomware|zero-day|breach|hijack|gunmen|ambush)\b/i;
const MED = /\b(clash(?:es)?|arrest(?:s|ed)?|raid(?:s)?|sanction(?:s|ed)?|militants?|terror\w*|seiz(?:e|ed|ure)|launder\w*|exploit\w*|vulnerab\w*|drills?|warships?|troops|military bases?|deploy\w*|protests?|unrest)\b/i;

export function rateSeverity(title: string): Severity {
  const m = title.match(/(\d{1,4})\s+(?:\w+\s+){0,3}(?:killed|dead|die|died|deaths|people killed|soldiers|civilians)/i)
    || title.match(/kill(?:s|ed)\s+(?:at least\s+)?(\d{1,4})/i);
  const count = m ? parseInt(m[1], 10) : 0;
  if (count >= 10 || CRIT.test(title)) return 'CRITICAL';
  if (count > 0 || HIGH.test(title)) return 'HIGH';
  if (MED.test(title)) return 'MEDIUM';
  return 'LOW';
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Parse the connector's Markdown rendering of an RSS feed. */
export function parseRss(md: string, wire: WireKey): LiveItem[] {
  const out: LiveItem[] = [];
  const seen = new Set<string>();
  const re = /^##\s+(.+?)\s*\n\s*Published:\s*([^\n·]+?)\s+·\s+Link:\s*(\S+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    let title = m[1].trim();
    let source = '';
    const dash = title.lastIndexOf(' - ');
    if (dash > 20) { source = title.slice(dash + 3).trim(); title = title.slice(0, dash).trim(); }
    const published = Date.parse(m[2].trim()) || Date.now();
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 70);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: wire + '-' + hash(key), title, source: source || 'Wire', url: m[3], published, wire, severity: rateSeverity(title) });
  }
  return out.sort((a, b) => b.published - a.published);
}

function resultText(payload: any): { text: string; error: string | null } {
  const r = payload?.results?.[0];
  if (r) return { text: r.full_content || (Array.isArray(r.excerpts) ? r.excerpts.join('\n') : ''), error: null };
  const e = payload?.errors?.[0];
  if (e) return { text: '', error: e.http_status_code ? `Source returned HTTP ${e.http_status_code}` : (e.error_type || 'Source unavailable') };
  if (typeof payload === 'string') return { text: payload, error: null };
  return { text: '', error: 'Source returned no content' };
}

export function parseQuakes(text: string): Quake[] {
  const start = text.indexOf('{');
  if (start < 0) return [];
  const data = JSON.parse(text.slice(start, text.lastIndexOf('}') + 1));
  return (data.features || []).map((f: any) => ({
    id: f.id,
    mag: Number(f.properties?.mag) || 0,
    place: String(f.properties?.place || 'Unknown location'),
    time: Number(f.properties?.time) || 0,
    lat: f.geometry?.coordinates?.[1],
    lng: f.geometry?.coordinates?.[0],
    url: String(f.properties?.url || ''),
    tsunami: !!f.properties?.tsunami,
    alert: f.properties?.alert || null,
  })).filter((q: Quake) => Number.isFinite(q.lat) && Number.isFinite(q.lng))
    .sort((a: Quake, b: Quake) => b.time - a.time);
}

// ---------------------------------------------------------------- connector errors

export function connectorMessage(code: string | undefined): string {
  switch (code) {
    case 'server_not_connected':
    case 'server_not_found':
    case 'selection_required':
      return 'Live feeds need the free Parallel Search connector. Add it in claude.ai Settings → Connectors, then reload.';
    case 'needs_reauth':
      return 'Reconnect Parallel Search in claude.ai Settings → Connectors, then reload.';
    case 'not_in_manifest':
    case 'consent_required':
      return 'Live feeds were not allowed for this page. Reload the page and choose Allow for Parallel Search.';
    case 'blocked_by_policy':
    case 'approval_required':
      return 'Your organization blocks the Parallel Search connector for this page.';
    case 'not_granted':
    case 'capability_disabled':
    case 'capability_removed':
    case 'unavailable':
      return 'Live feeds only work when this page is opened inside claude.ai.';
    case 'server_unavailable':
      return 'The source is slow to respond. Retrying on the next refresh.';
    case 'tool_error':
      return 'The source could not be read right now. Retrying on the next refresh.';
    default:
      return 'Live source temporarily unavailable. Retrying on the next refresh.';
  }
}

/** Codes where shown data must be retracted rather than kept as last-good. */
function isDenial(code?: string) {
  return ['server_not_connected', 'needs_reauth', 'not_in_manifest', 'blocked_by_policy', 'approval_required', 'consent_required', 'not_granted', 'capability_disabled', 'capability_removed'].includes(code || '');
}

// ---------------------------------------------------------------- one-shot calls

async function mcpCall(tool: 'web_search' | 'web_fetch', input: Record<string, unknown>, signal?: AbortSignal): Promise<any> {
  const mcp = await cap<any>('mcp');
  if (!mcp) { const e: any = new Error(connectorMessage('unavailable')); e.code = 'unavailable'; throw e; }
  try {
    const res = await mcp.callTool(CONNECTOR, tool, { ...input, session_id: sessionId }, { signal });
    return res?.payload;
  } catch (err: any) {
    if (err?.retryable && !signal?.aborted) {
      await new Promise(r => setTimeout(r, Math.min(err.retryAfterMs || 1500, 5000) + Math.random() * 800));
      try {
        const res = await mcp.callTool(CONNECTOR, tool, { ...input, session_id: sessionId }, { signal });
        return res?.payload;
      } catch (err2: any) { err = err2; }
    }
    const e: any = new Error(connectorMessage(err?.code));
    e.code = err?.code || 'upstream_error';
    throw e;
  }
}

export async function webSearch(objective: string, queries: string[], signal?: AbortSignal): Promise<SearchHit[]> {
  const payload = await mcpCall('web_search', { objective: objective.slice(0, 400), search_queries: queries.slice(0, 5) }, signal);
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map((r: any) => ({
    url: String(r.url || ''),
    title: String(r.title || r.url || ''),
    published: r.publish_date || null,
    excerpt: (Array.isArray(r.excerpts) ? r.excerpts.join(' … ') : '').replace(/\s+/g, ' ').slice(0, 900),
  })).filter((h: SearchHit) => /^https?:\/\//.test(h.url));
}

export async function fetchNews(query: string, wire: WireKey, window = '2d', signal?: AbortSignal): Promise<LiveItem[]> {
  const payload = await mcpCall('web_fetch', { urls: [googleNewsUrl(query, window)], full_content: true, objective: 'Latest news items with title, date and link' }, signal);
  return parseRss(resultText(payload).text, wire);
}

// ---------------------------------------------------------------- live feed hook

const emptyFeed = (): FeedState => ({ items: [], updatedAt: null, loading: true, error: null, errorCode: null });

export interface LiveIntel {
  feeds: Record<WireKey, FeedState>;
  quakes: FeedState & { quakes: Quake[] };
  refresh: () => void;
  connected: boolean | null;   // null = unknown yet
}

/** Keeps every wire current while `active` (system online). */
export function useLiveIntel(active: boolean): LiveIntel {
  const cached = localPref<Record<string, LiveItem[]>>('live_cache', {});
  const [feeds, setFeeds] = useState<Record<WireKey, FeedState>>(() =>
    Object.fromEntries(WIRE_KEYS.map(k => [k, { ...emptyFeed(), items: cached[k] || [], loading: !!active }])) as any);
  const [quakes, setQuakes] = useState<FeedState & { quakes: Quake[] }>({ ...emptyFeed(), loading: !!active, quakes: localPref('live_quakes', []) });
  const [connected, setConnected] = useState<boolean | null>(null);
  const [nonce, setNonce] = useState(0);
  const cacheRef = useRef(cached);

  useEffect(() => {
    if (!active) {
      setFeeds(prev => Object.fromEntries(WIRE_KEYS.map(k => [k, { ...prev[k], loading: false }])) as any);
      setQuakes(prev => ({ ...prev, loading: false }));
      return;
    }
    let alive = true;
    const unsubs: Array<() => void> = [];
    (async () => {
      const mcp = await cap<any>('mcp');
      if (!alive) return;
      if (!mcp) {
        const msg = connectorMessage('unavailable');
        setConnected(false);
        setFeeds(prev => Object.fromEntries(WIRE_KEYS.map(k => [k, { ...prev[k], loading: false, error: msg, errorCode: 'unavailable' }])) as any);
        setQuakes(prev => ({ ...prev, loading: false, error: msg, errorCode: 'unavailable' }));
        return;
      }
      const opts = { refetchInterval: REFRESH_MS, cache: { staleTime: REFRESH_MS - 30000, gcTime: 6 * 3600 * 1000 } };

      WIRE_KEYS.forEach((k, i) => {
        const input = { urls: [googleNewsUrl(WIRES[k].query, '1d')], full_content: true, objective: 'Latest news items with title, date and link', session_id: sessionId };
        // Stagger registration so the free-tier connector is not hit all at once.
        const t = setTimeout(() => {
          if (!alive) return;
          unsubs.push(mcp.watchTool(CONNECTOR, 'web_fetch', input, (ev: any) => {
            if (!alive) return;
            if (ev.type === 'data') {
              const { text, error } = resultText(ev.result?.payload);
              const items = parseRss(text, k);
              setConnected(true);
              setFeeds(prev => ({ ...prev, [k]: {
                items: items.length ? items : prev[k].items,
                updatedAt: ev.result?.cache?.storedAt || Date.now(),
                loading: false,
                error: items.length ? null : (error || 'No reports in the last 24 hours.'),
                errorCode: items.length ? null : 'empty',
              } }));
              if (items.length) {
                cacheRef.current = { ...cacheRef.current, [k]: items.slice(0, 40) };
                setLocalPref('live_cache', cacheRef.current);
              }
            } else {
              const code = ev.error?.code;
              if (isDenial(code)) setConnected(false);
              setFeeds(prev => ({ ...prev, [k]: {
                ...prev[k],
                items: isDenial(code) ? [] : prev[k].items,
                loading: false,
                error: connectorMessage(code),
                errorCode: code || 'upstream_error',
              } }));
            }
          }, opts));
        }, i * 700);
        unsubs.push(() => clearTimeout(t));
      });

      const qInput = { urls: [USGS_URL], full_content: true, objective: 'USGS earthquake GeoJSON feed', session_id: sessionId };
      unsubs.push(mcp.watchTool(CONNECTOR, 'web_fetch', qInput, (ev: any) => {
        if (!alive) return;
        if (ev.type === 'data') {
          try {
            const list = parseQuakes(resultText(ev.result?.payload).text);
            setQuakes({ quakes: list, items: [], updatedAt: ev.result?.cache?.storedAt || Date.now(), loading: false, error: null, errorCode: null });
            setLocalPref('live_quakes', list.slice(0, 60));
          } catch {
            setQuakes(prev => ({ ...prev, loading: false, error: 'USGS feed could not be read.', errorCode: 'parse' }));
          }
        } else {
          const code = ev.error?.code;
          setQuakes(prev => ({ ...prev, quakes: isDenial(code) ? [] : prev.quakes, loading: false, error: connectorMessage(code), errorCode: code || 'upstream_error' }));
        }
      }, opts));
    })();
    return () => { alive = false; unsubs.forEach(u => u()); };
  }, [active, nonce]);

  const refresh = useCallback(async () => {
    const mcp = await cap<any>('mcp');
    try { await mcp?.invalidate(CONNECTOR, 'web_fetch'); } catch { /* older shell */ }
    setFeeds(prev => Object.fromEntries(WIRE_KEYS.map(k => [k, { ...prev[k], loading: true }])) as any);
    setQuakes(prev => ({ ...prev, loading: true }));
    setNonce(n => n + 1);
  }, []);

  return { feeds, quakes, refresh, connected };
}

// ---------------------------------------------------------------- AI threat assessment

export interface AssessedThreat {
  id: string;
  title: string;
  severity: Severity;
  category: 'OSINT' | 'KINETIC' | 'CYBER' | 'FINANCIAL';
  location: string;
  lat: number;
  lng: number;
  summary: string;
  actors: string;
  sources: LiveItem[];
}

export interface Assessment {
  at: number;
  basis: number;
  threats: AssessedThreat[];
  alerts: { id: string; message: string; severity: Severity; source?: LiveItem }[];
}

/** Claude clusters the latest live items into located threat vectors, citing item numbers only. */
export async function assessThreats(items: LiveItem[], signal?: AbortSignal): Promise<Assessment> {
  const pool = items
    .filter(i => i.severity !== 'LOW')
    .sort((a, b) => b.published - a.published)
    .slice(0, 70);
  const lines = pool.map((it, i) => `[${i}] (${it.wire}) ${it.title} — ${it.source}, ${new Date(it.published).toISOString().slice(0, 16)}Z`).join('\n');
  const raw: any = await askClaudeJSON(
`You are the threat-assessment engine of an OSINT monitoring console. Below are live news items from the last 24 hours, numbered.
Group items describing the same real-world situation and return the most significant current security threats.
Rules: use ONLY what the items say; do not add facts, casualty numbers or events that are not in the items. Every threat must cite item numbers.
Coordinates: approximate latitude/longitude of the place where the event happened (city or province level).

ITEMS:
${lines}

Reply with only JSON:
{"threats":[{"title":"Country: short headline (max 60 chars)","severity":"CRITICAL|HIGH|MEDIUM|LOW","category":"KINETIC|CYBER|FINANCIAL|OSINT","location":"place, country","lat":0,"lng":0,"summary":"1-2 sentences from the items","actors":"groups or states named in the items, or Unknown","items":[0,1]}],
 "alerts":[{"message":"one-line alert","severity":"CRITICAL|HIGH|MEDIUM","item":0}]}
Return up to 10 threats (most severe first) and up to 8 alerts.`,
    { signal, fresh: true }
  );
  const sev = (s: any): Severity => (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(s) ? s : 'MEDIUM');
  const threats: AssessedThreat[] = (Array.isArray(raw?.threats) ? raw.threats : []).map((t: any, i: number) => {
    const src = (Array.isArray(t.items) ? t.items : []).map((n: any) => pool[Number(n)]).filter(Boolean) as LiveItem[];
    return {
      id: 'thr-' + hash(String(t.title) + i),
      title: String(t.title || 'Unnamed vector').slice(0, 80),
      severity: sev(t.severity),
      category: (['KINETIC', 'CYBER', 'FINANCIAL', 'OSINT'].includes(t.category) ? t.category : 'OSINT'),
      location: String(t.location || 'Unknown'),
      lat: Number(t.lat), lng: Number(t.lng),
      summary: String(t.summary || ''),
      actors: String(t.actors || 'Unknown'),
      sources: src,
    };
  }).filter((t: AssessedThreat) => t.sources.length > 0 && Number.isFinite(t.lat) && Number.isFinite(t.lng) && Math.abs(t.lat) <= 90 && Math.abs(t.lng) <= 180);
  const alerts = (Array.isArray(raw?.alerts) ? raw.alerts : []).map((a: any, i: number) => {
    const source = pool[Number(a.item)];
    return { id: 'al-' + hash(String(a.message) + (source?.id || i)), message: String(a.message || ''), severity: sev(a.severity), source };
  }).filter((a: any) => a.message && a.source);
  return { at: Date.now(), basis: pool.length, threats, alerts };
}

// ---------------------------------------------------------------- verification

export interface VerifyResult {
  score: number;
  verdict: 'VERIFIED' | 'CAUTION' | 'UNRELIABLE';
  findings: string[];
  auditorLogic: string;
  sources: { name: string; url: string }[];
  checkedAt: number;
}

/** Fact-check text against live web sources: extract claims, search, then judge with citations. */
export async function verifyAgainstWeb(text: string, context: string, signal?: AbortSignal, onStage?: (s: string) => void): Promise<VerifyResult> {
  onStage?.('Extracting claims');
  const plan: any = await askClaudeJSON(
`Extract the 3 most important checkable factual claims from the TEXT and a web search query (3-7 words) for each.
TEXT:
${text.slice(0, 6000)}

Reply with only JSON: {"claims":[{"claim":"...","query":"..."}]}`,
    { signal, tier: 'quick', fresh: true }
  );
  const claims = (Array.isArray(plan?.claims) ? plan.claims : []).filter((c: any) => c?.query).slice(0, 4);
  if (claims.length === 0) throw Object.assign(new Error('No checkable claims found.'), { code: 'no_claims' });

  onStage?.('Searching live sources');
  const hits = await webSearch(`Verify these claims with current reporting: ${claims.map((c: any) => c.claim).join('; ')}`.slice(0, 400), claims.map((c: any) => String(c.query)), signal);
  const evidence = hits.slice(0, 10);

  onStage?.('Auditing evidence');
  const judged: any = await askClaudeJSON(
`You are an intelligence auditor. Today is ${new Date().toISOString().slice(0, 10)}. Judge each CLAIM strictly against the EVIDENCE retrieved just now from the web (numbered).
Do not use outside knowledge to confirm a claim; if the evidence does not address a claim, say it is unconfirmed.
${context ? `CONTEXT: ${context.slice(0, 1500)}\n` : ''}
CLAIMS:
${claims.map((c: any, i: number) => `${i + 1}. ${c.claim}`).join('\n')}

EVIDENCE:
${evidence.map((h, i) => `[${i}] ${h.title} (${h.url})${h.published ? ` ${h.published}` : ''}\n${h.excerpt}`).join('\n\n') || '(no results)'}

Reply with only JSON: {"score":0-100,"verdict":"VERIFIED|CAUTION|UNRELIABLE","findings":["claim n: supported/contradicted/unconfirmed by [i] — short reason"],"auditorLogic":"1-2 sentences","cited":[0,1]}`,
    { signal, fresh: true }
  );
  const cited = (Array.isArray(judged?.cited) ? judged.cited : []).map((n: any) => evidence[Number(n)]).filter(Boolean) as SearchHit[];
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(judged?.score) || 0))),
    verdict: (['VERIFIED', 'CAUTION', 'UNRELIABLE'].includes(judged?.verdict) ? judged.verdict : 'CAUTION'),
    findings: (Array.isArray(judged?.findings) ? judged.findings : []).map(String).slice(0, 6),
    auditorLogic: String(judged?.auditorLogic || ''),
    sources: (cited.length ? cited : evidence.slice(0, 4)).map(h => ({ name: h.title, url: h.url })),
    checkedAt: Date.now(),
  };
}

export function timeAgo(ms: number | null | undefined): string {
  if (!ms) return '—';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
