// Entity pivot engine ("transforms"): given one selector, return connected
// entities as graph nodes + edges. All sources here are PUBLIC and keyless —
// certificate transparency (crt.sh), DNS-over-HTTPS (Google), domain registry
// (RDAP), and the app's own sanctions lists. Passive lookups only; no scanning.
import { screen as screenSanctions } from './sanctions.js';

const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 15000;

async function getJson(url, accept = 'application/json') {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: accept } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,24}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Best-guess selector type. */
export function detectType(value) {
  const v = String(value || '').trim();
  if (EMAIL_RE.test(v)) return 'email';
  if (IP_RE.test(v)) return 'ip';
  if (DOMAIN_RE.test(v)) return 'domain';
  return 'entity';
}

const node = (id, label, type) => ({ id: String(id), label: String(label), type });
const edge = (s, t, label) => ({ source: String(s), target: String(t), label });

async function domainPivot(domain) {
  const nodes = [node(domain, domain, 'domain')];
  const edges = [];
  const seen = new Set([domain]);
  const add = (id, label, type, from, rel) => { if (!seen.has(id)) { seen.add(id); nodes.push(node(id, label, type)); } edges.push(edge(from, id, rel)); };

  // Certificate-transparency subdomains (crt.sh)
  await getJson(`https://crt.sh/?q=${encodeURIComponent('%.' + domain)}&output=json`).then(rows => {
    const subs = new Set();
    for (const r of (rows || [])) String(r.name_value || '').split(/\n/).forEach(s => { s = s.trim().toLowerCase(); if (s && s.endsWith(domain) && s !== domain && !s.startsWith('*')) subs.add(s); });
    [...subs].slice(0, 40).forEach(s => add(s, s, 'subdomain', domain, 'cert'));
  }).catch(() => {});

  // DNS records (DoH)
  for (const [type, rel] of [['A', 'A'], ['MX', 'MX'], ['NS', 'NS']]) {
    await getJson(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`).then(j => {
      (j.Answer || []).slice(0, 8).forEach(a => {
        const data = String(a.data || '').replace(/\.$/, '').replace(/^\d+\s+/, '');
        if (!data) return;
        const kind = type === 'A' ? 'ip' : type === 'MX' ? 'mx' : 'ns';
        add(data.toLowerCase(), data, kind, domain, rel);
      });
    }).catch(() => {});
  }

  // Registrar (RDAP)
  await getJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`).then(j => {
    const reg = (j.entities || []).find(e => (e.roles || []).includes('registrar'));
    const name = reg?.vcardArray?.[1]?.find(x => x[0] === 'fn')?.[3];
    if (name) add('reg:' + name, name, 'registrar', domain, 'registrar');
  }).catch(() => {});

  return { nodes, edges };
}

async function ipPivot(ip) {
  const nodes = [node(ip, ip, 'ip')];
  const edges = [];
  // Reverse DNS (PTR) via DoH
  const rev = ip.split('.').reverse().join('.') + '.in-addr.arpa';
  await getJson(`https://dns.google/resolve?name=${encodeURIComponent(rev)}&type=PTR`).then(j => {
    (j.Answer || []).slice(0, 5).forEach(a => {
      const host = String(a.data || '').replace(/\.$/, '');
      if (host) { nodes.push(node(host.toLowerCase(), host, 'domain')); edges.push(edge(ip, host.toLowerCase(), 'PTR')); }
    });
  }).catch(() => {});
  return { nodes, edges };
}

function emailPivot(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  const nodes = [node(email, email, 'email')];
  const edges = [];
  if (domain && DOMAIN_RE.test(domain)) { nodes.push(node(domain, domain, 'domain')); edges.push(edge(email, domain, 'domain')); }
  return { nodes, edges };
}

function entityPivot(name) {
  const nodes = [node(name, name, 'person')];
  const edges = [];
  const { matches } = screenSanctions(name);
  matches.slice(0, 8).forEach(m => {
    const id = 'sdn:' + m.name;
    nodes.push(node(id, `${m.name} (${m.score})`, 'sanction'));
    edges.push(edge(name, id, m.program || m.list));
  });
  return { nodes, edges };
}

/** Run the pivot for a value; returns { type, nodes, edges }. */
export async function pivot(value, typeHint) {
  const v = String(value || '').trim();
  if (!v) return { type: 'unknown', nodes: [], edges: [] };
  const type = typeHint && typeHint !== 'auto' ? typeHint : detectType(v);
  let g = { nodes: [], edges: [] };
  try {
    if (type === 'domain') g = await domainPivot(v.toLowerCase());
    else if (type === 'ip') g = await ipPivot(v);
    else if (type === 'email') g = emailPivot(v.toLowerCase());
    else g = entityPivot(v);
  } catch { /* return whatever we have */ }
  return { type, value: v, ...g };
}
