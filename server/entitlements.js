// Subscription entitlements — the single source of truth for what a user can
// access. Billing is handled manually/offline; this module manages WHO can see
// WHAT. Monthly price of a bundle = the sum of its features at a-la-carte rates;
// annual = pay for 10 months (2 months free).

// A-la-carte price per feature, by group (monthly, INR).
export const GROUP_PRICE = { A: 4999, B: 3599, C: 2599 };
export const ANNUAL_MONTHS = 10;                 // pay 10, get 12

// Sellable features. `id` MUST match the client view id so gating is 1:1.
// Command, Settings, Alerts, threat detail, AI-connect, Academy, notifications
// and auth are baseline (free for everyone) and are NOT listed here.
export const FEATURES = [
  // ---- Group A — live monitoring dashboards (14)
  { id: 'worldmap',     group: 'A', name: 'Global Situation' },
  { id: 'liveearth',    group: 'A', name: 'Live Earth 3D' },
  { id: 'dashboard',    group: 'A', name: 'Security Dashboard' },
  { id: 'markets',      group: 'A', name: 'Markets & Reserves' },
  { id: 'business',     group: 'A', name: 'Business Watch' },
  { id: 'government',   group: 'A', name: 'Government' },
  { id: 'politics',     group: 'A', name: 'Elections & Politics' },
  { id: 'signals',      group: 'A', name: 'Signals' },
  { id: 'geoint',       group: 'A', name: 'Earth Watch' },
  { id: 'conflict',     group: 'A', name: 'Conflict Watch' },
  { id: 'maritime',     group: 'A', name: 'Maritime' },
  { id: 'chatter',      group: 'A', name: 'Chatter Tracker' },
  { id: 'trends',       group: 'A', name: 'Trends' },
  { id: 'visual-intel', group: 'A', name: 'Visual Intel' },
  { id: 'watchlists',   group: 'A', name: 'Watchlists' },
  // ---- Group B — investigation & OSINT tools (8)
  { id: 'mission',        group: 'B', name: 'Guided Mission' },
  { id: 'graph',          group: 'B', name: 'Link Analysis' },
  { id: 'research',       group: 'B', name: 'Intelligence Research' },   // mandatory on Starter
  { id: 'subject-lookup', group: 'B', name: 'Subject Lookup' },
  { id: 'sanctions',      group: 'B', name: 'Sanctions Screening' },
  { id: 'socmint',        group: 'B', name: 'Social Footprint' },
  { id: 'tools',          group: 'B', name: 'OSINT Tools' },
  { id: 'workbench',      group: 'B', name: 'Workbench' },
  // ---- Group C — output & reporting (2)
  { id: 'briefs',  group: 'C', name: 'Briefs' },
  { id: 'reports', group: 'C', name: 'Reports' },
];
export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map(f => [f.id, f]));
export const ALL_FEATURE_IDS = FEATURES.map(f => f.id);
export const groupOf = id => FEATURE_BY_ID[id]?.group || null;
export const priceOf = id => GROUP_PRICE[groupOf(id)] || 0;

// Views every signed-in user can always reach (never sold).
export const BASELINE_VIEWS = ['command', 'threat-wire', 'settings', 'alerts', 'plans', 'dev-registry'];

// Starter must include Intelligence Research among its B picks.
export const STARTER_REQUIRED_B = 'research';

// Plan allowances (how many features the user may pick from each group).
export const PLANS = {
  demo:         { name: 'Demo',         allow: { A: 1, B: 0, C: 0 }, free: true },
  starter:      { name: 'Starter',      allow: { A: 2, B: 3, C: 0 }, requireB: [STARTER_REQUIRED_B] },
  professional: { name: 'Professional', allow: { A: 3, B: 4, C: 1 } },
  business:     { name: 'Business',     allow: { A: 6, B: 5, C: 2 } },
  enterprise:   { name: 'Enterprise',   allow: null, custom: true },   // admin sets the allowance
};
export const PLAN_ORDER = ['demo', 'starter', 'professional', 'business', 'enterprise'];

// Allowance for a user's plan (enterprise uses the admin-set allowance).
export function allowanceFor(plan, ent) {
  if (plan === 'enterprise') return normAllow(ent?.entAllow);
  return PLANS[plan]?.allow ? { ...PLANS[plan].allow } : { A: 0, B: 0, C: 0 };
}
const normAllow = a => ({ A: Math.max(0, a?.A | 0), B: Math.max(0, a?.B | 0), C: Math.max(0, a?.C | 0) });

// Monthly price of a plan bundle = a-la-carte value of its allowance. Demo = 0.
export function planMonthly(plan, ent) {
  if (plan === 'demo') return 0;
  if (plan === 'enterprise') return null;              // custom / quote
  const a = allowanceFor(plan, ent);
  return a.A * GROUP_PRICE.A + a.B * GROUP_PRICE.B + a.C * GROUP_PRICE.C;
}
export const annualOf = monthly => (monthly == null ? null : monthly * ANNUAL_MONTHS);

// Normalise a stored entitlement blob (may be null for a fresh/legacy account).
export function normEntitlement(raw) {
  const e = raw && typeof raw === 'object' ? raw : {};
  return {
    selected: Array.isArray(e.selected) ? e.selected.filter(id => FEATURE_BY_ID[id]) : [],
    locked: !!e.locked,
    addons: Array.isArray(e.addons) ? e.addons.filter(id => FEATURE_BY_ID[id]) : [],
    allAccess: !!e.allAccess,
    entAllow: e.entAllow ? normAllow(e.entAllow) : null,
    billing: e.billing === 'annual' ? 'annual' : 'monthly',
  };
}

// The set of feature ids a user is entitled to right now.
export function entitledSet({ role, plan, legacyFull }, ent) {
  if (role === 'admin' || ent.allAccess || legacyFull) return new Set(ALL_FEATURE_IDS);
  return new Set([...ent.selected, ...ent.addons]);
}

// Count selected features per group.
export function countByGroup(ids) {
  const c = { A: 0, B: 0, C: 0 };
  for (const id of ids) { const g = groupOf(id); if (g) c[g]++; }
  return c;
}

// Validate a first-selection against a plan's allowance. Returns {ok, error}.
export function validateSelection(plan, ent, ids) {
  const clean = [...new Set(ids)].filter(id => FEATURE_BY_ID[id]);
  if (clean.length !== ids.length) return { ok: false, error: 'Unknown feature in selection.' };
  const allow = allowanceFor(plan, ent);
  const c = countByGroup(clean);
  for (const g of ['A', 'B', 'C']) {
    if (c[g] > allow[g]) return { ok: false, error: `Too many ${g}-group features (max ${allow[g]}).` };
  }
  const reqB = PLANS[plan]?.requireB || [];
  for (const need of reqB) {
    if (!clean.includes(need)) return { ok: false, error: `${FEATURE_BY_ID[need]?.name || need} is required on this plan.` };
  }
  return { ok: true, clean };
}
