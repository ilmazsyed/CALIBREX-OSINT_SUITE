/** Workbench: library search/timeline, cases (per-user store), and alert delivery. */
import { api, loadRecord, saveRecord } from './api';
import { Severity, WireKey } from './live';

// ---------------------------------------------------------------- library

export interface LibraryItem {
  id: string; title: string; summary: string; source: string; sourceId: string | null;
  kind: string; url: string; published: number; wire: WireKey; severity: Severity;
  place: { name: string; lat: number; lng: number } | null;
}
export interface LibraryParams { q?: string; wires?: WireKey[]; minSeverity?: Severity; source?: string; from?: number; to?: number; limit?: number }

export function getLibrary(p: LibraryParams = {}) {
  const qs = new URLSearchParams();
  if (p.q) qs.set('q', p.q);
  if (p.wires?.length) qs.set('wires', p.wires.join(','));
  if (p.minSeverity && p.minSeverity !== 'LOW') qs.set('minSeverity', p.minSeverity);
  if (p.source) qs.set('source', p.source);
  if (p.from) qs.set('from', String(p.from));
  if (p.to) qs.set('to', String(p.to));
  if (p.limit) qs.set('limit', String(p.limit));
  return api<{ results: LibraryItem[]; total: number; updatedAt: number | null }>(`/library?${qs.toString()}`);
}

// ---------------------------------------------------------------- cases

export interface CaseItem { id: string; title: string; url: string; source: string; wire?: string; severity?: Severity; published?: number; place?: string | null; addedAt: number }
export interface Board { id: string; name: string; createdAt: number; notes: string; items: CaseItem[] }

export const getCases = () => loadRecord<Board[]>('cases', []).then(v => Array.isArray(v) ? v : []);
export const saveCases = (cases: Board[]) => saveRecord('cases', cases.slice(0, 100));

export const newCase = (name: string): Board => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.trim().slice(0, 80) || 'Untitled case', createdAt: Date.now(), notes: '', items: [] });

/** Ask the app to pin an item to a case (a global modal handles the picker). */
export const addToCase = (item: Omit<CaseItem, 'addedAt'>) => window.dispatchEvent(new CustomEvent('cx:add-to-case', { detail: item }));

// ---------------------------------------------------------------- alert delivery

export interface Geofence { id: string; name: string; lat: number; lng: number; radiusKm: number }
export interface DeliveryConfig {
  enabled: boolean;
  minSeverity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  telegram: { configured?: boolean; chatId: string; botToken?: string } | null;
  webhook: { url: string } | null;
  geofences: Geofence[];
}
export const getDelivery = () => api<{ delivery: DeliveryConfig }>('/alert-delivery').then(r => r.delivery);
export const saveDelivery = (delivery: any) => api<{ delivery: DeliveryConfig }>('/alert-delivery', { method: 'PUT', body: delivery }).then(r => r.delivery);
export const testDelivery = (delivery: any) => api<{ ok: boolean }>('/alert-delivery/test', { method: 'POST', body: delivery });
