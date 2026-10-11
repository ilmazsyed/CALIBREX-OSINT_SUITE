// Gated "sensitive" tools: lookups that are lawful but carry policy/ToS weight
// (closed-source SOCMINT and dark-web search). They are OFF by default. An
// administrator must explicitly enable them with a written authorization
// acknowledgment, and EVERY query is written to an audit the master admin can
// review. No facial recognition.
const AUDIT_MAX = 2000;

/** Current gate state. */
export async function getGate(store) {
  const g = (await store.getSetting('sensitive_tools')) || {};
  return { enabled: !!g.enabled, acknowledgedBy: g.acknowledgedBy || null, acknowledgedAt: g.acknowledgedAt || null };
}

/** Enable/disable the gate. Enabling requires an acknowledgment string. */
export async function setGate(store, { enabled, acknowledgment }, adminUser) {
  if (enabled && !(acknowledgment && String(acknowledgment).trim().length >= 10))
    throw Object.assign(new Error('To enable sensitive tools, confirm you are legally authorized to run these lookups.'), { status: 400 });
  const state = enabled
    ? { enabled: true, acknowledgedBy: adminUser.email, acknowledgedAt: Date.now(), acknowledgment: String(acknowledgment).slice(0, 500) }
    : { enabled: false };
  await store.setSetting('sensitive_tools', state);
  return getGate(store);
}

/** Throw unless the gate is open. */
export async function ensureGate(store) {
  const g = await getGate(store);
  if (!g.enabled) throw Object.assign(new Error('Sensitive tools are disabled. An administrator must enable them in Settings.'), { status: 403, code: 'sensitive_disabled' });
}

/** Append one query to the audit. */
export async function audit(store, { user, tool, query }) {
  const log = (await store.getSetting('sensitive_audit')) || [];
  log.unshift({ id: Date.now().toString(36), at: Date.now(), userId: user.id, email: user.email, tool, query: String(query || '').slice(0, 200) });
  await store.setSetting('sensitive_audit', log.slice(0, AUDIT_MAX));
}

export async function getAudit(store) { return (await store.getSetting('sensitive_audit')) || []; }
