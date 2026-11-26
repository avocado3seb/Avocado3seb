// Gelände für das Phantasialand: Höhenfeld mit Hügeln, Fluss, See, Vulkan, Bergring; Laufkollision
import * as THREE from 'three';
import { textures } from './textures.js';

export function hash2(i, j) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263); h = Math.imul(h ^ (h >> 13), 1274126177); return ((h ^ (h >> 16)) >>> 0) / 4294967296; }
export function noise2(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, s = t => t * t * (3 - 2 * t);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * s(fx) + (c - a) * s(fz) + (a - b - c + d) * s(fx) * s(fz);
}
export function fbm(x, z, o = 4) { let v = 0, a = 0.5; for (let k = 0; k < o; k++) { v += a * noise2(x, z); x *= 2.03; z *= 2.03; a *= 0.5; } return v; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Terrain {
  // size: Kantenlänge (m), step: Zellgröße; features: { zones, volcano, river, lake, flat(x,z)->0..1 }
  constructor(size, step, features) {
    this.size = size; this.step = step; this.n = Math.round(size / step); this.f = features;
    const n = this.n, N = n + 1;
    this.H = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -size / 2 + i * step, z = -size / 2 + j * step;
      this.H[j * N + i] = this.raw(x, z);
    }
  }
  raw(x, z) {
    const f = this.f, size = this.size;
    // sanfte Hügel
    let h = (fbm(x / 140, z / 140) - 0.5) * 7;
    // Zonen: Hub flach
    const r0 = Math.hypot(x, z - 40);
    h *= sstep(40, 130, r0);
    // Bergring am Rand
    const rr = Math.hypot(x, z);
    const edge = sstep(size * 0.36, size * 0.49, rr);
    h += edge * (30 + 70 * fbm(x / 90 + 7, z / 90 + 3)) ;
    // Klugheim: Felsmassiv + Vulkan
    const k = f.volcano;
    const dv = Math.hypot(x - k.x, z - k.z);
    h += Math.max(0, 1 - dv / k.r) ** 1.6 * k.h * (0.85 + 0.3 * fbm(x / 30, z / 30));
    if (dv < k.crater) h -= (1 - dv / k.crater) * 14 * (1 - sstep(0, k.crater, dv) * 0.2);
    const kz = f.zones.klugheim; const dk = Math.hypot(x - kz.x, z - kz.z);
    h += sstep(kz.r * 0.55, kz.r * 1.05, dk) * sstep(kz.r * 1.5, kz.r * 1.0, dk) * 22 * fbm(x / 36 + 11, z / 36);
    // Mexico: Mesas
    const mz = f.zones.mexico; const dm = Math.hypot(x - mz.x, z - mz.z);
    h += sstep(mz.r * 0.7, mz.r * 1.0, dm) * sstep(mz.r * 1.5, mz.r * 1.05, dm) * 16 * fbm(x / 45 + 2, z / 45 + 9);
    // Fluss (Klugheim)
    const rv = f.river;
    let dmin = 1e9;
    for (let i = 0; i < rv.length - 1; i++) {
      const ax = rv[i][0], az = rv[i][1], bx = rv[i + 1][0], bz = rv[i + 1][1], vx = bx - ax, vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      dmin = Math.min(dmin, Math.hypot(x - (ax + vx * t), z - (az + vz * t)));
    }
    this._lastRiver = dmin;
    h -= (1 - sstep(4, 11, dmin)) * 3.2;
    // See (Afrika)
    const L = f.lake, dl = Math.hypot((x - L.x) / L.rx, (z - L.z) / L.rz);
    h -= (1 - sstep(0.55, 1.05, dl)) * 3.4;
    // Flachstellen (Bahnen, Wege, Gebäude)
    if (f.flat) { const m = f.flat(x, z); if (m > 0) h *= (1 - m); }
    // Rand weich auf 0 im Außenbereich der Weltkarte
    return h;
  }
  at(x, z) {
    const N = this.n + 1, u = (x + this.size / 2) / this.step, v = (z + this.size / 2) / this.step;
    if (u < 0 || v < 0 || u >= this.n || v >= this.n) return 0;
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const H = this.H, a = H[j * N + i], b = H[j * N + i + 1], c = H[(j + 1) * N + i], d = H[(j + 1) * N + i + 1];
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
  }
  // Gelände unter einem Gebäude einebnen (OBB cx,cz,hx,hz,rot auf Höhe yT, weicher Übergang 'margin'); mesh danach mit refresh() aktualisieren
  flatten(cx, cz, hx, hz, rot, yT, margin = 5) {
    const n = this.n, N = n + 1, size = this.size, step = this.step, c = Math.cos(rot), s = Math.sin(rot), ext = Math.max(hx, hz) + margin + 1;
    const i0 = Math.max(0, Math.floor((cx - ext + size / 2) / step)), i1 = Math.min(n, Math.ceil((cx + ext + size / 2) / step)), j0 = Math.max(0, Math.floor((cz - ext + size / 2) / step)), j1 = Math.min(n, Math.ceil((cz + ext + size / 2) / step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = -size / 2 + i * step, z = -size / 2 + j * step, dx = x - cx, dz = z - cz, lx = dx * c - dz * s, lz = dx * s + dz * c, d = Math.max(Math.abs(lx) - hx, Math.abs(lz) - hz);
      if (d >= margin) continue; const k = j * N + i, t = d <= 0 ? 0 : sstep(0, margin, d); this.H[k] = yT * (1 - t) + this.H[k] * t;
    }
    this.dirty = true;
  }
  refresh(mesh) { // Höhenfeld → Geometrie
    if (!this.dirty) return; const N = this.n + 1, p = mesh.geometry.attributes.position; for (let k = 0; k < N * N; k++) p.setY(k, this.H[k]); p.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); this.dirty = false;
  }
  recolor(mesh, colorFn) {
    const n = this.n, N = n + 1, size = this.size, step = this.step, col = mesh.geometry.attributes.color;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = -size / 2 + i * step, z = -size / 2 + j * step, y = this.H[k];
      const hx = this.H[j * N + Math.min(n, i + 1)] - this.H[j * N + Math.max(0, i - 1)], hz = this.H[Math.min(n, j + 1) * N + i] - this.H[Math.max(0, j - 1) * N + i];
      const c = colorFn(x, z, y, Math.hypot(hx, hz) / (2 * step)); col.setXYZ(k, c[0], c[1], c[2]);
    }
    col.needsUpdate = true;
  }
  build(colorFn) {
    const n = this.n, N = n + 1, size = this.size, step = this.step;
    const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = -size / 2 + i * step, z = -size / 2 + j * step, y = this.H[k];
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      uv[k * 2] = x / 24; uv[k * 2 + 1] = z / 24;
      // Neigung
      const hx = this.H[j * N + Math.min(n, i + 1)] - this.H[j * N + Math.max(0, i - 1)], hz = this.H[Math.min(n, j + 1) * N + i] - this.H[Math.max(0, j - 1) * N + i];
      const slope = Math.hypot(hx, hz) / (2 * step);
      const c = colorFn(x, z, y, slope);
      col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
    }
    const idx = new Uint32Array(n * n * 6); let q = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const tex = textures.grass().clone(); tex.repeat.set(1, 1); tex.needsUpdate = true;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }));
    m.receiveShadow = true; return m;
  }
}
