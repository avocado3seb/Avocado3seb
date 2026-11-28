// ============================================================================
//  phantasia.js – Phantasialand als handgebaute, begehbare Spielwelt (stilisiert, keine Originalpläne)
//  Themenbereiche: Klugheim (Taron), Deep in Africa (Black Mamba), Rookburgh (F.L.Y.), Mexico (Colorado Adventure),
//  Fantasy (Winja's Fear/Force, Raik, Crazy Bats). Gelände, Felsen, Wasserfälle, Brücken, Gebäude, Nacht-Beleuchtung.
// ============================================================================
import * as THREE from 'three';
import { ParkWorld, getTrack, gableGeometry } from './park.js';
import { Sim } from './physics.js';
import { createTrain } from './train.js';
import { railOffsets } from './coasterMesh.js';
import { CATS } from './specs.js';
import { mulberry32, hashStr } from './gen.js';
import { textures, signTexture } from './textures.js';
import { Terrain, fbm } from './pl_terrain.js';
import * as A from './pl_assets.js';
import { EXTRA_ZONES, ZONE_OF_AREA } from './pl_data.js';
import { placePOIs } from './pl_pois.js';
import { buildBeauty } from './pl_beauty.js';
import { buildMedieval, buildAviation } from './pl_themes.js';
import * as H from './pl_houses.js';
import { buildWorldExtras } from './pl_worlds.js';
import { buildWorldExtras2, rideFacades } from './pl_worlds2.js';
import { bakeStatic } from './pl_merge.js';
import { buildTrackBridges, buildEntrances } from './pl_bridges.js';
import { CharPool, visitorLooks, staffLook } from './pl_char.js';
import { buildChina, buildMystery, buildBerlin, buildParking, buildAirship, buildLightStrings, buildWinterDecor } from './pl_zones2.js';

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const ZONES = {
  klugheim:  { name: 'Klugheim', x: 440, z: -30, r: 240, tint: [0.34, 0.36, 0.36], fog: 2.6, fogCol: [0.38, 0.42, 0.48], amb: 0.8, desc: 'Nordisches Dorf zwischen Felsschluchten, Fluss und Vulkan – Taron' },
  africa:    { name: 'Deep in Africa', x: -440, z: -40, r: 240, tint: [0.2, 0.38, 0.14], fog: 1.9, fogCol: [0.4, 0.5, 0.4], amb: 0.55, desc: 'Dichter Dschungel mit Lagune, Wasserfällen und Hängebrücken – Black Mamba' },
  rookburgh: { name: 'Rookburgh', x: 0, z: -430, r: 210, tint: [0.3, 0.3, 0.3], fog: 2.2, fogCol: [0.45, 0.43, 0.42], amb: 0.85, desc: 'Rußige Industriestadt mit Backsteinhallen und Schloten – F.L.Y.' },
  mexico:    { name: 'Mexico', x: -260, z: 270, r: 170, tint: [0.55, 0.42, 0.28], fog: 1.0, fogCol: [0.8, 0.7, 0.6], amb: 1, desc: 'Staubige Canyons, Adobe-Häuser und Kakteen – Colorado Adventure' },
  fantasy:   { name: 'Fantasy', x: 280, z: 280, r: 180, tint: [0.3, 0.5, 0.25], fog: 1.0, fogCol: [0.7, 0.75, 0.85], amb: 1, desc: 'Märchenhafte Häuschen und Türme – Winja\'s, Raik, Crazy Bats' },
  berlin:    { name: 'Eingang & Hauptplatz', x: 0, z: 60, r: 140, tint: [0.3, 0.46, 0.22], fog: 1.0, fogCol: [0.75, 0.82, 0.9], amb: 1, desc: 'Eingangstor, Brunnenplatz und Hauptstraße' },
};
Object.assign(ZONES, EXTRA_ZONES);
// Kompakter Park: Themenbereiche enger um den Hauptplatz gruppiert (Bahnen verschränken sich wie im Vorbild)
function upNormals(g) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a[i * 3 + 1] = 1; g.setAttribute('normal', new THREE.BufferAttribute(a, 3)); }
const SQ = 0.7;
for (const k in ZONES) { if (k === 'berlin' || k === 'parking') continue; const z = ZONES[k]; z.x = Math.round(z.x * SQ); z.z = Math.round(60 + (z.z - 60) * SQ); z.r = Math.round(z.r * 0.85); }
const AREA_KEY = ZONE_OF_AREA;
const PLACE = { // Versatz der Bahn-Mitte zur Zonenmitte
  'Taron': [0, -14], 'Black Mamba': [7, 14], 'F.L.Y.': [0, 0], 'Colorado Adventure': [0, 0],
  "Winja's Fear": [-49, -42], "Winja's Force": [49, -42], 'Raik': [-62, 52], 'Crazy Bats': [56, 56],
  'Chiapas': [28, 7], 'Talocan': [-21, 56], 'River Quest': [-21, 14], 'Mystery Castle': [42, 28], 'Maus au Chocolat': [-49, 63], 'Wakobato': [-7, -14], 'Feng Ju Palace': [14, -7], 'Geister Rikscha': [38, 38], 'Hollywood Tour': [-62, -40],
  'Das verrückte Hotel Tartüff': [52, 68], 'Die 3 Mausketiere': [66, -48], 'Tikal': [-50, 4], 'Würmling Express': [-104, 104],
};

export class PhantasiaWorld extends ParkWorld {
  build() {
    const rng = this.prng = mulberry32(hashStr('phantasialand'));
    A.doorFronts.length = 0;
    this.R = (a = 0, b = 1) => a + (b - a) * rng();
    // out.world.add() markiert Gruppen als zusammenfassbar (siehe pl_merge.js); animierte Gruppen setzen userData.noMerge
    const out = this.out = { world: { add: (...gs) => { for (const g of gs) { if (g.isGroup && !g.userData.noMerge) g.userData.merge = true; this.group.add(g); } return this.group; } }, colliders: [], platforms: [], lights: [], glow: [], smoke: [], spinners: [] };
    this.zones = ZONES; this.radius = 820; this.flats = []; this.waterAnims = []; this.mist = []; this.smokeSprites = []; this.torchPts = [];
    this.gate = new THREE.Vector3(0, 0, 340); this.buildings = [];
    this.quality = this.opts.quality || 'medium';
    this.env.fogMul = 1; this.env.ambMul = 1;
    this.flatPts = new Map();
    this.features = {
      zones: ZONES, volcano: { x: ZONES.klugheim.x + 150, z: ZONES.klugheim.z - 175, r: 135, h: 75, crater: 28 },
      river: [[ZONES.klugheim.x - 150, ZONES.klugheim.z - 300], [ZONES.klugheim.x - 100, ZONES.klugheim.z - 150], [ZONES.klugheim.x - 125, ZONES.klugheim.z - 20], [ZONES.klugheim.x - 70, ZONES.klugheim.z + 110], [ZONES.klugheim.x - 130, ZONES.klugheim.z + 260]],
      lake: { x: ZONES.africa.x + 10, z: ZONES.africa.z + 75, rx: 70, rz: 48 },
      flat: (x, z) => this.flatMask(x, z),
    };
    this.placeRidesPL();
    { // Belegungsraster für Gebäude: wie 'grid', aber OHNE die Gleis-Fußabdrücke (Strecken sind meist hoch – darunter darf gebaut werden, solange nearTrackFast frei meldet)
      const g = this.grid, base = g.mark.bind(g), c = g.c, occ = this.occ = new Set(), key = (i, j) => i * 100003 + j;
      g.mark = (x, z, r) => { base(x, z, r); const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) occ.add(key(i, j)); };
      this.occFree = (x, z, r) => { const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (occ.has(key(i, j))) return false; return true; };
      this.siteOk = (x, z, r) => this.occFree(x, z, r) && !this.nearTrackFast(x, z, r + 3, 9) && !this.nearTrackFast(x, z, r * 0.55 + 2, 90) && !this.nearStation(x, z);
      for (const rd of this.rides) g.mark(rd.entrance.x, rd.entrance.z, 22);
    }
    this.layoutPaths();
    this.markFlatPaths();
    this.buildTerrainPL();
    this.buildPathMeshes();
    { // Wasserflächen vor der POI-Platzierung im Raster belegen (Teich China Town, Lagune Afrika) – dort darf nichts stehen
      const zc = this.zones.china, L = this.features.lake; this.grid.mark(zc.x - 20, zc.z + 25, 32); this.grid.mark(L.x, L.z, 78);
    }
    this.pois = placePOIs(this);
    rideFacades(this); // Fassaden der Fahrgeschäfte (Pyramiden, Torten, Tore …) bekommen Vorrang vor Vegetation und Streudekor
    buildMedieval(this); buildAviation(this);
    this.buildZoneDecor();
    this.buildExtras();
    this.buildEffects();
    this.buildVisitors();
    this.buildMinimapData();
    this.terrain.refresh(this.terrainMesh);
    this.buildRockColliders();
    this.buildColliderHash();
  }

  // ------------------------------------------------------------------ Flachmasken (Gelände unter Bahnen/Wegen/Plätzen)
  markFlat(x, z, r) {
    const c = 8, i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const cx = (i + 0.5) * c, cz = (j + 0.5) * c, d = Math.hypot(cx - x, cz - z);
      const m = 1 - sstep(r * 0.55, r + c, d); const k = i * 100003 + j;
      if (m > (this.flatPts.get(k) || 0)) this.flatPts.set(k, m);
    }
  }
  flatMask(x, z) {
    const c = 8, fx = x / c - 0.5, fz = z / c - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, g = (a, b) => this.flatPts.get(a * 100003 + b) || 0;
    return g(i, j) * (1 - u) * (1 - v) + g(i + 1, j) * u * (1 - v) + g(i, j + 1) * (1 - u) * v + g(i + 1, j + 1) * u * v;
  }
  markFlatPaths() {
    for (const [a, b, w] of this.edges) {
      const A_ = this.nodes[a], B_ = this.nodes[b], L = Math.hypot(B_.x - A_.x, B_.z - A_.z);
      for (let t = 0; t <= L; t += 6) this.markFlat(A_.x + (B_.x - A_.x) * t / L, A_.z + (B_.z - A_.z) * t / L, w * 0.9 + 3);
    }
    this.markFlat(0, 60, 62); this.markFlat(this.gate.x, this.gate.z, 24); this.markFlat(0, 520, 150); for (let z = 110; z < 340; z += 20) this.markFlat(0, z, 40);
  }

  // ------------------------------------------------------------------ Bahnen fest platzieren
  placeRidesPL() {
    const rot = (x, z, th) => [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
    this.paths = [];
    for (const c of this.def.coasters) {
      const key = AREA_KEY[c.area] || 'fantasy', zn = ZONES[key];
      const tr = getTrack(c), b = tr.bounds;
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      // Drehung: Eingang (lokal +z) zeigt zum Hauptplatz
      let best = 0, bs = -9;
      const dirHub = [-(zn.x), -(60 - zn.z)], dl = Math.hypot(...dirHub) || 1;
      for (let r = 0; r < 4; r++) { const th = r * Math.PI / 2, [ex, ez] = rot(0, 1, th); const s = (ex * dirHub[0] + ez * dirHub[1]) / dl; if (s > bs) { bs = s; best = th; } }
      const off = PLACE[c.name] || [0, 0];
      const [wx, wz] = rot(cx, cz, best);
      const ox = zn.x + off[0] - wx, oz = zn.z + off[1] - wz;
      const inf = { c, tr };
      this.addRide(inf, { th: best, ox, oz });
      const ride = this.rides[this.rides.length - 1];
      ride.zone = key;
      // flache Fläche unter der Strecke
      const cos = Math.cos(best), sin = Math.sin(best);
      for (let i = 0; i < tr.N; i += 4) this.markFlat(ox + tr.P[i * 3] * cos + tr.P[i * 3 + 2] * sin, oz - tr.P[i * 3] * sin + tr.P[i * 3 + 2] * cos, 9);
      this.markFlat(ride.entrance.x, ride.entrance.z, 16);
      // zweiter Zug
      ride.sets = [{ sim: ride.sim, train: ride.train }];
      if ((c.trains || 1) > 1) {
        const spec = ride.spec;
        const c2 = { ...c, id: c.id + '-z2', trainColor: c.trainAccent || '#e8e8ee', trainAccent: c.trainColor };
        const sim2 = new Sim(tr, { cars: spec.cars, spacing: spec.spacing, crr: spec.crr, delay: ride.sim.timer + 38, dispatch: 9 });
        const train2 = createTrain(tr, c2, spec.cars, tr.yOff); ride.group.add(train2.group);
        ride.sets.push({ sim: sim2, train: train2 });
      }
      this.wpPrep(ride);
      { const sl = tr.stationLen || 28; (this.stations = this.stations || []).push([ox + (sl / 2) * cos, oz - (sl / 2) * sin], [ride.entrance.x, ride.entrance.z]); }
    }
  }
  wpPrep(r) { // Weltkoordinaten der Strecke (jede 2. Probe)
    const tr = r.track, th = r.th, cos = Math.cos(th), sin = Math.sin(th), n = Math.floor(tr.N / 2);
    r.wp = new Float32Array(n * 3); r.wr = new Float32Array(n * 2); r.wu = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const i = k * 2, x = tr.P[i * 3], y = tr.P[i * 3 + 1], z = tr.P[i * 3 + 2];
      r.wp[k * 3] = r.ox + x * cos + z * sin; r.wp[k * 3 + 1] = y + r.yOff; r.wp[k * 3 + 2] = r.oz - x * sin + z * cos;
      const rx = tr.R[i * 3], rz = tr.R[i * 3 + 2]; r.wr[k * 2] = rx * cos + rz * sin; r.wr[k * 2 + 1] = -rx * sin + rz * cos;
      r.wu[k] = tr.U[i * 3 + 1];
    }
    r.wn = n;
  }

  // ------------------------------------------------------------------ Gelände
  buildTerrainPL() {
    const q = this.quality, step = q === 'low' ? 8 : 5;
    this.terrain = new Terrain(1900, step, this.features);
    const f = this.features;
    // Bodenfarbe je Themenwelt (sRGB); die Bodentextur ist neutral grau, der Farbton kommt allein aus diesen Vertexfarben
    const GK = 1.4, GROUND = Object.fromEntries(Object.entries({ berlin: '#4f8c34', rookburgh: '#4b463d', mexico: '#b98b50', mystery: '#3f4d3f', klugheim: '#55684a', africa: '#5f6e33', china: '#5a9250', fantasy: '#6cc247', parking: '#6b6b68' }).map(([k, c]) => { const t = new THREE.Color(c); return [k, [t.r * GK, t.g * GK, t.b * GK]]; }));
    const DEF = GROUND.berlin;
    this.terrainColor = (x, z, y, slope) => {
      let r = 0, g = 0, b = 0, wsum = 0;
      for (const k in ZONES) { const zn = ZONES[k], gc = GROUND[k] || DEF, d = Math.hypot(x - zn.x, z - zn.z), w = Math.exp(-(d * d) / (zn.r * zn.r * 0.55)); r += gc[0] * w; g += gc[1] * w; b += gc[2] * w; wsum += w; }
      if (wsum < 0.05) { r = DEF[0]; g = DEF[1]; b = DEF[2]; wsum = 1; }
      r /= wsum; g /= wsum; b /= wsum;
      const n = 0.82 + 0.3 * fbm(x / 25, z / 25);
      const rock = sstep(0.35, 0.8, slope);
      const rr = 0.2 + 0.08 * fbm(x / 9, z / 9);
      const wet = y < -0.6 ? 0.55 : 1;
      return [(r * (1 - rock) + rr * rock) * n * wet, (g * (1 - rock) + rr * 0.95 * rock) * n * wet, (b * (1 - rock) + rr * 0.9 * rock) * n * wet];
    };
    const mesh = this.terrainMesh = this.terrain.build(this.terrainColor);
    this.out.flatten = (cx, cz, hx, hz, rot, y) => this.terrain.flatten(cx, cz, hx, hz, rot, y);
    this.group.add(mesh);
    // Grundplatte bis zum Horizont. WICHTIG: unterteilt! Eine Fläche aus nur zwei 30-km-Dreiecken hat zu ungenaue Tiefenwerte und überdeckte
    // je nach Kamerawinkel Gelände und Wege (Boden "verschwand" wenige Sekunden nach dem Betreten des Parks).
    const far = this.farPlane = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000, 96, 96), new THREE.MeshStandardMaterial({ color: 0x3a5a2c, roughness: 1 }));
    far.rotation.x = -Math.PI / 2; far.position.y = -7; far.receiveShadow = true; this.group.add(far); // tief genug, damit die Gelände-Farben auch in Mulden (bis ca. -3,4 m) sichtbar sind
  }
  h(x, z) { return this.terrain.at(x, z); }
  nearStation(x, z) { for (const [sx, sz] of this.stations || []) if ((sx - x) ** 2 + (sz - z) ** 2 < 24 * 24) return true; return false; }

  // ------------------------------------------------------------------ Wege
  layoutPaths() {
    // Knoten
    const hub = this.node(0, 60), gate = this.node(this.gate.x, this.gate.z), g2 = this.node(0, 200);
    this.edge(gate, g2, 10); this.edge(g2, hub, 10);
    const zc = {};
    const lot = this.node(0, 500); this.edge(lot, gate, 10);
    for (const k of ['klugheim', 'africa', 'rookburgh', 'mexico', 'fantasy', 'china', 'mystery']) {
      const z = ZONES[k]; zc[k] = this.node(z.x - Math.sign(z.x) * 30, z.z + (z.z < 0 ? 50 : -40));
    }
    zc.berlin = hub;
    // Hauptwege (mit Zwischenknoten)
    const link = (a, b, w = 8, kink = true) => {
      const A_ = this.nodes[a], B_ = this.nodes[b];
      if (!kink) { this.edge(a, b, w); return; }
      const mid = this.node((A_.x + B_.x) / 2 + (B_.z - A_.z) * 0.12, (A_.z + B_.z) / 2 - (B_.x - A_.x) * 0.12);
      this.edge(a, mid, w); this.edge(mid, b, w);
    };
    for (const k in zc) link(hub, zc[k], 8);
    link(zc.klugheim, zc.fantasy, 6); link(zc.africa, zc.mexico, 6); link(zc.rookburgh, zc.klugheim, 6); link(zc.rookburgh, zc.africa, 6); link(zc.mexico, zc.fantasy, 6); link(zc.china, zc.rookburgh, 6); link(zc.china, zc.africa, 6); link(zc.mystery, zc.rookburgh, 6); link(zc.mystery, zc.klugheim, 6);
    for (const r of this.rides) {
      const e = r.entrance, an = this.node(e.x + r.dir[0] * 12, e.z + r.dir[1] * 12), en = this.node(e.x, e.z);
      this.edge(an, en, 5); r.pathNode = an; r.entranceNode = en;
      link(zc[r.zone], an, 5, false);
    }
  }
  buildPathMeshes() {
    // Geometrie, folgt dem Gelände
    const pos = [], uv = [], idx = [];
    const seg = (ax, az, bx, bz, w, flat) => {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 6));
      const dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz * w / 2, nz = dx * w / 2;
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, y = Math.max(0.05, this.h(x, z)) + 0.07;
        const i = pos.length / 3;
        pos.push(x + nx, y, z + nz, x - nx, y, z - nz); uv.push(0, k * L / n / w, 1, k * L / n / w);
        if (prev !== null) idx.push(prev, prev + 1, i + 1, prev, i + 1, i);
        prev = i;
      }
    };
    for (const [a, b, w] of this.edges) { const A_ = this.nodes[a], B_ = this.nodes[b]; seg(A_.x, A_.z, B_.x, B_.z, w); this.grid.mark(A_.x, A_.z, w / 2 + 2); const L = Math.hypot(B_.x - A_.x, B_.z - A_.z); for (let t = 0; t <= L; t += 4) this.grid.mark(A_.x + (B_.x - A_.x) * t / L, A_.z + (B_.z - A_.z) * t / L, w / 2 + 2.5); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); upNormals(geo);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: textures.paving(), side: THREE.DoubleSide, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: 0xffffff, emissive: 0x3a3428 }));
    mesh.receiveShadow = true; this.group.add(mesh);
    { // dunkler Randstein / Bordüre unter dem Belag → Wege klar erkennbar
      const bp = [], bi = [];
      for (const [a_, b_, w_] of this.edges) {
        const A_ = this.nodes[a_], B_ = this.nodes[b_], L = Math.hypot(B_.x - A_.x, B_.z - A_.z) || 1, n = Math.max(1, Math.round(L / 6)), dx = (B_.x - A_.x) / L, dz = (B_.z - A_.z) / L, hw = (w_ + 1.6) / 2; let prev = null;
        for (let k = 0; k <= n; k++) { const x = A_.x + (B_.x - A_.x) * k / n, z = A_.z + (B_.z - A_.z) * k / n, y = Math.max(0.05, this.h(x, z)) + 0.05, i = bp.length / 3; bp.push(x - dz * hw, y, z + dx * hw, x + dz * hw, y, z - dx * hw); if (prev !== null) bi.push(prev, prev + 1, i + 1, prev, i + 1, i); prev = i; }
      }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setIndex(bi); upNormals(bg);
      const bm = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x5a554e, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); bm.receiveShadow = true; this.group.add(bm);
    }
    // Hauptplatz
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(48, 48), new THREE.MeshStandardMaterial({ map: textures.paving().clone(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    plaza.material.map.repeat.set(8, 8); plaza.material.map.needsUpdate = true; plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.12, 60); plaza.receiveShadow = true; this.group.add(plaza);
    this.grid.mark(0, 60, 52);
    // Brunnen + Tor (aus ParkWorld: Plaza-Methode nutzt Mittelpunkt (0,0) – daher eigene Kurzfassung)
    const stone = new THREE.MeshStandardMaterial({ color: 0xb0aca0, roughness: 0.9, map: textures.concrete() });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 1.3, 24), stone); bowl.position.set(0, 0.7, 60); bowl.castShadow = true; this.group.add(bowl);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(7.3, 7.3, 0.1, 24), new THREE.MeshStandardMaterial({ map: textures.water(), color: 0x6ab0d8, roughness: 0.1 })); w.position.set(0, 1.3, 60); this.group.add(w);
    this.out.colliders.push({ x: 0, z: 60, r: 9, y0: 0, y1: 1.3 });
    const gate = new THREE.Group(); gate.position.copy(this.gate);
    const pillar = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9, map: A.tex.stone() });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(5, 14, 5), pillar); p.position.set(sx * 16, 7, 0); p.castShadow = true; gate.add(p); this.out.colliders.push({ x: this.gate.x + sx * 16, z: this.gate.z, hx: 2.5, hz: 2.5, rot: 0, y0: 0, y1: 14 }); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(38, 4.5, 3), pillar); beam.position.set(0, 15, 0); gate.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5), new THREE.MeshBasicMaterial({ map: signTexture('Phantasialand', '#6a2c8a', '#ffffff', 'Brühl · Deutschland') })); sign.position.set(0, 21, 0); gate.add(sign);
    const s2 = sign.clone(); s2.rotation.y = Math.PI; s2.position.z = -0.1; gate.add(s2);
    this.group.add(gate);
    this.out.glow.push([this.gate.x, 21, this.gate.z + 1, 1, 0.8, 0.5, 60]);
  }

  // ------------------------------------------------------------------ Hilfen für Platzierung
  nearTrack(x, z, r, maxY = 7) {
    for (const rd of this.rides) {
      const wp = rd.wp; if (Math.abs(rd.ox - x) > 900) continue;
      for (let k = 0; k < rd.wn; k += 1) {
        const dx = wp[k * 3] - x; if (dx > r || dx < -r) continue;
        const dz = wp[k * 3 + 2] - z; if (dz > r || dz < -r) continue;
        if (dx * dx + dz * dz < r * r && wp[k * 3 + 1] - this.h(wp[k * 3], wp[k * 3 + 2]) < maxY) return true;
      }
    }
    return false;
  }
  trackHash() {
    if (this._th) return this._th;
    const m = new Map(), c = 8;
    for (const rd of this.rides) for (let k = 0; k < rd.wn; k++) { const i = Math.floor(rd.wp[k * 3] / c), j = Math.floor(rd.wp[k * 3 + 2] / c), key = i * 100003 + j; let a = m.get(key); if (!a) m.set(key, a = []); a.push(rd.wp[k * 3], rd.wp[k * 3 + 1], rd.wp[k * 3 + 2]); }
    return (this._th = m);
  }
  nearTrackFast(x, z, r, maxY = 7) {
    const m = this.trackHash(), c = 8, i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c), r2 = r * r;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = m.get(i * 100003 + j); if (!a) continue; for (let q = 0; q < a.length; q += 3) { const dx = a[q] - x, dz = a[q + 2] - z; if (dx * dx + dz * dz < r2 && a[q + 1] - this.h(a[q], a[q + 2]) < maxY) return true; } }
    return false;
  }
  inZone(k, x, z, f = 1) { const zn = ZONES[k]; return Math.hypot(x - zn.x, z - zn.z) < zn.r * f; }
  zoneOf(x, z) { let best = null, bd = 1e9; for (const k in ZONES) { const zn = ZONES[k], d = Math.hypot(x - zn.x, z - zn.z) / zn.r; if (d < bd) { bd = d; best = k; } } return bd < 1.25 ? best : null; }

  scatter(key, count, minR, maxR, maker, clear = 6, tries = 40) {
    const zn = ZONES[key]; let made = 0;
    for (let t = 0; t < count * tries && made < count; t++) {
      const a = this.R(0, TAU), r = minR + Math.sqrt(this.rng()) * (maxR - minR), x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r;
      if (!this.occFree(x, z, clear)) continue;
      const y = this.h(x, z); if (y < -0.4 || this.nearTrackFast(x, z, clear + 3, 9) || this.nearTrackFast(x, z, clear * 0.55 + 2, 90) || this.nearStation(x, z)) continue;
      if (this.flatMask(x, z) < 0.3 && key !== 'africa' && Math.abs(this.h(x + 4, z) - y) > 1.2) continue;
      if (maker(x, y, z, this.R(0, TAU))) { this.grid.mark(x, z, clear); made++; }
    }
    return made;
  }
  alongPaths(key, count, maker, clear = 7) {
    const zn = ZONES[key], edges = this.edges.filter(e => { const A_ = this.nodes[e[0]], B_ = this.nodes[e[1]]; return Math.hypot((A_.x + B_.x) / 2 - zn.x, (A_.z + B_.z) / 2 - zn.z) < zn.r * 1.1 && Math.hypot(B_.x - A_.x, B_.z - A_.z) > 20; });
    let made = 0; if (!edges.length) return 0;
    for (let t = 0; t < count * 40 && made < count; t++) {
      const e = edges[Math.floor(this.rng() * edges.length)], A_ = this.nodes[e[0]], B_ = this.nodes[e[1]], L = Math.hypot(B_.x - A_.x, B_.z - A_.z);
      const tt = this.R(6, L - 6), side = this.rng() < 0.5 ? -1 : 1, nx = -(B_.z - A_.z) / L, nz = (B_.x - A_.x) / L, off = e[2] / 2 + clear + this.R(0, 6);
      const x = A_.x + (B_.x - A_.x) * tt / L + nx * off * side, z = A_.z + (B_.z - A_.z) * tt / L + nz * off * side;
      if (!this.occFree(x, z, clear) || this.nearTrackFast(x, z, clear + 2, 9) || this.nearTrackFast(x, z, clear * 0.55 + 2, 90)) continue;
      const y = this.h(x, z); if (y < -0.3) continue;
      const rot = Math.atan2(-(B_.z - A_.z), (B_.x - A_.x)) + (side > 0 ? Math.PI : 0) - Math.PI / 2 + Math.PI;
      if (maker(x, y, z, rot)) { this.grid.mark(x, z, clear); made++; }
    }
    return made;
  }

  // ------------------------------------------------------------------ Dekoration der Themenbereiche
  buildZoneDecor() {
    const q = this.quality, mult = { low: 0.45, medium: 0.8, high: 1.25 }[q] || 0.8, out = this.out, env = this.env, rng = this.rng;
    // Instancer
    const G = this.group;
    this.rockGeos = [1, 2, 3, 4, 5].map(s => A.rockGeometry(s, s === 5 ? 1.6 : 0.8));
    const rm = A.rockMat();
    this.rocks = this.rockGeos.map(g => new A.Inst(g, rm, 2600, G, { shadow: true }));
    const palm = new A.Inst(A.palmGeometry(), A.vcMat(), Math.round(520 * mult), G, { shadow: false });
    const bigleaf = new A.Inst(A.bigLeafGeometry(), A.vcMat(), Math.round(520 * mult), G);
    const fern = new A.Inst(A.fernGeometry(), A.vcMat(), Math.round(900 * mult), G);
    const cactus = new A.Inst(A.cactusGeometry(), A.vcMat(), 140, G, { shadow: true });
    const trunkG = new THREE.CylinderGeometry(0.28, 0.5, 1, 7); trunkG.translate(0, 0.5, 0);
    const crownG = new THREE.IcosahedronGeometry(1, 1); crownG.translate(0, 0.7, 0);
    const coneG = new THREE.ConeGeometry(1, 1, 7); coneG.translate(0, 0.5, 0);
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 });
    const leafM = this.leafM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const trunks = new A.Inst(trunkG, trunkM, 4200, G, { shadow: true });
    const crowns = new A.Inst(crownG, leafM, 6200, G, { shadow: true });
    const cones1 = new A.Inst(coneG, leafM, 5200, G, { shadow: true });
    const cones2 = new A.Inst(coneG, leafM, 9000, G);
    this.inst = { palm, bigleaf, fern, cactus, trunks, crowns, cones1, cones2 };
    const addRock = (x, y, z, s, col, collide = true, v = null) => {
      if (this.nearStation(x, z) && !(this._rockForce)) return;
      for (const [fx, fz, hx, hz, hr] of A.doorFronts) if (Math.hypot(x - fx, z - fz) < s * 1.15 + 3 || Math.hypot(x - hx, z - hz) < hr + s * 0.9) return; // keine Felsen vor Türen oder in Häusern
      const k = v ?? Math.floor(this.rng() * 5), ry = this.R(0, TAU);
      this.rocks[k].add(x, y, z, s * this.R(0.9, 1.4), s * this.R(0.7, 1.1), s * this.R(0.9, 1.4), ry, col, this.R(-0.1, 0.1), this.R(-0.1, 0.1));
    };
    this.addRock = addRock;
    const rockCol = { k: ['#4a4d52', '#3c3f45', '#585b60', '#2f3237'], a: ['#6a5a45', '#5a4c3a', '#7a6a55', '#4a4a3e'], m: ['#a8553a', '#b8663f', '#8a4a32', '#c8794a'], g: ['#6a6a68', '#5a5a58', '#787875'] };
    const pick = a => a[Math.floor(this.rng() * a.length)];
    const pineAt = (x, y, z, s, dark = true) => {
      const h = 5 * s, col = new THREE.Color().setHSL(0.36 + this.R(-0.03, 0.03), this.R(0.35, 0.55), this.R(0.1, 0.2));
      out.colliders.push({ x, z, r: 0.3 * s + 0.3, y0: y - 1, y1: y + 5 }); trunks.add(x, y, z, s * 0.6, h * 0.45, s * 0.6, 0, '#3a2a1c'); cones1.add(x, y + h * 0.2, z, 2.6 * s, 5.5 * s, 2.6 * s, this.R(0, TAU), col); cones2.add(x, y + h * 0.75, z, 1.9 * s, 4.4 * s, 1.9 * s, this.R(0, TAU), col); cones2.add(x, y + h * 1.18, z, 1.2 * s, 3.2 * s, 1.2 * s, this.R(0, TAU), col.clone().offsetHSL(0, 0, 0.03));
    };
    const leafyAt = (x, y, z, s) => { out.colliders.push({ x, z, r: 0.35 * s + 0.3, y0: y - 1, y1: y + 4 }); const col = new THREE.Color().setHSL(0.27 + this.R(-0.05, 0.05), this.R(0.4, 0.6), this.R(0.2, 0.32)); trunks.add(x, y, z, s * 0.7, 3.4 * s, s * 0.7, 0, '#4a3524'); crowns.add(x, y + 2.8 * s, z, 2.8 * s, 2.4 * s, 2.8 * s, this.R(0, TAU), col); const c2 = col.clone().offsetHSL(this.R(-0.02, 0.02), 0.04, 0.05); crowns.add(x + this.R(-1, 1) * s, y + 3.7 * s, z + this.R(-1, 1) * s, 2.0 * s, 1.7 * s, 2.0 * s, this.R(0, TAU), c2); crowns.add(x + this.R(-1.3, 1.3) * s, y + 2.3 * s, z + this.R(-1.3, 1.3) * s, 1.7 * s, 1.5 * s, 1.7 * s, this.R(0, TAU), col.clone().offsetHSL(0, 0, -0.04)); };
    this.pineAt = pineAt; this.leafyAt = leafyAt;

    // ---------- Berlin: Kaiserplatz – repräsentative Stadthäuser der 1920er rund um den Platz (nach Abstand sortiert, Tür zur Platzmitte; nur auf freien Flächen zwischen den Wegen)
    { const cands = []; for (let r = 66; r <= 156; r += 6) { const n = 120, off = this.R(0, 3); for (let k = 0; k < n; k++) cands.push([r, ((k * 3 + off) % 360) * Math.PI / 180]); }
      let placed = 0;
      for (const [r, a] of cands) {
        if (placed >= 36) break;
        const px = Math.cos(a) * r, pz = 60 + Math.sin(a) * r * 0.9; if (pz > 178 || !this.siteOk(px, pz, 8.5)) continue;
        const bays = 3 + Math.floor(this.rng() * 2), rot = Math.atan2(0 - px, 60 - pz), r2 = H.berlinHouse(this.prng, px, Math.max(0.05, this.h(px, pz)), pz, rot, env, out, { bays, floors: r < 100 ? 4 + Math.floor(this.rng() * 2) : 3 + Math.floor(this.rng() * 2) });
        this.buildings.push({ x: px, z: pz, rot, w: r2.w, d: r2.d, hollow: true }); this.grid.mark(px, pz, 9.5); placed++;
      }
    }

    // ---------- Klugheim
    const kz = ZONES.klugheim, volc = this.features.volcano;
    this.alongPaths('klugheim', Math.round(26 * mult + 8), (x, y, z, rot) => { A.nordicHouse(this.prng, x, y, z, rot, { turf: this.rng() < 0.45, enter: this.rng() < 0.28 }, env, out); return true; }, 9);
    this.scatter('klugheim', Math.round(18 * mult), 30, 200, (x, y, z, rot) => { A.nordicHouse(this.prng, x, y, z, rot, { turf: this.rng() < 0.6, enter: this.rng() < 0.2, w: 9, d: 7 }, env, out); return true; }, 10);
    // Felsen auf steilen Hängen und überall verstreut
    this.slopeRocks(kz, 'k', rockCol, Math.round(420 * mult));
    this.scatterRocks('klugheim', Math.round(220 * mult), rockCol.k, 2, 7);
    // Tannen
    this.scatter('klugheim', Math.round(900 * mult), 10, 300, (x, y, z) => { pineAt(x, y, z, this.R(0.9, 1.9)); out.colliders.push({ x, z, r: 0.5, y0: y, y1: y + 6 }); return true; }, 2.4, 6);
    // Vulkan: Lava-Becken & Rauch
    this.buildVolcano(volc);
    // Brücken
    this.buildBridgesKlugheim();
    // Fackeln entlang der Wege
    this.addTorches('klugheim', 30);

    // ---------- Deep in Africa
    const az = ZONES.africa, L = this.features.lake;
    this.scatter('africa', Math.round(26 * mult + 6), 20, 200, (x, y, z, rot) => { A.africanHut(this.prng, x, y, z, rot, {}, env, out); return true; }, 6);
    for (let k = 0; k < 2; k++) this.scatter('africa', 1, 40, 170, (x, y, z, rot) => { A.lodge(this.prng, x, y, z, rot, env, out); return true; }, 12);
    // dichter Dschungel
    this.scatter('africa', Math.round(500 * mult), 0, 270, (x, y, z) => { palm.add(x, y, z, this.R(0.8, 1.5), this.R(0.8, 1.5), this.R(0.8, 1.5), this.R(0, TAU), null, this.R(-0.08, 0.08), this.R(-0.08, 0.08)); out.colliders.push({ x, z, r: 0.45, y0: y, y1: y + 8 }); return true; }, 1.8, 20);
    this.scatter('africa', Math.round(460 * mult), 0, 280, (x, y, z) => { bigleaf.add(x, y, z, this.R(0.9, 1.7), this.R(0.9, 1.7), this.R(0.9, 1.7), this.R(0, TAU)); return true; }, 1.2, 14);
    this.scatter('africa', Math.round(800 * mult), 0, 290, (x, y, z) => { fern.add(x, y, z, this.R(0.8, 1.8), this.R(0.8, 1.5), this.R(0.8, 1.8), this.R(0, TAU)); return true; }, 0.8, 14);
    this.scatter('africa', Math.round(110 * mult), 0, 260, (x, y, z) => { const s = this.R(1.4, 2.6); trunks.add(x, y, z, s * 1.4, 14 * s, s * 1.4, 0, '#3a2a1c'); const col = new THREE.Color().setHSL(0.3, 0.5, 0.14); crowns.add(x, y + 12 * s, z, 6 * s, 3.4 * s, 6 * s, this.R(0, TAU), col); crowns.add(x + 3 * s, y + 10 * s, z + 2 * s, 4 * s, 2.6 * s, 4 * s, this.R(0, TAU), col); out.colliders.push({ x, z, r: 0.9 * s, y0: y, y1: y + 14 * s }); return true; }, 4, 6);
    this.scatterRocks('africa', Math.round(110 * mult), rockCol.a, 1.5, 6);
    this.buildLagoon(L);
    this.addTorches('africa', 30);
    // Totems
    for (let k = 0; k < 6; k++) this.scatter('africa', 1, 30, 180, (x, y, z, rot) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 4.2, 8), new THREE.MeshStandardMaterial({ map: A.tex.planks('#5a3a22') })); t.position.set(x, y + 2.1, z); t.castShadow = true; G.add(t); const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: 0xb8402a })); m.position.set(x, y + 3.4, z); G.add(m); out.colliders.push({ x, z, r: 0.6, y0: y, y1: y + 4 }); return true; }, 3);

    // ---------- Rookburgh
    this.alongPaths('rookburgh', Math.round(8 * mult + 3), (x, y, z, rot) => { H.steamHouse(this.prng, x, y, z, rot, env, out); return true; }, 9);
    this.scatter('rookburgh', 10, 20, 180, (x, y, z) => { this.pipeTower(x, y, z); return true; }, 5);
    this.scatterRocks('rookburgh', 40, rockCol.g, 1.2, 3.5);
    this.scatter('rookburgh', Math.round(120 * mult), 10, 240, (x, y, z) => { leafyAt(x, y, z, this.R(0.8, 1.3)); return true; }, 3, 5);
    this.addTorches('rookburgh', 26, 0xffc880);

    // ---------- Mexico
    this.alongPaths('mexico', Math.round(15 * mult + 4), (x, y, z, rot) => { H.mexicoHouse(this.prng, x, y, z, rot, env, out); return true; }, 8);
    this.scatterRocks('mexico', Math.round(240 * mult), rockCol.m, 3, 12, true);
    this.scatter('mexico', 80, 10, 190, (x, y, z) => { cactus.add(x, y, z, this.R(0.8, 1.6), this.R(0.8, 1.6), this.R(0.8, 1.6), this.R(0, TAU)); out.colliders.push({ x, z, r: 0.5, y0: y, y1: y + 3 }); return true; }, 2.5);
    this.addTorches('mexico', 16, 0xffb060);

    // ---------- Fantasy
    this.alongPaths('fantasy', Math.round(12 * mult + 4), (x, y, z, rot) => { H.toyHouse(this.prng, x, y, z, rot, env, out); return true; }, 8);
    this.scatter('fantasy', Math.round(160 * mult), 10, 200, (x, y, z) => { leafyAt(x, y, z, this.R(0.8, 1.4)); out.colliders.push({ x, z, r: 0.5, y0: y, y1: y + 4 }); return true; }, 2.5, 5);
    this.addTorches('fantasy', 20, 0xffd8a0);

    // ---------- Wald außen
    for (let k = 0; k < Math.round(1700 * mult); k++) {
      const a = this.R(0, TAU), r = this.R(430, 880), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.zoneOf(x, z) && Math.hypot(x - ZONES[this.zoneOf(x, z)].x, z - ZONES[this.zoneOf(x, z)].z) < ZONES[this.zoneOf(x, z)].r * 0.95) continue;
      if (this.nearTrackFast(x, z, 8, 30)) continue;
      const y = this.h(x, z); if (y < -0.4) continue;
      if (this.rng() < 0.6) pineAt(x, y, z, this.R(1.2, 2.4)); else leafyAt(x, y, z, this.R(1.2, 2.2));
    }

    // ---------- Themen entlang der Strecken
    for (const r of this.rides) this.themeTrack(r, addRock, rockCol, pineAt);
    for (const k in this.rocks) this.rocks[k].done();
    for (const k in this.inst) this.inst[k].done();
    // Zonen-Schilder
    for (const k of ['klugheim', 'africa', 'rookburgh', 'mexico', 'fantasy']) this.zoneSign(k);
  }

  zoneSign(key) {
    const zn = ZONES[key]; let best = null, bd = 1e9;
    for (const n of this.nodes) { const d = Math.hypot(n.x - zn.x, n.z - zn.z); if (d < bd && d > 20) { bd = d; best = n; } }
    if (!best) return;
    const g = new THREE.Group(), x = best.x + 7, z = best.z;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 5, 8), new THREE.MeshStandardMaterial({ map: A.tex.planks('#4a3322') })); post.position.y = 2.5; g.add(post);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: signTexture(zn.name, '#3a2a1c', '#ffe0a0') })); s.position.set(0, 4.6, 0.3); g.add(s);
    const s2 = s.clone(); s2.rotation.y = Math.PI; s2.position.z = -0.3; g.add(s2);
    g.position.set(x, this.h(x, z), z); g.userData.merge = true; this.group.add(g);
  }

  slopeRocks(zn, kind, cols, count) {
    let made = 0;
    for (let t = 0; t < count * 20 && made < count; t++) {
      const a = this.R(0, TAU), r = this.R(20, zn.r * 1.35), x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r;
      const y = this.h(x, z), sl = Math.abs(this.h(x + 3, z) - this.h(x - 3, z)) + Math.abs(this.h(x, z + 3) - this.h(x, z - 3));
      if (sl < 1.6 || this.nearTrackFast(x, z, 7, 9)) continue;
      this.addRock(x, y + 0.2, z, this.R(3, 11), cols[kind][Math.floor(this.rng() * cols[kind].length)], true); made++;
    }
  }
  scatterRocks(key, count, cols, smin, smax, collide = true) {
    this.scatter(key, count, 6, ZONES[key].r * 1.2, (x, y, z) => { this.addRock(x, y + smin * 0.1, z, this.R(smin, smax), cols[Math.floor(this.rng() * cols.length)], collide); return true; }, smin * 0.8 + 1, 5);
  }

  pipeTower(x, y, z) {
    const iron = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.6, metalness: 0.7 });
    const g = new THREE.Group(); g.position.set(x, y, z);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 16, 6), iron); l.position.set(sx * 2.2, 8, sz * 2.2); l.castShadow = true; g.add(l); }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 5, 14), iron); tank.position.y = 18.5; tank.castShadow = true; g.add(tank);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.8, 2, 14), iron); cap.position.y = 22; g.add(cap);
    g.userData.merge = true; this.group.add(g); this.out.colliders.push({ x, z, r: 3.6, y0: y, y1: y + 18 });
  }

  addTorches(key, count, color = 0xff8a30) {
    const zn = ZONES[key], edges = this.edges.filter(e => Math.hypot((this.nodes[e[0]].x + this.nodes[e[1]].x) / 2 - zn.x, (this.nodes[e[0]].z + this.nodes[e[1]].z) / 2 - zn.z) < zn.r);
    if (!edges.length) return;
    const poleG = new THREE.CylinderGeometry(0.06, 0.09, 2.6, 6); poleG.translate(0, 1.3, 0);
    const pm = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 1 });
    const inst = new A.Inst(poleG, pm, count, this.group);
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const e = edges[k % edges.length], A_ = this.nodes[e[0]], B_ = this.nodes[e[1]], L = Math.hypot(B_.x - A_.x, B_.z - A_.z), t = this.R(2, Math.max(3, L - 2));
      const nx = -(B_.z - A_.z) / L, nz = (B_.x - A_.x) / L, side = k % 2 ? 1 : -1, x = A_.x + (B_.x - A_.x) * t / L + nx * (e[2] / 2 + 0.8) * side, z = A_.z + (B_.z - A_.z) * t / L + nz * (e[2] / 2 + 0.8) * side, y = this.h(x, z);
      inst.add(x, y, z, 1, 1, 1);
      this.out.glow.push([x, y + 2.8, z, c.r, c.g * 0.8, c.b * 0.6, 24]);
      this.out.lights.push({ x, y: y + 2.8, z, color, int: 4.5, range: 12, flicker: 0.35 });
      this.torchPts.push([x, y + 2.8, z]);
    }
    inst.done();
  }

  // ------------------------------------------------------------------ Vulkan
  buildVolcano(v) {
    const lava = new THREE.Mesh(new THREE.CircleGeometry(v.crater * 0.8, 24), new THREE.MeshStandardMaterial({ color: 0x331000, emissive: 0xff5a10, emissiveIntensity: 2.2 }));
    lava.rotation.x = -Math.PI / 2; const cy = this.h(v.x, v.z) + 3.2; lava.position.set(v.x, cy, v.z); this.group.add(lava); this.lava = lava;
    this.out.lights.push({ x: v.x, y: cy + 4, z: v.z, color: 0xff6a20, int: 90, range: 160, flicker: 0.2 });
    for (let k = 0; k < 40; k++) { const a = this.R(0, TAU), r = this.R(0, v.crater * 0.7); this.out.glow.push([v.x + Math.cos(a) * r, cy + 0.5, v.z + Math.sin(a) * r, 1, 0.35, 0.05, 40 + this.R(0, 40)]); }
    // Lavabäche am Hang
    for (let k = 0; k < 5; k++) {
      let a = this.R(0, TAU), x = v.x + Math.cos(a) * v.crater, z = v.z + Math.sin(a) * v.crater;
      for (let s = 0; s < 30; s++) { x += Math.cos(a) * 3 + this.R(-1, 1); z += Math.sin(a) * 3 + this.R(-1, 1); const y = this.h(x, z); this.out.glow.push([x, y + 0.5, z, 1, 0.3, 0.04, 22]); }
    }
    this.smoke(v.x, cy + 2, v.z, 'volcano');
  }
  smoke(x, y, z, kind) {
    const mat = new THREE.SpriteMaterial({ map: textures.cloud(), color: kind === 'volcano' ? 0x55504c : kind === 'steam' ? 0xf2f2f0 : 0x8a8680, transparent: true, depthWrite: false, opacity: 0.0, fog: true });
    const n = kind === 'volcano' ? 22 : kind === 'steam' ? 5 : 7;
    for (let k = 0; k < n; k++) { const s = new THREE.Sprite(mat.clone()); s.userData = { x, y, z, t: this.R(0, 1), kind, sp: this.R(0.5, 1) }; this.group.add(s); this.smokeSprites.push(s); }
  }

  // ------------------------------------------------------------------ Brücken
  bridge(a, b, w, yTop, opts = {}) {
    const g = new THREE.Group();
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    g.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2); g.rotation.y = -ang;
    const wood = new THREE.MeshStandardMaterial({ map: A.tex.planks(opts.col || '#4a3322'), roughness: 1 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.28, w), wood); deck.position.y = yTop - 0.14; deck.castShadow = deck.receiveShadow = true; g.add(deck);
    const rail = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 1 });
    for (const sz of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(L, 0.1, 0.12), rail); r.position.set(0, yTop + 1.0, sz * w / 2); g.add(r); for (let t = -L / 2; t <= L / 2; t += 3) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), rail); p.position.set(t, yTop + 0.5, sz * w / 2); g.add(p); } }
    const h0 = this.h(a[0], a[1]);
    if (opts.arch) { // Steinbogen
      const stone = new THREE.MeshStandardMaterial({ map: A.tex.stone(), roughness: 1 });
      for (const sz of [-1, 1]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(L, 1.2, 0.5), stone); wall.position.set(0, yTop + 0.3, sz * (w / 2 + 0.1)); g.add(wall); }
      for (const sx of [-1, 1]) { const pier = new THREE.Mesh(new THREE.BoxGeometry(2.5, 6, w + 0.6), stone); pier.position.set(sx * (L / 2 - 1), yTop - 3, 0); g.add(pier); }
    } else for (const sx of [-1, 1]) { const pier = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), rail); pier.position.set(sx * (L / 2 - 2), yTop - 3, 0); g.add(pier); }
    g.userData.merge = true; this.group.add(g);
    this.out.platforms.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], hw: w / 2, yTop });
    // seitliche Geländer als Kollision
    for (const sz of [-1, 1]) { const nx = -Math.sin(ang) * sz * (w / 2), nz = Math.cos(ang) * sz * (w / 2); this.out.colliders.push({ x: (a[0] + b[0]) / 2 + nx, z: (a[1] + b[1]) / 2 + nz, hx: L / 2, hz: 0.1, rot: -ang, y0: yTop, y1: yTop + 1.1 }); }
  }
  buildBridgesKlugheim() {
    const rv = this.features.river;
    const mk = (i, t, w, arch, yTop) => {
      const A_ = rv[i], B_ = rv[i + 1], x = A_[0] + (B_[0] - A_[0]) * t, z = A_[1] + (B_[1] - A_[1]) * t, dx = B_[0] - A_[0], dz = B_[1] - A_[1], L = Math.hypot(dx, dz);
      const nx = -dz / L, nz = dx / L, half = 19;
      this.bridge([x - nx * half, z - nz * half], [x + nx * half, z + nz * half], w, yTop, { arch, col: arch ? undefined : '#3c2a1c' });
      this.markFlat(x, z, 12);
    };
    mk(1, 0.5, 4.5, true, 0.5); mk(2, 0.55, 3, false, 0.45); mk(3, 0.4, 4, true, 0.5);
    // Flusswasser
    const wm = new THREE.MeshStandardMaterial({ map: textures.water().clone(), color: 0x4a7a98, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 });
    wm.map.repeat.set(1, 1); const pos = [], uv = [], idx = [];
    let prev = null, acc = 0;
    for (let i = 0; i < rv.length - 1; i++) {
      const A_ = rv[i], B_ = rv[i + 1], L = Math.hypot(B_[0] - A_[0], B_[1] - A_[1]), n = Math.round(L / 6), dx = (B_[0] - A_[0]) / L, dz = (B_[1] - A_[1]) / L;
      for (let k = 0; k <= n; k++) { const x = A_[0] + (B_[0] - A_[0]) * k / n, z = A_[1] + (B_[1] - A_[1]) * k / n, hw = 7; const q = pos.length / 3; pos.push(x - dz * hw, -0.95, z + dx * hw, x + dz * hw, -0.95, z - dx * hw); uv.push(0, acc / 14, 1, acc / 14); acc += L / n; if (prev !== null && !(i > 0 && k === 0)) idx.push(prev, prev + 1, q + 1, prev, q + 1, q); prev = q; }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const river = new THREE.Mesh(geo, wm); this.group.add(river); this.waterAnims.push(wm.map);
  }

  // ------------------------------------------------------------------ Lagune mit Wasserfällen & Brücken
  buildLagoon(L) {
    const wm = new THREE.MeshStandardMaterial({ map: textures.water().clone(), color: 0x3a8a8a, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.9 });
    wm.map.repeat.set(8, 6); this.waterAnims.push(wm.map);
    const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 40), wm); lake.rotation.x = -Math.PI / 2; lake.scale.set(L.rx * 1.12, L.rz * 1.12, 1); lake.rotation.z = 0; lake.position.set(L.x, -0.55, L.z); this.group.add(lake);
    lake.scale.set(L.rx * 1.12, L.rz * 1.12, 1); lake.rotation.set(-Math.PI / 2, 0, 0);
    this.lakeMesh = lake;
    // Felswand mit 3 Wasserfällen im Norden
    const baseZ = L.z - L.rz - 2, cols = ['#6a5a45', '#5a4c3a', '#7a6a55', '#4a4a3e'];
    for (let k = 0; k < 34; k++) { const x = L.x - L.rx * 1.2 + (k / 33) * L.rx * 2.4, z = baseZ - this.R(0, 14); this.addRock(x, this.h(x, z) + 6, z, this.R(9, 17), cols[k % 4], true); }
    for (let k = 0; k < 18; k++) { const x = L.x - L.rx * 1.1 + this.R(0, L.rx * 2.2), z = baseZ - this.R(4, 20); this.addRock(x, 14 + this.R(0, 6), z, this.R(8, 14), cols[k % 4], false); }
    const wf = A.waterfallMaterial(); this.wfMats = [wf];
    const falls = [L.x - 38, L.x + 2, L.x + 40];
    falls.forEach((fx, i) => {
      const hgt = 20 - i * 2, w = 7 - i;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt, 1, 1), wf); m.position.set(fx, hgt / 2 - 1, baseZ + 3.2); this.group.add(m);
      const m2 = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.55, hgt, 1, 1), wf); m2.position.set(fx + 3.5, hgt / 2 - 1, baseZ + 4.2); m2.rotation.y = 0.15; this.group.add(m2);
      this.out.glow.push([fx, 2, baseZ + 4, 0.3, 0.7, 1, 90], [fx, 8, baseZ + 3.5, 0.3, 0.65, 1, 60], [fx, 14, baseZ + 3.5, 0.3, 0.6, 1, 50]);
      this.out.lights.push({ x: fx, y: 3, z: baseZ + 6, color: 0x4aa8ff, int: 18, range: 30, flicker: 0.05 });
      for (let q = 0; q < 6; q++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.cloud(), color: 0xe8f4ff, transparent: true, opacity: 0.35, depthWrite: false })); s.scale.set(16, 8, 1); s.position.set(fx + this.R(-6, 6), 2 + this.R(0, 3), baseZ + 7 + this.R(-2, 4)); s.userData.base = s.position.clone(); this.group.add(s); this.mist.push(s); }
    });
    // Hängebrücke über die Lagune + Holzsteg
    const y0 = 1.3;
    this.bridge([L.x - L.rx - 9, L.z + 6], [L.x + L.rx + 9, L.z + 10], 2.4, y0, { col: '#5a3f26' });
    this.bridge([L.x - 20, L.z - L.rz + 5], [L.x - 20, L.z + 12], 2.0, y0 - 0.1, { col: '#4a3322' });
    // Beleuchtung unter Wasser
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; this.out.glow.push([L.x + Math.cos(a) * L.rx * 0.7, -0.4, L.z + Math.sin(a) * L.rz * 0.7, 0.2, 0.9, 0.8, 70]); }
    this.markFlat(L.x, L.z + 8, 6);
  }

  // ------------------------------------------------------------------ Strecken-Themen
  themeTrack(r, addRock, rockCol, pineAt) {
    const zone = r.zone, tr = r.track, n = r.wn, out = this.out;
    const wp = r.wp, hAbove = k => wp[k * 3 + 1] - Math.max(-1, this.h(wp[k * 3], wp[k * 3 + 2]));
    const skip = Math.ceil((tr.stationLen + 24) / 2), endSkip = n - 8;
    const rocky = zone === 'klugheim' || zone === 'mexico' || zone === 'mystery', jungle = zone === 'africa', industrial = zone === 'rookburgh';
    const cols = zone === 'mexico' ? rockCol.m : zone === 'klugheim' ? rockCol.k : zone === 'africa' ? rockCol.a : rockCol.g;
    // Tunnelabschnitte (tief + gerade)
    const tunnels = []; let st = -1;
    for (let k = skip; k < endSkip; k++) {
      const low = hAbove(k) < (r.spec.rider === 'inv' || r.spec.rider === 'fly' ? 7 : 4.8) && Math.abs(r.wu[k] - 1) < 0.2;
      if (low && st < 0) st = k; if ((!low || k === endSkip - 1) && st >= 0) { if (k - st >= 18) tunnels.push([st, k]); st = -1; }
    }
    const civic = zone === 'berlin' || zone === 'fantasy' || zone === 'china'; // Stadt-/Märchen-/Gartenwelten: keine Felstunnel und Felssäulen (wirkten wie schwarze Findlinge rund um den Kaiserplatz)
    const maxTun = civic ? 0 : rocky || jungle ? 3 : 1;
    const chosen = tunnels.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, maxTun);
    const inv = r.spec.rider === 'inv' || r.spec.rider === 'fly';
    for (const [k0, k1] of chosen) {
      const a0 = k0 + 3, a1 = k1 - 3; r.tunnels = (r.tunnels || []).concat([[a0, a1]]);
      for (let k = a0; k < a1; k += 3) {
        const x = wp[k * 3], y = wp[k * 3 + 1], z = wp[k * 3 + 2], rx = r.wr[k * 2], rz = r.wr[k * 2 + 1], gy = Math.max(0, this.h(x, z));
        const rad = inv ? 6.4 : 5.0, cy = y - (inv ? 1.5 : 0.8);
        for (let q = 0; q <= 8; q++) {
          const ang = q / 8 * Math.PI, ox = Math.cos(ang) * rad, oy = Math.sin(ang) * rad;
          const s = this.R(2.6, 3.8), px = x + rx * ox, pz = z + rz * ox, py = Math.max(gy, cy + oy - s * 0.5);
          addRock(px, py, pz, s, cols[(q + k) % cols.length], false);
        }
        for (let q = 0; q < 2; q++) addRock(x + rx * this.R(-4, 4), cy + rad + 0.6, z + rz * this.R(-4, 4), this.R(3, 4.6), cols[(k + q) % cols.length], false);
        // Außen große Felsen als Berg über dem Tunnel
        if (k % 6 === 0) addRock(x + rx * this.R(-5, 5), cy + rad + 2, z + rz * this.R(-5, 5), this.R(6, 10), cols[k % cols.length], false);
      }
      // Beleuchtung im Tunnel
      for (let k = a0; k < a1; k += 6) { const x = wp[k * 3], y = wp[k * 3 + 1], z = wp[k * 3 + 2]; this.out.glow.push([x, y + 3.2, z, 1, 0.55, 0.2, 34]); if (k % 12 === (a0 % 12)) this.out.lights.push({ x, y: y + 3, z, color: 0xff9a50, int: 7, range: 16, flicker: 0.25, inside: true }); }
      // Eingangs-Fackeln
      for (const k of [a0, a1]) { const x = wp[k * 3], z = wp[k * 3 + 2], y = wp[k * 3 + 1]; this.out.glow.push([x + r.wr[k * 2] * 3.2, y + 0.8, z + r.wr[k * 2 + 1] * 3.2, 1, 0.5, 0.15, 30], [x - r.wr[k * 2] * 3.2, y + 0.8, z - r.wr[k * 2 + 1] * 3.2, 1, 0.5, 0.15, 30]); this.out.lights.push({ x, y: y + 1.5, z, color: 0xff9040, int: 6, range: 14, flicker: 0.3 }); }
      r.tunnelLights = true;
    }
    const inTunnel = k => (r.tunnels || []).some(([a, b]) => k >= a - 2 && k <= b + 2);
    // Schlucht-Felsen entlang tiefer Abschnitte
    if (rocky) for (let k = skip; k < endSkip; k += 5) {
      if (hAbove(k) > 7 || inTunnel(k)) continue;
      const x = wp[k * 3], z = wp[k * 3 + 2], rx = r.wr[k * 2], rz = r.wr[k * 2 + 1];
      for (const sd of [-1, 1]) {
        if (this.rng() < 0.45) continue;
        const o = this.R(7.5, 17), s = this.R(2.6, 7), px = x + rx * o * sd, pz = z + rz * o * sd;
        if (this.nearTrackFast(px, pz, 6, 9)) continue;
        addRock(px, this.h(px, pz) + s * 0.1, pz, s, cols[Math.floor(this.rng() * cols.length)], true);
        if (this.rng() < 0.25) { const s2 = this.R(9, 16), o2 = o + this.R(6, 10), qx = x + rx * o2 * sd, qz = z + rz * o2 * sd; addRock(qx, this.h(qx, qz) + s2 * 0.2, qz, s2, cols[Math.floor(this.rng() * cols.length)], true); }
      }
    }
    // Beinahe-Treffer: Säulen/Stämme knapp neben der Bahn
    const spots = []; for (let k = skip + 6; k < endSkip - 6; k += 1) if (!inTunnel(k) && hAbove(k) > 2.5 && hAbove(k) < 14 && Math.abs(r.wu[k] - 1) < 0.15 && this.rng() < 0.012) spots.push(k);
    for (const k of (civic ? [] : spots).slice(0, 7)) {
      const x = wp[k * 3], y = wp[k * 3 + 1], z = wp[k * 3 + 2], gy = this.h(x, z), sd = this.rng() < 0.5 ? -1 : 1, o = 3.1;
      const px = x + r.wr[k * 2] * o * sd, pz = z + r.wr[k * 2 + 1] * o * sd, hh = y - gy + 3;
      if (jungle) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, hh, 8), new THREE.MeshStandardMaterial({ map: A.tex.planks('#3a2a1c') })); t.position.set(px, gy + hh / 2, pz); t.castShadow = true; this.group.add(t); }
      else if (industrial) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.9, hh, 0.9), new THREE.MeshStandardMaterial({ color: 0x3a3e44, metalness: 0.7, roughness: 0.5 })); t.position.set(px, gy + hh / 2, pz); t.castShadow = true; this.group.add(t); }
      else { for (let q = 0; q < hh; q += 2.2) addRock(px, gy + q, pz, 1.9 + this.R(0, 0.6), cols[q % cols.length], false); }
    }
    // Dschungel: üppige Bepflanzung direkt an der Strecke
    if (jungle) for (let k = skip; k < endSkip; k += 2) {
      if (hAbove(k) > 9) continue;
      const x = wp[k * 3], z = wp[k * 3 + 2];
      for (let q = 0; q < 3; q++) {
        const sd = this.rng() < 0.5 ? -1 : 1, o = this.R(3.6, 11), px = x + r.wr[k * 2] * o * sd, pz = z + r.wr[k * 2 + 1] * o * sd, py = this.h(px, pz);
        if (py < -0.3 || this.nearTrackFast(px, pz, 3.4, 9) || this.nearStation(px, pz)) continue;
        if (this.rng() < 0.45) this.inst.palm.add(px, py, pz, this.R(0.9, 1.6), this.R(0.9, 1.6), this.R(0.9, 1.6), this.R(0, TAU)); else this.inst.bigleaf.add(px, py, pz, this.R(1, 1.8), this.R(1, 1.8), this.R(1, 1.8), this.R(0, TAU));
      }
    }
    // Industrie: Rohrbrücken über die Strecke
    if (industrial) for (let c = 0, k = skip + 10; k < endSkip && c < 6; k += 40 + Math.floor(this.rng() * 30)) {
      if (hAbove(k) > 4) continue; c++;
      const x = wp[k * 3], y = wp[k * 3 + 1], z = wp[k * 3 + 2], rx = r.wr[k * 2], rz = r.wr[k * 2 + 1], gy = this.h(x, z), iron = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.6, metalness: 0.7 });
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 22, 10), iron); pipe.position.set(x, y + 7, z); pipe.rotation.z = Math.PI / 2; pipe.rotation.y = Math.atan2(rz, rx) * -1; pipe.rotation.set(0, -Math.atan2(rz, rx), Math.PI / 2); pipe.castShadow = true; this.group.add(pipe);
      for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, y + 7 - gy, 0.7), iron); p.position.set(x + rx * 11 * sd, gy + (y + 7 - gy) / 2, z + rz * 11 * sd); p.castShadow = true; this.group.add(p); }
      this.out.glow.push([x, y + 6.2, z, 1, 0.6, 0.25, 26]);
    }
    // beleuchtete Schienen (Leuchtpunkte)
    const { railOff, gauge } = railOffsets(r.spec); const col = new THREE.Color(r.coaster.trackColor).lerp(new THREE.Color(0xffffff), 0.35);
    const cx = 0.4 + col.r, cy = 0.4 + col.g, cz = 0.4 + col.b; const th = r.th, cos = Math.cos(th), sin = Math.sin(th);
    for (let i = 0; i < tr.N; i += 5) {
      const lx = tr.P[i * 3] + tr.U[i * 3] * railOff, ly = tr.P[i * 3 + 1] + tr.U[i * 3 + 1] * railOff + r.yOff, lz = tr.P[i * 3 + 2] + tr.U[i * 3 + 2] * railOff;
      const sd = (i % 10 === 0) ? 1 : -1, rx = tr.R[i * 3] * gauge * sd, rz = tr.R[i * 3 + 2] * gauge * sd;
      const px = lx + rx, pz = lz + rz;
      out.glow.push([r.ox + px * cos + pz * sin, ly + tr.R[i * 3 + 1] * gauge * sd, r.oz - px * sin + pz * cos, Math.min(1.2, cx), Math.min(1.2, cy), Math.min(1.2, cz), 9]);
    }
    // Station: Lichter
    const sl = tr.stationLen || 28;
    for (let x = 0; x <= sl; x += 7) { const wx = r.ox + x * cos + 3 * sin, wz = r.oz - x * sin + 3 * cos; out.glow.push([wx, r.yOff + 3.6, wz, 1, 0.8, 0.5, 26]); }
    this.out.lights.push({ x: r.ox + (sl / 2) * cos, y: r.yOff + 3.6, z: r.oz - (sl / 2) * sin, color: 0xffd8a0, int: 10, range: 22, flicker: 0, inside: true });
    r.stationWorld = new THREE.Vector3(r.ox + (sl / 2) * cos, r.yOff, r.oz - (sl / 2) * sin);
  }

  // ------------------------------------------------------------------ Effekte, Lichter
  buildEffects() {
    const out = this.out, G = this.group;
    // Nebel-Schwaden (Bodennebel)
    const nm = { low: 40, medium: 110, high: 190 }[this.quality] || 110;
    for (let k = 0; k < nm; k++) {
      const key = ['klugheim', 'africa', 'rookburgh', 'klugheim', 'africa'][k % 5], zn = ZONES[key];
      const a = this.R(0, TAU), r = this.R(10, zn.r * 1.1), x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r, y = this.h(x, z);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.cloud(), color: 0xc8d0d8, transparent: true, opacity: key === 'rookburgh' ? 0.14 : 0.22, depthWrite: false }));
      const sz = this.R(30, 70); s.scale.set(sz, sz * 0.3, 1); s.position.set(x, Math.max(0, y) + this.R(2, 8), z); s.userData.base = s.position.clone(); s.userData.ph = this.R(0, TAU); G.add(s); this.mist.push(s);
    }
    // Leuchtpunkte
    this.glow = A.glowPoints(out.glow); G.add(this.glow);
    // Dynamische Lichter (Pool)
    this.lightSrc = out.lights;
    this.pool = []; const N = { low: 6, medium: 10, high: 16 }[this.quality] || 10;
    for (let k = 0; k < N; k++) { const l = new THREE.PointLight(0xffa050, 0, 20, 1.6); l.castShadow = false; G.add(l); this.pool.push(l); }
    this.poolT = 0; this.time = 0;
    // Rauch für Industrie-Schlote
    for (const s of out.smoke) this.smoke(s.x, s.y, s.z, s.kind || 'smoke');
  }

  // ------------------------------------------------------------------ Kollision & Boden
  makeBuilding(x, z, rotY, w, d, h, th) { // begehbares Haus mit Fassade, Dach, Schornstein, Blumenkästen und Innenraum
    const rng = this.rng, y = Math.max(0.05, this.h(x, z)), wall = th.walls[Math.floor(rng() * th.walls.length)];
    const wallMat = new THREE.MeshStandardMaterial({ map: textures.facade(wall, th.trim, th.style), roughness: 0.9 });
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
    A.hollow(g, x, y, z, rotY, w, d, h, wallMat, { kind: 'home', floor: '#7a5a3a', rug: 0x8a2a2a }, this.env, this.out);
    const roofCol = th.roof[Math.floor(rng() * th.roof.length)], roofMat = new THREE.MeshStandardMaterial({ map: textures.roofTile(), color: roofCol, roughness: 0.8, side: THREE.DoubleSide });
    const rh = Math.min(w, d) * this.R(0.34, 0.5), roof = new THREE.Mesh(gableGeometry(w + 1.1, d + 1.0, rh), roofMat); roof.position.y = h; roof.castShadow = true; g.add(roof);
    A.box(g, 0.9, rh * 0.9, 0.9, new THREE.MeshStandardMaterial({ map: A.tex.stone(), roughness: 1 }), w * 0.28, h + rh * 0.6, -d * 0.12);
    const win = A.M('fwin2', () => { const m = new THREE.MeshStandardMaterial({ map: A.tex.window(), emissive: 0xffa040, emissiveMap: A.tex.window(), emissiveIntensity: 0.4, roughness: 0.6 }); this.env.registerLamp(m); return m; });
    const n = Math.max(2, Math.floor(w / 3.6)); for (let r = 0; r < Math.max(1, Math.floor(h / 3.4)); r++) A.windowsOn(g, w, d, h, n, win, 1.9 + r * 3.3);
    A.flowerBoxes(g, w, d, n, 1.0);
    g.userData.merge = true; this.group.add(g); this.buildings.push({ x, z, rot: rotY, w, d, hollow: true }); return g;
  }
  buildRockColliders() { // jede Felsen-Instanz bekommt einen Kollisionskreis (aus Position/Skalierung) → kein Durchlaufen; Felsen auf Wegen werden entfernt → Wege bleiben frei
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), zero = new THREE.Vector3(0, 0, 0), segs = this.edges.map(e => ({ A: this.nodes[e[0]], B: this.nodes[e[1]], w: e[2] }));
    for (const pl of this.plazas || []) segs.push({ A: { x: pl.x, z: pl.z }, B: { x: pl.x, z: pl.z }, w: pl.r * 2 }); // Eingangsplätze frei von Felsen
    const onPath = (x, z, r) => { for (const e of segs) { const vx = e.B.x - e.A.x, vz = e.B.z - e.A.z, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - e.A.x) * vx + (z - e.A.z) * vz) / L2)), d = Math.hypot(x - (e.A.x + vx * t), z - (e.A.z + vz * t)); if (d < e.w / 2 + 0.8 + r * 0.7) return true; } return false; };
    let n = 0, removed = 0;
    for (const k in this.rocks) {
      const im = this.rocks[k].mesh;
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m); m.decompose(p, q, sc); const r = 0.82 * Math.max(sc.x, sc.z);
        if (onPath(p.x, p.z, r)) { m.compose(p, q, zero); im.setMatrixAt(i, m); removed++; continue; }
        if (r < 0.4) continue; this.out.colliders.push({ x: p.x, z: p.z, r, y0: p.y - 1.5, y1: p.y + sc.y * 0.75 }); n++;
      }
      im.instanceMatrix.needsUpdate = true;
    }
    this.rockColliders = n; this.rocksRemoved = removed;
  }
  buildColliderHash() {
    const c = 12; this.chash = new Map(); this.cc = c;
    for (const col of this.out.colliders) {
      const rr = col.r !== undefined ? col.r : Math.hypot(col.hx, col.hz) + 0.5;
      const i0 = Math.floor((col.x - rr) / c), i1 = Math.floor((col.x + rr) / c), j0 = Math.floor((col.z - rr) / c), j1 = Math.floor((col.z + rr) / c);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i * 100003 + j; let a = this.chash.get(k); if (!a) this.chash.set(k, a = []); a.push(col); }
    }
  }
  groundAt(x, z, yFeet = 100) {
    let g = this.h(x, z);
    for (const p of this.out.platforms) {
      if (p.flat) { // rotierte Rechteckplattform
        const dx = x - p.cx, dz = z - p.cz, c = Math.cos(p.rot), s = Math.sin(p.rot), lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) < p.hx && Math.abs(lz) < p.hz && p.yTop <= yFeet + 0.7 && p.yTop > g) g = p.yTop;
      } else {
        const vx = p.bx - p.ax, vz = p.bz - p.az, L2 = vx * vx + vz * vz, t = ((x - p.ax) * vx + (z - p.az) * vz) / L2;
        if (t < 0 || t > 1) continue;
        const px = p.ax + vx * t, pz = p.az + vz * t;
        if (Math.hypot(x - px, z - pz) < p.hw && p.yTop <= yFeet + 0.7 && p.yTop > g) g = p.yTop;
      }
    }
    return g;
  }
  collide(pos, r, yFeet) {
    const c = this.cc, i = Math.floor(pos.x / c), j = Math.floor(pos.z / c);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const a = this.chash.get((i + di) * 100003 + (j + dj)); if (!a) continue;
      for (const col of a) {
        if (yFeet > col.y1 - 0.25 || yFeet + 1.7 < col.y0) continue;
        if (col.r !== undefined) {
          const dx = pos.x - col.x, dz = pos.z - col.z, d = Math.hypot(dx, dz), m = col.r + r;
          if (d < m && d > 1e-4) { pos.x = col.x + dx / d * m; pos.z = col.z + dz / d * m; }
        } else {
          const cs = Math.cos(col.rot), sn = Math.sin(col.rot), dx = pos.x - col.x, dz = pos.z - col.z;
          let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
          const ex = col.hx + r, ez = col.hz + r;
          if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
            const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
            if (px < pz) lx = Math.sign(lx || 1) * ex; else lz = Math.sign(lz || 1) * ez;
            pos.x = col.x + lx * cs + lz * sn; pos.z = col.z - lx * sn + lz * cs;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ Update
  setCam(p) { this.camPos = p; }
  update(dt, simDt) {
    this.time += dt;
    const env = this.env, night = env.night ?? 0;
    for (const r of this.rides) {
      for (const s of r.sets) { if (r.replayHook && s.sim === r.sim) r.replayHook(); else s.sim.step(simDt); s.train.update(s.sim); }
    }
    for (const a of this.anims) a(dt);
    for (const s of this.out.spinners) s.obj.rotation[s.axis] += s.speed * dt; // Zahnräder & Co.
    this.updateVisitors(dt);
    // Wasser / Wasserfälle
    for (const t of this.waterAnims) t.offset.y -= dt * 0.04;
    for (const m of this.wfMats || []) { m.uniforms.uTime.value = this.time; m.uniforms.uNight.value = night; }
    if (this.glow) { this.glow.material.uniforms.uNight.value = Math.min(1, night * 1.15); this.glow.material.uniforms.uScale.value = window.innerHeight * 0.72; }
    if (this.lava) this.lava.material.emissiveIntensity = 1.6 + Math.sin(this.time * 2.3) * 0.5 + night * 1.2;
    for (const s of this.mist) { const u = s.userData; if (u.base) { s.position.x = u.base.x + Math.sin(this.time * 0.1 + (u.ph || 0)) * 4; s.material.opacity = (u.ph !== undefined ? 0.2 : 0.3) * (1 - night * 0.55); } }
    for (const s of this.smokeSprites) {
      const u = s.userData; u.t += dt * 0.12 * u.sp; if (u.t > 1) u.t = 0;
      const k = u.t, vol = u.kind === 'volcano', stm = u.kind === 'steam';
      s.position.set(u.x + k * (vol ? 30 : stm ? 5 : 10) + Math.sin(k * 6 + u.sp * 9) * (stm ? 1.2 : 3), u.y + k * (vol ? 120 : stm ? 15 : 34), u.z + k * (stm ? 2 : 6));
      const sz = (vol ? 16 : stm ? 2.5 : 6) + k * (vol ? 70 : stm ? 7 : 20); s.scale.set(sz, sz, 1);
      s.material.opacity = Math.sin(k * Math.PI) * (vol ? 0.5 : stm ? 0.55 : 0.4);
    }
    // Lichtpool + Zonen-Atmosphäre
    const cp = this.camPos;
    if (cp) {
      this.poolT -= dt;
      if (this.poolT <= 0) {
        this.poolT = 0.25;
        const cand = [];
        for (const l of this.lightSrc) { const d = (l.x - cp.x) ** 2 + (l.y - cp.y) ** 2 + (l.z - cp.z) ** 2; if (d < 70 * 70) cand.push([d, l]); }
        cand.sort((a, b) => a[0] - b[0]);
        this.pool.forEach((p, i) => { const c = cand[i]; if (!c) { p.userData.target = 0; return; } const l = c[1]; p.position.set(l.x, l.y, l.z); p.color.set(l.color); p.distance = l.range * 1.6; p.userData.src = l; p.userData.target = 1; });
      }
      for (const p of this.pool) { const l = p.userData.src; if (!l) continue; const base = l.int * Math.min(1, night * 1.4 + (l.inside ? 0.25 : 0)); const fl = 1 + (l.flicker || 0) * (Math.sin(this.time * 17 + l.x) * 0.5 + Math.sin(this.time * 7.3 + l.z) * 0.5); const tgt = base * fl * (p.userData.target || 0); p.intensity += (tgt - p.intensity) * Math.min(1, dt * 6); }
      // Nebel/Ambiente je Zone
      let fm = 1, am = 1; const tint = new THREE.Color();
      let tw = 0;
      for (const k in ZONES) { const zn = ZONES[k], d = Math.hypot(cp.x - zn.x, cp.z - zn.z), w = 1 - sstep(zn.r * 0.5, zn.r * 1.05, d); if (w > 0) { fm += (zn.fog - 1) * w; am += (zn.amb - 1) * w; if (zn.fog > 1.2) { tint.r += zn.fogCol[0] * w; tint.g += zn.fogCol[1] * w; tint.b += zn.fogCol[2] * w; tw += w; } } }
      env.fogMul += (fm - env.fogMul) * Math.min(1, dt * 1.5); env.ambMul += (am - env.ambMul) * Math.min(1, dt * 1.5);
      env.fogTintAmt = Math.min(0.7, tw); if (tw > 0) env.fogTint = tint.multiplyScalar(1 / tw);
    }
  }

  // ------------------------------------------------------------------ Extras: Zonen, POIs, Winter, Routen
  buildExtras() {
    const rng = this.prng, out = this.out;
    buildChina(this, rng); buildMystery(this, rng); buildBerlin(this, rng); buildParking(this, rng); buildAirship(this);
    // Stichwege zu den POIs (für Besucher und Navigation)
    const spur = [];
    for (const p of this.pois) {
      const n = this.node(p.ax, p.az); p.node = n; let best = -1, bd = 1e9;
      for (let i = 0; i < this.nodes.length; i++) { if (i === n) continue; const d = Math.hypot(this.nodes[i].x - p.ax, this.nodes[i].z - p.az); if (d < bd && d > 1) { bd = d; best = i; } }
      if (best >= 0) { this.edge(n, best, 3); spur.push([n, best]); }
    }
    this.spurMesh(spur);
    for (const pt of buildLightStrings(this)) out.glow.push(pt);
    this.winterGroup = buildWinterDecor(this, rng);
    for (const k of ['china', 'mystery']) this.zoneSign(k);
    // Interaktionspunkte
    this.interactables = [];
    for (const p of this.pois) this.interactables.push({ type: 'poi', poi: p, x: p.ax, z: p.az, r: p.kind === 'hotel' ? 9 : p.kind === 'stage' ? 10 : p.kind === 'flat' ? 7 : p.kind === 'restaurant' || p.kind === 'shop' ? 6 : 4.5, name: p.name, kind: p.kind });
    for (const r of this.rides) this.interactables.push({ type: 'ride', ride: r, x: r.entrance.x, z: r.entrance.z, r: 16, name: r.coaster.name, kind: 'ride' });
    this.interactables.push({ type: 'gate', x: 0, z: 352, r: 16, name: 'Ticketscanner / Eingang', kind: 'gate' });
    for (const r of this.rides) this.makeQueueSign(r);
    buildTrackBridges(this); buildEntrances(this);
    buildWorldExtras(this);
    buildWorldExtras2(this); // China Town (Ehrentor, Bambus, Kirschbäume), Wuze Town, Fassaden der Fahrgeschäfte
    buildBeauty(this);
    this.mergeStats = bakeStatic(this); // statische Gebäudeteile je Material/Kachel zusammenfassen (Draw-Calls)
    this.winter = false; this.hist = { inPark: 0, entered: 0 };
  }
  spurMesh(spur) {
    const pos = [], uv = [], idx = [];
    for (const [a, b] of spur) {
      const A_ = this.nodes[a], B_ = this.nodes[b], L = Math.hypot(B_.x - A_.x, B_.z - A_.z) || 1, nx = -(B_.z - A_.z) / L * 1.5, nz = (B_.x - A_.x) / L * 1.5, i = pos.length / 3;
      const ya = Math.max(0.05, this.h(A_.x, A_.z)) + 0.09, yb = Math.max(0.05, this.h(B_.x, B_.z)) + 0.09;
      pos.push(A_.x + nx, ya, A_.z + nz, A_.x - nx, ya, A_.z - nz, B_.x - nx, yb, B_.z - nz, B_.x + nx, yb, B_.z + nz); uv.push(0, 0, 1, 0, 1, L / 3, 0, L / 3); idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); upNormals(geo);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: textures.paving(), side: THREE.DoubleSide, roughness: 1, color: 0xb8b0a0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.receiveShadow = true; this.group.add(m);
  }
  makeQueueSign(r) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
    sp.scale.set(7.5, 2.8, 1); sp.position.set(r.entrance.x, r.yOff + 8.5, r.entrance.z); this.group.add(sp);
    r.qs = { cv, tex, sp, last: -9 }; r.queueCount = 0; this.drawQueueSign(r);
  }
  waitMinutes(r) { const spec = r.spec, cap = spec.cars * (spec.rows || 1) * spec.across, cyc = r.track.L / 12 + 25; return Math.round((r.queueCount / cap) * cyc / 60 * (r.sets && r.sets.length > 1 ? 0.6 : 1)) + (r.queueCount > 0 ? 2 : 0); }
  drawQueueSign(r) {
    const g = r.qs.cv.getContext('2d'), w = this.waitMinutes(r); g.clearRect(0, 0, 256, 96);
    g.fillStyle = 'rgba(10,14,24,.82)'; g.beginPath(); g.roundRect(2, 2, 252, 92, 14); g.fill(); g.strokeStyle = r.coaster.trackColor; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 22px "Segoe UI", sans-serif'; g.fillText(r.coaster.name.slice(0, 20), 128, 32);
    g.fillStyle = w > 20 ? '#ff8a6a' : w > 8 ? '#ffd060' : '#7aff9a'; g.font = '800 30px "Segoe UI", sans-serif'; g.fillText(w + ' Min. Wartezeit', 128, 64); g.fillStyle = '#ffffff'; g.font = '700 15px "Segoe UI", sans-serif'; g.fillText('E = Einsteigen (kostenlos)', 128, 86); r.qs.tex.needsUpdate = true;
  }
  routeTo(px, pz, target) {
    let a = 0, ad = 1e9; for (let i = 0; i < this.nodes.length; i++) { const d = Math.hypot(this.nodes[i].x - px, this.nodes[i].z - pz); if (d < ad) { ad = d; a = i; } }
    const b = target.node !== undefined ? target.node : (target.ride ? target.ride.entranceNode : a);
    const path = this.bfs(a, b); return path.map(i => [this.nodes[i].x, this.nodes[i].z]);
  }
  bfs(from, to) {
    this._bc = this._bc || new Map(); const key = from * 4096 + to; if (this._bc.has(key)) return this._bc.get(key);
    const prev = new Int32Array(this.nodes.length).fill(-1); prev[from] = from; const q = [from];
    for (let h = 0; h < q.length; h++) { const n = q[h]; if (n === to) break; for (const m of this.nodes[n].adj) if (prev[m] < 0) { prev[m] = n; q.push(m); } }
    const path = []; if (prev[to] >= 0) for (let n = to; ; n = prev[n]) { path.push(n); if (n === from) break; }
    path.reverse(); if (this._bc.size > 3000) this._bc.clear(); this._bc.set(key, path); return path;
  }
  setRoute(pts) {
    this.clearRoute(); if (!pts || pts.length < 2) return;
    const v = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 5)); for (let k = 0; k < n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; v.push(x, Math.max(0, this.h(x, z)) + 0.9, z); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    this.routeLine = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd040, size: 9, sizeAttenuation: false, transparent: true, opacity: 0.95, depthTest: false })); this.routeLine.renderOrder = 20; this.routeLine.frustumCulled = false; this.group.add(this.routeLine);
  }
  clearRoute() { if (this.routeLine) { this.group.remove(this.routeLine); this.routeLine.geometry.dispose(); this.routeLine = null; } }

  // ------------------------------------------------------------------ Wintertraum
  setWinter(on) {
    if (this.winter === on) return; this.winter = on;
    this.terrain.recolor(this.terrainMesh, on ? (x, z, y, sl) => { const c = this.terrainColor(x, z, y, sl), k = Math.max(0, 1 - sl * 1.4); const w = 0.8 + 0.2 * fbm(x / 18, z / 18); return [c[0] + (w - c[0]) * k * 0.9, c[1] + (w - c[1]) * k * 0.9, c[2] + (w * 1.05 - c[2]) * k * 0.9]; } : this.terrainColor);
    const tm = this.terrainMesh.material; if (on) { this._gm = this._gm || tm.map; tm.map = null; } else if (this._gm) tm.map = this._gm; tm.needsUpdate = true;
    if (this.farPlane) this.farPlane.material.color.set(on ? 0xd8e2ec : 0x3a5a2c);
    const snow = new THREE.Color(0xcfd8e0);
    for (const key of ['turf', 'slate', 'thatch']) { const m = A.mats[key]; if (m) { m.emissive = m.emissive || new THREE.Color(0); m.emissive.copy(on ? snow : new THREE.Color(0)); m.emissiveIntensity = on ? 0.55 : 0; m.needsUpdate = true; } }
    if (this.leafM) { this.leafM.emissive.copy(on ? new THREE.Color(0xb8c8d0) : new THREE.Color(0)); this.leafM.emissiveIntensity = on ? 0.5 : 0; }
    if (this.winterGroup) { this.winterGroup.visible = on; this.winterGroup.userData.glow.visible = on; }
    this.env.setWeather(on ? 'snow' : 'clear'); this.env.apply(true);
  }

  // ------------------------------------------------------------------ Besucher-KI
  buildVisitors() {
    super.buildVisitors();
    const mk = (geo, color) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), 40); m.frustumCulled = false; m.castShadow = true; this.group.add(m); return m; };
    const body = new THREE.BoxGeometry(0.46, 0.64, 0.28); body.translate(0, 1.05, 0);
    const legs = new THREE.BoxGeometry(0.32, 0.72, 0.2); legs.translate(0, 0.38, 0);
    const head = new THREE.SphereGeometry(0.15, 6, 5); head.translate(0, 1.55, 0);
    this.staffMeshes = [mk(body, 0xe8a010), mk(legs, 0x20242c), mk(head, 0xe0b090)];
    this.staff = Array.from({ length: 36 }, (_, i) => ({ a: this.rng() * this.nodes.length | 0, b: 0, t: 1, speed: 0.9 + this.rng() * 0.5, dwell: 0, x: 0, z: 0, yaw: 0, path: [], pi: 0, off: this.R(-1, 1) }));
    this.vFood = this.pois.filter(p => p.kind === 'restaurant' || p.kind === 'stand'); this.vStands = this.pois.filter(p => p.kind === 'stand'); this.vShops = this.pois.filter(p => p.kind === 'shop');
    this.vHotels = this.pois.filter(p => p.kind === 'hotel'); this.vStages = this.pois.filter(p => p.kind === 'stage'); this.vWC = this.pois.filter(p => p.kind === 'wc');
    this.lotNode = this.nodes.findIndex(n => n.x === 0 && n.z === 500); this.groups = {}; this.simT = 0; this.statT = 0;
    this.thrill = new Set(['launch', 'hyper', 'inverted', 'floorless', 'dive', 'flying', 'wing', 'sitdown']);
    // Nahe Besucher/Personal als echte Vice-City-Figuren (LOD), ferne bleiben instanziert
    const looks = visitorLooks(this.rng, 44), sl = staffLook(), size = { low: 12, medium: 34, high: 56 }[this.quality] ?? 34;
    this.charPool = new CharPool(this.group, size, 50);
    this.people = [...this.vis.map((v, i) => ({ x: 0, z: 0, y: 0, yaw: 0, walking: false, speed: 1, sit: false, kid: i % 4 === 3, talk: false, hands: false, look: looks[i % looks.length] })), ...this.staff.map(() => ({ x: 0, z: 0, y: 0, yaw: 0, walking: false, speed: 1, sit: false, kid: false, talk: false, hands: false, look: sl }))];
  }
  hideVis(i) { // instanzierte Version verstecken, solange eine echte Figur sie darstellt
    const Z = this._zeroM || (this._zeroM = new THREE.Matrix4().makeScale(0, 0, 0)), n = this.vis.length;
    const set = i < n ? this.visMeshes : this.staffMeshes, k = i < n ? i : i - n; for (const m of set) m.setMatrixAt(k, Z);
  }
  showActive(p) { const h = this.env.hour; for (const [, times] of p.shows || []) for (const t of times) { const d = (h - t + 24) % 24; if (d < 0.9) return true; } return false; }
  pickGoal(v, i) {
    const R = this.rng; const pick = a => a[Math.floor(R() * a.length)];
    const grp = this.groups[v.gid]; let tgt = null;
    if (grp && i % 3 !== 0 && this.simT - grp.t < 12) tgt = grp.target;
    if (!tgt) {
      const stage = this.vStages.find(s => s.active), r = R();
      if (v.hunger > 0.62 && this.vFood.length) tgt = { kind: 'food', poi: pick(this.vFood) };
      else if (v.thirst > 0.6 && this.vStands.length) tgt = { kind: 'food', poi: pick(this.vStands) };
      else if (v.tired > 0.88 && this.vWC.length) tgt = { kind: 'wc', poi: pick(this.vWC) };
      else if (stage && r < 0.35) tgt = { kind: 'stage', poi: stage };
      else if (r < 0.1 && this.vShops.length) tgt = { kind: 'shop', poi: pick(this.vShops) };
      else if (r < 0.13 && this.vHotels.length) tgt = { kind: 'hotel', poi: pick(this.vHotels) };
      else if (r < 0.17) tgt = { kind: 'leave' };
      else { const rs = this.rides.filter(x => (v.like === 'thrill') === this.thrill.has(x.coaster.cat) || R() < 0.25); tgt = { kind: 'ride', ride: pick(rs.length ? rs : this.rides) }; }
      if (i % 3 === 0) this.groups[v.gid] = { target: tgt, t: this.simT };
    }
    const node = tgt.kind === 'ride' ? tgt.ride.entranceNode : tgt.kind === 'leave' ? this.lotNode : tgt.poi.node;
    v.tgt = tgt; const path = this.bfs(v.a, node);
    if (path.length < 2) { v.dwell = 1; v.mode = 'dwell'; return; }
    v.path = path; v.pi = 1; v.b = path[1]; v.t = 0; v.mode = 'walk';
  }
  arrive(v) {
    const t = v.tgt || {}; v.mode = 'dwell'; v.seated = false; v.qi = 0;
    if (t.kind === 'ride') { const r = t.ride; v.qi = r.queueCount++; v.dwell = Math.min(40, 6 + v.qi * 1.3); }
    else if (t.kind === 'food') { v.dwell = 14 + this.R(0, 14); v.seated = t.poi.kind === 'restaurant'; }
    else if (t.kind === 'shop') v.dwell = 10 + this.R(0, 6); else if (t.kind === 'stage') v.dwell = 18 + this.R(0, 12);
    else if (t.kind === 'wc') v.dwell = 5; else if (t.kind === 'hotel') v.dwell = 8; else v.dwell = 3;
    if (t.poi) t.poi.visitors = (t.poi.visitors || 0) + 1;
  }
  finishDwell(v) {
    const t = v.tgt || {};
    if (t.poi && t.poi.visitors) t.poi.visitors--;
    if (t.kind === 'ride') { t.ride.queueCount = Math.max(0, t.ride.queueCount - 1); v.fun = 0; v.ridden = (v.ridden || 0) + 1; this.hist.rides = (this.hist.rides || 0) + 1; }
    else if (t.kind === 'food') { v.hunger = t.poi.kind === 'restaurant' ? 0 : v.hunger * 0.5; v.thirst = 0; this.hist.meals = (this.hist.meals || 0) + 1; }
    else if (t.kind === 'wc') v.tired *= 0.4; else if (t.kind === 'shop') this.hist.sales = (this.hist.sales || 0) + 1;
    else if (t.kind === 'leave') { v.a = this.lotNode; v.hunger = v.thirst = 0; this.hist.entered++; }
    v.seated = false;
  }
  updateVisitors(dt) {
    if (!this.visMeshes || !this.vFood) { return; }
    this.simT += dt; this.statT += dt;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const [iBody, iLegs, iHead] = this.visMeshes, N = this.nodes;
    for (const p of this.vStages) p.active = this.showActive(p);
    for (let i = 0; i < this.vis.length; i++) {
      const v = this.vis[i];
      if (v.mode === undefined) { v.mode = 'dwell'; v.dwell = this.R(0, 4); v.hunger = this.R(0, 0.5); v.thirst = this.R(0, 0.5); v.tired = this.R(0, 0.4); v.fun = this.R(0.3, 1); v.kid = i % 4 === 3; v.like = ['thrill', 'family', 'thrill', 'family', 'food'][i % 5]; v.gid = Math.floor(i / 3); v.path = []; if (i % 5 === 0 && this.lotNode >= 0) v.a = this.lotNode; v.b = v.a; v.t = 0; }
      v.hunger = Math.min(1, v.hunger + dt * 0.004); v.thirst = Math.min(1, v.thirst + dt * 0.005); v.tired = Math.min(1, v.tired + dt * 0.0025); v.fun = Math.min(1, v.fun + dt * 0.01);
      const kid = v.kid ? 0.72 : 1;
      if (v.mode === 'dwell') {
        v.dwell -= dt; if (v.dwell <= 0) { if (v.tgt) this.finishDwell(v); this.pickGoal(v, i); }
      } else {
        const A_ = N[v.a], B_ = N[v.b], L = Math.hypot(B_.x - A_.x, B_.z - A_.z) || 1;
        v.t += v.speed * kid * dt / L; v.ph += dt * 7 * v.speed;
        if (v.t >= 1) { v.a = v.b; v.t = 0; if (v.pi + 1 < v.path.length) { v.b = v.path[++v.pi]; } else this.arrive(v); }
      }
      const A2 = N[v.a], B2 = N[v.b], L2 = Math.hypot(B2.x - A2.x, B2.z - A2.z) || 1; let dx = (B2.x - A2.x) / L2, dz = (B2.z - A2.z) / L2;
      if (v.mode === 'dwell') {
        let ox = 0, oz = 0;
        if (v.tgt && v.tgt.kind === 'ride') { const r = v.tgt.ride; const row = Math.floor(v.qi / 3), col = (v.qi % 3) - 1; ox = -r.dir[0] * (row * 1.1) + (-r.dir[1]) * col * 1.0; oz = -r.dir[1] * (row * 1.1) + r.dir[0] * col * 1.0; dx = r.dir[0]; dz = r.dir[1]; }
        else { ox = Math.sin(i * 12.9) * 2.2; oz = Math.cos(i * 7.7) * 2.2; if (v.tgt && v.tgt.poi) { dx = v.tgt.poi.x - A2.x; dz = v.tgt.poi.z - A2.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; } }
        v.x = A2.x + ox; v.z = A2.z + oz;
      } else { v.x = A2.x + dx * L2 * v.t - dz * v.off; v.z = A2.z + dz * L2 * v.t + dx * v.off; }
      v.yaw = Math.atan2(dx, dz);
      const bob = v.mode === 'walk' ? Math.abs(Math.sin(v.ph)) * 0.06 : 0;
      q.setFromAxisAngle(up, v.yaw); pv.set(v.x, Math.max(0.05, this.h(v.x, v.z)) + 0.07 + bob, v.z); sc.set(kid, kid * (v.seated ? 0.78 : 1), kid);
      m.compose(pv, q, sc); iBody.setMatrixAt(i, m); iLegs.setMatrixAt(i, m); iHead.setMatrixAt(i, m);
      const P = this.people[i]; P.x = v.x; P.z = v.z; P.y = pv.y - bob; P.yaw = v.yaw; P.walking = v.mode === 'walk'; P.speed = v.speed * kid; P.sit = !!v.seated; P.talk = v.mode === 'dwell' && i % 3 === 0; P.hands = !!(v.mode === 'dwell' && v.tgt && v.tgt.kind === 'stage' && v.tgt.poi && v.tgt.poi.active);
    }
    for (const mm of this.visMeshes) mm.instanceMatrix.needsUpdate = true;
    // Personal: pendelt zwischen Bereichen, "arbeitet" an Punkten
    const [sb, sl, sh] = this.staffMeshes;
    for (let i = 0; i < this.staff.length; i++) {
      const s = this.staff[i];
      if (s.dwell > 0) { s.dwell -= dt; if (s.dwell <= 0) { const tn = this.pois[Math.floor(this.rng() * this.pois.length)]; s.path = this.bfs(s.a, tn.node); s.pi = 1; if (s.path.length > 1) { s.b = s.path[1]; s.t = 0; } else s.dwell = 4; } }
      else { const A_ = N[s.a], B_ = N[s.b], L = Math.hypot(B_.x - A_.x, B_.z - A_.z) || 1; s.t += s.speed * dt / L; if (s.t >= 1) { s.a = s.b; s.t = 0; if (s.pi + 1 < s.path.length) s.b = s.path[++s.pi]; else s.dwell = 8 + this.R(0, 12); } }
      const A2 = N[s.a], B2 = N[s.b], L2 = Math.hypot(B2.x - A2.x, B2.z - A2.z) || 1, dx = (B2.x - A2.x) / L2, dz = (B2.z - A2.z) / L2;
      s.x = A2.x + dx * L2 * s.t - dz * s.off; s.z = A2.z + dz * L2 * s.t + dx * s.off; s.yaw = Math.atan2(dx, dz);
      q.setFromAxisAngle(up, s.yaw); pv.set(s.x, Math.max(0.05, this.h(s.x, s.z)) + 0.07, s.z); sc.set(1, 1, 1); m.compose(pv, q, sc); sb.setMatrixAt(i, m); sl.setMatrixAt(i, m); sh.setMatrixAt(i, m);
      const P = this.people[this.vis.length + i]; P.x = s.x; P.z = s.z; P.y = pv.y; P.yaw = s.yaw; P.walking = s.dwell <= 0; P.speed = s.speed; P.talk = s.dwell > 0;
    }
    if (this.charPool && this.camPos) this.charPool.update(dt, this.camPos, this.people, i => this.hideVis(i));
    for (const mm of this.visMeshes) mm.instanceMatrix.needsUpdate = true;
    for (const mm of this.staffMeshes) mm.instanceMatrix.needsUpdate = true;
    if (this.statT > 2) {
      this.statT = 0; let inPark = 0; for (const v of this.vis) if (!(v.a === this.lotNode && v.mode === 'dwell')) inPark++; this.hist.inPark = inPark;
      for (const r of this.rides) if (r.qs) this.drawQueueSign(r);
    }
    // Showbühnen: Scheinwerfer
    for (const p of this.vStages) if (p.spots) p.spots.forEach((sp, k) => { sp.material.opacity = p.active ? (0.35 + 0.35 * Math.sin(this.time * 4 + k)) * Math.min(1, (this.env.night || 0) * 1.5 + 0.2) : 0; sp.material.color.setHSL((this.time * 0.2 + k / 6) % 1, 0.9, 0.6); });
  }

}
