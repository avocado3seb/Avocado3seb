// Gastronomie, Shops, Hotels, Bühnen, Toiletten als begehbare Gebäude + Interaktionspunkte
import * as THREE from 'three';
import { signTexture, textures } from './textures.js';
import { gableGeometry } from './park.js';
import * as A from './pl_assets.js';
import { POIS, ZONE_OF_AREA } from './pl_data.js';

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
  const wm = wallMat(st, w, hT);
  A.wallSet(g, w, d, hG, 0.4, wm, true, out.colliders, x, z, rot);
  const upper = A.box(g, w, hT - hG, d, wm, 0, hG + (hT - hG) / 2, 0);
  out.colliders.push({ x, z, hx: w / 2, hz: d / 2, rot, y0: hG, y1: hT });
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
    const maker = (x, y, z, rot) => {
      const clear = def.kind === 'hotel' ? 22 : def.kind === 'stage' ? 18 : def.kind === 'restaurant' || def.kind === 'shop' ? 12 : 8;
      if (!world.grid.free(x, z, clear)) return false;
      const poi = { ...def };
      const f = def.kind === 'hotel' ? buildHotel : def.kind === 'stage' ? buildStage : def.kind === 'wc' ? buildWC : def.kind === 'stand' ? buildStand : buildHall;
      const r = f(world, poi, x, y, z, rot);
      Object.assign(poi, { x: r.ex, z: r.ez, ax: r.x, az: r.z, r: r.r, y: y, rot });
      pois.push(poi); done = true; return true;
    };
    world.alongPaths(key, 1, maker, def.kind === 'hotel' ? 18 : def.kind === 'restaurant' || def.kind === 'shop' ? 11 : 7);
    for (const [zk, minR, maxF] of [[key, 15, 1.4], [key, 15, 2.2], ['berlin', 40, 1.3]]) {
      if (done) break;
      const zn = world.zones[zk] || { x: 0, z: 60, r: 120 };
      world.scatter(zk in world.zones ? zk : 'berlin', 1, minR, zn.r * maxF, (x, y, z, rot) => maker(x, y, z, rot), 6, 500);
    }
  }
  return pois;
}
