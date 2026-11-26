// Assets für die Phantasialand-Welt: Felsen, Pflanzen, Gebäude, Wasserfälle, Leuchtpunkte
import * as THREE from 'three';
import { Batch, hex } from './batch.js';
import { textures } from './textures.js';
import { gableGeometry } from './park.js';
import { fbm, noise2 } from './pl_terrain.js';

const TAU = Math.PI * 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- Instanzierung
export class Inst {
  constructor(geo, mat, max, group, opts = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.count = 0; this.max = max;
    this.mesh.castShadow = !!opts.shadow; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    group.add(this.mesh); this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.c = new THREE.Color();
  }
  add(x, y, z, sx, sy, sz, ry = 0, color = null, rx = 0, rz = 0) {
    if (this.mesh.count >= this.max) return;
    this.e.set(rx, ry, rz); this.q.setFromEuler(this.e);
    this.m.compose(V3(x, y, z), this.q, V3(sx, sy, sz));
    this.mesh.setMatrixAt(this.mesh.count, this.m);
    if (color) this.mesh.setColorAt(this.mesh.count, this.c.set(color));
    this.mesh.count++;
  }
  done() { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
}

// ---------------------------------------------------------------- Felsen
export function rockGeometry(seed, flat = 0.8) {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = fbm(v.x * 1.7 + seed * 7.1, v.z * 1.7 + v.y * 2.3 + seed * 3.3, 4);
    const ridge = Math.abs(noise2(v.x * 3.2 + seed, v.y * 3.2 + v.z * 3.2) - 0.5) * 0.5;
    let r = 0.62 + n * 0.75 - ridge * 0.5;
    v.multiplyScalar(r); v.y *= flat; if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.1;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
export const rockMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, flatShading: true, map: textures.concrete() });

// ---------------------------------------------------------------- Pflanzen (Batch -> eine Geometrie, dann instanziert)
const leafColor = [0.1, 0.32, 0.08];
function frond(b, base, yaw, len, segs, droop, w, col) {
  let p = base.slice(), pitch = 0.5;
  for (let s = 0; s < segs; s++) {
    const l = len / segs, dx = Math.cos(yaw) * Math.cos(pitch) * l, dz = Math.sin(yaw) * Math.cos(pitch) * l, dy = Math.sin(pitch) * l;
    const c = [p[0] + dx / 2, p[1] + dy / 2, p[2] + dz / 2];
    const ax = [Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)];
    const side = [-Math.sin(yaw), 0, Math.cos(yaw)];
    const up = [ax[1] * side[2] - ax[2] * side[1], ax[2] * side[0] - ax[0] * side[2], ax[0] * side[1] - ax[1] * side[0]];
    b.obox(c, ax, up, side, l * 1.02, 0.025, w * (1 - s / segs * 0.7), col);
    p = [p[0] + dx, p[1] + dy, p[2] + dz]; pitch -= droop;
  }
}
export function palmGeometry() {
  const b = new Batch(), trunk = [0.34, 0.24, 0.14];
  const top = [0.6, 8.2, 0.2];
  let prev = [0, 0, 0];
  for (let i = 1; i <= 5; i++) { const t = i / 5, c = [0.6 * t * t, 8.2 * t, 0.2 * t * t]; b.tube(prev, c, 0.3 - t * 0.12, trunk, 6); prev = c; }
  for (let k = 0; k < 9; k++) frond(b, top, k / 9 * TAU + 0.3, 3.8 + (k % 3) * 0.3, 4, 0.32, 1.1, [0.08 + (k % 2) * 0.05, 0.34, 0.07]);
  return b.build();
}
export function bigLeafGeometry() {
  const b = new Batch();
  b.tube([0, 0, 0], [0, 1.2, 0], 0.07, [0.25, 0.4, 0.15], 5);
  for (let k = 0; k < 7; k++) frond(b, [0, 0.9, 0], k / 7 * TAU, 2.6, 3, 0.35, 1.0, [0.07, 0.38 + (k % 2) * 0.06, 0.1]);
  return b.build();
}
export function fernGeometry() {
  const b = new Batch();
  for (let k = 0; k < 11; k++) frond(b, [0, 0.1, 0], k / 11 * TAU, 1.6, 3, 0.3, 0.45, [0.1, 0.4 + (k % 3) * 0.04, 0.1]);
  return b.build();
}
export function cactusGeometry() {
  const b = new Batch(), c = [0.2, 0.42, 0.2];
  b.tube([0, 0, 0], [0, 3.2, 0], 0.3, c, 7);
  b.tube([0, 1.4, 0], [0.9, 1.4, 0], 0.18, c, 6); b.tube([0.9, 1.4, 0], [0.9, 2.5, 0], 0.18, c, 6);
  b.tube([0, 1.9, 0], [-0.8, 1.9, 0], 0.17, c, 6); b.tube([-0.8, 1.9, 0], [-0.8, 2.8, 0], 0.17, c, 6);
  return b.build();
}
export const vcMat = (rough = 0.9) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, side: THREE.DoubleSide });

// ---------------------------------------------------------------- Texturen für Gebäude
const tcache = {};
function ctex(key, w, h, draw, rep) {
  if (tcache[key]) return tcache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return (tcache[key] = t);
}
export const tex = {
  planks: (col = '#4a3322') => ctex('planks' + col, 256, 256, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, 0, 2, h); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,220,170'},.07)`; g.fillRect(x + 2 + Math.random() * 28, Math.random() * h, 1 + Math.random() * 2, 8 + Math.random() * 40); } }
  }),
  thatch: () => ctex('thatch', 256, 256, (g, w, h) => {
    g.fillStyle = '#9a7a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { g.strokeStyle = `rgba(${90 + Math.random() * 90},${70 + Math.random() * 60},30,.55)`; g.lineWidth = 1; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 4, y + 14 + Math.random() * 14); g.stroke(); }
  }),
  slate: () => ctex('slate', 256, 256, (g, w, h) => {
    g.fillStyle = '#34383f'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = -1; x < 8; x++) { const v = 40 + Math.random() * 26; g.fillStyle = `rgb(${v},${v + 3},${v + 8})`; g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14); }
  }),
  brick: (col = [150, 72, 52]) => ctex('brick' + col, 256, 256, (g, w, h) => {
    g.fillStyle = '#3a2a24'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = -1; x < 8; x++) { const v = Math.random() * 30; g.fillStyle = `rgb(${col[0] + v},${col[1] + v * .4},${col[2] + v * .3})`; g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14); }
  }),
  adobe: () => ctex('adobe', 256, 256, (g, w, h) => {
    g.fillStyle = '#c99a6a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '90,50,20' : '255,230,190'},.08)`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  }),
  stone: () => ctex('stone', 256, 256, (g, w, h) => {
    g.fillStyle = '#6a6a68'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) { const v = 70 + Math.random() * 50; g.fillStyle = `rgb(${v},${v},${v - 4})`; g.beginPath(); g.roundRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28, 6); g.fill(); }
  }),
  window: () => ctex('window', 64, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffd890'); gr.addColorStop(1, '#ff9a3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a1a10'; g.fillRect(w / 2 - 2, 0, 4, h); g.fillRect(0, h / 2 - 2, w, 4); g.strokeStyle = '#2a1a10'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  }),
};
export const mats = {};
export const M = (key, make) => mats[key] || (mats[key] = make());

// ---------------------------------------------------------------- Gebäude (jeweils: { group, colliders, lights, windows })
// Colliders: { x, z, hx, hz, rot, y0, y1 }  (OBB in Weltkoordinaten)
export function box(parent, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
function uvScale(geo, sx, sy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return geo; }

// Wände mit Türöffnung (vorne = +z), Dicke t
export function wallSet(g, w, d, h, t, mat, door = true, cols = null, ox = 0, oz = 0, rot = 0) {
  const parts = [];
  const add = (cx, cz, sx, sz, hh = h, y0 = 0) => {
    const m = new THREE.Mesh(uvScale(new THREE.BoxGeometry(sx, hh, sz), Math.max(sx, sz) / 3, hh / 3), mat); m.position.set(cx, y0 + hh / 2, cz); m.castShadow = m.receiveShadow = true; g.add(m); parts.push([cx, cz, sx, sz, y0, y0 + hh]);
  };
  add(0, -d / 2 + t / 2, w, t); add(-w / 2 + t / 2, 0, t, d); add(w / 2 - t / 2, 0, t, d);
  if (door) { const dw = 2.0, side = (w - dw) / 2; add(-w / 2 + side / 2, d / 2 - t / 2, side, t); add(w / 2 - side / 2, d / 2 - t / 2, side, t); add(0, d / 2 - t / 2, dw, t, h - 2.3, 2.3); }
  else add(0, d / 2 - t / 2, w, t);
  if (cols) {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const [cx, cz, sx, sz, y0, y1] of parts) {
      // lokale -> Welt (Rotation um Y, three: x' = x cos + z sin, z' = -x sin + z cos)
      const wx = ox + cx * c + cz * s, wz = oz - cx * s + cz * c;
      cols.push({ x: wx, z: wz, hx: sx / 2, hz: sz / 2, rot, y0, y1 });
    }
  }
}

export function windowsOn(g, w, d, h, n, litMat, y = null) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const fx = -w / 2 + (k + 0.5) * w / n;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), litMat); m.position.set(fx, y ?? Math.min(2.0, h * 0.5), d / 2 + 0.02); g.add(m); out.push(m);
    const m2 = m.clone(); m2.position.z = -d / 2 - 0.02; m2.rotation.y = Math.PI; g.add(m2);
  }
}

export function nordicHouse(rng, x, y, z, rot, opts = {}, env, out) {
  const w = opts.w || 8 + rng() * 5, d = opts.d || 6 + rng() * 3, h = opts.h || 3.2 + rng() * 1.2;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const wood = M('nwood', () => new THREE.MeshStandardMaterial({ map: tex.planks('#3c2a1c'), roughness: 0.95 }));
  const stone = M('nstone', () => new THREE.MeshStandardMaterial({ map: tex.stone(), roughness: 1 }));
  const roofMat = opts.turf ? M('turf', () => new THREE.MeshStandardMaterial({ map: textures.grass(), color: 0x6f8a4a, roughness: 1, side: THREE.DoubleSide })) : M('slate', () => new THREE.MeshStandardMaterial({ map: tex.slate(), roughness: 0.8, side: THREE.DoubleSide }));
  const win = M('win', () => { const m = new THREE.MeshStandardMaterial({ map: tex.window(), emissive: 0xffa040, emissiveMap: tex.window(), emissiveIntensity: 0.4, roughness: 0.6 }); env.registerLamp(m); m.userData.base = 0.35; return m; });
  const base = box(g, w + 0.4, 1.0, d + 0.4, stone, 0, 0.1, 0); base.geometry = uvScale(new THREE.BoxGeometry(w + 0.4, 1.4, d + 0.4), (w + d) / 4, 0.5); base.position.y = -0.3;
  if (opts.enter) wallSet(g, w, d, h, 0.3, wood, true, out.colliders, x, z, rot); else { box(g, w, h, d, new THREE.MeshStandardMaterial({ map: (() => { const t = tex.planks('#3c2a1c').clone(); t.repeat.set(w / 4, h / 3); t.needsUpdate = true; return t; })(), roughness: 0.95 }), 0, h / 2, 0); out.colliders.push({ x, z, hx: w / 2, hz: d / 2, rot, y0: 0, y1: h }); }
  const rh = Math.min(w, d) * 0.62;
  const roof = new THREE.Mesh(gableGeometry(w, d, rh), roofMat); roof.position.y = h; roof.castShadow = true; g.add(roof);
  // Drachenköpfe am Giebel
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.4, 5), wood); b.position.set(sx * (w / 2 + 0.4), h + rh + 0.2, 0); b.rotation.z = -sx * 0.5; g.add(b); }
  windowsOn(g, w, d, h, Math.max(2, Math.floor(w / 3.5)), win);
  const door = box(g, 1.7, 2.1, 0.1, wood, 0, 1.05, d / 2 + 0.04); door.material = new THREE.MeshStandardMaterial({ color: 0x24160d, roughness: 0.9 });
  // Schornstein
  box(g, 0.9, 2.4, 0.9, stone, w * 0.25, h + rh * 0.7, -d * 0.15);
  if (opts.enter) {
    const floor = box(g, w - 0.6, 0.12, d - 0.6, new THREE.MeshStandardMaterial({ map: tex.planks('#5a4028'), roughness: 1 }), 0, 0.06, 0); floor.castShadow = false;
    const fm = new THREE.MeshStandardMaterial({ map: tex.planks('#6a4a2a'), roughness: 1 });
    box(g, w * 0.5, 0.1, 1.1, fm, 0, 0.85, -d / 2 + 1.2); for (const sx of [-1, 1]) box(g, 0.12, 0.85, 0.9, fm, sx * w * 0.22, 0.45, -d / 2 + 1.2);
    box(g, 1.8, 0.1, 1.0, fm, -w * 0.25, 0.8, 0.5); box(g, 0.12, 0.8, 0.9, fm, -w * 0.25 - 0.8, 0.4, 0.5); box(g, 0.12, 0.8, 0.9, fm, -w * 0.25 + 0.8, 0.4, 0.5);
    for (let k = 0; k < 3; k++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 10), fm); bar.position.set(w / 2 - 1 - k * 0.9, 0.5, -d / 2 + 0.8); g.add(bar); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc070 })); lamp.position.set(0, h - 0.5, 0); g.add(lamp);
    out.lights.push({ x: x + 0, y: y + h - 0.5, z, color: 0xffb060, int: 7, range: 14, flicker: 0.15, inside: true });
    out.glow.push([x, y + h - 0.5, z, 1, 0.7, 0.35, 28]);
  }
  out.world.add(g); g.userData.windows = true;
  // Leuchtpunkte Fenster
  for (let k = 0; k < Math.max(2, Math.floor(w / 3.5)); k++) {
    const fx = -w / 2 + (k + 0.5) * w / Math.max(2, Math.floor(w / 3.5)), c = Math.cos(rot), s = Math.sin(rot);
    out.glow.push([x + fx * c + (d / 2 + 0.3) * s, y + 2, z - fx * s + (d / 2 + 0.3) * c, 1, 0.65, 0.3, 14]);
  }
  // Laterne an der Tür
  const lx = x + (1.4) * Math.cos(rot) + (d / 2 + 0.5) * Math.sin(rot), lz = z - 1.4 * Math.sin(rot) + (d / 2 + 0.5) * Math.cos(rot);
  out.lights.push({ x: lx, y: y + 2.4, z: lz, color: 0xff9a40, int: 4, range: 10, flicker: 0.3 });
  out.glow.push([lx, y + 2.4, lz, 1, 0.6, 0.25, 26]);
  return { w, d, h };
}

export function africanHut(rng, x, y, z, rot, opts, env, out) {
  const r = opts.r || 2.6 + rng() * 1.2, h = 2.4;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const wall = M('clay', () => new THREE.MeshStandardMaterial({ map: tex.adobe(), color: 0xd8b48a, roughness: 1 }));
  const thatch = M('thatch', () => new THREE.MeshStandardMaterial({ map: tex.thatch(), roughness: 1, side: THREE.DoubleSide }));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 14), wall); body.position.y = h / 2; body.castShadow = true; g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.55, h * 0.95, 14), thatch); roof.position.y = h + h * 0.4; roof.castShadow = true; g.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), new THREE.MeshStandardMaterial({ color: 0x1a0f08 })); door.position.set(0, 0.8, r + 0.01); g.add(door);
  const lamp = new THREE.MeshStandardMaterial({ color: 0x331a08, emissive: 0xff8a30, emissiveIntensity: 0 }); env.registerLamp(lamp);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), lamp); w.position.set(r * 0.7, 1.4, r * 0.7); w.lookAt(r * 2, 1.4, r * 2); g.add(w);
  out.world.add(g); out.colliders.push({ x, z, r: r + 0.3, y0: 0, y1: h });
  out.glow.push([x + Math.sin(rot) * r, y + 1.6, z + Math.cos(rot) * r, 1, 0.55, 0.2, 18]);
  out.lights.push({ x: x + Math.sin(rot) * (r + 1), y: y + 2, z: z + Math.cos(rot) * (r + 1), color: 0xff8a30, int: 3.5, range: 9, flicker: 0.35 });
}

export function lodge(rng, x, y, z, rot, env, out) { // begehbare Lodge auf Stelzen
  const w = 12, d = 8, h = 3.4, lift = 1.2;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const wood = M('lw', () => new THREE.MeshStandardMaterial({ map: tex.planks('#5a3a22'), roughness: 1 }));
  const thatch = M('thatch', () => new THREE.MeshStandardMaterial({ map: tex.thatch(), roughness: 1, side: THREE.DoubleSide }));
  const win = M('win', () => { const m = new THREE.MeshStandardMaterial({ map: tex.window(), emissive: 0xffa040, emissiveMap: tex.window(), emissiveIntensity: 0.4 }); env.registerLamp(m); return m; });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, lift + 1, 8), wood); p.position.set(sx * (w / 2 - 0.4), (lift - 1) / 2 + 0.2, sz * (d / 2 - 0.4)); g.add(p); }
  const deck = box(g, w + 4, 0.25, d + 3, wood, 0, lift, 1.2);
  const inner = new THREE.Group(); inner.position.y = lift + 0.12; g.add(inner);
  wallSet(inner, w, d, h, 0.3, wood, true, null);
  const rf = new THREE.Mesh(gableGeometry(w + 2, d + 2, 3.4), thatch); rf.position.y = lift + 0.12 + h; rf.castShadow = true; g.add(rf);
  const fl = box(inner, w - 0.6, 0.1, d - 0.6, new THREE.MeshStandardMaterial({ map: tex.planks('#7a5632'), roughness: 1 }), 0, 0.05, 0);
  windowsOn(inner, w, d, h, 3, win, 1.8);
  // Treppe
  for (let k = 0; k < 4; k++) box(g, 2.2, 0.2, 0.5, wood, 0, 0.3 * k + 0.1, d / 2 + 3.3 - k * 0.5);
  const tb = M('lwt', () => new THREE.MeshStandardMaterial({ map: tex.planks('#6a4a2a'), roughness: 1 }));
  box(inner, 3, 0.1, 1.2, tb, 0, 0.8, -d / 2 + 1.5); box(inner, 0.15, 0.8, 1.0, tb, -1.2, 0.4, -d / 2 + 1.5); box(inner, 0.15, 0.8, 1.0, tb, 1.2, 0.4, -d / 2 + 1.5);
  out.world.add(g);
  const cols = [];
  wallSet(new THREE.Group(), w, d, h, 0.3, wood, true, cols, x, z, rot);
  for (const c of cols) { c.y0 += lift; c.y1 += lift; out.colliders.push(c); }
  // Plattform: Deck begehbar
  out.platforms.push({ cx: x + Math.sin(rot) * 1.2, cz: z + Math.cos(rot) * 1.2, hx: (w + 4) / 2, hz: (d + 3) / 2, rot, yTop: y + lift + 0.12, flat: true });
  out.platforms.push({ cx: x + Math.sin(rot) * (d / 2 + 3.0), cz: z + Math.cos(rot) * (d / 2 + 3.0), hx: 1.1, hz: 1.0, rot, yTop: y + lift * 0.5, flat: true });
  out.lights.push({ x, y: y + lift + 3, z, color: 0xffa050, int: 8, range: 16, flicker: 0.2, inside: true });
  out.glow.push([x, y + lift + 3, z, 1, 0.65, 0.3, 30]);
}

export function industrial(rng, x, y, z, rot, env, out, opts = {}) {
  const w = opts.w || 18 + rng() * 12, d = opts.d || 12 + rng() * 8, h = 7 + rng() * 5;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const brickT = tex.brick(rng() < 0.5 ? [140, 60, 44] : [110, 90, 80]).clone(); brickT.repeat.set(w / 5, h / 5); brickT.needsUpdate = true;
  const brick = new THREE.MeshStandardMaterial({ map: brickT, roughness: 0.95 });
  const body = box(g, w, h, d, brick, 0, h / 2, 0);
  const metal = M('iron', () => new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.55, metalness: 0.7 }));
  // Sheddach
  const teeth = Math.floor(w / 6);
  for (let k = 0; k < teeth; k++) { const tri = new THREE.Mesh(gableGeometry(5.8, d + 0.6, 2.2), metal); tri.rotation.y = Math.PI / 2; tri.scale.set(1, 1, 1); tri.position.set(-w / 2 + (k + 0.5) * (w / teeth), h, 0); g.add(tri); }
  const win = M('iwin', () => { const m = new THREE.MeshStandardMaterial({ color: 0x221510, emissive: 0xff8a2a, emissiveIntensity: 0.3 }); env.registerLamp(m); return m; });
  for (let k = 0; k < Math.floor(w / 4); k++) for (const sz of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3), win); m.position.set(-w / 2 + 2 + k * 4, 3.4, sz * (d / 2 + 0.02)); if (sz < 0) m.rotation.y = Math.PI; g.add(m); out.glow.push([x + (m.position.x) * Math.cos(rot) + sz * (d / 2 + 0.5) * Math.sin(rot), y + 3.4, z - m.position.x * Math.sin(rot) + sz * (d / 2 + 0.5) * Math.cos(rot), 1, 0.5, 0.15, 22]); }
  // Schornstein
  const ch = 22 + rng() * 14, cx = w / 2 - 3;
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, ch, 12), new THREE.MeshStandardMaterial({ map: brickT, roughness: 1 })); chim.position.set(cx, ch / 2, -d / 2 + 2); chim.castShadow = true; g.add(chim);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.18, 6, 14), metal); ring.rotation.x = Math.PI / 2; ring.position.set(cx, ch, -d / 2 + 2); g.add(ring);
  // Rohre
  for (let k = 0; k < 2; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, w * 0.9, 8), metal); p.rotation.z = Math.PI / 2; p.position.set(0, h - 1 - k * 1.2, d / 2 + 0.7); g.add(p); }
  const door = box(g, 3.4, 4, 0.2, metal, 0, 2, d / 2 + 0.05);
  out.world.add(g); out.colliders.push({ x, z, hx: w / 2, hz: d / 2, rot, y0: 0, y1: h });
  const c = Math.cos(rot), s = Math.sin(rot);
  out.smoke.push({ x: x + cx * c + (-d / 2 + 2) * s, y: y + ch, z: z - cx * s + (-d / 2 + 2) * c, kind: 'smoke' });
  out.lights.push({ x: x + (d / 2 + 2) * s, y: y + 5, z: z + (d / 2 + 2) * c, color: 0xff9040, int: 6, range: 18, flicker: 0.1 });
  return { w, d, h };
}

export function adobe(rng, x, y, z, rot, env, out, opts = {}) {
  const w = opts.w || 7 + rng() * 5, d = opts.d || 6 + rng() * 3, h = 3 + rng() * 1.5;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const t = tex.adobe().clone(); t.repeat.set(w / 4, h / 3); t.needsUpdate = true;
  box(g, w, h, d, new THREE.MeshStandardMaterial({ map: t, color: [0xe6c090, 0xe0a070, 0xd8d0b0][Math.floor(rng() * 3)], roughness: 1 }), 0, h / 2, 0);
  box(g, w + 0.5, 0.35, d + 0.5, M('adb2', () => new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 1 })), 0, h + 0.15, 0);
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, d + 1.2, 6), M('beam', () => new THREE.MeshStandardMaterial({ color: 0x5a3a20 }))); b.rotation.x = Math.PI / 2; b.position.set(-w / 2 + 1 + k * (w - 2) / 3, h - 0.5, 0); g.add(b); }
  const win = M('awin', () => { const m = new THREE.MeshStandardMaterial({ color: 0x221510, emissive: 0xffa040, emissiveIntensity: 0.3 }); env.registerLamp(m); return m; });
  windowsOn(g, w, d, h, 2, win, 1.9);
  box(g, 1.5, 2.2, 0.1, M('adoor', () => new THREE.MeshStandardMaterial({ color: 0x3a6a7a })), 0, 1.1, d / 2 + 0.05);
  out.world.add(g); out.colliders.push({ x, z, hx: w / 2, hz: d / 2, rot, y0: 0, y1: h });
  const c = Math.cos(rot), s = Math.sin(rot);
  out.glow.push([x + (d / 2 + 0.5) * s, y + 2, z + (d / 2 + 0.5) * c, 1, 0.65, 0.3, 16]);
}

export function fairyHouse(rng, x, y, z, rot, env, out) {
  const w = 6 + rng() * 3, d = 6 + rng() * 2, h = 4 + rng() * 2;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const col = new THREE.Color().setHSL(rng(), 0.55, 0.62), roofC = new THREE.Color().setHSL(rng(), 0.6, 0.4);
  box(g, w, h, d, new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }), 0, h / 2, 0);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.9, 8), new THREE.MeshStandardMaterial({ color: roofC, roughness: 0.6 })); cone.position.y = h + h * 0.4; cone.castShadow = true; g.add(cone);
  const win = M('fwin', () => { const m = new THREE.MeshStandardMaterial({ color: 0x221510, emissive: 0xffd080, emissiveIntensity: 0.3 }); env.registerLamp(m); return m; });
  windowsOn(g, w, d, h, 2, win, 2.2);
  out.world.add(g); out.colliders.push({ x, z, hx: w / 2, hz: d / 2, rot, y0: 0, y1: h });
  const c = Math.cos(rot), s = Math.sin(rot);
  out.glow.push([x + (d / 2 + 0.5) * s, y + 2.4, z + (d / 2 + 0.5) * c, 1, 0.85, 0.5, 18]);
}

// ---------------------------------------------------------------- Wasserfall
export function waterfallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uTime, uNight; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float s = n(vec2(vUv.x*16., vUv.y*2.5 + uTime*2.6))*.6 + n(vec2(vUv.x*34., vUv.y*6. + uTime*4.2))*.4;
        float a = smoothstep(.22, .85, s) * (0.55 + 0.45*vUv.y);
        vec3 col = mix(vec3(.62,.8,.9), vec3(1.), s);
        vec3 glow = vec3(.15,.55,1.) * uNight * 2.0 + vec3(.1,.9,.8)*uNight*s*0.8;
        gl_FragColor = vec4(col*(1.-uNight*.7)+glow, clamp(a*.85+.12, 0., 1.));
      }`,
  });
}

// ---------------------------------------------------------------- Leuchtpunkte (additiv, Nacht)
export function glowPoints(list) {
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  list.forEach((p, i) => { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; col[i * 3] = p[3]; col[i * 3 + 1] = p[4]; col[i * 3 + 2] = p[5]; size[i] = p[6]; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uNight: { value: 0 }, uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aCol; attribute float aSize; uniform float uScale; varying vec3 vCol;
      void main(){ vCol = aCol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(aSize*0.1*uScale/ -mv.z, 2.0, 160.0); }`,
    fragmentShader: `uniform float uNight; varying vec3 vCol; void main(){ vec2 d = gl_PointCoord-.5; float r = length(d)*2.; float a = pow(max(0.,1.-r), 2.2); gl_FragColor = vec4(vCol*a*uNight*1.6, a*uNight); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
}
