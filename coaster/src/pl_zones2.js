// Zusätzliche Themenbereiche (China Town, Mystery, Berlin), Parkplatz, Luftschiff, Lichterketten, Winter-Dekor
import * as THREE from 'three';
import * as A from './pl_assets.js';
import { textures, signTexture } from './textures.js';
import { glowPoints } from './pl_assets.js';

const TAU = Math.PI * 2;
const mat = (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...e });
const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l);

// ------------------------------------------------------------------ Pagode & chinesische Pavillons
function pagoda(world, x, y, z, floors = 4, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale);
  const red = mat('#a8302a'), roofM = mat('#1f5a48', { side: THREE.DoubleSide }), gold = mat('#d8a82a', { metalness: 0.6, roughness: 0.4 });
  const win = A.M('cwin', () => { const m = new THREE.MeshStandardMaterial({ color: 0x331a10, emissive: 0xff8a30, emissiveIntensity: 0.3 }); world.env.registerLamp(m); return m; });
  A.box(g, 12, 1.0, 12, mat('#8a8a88', { map: A.tex.stone() }), 0, 0.5, 0);
  for (let f = 0; f < floors; f++) {
    const w = 9 - f * 1.5, yb = 1 + f * 4.2;
    A.box(g, w, 3, w, red, 0, yb + 1.5, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.95, 1.8, 4), roofM); roof.rotation.y = Math.PI / 4; roof.position.y = yb + 3.9; roof.scale.set(1, 1, 1); roof.castShadow = true; g.add(roof);
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), win); m.position.set(dx * (w / 2 + 0.03), yb + 1.6, dz * (w / 2 + 0.03)); m.rotation.y = ry; g.add(m); }
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3, 6), gold); spire.position.y = 1 + floors * 4.2 + 2; g.add(spire);
  world.out.world.add(g); world.out.colliders.push({ x, z, r: 6.2 * scale, y0: y, y1: y + 20 });
  for (let f = 0; f < floors; f++) { const yy = y + (1 + f * 4.2 + 2) * scale; world.out.glow.push([x + 4.5 * scale, yy, z, 1, 0.5, 0.2, 40], [x - 4.5 * scale, yy, z, 1, 0.5, 0.2, 40]); }
  world.out.lights.push({ x, y: y + 4, z: z + 7 * scale, color: 0xff9a50, int: 9, range: 20, flicker: 0.1 });
}
function lantern(world, x, y, z, col) {
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.0, roughness: 0.6 }));
  l.scale.y = 1.25; l.position.set(x, y, z); world.group.add(l); world.env.registerLamp(l.material);
  world.out.glow.push([x, y, z, ((col >> 16) & 255) / 255 * 1.2, ((col >> 8) & 255) / 255 * 0.7, (col & 255) / 255 * 0.5, 22]);
}

export function buildChina(world, rng) {
  const zn = world.zones.china, out = world.out, G = world.group;
  // Teich mit Steg
  const pond = new THREE.Mesh(new THREE.CircleGeometry(28, 32), new THREE.MeshStandardMaterial({ map: textures.water().clone(), color: 0x3a7a7a, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.9 }));
  pond.rotation.x = -Math.PI / 2; pond.scale.set(1, 0.7, 1); pond.position.set(zn.x - 20, 0.04, zn.z + 25); G.add(pond); world.waterAnims.push(pond.material.map); world.grid.mark(zn.x - 20, zn.z + 25, 30);
  world.bridge([zn.x - 52, zn.z + 25], [zn.x + 12, zn.z + 25], 3, 0.8, { col: '#8a2a22' });
  // Pagoden und Tore
  for (const [dx, dz, f, s] of [[40, -10, 5, 1.1], [-40, -30, 4, 1], [10, 70, 3, 0.9]]) { if (world.grid.free(zn.x + dx, zn.z + dz, 12)) { pagoda(world, zn.x + dx, world.h(zn.x + dx, zn.z + dz), zn.z + dz, f, s); world.grid.mark(zn.x + dx, zn.z + dz, 12); } }
  // Laternen entlang aller Wege in der Zone
  for (const e of world.edges) {
    const A_ = world.nodes[e[0]], B_ = world.nodes[e[1]], L = Math.hypot(B_.x - A_.x, B_.z - A_.z);
    if (Math.hypot((A_.x + B_.x) / 2 - zn.x, (A_.z + B_.z) / 2 - zn.z) > zn.r * 1.2) continue;
    for (let t = 6; t < L; t += 11) { const x = A_.x + (B_.x - A_.x) * t / L, z = A_.z + (B_.z - A_.z) * t / L; lantern(world, x + 3.5, world.h(x, z) + 3.2, z, 0xd82a2a); lantern(world, x - 3.5, world.h(x, z) + 3.2, z, 0xe8a030); }
  }
  // Bäume (Kirsch/Bambus ähnlich) und Pavillons
  world.scatter('china', 90, 10, zn.r, (x, y, z) => { world.leafyAt(x, y, z, 0.9 + rng() * 0.5); const l = world.inst.crowns; return true; }, 3, 6);
  world.scatter('china', 6, 20, zn.r * 0.9, (x, y, z, rot) => { A.fairyHouse(world.prng, x, y, z, rot, world.env, out); return true; }, 8);
}

// ------------------------------------------------------------------ Mystery: Schloss, Nebel, tote Bäume
export function buildMystery(world, rng) {
  const zn = world.zones.mystery, out = world.out, G = world.group;
  const stone = mat('#4a4a52', { map: A.tex.stone() }), roofM = mat('#1a1a22');
  const cx = zn.x + 10, cz = zn.z - 20, cy = world.h(cx, cz);
  const g = new THREE.Group(); g.position.set(cx, cy, cz);
  A.box(g, 36, 22, 24, stone, 0, 11, 0);
  for (const [sx, sz] of [[-18, -12], [18, -12], [-18, 12], [18, 12]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 36, 14), stone); t.position.set(sx, 18, sz); t.castShadow = true; g.add(t); const c = new THREE.Mesh(new THREE.ConeGeometry(7, 12, 14), roofM); c.position.set(sx, 42, sz); g.add(c); }
  const keep = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 50, 14), stone); keep.position.set(0, 25, 0); keep.castShadow = true; g.add(keep);
  const kc = new THREE.Mesh(new THREE.ConeGeometry(9.5, 18, 14), roofM); kc.position.set(0, 59, 0); g.add(kc);
  const win = A.M('mwin', () => { const m = new THREE.MeshStandardMaterial({ color: 0x151520, emissive: 0x7aa8ff, emissiveIntensity: 0.3 }); world.env.registerLamp(m); return m; });
  for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, r = 7.1; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), win); m.position.set(Math.cos(a) * r, 18 + (k % 4) * 8, Math.sin(a) * r); m.rotation.y = -a + Math.PI / 2; g.add(m); out.glow.push([cx + Math.cos(a) * (r + 0.5), cy + 18 + (k % 4) * 8, cz + Math.sin(a) * (r + 0.5), 0.35, 0.55, 1, 30]); }
  G.add(g); out.colliders.push({ x: cx, z: cz, r: 22, y0: cy, y1: cy + 60 }); world.grid.mark(cx, cz, 34);
  out.lights.push({ x: cx, y: cy + 6, z: cz + 16, color: 0x7aa8ff, int: 22, range: 40, flicker: 0.25 });
  out.glow.push([cx, cy + 66, cz, 0.5, 0.7, 1, 90]);
  // Tote Bäume, Grabsteine, Fackeln in Blau
  const dead = new THREE.CylinderGeometry(0.15, 0.4, 1, 5); dead.translate(0, 0.5, 0);
  const di = new A.Inst(dead, mat('#2a2420'), 140, G, { shadow: true });
  world.scatter('mystery', 120, 10, zn.r * 1.1, (x, y, z) => { const s = 3 + rng() * 5; di.add(x, y, z, 1, s, 1, rng() * TAU, null, (rng() - 0.5) * 0.3, (rng() - 0.5) * 0.3); return true; }, 2, 5); di.done();
  const stones = new A.Inst(new THREE.BoxGeometry(0.8, 1.4, 0.25), mat('#6a6a70'), 80, G, { shadow: true });
  world.scatter('mystery', 60, 40, zn.r, (x, y, z) => { stones.add(x, y + 0.5, z, 1, 0.8 + rng() * 0.5, 1, rng() * TAU, null, 0, (rng() - 0.5) * 0.25); return true; }, 1.5, 5); stones.done();
  for (let k = 0; k < 22; k++) { const a = rng() * TAU, r = 25 + rng() * 80, x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r; if (!world.grid.free(x, z, 2)) continue; const y = world.h(x, z); out.glow.push([x, y + 1.6, z, 0.3, 0.5, 1, 26]); out.lights.push({ x, y: y + 1.6, z, color: 0x6a9aff, int: 4, range: 10, flicker: 0.4 }); }
}

// ------------------------------------------------------------------ Berlin: Straßenzüge, Uhrenturm
export function buildBerlin(world, rng) {
  const out = world.out, th = world.theme;
  // Häuserzeilen beiderseits der Hauptstraße (Gate -> Hub)
  for (let side of [-1, 1]) for (let k = 0; k < 7; k++) {
    const x = side * (22 + rng() * 3), z = 110 + k * 26 + rng() * 4;
    if (!world.grid.free(x, z, 9)) continue;
    const w = 12 + rng() * 6, d = 11 + rng() * 3, h = 8 + rng() * 6, rot = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    world.makeBuilding(x, z, rot, w, d, h, th); world.grid.mark(x, z, 10);
    out.glow.push([x - side * (d / 2 + 0.3), 2.2, z, 1, 0.7, 0.35, 20]);
  }
  // Uhrenturm
  const g = new THREE.Group(); g.position.set(-70, 0, 120);
  const brick = mat('#9a5a40', { map: A.tex.brick() });
  A.box(g, 6, 26, 6, brick, 0, 13, 0); const rf = new THREE.Mesh(new THREE.ConeGeometry(5, 8, 4), mat('#2a3a30')); rf.position.y = 30; rf.rotation.y = Math.PI / 4; g.add(rf);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(2, 24), new THREE.MeshStandardMaterial({ color: 0xf4efe0, emissive: 0xffe0a0, emissiveIntensity: 0 })); clock.position.set(0, 21, 3.05); g.add(clock); world.env.registerLamp(clock.material);
  world.out.world.add(g); out.colliders.push({ x: -70, z: 120, hx: 3, hz: 3, rot: 0, y0: 0, y1: 28 }); out.glow.push([-70, 21, 123.5, 1, 0.85, 0.5, 40]); world.grid.mark(-70, 120, 8);
  // Laternen entlang Hauptstraße
  for (let z = 120; z < 330; z += 14) for (const sx of [-1, 1]) { out.glow.push([sx * 6.5, 4.4, z, 1, 0.78, 0.45, 22]); }
}

// ------------------------------------------------------------------ Parkplatz
export function buildParking(world, rng) {
  const zn = world.zones.parking, G = world.group, out = world.out;
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(260, 150), new THREE.MeshStandardMaterial({ map: textures.asphalt().clone(), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  lot.material.map.repeat.set(26, 15); lot.material.map.needsUpdate = true; lot.rotation.x = -Math.PI / 2; lot.position.set(zn.x, 0.06, zn.z); lot.receiveShadow = true; G.add(lot);
  // Fahrzeuge (instanziert)
  const car = new THREE.BoxGeometry(2, 1.4, 4.4); car.translate(0, 0.9, 0);
  const cars = new A.Inst(car, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.5 }), 260, G, { shadow: true });
  const cabin = new THREE.BoxGeometry(1.8, 0.7, 2.2); cabin.translate(0, 1.85, -0.2);
  const cab = new A.Inst(cabin, new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.2, metalness: 0.6 }), 260, G);
  for (let r = 0; r < 5; r++) for (let k = 0; k < 24; k++) {
    if (rng() < 0.28) continue; const x = zn.x - 110 + k * 9.2, z = zn.z - 50 + r * 24 + (r > 2 ? 10 : 0);
    const col = hsl(rng(), 0.5 * rng(), 0.25 + rng() * 0.5); cars.add(x, 0.08, z, 1, 1, 1, 0, col); cab.add(x, 0.08, z, 1, 1, 1, 0);
    out.colliders.push({ x, z, hx: 1, hz: 2.2, rot: 0, y0: 0, y1: 1.6 });
  }
  cars.done(); cab.done();
  // Busse
  const bus = new THREE.BoxGeometry(3, 3, 12); bus.translate(0, 1.8, 0); const buses = new A.Inst(bus, new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.5 }), 6, G, { shadow: true });
  for (let k = 0; k < 4; k++) { buses.add(zn.x - 90 + k * 22, 0.1, zn.z + 62, 1, 1, 1, 0); out.colliders.push({ x: zn.x - 90 + k * 22, z: zn.z + 62, hx: 1.5, hz: 6, rot: 0, y0: 0, y1: 3.5 }); } buses.done();
  // Ticketschalter am Tor, Schranken
  for (const sx of [-1, 1]) { const b = new THREE.Group(); b.position.set(sx * 12, 0, 370); A.box(b, 3, 3, 3, mat('#d8d0c0'), 0, 1.5, 0); A.box(b, 3.4, 0.3, 3.4, mat('#a8302a'), 0, 3.1, 0); A.box(b, 1.2, 0.8, 0.1, new THREE.MeshBasicMaterial({ color: 0x88ccff }), 0, 1.6, 1.55); G.add(b); out.colliders.push({ x: sx * 12, z: 370, hx: 1.5, hz: 1.5, rot: 0, y0: 0, y1: 3.2 }); out.glow.push([sx * 12, 3.6, 370, 1, 0.9, 0.6, 24]); }
  for (let z = 360; z < 560; z += 18) for (const sx of [-1, 1]) out.glow.push([sx * 7, 4.6, z, 1, 0.8, 0.5, 20]);
  // Lichtmasten auf dem Parkplatz
  for (let k = 0; k < 6; k++) for (let r = 0; r < 3; r++) { const x = zn.x - 100 + k * 40, z = zn.z - 40 + r * 40; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 6), mat('#3a3e44')); p.position.set(x, 4.5, z); G.add(p); out.glow.push([x, 9.2, z, 1, 0.9, 0.65, 40]); if (r === 1 && k % 2 === 0) out.lights.push({ x, y: 9, z, color: 0xffe0b0, int: 14, range: 30, flicker: 0 }); }
  world.markFlat(zn.x, zn.z, 140);
}

// ------------------------------------------------------------------ Luftschiff (Rookburgh)
export function buildAirship(world) {
  const zn = world.zones.rookburgh, g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat('#b8a888', { metalness: 0.2, roughness: 0.6 })); body.scale.set(26, 8, 8); body.castShadow = true; g.add(body);
  const gond = A.box(g, 8, 2.5, 3, mat('#4a3a2a'), 0, -9, 0);
  for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 4), mat('#2a2a2a')); rod.position.set(sx * 3, -6, 0); g.add(rod); }
  for (const [x, y, z] of [[-22, 0, 0], [-20, 6, 0], [-20, -6, 0]]) { const f = A.box(g, 6, 0.4, 5, mat('#8a2a22'), x, y, z); f.rotation.z = y * 0.05; }
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 0.4), mat('#222')); prop.position.set(-4, -9, 2.2); g.add(prop);
  const mk = (c) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.cloud(), color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false })); s.scale.set(7, 7, 1); return s; };
  const red = mk(0xff2020), green = mk(0x20ff40), white = mk(0xffffff); red.position.set(0, -9, 3.5); green.position.set(0, -9, -3.5); white.position.set(-26, 0, 0); g.add(red, green, white);
  const lamp = new THREE.PointLight(0xffe0b0, 0, 40, 1.8); lamp.position.set(0, -10, 0); g.add(lamp);
  world.group.add(g);
  world.anims.push(dt => {
    const t = world.time * 0.04, R = 230;
    g.position.set(zn.x + Math.cos(t) * R, 125 + Math.sin(t * 3) * 6, zn.z + Math.sin(t) * R * 0.7);
    g.rotation.y = -t - Math.PI / 2 + 0.2 * Math.sin(t * 2); prop.rotation.x += dt * 14;
    const night = Math.min(1, (world.env.night || 0) * 1.4), blink = (Math.sin(world.time * 5) > 0.2 ? 1 : 0.15);
    red.material.opacity = night * blink; green.material.opacity = night * blink; white.material.opacity = night * (0.6 + 0.4 * Math.sin(world.time * 2)); lamp.intensity = 25 * night;
    gond.material.emissive = gond.material.emissive || new THREE.Color(0); gond.material.emissive.setRGB(1, 0.6, 0.25); gond.material.emissiveIntensity = night * 0.8;
  });
}

// ------------------------------------------------------------------ Lichterketten (Nacht) entlang der Wege
export function buildLightStrings(world) {
  const pts = [], cols = { klugheim: [1, 0.6, 0.25], africa: [0.5, 1, 0.4], rookburgh: [1, 0.7, 0.3], mexico: null, fantasy: null, china: [1, 0.3, 0.25], mystery: [0.4, 0.6, 1], berlin: [1, 0.85, 0.55] };
  for (const e of world.edges) {
    if (e[2] < 5) continue;
    const A_ = world.nodes[e[0]], B_ = world.nodes[e[1]], L = Math.hypot(B_.x - A_.x, B_.z - A_.z), nx = -(B_.z - A_.z) / L, nz = (B_.x - A_.x) / L;
    const zk = world.zoneOf((A_.x + B_.x) / 2, (A_.z + B_.z) / 2) || 'berlin';
    for (const sd of [-1, 1]) for (let t = 3; t < L - 3; t += 2.6) {
      const sag = Math.sin(((t % 15) / 15) * Math.PI) * 0.7, x = A_.x + (B_.x - A_.x) * t / L + nx * (e[2] / 2 + 0.9) * sd, z = A_.z + (B_.z - A_.z) * t / L + nz * (e[2] / 2 + 0.9) * sd;
      let c = cols[zk]; if (!c) { const h = new THREE.Color().setHSL(((t * 0.07 + sd) % 1 + 1) % 1, 0.9, 0.6); c = [h.r * 1.2, h.g * 1.2, h.b * 1.2]; }
      pts.push([x, world.h(x, z) + 4.2 - sag, z, c[0], c[1], c[2], 9]);
    }
  }
  return pts;
}

// ------------------------------------------------------------------ Wintertraum-Dekor (standardmäßig unsichtbar)
export function buildWinterDecor(world, rng) {
  const g = new THREE.Group(); g.visible = false; const pts = [];
  // Weihnachtsmarkt auf dem Hauptplatz
  const wood = mat('#6a4a2a');
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * TAU, r = 34, x = Math.cos(a) * r, z = 60 + Math.sin(a) * r * 0.85;
    const s = new THREE.Group(); s.position.set(x, 0.1, z); s.rotation.y = -a + Math.PI / 2;
    A.box(s, 3.4, 2.4, 2.4, wood, 0, 1.2, 0); const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.4, 4), mat(k % 2 ? '#a8302a' : '#f0ece0')); roof.rotation.y = Math.PI / 4; roof.position.y = 3.1; s.add(roof);
    A.box(s, 3.6, 0.15, 1.2, mat('#d8c8a0'), 0, 1.15, 1.5); g.add(s);
    for (let q = 0; q < 6; q++) pts.push([x + (q - 2.5) * 0.5 * Math.cos(-a + Math.PI / 2), 2.9 + (q % 2) * 0.2, z + (q - 2.5) * 0.5 * Math.sin(-a + Math.PI / 2), 1, 0.45 + (q % 3) * 0.2, 0.2, 12]);
    pts.push([x, 1.6, z + 1.5, 1, 0.7, 0.35, 30]); world.out.lights.push({ x, y: 2.5, z, color: 0xffa050, int: 4, range: 10, flicker: 0.2, winter: true });
  }
  // Großer Weihnachtsbaum
  const tx = 0, tz = 60;
  const tree = new THREE.Group(); tree.position.set(tx, 0, tz);
  for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(6 - k * 1.2, 7, 12), mat('#1f5a32')); c.position.y = 6 + k * 4.5; c.castShadow = true; tree.add(c); }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshBasicMaterial({ color: 0xffe080 })); star.position.y = 26; tree.add(star); g.add(tree);
  for (let k = 0; k < 160; k++) { const h = 3 + rng() * 21, r = Math.max(0.5, (26 - h) / 26 * 6), a = rng() * TAU, c = [[1, 0.2, 0.2], [1, 0.8, 0.3], [0.3, 0.6, 1], [0.4, 1, 0.4]][k % 4]; pts.push([tx + Math.cos(a) * r, h, tz + Math.sin(a) * r, c[0], c[1], c[2], 11]); }
  pts.push([tx, 26, tz, 1, 0.85, 0.4, 70]);
  // Girlanden entlang der Hauptstraße und um das Tor
  for (let z = 110; z < 340; z += 3) for (const sx of [-1, 1]) pts.push([sx * 8, 4.8 + Math.sin(z * 0.9) * 0.3, z, ((z / 3) % 2) ? 1 : 0.3, ((z / 3) % 2) ? 0.3 : 1, 0.3, 10]);
  g.userData.glow = glowPoints(pts); g.userData.glow.visible = false; world.group.add(g, g.userData.glow);
  return g;
}
