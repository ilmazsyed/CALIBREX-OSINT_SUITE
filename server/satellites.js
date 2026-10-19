// Satellite orbital elements (TLEs) for the Live Earth 3D globe. Keyless —
// CelesTrak publishes current TLEs; the client propagates positions with SGP4
// (satellite.js). We cache for hours (TLEs change slowly) and never wipe a good
// cache on a failed refresh, matching Calibrex's fail-proof feed policy.

let cache = { at: 0, sats: [] };
const TTL = 6 * 60 * 60 * 1000;          // 6h

// Ordered so the most recognisable objects (ISS + bright sats) come first; the
// list is capped to keep client-side SGP4 cheap on phones.
const GROUPS = [
  ['stations', 'Stations', 20],
  ['visual', 'Bright', 120],
  ['weather', 'Weather', 60],
  ['science', 'Science', 60],
];
const CAP = 260;

function parseTle(txt, group, limit) {
  const lines = txt.split(/\r?\n/).map(l => l.replace(/\s+$/, '')).filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 < lines.length && out.length < limit; i += 3) {
    const name = lines[i].trim();
    const t1 = lines[i + 1];
    const t2 = lines[i + 2];
    if (t1 && t2 && t1.startsWith('1 ') && t2.startsWith('2 ')) out.push({ name, tle1: t1, tle2: t2, group });
  }
  return out;
}

async function fetchGroup(g, limit) {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`;
  const r = await fetch(url, { headers: { 'user-agent': 'Calibrex/1.0 (+https://calibrex.org)' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`celestrak ${g} ${r.status}`);
  return parseTle(await r.text(), g, limit);
}

export async function satellites() {
  if (cache.sats.length && Date.now() - cache.at < TTL) return cache.sats;
  const results = await Promise.allSettled(GROUPS.map(([g, , lim]) => fetchGroup(g, lim)));
  let sats = [];
  for (const r of results) if (r.status === 'fulfilled') sats = sats.concat(r.value);
  if (sats.length) cache = { at: Date.now(), sats: sats.slice(0, CAP) };   // never wipe on total failure
  return cache.sats;
}
export const satellitesUpdatedAt = () => cache.at;
