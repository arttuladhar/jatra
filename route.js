import * as THREE from 'three';
import { box } from './builder.js';
import { staticBox } from './physics.js';
import routeMap from './route-map.json' with { type: 'json' };
// The editable route file is the input boundary: reject malformed geometry
// before it can introduce NaN positions or zero-length physics segments.
export function projectRoute(data) {
  const invalid = (message) => {
    throw new Error(`Invalid route-map.json: ${message}`);
  };
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features))
    invalid('expected a FeatureCollection.');
  const lines = data.features.filter((f) => f?.geometry?.type === 'LineString');
  if (lines.length !== 1) invalid('expected exactly one LineString.');
  const coordinates = lines[0].geometry.coordinates;
  const validPoint = (p) =>
    Array.isArray(p) &&
    p.length === 2 &&
    p.every(Number.isFinite) &&
    Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) < 90;
  const samePoint = (a, b) => validPoint(a) && validPoint(b) && a.every((v, i) => v === b[i]);
  if (!Array.isArray(coordinates) || coordinates.length < 3 || !coordinates.every(validPoint))
    invalid('expected at least three finite longitude/latitude pairs.');
  if (!samePoint(coordinates[0], coordinates.at(-1))) invalid('the route must be a closed loop.');
  if (coordinates.some((p, i) => i > 0 && samePoint(p, coordinates[i - 1])))
    invalid('adjacent route vertices must be distinct.');
  const stops = data.features
    .filter((f) => f?.geometry?.type === 'Point')
    .sort((a, b) => (a.properties?.stop ?? 0) - (b.properties?.stop ?? 0));
  if (
    stops.length !== coordinates.length ||
    stops.some(
      (stop, i) =>
        stop.properties?.stop !== i + 1 ||
        typeof stop.properties?.name !== 'string' ||
        !stop.properties.name.trim() ||
        !samePoint(stop.geometry.coordinates, coordinates[i]),
    )
  )
    invalid('numbered, named stops must match the ordered LineString vertices.');
  // Local equirectangular projection: east +X, north -Z, metres at real scale.
  const [originLon, originLat] = coordinates[0],
    radians = Math.PI / 180,
    earthRadius = 6371000;
  return coordinates.map(([lon, lat], i) => ({
    name: stops[i].properties.name,
    x: (lon - originLon) * radians * earthRadius * Math.cos(originLat * radians),
    z: -(lat - originLat) * radians * earthRadius,
  }));
}
export const ROUTE = projectRoute(routeMap);
export const START_HEADING = Math.atan2(-(ROUTE[1].x - ROUTE[0].x), -(ROUTE[1].z - ROUTE[0].z));
export const ROAD_WIDTH = 8;
export const CHECKPOINT_RADIUS = 4;
const PLAZA_WIDTH = 11;
// Distance outside the union of the same extended rectangles we render. At
// corners, either adjoining street is valid; the start/end plazas are included.
export function distanceOutsideRoad(position) {
  let distance = Infinity;
  for (let i = 1; i < ROUTE.length; i++) {
    const a = ROUTE[i - 1],
      b = ROUTE[i],
      dx = b.x - a.x,
      dz = b.z - a.z,
      len = Math.hypot(dx, dz);
    const x = position.x - (a.x + b.x) / 2,
      z = position.z - (a.z + b.z) / 2;
    const across = Math.abs((x * dz - z * dx) / len),
      along = Math.abs((x * dx + z * dz) / len);
    distance = Math.min(
      distance,
      Math.hypot(Math.max(0, across - ROAD_WIDTH / 2), Math.max(0, along - (len + ROAD_WIDTH) / 2)),
    );
  }
  // Small start/finish squares accommodate the long chassis while at rest.
  for (const p of [ROUTE[0], ROUTE.at(-1)])
    distance = Math.min(
      distance,
      Math.hypot(
        Math.max(0, Math.abs(position.x - p.x) - PLAZA_WIDTH / 2),
        Math.max(0, Math.abs(position.z - p.z) - PLAZA_WIDTH / 2),
      ),
    );
  return distance;
}
export function chariotRoadDeparture(base) {
  let outside = 0;
  // Check the chassis/outer-wheel footprint, not just its center point.
  for (const x of [-2.4, 0, 2.4])
    for (const z of [-4.7, 0, 4.7]) {
      const point = base.pointToWorldFrame({ x, y: 0, z });
      outside = Math.max(outside, distanceOutsideRoad(point));
    }
  return outside;
}
export function routeLength() {
  return ROUTE.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - ROUTE[i].x, p.z - ROUTE[i].z), 0);
}
export function advanceCheckpoint(index, position) {
  const next = ROUTE[index + 1];
  return next && Math.hypot(position.x - next.x, position.z - next.z) < CHECKPOINT_RADIUS
    ? index + 1
    : index;
}
export function upcomingTurn(checkpoint, position) {
  const a = ROUTE[checkpoint],
    b = ROUTE[checkpoint + 1],
    c = ROUTE[checkpoint + 2];
  if (!b) return null;
  const distance = Math.hypot(position.x - b.x, position.z - b.z);
  if (!c) return { distance, direction: 'Finish', degrees: 0 };
  const ix = b.x - a.x,
    iz = b.z - a.z,
    ox = c.x - b.x,
    oz = c.z - b.z;
  const angle = Math.atan2(ix * oz - iz * ox, ix * ox + iz * oz);
  return {
    distance,
    direction: angle > 0 ? 'Right' : 'Left',
    degrees: Math.round((Math.abs(angle) * 180) / Math.PI),
  };
}
export function createRoute(scene, world) {
  const group = new THREE.Group(),
    markers = [];
  scene.add(group);
  const road = new THREE.MeshStandardMaterial({ color: '#bab39c', roughness: 1 });
  const edging = new THREE.MeshStandardMaterial({ color: '#d7bf88', roughness: 1 });
  for (const p of [ROUTE[0]]) {
    const plaza = box(PLAZA_WIDTH, 0.06, PLAZA_WIDTH, road);
    plaza.position.set(p.x, -0.005, p.z);
    group.add(plaza);
  }
  // Small shared procedural textures keep brick courses and lattice readable
  // without an image download or hundreds of individual decorative meshes.
  function pattern(pixel, repeatX = 1, repeatY = 1) {
    const data = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) data.set([...pixel(x, y), 255], (y * 64 + x) * 4);
    const texture = new THREE.DataTexture(data, 64, 64);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }
  const brick = pattern(
    (x, y) =>
      y % 16 < 2 || (x + (Math.floor(y / 16) % 2) * 16) % 32 < 2
        ? [133, 96, 77]
        : [195 + ((x * 7 + y * 3) % 18), 130, 101],
    4,
    4,
  );
  const lattice = pattern((x, y) =>
    (x + y) % 16 < 3 || (x - y + 64) % 16 < 3 ? [132, 83, 48] : [35, 25, 22],
  );
  const wallMaterials = ['#c58a70', '#ae7159', '#d0987c', '#b87960'].map(
    (color) => new THREE.MeshStandardMaterial({ color, map: brick, roughness: 1 }),
  );
  const roofMat = new THREE.MeshStandardMaterial({ color: '#9b4930', roughness: 1 });
  const timber = new THREE.MeshStandardMaterial({ color: '#43291d', roughness: 1 });
  const windowMat = new THREE.MeshStandardMaterial({ map: lattice, roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: '#817566', roughness: 1 });
  const yellow = new THREE.MeshBasicMaterial({ color: '#ffcf32', toneMapped: false });
  const charcoal = new THREE.MeshBasicMaterial({ color: '#252522', toneMapped: false });
  const brass = new THREE.MeshStandardMaterial({
    color: '#bf923c',
    metalness: 0.5,
    roughness: 0.5,
  });
  function building(x, z, yaw, i, w, h, depth) {
    const b = new THREE.Group();
    b.name = 'house';
    b.position.set(x, 0, z);
    b.rotation.y = yaw;
    b.scale.z = depth / 6;
    const walls = box(w, h, 6, wallMaterials[i % 4]);
    walls.position.y = h / 2;
    b.add(walls);
    const plinth = box(w + 0.12, 0.45, 6.12, stone);
    plinth.position.y = 0.225;
    b.add(plinth);
    // The street is on local -X; stretch the whole facade with its frontage.
    const facade = new THREE.Group();
    facade.position.x = -w / 2;
    facade.rotation.y = -Math.PI / 2;
    b.add(facade);
    const door = box(1.25, 2.1, 0.16, timber);
    door.position.set(0, 1.1, 0.08);
    facade.add(door);
    for (let y = 2.5; y + 1.7 < h; y += 2.2) {
      const band = box(6.1, 0.16, 0.18, timber);
      band.position.set(0, y - 0.25, 0.08);
      facade.add(band);
      for (const sx of [-1, 0, 1]) {
        const frame = box(1.5, 1.65, 0.3, timber);
        frame.position.set(sx * 1.8, y + 0.7, 0.18);
        facade.add(frame);
        const win = box(1.12, 1.25, 0.04, windowMat);
        win.position.set(sx * 1.8, y + 0.7, 0.35);
        facade.add(win);
      }
      const sill = box(5.3, 0.16, 0.55, timber);
      sill.position.set(0, y - 0.12, 0.25);
      facade.add(sill);
      const lintel = box(5.5, 0.2, 0.55, timber);
      lintel.position.set(0, y + 1.6, 0.25);
      facade.add(lintel);
    }
    const eave = box(w + 0.9, 0.2, 6.8, timber);
    eave.position.y = h + 0.05;
    b.add(eave);
    const run = (w + 1) / 2,
      rise = 1.25;
    for (const side of [-1, 1]) {
      const roof = box(Math.hypot(run, rise), 0.18, 6.9, roofMat);
      roof.position.set((side * run) / 2, h + 0.2 + rise / 2, 0);
      roof.rotation.z = -side * Math.atan2(rise, run);
      b.add(roof);
    }
    const ridge = box(0.24, 0.22, 7, roofMat);
    ridge.position.y = h + 0.2 + rise;
    b.add(ridge);
    group.add(b);
    staticBox(world, [x, h / 2, z], [w, h, depth], yaw);
  }
  // Small neighborhood shrines, inspired by tiered Newar temples rather than
  // replicas of named monuments. Steps and shrine walls have matching bodies.
  function temple(x, z, yaw, tiers) {
    const t = new THREE.Group();
    t.name = 'temple';
    t.position.set(x, 0, z);
    t.rotation.y = yaw;
    group.add(t);
    for (let step = 0; step < 3; step++) {
      const size = 10 - step * 1.2,
        base = box(size, 0.3, size, stone);
      base.position.y = 0.15 + step * 0.3;
      t.add(base);
      staticBox(world, [x, base.position.y, z], [size, 0.3, size], yaw);
    }
    for (let tier = 0; tier < tiers; tier++) {
      const size = 5 - tier * 1.25,
        y = 0.9 + tier * 2.8;
      const walls = box(size, 2.3, size, wallMaterials[1]);
      walls.position.y = y + 1.15;
      t.add(walls);
      staticBox(world, [x, y + 1.15, z], [size, 2.3, size], yaw);
      for (const side of [-1, 1]) {
        const door = box(0.12, 1.7, 1, timber);
        door.position.set(side * (size / 2 + 0.04), y + 0.85, 0);
        t.add(door);
        for (const end of [-1, 1]) {
          const strut = box(0.16, 1.15, 0.16, timber);
          strut.position.set(side * (size / 2 + 0.35), y + 1.85, end * size * 0.35);
          strut.rotation.z = side * 0.45;
          t.add(strut);
        }
      }
      const eave = box(size + 2, 0.18, size + 2, timber);
      eave.position.y = y + 2.25;
      t.add(eave);
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry((size - 0.5) / Math.SQRT2, (size + 2) / Math.SQRT2, 1.2, 4),
        roofMat,
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = y + 2.9;
      t.add(roof);
    }
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.3, 8), brass);
    finial.position.y = 0.9 + (tiers - 1) * 2.8 + 4.1;
    t.add(finial);
  }
  ROUTE.forEach((p, i) => {
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(CHECKPOINT_RADIUS - 0.3, 0.1, 5, 48),
      new THREE.MeshBasicMaterial({ color: '#c29143' }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(p.x, 0.05, p.z);
    group.add(marker);
    markers.push(marker);
    if (!i) return;
    const a = ROUTE[i - 1],
      dx = p.x - a.x,
      dz = p.z - a.z,
      len = Math.hypot(dx, dz),
      yaw = Math.atan2(dx, dz);
    const street = box(ROAD_WIDTH, 0.06, len + ROAD_WIDTH, road);
    street.position.set((a.x + p.x) / 2, -0.005, (a.z + p.z) / 2);
    street.rotation.y = yaw;
    group.add(street);
    const nx = dz / len,
      nz = -dx / len;
    // Stop edge markings before intersections so they do not cut across a turn.
    if (len > 24)
      for (const side of [-1, 1]) {
        const edge = box(0.12, 0.015, len - 24, edging);
        edge.position.set(
          (a.x + p.x) / 2 + nx * side * (ROAD_WIDTH / 2 - 0.12),
          0.034,
          (a.z + p.z) / 2 + nz * side * (ROAD_WIDTH / 2 - 0.12),
        );
        edge.rotation.y = yaw;
        group.add(edge);
      }
    // Each side has its own repeatable lot sequence. Frontage, height,
    // setback and empty lots vary independently instead of mirrored rows.
    for (const side of [-1, 1]) {
      let seed = i * 7919 + (side + 2) * 104729;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      let d = 20 + random() * 8,
        lot = 0;
      while (d < len - 20) {
        const shrine = i % 2 === 0 && side === (i % 4 === 0 ? 1 : -1) && lot === 2;
        const depth = shrine ? 12 : 4.5 + random() * 4,
          w = shrine ? 10 : 5.5 + random() * 3.5;
        const h = 3 + Math.floor(random() * 5) * 2.2,
          empty = !shrine && random() < 0.2;
        const setback = ROAD_WIDTH / 2 + w / 2 + 1 + random() * 3.5;
        const center = d + depth / 2,
          x = a.x + (dx * center) / len + nx * side * setback,
          z = a.z + (dz * center) / len + nz * side * setback;
        const angle = yaw + (side < 0 ? Math.PI : 0);
        // Check the full decorative footprint against every street, including
        // nearby crossing segments, before placing a collidable structure.
        let clear = center + depth / 2 < len - 16;
        for (let u = -w / 2 - 0.6; u <= w / 2 + 0.6; u += 0.5)
          for (let v = -depth / 2 - 0.6; v <= depth / 2 + 0.6; v += 0.5) {
            if (
              distanceOutsideRoad({
                x: x + Math.cos(angle) * u + Math.sin(angle) * v,
                z: z - Math.sin(angle) * u + Math.cos(angle) * v,
              }) < 0.4
            )
              clear = false;
          }
        if (clear && !empty) {
          if (shrine) temple(x, z, angle, i % 4 === 0 ? 3 : 2);
          else building(x, z, angle, Math.floor(random() * 4), w, h, depth);
        }
        d += depth + (shrine ? 7 : 1 + random() * 3) + (empty ? 5 : 0);
        lot++;
      }
    }
    // Bumps keep their existing positions independently of the scenery.
    for (let d = 22; d < len - 20; d += 12) {
      const x = a.x + (dx * d) / len,
        z = a.z + (dz * d) / len;
      if (d > 50 && Math.round((d - 22) / 12) % 5 === 3) {
        const hazard = new THREE.Group();
        hazard.name = 'road-bump';
        hazard.position.set(x, 0, z);
        hazard.rotation.y = yaw;
        group.add(hazard);
        const bump = box(ROAD_WIDTH - 0.8, 0.12, 1.2, charcoal);
        bump.position.y = 0.035;
        hazard.add(bump);
        for (let stripe = 0; stripe < 8; stripe++) {
          const paint = box(0.45, 0.012, 1.2, yellow);
          paint.position.set(-3.375 + stripe * 0.9, 0.101, 0);
          hazard.add(paint);
        }
        staticBox(world, [x, 0.035, z], [ROAD_WIDTH - 0.8, 0.12, 1.2], yaw);
      }
    }
  });
  group.traverse((m) => {
    if (m.isMesh) {
      m.receiveShadow = true;
      m.castShadow = true;
    }
  });
  return { group, markers };
}
