import test from 'node:test';
import assert from 'node:assert/strict';
import { makeChariot } from '../builder.js';
import { makeWorld, assemble } from '../physics.js';
import { createTeams, updateTeams } from '../teams.js';

test('pullers stride and lean with effort, grip the rope, and freeze with simulation time', () => {
  const rig = assemble(makeWorld(), makeChariot([0, 0, 0, 0, 0]).parts),
    team = createTeams();
  const person = team.userData.people[0],
    { legs, torso } = person.userData;
  updateTeams(team, rig, true);
  assert.equal(Math.abs(legs[0].rotation.x), 0);
  assert.equal(Math.abs(torso.rotation.x), 0);
  rig.effort = 1;
  rig.base.velocity.z = -1;
  rig.age = 0.2;
  updateTeams(team, rig, true);
  const first = legs[0].rotation.x;
  assert.notEqual(first, 0);
  assert.ok(torso.rotation.x < -0.1);
  rig.age = 0.45;
  updateTeams(team, rig, true);
  assert.notEqual(legs[0].rotation.x, first);
  const pose = [legs[0].rotation.x, torso.rotation.x, person.userData.hips.position.y];
  updateTeams(team, rig, true);
  assert.deepEqual([legs[0].rotation.x, torso.rotation.x, person.userData.hips.position.y], pose);
  const grip = person.localToWorld(person.userData.grip.clone()),
    points = team.userData.ropes[0].line.geometry.attributes.position;
  assert.ok(Math.abs(points.getX(1) - grip.x) < 1e-5);
  assert.ok(Math.abs(points.getY(1) - grip.y) < 1e-5);
  assert.ok(Math.abs(points.getZ(1) - grip.z) < 1e-5);
  rig.effort = 0;
  rig.base.velocity.setZero();
  rig.age = 0.6;
  updateTeams(team, rig, false);
  assert.equal(Math.abs(legs[0].rotation.x), 0);
  assert.equal(Math.abs(torso.rotation.x), 0);
});
