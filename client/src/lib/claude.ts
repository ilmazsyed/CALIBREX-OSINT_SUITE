/**
 * Claude artifact runtime bridge for Calibrex.
 * Replaces the Gemini client, localStorage auth and browser downloads of the
 * original AI Studio build with the claude.ai artifact capabilities:
 *   sample    -> AI synthesis (runs on the viewer's own Claude account)
 *   user      -> who is viewing (identity replaces the old password registry)
 *   db        -> per-operator archive, visit log, revocation list
 *   room      -> live presence (who is online, which screen)
 *   downloads -> TXT / dossier export
 */

declare global {
  interface Window { claude?: { use: (name: string) => Promise<any> } }
}

const cache: Record<string, Promise<any>> = {};
export function cap<T = any>(name: string): Promise<T | null> {
  if (!cache[name]) {
    cache[name] = window.claude?.use
      ? window.claude.use(name).catch(() => null)
      : Promise.resolve(null);
  }
  return cache[name];
}

// ---------------------------------------------------------------- AI (sample)

export class AiError extends Error {
  code: string;
  partial?: string;
  constructor(code: string, message: string, partial?: string) {
    super(message);
    this.code = code;
    this.partial = partial;
  }
}

const AI_COPY: Record<string, string> = {
  not_granted: 'Claude access was declined for this page. Reload and choose Allow to use AI synthesis.',
  sampling_disabled: 'Claude is not available on this account.',
  not_declared: 'AI synthesis is not enabled on this build.',
  capability_disabled: 'AI synthesis is not available in this viewer.',
  capability_removed: 'AI synthesis is not available in this viewer.',
  rate_limited: 'Claude usage limit reached. Wait a moment, then try again.',
  session_expired: 'Your claude.ai session expired. Sign in again, then retry.',
  refused: 'Claude declined this request. Rephrase the query and try again.',
  empty_completion: 'Claude returned an empty answer. Simplify the request and try again.',
  invalid_json: 'Claude returned an unreadable answer. Try again.',
  prompt_too_large: 'Too much source material. Remove some pinned nodes and try again.',
  upstream_error: 'Connection to Claude was interrupted. Try again.',
  unavailable: 'AI synthesis only works when this page is opened inside claude.ai.',
};

export function aiMessage(e: any): string {
  const code = e?.code || 'upstream_error';
  return AI_COPY[code] || AI_COPY.upstream_error;
}

/** Codes after which AI should be treated as off for the rest of the visit. */
export function aiIsPermanent(e: any): boolean {
  return ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'unavailable'].includes(e?.code);
}

type AskOpts = {
  onText?: (text: string) => void;
  signal?: AbortSignal;
  tier?: 'quick' | 'default' | 'complex';
  fresh?: boolean;
};

export async function askClaude(prompt: string, opts: AskOpts = {}): Promise<string> {
  const sample = await cap<any>('sample');
  if (!sample) throw new AiError('unavailable', AI_COPY.unavailable);
  try {
    const res = await sample(prompt, {
      onText: opts.onText ? ({ text }: { text: string }) => opts.onText!(text) : undefined,
      signal: opts.signal,
      modelTier: opts.tier,
      cache: opts.fresh ? false : undefined,
    });
    return res.text;
  } catch (e: any) {
    throw new AiError(e?.code || 'upstream_error', e?.message || 'failed', e?.text);
  }
}

/** Lenient JSON recovery for model output: code fences, prose around the value,
 *  raw line breaks inside strings, smart quotes and trailing commas. */
export function repairJSON(text: string | undefined): any {
  if (!text) return undefined;
  let t = text.replace(/```(?:json)?/gi, '').trim();
  const start = t.search(/[{[]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start < 0 || end <= start) return undefined;
  t = t.slice(start, end + 1);
  const attempts = [
    t,
    // escape raw control characters inside string literals
    t.replace(/"(?:[^"\\]|\\.)*"/gs, m => m.replace(/\n/g, '\\n').replace(/\r/g, '').replace(/\t/g, ' ')),
  ];
  attempts.push(attempts[1].replace(/[\u201C\u201D]/g, '\\"').replace(/,\s*([}\]])/g, '$1'));
  for (const a of attempts) {
    try { return JSON.parse(a); } catch { /* next */ }
  }
  return undefined;
}

export async function askClaudeJSON<T = any>(prompt: string, opts: AskOpts = {}): Promise<T> {
  const sample = await cap<any>('sample');
  if (!sample) throw new AiError('unavailable', AI_COPY.unavailable);
  try {
    return await sample.json(prompt, {
      signal: opts.signal,
      modelTier: opts.tier,
      cache: opts.fresh ? false : undefined,
    });
  } catch (e: any) {
    if (e?.code !== 'invalid_json') throw new AiError(e?.code || 'upstream_error', e?.message || 'failed', e?.text);
    const repaired = repairJSON(e?.text);
    if (repaired !== undefined) return repaired as T;
    // One stricter retry, parsed by the page itself.
    try {
      const res = await sample(prompt + '\n\nIMPORTANT: output one valid minified JSON value only. Escape quotes and line breaks inside strings. No commentary, no code fences.', {
        signal: opts.signal, modelTier: opts.tier, cache: false,
      });
      const again = repairJSON(res?.text);
      if (again !== undefined) return again as T;
      throw new AiError('invalid_json', 'unparseable', res?.text);
    } catch (e2: any) {
      if (e2 instanceof AiError) throw e2;
      throw new AiError(e2?.code || 'upstream_error', e2?.message || 'failed', e2?.text);
    }
  }
}

// ---------------------------------------------------------------- identity

export interface Operator {
  id: string | null;
  name: string;
  email: string | null;
  avatarUrl: string;
  isOwner: boolean;
  canEdit: boolean;
  org: string;
}

export async function whoAmI(): Promise<Operator> {
  const user = await cap<any>('user');
  if (!user) {
    return { id: null, name: '', email: null, avatarUrl: '', isOwner: false, canEdit: false, org: '' };
  }
  const me = await user.me();
  return { id: me.id, name: me.name || '', email: me.email, avatarUrl: me.avatarUrl, isOwner: !!me.isOwner, canEdit: !!me.canEdit, org: '' };
}

export async function resolveProfiles(ids: string[]): Promise<Record<string, { name: string; email: string | null; avatarUrl: string; guest: boolean }>> {
  const user = await cap<any>('user');
  if (!user || ids.length === 0) return {};
  try { return await user.profiles(ids); } catch { return {}; }
}

// ---------------------------------------------------------------- per-operator storage

const LS_PREFIX = 'calibrex_';
function lsGet(key: string): any {
  try { const v = localStorage.getItem(LS_PREFIX + key); return v ? JSON.parse(v) : undefined; } catch { return undefined; }
}
function lsSet(key: string, value: any) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

let dbWritable = true;

/** Load one of this operator's records (history, research log, settings). */
export async function loadRecord<T>(uid: string | null, key: string, fallback: T): Promise<T> {
  const local = lsGet(key);
  const db = await cap<any>('db');
  if (db && uid) {
    try {
      const snap = await db.doc(`data/users/${uid}/${key}`).get();
      if (snap.exists) return (snap.data()?.value as T) ?? fallback;
    } catch { /* fall through */ }
  }
  return local === undefined ? fallback : local;
}

/** Save one of this operator's records. Private to the operator. */
export async function saveRecord(uid: string | null, key: string, value: any): Promise<void> {
  lsSet(key, value);
  const db = await cap<any>('db');
  if (!db || !uid || !dbWritable) return;
  try {
    await db.doc(`data/users/${uid}/${key}`).set({ value, savedAt: new Date().toISOString() });
  } catch (e: any) {
    if (e?.code === 'invalid_argument' || e?.code === 'not_granted' || e?.code === 'revoked') dbWritable = false;
  }
}

export function localPref<T>(key: string, fallback: T): T {
  const v = lsGet(key);
  return v === undefined ? fallback : v;
}
export function setLocalPref(key: string, value: any) { lsSet(key, value); }

// ---------------------------------------------------------------- access control

export interface VisitRecord {
  id: string;
  firstSeen: string;
  lastSeen: string;
  visits: number;
  org?: string;
  callsign?: string;
  guest?: boolean;
  lastView?: string;
}

export interface Revocation { at: string; reason?: string }

/** Watch the revocation list. Everyone can read it; only the owner writes it. */
export async function watchRevocations(cb: (list: Record<string, Revocation>) => void): Promise<() => void> {
  const db = await cap<any>('db');
  if (!db) { cb({}); return () => {}; }
  return db.doc('access/revoked').onSnapshot(
    (snap: any) => cb((snap.exists ? (snap.data()?.users as Record<string, Revocation>) : null) || {}),
    () => cb({}),
  );
}

export async function setRevoked(uid: string, revoked: boolean, current: Record<string, Revocation>): Promise<void> {
  const db = await cap<any>('db');
  if (!db) throw new Error('Access registry unavailable.');
  const users = { ...current };
  if (revoked) users[uid] = { at: new Date().toISOString() };
  else delete users[uid];
  await db.doc('access/revoked').set({ users, updatedAt: new Date().toISOString() });
}

/** Provider contact shown to suspended operators. Everyone reads it; only the owner writes it. */
export async function watchProviderContact(cb: (contact: string) => void): Promise<() => void> {
  const db = await cap<any>('db');
  if (!db) { cb(''); return () => {}; }
  return db.doc('access/provider').onSnapshot(
    (snap: any) => cb(snap.exists ? String(snap.data()?.contact || '') : ''),
    () => cb(''),
  );
}

export async function setProviderContact(contact: string): Promise<void> {
  const db = await cap<any>('db');
  if (!db) throw new Error('Access registry unavailable.');
  await db.doc('access/provider').set({ contact: contact.slice(0, 300), updatedAt: new Date().toISOString() });
}

/** Log this operator's visit. Works for viewers allowed to write; others are logged by the owner's live console. */
export async function logVisit(uid: string, fields: Partial<VisitRecord>, newVisit = true): Promise<void> {
  const db = await cap<any>('db');
  if (!db) return;
  const ref = db.doc(`visits/${uid}`);
  const now = new Date().toISOString();
  try {
    const snap = await ref.get();
    const prev = snap.exists ? (snap.data() as VisitRecord) : null;
    await ref.set({
      ...(prev || {}),
      ...fields,
      id: uid,
      firstSeen: prev?.firstSeen || now,
      lastSeen: now,
      visits: (prev?.visits || 0) + (newVisit || !prev ? 1 : 0),
    });
  } catch { /* view-only visitors cannot write; owner console logs them from presence */ }
}

export async function watchVisits(cb: (rows: VisitRecord[]) => void): Promise<() => void> {
  const db = await cap<any>('db');
  if (!db) { cb([]); return () => {}; }
  return db.collection('visits').orderBy('lastSeen', 'desc').limit(500).onSnapshot(
    (snap: any) => cb(snap.docs.map((d: any) => d.data() as VisitRecord)),
    () => cb([]),
  );
}

// ---------------------------------------------------------------- presence

export interface LivePeer { peer: string; by: string | null; guest: boolean; isMe: boolean; view?: string; since?: number }

export async function joinPresence(onPeers: (peers: LivePeer[]) => void): Promise<{ setView: (v: string) => void; stop: () => void }> {
  const room = await cap<any>('room');
  if (!room) return { setView: () => {}, stop: () => {} };
  const since = Date.now();
  room.presence({ view: 'dashboard', since }).catch(() => {});
  const unsub = room.onPeers((c: any) => {
    onPeers(c.peers.filter((p: any) => p.kind === 'viewer').map((p: any) => ({
      peer: p.peer, by: p.by, guest: !!p.guest, isMe: !!p.isMe,
      view: typeof p.presence?.view === 'string' ? p.presence.view : undefined,
      since: typeof p.presence?.since === 'number' ? p.presence.since : undefined,
    })));
  }, () => {});
  return {
    setView: (v: string) => { room.presence({ view: v }).catch(() => {}); },
    stop: unsub,
  };
}

// ---------------------------------------------------------------- export

/** Offer a file to the viewer. Returns false when this viewer cannot save files. */
export async function saveFile(filename: string, data: string): Promise<boolean> {
  const downloads = await cap<any>('downloads');
  if (!downloads) return false;
  try { await downloads.save({ filename, data }); return true; } catch { return false; }
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** A self-contained printable dossier (replaces the old print-to-PDF popup). */
export function dossierHtml(title: string, content: string, meta: Record<string, string>): string {
  const st = localPref<any>('settings', null);
  meta = { CLASSIFICATION: st?.classification || 'CONFIDENTIAL', 'PREPARED BY': st?.role || 'Intelligence Analyst', ...meta };
  const rows = Object.entries(meta).map(([k, v]) => `<p><strong>${esc(k)}:</strong> ${esc(v)}</p>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:"Courier New",Courier,monospace;padding:40px;color:#000;max-width:800px;margin:auto}h1{text-decoration:underline;text-transform:uppercase;margin-bottom:20px}.header{margin-bottom:30px;border-bottom:2px solid #000;padding-bottom:10px}pre{white-space:pre-wrap;font-family:inherit;font-size:15px}</style></head><body><div class="header"><h1>${esc(title)}</h1>${rows}</div><pre>${esc(content)}</pre><p style="margin-top:40px;font-size:11px">CALIBREX OSINT STUDIO — Use your browser's Print command to save as PDF.</p></body></html>`;
}

/** Strip Markdown emphasis/heading marks for the plain-text report views. */
export function plainText(md: string): string {
  return md
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S.+?)\*(?=\s|$)/g, '$1$2')
    .replace(/^\s*[-*]\s+/gm, '• ');
}
