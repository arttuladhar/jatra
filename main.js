import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  makeChariot,
  disposeChariot,
  highlight,
  WOODS,
  OPTIONS,
  properties,
  box,
} from './builder.js';
import {
  makeWorld,
  assemble,
  STEP,
  pull,
  inspectJoints,
  damageOffRoad,
  sync,
  CANNON,
} from './physics.js';
import { bindControls, bindSteeringButtons } from './controls.js';
import { createTeams, updateTeams } from './teams.js';
import { createProcessionAudio } from './sound.js';
import {
  ROUTE,
  START_HEADING,
  routeLength,
  createRoute,
  advanceCheckpoint,
  chariotRoadDeparture,
  upcomingTurn,
} from './route.js';

const $ = (id) => document.getElementById(id);
const processionAudio = createProcessionAudio(() => {
  if (!processionAudio.muted) $('sound-toggle').textContent = 'Enable sound';
});
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true });
} catch (error) {
  $('status').textContent = 'WebGL is unavailable. Enable hardware acceleration and reload.';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor('#e8e6d7');
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#e8e6d7', 65, 210);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(22, 15, 25);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 6, 0);
orbit.enableDamping = true;
orbit.minDistance = 8;
orbit.maxDistance = 55;
orbit.maxPolarAngle = Math.PI * 0.48;
scene.add(new THREE.HemisphereLight('#fff9e8', '#797b59', 2.8));
const sun = new THREE.DirectionalLight('#fff0cd', 3.3);
sun.position.set(-20, 35, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 100 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(2400, 2400),
  new THREE.MeshStandardMaterial({ color: '#d3d2ba', roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const workshop = new THREE.Group();
scene.add(workshop);
const plinth = new THREE.Mesh(
  new THREE.CylinderGeometry(10, 10.3, 0.16, 64),
  new THREE.MeshStandardMaterial({ color: '#c5c6ad' }),
);
plinth.position.y = -0.03;
plinth.receiveShadow = true;
workshop.add(plinth);
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(9, 0.025, 4, 96),
  new THREE.MeshBasicMaterial({ color: '#969f80' }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.065;
workshop.add(ring);
for (let i = 0; i < 48; i++) {
  const a = (i * Math.PI) / 24;
  const mark = box(
    0.025,
    0.01,
    i % 4 === 0 ? 0.32 : 0.13,
    new THREE.MeshBasicMaterial({ color: '#969f80' }),
  );
  mark.position.set(Math.sin(a) * 9, 0.08, Math.cos(a) * 9);
  mark.rotation.y = a;
  workshop.add(mark);
}
// A 3D placard travels to the selected component; HTML provides an accessible
// readout, while navigation highlights the actual assembly and pans the camera.
const labelCanvas = document.createElement('canvas');
labelCanvas.width = 512;
labelCanvas.height = 128;
const labelTexture = new THREE.CanvasTexture(labelCanvas),
  label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: labelTexture, depthTest: false, toneMapped: false }),
  );
labelTexture.colorSpace = THREE.SRGBColorSpace;
label.scale.set(4.5, 1.125, 1);
scene.add(label);
const selection = [0, 0, 0, 0, 0];
let selected = 0,
  chariot,
  world,
  rig,
  route,
  phase = 'workshop',
  paused = false,
  checkpoint = 0,
  accumulator = 0,
  focusTime = 0;
const desiredTarget = new THREE.Vector3(0, 5.6, 0),
  desiredCamera = new THREE.Vector3(22, 15, 25);
function updateReadout() {
  const p = properties(selected, selection[selected]);
  $('part-title').textContent = p.name;
  $('part-subtitle').textContent = p.subtitle;
  $('wood-name').textContent = p.wood;
  $('option-name').textContent = OPTIONS[selection[selected]].name;
  $('part-count').textContent = `0${selected + 1} / 05`;
  $('weight').textContent = `${p.mass.toFixed(0)} kg / piece`;
  $('flex').textContent = `${Math.round(p.flexibility * 100)} / 100`;
  $('strength').textContent = `${(p.strength / 1000).toFixed(0)} kN`;
  $('part-note').textContent = p.note;
  highlight(chariot, selected);
  const ctx = labelCanvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = '#f8f4e9';
  ctx.fillRect(0, 8, 512, 110);
  ctx.fillStyle = '#a64c32';
  ctx.font = '24px sans-serif';
  ctx.fillText(`0${selected + 1}   /   ${p.name.toUpperCase()}`, 22, 53);
  ctx.fillStyle = '#68745c';
  ctx.font = '20px sans-serif';
  ctx.fillText(p.wood + '  ·  ' + OPTIONS[selection[selected]].name, 22, 88);
  labelTexture.needsUpdate = true;
  label.position.set(4, p.y + 1, 0);
}
function rebuild() {
  processionAudio.reset();
  if (chariot) {
    chariot.group.traverse((m) => {
      if (m.userData.ownMaterial) m.material.dispose();
    });
    disposeChariot(chariot);
  }
  if (route) {
    route.group.traverse((m) => {
      m.geometry?.dispose();
      m.material?.map?.dispose();
      m.material?.dispose();
    });
    scene.remove(route.group);
    route = null;
  }
  world = makeWorld();
  chariot = makeChariot(selection);
  scene.add(chariot.group);
  phase = 'workshop';
  rig = null;
  paused = false;
  checkpoint = 0;
  accumulator = 0;
  workshop.visible = label.visible = true;
  teams.visible = false;
  orbit.enabled = true;
  orbit.enablePan = true;
  $('builder-panel').classList.remove('hidden');
  $('simulation-panel').classList.add('hidden');
  $('start').classList.remove('hidden');
  $('workshop-tab').classList.add('active');
  $('route-tab').classList.remove('active');
  $('heading').innerHTML = 'Built by hand.<br>Moved by many.';
  $('description').innerHTML =
    'Timber, rope, and a little faith. Assemble your chariot,<br>then guide a procession through the old city.';
  $('hint').innerHTML =
    '<kbd>↑</kbd><kbd>↓</kbd> Select part <span></span><kbd>←</kbd><kbd>→</kbd> Customize <span></span> Drag to orbit';
  $('status').textContent = 'A tradition in your hands.';
  desiredTarget.set(0, 5.6, 0);
  desiredCamera.set(22, 15, 25);
  focusTime = 1;
  updateReadout();
  drawMap();
}
function select(delta) {
  selected = (selected + delta + 5) % 5;
  updateReadout();
  desiredTarget.set(0, WOODS[selected].y, 0);
  desiredCamera.set(19, WOODS[selected].y + 8, 23);
  focusTime = 1;
}
function change(delta) {
  selection[selected] = (selection[selected] + delta + 3) % 3;
  rebuild();
  select(0);
}
function setProcessionView(overhead = false) {
  if (!rig) return;
  orbit.target.copy(rig.base.position).add(new THREE.Vector3(0, 4, 0));
  camera.position
    .copy(orbit.target)
    .add(overhead ? new THREE.Vector3(0, 32, 3) : new THREE.Vector3(15, 18, 23));
  orbit.update();
}
function start() {
  if (phase !== 'workshop') return;
  enableAudio();
  rig = assemble(world, chariot.parts, START_HEADING);
  sync(rig);
  route = createRoute(scene, world);
  phase = 'procession';
  workshop.visible = label.visible = false;
  teams.visible = true;
  orbit.enabled = true;
  orbit.enablePan = false;
  setProcessionView();
  keys.clear();
  $('builder-panel').classList.add('hidden');
  $('simulation-panel').classList.remove('hidden');
  $('start').classList.add('hidden');
  $('workshop-tab').classList.remove('active');
  $('route-tab').classList.add('active');
  $('heading').innerHTML = 'One chariot.<br>Many hands.';
  $('description').textContent = 'Brake before striped speed bumps and tight corners.';
  $('hint').innerHTML =
    '<kbd>W</kbd> Heave <span></span><kbd>←</kbd><kbd>→</kbd> Turn left / right <span></span><kbd>Space</kbd> Brake <span></span><kbd>P</kbd> Pause <span></span> Drag to orbit · Scroll to zoom';
  $('status').textContent = `Hold W to build a steady heave. Next: ${ROUTE[1].name}.`;
}
const keys = bindControls({
  select,
  change,
  start,
  rebuild,
  pause: () => {
    paused = !paused;
    keys.clear();
    $('status').textContent = paused ? 'Paused · Press P to resume.' : 'The procession continues.';
  },
  isWorkshop: () => phase === 'workshop',
  blocked: () => $('help').open,
});
bindSteeringButtons(keys, () => phase === 'procession' && !paused && !$('help').open);
$('overhead-view').onclick = () => setProcessionView(true);
$('reset-view').onclick = () => setProcessionView();
$('up').onclick = () => select(-1);
$('down').onclick = () => select(1);
$('previous').onclick = () => change(-1);
$('next').onclick = () => change(1);
$('start').onclick = start;
$('rebuild').onclick = rebuild;
$('soundless').onclick = () => {
  keys.clear();
  $('help').showModal();
};
async function enableAudio() {
  if (processionAudio.muted || !processionAudio.supported) return;
  const ready = await processionAudio.unlock();
  if (processionAudio.muted) return;
  $('sound-toggle').textContent = ready ? 'Mute sound' : 'Enable sound';
}
$('sound-toggle').disabled = !processionAudio.supported;
if (!processionAudio.supported) {
  $('sound-toggle').textContent = 'Sound unavailable';
  $('sound-volume').disabled = true;
}
$('sound-toggle').onclick = () => {
  if ($('sound-toggle').textContent === 'Enable sound') {
    enableAudio();
    return;
  }
  processionAudio.setMuted(!processionAudio.muted);
  $('sound-toggle').setAttribute('aria-pressed', String(processionAudio.muted));
  $('sound-toggle').textContent = processionAudio.muted ? 'Unmute sound' : 'Mute sound';
  if (!processionAudio.muted) enableAudio();
};
$('sound-volume').oninput = (event) => {
  processionAudio.setVolume(Number(event.target.value) / 100);
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) processionAudio.stop();
});
function drawMap() {
  const xs = ROUTE.map((p) => p.x),
    zs = ROUTE.map((p) => p.z),
    minX = Math.min(...xs),
    minZ = Math.min(...zs);
  const width = Math.max(...xs) - minX,
    height = Math.max(...zs) - minZ,
    scale = Math.min(210 / width, 75 / height);
  const project = (p) => [
    125 + (p.x - minX - width / 2) * scale,
    50 + (p.z - minZ - height / 2) * scale,
  ];
  $('route-length').textContent = `${(routeLength() / 1000).toFixed(2)} KM`;
  $('route-start').textContent = ROUTE[0].name;
  $('route-end').textContent = `${ROUTE.at(-1).name} ↗`;
  $('route-map').setAttribute(
    'aria-label',
    `Procession loop through ${ROUTE.length} stops, starting and ending at ${ROUTE[0].name}`,
  );
  // Draw the current stop last so the shared start/finish point stays visible.
  const order = ROUTE.map((_, i) => i).filter((i) => i !== checkpoint);
  order.push(checkpoint);
  const map = $('route-map'),
    svg = 'http://www.w3.org/2000/svg';
  const line = document.createElementNS(svg, 'polyline');
  line.setAttribute('points', ROUTE.map((p) => project(p).join(',')).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#929c7d');
  line.setAttribute('stroke-width', '1.5');
  map.replaceChildren(line);
  for (const i of order) {
    const [x, y] = project(ROUTE[i]),
      circle = document.createElementNS(svg, 'circle'),
      title = document.createElementNS(svg, 'title');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', i === checkpoint ? 4 : 2.5);
    circle.setAttribute('fill', i <= checkpoint ? '#aa4e31' : '#f2f0e3');
    circle.setAttribute('stroke', '#929c7d');
    title.textContent = ROUTE[i].name;
    circle.append(title);
    map.append(circle);
  }
}
const teams = createTeams();
scene.add(teams);
rebuild();
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (phase === 'workshop') {
    if (focusTime > 0) {
      orbit.target.lerp(desiredTarget, 1 - Math.exp(-5 * dt));
      camera.position.lerp(desiredCamera, 1 - Math.exp(-4 * dt));
      focusTime -= dt;
    }
    orbit.update();
  } else {
    if (!paused && !$('help').open && !document.hidden) {
      accumulator += dt;
      while (accumulator >= STEP) {
        if (phase === 'procession') pull(rig, keys, STEP);
        world.step(STEP);
        rig.age += STEP;
        if (phase === 'procession') damageOffRoad(rig, chariotRoadDeparture(rig.base), STEP);
        const broken = inspectJoints(world, rig.joints);
        if (broken.length && phase === 'procession') {
          phase = 'failed';
          $('status').textContent =
            `${rig.offRoad > 0 ? 'Off-road damage! ' : ''}Joint failed: ${broken[0]}. Press R to rebuild.`;
        }
        const up = rig.base.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
        if (up.y < 0.45 && phase === 'procession') {
          phase = 'failed';
          $('status').textContent = 'The chariot tipped. Press R to rebuild.';
        }
        accumulator -= STEP;
      }
      sync(rig);
      if (phase === 'procession') {
        const next = advanceCheckpoint(checkpoint, rig.base.position);
        if (next !== checkpoint) {
          checkpoint = next;
          drawMap();
          $('status').textContent = `${ROUTE[checkpoint].name} reached. Keep the team together.`;
          if (checkpoint === ROUTE.length - 1) {
            phase = 'won';
            $('status').textContent =
              'Basantapur reached. Every joint intact. A journey carried together.';
          }
        }
      }
    }
    const position = new THREE.Vector3().copy(rig.base.position);
    // Translate camera and orbit target together. OrbitControls owns the angle
    // and zoom, so following the moving chariot never overwrites the user's view.
    const focus = position.clone().add(new THREE.Vector3(0, 4, 0));
    camera.position.add(focus.clone().sub(orbit.target));
    orbit.target.copy(focus);
    orbit.update();
    sun.position.copy(position).add(new THREE.Vector3(-20, 35, 18));
    sun.target.position.copy(position);
    updateTeams(teams, rig, phase === 'procession');
    const speed = Math.hypot(rig.base.velocity.x, rig.base.velocity.z),
      stress = Math.max(0, ...rig.joints.filter((j) => !j.broken).map((j) => j.stress));
    let steering = 'STRAIGHT';
    for (const key of keys) {
      if (key === 'ArrowLeft') steering = '← LEFT';
      if (key === 'ArrowRight') steering = 'RIGHT →';
    }
    processionAudio.update({
      phase,
      paused: paused || $('help').open || document.hidden,
      pulling: keys.has('KeyW') || keys.has('ArrowLeft') || keys.has('ArrowRight'),
    });
    for (const button of document.querySelectorAll('[data-steer]'))
      button.classList.toggle('held', keys.has(button.dataset.steer));
    $('steering').textContent =
      phase === 'failed'
        ? 'DISABLED — PRESS R TO REBUILD'
        : phase === 'won'
          ? 'COMPLETE'
          : paused || $('help').open
            ? 'PAUSED'
            : steering;
    const turn = upcomingTurn(checkpoint, rig.base.position);
    $('turn-preview').textContent = turn
      ? `${turn.direction === 'Finish' ? 'Basantapur' : `${turn.direction === 'Left' ? '←' : '→'} ${turn.direction} ${turn.degrees}°`} · ${Math.round(turn.distance)} m`
      : 'Route complete';
    $('turn-preview').classList.toggle(
      'danger',
      phase === 'procession' && !!turn && turn.degrees > 0 && turn.distance < 25 && speed > 1,
    );
    const damage = Math.max(0, ...rig.joints.map((j) => j.damage));
    $('damage').value = damage;
    $('damage-value').textContent = `${Math.round(damage * 100)}%`;
    $('road-warning').textContent =
      rig.offRoad > 0 ? 'OFF ROAD — STRUCTURE TAKING DAMAGE' : 'ON PATH';
    $('road-warning').classList.toggle('danger', rig.offRoad > 0);
    $('speed').textContent = `${(speed * 3.6).toFixed(1)} km/h`;
    $('momentum').textContent = `${((speed * rig.totalMass) / 1000).toFixed(1)} kN·s`;
    $('joints').textContent =
      `${rig.joints.filter((j) => !j.broken).length} / ${rig.joints.length}`;
    $('effort').value = rig.effort;
    $('effort-value').textContent = `${Math.round(rig.effort * 100)}%`;
    $('stress').value = stress;
    $('stress-value').textContent = `${Math.round(stress * 100)}%`;
    $('checkpoint').textContent = ROUTE[checkpoint].name;
    $('next-stop').textContent =
      checkpoint < ROUTE.length - 1
        ? `Next: ${ROUTE[checkpoint + 1].name}`
        : 'The procession is complete.';
    route.markers.forEach((m, i) => {
      m.visible = i === checkpoint + 1;
      m.material.color.set('#bc8431');
    });
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
