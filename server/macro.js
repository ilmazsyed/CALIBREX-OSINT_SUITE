// Macroeconomic context: key World Bank development indicators per country —
// an economic-vulnerability lens alongside the live markets feed. Keyless,
// free. Annual data (most-recent-value per country), so this is structural
// context, not a real-time signal. Refreshed daily; last-good kept on failure.
const WB = 'https://api.worldbank.org/v2';
const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 20000;
// Geopolitically significant economies (ISO-3), matched to the instability set.
const CODES = 'IN;PK;CN;US;RU;UA;IR;TR;EG;SA;IL;JP;KR;GB;FR;DE;BR;ZA;NG;VE;AF;SY;YE;SD;ET;MM;ID;PH;LK;BD';
const INDICATORS = [
  { id: 'NY.GDP.MKTP.KD.ZG', key: 'gdpGrowth', label: 'GDP growth %' },
  { id: 'FP.CPI.TOTL.ZG', key: 'inflation', label: 'Inflation %' },
  { id: 'SL.UEM.TOTL.ZS', key: 'unemployment', label: 'Unemployment %' },
  { id: 'GC.DOD.TOTL.GD.ZS', key: 'govDebt', label: 'Govt debt % GDP' },
  { id: 'BN.CAB.XOKA.GD.ZS', key: 'currentAccount', label: 'Current account % GDP' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

/** Parse a World Bank [meta, data] payload into iso3 -> { value, year, name } (most recent non-null). */
export function parseWb(json) {
  const data = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  const out = new Map();
  for (const r of data) {
    if (r.value == null) continue;
    const iso = r.countryiso3code || r.country?.id;
    if (!iso) continue;
    const prev = out.get(iso);
    if (!prev || Number(r.date) > Number(prev.year)) out.set(iso, { value: Number(r.value), year: r.date, name: r.country?.value || iso });
  }
  return out;
}

let state = { updatedAt: 0, countries: [], indicators: INDICATORS.map(i => ({ key: i.key, label: i.label })) };

export async function refreshMacro() {
  const perCountry = new Map();
  for (const ind of INDICATORS) {
    try {
      const m = parseWb(await getJson(`${WB}/country/${CODES}/indicator/${ind.id}?format=json&mrv=1&per_page=1000`));
      for (const [iso, v] of m) {
        const c = perCountry.get(iso) || { iso, country: v.name, indicators: {} };
        c.country = v.name; c.indicators[ind.key] = { value: v.value, year: v.year };
        perCountry.set(iso, c);
      }
    } catch { /* keep last-good for this indicator */ }
    await sleep(300);
  }
  const countries = [...perCountry.values()].sort((a, b) => a.country.localeCompare(b.country));
  if (countries.length) state = { updatedAt: Date.now(), countries, indicators: INDICATORS.map(i => ({ key: i.key, label: i.label })) };
  return state;
}

export function macroSnapshot() {
  return { ...state, note: 'World Bank development indicators (most recent available year per country). Annual data — structural context, not a real-time signal.' };
}

export function startMacroLoop() {
  refreshMacro().catch(e => console.error('[macro] refresh failed', e.message));
  setInterval(() => refreshMacro().catch(e => console.error('[macro] refresh failed', e.message)), 24 * 3600 * 1000).unref();
}
