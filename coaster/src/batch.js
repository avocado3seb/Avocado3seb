// Geometrie-Sammler: viele Boxen/Rohre/Sweeps -> ein BufferGeometry (mit Vertexfarben)
import * as THREE from 'three';

export class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.n = 0; }

  _quad(p0, p1, p2, p3, nx, ny, nz, c) {
    const b = this.n;
    for (const p of [p0, p1, p2, p3]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); this.col.push(c[0], c[1], c[2]); }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3); this.n += 4;
  }

  // achsparallele Box (lokale Koordinaten)
  box(cx, cy, cz, sx, sy, sz, color) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const c = color;
    this._quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, c);
    this._quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, c);
    this._quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, c);
    this._quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, c);
    this._quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, c);
    this._quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, c);
  }

  // orientierte Box: Mittelpunkt c, Achsen ax, ay, az (Einheitsvektoren), Größen sx, sy, sz
  obox(c, ax, ay, az, sx, sy, sz, color) {
    const P = (a, b, d) => [
      c[0] + ax[0] * a * sx / 2 + ay[0] * b * sy / 2 + az[0] * d * sz / 2,
      c[1] + ax[1] * a * sx / 2 + ay[1] * b * sy / 2 + az[1] * d * sz / 2,
      c[2] + ax[2] * a * sx / 2 + ay[2] * b * sy / 2 + az[2] * d * sz / 2];
    this._quad(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), ax[0], ax[1], ax[2], color);
    this._quad(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), -ax[0], -ax[1], -ax[2], color);
    this._quad(P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), ay[0], ay[1], ay[2], color);
    this._quad(P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), -ay[0], -ay[1], -ay[2], color);
    this._quad(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), az[0], az[1], az[2], color);
    this._quad(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), -az[0], -az[1], -az[2], color);
  }

  // Rohr/Balken zwischen zwei Punkten (Kreis oder Rechteck-Querschnitt)
  tube(a, b, r, color, sides = 6) {
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz); if (L < 1e-4) return;
    dx /= L; dy /= L; dz /= L;
    // beliebige Senkrechte
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(dy) > 0.95) { ux = 1; uy = 0; }
    let sx = dy * uz - dz * uy, sy = dz * ux - dx * uz, sz = dx * uy - dy * ux;
    const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl;
    const tx = sy * dz - sz * dy, ty = sz * dx - sx * dz, tz = sx * dy - sy * dx;
    const base = this.n;
    for (let i = 0; i < sides; i++) {
      const ang = (i / sides) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const nx = sx * ca + tx * sa, ny = sy * ca + ty * sa, nz = sz * ca + tz * sa;
      for (const p of [a, b]) { this.pos.push(p[0] + nx * r, p[1] + ny * r, p[2] + nz * r); this.nor.push(nx, ny, nz); this.col.push(color[0], color[1], color[2]); }
    }
    this.n += sides * 2;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a0 = base + i * 2, a1 = base + i * 2 + 1, b0 = base + j * 2, b1 = base + j * 2 + 1;
      this.idx.push(a0, b0, b1, a0, b1, a1);
    }
  }

  // Querschnitt entlang der Strecke ziehen. verts: [[r,u,nr,nu],...] segs: [[i,j],...]
  // frames: Funktion(i) -> {p:[x,y,z], r:[..], u:[..]}; count: Anzahl Samples; closed: Schleife schließen
  sweep(count, frameFn, verts, segs, color, stride = 1, closed = true) {
    const rings = [];
    for (let k = 0; k < count; k += stride) rings.push(frameFn(k));
    if (closed && count % stride !== 0) { /* Rest ignorieren */ }
    const nV = verts.length, base = this.n;
    for (const f of rings) {
      for (const v of verts) {
        this.pos.push(f.p[0] + f.r[0] * v[0] + f.u[0] * v[1], f.p[1] + f.r[1] * v[0] + f.u[1] * v[1], f.p[2] + f.r[2] * v[0] + f.u[2] * v[1]);
        this.nor.push(f.r[0] * v[2] + f.u[0] * v[3], f.r[1] * v[2] + f.u[1] * v[3], f.r[2] * v[2] + f.u[2] * v[3]);
        this.col.push(color[0], color[1], color[2]);
      }
    }
    this.n += rings.length * nV;
    const R = rings.length;
    const last = closed ? R : R - 1;
    for (let k = 0; k < last; k++) {
      const k2 = (k + 1) % R;
      for (const [i, j] of segs) {
        const a = base + k * nV + i, b = base + k * nV + j, c = base + k2 * nV + j, d = base + k2 * nV + i;
        this.idx.push(a, d, c, a, c, b);
      }
    }
  }

  // beliebige Geometrie (mit Vertexfarben) mit Matrix einfügen – z. B. Vice-City-Figuren
  addGeometry(geo, m) {
    const p = geo.attributes.position, nr = geo.attributes.normal, c = geo.attributes.color, e = m.elements, b = this.n;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      this.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      const nx = nr.getX(i), ny = nr.getY(i), nz = nr.getZ(i); let tx = e[0] * nx + e[4] * ny + e[8] * nz, ty = e[1] * nx + e[5] * ny + e[9] * nz, tz = e[2] * nx + e[6] * ny + e[10] * nz; const l = Math.hypot(tx, ty, tz) || 1;
      this.nor.push(tx / l, ty / l, tz / l); if (c) this.col.push(c.getX(i), c.getY(i), c.getZ(i)); else this.col.push(1, 1, 1);
    }
    const ix = geo.index; if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(ix.getX(i) + b); else for (let i = 0; i < p.count; i++) this.idx.push(i + b);
    this.n += p.count;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  get empty() { return this.n === 0; }
}

export function hex(c) {
  const col = new THREE.Color(c);
  return [col.r, col.g, col.b];
}
export function shade(c, k) { return [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)]; }

// Kreis-Querschnitt für sweep()
export function circleSection(r, sides = 7) {
  const verts = [], segs = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    verts.push([c * r, s * r, c, s]); segs.push([i, (i + 1) % sides]);
  }
  return { verts, segs };
}
// Rechteck-Querschnitt (flachschattiert) – w = Breite (r-Richtung), h = Höhe (u-Richtung)
export function rectSection(w, h, ox = 0, oy = 0) {
  const x0 = ox - w / 2, x1 = ox + w / 2, y0 = oy - h / 2, y1 = oy + h / 2;
  const verts = [
    [x0, y1, 0, 1], [x1, y1, 0, 1], // oben
    [x1, y1, 1, 0], [x1, y0, 1, 0], // rechts
    [x1, y0, 0, -1], [x0, y0, 0, -1], // unten
    [x0, y0, -1, 0], [x0, y1, -1, 0], // links
  ];
  return { verts, segs: [[0, 1], [2, 3], [4, 5], [6, 7]] };
}
