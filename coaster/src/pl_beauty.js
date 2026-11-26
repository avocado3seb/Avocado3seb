// ============================================================================
//  pl_beauty.js – Verschönerung & Verdichtung: Blumenbeete, Hecken, Laternen, Bänke, Mülleimer,
//  Gräser/Wildblumen, Zierbäume und zusätzliche Häuserzeilen entlang der Wege.
// ============================================================================
import * as THREE from 'three';
import * as A from './pl_assets.js';
import { ZONES } from './phantasia.js';

const FLOWER_COLS = ['#ff4a6a', '#ffd23a', '#ffffff', '#c05aff', '#ff8a2a', '#5aa0ff', '#ff7ab8', '#fff08a'];

export function buildBeauty(world) {
  const G = world.group, out = world.out, R = (a, b) => world.R(a, b), rng = () => world.rng();
  const q = world.quality, mult = { low: 0.5, medium: 0.85, high: 1.2 }[q] || 0.85;
  const nearNode = (x, z, d) => { for (const n of world.nodes) if (Math.hypot(n.x - x, n.z - z) < d) return true; return false; };
  const edges = world.edges.map(e => ({ A: world.nodes[e[0]], B: world.nodes[e[1]], w: e[2] })).map(e => ({ ...e, L: Math.hypot(e.B.x - e.A.x, e.B.z - e.A.z) }));
  const mainEdges = edges.filter(e => e.w >= 6 && e.L > 16);
  const sideOf = (e, t, off, side) => { const nx = -(e.B.z - e.A.z) / e.L, nz = (e.B.x - e.A.x) / e.L; return [e.A.x + (e.B.x - e.A.x) * t / e.L + nx * off * side, e.A.z + (e.B.z - e.A.z) * t / e.L + nz * off * side, Math.atan2(e.B.x - e.A.x, e.B.z - e.A.z)]; };
  const cols = out.colliders;
  const blocked = (x, z, r) => { for (let i = 0; i < cols.length; i++) { const c = cols[i], rr = (c.r !== undefined ? c.r : Math.hypot(c.hx, c.hz)) + r; if (Math.abs(c.x - x) < rr && Math.abs(c.z - z) < rr && Math.hypot(c.x - x, c.z - z) < rr) return true; } return false; };
  const okSpot = (x, z, r) => world.h(x, z) > -0.2 && !world.nearTrackFast(x, z, r, 9) && !blocked(x, z, r);

  // ---- Blumen (Kopf + Bodenmatte)
  const flowerG = (() => { const g = []; const base = new THREE.IcosahedronGeometry(0.11, 0);
    for (let i = 0; i < 11; i++) { const h = base.clone(); h.translate((Math.random() - 0.5) * 1.5, 0.22 + Math.random() * 0.3, (Math.random() - 0.5) * 1.5); g.push(h); }
    return mergeGeos(g); })();
  const matG = new THREE.CylinderGeometry(0.95, 1.05, 0.22, 9); matG.translate(0, 0.11, 0);
  const heads = new A.Inst(flowerG, new THREE.MeshStandardMaterial({ roughness: 0.7 }), Math.round(900 * mult), G);
  const mats = new A.Inst(matG, new THREE.MeshStandardMaterial({ color: 0x3f7a2a, roughness: 1 }), Math.round(900 * mult), G);
  const bed = (x, z, s = 1) => { const y = world.h(x, z); mats.add(x, y, z, s, 1, s, R(0, 6), '#' + new THREE.Color().setHSL(0.27 + R(-0.03, 0.03), 0.5, R(0.22, 0.32)).getHexString()); heads.add(x, y, z, s, 1, s, R(0, 6), FLOWER_COLS[Math.floor(rng() * FLOWER_COLS.length)]); };
  for (const e of edges) { if (e.w < 5 || e.L < 14) continue; for (let t = 9; t < e.L - 9; t += R(7, 12)) { const side = rng() < 0.5 ? -1 : 1, [x, z] = sideOf(e, t, e.w / 2 + 1.7, side); if (okSpot(x, z, 1.4) && !nearNode(x, z, 8)) bed(x, z, R(0.8, 1.3)); } }
  for (let a = 0; a < 6.28; a += 0.26) { bed(Math.cos(a) * 15, 60 + Math.sin(a) * 15, 1.1); bed(Math.cos(a + 0.13) * 27, 60 + Math.sin(a + 0.13) * 27, 1.3); }
  heads.done(); mats.done();

  // ---- Hecken entlang der Hauptwege (mit Lücken an Abzweigen)
  const hedgeG = new THREE.BoxGeometry(1, 1, 1); hedgeG.translate(0, 0.5, 0);
  const hedges = new A.Inst(hedgeG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: A.tex.leaf ? A.tex.leaf() : null }), Math.round(700 * mult), G, { shadow: true });
  for (const e of mainEdges) {
    if (e.w < 8) continue;
    for (let t = 14; t < e.L - 14; t += 5) { if (rng() < 0.18) continue; for (const side of [-1, 1]) { if (rng() < 0.35) continue; const [x, z, yaw] = sideOf(e, t, e.w / 2 + 0.9, side); if (!okSpot(x, z, 3) || nearNode(x, z, 9)) continue; const y = world.h(x, z), hh = R(0.8, 1.15); hedges.add(x, y, z, 0.8, hh, 5.2, yaw, '#' + new THREE.Color().setHSL(0.3 + R(-0.03, 0.03), 0.55, R(0.17, 0.26)).getHexString()); out.colliders.push({ x, z, hx: 0.5, hz: 2.6, rot: yaw, y0: y, y1: y + 1 }); } }
  }
  hedges.done();

  // ---- Laternen, Bänke, Mülleimer
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd890, emissiveIntensity: 0, roughness: 0.4 }); world.env.registerLamp(lampMat);
  const poleG = new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6); poleG.translate(0, 2.1, 0);
  const headG = new THREE.SphereGeometry(0.32, 8, 6); headG.translate(0, 4.35, 0);
  const poles = new A.Inst(poleG, new THREE.MeshStandardMaterial({ color: 0x25262b, roughness: 0.6, metalness: 0.5 }), Math.round(260 * mult), G, { shadow: true });
  const lheads = new A.Inst(headG, lampMat, Math.round(260 * mult), G);
  const benchG = (() => { const a = new THREE.BoxGeometry(1.7, 0.1, 0.5); a.translate(0, 0.5, 0); const b = new THREE.BoxGeometry(1.7, 0.45, 0.08); b.translate(0, 0.85, -0.22); const l1 = new THREE.BoxGeometry(0.08, 0.5, 0.5); l1.translate(-0.75, 0.25, 0); const l2 = l1.clone(); l2.translate(1.5, 0, 0); return mergeGeos([a, b, l1, l2]); })();
  const benches = new A.Inst(benchG, new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.9 }), Math.round(120 * mult), G, { shadow: true });
  const binG = new THREE.CylinderGeometry(0.28, 0.24, 0.85, 8); binG.translate(0, 0.43, 0);
  const bins = new A.Inst(binG, new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.7, metalness: 0.3 }), Math.round(120 * mult), G, { shadow: true });
  let lampN = 0;
  for (const e of edges) {
    if (e.w < 5 || e.L < 14) continue;
    for (let t = 10, k = 0; t < e.L - 8; t += 19, k++) {
      const side = k % 2 ? 1 : -1, [x, z, yaw] = sideOf(e, t, e.w / 2 + 0.6, side);
      if (!okSpot(x, z, 0.5) || nearNode(x, z, 5)) continue; const y = world.h(x, z);
      poles.add(x, y, z, 1, 1, 1); lheads.add(x, y, z, 1, 1, 1); out.glow.push([x, y + 4.35, z, 1, 0.82, 0.5, 15]); out.colliders.push({ x, z, r: 0.2, y0: y, y1: y + 4 }); lampN++;
      if (k % 2 === 0) { const [bx, bz] = sideOf(e, t + 7, e.w / 2 + 1.2, side); if (okSpot(bx, bz, 1) && !nearNode(bx, bz, 6)) { const by = world.h(bx, bz); benches.add(bx, by, bz, 1, 1, 1, yaw + (side > 0 ? Math.PI : 0)); out.colliders.push({ x: bx, z: bz, hx: 0.9, hz: 0.3, rot: yaw + (side > 0 ? Math.PI : 0), y0: by, y1: by + 1 }); } }
      if (k % 3 === 1) { const [tx, tz] = sideOf(e, t + 4, e.w / 2 + 1.1, -side); if (okSpot(tx, tz, 0.5) && !nearNode(tx, tz, 6)) bins.add(tx, world.h(tx, tz), tz, 1, 1, 1); }
    }
  }
  poles.done(); lheads.done(); benches.done(); bins.done();

  // ---- Gräser & Wildblumen
  const tuftG = new THREE.ConeGeometry(0.22, 0.7, 4); tuftG.translate(0, 0.35, 0);
  const tufts = new A.Inst(tuftG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), Math.round(5200 * mult), G);
  for (const k in ZONES) {
    const zn = ZONES[k]; if (k === 'parking') continue; const n = Math.round(zn.r * 3.2 * mult);
    for (let i = 0, made = 0; i < n * 3 && made < n; i++) {
      const a = R(0, 6.28), r = Math.sqrt(rng()) * zn.r * 1.1, x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r;
      if (!world.grid.free(x, z, 0.6) || world.h(x, z) < -0.2 || world.nearTrackFast(x, z, 3, 9) || world.flatMask(x, z) > 0.9 && rng() < 0.7) continue; made++;
      const dry = k === 'mexico' || k === 'mystery' && rng() < 0.4, c = new THREE.Color().setHSL(dry ? 0.12 : 0.27 + R(-0.04, 0.04), dry ? 0.45 : 0.55, R(0.2, 0.36));
      for (let j = 0; j < 3; j++) tufts.add(x + R(-0.3, 0.3), world.h(x, z), z + R(-0.3, 0.3), R(0.8, 1.6), R(0.8, 1.8), R(0.8, 1.6), R(0, 6), '#' + c.getHexString(), R(-0.2, 0.2), R(-0.2, 0.2));
    }
  }
  tufts.done();

  // ---- Zierbäume & Verdichtung (Häuserzeilen entlang der Wege)
  if (world.leafyAt) for (const k of ['berlin', 'fantasy', 'china', 'mystery', 'mexico']) world.scatter(k, Math.round(26 * mult), 18, ZONES[k].r * 1.05, (x, y, z) => { world.leafyAt(x, y, z, R(1.4, 2.6)); out.colliders.push({ x, z, r: 0.5, y0: y, y1: y + 6 }); return true; }, 4, 8);
  const env = world.env, pr = world.prng;
  const dens = (key, n, f, clear) => world.alongPaths(key, Math.round(n * mult), (x, y, z, rot) => { f(pr, x, y, z, rot, env, out); return true; }, clear);
  dens('berlin', 22, (r, x, y, z, rot, e, o) => A.nordicHouse(r, x, y, z, rot, { w: 9, d: 7 }, e, o), 9);
  dens('klugheim', 14, (r, x, y, z, rot, e, o) => A.nordicHouse(r, x, y, z, rot, { turf: rng() < 0.5 }, e, o), 9);
  dens('mexico', 10, (r, x, y, z, rot, e, o) => A.adobe(r, x, y, z, rot, e, o), 8);
  dens('fantasy', 12, (r, x, y, z, rot, e, o) => A.fairyHouse(r, x, y, z, rot, e, o), 8);
  dens('china', 8, (r, x, y, z, rot, e, o) => A.fairyHouse(r, x, y, z, rot, e, o), 8);
  dens('rookburgh', 8, (r, x, y, z, rot, e, o) => A.industrial(r, x, y, z, rot, e, o), 14);
  dens('africa', 12, (r, x, y, z, rot, e, o) => A.africanHut(r, x, y, z, rot, {}, e, o), 6);
  world.beautyCount = { lamps: lampN };
}

function mergeGeos(list) { // einfaches Zusammenführen nicht-indizierter/indizierter Geometrien
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0.clone(); const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); r.setIndex(idx); return r;
}
