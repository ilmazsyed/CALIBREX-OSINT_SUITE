import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portBoard, scoreLane, km } from '../supplychain.js';

const INFRA = [
  { id: 'cp-hormuz', name: 'Strait of Hormuz', type: 'chokepoint', lat: 26.57, lng: 56.25, country: 'Oman/Iran' },
  { id: 'port-jebel', name: 'Jebel Ali', type: 'port', lat: 25.0, lng: 55.1, country: 'UAE' },
  { id: 'air-x', name: 'Some airport', type: 'airport', lat: 25, lng: 55 },
];
const LAYERS = {
  conflict: [{ lat: 26.6, lng: 56.3, title: 'Strike near strait', severity: 'HIGH' }],
  maritime: [{ lat: 25.1, lng: 55.2, title: 'Tanker incident', severity: 'CRITICAL' }],
  vessels: [{ lat: 26.6, lng: 56.3, title: 'cargo' }], // weight 0 -> ignored
};

test('portBoard scores nearby disruption and excludes airports by default', () => {
  const b = portBoard(INFRA, LAYERS, { radiusKm: 100 });
  assert.ok(b.nodes.length === 2, 'ports + chokepoints only');
  assert.ok(!b.nodes.some(n => n.type === 'airport'));
  const hormuz = b.nodes.find(n => n.id === 'cp-hormuz');
  assert.ok(hormuz.score > 0 && hormuz.nearby.length > 0);
  assert.ok(['HIGH', 'ELEVATED', 'WATCH', 'NORMAL'].includes(hormuz.status));
});

test('scoreLane scores segments, finds chokepoints on route, needs 2 waypoints', () => {
  assert.match(scoreLane([{ lat: 1, lng: 1 }], INFRA, LAYERS).error, /two waypoints/);
  const lane = scoreLane([{ lat: 24, lng: 54, name: 'Jebel Ali' }, { lat: 27, lng: 57, name: 'Gulf of Oman' }], INFRA, LAYERS, { corridorKm: 250 });
  assert.equal(lane.segments.length, 1);
  assert.ok(lane.overall > 0);
  assert.ok(lane.chokepointsOnRoute.includes('Strait of Hormuz'), 'lane passes Hormuz');
});

test('km is a sane haversine', () => {
  assert.ok(Math.abs(km(0, 0, 0, 1) - 111.3) < 1, 'one degree lng at equator ~111km');
});
