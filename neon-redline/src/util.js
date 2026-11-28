/* NEON REDLINE – util.js : Mathe, Rauschen, Raster, Helfer */
(function (G) {
'use strict';
const U = {};
U.PI = Math.PI; U.TAU = Math.PI * 2; U.RAD = Math.PI / 180;
U.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
U.lerp = (a, b, t) => a + (b - a) * t;
U.sstep = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
U.sign = v => v < 0 ? -1 : 1;
U.mix = U.lerp;
U.wrapAngle = a => { while (a > Math.PI) a -= U.TAU; while (a < -Math.PI) a += U.TAU; return a; };
U.damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
U.mulberry = function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
U.hash2 = function (x, y) { let h = (x | 0) * 374761393 + (y | 0) * 668265263; h = (h ^ (h >>> 13)) * 1274126177; h = h ^ (h >>> 16); return ((h >>> 0) % 100000) / 100000; };
U.hashStr = function (s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---- Gradient-Rauschen 2D ---- */
const P = new Uint8Array(512);
(function () { const r = U.mulberry(1337); const p = []; for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255]; })();
const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
U.noise2 = function (x, y) {
  const X = Math.floor(x), Y = Math.floor(y); const xf = x - X, yf = y - Y; const xi = X & 255, yi = Y & 255;
  const aa = P[P[xi] + yi] & 7, ab = P[P[xi] + yi + 1] & 7, ba = P[P[xi + 1] + yi] & 7, bb = P[P[xi + 1] + yi + 1] & 7;
  const u = fade(xf), v = fade(yf);
  const n00 = GX[aa] * xf + GY[aa] * yf, n10 = GX[ba] * (xf - 1) + GY[ba] * yf;
  const n01 = GX[ab] * xf + GY[ab] * (yf - 1), n11 = GX[bb] * (xf - 1) + GY[bb] * (yf - 1);
  const a = n00 + u * (n10 - n00), b = n01 + u * (n11 - n01);
  return (a + v * (b - a)) * 1.1;
};
U.fbm = function (x, y, oct) { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * U.noise2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };
U.ridged = function (x, y, oct) { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { let v = 1 - Math.abs(U.noise2(x * f, y * f)); v *= v; s += a * v; n += a; a *= 0.5; f *= 2.1; } return s / n; };

/* ---- Raumraster ---- */
U.Grid = class {
  constructor(cell) { this.cell = cell; this.m = new Map(); }
  k(ix, iz) { return ix * 100003 + iz; }
  add(item, x0, z0, x1, z1) {
    const c = this.cell; const ix0 = Math.floor(Math.min(x0, x1) / c), ix1 = Math.floor(Math.max(x0, x1) / c);
    const iz0 = Math.floor(Math.min(z0, z1) / c), iz1 = Math.floor(Math.max(z0, z1) / c);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) { const k = this.k(ix, iz); let a = this.m.get(k); if (!a) { a = []; this.m.set(k, a); } a.push(item); }
  }
  at(x, z) { return this.m.get(this.k(Math.floor(x / this.cell), Math.floor(z / this.cell))); }
  cellList(ix, iz) { return this.m.get(this.k(ix, iz)); }
};

U.col = function (hex) { const c = new THREE.Color(hex); c.convertSRGBToLinear(); return c; };
U.colRGB = function (hex) { const c = U.col(hex); return [c.r, c.g, c.b]; };
U.pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
U.fmtTime = function (t) { if (!isFinite(t)) return '--:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
U.dist2 = (a, b, c, d) => Math.hypot(a - c, b - d);
/* Abstand Punkt-Strecke (2D); gibt t (0..1) zurück, dist in out */
U.segDist = function (px, pz, ax, az, bx, bz, out) {
  const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz; let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t; const cx = ax + dx * t, cz = az + dz * t; out.t = t; out.cx = cx; out.cz = cz; out.d = Math.hypot(px - cx, pz - cz); return out;
};

/* ---- Geometrie-Baukasten: sammelt Dreiecke mit Vertexfarben, flache Normalen ---- */
U.GeoBuilder = class {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; this.vc = 0; }
  _v(x, y, z, nx, ny, nz, r, g, b, u, v) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(r, g, b); this.u.push(u, v); return this.vc++; }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  /* Quad aus 4 Punkten (CCW von außen gesehen) */
  quad4(p0, p1, p2, p3, col, uv) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const uu = uv || [0, 0, 1, 0, 1, 1, 0, 1];
    const a = this._v(p0[0], p0[1], p0[2], nx, ny, nz, col[0], col[1], col[2], uu[0], uu[1]);
    const b = this._v(p1[0], p1[1], p1[2], nx, ny, nz, col[0], col[1], col[2], uu[2], uu[3]);
    const c = this._v(p2[0], p2[1], p2[2], nx, ny, nz, col[0], col[1], col[2], uu[4], uu[5]);
    const d = this._v(p3[0], p3[1], p3[2], nx, ny, nz, col[0], col[1], col[2], uu[6], uu[7]);
    this.quad(a, b, c, d);
  }
  /* Quader, optional um Y rotiert; uvMode: 'tile' (Fassade, Meter-basiert) | 'solid' */
  box(cx, cy, cz, sx, sy, sz, ry, col, opt) {
    opt = opt || {}; const hx = sx / 2, hz = sz / 2; const c = Math.cos(ry || 0), s = Math.sin(ry || 0);
    const T = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const y0 = opt.base ? 0 : -sy / 2, y1 = opt.base ? sy : sy / 2;
    const A = T(-hx, y0, hz), B = T(hx, y0, hz), C = T(hx, y1, hz), D = T(-hx, y1, hz);
    const E = T(-hx, y0, -hz), F = T(hx, y0, -hz), Gp = T(hx, y1, -hz), H = T(-hx, y1, -hz);
    const tile = opt.tile; const uo = opt.uo || 0, vo = opt.vo || 0;
    const sideUV = (w, h) => tile ? [uo, vo, uo + w / tile[0], vo, uo + w / tile[0], vo + h / tile[1], uo, vo + h / tile[1]] : null;
    const topUV = tile ? [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02] : null;
    const sh = opt.shade || [1, 1, 1, 1, 1, 1]; // front, back, right, left, top, bottom
    const m = (k) => [col[0] * sh[k], col[1] * sh[k], col[2] * sh[k]];
    this.quad4(A, B, C, D, m(0), sideUV(sx, sy)); this.quad4(F, E, H, Gp, m(1), sideUV(sx, sy));
    this.quad4(B, F, Gp, C, m(2), sideUV(sz, sy)); this.quad4(E, A, D, H, m(3), sideUV(sz, sy));
    this.quad4(D, C, Gp, H, m(4), topUV);
    if (!opt.noBottom) this.quad4(E, F, B, A, m(5), topUV);
  }
  /* Zylinder/Kegel (y aufwärts) */
  cyl(cx, cy, cz, rBot, rTop, h, seg, col, opt) {
    opt = opt || {}; seg = seg || 8; const y0 = opt.base ? cy : cy - h / 2, y1 = y0 + h; const sm = opt.smooth !== false;
    const rows = [];
    for (let k = 0; k < seg; k++) {
      const a0 = k / seg * U.TAU, a1 = (k + 1) / seg * U.TAU; const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const slope = (rBot - rTop) / h; const m0 = [c0, slope, s0], m1 = [c1, slope, s1]; const n = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
      let n0 = n(m0), n1 = n(m1); if (!sm) { const am = (a0 + a1) / 2; n0 = n1 = n([Math.cos(am), slope, Math.sin(am)]); }
      const tc = opt.tile ? opt.tile : null; const u0 = tc ? k / seg * (U.TAU * rBot / tc[0]) : 0.02, u1 = tc ? (k + 1) / seg * (U.TAU * rBot / tc[0]) : 0.02; const vv = tc ? h / tc[1] : 0.02;
      const a = this._v(cx + c0 * rBot, y0, cz + s0 * rBot, n0[0], n0[1], n0[2], col[0], col[1], col[2], u0, tc ? 0 : 0.02);
      const b = this._v(cx + c1 * rBot, y0, cz + s1 * rBot, n1[0], n1[1], n1[2], col[0], col[1], col[2], u1, tc ? 0 : 0.02);
      const c = this._v(cx + c1 * rTop, y1, cz + s1 * rTop, n1[0], n1[1], n1[2], col[0], col[1], col[2], u1, tc ? vv : 0.02);
      const d = this._v(cx + c0 * rTop, y1, cz + s0 * rTop, n0[0], n0[1], n0[2], col[0], col[1], col[2], u0, tc ? vv : 0.02);
      this.quad(b, a, d, c);
    }
    if (rTop > 0.01 && opt.cap !== false) { const cv = this._v(cx, y1, cz, 0, 1, 0, col[0], col[1], col[2], 0.02, 0.02); let first = -1, prev = -1;
      for (let k = 0; k <= seg; k++) { const a = k / seg * U.TAU; const v = this._v(cx + Math.cos(a) * rTop, y1, cz + Math.sin(a) * rTop, 0, 1, 0, col[0], col[1], col[2], 0.02, 0.02); if (prev >= 0) this.tri(cv, v, prev); prev = v; } }
  }
  /* Satteldach / Prisma: Grundfläche sx*sz, Firsthöhe h, First entlang Z */
  gable(cx, cy, cz, sx, sz, h, ry, col, col2) {
    const hx = sx / 2, hz = sz / 2; const c = Math.cos(ry || 0), s = Math.sin(ry || 0); const T = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const A = T(-hx, 0, hz), B = T(hx, 0, hz), C = T(0, h, hz), E = T(-hx, 0, -hz), F = T(hx, 0, -hz), Gp = T(0, h, -hz);
    this.quad4(B, F, Gp, C, col, [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02]); this.quad4(E, A, C, Gp, col2 || col, [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02]);
    const nm = (a, b, d) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2]; const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l]; };
    let n = nm(A, B, C); let a = this._v(...A, ...n, ...col, 0.02, 0.02), b = this._v(...B, ...n, ...col, 0.02, 0.02), d = this._v(...C, ...n, ...col, 0.02, 0.02); this.tri(a, b, d);
    n = nm(F, E, Gp); a = this._v(...F, ...n, ...col, 0.02, 0.02); b = this._v(...E, ...n, ...col, 0.02, 0.02); d = this._v(...Gp, ...n, ...col, 0.02, 0.02); this.tri(a, b, d);
  }
  /* Stab von a nach b mit quadratischem Querschnitt */
  beam(ax, ay, az, bx, by, bz, w, h, col) {
    const dx = bx - ax, dy = by - ay, dz = bz - az; const L = Math.hypot(dx, dy, dz) || 1; const f = [dx / L, dy / L, dz / L];
    let up = Math.abs(f[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    let r = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]]; let rl = Math.hypot(...r) || 1; r = [r[0] / rl, r[1] / rl, r[2] / rl];
    let u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const P = (p, sr, su) => [p[0] + r[0] * sr * w / 2 + u[0] * su * h / 2, p[1] + r[1] * sr * w / 2 + u[1] * su * h / 2, p[2] + r[2] * sr * w / 2 + u[2] * su * h / 2];
    const a = [ax, ay, az], b = [bx, by, bz]; const uv = [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02];
    this.quad4(P(a, 1, 1), P(b, 1, 1), P(b, -1, 1), P(a, -1, 1), col, uv); this.quad4(P(a, -1, -1), P(b, -1, -1), P(b, 1, -1), P(a, 1, -1), col, uv);
    this.quad4(P(a, 1, -1), P(b, 1, -1), P(b, 1, 1), P(a, 1, 1), col, uv); this.quad4(P(a, -1, 1), P(b, -1, 1), P(b, -1, -1), P(a, -1, -1), col, uv);
  }
  isEmpty() { return this.vc === 0; }
  build() {
    if (this.vc === 0) return null; const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.vc > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
};

/* Canvas-Helfer */
U.canvas = function (w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

G.U = U;
})(window.G = window.G || {});
