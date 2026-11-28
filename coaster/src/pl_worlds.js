// ============================================================================
//  pl_worlds.js – Dekoration der Themenwelten jenseits der Häuser (stilisiert, nach der Beschreibung des Nutzers):
//  Kaiserplatz (Berlin), Rookburgh (Gassen, Rohre, Zahnräder, Flugmaschinen), Klugheim (Basaltsäulen), Mexico (Marktstände, Fähnchenketten),
//  Mystery (Wehrmauer, Runensteine, Wasserspeier, Kapuzenfiguren), Deep in Africa (Marktstände).
// ============================================================================
import * as THREE from 'three';
import * as A from './pl_assets.js';
import * as H from './pl_houses.js';
import * as T from './pl_tex.js';
import { Batch, hex } from './batch.js';
import { signTexture } from './textures.js';

const TAU = Math.PI * 2;
const std = (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...e });
const mesh = (geo, mat, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; };
const Q = w => ({ low: 0.45, medium: 0.8, high: 1.25 }[w.quality] || 0.8);

// Punkt nahe an einem Weg? (Kantenabstand < Halbbreite + m)
export function onPath(world, x, z, m = 2) {
  for (const [a, b, w] of world.edges) {
    const A_ = world.nodes[a], B_ = world.nodes[b], dx = B_.x - A_.x, dz = B_.z - A_.z, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - A_.x) * dx + (z - A_.z) * dz) / L2));
    if (Math.hypot(x - (A_.x + dx * t), z - (A_.z + dz * t)) < w / 2 + m) return true;
  }
  return false;
}
// freie Plätze (ohne Gleis-Fußabdrücke) um einen Punkt suchen; fn(x, y, z, rot) → false = ablehnen
export function around(world, cx, cz, rMax, n, clear, fn, rMin = 0, tries = 40, low = false) { // low: auch Senken bis -3 m zulassen, fn bekommt dann die echte Bodenhöhe (für Pflanzen)
  let made = 0;
  for (let t = 0; t < n * tries && made < n; t++) {
    const a = world.R(0, TAU), r = rMin + Math.sqrt(world.rng()) * (rMax - rMin), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (!world.siteOk(x, z, clear)) continue; const y = world.h(x, z); if (y < (low ? -3 : -0.4)) continue;
    if (fn(x, low ? y : Math.max(0.05, y), z, Math.atan2(cx - x, cz - z)) !== false) { world.grid.mark(x, z, clear); made++; }
  }
  return made;
}
const bench = () => { const b = new Batch(), wd = hex('#7a5232'), ir = hex('#2a2a30'); b.box(0, 0.5, 0, 1.7, 0.1, 0.5, wd); b.box(0, 0.88, -0.22, 1.7, 0.42, 0.07, wd); for (const sx of [-0.75, 0.75]) b.box(sx, 0.25, 0, 0.08, 0.5, 0.5, ir); return b.build(); };

// ---------------------------------------------------------------- Berlin: Kaiserplatz (Laternen, Bänke, Beete, Café-Schirme, Platzschild)
export function kaiserplatz(world) {
  const out = world.out, G = world.group, env = world.env, cx = 0, cz = 60;
  const lamp = new Batch(), ir = hex('#25262b'); lamp.tube([0, 0, 0], [0, 0.55, 0], 0.24, ir, 8); lamp.tube([0, 0.55, 0], [0, 3.9, 0], 0.075, ir, 8); lamp.tube([0, 3.5, 0], [0, 3.62, 0], 0.15, ir, 8); lamp.tube([0, 3.9, 0], [0, 4.0, 0], 0.18, ir, 8); lamp.tube([0, 4.7, 0], [0, 4.85, 0], 0.2, ir, 8);
  const lm = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffd890, emissiveIntensity: 0, roughness: 0.3 }); env.registerLamp(lm);
  const poles = new A.Inst(lamp.build(), A.vcMat(0.5), 24, G, { shadow: true }), globes = new A.Inst(new THREE.SphereGeometry(0.34, 12, 10), lm, 24, G), benches = new A.Inst(bench(), A.vcMat(0.9), 24, G, { shadow: true });
  let nl = 0; for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + 0.12, x = cx + Math.cos(a) * 45, z = cz + Math.sin(a) * 45; if (onPath(world, x, z, 3)) continue; const y = Math.max(0.12, world.h(x, z)); poles.add(x, y, z, 1, 1, 1); globes.add(x, y + 4.35, z, 1, 1, 1); out.glow.push([x, y + 4.4, z, 1, 0.82, 0.5, 17]); out.colliders.push({ x, z, r: 0.25, y0: y, y1: y + 4 }); if (nl++ % 2 === 0) out.lights.push({ x, y: y + 4.3, z, color: 0xffd890, int: 5, range: 14, flicker: 0.05 }); }
  let nb = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + 0.35, x = cx + Math.cos(a) * 41, z = cz + Math.sin(a) * 41; if (onPath(world, x, z, 3.2)) continue; benches.add(x, 0.12, z, 1, 1, 1, -a + Math.PI / 2 + Math.PI); out.colliders.push({ x, z, hx: 0.9, hz: 0.3, rot: -a + Math.PI / 2, y0: 0, y1: 1 }); nb++; }
  poles.done(); globes.done(); benches.done();
  // Blumenbeete
  const bed = new THREE.CylinderGeometry(1.7, 1.8, 0.4, 16), bedM = std('#8a8478', { map: A.tex.stone() }), fl = new A.Inst(new THREE.SphereGeometry(0.17, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), 200, G), cols = ['#e83a5a', '#ffd23a', '#ffffff', '#c05aff', '#ff8a2a'];
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + 0.5, x = cx + Math.cos(a) * 34, z = cz + Math.sin(a) * 34; if (onPath(world, x, z, 3.5)) continue; G.add(mesh(bed, bedM, x, 0.32, z)); G.add(mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 12), std('#3a2a1c'), x, 0.54, z, false)); for (let q = 0; q < 16; q++) { const aa = world.R(0, TAU), rr = Math.sqrt(world.rng()) * 1.35; fl.add(x + Math.cos(aa) * rr, 0.7 + world.R(0, 0.12), z + Math.sin(aa) * rr, 1, 1, 1, 0, cols[(q + k) % cols.length]); } out.colliders.push({ x, z, r: 1.8, y0: 0, y1: 0.5 }); }
  fl.done();
  // Café-Tische mit Schirmen (Ostseite)
  const stripe = new THREE.MeshStandardMaterial({ map: T.awningTex('#b02a2a', '#f4ecd8'), roughness: 0.85, side: THREE.DoubleSide }), wd = std('#6a4a2a');
  for (let k = 0; k < 6; k++) { const a = -0.55 + k * 0.22, x = cx + Math.cos(a) * 37, z = cz + Math.sin(a) * 37; if (onPath(world, x, z, 4)) continue;
    const g = new THREE.Group(); g.position.set(x, 0.12, z); g.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 14), wd, 0, 0.8, 0), mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 6), wd, 0, 0.4, 0), mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), std('#d8d0c0'), 0, 1.25, 0), mesh(new THREE.ConeGeometry(1.9, 0.6, 14, 1, true), stripe, 0, 2.6, 0));
    for (let q = 0; q < 3; q++) { const aa = q / 3 * TAU; g.add(mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), wd, Math.cos(aa) * 1.0, 0.48, Math.sin(aa) * 1.0, false), mesh(new THREE.BoxGeometry(0.4, 0.4, 0.05), wd, Math.cos(aa) * 1.2, 0.7, Math.sin(aa) * 1.2, false)); }
    out.world.add(g); out.colliders.push({ x, z, r: 0.9, y0: 0, y1: 1 }); }
  // Platzschild "Kaiserplatz"
  for (const [px, pz] of [[-11, 60 + 52], [11, 60 + 52], [-11, 60 - 52]]) { if (onPath(world, px, pz, 2)) continue; const g = new THREE.Group(); g.position.set(px, world.h(px, pz), pz); g.rotation.y = pz > 60 ? 0 : Math.PI; g.add(mesh(new THREE.BoxGeometry(3.4, 0.9, 0.9), std('#8a8478', { map: A.tex.stone() }), 0, 0.45, 0), mesh(new THREE.BoxGeometry(3, 1.1, 0.25), std('#2a2a30'), 0, 1.45, 0)); const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.7), new THREE.MeshBasicMaterial({ map: signTexture('Kaiserplatz', '#5a2a2a', '#f0e2b8') })); sg.position.set(0, 1.45, 0.14); g.add(sg); out.world.add(g); out.colliders.push({ x: px, z: pz, hx: 1.7, hz: 0.5, rot: g.rotation.y, y0: 0, y1: 2 }); break; }
}

// ---------------------------------------------------------------- Rookburgh: dichte Gassen mit Werkhallen, Rohre, Zahnräder, Flugmaschinen
export function rookburgh(world) {
  const zn = world.zones.rookburgh, out = world.out, env = world.env, G = world.group, k = Q(world), houses = [];
  // Raster aus Werkhallen (Zeilen mit schmalen Gassen dazwischen); Mulden werden eingeebnet
  const cellX = 22, cellZ = 20; let n = 0; const max = Math.round(36 * k);
  for (let zi = -6; zi <= 4 && n < max; zi++) for (let xi = -9; xi <= 9 && n < max; xi++) {
    const x = zn.x + xi * cellX + world.R(-1.2, 1.2), z = zn.z + zi * cellZ + 4 + world.R(-1.2, 1.2);
    if (Math.hypot(x - zn.x, (z - zn.z) * 1.3) > 195) continue;
    if (!world.occFree(x, z, 6.2) || world.nearTrackFast(x, z, 11, 9) || world.nearTrackFast(x, z, 6, 90) || world.nearStation(x, z)) continue;
    const y0 = world.h(x, z); if (y0 < -2.4) continue;
    const rot = (zi % 2 ? Math.PI : 0) + (world.rng() < 0.12 ? Math.PI / 2 : 0), r = H.steamHouse(world.prng, x, Math.max(0.05, y0), z, rot, env, out, { w: 9.5 + world.R(0, 5), d: 8 + world.R(0, 3.5) });
    houses.push({ x, z, h: r.h }); world.grid.mark(x, z, 6.2); n++;
  }
  world.rookburghCount = n; (world.spots = world.spots || {}).rookburgh = houses.map(h => [h.x, h.z]);
  // Rohre zwischen benachbarten Werkhallen (über den Gassen), mit Stützen, Ellbogen und Dampfaustritt
  const pipes = new Batch(), copper = hex('#b87333'), dark = hex('#3a3e46'), brass = hex('#d4a84a'); let leaks = 0;
  for (let i = 0; i < houses.length; i++) for (let j = i + 1; j < houses.length; j++) {
    const a = houses[i], b = houses[j], d = Math.hypot(a.x - b.x, a.z - b.z); if (d > 34 || d < 12 || world.rng() < 0.55) continue;
    const y = 6.2 + world.R(0, 1.5), c = world.rng() < 0.5 ? copper : dark;
    pipes.tube([a.x, y, a.z], [b.x, y, b.z], 0.32, c, 8); pipes.tube([a.x, y - 0.45, a.z], [a.x, y + 0.45, a.z], 0.4, brass, 8); pipes.tube([b.x, y - 0.45, b.z], [b.x, y + 0.45, b.z], 0.4, brass, 8);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2; pipes.tube([mx, y - 0.3, mz], [mx, world.h(mx, mz), mz], 0.16, dark, 6); pipes.tube([mx, y - 0.1, mz], [mx, y + 0.9, mz], 0.14, brass, 6);
    if (leaks++ < 7) out.smoke.push({ x: mx, y: y + 1, z: mz, kind: 'steam' });
  }
  if (!pipes.empty) G.add(mesh(pipes.build(), A.vcMat(0.45), 0, 0, 0));
  // große freistehende Zahnräder auf Sockeln
  for (let q = 0; q < 3; q++) around(world, zn.x, zn.z, 120, 1, 6, (x, y, z, rot) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot + world.R(-0.6, 0.6); g.add(mesh(new THREE.BoxGeometry(2.4, 1.6, 1.4), std('#3a3e46', { metalness: 0.6, roughness: 0.5 }), 0, 0.8, 0));
    const gm = new THREE.MeshStandardMaterial({ map: T.gearTex(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.7 }), gear = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), gm); gear.position.set(0, 4.7, 0); g.add(gear); out.spinners.push({ obj: gear, axis: 'z', speed: 0.35 * (q % 2 ? 1 : -1) }); out.world.add(g); out.colliders.push({ x, z, r: 1.6, y0: y, y1: y + 2 });
  });
  // Flugmaschinen (Ornithopter) kreisen über der Stadt
  const metal = std('#8a6a44', { metalness: 0.4, roughness: 0.5 }), cloth = std('#e8dcc0', { side: THREE.DoubleSide, roughness: 0.9 });
  for (let q = 0; q < 3; q++) {
    const g = new THREE.Group(); g.add(mesh(new THREE.CapsuleGeometry(0.7, 2.6, 4, 8), metal).rotateZ(Math.PI / 2)); const wings = []; for (const sz of [-1, 1]) { const wg = new THREE.Group(); wg.position.set(0, 0.2, sz * 0.6); const pl = mesh(new THREE.PlaneGeometry(2.4, 4.8), cloth, 0, 0, sz * 2.4, false); pl.rotation.x = Math.PI / 2; wg.add(pl); g.add(wg); wings.push([wg, sz]); }
    const rot = mesh(new THREE.BoxGeometry(0.08, 0.12, 2.6), std('#2a2a2e'), 1.7, 0, 0, false); g.add(rot); g.add(mesh(new THREE.BoxGeometry(0.1, 1.1, 0.7), std('#a8302a'), -1.6, 0.5, 0, false));
    g.userData.noMerge = true; out.world.add(g); const R = 70 + q * 26, ph = q * 2.1, hh = 30 + q * 7;
    world.anims.push(dt => { const t = world.time * (0.12 - q * 0.02) + ph; g.position.set(zn.x + Math.cos(t) * R, hh + Math.sin(t * 3) * 2, zn.z + Math.sin(t) * R * 0.45); g.rotation.y = -t - Math.PI / 2; rot.rotation.x += dt * 30; for (const [wg, sz] of wings) wg.rotation.x = sz * 0.5 * Math.sin(world.time * 5 + q); });
  }
  // Dampfventile am Boden entlang der Wege
  let vents = 0; for (const [a, b, w] of world.edges) { const A_ = world.nodes[a], B_ = world.nodes[b]; if (Math.hypot((A_.x + B_.x) / 2 - zn.x, (A_.z + B_.z) / 2 - zn.z) > zn.r || vents > 8) continue; const L = Math.hypot(B_.x - A_.x, B_.z - A_.z); if (L < 30) continue; const t = L * 0.5, x = A_.x + (B_.x - A_.x) * t / L - (B_.z - A_.z) / L * (w / 2 + 1.1), z = A_.z + (B_.z - A_.z) * t / L + (B_.x - A_.x) / L * (w / 2 + 1.1); if (!world.occFree(x, z, 1)) continue; G.add(mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.1, 8), std('#3a3e46', { metalness: 0.6 }), x, world.h(x, z) + 0.55, z)); out.smoke.push({ x, y: world.h(x, z) + 1.2, z, kind: 'steam' }); vents++; }
}

// ---------------------------------------------------------------- Klugheim: gewaltige Basaltsäulen
export function klugheim(world) {
  const zn = world.zones.klugheim, out = world.out, G = world.group, k = Q(world);
  const geo = new THREE.CylinderGeometry(0.5, 0.56, 1, 6); geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.05, flatShading: true, map: T.stoneTintTex('#4a5058') }), inst = new A.Inst(geo, mat, Math.round(260 * k) + 40, G, { shadow: true });
  const cols = ['#2c3036', '#343a42', '#3c424a', '#262a30', '#454c54']; let total = 0;
  const clusters = Math.round(15 * k) + 3;
  for (let c = 0; c < clusters; c++) {
    let cx = 0, cz = 0, ok = false;
    for (let t = 0; t < 40 && !ok; t++) { const ang = world.R(0, TAU), r = world.R(0.3, 1.0) * zn.r; cx = zn.x + Math.cos(ang) * r; cz = zn.z + Math.sin(ang) * r; ok = world.occFree(cx, cz, 5) && !world.nearTrackFast(cx, cz, 7, 9) && !world.nearStation(cx, cz) && world.h(cx, cz) > -1.5; }
    if (!ok) continue; const y0 = world.h(cx, cz);
    const n = 7 + Math.floor(world.rng() * 7), top = world.R(10, 34);
    for (let i = 0; i < n; i++) {
      const a = world.R(0, TAU), rr = Math.sqrt(world.rng()) * 6.5, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr; if (world.nearTrackFast(x, z, 3.5, 12)) continue; const s = world.R(1.3, 3.0), hgt = Math.max(5, top * (1 - rr / 9) * world.R(0.6, 1.1)), y = world.h(x, z) - 1.5;
      inst.add(x, y, z, s * 2, hgt + 1.5, s * 2, world.R(0, 1), cols[Math.floor(world.rng() * cols.length)], world.R(-0.05, 0.05), world.R(-0.05, 0.05)); out.colliders.push({ x, z, r: s * 0.95, y0: y, y1: y + hgt }); total++;
    }
    (world.spots = world.spots || {}).basalt = (world.spots.basalt || []).concat([[cx, cz]]); world.grid.mark(cx, cz, 7);
  }
  inst.done(); world.basaltCount = total;
}

// ---------------------------------------------------------------- Mexico: Marktstände, Fähnchenketten
export function marketStall(world, x, y, z, rot, pal = ['#e83a2a', '#ffd23a', '#2aa8a0', '#f4ecd8']) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; const wd = std('#6a4a2a', { map: A.tex.planks('#6a4a2a') }), c1 = pal[Math.floor(world.rng() * pal.length)], c2 = pal[(pal.indexOf(c1) + 1) % pal.length];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.7, 6), wd, sx * 1.5, 1.35, sz * 0.8, false));
  g.add(mesh(new THREE.BoxGeometry(3.2, 0.9, 1.1), wd, 0, 0.45, 0.2), mesh(new THREE.BoxGeometry(3.4, 0.08, 1.3), std('#d8c8a0'), 0, 0.94, 0.2, false));
  const can = mesh(new THREE.BoxGeometry(3.7, 0.08, 2.3), new THREE.MeshStandardMaterial({ map: T.rep(T.awningTex(c1, c2), 4, 1), roughness: 0.85 }), 0, 2.75, 0.1); can.rotation.x = 0.16; g.add(can);
  for (let q = 0; q < 7; q++) { const col = new THREE.Color().setHSL((q * 0.19 + world.R(0, 0.1)) % 1, 0.7, 0.55); g.add(mesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }), -1.2 + q * 0.4, 1.12, 0.2, false)); }
  world.out.world.add(g); world.out.colliders.push({ x, z, hx: 1.8, hz: 0.7, rot, y0: y, y1: y + 1 }); world.out.glow.push([x, y + 2.6, z, 1, 0.75, 0.4, 14]);
}
export function mexico(world) {
  const zn = world.zones.mexico, out = world.out, G = world.group, k = Q(world);
  around(world, zn.x, zn.z, zn.r * 1.05, Math.round(9 * k) + 2, 5.5, (x, y, z, rot) => marketStall(world, x, y, z, rot));
  // Fähnchenketten quer über die Wege
  const poles = new Batch(), flags = new A.Inst(new THREE.ConeGeometry(0.26, 0.55, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }), 900, G), wood = hex('#4a3020'), str = hex('#d8d0b8'), pal = ['#e83a2a', '#ffd23a', '#2aa8a0', '#d85a90', '#3a78c8', '#7ac860'];
  let strings = 0;
  for (const [a, b, w] of world.edges) {
    const A_ = world.nodes[a], B_ = world.nodes[b], L = Math.hypot(B_.x - A_.x, B_.z - A_.z); if (L < 24 || Math.hypot((A_.x + B_.x) / 2 - zn.x, (A_.z + B_.z) / 2 - zn.z) > zn.r * 1.1 || strings > 26) continue;
    const dx = (B_.x - A_.x) / L, dz = (B_.z - A_.z) / L, nx = -dz, nz = dx, half = w / 2 + 0.9;
    for (let t = 9; t < L - 8; t += 14) {
      const px = A_.x + dx * t, pz = A_.z + dz * t, p1 = [px + nx * half, 0, pz + nz * half], p2 = [px - nx * half, 0, pz - nz * half], y1 = world.h(p1[0], p1[2]), y2 = world.h(p2[0], p2[2]); const H1 = 5.6;
      poles.tube([p1[0], y1, p1[2]], [p1[0], y1 + H1, p1[2]], 0.09, wood, 6); poles.tube([p2[0], y2, p2[2]], [p2[0], y2 + H1, p2[2]], 0.09, wood, 6);
      let prev = [p1[0], y1 + H1, p1[2]]; const N = 12; for (let i = 1; i <= N; i++) { const u = i / N, sag = Math.sin(u * Math.PI) * 0.9, q = [p1[0] + (p2[0] - p1[0]) * u, y1 + H1 + (y2 - y1) * u - sag, p1[2] + (p2[2] - p1[2]) * u]; poles.tube(prev, q, 0.02, str, 4); if (i < N) flags.add(q[0], q[1] - 0.3, q[2], 1, 1, 1, Math.atan2(nz, nx), pal[(i + strings) % pal.length], Math.PI, 0); prev = q; }
      out.colliders.push({ x: p1[0], z: p1[2], r: 0.15, y0: y1, y1: y1 + H1 }, { x: p2[0], z: p2[2], r: 0.15, y0: y2, y1: y2 + H1 }); strings++;
    }
  }
  if (!poles.empty) G.add(mesh(poles.build(), A.vcMat(0.8), 0, 0, 0, false)); flags.done();
}

// ---------------------------------------------------------------- Mystery: Wehrmauer um die Burg, Runensteine, Wasserspeier, Kapuzenfiguren
export function mystery(world) {
  const zn = world.zones.mystery, out = world.out, env = world.env, G = world.group, k = Q(world), cx = zn.x + 10, cz = zn.z - 20;
  const stone = new THREE.MeshStandardMaterial({ map: T.rep(T.stoneTintTex('#4a4a52'), 3, 1), roughness: 1 }), dark = std('#1a1a22'), N = 22, R = 46, mer = new A.Inst(new THREE.BoxGeometry(1.1, 0.9, 1.3), stone, 400, G, { shadow: true });
  for (let i = 0; i < N; i++) {
    const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, am = (a0 + a1) / 2, x0 = cx + Math.cos(a0) * R, z0 = cz + Math.sin(a0) * R, x1 = cx + Math.cos(a1) * R, z1 = cz + Math.sin(a1) * R, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0);
    if (onPath(world, mx, mz, 3) || world.nearTrackFast(mx, mz, 7, 14) || world.h(mx, mz) < -0.6) { // Lücke: Wachturm am Tor
      if (!onPath(world, x0, z0, 1.5)) { const y = world.h(x0, z0); const t = mesh(new THREE.CylinderGeometry(2.4, 2.8, 10, 10), stone, x0, y + 5, z0); G.add(t, mesh(new THREE.ConeGeometry(3.2, 3.6, 10), dark, x0, y + 11.8, z0)); out.colliders.push({ x: x0, z: z0, r: 2.7, y0: y, y1: y + 10 }); out.glow.push([x0, y + 7, z0, 0.4, 0.6, 1, 22]); }
      continue; }
    const y = Math.max(0.05, world.h(mx, mz)), ang = Math.atan2(z1 - z0, x1 - x0);
    const wall = mesh(new THREE.BoxGeometry(len + 0.3, 4.6, 1.2), stone, mx, y + 2.3, mz); wall.rotation.y = -ang; G.add(wall); out.colliders.push({ x: mx, z: mz, hx: len / 2, hz: 0.6, rot: -ang, y0: y, y1: y + 4.6 });
    for (let q = 0; q < 4; q++) { const u = (q + 0.5) / 4 - 0.5; mer.add(mx + Math.cos(ang) * u * len, y + 5.0, mz + Math.sin(ang) * u * len, 1, 1, 1, -ang); }
    if (i % 3 === 0) { const t = mesh(new THREE.CylinderGeometry(2.3, 2.7, 9, 10), stone, x0, y + 4.5, z0); G.add(t, mesh(new THREE.ConeGeometry(3.1, 3.4, 10), dark, x0, y + 10.6, z0)); out.colliders.push({ x: x0, z: z0, r: 2.6, y0: y, y1: y + 9 }); out.glow.push([x0, y + 6, z0, 0.4, 0.6, 1, 20]); }
  }
  mer.done();
  // Runensteine (leuchten nachts)
  const rm = new THREE.MeshStandardMaterial({ map: T.runeTex(), emissiveMap: T.runeGlowTex(), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9 }); env.registerLamp(rm);
  const runes = new A.Inst(new THREE.BoxGeometry(1.1, 2.2, 0.4), rm, 60, G, { shadow: true });
  around(world, zn.x, zn.z, zn.r * 1.1, Math.round(16 * k) + 4, 4, (x, y, z, rot) => { const s = world.R(0.9, 1.6); runes.add(x, y + 0.9 * s, z, s, s, s, world.R(0, TAU), null, 0, world.R(-0.1, 0.1)); out.colliders.push({ x, z, r: 0.7 * s, y0: y, y1: y + 2.4 * s }); out.glow.push([x, y + 1.5 * s, z, 0.4, 0.55, 1, 14]); });
  runes.done();
  // Kapuzenfiguren (Statuen)
  const robe = std('#1c1c24', { roughness: 1 }), eye = new THREE.MeshBasicMaterial({ color: 0x9ad0ff });
  around(world, zn.x, zn.z, zn.r, Math.round(8 * k) + 2, 3.5, (x, y, z, rot) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; g.add(mesh(new THREE.ConeGeometry(0.85, 3.1, 8), robe, 0, 1.55, 0), mesh(new THREE.SphereGeometry(0.42, 10, 8), robe, 0, 3.2, 0.05)); for (const sx of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.07, 6, 5), eye, sx * 0.14, 3.2, 0.42, false)); g.add(mesh(new THREE.BoxGeometry(0.2, 0.2, 0.9), robe, 0, 2.4, 0.7, false)); out.world.add(g); out.colliders.push({ x, z, r: 0.8, y0: y, y1: y + 3.4 }); out.glow.push([x, y + 3.2, z + 0.4, 0.4, 0.6, 1, 9]); });
  // Wasserspeier auf den Burgtürmen
  const gar = new Batch(), gc = hex('#33353c'), cy = world.h(cx, cz);
  const gargoyle = (px, py, pz, yaw) => { const gb = new Batch(); gb.obox([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], 1.4, 0.8, 0.8, gc); gb.obox([1.0, 0.25, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.7, 0.6, 0.6, gc); gb.tube([0.9, 0.55, 0.2], [1.1, 1.1, 0.25], 0.07, gc, 4); gb.tube([0.9, 0.55, -0.2], [1.1, 1.1, -0.25], 0.07, gc, 4); gb.obox([-0.1, 0.5, 0.9], [1, 0.2, 0], [-0.2, 1, 0], [0, 0, 1], 1.1, 0.08, 1.2, gc); gb.obox([-0.1, 0.5, -0.9], [1, 0.2, 0], [-0.2, 1, 0], [0, 0, 1], 1.1, 0.08, 1.2, gc); const g = gb.build(); const m = new THREE.Mesh(g, A.vcMat(0.9)); m.position.set(px, py, pz); m.rotation.y = yaw; m.castShadow = true; G.add(m); };
  for (const [sx, sz] of [[-18, -12], [18, -12], [-18, 12], [18, 12]]) { const ang = Math.atan2(sz, sx); gargoyle(cx + sx + Math.cos(ang) * 5.2, cy + 33, cz + sz + Math.sin(ang) * 5.2, -ang); }
}

// ---------------------------------------------------------------- Deep in Africa: Marktstände in Erdfarben
export function africa(world) {
  const zn = world.zones.africa, k = Q(world);
  around(world, zn.x, zn.z, zn.r * 0.95, Math.round(9 * k) + 2, 5.5, (x, y, z, rot) => marketStall(world, x, y, z, rot, ['#b8502a', '#e8b030', '#2a6a3a', '#f0e6d0', '#7a3a1a']));
}

export function buildWorldExtras(world) { // Reihenfolge: nach den Häusern, vor den Laternen/Verdichtung (buildBeauty)
  kaiserplatz(world); rookburgh(world); klugheim(world); mexico(world); mystery(world); africa(world);
}
