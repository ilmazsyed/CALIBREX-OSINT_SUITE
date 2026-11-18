import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const geoPath = new URL('../../client/src/lib/india-states.json', import.meta.url);
const features = JSON.parse(fs.readFileSync(fileURLToPath(geoPath), 'utf8')).features || [];

test('India map geometry includes Jammu and Kashmir and Ladakh', () => {
  const names = new Set(features.map(feature => feature.properties?.NAME_1 || feature.properties?.name));
  assert.ok([...names].some(name => /Jammu and Kashmir/i.test(String(name))), 'Jammu and Kashmir geometry must be present');
  assert.ok([...names].some(name => /^Ladakh$/i.test(String(name))), 'Ladakh geometry must be present');
});

test('GEOINT map uses the shared full-India viewport and India state geometry', () => {
  const mapPath = new URL('../../client/src/components/GeoMap.tsx', import.meta.url);
  const source = fs.readFileSync(fileURLToPath(mapPath), 'utf8');
  assert.match(source, /import indiaStates from '..\/lib\/india-states\.json'/);
  assert.match(source, /fitIndia\(map, false\)/);
  assert.match(source, /L\.geoJSON\(indiaStates as any/);
});
