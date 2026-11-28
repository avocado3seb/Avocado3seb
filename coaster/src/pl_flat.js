// ============================================================================
//  pl_flat.js – Fahrgeschäfte zum Mitfahren ohne Strecke: Pferdekarussell, Wellenflug (Kettenkarussell), Tittle Tattle Tree.
//  Die Spielerfigur setzt sich auf einen Sitz (E am Eingang) und fährt die Runde mit; Leertaste = Absteigen.
//  Stilisierte Nachbildungen nach der Beschreibung – keine Originalpläne.
// ============================================================================
import * as THREE from 'three';
import { Batch, hex } from './batch.js';
import * as A from './pl_assets.js';

const TAU = Math.PI * 2;
const std = (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...e });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const vcMat = (r = 0.55, m = 0.1) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, metalness: m });
const V = new THREE.Vector3(), V2 = new THREE.Vector3();

function stripeTex(c1, c2, n = 12) { // senkrechte Streifen (läuft einmal um einen Kegel)
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * 512 / n, 0, 512 / n + 1, 64); }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 54, 512, 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

// ---------------------------------------------------------------- Pferd (Batch, Vorwärts = +x), mit Haltestange
const horseCache = {};
function horseGeo(body, mane, saddle) {
  const key = body + mane + saddle; if (horseCache[key]) return horseCache[key];
  const b = new Batch(), X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], bc = hex(body), mc = hex(mane), sc = hex(saddle), gold = hex('#d8b040'), dark = hex('#2a2018');
  b.obox([0, 0.78, 0], X, Y, Z, 1.15, 0.52, 0.42, bc);
  b.obox([0.52, 0.88, 0], X, Y, Z, 0.34, 0.52, 0.38, bc); b.obox([-0.5, 0.82, 0], X, Y, Z, 0.34, 0.5, 0.4, bc);
  b.tube([0.6, 0.95, 0], [0.82, 1.38, 0], 0.15, bc, 6);
  b.obox([1.02, 1.42, 0], [0.97, -0.24, 0], [0.24, 0.97, 0], Z, 0.5, 0.22, 0.2, bc);
  b.tube([0.55, 1.02, 0], [0.76, 1.5, 0], 0.075, mc, 5);
  for (const sz of [-1, 1]) b.tube([0.84, 1.52, sz * 0.07], [0.88, 1.68, sz * 0.06], 0.04, bc, 4);
  for (const [x, z, fwd] of [[0.5, 0.14, 0.3], [0.5, -0.14, 0.3], [-0.5, 0.14, -0.06], [-0.5, -0.14, -0.06]]) { b.tube([x, 0.6, z], [x + fwd, 0.14, z], 0.065, bc, 5); b.tube([x + fwd, 0.14, z], [x + fwd, 0.02, z], 0.08, dark, 5); }
  b.tube([-0.66, 0.92, 0], [-0.96, 0.46, 0], 0.06, mc, 5);
  b.obox([0.05, 1.07, 0], X, Y, Z, 0.5, 0.09, 0.46, sc);
  b.tube([0.05, 0.3, 0], [0.05, 3.2, 0], 0.035, gold, 5);
  return (horseCache[key] = b.build());
}

// ---------------------------------------------------------------- Arme mit Kette + Sitz (Wellenflug, Tree)
function makeArms(parent, count, R, L, seatMat, seatFn) {
  const chainM = std('#2a2a30', { metalness: 0.7, roughness: 0.4 }), arms = [];
  for (let k = 0; k < count; k++) {
    const a = k / count * TAU, arm = new THREE.Group(); arm.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); arm.rotation.y = -a; // +x = nach außen, +z = Fahrtrichtung
    const pivot = new THREE.Group(); arm.add(pivot);
    for (const sz of [-0.28, 0.28]) { const ch = mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 4), chainM, 0, -L / 2, sz); ch.castShadow = false; pivot.add(ch); }
    const seat = new THREE.Group(); seat.position.set(0, -L, 0); seat.rotation.y = Math.PI / 2; pivot.add(seat); // Sitz-Vorwärts (+x) = Fahrtrichtung (= -z des Arms)
    seatFn(seat, k, seatMat); parent.add(arm); arms.push({ arm, pivot, seat });
  }
  return arms;
}
function swingSeat(seat, k) {
  const cols = ['#c8202e', '#e8a010', '#2a6ac8', '#2a9a4a', '#a040c8', '#e8e0d0'], c = cols[k % cols.length];
  seat.add(mesh(new THREE.BoxGeometry(0.62, 0.1, 0.62), std(c), 0, 0, 0)); seat.add(mesh(new THREE.BoxGeometry(0.08, 0.55, 0.62), std(c), -0.3, 0.3, 0));
  for (const sz of [-0.3, 0.3]) seat.add(mesh(new THREE.BoxGeometry(0.55, 0.05, 0.05), std('#d8d8d8', { metalness: 0.8 }), 0, 0.42, sz));
}

// ---------------------------------------------------------------- Bauteile der drei Fahrgeschäfte
function buildCarousel(f, G) {
  const env = f.world.env, wood = new THREE.MeshStandardMaterial({ map: A.tex.planks('#6a4a2a'), roughness: 0.9 }), gold = std('#d8b040', { metalness: 0.7, roughness: 0.35 });
  G.add(mesh(new THREE.CylinderGeometry(7.9, 8.3, 0.7, 40), wood, 0, 0.35, 0));
  const rotor = f.rotor = new THREE.Group(); rotor.position.y = 0.7; G.add(rotor);
  rotor.add(mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.3, 40), std('#9a7a50', { roughness: 0.8 }), 0, 0.15, 0));
  rotor.add(mesh(new THREE.CylinderGeometry(1.6, 1.6, 6.4, 20), std('#e8dcc0', { roughness: 0.6 }), 0, 3.2, 0));
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, m = mesh(new THREE.PlaneGeometry(0.9, 3.4), std('#e8eef4', { metalness: 1, roughness: 0.06 }), Math.cos(a) * 1.62, 3.4, Math.sin(a) * 1.62); m.rotation.y = Math.PI / 2 - a; rotor.add(m); }
  const bulbM = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffc860, emissiveIntensity: 0.4, roughness: 0.4 }); env.registerLamp(bulbM);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), bulbM, 64), m4 = new THREE.Matrix4();
  for (let k = 0; k < 40; k++) { const a = k / 40 * TAU; m4.makeTranslation(Math.cos(a) * 8.45, 6.0, Math.sin(a) * 8.45); bulbs.setMatrixAt(k, m4); }
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; m4.makeTranslation(Math.cos(a) * 1.65, 6.35, Math.sin(a) * 1.65); bulbs.setMatrixAt(40 + k, m4); }
  rotor.add(bulbs);
  const cone = mesh(new THREE.ConeGeometry(8.7, 2.6, 28, 1, true), new THREE.MeshStandardMaterial({ map: stripeTex('#b8202a', '#f4ecd8', 14), roughness: 0.8, side: THREE.DoubleSide }), 0, 7.45, 0); rotor.add(cone);
  const rim = mesh(new THREE.TorusGeometry(8.55, 0.16, 6, 48), gold, 0, 6.1, 0); rim.rotation.x = Math.PI / 2; rotor.add(rim);
  rotor.add(mesh(new THREE.SphereGeometry(0.55, 12, 10), gold, 0, 8.9, 0)); rotor.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), gold, 0, 8.4, 0));
  const body = ['#f4f0e4', '#c89a64', '#6a4a30', '#3a3a40', '#d8d0c0', '#a8582a', '#e8e0d0', '#8a8a90'], saddles = ['#b02a2a', '#2a5aa8', '#2a8a4a', '#d8a020'], manes = ['#d8b040', '#2a2018', '#e8e0d0', '#b02a2a'];
  let n = 0; f.horses = [];
  for (const [R, cnt] of [[6.3, 14], [4.4, 10], [2.9, 6]]) for (let k = 0; k < cnt; k++) {
    const a = k / cnt * TAU + (R < 5 ? 0.2 : 0), h = new THREE.Mesh(horseGeo(body[(n + k) % body.length], manes[(n + k * 3) % manes.length], saddles[(n + k) % saddles.length]), vcMat(0.5, 0.15));
    h.castShadow = true; h.position.set(Math.cos(a) * R, 0.55, Math.sin(a) * R); h.rotation.y = Math.PI / 2 - a; h.userData = { phase: a * 2 + n, amp: 0.33 };
    rotor.add(h); f.horses.push(h); f.seats.push({ obj: h, local: new THREE.Vector3(0.05, 1.1, 0), drop: 0.52 }); n++;
  }
  f.radius = 8.6; f.radiusCol = 8.4; f.glowY = 6; f.speed = 0.85;
  f.apply = dt => { f.rotor.rotation.y += f.w * f.speed * dt; const t = f.tt * 2.3; for (const h of f.horses) h.position.y = 0.55 + f.w * h.userData.amp * (0.5 + 0.5 * Math.sin(t + h.userData.phase)); };
}

function buildWave(f, G) {
  const env = f.world.env;
  G.add(mesh(new THREE.BoxGeometry(5.4, 2.8, 5.4), std('#e8dcc0'), 0, 1.4, 0)); const hip = mesh(new THREE.ConeGeometry(4.2, 1.8, 4), std('#a82a2a'), 0, 3.7, 0); hip.rotation.y = Math.PI / 4; G.add(hip);
  G.add(mesh(new THREE.CylinderGeometry(1.0, 1.5, 9, 16), std('#7a8aa0', { metalness: 0.5, roughness: 0.45 }), 0, 6.5, 0));
  const tilt = f.tilt = new THREE.Group(); tilt.position.y = 11; G.add(tilt);
  const spin = f.spin = new THREE.Group(); tilt.add(spin);
  spin.add(mesh(new THREE.ConeGeometry(6.2, 2.4, 28, 1, true), new THREE.MeshStandardMaterial({ map: stripeTex('#2a5ac8', '#f4ecd8', 16), roughness: 0.8, side: THREE.DoubleSide }), 0, 1.2, 0));
  const ring = mesh(new THREE.TorusGeometry(5.6, 0.14, 6, 48), std('#d8b040', { metalness: 0.7, roughness: 0.35 }), 0, 0, 0); ring.rotation.x = Math.PI / 2; spin.add(ring);
  const bulbM = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffb050, emissiveIntensity: 0.4 }); env.registerLamp(bulbM);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 8, 6), bulbM, 32), m4 = new THREE.Matrix4(); for (let k = 0; k < 32; k++) { const a = k / 32 * TAU; m4.makeTranslation(Math.cos(a) * 5.7, 0.05, Math.sin(a) * 5.7); bulbs.setMatrixAt(k, m4); } spin.add(bulbs);
  const arms = makeArms(spin, 16, 5.6, 4.6, null, swingSeat); f.arms = arms; for (const a of arms) f.seats.push({ obj: a.seat, local: new THREE.Vector3(0, 0.12, 0), drop: 0.45 });
  f.radius = 12; f.radiusCol = 3.4; f.glowY = 11; f.speed = 1.55;
  f.apply = dt => {
    f.spin.rotation.y += f.w * f.speed * dt; const t = f.tt * 0.9; f.tilt.rotation.x = 0.17 * f.w * Math.sin(t); f.tilt.rotation.z = 0.17 * f.w * Math.cos(t);
    const sw = 0.12 + 0.78 * f.w * f.w; for (const a of f.arms) a.pivot.rotation.z = sw;
  };
}

function buildTree(f, G) {
  const env = f.world.env, bark = new THREE.MeshStandardMaterial({ map: A.tex.planks('#3a2a1c'), roughness: 1 });
  const trunk = mesh(new THREE.CylinderGeometry(1.3, 2.3, 15, 14), bark, 0, 7.5, 0); G.add(trunk);
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, r = mesh(new THREE.ConeGeometry(0.7, 3.4, 6), bark, Math.cos(a) * 2.2, 1.0, Math.sin(a) * 2.2); r.rotation.z = Math.cos(a) * 0.9; r.rotation.x = -Math.sin(a) * 0.9; G.add(r); }
  const leaf = (c, e) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, emissive: e, emissiveIntensity: 0.0 }); env.registerLamp(m); m.userData.base = 0.0; return m; };
  const cols = [[0x2aa890, 0x0c4038], [0xd870b0, 0x40182c], [0x8ad850, 0x2c4414], [0x4a8ae0, 0x142a48], [0xe8c040, 0x483c10]];
  for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, [c, e] = cols[k % cols.length], s = 4.2 + (k % 3) * 0.8, m = mesh(new THREE.IcosahedronGeometry(1, 1), leaf(c, e), Math.cos(a) * 3.6, 15.5 + (k % 2) * 1.4, Math.sin(a) * 3.6); m.scale.set(s, s * 0.8, s); G.add(m); }
  const top = mesh(new THREE.IcosahedronGeometry(1, 1), leaf(cols[0][0], cols[0][1]), 0, 19, 0); top.scale.set(5.2, 4.4, 5.2); G.add(top);
  const lanM = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc060, emissiveIntensity: 0.4 }); env.registerLamp(lanM);
  for (let k = 0; k < 18; k++) { const a = k / 18 * TAU, m = mesh(new THREE.SphereGeometry(0.28, 8, 6), lanM, Math.cos(a) * 6.6, 12.6 + (k % 3) * 0.9, Math.sin(a) * 6.6); m.castShadow = false; G.add(m); { const lx = Math.cos(a) * 6.6, lz = Math.sin(a) * 6.6; f.world.out.glow.push([f.x + lx * Math.cos(f.rot) + lz * Math.sin(f.rot), f.y + 12.6, f.z - lx * Math.sin(f.rot) + lz * Math.cos(f.rot), 1, 0.75, 0.35, 16]); } }
  const spin = f.spin = new THREE.Group(); spin.position.y = 9.4; G.add(spin);
  const ring = mesh(new THREE.TorusGeometry(4.2, 0.16, 6, 40), std('#6a4a2a'), 0, 0, 0); ring.rotation.x = Math.PI / 2; spin.add(ring);
  const pod = (seat, k) => { const c = ['#e87ac0', '#6ad8c0', '#f0c050', '#7aa0f0'][k % 4]; const e = mesh(new THREE.SphereGeometry(0.6, 12, 10), std(c, { roughness: 0.5 }), 0, 0.35, 0); e.scale.set(1, 0.8, 1); seat.add(e); seat.add(mesh(new THREE.BoxGeometry(0.5, 0.1, 0.55), std('#fff0d0'), 0, 0.05, 0)); };
  const arms = makeArms(spin, 8, 4.2, 3.2, null, pod); f.arms = arms; for (const a of arms) f.seats.push({ obj: a.seat, local: new THREE.Vector3(0, 0.2, 0), drop: 0.45 });
  f.radius = 10; f.radiusCol = 2.6; f.glowY = 10; f.speed = 1.1;
  f.apply = dt => { f.spin.rotation.y += f.w * f.speed * dt; const sw = 0.1 + 0.5 * f.w * f.w; arms.forEach((a, k) => { a.pivot.rotation.z = sw + 0.08 * f.w * Math.sin(f.tt * 2 + k); }); };
}
const BUILD = { carousel: buildCarousel, wave: buildWave, tree: buildTree };

// ---------------------------------------------------------------- Fahrgeschäft
export class FlatRide {
  constructor(world, poi, kind, x, y, z, rot) {
    this.world = world; this.poi = poi; this.kind = kind; this.x = x; this.y = y; this.z = z; this.rot = rot;
    this.G = new THREE.Group(); this.G.position.set(x, y, z); this.G.rotation.y = rot;
    this.w = 0; this.t = 0; this.tt = Math.random() * 10; this.state = 'idle'; this.dur = 38; this.seats = []; this.autoT = 12 + Math.random() * 30; this.occupied = false;
    BUILD[kind](this, this.G);
    this.G.userData.noMerge = true; world.out.world.add(this.G); this.G.updateMatrixWorld(true);
    world.out.colliders.push({ x, z, r: this.radiusCol, y0: y, y1: y + 14 });
    world.out.lights.push({ x, y: y + this.glowY, z, color: 0xffc070, int: 14, range: 26, flicker: 0.04 });
    world.out.glow.push([x, y + this.glowY, z, 1, 0.75, 0.4, 46]);
    (world.anims || (world.anims = [])).push(dt => this.update(dt));
    this.apply(0);
  }
  start(dur = 38) { this.state = 'run'; this.t = 0; this.dur = dur; }
  update(dt) {
    this.tt += dt;
    if (this.state === 'idle') { if (!this.occupied) { this.autoT -= dt; if (this.autoT <= 0) { this.start(22); this.autoT = 60 + Math.random() * 60; } } }
    else if (this.state === 'run') { this.t += dt; this.w = Math.min(1, this.t / 4); if (this.t > this.dur) this.state = 'stop'; }
    else if (this.state === 'stop') { this.w = Math.max(0, this.w - dt / 5); if (this.w <= 0) this.state = 'idle'; }
    if (this.w > 0) this.apply(dt);
  }
  // nächster Sitz zu einer Weltposition
  pickSeat(px, pz) {
    this.G.updateMatrixWorld(true); let best = 0, bd = 1e9;
    this.seats.forEach((s, i) => { s.obj.getWorldPosition(V); const d = (V.x - px) ** 2 + (V.z - pz) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  }
  // Weltpose des Sitzes: Füße x,y,z + Blickrichtung (Fahrtrichtung)
  seatPose(i, out) {
    const s = this.seats[i]; s.obj.updateWorldMatrix(true, false);
    V.copy(s.local).applyMatrix4(s.obj.matrixWorld); V2.set(1, 0, 0).transformDirection(s.obj.matrixWorld);
    out.x = V.x; out.y = V.y - s.drop; out.z = V.z; out.yaw = Math.atan2(V2.x, V2.z); return out;
  }
  get exit() { const d = this.radius + 3; return { x: this.x + Math.sin(this.rot) * d, z: this.z + Math.cos(this.rot) * d }; }
}
