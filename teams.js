import * as THREE from 'three';
import { box } from './builder.js';

const skin = new THREE.MeshStandardMaterial({ color: '#a47855' });
const trousers = new THREE.MeshStandardMaterial({ color: '#4e5144' });
const shirts = ['#a95437', '#e5d9b8'].map((color) => new THREE.MeshStandardMaterial({ color }));
const up = new THREE.Vector3(0, 1, 0);

export function createTeams() {
  const team = new THREE.Group();
  team.userData = { ropes: [], people: [], age: 0, gait: 0 };
  for (const side of [-1, 1]) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 6 }, () => new THREE.Vector3()),
      ),
      new THREE.LineBasicMaterial({ color: '#927747' }),
    );
    team.add(line);
    team.userData.ropes.push({ side, line });
    for (let index = 0; index < 5; index++) {
      const person = new THREE.Group(),
        hips = new THREE.Group(),
        torso = new THREE.Group();
      person.add(hips);
      hips.position.y = 0.55;
      hips.add(torso);
      const shirt = box(0.4, 0.65, 0.28, shirts[index % 2]);
      shirt.position.y = 0.31;
      torso.add(shirt);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), skin);
      head.position.y = 0.8;
      torso.add(head);
      const legs = [],
        arms = [];
      for (const x of [-0.12, 0.12]) {
        const leg = new THREE.Group();
        leg.position.x = x;
        const limb = box(0.13, 0.5, 0.13, trousers);
        limb.position.y = -0.25;
        leg.add(limb);
        const foot = box(0.15, 0.08, 0.24, trousers);
        foot.position.set(0, -0.5, -0.045);
        leg.add(foot);
        hips.add(leg);
        legs.push(leg);
        const upper = box(0.1, 1, 0.1, shirts[index % 2]),
          lower = box(0.085, 1, 0.085, skin);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 4), skin);
        person.add(upper, lower, hand);
        arms.push({ x, upper, lower, hand });
      }
      person.userData = { side, index, hips, torso, legs, arms, grip: new THREE.Vector3() };
      person.traverse((mesh) => {
        if (mesh.isMesh) mesh.castShadow = true;
      });
      team.add(person);
      team.userData.people.push(person);
    }
  }
  return team;
}
function poseArm(mesh, a, b) {
  const direction = b.clone().sub(a);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.y = direction.length();
  mesh.quaternion.setFromUnitVectors(up, direction.normalize());
}

export function updateTeams(team, rig, pulling) {
  const state = team.userData;
  // Simulation time, not wall time: pause/help freezes the pose; a new run resets it.
  if (rig.age < state.age) state.gait = 0;
  const dt = Math.max(0, rig.age - state.age);
  state.age = rig.age;
  const speed = Math.hypot(rig.base.velocity.x, rig.base.velocity.z);
  const effort = pulling ? rig.effort : 0;
  state.gait += dt * (Math.min(speed, 4) * 5 + effort * 1.8);
  const forward = rig.base.quaternion.vmult({ x: 0, y: 0, z: -1 });
  const yaw = Math.atan2(-forward.x, -forward.z);
  for (const person of state.people) {
    const { side, index, hips, torso, legs, arms, grip } = person.userData;
    const position = rig.base.pointToWorldFrame({ x: side * 2, y: 0, z: -6 - index * 1.2 });
    person.position.set(position.x, 0, position.z);
    person.rotation.set(0, yaw, 0);
    const gait = state.gait + index * 0.8 + side * 0.35;
    const activity = Math.min(1, speed / 0.9 + effort * 0.3);
    const sideEffort =
      effort * (Math.abs(rig.steer ?? 0) > 0.02 && Math.sign(rig.steer) !== side ? 0.25 : 1);
    const heave = Math.sin(rig.age * 3.5 - index * 0.18);
    const swing = Math.sin(gait) * 0.55 * activity;
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    hips.position.y = 0.55 + Math.abs(Math.sin(gait * 2)) * 0.035 * activity;
    torso.rotation.x = -sideEffort * (0.28 + 0.09 * heave);
    torso.rotation.z = Math.sin(gait) * 0.035 * activity;
    grip.set(
      -side * 0.3,
      0.88 + sideEffort * 0.04 * heave,
      -0.15 - sideEffort * (0.12 + 0.1 * heave),
    );
    // Hands share the rope's grip position, with bent elbows that flex on each
    // heave. Keep arm segments attached as the torso leans and the hips bob.
    torso.updateMatrix();
    hips.updateMatrix();
    for (const arm of arms) {
      const shoulder = new THREE.Vector3(Math.sign(arm.x) * 0.22, 0.53, 0)
        .applyMatrix4(torso.matrix)
        .applyMatrix4(hips.matrix);
      const hand = grip.clone();
      hand.z += Math.sign(arm.x) * 0.075;
      const elbow = shoulder.clone().lerp(hand, 0.5);
      elbow.z += 0.16;
      elbow.y -= 0.12;
      poseArm(arm.upper, shoulder, elbow);
      poseArm(arm.lower, elbow, hand);
      arm.hand.position.copy(hand);
    }
  }
  team.updateMatrixWorld(true);
  for (const { side, line } of state.ropes) {
    const anchor = rig.base.pointToWorldFrame({ x: side * 1.3, y: -0.2, z: -3.5 });
    const points = line.geometry.attributes.position;
    points.setXYZ(0, anchor.x, anchor.y, anchor.z);
    for (const person of state.people.filter((p) => p.userData.side === side)) {
      const grip = person.localToWorld(person.userData.grip.clone());
      points.setXYZ(person.userData.index + 1, grip.x, grip.y, grip.z);
    }
    points.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }
}
