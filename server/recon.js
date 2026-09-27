// Infrastructure recon: given a domain or IP tied to a threat actor's
// website (propaganda site, phishing domain, ransomware leak site), gather
// what public, keyless sources say about it. No people, no private data.
//   - Subdomains from Certificate Transparency (crt.sh)
//   - DNS records (Google/Cloudflare DNS-over-HTTPS)
//   - Domain registration (RDAP)
//   - IP ownership, network and country (RDAP)
//   - Reputation flags (abuse.ch URLhaus, public feeds)
//   - Archive history (Wayback Machine)
import dns from 'dns/promises';
import net from 'net';

const UA = 'CalibrexOSINT/1.0 (+https://github.com/ilmazsyed/CALIBREX-OSINT_SUITE)';
const TIMEOUT = 15000;
const cache = new Map(); // key -> { at, value }
const CACHE_MS = 30 * 60000;

const DOMAIN_RE = /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,}$/;

/** Classify and clean the input. Returns { kind: 'domain'|'ipv4'|'ipv6', value } or null. */
export function parseTarget(raw) {
  let s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  // Strip a scheme/path if a whole URL was pasted.
  if (s.includes('/') || s.includes(':')) {
    try { s = new URL(s.includes('://') ? s : 'http://' + s).hostname || s; } catch { /* keep raw */ }
  }
  s = s.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (net.isIPv4(s)) return { kind: 'ipv4', value: s };
  if (net.isIPv6(s)) return { kind: 'ipv6', value: s };
  if (DOMAIN_RE.test(s)) return { kind: 'domain', value: s };
  return null;
}

async function getJson(url, { headers = {}, timeout = TIMEOUT } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
    if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------- DNS

const DOH = 'https://dns.google/resolve';
async function dohQuery(name, type) {
  try {
    const data = await getJson(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, { headers: { Accept: 'application/dns-json' } });
    return (data.Answer || []).filter(a => a.type === { A: 1, AAAA: 28, MX: 15, NS: 2, TXT: 16, CNAME: 5 }[type]).map(a => a.data.replace(/^"|"$/g, ''));
  } catch { return []; }
}
async function dnsRecords(domain) {
  const [a, aaaa, mx, ns, txt] = await Promise.all([dohQuery(domain, 'A'), dohQuery(domain, 'AAAA'), dohQuery(domain, 'MX'), dohQuery(domain, 'NS'), dohQuery(domain, 'TXT')]);
  return {
    a, aaaa,
    mx: mx.map(m => m.replace(/^\d+\s+/, '').replace(/\.$/, '')),
    ns: ns.map(n => n.replace(/\.$/, '')),
    // TXT often reveals which mail/cloud providers the operator uses.
    txt: txt.slice(0, 12),
  };
}

// ---------------------------------------------------------------- subdomains (Certificate Transparency)

async function subdomains(domain) {
  try {
    const rows = await getJson(`https://crt.sh/?q=${encodeURIComponent('%.' + domain)}&output=json`, { timeout: 20000 });
    const set = new Set();
    for (const r of rows) String(r.name_value || '').split('\n').forEach(n => {
      n = n.trim().toLowerCase().replace(/^\*\./, '');
      if (n && n.endsWith(domain) && DOMAIN_RE.test(n)) set.add(n);
    });
    set.delete(domain);
    return { names: [...set].sort().slice(0, 500), truncated: set.size > 500, source: 'crt.sh (Certificate Transparency logs)' };
  } catch (e) {
    return { names: [], truncated: false, error: `Certificate Transparency search unavailable (${e.message}).` };
  }
}

// ---------------------------------------------------------------- registration (RDAP)

function contactsFromRdap(obj) {
  const out = { registrar: null, created: null, updated: null, expires: null, statuses: [], nameservers: [], org: null, country: null, abuse: null };
  out.statuses = (obj.status || []).slice(0, 12);
  for (const e of obj.events || []) {
    if (e.eventAction === 'registration') out.created = e.eventDate;
    if (e.eventAction === 'last changed' || e.eventAction === 'last update of RDAP database') out.updated = e.eventDate || out.updated;
    if (e.eventAction === 'expiration') out.expires = e.eventDate;
  }
  out.nameservers = (obj.nameservers || []).map(n => String(n.ldhName || '').toLowerCase()).filter(Boolean);
  for (const en of obj.entities || []) {
    const roles = en.roles || [];
    const vcard = en.vcardArray?.[1] || [];
    const get = k => vcard.find(f => f[0] === k)?.[3];
    if (roles.includes('registrar')) out.registrar = get('fn') || en.handle || out.registrar;
    if (roles.includes('registrant')) { out.org = get('org') || out.org; const adr = vcard.find(f => f[0] === 'adr')?.[3]; if (Array.isArray(adr)) out.country = adr[6] || out.country; }
    if (roles.includes('abuse')) { const em = get('email'); if (em) out.abuse = em; }
    for (const sub of en.entities || []) { if ((sub.roles || []).includes('abuse')) { const em = (sub.vcardArray?.[1] || []).find(f => f[0] === 'email')?.[3]; if (em) out.abuse = em; } }
  }
  return out;
}

async function domainRegistration(domain) {
  try {
    const data = await getJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { timeout: 20000 });
    return { ok: true, ...contactsFromRdap(data) };
  } catch (e) {
    return { ok: false, error: e.status === 404 ? 'No registration record found (the registry may not publish RDAP for this TLD).' : `Registration lookup failed (${e.message}).` };
  }
}

async function ipInfo(ip) {
  try {
    const data = await getJson(`https://rdap.org/ip/${encodeURIComponent(ip)}`, { timeout: 15000 });
    const out = { ok: true, network: data.name || null, handle: data.handle || null, country: data.country || null, type: data.type || null, cidr: null, org: null, abuse: null };
    if (Array.isArray(data.cidr0_cidrs) && data.cidr0_cidrs[0]) { const c = data.cidr0_cidrs[0]; out.cidr = `${c.v4prefix || c.v6prefix}/${c.length}`; }
    for (const en of data.entities || []) {
      const vcard = en.vcardArray?.[1] || [];
      if ((en.roles || []).includes('registrant') || (en.roles || []).includes('administrative')) out.org = vcard.find(f => f[0] === 'fn')?.[3] || en.handle || out.org;
      const collect = e => { for (const sub of e.entities || []) { if ((sub.roles || []).includes('abuse')) { const em = (sub.vcardArray?.[1] || []).find(f => f[0] === 'email')?.[3]; if (em) out.abuse = em; } collect(sub); } };
      collect(en);
    }
    return out;
  } catch (e) {
    return { ok: false, error: `IP ownership lookup failed (${e.message}).` };
  }
}

// ---------------------------------------------------------------- reputation

async function reputation(target) {
  const flags = [];
  // abuse.ch URLhaus: known malware-distribution hosts (keyless host API).
  try {
    const host = target.kind === 'domain' ? target.value : target.value;
    const res = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
      method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `host=${encodeURIComponent(host)}`, signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json().catch(() => ({}));
    if (data.query_status === 'ok') {
      flags.push({ source: 'abuse.ch URLhaus', level: 'malicious', detail: `Listed with ${data.url_count || 0} malware URL(s). First seen ${data.firstseen || 'unknown'}.`, url: data.urlhaus_reference || 'https://urlhaus.abuse.ch/' });
    }
  } catch { /* source unavailable */ }
  return flags;
}

// ---------------------------------------------------------------- archive

async function wayback(target) {
  try {
    const q = target.kind === 'domain' ? target.value : target.value;
    const data = await getJson(`https://archive.org/wayback/available?url=${encodeURIComponent(q)}`, { timeout: 12000 });
    const snap = data?.archived_snapshots?.closest;
    return snap?.available ? { available: true, url: snap.url, timestamp: snap.timestamp, viewer: `https://web.archive.org/web/*/${q}` } : { available: false, viewer: `https://web.archive.org/web/*/${q}` };
  } catch { return { available: false }; }
}

// ---------------------------------------------------------------- orchestration

/** Handy external viewers for the analyst to dig further. */
function externalLinks(target) {
  const v = encodeURIComponent(target.value);
  if (target.kind === 'domain') return [
    { label: 'VirusTotal', url: `https://www.virustotal.com/gui/domain/${v}` },
    { label: 'Shodan', url: `https://www.shodan.io/search?query=hostname:${v}` },
    { label: 'crt.sh certificates', url: `https://crt.sh/?q=${v}` },
    { label: 'urlscan.io', url: `https://urlscan.io/domain/${v}` },
    { label: 'SecurityTrails', url: `https://securitytrails.com/domain/${v}/dns` },
    { label: 'Wayback Machine', url: `https://web.archive.org/web/*/${v}` },
  ];
  return [
    { label: 'VirusTotal', url: `https://www.virustotal.com/gui/ip-address/${v}` },
    { label: 'Shodan', url: `https://www.shodan.io/host/${v}` },
    { label: 'AbuseIPDB', url: `https://www.abuseipdb.com/check/${v}` },
    { label: 'GreyNoise', url: `https://viz.greynoise.io/ip/${v}` },
    { label: 'urlscan.io', url: `https://urlscan.io/ip/${v}` },
  ];
}

/** Full recon on one domain or IP. Everything comes from public, keyless sources. */
export async function recon(raw) {
  const target = parseTarget(raw);
  if (!target) throw Object.assign(new Error('Enter a domain (example.com) or an IP address.'), { status: 400 });
  const key = `${target.kind}:${target.value}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let result;
  if (target.kind === 'domain') {
    const [dnsr, subs, reg, rep, arch] = await Promise.all([
      dnsRecords(target.value), subdomains(target.value), domainRegistration(target.value), reputation(target), wayback(target),
    ]);
    // Look up ownership of the first resolved IP so the analyst sees the host too.
    let host = null;
    if (dnsr.a[0]) host = await ipInfo(dnsr.a[0]);
    result = { target, dns: dnsr, host, subdomains: subs, registration: reg, reputation: rep, archive: arch, links: externalLinks(target) };
  } else {
    const [info, rep, arch] = await Promise.all([ipInfo(target.value), reputation(target), wayback(target)]);
    let ptr = [];
    try { ptr = await dns.reverse(target.value); } catch { /* no PTR */ }
    result = { target, ipInfo: info, ptr, reputation: rep, archive: arch, links: externalLinks(target) };
  }
  result.checkedAt = Date.now();
  cache.set(key, { at: Date.now(), value: result });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return result;
}
