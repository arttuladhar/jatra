import * as CANNON from 'cannon-es';
export { CANNON };
export const STEP = 1 / 120;
export function makeWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  world.solver.iterations = 40;
  world.solver.tolerance = 1e-7;
  world.defaultContactMaterial.friction = 0.55;
  world.defaultContactMaterial.restitution = 0;
  const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);
  return world;
}
export function staticBox(world, pos, size, yaw = 0) {
  const b = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(...size.map((v) => v / 2))),
    position: new CANNON.Vec3(...pos),
  });
  b.quaternion.setFromEuler(0, yaw, 0);
  world.addBody(b);
  return b;
}
export function assemble(world, parts, heading = 0) {
  const joints = [];
  for (const p of parts) {
    const body = new CANNON.Body({
      mass: p.mass,
      position: new CANNON.Vec3(...p.pos),
      linearDamping: 0.015,
      angularDamping: 0.12,
    });
    if (p.shape === 'wheel') {
      const q = new CANNON.Quaternion();
      q.setFromEuler(0, 0, Math.PI / 2);
      body.addShape(new CANNON.Cylinder(p.size[0], p.size[0], p.size[1], 48), new CANNON.Vec3(), q);
    } else body.addShape(new CANNON.Box(new CANNON.Vec3(...p.size.map((v) => v / 2))));
    world.addBody(body);
    p.body = body;
  }
  const base = parts[0];
  function connect(a, b, hinge = false) {
    const c = hinge
      ? new CANNON.HingeConstraint(a.body, b.body, {
          pivotA: b.body.position.vsub(a.body.position),
          pivotB: new CANNON.Vec3(),
          axisA: new CANNON.Vec3(1, 0, 0),
          axisB: new CANNON.Vec3(1, 0, 0),
          maxForce: 1e9,
          collideConnected: false,
        })
      : new CANNON.LockConstraint(a.body, b.body, { maxForce: 1e9, collideConnected: false });
    for (const e of c.equations) e.setSpookParams(2e8 / (1 + b.flexibility * 4), 4, STEP);
    world.addConstraint(c);
    joints.push({
      constraint: c,
      limit: Math.min(a.strength, b.strength),
      stress: 0,
      damage: 0,
      broken: false,
      name: b.id,
    });
  }
  for (const p of parts.slice(1)) {
    if (p.id === 'crown')
      for (const pillar of parts.filter((v) => v.part === 3)) connect(pillar, p);
    else if (p.id.startsWith('tower-')) {
      const tier = Number(p.id.split('-')[1]);
      connect(
        parts.find((v) => v.id === (tier ? `tower-${tier - 1}` : 'crown')),
        p,
      );
    } else connect(base, p, p.shape === 'wheel');
  }
  // Rotate the completed assembly together, preserving local joint anchors.
  const orientation = new CANNON.Quaternion();
  orientation.setFromEuler(0, heading, 0);
  for (const { body } of parts) {
    orientation.vmult(body.position, body.position);
    orientation.mult(body.quaternion, body.quaternion);
    body.previousPosition.copy(body.position);
    body.interpolatedPosition.copy(body.position);
    body.previousQuaternion.copy(body.quaternion);
    body.interpolatedQuaternion.copy(body.quaternion);
    body.aabbNeedsUpdate = true;
  }
  return {
    parts,
    joints,
    base: base.body,
    totalMass: parts.reduce((s, p) => s + p.mass, 0),
    effort: 0,
    brake: 0,
    age: 0,
    offRoad: 0,
  };
}
// Cannon-es does not automatically fracture constraints. Inspect solved equation
// multipliers (force / torque reactions) AFTER EACH fixed step, then remove the
// actual joint. Torque is normalized by a nominal 1 m lever arm for game tuning.
export function inspectJoints(world, joints) {
  const broken = [];
  for (const joint of joints) {
    if (joint.broken) continue;
    joint.stress =
      Math.max(...joint.constraint.equations.map((e) => Math.abs(e.multiplier))) /
      Math.max(1, joint.limit * (1 - joint.damage));
    if (joint.stress > 1 || joint.damage >= 1) {
      world.removeConstraint(joint.constraint);
      joint.broken = true;
      broken.push(joint.name);
    }
  }
  return broken;
}
export function pull(rig, input, dt) {
  const active = input.has('KeyW') || input.has('ArrowLeft') || input.has('ArrowRight');
  rig.effort = Math.max(0, Math.min(1, rig.effort + (active ? 0.28 : -0.55) * dt));
  rig.brake = Math.max(0, Math.min(1, rig.brake + (input.has('Space') ? 0.9 : -2) * dt));
  // Sets preserve press order. The latest held steering key wins, so pressing
  // Right while Left is held switches right instead of cancelling both directions.
  let turn = 0;
  for (const key of input) {
    if (key === 'ArrowLeft') turn = 1;
    else if (key === 'ArrowRight') turn = -1;
  }
  const left = turn === 1,
    right = turn === -1;
  // +X rope produces leftward yaw when it pulls toward local -Z.
  const speed = Math.hypot(rig.base.velocity.x, rig.base.velocity.z);
  const teamForce = 6500 / (1 + (speed / 1.5) ** 2); // Pulling effort falls as the team must run.
  for (const side of [-1, 1]) {
    // Redistribute the full team pull when steering. Reducing one rope to 8%
    // used to halve total force, leaving a settled chariot turning in place.
    const bias = left !== right ? ((left ? side === 1 : side === -1) ? 1.85 : 0.15) : 1;
    const localForce = new CANNON.Vec3(0, 0, -teamForce * rig.effort * bias);
    rig.base.applyLocalForce(localForce, new CANNON.Vec3(side * 1.3, -0.2, -3.5));
  }
  // Gameplay steering assist: yaw the complete intact assembly together at a
  // bounded rate. Fixed axles otherwise scrub against the ground and barely
  // turn. Preserve momentum, height and tilt; collisions still solve each step.
  // This is intentionally assisted steering, not a physical rope-only model.
  if (turn && Math.sign(rig.steer ?? 0) !== turn) rig.steer = 0;
  rig.steer = (rig.steer ?? 0) + (turn * 0.35 - (rig.steer ?? 0)) * (1 - Math.exp(-6 * dt));
  if (Math.abs(rig.steer) > 0.001 && !rig.joints.some((j) => j.broken)) {
    const yaw = new CANNON.Quaternion();
    yaw.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rig.steer * dt);
    const center = rig.base.position.clone();
    for (const p of rig.parts) {
      const offset = p.body.position.vsub(center);
      yaw.vmult(offset, offset);
      center.vadd(offset, p.body.position);
      yaw.mult(p.body.quaternion, p.body.quaternion);
      p.body.aabbNeedsUpdate = true;
      p.body.wakeUp();
    }
  }
  // Brake drag acts at the attached shoes, not by overwriting velocity. Detached
  // shoes no longer brake; Ma eel construction controls the friction coefficient.
  for (const p of rig.parts.filter((p) => p.part === 4)) {
    if (rig.joints.find((j) => j.name === p.id)?.broken) continue;
    const velocity = p.body.velocity,
      speed = Math.hypot(velocity.x, velocity.z);
    if (speed > 0.001) {
      const force = Math.min(
        (rig.brake * p.friction * rig.totalMass * 9.81) / 2,
        (speed * p.mass) / dt,
      );
      p.body.applyForce(
        new CANNON.Vec3((-velocity.x / speed) * force, 0, (-velocity.z / speed) * force),
      );
    }
  }
}
// Off-road exposure permanently weakens joints. Returning to the road stops
// additional wear; it does not repair damage. Normal stress can then break them.
export function damageOffRoad(rig, distance, dt) {
  rig.offRoad = distance;
  if (distance <= 0) return;
  const speed = Math.hypot(rig.base.velocity.x, rig.base.velocity.z);
  const wear = dt * 0.065 * (1 + Math.min(distance, 12) / 3) * (1 + speed / 3);
  for (const joint of rig.joints) {
    if (!joint.broken) joint.damage = Math.min(1, joint.damage + (wear * 100000) / joint.limit);
  }
}
export function sync(rig) {
  for (const p of rig.parts) {
    p.mesh.position.copy(p.body.position);
    p.mesh.quaternion.copy(p.body.quaternion);
  }
}
