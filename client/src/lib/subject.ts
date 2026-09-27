/** Phase 3 client: subject lookups (gated, off by default). */
import { api } from './api';

export interface SubjectStatus {
  enabled: boolean; allowed: boolean; consented: boolean;
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
export interface AuditEntry { id: string; at: number; userId: string; email: string; kind: string; query: string; purpose: string; caseRef: string }
export interface AdminSubject {
  enabled: boolean; dailyLimit: number; agreementVersion: string;
  users: { id: string; email: string; name: string; role: string; status: string; allowed: boolean; isAdmin: boolean }[];
}

export const subject = {
  status: () => api<SubjectStatus>('/subject/status'),
  consent: () => api<SubjectStatus>('/subject/consent', { body: { accept: true } }),
  phone: (number: string, purpose: string, caseRef: string, country?: string) =>
    api<{ result: PhoneResult; usedToday: number }>('/subject/phone', { body: { number, purpose, caseRef, country } }),
  username: (username: string, purpose: string, caseRef: string) =>
    api<{ result: UsernameResult; usedToday: number }>('/subject/username', { body: { username, purpose, caseRef } }),
};
export const subjectAdmin = {
  get: () => api<AdminSubject>('/admin/subject'),
  set: (patch: { enabled?: boolean; dailyLimit?: number }) => api<{ enabled: boolean; dailyLimit: number }>('/admin/subject', { method: 'PUT', body: patch }),
  setUser: (id: string, allowed: boolean) => api<{ id: string; allowed: boolean }>(`/admin/subject/user/${id}`, { method: 'PUT', body: { allowed } }),
  audit: () => api<{ entries: AuditEntry[] }>('/admin/subject/audit'),
};
