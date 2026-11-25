// Welt-Infrastruktur: Terrain, Straßennetz (Graph), Kollisionen, Chunks, Kartenbild
import * as THREE from 'three';
import { clamp, lerp, smoothstep, fbm, vnoise, hash2, RNG, circleAABB, nextFrame } from './util.js';
import { MB, MBSet } from './builder.js';
import { createMaterials, updateMaterialsForEnv } from './materials.js';
import { makeTerrainDetail } from './textures.js';
import { CityGen } from './city.js';

import { HALF, CS, NC, SEA, GX0, GX1, GZ0, GZ1, PITCH, RECTS, ROAD_W, FLAT, ISLANDS, coastX, inRect } from './consts.js';
export * from './consts.js';
const sdBox = (x, z, x0, x1, z0, z1) => {
  const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
  if (dx > 0 || dz > 0) return Math.hypot(dx, dz);
  return -Math.min(x - x0, x1 - x, z - z0, z1 - z);
};

// ---------- Terrainhöhe ----------
export function terrainH(x, z) {
  const d = sdBox(x, z, FLAT.x0, FLAT.x1, FLAT.z0, FLAT.z1);
  let h = -0.12;
  if (d > 0) {
    const w = smoothstep(0, 420, d);
    const hill = 2 + Math.max(0, fbm(x / 650 + 11, z / 650 + 5, 4, 3) - 0.28) * 95;
    const mtn = smoothstep(-1350, -2050, z) * fbm(x / 420 + 3, z / 420 + 9, 4, 8) * 110;
    h = lerp(-0.12, hill + mtn, w);
  }
  // Strand
  if (x > 1105) {
    const cx = coastX(z);
    const t = (x - 1105) / Math.max(1, cx - 1105);
    const beach = lerp(0.35, -0.3, smoothstep(0.45, 1, t));
    const blend = smoothstep(1105, 1128, x);
    h = lerp(h, beach, blend);
    const shore = x - cx;
    if (shore > -6) {
      const sea = SEA - 0.8 - Math.max(0, shore) * 0.12;
      h = lerp(h, Math.max(sea, -60), smoothstep(-6, 18, shore));
    }
  }
  // Hafenbecken
  const b = RECTS.bay;
  const bd = -sdBox(x, z, b.x0, b.x1, b.z0, b.z1);
  if (bd > 0) h = lerp(h, -14, smoothstep(0, 28, bd));
  // See im Nordwesten
  const ld = Math.hypot(x + 1650, z + 850);
  if (ld < 260) h = lerp(h, -9, smoothstep(260, 170, ld));
  // Inseln (Privatinseln)
  for (const I of ISLANDS) {
    const id = Math.hypot(x - I.x, z - I.z);
    if (id < I.r) h = Math.max(h, lerp(-4, I.h + vnoise(x / 40, z / 40) * 3, smoothstep(I.r, I.r * 0.45, id)));
  }
  // Inselrand der Welt
  const e = smoothstep(2250, 2400, Math.max(Math.abs(x), Math.abs(z)));
  h = lerp(h, -30, e);
  return h;
}
export const isWaterAt = (x, z) => terrainH(x, z) < SEA - 0.35;

export class SpatialHash {
  constructor(cell = 40) { this.cell = cell; this.m = new Map(); }
  _k(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  add(item, x0, z0, x1, z1) {
    const c = this.cell;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++) for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
      const k = this._k(ix, iz); let a = this.m.get(k); if (!a) { a = []; this.m.set(k, a); } a.push(item);
    }
  }
  query(x0, z0, x1, z1, out) {
    const c = this.cell; out.length = 0;
    const seen = SpatialHash._seen = (SpatialHash._seen || 0) + 1;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++) for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
      const a = this.m.get(this._k(ix, iz)); if (!a) continue;
      for (let i = 0; i < a.length; i++) { const it = a[i]; if (it._s !== seen) { it._s = seen; out.push(it); } }
    }
    return out;
  }
}

export class World {
  constructor(G) {
    this.G = G;
    this.group = new THREE.Group();
    this.group.name = 'world';
    this.M = createMaterials();
    this.colliders = new SpatialHash(40);
    this.nodes = new Map();       // key -> node
    this.nodeList = [];
    this.edges = [];
    this.lines = [];
    this.blocks = [];
    this.blockAt = new Map();
    this.chunks = [];
    this.skyline = new MBSet();
    this.sets = [];               // MBSet je Chunk
    this.pois = [];               // Interaktionspunkte
    this.animated = [];           // animierte Objekte (Kräne, Riesenrad, Windräder)
    this.parkSpots = [];          // Parkplätze für zufällige geparkte Autos
    this.signals = [];            // Ampelknoten
    this.lights = [];             // Straßenlaternen-Positionen
    this.dynamic = [];            // Objekte, die einzeln gesteuert werden
    this._tmp = [];
    this.waterTex = null;
    this.extras = []; this.ramps = [];
  }
  addExtra(x, z, obj) { this.extras.push({ idx: this.chunkIdx(x, z), obj }); }
  // Ampelphase: axis 'x' = Verkehr entlang x; Rückgabe 0 rot, 1 gelb, 2 grün
  signalState(n, axis, t) {
    const tt = (t + n.signal.off) % 32;
    if (axis === 'z') return tt < 12 ? 2 : tt < 15 ? 1 : 0;
    return tt >= 16 && tt < 28 ? 2 : tt >= 28 && tt < 31 ? 1 : 0;
  }

  chunkIdx(x, z) {
    const cx = clamp(Math.floor((x + HALF) / CS), 0, NC - 1), cz = clamp(Math.floor((z + HALF) / CS), 0, NC - 1);
    return cz * NC + cx;
  }
  mb(x, z, key) { return this.sets[this.chunkIdx(x, z)].get(key); }

  // ----- Kollisionen -----
  addBox(x, z, w, d, h, tag = 'b', y0 = 0) {
    const it = { t: 0, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h, y0, tag };
    this.colliders.add(it, it.x0, it.z0, it.x1, it.z1);
    return it;
  }
  addCircle(x, z, r, h = 3, tag = 'c') {
    const it = { t: 1, x, z, r, h, y0: 0, tag };
    this.colliders.add(it, x - r, z - r, x + r, z + r);
    return it;
  }
  // Kreis gegen Welt: liefert Verschiebungsvektor {x,z,hit,nx,nz,pen,tag}
  pushCircle(x, z, r, y = 0, out = { x: 0, z: 0, hit: false, nx: 0, nz: 0, pen: 0, tag: '' }) {
    out.x = 0; out.z = 0; out.hit = false; out.pen = 0;
    const list = this.colliders.query(x - r - 1, z - r - 1, x + r + 1, z + r + 1, this._tmp);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.h + c.y0 < y) continue;
      let r2 = null;
      if (c.t === 0) r2 = circleAABB(x + out.x, z + out.z, r, c.x0, c.z0, c.x1, c.z1);
      else {
        const dx = x + out.x - c.x, dz = z + out.z - c.z, d = Math.hypot(dx, dz), rr = r + c.r;
        if (d < rr) r2 = { nx: d > 1e-6 ? dx / d : 1, nz: d > 1e-6 ? dz / d : 0, pen: rr - d };
      }
      if (r2) { out.x += r2.nx * r2.pen; out.z += r2.nz * r2.pen; if (r2.pen > out.pen) { out.pen = r2.pen; out.nx = r2.nx; out.nz = r2.nz; out.tag = c.tag; } out.hit = true; }
    }
    return out;
  }
  // 3D-Strahl gegen Gebäude (für Kamera und Schüsse). Liefert Entfernung t oder null
  rayHit(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    const x1 = ox + dx * maxT, z1 = oz + dz * maxT;
    const list = this.colliders.query(Math.min(ox, x1) - 1, Math.min(oz, z1) - 1, Math.max(ox, x1) + 1, Math.max(oz, z1) + 1, this._tmp);
    for (const c of list) {
      let t0 = 0, t1 = maxT;
      let x0, X1, z0, Z1;
      if (c.t === 0) { x0 = c.x0; X1 = c.x1; z0 = c.z0; Z1 = c.z1; } else { x0 = c.x - c.r * 0.7; X1 = c.x + c.r * 0.7; z0 = c.z - c.r * 0.7; Z1 = c.z + c.r * 0.7; }
      const ys0 = c.y0, ys1 = c.y0 + c.h;
      const ax = [[ox, dx, x0, X1], [oy, dy, ys0, ys1], [oz, dz, z0, Z1]];
      let ok = true;
      for (const [o, dd, lo, hi] of ax) {
        if (Math.abs(dd) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } }
        else { let a = (lo - o) / dd, b = (hi - o) / dd; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; } }
      }
      if (ok && (best === null || t0 < best)) best = t0;
    }
    // Boden
    if (dy < 0) { const gy = this.groundY(ox + dx * 5, oz + dz * 5); const t = (gy - oy) / dy; if (t > 0 && t < maxT && (best === null || t < best)) best = t; }
    return best;
  }
  groundY(x, z) {
    let y = terrainH(x, z);
    const rs = this.ramps;
    if (rs.length) for (let i = 0; i < rs.length; i++) {
      const r = rs[i], dx = x - r.x, dz = z - r.z; if (dx * dx + dz * dz > r.rad2) continue;
      const sy = Math.sin(r.yaw), cy = Math.cos(r.yaw), u = dx * sy + dz * cy, v = dx * cy - dz * sy;
      if (Math.abs(v) < r.w / 2 && u > -r.len / 2 && u < r.len / 2) { const t = (u + r.len / 2) / r.len, hh = r.dir > 0 ? t * r.h : (1 - t) * r.h; if (hh > y) y = hh; }
    }
    return y;
  }
  addRamp(r) {
    r.rad2 = (r.len / 2 + r.w / 2 + 1) ** 2; this.ramps.push(r);
    const sy = Math.sin(r.yaw), cy = Math.cos(r.yaw), y0 = terrainH(r.x, r.z);
    const P = (u, v, y) => new THREE.Vector3(r.x + sy * u + cy * v, y + y0, r.z + cy * u - sy * v);
    const hs = r.len / 2, hw = r.w / 2, hLow = r.dir > 0 ? 0 : r.h, hHigh = r.dir > 0 ? r.h : 0;
    const g = new THREE.BufferGeometry();
    const a = P(-hs, -hw, hLow * 1 * (r.dir > 0 ? 0 : 1) + (r.dir > 0 ? 0 : 0)), pts = [];
    const lo = (r.dir > 0 ? 0 : r.h), hi = (r.dir > 0 ? r.h : 0);
    const A = P(-hs, -hw, lo), B = P(-hs, hw, lo), C = P(hs, hw, hi), D = P(hs, -hw, hi), A0 = P(-hs, -hw, 0), B0 = P(-hs, hw, 0), C0 = P(hs, hw, 0), D0 = P(hs, -hw, 0);
    const tri = (p, q, s) => pts.push(p, q, s);
    tri(A, D, C); tri(A, C, B); // Oberseite (Normale nach oben via Reihenfolge prüfen)
    tri(A0, A, B); tri(A0, B, B0); tri(D0, C, D); tri(D0, C0, C); tri(A0, D, A); tri(A0, D0, D); tri(B0, B, C); tri(B0, C, C0);
    g.setFromPoints(pts); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x331400 }));
    m.castShadow = m.receiveShadow = true; this.group.add(m); r.mesh = m;
    // Streifen
    for (let k = 0; k < 4; k++) { const u0 = -hs + (k + 0.5) * r.len / 4; const t = (u0 + hs) / r.len; const hh = r.dir > 0 ? t * r.h : (1 - t) * r.h; const st = new THREE.Mesh(new THREE.BoxGeometry(r.w * 0.9, 0.06, 0.5), new THREE.MeshBasicMaterial({ color: k % 2 ? 0xffffff : 0x111111 })); st.position.copy(P(u0, 0, hh + 0.04)); st.rotation.y = r.yaw; this.group.add(st); }
    return r;
  }
  isWater(x, z) { return terrainH(x, z) < SEA - 0.35; }
  // ----- Distrikt -----
  districtAt(x, z) {
    for (const k of ['airport', 'stadium', 'park', 'golf']) if (inRect(RECTS[k], x, z)) return RECTS[k].name;
    if (inRect(RECTS.bay, x, z)) return 'Hafenbecken';
    if (x > 1300 || z > 1450 || z < -1100 || x < -1500) {
      if (terrainH(x, z) < SEA - 0.5) return 'Offene See';
      if (z < -1500) return 'Vice-Berge';
      if (x < -1500) return 'Westliches Umland';
      if (z > 1450) return 'Südliches Umland';
      return 'Küstenregion';
    }
    if (x > 1100) return 'Ocean Beach';
    if (((x - 150) / 520) ** 2 + ((z + 100) / 420) ** 2 < 1) return 'Zentrum';
    if (x > 600 && z < 700) return 'Ocean Drive';
    if (z >= 700 && x > -100) return 'Hafen & Industrie';
    if (z < -700 && x > -400) return 'Sunset Hills';
    if (x < -500) return 'Westside';
    return 'Midtown';
  }
  blockTypeFor(x, z) {
    const d = this.districtAt(x, z);
    return { 'Zentrum': 'tower', 'Ocean Drive': 'deco', 'Hafen & Industrie': 'industrial', 'Sunset Hills': 'villa', 'Westside': 'residential', 'Midtown': 'mid' }[d] || 'mid';
  }

  // ----- Straßennetz -----
  segmentValid(x0, z0, x1, z1) {
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    for (const k of ['airport', 'park', 'golf', 'stadium', 'bay']) if (inRect(RECTS[k], mx, mz, 1)) return false;
    return true;
  }
  buildGraph() {
    const L = this.lines;
    for (let j = -10; j <= 12; j++) L.push({ horiz: true, c: j * PITCH, a: GX0, b: GX1, kind: j % 4 === 0 ? 'avenue' : 'street', city: true });
    for (let i = -14; i <= 11; i++) L.push({ horiz: false, c: i * PITCH, a: GZ0, b: GZ1, kind: i === 11 ? 'promenade' : i % 4 === 0 ? 'avenue' : 'street', city: true });
    for (const z of [-400, 0, 400]) L.push({ horiz: true, c: z, a: -1900, b: GX0, kind: 'highway' });
    for (const x of [-800, 0, 400, 800]) L.push({ horiz: false, c: x, a: -1900, b: GZ0, kind: 'highway' });
    for (const x of [-800, 0, 400]) L.push({ horiz: false, c: x, a: GZ1, b: 1900, kind: 'highway' });
    L.push({ horiz: false, c: -1900, a: -400, b: 400, kind: 'highway' });
    L.push({ horiz: true, c: -1900, a: -800, b: 800, kind: 'highway' });
    L.push({ horiz: true, c: 1900, a: -800, b: 400, kind: 'highway' });
    const key = (x, z) => x + '|' + z;
    const getNode = (x, z) => {
      const k = key(x, z); let n = this.nodes.get(k);
      if (!n) { n = { id: this.nodeList.length, x, z, out: [], hwH: 0, hwV: 0, city: false }; this.nodes.set(k, n); this.nodeList.push(n); }
      return n;
    };
    for (const line of L) {
      const W = ROAD_W[line.kind];
      for (let t = line.a; t < line.b; t += PITCH) {
        const x0 = line.horiz ? t : line.c, z0 = line.horiz ? line.c : t;
        const x1 = line.horiz ? t + PITCH : line.c, z1 = line.horiz ? line.c : t + PITCH;
        if (!this.segmentValid(x0, z0, x1, z1)) continue;
        const A = getNode(x0, z0), B = getNode(x1, z1);
        const speed = { avenue: 15, street: 11, highway: 26, promenade: 9 }[line.kind];
        const e = { a: A, b: B, kind: line.kind, w: W, horiz: line.horiz, len: PITCH, speed, id: this.edges.length };
        this.edges.push(e);
        const dx = (B.x - A.x) / PITCH, dz = (B.z - A.z) / PITCH;
        A.out.push({ to: B, edge: e, dx, dz, len: PITCH }); B.out.push({ to: A, edge: e, dx: -dx, dz: -dz, len: PITCH });
        if (line.horiz) { A.hwH = Math.max(A.hwH, W / 2); B.hwH = Math.max(B.hwH, W / 2); } else { A.hwV = Math.max(A.hwV, W / 2); B.hwV = Math.max(B.hwV, W / 2); }
        if (line.city) { A.city = B.city = true; }
      }
    }
    // Ampelknoten
    for (const n of this.nodeList) {
      if (n.city && n.out.length >= 3 && n.out.every((o) => o.edge.kind !== 'highway')) {
        n.signal = { off: hash2(n.x, n.z, 5) * 40 };
        this.signals.push(n);
      }
    }
  }
  nearestNode(x, z, maxD = 400) {
    // Gitter-nah: runden auf Raster
    const gx = Math.round(x / PITCH) * PITCH, gz = Math.round(z / PITCH) * PITCH;
    let best = null, bd = 1e9;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const n = this.nodes.get((gx + dx * PITCH) + '|' + (gz + dz * PITCH));
      if (!n) continue;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < bd) { bd = d; best = n; }
    }
    return bd <= maxD ? best : null;
  }
  // A* über Knoten
  findPath(from, to, maxIter = 4000) {
    if (!from || !to) return null;
    if (from === to) return [from];
    const open = [{ n: from, g: 0, f: 0 }], gs = new Map([[from, 0]]), prev = new Map();
    const closed = new Set();
    let it = 0;
    while (open.length && it++ < maxIter) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur.n === to) {
        const path = [to]; let p = to;
        while (prev.has(p)) { p = prev.get(p); path.push(p); }
        return path.reverse();
      }
      if (closed.has(cur.n)) continue;
      closed.add(cur.n);
      for (const o of cur.n.out) {
        const g = cur.g + o.len / (o.edge.speed / 10);
        if (g < (gs.get(o.to) ?? 1e9)) {
          gs.set(o.to, g); prev.set(o.to, cur.n);
          open.push({ n: o.to, g, f: g + Math.hypot(o.to.x - to.x, o.to.z - to.z) / 2.6 });
        }
      }
    }
    return null;
  }
  randomNode(rng, cond) {
    for (let i = 0; i < 40; i++) { const n = this.nodeList[Math.floor(rng() * this.nodeList.length)]; if (!cond || cond(n)) return n; }
    return this.nodeList[0];
  }

  // ----- Aufbau -----
  async build(progress = () => {}) {
    const G = this.G;
    for (let i = 0; i < NC * NC; i++) this.sets.push(new MBSet());
    progress(0.02, 'Straßennetz wird geplant …');
    this.buildGraph();
    await nextFrame();
    const city = new CityGen(this, G);
    this.city = city;
    // Terrain
    progress(0.05, 'Gelände wird modelliert …');
    this.terrainMeshes = [];
    for (let cz = 0; cz < NC; cz++) {
      for (let cx = 0; cx < NC; cx++) this.buildTerrainChunk(cx, cz);
      if (cz % 3 === 2) { progress(0.05 + 0.15 * cz / NC, 'Gelände wird modelliert …'); await nextFrame(); }
    }
    progress(0.2, 'Straßen werden asphaltiert …');
    city.roads();
    await nextFrame();
    progress(0.28, 'Wolkenkratzer wachsen …');
    await city.blocks(progress, nextFrame);
    progress(0.8, 'Landmarken & Umland …');
    await nextFrame();
    city.landmarks();
    await nextFrame();
    city.countryside();
    await nextFrame();
    progress(0.92, 'Beleuchtung & Ampeln …');
    city.signalsAndLamps();
    // Meshes zusammensetzen
    this.chunkGroups = [];
    for (let i = 0; i < this.sets.length; i++) {
      const g = new THREE.Group();
      const cx = i % NC, cz = Math.floor(i / NC);
      g.userData.cx = -HALF + (cx + 0.5) * CS; g.userData.cz = -HALF + (cz + 0.5) * CS;
      for (const [k, mb] of this.sets[i].m) {
        if (mb.count === 0) continue;
        const mesh = new THREE.Mesh(mb.build(), this.M[k] || this.M.plain);
        mesh.castShadow = !['asphalt', 'sidewalk', 'grass', 'sand', 'concrete', 'dirt', 'plaza', 'glow', 'runway', 'pitch'].includes(k) && k !== 'glassClear';
        mesh.receiveShadow = k !== 'glow' && k !== 'neon' && k !== 'lamp';
        if (k === 'glow') { mesh.renderOrder = 5; mesh.castShadow = false; }
        mesh.matrixAutoUpdate = false;
        g.add(mesh);
      }
      this.group.add(g);
      this.chunkGroups.push(g);
    }
    for (const e of this.extras) this.chunkGroups[e.idx].add(e.obj);
    // Skyline (immer sichtbar)
    for (const [k, mb] of this.skyline.m) {
      if (mb.count === 0) continue;
      const mesh = new THREE.Mesh(mb.build(), this.M[k] || this.M.plain);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false; mesh.name = 'skyline';
      this.group.add(mesh);
    }
    for (const m of this.terrainMeshes) this.group.add(m);
    this.buildMapCanvas();
    progress(1, 'Fertig');
  }

  // ----- Terrain -----
  buildTerrainChunk(cx, cz) {
    const x0 = -HALF + cx * CS, z0 = -HALF + cz * CS;
    // Auflösung bestimmen
    let flat = true, wet = false, minH = 1e9, maxH = -1e9;
    for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6; b++) {
      const h = terrainH(x0 + a * CS / 6, z0 + b * CS / 6);
      minH = Math.min(minH, h); maxH = Math.max(maxH, h);
    }
    if (maxH - minH > 0.01) flat = false;
    const coastal = minH < SEA - 0.2 || (x0 + CS > 1050 && x0 < 1420 && maxH > -50) || (maxH - minH > 0.3 && minH < 2);
    const N = flat ? 2 : coastal ? 60 : 30;
    const step = CS / N;
    const pos = new Float32Array((N + 1) * (N + 1) * 3), nor = new Float32Array((N + 1) * (N + 1) * 3), col = new Float32Array((N + 1) * (N + 1) * 3), uv = new Float32Array((N + 1) * (N + 1) * 2);
    const c = new THREE.Color();
    const rng = new RNG(cx * 97 + cz * 31 + 7);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = x0 + i * step, z = z0 + j * step, h = terrainH(x, z);
      const k = j * (N + 1) + i;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const e = 2.5;
      const hx = terrainH(x + e, z) - terrainH(x - e, z), hz = terrainH(x, z + e) - terrainH(x, z - e);
      const nl = Math.hypot(hx, 2 * e, hz);
      nor[k * 3] = -hx / nl; nor[k * 3 + 1] = 2 * e / nl; nor[k * 3 + 2] = -hz / nl;
      const slope = Math.hypot(hx, hz) / (2 * e);
      // Farbe
      const n = fbm(x / 60, z / 60, 3, 4);
      if (h < SEA - 0.1) c.setRGB(0.42, 0.38, 0.3).lerp(new THREE.Color(0.55, 0.5, 0.38), smoothstep(-6, -0.3, h));
      else if (h < 0.9 && x > 1100 && x < 1500) c.setHex(0xe4d3a4).multiplyScalar(0.9 + n * 0.15);
      else if (slope > 0.55 || h > 85) c.setRGB(0.42, 0.4, 0.37).multiplyScalar(0.8 + n * 0.5);
      else if (h > 60) c.setHex(0x6c7a50).lerp(new THREE.Color(0x8a8a7e), smoothstep(60, 90, h));
      else {
        const f = fbm(x / 140 + 20, z / 140 - 5, 3, 12);
        c.setHex(0x587a36).lerp(new THREE.Color(0x3c5a2a), smoothstep(0.45, 0.65, f)).lerp(new THREE.Color(0x8a8a4a), smoothstep(0.5, 0.2, n) * 0.5);
        if (flat) c.setHex(0x6b6e66);
      }
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      uv[k * 2] = x / 16; uv[k * 2 + 1] = -z / 16;
    }
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, d = a + N + 1, e2 = d + 1;
      idx.push(a, d, b, b, d, e2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    if (!this._terrainMat) this._terrainMat = new THREE.MeshStandardMaterial({ map: makeTerrainDetail(), vertexColors: true, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(g, this._terrainMat);
    mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    mesh.userData.cx = x0 + CS / 2; mesh.userData.cz = z0 + CS / 2;
    this.terrainMeshes.push(mesh);
  }

  // ----- Sichtbarkeit -----
  updateVisibility(px, pz, dist) {
    const lim = dist + CS * 0.75;
    for (const g of this.chunkGroups) g.visible = Math.hypot(g.userData.cx - px, g.userData.cz - pz) < lim;
    const tl = dist * 1.9 + CS;
    for (const m of this.terrainMeshes) m.visible = Math.hypot(m.userData.cx - px, m.userData.cz - pz) < tl;
  }

  // ----- Karte (Offscreen-Canvas, wird von Minimap und Vollkarte genutzt) -----
  buildMapCanvas() {
    const S = 1536, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    const k = S / (HALF * 2);
    const px = (wx) => (wx + HALF) * k, pz = (wz) => (wz + HALF) * k;
    const img = x.createImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const wx = i / k - HALF, wz = j / k - HALF;
      const h = terrainH(wx, wz);
      let r, g, b;
      if (h < SEA - 0.35) { const d = clamp(-h / 25, 0, 1); r = 28 - d * 14; g = 70 - d * 28; b = 120 - d * 40; }
      else if (h < 0.9 && wx > 1100 && wx < 1500) { r = 214; g = 198; b = 150; }
      else {
        const s = 1 + (terrainH(wx + 8, wz + 8) - h) * 0.03;
        const hh = clamp(h / 90, 0, 1);
        r = lerp(70, 128, hh) * s; g = lerp(100, 120, hh) * s; b = lerp(58, 100, hh) * s;
      }
      const o = (j * S + i) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // Blöcke
    const colors = { tower: '#6d7480', mid: '#7a7e86', deco: '#c6a98a', industrial: '#6d6a68', residential: '#8a8f78', villa: '#7f9a68', park: '#4f8a3c', plaza: '#a49d8c', construction: '#8a7a5c', special: '#8a8f99' };
    for (const b of this.blocks) {
      x.fillStyle = colors[b.type] || '#777';
      x.fillRect(px(b.x0), pz(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
    }
    const rc = { airport: '#555a62', park: '#3c7a34', golf: '#3f8a3a', stadium: '#8c8c94' };
    for (const key of Object.keys(rc)) { const r = RECTS[key]; x.fillStyle = rc[key]; x.fillRect(px(r.x0), pz(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k); }
    // Straßen
    x.lineCap = 'butt';
    for (const e of this.edges) {
      x.strokeStyle = e.kind === 'avenue' ? '#f2e6c4' : e.kind === 'highway' ? '#e8b24a' : '#d9d5cc';
      x.lineWidth = Math.max(1.2, e.w * k * (e.kind === 'avenue' ? 1.05 : 0.9));
      x.beginPath(); x.moveTo(px(e.a.x), pz(e.a.z)); x.lineTo(px(e.b.x), pz(e.b.z)); x.stroke();
    }
    // Landebahn
    x.strokeStyle = '#2d3036'; x.lineWidth = 40 * k; x.beginPath(); x.moveTo(px(-1350), pz(850)); x.lineTo(px(-550), pz(850)); x.stroke();
    this.mapCanvas = c; this.mapScale = k;
  }
}
