import test from 'node:test';
import assert from 'node:assert/strict';
import { makeChariot } from '../builder.js';
import { makeWorld, assemble, inspectJoints, pull, STEP, damageOffRoad } from '../physics.js';
import {
  routeLength,
  advanceCheckpoint,
  ROUTE,
  START_HEADING,
  ROAD_WIDTH,
  distanceOutsideRoad,
  chariotRoadDeparture,
} from '../route.js';
function setup() {
  const world = makeWorld(),
    rig = assemble(world, makeChariot([0, 0, 0, 0, 0]).parts);
  return { world, rig };
}
test('closed-loop checkpoints cannot be skipped or completed at spawn', () => {
  assert.ok(routeLength() > 1700 && routeLength() < 1710);
  assert.equal(advanceCheckpoint(0, ROUTE.at(-1)), 0);
  assert.equal(advanceCheckpoint(0, ROUTE[2]), 0);
  let checkpoint = 0;
  for (const point of ROUTE.slice(1)) checkpoint = advanceCheckpoint(checkpoint, point);
  assert.equal(checkpoint, ROUTE.length - 1);
  assert.equal(advanceCheckpoint(checkpoint, ROUTE[0]), checkpoint);
});
test('assembly rests without fractures then moves under rope force', () => {
  const { world, rig } = setup();
  for (let i = 0; i < 600; i++) {
    world.step(STEP);
    assert.deepEqual(inspectJoints(world, rig.joints), []);
  }
  const initialZ = rig.base.position.z;
  for (let i = 0; i < 600; i++) {
    pull(rig, new Set(['KeyW']), STEP);
    world.step(STEP);
    assert.deepEqual(inspectJoints(world, rig.joints), []);
  }
  assert.ok(rig.base.position.z < initialZ - 1);
  assert.ok(rig.base.quaternion.vmult({ x: 0, y: 1, z: 0 }).y > 0.9);
});
test('an overloaded joint is removed while other parts keep simulating', () => {
  const { world, rig } = setup();
  const j = rig.joints.find((j) => j.name === 'tower-4');
  rig.parts.find((p) => p.id === 'tower-4').body.force.x = 1e8;
  world.step(STEP);
  assert.ok(inspectJoints(world, rig.joints).includes('tower-4'));
  assert.ok(!world.constraints.includes(j.constraint));
  assert.equal(world.bodies.length, rig.parts.length + 1);
});

test('all construction presets settle intact', () => {
  for (const option of [1, 2]) {
    const world = makeWorld(),
      rig = assemble(world, makeChariot(Array(5).fill(option)).parts);
    for (let i = 0; i < 360; i++) {
      world.step(STEP);
      assert.deepEqual(inspectJoints(world, rig.joints), []);
    }
  }
});
test('rope imbalance turns and braking removes momentum', () => {
  function run(input) {
    const { world, rig } = setup();
    for (let i = 0; i < 720; i++) {
      pull(rig, new Set(i < 480 ? ['KeyW'] : input), STEP);
      world.step(STEP);
    }
    return rig;
  }
  const coast = run([]),
    brake = run(['Space']),
    left = run(['ArrowLeft']),
    right = run(['ArrowRight']);
  assert.ok(
    Math.hypot(brake.base.velocity.x, brake.base.velocity.z) <
      Math.hypot(coast.base.velocity.x, coast.base.velocity.z),
  );
  assert.ok(left.base.quaternion.y > 0);
  assert.ok(right.base.quaternion.y < 0);
});

test('Left and Right arrows make visible turns from rest and while moving without breaking the chariot', () => {
  for (const option of [0, 1, 2])
    for (const key of ['ArrowLeft', 'ArrowRight'])
      for (const moving of [false, true]) {
        const world = makeWorld(),
          rig = assemble(world, makeChariot(Array(5).fill(option)).parts);
        for (let i = 0; i < 600; i++) {
          const input = new Set(
            i < 240 ? (moving ? ['KeyW'] : []) : moving ? ['KeyW', key] : [key],
          );
          pull(rig, input, STEP);
          world.step(STEP);
          assert.deepEqual(inspectJoints(world, rig.joints), []);
        }
        const yaw = 2 * Math.atan2(rig.base.quaternion.y, rig.base.quaternion.w);
        assert.ok(
          key === 'ArrowLeft' ? yaw > 0.5 : yaw < -0.5,
          `Expected a visible ${key} turn, got ${yaw}`,
        );
      }
});
test('road bounds match straight edges, diagonal streets, junctions, and chariot width', () => {
  const a = ROUTE[0],
    b = ROUTE[1],
    len = Math.hypot(b.x - a.x, b.z - a.z);
  const nx = (b.z - a.z) / len,
    nz = -(b.x - a.x) / len;
  const point = (offset) => ({
    x: (a.x + b.x) / 2 + nx * offset,
    z: (a.z + b.z) / 2 + nz * offset,
  });
  assert.equal(distanceOutsideRoad(point(ROAD_WIDTH / 2 - 0.01)), 0);
  assert.ok(distanceOutsideRoad(point(ROAD_WIDTH / 2 + 0.5)) > 0);
  for (const p of ROUTE) assert.equal(distanceOutsideRoad(p), 0);
  const { rig } = setup(),
    center = point(0);
  rig.base.position.set(center.x, 2, center.z);
  rig.base.quaternion.setFromEuler(0, START_HEADING, 0);
  assert.equal(chariotRoadDeparture(rig.base), 0);
  const edge = point(ROAD_WIDTH / 2 - 1);
  rig.base.position.set(edge.x, 2, edge.z);
  assert.ok(chariotRoadDeparture(rig.base) > 0);
});
test('off-road exposure permanently weakens and eventually breaks real joints', () => {
  const { world, rig } = setup();
  damageOffRoad(rig, 0, 10);
  assert.ok(rig.joints.every((j) => j.damage === 0));
  damageOffRoad(rig, 2, 1);
  const damage = rig.joints.map((j) => j.damage);
  assert.ok(damage.every((d) => d > 0));
  damageOffRoad(rig, 0, 10);
  assert.deepEqual(
    rig.joints.map((j) => j.damage),
    damage,
  );
  for (let i = 0; i < 1200; i++) {
    damageOffRoad(rig, 5, STEP);
    inspectJoints(world, rig.joints);
  }
  assert.ok(rig.joints.some((j) => j.broken));
  assert.ok(world.constraints.length < rig.joints.length);
});

test('the latest steering press wins and reversing starts in the requested direction', () => {
  for (const [first, second, sign] of [
    ['ArrowLeft', 'ArrowRight', -1],
    ['ArrowRight', 'ArrowLeft', 1],
  ]) {
    const { world, rig } = setup(),
      input = new Set([first]);
    for (let i = 0; i < 120; i++) {
      pull(rig, input, STEP);
      world.step(STEP);
    }
    const before = 2 * Math.atan2(rig.base.quaternion.y, rig.base.quaternion.w);
    input.add(second);
    pull(rig, input, STEP);
    assert.ok(rig.steer * sign > 0, 'Reversing must not continue the old steering direction');
    world.step(STEP);
    for (let i = 0; i < 240; i++) {
      pull(rig, input, STEP);
      world.step(STEP);
      assert.deepEqual(inspectJoints(world, rig.joints), []);
    }
    const after = 2 * Math.atan2(rig.base.quaternion.y, rig.base.quaternion.w);
    assert.ok((after - before) * sign > 0.5, 'The latest held key must produce a visible turn');
    input.delete(second);
    pull(rig, input, STEP);
    assert.ok(rig.steer * sign < 0, 'Releasing the latest key restores the still-held key');
  }
});

test('Right Arrow moves a settled chariot right, and Left Arrow moves it left', () => {
  for (const option of [0, 1, 2])
    for (const [key, sign] of [
      ['ArrowRight', 1],
      ['ArrowLeft', -1],
    ]) {
      const world = makeWorld(),
        rig = assemble(world, makeChariot(Array(5).fill(option)).parts);
      // Let the wheels fully settle: a spawn that is still dropping masks stalling.
      for (let i = 0; i < 480; i++) world.step(STEP);
      const start = rig.base.position.clone();
      for (let i = 0; i < 360; i++) {
        pull(rig, new Set([key]), STEP);
        world.step(STEP);
        assert.deepEqual(inspectJoints(world, rig.joints), []);
      }
      assert.ok(
        (rig.base.position.x - start.x) * sign > 0.5,
        `${key} must translate over 0.5 m in its direction, not merely rotate`,
      );
      assert.ok(rig.base.position.z < start.z - 0.5, 'The turn must also pull forward');
    }
});

test('procession spawns aligned with the GeoJSON first leg and pulls along it intact', () => {
  for (const option of [0, 1, 2]) {
    const world = makeWorld(),
      rig = assemble(world, makeChariot(Array(5).fill(option)).parts, START_HEADING);
    const forward = rig.base.quaternion.vmult({ x: 0, y: 0, z: -1 }),
      next = ROUTE[1],
      length = Math.hypot(next.x, next.z);
    assert.ok(Math.abs(forward.x - next.x / length) < 1e-10);
    assert.ok(Math.abs(forward.z - next.z / length) < 1e-10);
    for (let i = 0; i < 960; i++) {
      if (i >= 480) pull(rig, new Set(['KeyW']), STEP);
      world.step(STEP);
      assert.deepEqual(inspectJoints(world, rig.joints), []);
      assert.equal(chariotRoadDeparture(rig.base), 0);
    }
    assert.ok(
      rig.base.position.x < -0.5 && rig.base.position.z < -1,
      'Heaving follows the northwestern road',
    );
  }
});
