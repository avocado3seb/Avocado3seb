// ============================================================================
//  pl_themes.js – Themenwelten mit Charakter: Klugheim als Mittelalterwelt (Burg, Mauern, Türme,
//  Fachwerkhäuser, Marktstände, Banner, Windmühle) und Rookburgh als Pionierzeit der Fliegerei
//  (Holz-Hangars, Doppeldecker, Gleiter, Windsäcke, Startschiene).
// ============================================================================
import * as THREE from 'three';
import * as A from './pl_assets.js';
import { ZONES } from './phantasia.js';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
const toWorld = (ox, oz, rot, lx, lz) => [ox + lx * Math.cos(rot) + lz * Math.sin(rot), oz - lx * Math.sin(rot) + lz * Math.cos(rot)];

function findSpot(world, key, clear, slopeMax = 4, tries = 900, minR = 15, trackY = 90) {
  const zn = ZONES[key];
  for (let t = 0; t < tries; t++) {
    const a = world.R(0, 6.283), r = minR + Math.sqrt(world.rng()) * (zn.r * 1.0 - minR), x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r;
    const dbg = world._fs || (world._fs = {}); const d = dbg[key + clear] || (dbg[key + clear] = { grid: 0, track: 0, station: 0, slope: 0, water: 0, ok: 0 });
    if (!world.grid.free(x, z, clear)) { d.grid++; continue; } if (world.nearTrackFast(x, z, clear, trackY)) { d.track++; continue; } if (world.nearStation(x, z)) { d.station++; continue; }
    let lo = 1e9, hi = -1e9; for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]]) { const h = world.h(x + dx * clear * 0.8, z + dz * clear * 0.8); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    if (lo < -0.2) { d.water++; continue; } if (hi - lo > slopeMax) { d.slope++; continue; } d.ok++;
    return [x, z, world.h(x, z)];
  }
  return null;
}
function placeNear(world, cx, cz, rmin, rmax, count, clear, fn, trackY = 9) { // um einen Punkt (z. B. Bahneingang) herum
  let n = 0;
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < 600; t++) {
      const a = world.R(0, 6.283), r = rmin + Math.sqrt(world.rng()) * (rmax - rmin), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = world.h(x, z);
      if (y < -3 || !world.grid.free(x, z, clear) || world.nearTrackFast(x, z, clear, trackY) || world.nearStation(x, z)) continue;
      if (Math.abs(world.h(x + clear * 0.7, z) - y) > 3 || Math.abs(world.h(x, z + clear * 0.7) - y) > 3) continue;
      fn(x, y, z, Math.round(Math.atan2(cx - x, cz - z) / (Math.PI / 2)) * (Math.PI / 2)); world.grid.mark(x, z, clear); n++; break;
    }
  }
  return n;
}
function placeMany(world, key, count, clear, slope, fn, trackY = 9) { // freie Plätze suchen (Bahnen verdichten den Park → alongPaths findet kaum Platz)
  let n = 0; for (let i = 0; i < count; i++) { const sp = findSpot(world, key, clear, slope, 700, 10, trackY); if (!sp) continue; const face = Math.round(Math.atan2(-sp[0] * 0 + (0 - sp[0]), 60 - sp[1]) / (Math.PI / 2)) * (Math.PI / 2); fn(sp[0], sp[2], sp[1], face); world.grid.mark(sp[0], sp[1], clear); n++; } return n;
}
function box(g, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; }
function cloth(color, w = 1.6, h = 2.6) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(color, { side: THREE.DoubleSide })); return m; }

// ============================================================== Mittelalter (Klugheim)
export function buildMedieval(world, key = 'klugheim', big = true) {
  const out = world.out, R = (a, b) => world.R(a, b), G = world.group;
  const stone = std(0xffffff, { map: A.tex.stone(), roughness: 1 }), roofM = std(0x7a2a22), wood = std(0x5a3d26), dark = std(0x3a3a40);
  const S = big ? 21 : 15, spot = findSpot(world, key, S + 8, 4.5) || findSpot(world, key, S + 4, 7);
  if (spot) {
    const [cx, cz, by] = spot, hub = { x: 0, z: 60 }, rot = Math.round(Math.atan2(hub.x - cx, hub.z - cz) / (Math.PI / 2)) * (Math.PI / 2);
    const g = new THREE.Group(); g.position.set(cx, by, cz); g.rotation.y = rot; g.userData.merge = true; G.add(g);
    const col = (lx, lz, hx, hz, y1) => { const [wx, wz] = toWorld(cx, cz, rot, lx, lz); out.colliders.push({ x: wx, z: wz, hx, hz, rot, y0: by - 6, y1: by + y1 }); };
    const T = 2.4, WH = 10, GATE = 3.6;
    // Ringmauer (Vorderseite mit Tor)
    const wall = (lx, lz, sx, sz) => { box(g, sx, WH + 4, sz, stone, lx, WH / 2 - 2, lz); col(lx, lz, sx / 2, sz / 2, WH); for (let i = -Math.floor(sx / 4); i <= Math.floor(sx / 4); i++) if (sx > sz) box(g, 1.3, 1.1, T + 0.3, stone, lx + i * 2.6, WH + 0.5, lz); };
    wall(0, -S, 2 * S, T); wall(-S, 0, T, 2 * S); wall(S, 0, T, 2 * S);
    wall(-(S + GATE) / 2, S, S - GATE, T); wall((S + GATE) / 2, S, S - GATE, T);
    box(g, 2 * GATE, 2.2, T + 0.4, stone, 0, WH + 0.4, S); // Torbogen-Sturz
    box(g, 2 * GATE, 0.6, T, wood, 0, 6.2, S);
    // Türme
    const tower = (lx, lz, r, h) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, h + 4, 14), stone); t.position.set(lx, h / 2 - 2, lz); t.castShadow = t.receiveShadow = true; g.add(t); const ro = new THREE.Mesh(new THREE.ConeGeometry(r * 1.25, r * 1.9, 14), roofM); ro.position.set(lx, h + r * 0.95, lz); ro.castShadow = true; g.add(ro); col(lx, lz, r + 0.2, r + 0.2, h); const [wx, wz] = toWorld(cx, cz, rot, lx, lz); out.colliders.pop(); out.colliders.push({ x: wx, z: wz, r: r + 0.3, y0: by - 6, y1: by + h }); out.glow.push([wx, by + h - 3, wz, 1, 0.7, 0.35, 22]); };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * S, sz * S, 4.6, 19);
    for (const sx of [-1, 1]) tower(sx * (GATE + 1.6), S, 2.8, 14);
    // Bergfried
    box(g, 14, 22, 14, stone, 0, 9, -S + 12); col(0, -S + 12, 7, 7, 20);
    for (let i = -3; i <= 3; i++) for (const e of [-1, 1]) { box(g, 1.4, 1.4, 1.4, stone, i * 2, 20.7, e * 7 - S + 12); box(g, 1.4, 1.4, 1.4, stone, e * 7, 20.7, i * 2 - S + 12); }
    const roofK = new THREE.Mesh(new THREE.ConeGeometry(6, 9, 4), roofM); roofK.position.set(0, 26, -S + 12); roofK.rotation.y = Math.PI / 4; roofK.castShadow = true; g.add(roofK);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 5), dark); pole.position.set(0, 34, -S + 12); g.add(pole);
    const flag = cloth(0xc01a2a, 4.2, 2.4); flag.position.set(2.2, 35.5, -S + 12); g.add(flag); world.anims.push(dt => { flag.rotation.y = Math.sin(world.time * 2.2) * 0.25; });
    for (const sx of [-1, 1]) { const b = cloth(sx < 0 ? 0xc01a2a : 0x1a3aa0, 2.2, 5); b.position.set(sx * 8, 7, S + 1.3); g.add(b); }
    // Brunnen im Hof + Fackeln
    const well = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 1.1, 12), stone); well.position.set(-6, 0.55, 4); g.add(well); col(-6, 4, 1.6, 1.6, 1.2); { const [wx, wz] = toWorld(cx, cz, rot, -6, 4); out.colliders.pop(); out.colliders.push({ x: wx, z: wz, r: 1.7, y0: by - 1, y1: by + 1.2 }); }
    for (const [lx, lz] of [[-GATE - 0.6, S + 1.8], [GATE + 0.6, S + 1.8], [-8, -S + 5.5], [8, -S + 5.5], [-S + 3, 0], [S - 3, 0]]) { const [wx, wz] = toWorld(cx, cz, rot, lx, lz); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 5), wood); t.position.set(lx, 1.3, lz); g.add(t); out.glow.push([wx, by + 2.8, wz, 1, 0.55, 0.2, 26]); out.lights.push({ x: wx, y: by + 2.8, z: wz, color: 0xff8a30, int: 6, range: 13, flicker: 0.35 }); }
    world.grid.mark(cx, cz, S + 8); if (big) world.castle = { x: cx, z: cz, rot }; else world.castle2 = { x: cx, z: cz, rot };
  }
  // Fachwerkhäuser entlang der Wege (mittelalterlicher Stil)
  const th = world.theme; let made = 0;
  if (th) made = placeMany(world, key, big ? 12 : 8, 9, 3, (x, y, z, r4) => { const w = R(8, 12), d = R(7, 9), h = R(6, 10); world.makeBuilding(x, z, r4, w, d, h, th); });
  // Marktstände mit Stoffdächern und Banner
  const awn = [0xc01a2a, 0x1a5ac0, 0xe0b020, 0x2a9a4a, 0x8a2aa0];
  placeMany(world, key, big ? 8 : 5, 5, 3, (x, y, z, rot) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; g.userData.merge = true; G.add(g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.14, 2.6, 0.14, wood, sx * 1.7, 1.3, sz * 1.2);
    box(g, 3.9, 0.9, 1.1, wood, 0, 0.45, 0.35); const c = awn[Math.floor(world.rng() * awn.length)];
    for (let i = 0; i < 6; i++) { const s = box(g, 0.66, 0.08, 3.0, std(i % 2 ? c : 0xf2ecd8), -1.65 + i * 0.66, 2.75, 0); s.rotation.x = 0.12; }
    for (const [lx, lz] of [[-1.2, 0.35], [0, 0.35], [1.2, 0.35]]) box(g, 0.5, 0.3, 0.4, std(0xa8703a), lx, 1.05, lz);
    out.colliders.push({ x, z, hx: 2, hz: 1.4, rot, y0: y, y1: y + 2.6 });
  });
  world.alongPaths(key, big ? 16 : 10, (x, y, z, rot) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 6.5, 6), wood); p.position.set(x, y + 3.25, z); G.add(p); const b = cloth(awn[Math.floor(world.rng() * awn.length)], 1.5, 3.6); b.position.set(x + 0.8 * Math.cos(rot), y + 4.4, z - 0.8 * Math.sin(rot)); b.rotation.y = rot; G.add(b); out.colliders.push({ x, z, r: 0.2, y0: y, y1: y + 6 }); return true; }, 3);
  // Windmühle mit drehenden Flügeln
  const mill = big ? findSpot(world, key, 9, 3.5) : null;
  if (mill) {
    const [mx, mz, my] = mill, g = new THREE.Group(); g.position.set(mx, my, mz); G.add(g);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 11, 12), std(0xffffff, { map: A.tex.stone() })); body.position.y = 5; body.castShadow = true; g.add(body);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.6, 12), roofM); cap.position.y = 12.6; g.add(cap);
    const hub = new THREE.Group(); hub.position.set(0, 11, 3); g.add(hub);
    for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; const bar = box(arm, 0.25, 9, 0.25, wood, 0, 4.5, 0), sail = box(arm, 1.8, 6.5, 0.06, std(0xe8dfc8), 1.1, 5.2, 0.1); hub.add(arm); }
    world.anims.push(dt => { hub.rotation.z += dt * 0.5; });
    out.colliders.push({ x: mx, z: mz, r: 3.9, y0: my - 1, y1: my + 12 }); world.grid.mark(mx, mz, 10);
  }
  if (big) world.medieval = { castle: !!spot, houses: made };
}

// ============================================================== Pionierzeit der Fliegerei (Rookburgh)
function biplane(g, wingCol = 0xf0e6c8) {
  const canvas = std(wingCol), wood = std(0x6a4a2a), red = std(0xb02020);
  box(g, 6.2, 0.85, 0.85, canvas, 0, 1.25, 0); box(g, 1.3, 0.9, 0.9, red, 3.2, 1.25, 0);           // Rumpf, Motor
  for (const y of [0.75, 2.45]) box(g, 1.7, 0.1, 10, canvas, 0.2, y + 0.55, 0);                    // Tragflächen
  for (const z of [-3.6, -1.4, 1.4, 3.6]) { box(g, 0.07, 1.7, 0.07, wood, 0.6, 1.9, z); box(g, 0.07, 1.7, 0.07, wood, -0.2, 1.9, z); }
  box(g, 1.1, 0.08, 3.2, canvas, -3.2, 1.35, 0); box(g, 0.1, 1.2, 0.08, red, -3.2, 1.95, 0);       // Leitwerk
  const prop = new THREE.Group(); prop.position.set(3.9, 1.25, 0); box(prop, 0.1, 0.16, 2.7, wood, 0, 0, 0); box(prop, 0.1, 2.7, 0.16, wood, 0, 0, 0); g.add(prop);
  for (const z of [-0.9, 0.9]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.14, 12), std(0x1a1a1e)); w.rotation.x = Math.PI / 2; w.position.set(1.6, 0.4, z); g.add(w); box(g, 0.08, 0.9, 0.08, wood, 1.6, 0.85, z); }
  return prop;
}
export function buildAviation(world) {
  const out = world.out, R = (a, b) => world.R(a, b), G = world.group, zn = ZONES.rookburgh;
  const plank = std(0xffffff, { map: A.tex.planks('#7a5a3a') }), tin = std(0x8a8f96, { metalness: 0.4, roughness: 0.6 });
  // Holz-Hangars mit Tonnendach
  const hangar = (x, y, z, rot) => {
    const w = 13, d = 20, h = 6, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; g.userData.merge = true; G.add(g);
    box(g, 0.5, h, d, plank, -w / 2, h / 2, 0); box(g, 0.5, h, d, plank, w / 2, h / 2, 0); box(g, w, h, 0.5, plank, 0, h / 2, -d / 2);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 + 0.3, w / 2 + 0.3, d + 0.6, 14, 1, true, Math.PI / 2, Math.PI), tin); roof.rotation.set(Math.PI / 2, 0, 0); roof.position.y = h; roof.scale.set(1, 1, 0.55); roof.material.side = THREE.DoubleSide; roof.castShadow = true; g.add(roof);
    box(g, 3.4, h - 0.5, 0.3, plank, -w / 2 + 1.7, (h - 0.5) / 2, d / 2); box(g, 3.4, h - 0.5, 0.3, plank, w / 2 - 1.7, (h - 0.5) / 2, d / 2);   // halboffene Tore
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#f2e6c4'; c.fillRect(0, 0, 256, 64); c.strokeStyle = '#6a3a1a'; c.lineWidth = 4; c.strokeRect(3, 3, 250, 58); c.fillStyle = '#6a2a14'; c.font = '700 22px Georgia, serif'; c.textAlign = 'center'; c.fillText('FLUGPIONIERE', 128, 30); c.font = '16px Georgia, serif'; c.fillText('Werkstatt · Anno 1903', 128, 52);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) })); sign.position.set(0, h + 0.2, d / 2 + 0.2); g.add(sign);
    const lx = x + 8 * Math.sin(rot) * 0, ang = rot;
    const sx = (a, b) => [x + a * Math.cos(ang) + b * Math.sin(ang), z - a * Math.sin(ang) + b * Math.cos(ang)];
    for (const [a, b, hx, hz] of [[-w / 2, 0, 0.3, d / 2], [w / 2, 0, 0.3, d / 2], [0, -d / 2, w / 2, 0.3], [-w / 2 + 1.7, d / 2, 1.7, 0.3], [w / 2 - 1.7, d / 2, 1.7, 0.3]]) { const [wx, wz] = sx(a, b); out.colliders.push({ x: wx, z: wz, hx, hz, rot: ang, y0: y, y1: y + h }); }
    const [lx2, lz2] = sx(0, d / 2 + 2); out.glow.push([lx2, y + 4, lz2, 1, 0.75, 0.4, 22]);
  };
  const fly = world.rides.find(r => r.coaster.name === 'F.L.Y.'), E = fly ? fly.entrance : { x: zn.x, z: zn.z };
  const near = (cnt, clear, fn) => { let n = placeNear(world, zn.x, zn.z + 10, 8, 110, cnt, clear, fn, 5); if (n < cnt) n += placeNear(world, E.x, E.z, 12, 150, cnt - n, clear, fn, 5); return n; };
  let n = near(4, 9, (x, y, z, rot) => hangar(x, y, z, rot));
  // Doppeldecker, Gleiter, Windsäcke
  const props = [];
  const planes = near(4, 5, (x, y, z, rot) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; G.add(g); props.push(biplane(g, 0xf0e6c8)); out.colliders.push({ x, z, r: 4.2, y0: y, y1: y + 3.2 }); });
  near(3, 4, (x, y, z, rot) => { // Lilienthal-Gleiter auf Stütze
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; G.add(g);
    const wingG = new THREE.BufferGeometry(); wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -6, 0.3, 3.2, 0, 0.1, 2.2, 0, 0, 0, 0, 0.1, 2.2, 6, 0.3, 3.2, 0, 0, 0, 6, 0.3, 3.2, 0, 0.1, 2.2, 0, 0, 0, 0, 0.1, 2.2, -6, 0.3, 3.2].map((v, i) => v), 3)); wingG.computeVertexNormals();
    const wing = new THREE.Mesh(wingG, std(0xece3c8, { side: THREE.DoubleSide })); wing.position.set(0, 3.2, -1.2); wing.scale.set(1, 1, 1); wing.castShadow = true; g.add(wing);
    box(g, 0.16, 3.2, 0.16, std(0x6a4a2a), 0, 1.6, 0); box(g, 2.6, 0.1, 0.1, std(0x6a4a2a), 0, 3.0, 0.2); out.colliders.push({ x, z, r: 0.9, y0: y, y1: y + 3.5 });
  });
  const sockCol = [0xff7a1a, 0xffffff];
  world.alongPaths('rookburgh', 5, (x, y, z, rot) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 7, 5), std(0x3a3a3e)); p.position.set(x, y + 3.5, z); G.add(p); const sock = new THREE.Group(); sock.position.set(x, y + 6.7, z); G.add(sock); for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.5 - i * 0.09, 0.42 - i * 0.09, 0.5, 8, 1, true), std(sockCol[i % 2], { side: THREE.DoubleSide })); s.rotation.z = Math.PI / 2; s.position.x = 0.3 + i * 0.5; sock.add(s); } world.anims.push(dt => { sock.rotation.y = Math.sin(world.time * 0.7 + x) * 0.5; sock.rotation.z = -0.12 + Math.sin(world.time * 3 + x) * 0.05; }); out.colliders.push({ x, z, r: 0.2, y0: y, y1: y + 7 }); return true; }, 3);
  world.anims.push(dt => { for (const p of props) p.rotation.x += dt * 2.2; });
  world.aviation = { hangars: n, planes };
}
