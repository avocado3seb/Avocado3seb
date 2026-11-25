// Stadtgenerator: Straßen, Blöcke, Gebäude, Props
import * as THREE from 'three';
import { RNG, hash2, clamp, lerp, smoothstep, strHash } from './util.js';
import { colorOf } from './builder.js';
import { terrainH, SpatialHash } from './world.js';
import { HALF, SEA, PITCH, RECTS, ROAD_W, inRect, ISLANDS } from './consts.js';
import { SPECIALS, KIOSKS, PROPERTIES } from './data.js';
import { makeSignTexture } from './textures.js';
import { Landmarks } from './landmarks.js';

const GLASS_T = [0xcfe3f2, 0xb4d6c8, 0xe6d2b0, 0xffffff, 0xc2cde8, 0xd8e8e0];
const OFFICE_T = [0xf0ece2, 0xe2dccd, 0xd6d3ca, 0xf5efe0, 0xcfd3d6];
const DECO_T = [0xffb3c7, 0x9ee6df, 0xfff1a8, 0xffffff, 0xffc9a3, 0xc3b3ff, 0x9fe0ff, 0xb4f0b8];
const BRICK_T = [0xffffff, 0xf2d6c4, 0xe6b8a0, 0xd8cfc8];
const HOUSE_T = [0xf5efe0, 0xe8d9b8, 0xf2c9a0, 0xd8e4e8, 0xe9d1d1, 0xcfe3c6, 0xffffff];
const ROOF_T = [0xb5523a, 0xa14530, 0x7a4a3a, 0x5a5a60, 0x8a6a50];
const NEON = [0xff2bd6, 0x00e5ff, 0xffea00, 0xff5252, 0x76ff03, 0xb388ff];

export const hwV = (i) => (i % 4 === 0 ? 11 : i === 11 ? 8 : 7);
export const hwH = (j) => (j % 4 === 0 ? 11 : 7);

export class CityGen {
  constructor(W, G) {
    this.W = W; this.G = G;
    this.rng = new RNG(20240601);
    W.lampHash = new SpatialHash(50);
    W.displaySpots = [];
    W.signCache = new Map();
    this.lm = new Landmarks(this);
  }
  mb(x, z, k) { return this.W.mb(x, z, k); }

  // ================= STRAßEN =================
  roadY(x, z, px, pz, hw) { return Math.max(terrainH(x, z), terrainH(x + px * hw, z + pz * hw), terrainH(x - px * hw, z - pz * hw)); }
  ribbon(mb, x0, z0, x1, z1, width, yoff, col, uvs = 8, off = 0, wlim = null) {
    const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.1) return;
    const n = Math.max(1, Math.ceil(len / 8));
    const dx = (x1 - x0) / len, dz = (z1 - z0) / len, px = -dz, pz = dx, hw = width / 2;
    const rw = wlim ?? 8;
    let prev = null; col = colorOf(col);
    for (let k = 0; k <= n; k++) {
      const t = k / n, cx = x0 + (x1 - x0) * t + px * off, cz = z0 + (z1 - z0) * t + pz * off;
      const y = this.roadY(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, px, pz, rw) + yoff;
      const cur = { L: [cx + px * hw, y, cz + pz * hw], R: [cx - px * hw, y, cz - pz * hw], v: (len * t) / uvs };
      if (prev) mb.quad(prev.R, prev.L, cur.L, cur.R, col, [0, prev.v, width / uvs, prev.v, width / uvs, cur.v, 0, cur.v]);
      prev = cur;
    }
  }
  dashLine(mb, x0, z0, x1, z1, off, lw, dash, gap, col, flat, yb = 0.05) {
    const len = Math.hypot(x1 - x0, z1 - z0); const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
    const px = -dz, pz = dx;
    for (let s = 1; s + dash < len - 1; s += dash + gap) {
      const ax = x0 + dx * s + px * off, az = z0 + dz * s + pz * off, bx = x0 + dx * (s + dash) + px * off, bz = z0 + dz * (s + dash) + pz * off;
      if (flat) mb.strip(ax, az, bx, bz, lw, yb, yb, col);
      else this.ribbon(mb, ax, az, bx, bz, lw, 0.14, col, 8, 0, 8);
    }
  }
  roads() {
    const W = this.W;
    const Y = [1, 0.85, 0.2], WH = [0.93, 0.93, 0.9];
    for (const e of W.edges) {
      const A = e.a, B = e.b;
      let x0, z0, x1, z1;
      if (e.horiz) { x0 = A.x + A.hwV; x1 = B.x - B.hwV; z0 = z1 = A.z; } else { z0 = A.z + A.hwH; z1 = B.z - B.hwH; x0 = x1 = A.x; }
      const flat = A.city && B.city && e.kind !== 'highway';
      const mid = [(x0 + x1) / 2, (z0 + z1) / 2];
      const am = W.mb(mid[0], mid[1], 'asphalt'), mk = W.mb(mid[0], mid[1], 'marking');
      if (flat) {
        am.strip(x0, z0, x1, z1, e.w, 0.04, 0.04, [1, 1, 1]);
        if (e.kind === 'avenue') {
          this.dashLine(mk, x0, z0, x1, z1, 0.22, 0.14, 100, 0, Y, true); this.dashLine(mk, x0, z0, x1, z1, -0.22, 0.14, 100, 0, Y, true);
          this.dashLine(mk, x0, z0, x1, z1, 5.5, 0.14, 3, 6, WH, true); this.dashLine(mk, x0, z0, x1, z1, -5.5, 0.14, 3, 6, WH, true);
        } else if (e.kind === 'street') this.dashLine(mk, x0, z0, x1, z1, 0, 0.14, 3, 6, Y, true);
        else this.dashLine(mk, x0, z0, x1, z1, 0, 0.12, 2, 8, WH, true);
      } else {
        this.ribbon(am, x0, z0, x1, z1, e.w, 0.08, [1, 1, 1]);
        const mk2 = mk;
        this.dashLine(mk2, x0, z0, x1, z1, 0, 0.16, 4, 8, WH, false);
        this.ribbon(mk2, x0, z0, x1, z1, 0.14, 0.14, WH, 8, e.w / 2 - 0.5);
        this.ribbon(mk2, x0, z0, x1, z1, 0.14, 0.14, WH, 8, -(e.w / 2 - 0.5));
      }
    }
    // Kreuzungen
    for (const n of W.nodeList) {
      if (n.hwH > 0 && n.hwV > 0) {
        const am = W.mb(n.x, n.z, 'asphalt');
        if (n.city) am.strip(n.x - n.hwV, n.z, n.x + n.hwV, n.z, n.hwH * 2, 0.04, 0.04, [1, 1, 1]);
        else {
          const y = this.roadY(n.x, n.z, 1, 0, Math.max(n.hwH, n.hwV)) + 0.08;
          am.quad([n.x - n.hwV, y, n.z + n.hwH], [n.x + n.hwV, y, n.z + n.hwH], [n.x + n.hwV, y, n.z - n.hwH], [n.x - n.hwV, y, n.z - n.hwH], [1, 1, 1], [0, 0, 1, 0, 1, 1, 0, 1]);
        }
      }
      // Zebrastreifen
      if (n.signal) {
        const mk = W.mb(n.x, n.z, 'marking');
        for (const o of n.out) {
          const hwc = o.edge.horiz ? n.hwV : n.hwH, w = o.edge.w;
          const s0 = hwc + 1.2;
          const px = -o.dz, pz = o.dx;
          for (let a = -w / 2 + 1.0; a < w / 2 - 0.6; a += 1.4) {
            mk.strip(n.x + o.dx * s0 + px * a, n.z + o.dz * s0 + pz * a, n.x + o.dx * (s0 + 3) + px * a, n.z + o.dz * (s0 + 3) + pz * a, 0.65, 0.05, 0.05, WH);
          }
          const s1 = s0 + 4.6;
          mk.strip(n.x + o.dx * s1 - px * w * 0.25, n.z + o.dz * s1 - pz * w * 0.25, n.x + o.dx * s1 - px * 0.1, n.z + o.dz * s1 - pz * 0.1, 0.4, 0.05, 0.05, WH);
        }
      }
    }
  }

  // ================= BLÖCKE =================
  async blocks(progress, nextFrame) {
    const W = this.W;
    const skip = ['airport', 'park', 'golf', 'stadium', 'bay'];
    let count = 0, total = 25 * 22;
    for (let i = -14; i <= 10; i++) {
      for (let j = -10; j <= 11; j++) {
        count++;
        const cx = i * 100 + 50, cz = j * 100 + 50;
        if (skip.some((k) => inRect(RECTS[k], cx, cz))) continue;
        const b = { i, j, cx, cz, x0: i * 100 + hwV(i), x1: (i + 1) * 100 - hwV(i + 1), z0: j * 100 + hwH(j), z1: (j + 1) * 100 - hwH(j + 1) };
        b.w = b.x1 - b.x0; b.d = b.z1 - b.z0;
        const rng = new RNG(((i + 40) * 1000 + (j + 40)) * 7919 + 13);
        b.rng = rng;
        b.district = W.districtAt(cx, cz);
        let type = W.blockTypeFor(cx, cz);
        const r = rng.next();
        if (type === 'tower' && r < 0.18) type = 'mid';
        else if ((type === 'mid' || type === 'tower') && r > 0.97) type = 'construction';
        else if (type === 'mid' && r > 0.94) type = 'plaza';
        else if (r > 0.935 && type !== 'villa' && type !== 'industrial') type = 'park';
        else if (type === 'mid' && r > 0.9) type = 'gas';
        const sp = SPECIALS.find((s) => s.i === i && s.j === j);
        if (sp) type = 'special';
        b.type = type; b.special = sp;
        W.blocks.push(b); W.blockAt.set(i + ',' + j, b);
        this.blockBase(b);
        switch (type) {
          case 'tower': this.towerBlock(b); break;
          case 'mid': this.midBlock(b); break;
          case 'deco': this.decoBlock(b); break;
          case 'industrial': this.industrialBlock(b); break;
          case 'residential': this.residentialBlock(b); break;
          case 'villa': this.villaBlock(b); break;
          case 'park': this.parkBlock(b); break;
          case 'plaza': this.plazaBlock(b); break;
          case 'construction': this.constructionBlock(b); break;
          case 'gas': this.gasBlock(b); break;
          case 'special': this.special(b, sp); break;
        }
        this.streetProps(b);
      }
      if (i % 2 === 0) { progress(0.28 + 0.5 * count / total, 'Gebäude & Straßenzüge …'); await nextFrame(); }
    }
    // Kioske und Immobilien
    for (const k of KIOSKS) this.kiosk(k);
    for (const p of PROPERTIES) this.propertyGate(p);
  }
  blockBase(b) {
    const W = this.W, mbS = W.mb(b.cx, b.cz, 'sidewalk');
    mbS.box(b.cx, 0, b.cz, b.w, 0.16, b.d, { col: [1, 1, 1], uvs: 8, topUV: null });
    const key = { tower: 'plaza', mid: 'concrete', deco: 'plaza', industrial: 'concrete', residential: 'grass', villa: 'grass', park: 'grass', plaza: 'plaza', construction: 'dirt', gas: 'concrete', special: 'plaza' }[b.type] || 'concrete';
    W.mb(b.cx, b.cz, key).ground(b.x0 + 3.4, b.z0 + 3.4, b.x1 - 3.4, b.z1 - 3.4, 0.17, key === 'grass' ? [0.9, 1, 0.8] : [1, 1, 1], 8);
  }
  streetProps(b) {
    const W = this.W, rng = b.rng;
    const palm = ['deco', 'tower', 'special'].includes(b.type) || b.district === 'Ocean Drive';
    const sides = [
      { x0: b.x0 + 1.6, z0: b.z0 + 1.6, dx: 1, dz: 0, len: b.w - 3.2, outx: 0, outz: -1, yaw: Math.PI / 2 },
      { x0: b.x0 + 1.6, z0: b.z1 - 1.6, dx: 1, dz: 0, len: b.w - 3.2, outx: 0, outz: 1, yaw: -Math.PI / 2 },
      { x0: b.x0 + 1.6, z0: b.z0 + 1.6, dx: 0, dz: 1, len: b.d - 3.2, outx: -1, outz: 0, yaw: 0 },
      { x0: b.x1 - 1.6, z0: b.z0 + 1.6, dx: 0, dz: 1, len: b.d - 3.2, outx: 1, outz: 0, yaw: Math.PI },
    ];
    for (let s = 0; s < 4; s++) {
      const sd = sides[s];
      for (let t = 15; t < sd.len - 12; t += 22) {
        const x = sd.x0 + sd.dx * t, z = sd.z0 + sd.dz * t;
        if (b.type !== 'industrial' && b.type !== 'park' && rng.chance(0.55)) { if (palm) this.palm(x, z, rng); else if (b.type !== 'construction') this.tree(x, z, rng, 0.7); }
        else if (rng.chance(0.12)) this.bench(x, z, sd.dx === 1 ? 0 : Math.PI / 2, rng);
      }
      for (let t = 22; t < sd.len - 16; t += 38) {
        const x = sd.x0 + sd.dx * t, z = sd.z0 + sd.dz * t;
        this.lamp(x, z, Math.atan2(sd.outx, sd.outz));
      }
      // Parkplätze für Autos am Bordstein
      for (let t = 18; t < sd.len - 8; t += 11) {
        if (rng.chance(0.22)) {
          const x = sd.x0 + sd.dx * t + sd.outx * 1.6, z = sd.z0 + sd.dz * t + sd.outz * 1.6;
          W.parkSpots.push({ x, z, yaw: sd.yaw });
        }
      }
    }
    // Hydranten, Mülleimer, Briefkasten an Ecken
    for (const [x, z] of [[b.x0 + 2, b.z0 + 2], [b.x1 - 2, b.z1 - 2]]) {
      if (rng.chance(0.5)) this.W.mb(x, z, 'plain').cyl(x, 0.16, z, 0.17, 0.7, 6, rng.chance(0.5) ? 0xc62828 : 0x2e7d32);
    }
  }
  inset(b, m) { return { x0: b.x0 + m, x1: b.x1 - m, z0: b.z0 + m, z1: b.z1 - m, w: b.w - 2 * m, d: b.d - 2 * m, cx: b.cx, cz: b.cz }; }

  // ================= EINZELTEILE =================
  tree(x, z, rng, scale = 1) {
    const W = this.W, mb = W.mb(x, z, 'leaf');
    const h = rng.range(5, 8) * scale, g = rng.range(0.9, 1.1);
    const lc = [0x3f7d2c, 0x4a8a30, 0x356b2a, 0x5a9a38][rng.int(0, 3)];
    mb.cyl(x, 0.16, z, 0.18 * scale + 0.05, h * 0.55, 6, 0x5b4030, { r2: 0.12, cap: false });
    mb.blob(x, 0.16 + h * 0.62, z, 2.4 * scale * g, 2.1 * scale * g, 2.4 * scale * g, lc, 6, 4, 0.35, x * 13 + z);
    mb.blob(x + rng.range(-0.8, 0.8), 0.16 + h * 0.85, z + rng.range(-0.8, 0.8), 1.8 * scale, 1.6 * scale, 1.8 * scale, lc, 6, 4, 0.4, x + z * 7);
    W.addCircle(x, z, 0.35, 6, 'tree');
  }
  palm(x, z, rng, h = rng.range(6, 10)) {
    const W = this.W, mb = W.mb(x, z, 'leaf');
    const lean = rng.range(-0.8, 0.8), ang = rng.range(0, 6.28);
    const lx = Math.cos(ang) * lean, lz = Math.sin(ang) * lean;
    const seg = 3;
    let px = x, pz = z, py = 0.16;
    for (let s = 0; s < seg; s++) {
      const t0 = s / seg, t1 = (s + 1) / seg;
      const nx = x + lx * t1 * t1 * h * 0.15, nz = z + lz * t1 * t1 * h * 0.15, ny = 0.16 + h * t1;
      mb.cyl(px, py, pz, 0.2 - t0 * 0.07, ny - py, 6, 0x8a6a4a, { r2: 0.2 - t1 * 0.07, cap: false });
      px = nx; pz = nz; py = ny;
    }
    const gc = [0x3f8a3a, 0x4a9a3e, 0x2f7a35][rng.int(0, 2)];
    const nf = 7;
    for (let f = 0; f < nf; f++) {
      const a = (f / nf) * Math.PI * 2 + rng.range(-0.2, 0.2), len = rng.range(2.8, 3.8);
      const ca = Math.cos(a), sa = Math.sin(a), pa = -sa, pb = ca;
      const A = [px, py, pz], M = [px + ca * len * 0.55, py + 0.9, pz + sa * len * 0.55], E = [px + ca * len, py - 0.55, pz + sa * len];
      const wd = 0.55;
      const aL = [A[0] + pa * 0.05, A[1], A[2] + pb * 0.05], aR = [A[0] - pa * 0.05, A[1], A[2] - pb * 0.05];
      const mL = [M[0] + pa * wd, M[1] - 0.12, M[2] + pb * wd], mR = [M[0] - pa * wd, M[1] - 0.12, M[2] - pb * wd];
      const c1 = [gc >> 16 & 255, gc >> 8 & 255, gc & 255].map((v) => v / 255);
      const col = c1.map((v) => v * 0.9 + 0.02);
      // oben sichtbar + unten sichtbar
      mb.quad(aR, aL, mL, mR, colorOf(gc)); mb.quad(aL, aR, mR, mL, col);
      mb.tri(mL, mR, E, colorOf(gc)); mb.tri(mR, mL, E, col);
    }
    mb.blob(px, py - 0.1, pz, 0.28, 0.28, 0.28, 0x6a4a2a, 5, 3);
    W.addCircle(x, z, 0.3, 8, 'tree');
  }
  lamp(x, z, face) {
    const W = this.W, mb = W.mb(x, z, 'plain');
    const nx = Math.sin(face), nz = Math.cos(face);
    mb.cyl(x, 0.16, z, 0.11, 7.6, 6, 0x3a3d42, { r2: 0.07, cap: false });
    mb.box(x + nx * 0.9, 7.6, z + nz * 0.9, 0.14, 0.14, 1.9, { rot: face, col: 0x3a3d42, uvs: 2 });
    const hx = x + nx * 1.7, hz = z + nz * 1.7;
    W.mb(x, z, 'lamp').box(hx, 7.45, hz, 0.45, 0.14, 0.9, { rot: face, col: [1.0, 0.82, 0.55], uvs: 2, top: false });
    W.mb(x, z, 'glow').ground(hx - 7, hz - 7, hx + 7, hz + 7, 0.19, [1.0, 0.75, 0.4], 14);
    W.addCircle(x, z, 0.2, 8, 'lamp');
    W.lampHash.add({ x: hx, y: 7.2, z: hz }, hx, hz, hx, hz);
  }
  bench(x, z, rot, rng) {
    const mb = this.W.mb(x, z, 'plain');
    mb.box(x, 0.16, z, 1.7, 0.08, 0.5, { rot, col: 0x6d4c33, uvs: 1 });
    mb.box(x, 0.16, z, 1.6, 0.4, 0.4, { rot, col: 0x37474f, uvs: 1, top: false });
    this.W.addBox(x, z, 1.7, 0.5, 0.9, 'prop');
  }
  addSign(text, x, y, z, rotY, w, h, fg = '#ff4fd8') {
    const W = this.W;
    const key = text + fg;
    let mat = W.signCache.get(key);
    if (!mat) { mat = new THREE.MeshBasicMaterial({ map: makeSignTexture(text, fg), toneMapped: false }); W.signCache.set(key, mat); }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z); mesh.rotation.y = rotY;
    W.addExtra(x, z, mesh);
    return mesh;
  }

  // ================= GEBÄUDE =================
  shaft(set, key, cx, cz, w, d, y0, y1, tint, fac) {
    set.get(key).box(cx, y0, cz, w, y1 - y0, d, { col: tint, fac, top: false });
  }
  roofCap(set, cx, cz, w, d, y, rng, o = {}) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    set.get('roof').ground(x0, z0, x1, z1, y + 0.02, [1, 1, 1], 6);
    const pm = set.get('plain');
    const pc = o.parapet ?? 0xcfcac0;
    pm.box(cx, y, z0 + 0.2, w, 0.9, 0.4, { col: pc, uvs: 3 }); pm.box(cx, y, z1 - 0.2, w, 0.9, 0.4, { col: pc, uvs: 3 });
    pm.box(x0 + 0.2, y, cz, 0.4, 0.9, d - 0.8, { col: pc, uvs: 3 }); pm.box(x1 - 0.2, y, cz, 0.4, 0.9, d - 0.8, { col: pc, uvs: 3 });
    const n = Math.min(6, Math.floor(w * d / 120) + 1);
    for (let k = 0; k < n; k++) {
      const ux = rng.range(x0 + 3, x1 - 3), uz = rng.range(z0 + 3, z1 - 3);
      if (rng.chance(0.6)) pm.box(ux, y, uz, rng.range(1.5, 3.4), rng.range(1, 2), rng.range(1.5, 3.2), { col: 0x8f979d, uvs: 2 });
      else pm.cyl(ux, y, uz, rng.range(0.6, 1.2), rng.range(1.5, 3), 8, 0xb8bec4);
    }
    if (o.tall) {
      const lm = set.get('lamp');
      pm.cyl(cx, y, cz, 0.25, o.tall, 6, 0x9aa0a6, { r2: 0.08 });
      lm.box(cx, y + o.tall, cz, 0.5, 0.5, 0.5, { col: [1, 0.1, 0.1], uvs: 1 });
    }
    if (o.pad) {
      const pr = Math.min(w, d) * 0.32;
      pm.cyl(cx, y + 0.02, cz, pr, 0.15, 20, 0x3b4a58, { uvs: 1 });
      pm.cyl(cx, y + 0.17, cz, pr * 0.84, 0.05, 20, 0xf2f2f2, { uvs: 1 });
      pm.cyl(cx, y + 0.22, cz, pr * 0.74, 0.05, 20, 0x3b4a58, { uvs: 1 });
      pm.box(cx - pr * 0.25, y + 0.26, cz, 0.7, 0.04, pr * 0.9, { col: 0xf2f2f2, uvs: 1 });
      pm.box(cx + pr * 0.25, y + 0.26, cz, 0.7, 0.04, pr * 0.9, { col: 0xf2f2f2, uvs: 1 });
      pm.box(cx, y + 0.26, cz, pr * 0.5, 0.04, 0.7, { col: 0xf2f2f2, uvs: 1 });
    }
  }
  // generisches Gebäude
  bldg(cx, cz, w, d, h, o = {}) {
    const W = this.W, rng = o.rng || this.rng;
    const sky = h >= 70;
    const set = sky ? W.skyline : W.sets[W.chunkIdx(cx, cz)];
    const key = o.facade || 'facade_office';
    const tint = o.tint ?? 0xffffff;
    const fh = o.floorH || 3.6, bw = o.bayW || 3.2;
    const y0 = 0.16;
    let yb = y0;
    const fac = () => ({ cw: bw, ch: fh, ou: rng.int(0, 7), ov: rng.int(0, 7) });
    if (o.ground !== false && h > 8) {
      set.get('facade_shop').box(cx, y0, cz, w + 0.3, 4.6, d + 0.3, { col: o.shopTint ?? 0xffffff, fac: { cw: 3.6, ch: 4.6, ou: rng.int(0, 7), ov: rng.int(0, 7) }, top: false });
      set.get('plain').box(cx, y0 + 4.6, cz, w + 1.0, 0.35, d + 1.0, { col: o.ledge ?? 0xd9d4c8, uvs: 3 });
      yb = y0 + 4.95;
    }
    const mh = o.tiers ? Math.min(h, o.tiers[0]) : h;
    this.shaft(set, key, cx, cz, w, d, yb, y0 + mh, tint, fac());
    let topY = y0 + mh, tw = w, td = d;
    if (o.tiers) {
      let prevH = y0 + mh;
      for (let t = 1; t < o.tiers.length; t++) {
        tw *= o.shrink?.[t - 1] ?? 0.8; td *= o.shrink?.[t - 1] ?? 0.8;
        const th = y0 + o.tiers[t];
        this.shaft(set, key, cx, cz, tw, td, prevH, th, tint, fac());
        if (t < o.tiers.length - 1) this.roofCap(set, cx, cz, tw, td, th, rng, { parapet: 0xb8b4aa });
        prevH = th; topY = th;
      }
    }
    this.roofCap(set, cx, cz, tw, td, topY, rng, { tall: o.antenna, pad: o.pad, parapet: o.parapet });
    W.addBox(cx, cz, w, d, topY);
    return topY;
  }
  skyscraper(cx, cz, w, d, H, rng, extra = {}) {
    const glass = rng.chance(0.62);
    const o = { rng, facade: glass ? 'facade_glass' : 'facade_office', tint: glass ? rng.pick(GLASS_T) : rng.pick(OFFICE_T), floorH: glass ? 3.8 : 3.8, bayW: glass ? 2.2 : 3.4, ground: true, antenna: H > 120 ? rng.range(12, 30) : 0, pad: H > 90 && rng.chance(0.4), ...extra };
    if (H > 100) { o.tiers = [H * 0.62, H * 0.86, H]; o.shrink = [0.82, 0.62]; }
    else if (H > 60) { o.tiers = [H * 0.75, H]; o.shrink = [0.78]; }
    return this.bldg(cx, cz, w, d, H, o);
  }
  towerBlock(b) {
    const rng = b.rng, W = this.W;
    const dc = Math.hypot((b.cx - 150) / 520, (b.cz + 100) / 420);
    const base = lerp(210, 70, clamp(dc, 0, 1));
    const m = this.inset(b, 11);
    if (rng.chance(0.55)) {
      const w = rng.range(46, Math.min(66, m.w)), d = rng.range(46, Math.min(66, m.d));
      this.skyscraper(b.cx + rng.range(-4, 4), b.cz + rng.range(-4, 4), w, d, base * rng.range(0.55, 1.15), rng);
    } else {
      const hw = m.w / 2 - 1, hd = m.d / 2 - 1;
      for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
        if (rng.chance(0.12)) continue;
        const x = b.cx + (a ? 1 : -1) * hw / 2, z = b.cz + (c ? 1 : -1) * hd / 2;
        this.skyscraper(x, z, hw * 0.88, hd * 0.88, base * rng.range(0.28, 0.75), rng);
      }
    }
    if (rng.chance(0.4)) { const px = b.cx, pz = b.z1 - 7; W.mb(px, pz, 'plain').cyl(px, 0.17, pz, 3, 0.5, 14, 0xb6b2a8); W.mb(px, pz, 'pool').cyl(px, 0.65, pz, 2.4, 0.04, 14, 0x35c8e8, { cap: true }); }
  }
  midBlock(b) {
    const rng = b.rng;
    const m = this.inset(b, 10);
    const layout = rng.int(0, 2);
    const facs = ['facade_office', 'facade_brick', 'facade_deco'];
    const pickStyle = () => { const f = rng.pick(facs); return { facade: f, tint: f === 'facade_brick' ? rng.pick(BRICK_T) : f === 'facade_deco' ? rng.pick(DECO_T) : rng.pick(OFFICE_T), rng }; };
    if (layout === 0) {
      this.bldg(b.cx, b.cz, m.w * rng.range(0.78, 1), m.d * rng.range(0.78, 1), rng.range(18, 52), { ...pickStyle(), pad: rng.chance(0.15), antenna: rng.chance(0.3) ? 6 : 0 });
    } else if (layout === 1) {
      const split = rng.chance(0.5);
      for (let k = 0; k < 2; k++) {
        const w = split ? m.w / 2 - 1.5 : m.w, d = split ? m.d : m.d / 2 - 1.5;
        const x = split ? m.x0 + w / 2 + k * (w + 3) : b.cx, z = split ? b.cz : m.z0 + d / 2 + k * (d + 3);
        this.bldg(x, z, w, d, rng.range(14, 40), pickStyle());
      }
    } else {
      for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
        const w = m.w / 2 - 1.5, d = m.d / 2 - 1.5;
        this.bldg(m.x0 + w / 2 + a * (w + 3), m.z0 + d / 2 + c * (d + 3), w, d, rng.range(10, 30), pickStyle());
      }
    }
  }
  decoBlock(b) {
    const rng = b.rng, W = this.W;
    const m = this.inset(b, 10);
    const n = rng.int(2, 4);
    const w = m.w / 2 - 2, d = m.d / 2 - 2;
    const cells = [[0, 0], [1, 0], [0, 1], [1, 1]];
    for (let k = 0; k < n; k++) {
      const [a, c] = cells[k];
      const x = m.x0 + w / 2 + a * (w + 4), z = m.z0 + d / 2 + c * (d + 4);
      const h = rng.range(10, 30), tint = rng.pick(DECO_T);
      this.bldg(x, z, w, d, h, { rng, facade: 'facade_deco', tint, floorH: 3.4, bayW: 3.4, shopTint: rng.pick(DECO_T), parapet: tint });
      // Neon-Elemente
      const nc = rng.pick(NEON);
      W.mb(x, z, 'neon').box(x - w / 2 - 0.25, h * 0.5, z + rng.range(-d * 0.3, d * 0.3), 0.35, h * 0.35, 1.1, { col: nc, uvs: 1 });
      W.mb(x, z, 'neon').box(x, 4.4, z - d / 2 - 0.2, w * 0.8, 0.25, 0.25, { col: nc, uvs: 1 });
      W.mb(x, z, 'glow').ground(x - w / 2 - 6, z - 8, x - w / 2 + 6, z + 8, 0.2, colorOf(nc).map((v) => v * 0.8), 12);
      if (rng.chance(0.4)) this.palm(x + w / 2 + 2, z + d / 2 + 2, rng);
    }
  }
  industrialBlock(b) {
    const rng = b.rng, W = this.W;
    const m = this.inset(b, 10);
    const waterside = b.cz > 700 && b.cx > 500;
    if (rng.chance(0.5) || waterside) {
      // Containerlager
      const cols = [0xc0392b, 0x2e86c1, 0x27ae60, 0xe67e22, 0xecf0f1, 0xf1c40f, 0x7f8c8d, 0x8e44ad];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
        if (rng.chance(0.12)) continue;
        const x = m.x0 + 8 + c * 15, z = m.z0 + 5 + r * 15.5;
        const lv = rng.int(1, 3);
        for (let k = 0; k < lv; k++) W.mb(x, z, 'plain').box(x, 0.17 + k * 2.6, z, 12.2, 2.6, 2.45, { col: rng.pick(cols), uvs: 3 });
        W.addBox(x, z, 12.2, 2.45, lv * 2.6);
      }
    } else {
      const n = rng.int(1, 2);
      for (let k = 0; k < n; k++) {
        const w = n === 1 ? m.w * 0.85 : m.w / 2 - 2, d = m.d * 0.8;
        const x = n === 1 ? b.cx : m.x0 + w / 2 + k * (w + 4), z = b.cz;
        const h = rng.range(8, 14);
        const sets = W.sets[W.chunkIdx(x, z)];
        sets.get('facade_warehouse').box(x, 0.16, z, w, h, d, { col: rng.pick([0xffffff, 0xdfe6ee, 0xeadfce]), fac: { cw: 6, ch: 4, ou: rng.int(0, 7), ov: 0 }, top: false });
        sets.get('metal').gable(x, 0.16 + h, z, w, d, 2.2, 'x', 0xb5bcc4, 6, 0.3);
        W.addBox(x, z, w + 0.6, d + 0.6, h + 2);
        // Rolltore
        sets.get('plain').box(x, 0.17, z + d / 2 + 0.05, 5, 4.2, 0.2, { col: 0x5d6d7e, uvs: 2 });
      }
      if (rng.chance(0.5)) { const x = m.x1 - 6, z = m.z1 - 6; for (let k = 0; k < 2; k++) { W.mb(x, z, 'plain').cyl(x - k * 8, 0.17, z, 3.4, 9, 12, 0xe3e6e8); W.addCircle(x - k * 8, z, 3.4, 9); } }
    }
  }
  house(x, z, w, d, rng, face) {
    const W = this.W, sets = W.sets[W.chunkIdx(x, z)];
    const floors = rng.chance(0.4) ? 2 : 1, fh = 3.1, h = floors * fh;
    const tint = rng.pick(HOUSE_T);
    sets.get('facade_house').box(x, 0.17, z, w, h, d, { col: tint, fac: { cw: 3.2, ch: fh, ou: rng.int(0, 7), ov: rng.int(0, 7) }, top: false });
    const rc = rng.pick(ROOF_T), gx = rng.chance(0.5);
    if (rng.chance(0.75)) sets.get('tiles').gable(x, 0.17 + h, z, w, d, rng.range(2.2, 3.4), gx ? 'x' : 'z', rc, 4, 0.5);
    else { sets.get('roof').ground(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0.19 + h, [1, 1, 1], 6); sets.get('plain').box(x, 0.17 + h, z, w + 0.8, 0.3, d + 0.8, { col: 0xeeeeee, uvs: 3 }); }
    // Garage
    const gdx = face * (w / 2 + 2.6);
    sets.get('plain').box(x + gdx, 0.17, z, 5.2, 2.8, d * 0.8, { col: tint, uvs: 3 });
    sets.get('plain').box(x + gdx, 2.97, z, 5.6, 0.25, d * 0.85, { col: 0x555a60, uvs: 3 });
    sets.get('plain').box(x + gdx + face * 2.65, 0.17, z, 0.1, 2.3, 3.4, { col: 0xdfe3e6, uvs: 2 });
    W.addBox(x + gdx / 2, z, w + Math.abs(gdx), d, h + 2);
    // Tür & Stufen
    sets.get('plain').box(x, 0.17, z + d / 2 + 0.05, 1.1, 2.1, 0.12, { col: rng.pick([0x5d4037, 0x1565c0, 0xb71c1c, 0x2e7d32]), uvs: 1 });
    // Pool
    if (rng.chance(0.18)) sets.get('pool').ground(x - 4, z - d / 2 - 9, x + 4, z - d / 2 - 3, 0.2, [1, 1, 1], 6);
    return h;
  }
  residentialBlock(b) {
    const rng = b.rng, W = this.W;
    const m = this.inset(b, 8);
    if (rng.chance(0.18)) {
      // Apartmentblöcke
      const n = 2;
      for (let k = 0; k < n; k++) {
        const w = m.w * 0.85, d = m.d / 2 - 4;
        this.bldg(b.cx, m.z0 + d / 2 + k * (d + 8), w, d, rng.range(14, 24), { rng, facade: 'facade_brick', tint: rng.pick(BRICK_T), floorH: 3.0, bayW: 3.0, ground: false });
      }
      return;
    }
    const cols = 3, rows = 2;
    const lw = m.w / cols, ld = m.d / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = m.x0 + lw * (c + 0.5), z = m.z0 + ld * (r + 0.5);
      if (rng.chance(0.06)) { W.mb(x, z, 'grass').ground(x - lw / 2 + 1, z - ld / 2 + 1, x + lw / 2 - 1, z + ld / 2 - 1, 0.2, [0.8, 1, 0.8], 6); this.tree(x, z, rng, 1.2); continue; }
      const w = rng.range(9, 12), d = rng.range(8, 10);
      this.house(x - 1.5, z, w, d, rng, rng.chance(0.5) ? 1 : -1);
      // Zaun
      const fm = W.mb(x, z, 'plain');
      const fx0 = x - lw / 2 + 0.5, fx1 = x + lw / 2 - 0.5, fz0 = z - ld / 2 + 0.5, fz1 = z + ld / 2 - 0.5;
      fm.box((fx0 + fx1) / 2, 0.17, fz0, fx1 - fx0, 0.9, 0.08, { col: 0xf3f0e8, uvs: 1 }); fm.box((fx0 + fx1) / 2, 0.17, fz1, fx1 - fx0, 0.9, 0.08, { col: 0xf3f0e8, uvs: 1 });
      fm.box(fx0, 0.17, z, 0.08, 0.9, fz1 - fz0, { col: 0xf3f0e8, uvs: 1 }); fm.box(fx1, 0.17, z, 0.08, 0.9, fz1 - fz0, { col: 0xf3f0e8, uvs: 1 });
      if (rng.chance(0.6)) this.tree(x + rng.range(-3, 3), z + (rng.chance(0.5) ? 1 : -1) * ld * 0.3, rng, 0.9);
      if (rng.chance(0.4)) this.palm(x + lw * 0.3, z + ld * 0.28, rng, 6);
    }
  }
  villaBlock(b) {
    const rng = b.rng, W = this.W;
    const m = this.inset(b, 12);
    const sets = W.sets[W.chunkIdx(b.cx, b.cz)];
    const cx = b.cx, cz = b.cz + 4;
    const w = rng.range(32, 40), d = rng.range(16, 20);
    const tint = rng.pick([0xffffff, 0xf3ece0, 0xeef2f6]);
    sets.get('facade_deco').box(cx, 0.17, cz, w, 4.4, d, { col: tint, fac: { cw: 4, ch: 4.4, ou: rng.int(0, 7), ov: 2 }, top: false });
    sets.get('facade_glass').box(cx + 3, 4.6, cz, w * 0.62, 3.8, d * 0.86, { col: 0xffffff, fac: { cw: 3, ch: 3.8, ou: rng.int(0, 7), ov: 0 }, top: false });
    sets.get('plain').box(cx, 4.57, cz, w + 3, 0.3, d + 3, { col: 0xf2f2f0, uvs: 4 });
    sets.get('plain').box(cx + 3, 8.4, cz, w * 0.62 + 3, 0.35, d * 0.86 + 3, { col: 0xf2f2f0, uvs: 4 });
    sets.get('roof').ground(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, 4.9, [1, 1, 1], 6);
    W.addBox(cx, cz, w + 2, d + 2, 9);
    // Pool + Deck
    const pz = cz - d / 2 - 9;
    sets.get('plaza').ground(cx - 14, pz - 6, cx + 14, pz + 6, 0.2, [1, 1, 1], 8);
    sets.get('pool').ground(cx - 10, pz - 3.2, cx + 10, pz + 3.2, 0.23, [1, 1, 1], 6);
    // Mauer + Tor
    const wm = sets.get('plain'), wc = 0xe9e4d8;
    const x0 = m.x0, x1 = m.x1, z0 = m.z0, z1 = m.z1;
    wm.box((x0 + x1) / 2, 0.17, z0, x1 - x0, 2.2, 0.5, { col: wc, uvs: 3 });
    wm.box(x0, 0.17, (z0 + z1) / 2, 0.5, 2.2, z1 - z0, { col: wc, uvs: 3 }); wm.box(x1, 0.17, (z0 + z1) / 2, 0.5, 2.2, z1 - z0, { col: wc, uvs: 3 });
    wm.box((x0 + cx - 4) / 2, 0.17, z1, cx - 4 - x0, 2.2, 0.5, { col: wc, uvs: 3 }); wm.box((x1 + cx + 4) / 2, 0.17, z1, x1 - cx - 4, 2.2, 0.5, { col: wc, uvs: 3 });
    wm.box(cx - 4, 0.17, z1, 0.8, 3, 0.8, { col: 0xd7d0bf, uvs: 2 }); wm.box(cx + 4, 0.17, z1, 0.8, 3, 0.8, { col: 0xd7d0bf, uvs: 2 });
    W.addBox((x0 + x1) / 2, z0, x1 - x0, 0.6, 2.2); W.addBox(x0, (z0 + z1) / 2, 0.6, z1 - z0, 2.2); W.addBox(x1, (z0 + z1) / 2, 0.6, z1 - z0, 2.2);
    W.addBox((x0 + cx - 4) / 2, z1, cx - 4 - x0, 0.6, 2.2); W.addBox((x1 + cx + 4) / 2, z1, x1 - cx - 4, 0.6, 2.2);
    for (let k = 0; k < 6; k++) this.palm(rng.range(x0 + 4, x1 - 4), rng.range(z0 + 4, z0 + 12), rng, rng.range(8, 12));
    for (let k = 0; k < 3; k++) this.tree(rng.range(x0 + 4, x1 - 4), rng.range(z1 - 14, z1 - 6), rng, 1.1);
    if (rng.chance(0.4)) this.roofCap(sets, cx + 3, cz, w * 0.5, d * 0.5, 8.75, rng, { pad: true });
    if (rng.chance(0.5)) { sets.get('plain').box(x1 - 14, 0.17, z1 - 12, 3.4, 1.2, 2.2, { col: 0x222222, uvs: 2 }); }
  }
  parkBlock(b) {
    const rng = b.rng, W = this.W;
    this.parkContent(b.x0 + 4, b.z0 + 4, b.x1 - 4, b.z1 - 4, rng, 14);
  }
  parkContent(x0, z0, x1, z1, rng, ntrees) {
    const W = this.W, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    W.mb(cx, cz, 'plaza').strip(x0, cz, x1, cz, 3, 0.2, 0.2, [1, 1, 1]);
    W.mb(cx, cz, 'plaza').strip(cx, z0, cx, z1, 3, 0.2, 0.2, [1, 1, 1]);
    for (let k = 0; k < ntrees; k++) {
      const x = rng.range(x0 + 3, x1 - 3), z = rng.range(z0 + 3, z1 - 3);
      if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue;
      if (rng.chance(0.3)) this.palm(x, z, rng); else this.tree(x, z, rng, rng.range(1, 1.4));
    }
    this.bench(cx + 6, cz + 2.3, 0, rng); this.bench(cx - 6, cz - 2.3, 0, rng);
    // Teich
    if (rng.chance(0.7) && x1 - x0 > 60) { const px = (x0 + cx) / 2, pz = (z0 + cz) / 2; W.mb(px, pz, 'pool').cyl(px, 0.18, pz, 9, 0.05, 20, 0x2a8fb8); W.addCircle(px, pz, 9, 0.5, 'pond'); }
  }
  plazaBlock(b) {
    const rng = b.rng, W = this.W;
    const cx = b.cx, cz = b.cz, pm = W.mb(cx, cz, 'plain');
    pm.cyl(cx, 0.17, cz, 7, 0.7, 20, 0xcfc9bb, { cap: true });
    W.mb(cx, cz, 'pool').cyl(cx, 0.8, cz, 6.2, 0.06, 20, 0x35c8e8);
    pm.cyl(cx, 0.17, cz, 1.2, 3.4, 10, 0xb8b2a4, { r2: 0.6 });
    W.addCircle(cx, cz, 7, 1.2, 'fountain');
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; this.palm(cx + Math.cos(a) * 26, cz + Math.sin(a) * 26, rng, 8); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.4; this.bench(cx + Math.cos(a) * 14, cz + Math.sin(a) * 14, -a, rng); }
    const m = this.inset(b, 10);
    for (const [x, z] of [[m.x0 + 6, m.z0 + 6], [m.x1 - 6, m.z0 + 6]]) { this.bldg(x, z, 12, 12, rng.range(8, 14), { rng, facade: 'facade_deco', tint: rng.pick(DECO_T) }); }
  }
  constructionBlock(b) {
    const rng = b.rng, W = this.W;
    const m = this.inset(b, 10);
    const sets = W.sets[W.chunkIdx(b.cx, b.cz)], pm = sets.get('plain');
    const cx = b.cx - 8, cz = b.cz + 4, w = 34, d = 26, floors = rng.int(5, 12), fh = 3.6;
    for (let f = 0; f <= floors; f++) pm.box(cx, 0.17 + f * fh, cz, w, 0.4, d, { col: 0x9a9a95, uvs: 4 });
    for (let a = 0; a <= 4; a++) for (let c = 0; c <= 3; c++) pm.box(cx - w / 2 + 1 + a * (w - 2) / 4, 0.17, cz - d / 2 + 1 + c * (d - 2) / 3, 0.9, floors * fh, 0.9, { col: 0xb0afa8, uvs: 2 });
    W.addBox(cx, cz, w, d, floors * fh);
    // Kran (animiert)
    const kx = b.cx + 20, kz = b.cz - 18;
    pm.box(kx, 0.17, kz, 2, 48, 2, { col: 0xf6a800, uvs: 4 });
    W.addBox(kx, kz, 2.4, 2.4, 48);
    const jib = new THREE.Group();
    const jm = new THREE.MeshStandardMaterial({ color: 0xf6a800, roughness: 0.6 });
    const jb = new THREE.Mesh(new THREE.BoxGeometry(46, 1.2, 1.2), jm); jb.position.set(10, 0, 0);
    const cw = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), new THREE.MeshStandardMaterial({ color: 0x55585c })); cw.position.set(-17, -1, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), new THREE.MeshStandardMaterial({ color: 0xffffff })); cab.position.set(-2, 1.5, 1.8);
    jib.add(jb, cw, cab); jib.position.set(kx, 50, kz); jib.userData.spin = 0.05 + rng.next() * 0.05; jib.rotation.y = rng.range(0, 6);
    jib.traverse((o) => { o.castShadow = true; });
    W.addExtra(kx, kz, jib); W.animated.push({ obj: jib, type: 'spin', speed: jib.userData.spin });
    // Zaun / Hütchen
    const sx0 = m.x0, sx1 = m.x1, sz0 = m.z0, sz1 = m.z1;
    for (const [ax, az, bx, bz] of [[sx0, sz0, sx1, sz0], [sx0, sz1, sx1, sz1], [sx0, sz0, sx0, sz1], [sx1, sz0, sx1, sz1]]) {
      const l = Math.hypot(bx - ax, bz - az);
      pm.box((ax + bx) / 2, 0.17, (az + bz) / 2, Math.abs(bx - ax) || 0.15, 2, Math.abs(bz - az) || 0.15, { col: 0x7d8a96, uvs: 2 });
      W.addBox((ax + bx) / 2, (az + bz) / 2, Math.abs(bx - ax) || 0.3, Math.abs(bz - az) || 0.3, 2);
    }
    for (let k = 0; k < 8; k++) pm.cyl(rng.range(sx0, sx1), 0.17, sz1 + 1, 0.2, 0.7, 6, 0xff6d00, { r2: 0.05 });
  }
  gasBlock(b) {
    const rng = b.rng, W = this.W, pm = W.mb(b.cx, b.cz, 'plain');
    const cx = b.cx, cz = b.cz - 6;
    pm.box(cx - 10, 4.8, cz, 3.2, 0.5, 12, { col: 0xf5f5f5, uvs: 4 }); // dummy
    pm.box(cx, 4.8, cz, 26, 0.5, 14, { col: 0xf5f5f5, uvs: 4 });
    pm.box(cx, 5.3, cz, 26.2, 0.5, 14.2, { col: 0xe53935, uvs: 4 });
    for (const [px, pz] of [[cx - 11, cz - 5], [cx + 11, cz - 5], [cx - 11, cz + 5], [cx + 11, cz + 5]]) { pm.box(px, 0.17, pz, 0.6, 4.6, 0.6, { col: 0xcfd8dc, uvs: 2 }); W.addBox(px, pz, 0.7, 0.7, 4.6); }
    for (const px of [-6, 6]) for (const pz of [-2.5, 2.5]) { pm.box(cx + px, 0.17, cz + pz, 0.8, 1.4, 0.5, { col: 0xe53935, uvs: 1 }); W.addBox(cx + px, cz + pz, 1, 0.7, 1.4); }
    const sets = W.sets[W.chunkIdx(cx, cz)];
    sets.get('facade_shop').box(cx, 0.17, b.z1 - 18, 20, 4.2, 9, { fac: { cw: 3.6, ch: 4.2, ou: 1, ov: 0 }, top: false });
    sets.get('plain').box(cx, 4.37, b.z1 - 18, 21, 0.4, 10, { col: 0xe53935, uvs: 4 });
    W.addBox(cx, b.z1 - 18, 20, 9, 4.4);
    this.addSign('PETRO', cx, 6.6, cz - 7.2, 0, 8, 2.4, '#ffea00');
  }

  // ================= SPEZIALGEBÄUDE =================
  poi(o) { this.W.pois.push({ r: 3.2, ...o }); }
  special(b, sp) {
    const W = this.W, rng = b.rng, sets = W.sets[W.chunkIdx(b.cx, b.cz)], pm = sets.get('plain');
    const cx = b.cx, cz = b.cz;
    const frontZ = b.z1 - 6;     // Vorderseite nach Süden
    const mk = (kind, name, ox = 0, oz = 0) => this.poi({ id: sp.id, kind, name, x: cx + ox, z: b.z1 - 1.8 + oz });
    switch (sp.kind) {
      case 'police': {
        this.bldg(cx, cz - 8, 56, 34, 22, { rng, facade: 'facade_office', tint: 0xb8c4d6, pad: true, shopTint: 0x9aa8bc });
        this.addSign('POLIZEI', cx, 9.5, cz - 8 + 17.3, 0, 12, 3, '#4fc3f7');
        sets.get('neon').box(cx, 22.2, cz + 9.6, 56, 0.3, 0.3, { col: [0.2, 0.5, 1], uvs: 1 });
        mk('police', 'Polizeipräsidium'); break;
      }
      case 'hospital': {
        this.bldg(cx, cz - 6, 64, 36, 30, { rng, facade: 'facade_office', tint: 0xffffff, pad: true });
        sets.get('neon').box(cx, 22, cz - 6 + 18.3, 4, 12, 0.3, { col: [1, 0.1, 0.1], uvs: 1 }); sets.get('neon').box(cx, 26, cz - 6 + 18.3, 12, 4, 0.3, { col: [1, 0.1, 0.1], uvs: 1 });
        this.addSign('KRANKENHAUS', cx, 7.5, cz - 6 + 18.4, 0, 14, 3, '#ff5252');
        mk('hospital', 'Vice Memorial Hospital'); break;
      }
      case 'bank': {
        this.skyscraper(cx, cz - 8, 50, 40, 78, rng, { facade: 'facade_glass', tint: 0xcfe3f2 });
        for (let k = -2; k <= 2; k++) { pm.cyl(cx + k * 9, 0.17, b.z1 - 8, 1.1, 9, 12, 0xe8e2d4); W.addCircle(cx + k * 9, b.z1 - 8, 1.1, 9); }
        pm.box(cx, 9.17, b.z1 - 8, 48, 1.2, 6, { col: 0xd7d0bf, uvs: 4 });
        this.addSign('FEDERAL BANK', cx, 11.5, b.z1 - 5, 0, 16, 3, '#ffd54f');
        mk('bank', 'Vice Federal Bank'); break;
      }
      case 'casino': {
        this.bldg(cx, cz - 4, 62, 50, 34, { rng, facade: 'facade_deco', tint: 0xffd6ea, shopTint: 0xffe08a, parapet: 0xffd54f, pad: false });
        const nc = [0xff2bd6, 0x00e5ff, 0xffea00];
        for (let k = 0; k < 6; k++) sets.get('neon').box(cx - 27 + k * 11, 34, cz - 4 + 25.4, 0.5, 6, 0.5, { col: nc[k % 3], uvs: 1 });
        sets.get('neon').box(cx, 5.2, cz - 4 + 25.4, 40, 0.4, 0.4, { col: [1, 0.85, 0.2], uvs: 1 });
        sets.get('glow').ground(cx - 30, cz + 15, cx + 30, cz + 40, 0.2, [1, 0.5, 0.8], 40);
        this.addSign('GOLDEN PALMS', cx, 28, cz - 4 + 25.6, 0, 22, 5, '#ffea00');
        for (let k = -3; k <= 3; k += 2) this.palm(cx + k * 8, b.z1 - 5, rng, 9);
        mk('casino', 'Golden Palms Casino'); break;
      }
      case 'dealer': {
        sets.get('facade_shop').box(cx, 0.17, cz - 6, 62, 7, 30, { col: 0xffffff, fac: { cw: 7, ch: 7, ou: 0, ov: 0 }, top: false });
        sets.get('plain').box(cx, 7.17, cz - 6, 64, 0.6, 32, { col: 0x222428, uvs: 4 });
        W.addBox(cx, cz - 6, 62, 30, 7.6);
        this.addSign('PREMIUM DELUXE MOTORSPORT', cx, 9.5, cz + 9.5, 0, 26, 3.2, '#ffd54f');
        for (let k = 0; k < 5; k++) W.displaySpots.push({ x: cx - 22 + k * 11, z: b.z1 - 12, yaw: Math.PI + rng.range(-0.3, 0.3), tag: 'dealer' });
        mk('dealer', 'Premium Deluxe Motorsport'); break;
      }
      case 'spray': {
        sets.get('plain').box(cx, 0.17, cz - 12, 34, 7.5, 20, { col: 0xf0c814, uvs: 4 });
        W.addBox(cx, cz - 12, 34, 20, 7.5);
        sets.get('plain').box(cx, 0.17, cz - 1.8, 12, 5.2, 0.4, { col: 0x222222, uvs: 2 });
        for (let k = 0; k < 8; k++) sets.get('plain').box(cx - 5.25 + k * 1.5, 0.2, cz - 1.55, 0.75, 5.1, 0.1, { col: 0xf0c814, uvs: 1 });
        this.addSign("PAY 'N' SPRAY", cx, 9, cz - 1.6, 0, 16, 3.2, '#ff5252');
        this.poi({ id: sp.id, kind: 'spray', name: "Pay 'n' Spray", x: cx, z: cz + 6, r: 7, vehicle: true });
        break;
      }
      case 'club': {
        this.bldg(cx, cz - 6, 46, 40, 14, { rng, facade: 'facade_office', tint: 0x222233, ground: false, parapet: 0x111122 });
        for (let k = 0; k < 8; k++) sets.get('neon').box(cx - 21 + k * 6, 0.5, cz - 6 + 20.2, 0.3, 14, 0.3, { col: NEON[k % 6], uvs: 1 });
        sets.get('glow').ground(cx - 30, cz + 10, cx + 30, cz + 40, 0.2, [0.9, 0.2, 0.9], 40);
        this.addSign('CLUB NEON', cx, 9, cz - 6 + 20.4, 0, 20, 5, '#ff2bd6');
        mk('club', 'Club Neon'); break;
      }
      case 'mall': {
        this.bldg(cx, cz - 2, 78, 70, 16, { rng, facade: 'facade_shop', tint: 0xf0e6d8, ground: false, parapet: 0xe0d6c8 });
        this.addSign('VICE GALLERIA', cx, 11, cz - 2 + 35.4, 0, 22, 4, '#80deea');
        for (let k = -3; k <= 3; k++) this.palm(cx + k * 10, b.z1 - 5, rng, 8);
        mk('mall', 'Vice Galleria (Einkaufszentrum)'); break;
      }
    }
  }
  kiosk(k) {
    const W = this.W;
    const sx = k.c.includes('e') ? 1 : -1, sz = k.c.includes('n') ? -1 : 1;
    const nx = k.i * 100, nz = k.j * 100;
    const hv = hwV(k.i), hh = hwH(k.j);
    const kx = nx + sx * (hv + 6.4), kz = nz + sz * (hh + 6.4);
    const mx = nx + sx * (hv + 2.2), mz = nz + sz * (hh + 2.2);
    if (terrainH(kx, kz) < -0.5) return;
    const sets = W.sets[W.chunkIdx(kx, kz)], pm = sets.get('plain');
    const col = k.color || 0xffffff;
    pm.box(kx, 0.17, kz, 5.6, 3.4, 5.6, { col: 0xf2efe8, uvs: 3 });
    pm.box(kx, 3.5, kz, 6.2, 0.25, 6.2, { col, uvs: 3 });
    sets.get('facade_shop').box(kx - sx * 0.01, 0.9, kz, 5.65, 2.2, 5.65, { col: 0xffffff, fac: { cw: 2.8, ch: 2.2, ou: 1, ov: 0 }, top: false });
    // Markise zur Ecke
    pm.box(kx - sx * 3.4, 3.0, kz, 1.3, 0.14, 5.8, { col, uvs: 2 }); pm.box(kx, 3.0, kz - sz * 3.4, 5.8, 0.14, 1.3, { col, uvs: 2 });
    W.addBox(kx, kz, 5.7, 5.7, 3.6);
    const short = k.name.split('(')[0].trim().slice(0, 20);
    const yaw = Math.atan2(-sx, -sz);
    this.addSign(short.toUpperCase(), kx - sx * 1.2, 4.7, kz - sz * 1.2, yaw, 5.6, 1.6, '#' + (col).toString(16).padStart(6, '0'));
    this.poi({ id: k.id, kind: k.kind, name: k.name, x: mx, z: mz, menu: k.menu, job: k.job, race: k.race, luxe: k.luxe, color: col, shop: k.shop });
  }
  propertyGate(p) {
    const W = this.W;
    let mx, mz;
    if (p.i !== undefined) {
      const sx = p.c.includes('e') ? 1 : -1, sz = p.c.includes('n') ? -1 : 1;
      const nx = p.i * 100, nz = p.j * 100, hv = hwV(p.i), hh = hwH(p.j);
      mx = nx + sx * (hv + 2.2); mz = nz + sz * (hh + 2.2);
      const gx = nx + sx * (hv + 5.5), gz = nz + sz * (hh + 5.5);
      const pm = W.mb(gx, gz, 'plain');
      pm.box(gx, 0.17, gz, 1, 3.2, 1, { col: 0xdedad0, uvs: 2 }); pm.box(gx + sx * 3, 0.17, gz, 1, 3.2, 1, { col: 0xdedad0, uvs: 2 });
      pm.box(gx + sx * 1.5, 3.1, gz, 4, 0.5, 1, { col: 0x2b2f36, uvs: 2 });
      W.addBox(gx, gz, 1.1, 1.1, 3.2); W.addBox(gx + sx * 3, gz, 1.1, 1.1, 3.2);
      W.mb(gx, gz, 'neon').box(gx + sx * 1.5, 2.5, gz - 0.6 * sz, 3, 0.18, 0.1, { col: [0.2, 0.9, 0.4], uvs: 1 });
      if (p.type === 'villa' || p.type === 'beach' || p.type === 'penthouse') this.addSign(p.name.split('(')[0].trim().toUpperCase().slice(0, 22), gx + sx * 1.5, 4.6, gz - sz * 0.2, Math.atan2(-sx, -sz) * 0 + (sz < 0 ? Math.PI : 0), 5, 1.1, '#69f0ae');
    } else if (p.island) {
      const I = ISLANDS.find((q) => q.id === p.island);
      mx = I.x + (p.dx || 0); mz = I.z + (p.dz || 0);
    } else { mx = p.x; mz = p.z; }
    this.poi({ id: p.id, kind: 'property', name: p.name, x: mx, z: mz, prop: p });
  }

  // ================= WEITERES =================
  landmarks() { this.lm.all(); }
  countryside() { this.lm.countryside(); }

  signalsAndLamps() {
    const W = this.W;
    const geo = new THREE.BoxGeometry(0.32, 0.32, 0.12);
    const n = W.signals.length;
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }), n * 4 * 3);
    mesh.frustumCulled = false;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const pm = W.mb(0, 0, 'plain');
    W.signals.forEach((nd, si) => {
      const corners = [[1, -1, 'z'], [-1, 1, 'z'], [-1, -1, 'x'], [1, 1, 'x']];
      corners.forEach(([sx, sz, axis], ci) => {
        const x = nd.x + sx * (nd.hwV + 1.0), z = nd.z + sz * (nd.hwH + 1.0);
        const pmb = W.mb(x, z, 'plain');
        pmb.cyl(x, 0.16, z, 0.1, 4.6, 6, 0x2b2e33, { r2: 0.08, cap: false });
        pmb.box(x - sx * 0.1, 4.0, z - sz * 0.1, 0.5, 1.3, 0.5, { col: 0x15171a, uvs: 1 });
        W.addCircle(x, z, 0.18, 5, 'pole');
        for (let l = 0; l < 3; l++) {
          const idx = (si * 4 + ci) * 3 + l;
          // zur Kreuzungsmitte gerichtet
          const rotY = Math.atan2(-sx, -sz);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
          m4.compose(new THREE.Vector3(x - sx * 0.1 - sx * 0.2, 4.45 - l * 0.4, z - sz * 0.1 - sz * 0.2), q, new THREE.Vector3(1, 1, 1));
          mesh.setMatrixAt(idx, m4);
          mesh.setColorAt(idx, c.setRGB(0.05, 0.05, 0.05));
        }
      });
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    W.signalMesh = mesh; W.group.add(mesh);
  }
  landmarkPlaceholder() {}
}
