/** Phase 3 client: subject lookups (gated, off by default). */
import { api } from './api';

export interface SubjectStatus {
  enabled: boolean; allowed: boolean;
  agreementVersion: string; agreementText: string;
  dailyLimit: number; usedToday: number; platformCount: number;
}
export interface PhoneResult {
  ok: true; e164: string; national: string; international: string; valid: boolean; possible: boolean;
  country: string | null; countryCallingCode: string; type: string; carrierNote: string;
  searchLinks: { label: string; url: string }[];
}
export interface UsernameResult {
  ok: true; username: string;
  profiles: { name: string; category: string; url: string }[];
  aggregators: { label: string; url: string }[];
  caution: string;
}
export interface AuditEntry { id: string; at: number; userId: string; email: string; kind: string; query: string; purpose: string; caseRef: string; accepted?: boolean; agreementVersion?: string }
export interface AdminSubject {
  enabled: boolean; dailyLimit: number;
  agreementText: string; agreementVersion: string; agreementUpdatedAt: number | null; agreementUpdatedBy: string | null;
  users: { id: string; email: string; name: string; role: string; status: string; allowed: boolean; isAdmin: boolean }[];
}

// Every lookup must carry a fresh acceptance of the current agreement version.
export const subject = {
  status: () => api<SubjectStatus>('/subject/status'),
  phone: (number: string, purpose: string, caseRef: string, agreementVersion: string, country?: string) =>
    api<{ result: PhoneResult; usedToday: number }>('/subject/phone', { body: { number, purpose, caseRef, country, accept: true, agreementVersion } }),
  username: (username: string, purpose: string, caseRef: string, agreementVersion: string) =>
    api<{ result: UsernameResult; usedToday: number }>('/subject/username', { body: { username, purpose, caseRef, accept: true, agreementVersion } }),
};
export const subjectAdmin = {
  get: () => api<AdminSubject>('/admin/subject'),
  set: (patch: { enabled?: boolean; dailyLimit?: number; agreementText?: string }) => api<AdminSubject>('/admin/subject', { method: 'PUT', body: patch }),
  setUser: (id: string, allowed: boolean) => api<{ id: string; allowed: boolean }>(`/admin/subject/user/${id}`, { method: 'PUT', body: { allowed } }),
  audit: () => api<{ entries: AuditEntry[] }>('/admin/subject/audit'),
};
