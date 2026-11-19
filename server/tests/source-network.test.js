import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCE_LAYERS, SOURCE_REGIONS, sourceLayer, sourceGeography,
  expectedCadenceMinutes, sourceHealthStatus, buildSourceNetwork, filterSourceNetwork,
} from '../source-network.js';

test('the network has six independently tracked 1,000-source layer targets', () => {
  assert.equal(SOURCE_LAYERS.length, 6);
  assert.ok(SOURCE_LAYERS.every(layer => layer.target === 1000));
  assert.equal(SOURCE_LAYERS.reduce((n, layer) => n + layer.target, 0), 6000);
});

test('regional hierarchy covers major world regions without inventing a country attribution', () => {
  for (const id of ['south-asia','east-asia','southeast-asia','central-asia','middle-east','europe','africa','north-america','latin-america-caribbean','oceania','global']) {
    assert.ok(SOURCE_REGIONS.some(region => region.id === id), id);
  }
  assert.equal(sourceGeography({ id: 'thehindu', group: 'Indian news' }).country, 'IN');
  assert.equal(sourceGeography({ id: 'unknown', group: 'International news' }).country, null);
});

test('sources map into the intended intelligence layers', () => {
  assert.equal(sourceLayer({ id: 'pib', group: 'Indian news', kind: 'official', type: 'rss' }), 'official');
  assert.equal(sourceLayer({ id: 'reddit', group: 'Chatter & deep web', kind: 'social', type: 'api' }), 'social');
  assert.equal(sourceLayer({ id: 'cisa-kev', group: 'Cyber', kind: 'official', type: 'api' }), 'official');
  assert.equal(sourceLayer({ id: 'gcaptain', group: 'Maritime', kind: 'news', type: 'rss' }), 'mobility');
  assert.equal(sourceLayer({ id: 'usgs', group: 'Hazards', kind: 'official', type: 'geojson' }), 'geospatial');
  assert.equal(sourceLayer({ id: 'biz', group: 'Business & power', kind: 'news', type: 'search' }), 'economic');
  assert.equal(sourceLayer({ id: 'nasa-eonet', layer: 'geospatial', group: 'Hazards', kind: 'official', type: 'api' }), 'geospatial');
  assert.equal(sourceLayer({ id: 'opensky-south-asia', layer: 'mobility', group: 'Maritime', kind: 'analysis', type: 'api' }), 'mobility');
  assert.equal(sourceLayer({ id: 'world-bank-open-data', layer: 'economic', group: 'Business & power', kind: 'official', type: 'api' }), 'economic');
});

test('health depends on measured successful collection and expected cadence', () => {
  const now = Date.now();
  assert.equal(sourceHealthStatus(null, now, 5), 'unverified');
  assert.equal(sourceHealthStatus({ state: 'error' }, now, 5), 'failed');
  assert.equal(sourceHealthStatus({ lastSuccessAt: now - 10 * 60_000, consecutiveFailures: 0 }, now, 5), 'healthy');
  assert.equal(sourceHealthStatus({ lastSuccessAt: now - 30 * 60_000, consecutiveFailures: 1 }, now, 5), 'degraded');
  assert.equal(sourceHealthStatus({ lastSuccessAt: now - 4 * 60 * 60_000, consecutiveFailures: 3 }, now, 5), 'stale');
  assert.equal(expectedCadenceMinutes({ type: 'rss' }), 1);
  assert.equal(expectedCadenceMinutes({ type: 'search' }), 5);
});

test('network summary separates configured, healthy and unverified records', () => {
  const now = Date.now();
  const network = buildSourceNetwork([
    { id: 'pib', name: 'PIB', group: 'Indian news', type: 'rss', kind: 'official' },
    { id: 'thehindu', name: 'The Hindu', group: 'Indian news', type: 'rss', kind: 'news' },
    { id: 'reddit', name: 'Reddit', group: 'Chatter & deep web', type: 'api', kind: 'social' },
  ], {
    pib: { lastSuccessAt: now - 60_000, checkedAt: now, consecutiveFailures: 0, count: 12 },
  }, [], now);
  assert.equal(network.target, 6000);
  assert.equal(network.configured, 3);
  assert.equal(network.healthy, 1);
  assert.equal(network.unverified, 2);
  assert.equal(network.layers.find(x => x.id === 'news').configured, 1);
  assert.equal(network.layers.find(x => x.id === 'news').remaining, 999);
  assert.equal(network.sources.find(x => x.id === 'thehindu').health, 'unverified');
});

test('regional source filters return the actual matching source list',()=>{
 const network=buildSourceNetwork([
  {id:'pib',name:'Press Information Bureau',group:'Indian news',type:'rss',kind:'official'},
  {id:'dawn',name:'Dawn',group:'South Asia',type:'rss',kind:'news'},
  {id:'bbc',name:'BBC World',group:'International news',type:'rss',kind:'news'}
 ],{});
 const southAsia=filterSourceNetwork(network.sources,{region:'South Asia'});
 assert.equal(southAsia.summary.matched,2);
 assert.deepEqual(southAsia.sources.map(x=>x.id).sort(),['dawn','pib']);
 const official=filterSourceNetwork(network.sources,{region:'South Asia',layer:'official'});
 assert.deepEqual(official.sources.map(x=>x.id),['pib']);
 assert.equal(filterSourceNetwork(network.sources,{region:'not-a-region'}).error,'Unknown source region.');
});
