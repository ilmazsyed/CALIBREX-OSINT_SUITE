import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWikidataSearch, parseWikipediaSummary, parseOpenSanctions } from '../entity-intel.js';

test('parseWikidataSearch extracts labelled entities', () => {
  const out = parseWikidataSearch({ search: [
    { id: 'Q7747', label: 'Vladimir Putin', description: 'President of Russia', concepturi: 'http://www.wikidata.org/entity/Q7747' },
    { id: 'Q123', label: 'Other', description: '' },
    { label: 'no id dropped' },
  ] });
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'Q7747');
  assert.equal(out[0].label, 'Vladimir Putin');
  assert.match(out[0].url, /Q7747/);
});

test('parseWikipediaSummary returns a clean blurb, skips disambiguation', () => {
  const ok = parseWikipediaSummary({ type: 'standard', title: 'ACME Corp', extract: 'A company.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/ACME_Corp' } } });
  assert.equal(ok.title, 'ACME Corp');
  assert.match(ok.url, /ACME_Corp/);
  assert.equal(parseWikipediaSummary({ type: 'disambiguation' }), null);
});

test('parseOpenSanctions maps results into match shape', () => {
  const out = parseOpenSanctions({ results: [
    { id: 'ofac-1', caption: 'John Doe', schema: 'Person', score: 0.92, datasets: ['us_ofac_sdn'], properties: { topics: ['sanction'], country: ['ru'], program: ['UKRAINE-EO13662'] } },
    { id: 'x', properties: {} }, // no name -> dropped
  ] });
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'John Doe');
  assert.equal(out[0].list, 'OpenSanctions');
  assert.equal(out[0].score, 92);
  assert.deepEqual(out[0].topics, ['sanction']);
});
