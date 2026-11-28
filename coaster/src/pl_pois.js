// Gastronomie, Shops, Hotels, Bühnen, Toiletten als begehbare Gebäude + Interaktionspunkte
import * as THREE from 'three';
import { signTexture, textures } from './textures.js';
import { gableGeometry } from './park.js';
import * as A from './pl_assets.js';
import { POIS, ZONE_OF_AREA } from './pl_data.js';
import { FlatRide } from './pl_flat.js';
import { hotelStyle, tavernDecor } from './pl_worlds2.js';

const TAU = Math.PI * 2;
const STYLE = { // je Themenbereich: Wandfarbe, Dachfarbe, Akzent
  klugheim: { wall: '#4a3322', roof: '#2a2a30', acc: '#ffb060', tex: 'wood' }, africa: { wall: '#7a5a38', roof: '#9a7a3a', acc: '#ffb040', tex: 'wood' },
  rookburgh: { wall: '#7a3c2c', roof: '#3a3e44', acc: '#ffa040', tex: 'brick' }, mexico: { wall: '#d8a070', roof: '#a85a30', acc: '#ffd070', tex: 'adobe' },
  fantasy: { wall: '#d890c0', roof: '#7a50b0', acc: '#ffe0a0', tex: 'plain' }, china: { wall: '#a8302a', roof: '#2a4a3a', acc: '#ffd060', tex: 'plain' },
  berlin: { wall: '#d8c8a0', roof: '#8a3a2a', acc: '#fff0c0', tex: 'plain' }, mystery: { wall: '#4a4a52', roof: '#2a2a30', acc: '#9ac0ff', tex: 'stone' },
};
const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...extra });

function wallMat(st, w, h) {
  if (st.tex === 'plain') return mat(st.wall);
  const t = (st.tex === 'wood' ? A.tex.planks(st.wall) : st.tex === 'brick' ? A.tex.brick() : st.tex === 'adobe' ? A.tex.adobe() : A.tex.stone()).clone();
  t.repeat.set(Math.max(1, w / 4), Math.max(1, h / 3)); t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, color: st.tex === 'adobe' ? new THREE.Color(st.wall) : 0xffffff });
}

// Zeichnet ein Schild (Menü-/Namensschild)
function signMesh(text, bg, w = 6, h = 1.5, sub = '') { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text, bg, '#ffffff', sub) })); return m; }

export function buildHall(world, poi, x, y, z, rot, opts = {}) {
  const st = STYLE[poi.zone] || STYLE.berlin, out = world.out, env = world.env;
  const w = opts.w || 12, d = opts.d || 9, h = opts.h || 4.2, kind = poi.kind;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const wm = wallMat(st, w, h);
  A.wallSet(g, w, d, h, 0.3, wm, true, out.colliders, x, z, rot);
  const roofM = mat(st.roof, { side: THREE.DoubleSide });
  const roof = new THREE.Mesh(gableGeometry(w, d, Math.min(w, d) * 0.4), roofM); roof.position.y = h; roof.castShadow = true; g.add(roof);
  const floor = A.box(g, w - 0.5, 0.1, d - 0.5, new THREE.MeshStandardMaterial({ map: A.tex.planks('#6a5038'), roughness: 1 }), 0, 0.05, 0); floor.castShadow = false;
  const win = A.M('win', () => { const m = new THREE.MeshStandardMaterial({ map: A.tex.window(), emissive: 0xffa040, emissiveMap: A.tex.window(), emissiveIntensity: 0.4, roughness: 0.6 }); env.registerLamp(m); return m; });
  A.windowsOn(g, w, d, h, 3, win, 2.0);
  const sign = signMesh(poi.name, '#' + new THREE.Color(st.roof).getHexString(), Math.min(8, w - 1), 1.3, kind === 'shop' ? 'Shop' : 'Restaurant'); sign.position.set(0, h + 0.9, d / 2 + 0.05); g.add(sign);
  const s2 = sign.clone(); s2.rotation.y = Math.PI; s2.position.z = -d / 2 - 0.05; g.add(s2);
  const wood = mat('#6a4a2a');
  if (kind === 'shop') {
    // Regale mit bunten Produkten, Kasse
    for (const sx of [-1, 1]) { A.box(g, 0.5, 2.2, d - 3, wood, sx * (w / 2 - 0.7), 1.1, -0.5); for (let k = 0; k < 14; k++) { const c = new THREE.Color().setHSL((k * 0.13) % 1, 0.6, 0.55); A.box(g, 0.4, 0.35, 0.5, mat(c), sx * (w / 2 - 0.9), 0.5 + (k % 4) * 0.5, -d / 2 + 2.2 + (k >> 2) * 1.3); } }
    A.box(g, 2.4, 1.0, 0.8, wood, 0, 0.5, -d / 2 + 1.2); A.box(g, 0.5, 0.35, 0.4, mat('#222'), 0.6, 1.15, -d / 2 + 1.2);
    A.box(g, 1.8, 0.8, 1.8, wood, 0, 0.45, 0.8); for (let k = 0; k < 5; k++) A.box(g, 0.4, 0.4, 0.4, mat(new THREE.Color().setHSL(k * 0.2, 0.7, 0.55)), -0.6 + k * 0.3, 0.95, 0.8);
  } else {
    // Theke + Tische mit Hockern
    A.box(g, w - 3, 1.0, 0.9, wood, 0, 0.5, -d / 2 + 1.0);
    for (let k = 0; k < 4; k++) { const tx = -w / 2 + 2.6 + (k % 2) * 4.2 + (k > 1 ? 0.8 : 0), tz = -0.4 + (k >> 1) * 2.8; A.box(g, 1.3, 0.1, 1.3, wood, tx, 0.8, tz); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6), wood); p.position.set(tx, 0.4, tz); g.add(p); for (const [dx, dz] of [[-1, 0], [1, 0]]) { const sto = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 8), wood); sto.position.set(tx + dx * 1.0, 0.3, tz + dz); g.add(sto); } }
    for (let k = 0; k < 5; k++) A.box(g, 0.2, 0.3, 0.2, mat(new THREE.Color().setHSL(k * 0.17, 0.5, 0.6)), -2 + k * 1, 1.15, -d / 2 + 1.0); // Becher
  }
  // Menütafel an der Wand
  const mb = signMesh('Speisekarte', '#222a30', 2.2, 1.4, 'Preise am Tresen'); mb.position.set(w / 2 - 0.2, 2.4, -d / 2 + 2); mb.rotation.y = -Math.PI / 2; g.add(mb);
  if (poi.id === 'r-klug') tavernDecor(world, g, w, d, h, out, x, y, z, rot); // dunkles Fachwerk, hängendes Schild, Fässer, rauchender Schornstein
  world.out.world.add(g);
  const c = Math.cos(rot), s = Math.sin(rot);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc070 })); lamp.position.set(0, h - 0.5, 0); g.add(lamp);
  out.lights.push({ x, y: y + h - 0.6, z, color: 0xffb060, int: 8, range: 14, flicker: 0.1, inside: true });
  out.glow.push([x, y + h - 0.6, z, 1, 0.7, 0.35, 26]);
  for (let k = 0; k < 3; k++) { const fx = -w / 2 + (k + 0.5) * w / 3; out.glow.push([x + fx * c + (d / 2 + 0.3) * s, y + 2, z - fx * s + (d / 2 + 0.3) * c, 1, 0.65, 0.3, 14]); }
  return { x: x + (d / 2 + 2.2) * s, z: z + (d / 2 + 2.2) * c, ex: x, ez: z, r: 5 };
}

export function buildStand(world, poi, x, y, z, rot) {
  const st = STYLE[poi.zone] || STYLE.berlin, out = world.out, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const wood = mat('#6a4a2a');
  A.box(g, 4.2, 1.1, 1.4, wood, 0, 0.55, 0); A.box(g, 4.4, 0.12, 1.8, mat('#d8d0c0'), 0, 1.16, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.8, 6), wood); p.position.set(sx * 2.0, 1.4, sz * 0.8); g.add(p); }
  const can = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.16, 2.4), new THREE.MeshStandardMaterial({ map: stripeTex(st.roof), roughness: 0.8 })); can.position.set(0, 2.9, 0); can.rotation.x = 0.12; can.castShadow = true; g.add(can);
  const sg = signMesh(poi.name, '#' + new THREE.Color(st.roof).getHexString(), 3.8, 0.9); sg.position.set(0, 3.45, 1.0); g.add(sg);
  A.box(g, 1.6, 0.9, 1.0, mat('#c8c8c8', { metalness: 0.6 }), 1.0, 0.45, -1.4); // Grill/Kühlung
  out.world.add(g); out.colliders.push({ x, z, hx: 2.2, hz: 0.9, rot, y0: 0, y1: 2.5 });
  const c = Math.cos(rot), s = Math.sin(rot);
  out.glow.push([x, y + 3.0, z, 1, 0.75, 0.4, 26], [x + 1.6 * c + 1.0 * s, y + 2.9, z - 1.6 * s + 1.0 * c, 1, 0.6, 0.3, 14], [x - 1.6 * c + 1.0 * s, y + 2.9, z + 1.6 * s + 1.0 * c, 1, 0.6, 0.3, 14]);
  out.lights.push({ x: x + 1.5 * s, y: y + 2.6, z: z + 1.5 * c, color: 0xffb060, int: 5, range: 11, flicker: 0.12 });
  // Tische davor
  for (let k = 0; k < 3; k++) { const tx = x + (-2.5 + k * 2.5) * c + 4.2 * s, tz = z - (-2.5 + k * 2.5) * s + 4.2 * c; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 10), wood); t.position.set(tx, y + 0.85, tz); world.group.add(t); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.85, 6), wood); p.position.set(tx, y + 0.42, tz); world.group.add(p); out.colliders.push({ x: tx, z: tz, r: 0.7, y0: 0, y1: 0.9 }); }
  return { x: x + 2.2 * s, z: z + 2.2 * c, ex: x, ez: z, r: 4 };
}
function stripeTex(col) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f0e4' : col; g.fillRect(i * 8, 0, 8, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildHotel(world, poi, x, y, z, rot) {
  const st = STYLE[poi.zone] || STYLE.berlin, out = world.out, env = world.env;
  const w = 32, d = 18, hG = 4.4, hT = 15, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  if (out.flatten) out.flatten(x, z, w / 2 + 2, d / 2 + 2, rot, y); // Mulden unter dem Hotel einebnen
  const wm = wallMat(st, w, hT);
  A.wallSet(g, w, d, hG, 0.4, wm, true, out.colliders, x, z, rot, y);
  const upper = A.box(g, w, hT - hG, d, wm, 0, hG + (hT - hG) / 2, 0);
  out.colliders.push({ x, z, hx: w / 2, hz: d / 2, rot, y0: y + hG, y1: y + hT });
  const roof = new THREE.Mesh(gableGeometry(w + 1, d + 1, 5), mat(st.roof, { side: THREE.DoubleSide })); roof.position.y = hT; roof.castShadow = true; g.add(roof);
  A.box(g, w - 0.5, 0.1, d - 0.5, new THREE.MeshStandardMaterial({ map: A.tex.planks('#7a6a58'), roughness: 0.9, color: 0xd8d0c0 }), 0, 0.05, 0);
  // Eingangsbereich: Lobby
  const wood = mat('#5a3a22'), cloth = mat(new THREE.Color(st.acc).multiplyScalar(0.6));
  A.box(g, 8, 1.1, 1.2, wood, 0, 0.55, -d / 2 + 2.5); A.box(g, 8.4, 0.15, 1.5, mat('#d8c8a0'), 0, 1.15, -d / 2 + 2.5);
  for (const sx of [-1, 1]) { A.box(g, 3, 0.5, 1.2, cloth, sx * 9, 0.3, 1.5); A.box(g, 3, 0.9, 0.3, cloth, sx * 9, 0.75, 2.0); A.box(g, 1.2, 0.5, 1.2, cloth, sx * 9, 0.3, 4); const pl = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 7), mat('#2a6a30')); pl.position.set(sx * 13.5, 0.9, -2); g.add(pl); }
  const lift = A.box(g, 3.2, 3.6, 0.2, mat('#9aa0a8', { metalness: 0.7, roughness: 0.35 }), w / 2 - 3, 1.8, -d / 2 + 0.7);
  const rg = A.box(g, 2.5, 1.2, 0.1, new THREE.MeshBasicMaterial({ color: 0xffd890 }), 0, 3.4, -d / 2 + 0.6);
  const sign = signMesh(poi.name, '#' + new THREE.Color(st.roof).getHexString(), 14, 2.4, 'Hotel'); sign.position.set(0, hT + 1.2, d / 2 + 0.2); g.add(sign);
  const s2 = sign.clone(); s2.rotation.y = Math.PI; s2.position.z = -d / 2 - 0.2; g.add(s2);
  const sty = hotelStyle(world, poi, g, w, d, hG, hT, out); // Ling Bao (Palast), Matamba (Lodge), Charles Lindbergh (Flieger-Hotel)
  if (sty) { roof.visible = false; sign.position.y = s2.position.y = sty.signY; }
  // Fenster der Zimmer (leuchtend)
  const win = A.M('hwin', () => { const m = new THREE.MeshStandardMaterial({ color: 0x221510, emissive: 0xffc070, emissiveIntensity: 0.3 }); env.registerLamp(m); return m; });
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let fl = 0; fl < 3; fl++) for (let k = 0; k < 9; k++) {
    const fx = -w / 2 + 2 + k * 3.5, fy = hG + 1.8 + fl * 3.2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), win); m.position.set(fx, fy, d / 2 + 0.03); g.add(m); const m2 = m.clone(); m2.position.z = -d / 2 - 0.03; m2.rotation.y = Math.PI; g.add(m2);
    if ((k + fl) % 3 !== 1) out.glow.push([x + fx * c + (d / 2 + 0.4) * s, y + fy, z - fx * s + (d / 2 + 0.4) * c, 1, 0.72, 0.38, 16]);
  }
  // Flur im Erdgeschoss mit Zimmertüren
  for (let k = 0; k < 6; k++) A.box(g, 1.1, 2.1, 0.1, wood, -w / 2 + 3 + k * 2.6, 1.05, -d / 2 + 0.55);
  out.world.add(g);
  out.lights.push({ x, y: y + 3.6, z, color: 0xffc080, int: 10, range: 22, flicker: 0.05, inside: true }, { x: x + (d / 2 + 3) * s, y: y + 2.5, z: z + (d / 2 + 3) * c, color: 0xffb060, int: 7, range: 16, flicker: 0.1 });
  out.glow.push([x, y + 3.6, z, 1, 0.75, 0.4, 40], [x + (d / 2 + 1) * s, y + hT + 1.2, z + (d / 2 + 1) * c, 1, 0.8, 0.5, 60]);
  return { x: x + (d / 2 + 4) * s, z: z + (d / 2 + 4) * c, ex: x, ez: z, r: 8, hotel: true };
}

export function buildStage(world, poi, x, y, z, rot) {
  const st = STYLE[poi.zone] || STYLE.berlin, out = world.out, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const wood = mat('#3a2a20');
  A.box(g, 16, 1.2, 8, wood, 0, 0.6, 0); A.box(g, 16, 7, 0.6, mat(st.roof), 0, 4.7, -3.8);
  for (const sx of [-1, 1]) A.box(g, 0.8, 8, 0.8, mat('#2a2a30', { metalness: 0.7 }), sx * 7.8, 4, 3.6);
  A.box(g, 16.6, 0.8, 0.8, mat('#2a2a30', { metalness: 0.7 }), 0, 8.2, 3.6);
  const sg = signMesh(poi.name, '#' + new THREE.Color(st.roof).getHexString(), 8, 1.4, 'Bühne'); sg.position.set(0, 6.4, -3.45); g.add(sg);
  for (let r = 0; r < 4; r++) for (let k = -3; k <= 3; k++) A.box(g, 1.6, 0.4, 0.7, wood, k * 2.2, 0.35, 8 + r * 2);
  out.world.add(g); out.colliders.push({ x, z, hx: 8, hz: 4, rot, y0: 0, y1: 1.2 });
  const c = Math.cos(rot), s = Math.sin(rot);
  // Scheinwerfer (animierte Sprites)
  poi.spots = [];
  for (let k = 0; k < 6; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.cloud(), color: new THREE.Color().setHSL(k / 6, 0.9, 0.6), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    const lx = -6 + k * 2.4; sp.scale.set(10, 10, 1); sp.position.set(x + lx * c + 3.4 * s, y + 7.8, z - lx * s + 3.4 * c); world.group.add(sp); poi.spots.push(sp);
  }
  out.lights.push({ x: x + 2 * s, y: y + 5, z: z + 2 * c, color: 0xffd8a0, int: 12, range: 24, flicker: 0.05 });
  return { x: x + 12 * s, z: z + 12 * c, ex: x, ez: z, r: 10 };
}

// Fahrgeschäft zum Mitfahren (Pferdekarussell, Wellenflug, Tittle Tattle Tree)
export function buildFlat(world, poi, x, y, z, rot) {
  const f = new FlatRide(world, poi, poi.flat, x, y, z, rot); poi.flatRide = f;
  if (world.out.flatten) world.out.flatten(x, z, f.radius, f.radius, 0, y);
  const d = f.radius + 3;
  return { x: x + d * Math.sin(rot), z: z + d * Math.cos(rot), ex: x, ez: z, r: 7 };
}

// Adventure Trail (Deep in Africa): Holzportal am Start, dazu Wegpunkt-Pfosten mit leuchtender Kugel rund um den Start. Die Tour selbst läuft in pl_game.js (E am Portal).
export function buildTrail(world, poi, x, y, z, rot) {
  const out = world.out, env = world.env, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const wood = new THREE.MeshStandardMaterial({ map: A.tex.planks('#5a3a22'), roughness: 0.95 }), rope = mat('#c8b080');
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 5.2, 8), wood); p.position.set(sx * 3.2, 2.6, 0); p.castShadow = true; g.add(p); const mask = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), mat('#8a2a1a')); mask.position.set(sx * 3.2, 4.4, 0.3); g.add(mask); const eye = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd040 })); eye.position.set(sx * 3.2, 4.5, 0.58); g.add(eye); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.5, 0.6), wood); bar.position.set(0, 5.1, 0); g.add(bar);
  for (let k = 0; k < 7; k++) { const r = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), rope); r.position.set(-3 + k, 4.6, 0.1); g.add(r); }
  const sg = signMesh('Adventure Trail', '#5a3a1a', 4.6, 1.1, 'Wegpunkt-Tour · E'); sg.position.set(0, 3.9, 0.35); g.add(sg);
  const lamp = A.M('trailtorch', () => { const m = new THREE.MeshStandardMaterial({ color: 0x331a08, emissive: 0xff8a30, emissiveIntensity: 0 }); env.registerLamp(m); return m; });
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), lamp); f.position.set(sx * 3.2, 5.6, 0); g.add(f); }
  out.world.add(g); for (const sx of [-1, 1]) out.colliders.push({ x: x + sx * 3.2 * Math.cos(rot), z: z - sx * 3.2 * Math.sin(rot), r: 0.45, y0: y, y1: y + 5 });
  out.glow.push([x, y + 5.6, z, 1, 0.55, 0.2, 26]); out.lights.push({ x: x + 2 * Math.sin(rot), y: y + 4.4, z: z + 2 * Math.cos(rot), color: 0xff9a40, int: 5, range: 14, flicker: 0.3 });
  // Wegpunkte: Ring um den Start (Abstand 40–110 m), nur auf freiem, nicht zu tiefem Boden, mind. 28 m Abstand zueinander
  const n = poi.cps || 5, pts = [], orbM = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, roughness: 0.3 });
  for (let t = 0; t < 900 && pts.length < n; t++) {
    const a = world.R(0, TAU), r = world.R(40, 115), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, py = world.h(px, pz);
    if (py < -0.3 || !world.occFree(px, pz, 4) || world.nearTrackFast(px, pz, 5, 9) || pts.some(q => Math.hypot(q.x - px, q.z - pz) < 28)) continue;
    world.grid.mark(px, pz, 4); pts.push({ x: px, z: pz, y: Math.max(0.05, py) });
  }
  poi.cpsList = pts.map(q => { const cg = new THREE.Group(); cg.position.set(q.x, q.y, q.z); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.2, 7), wood); post.position.y = 1.6; cg.add(post); const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), orbM(0xffb030)); orb.position.y = 3.7; cg.add(orb); cg.userData.noMerge = true; out.world.add(cg); out.glow.push([q.x, q.y + 3.7, q.z, 1, 0.7, 0.2, 22]); out.colliders.push({ x: q.x, z: q.z, r: 0.3, y0: q.y, y1: q.y + 3 }); return { x: q.x, z: q.z, y: q.y, orb, done: false }; });
  return { x: x + 4 * Math.sin(rot), z: z + 4 * Math.cos(rot), ex: x, ez: z, r: 5 };
}

export function buildWC(world, poi, x, y, z, rot) {
  const out = world.out, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  A.box(g, 5, 3, 4, mat('#9aa0a4'), 0, 1.5, 0); A.box(g, 5.4, 0.3, 4.4, mat('#4a4e54'), 0, 3.1, 0);
  const sg = signMesh('WC', '#2a5a8a', 1.6, 0.8); sg.position.set(0, 2.2, 2.05); g.add(sg);
  out.world.add(g); out.colliders.push({ x, z, hx: 2.5, hz: 2, rot, y0: 0, y1: 3 }); out.glow.push([x + 2.5 * Math.sin(rot), y + 2.4, z + 2.5 * Math.cos(rot), 0.6, 0.8, 1, 16]);
  return { x: x + 4 * Math.sin(rot), z: z + 4 * Math.cos(rot), ex: x, ez: z, r: 4 };
}

// Platziert alle POIs; gibt Liste interaktiver Punkte zurück
export function placePOIs(world) {
  const pois = [];
  for (const def of POIS) {
    const key = def.zone; let done = false;
    const maker = (x, y, z, rot, force) => {
      const clear = force || (def.kind === 'hotel' ? 14 : def.kind === 'stage' ? 18 : def.kind === 'flat' || def.kind === 'trail' ? 12 : def.kind === 'restaurant' || def.kind === 'shop' ? 12 : 8);
      if (!(world.occFree ? world.occFree(x, z, clear) : world.grid.free(x, z, clear))) return false;
      const poi = { ...def };
      const f = def.kind === 'hotel' ? buildHotel : def.kind === 'stage' ? buildStage : def.kind === 'flat' ? buildFlat : def.kind === 'trail' ? buildTrail : def.kind === 'wc' ? buildWC : def.kind === 'stand' ? buildStand : buildHall;
      const r = f(world, poi, x, y, z, rot);
      Object.assign(poi, { x: r.ex, z: r.ez, ax: r.x, az: r.z, r: r.r, y: y, rot });
      pois.push(poi); done = true; return true;
    };
    // Hotels und Mitfahr-Attraktionen: spiralförmige Suche um den Wunschort (Standard: Mitte der Themenwelt), Vorderseite zum nächsten Weg
    if (def.kind === 'hotel' || def.at) {
      const zn = world.zones[key] || { x: 0, z: 60, r: 120 }, at = def.at || [zn.x, zn.z], clear = def.kind === 'hotel' ? 12 : def.kind === 'flat' ? ({ carousel: 10, wave: 12, tree: 11 }[def.flat] || 12) : 12, rMax = def.kind === 'hotel' ? zn.r * 1.35 : 110, trk = def.kind === 'hotel' ? 11 : clear - 1, yMin = def.kind === 'hotel' || def.kind === 'flat' ? -3 : -0.4; // tiefe Mulden werden eingeebnet (Wasserflächen sind vorher im Raster belegt)
      for (let r = 0; r <= rMax && !done; r += 5) for (let k = 0, n = Math.max(1, Math.round(r / 5) * 6); k < n && !done; k++) {
        const a = k / n * TAU + r * 0.37, x = at[0] + Math.cos(a) * r, z = at[1] + Math.sin(a) * r, y0 = world.h(x, z), y = Math.max(y0, 0.05);
        if (y0 < yMin || !world.occFree(x, z, clear) || world.nearTrackFast(x, z, trk, 9) || world.nearTrackFast(x, z, clear * 0.55 + 2, 90) || world.nearStation(x, z)) continue;
        let bn = null, bd = 1e9; for (const nd of world.nodes) { const d = (nd.x - x) ** 2 + (nd.z - z) ** 2; if (d < bd) { bd = d; bn = nd; } }
        if (maker(x, y, z, bn ? Math.atan2(bn.x - x, bn.z - z) : 0, clear)) world.grid.mark(x, z, clear);
      }
    }
    if (!done) world.alongPaths(key, 1, (x, y, z, rot) => maker(x, y, z, rot), def.kind === 'flat' ? 14 : def.kind === 'hotel' ? 16 : def.kind === 'restaurant' || def.kind === 'shop' ? 11 : 7);
    for (const [zk, minR, maxF] of [[key, 15, 1.4], [key, 15, 2.2], ['berlin', 40, 1.3]]) {
      if (done) break;
      const zn = world.zones[zk] || { x: 0, z: 60, r: 120 };
      world.scatter(zk in world.zones ? zk : 'berlin', 1, minR, zn.r * maxF, (x, y, z, rot) => maker(x, y, z, rot), 6, 500);
    }
  }
  return pois;
}
