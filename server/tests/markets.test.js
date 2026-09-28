import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStooqCsv, fxFromTimeseries, cryptoFromJson, parseWorldBank, parseTreasuryYields } from '../markets.js';

test('Stooq CSV parses daily closes oldest to newest', () => {
  const csv = 'Date,Open,High,Low,Close,Volume\n2026-09-25,73.1,74,72.8,73.5,100\n2026-09-26,73.5,75,73.2,74.8,120\nbad,,,,,';
  const s = parseStooqCsv(csv);
  assert.equal(s.length, 2);
  assert.deepEqual(s[1], { date: '2026-09-26', close: 74.8 });
  assert.equal(parseStooqCsv('no header here').length, 0);
});

test('Forex quotes: latest rate, daily change, sparkline and full series from a timeseries', () => {
  const data = { base: 'USD', rates: { '2026-09-24': { INR: 88.0, EUR: 0.92 }, '2026-09-25': { INR: 88.5, EUR: 0.93 } } };
  const { quotes, series } = fxFromTimeseries(data);
  const inr = quotes.find(x => x.id === 'usdinr');
  assert.equal(inr.value, 88.5);
  assert.ok(Math.abs(inr.change - 0.5) < 1e-9);
  assert.deepEqual(inr.spark, [88.0, 88.5]);
  assert.equal(inr.category, 'Forex');
  assert.deepEqual(series.usdinr, [{ date: '2026-09-24', close: 88.0 }, { date: '2026-09-25', close: 88.5 }]);
});

test('Treasury yields: parses newest curve and flags 10y-2y inversion', () => {
  const csv = 'Date,"1 Mo","3 Mo","2 Yr","5 Yr","10 Yr","30 Yr"\n' +
    '09/26/2026,4.90,4.80,4.20,4.00,3.90,4.30\n' +   // newer, inverted (10y<2y)
    '09/25/2026,4.91,4.82,4.10,4.05,4.25,4.40';        // older, not inverted
  const y = parseTreasuryYields(csv);
  assert.equal(y.asOf, '09/26/2026'); // newest row chosen regardless of order
  assert.equal(y.points.find(p => p.years === 10).pct, 3.90);
  assert.equal(y.spread10y2y, -0.30);
  assert.equal(y.inverted, true);
  assert.equal(parseTreasuryYields('only,a,header'), null);
});

test('Crypto quotes carry price and 24h change', () => {
  const q = cryptoFromJson({ bitcoin: { usd: 64000, usd_24h_change: 2.5 }, ethereum: { usd: 3200, usd_24h_change: -1.1 } });
  assert.equal(q[0].label, 'Bitcoin');
  assert.equal(q[0].value, 64000);
  assert.equal(q[0].changePct, 2.5);
  assert.equal(q[1].changePct, -1.1);
});

test('World Bank reserves: latest non-empty value per country, sorted desc', () => {
  const json = [{ page: 1 }, [
    { countryiso3code: 'IND', country: { value: 'India' }, value: 700e9, date: '2024' },
    { countryiso3code: 'CHN', country: { value: 'China' }, value: 3200e9, date: '2024' },
    { countryiso3code: 'PAK', country: { value: 'Pakistan' }, value: null, date: '2024' },
  ]];
  const r = parseWorldBank(json);
  assert.equal(r[0].country, 'China');
  assert.equal(r[0].usd, 3200e9);
  assert.ok(!r.some(x => x.code === 'PAK')); // null dropped
  assert.equal(r.find(x => x.code === 'IND').year, '2024');
});
