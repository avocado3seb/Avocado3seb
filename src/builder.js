// Geometrie-Builder: sammelt Dreiecke (Position, Normale, UV, Farbe) und erzeugt daraus eine BufferGeometry.
import * as THREE from 'three';
import { ATLAS_N } from './textures.js';

const _c = new THREE.Color();
export function colorOf(c) {
  if (Array.isArray(c)) return c;
  _c.set(c);
  return [_c.r, _c.g, _c.b];
}

export class MB {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  vert(x, y, z, nx, ny, nz, u, v, c) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v); this.col.push(c[0], c[1], c[2]);
    return this.pos.length / 3 - 1;
  }
  // Allgemeines Viereck (CCW von außen gesehen)
  quad(a, b, c, d, col = [1, 1, 1], uvs = null, uvScale = 4) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let t;
    if (uvs) t = uvs;
    else {
      const w = Math.hypot(ux, uy, uz) / uvScale, h = Math.hypot(vx, vy, vz) / uvScale;
      t = [0, 0, w, 0, w, h, 0, h];
    }
    const i0 = this.vert(a[0], a[1], a[2], nx, ny, nz, t[0], t[1], col);
    const i1 = this.vert(b[0], b[1], b[2], nx, ny, nz, t[2], t[3], col);
    const i2 = this.vert(c[0], c[1], c[2], nx, ny, nz, t[4], t[5], col);
    const i3 = this.vert(d[0], d[1], d[2], nx, ny, nz, t[6], t[7], col);
    this.idx.push(i0, i1, i2, i0, i2, i3);
  }
  // Viereck, dessen Normale vom Referenzpunkt weg zeigt
  quadO(a, b, c, d, col, ref, uvs = null) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + c[0] + d[0]) / 4 - ref[0], my = (a[1] + b[1] + c[1] + d[1]) / 4 - ref[1], mz = (a[2] + b[2] + c[2] + d[2]) / 4 - ref[2];
    if (nx * mx + ny * my + nz * mz >= 0) this.quad(a, b, c, d, col, uvs); else this.quad(d, c, b, a, col, uvs && [uvs[6], uvs[7], uvs[4], uvs[5], uvs[2], uvs[3], uvs[0], uvs[1]]);
  }
  triO(a, b, c, col, ref) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + c[0]) / 3 - ref[0], my = (a[1] + b[1] + c[1]) / 3 - ref[1], mz = (a[2] + b[2] + c[2]) / 3 - ref[2];
    if (nx * mx + ny * my + nz * mz >= 0) this.tri(a, b, c, col); else this.tri(a, c, b, col);
  }
  tri(a, b, c, col = [1, 1, 1], uvs = [0, 0, 1, 0, 0.5, 1]) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const i0 = this.vert(a[0], a[1], a[2], nx, ny, nz, uvs[0], uvs[1], col);
    const i1 = this.vert(b[0], b[1], b[2], nx, ny, nz, uvs[2], uvs[3], col);
    const i2 = this.vert(c[0], c[1], c[2], nx, ny, nz, uvs[4], uvs[5], col);
    this.idx.push(i0, i1, i2);
  }
  /**
   * Quader. (x,y0,z) = Mitte der Grundfläche, Größe w (x), h (y), d (z).
   * o: {rot, col, fac:{cw,ch,ou,ov}, uvs (Meter pro Kachel), top, bottom, colTop}
   */
  box(x, y0, z, w, h, d, o = {}) {
    const rot = o.rot || 0, col = colorOf(o.col ?? 0xffffff), colTop = o.colTop ? colorOf(o.colTop) : col;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const hw = w / 2, hd = d / 2, y1 = y0 + h;
    const P = (lx, ly, lz) => [x + lx * cs + lz * sn, ly, z - lx * sn + lz * cs];
    const c = [P(-hw, y0, -hd), P(hw, y0, -hd), P(hw, y0, hd), P(-hw, y0, hd), P(-hw, y1, -hd), P(hw, y1, -hd), P(hw, y1, hd), P(-hw, y1, hd)];
    const us = o.uvs || 4;
    const fac = o.fac;
    const sideUV = (len) => {
      if (fac) {
        const u0 = fac.ou || 0, v0 = fac.ov || 0;
        const u1 = u0 + len / fac.cw, v1 = v0 + h / fac.ch;
        const s = 1 / ATLAS_N;
        return [u0 * s, v0 * s, u1 * s, v0 * s, u1 * s, v1 * s, u0 * s, v1 * s];
      }
      const uu = len / us, vv = h / us;
      return [0, 0, uu, 0, uu, vv, 0, vv];
    };
    // Seiten (CCW von außen)
    // -Z Seite (hinten): von +x nach -x gesehen
    if (o.sides !== false) {
      this.quad(c[1], c[0], c[4], c[5], col, flipV(sideUV(w)));
      this.quad(c[3], c[2], c[6], c[7], col, flipV(sideUV(w)));
      this.quad(c[0], c[3], c[7], c[4], col, flipV(sideUV(d)));
      this.quad(c[2], c[1], c[5], c[6], col, flipV(sideUV(d)));
    }
    if (o.top !== false) {
      const t = o.topUV || [0, 0, w / us, 0, w / us, d / us, 0, d / us];
      this.quad(c[7], c[6], c[5], c[4], colTop, [t[6], t[7], t[4], t[5], t[2], t[3], t[0], t[1]]);
    }
    if (o.bottom) this.quad(c[0], c[1], c[2], c[3], col);
  }
  // Satteldach: Firstrichtung entlang x (axis 'x') oder z
  gable(x, y0, z, w, d, h, axis = 'x', col = [1, 1, 1], us = 4, overhang = 0.4) {
    col = colorOf(col);
    const hw = w / 2 + overhang, hd = d / 2 + overhang, y1 = y0 + h;
    if (axis === 'x') {
      const A = [x - hw, y0, z - hd], B = [x + hw, y0, z - hd], C = [x + hw, y0, z + hd], D = [x - hw, y0, z + hd];
      const R1 = [x - hw, y1, z], R2 = [x + hw, y1, z];
      this.quad(B, A, R1, R2, col, [0, 0, hw * 2 / us, 0, hw * 2 / us, hd / us * 1.2, 0, hd / us * 1.2]);
      this.quad(D, C, R2, R1, col, [0, 0, hw * 2 / us, 0, hw * 2 / us, hd / us * 1.2, 0, hd / us * 1.2]);
      this.tri(A, D, R1, col, [0, 0, 1, 0, 0.5, 1]);
      this.tri(C, B, R2, col, [0, 0, 1, 0, 0.5, 1]);
    } else {
      const A = [x - hw, y0, z - hd], B = [x + hw, y0, z - hd], C = [x + hw, y0, z + hd], D = [x - hw, y0, z + hd];
      const R1 = [x, y1, z - hd], R2 = [x, y1, z + hd];
      this.quad(A, D, R2, R1, col, [0, 0, hd * 2 / us, 0, hd * 2 / us, hw / us * 1.2, 0, hw / us * 1.2]);
      this.quad(C, B, R1, R2, col, [0, 0, hd * 2 / us, 0, hd * 2 / us, hw / us * 1.2, 0, hw / us * 1.2]);
      this.tri(B, A, R1, col, [0, 0, 1, 0, 0.5, 1]);
      this.tri(D, C, R2, col, [0, 0, 1, 0, 0.5, 1]);
    }
  }
  // Zylinder / Kegelstumpf
  cyl(x, y0, z, r, h, seg = 10, col = 0xffffff, o = {}) {
    col = colorOf(col);
    const r2 = o.r2 ?? r, cap = o.cap !== false, us = o.uvs || 4;
    const base = this.count;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
      const slope = (r - r2) / h; const nl = Math.hypot(1, slope);
      this.vert(x + cs * r, y0, z + sn * r, cs / nl, slope / nl, sn / nl, (i / seg) * (Math.PI * 2 * r / us), 0, col);
      this.vert(x + cs * r2, y0 + h, z + sn * r2, cs / nl, slope / nl, sn / nl, (i / seg) * (Math.PI * 2 * r / us), h / us, col);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    if (cap && r2 > 0.001) {
      const c0 = this.vert(x, y0 + h, z, 0, 1, 0, 0.5, 0.5, col);
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const v1 = this.vert(x + Math.cos(a0) * r2, y0 + h, z + Math.sin(a0) * r2, 0, 1, 0, 0.5 + Math.cos(a0) * 0.5, 0.5 + Math.sin(a0) * 0.5, col);
        const v2 = this.vert(x + Math.cos(a1) * r2, y0 + h, z + Math.sin(a1) * r2, 0, 1, 0, 0.5 + Math.cos(a1) * 0.5, 0.5 + Math.sin(a1) * 0.5, col);
        this.idx.push(c0, v2, v1);
      }
    }
  }
  // Ellipsoid (Baumkronen, Büsche, Kuppeln)
  blob(x, y, z, rx, ry, rz, col = 0xffffff, seg = 7, rings = 5, jitter = 0, seed = 1) {
    col = colorOf(col);
    const base = this.count;
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let j = 0; j <= rings; j++) {
      const v = j / rings, phi = v * Math.PI;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg, th = u * Math.PI * 2;
        const j2 = 1 + (jitter ? (rnd() - 0.5) * jitter : 0);
        const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        const cl = 0.78 + 0.22 * (ny * 0.5 + 0.5);
        this.vert(x + nx * rx * j2, y + ny * ry * j2, z + nz * rz * j2, nx, ny, nz, u, v, [col[0] * cl, col[1] * cl, col[2] * cl]);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = base + j * (seg + 1) + i, b = a + seg + 1;
      this.idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  // flache Bodenfläche (nach oben zeigend), Welt-UV
  ground(x0, z0, x1, z1, y, col = [1, 1, 1], us = 8) {
    col = colorOf(col);
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], col, [x0 / us, -z1 / us, x1 / us, -z1 / us, x1 / us, -z0 / us, x0 / us, -z0 / us]);
  }
  // Band entlang einer Strecke mit Breite (nach oben)
  strip(x0, z0, x1, z1, width, y0, y1 = y0, col = [1, 1, 1], uv = null) {
    col = colorOf(col);
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len * width / 2, nz = dx / len * width / 2;
    const a = [x0 - nx, y0, z0 - nz], b = [x0 + nx, y0, z0 + nz], c = [x1 + nx, y1, z1 + nz], d = [x1 - nx, y1, z1 - nz];
    const l = len / 8, w = width / 8;
    // Normale soll nach oben zeigen: Reihenfolge so wählen
    const up = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
    if (up < 0) this.quad(a, d, c, b, col, uv || [0, 0, l, 0, l, w, 0, w]);
    else this.quad(a, b, c, d, col, uv || [0, 0, w, 0, w, l, 0, l]);
  }
  // Geometrie (mit Transformation) einer anderen Quelle anhängen
  append(geo, m, col = null) {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    const base = this.count;
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      nn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      const c = col || [1, 1, 1];
      this.vert(v.x, v.y, v.z, nn.x, nn.y, nn.z, uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0, c);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
function flipV(t) { return t; }

// Gruppe von MBs nach Material-Schlüssel
export class MBSet {
  constructor() { this.m = new Map(); }
  get(key) { let b = this.m.get(key); if (!b) { b = new MB(); this.m.set(key, b); } return b; }
}
