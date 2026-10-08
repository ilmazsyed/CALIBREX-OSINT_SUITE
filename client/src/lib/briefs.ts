// Filed Rapid Briefs — the operator's saved snapshots from any dashboard.
// Stored per user under the 'briefs' record; separate from compiled Reports.
import { loadRecord, saveRecord } from './api';

export interface Brief {
  id: string;
  title: string;
  domain: string;   // Security | Business | Government | Politics | Markets …
  text: string;
  date: string;     // human-readable
  createdAt: number;
}

let cache: Brief[] | null = null;

export async function listBriefs(): Promise<Brief[]> {
  const v = await loadRecord<Brief[]>('briefs', []);
  cache = Array.isArray(v) ? v : [];
  return cache;
}

export async function addBrief(b: { title: string; domain: string; text: string }): Promise<Brief> {
  const list = cache || (await listBriefs());
  const brief: Brief = { ...b, id: Date.now().toString(36), createdAt: Date.now(), date: new Date().toLocaleString() };
  const next = [brief, ...list].slice(0, 200);
  cache = next;
  await saveRecord('briefs', next);
  try { window.dispatchEvent(new CustomEvent('cx:briefs')); } catch { /* ignore */ }
  return brief;
}

export async function deleteBrief(id: string): Promise<void> {
  const list = cache || (await listBriefs());
  const next = list.filter(b => b.id !== id);
  cache = next;
  await saveRecord('briefs', next);
  try { window.dispatchEvent(new CustomEvent('cx:briefs')); } catch { /* ignore */ }
}
