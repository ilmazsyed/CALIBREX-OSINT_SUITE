import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStooqCsv, fxFromTimeseries, cryptoFromJson, parseWorldBank } from '../markets.js';

test('Stooq CSV parses daily closes oldest to newest', () => {
  const csv = 'Date,Open,High,Low,Close,Volume\n2026-09-25,73.1,74,72.8,73.5,100\n2026-09-26,73.5,75,73.2,74.8,120\nbad,,,,,';
  const s = parseStooqCsv(csv);
  assert.equal(s.length, 2);
  assert.deepEqual(s[1], { date: '2026-09-26', close: 74.8 });
  assert.equal(parseStooqCsv('no header here').length, 0);
});

test('Forex quotes: latest rate, daily change and sparkline from a timeseries', () => {
  const data = { base: 'USD', rates: { '2026-09-24': { INR: 88.0, EUR: 0.92 }, '2026-09-25': { INR: 88.5, EUR: 0.93 } } };
  const q = fxFromTimeseries(data);
  const inr = q.find(x => x.id === 'usdinr');
  assert.equal(inr.value, 88.5);
  assert.ok(Math.abs(inr.change - 0.5) < 1e-9);
  assert.deepEqual(inr.spark, [88.0, 88.5]);
  assert.equal(inr.category, 'Forex');
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
