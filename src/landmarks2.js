// Erweiterte Welt: Alpen & Skidorf, Terra Mundi (Weltreise-Insel), Savanne/Safari, Alcatraz
import * as THREE from 'three';
import { RNG, hash2, clamp, lerp, smoothstep, fbm } from './util.js';
import { terrainH } from './world.js';
import { ISLANDS, SKI_VILLAGE, SAVANNA, inSavanna } from './consts.js';
import { Infra } from './infra.js';

const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export class Landmarks2 {
  constructor(lm) { this.lm = lm; this.c = lm.c; this.W = lm.W; this.rng = new RNG(4711); }
  all() { this.alps(); this.terraMundi(); this.savanna(); this.alcatraz(); new Infra(this.lm).all(); }
  poi(id, kind, name, x, z, r = 3.4, extra = {}) { this.W.pois.push({ id, kind, name, x, z, r, ...extra }); }
  pyramid(mb, x, y0, z, s, h, col) {
    const A = [x - s / 2, y0, z - s / 2], B = [x + s / 2, y0, z - s / 2], C = [x + s / 2, y0, z + s / 2], D = [x - s / 2, y0, z + s / 2], P = [x, y0 + h, z], ref = [x, y0 + h * 0.3, z];
    for (const [a, b] of [[A, B], [B, C], [C, D], [D, A]]) mb.triO(a, b, P, col, ref);
  }
  // ------------------ Alpen ------------------
  alps() {
    const W = this.W, c = this.c, rng = this.rng, V = SKI_VILLAGE, gy = V.h;
    const sets = W.sets[W.chunkIdx(V.x, V.z)], pm = (x, z) => W.mb(x, z, 'plain'), wd = (x, z) => W.mb(x, z, 'wood');
    // Dorfplatz (Schnee/Pflaster)
    W.mb(V.x, V.z, 'plaza').ground(V.x - 60, V.z - 40, V.x + 60, V.z + 40, gy + 0.1, [0.95, 0.97, 1], 8);
    // Chalets
    const chalet = (x, z, w, d, hh, rot = 0) => {
      wd(x, z).box(x, gy + 0.1, z, w, hh, d, { col: 0xb98a5a, uvs: 3 });
      W.mb(x, z, 'tiles').gable(x, gy + 0.1 + hh, z, w, d, 3.2, w > d ? 'x' : 'z', 0x5a3a2a, 4, 0.6);
      pm(x, z).box(x, gy + 0.1, z + d / 2 + 0.05, 1.2, 2.1, 0.12, { col: 0x3e2723, uvs: 1 });
      W.mb(x, z, 'lamp').box(x + w / 3, gy + hh * 0.5, z + d / 2 + 0.06, 1.3, 1.0, 0.1, { col: [1, 0.85, 0.5], uvs: 1 });
      W.addBox(x, z, w + 1, d + 1, hh + 3);
      pm(x, z).box(x, gy + 0.1 + hh + 3.2, z, 0.1, 0.1, 0.1, { col: 0xffffff, uvs: 1 });
    };
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, r = 55 + rng.range(0, 40); const x = V.x + Math.cos(a) * r * 1.3, z = V.z + Math.sin(a) * r; if (Math.hypot(x - V.x, z - V.z) < 38) continue; chalet(x, z, rng.range(9, 14), rng.range(8, 11), rng.range(4.5, 6.5)); }
    // Hotel / Lodge
    const hx = V.x - 85, hz = V.z + 10;
    sets.get('facade_house').box(hx, gy + 0.1, hz, 40, 14, 22, { col: 0xf2e8d8, fac: { cw: 3.5, ch: 3.4, ou: 2, ov: 1 }, top: false });
    W.mb(hx, hz, 'tiles').gable(hx, gy + 14.1, hz, 40, 22, 6, 'x', 0x6d3a2a, 5, 0.8); W.addBox(hx, hz, 41, 23, 20);
    c.addSign('ALPENHOTEL', hx, gy + 11, hz + 11.2, 0, 14, 2.6, '#ffd54f');
    // Kirche
    const kx = V.x + 90, kz = V.z - 15;
    pm(kx, kz).box(kx, gy + 0.1, kz, 10, 9, 18, { col: 0xf3efe8, uvs: 3 }); W.mb(kx, kz, 'tiles').gable(kx, gy + 9.1, kz, 10, 18, 4, 'z', 0x7a3b2e, 4, 0.5);
    pm(kx, kz).box(kx, gy + 0.1, kz - 9, 5, 22, 5, { col: 0xf3efe8, uvs: 3 }); W.mb(kx, kz, 'tiles').cyl(kx, gy + 22.1, kz - 9, 3.4, 8, 4, 0x7a3b2e, { r2: 0.1 }); W.addBox(kx, kz, 11, 19, 12);
    // Bergbahn-Talstation + Skiverleih
    const lx = V.x + 10, lz = V.z - 60;
    pm(lx, lz).box(lx, gy + 0.1, lz, 18, 7, 10, { col: 0xd32f2f, uvs: 3 }); W.mb(lx, lz, 'metal').gable(lx, gy + 7.1, lz, 18, 10, 2.5, 'x', 0x8a8f95, 5, 0.5); W.addBox(lx, lz, 19, 11, 9);
    c.addSign('BERGBAHN', lx, gy + 5, lz + 5.2, 0, 8, 1.6, '#ffffff');
    this.poi('lift', 'lift', 'Bergbahn (Gipfelstation)', lx, lz + 7.5, 3.4);
    const rx = V.x - 30, rz = V.z - 62;
    wd(rx, rz).box(rx, gy + 0.1, rz, 12, 5, 8, { col: 0x4a90d9, uvs: 3 }); W.addBox(rx, rz, 13, 9, 6); c.addSign('SKIVERLEIH', rx, gy + 4, rz + 4.2, 0, 6, 1.4, '#40c4ff');
    this.poi('skirent', 'skirent', 'Skiverleih & Wintersport', rx, rz + 6, 3.4);
    // Schneebedeckte Nadelbäume im Dorf
    for (let k = 0; k < 90; k++) { const a = rng.range(0, 6.28), r = rng.range(70, 260); const x = V.x + Math.cos(a) * r * 1.4, z = V.z + Math.sin(a) * r; const h = terrainH(x, z); if (h < 20 || h > 160) continue; if (Math.hypot(x - V.x, z - V.z) < 70) continue; this.fir(x, z, h, rng.range(1, 1.8), true); }
    // Seilbahn-Masten und Gondeln zum Gipfel
    const top = this.summit(); this.topPos = top;
    const n = 9; const pts = []; const base = [lx, gy + 9, lz - 6];
    for (let k = 0; k <= n; k++) { const t = k / n; const x = lerp(base[0], top.x, t), z = lerp(base[2], top.z, t); const y = terrainH(x, z) + 14 + (k === 0 || k === n ? 0 : 6); pts.push([x, y, z]); if (k > 0 && k < n) { pm(x, z).cyl(x, terrainH(x, z), z, 0.6, y - terrainH(x, z) + 1, 6, 0x6d737a); } }
    // Gipfelstation
    pm(top.x, top.z).box(top.x, top.y, top.z, 14, 6, 10, { col: 0xd32f2f, uvs: 3 }); W.addBox(top.x, top.z, 15, 11, 8); W.pois.push({ id: 'summit', kind: 'landmark', name: 'Gipfelstation (Skigebiet)', x: top.x, z: top.z, r: 0 });
    this.poi('liftdown', 'lift', 'Bergbahn (Talfahrt)', top.x + 9, top.z, 3.4, { down: true });
    for (let g = 0; g < 4; g++) { const grp = new THREE.Group(); const cab = new THREE.Mesh(BOX(2.4, 2.2, 2.2), new THREE.MeshStandardMaterial({ color: [0xd32f2f, 0xffd54f, 0x2196f3, 0x4caf50][g], roughness: 0.5 })); cab.position.y = -2.2; cab.castShadow = true; const arm = new THREE.Mesh(BOX(0.1, 2.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x333333 })); arm.position.y = -1.1; grp.add(cab, arm); W.addExtra(V.x, V.z, grp); W.animated.push({ type: 'gondola', obj: grp, pts, t: g / 4, speed: 0.012, dir: 1 }); }
    // Seil
    const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: 0x222222 })); W.addExtra(V.x, V.z, rope);
    W.pois.push({ id: 'alps', kind: 'landmark', name: 'Alpen & Skidorf', x: V.x, z: V.z, r: 0 });
    W.skiStart = { x: top.x, z: top.z + 25 };
  }
  summit() { let best = { h: -1 }; for (let x = -1900; x < -1300; x += 20) for (let z = -2700; z < -2250; z += 20) { const h = terrainH(x, z); if (h > best.h) best = { h, x, z }; } return { x: best.x, z: best.z, y: best.h }; }
  fir(x, z, h, s, snow) {
    const W = this.W, mb = W.mb(x, z, 'leaf');
    mb.cyl(x, h, z, 0.25, 3, 5, 0x5b4030);
    for (let k = 0; k < 4; k++) { const r = 2.7 * s - k * 0.55; mb.cyl(x, h + 2 + k * 2.4, z, r, 3.2, 7, snow ? (k % 2 ? 0xeef4f2 : 0x3a6a4a) : [0x2f5d3a, 0x2a5234, 0x356b42][k % 3], { r2: 0.1, cap: false }); }
    if (!this.skipCol) W.addCircle(x, z, 0.4, 8, 'tree');
  }
  // ------------------ Terra Mundi ------------------
  terraMundi() {
    const W = this.W, c = this.c, rng = this.rng, I = ISLANDS.find((q) => q.id === 'terra'), gy = I.h;
    const pm = (x, z) => W.mb(x, z, 'plain'), stone = 0xd8cdb8;
    // Wege / Plätze je Kontinent
    for (const [x, z, w, d] of [[2380, 520, 150, 120], [2690, 520, 150, 120], [2500, 840, 190, 120], [2200, 750, 120, 140], [2680, 820, 120, 90]]) W.mb(x, z, 'plaza').ground(x - w / 2, z - d / 2, x + w / 2, z + d / 2, gy + 0.1, [1, 1, 1], 8);
    // Eiffelturm (Europa)
    const ex = 2360, ez = 500; const e = pm(ex, ez), col = 0x6b5a48;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { e.cyl(ex + dx * 14, gy, ez + dz * 14, 3.5, 36, 4, col, { r2: 1.6 }); }
    e.box(ex, gy + 34, ez, 34, 1.6, 34, { col, uvs: 3 }); e.cyl(ex, gy + 35.5, ez, 15, 52, 4, col, { r2: 4 }); e.box(ex, gy + 86, ez, 12, 1.4, 12, { col, uvs: 3 }); e.cyl(ex, gy + 87.4, ez, 3.6, 44, 4, col, { r2: 0.35 }); W.mb(ex, ez, 'lamp').box(ex, gy + 132, ez, 1, 1, 1, { col: [1, 0.9, 0.5], uvs: 1 });
    for (let k = 1; k < 5; k++) e.box(ex, gy + k * 7, ez, 30 - k * 4, 0.6, 30 - k * 4, { col, uvs: 3 });
    W.addBox(ex, ez, 36, 36, 40); W.addCircle(ex, ez, 10, 130); c.addSign('EUROPA · PARIS', ex, gy + 8, ez + 19, 0, 12, 2.2, '#40c4ff');
    W.pois.push({ id: 'eiffel', kind: 'landmark', name: 'Eiffelturm (Europa)', x: ex, z: ez, r: 0 });
    // Kolosseum
    const kx = 2450, kz = 470, R = 36, n = 36;
    for (let t = 0; t < 3; t++) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = kx + Math.cos(a) * R, z = kz + Math.sin(a) * R; pm(x, z).box(x, gy + t * 7, z, 6.4, 7, 2.6, { rot: -a + Math.PI / 2, col: 0xcdb892, uvs: 3 }); if (i % 2 === 0) pm(x, z).box(x + Math.cos(a) * 1.4, gy + t * 7 + 0.5, z + Math.sin(a) * 1.4, 2.2, 4.8, 0.4, { rot: -a + Math.PI / 2, col: 0x4a3f33, uvs: 1 }); }
    W.addCircle(kx, kz, R + 3, 21); W.pois.push({ id: 'colosseum', kind: 'landmark', name: 'Kolosseum (Rom)', x: kx, z: kz, r: 0 });
    // Big Ben
    const bx = 2300, bz = 565; pm(bx, bz).box(bx, gy, bz, 9, 52, 9, { col: 0xc9b98f, uvs: 3 }); pm(bx, bz).cyl(bx, gy + 52, bz, 6.4, 14, 4, 0x4a5a48, { r2: 0.3 });
    for (const [dx, dz, ry] of [[0, 4.6, 0], [0, -4.6, Math.PI], [4.6, 0, Math.PI / 2], [-4.6, 0, -Math.PI / 2]]) W.mb(bx, bz, 'lamp').box(bx + dx, gy + 44, bz + dz, dz ? 6 : 0.2, 6, dz ? 0.2 : 6, { col: [1, 0.95, 0.75], uvs: 1 });
    W.addBox(bx, bz, 10, 10, 66); W.pois.push({ id: 'bigben', kind: 'landmark', name: 'Uhrturm (London)', x: bx, z: bz, r: 0 });
    // Holländische Windmühle
    const wx = 2330, wz = 610; pm(wx, wz).cyl(wx, gy, wz, 5, 14, 8, 0xf2ead6, { r2: 3 }); pm(wx, wz).cyl(wx, gy + 14, wz, 4, 3, 8, 0x8a4a2e, { r2: 0.2 });
    const mill = new THREE.Group(); const bm = new THREE.MeshStandardMaterial({ color: 0xeeeeee }); for (let b = 0; b < 4; b++) { const bl = new THREE.Mesh(BOX(1.6, 16, 0.3), bm); bl.position.y = 8; const pv = new THREE.Group(); pv.rotation.z = b * Math.PI / 2; pv.add(bl); mill.add(pv); } mill.position.set(wx, gy + 12, wz + 4.5); W.addExtra(wx, wz, mill); W.animated.push({ type: 'spinz', obj: mill, speed: 0.6 }); W.addCircle(wx, wz, 5.2, 16);
    // Pagode (Asien)
    const px = 2700, pz = 520; for (let k = 0; k < 5; k++) { const w = 16 - k * 2.4; pm(px, pz).box(px, gy + k * 6, pz, w, 4.2, w, { col: 0xb53a2a, uvs: 3 }); W.mb(px, pz, 'tiles').gable(px, gy + k * 6 + 4.2, pz, w + 3, w + 3, 1.8, 'x', 0x3a2a2a, 4, 0.5); }
    pm(px, pz).cyl(px, gy + 30, pz, 0.3, 8, 5, 0xd4af37); W.addBox(px, pz, 17, 17, 32); c.addSign('ASIEN · JAPAN', px, gy + 6, pz + 10, 0, 12, 2.2, '#ff5252');
    W.pois.push({ id: 'pagode', kind: 'landmark', name: 'Pagode (Asien)', x: px, z: pz, r: 0 });
    // Taj Mahal
    const tx = 2620, tz = 465; pm(tx, tz).box(tx, gy, tz, 46, 7, 46, { col: 0xf4efe4, uvs: 3 }); pm(tx, tz).box(tx, gy + 7, tz, 26, 14, 26, { col: 0xf8f4ea, uvs: 3 }); W.mb(tx, tz, 'plain').blob(tx, gy + 25, tz, 11, 12, 11, 0xf8f4ea, 14, 10); pm(tx, tz).cyl(tx, gy + 36, tz, 0.3, 5, 5, 0xd4af37);
    for (const [dx, dz] of [[-21, -21], [21, -21], [-21, 21], [21, 21]]) { pm(tx, tz).cyl(tx + dx, gy + 0, tz + dz, 2, 26, 8, 0xf4efe4); W.mb(tx, tz, 'plain').blob(tx + dx, gy + 27, tz + dz, 2.4, 2.2, 2.4, 0xf8f4ea, 8, 6); }
    W.mb(tx, tz, 'pool').ground(tx - 6, tz + 28, tx + 6, tz + 70, gy + 0.2, [1, 1, 1], 6); W.addBox(tx, tz, 48, 48, 30); W.pois.push({ id: 'taj', kind: 'landmark', name: 'Taj Mahal (Indien)', x: tx, z: tz, r: 0 });
    // Fuji
    const fx = 2830, fz = 640; pm(fx, fz).cyl(fx, gy - 1, fz, 120, 118, 18, 0x5a6a85, { r2: 14, cap: false }); pm(fx, fz).cyl(fx, gy + 70, fz, 47, 47, 18, 0xf5f8ff, { r2: 14 }); W.addCircle(fx, fz, 92, 70); W.pois.push({ id: 'fuji', kind: 'landmark', name: 'Fuji (Japan)', x: fx, z: fz, r: 0 });
    // Torii
    const to = (x, z) => { for (const dx of [-5, 5]) pm(x, z).box(x + dx, gy, z, 1.2, 9, 1.2, { col: 0xd32f2f, uvs: 1 }); pm(x, z).box(x, gy + 8, z, 14, 1.3, 1.6, { col: 0xd32f2f, uvs: 1 }); pm(x, z).box(x, gy + 6, z, 11, 0.6, 1.2, { col: 0xd32f2f, uvs: 1 }); }; to(2735, 580); to(2735, 600);
    // Pyramiden + Sphinx (Afrika)
    const pyr = [[2480, 880, 96, 66], [2580, 900, 70, 48], [2400, 910, 52, 36]]; for (const [x, z, s, h] of pyr) { this.pyramid(pm(x, z), x, gy, z, s, h, 0xd9b873); W.addBox(x, z, s * 0.75, s * 0.75, h * 0.7); }
    const sx = 2500, sz = 800; pm(sx, sz).box(sx, gy, sz, 10, 8, 28, { col: 0xd2ad66, uvs: 3 }); W.mb(sx, sz, 'plain').blob(sx, gy + 11, sz + 12, 4.2, 4.6, 4.2, 0xd2ad66, 10, 8); pm(sx, sz).box(sx, gy + 8, sz + 12, 9, 2, 9, { col: 0xd2ad66, uvs: 3 }); W.addBox(sx, sz, 11, 30, 10);
    c.addSign('AFRIKA · ÄGYPTEN', 2480, gy + 8, 820, 0, 14, 2.4, '#ffd54f'); W.pois.push({ id: 'pyramiden', kind: 'landmark', name: 'Pyramiden & Sphinx (Afrika)', x: 2490, z: 860, r: 0 });
    for (let k = 0; k < 22; k++) { const x = 2420 + rng.range(-90, 160), z = 960 + rng.range(-20, 50); if (Math.hypot(x - 2500, z - 960) > 140) continue; this.acacia(x, z, gy); }
    // Freiheitsstatue (Amerika)
    const lx = 2160, lz = 700; pm(lx, lz).box(lx, gy, lz, 16, 14, 16, { col: 0xb8b2a6, uvs: 3 }); pm(lx, lz).cyl(lx, gy + 14, lz, 3.6, 22, 10, 0x6fb59b, { r2: 2.2 }); W.mb(lx, lz, 'plain').blob(lx, gy + 38, lz, 2.4, 3, 2.4, 0x6fb59b, 10, 8);
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; pm(lx, lz).cyl(lx + Math.cos(a) * 1.8, gy + 40, lz + Math.sin(a) * 1.8, 0.3, 2.6, 4, 0x6fb59b, { r2: 0.05 }); }
    pm(lx, lz).box(lx + 3.4, gy + 28, lz, 1.4, 14, 1.4, { col: 0x6fb59b, uvs: 1 }); W.mb(lx, lz, 'lamp').box(lx + 3.4, gy + 43, lz, 1.4, 2.2, 1.4, { col: [1, 0.85, 0.3], uvs: 1 }); W.addBox(lx, lz, 18, 18, 36); c.addSign('AMERIKA · USA', lx + 12, gy + 6, lz + 5, Math.PI / 2, 12, 2.2, '#40c4ff');
    W.pois.push({ id: 'liberty', kind: 'landmark', name: 'Freiheitsstatue (Amerika)', x: lx, z: lz, r: 0 });
    // Mount Rushmore
    const rx = 2230, rz = 800; pm(rx, rz).box(rx, gy, rz, 70, 46, 26, { col: 0x8f8a82, uvs: 4 }); for (let k = 0; k < 4; k++) W.mb(rx, rz, 'plain').blob(rx - 24 + k * 16, gy + 36, rz + 14, 5.6, 7, 4, 0xb8aea0, 10, 8); W.addBox(rx, rz, 72, 28, 46); W.pois.push({ id: 'rushmore', kind: 'landmark', name: 'Mount Rushmore (Amerika)', x: rx, z: rz, r: 0 });
    // Opernhaus Sydney (Australien)
    const ox = 2680, oz = 820; pm(ox, oz).box(ox, gy, oz, 64, 4, 34, { col: 0xd8d2c4, uvs: 4 }); for (let k = 0; k < 5; k++) { const s = 1 - k * 0.12; W.mb(ox, oz, 'plain').blob(ox - 22 + k * 11, gy + 4, oz + (k % 2) * 3, 7.5 * s, 16 * s, 11 * s, 0xf8f6f0, 14, 10); } W.addBox(ox, oz, 66, 36, 22); c.addSign('AUSTRALIEN · SYDNEY', ox, gy + 9, oz + 18, 0, 16, 2.4, '#ffee58');
    W.pois.push({ id: 'opera', kind: 'landmark', name: 'Opernhaus (Australien)', x: ox, z: oz, r: 0 });
    // Chinesische Mauer
    for (let k = 0; k < 14; k++) { const x = 2700 + k * 10, z = 400 - Math.sin(k * 0.5) * 8; pm(x, z).box(x, gy + 3 + k * 0.6, z, 10.6, 5, 3.4, { col: 0x9a8f7a, uvs: 3 }); W.addBox(x, z, 10.6, 3.4, 8 + k * 0.6); }
    // Flughafen & Hotel
    W.mb(2400, 720, 'runway').strip(2280, 725, 2480, 725, 24, gy + 0.12, gy + 0.12, [1, 1, 1], [0, 0, 12, 0, 12, 1.5, 0, 1.5]); for (let s = 2290; s < 2470; s += 24) W.mb(s, 725, 'marking').strip(s, 725, s + 12, 725, 1, gy + 0.14, gy + 0.14, [1, 1, 1]);
    this.poi('terra_air', 'travel', 'Terra Mundi – Flughafen & Rückflug', 2300, 700, 3.4, { returnTrip: true });
    // Palmen
    for (let k = 0; k < 70; k++) { const a = rng.range(0, 6.28), r = rng.range(60, 440), x = 2520 + Math.cos(a) * r, z = 650 + Math.sin(a) * r; const h = terrainH(x, z); if (h < 2) continue; if (W.pushCircle(x, z, 3, h + 1).hit) continue; if (rng.chance(0.6)) c.palm(x, z, rng, rng.range(6, 10)); else c.tree(x, z, rng, 1); }
    W.pois.push({ id: 'terra', kind: 'landmark', name: 'Terra Mundi – Weltreise-Insel', x: 2520, z: 650, r: 0 });
  }
  acacia(x, z, h0 = null) {
    const W = this.W, mb = W.mb(x, z, 'leaf'), h = h0 ?? terrainH(x, z); const s = this.rng.range(0.9, 1.5);
    mb.cyl(x, h, z, 0.3 * s, 5 * s, 5, 0x6b4a30, { r2: 0.2 * s, cap: false });
    mb.blob(x, h + 5.6 * s, z, 4.8 * s, 1.1 * s, 4.8 * s, 0x6a8a3a, 8, 4, 0.2, x + z);
    W.addCircle(x, z, 0.4, 7, 'tree');
  }
  baobab(x, z) {
    const W = this.W, mb = W.mb(x, z, 'leaf'), h = terrainH(x, z), s = this.rng.range(1, 1.5);
    mb.cyl(x, h, z, 2.2 * s, 9 * s, 8, 0x7a6248, { r2: 1.6 * s, cap: false });
    mb.blob(x, h + 10 * s, z, 5.5 * s, 3 * s, 5.5 * s, 0x5a8a3a, 8, 5, 0.4, x * 3 + z);
    W.addCircle(x, z, 2.3 * s, 12, 'tree');
  }
  // ------------------ Savanne ------------------
  savanna() {
    const W = this.W, c = this.c, rng = this.rng;
    for (let k = 0; k < 520; k++) { const x = rng.range(SAVANNA.x0 + 60, SAVANNA.x1 - 60), z = rng.range(SAVANNA.z0 + 40, SAVANNA.z1 - 100); const h = terrainH(x, z); if (h < 0.5) continue; if (rng.chance(0.12)) this.baobab(x, z); else this.acacia(x, z); }
    // Lodge
    const lx = -1450, lz = 2300, gy = terrainH(lx, lz);
    const sets = W.sets[W.chunkIdx(lx, lz)];
    sets.get('wood').box(lx, gy, lz, 34, 5, 14, { col: 0xc29a6a, uvs: 3 }); W.mb(lx, lz, 'tiles').gable(lx, gy + 5, lz, 34, 14, 5, 'x', 0xb8a050, 4, 1.2); W.addBox(lx, lz, 35, 15, 9);
    for (let k = 0; k < 6; k++) { const x = lx - 40 + k * 16, z = lz + 28; W.mb(x, z, 'wood').cyl(x, terrainH(x, z), z, 4, 3.2, 10, 0xc29a6a); W.mb(x, z, 'plain').cyl(x, terrainH(x, z) + 3.2, z, 5.2, 3.2, 10, 0xb8a050, { r2: 0.2 }); W.addCircle(x, z, 4.2, 6); }
    c.addSign('SAFARI LODGE', lx, gy + 4, lz + 7.2, 0, 12, 2.4, '#ffd54f');
    this.poi('safari', 'safari', 'Safari-Lodge (Tour & Jeeps)', lx, lz + 12, 3.6);
    W.pois.push({ id: 'savanna', kind: 'landmark', name: 'Savanne (Afrika-Safari)', x: -1500, z: 2500, r: 0 });
    // Wasserloch
    const wx = -1750, wz = 2550; W.mb(wx, wz, 'pool').cyl(wx, terrainH(wx, wz) + 0.1, wz, 24, 0.1, 18, 0x3a8fb8);
    W.safariSpots = [{ x: -1400, z: 2500 }, { x: -1750, z: 2550 }, { x: -1000, z: 2700 }, { x: -2100, z: 2300 }, { x: -700, z: 2400 }];
  }
  // ------------------ Alcatraz ------------------
  alcatraz() {
    const W = this.W, c = this.c, I = ISLANDS.find((q) => q.id === 'alcatraz'), gy = I.h, ix = I.x, iz = I.z;
    const pm = (x, z) => W.mb(x, z, 'plain'), conc = 0x9a9a94;
    W.mb(ix, iz, 'concrete').ground(ix - 60, iz - 48, ix + 60, iz + 48, gy + 0.1, [0.8, 0.8, 0.8], 8);
    const wall = (x, z, w, d) => { pm(x, z).box(x, gy, z, w, 9, d, { col: conc, uvs: 4 }); W.addBox(x, z, w, d, 9); };
    wall(ix, iz - 30, 70, 2); wall(ix, iz + 30, 70, 2); wall(ix - 35, iz, 2, 62); wall(ix + 35, iz, 2, 62);
    // Zellenblock
    W.sets[W.chunkIdx(ix, iz)].get('facade_warehouse').box(ix, gy, iz - 12, 50, 14, 14, { col: 0xc9c3b6, fac: { cw: 4, ch: 3.5, ou: 3, ov: 1 }, top: false });
    pm(ix, iz).box(ix, gy + 14, iz - 12, 51, 0.8, 15, { col: 0x6d6a64, uvs: 4 }); W.addBox(ix, iz - 12, 51, 15, 15);
    // Wachtürme
    for (const [dx, dz] of [[-35, -30], [35, -30], [-35, 30], [35, 30]]) { pm(ix, iz).cyl(ix + dx, gy, iz + dz, 2.4, 20, 8, conc, { r2: 2 }); W.mb(ix, iz, 'facade_glass').box(ix + dx, gy + 20, iz + dz, 5, 3.4, 5, { col: 0xdfe8ee, fac: { cw: 2, ch: 2, ou: 0, ov: 0 }, top: false }); pm(ix, iz).cyl(ix + dx, gy + 23.4, iz + dz, 3.6, 0.8, 8, 0x444444, { r2: 0.2 }); W.mb(ix, iz, 'lamp').box(ix + dx, gy + 21, iz + dz + 2.6, 1.4, 0.8, 0.4, { col: [1, 0.95, 0.7], uvs: 1 }); W.addCircle(ix + dx, iz + dz, 2.6, 24); }
    // Hofausstattung: Basketballkorb & Hantelbank
    pm(ix, iz).cyl(ix + 18, gy, iz + 14, 0.15, 3.2, 6, 0x555555); pm(ix, iz).box(ix + 18, gy + 3, iz + 14.5, 1.8, 1.2, 0.1, { col: 0xffffff, uvs: 1 });
    pm(ix, iz).box(ix - 18, gy, iz + 12, 4, 0.6, 1.2, { col: 0x333333, uvs: 1 }); pm(ix, iz).box(ix - 18, gy + 1.2, iz + 12, 4.4, 0.2, 0.2, { col: 0x999999, uvs: 1 });
    c.addSign('ALCATRAZ', ix, gy + 11, iz + 18, 0, 14, 3, '#ff5252');
    W.pois.push({ id: 'alcatraz', kind: 'landmark', name: 'Alcatraz – Gefängnisinsel', x: ix, z: iz, r: 0 });
    W.prisonYard = { x: ix, z: iz + 10, y: gy, cx: ix, cz: iz };
    this.poi('workout', 'workout', 'Hantelbank (Training)', ix - 18, iz + 12, 3, { prison: true });
  }
}
