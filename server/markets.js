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

// Instruments to pull. Stooq symbols; `dp` = decimal places for display.
export const STOOQ = [
  { id: 'wti', symbol: 'cl.f', label: 'Crude Oil (WTI)', category: 'Commodities', unit: 'USD/bbl', dp: 2 },
  { id: 'brent', symbol: 'cb.f', label: 'Crude Oil (Brent)', category: 'Commodities', unit: 'USD/bbl', dp: 2 },
  { id: 'gold', symbol: 'gc.f', label: 'Gold', category: 'Commodities', unit: 'USD/oz', dp: 1 },
  { id: 'silver', symbol: 'si.f', label: 'Silver', category: 'Commodities', unit: 'USD/oz', dp: 2 },
  { id: 'natgas', symbol: 'ng.f', label: 'Natural Gas', category: 'Commodities', unit: 'USD/MMBtu', dp: 3 },
  { id: 'copper', symbol: 'hg.f', label: 'Copper', category: 'Commodities', unit: 'USD/lb', dp: 3 },
  { id: 'spx', symbol: '^spx', label: 'S&P 500', category: 'Indices', unit: '', dp: 2 },
  { id: 'ndq', symbol: '^ndq', label: 'Nasdaq', category: 'Indices', unit: '', dp: 2 },
  { id: 'nifty', symbol: '^nsei', label: 'Nifty 50 (India)', category: 'Indices', unit: '', dp: 2 },
  { id: 'ftse', symbol: '^ftm', label: 'FTSE 100', category: 'Indices', unit: '', dp: 2 },
];

/** Parse a Stooq daily CSV (Date,Open,High,Low,Close,Volume) into {date,close}[] oldest→newest. */
export function parseStooqCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (!/date/i.test(lines[0])) return [];
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
    id: inst.id, label: inst.label, category: inst.category, unit: inst.unit, dp: inst.dp,
    value, change, changePct: prev ? (change / prev) * 100 : 0,
    spark: closes.slice(-30), asOf: series[series.length - 1].date, source: 'Stooq',
  };
}
async function pullStooq(inst) {
  const d2 = new Date();
  const d1 = new Date(d2.getTime() - 45 * 86400000);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(inst.symbol)}&d1=${fmt(d1)}&d2=${fmt(d2)}&i=d`;
  return quoteFromSeries(inst, parseStooqCsv(await fetchText(url, 'text/csv')));
}

// ---------------------------------------------------------------- Forex (ECB via Frankfurter)

export const FX = ['INR', 'EUR', 'GBP', 'JPY', 'CNY', 'AED', 'RUB', 'AUD', 'CAD', 'CHF'];
const FX_LABEL = { INR: 'US Dollar / Indian Rupee', EUR: 'US Dollar / Euro', GBP: 'US Dollar / Pound', JPY: 'US Dollar / Yen', CNY: 'US Dollar / Yuan', AED: 'US Dollar / UAE Dirham', RUB: 'US Dollar / Ruble', AUD: 'US Dollar / Aus Dollar', CAD: 'US Dollar / Can Dollar', CHF: 'US Dollar / Swiss Franc' };

/** Build FX quotes from a Frankfurter time-series (base USD). */
export function fxFromTimeseries(data) {
  const dates = Object.keys(data.rates || {}).sort();
  if (!dates.length) return [];
  const last = data.rates[dates[dates.length - 1]] || {};
  const prev = data.rates[dates[dates.length - 2]] || last;
  return FX.filter(sym => last[sym] != null).map(sym => {
    const value = last[sym];
    const p = prev[sym] ?? value;
    const spark = dates.map(d => data.rates[d]?.[sym]).filter(v => v != null).slice(-30);
    return { id: 'usd' + sym.toLowerCase(), label: FX_LABEL[sym] || `USD/${sym}`, category: 'Forex', unit: `${sym} per USD`, dp: sym === 'JPY' || sym === 'INR' ? 2 : 4, value, change: value - p, changePct: p ? ((value - p) / p) * 100 : 0, spark, asOf: dates[dates.length - 1], source: 'ECB' };
  });
}
async function pullForex() {
  const start = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
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

// ---------------------------------------------------------------- orchestration

const state = { updatedAt: null, refreshing: false, quotes: [], reserves: [], sources: {} };

export async function refreshMarkets() {
  if (state.refreshing) return;
  state.refreshing = true;
  const note = (id, ok, error) => { state.sources[id] = { ok, error: error || null, at: Date.now() }; };
  try {
    const quotes = [];
    for (const inst of STOOQ) {
      try { const q = await pullStooq(inst); if (q) quotes.push(q); note(inst.id, true); }
      catch (e) { note(inst.id, false, e.message); }
      await sleep(400);
    }
    try { quotes.push(...await pullForex()); note('forex', true); } catch (e) { note('forex', false, e.message); }
    try { quotes.push(...await pullCrypto()); note('crypto', true); } catch (e) { note('crypto', false, e.message); }
    if (quotes.length) state.quotes = quotes;
    try { const r = await pullReserves(); if (r.length) state.reserves = r; note('reserves', true); } catch (e) { note('reserves', false, e.message); }
    state.updatedAt = Date.now();
  } finally { state.refreshing = false; }
}

async function loadFixture(file) {
  const fs = await import('fs');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  state.quotes = data.quotes || [];
  state.reserves = data.reserves || [];
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
  return { updatedAt: state.updatedAt, refreshing: state.refreshing, groups, reserves: state.reserves, sources: state.sources };
}
