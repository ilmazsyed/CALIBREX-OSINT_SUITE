import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeQuote, detectEvents, countryStress, stdev } from '../crisis.js';

const series = (closes, start = '2026-01-01') => closes.map((close, i) => ({ date: `d${i}`, close }));
const flat = (n, v) => Array.from({ length: n }, () => v);

test('analyzeQuote: bear market when >20% below the 12-month high', () => {
  const closes = [...flat(200, 100), 78]; // high 100, last 78 => -22%
  const e = analyzeQuote({ id: 'spx', label: 'S&P 500', category: 'Indices', changePct: -1, asOf: '2026-09-28' }, series(closes));
  assert.equal(e.kind, 'bear');
  assert.equal(e.severity, 'CRITICAL');
  assert.match(e.message, /bear-market/);
  assert.equal(e.id, 'spx:bear:2026-09-28');
});

test('analyzeQuote: correction between -10% and -20%', () => {
  const e = analyzeQuote({ id: 'dax', label: 'DAX', category: 'Indices', changePct: -1, asOf: 'x' }, series([...flat(200, 100), 88]));
  assert.equal(e.kind, 'correction');
  assert.equal(e.severity, 'HIGH');
});

test('analyzeQuote: currency 12-month low against USD', () => {
  const e = analyzeQuote({ id: 'usdtry', label: 'USD / Turkish Lira', category: 'Forex', changePct: 0.5, asOf: 'x' }, series([...flat(60, 30), 42]));
  assert.equal(e.kind, 'ccy_low');
  assert.match(e.message, /Turkish Lira fell to a 12-month low/);
});

test('analyzeQuote: quiet series produces no event; too-short series ignored', () => {
  assert.equal(analyzeQuote({ id: 'x', label: 'X', category: 'Indices', changePct: 0.1, asOf: 'x' }, series(flat(200, 100))), null);
  assert.equal(analyzeQuote({ id: 'x', label: 'X', category: 'Indices', changePct: 0.1, asOf: 'x' }, series([100, 101])), null);
});

test('detectEvents: adds a yield-inversion event and sorts most-severe first', () => {
  const quotes = [{ id: 'spx', label: 'S&P 500', category: 'Indices', changePct: -1, asOf: 'x' }];
  const sm = { spx: series([...flat(200, 100), 78]) };
  const events = detectEvents(quotes, sm, { inverted: true, spread10y2y: -0.3, asOf: '2026-09-28' });
  assert.ok(events.some(e => e.kind === 'yield'));
  assert.equal(events[0].severity, 'CRITICAL'); // bear market sorts above the HIGH yield event
});

test('countryStress: scores and bands a currency collapse', () => {
  const sm = { usdtry: series([...flat(200, 30), 45]) }; // lira 50% weaker than 12-mo strong
  const stress = countryStress(sm);
  const tr = stress.find(s => s.country === 'Turkey');
  assert.ok(tr.score >= 50);
  assert.ok(['STRESS', 'CRISIS'].includes(tr.band));
  assert.match(tr.drivers[0], /currency/);
});

test('stdev: basic sanity', () => { assert.ok(Math.abs(stdev([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 0.01); });
