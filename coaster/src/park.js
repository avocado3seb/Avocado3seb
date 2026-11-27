// ============================================================================
//  park.js – komplette Parkwelt: Bahnen platzieren, Wege, Gebäude, Wahrzeichen,
//  Fahrgeschäfte, Bäume, Hügel, Besucher
// ============================================================================
import { visitorGeometries } from './pl_figures.js';
import * as THREE from 'three';
import { buildTrack } from './track.js';
import { Sim } from './physics.js';
import { genLayout, mulberry32, hashStr } from './gen.js';
import { CATS } from './specs.js';
import { buildCoasterMesh, buildStation } from './coasterMesh.js';
import { createTrain } from './train.js';
import { textures, signTexture } from './textures.js';

const TAU = Math.PI * 2;
const trackCache = new Map();

export function getTrack(c) {
  if (!trackCache.has(c.id)) {
    const spec = CATS[c.cat] || CATS.sitdown;
    const layout = c.layout || genLayout(c);
    const tr = buildTrack(layout, { trainLen: spec.cars * spec.spacing });
    tr.layoutText = layout;
    tr.yOff = spec.clearance - tr.bounds.minY;
    trackCache.set(c.id, tr);
  }
  return trackCache.get(c.id);
}
export function clearTrackCache(id) { if (id) trackCache.delete(id); else trackCache.clear(); }

// ---------------------------------------------------------------------------
class Grid {
  constructor(cell = 6) { this.c = cell; this.m = new Set(); }
  key(i, j) { return i * 100003 + j; }
  mark(x, z, r) {
    const c = this.c, i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) this.m.add(this.key(i, j));
  }
  free(x, z, r) {
    const c = this.c, i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (this.m.has(this.key(i, j))) return false;
    return true;
  }
}

const THEMES = {
  central:  { walls: ['#efe6d0', '#e8dcc0', '#f2ecd8'], trim: '#5a3a22', style: 'timber', roof: ['#9b3b2a', '#7a3a2a'], lamp: '#fff2c0' },
  alpine:   { walls: ['#c99a64', '#b98a5a', '#e8dcc0'], trim: '#5a3a22', style: 'timber', roof: ['#6a4a32', '#4a3a2a'], lamp: '#ffe8b0' },
  dutch:    { walls: ['#a8503c', '#b85a44', '#9a4a38'], trim: '#e8e0d0', style: 'brick', roof: ['#3a3a42', '#4a2a2a'], lamp: '#fff2c0' },
  british:  { walls: ['#a85a40', '#c8a878', '#8a8a7a'], trim: '#2a2a30', style: 'brick', roof: ['#3a3e48', '#4a4a50'], lamp: '#ffeab0' },
  nordic:   { walls: ['#a8382a', '#d8a82a', '#3a5a8a', '#e8e0d0'], trim: '#f4f0e4', style: 'plaster', roof: ['#2a2a30', '#4a2a22'], lamp: '#ffe0a0' },
  med:      { walls: ['#e8c898', '#f0d8b0', '#e8a888', '#f2ecd8'], trim: '#a85a3a', style: 'plaster', roof: ['#b8502e', '#c8623a'], lamp: '#ffe8b8' },
  atlantic: { walls: ['#e8e0c8', '#d8d0b8', '#f0e8d0'], trim: '#6a6a72', style: 'plaster', roof: ['#4a4e5a', '#5a5e6a'], lamp: '#fff0c0' },
  slavic:   { walls: ['#e8d8a8', '#d8b8a0', '#c8d8b0'], trim: '#6a4a3a', style: 'plaster', roof: ['#a8402e', '#8a3a2a'], lamp: '#fff0c0' },
};

const matCache = {};
const stdMat = (key, make) => matCache[key] || (matCache[key] = make());

export function gableGeometry(w, d, h) {
  // Satteldach, Firstrichtung entlang x
  const hw = w / 2, hd = d / 2, o = 0.5;
  const p = [
    [-hw - o, 0, -hd - o], [hw + o, 0, -hd - o], [hw + o, 0, hd + o], [-hw - o, 0, hd + o], [-hw - o, h, 0], [hw + o, h, 0],
  ];
  const tri = [
    [0, 1, 5, 4], [3, 4, 5, 2], // Dachflächen
  ];
  const pos = [], uv = [], idx = [];
  const add = (a, b, c, d2) => {
    const i = pos.length / 3;
    for (const q of [a, b, c, d2]) pos.push(...p[q]);
    uv.push(0, 0, 4, 0, 4, 2, 0, 2);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  add(0, 1, 5, 4); add(2, 3, 4, 5);
  // Giebel
  const g = pos.length / 3;
  pos.push(-hw - o, 0, -hd - o, -hw - o, 0, hd + o, -hw - o, h, 0, hw + o, 0, hd + o, hw + o, 0, -hd - o, hw + o, h, 0);
  uv.push(0, 0, 1, 0, .5, 1, 0, 0, 1, 0, .5, 1);
  idx.push(g, g + 1, g + 2, g + 3, g + 4, g + 5);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

export class ParkWorld {
  constructor(parkDef, env, opts = {}) {
    this.def = parkDef; this.env = env; this.opts = opts;
    this.group = new THREE.Group(); this.group.name = 'park:' + parkDef.name;
    this.rng = mulberry32(hashStr(parkDef.name));
    this.rides = []; this.anims = []; this.nodes = []; this.edges = [];
    this.grid = new Grid(6);
    this.theme = THEMES[parkDef.theme] || THEMES.central;
    this.quality = opts.quality || 'high';
    this.build();
  }

  R(a = 0, b = 1) { return a + (b - a) * this.rng(); }

  // ------------------------------------------------------------------ Aufbau
  build() {
    this.placeRides();
    this.buildPaths();
    this.buildGround();
    this.buildPlaza();
    this.buildBuildings();
    this.buildLandmarks();
    this.buildFlats();
    this.buildWater();
    this.buildTrees();
    this.buildScenery();
    this.buildVisitors();
    this.buildMinimapData();
  }

  placeRides() {
    const coasters = [...this.def.coasters];
    const infos = coasters.map(c => {
      const tr = getTrack(c), b = tr.bounds, L = tr.stationLen || 28;
      const m = 14;
      const minX = Math.min(b.minX, 0) - m, maxX = Math.max(b.maxX, L) + m, minZ = Math.min(b.minZ, 0) - m, maxZ = Math.max(b.maxZ, 40) + m;
      return { c, tr, minX, maxX, minZ, maxZ, area: (maxX - minX) * (maxZ - minZ) };
    });
    infos.sort((a, b) => b.area - a.area);
    const placed = [{ x0: -70, x1: 70, z0: -70, z1: 70 }];
    const hub = new THREE.Vector2(0, 0), margin = 22;
    const rot = (x, z, th) => [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
    for (const inf of infos) {
      let best = null;
      for (let k = 0; k < 900 && !best; k++) {
        const ang = k * 2.39996 + this.R(0, 0.4), rad = 120 + 30 * Math.sqrt(k) * 1.5;
        const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad;
        const cands = [];
        for (let r = 0; r < 4; r++) {
          const th = r * Math.PI / 2;
          const [ex, ez] = rot(0, 1, th);   // lokale +z-Richtung (Eingang) in Welt
          const mx = (inf.minX + inf.maxX) / 2, mz = (inf.minZ + inf.maxZ) / 2;
          const [wx, wz] = rot(mx, mz, th);
          const ox = cx - wx, oz = cz - wz;  // Ursprung der Bahn
          const dirHub = new THREE.Vector2(-cx, -cz).normalize();
          cands.push({ th, ox, oz, score: ex * dirHub.x + ez * dirHub.y });
        }
        cands.sort((a, b) => b.score - a.score);
        for (const cd of cands) {
          const cs = [[inf.minX, inf.minZ], [inf.maxX, inf.minZ], [inf.maxX, inf.maxZ], [inf.minX, inf.maxZ]].map(([x, z]) => { const [wx, wz] = rot(x, z, cd.th); return [wx + cd.ox, wz + cd.oz]; });
          const box = { x0: Math.min(...cs.map(p => p[0])) - margin, x1: Math.max(...cs.map(p => p[0])) + margin, z0: Math.min(...cs.map(p => p[1])) - margin, z1: Math.max(...cs.map(p => p[1])) + margin };
          if (placed.every(p => box.x1 < p.x0 || box.x0 > p.x1 || box.z1 < p.z0 || box.z0 > p.z1)) { best = { ...cd, box }; break; }
        }
      }
      if (!best) best = { th: 0, ox: 400 + this.rides.length * 300, oz: 0, box: { x0: 0, x1: 0, z0: 0, z1: 0 } };
      placed.push(best.box);
      this.addRide(inf, best);
    }
    // Gesamtausdehnung
    let R = 160;
    for (const b of placed) R = Math.max(R, Math.hypot(Math.max(Math.abs(b.x0), Math.abs(b.x1)), Math.max(Math.abs(b.z0), Math.abs(b.z1))));
    this.radius = R;
  }

  addRide(inf, pl) {
    const { c, tr } = inf;
    const spec = CATS[c.cat] || CATS.sitdown;
    const g = new THREE.Group();
    g.position.set(pl.ox, 0, pl.oz); g.rotation.y = pl.th;
    g.add(buildCoasterMesh(tr, c, { yOff: tr.yOff }));
    const st = buildStation(tr, c, spec, tr.yOff);
    g.add(st);
    const sim = new Sim(tr, { cars: spec.cars, spacing: spec.spacing, crr: spec.crr, delay: this.R(0, 18) + this.rides.length * 7, dispatch: 9 });
    const train = createTrain(tr, c, spec.cars, tr.yOff);
    g.add(train.group);
    this.group.add(g);
    // Eingang in Weltkoordinaten
    const loc = st.userData.entrance;
    const th = pl.th;
    const ex = pl.ox + loc.x * Math.cos(th) + loc.z * Math.sin(th), ez = pl.oz - loc.x * Math.sin(th) + loc.z * Math.cos(th);
    const dir = [Math.sin(th), Math.cos(th)];
    const ride = { coaster: c, track: tr, sim, train, group: g, spec, entrance: new THREE.Vector3(ex, 0, ez), dir, th, ox: pl.ox, oz: pl.oz, yOff: tr.yOff };
    this.rides.push(ride);
    // belegte Zellen entlang der Strecke
    const cos = Math.cos(th), sin = Math.sin(th);
    for (let i = 0; i < tr.N; i += 4) {
      const x = tr.P[i * 3], z = tr.P[i * 3 + 2];
      this.grid.mark(pl.ox + x * cos + z * sin, pl.oz - x * sin + z * cos, 9);
    }
    this.grid.mark(ex, ez, 10);
  }

  worldOf(ride, lx, ly, lz, out = new THREE.Vector3()) {
    const th = ride.th;
    return out.set(ride.ox + lx * Math.cos(th) + lz * Math.sin(th), ly, ride.oz - lx * Math.sin(th) + lz * Math.cos(th));
  }

  // ------------------------------------------------------------------ Wege
  node(x, z) {
    for (let i = 0; i < this.nodes.length; i++) if (Math.hypot(this.nodes[i].x - x, this.nodes[i].z - z) < 1.5) return i;
    this.nodes.push({ x, z, adj: [] }); return this.nodes.length - 1;
  }
  edge(a, b, w = 6) {
    if (a === b) return;
    if (this.nodes[a].adj.includes(b)) return;
    this.nodes[a].adj.push(b); this.nodes[b].adj.push(a);
    this.edges.push([a, b, w]);
  }

  buildPaths() {
    const hub = this.node(0, 0);
    this.gate = new THREE.Vector3(0, 0, 100 + Math.min(160, this.rides.length * 8));
    const gnode = this.node(this.gate.x, this.gate.z);
    const g2 = this.node(0, 62);
    this.edge(gnode, g2, 10); this.edge(g2, hub, 10);
    const sorted = [...this.rides].sort((a, b) => Math.atan2(a.entrance.z, a.entrance.x) - Math.atan2(b.entrance.z, b.entrance.x));
    const approach = [];
    for (const r of sorted) {
      const A = r.entrance.clone().add(new THREE.Vector3(r.dir[0] * 12, 0, r.dir[1] * 12));
      const an = this.node(A.x, A.z), en = this.node(r.entrance.x, r.entrance.z);
      r.pathNode = an; r.entranceNode = en;
      this.edge(an, en, 5);
      // Hauptweg zum Hub – Knick, damit es nicht diagonal quer läuft
      const horizFirst = Math.abs(A.x) > Math.abs(A.z);
      const mid = horizFirst ? this.node(A.x, 0) : this.node(0, A.z);
      if (mid !== hub && mid !== an) { this.edge(hub, mid, 7); this.edge(mid, an, 6); } else this.edge(hub, an, 7);
      approach.push(an);
    }
    for (let i = 0; i < approach.length; i++) {
      if (approach.length > 2) this.edge(approach[i], approach[(i + 1) % approach.length], 5);
    }
    // Geometrie
    const pos = [], uv = [], idx = [];
    const quad = (ax, az, bx, bz, w) => {
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2;
      const i = pos.length / 3;
      pos.push(ax + nx, 0.05, az + nz, ax - nx, 0.05, az - nz, bx - nx, 0.05, bz - nz, bx + nx, 0.05, bz + nz);
      uv.push(0, 0, 1, 0, 1, L / w, 0, L / w);
      idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    };
    for (const [a, b, w] of this.edges) {
      const A = this.nodes[a], B = this.nodes[b];
      quad(A.x, A.z, B.x, B.z, w);
      this.grid.mark(A.x, A.z, w / 2 + 1.5);
      const L = Math.hypot(B.x - A.x, B.z - A.z);
      for (let t = 0; t <= L; t += 4) this.grid.mark(A.x + (B.x - A.x) * t / L, A.z + (B.z - A.z) * t / L, w / 2 + 2);
    }
    for (const n of this.nodes) { // Knoten-Kreise
      const i = pos.length / 3, r = 4;
      pos.push(n.x, 0.05, n.z); uv.push(.5, .5);
      for (let k = 0; k <= 12; k++) { const a = k / 12 * TAU; pos.push(n.x + Math.cos(a) * r, 0.05, n.z + Math.sin(a) * r); uv.push(.5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5); }
      for (let k = 0; k < 12; k++) idx.push(i, i + 1 + k, i + 2 + k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const tex = textures.paving().clone(); tex.needsUpdate = true; tex.repeat.set(1, 1);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: textures.paving(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mesh.receiveShadow = true; this.group.add(mesh);
    // Laternen entlang der Wege
    this.lamps = [];
    for (const [a, b, w] of this.edges) {
      const A = this.nodes[a], B = this.nodes[b], L = Math.hypot(B.x - A.x, B.z - A.z);
      if (w < 6) continue;
      const nx = -(B.z - A.z) / L, nz = (B.x - A.x) / L;
      for (let t = 12; t < L - 8; t += 30) {
        const side = ((t / 30) | 0) % 2 ? 1 : -1;
        this.lamps.push([A.x + (B.x - A.x) * t / L + nx * (w / 2 + 1) * side, A.z + (B.z - A.z) * t / L + nz * (w / 2 + 1) * side]);
      }
    }
  }

  // ------------------------------------------------------------------ Boden
  buildGround() {
    const size = (this.radius + 2400) * 2;
    const tex = textures.grass().clone(); tex.repeat.set(size / 28, size / 28); tex.needsUpdate = true;
    // unterteilt (keine riesigen Dreiecke): sonst werden Tiefenwerte ungenau und der Boden kann Wege/Plätze überdecken
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 64, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: this.def.theme === 'nordic' ? 0xaaccaa : 0xffffff }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.group.add(ground);
    this.ground = ground;
    // Hügel-Ring am Horizont
    const steps = 220, R0 = this.radius + 1400, pos = [], col = [], idx = [];
    const alpine = this.def.theme === 'alpine' || this.def.theme === 'nordic';
    const hillCol = alpine ? [0.34, 0.42, 0.34] : [0.3, 0.45, 0.28];
    for (let i = 0; i <= steps; i++) {
      const a = i / steps * TAU;
      const n = Math.sin(a * 3 + 1) * 0.5 + Math.sin(a * 7 + 2) * 0.3 + Math.sin(a * 17 + 4) * 0.15 + 0.6;
      const h = (alpine ? 380 : 120) * Math.max(0.1, n);
      for (const [r, y, shade] of [[R0 - 300, -4, 1], [R0, h * 0.55, 1.0], [R0 + 500, h, alpine && h > 300 ? 1.5 : 0.9]]) {
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        const k = shade * (0.85 + 0.15 * Math.sin(i * 1.7));
        col.push(Math.min(1, hillCol[0] * k), Math.min(1, hillCol[1] * k), Math.min(1, hillCol[2] * k));
      }
    }
    for (let i = 0; i < steps; i++) for (let k = 0; k < 2; k++) {
      const a = i * 3 + k, b = a + 1, c = a + 3, d = a + 4;
      idx.push(a, c, b, b, c, d);
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    hg.setIndex(idx); hg.computeVertexNormals();
    const hills = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    this.group.add(hills);
  }

  // ------------------------------------------------------------------ Hub-Plaza, Tor
  buildPlaza() {
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(48, 48), new THREE.MeshStandardMaterial({ map: textures.paving(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.06; plaza.receiveShadow = true; plaza.material.map = textures.paving().clone(); plaza.material.map.repeat.set(8, 8); plaza.material.map.needsUpdate = true;
    this.group.add(plaza);
    this.grid.mark(0, 0, 50);
    // Brunnen
    const stone = new THREE.MeshStandardMaterial({ color: 0xb0aca0, roughness: 0.9 });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.4, 24), stone); bowl.position.y = 0.7; bowl.castShadow = bowl.receiveShadow = true; this.group.add(bowl);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.2, 0.1, 24), new THREE.MeshStandardMaterial({ map: textures.water(), color: 0x6ab0d8, roughness: 0.1, metalness: 0.2 })); w.position.y = 1.35; this.group.add(w);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 5, 10), stone); col.position.y = 3.5; col.castShadow = true; this.group.add(col);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); jet.position.y = 7.2; this.group.add(jet);
    // Eingangstor
    const gate = new THREE.Group(); gate.position.copy(this.gate);
    const pillar = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.theme.walls[0]), roughness: 0.85, map: textures.plaster() });
    const roofM = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.theme.roof[0]), roughness: 0.7 });
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(5, 14, 5), pillar); p.position.set(sx * 16, 7, 0); p.castShadow = true; gate.add(p);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(4.6, 4, 4), roofM); cap.position.set(sx * 16, 16, 0); cap.rotation.y = Math.PI / 4; gate.add(cap);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(38, 4.5, 3), pillar); beam.position.set(0, 15, 0); beam.castShadow = true; gate.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5), new THREE.MeshBasicMaterial({ map: signTexture(this.def.name, '#c8202e', '#ffffff', this.def.city ? this.def.city + ' · ' + (this.def.cc || '') : '') }));
    sign.position.set(0, 21, 0); gate.add(sign);
    const sign2 = sign.clone(); sign2.rotation.y = Math.PI; sign2.position.z = -0.1; gate.add(sign2);
    this.group.add(gate);
    this.grid.mark(this.gate.x, this.gate.z, 20);
  }

  // ------------------------------------------------------------------ Gebäude
  buildBuildings() {
    const th = this.theme, count = 14 + this.rides.length * 5;
    const edges = this.edges.filter(e => e[2] >= 5);
    let tries = 0, made = 0;
    this.buildings = [];
    while (made < count && tries++ < count * 25) {
      const e = edges[Math.floor(this.rng() * edges.length)];
      const A = this.nodes[e[0]], B = this.nodes[e[1]], L = Math.hypot(B.x - A.x, B.z - A.z);
      if (L < 30) continue;
      const t = this.R(10, L - 10), side = this.rng() < 0.5 ? -1 : 1;
      const nx = -(B.z - A.z) / L, nz = (B.x - A.x) / L, ux = (B.x - A.x) / L, uz = (B.z - A.z) / L;
      const w = this.R(10, 22), d = this.R(8, 14), h = this.R(4.5, 9);
      const off = e[2] / 2 + 3 + d / 2;
      const x = A.x + ux * t + nx * off * side, z = A.z + uz * t + nz * off * side;
      if (!this.grid.free(x, z, Math.max(w, d) / 2 + 2)) continue;
      const ang = Math.atan2(uz, ux);
      this.makeBuilding(x, z, -ang + (side > 0 ? Math.PI : 0), w, d, h, th);
      this.grid.mark(x, z, Math.max(w, d) / 2 + 2);
      made++;
    }
  }

  makeBuilding(x, z, rotY, w, d, h, th, floors) {
    const rng = this.rng;
    const wall = th.walls[Math.floor(rng() * th.walls.length)];
    const tex = textures.facade(wall, th.trim, th.style);
    const key = 'wall:' + wall + th.trim + th.style;
    const sideMat = stdMat(key, () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    const plain = stdMat('plain:' + wall, () => new THREE.MeshStandardMaterial({ color: wall, roughness: 0.9 }));
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    const scale = [[d, h], [d, h], [1, 1], [1, 1], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * scale[f][0] / 7, uv.getY(k) * scale[f][1] / 7); }
    const m = new THREE.Mesh(geo, [sideMat, sideMat, plain, plain, sideMat, sideMat]);
    m.position.y = h / 2; m.castShadow = true; m.receiveShadow = true;
    const g = new THREE.Group(); g.add(m);
    const roofCol = th.roof[Math.floor(rng() * th.roof.length)];
    const roofMat = stdMat('roof:' + roofCol, () => new THREE.MeshStandardMaterial({ map: textures.roofTile(), color: roofCol, roughness: 0.8, side: THREE.DoubleSide }));
    const rh = Math.min(w, d) * this.R(0.28, 0.5);
    const roof = new THREE.Mesh(gableGeometry(w, d, rh), roofMat); roof.position.y = h; roof.castShadow = true; g.add(roof);
    g.position.set(x, 0, z); g.rotation.y = rotY;
    this.group.add(g);
    this.buildings.push({ x, z });
    return g;
  }

  // ------------------------------------------------------------------ Wahrzeichen
  buildLandmarks() {
    const lms = this.def.lm || [];
    const gateDir = Math.PI / 2; // Tor liegt bei +z
    let k = 0;
    for (const kind of lms) {
      const a = gateDir + Math.PI + (k - (lms.length - 1) / 2) * 0.9 + this.R(-0.2, 0.2);
      let placed = false;
      for (let rad = 95; rad < 200 && !placed; rad += 14) {
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        if (!this.grid.free(x, z, 28)) continue;
        const obj = this.makeLandmark(kind);
        if (!obj) break;
        obj.position.set(x, 0, z); obj.rotation.y = Math.atan2(-z, x) + Math.PI / 2;
        this.group.add(obj); this.grid.mark(x, z, 28); placed = true;
        this.landmarks = (this.landmarks || []); this.landmarks.push({ kind, x, z });
      }
      k++;
    }
  }

  makeLandmark(kind) {
    const g = new THREE.Group();
    const stone = stdMat('lm:stone', () => new THREE.MeshStandardMaterial({ color: 0xc2baa6, roughness: 0.95, map: textures.concrete() }));
    const roofC = new THREE.Color(this.theme.roof[0]);
    const roofM = new THREE.MeshStandardMaterial({ color: roofC, roughness: 0.7 });
    const add = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
    const lamp = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe0a0, emissiveIntensity: 0, roughness: 0.5 }); this.env.registerLamp(lamp);
    switch (kind) {
      case 'castle': {
        add(new THREE.BoxGeometry(22, 26, 18), stone, 0, 13, 0);
        add(new THREE.ConeGeometry(14, 14, 4), roofM, 0, 33, 0).rotation.y = Math.PI / 4;
        for (const [sx, sz] of [[-17, -14], [17, -14], [-17, 14], [17, 14]]) {
          add(new THREE.CylinderGeometry(4.5, 5, 30, 12), stone, sx, 15, sz);
          add(new THREE.ConeGeometry(6, 10, 12), roofM, sx, 35, sz);
          add(new THREE.BoxGeometry(1.2, 2.4, 1), lamp, sx, 22, sz + 4.6 * Math.sign(sz));
        }
        add(new THREE.BoxGeometry(34, 12, 2), stone, 0, 6, -14); add(new THREE.BoxGeometry(34, 12, 2), stone, 0, 6, 14);
        add(new THREE.BoxGeometry(2, 12, 28), stone, -17, 6, 0); add(new THREE.BoxGeometry(2, 12, 28), stone, 17, 6, 0);
        break;
      }
      case 'pyramid': {
        const t = textures.plaster().clone(); t.repeat.set(6, 6); t.needsUpdate = true;
        const sand = new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 0.95, map: t });
        add(new THREE.ConeGeometry(34, 38, 4), sand, 0, 19, 0).rotation.y = Math.PI / 4;
        add(new THREE.BoxGeometry(1.4, 22, 1.4), sand, 40, 11, 8); add(new THREE.ConeGeometry(1.4, 3, 4), new THREE.MeshStandardMaterial({ color: 0xe8c040, metalness: 0.8, roughness: 0.3 }), 40, 23.4, 8);
        add(new THREE.BoxGeometry(8, 5, 8), sand, -26, 2.5, 30);
        break;
      }
      case 'globe': {
        const m = new THREE.MeshStandardMaterial({ color: 0xc8cdd6, metalness: 0.85, roughness: 0.25 });
        add(new THREE.SphereGeometry(21, 36, 24), m, 0, 22, 0);
        for (let i = 0; i < 6; i++) { const r = add(new THREE.TorusGeometry(21.3, 0.18, 6, 48), new THREE.MeshStandardMaterial({ color: 0x4a5a7a, metalness: 0.5, roughness: 0.4 }), 0, 22, 0); r.rotation.y = i * Math.PI / 6; }
        add(new THREE.CylinderGeometry(8, 9, 2, 20), stone, 0, 1, 0);
        break;
      }
      case 'windmill': {
        const brick = new THREE.MeshStandardMaterial({ color: 0xa8503c, roughness: 0.9, map: textures.brick() });
        add(new THREE.CylinderGeometry(5, 8, 24, 12), brick, 0, 12, 0);
        add(new THREE.ConeGeometry(6.4, 8, 12), new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.8 }), 0, 28, 0);
        const rotor = new THREE.Group(); rotor.position.set(0, 24, 6);
        const bladeM = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.8 });
        for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 22, 0.4), bladeM); b.position.y = 12; b.castShadow = true; arm.add(b); rotor.add(arm); }
        g.add(rotor); this.anims.push(dt => { rotor.rotation.z += dt * 0.4; });
        break;
      }
      case 'tower': {
        const steel = new THREE.MeshStandardMaterial({ color: 0x8a919c, metalness: 0.6, roughness: 0.45 });
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const a = new THREE.Vector3(sx * 7, 0, sz * 7), b = new THREE.Vector3(sx * 1.2, 52, sz * 1.2);
          const len = a.distanceTo(b); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, len, 6), steel);
          leg.position.copy(a).lerp(b, 0.5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); leg.castShadow = true; g.add(leg);
        }
        for (let y = 10; y < 50; y += 12) { const r = 7 - y * 0.11; add(new THREE.BoxGeometry(r * 2, 0.5, r * 2), steel, 0, y, 0); }
        add(new THREE.CylinderGeometry(5, 3, 4, 14), lamp, 0, 54, 0); add(new THREE.ConeGeometry(2, 9, 8), steel, 0, 61, 0);
        break;
      }
      case 'ship': {
        const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9, map: textures.wood() });
        const hull = add(new THREE.BoxGeometry(34, 5, 10), wood, 0, 3, 0); hull.scale.set(1, 1, 1);
        add(new THREE.ConeGeometry(5, 10, 4), wood, 20, 4, 0).rotation.z = -Math.PI / 2;
        add(new THREE.ConeGeometry(5, 8, 4), wood, -19, 4.5, 0).rotation.z = Math.PI / 2;
        for (const x of [-6, 7]) { add(new THREE.CylinderGeometry(0.4, 0.5, 26, 6), wood, x, 17, 0); add(new THREE.PlaneGeometry(10, 12), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, side: THREE.DoubleSide, roughness: 1 }), x, 18, 0).rotation.y = Math.PI / 2; }
        break;
      }
      case 'lighthouse': {
        for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(4.2 - i * 0.5 - 0.5, 4.2 - i * 0.5, 7, 14), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xc8202e : 0xf0f0f0, roughness: 0.8 }), 0, 3.5 + i * 7, 0);
        add(new THREE.CylinderGeometry(2.6, 2.6, 4, 12), lamp, 0, 37, 0); add(new THREE.ConeGeometry(3.4, 4, 12), roofM, 0, 41, 0);
        break;
      }
      case 'menhir': {
        for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, r = 10 + (i % 2) * 4; const m = add(new THREE.BoxGeometry(2.4, 8 + (i % 3) * 3, 2), stone, Math.cos(a) * r, 5, Math.sin(a) * r); m.rotation.set((i % 3 - 1) * 0.08, a, (i % 2 - .5) * 0.1); }
        break;
      }
      case 'pagoda': {
        const red = new THREE.MeshStandardMaterial({ color: 0xb8302a, roughness: 0.7 });
        for (let i = 0; i < 4; i++) { add(new THREE.BoxGeometry(14 - i * 2.5, 5, 14 - i * 2.5), red, 0, 2.5 + i * 7, 0); add(new THREE.ConeGeometry(11 - i * 2, 3.5, 4), new THREE.MeshStandardMaterial({ color: 0x2a5a4a, roughness: 0.6 }), 0, 6.5 + i * 7, 0).rotation.y = Math.PI / 4; }
        break;
      }
      default: return null;
    }
    return g;
  }

  // ------------------------------------------------------------------ Fahrgeschäfte
  buildFlats() {
    const list = [...(this.def.flats || [])];
    const generic = [['ferris', 'Riesenrad'], ['carousel', 'Karussell'], ['tower', 'Freifallturm']];
    for (const gnr of generic) if (!list.some(f => f.kind === gnr[0])) list.push({ kind: gnr[0], name: gnr[1] });
    this.flats = [];
    let k = 0;
    for (const f of list) {
      let placed = false;
      for (let tries = 0; tries < 80 && !placed; tries++) {
        const a = this.R(0, TAU), rad = 100 + tries * 6 + this.R(0, 60);
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        if (!this.grid.free(x, z, 26)) continue;
        const obj = this.makeFlat(f.kind);
        obj.position.set(x, 0, z); obj.rotation.y = this.R(0, TAU);
        this.group.add(obj); this.grid.mark(x, z, 26); placed = true;
        this.flats.push({ kind: f.kind, name: f.name, x, z, obj });
        this.pathTo(x, z);
      }
      k++;
    }
  }

  pathTo(x, z) {
    // einfache Verbindung zum nächsten Knoten
    let best = -1, bd = 1e9;
    for (let i = 0; i < this.nodes.length; i++) { const d = Math.hypot(this.nodes[i].x - x, this.nodes[i].z - z); if (d < bd && d > 4) { bd = d; best = i; } }
    if (best < 0) return;
    const n = this.node(x, z); this.edge(n, best, 4);
  }

  makeFlat(kind) {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xd0d4dc, metalness: 0.5, roughness: 0.4 });
    const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(this.rng(), 0.7, 0.5), roughness: 0.5, metalness: 0.2 });
    const lamp = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffffcc, emissiveIntensity: 0 }); this.env.registerLamp(lamp);
    const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    if (kind === 'ferris') {
      const R = 24;
      add(g, new THREE.CylinderGeometry(1, 1.6, 2, 8), steel, 0, 1, 0);
      for (const sz of [-3, 3]) { const l = add(g, new THREE.BoxGeometry(1.2, R + 6, 1.2), steel, -R * 0.35, (R + 6) / 2, sz); l.rotation.z = -0.28; const l2 = add(g, new THREE.BoxGeometry(1.2, R + 6, 1.2), steel, R * 0.35, (R + 6) / 2, sz); l2.rotation.z = 0.28; }
      const wheel = new THREE.Group(); wheel.position.set(0, R + 3, 0);
      for (const sz of [-3, 3]) { const rim = add(wheel, new THREE.TorusGeometry(R, 0.35, 6, 48), steel, 0, 0, sz); }
      for (let i = 0; i < 16; i++) for (const sz of [-3, 3]) { const sp = add(wheel, new THREE.BoxGeometry(0.2, R, 0.2), steel, 0, 0, sz); sp.geometry.translate(0, R / 2, 0); sp.position.set(0, 0, sz); sp.rotation.z = i / 16 * TAU; }
      const gondolas = [];
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; const gd = new THREE.Group(); gd.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); const gm = add(gd, new THREE.BoxGeometry(2.4, 2, 5), i % 2 ? accent : lamp, 0, -1.2, 0); wheel.add(gd); gondolas.push(gd); }
      g.add(wheel);
      this.anims.push(dt => { wheel.rotation.z += dt * 0.08; gondolas.forEach(gd => { gd.rotation.z = -wheel.rotation.z; }); });
    } else if (kind === 'carousel') {
      const base = add(g, new THREE.CylinderGeometry(12, 12, 0.8, 32), accent, 0, 0.5, 0);
      const rot = new THREE.Group(); g.add(rot);
      add(rot, new THREE.CylinderGeometry(1.4, 1.4, 10, 12), steel, 0, 5, 0);
      add(g, new THREE.ConeGeometry(13.4, 5, 32), accent, 0, 12.5, 0);
      add(g, new THREE.CylinderGeometry(12.6, 12.6, 0.6, 32), lamp, 0, 9.8, 0);
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; const p = add(rot, new THREE.CylinderGeometry(0.1, 0.1, 8, 5), steel, Math.cos(a) * 8, 5.4, Math.sin(a) * 8); const horse = add(rot, new THREE.BoxGeometry(1.8, 1.6, 0.7), i % 2 ? accent : steel, Math.cos(a) * 8, 3 + (i % 2), Math.sin(a) * 8); horse.rotation.y = -a; }
      this.anims.push(dt => { rot.rotation.y += dt * 0.7; });
    } else if (kind === 'tower') {
      const H = 62;
      add(g, new THREE.CylinderGeometry(1.4, 2, H, 10), steel, 0, H / 2, 0);
      add(g, new THREE.CylinderGeometry(0.4, 0.4, H, 6), lamp, 2.2, H / 2, 0);
      const car = new THREE.Group(); add(car, new THREE.CylinderGeometry(3.4, 3.4, 1.6, 16), accent, 0, 0, 0); add(car, new THREE.CylinderGeometry(3.6, 3.6, 0.3, 16), lamp, 0, 0.9, 0); g.add(car);
      let t = 0; this.anims.push(dt => { t += dt; const ph = t % 14; const y = ph < 6 ? 4 + (ph / 6) * (H - 8) : ph < 8 ? H - 4 : ph < 9 ? H - 4 - ((ph - 8)) * (H - 8) * 0.85 * (ph - 8) : 6 + (1 - Math.min(1, (ph - 9) / 5)) * 6; car.position.y = Math.max(2, y); });
    } else if (kind === 'pendulum') {
      for (const sz of [-4, 4]) { const a = add(g, new THREE.BoxGeometry(1.4, 26, 1.4), steel, -4, 13, sz); a.rotation.z = 0.2; const b = add(g, new THREE.BoxGeometry(1.4, 26, 1.4), steel, 4, 13, sz); b.rotation.z = -0.2; }
      add(g, new THREE.BoxGeometry(1.2, 1.2, 10), steel, 0, 25.5, 0);
      const pivot = new THREE.Group(); pivot.position.set(0, 25, 0); g.add(pivot);
      add(pivot, new THREE.BoxGeometry(1, 20, 1), steel, 0, -10, 0);
      add(pivot, new THREE.CylinderGeometry(6, 6, 1.2, 20), accent, 0, -20, 0);
      add(pivot, new THREE.CylinderGeometry(6.2, 6.2, 0.3, 20), lamp, 0, -19.3, 0);
      let t = Math.random() * 6; this.anims.push(dt => { t += dt; pivot.rotation.z = Math.sin(t * 0.7) * 1.15 * Math.min(1, t / 8 % 1 + 0.5); });
      g.userData.pivot = pivot;
    }
    return g;
  }

  // ------------------------------------------------------------------ Wasser
  buildWater() {
    const water = new THREE.MeshStandardMaterial({ map: textures.water(), color: 0x7ab8d8, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.88 });
    let n = 0;
    for (let tries = 0; tries < 120 && n < 2; tries++) {
      const a = this.R(0, TAU), rad = this.R(110, this.radius + 60), x = Math.cos(a) * rad, z = Math.sin(a) * rad, r = this.R(22, 46);
      if (!this.grid.free(x, z, r * 1.3)) continue;
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 36), water); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z); m.scale.set(1, 1 / this.R(1.3, 1.9), 1);
      m.rotation.z = this.R(0, TAU); this.group.add(m); this.grid.mark(x, z, r * 1.3); n++;
    }
  }

  // ------------------------------------------------------------------ Bäume
  buildTrees() {
    const q = { low: 600, medium: 1600, high: 3400 }[this.quality] || 1600;
    const total = q;
    const pts = [];
    const R = this.radius;
    for (let i = 0; i < total * 8 && pts.length < total; i++) {
      const a = this.R(0, TAU), rad = Math.sqrt(this.rng()) * (R + 120);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (!this.grid.free(x, z, 3)) continue;
      pts.push([x, z, this.R(0.8, 1.6)]);
    }
    // Wald außerhalb
    const outer = Math.round(q * 1.6);
    for (let i = 0; i < outer; i++) {
      const a = this.R(0, TAU), rad = this.R(R + 140, R + 1250);
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad, this.R(1.2, 2.4)]);
    }
    const conif = this.def.theme === 'nordic' || this.def.theme === 'alpine';
    const nCon = pts.filter((_, i) => conif ? (i % 4 !== 0) : (i % 5 === 0)).length;
    const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; this.group.add(m); return m; };
    const trunk = new THREE.CylinderGeometry(0.25, 0.4, 3.2, 6); trunk.translate(0, 1.6, 0);
    const crownB = new THREE.IcosahedronGeometry(2.8, 0); crownB.translate(0, 5.2, 0);
    const c1 = new THREE.ConeGeometry(2.6, 5, 7); c1.translate(0, 4.2, 0);
    const c2 = new THREE.ConeGeometry(1.9, 4.2, 7); c2.translate(0, 7.2, 0);
    const matT = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 });
    const matL = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const decid = [], cons = [];
    pts.forEach((p, i) => ((conif ? (i % 4 !== 0) : (i % 5 === 0)) ? cons : decid).push(p));
    const iT = mk(trunk, matT, pts.length), iB = mk(crownB, matL, Math.max(1, decid.length)), iC1 = mk(c1, matL, Math.max(1, cons.length)), iC2 = mk(c2, matL, Math.max(1, cons.length));
    const m = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
    let ti = 0;
    const place = (arr, a, b) => arr.forEach((p, i) => {
      q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.R(0, TAU)); s.set(p[2], p[2] * this.R(0.9, 1.3), p[2]); pv.set(p[0], 0, p[1]);
      m.compose(pv, q4, s); a.setMatrixAt(i, m); if (b) b.setMatrixAt(i, m); iT.setMatrixAt(ti++, m);
      col.setHSL(conif ? 0.34 + this.R(-0.03, 0.03) : 0.27 + this.R(-0.05, 0.05), this.R(0.4, 0.6), conif ? this.R(0.14, 0.22) : this.R(0.2, 0.34));
      a.setColorAt(i, col); if (b) b.setColorAt(i, col);
    });
    place(decid, iB, null); place(cons, iC1, iC2);
    iB.count = decid.length; iC1.count = cons.length; iC2.count = cons.length; iT.count = pts.length;
    for (const im of [iT, iB, iC1, iC2]) im.instanceMatrix.needsUpdate = true;
    for (const im of [iB, iC1, iC2]) if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ Laternen, Bänke, Büsche
  buildScenery() {
    const n = this.lamps.length;
    if (n) {
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.2, 5); poleGeo.translate(0, 2.1, 0);
      const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2a2e34, metalness: 0.5, roughness: 0.5 }), n);
      const bulbMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: new THREE.Color(this.theme.lamp), emissiveIntensity: 0 }); this.env.registerLamp(bulbMat);
      const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 8, 6), bulbMat, n);
      const m = new THREE.Matrix4();
      this.lamps.forEach((p, i) => { m.makeTranslation(p[0], 0, p[1]); poles.setMatrixAt(i, m); m.makeTranslation(p[0], 4.3, p[1]); bulbs.setMatrixAt(i, m); });
      poles.castShadow = true; this.group.add(poles, bulbs);
    }
    // Bänke
    const benchPts = [];
    for (const [a, b, w] of this.edges) {
      if (w < 6) continue;
      const A = this.nodes[a], B = this.nodes[b], L = Math.hypot(B.x - A.x, B.z - A.z), nx = -(B.z - A.z) / L, nz = (B.x - A.x) / L;
      for (let t = 20; t < L - 10; t += 55) benchPts.push([A.x + (B.x - A.x) * t / L + nx * (w / 2 + 1.4), A.z + (B.z - A.z) * t / L + nz * (w / 2 + 1.4), Math.atan2(B.z - A.z, B.x - A.x)]);
    }
    if (benchPts.length) {
      const bg = new THREE.BoxGeometry(2, 0.12, 0.6);
      const benches = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 }), benchPts.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      benchPts.forEach((p, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -p[2]); m.compose(new THREE.Vector3(p[0], 0.55, p[1]), q, new THREE.Vector3(1, 1, 1)); benches.setMatrixAt(i, m); });
      this.group.add(benches);
    }
  }

  // ------------------------------------------------------------------ Besucher
  buildVisitors() {
    const count = { low: 80, medium: 220, high: 420 }[this.quality] || 220;
    const { body, legs, head } = visitorGeometries();
    const iBody = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: true }), count);
    const iLegs = new THREE.InstancedMesh(legs, new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: true }), count);
    const iHead = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: true }), count);
    for (const m of [iBody, iLegs, iHead]) { m.frustumCulled = false; m.castShadow = true; this.group.add(m); }
    const vis = [];
    const hubN = 0;
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const e = this.edges[Math.floor(this.rng() * this.edges.length)];
      const a = this.rng() < 0.5 ? e[0] : e[1], b = a === e[0] ? e[1] : e[0];
      vis.push({ a, b, t: this.rng(), speed: this.R(1.0, 1.8), off: this.R(-1.8, 1.8), x: 0, z: 0, yaw: 0, ph: this.rng() * 6 });
      col.setHSL(this.rng(), this.R(0.4, 0.8), this.R(0.35, 0.65)); iBody.setColorAt(i, col);
      col.setHSL(this.R(0.55, 0.75), 0.3, this.R(0.15, 0.35)); iLegs.setColorAt(i, col);
      col.setHSL(this.R(0.05, 0.12), this.R(0.3, 0.6), this.R(0.4, 0.8)); iHead.setColorAt(i, col);
    }
    this.vis = vis; this.visMeshes = [iBody, iLegs, iHead];
    this.updateVisitors(0);
    for (const m of this.visMeshes) m.instanceColor.needsUpdate = true;
  }

  updateVisitors(dt) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    const [iBody, iLegs, iHead] = this.visMeshes;
    for (let i = 0; i < this.vis.length; i++) {
      const v = this.vis[i], A = this.nodes[v.a], B = this.nodes[v.b];
      const L = Math.hypot(B.x - A.x, B.z - A.z) || 1;
      v.t += v.speed * dt / L; v.ph += dt * 7 * v.speed;
      if (v.t >= 1) {
        const prev = v.a; v.a = v.b; v.t = 0;
        const adj = this.nodes[v.a].adj; let nb = adj[Math.floor(this.rng() * adj.length)];
        if (adj.length > 1) for (let k = 0; k < 4 && nb === prev; k++) nb = adj[Math.floor(this.rng() * adj.length)];
        v.b = nb;
      }
      const A2 = this.nodes[v.a], B2 = this.nodes[v.b], L2 = Math.hypot(B2.x - A2.x, B2.z - A2.z) || 1;
      const dx = (B2.x - A2.x) / L2, dz = (B2.z - A2.z) / L2;
      v.x = A2.x + dx * L2 * v.t - dz * v.off; v.z = A2.z + dz * L2 * v.t + dx * v.off;
      v.yaw = Math.atan2(dx, dz);
      const bob = Math.abs(Math.sin(v.ph)) * 0.06;
      q.setFromAxisAngle(up, v.yaw); pv.set(v.x, bob, v.z);
      m.compose(pv, q, s);
      iBody.setMatrixAt(i, m); iLegs.setMatrixAt(i, m); iHead.setMatrixAt(i, m);
    }
    for (const mm of this.visMeshes) mm.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ Minikarte
  buildMinimapData() {
    this.mini = this.rides.map(r => {
      const tr = r.track, pts = [], th = r.th;
      for (let i = 0; i < tr.N; i += 6) {
        const x = tr.P[i * 3], z = tr.P[i * 3 + 2];
        pts.push([r.ox + x * Math.cos(th) + z * Math.sin(th), r.oz - x * Math.sin(th) + z * Math.cos(th)]);
      }
      return { ride: r, pts };
    });
  }

  // ------------------------------------------------------------------ Update
  update(dt, simDt = dt) {
    for (const r of this.rides) { if (r.replayHook) r.replayHook(); else r.sim.step(simDt); r.train.update(r.sim); }
    for (const a of this.anims) a(dt);
    this.updateVisitors(dt);
  }

  dispose() {
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}
