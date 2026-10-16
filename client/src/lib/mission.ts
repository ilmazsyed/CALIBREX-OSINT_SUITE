// Guided Mission — role-based, coached investigations. A library of 11 role
// personas (Calibrex's own); each routes the analyst through that role's
// signature monitors and OSINT tools and ends at a filed brief. The set is
// designed so that, collectively, every feature of the app is exercised.
// Nothing here requires AI; state is persisted per user.
import { api, loadRecord, saveRecord } from './api';
import { getInstability } from './instability';
import { getCorrelations } from './correlation';
import type { ServerThreat } from './live';

export interface MissionState {
  active: boolean;
  minimized: boolean;
  roleId: string | null;      // null while picking a role
  step: number;               // index into the composed steps
  topic: string;
  caseId: string | null;
  caseName: string;
  pinned: number;
  briefDone: boolean;
  startedAt: number;
  completedAt: number | null;
}

export const freshMission = (): MissionState => ({
  active: true, minimized: false, roleId: null, step: 0, topic: '', caseId: null, caseName: '',
  pinned: 0, briefDone: false, startedAt: Date.now(), completedAt: null,
});

export const loadMission = () => loadRecord<MissionState | null>('mission', null);
export const saveMission = (m: MissionState | null) => saveRecord('mission', m);

// Completed roles (for the coverage tracker).
export const loadDone = () => loadRecord<string[]>('mission_done', []).then(v => Array.isArray(v) ? v : []);
export const saveDone = (ids: string[]) => saveRecord('mission_done', ids.slice(0, 50));

// ---- Roles ------------------------------------------------------------------
export interface Stop { view: string; label: string; note: string }
export interface Role {
  id: string; name: string; room: string; accent: string; blurb: string;
  primary: Stop[];            // signature screens the role scans first
  tool?: Stop;                // a specialised OSINT tool used during collection
}

// accent = a hex used for the role chip.
export const ROLES: Role[] = [
  { id: 'journalist', name: 'The Journalist', room: 'The Evidence Room', accent: '#ff6b6b',
    blurb: 'Chase a story, verify it hard, and file it with provenance.',
    primary: [
      { view: 'threat-wire', label: 'Threat Wire', note: 'Scan the live wire for a developing story worth standing up.' },
      { view: 'chatter', label: 'Chatter Tracker', note: 'Check what’s spiking in open chatter around it.' },
    ],
    tool: { view: 'subject-lookup', label: 'Subject Lookup', note: 'Background the people/organisations named in the story.' } },
  { id: 'security', name: 'The Security Analyst', room: 'The Watch Floor', accent: '#3ec9a7',
    blurb: 'Read the threat picture, cluster the signals, brief the watch.',
    primary: [
      { view: 'dashboard', label: 'Security Dashboard', note: 'Take the current threat posture across the wires.' },
      { view: 'conflict', label: 'Conflict Watch', note: 'Check the Instability Index and Signal Convergence for where streams are stacking.' },
      { view: 'geoint', label: 'Earth Watch', note: 'Correlate with on-the-ground events (fires, quakes, conflict points).' },
    ],
    tool: { view: 'signals', label: 'Signals', note: 'Look for military-aircraft activity or anomalies near the area.' } },
  { id: 'policymaker', name: 'The Policymaker', room: 'The Globe Room', accent: '#e9c46a',
    blurb: 'See the whole board, weigh governance and stability, decide.',
    primary: [
      { view: 'worldmap', label: 'Global Situation', note: 'Take in every geolocated stream on one map.' },
      { view: 'government', label: 'Government', note: 'Read the official actions, orders and diplomacy in play.' },
      { view: 'conflict', label: 'Instability Index', note: 'Rank the countries by observed instability intensity.' },
    ] },
  { id: 'risk', name: 'The Risk Professional', room: 'The Supply Line', accent: '#ff9f45',
    blurb: 'Trace exposure across trade, shipping and sanctions.',
    primary: [
      { view: 'maritime', label: 'Maritime', note: 'Watch shipping incidents, chokepoints and sanctioned vessels (AIS).' },
      { view: 'markets', label: 'Markets & Macro', note: 'Check market stress and the macro-vulnerability table.' },
      { view: 'business', label: 'Business Watch', note: 'Scan corporate distress and deal flow tied to the exposure.' },
    ],
    tool: { view: 'sanctions', label: 'Sanctions screening', note: 'Screen the counterparties against OFAC lists.' } },
  { id: 'investor', name: 'The Investor', room: 'The Trading Floor', accent: '#48cae4',
    blurb: 'Turn signal into a thesis — markets, macro and momentum.',
    primary: [
      { view: 'markets', label: 'Markets & Reserves', note: 'Read quotes, reserves, yields and the macro table.' },
      { view: 'business', label: 'Business Watch', note: 'Find the corporate events moving the sector.' },
      { view: 'trends', label: 'Trends', note: 'See what’s accelerating across the wires.' },
    ],
    tool: { view: 'signals', label: 'Signals', note: 'Cross-check with real-world activity signals.' } },
  { id: 'student', name: 'The Student & Researcher', room: 'The Midnight Archive', accent: '#c77dff',
    blurb: 'Go deep — research, map the network, cite everything.',
    primary: [
      { view: 'research', label: 'Intelligence Research', note: 'Run a grounded search across the live sources.' },
      { view: 'graph', label: 'Link Analysis', note: 'Map how the entities connect.' },
      { view: 'subject-lookup', label: 'Subject Lookup', note: 'Build out the key actors.' },
    ] },
  { id: 'political', name: 'The Political Analyst', room: 'The Briefing Room', accent: '#b57edc',
    blurb: 'Track parties, leaders and momentum into a sharp brief.',
    primary: [
      { view: 'politics', label: 'Elections & Politics', note: 'Read leader/party momentum and the election tracker.' },
      { view: 'government', label: 'Government', note: 'Tie it to governance actions and crises.' },
      { view: 'conflict', label: 'Instability Index', note: 'Place it against country-level instability.' },
    ],
    tool: { view: 'chatter', label: 'Chatter Tracker', note: 'Gauge the sentiment and spikes around it.' } },
  { id: 'entrepreneur', name: 'The Entrepreneur', room: 'The Deal Room', accent: '#f4a261',
    blurb: 'Due-diligence a counterparty before you shake hands.',
    primary: [
      { view: 'business', label: 'Business Watch', note: 'Scan the company and its sector.' },
      { view: 'markets', label: 'Markets', note: 'Check the macro backdrop of the market you’re entering.' },
      { view: 'subject-lookup', label: 'Subject Lookup', note: 'Background the principals.' },
    ],
    tool: { view: 'sanctions', label: 'Sanctions screening', note: 'Screen the counterparty and its owners.' } },
  { id: 'indie', name: 'The Independent Journalist', room: 'The Studio of One', accent: '#e07a5f',
    blurb: 'A lean one-person workflow — social, visuals, verify, publish.',
    primary: [
      { view: 'socmint', label: 'SOCMINT', note: 'Pull the open social signal on the story.' },
      { view: 'visual-intel', label: 'Visual Intel', note: 'Gather and sanity-check the imagery.' },
      { view: 'research', label: 'Research', note: 'Corroborate against the wires.' },
    ] },
  { id: 'newsroom', name: 'The Digital Newsroom', room: 'The Control Room', accent: '#ff5d5d',
    blurb: 'Run the desk — watchlists, alerts, trends, production at pace.',
    primary: [
      { view: 'watchlists', label: 'Watchlists', note: 'Set/scan the desk’s standing watchlists.' },
      { view: 'chatter', label: 'Chatter Tracker', note: 'Catch the breaking spike early.' },
      { view: 'trends', label: 'Trends', note: 'Spot the day’s momentum for commissioning.' },
    ],
    tool: { view: 'briefs', label: 'Daily Brief', note: 'Pull the standing daily brief as a starting point.' } },
  { id: 'owner', name: 'The Media Business Owner', room: 'The Glass Tower', accent: '#4ea8de',
    blurb: 'The executive overview — one risk picture, one decision.',
    primary: [
      { view: 'command', label: 'Command', note: 'Take the single risk picture across every monitor.' },
      { view: 'worldmap', label: 'Global Situation', note: 'See the whole world at a glance.' },
      { view: 'trends', label: 'Trends', note: 'Read where coverage and attention are heading.' },
    ] },
];

export const roleById = (id: string | null) => ROLES.find(r => r.id === id) || null;

// ---- Composed step engine ---------------------------------------------------
export type StepKind = 'orient' | 'pick' | 'collect' | 'tool' | 'read' | 'verify' | 'report' | 'brief';
export interface Step { kind: StepKind; title: string; what: string; view?: string; action?: string; investigate?: boolean; ai?: string }

/** Compose a role's full step list: orient through its screens → pick a lead →
 *  collect & pin → (specialised tool) → read → verify → report → file. */
export function buildSteps(role: Role | null): Step[] {
  const steps: Step[] = [];
  if (role) for (const p of role.primary) steps.push({ kind: 'orient', title: p.label, what: p.note, view: p.view, action: `Open ${p.label}` });
  steps.push({ kind: 'pick', title: 'Pick your lead', what: 'Choose a live topic from the situation below, or type your own. We’ll open a Case to hold everything you gather.' });
  steps.push({ kind: 'collect', title: 'Collect & pin sources', what: 'Search the topic, open promising results, and pin the credible ones to your Case with “Add to case”. Aim for 3+ independent outlets.', view: 'research', action: 'Open Research', investigate: true, ai: 'Ask AI to suggest investigative angles' });
  if (role?.tool) steps.push({ kind: 'tool', title: role.tool.label, what: role.tool.note, view: role.tool.view, action: `Open ${role.tool.label}` });
  steps.push({ kind: 'read', title: 'Read & extract', what: 'Open a pinned source in the reader. Note who/what/where/when and anything to check. Every capture is hash-stamped for provenance.', view: 'workbench', action: 'Open your Case', ai: 'Use “Summarise article with AI” in the reader' });
  steps.push({ kind: 'verify', title: 'Corroborate a claim', what: 'Take the most important claim and run Verify. 3+ independent outlets = corroborated; fewer = treat as unconfirmed.', view: 'research', action: 'Go to Verify' });
  steps.push({ kind: 'report', title: 'Compile the report', what: 'Open Reports with your Case. Write: Executive summary, Analysis, Implications, Indicators to watch — every claim tied to a pinned source.', view: 'reports', action: 'Open Reports', ai: 'Use the AI draft button in Reports' });
  steps.push({ kind: 'brief', title: 'File the brief', what: 'Save the finished write-up as a Rapid Brief so it’s filed and shareable. That closes the loop — collection to product.', view: 'briefs', action: 'Open Briefs' });
  return steps;
}

export interface Suggestion { label: string; query: string; tag: 'Convergence' | 'Instability' | 'Threat' }

/** Live, investigable topic suggestions drawn from the current situation. */
export async function suggestTopics(): Promise<Suggestion[]> {
  const out: Suggestion[] = [];
  const [conv, inst, intel] = await Promise.allSettled([getCorrelations(), getInstability(), api<{ threats: ServerThreat[] }>('/intel')]);
  if (conv.status === 'fulfilled') for (const c of (conv.value.convergences || []).slice(0, 3)) out.push({ label: `${c.country} — ${c.streamCount} converging streams`, query: c.country, tag: 'Convergence' });
  if (inst.status === 'fulfilled') for (const c of (inst.value.countries || []).slice(0, 3)) out.push({ label: `${c.country} — instability ${c.score}/100 (${c.band})`, query: c.country, tag: 'Instability' });
  if (intel.status === 'fulfilled') for (const t of (intel.value.threats || []).slice(0, 4)) out.push({ label: t.title, query: t.location || t.title, tag: 'Threat' });
  const seen = new Set<string>();
  return out.filter(s => { const k = s.query.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
}

// Events the dock dispatches / listens for.
export const MISSION_OPEN = 'cx:mission-open';
export const MISSION_INVESTIGATE = 'cx:investigate';
export const openMission = () => window.dispatchEvent(new Event(MISSION_OPEN));
export const investigateTopic = (q: string) => window.dispatchEvent(new CustomEvent(MISSION_INVESTIGATE, { detail: q }));
