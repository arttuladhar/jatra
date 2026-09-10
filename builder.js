import * as THREE from 'three';

// Game tuning, not measured engineering properties of these traditional timbers.
export const WOODS = [
  {
    name: 'Dhama',
    subtitle: 'The central spine',
    wood: 'Sau / Saur',
    mass: 2200,
    flexibility: 0.25,
    strength: 260000,
    note: 'The long timber spine carries every heave into the frame.',
    y: 2.1,
  },
  {
    name: 'The four Bhairavs',
    subtitle: 'Solid timber wheels',
    wood: 'San-nan',
    mass: 520,
    flexibility: 0.18,
    strength: 150000,
    note: 'Four heavy discs keep their momentum long after the team rests.',
    y: 1.3,
  },
  {
    name: 'Upper tower',
    subtitle: 'A silhouette above the city',
    wood: 'Falnat',
    mass: 480,
    flexibility: 0.65,
    strength: 105000,
    note: 'A taller tower raises the center of mass. Take corners with care.',
    y: 9,
  },
  {
    name: 'Shrine pillars',
    subtitle: 'The frame beneath the tower',
    wood: 'Lakuri',
    mass: 110,
    flexibility: 0.5,
    strength: 150000,
    note: 'Four lashed pillars transfer the tower’s weight into the Dhama.',
    y: 4,
  },
  {
    name: 'Wooden brakes',
    subtitle: 'Bring the procession to rest',
    wood: 'Maeel',
    mass: 85,
    flexibility: 0.35,
    strength: 100000,
    note: 'Progressive pressure preserves balance. Sudden braking loads the joints.',
    y: 1.6,
  },
];
export const OPTIONS = [
  { name: 'Traditional', mass: 1, strength: 1, flex: 1, scale: 1, friction: 0.6 },
  { name: 'Reinforced', mass: 1.25, strength: 1.5, flex: 0.7, scale: 1.08, friction: 0.85 },
  { name: 'Slender', mass: 0.78, strength: 0.7, flex: 1.3, scale: 0.9, friction: 0.42 },
];
export function properties(part, selection) {
  const w = WOODS[part],
    o = OPTIONS[selection];
  return {
    ...w,
    mass: w.mass * o.mass,
    strength: w.strength * o.strength,
    flexibility: w.flexibility * o.flex,
    scale: o.scale,
    friction: o.friction,
  };
}
const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
const timber = material('#694126'),
  gold = material('#bd913c'),
  red = material('#a33626'),
  rope = material('#c3a76b'),
  green = material('#586343');
export function box(w, h, d, mat = timber) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}
function beam(group, a, b, width, mat = timber) {
  const start = new THREE.Vector3(...a),
    end = new THREE.Vector3(...b);
  const m = box(width, start.distanceTo(end), width, mat);
  m.position.copy(start).add(end).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  group.add(m);
}
export function makeChariot(selection) {
  const group = new THREE.Group(),
    parts = [];
  function add(id, part, pos, size, mesh, shape = 'box') {
    mesh.position.set(...pos);
    group.add(mesh);
    mesh.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const p = properties(part, selection[part]);
    parts.push({ id, part, pos, size, mesh, shape, ...p });
    return mesh;
  }
  const base = new THREE.Group();
  base.add(box(3.3, 0.5, 5.8));
  for (const x of [-1.2, 1.2]) {
    const m = box(0.35, 0.4, 8);
    m.position.set(x, -0.28, -0.7);
    base.add(m);
  }
  const deck = box(4, 0.18, 4.9, gold);
  deck.position.y = 0.35;
  base.add(deck);
  add('dhama', 0, [0, 2.0, 0], [3.3, 0.5, 5.8], base);
  // Reference plates show solid planked discs, not wagon spokes. Add carved eye
  // textures to these faces later; keep the convex cylinder as the collider.
  for (const x of [-2.05, 2.05])
    for (const z of [-1.9, 1.9]) {
      const g = new THREE.Group(),
        s = properties(1, selection[1]).scale,
        r = 1.28 * s;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.45, 24), material('#aa7137'));
      disc.rotation.z = Math.PI / 2;
      g.add(disc);
      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.065, 6, 32), gold);
        rim.rotation.y = Math.PI / 2;
        rim.position.x = side * 0.235;
        g.add(rim);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.16, 12), timber);
        hub.rotation.z = Math.PI / 2;
        hub.position.x = side * 0.28;
        g.add(hub);
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          beam(
            g,
            [side * 0.24, Math.sin(a) * 0.34, Math.cos(a) * 0.34],
            [side * 0.24, Math.sin(a) * r * 0.86, Math.cos(a) * r * 0.86],
            0.018,
            timber,
          );
        }
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3;
          const eye = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 6, 16), red);
          eye.rotation.y = Math.PI / 2;
          eye.position.set(side * 0.26, Math.sin(a) * r * 0.62, Math.cos(a) * r * 0.62);
          g.add(eye);
        }
      }
      add(`wheel-${x}-${z}`, 1, [x, 1.4, z], [r, 0.45, r], g, 'wheel');
    }
  for (const x of [-1.35, 1.35])
    for (const z of [-1.6, 1.6]) {
      const g = new THREE.Group();
      g.add(box(0.24, 2.1, 0.24, gold));
      for (const y of [-0.8, 0.8]) {
        const m = box(0.36, 0.18, 0.36);
        m.position.y = y;
        g.add(m);
      }
      add(`pillar-${x}-${z}`, 3, [x, 3.35, z], [0.24, 2.1, 0.24], g);
    }
  const shrine = new THREE.Group();
  shrine.add(box(3.8, 0.3, 4.2, gold));
  for (const x of [-1.3, 1.3]) {
    const curtain = box(0.06, 1.4, 2.1, red);
    curtain.position.set(x, -0.85, 0);
    shrine.add(curtain);
  }
  for (let i = 0; i < 12; i++) {
    const m = box(0.16, 0.22, 0.12, gold);
    m.position.set(-1.65 + i * 0.3, 0.2, -2.1);
    shrine.add(m);
  }
  add('crown', 2, [0, 4.55, 0], [3.8, 0.3, 4.2], shrine);
  // The skeleton in image.png and copy 5 uses tapering crossed timbers and
  // repeated lashings. Each tier is a separate rigid body, so it can fall away.
  const towerScale = properties(2, selection[2]).scale;
  for (let tier = 0; tier < 5; tier++) {
    const g = new THREE.Group(),
      h = 1.65 * towerScale,
      r = 1.4 - tier * 0.245,
      rt = r - 0.22;
    for (const x of [-1, 1])
      for (const z of [-1, 1]) beam(g, [x * r, -h / 2, z * r], [x * rt, h / 2, z * rt], 0.13);
    for (let j = 0; j < 4; j++) {
      const y = -h / 2 + (j * h) / 3,
        rr = r - ((r - rt) * j) / 3;
      for (const z of [-1, 1])
        beam(g, [-rr - 0.16, y, z * rr], [rr + 0.16, y, z * rr], 0.095, rope);
      for (const x of [-1, 1])
        beam(g, [x * rr, y, -rr - 0.16], [x * rr, y, rr + 0.16], 0.095, rope);
    }
    for (const z of [-1, 1]) beam(g, [-r, -h / 2, z * r], [rt, h / 2, z * rt], 0.08, gold);
    const foliage = new THREE.Mesh(new THREE.CylinderGeometry(rt * 0.9, r * 0.9, h, 7), green);
    g.add(foliage);
    const ribbon = box(0.18, h, 0.035, red);
    ribbon.position.z = -r - 0.03;
    ribbon.rotation.x = -0.13;
    g.add(ribbon);
    if (tier === 4) {
      beam(g, [0, 0, 0], [0, 2, 0], 0.07, gold);
      const flag = box(0.95, 0.34, 0.025, red);
      flag.position.set(0.42, 1.8, 0);
      g.add(flag);
    }
    add(`tower-${tier}`, 2, [0, 4.75 + h * (tier + 0.5), 0], [r * 2, h, r * 2], g);
  }
  for (const x of [-1.5, 1.5])
    add(`brake-${x}`, 4, [x, 1.55, 0.45], [0.25, 0.35, 0.85], box(0.25, 0.35, 0.85));
  const groundOffset = 1.28 * properties(1, selection[1]).scale + 0.003 - 1.4;
  for (const p of parts) {
    p.pos[1] += groundOffset;
    p.mesh.position.y = p.pos[1];
  }
  return { group, parts };
}
export function disposeChariot(chariot) {
  chariot.group.traverse((m) => {
    m.geometry?.dispose();
  });
  chariot.group.removeFromParent();
}
export function highlight(chariot, index) {
  for (const p of chariot.parts)
    p.mesh.traverse((m) => {
      if (m.isMesh) {
        if (!m.userData.ownMaterial) {
          m.material = m.material.clone();
          m.userData.ownMaterial = true;
        }
        m.material.emissive.set(p.part === index ? '#70411b' : '#000000');
        m.material.emissiveIntensity = 0.22;
      }
    });
}
