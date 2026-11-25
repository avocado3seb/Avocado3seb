// Landmarken: Flughafen, Hafen, Strand & Pier, Stadion, Golf, Park, Privatinseln, Umland
import * as THREE from 'three';
import { RNG, hash2, clamp, lerp, smoothstep, fbm } from './util.js';
import { colorOf } from './builder.js';
import { terrainH, SpatialHash } from './world.js';
import { HALF, SEA, PITCH, RECTS, ISLANDS, coastX, inSavanna } from './consts.js';
import { Landmarks2 } from './landmarks2.js';

const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export class Landmarks {
  constructor(city) { this.c = city; this.W = city.W; this.rng = new RNG(777); }

  all() {
    this.airport();
    this.harbor();
    this.beach();
    this.stadium();
    this.golfAndPark();
    this.islands();
    this.viceSign();
    new Landmarks2(this).all();
  }

  // ---------- Flughafen ----------
  airport() {
    const W = this.W, c = this.c, R = RECTS.airport, rng = this.rng;
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    const gm = W.mb(cx, cz, 'concrete');
    // Rollfeld / Vorfeld
    for (let x = R.x0 + 8; x < R.x1 - 8; x += 150) {
      const x1 = Math.min(x + 150, R.x1 - 8);
      const mid = (x + x1) / 2;
      W.mb(mid, 800, 'concrete').ground(x, R.z0 + 8, x1, R.z1 - 8, 0.07, [0.62, 0.64, 0.62], 12);
    }
    // Landebahn
    for (let x = -1350; x < -550; x += 150) {
      const x1 = Math.min(x + 150, -550);
      const mid = (x + x1) / 2;
      W.mb(mid, 850, 'runway').strip(x, 850, x1, 850, 44, 0.09, 0.09, [1, 1, 1], [0, 0, (x1 - x) / 16, 0, (x1 - x) / 16, 44 / 16, 0, 44 / 16]);
      const mk = W.mb(mid, 850, 'marking');
      for (let s = x + 10; s < x1 - 20; s += 35) mk.strip(s, 850, s + 18, 850, 1.2, 0.11, 0.11, [1, 1, 1]);
    }
    const mk = W.mb(-1300, 850, 'marking');
    for (const sx of [-1340, -560]) for (let k = -6; k <= 6; k++) { if (!k) continue; mk.strip(sx, 850 + k * 3, sx + (sx < -900 ? 1 : -1) * 20, 850 + k * 3, 1.3, 0.11, 0.11, [1, 1, 1]); }
    // Rollweg
    W.mb(-950, 760, 'runway').strip(-1250, 760, -650, 760, 22, 0.09, 0.09, [1, 1, 1]);
    for (const x of [-1200, -900, -650]) W.mb(x, 805, 'runway').strip(x, 740, x, 830, 22, 0.09, 0.09, [1, 1, 1]);
    // Terminal
    const tx = -900, tz = 650;
    const sets = W.sets[W.chunkIdx(tx, tz)];
    sets.get('facade_glass').box(tx, 0.17, tz, 220, 14, 34, { col: 0xd8ecf6, fac: { cw: 4, ch: 4.6, ou: 0, ov: 0 }, top: false });
    sets.get('plain').box(tx, 14.17, tz, 224, 1.2, 38, { col: 0xeceff1, uvs: 6 });
    sets.get('plain').box(tx, 15.4, tz, 100, 6, 16, { col: 0xcfd8dc, uvs: 6 });
    W.addBox(tx, tz, 220, 34, 16);
    c.addSign('VICE INTERNATIONAL', tx, 19, tz + 17.5, 0, 40, 4, '#4fc3f7');
    // Kontrollturm
    const kx = -1010, kz = 700;
    sets.get('plain').cyl(kx, 0.17, kz, 4, 38, 14, 0xe9edf0, { r2: 3 });
    sets.get('facade_glass').box(kx, 38, kz, 11, 5, 11, { col: 0xb8d8e8, fac: { cw: 2.5, ch: 2.5, ou: 0, ov: 0 }, top: false });
    sets.get('plain').box(kx, 43, kz, 13, 0.8, 13, { col: 0xeceff1, uvs: 4 });
    sets.get('plain').cyl(kx, 43.8, kz, 0.15, 10, 5, 0x888888);
    W.addCircle(kx, kz, 4.2, 44, 'tower');
    // Hangars
    for (let k = 0; k < 4; k++) {
      const hx = -1330 + k * 62, hz = 640;
      sets.get('metal').box(hx, 0.17, hz, 50, 14, 36, { col: 0xdfe5ea, top: false, uvs: 8 });
      sets.get('metal').gable(hx, 14.17, hz, 50, 36, 6, 'x', 0xc3ccd3, 8, 0.4);
      sets.get('plain').box(hx, 0.17, hz + 18.1, 32, 11, 0.4, { col: 0x4a5560, uvs: 2 });
      W.addBox(hx, hz, 50, 36, 20);
    }
    // Zaun um den Flughafen (Poller + Lampen entlang der Bahn)
    for (let x = -1350; x < -550; x += 40) { c.lamp(x, 872, 0); c.lamp(x, 828, Math.PI); }
    // Parkplatz & Zufahrtsschilder
    W.mb(-900, 610, 'asphalt').strip(-1000, 612, -800, 612, 16, 0.05, 0.05, [1, 1, 1]);
    // Park-/Display-Spots für Flugzeuge
    W.airSpots = [
      { x: -1180, z: 700, yaw: Math.PI, cls: 'plane' }, { x: -1100, z: 700, yaw: Math.PI, cls: 'plane' }, { x: -1020, z: 740, yaw: Math.PI / 2, cls: 'jet' },
      { x: -820, z: 720, yaw: Math.PI, cls: 'plane' }, { x: -760, z: 720, yaw: Math.PI, cls: 'heli' }, { x: -700, z: 720, yaw: Math.PI, cls: 'heli' },
      { x: -1150, z: 880, yaw: Math.PI / 2, cls: 'jet' }, { x: -1280, z: 780, yaw: 0.4, cls: 'plane' },
    ];
    W.pois.push({ id: 'airshop', kind: 'aircraft', name: 'Vice Air Charter (Flugzeuge & Helikopter)', x: -900, z: 668, r: 3.4 });
    W.pois.push({ id: 'airport', kind: 'landmark', name: 'Vice International Airport', x: -900, z: 650, r: 0 });
  }

  // ---------- Hafen ----------
  harbor() {
    const W = this.W, c = this.c, rng = this.rng, R = RECTS.bay;
    const wm = (x, z) => W.mb(x, z, 'wood'), cm = (x, z) => W.mb(x, z, 'concrete');
    // Kai entlang der Nordkante
    cm(850, 905).ground(R.x0, 893, R.x1 - 200, 910, 0.2, [0.8, 0.82, 0.84], 10);
    W.addBox(850, 893, 500, 0.5, 0.3);
    // Stege
    W.docks = [];
    for (const x of [680, 780, 880, 980]) {
      for (let z = 908; z < 1010; z += 25) wm(x, z).ground(x - 4, z, x + 4, z + 25, 0.5, [1, 1, 1], 4);
      for (let z = 912; z < 1010; z += 12) { const pm = W.mb(x, z, 'plain'); pm.cyl(x - 4.2, -2, z, 0.25, 3, 6, 0x4a3a2a); pm.cyl(x + 4.2, -2, z, 0.25, 3, 6, 0x4a3a2a); }
      W.docks.push({ x, z0: 908, z1: 1010 });
    }
    // Containerkräne (Portal)
    for (const x of [640, 740]) this.gantryCrane(x, 900);
    // Frachtschiff
    this.freighter(1010, 1090, rng);
    // Leuchtturm
    const lx = 1220, lz = 880;
    W.mb(lx, lz, 'plain').cyl(lx, 0.1, lz, 4, 26, 12, 0xf5f5f5, { r2: 2.6 });
    W.mb(lx, lz, 'plain').cyl(lx, 12, lz, 4.1, 3, 12, 0xd32f2f, { r2: 3.3 });
    W.mb(lx, lz, 'lamp').box(lx, 26, lz, 2.2, 2.4, 2.2, { col: [1, 0.95, 0.6], uvs: 1 });
    W.mb(lx, lz, 'plain').cyl(lx, 28.4, lz, 2.4, 1.2, 10, 0x37474f, { r2: 0.2 });
    W.addCircle(lx, lz, 4, 30, 'lighthouse');
    W.mb(lx, lz, 'concrete').ground(lx - 14, lz - 14, lx + 14, lz + 14, 0.15, [0.7, 0.7, 0.7], 8);
    W.boatSpots = [];
    for (let k = 0; k < 6; k++) W.boatSpots.push({ x: 680 + (k % 2) * 200 + (k >= 4 ? 100 : 0) + (k % 2 ? -8 : 8), z: 940 + (k % 3) * 28, yaw: 0, tag: 'dock' });
    W.pois.push({ id: 'boatshop', kind: 'boats', name: 'Marina Boote & Yachten', x: 740, z: 890, r: 3.4 });
    W.pois.push({ id: 'harbor', kind: 'landmark', name: 'Vice Harbor', x: 800, z: 920, r: 0 });
  }
  gantryCrane(x, z) {
    const W = this.W, pm = W.mb(x, z, 'plain');
    for (const [dx, dz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) pm.box(x + dx, 0.2, z + dz, 1, 36, 1, { col: 0xd32f2f, uvs: 3 });
    pm.box(x, 36, z, 14, 2, 10, { col: 0xd32f2f, uvs: 3 });
    pm.box(x, 36.5, z + 30, 5, 2.2, 66, { col: 0xe53935, uvs: 3 });
    pm.box(x, 30, z + 8, 2, 8, 2, { col: 0x455a64, uvs: 2 });
    W.addBox(x, z, 14, 10, 36);
    // seitliche Stützen als Hindernis
  }
  freighter(x, z, rng) {
    const W = this.W, pm = W.mb(x, z, 'plain'), sh = W.mb(x, z, 'shiny');
    const L = 150, Wd = 26;
    pm.box(x, -4, z, Wd, 10, L, { col: 0x1d3557, uvs: 6 });
    pm.box(x, 5.9, z, Wd - 1, 0.5, L - 2, { col: 0x6b705c, uvs: 6 });
    pm.gable(x, 6, z - L / 2 - 4, 2, 2, 0.1, 'x', 0x1d3557); // dummy
    pm.box(x, 6.4, z + L / 2 - 20, 22, 20, 14, { col: 0xf5f5f5, uvs: 6 });
    pm.box(x, 26.4, z + L / 2 - 20, 24, 3, 15, { col: 0x37474f, uvs: 6 });
    pm.cyl(x, 29, z + L / 2 - 14, 2, 6, 8, 0xc62828);
    const cols = [0xc0392b, 0x2e86c1, 0x27ae60, 0xe67e22, 0xecf0f1, 0xf1c40f, 0x7f8c8d];
    for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) { if (rng.chance(0.15)) continue; const lv = rng.int(1, 3); for (let k = 0; k < lv; k++) pm.box(x - 8 + (q % 4) * 4.4 + (q >= 4 ? 8 : 0) * 0, 6.5 + k * 2.6, z - L / 2 + 8 + r * 13, 4.1, 2.6, 12.2, { col: rng.pick(cols), uvs: 3 }); }
    W.addBox(x, z, Wd, L, 8);
    W.addBox(x, z + L / 2 - 20, 22, 14, 28);
  }

  // ---------- Strand & Pier ----------
  beach() {
    const W = this.W, c = this.c, rng = this.rng;
    // Promenade entlang x=1100 existiert als Straße. Strandausstattung:
    for (let z = -900; z < 800; z += 38) {
      const x = 1128 + rng.range(0, 90), zz = z + rng.range(-10, 10);
      if (terrainH(x, zz) < 0) continue;
      const col = rng.pick([0xe53935, 0x1e88e5, 0xfdd835, 0xff7043, 0x8e24aa, 0x00acc1]);
      const mb = W.mb(x, zz, 'plain');
      mb.cyl(x, 0.2, zz, 0.05, 2.4, 5, 0xeeeeee, { cap: false });
      mb.cyl(x, 2.2, zz, 1.9, 0.5, 10, col, { r2: 0.05 });
      mb.box(x + 1.4, 0.3, zz, 0.9, 0.12, 2, { col: 0xffffff, uvs: 1 });
      if (rng.chance(0.5)) this.c.palm(x - 4, zz + 4, rng, 7);
    }
    // Rettungstürme
    for (let z = -700; z < 700; z += 260) {
      const x = 1165, hz = z;
      const pm = W.mb(x, hz, 'plain');
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pm.cyl(x + dx * 1.2, 0.2, hz + dz * 1.2, 0.12, 2.4, 5, 0xffffff);
      pm.box(x, 2.6, hz, 3.4, 2.2, 3.4, { col: 0xff5252, uvs: 2 });
      pm.box(x, 4.8, hz, 4, 0.3, 4, { col: 0xffffff, uvs: 2 });
      W.addBox(x, hz, 3.6, 3.6, 5);
    }
    // Volleyballnetze
    for (let z = -600; z < 600; z += 330) { const x = 1150, pm = W.mb(x, z, 'plain'); pm.box(x, 0.2, z - 4.5, 0.12, 2.4, 0.12, { col: 0xdddddd, uvs: 1 }); pm.box(x, 0.2, z + 4.5, 0.12, 2.4, 0.12, { col: 0xdddddd, uvs: 1 }); pm.box(x, 1.8, z, 0.05, 0.8, 9, { col: 0xf5f5f5, uvs: 1 }); }
    // Pier mit Riesenrad (z=100)
    const pz = 100;
    for (let x = 1135; x < 1360; x += 20) {
      W.mb(x, pz, 'wood').ground(x, pz - 5, x + 20, pz + 5, 1.1, [1, 1, 1], 4);
      const pm = W.mb(x, pz, 'plain');
      for (const s of [-4.6, 4.6]) { pm.cyl(x + 2, -4, pz + s, 0.3, 5.3, 6, 0x4a3a2a); pm.cyl(x + 12, -4, pz + s, 0.3, 5.3, 6, 0x4a3a2a); pm.box(x + 10, 1.1, pz + s, 20, 1, 0.12, { col: 0x8d6e63, uvs: 2 }); }
    }
    W.pierEnd = { x: 1360, z: pz };
    // Pier-Gebäude: Arcade
    const ax = 1180, sets = W.sets[W.chunkIdx(ax, pz)];
    sets.get('facade_shop').box(ax, 1.1, pz - 12.5, 16, 6, 8, { col: 0xffffff, fac: { cw: 4, ch: 3, ou: 1, ov: 1 }, top: false });
    sets.get('plain').box(ax, 7.1, pz - 12.5, 17, 0.5, 9, { col: 0xff2bd6, uvs: 3 });
    W.mb(ax, pz, 'neon').box(ax, 7.8, pz - 8, 14, 0.4, 0.3, { col: [0, 0.9, 1], uvs: 1 });
    c.addSign('ARCADE', ax, 9.2, pz - 8, 0, 9, 2.4, '#00e5ff');
    W.addBox(ax, pz - 12.5, 16, 8, 7);
    W.pois.push({ id: 'arcade', kind: 'arcade', name: 'Pier-Arcade (Minispiele)', x: ax, z: pz - 6.2, r: 3.4 });
    // Riesenrad (animiert)
    const wheel = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5, metalness: 0.5 });
    const R = 18;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 6, 40), steel); wheel.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.2, 6, 30), steel); wheel.add(ring2);
    const cabCols = [0xff5252, 0x40c4ff, 0xffd740, 0x69f0ae, 0xe040fb, 0xff9100];
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      const spoke = new THREE.Mesh(BOX(R * 2, 0.15, 0.15), steel); spoke.rotation.z = a; if (k < 8) wheel.add(spoke);
      const cab = new THREE.Mesh(BOX(2.2, 2, 2.4), new THREE.MeshStandardMaterial({ color: cabCols[k % 6], roughness: 0.4 }));
      cab.position.set(Math.cos(a) * R, Math.sin(a) * R - 1.2, 0); cab.userData.cab = true; wheel.add(cab);
      const lamp = new THREE.Mesh(BOX(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: cabCols[(k + 2) % 6], toneMapped: false }));
      lamp.position.set(Math.cos(a) * R, Math.sin(a) * R + 0.4, 0); wheel.add(lamp);
    }
    wheel.position.set(1345, R + 6, pz); wheel.traverse((o) => { o.castShadow = true; });
    const legs = new THREE.Mesh(BOX(1, R + 6, 1), steel);
    for (const dz of [-3, 3]) { const l = legs.clone(); l.position.set(1345, (R + 6) / 2 + 1, pz + dz); l.rotation.z = 0; W.addExtra(1345, pz, l); }
    W.addExtra(1345, pz, wheel); W.animated.push({ obj: wheel, type: 'wheel', speed: 0.12 });
    W.addCircle(1345, pz, 3, 40, 'wheel');
    W.pois.push({ id: 'pier', kind: 'landmark', name: 'Vice Pier', x: 1300, z: pz, r: 0 });
  }

  // ---------- Stadion ----------
  stadium() {
    const W = this.W, R = RECTS.stadium, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    const pm = W.mb(cx, cz, 'plain');
    W.mb(cx, cz, 'pitch').ground(cx - 50, cz - 32, cx + 50, cz + 32, 0.2, [1, 1, 1], 20);
    W.mb(cx, cz, 'plaza').ground(R.x0 + 4, R.z0 + 4, R.x1 - 4, R.z1 - 4, 0.16, [0.7, 0.7, 0.72], 10);
    W.mb(cx, cz, 'plaza').ground(R.x0 + 4, R.z0 + 4, R.x1 - 4, R.z1 - 4, 0.15, [0.7, 0.7, 0.72], 10);
    const wm = W.mb(cx, cz, 'marking');
    for (const [x0, z0, x1, z1] of [[cx - 50, cz - 32, cx + 50, cz - 32], [cx - 50, cz + 32, cx + 50, cz + 32], [cx - 50, cz - 32, cx - 50, cz + 32], [cx + 50, cz - 32, cx + 50, cz + 32], [cx, cz - 32, cx, cz + 32]]) wm.strip(x0, z0, x1, z1, 0.3, 0.22, 0.22, [1, 1, 1]);
    // Tribünen (gestufte Ringe)
    for (let tier = 0; tier < 6; tier++) {
      const gx = 62 + tier * 5, gz = 42 + tier * 4.4, y = 0.2 + tier * 2.3;
      const col = [0xb23a48, 0xc9485b, 0x3d5a80, 0x4a6fa5, 0xe0e0e0, 0xcfcfcf][tier];
      pm.box(cx, y, cz - gz, gx * 2, 2.3, 4.4, { col, uvs: 3 }); pm.box(cx, y, cz + gz, gx * 2, 2.3, 4.4, { col, uvs: 3 });
      pm.box(cx - gx, y, cz, 5, 2.3, gz * 2, { col, uvs: 3 }); pm.box(cx + gx, y, cz, 5, 2.3, gz * 2, { col, uvs: 3 });
    }
    pm.box(cx, 14, cz - 70, 170, 0.6, 14, { col: 0xeeeeee, uvs: 4 });
    for (const [x, z] of [[cx - 85, cz - 62], [cx + 85, cz - 62], [cx - 85, cz + 62], [cx + 85, cz + 62]]) { pm.cyl(x, 0, z, 0.5, 40, 8, 0xdddddd); W.mb(x, z, 'lamp').box(x, 40, z, 5, 2, 1.5, { col: [1, 1, 0.9], uvs: 1 }); }
    W.addBox(cx, cz - 70, 180, 8, 12); W.addBox(cx, cz + 70, 180, 8, 12); W.addBox(cx - 90, cz, 8, 140, 12); W.addBox(cx + 90, cz, 8, 140, 12);
    W.pois.push({ id: 'stadium', kind: 'landmark', name: 'Vice Stadion', x: cx, z: cz, r: 0 });
  }

  // ---------- Golf & Park ----------
  golfAndPark() {
    const W = this.W, c = this.c, rng = this.rng;
    let R = RECTS.park;
    W.mb(-350, 50, 'grass').ground(R.x0 + 3, R.z0 + 3, R.x1 - 3, R.z1 - 3, 0.12, [0.9, 1, 0.85], 10);
    c.parkContent(R.x0 + 8, R.z0 + 8, R.x1 - 8, R.z1 - 8, rng, 70);
    R = RECTS.golf;
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    W.mb(cx, cz, 'grass').ground(R.x0 + 2, R.z0 + 2, R.x1 - 2, R.z1 - 2, 0.12, [0.7, 1, 0.55], 10);
    W.mb(cx, cz, 'sand').ground(cx - 40, cz - 30, cx - 14, cz - 12, 0.14, [1, 1, 1], 6);
    W.mb(cx, cz, 'sand').ground(cx + 20, cz + 20, cx + 50, cz + 40, 0.14, [1, 1, 1], 6);
    W.mb(cx, cz, 'pool').cyl(cx + 30, 0.14, cz - 40, 22, 0.05, 20, 0x2a8fb8);
    W.mb(cx, cz, 'grass').cyl(cx - 90, 0.14, cz, 9, 0.04, 14, 0x8fe36a);
    W.mb(cx, cz, 'plain').cyl(cx - 90, 0.14, cz, 0.04, 2.2, 4, 0xffffff); W.mb(cx, cz, 'plain').box(cx - 89.6, 2, cz, 0.8, 0.5, 0.05, { col: 0xff3d00, uvs: 1 });
    for (let k = 0; k < 50; k++) { const x = rng.range(R.x0 + 8, R.x1 - 8), z = rng.range(R.z0 + 8, R.z1 - 8); if (rng.chance(0.4)) c.palm(x, z, rng); else c.tree(x, z, rng, 1.2); }
    // Clubhaus
    c.bldg(R.x0 + 30, R.z1 - 26, 30, 18, 8, { rng, facade: 'facade_house', tint: 0xf6f0e4, ground: false });
    W.pois.push({ id: 'golf', kind: 'landmark', name: 'Palm Golfclub', x: cx, z: cz, r: 0 });
    W.pois.push({ id: 'park', kind: 'landmark', name: 'Central Park', x: -350, z: 50, r: 0 });
  }

  // ---------- Privatinseln ----------
  islands() {
    const W = this.W, c = this.c, rng = this.rng;
    for (const I of ISLANDS) {
      if (I.skip) continue;
      // Palmen & Büsche
      for (let k = 0; k < 90; k++) {
        const a = rng.range(0, 6.283), r = Math.sqrt(rng.next()) * I.r * 0.8;
        const x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r;
        if (terrainH(x, z) < 1.2) continue;
        if (rng.chance(0.55)) c.palm(x, z, rng, rng.range(7, 12)); else c.tree(x, z, rng, 1);
      }
      // Anleger
      const dockA = Math.atan2(0, -1);
      const dx0 = I.x - I.r * 0.55, dz0 = I.z;
      for (let k = 0; k < 7; k++) { const x = dx0 - k * 12; W.mb(x, dz0, 'wood').ground(x - 12, dz0 - 3, x, dz0 + 3, 0.6, [1, 1, 1], 4); }
      W.pois.push({ id: 'island_' + I.id, kind: 'landmark', name: I.name, x: I.x, z: I.z, r: 0 });
    }
    // Isla Esmeralda: Villa, Pool, Helipad, Landebahn
    const E = ISLANDS[0], ex = E.x, ez = E.z, sets = W.sets[W.chunkIdx(ex, ez)];
    const gy = terrainH(ex, ez);
    this.islandVilla(ex - 20, ez + 10, gy);
    // kurze Landebahn
    W.mb(ex, ez, 'runway').strip(ex - 110, ez + 90, ex + 120, ez + 70, 18, gy + 0.12, gy + 0.12, [1, 1, 1], [0, 0, 14, 0, 14, 1.2, 0, 1.2]);
    // Palmera: Resortbar
    const P = ISLANDS[1], py = terrainH(P.x, P.z);
    this.islandVilla(P.x, P.z, py, true);
    const A = ISLANDS[2], ay = terrainH(A.x, A.z);
    this.islandVilla(A.x - 10, A.z, ay);
    const S = ISLANDS[3]; this.islandVilla(S.x, S.z, terrainH(S.x, S.z), true);
  }
  islandVilla(x, z, gy, resort = false) {
    const W = this.W, rng = this.rng, sets = W.sets[W.chunkIdx(x, z)];
    sets.get('plaza').ground(x - 40, z - 28, x + 40, z + 28, gy + 0.1, [1, 1, 1], 8);
    sets.get('facade_deco').box(x, gy + 0.1, z, 36, 4.4, 17, { col: 0xffffff, fac: { cw: 4, ch: 4.4, ou: 2, ov: 2 }, top: false });
    sets.get('facade_glass').box(x + 3, gy + 4.5, z, 22, 3.6, 14, { col: 0xffffff, fac: { cw: 3, ch: 3.6, ou: 0, ov: 0 }, top: false });
    sets.get('plain').box(x, gy + 4.5, z, 39, 0.3, 20, { col: 0xf6f2e8, uvs: 4 });
    sets.get('plain').box(x + 3, gy + 8.1, z, 25, 0.35, 17, { col: 0xf6f2e8, uvs: 4 });
    sets.get('pool').ground(x - 14, z - 22, x + 14, z - 12, gy + 0.18, [1, 1, 1], 6);
    W.addBox(x, z, 38, 18, gy + 9);
    for (let k = 0; k < 6; k++) this.c.palm(x - 30 + k * 12, z + 24, rng, 9);
    if (resort) { for (let k = 0; k < 5; k++) { const bx = x - 30 + k * 15, bz = z + 38; sets.get('plain').cyl(bx, gy, bz, 2, 0.1, 8, 0xb0894a); sets.get('plain').cyl(bx, gy + 0.1, bz, 0.06, 2.4, 5, 0xeeeeee); sets.get('plain').cyl(bx, gy + 2.4, bz, 2.2, 0.5, 8, 0xff7043, { r2: 0.05 }); } }
    this.c.roofCap(sets, x + 3, z, 12, 8, gy + 8.4, rng, { pad: true });
  }

  // ---------- Schriftzug in den Bergen ----------
  viceSign() {
    const W = this.W;
    const font = {
      V: ['X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '.X.X.', '..X..'],
      I: ['XXX', '.X.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
      C: ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
      E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
      T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
      Y: ['X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..', '..X..'],
      ' ': ['..', '..', '..', '..', '..', '..', '..'],
    };
    const text = 'VICE CITY';
    const px = 4.2, gap = 1.5;
    let total = 0; for (const ch of text) total += font[ch][0].length * px + gap * px;
    let x = 300 - total / 2; const z = -1620;
    for (const ch of text) {
      const g = font[ch];
      for (let r = 0; r < 7; r++) for (let q = 0; q < g[r].length; q++) {
        if (g[r][q] !== 'X') continue;
        const gx = x + q * px, h = terrainH(gx, z);
        W.mb(gx, z, 'plain').box(gx + px / 2, h + 3 + (6 - r) * px, z, px * 0.95, px * 0.95, 1.5, { col: 0xf4f4f0, uvs: 4 });
        W.mb(gx, z, 'plain').box(gx + px / 2, h, z, 0.5, 3 + (6 - r) * px, 0.5, { col: 0x888888, uvs: 4 });
      }
      x += (g[0].length + gap) * px;
    }
  }

  // ---------- Umland ----------
  countryside() {
    const W = this.W, c = this.c, rng = new RNG(9001);
    // Wald (Regenwald im Westen/Süden, Nadelwald im Norden), Sümpfe (Südwest), Felder
    const isNearRoad = (x, z) => {
      for (const l of W.lines) {
        if (l.kind !== 'highway' && !l.city) continue;
        const along = l.horiz ? x : z, across = l.horiz ? z : x;
        if (Math.abs(across - l.c) < 14 && along > l.a - 14 && along < l.b + 14) return true;
      }
      return false;
    };
    const FLATR = { x0: -1470, x1: 1170, z0: -1070, z1: 1270 };
    for (let cz = -3100; cz < 3100; cz += 38) for (let cx = -3100; cx < 3100; cx += 38) {
      const x = cx + rng.range(0, 30), z = cz + rng.range(0, 30);
      if (x > FLATR.x0 && x < FLATR.x1 && z > FLATR.z0 && z < FLATR.z1) continue;
      const h = terrainH(x, z);
      if (h < 1.2 || h > (z < -1800 ? 130 : 78)) continue;
      if (inSavanna(x, z)) continue;
      if (Math.hypot(x - 2520, z - 650) < 480) continue;
      const f = fbm(x / 160 + 7, z / 160 + 3, 3, 21);
      if (f < 0.46 && rng.next() < 0.82) continue;
      if (isNearRoad(x, z)) continue;
      const swamp = x < -1500 && z > 400 && x > -2200;
      const rain = (x < -1480 && z > -300) || z > 1300;
      const conifer = z < -1300 || h > 60;
      const mb = W.mb(x, z, 'leaf');
      const s = rng.range(0.9, 1.7);
      if (conifer) {
        mb.cyl(x, h, z, 0.25, 3, 5, 0x5b4030);
        for (let k = 0; k < 3; k++) mb.cyl(x, h + 2 + k * 2.6, z, 2.6 * s - k * 0.55, 3.4, 7, [0x2f5d3a, 0x2a5234, 0x356b42][k], { r2: 0.1, cap: false });
      } else {
        const lc = rain ? [0x2f7d32, 0x3a8d3a, 0x246b2c][rng.int(0, 2)] : [0x4a8a30, 0x5a9a38, 0x6aa040][rng.int(0, 2)];
        mb.cyl(x, h - 0.2, z, 0.3 * s, 5 * s, 6, 0x5b4030, { r2: 0.18 * s, cap: false });
        mb.blob(x, h + 5.8 * s, z, 3.2 * s, 2.6 * s, 3.2 * s, lc, 6, 4, 0.4, x * 3 + z);
        if (rain) mb.blob(x + 1.5, h + 7.4 * s, z - 1, 2.4 * s, 2 * s, 2.4 * s, lc, 6, 4, 0.4, x + z);
      }
      if (rng.chance(0.5)) W.addCircle(x, z, 0.4, 8, 'tree');
    }
    // Sumpfpflanzen (Schilf, Wasserlinsen)
    for (let k = 0; k < 260; k++) {
      const x = -1950 + rng.range(0, 350), z = 650 + rng.range(0, 800);
      const h = terrainH(x, z); if (h < -1 || h > 3) continue;
      const mb = W.mb(x, z, 'leaf');
      for (let q = 0; q < 4; q++) mb.cyl(x + rng.range(-1, 1), h, z + rng.range(-1, 1), 0.04, rng.range(1.2, 2.2), 4, 0x8a9a3a, { r2: 0.01, cap: false });
    }
    // Windräder
    for (let k = 0; k < 8; k++) {
      const x = -1850 + (k % 4) * 90 + rng.range(-10, 10), z = -1450 - Math.floor(k / 4) * 120, h = terrainH(x, z);
      if (h < 1) continue;
      W.mb(x, z, 'plain').cyl(x, h, z, 1.6, 55, 10, 0xf2f4f5, { r2: 0.9 });
      const rot = new THREE.Group();
      const bm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      for (let b = 0; b < 3; b++) { const blade = new THREE.Mesh(BOX(1.4, 30, 0.3), bm); blade.position.y = 15; const piv = new THREE.Group(); piv.rotation.z = b * 2.094; piv.add(blade); rot.add(piv); }
      const hub = new THREE.Mesh(BOX(2.4, 2.4, 3.6), bm); rot.add(hub);
      rot.position.set(x, h + 55, z + 2.4); rot.traverse((o) => { o.castShadow = true; });
      W.addExtra(x, z, rot); W.animated.push({ obj: rot, type: 'spinz', speed: 0.9 + rng.next() * 0.4 });
      W.addCircle(x, z, 1.7, 56, 'turbine');
    }
    // Bauernhöfe
    const farms = [[-1700, -200], [-1650, 300], [-600, -1550], [300, 1700], [-300, 1650], [900, -1450]];
    for (const [fx, fz] of farms) {
      const h = terrainH(fx, fz); if (h < 1) continue;
      const sets = W.sets[W.chunkIdx(fx, fz)];
      sets.get('plain').box(fx, h, fz, 14, 7, 20, { col: 0xa33a2a, uvs: 4 });
      sets.get('plain').gable(fx, h + 7, fz, 14, 20, 4.5, 'z', 0x6d4c41, 4, 0.4);
      sets.get('plain').box(fx + 18, h, fz + 4, 8, 4, 10, { col: 0xefe6d2, uvs: 3 });
      sets.get('tiles').gable(fx + 18, h + 4, fz + 4, 8, 10, 2.6, 'z', 0xb5523a, 4, 0.4);
      sets.get('plain').cyl(fx - 14, h, fz + 4, 3, 14, 10, 0xb0b8bf, { r2: 3 });
      sets.get('plain').cyl(fx - 14, h + 14, fz + 4, 3, 2.4, 10, 0x8a949c, { r2: 0.1 });
      W.addBox(fx, fz, 14, 20, 12); W.addBox(fx + 18, fz + 4, 8, 10, 6); W.addCircle(fx - 14, fz + 4, 3, 16);
      // Felder
      for (let q = 0; q < 4; q++) sets.get('dirt').ground(fx - 70 + q * 36, fz + 40, fx - 38 + q * 36, fz + 100, h + 0.1, [0.9 + q * 0.05, 1, 0.7], 8);
    }
    // Funkturm im Gebirge, Hütte am See
    const rx = 420, rz = -1780, rh = terrainH(rx, rz);
    W.mb(rx, rz, 'plain').cyl(rx, rh, rz, 2, 60, 4, 0xc62828, { r2: 0.4 });
    W.mb(rx, rz, 'lamp').box(rx, rh + 60, rz, 0.8, 0.8, 0.8, { col: [1, 0, 0], uvs: 1 });
    W.addCircle(rx, rz, 2, 60);
    const cabinX = -1560, cabinZ = -700, ch = terrainH(cabinX, cabinZ);
    if (ch > 0) { const s = W.sets[W.chunkIdx(cabinX, cabinZ)]; s.get('wood').box(cabinX, ch, cabinZ, 8, 3.2, 6, { col: 0xd2a679, uvs: 3 }); s.get('tiles').gable(cabinX, ch + 3.2, cabinZ, 8, 6, 2, 'x', 0x6d4c41, 3, 0.4); W.addBox(cabinX, cabinZ, 8, 6, 5); }
    W.pois.push({ id: 'cabin', kind: 'landmark', name: 'Seehütte', x: cabinX, z: cabinZ, r: 0 });
    W.pois.push({ id: 'mountain', kind: 'landmark', name: 'Vice-Berge', x: 400, z: -1800, r: 0 });
    W.pois.push({ id: 'swamp', kind: 'landmark', name: 'Sumpfland', x: -1800, z: 1000, r: 0 });
    W.pois.push({ id: 'rainforest', kind: 'landmark', name: 'Regenwald', x: -1700, z: 100, r: 0 });
  }
}
