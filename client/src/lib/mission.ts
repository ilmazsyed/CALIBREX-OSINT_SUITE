// Guided Mission — a coached, end-to-end investigation that orchestrates the
// existing tools (Research → pin to a Case → read → Verify → Report → Brief).
// State is persisted per user; nothing here requires AI.
import { api, loadRecord, saveRecord } from './api';
import { getInstability } from './instability';
import { getCorrelations } from './correlation';
import type { ServerThreat } from './live';

export interface MissionState {
  active: boolean;
  minimized: boolean;
  step: number;               // 0..6
  topic: string;
  caseId: string | null;
  caseName: string;
  pinned: number;
  readDone: boolean;
  verifyDone: boolean;
  reportDone: boolean;
  briefDone: boolean;
  startedAt: number;
  completedAt: number | null;
}

export const STEP_COUNT = 7;

export const freshMission = (): MissionState => ({
  active: true, minimized: false, step: 0, topic: '', caseId: null, caseName: '',
  pinned: 0, readDone: false, verifyDone: false, reportDone: false, briefDone: false,
  startedAt: Date.now(), completedAt: null,
});

export const loadMission = () => loadRecord<MissionState | null>('mission', null);
export const saveMission = (m: MissionState | null) => saveRecord('mission', m);

export interface Suggestion { label: string; query: string; tag: 'Convergence' | 'Instability' | 'Threat' }

/** Live, investigable topic suggestions drawn from the current situation. */
export async function suggestTopics(): Promise<Suggestion[]> {
  const out: Suggestion[] = [];
  const [conv, inst, intel] = await Promise.allSettled([
    getCorrelations(),
    getInstability(),
    api<{ threats: ServerThreat[] }>('/intel'),
  ]);
  if (conv.status === 'fulfilled') for (const c of (conv.value.convergences || []).slice(0, 3)) out.push({ label: `${c.country} — ${c.streamCount} converging streams`, query: c.country, tag: 'Convergence' });
  if (inst.status === 'fulfilled') for (const c of (inst.value.countries || []).slice(0, 3)) out.push({ label: `${c.country} — instability ${c.score}/100 (${c.band})`, query: c.country, tag: 'Instability' });
  if (intel.status === 'fulfilled') for (const t of (intel.value.threats || []).slice(0, 4)) out.push({ label: t.title, query: t.location || t.title, tag: 'Threat' });
  const seen = new Set<string>();
  return out.filter(s => { const k = s.query.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
}

// Events the dock dispatches / listens for.
export const MISSION_OPEN = 'cx:mission-open';            // launcher → open/resume the dock
export const MISSION_INVESTIGATE = 'cx:investigate';     // dock → App: load a topic into Research
export const openMission = () => window.dispatchEvent(new Event(MISSION_OPEN));
export const investigateTopic = (q: string) => window.dispatchEvent(new CustomEvent(MISSION_INVESTIGATE, { detail: q }));
