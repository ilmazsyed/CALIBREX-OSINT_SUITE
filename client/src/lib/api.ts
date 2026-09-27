/** Calibrex web client: server API, per-operator records, exports. */

export class ApiError extends Error {
  status: number;
  code?: string;
  contact?: string;
  constructor(status: number, message: string, code?: string, contact?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.contact = contact;
  }
}

type AccessListener = (e: ApiError) => void;
const accessListeners = new Set<AccessListener>();
/** Called when any request reports the account was suspended or signed out. */
export function onAccessChange(fn: AccessListener) { accessListeners.add(fn); return () => { accessListeners.delete(fn); }; }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      signal: opts.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the Calibrex server. Check your connection and try again.', 'network');
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new ApiError(res.status, data?.error || `Request failed (${res.status}).`, data?.code, data?.contact);
    if (res.status === 401 || (res.status === 403 && (data?.code === 'suspended' || data?.code === 'pending'))) {
      accessListeners.forEach(fn => fn(err));
    }
    throw err;
  }
  return data as T;
}

// ---------------------------------------------------------------- accounts

export interface User {
  id: string;
  email: string;
  name: string;
  org: string;
  role: 'user' | 'admin';
  status: 'pending' | 'active' | 'suspended';
  createdAt: number;
  lastSeen: number | null;
  visits: number;
}

export const auth = {
  me: () => api<{ user: User | null; contact: string }>('/auth/me'),
  login: (email: string, password: string) => api<{ user: User; contact: string }>('/auth/login', { body: { email, password } }),
  signup: (b: { email: string; password: string; name: string; org: string }) => api<{ user: User; contact: string }>('/auth/signup', { body: b }),
  logout: () => api('/auth/logout', { body: {} }),
  changePassword: (current: string, next: string) => api('/auth/password', { body: { current, next } }),
};

export const admin = {
  users: () => api<{ users: User[] }>('/admin/users'),
  update: (id: string, patch: Partial<Pick<User, 'status' | 'role' | 'name' | 'org'>>) => api<{ user: User }>(`/admin/users/${id}`, { method: 'PATCH', body: patch }),
  setPassword: (id: string, password: string) => api(`/admin/users/${id}/password`, { body: { password } }),
  remove: (id: string) => api(`/admin/users/${id}`, { method: 'DELETE' }),
  getContact: () => api<{ contact: string }>('/admin/contact'),
  setContact: (contact: string) => api<{ contact: string }>('/admin/contact', { method: 'PUT', body: { contact } }),
  sources: () => api<{ updatedAt: number | null; sources: Record<string, { ok: boolean; count: number; error: string | null; at: number }> }>('/admin/sources'),
};

// ---------------------------------------------------------------- per-operator records

const LS_PREFIX = 'calibrex_';
function lsGet(key: string): any {
  try { const v = localStorage.getItem(LS_PREFIX + key); return v ? JSON.parse(v) : undefined; } catch { return undefined; }
}
function lsSet(key: string, value: any) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch { /* storage blocked */ }
}
export function localPref<T>(key: string, fallback: T): T {
  const v = lsGet(key);
  return v === undefined ? fallback : v;
}
export function setLocalPref(key: string, value: any) { lsSet(key, value); }

/** Load one of this operator's server-side records (history, research log, settings). */
export async function loadRecord<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await api<{ value: T | null }>(`/me/data/${key}`);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function saveRecord(key: string, value: any): Promise<boolean> {
  try { await api(`/me/data/${key}`, { method: 'PUT', body: { value } }); return true; } catch { return false; }
}

// ---------------------------------------------------------------- exports

export async function saveFile(filename: string, data: string, type = 'text/plain'): Promise<boolean> {
  try {
    const url = URL.createObjectURL(new Blob([data], { type: `${type};charset=utf-8` }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
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

/** A self-contained printable dossier. */
export function dossierHtml(title: string, content: string, meta: Record<string, string>): string {
  const st = localPref<any>('settings', null);
  meta = { CLASSIFICATION: st?.classification || 'CONFIDENTIAL', 'PREPARED BY': st?.role || 'Intelligence Analyst', ...meta };
  const rows = Object.entries(meta).map(([k, v]) => `<p><strong>${esc(k)}:</strong> ${esc(v)}</p>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:"Courier New",Courier,monospace;padding:40px;color:#000;max-width:800px;margin:auto}h1{text-decoration:underline;text-transform:uppercase;margin-bottom:20px}.header{margin-bottom:30px;border-bottom:2px solid #000;padding-bottom:10px}pre{white-space:pre-wrap;font-family:inherit;font-size:15px}</style></head><body><div class="header"><h1>${esc(title)}</h1>${rows}</div><pre>${esc(content)}</pre><p style="margin-top:40px;font-size:11px">CALIBREX OSINT STUDIO</p></body></html>`;
}

/** Open the dossier in a new tab and bring up the print dialog (Save as PDF). */
export function printDossier(html: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

/** Strip Markdown emphasis/heading marks for the plain-text report views. */
export function plainText(md: string): string {
  return md
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S.+?)\*(?=\s|$)/g, '$1$2')
    .replace(/^\s*[-*]\s+/gm, '• ');
}

/** Apply the Display settings (comfortable text, larger text) to the page. */
export function applyDisplay(settings?: any) {
  const d = (settings ?? localPref<any>('settings', null))?.display || {};
  const root = document.documentElement;
  root.classList.toggle('cx-comfort', d.comfort !== false);
  root.classList.toggle('cx-large', d.size === 'large');
}
