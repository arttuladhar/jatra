import test from 'node:test';
import routeMap from '../route-map.json' with { type: 'json' };
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CANNON, makeWorld } from '../physics.js';
import {
  ROUTE,
  ROAD_WIDTH,
  routeLength,
  projectRoute,
  upcomingTurn,
  chariotRoadDeparture,
  distanceOutsideRoad,
  createRoute,
} from '../route.js';

test('GeoJSON streets retain their bends and a clear start/finish footprint', () => {
  assert.equal(ROAD_WIDTH, 8);
  const base = new CANNON.Body();
  for (const point of [ROUTE[0], ROUTE.at(-1)]) {
    base.position.set(point.x, 2, point.z);
    assert.equal(chariotRoadDeparture(base), 0);
  }
  const turns = ROUTE.slice(1, -1).map((p, i) => upcomingTurn(i, p));
  assert.ok(turns.some((t) => t.degrees >= 90));
  assert.ok(turns.some((t) => t.direction === 'Left'));
  assert.ok(turns.some((t) => t.direction === 'Right'));
});
test('a slow rounded line through every corner keeps the whole chassis on the road', () => {
  const base = new CANNON.Body();
  for (let i = 1; i < ROUTE.length - 1; i++) {
    const a = ROUTE[i - 1],
      p = ROUTE[i],
      b = ROUTE[i + 1];
    const il = Math.hypot(p.x - a.x, p.z - a.z),
      ol = Math.hypot(b.x - p.x, b.z - p.z);
    const incoming = { x: (p.x - a.x) / il, z: (p.z - a.z) / il },
      outgoing = { x: (b.x - p.x) / ol, z: (b.z - p.z) / ol };
    for (let j = 0; j <= 100; j++) {
      const t = j / 100,
        radius = 6;
      base.position.set(
        (1 - t) ** 2 * (p.x - radius * incoming.x) +
          2 * (1 - t) * t * p.x +
          t * t * (p.x + radius * outgoing.x),
        2,
        (1 - t) ** 2 * (p.z - radius * incoming.z) +
          2 * (1 - t) * t * p.z +
          t * t * (p.z + radius * outgoing.z),
      );
      base.quaternion.setFromEuler(
        0,
        Math.atan2(
          -((1 - t) * incoming.x + t * outgoing.x),
          -((1 - t) * incoming.z + t * outgoing.z),
        ),
        0,
      );
      assert.equal(
        chariotRoadDeparture(base),
        0,
        `Corner at ${p.name} must have a traversable line`,
      );
    }
  }
});
test('closer building colliders do not obstruct the road', () => {
  const world = makeWorld();
  createRoute(new THREE.Scene(), world);
  assert.ok(
    world.bodies.some((body) => body.shapes[0].halfExtents?.y === 0.06),
    'Road bumps remain present',
  );
  for (const body of world.bodies) {
    const shape = body.shapes[0];
    if (!shape.halfExtents || shape.halfExtents.y < 2) continue;
    for (const x of [-shape.halfExtents.x, shape.halfExtents.x])
      for (const z of [-shape.halfExtents.z, shape.halfExtents.z]) {
        assert.ok(distanceOutsideRoad(body.pointToWorldFrame(new CANNON.Vec3(x, 0, z))) > 0.3);
      }
  }
});

test('varied scenery is repeatable and leaves the route clear; bumps have no signs', () => {
  const world = makeWorld(),
    { group } = createRoute(new THREE.Scene(), world);
  const houses = group.children.filter((m) => m.name === 'house'),
    temples = group.children.filter((m) => m.name === 'temple');
  assert.ok(houses.length > 30);
  assert.ok(temples.length >= 3);
  const heights = houses.map((h) => new THREE.Box3().setFromObject(h).max.y);
  assert.ok(
    Math.max(...heights) - Math.min(...heights) > 8,
    'Skyline includes short and tall houses',
  );
  const a = ROUTE[0],
    b = ROUTE[1],
    len = Math.hypot(b.x - a.x, b.z - a.z);
  const firstStreet = houses
    .map((h) => ({
      along: ((h.position.x - a.x) * (b.x - a.x) + (h.position.z - a.z) * (b.z - a.z)) / len,
      across: Math.abs(
        ((h.position.x - a.x) * (b.z - a.z) - (h.position.z - a.z) * (b.x - a.x)) / len,
      ),
    }))
    .filter((h) => h.along > 20 && h.along < len - 20 && h.across < 15);
  assert.ok(new Set(firstStreet.map((h) => h.across.toFixed(1))).size > 4, 'Setbacks are varied');
  const serialize = (g) =>
    g.children
      .filter((m) => ['house', 'temple'].includes(m.name))
      .map((m) => [m.name, ...m.position.toArray(), m.scale.z]);
  assert.deepEqual(serialize(group), serialize(createRoute(new THREE.Scene(), makeWorld()).group));
  for (const bump of group.children.filter((m) => m.name === 'road-bump')) {
    const bounds = new THREE.Box3().setFromObject(bump);
    assert.ok(bounds.max.y < 0.12, 'Only the painted speed bump remains, without sign posts');
    for (const child of bump.children) assert.equal(child.position.z, 0, 'No approach markings');
  }
  for (const body of world.bodies) {
    const shape = body.shapes[0];
    if (!shape.halfExtents || shape.halfExtents.y === 0.06) continue;
    for (const x of [-shape.halfExtents.x, 0, shape.halfExtents.x])
      for (const z of [-shape.halfExtents.z, 0, shape.halfExtents.z]) {
        assert.ok(
          distanceOutsideRoad(body.pointToWorldFrame(new CANNON.Vec3(x, 0, z))) > 0.3,
          'Houses and temple steps stay outside every street',
        );
      }
  }
});

test('road geometry and stop names follow the supplied GeoJSON at geographic scale', () => {
  const coordinates = routeMap.features.find((f) => f.geometry.type === 'LineString').geometry
    .coordinates;
  const stops = routeMap.features
    .filter((f) => f.geometry.type === 'Point')
    .sort((a, b) => a.properties.stop - b.properties.stop);
  assert.equal(ROUTE.length, coordinates.length);
  assert.deepEqual(
    ROUTE.map((p) => p.name),
    stops.map((s) => s.properties.name),
  );
  assert.equal(ROUTE[0].x, 0);
  assert.ok(ROUTE[0].z === 0);
  assert.equal(ROUTE.at(-1).x, ROUTE[0].x);
  assert.equal(ROUTE.at(-1).z, ROUTE[0].z);
  let geographicLength = 0;
  const rad = Math.PI / 180;
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1],
      [lon2, lat2] = coordinates[i];
    const hav =
      Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
    geographicLength += 2 * 6371000 * Math.asin(Math.sqrt(hav));
    assert.equal(Math.sign(ROUTE[i].x - ROUTE[i - 1].x), Math.sign(lon2 - lon1));
    assert.equal(Math.sign(ROUTE[i].z - ROUTE[i - 1].z), -Math.sign(lat2 - lat1));
    const dx = ROUTE[i].x - ROUTE[i - 1].x,
      dz = ROUTE[i].z - ROUTE[i - 1].z;
    assert.ok(
      Math.abs(dx / ((lon2 - lon1) * rad) - 6371000 * Math.cos(coordinates[0][1] * rad)) < 1e-5,
    );
    assert.ok(Math.abs(dz / ((lat2 - lat1) * rad) + 6371000) < 1e-5);
  }
  assert.ok(
    Math.abs(routeLength() - geographicLength) < 0.1,
    'Projection preserves metre scale without normalizing length',
  );
});

test('editable route data rejects malformed and degenerate inputs', () => {
  const mutations = [
    (data) => {
      data.features = [];
    },
    (data) => {
      data.features[0].geometry.coordinates[1][0] = NaN;
    },
    (data) => {
      data.features[0].geometry.coordinates[1][1] = 100;
    },
    (data) => {
      data.features[0].geometry.coordinates[1] = data.features[0].geometry.coordinates[0];
    },
    (data) => {
      data.features[0].geometry.coordinates.pop();
    },
    (data) => {
      data.features[2].properties.stop = 1;
    },
    (data) => {
      data.features[1].properties.name = '';
    },
    (data) => {
      data.features[1].geometry.coordinates = [0, 0];
    },
  ];
  for (const mutate of mutations) {
    const data = structuredClone(routeMap);
    mutate(data);
    assert.throws(() => projectRoute(data), /Invalid route-map.json:/);
  }
  assert.throws(() => projectRoute(null), /FeatureCollection/);
  const shuffled = structuredClone(routeMap);
  shuffled.features.reverse();
  assert.deepEqual(
    projectRoute(shuffled),
    ROUTE,
    'Stop numbering, not feature array order, determines the sequence',
  );
});
