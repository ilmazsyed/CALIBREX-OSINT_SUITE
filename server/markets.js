// Markets & Reserves: quantitative intel to sit alongside the news engine.
// All sources are free and keyless. Values are delayed (not a trading terminal)
// and some sources may throttle a cloud server — the dashboard shows staleness.
//   - Commodities & indices: Stooq daily CSV (crude, gold, silver, gas, copper, indices)
//   - Forex: ECB daily reference rates via Frankfurter
//   - Crypto: CoinGecko simple price
//   - Reserves: World Bank (annual, official) total reserves incl. gold
const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 20000;
const REFRESH_MS = 10 * 60 * 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchText(url, accept = '*/*') {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: accept } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}
const fetchJson = async url => JSON.parse(await fetchText(url, 'application/json'));

// ---------------------------------------------------------------- Stooq (commodities, indices)

// Instruments to pull. Stooq symbols; `dp` = decimal places; `region` groups indices.
// Symbols Stooq does not recognise simply fail and are shown as unavailable.
export const STOOQ = [
  // Commodities
  { id: 'wti', symbol: 'cl.f', label: 'Crude Oil (WTI)', category: 'Commodities', unit: 'USD/bbl', dp: 2 },
  { id: 'brent', symbol: 'cb.f', label: 'Crude Oil (Brent)', category: 'Commodities', unit: 'USD/bbl', dp: 2 },
  { id: 'gold', symbol: 'gc.f', label: 'Gold', category: 'Commodities', unit: 'USD/oz', dp: 1 },
  { id: 'silver', symbol: 'si.f', label: 'Silver', category: 'Commodities', unit: 'USD/oz', dp: 2 },
  { id: 'natgas', symbol: 'ng.f', label: 'Natural Gas', category: 'Commodities', unit: 'USD/MMBtu', dp: 3 },
  { id: 'copper', symbol: 'hg.f', label: 'Copper', category: 'Commodities', unit: 'USD/lb', dp: 3 },
  { id: 'wheat', symbol: 'zw.f', label: 'Wheat', category: 'Commodities', unit: 'USd/bu', dp: 2 },
  { id: 'corn', symbol: 'zc.f', label: 'Corn', category: 'Commodities', unit: 'USd/bu', dp: 2 },
  // Volatility (the fear gauge)
  { id: 'vix', symbol: '^vix', label: 'VIX (volatility)', category: 'Volatility', unit: '', dp: 2 },
  // Indices — Americas
  { id: 'spx', symbol: '^spx', label: 'S&P 500', category: 'Indices', region: 'Americas', unit: '', dp: 2 },
  { id: 'ndq', symbol: '^ndq', label: 'Nasdaq', category: 'Indices', region: 'Americas', unit: '', dp: 2 },
  { id: 'dji', symbol: '^dji', label: 'Dow Jones', category: 'Indices', region: 'Americas', unit: '', dp: 2 },
  { id: 'bvp', symbol: '^bvp', label: 'Bovespa (Brazil)', category: 'Indices', region: 'Americas', unit: '', dp: 0 },
  { id: 'mex', symbol: '^mex', label: 'IPC (Mexico)', category: 'Indices', region: 'Americas', unit: '', dp: 0 },
  // Indices — Europe
  { id: 'dax', symbol: '^dax', label: 'DAX (Germany)', category: 'Indices', region: 'Europe', unit: '', dp: 2 },
  { id: 'cac', symbol: '^cac', label: 'CAC 40 (France)', category: 'Indices', region: 'Europe', unit: '', dp: 2 },
  { id: 'ftse', symbol: '^ftm', label: 'FTSE 100 (UK)', category: 'Indices', region: 'Europe', unit: '', dp: 2 },
  { id: 'ibex', symbol: '^ibex', label: 'IBEX 35 (Spain)', category: 'Indices', region: 'Europe', unit: '', dp: 2 },
  { id: 'fmib', symbol: '^fmib', label: 'FTSE MIB (Italy)', category: 'Indices', region: 'Europe', unit: '', dp: 2 },
  { id: 'aex', symbol: '^aex', label: 'AEX (Netherlands)', category: 'Indices', region: 'Europe', unit: '', dp: 2 },
  { id: 'smi', symbol: '^smi', label: 'SMI (Switzerland)', category: 'Indices', region: 'Europe', unit: '', dp: 2 },
  // Indices — Asia-Pacific / MENA
  { id: 'nifty', symbol: '^nsei', label: 'Nifty 50 (India)', category: 'Indices', region: 'Asia-Pacific', unit: '', dp: 2 },
  { id: 'nkx', symbol: '^nkx', label: 'Nikkei 225 (Japan)', category: 'Indices', region: 'Asia-Pacific', unit: '', dp: 2 },
  { id: 'hsi', symbol: '^hsi', label: 'Hang Seng (HK)', category: 'Indices', region: 'Asia-Pacific', unit: '', dp: 2 },
  { id: 'shc', symbol: '^shc', label: 'Shanghai Composite', category: 'Indices', region: 'Asia-Pacific', unit: '', dp: 2 },
  { id: 'kospi', symbol: '^kospi', label: 'KOSPI (Korea)', category: 'Indices', region: 'Asia-Pacific', unit: '', dp: 2 },
  { id: 'axjo', symbol: '^axjo', label: 'ASX 200 (Australia)', category: 'Indices', region: 'Asia-Pacific', unit: '', dp: 2 },
];

/** Parse a Stooq daily CSV (Date,Open,High,Low,Close,Volume) into {date,close}[] oldest→newest. */
export function parseStooqCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (!lines.length || !/date/i.test(lines[0])) return [];
  const out = [];
  for (const line of lines.slice(1)) {
    const c = line.split(',');
    const close = parseFloat(c[4]);
    if (c[0] && Number.isFinite(close)) out.push({ date: c[0], close });
  }
  return out;
}
function quoteFromSeries(inst, series) {
  if (series.length < 1) return null;
  const closes = series.map(s => s.close);
  const value = closes[closes.length - 1];
  const prev = closes.length > 1 ? closes[closes.length - 2] : value;
  const change = value - prev;
  return {
    id: inst.id, label: inst.label, category: inst.category, region: inst.region || null, unit: inst.unit, dp: inst.dp,
    value, change, changePct: prev ? (change / prev) * 100 : 0,
    spark: closes.slice(-30), asOf: series[series.length - 1].date, source: 'Stooq',
  };
}
async function pullStooq(inst) {
  const d2 = new Date();
  const d1 = new Date(d2.getTime() - 420 * 86400000); // ~14 months for charts + z-scores/52w range
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(inst.symbol)}&d1=${fmt(d1)}&d2=${fmt(d2)}&i=d`;
  const series = parseStooqCsv(await fetchText(url, 'text/csv'));
  const quote = quoteFromSeries(inst, series);
  return quote ? { quote, series } : null;
}

// ---------------------------------------------------------------- Forex (ECB via Frankfurter)

// ECB reference set (Frankfurter). RUB was dropped by the ECB in 2022, so it is
// not requested here. EM currencies journalists watch in crises are included.
export const FX = ['INR', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'TRY', 'ZAR', 'BRL', 'MXN', 'KRW', 'IDR'];
const FX_LABEL = { INR: 'USD / Indian Rupee', EUR: 'USD / Euro', GBP: 'USD / Pound', JPY: 'USD / Yen', CNY: 'USD / Yuan', AUD: 'USD / Aus Dollar', CAD: 'USD / Can Dollar', CHF: 'USD / Swiss Franc', TRY: 'USD / Turkish Lira', ZAR: 'USD / SA Rand', BRL: 'USD / Brazil Real', MXN: 'USD / Mexican Peso', KRW: 'USD / Korean Won', IDR: 'USD / Indonesian Rupiah' };

/** Build FX quotes + full series from a Frankfurter time-series (base USD). Returns { quotes, series }. */
export function fxFromTimeseries(data) {
  const dates = Object.keys(data.rates || {}).sort();
  if (!dates.length) return { quotes: [], series: {} };
  const last = data.rates[dates[dates.length - 1]] || {};
  const prev = data.rates[dates[dates.length - 2]] || last;
  const quotes = [], series = {};
  for (const sym of FX) {
    if (last[sym] == null) continue;
    const id = 'usd' + sym.toLowerCase();
    const value = last[sym];
    const p = prev[sym] ?? value;
    const full = dates.map(d => ({ date: d, close: data.rates[d]?.[sym] })).filter(x => x.close != null);
    series[id] = full;
    quotes.push({ id, label: FX_LABEL[sym] || `USD/${sym}`, category: 'Forex', region: null, unit: `${sym} per USD`, dp: sym === 'JPY' || sym === 'KRW' || sym === 'IDR' ? 2 : 4, value, change: value - p, changePct: p ? ((value - p) / p) * 100 : 0, spark: full.map(x => x.close).slice(-30), asOf: dates[dates.length - 1], source: 'ECB' });
  }
  return { quotes, series };
}
async function pullForex() {
  const start = new Date(Date.now() - 420 * 86400000).toISOString().slice(0, 10);
  const data = await fetchJson(`https://api.frankfurter.app/${start}..?from=USD&to=${FX.join(',')}`);
  return fxFromTimeseries(data);
}

// ---------------------------------------------------------------- Crypto (CoinGecko)

const COINS = [{ id: 'bitcoin', label: 'Bitcoin' }, { id: 'ethereum', label: 'Ethereum' }];
export function cryptoFromJson(data) {
  return COINS.filter(c => data[c.id]).map(c => {
    const value = data[c.id].usd;
    const pct = data[c.id].usd_24h_change || 0;
    return { id: c.id, label: c.label, category: 'Crypto', unit: 'USD', dp: value >= 100 ? 0 : 2, value, change: value * (pct / 100) / (1 + pct / 100), changePct: pct, spark: [], asOf: new Date().toISOString().slice(0, 10), source: 'CoinGecko' };
  });
}
async function pullCrypto() {
  const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${COINS.map(c => c.id).join(',')}&vs_currencies=usd&include_24hr_change=true`);
  return cryptoFromJson(data);
}

// ---------------------------------------------------------------- Reserves (World Bank, annual)

export const RESERVE_COUNTRIES = [
  ['IND', 'India'], ['CHN', 'China'], ['USA', 'United States'], ['JPN', 'Japan'],
  ['RUS', 'Russia'], ['SAU', 'Saudi Arabia'], ['ARE', 'UAE'], ['GBR', 'United Kingdom'], ['PAK', 'Pakistan'],
];
/** Parse the World Bank indicator response (total reserves incl. gold, current US$). */
export function parseWorldBank(json) {
  const rows = Array.isArray(json) && json[1] ? json[1] : [];
  const byCountry = new Map();
  for (const r of rows) {
    if (r.value == null) continue;
    const code = r.countryiso3code || r.country?.id;
    if (!byCountry.has(code)) byCountry.set(code, { code, country: r.country?.value, value: r.value, year: r.date });
  }
  return RESERVE_COUNTRIES.map(([code, name]) => {
    const d = byCountry.get(code);
    return { code, country: name, usd: d?.value ?? null, year: d?.year ?? null };
  }).filter(d => d.usd != null).sort((a, b) => b.usd - a.usd);
}
async function pullReserves() {
  const codes = RESERVE_COUNTRIES.map(c => c[0]).join(';');
  const json = await fetchJson(`https://api.worldbank.org/v2/country/${codes}/indicator/FI.RES.TOTL.CD?format=json&mrnev=1&per_page=200`);
  return parseWorldBank(json);
}

// ---------------------------------------------------------------- US Treasury yield curve (keyless)

const TENORS = [['3 Mo', '3M', 0.25], ['2 Yr', '2Y', 2], ['5 Yr', '5Y', 5], ['10 Yr', '10Y', 10], ['30 Yr', '30Y', 30]];

/** Split one CSV line, honouring quoted fields (Treasury quotes its headers). */
function csvRow(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

/** Parse the daily Treasury par-yield CSV → the newest curve + the 10y-2y spread. */
export function parseTreasuryYields(csv) {
  const lines = String(csv).trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = csvRow(lines[0]);
  const idx = label => header.findIndex(h => h.toLowerCase() === label.toLowerCase());
  const dateCol = 0;
  const rows = lines.slice(1).map(csvRow).filter(r => r[dateCol]);
  if (!rows.length) return null;
  // Newest by date (the feed is usually newest-first, but do not assume).
  rows.sort((a, b) => new Date(b[dateCol]) - new Date(a[dateCol]));
  const row = rows[0];
  const points = [];
  for (const [label, short, years] of TENORS) {
    const i = idx(label);
    const v = i >= 0 ? parseFloat(row[i]) : NaN;
    if (Number.isFinite(v)) points.push({ label: short, years, pct: v });
  }
  if (points.length < 2) return null;
  const y2 = points.find(p => p.years === 2)?.pct;
  const y10 = points.find(p => p.years === 10)?.pct;
  const spread10y2y = Number.isFinite(y2) && Number.isFinite(y10) ? +(y10 - y2).toFixed(2) : null;
  return { asOf: row[dateCol], points, spread10y2y, inverted: spread10y2y != null && spread10y2y < 0 };
}
async function pullYields() {
  const yr = new Date().getUTCFullYear();
  const url = y => `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
  let res = parseTreasuryYields(await fetchText(url(yr), 'text/csv'));
  if (!res) res = parseTreasuryYields(await fetchText(url(yr - 1), 'text/csv')); // early January fallback
  return res;
}

// ---------------------------------------------------------------- orchestration

const state = { updatedAt: null, refreshing: false, quotes: [], series: {}, reserves: [], yields: null, sources: {} };

export async function refreshMarkets() {
  if (state.refreshing) return;
  state.refreshing = true;
  const note = (id, ok, error) => { state.sources[id] = { ok, error: error || null, at: Date.now() }; };
  try {
    const quotes = [];
    const series = {};
    for (const inst of STOOQ) {
      try { const r = await pullStooq(inst); if (r) { quotes.push(r.quote); series[r.quote.id] = r.series; } note(inst.id, true); }
      catch (e) { note(inst.id, false, e.message); }
      await sleep(400);
    }
    try { const fx = await pullForex(); quotes.push(...fx.quotes); Object.assign(series, fx.series); note('forex', true); } catch (e) { note('forex', false, e.message); }
    try { quotes.push(...await pullCrypto()); note('crypto', true); } catch (e) { note('crypto', false, e.message); }
    if (quotes.length) { state.quotes = quotes; state.series = series; }
    try { const r = await pullReserves(); if (r.length) state.reserves = r; note('reserves', true); } catch (e) { note('reserves', false, e.message); }
    try { const y = await pullYields(); if (y) state.yields = y; note('yields', true); } catch (e) { note('yields', false, e.message); }
    state.updatedAt = Date.now();
    for (const fn of listeners) Promise.resolve().then(() => fn(marketsSnapshot(), state.series)).catch(e => console.error('[markets] listener', e));
  } finally { state.refreshing = false; }
}

// Listeners run after each refresh (used by the crisis engine / alert delivery).
const listeners = new Set();
export function onMarketsRefresh(fn) { listeners.add(fn); return () => listeners.delete(fn); }

async function loadFixture(file) {
  const fs = await import('fs');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  state.quotes = data.quotes || [];
  state.series = data.series || {};
  state.reserves = data.reserves || [];
  state.yields = data.yields || null;
  state.sources = { fixture: { ok: true, error: null, at: Date.now() } };
  state.updatedAt = Date.now();
}

export function startMarketsLoop() {
  if (process.env.MARKETS_FIXTURE) { loadFixture(process.env.MARKETS_FIXTURE).catch(e => console.error('[markets] fixture', e)); return; }
  refreshMarkets().catch(e => console.error('[markets] refresh failed', e));
  setInterval(() => refreshMarkets().catch(e => console.error('[markets] refresh failed', e)), REFRESH_MS).unref();
}

export function marketsSnapshot() {
  const groups = {};
  for (const q of state.quotes) (groups[q.category] ||= []).push(q);
  return { updatedAt: state.updatedAt, refreshing: state.refreshing, groups, reserves: state.reserves, yields: state.yields, sources: state.sources };
}

/** Full daily series for one instrument id (for the chart modal). */
export function marketsSeries(id) {
  return state.series[id] || [];
}
/** All stored series (used by the crisis engine). */
export function allSeries() { return state.series; }
