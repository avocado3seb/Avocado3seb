// ============================================================================
//  pl_worlds2.js – weitere Themenwelt-Bauten (stilisiert): China Town (Paifang-Tor, Bambus, Kirschbäume), Fantasy/Wuze Town (Figuren, Pilze),
//  Fassaden der Fahrgeschäfte (Talocan/Tikal-Pyramiden, schiefes Hotel Tartüff, Torten-Fassade Maus au Chocolat, Mausketiere-Tor, Würmling),
//  Hotel-Stile (Ling Bao, Matamba, Charles Lindbergh) und Rutmor's Taverne.
// ============================================================================
import * as THREE from 'three';
import * as A from './pl_assets.js';
import * as H from './pl_houses.js';
import * as T from './pl_tex.js';
import { signTexture } from './textures.js';
import { gableGeometry } from './park.js';
import { around, onPath } from './pl_worlds.js';
import { SUBAREAS } from './pl_data.js';

const TAU = Math.PI * 2;
const std = (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...e });
const mesh = (geo, mat, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; };
const Q = w => ({ low: 0.45, medium: 0.8, high: 1.25 }[w.quality] || 0.8);
const lampMat = (env, key, color, emissive) => A.M(key, () => { const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0, roughness: 0.5 }); env.registerLamp(m); return m; });

// ---------------------------------------------------------------- China Town
export function chinaExtras(world) {
  const zn = world.zones.china, out = world.out, G = world.group, env = world.env, k = Q(world);
  // Paifang (Ehrentor) über dem Hauptweg am Zonenrand
  let best = null, bd = 1e9; for (const n of world.nodes) { const d = Math.hypot(n.x - zn.x, n.z - zn.z); if (d < bd) { bd = d; best = n; } }
  if (best) {
    let dx = 0, dz = 1, bl = 1e9; for (const [a, b] of world.edges) { const A_ = world.nodes[a], B_ = world.nodes[b]; if (A_ !== best && B_ !== best) continue; const o = A_ === best ? B_ : A_, L = Math.hypot(o.x - best.x, o.z - best.z); if (L > 8 && L < bl) { bl = L; dx = (o.x - best.x) / L; dz = (o.z - best.z) / L; } }
    const px = best.x + dx * 9, pz = best.z + dz * 9, y = Math.max(0.05, world.h(px, pz)), g = new THREE.Group(); g.position.set(px, y, pz); g.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
    const red = std('#a8302a', { map: T.rep(T.plasterTex('#a8302a'), 1, 3) }), gold = std('#d8a82a', { metalness: 0.75, roughness: 0.35 }), roof = new THREE.MeshStandardMaterial({ map: T.rep(T.glazedTex(), 3, 2), roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide });
    for (const sx of [-4.6, 4.6]) { g.add(mesh(new THREE.CylinderGeometry(0.45, 0.5, 7, 12), red, sx, 3.5, 0), mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), std('#8a8478', { map: A.tex.stone() }), sx, 0.25, 0)); out.colliders.push({ x: px + sx * Math.cos(g.rotation.y), z: pz - sx * Math.sin(g.rotation.y), r: 0.7, y0: y, y1: y + 7 }); }
    g.add(mesh(new THREE.BoxGeometry(11.4, 0.7, 0.8), red, 0, 6.3, 0), mesh(new THREE.BoxGeometry(11.6, 0.25, 0.95), gold, 0, 6.72, 0, false), mesh(T.curvedRoofGeo(12, 3.4, 1.7, 0.8), roof, 0, 6.8, 0));
    for (const sx of [-4.6, 4.6]) g.add(mesh(T.curvedRoofGeo(3.2, 2.8, 1.2, 0.6), roof, sx, 7.0, 0));
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: signTexture('China Town', '#8a1a14', '#f4d880') })); sg.position.set(0, 5.4, 0.45); g.add(sg); const s2 = sg.clone(); s2.rotation.y = Math.PI; s2.position.z = -0.45; g.add(s2);
    const lan = lampMat(env, 'chlantern', 0xd02a1a, 0xff3a1a); for (const sx of [-2.6, 0, 2.6]) { const l = mesh(new THREE.SphereGeometry(0.38, 10, 8), lan, sx, 5.4 - 0.9 * (sx === 0 ? 0 : 1) - 0.4, 0.6, false); l.scale.y = 1.25; g.add(l); }
    out.world.add(g); out.glow.push([px, y + 5, pz, 1, 0.3, 0.15, 24]); world.paifang = { x: px, z: pz, y };
  }
  // Bambushaine
  const stem = new THREE.CylinderGeometry(0.09, 0.12, 1, 6); stem.translate(0, 0.5, 0);
  const bam = new A.Inst(stem, std('#5a9a3a', { roughness: 0.6 }), 420, G, { shadow: true }), cap = new A.Inst(new THREE.IcosahedronGeometry(0.5, 0), std('#4a8a30'), 420, G);
  around(world, zn.x, zn.z, zn.r * 1.1, Math.round(9 * k) + 3, 5, (x, y, z) => { const n = 14 + Math.floor(world.rng() * 10); for (let i = 0; i < n; i++) { const a = world.R(0, TAU), r = Math.sqrt(world.rng()) * 3.2, bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, h = world.R(4, 8); bam.add(bx, world.h(bx, bz), bz, 1, h, 1, 0, null, world.R(-0.05, 0.05), world.R(-0.05, 0.05)); cap.add(bx, world.h(bx, bz) + h, bz, 0.9, 1.6, 0.9, world.R(0, TAU)); } out.colliders.push({ x, z, r: 2.4, y0: y, y1: y + 6 }); }, 0, 40, true);
  bam.done(); cap.done(); world.bambooCount = bam.mesh.count;
  // Kirschbäume (rosa Kronen, eigene Instanzen)
  {
    const tg = new THREE.CylinderGeometry(0.28, 0.5, 1, 7); tg.translate(0, 0.5, 0); const cg = new THREE.IcosahedronGeometry(1, 1); cg.translate(0, 0.7, 0); const pink = ['#f4a8c0', '#f8bcd0', '#ee94b4', '#fad0dc'];
    const trunks = new A.Inst(tg, std('#4a3524', { roughness: 1 }), 120, G, { shadow: true }), crowns = new A.Inst(cg, std('#ffffff', { roughness: 0.9 }), 400, G, { shadow: true });
    around(world, zn.x, zn.z, zn.r * 1.05, Math.round(22 * k) + 4, 3.6, (x, y, z) => { const s = world.R(0.9, 1.5); trunks.add(x, y, z, s * 0.7, 3.2 * s, s * 0.7, 0); for (let q = 0; q < 3; q++) crowns.add(x + world.R(-1, 1) * s, y + (2.6 + q * 0.5) * s, z + world.R(-1, 1) * s, (2.6 - q * 0.3) * s, 2.0 * s, (2.6 - q * 0.3) * s, world.R(0, TAU), pink[(q + Math.floor(Math.abs(x))) & 3]); out.colliders.push({ x, z, r: 0.5, y0: y, y1: y + 4 }); }, 0, 40, true);
    trunks.done(); crowns.done(); world.cherryCount = trunks.mesh.count;
  }
}

// ---------------------------------------------------------------- Fantasy & Wuze Town
function wuzeFigure(rng, col) {
  const g = new THREE.Group(), m = std(col, { roughness: 0.45 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff }), black = new THREE.MeshBasicMaterial({ color: 0x151520 }), neon = new THREE.MeshStandardMaterial({ color: 0xffe060, emissive: 0xffd040, emissiveIntensity: 0.6 });
  const body = mesh(new THREE.SphereGeometry(0.8, 16, 12), m, 0, 1.0, 0); body.scale.set(1, 1.2, 0.95); g.add(body);
  for (const sx of [-1, 1]) { g.add(mesh(new THREE.SphereGeometry(0.26, 10, 8), white, sx * 0.32, 1.45, 0.62, false), mesh(new THREE.SphereGeometry(0.12, 8, 6), black, sx * 0.32, 1.45, 0.8, false)); const arm = mesh(new THREE.SphereGeometry(0.22, 8, 6), m, sx * 0.85, 0.95, 0.1); arm.scale.set(0.8, 1.3, 0.8); g.add(arm); const ft = mesh(new THREE.SphereGeometry(0.3, 8, 6), m, sx * 0.38, 0.12, 0.2); ft.scale.set(1.2, 0.5, 1.5); g.add(ft); const ant = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), black, sx * 0.3, 2.35, 0, false); ant.rotation.z = -sx * 0.25; g.add(ant, mesh(new THREE.SphereGeometry(0.12, 8, 6), neon, sx * 0.44, 2.75, 0, false)); }
  const mouth = mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 12, Math.PI), black, 0, 1.1, 0.74, false); mouth.rotation.z = Math.PI; g.add(mouth);
  return g;
}
export function fantasyExtras(world) {
  const sub = SUBAREAS.find(s => s.key === 'wuze'), zn = world.zones.fantasy, out = world.out, G = world.group, env = world.env, k = Q(world);
  // Wuze Town: runde Neonbauten um den Platz mit dem Tittle Tattle Tree
  const tree = world.pois.find(p => p.flatRide && p.flat === 'tree'), cx = tree ? tree.x : sub.x, cz = tree ? tree.z : sub.z; let nh = 0;
  // die Senke zu einem flachen Stadtboden einebnen (die Mulde ist nur 1–2 m tief; Wege und Gleise liegen dort bereits auf ca. 0 m)
  if (out.flatten) out.flatten(cx, cz, 50, 50, 0, 0.05, 16);
  nh += around(world, cx, cz, 66, Math.round(11 * k) + 4, 6.4, (x, y, z, rot) => { H.wuzeHouse(world.prng, x, y, z, rot, env, out); }, 15);
  // Wuze-Figuren als Skulpturen rund um den Baum (wippen leicht)
  const pals = ['#f48ab8', '#7ad8f0', '#f8e070', '#a8e870', '#c0a0f8', '#f8a870', '#70e8c8'], figs = [];
  around(world, cx, cz, 34, 12, 2.6, (x, y, z, rot) => { const f = wuzeFigure(world.rng, pals[figs.length % pals.length]); f.position.set(x, y, z); f.rotation.y = rot + world.R(-0.5, 0.5); const s = world.R(1.0, 1.7); f.scale.setScalar(s); f.userData.noMerge = true; out.world.add(f); out.colliders.push({ x, z, r: 0.9 * s, y0: y, y1: y + 3 * s }); figs.push([f, y, world.R(0, TAU)]); out.glow.push([x, y + 2.8 * s, z, 1, 0.85, 0.3, 10]); }, 9);
  world.anims.push(() => { for (const [f, y, ph] of figs) f.position.y = y + Math.abs(Math.sin(world.time * 2.2 + ph)) * 0.18; });
  // Neon-Schild "Wuze Town" auf zwei Masten
  around(world, cx, cz, 70, 1, 4, (x, y, z, rot) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; for (const sx of [-3, 3]) g.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 7, 8), std('#e8e0f0', { metalness: 0.4 }), sx, 3.5, 0)); const sg = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.9), new THREE.MeshBasicMaterial({ map: signTexture('Wuze Town', '#5a2ad0', '#ffe8ff', 'Fantasy') })); sg.position.set(0, 6.6, 0.05); g.add(sg); const s2 = sg.clone(); s2.rotation.y = Math.PI; s2.position.z = -0.05; g.add(s2); out.world.add(g); out.colliders.push({ x: x + 3 * Math.cos(rot), z: z - 3 * Math.sin(rot), r: 0.4, y0: y, y1: y + 7 }, { x: x - 3 * Math.cos(rot), z: z + 3 * Math.sin(rot), r: 0.4, y0: y, y1: y + 7 }); out.glow.push([x, y + 6.6, z, 0.7, 0.4, 1, 30]); }, 12);
  // Riesenpilze und -blumen im ganzen Fantasy-Gebiet
  const stem = new THREE.CylinderGeometry(0.3, 0.45, 1, 8); stem.translate(0, 0.5, 0);
  const stems = new A.Inst(stem, std('#f4ecd8'), 80, G, { shadow: true }), caps = new A.Inst(new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: T.spotsTex('#d8405a'), roughness: 0.6, color: 0xffffff }), 80, G, { shadow: true });
  const capCols = ['#ffffff', '#ffd0d8', '#d8f0ff', '#fff0b8'];
  around(world, zn.x, zn.z, zn.r * 1.1, Math.round(26 * k) + 6, 3.6, (x, y, z) => { const s = world.R(0.8, 2.2); stems.add(x, y, z, s, s * 2.1, s, 0); caps.add(x, y + s * 2.0, z, s * 1.7, s * 1.1, s * 1.7, world.R(0, TAU), capCols[Math.floor(world.rng() * 4)]); out.colliders.push({ x, z, r: 0.5 * s + 0.2, y0: y, y1: y + 2.2 * s }); });
  stems.done(); caps.done();
  world.wuzeCount = nh;
}

// ---------------------------------------------------------------- Fassaden der Fahrgeschäfte
function pyramid(world, x, y, z, rot, steps, base, opts = {}) {
  const out = world.out, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; const st = new THREE.MeshStandardMaterial({ map: T.rep(T.stoneTintTex(opts.tint || '#9a8f78'), 3, 1), roughness: 0.95 }), glyph = new THREE.MeshStandardMaterial({ map: T.rep(T.glyphTex(), 3, 1), roughness: 0.9 });
  const sh = opts.stepH || 2.4; let w = base; for (let i = 0; i < steps; i++) { const m = [st, st, st, st, i % 2 ? glyph : st, st]; g.add(mesh(new THREE.BoxGeometry(w, sh, w), m, 0, sh / 2 + i * sh, 0)); w -= base / (steps + 1.2); }
  const topY = steps * sh, tw = Math.max(3, w + 0.5); g.add(mesh(new THREE.BoxGeometry(tw, 2.8, tw), st, 0, topY + 1.4, 0), mesh(new THREE.BoxGeometry(tw + 0.8, 0.5, tw + 0.8), st, 0, topY + 3.05, 0));
  for (let i = 0; i < Math.min(steps, 9); i++) g.add(mesh(new THREE.BoxGeometry(3.2, sh * 0.5, 1.2), st, 0, sh * 0.25 + i * sh, base / 2 - i * (base / (steps + 1.2)) / 2 + 0.4)); // Freitreppe
  const door = mesh(new THREE.BoxGeometry(1.6, 2.0, 0.2), std('#1a1208'), 0, topY + 1.0, tw / 2 + 0.05, false); g.add(door);
  const fire = new THREE.MeshStandardMaterial({ color: 0xff7a20, emissive: 0xff6a10, emissiveIntensity: 1.4 }); for (const sx of [-1, 1]) { g.add(mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.6, 8), std('#3a3a3e'), sx * 2.2, topY + 3.5, tw / 2 - 0.4, false), mesh(new THREE.ConeGeometry(0.32, 0.9, 7), fire, sx * 2.2, topY + 4.2, tw / 2 - 0.4, false)); }
  out.world.add(g); out.colliders.push({ x, z, hx: base / 2, hz: base / 2, rot, y0: y, y1: y + topY }); const gl = (lx, lz, yy, c, s, ii) => { const cc = Math.cos(rot), ss = Math.sin(rot); out.glow.push([x + lx * cc + lz * ss, y + yy, z - lx * ss + lz * cc, c[0], c[1], c[2], s]); };
  for (const sx of [-1, 1]) gl(sx * 2.2, tw / 2 - 0.4, topY + 4.2, [1, 0.5, 0.15], 22); const cc = Math.cos(rot), ss = Math.sin(rot); out.lights.push({ x: x + 2.2 * cc + (tw / 2) * ss, y: y + topY + 4, z: z - 2.2 * ss + (tw / 2) * cc, color: 0xff8a30, int: 7, range: 18, flicker: 0.3 });
}
function crookedHotel(world, x, y, z, rot) {
  const out = world.out, rng = world.rng, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; const cols = ['#d8708a', '#e8b050', '#70b8d8', '#a8d870'], win = lampMat(world.env, 'crookwin', 0x20182a, 0xffd080);
  let yy = 0, off = 0; const floors = 6; for (let i = 0; i < floors; i++) { const w = 13 - i * 0.6, h = 3.3, tilt = (rng() - 0.5) * 0.16; off += (rng() - 0.5) * 1.6; const fl = mesh(new THREE.BoxGeometry(w, h, 8.5), std(cols[i % cols.length], { roughness: 0.7 }), off, yy + h / 2, 0); fl.rotation.z = tilt; fl.rotation.y = (rng() - 0.5) * 0.06; g.add(fl);
    for (let q = 0; q < 3; q++) { const wd = new THREE.Mesh(new THREE.PlaneGeometry(1.1 + rng() * 0.5, 1.2 + rng() * 0.5), win); wd.position.set(off + (q - 1) * 3.4, yy + h / 2 + (rng() - 0.5) * 0.4, 4.3); wd.rotation.z = tilt + (rng() - 0.5) * 0.2; g.add(wd); }
    yy += h * 0.97; }
  const roof = mesh(new THREE.ConeGeometry(8.5, 5, 4), std('#6a2a8a'), off, yy + 2.5, 0); roof.rotation.y = Math.PI / 4; roof.rotation.z = 0.07; g.add(roof);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.5), new THREE.MeshBasicMaterial({ map: signTexture('Hotel Tartüff', '#8a1a5a', '#ffe0a0', 'ganz normales Hotel') })); sg.position.set(0, 4.2, 4.5); sg.rotation.z = -0.08; g.add(sg);
  out.world.add(g); out.colliders.push({ x, z, hx: 7, hz: 4.5, rot, y0: y, y1: y + 20 }); out.glow.push([x, y + 4, z, 1, 0.6, 0.8, 24]);
}
function cakeFacade(world, x, y, z, rot) {
  const out = world.out, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; g.scale.setScalar(1.45); const layers = [['#e8a0b8', 6.4], ['#7a4a2a', 5.0], ['#fff0d8', 3.8]], cream = std('#fff6e8', { roughness: 0.4 });
  let yy = 0; layers.forEach(([c, r], i) => { g.add(mesh(new THREE.CylinderGeometry(r, r, 3.4, 28), std(c, { roughness: 0.5 }), 0, yy + 1.7, 0)); const rim = mesh(new THREE.TorusGeometry(r, 0.32, 8, 32), cream, 0, yy + 3.4, 0); rim.rotation.x = Math.PI / 2; g.add(rim); for (let q = 0; q < 14; q++) { const a = q / 14 * TAU; g.add(mesh(new THREE.ConeGeometry(0.28, 1.2, 6), cream, Math.cos(a) * (r + 0.05), yy + 3.0, Math.sin(a) * (r + 0.05), false)); } yy += 3.4; });
  g.add(mesh(new THREE.SphereGeometry(0.9, 12, 10), std('#c0182a', { roughness: 0.3 }), 0, yy + 0.9, 0));
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.6), new THREE.MeshBasicMaterial({ map: signTexture('Maus au Chocolat', '#5a2a1a', '#ffd8a0', 'Tortenfabrik') })); sg.position.set(0, 1.9, 6.5); g.add(sg);
  for (const sx of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(1.5, 12, 10), std('#e8d0c0'), sx * 2.2, yy + 1.0, 0), mesh(new THREE.SphereGeometry(0.9, 10, 8), std('#e89ab0'), sx * 2.2, yy + 1.0, 0.9)); // Mäuseohren
  out.world.add(g); out.colliders.push({ x, z, r: 9.6, y0: y, y1: y + 16 }); out.glow.push([x, y + 7, z, 1, 0.75, 0.5, 36]);
}
function musketeerGate(world, x, y, z, rot) {
  const out = world.out, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; const st = std('#b8a888', { map: A.tex.stone() }), blue = std('#1f3a8a'), gold = std('#d8b040', { metalness: 0.7, roughness: 0.35 });
  for (const sx of [-4.5, 4.5]) { g.add(mesh(new THREE.CylinderGeometry(1.5, 1.7, 9, 12), st, sx, 4.5, 0), mesh(new THREE.ConeGeometry(2.1, 3, 12), blue, sx, 10.5, 0)); out.colliders.push({ x: x + sx * Math.cos(rot), z: z - sx * Math.sin(rot), r: 1.8, y0: y, y1: y + 9 }); }
  g.add(mesh(new THREE.BoxGeometry(7.5, 1.4, 1.6), st, 0, 8.4, 0), mesh(new THREE.BoxGeometry(7.5, 0.3, 1.8), gold, 0, 9.2, 0, false));
  for (let q = 0; q < 3; q++) { const hx = (q - 1) * 2.6; g.add(mesh(new THREE.ConeGeometry(1.0, 1.1, 14), std(['#c8202e', '#2a5ac8', '#2a9a4a'][q]), hx, 10.0, 0), mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.12, 16), std(['#c8202e', '#2a5ac8', '#2a9a4a'][q]), hx, 9.5, 0), mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4), std('#f4ecd8'), hx + 0.7, 10.3, 0, false)); }
  for (const sx of [-1, 1]) { g.add(mesh(new THREE.SphereGeometry(1.2, 12, 10), std('#c8c0b8'), sx * 7.2, 7.0, 0)); }
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.3), new THREE.MeshBasicMaterial({ map: signTexture('Die 3 Mausketiere', '#1f3a8a', '#ffe8a0') })); sg.position.set(0, 6.6, 0.9); g.add(sg);
  out.world.add(g); out.glow.push([x, y + 7, z, 1, 0.8, 0.5, 26]);
}
function wormSculpture(world, x, y, z, rot) {
  const out = world.out, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; const cols = ['#6ac84a', '#a8e060', '#f0e060', '#f09a50', '#e86a8a', '#a870d8'];
  const n = 12; for (let i = 0; i < n; i++) { const t = i / (n - 1), px = (t - 0.5) * 9, py = 1.0 + Math.sin(t * Math.PI) * 3.4, r = 1.0 - Math.abs(t - 0.5) * 0.3; g.add(mesh(new THREE.SphereGeometry(r, 14, 10), std(cols[i % cols.length], { roughness: 0.45 }), px, py, 0)); }
  const hd = (0.5) * 9; for (const sz of [-0.35, 0.35]) g.add(mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), hd + 0.5, 1.4, sz, false), mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0x151520 }), hd + 0.78, 1.4, sz, false));
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.2), new THREE.MeshBasicMaterial({ map: signTexture('Würmling Express', '#3a8a2a', '#ffffff') })); sg.position.set(0, 5.6, 0); g.add(sg);
  for (const sx of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.6, 6), std('#8a6a44'), sx * 2.6, 2.8, 0, false));
  out.world.add(g); out.colliders.push({ x, z, hx: 4.6, hz: 1.2, rot, y0: y, y1: y + 5 }); out.glow.push([x, y + 3, z, 0.6, 1, 0.4, 24]);
}
const FACADES = { 'Talocan': (w, x, y, z, rot) => pyramid(w, x, y, z, rot, 6, 24, { tint: '#7a6a50' }), 'Tikal': (w, x, y, z, rot) => pyramid(w, x, y, z, rot, 7, 17, { stepH: 2.9, tint: '#56644a' }), 'Das verrückte Hotel Tartüff': crookedHotel, 'Maus au Chocolat': cakeFacade, 'Die 3 Mausketiere': musketeerGate, 'Würmling Express': wormSculpture,
  'Geister Rikscha': (w, x, y, z, rot) => H.chinaHouse(w.prng, x, y, z, rot, w.env, w.out, { w: 9, d: 7 }), 'Feng Ju Palace': (w, x, y, z, rot) => H.chinaHouse(w.prng, x, y, z, rot, w.env, w.out, { w: 13, d: 9 }) };
// Platzbedarf (Radius in m) der Fassaden
const FACADE_R = { 'Talocan': 15, 'Tikal': 12, 'Das verrückte Hotel Tartüff': 10, 'Maus au Chocolat': 9, 'Die 3 Mausketiere': 10, 'Würmling Express': 7, 'Geister Rikscha': 8, 'Feng Ju Palace': 9 };
// Zellen, die ein Kreis im Belegungsraster überdeckt (gleiche Rechnung wie in phantasia.js)
const cellsOf = (c, x, z, r) => { const s = new Set(); for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) s.add(i * 100003 + j); return s; };
export function rideFacades(world) {
  const done = [], list = [], c = world.grid.c;
  for (const r of world.rides) {
    const name = r.coaster.name, f = FACADES[name]; if (!f) continue;
    const e = r.entrance, rr = FACADE_R[name] || 9, own = cellsOf(c, e.x, e.z, 22), dx = r.dir[0], dz = r.dir[1], a0 = Math.atan2(dx, dz);
    // Die Fläche um den eigenen Eingang ist im Raster als "frei halten" markiert – genau dort soll die Fassade stehen, also diese Zellen ausnehmen
    const free = (x, z) => { for (const k of cellsOf(c, x, z, rr * 0.7)) if (world.occ.has(k) && !own.has(k)) return false; return true; };
    let placed = false;
    for (let dist = Math.max(12, rr * 0.9 + 4); dist <= rr + 44 && !placed; dist += 3) for (let k = 0; k < 18 && !placed; k++) {
      const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (TAU / 18), x = e.x + Math.sin(a) * dist, z = e.z + Math.cos(a) * dist, y0 = world.h(x, z);
      // Warteschlangen-Korridor (vom Eingang zur Station, also entgegen 'dir') muss frei bleiben
      const rx = x - e.x, rz = z - e.z, along = -(rx * dx + rz * dz), lat = rx * -dz + rz * dx;
      if (along > -rr * 0.3 && along < 36 && Math.abs(lat) < rr * 0.7 + 4) continue;
      if (y0 < -3 || !free(x, z) || world.nearTrackFast(x, z, rr + 2, 9) || world.nearTrackFast(x, z, rr * 0.5 + 2, 90) || world.nearStation(x, z) || onPath(world, x, z, rr * 0.75)) continue;
      const y = Math.max(0.05, y0); if (world.out.flatten) world.out.flatten(x, z, rr, rr, 0, y);
      f(world, x, y, z, Math.atan2(e.x - x, e.z - z)); world.grid.mark(x, z, rr); placed = true; done.push(name); list.push({ name, x, z, y });
    }
  }
  world.facadeNames = done; world.facadeList = list;
}

// ---------------------------------------------------------------- Hotel-Stile (erweitern das generische Hotel um dachtypische/zonentypische Bauteile)
export function hotelStyle(world, poi, g, w, d, hG, hT, out) {
  const env = world.env;
  if (poi.id === 'h-ling') { // Palast: rote Säulen, goldene Zierbänder, zweistufiges geschwungenes Dach
    const red = std('#9a2418', { roughness: 0.6 }), gold = std('#d8a82a', { metalness: 0.75, roughness: 0.35 }), roof = new THREE.MeshStandardMaterial({ map: T.rep(T.glazedTex('#a8741c', '#d8a030'), 5, 3), roughness: 0.45, metalness: 0.25, side: THREE.DoubleSide }); // kaiserlich-goldene Ziegel
    for (let k = 0; k < 9; k++) g.add(mesh(new THREE.CylinderGeometry(0.4, 0.45, hG + 0.6, 12), red, -w / 2 + 2 + k * (w - 4) / 8, (hG + 0.6) / 2, d / 2 + 1.2));
    g.add(mesh(new THREE.BoxGeometry(w + 1, 0.5, 2.4), gold, 0, hG + 0.45, d / 2 + 1.1, false), mesh(T.curvedRoofGeo(w + 8, d + 8, 4.4, 2.0), roof, 0, hT, 0), mesh(new THREE.BoxGeometry(w * 0.5, 3.2, d * 0.5), red, 0, hT + 2.2, 0), mesh(T.curvedRoofGeo(w * 0.5 + 6, d * 0.5 + 6, 3.4, 1.6), roof, 0, hT + 3.4, 0));
    g.add(mesh(new THREE.ConeGeometry(0.4, 3.2, 6), gold, 0, hT + 7.9, 0), mesh(new THREE.SphereGeometry(0.55, 8, 6), gold, 0, hT + 9.9, 0));
    const lan = lampMat(env, 'chlantern', 0xd02a1a, 0xff3a1a); for (let k = 0; k < 8; k++) { const lm = mesh(new THREE.SphereGeometry(0.45, 10, 8), lan, -w / 2 + 3 + k * (w - 6) / 7, hG + 0.2, d / 2 + 2.4, false); lm.scale.y = 1.25; g.add(lm); } return { signY: hT + 11.5 };
  }
  if (poi.id === 'h-mat') { // Lodge: Strohdach, Holzveranda, Wandmuster
    const thatch = new THREE.MeshStandardMaterial({ map: T.rep(A.tex.thatch(), 6, 3), roughness: 1, side: THREE.DoubleSide }), wood = std('#5a3a22', { map: A.tex.planks('#5a3a22') });
    g.add(mesh(gableGeometry(w + 3, d + 3, 8.5), thatch, 0, hT - 0.4, 0), mesh(gableGeometry(w * 0.55, d + 5, 5), thatch, 0, hT + 2.6, 0));
    for (let k = 0; k < 11; k++) g.add(mesh(new THREE.CylinderGeometry(0.22, 0.26, hG + 0.2, 8), wood, -w / 2 + 1.5 + k * (w - 3) / 10, (hG + 0.2) / 2, d / 2 + 1.8));
    g.add(mesh(new THREE.BoxGeometry(w + 2, 0.3, 3.4), wood, 0, hG + 0.2, d / 2 + 1.5, false));
    const band = mesh(new THREE.PlaneGeometry(w - 2, 3), new THREE.MeshStandardMaterial({ map: T.rep(T.muralTex(1), 6, 1), roughness: 1 }), 0, hG + 2.0, d / 2 + 0.06, false); g.add(band); return { signY: hT + 9.5 };
  }
  if (poi.id === 'h-lind') { // Flieger-Hotel: Kupfer-Kuppel, Propeller-Mast, Doppeldecker auf dem Dach, Nietenbänder
    const copper = std('#b87333', { metalness: 0.85, roughness: 0.38 }), iron = std('#30343a', { metalness: 0.7, roughness: 0.55 }), dome = mesh(new THREE.SphereGeometry(5.5, 24, 12, 0, TAU, 0, Math.PI / 2), copper, 0, hT + 0.6, 0);
    g.add(mesh(new THREE.BoxGeometry(w + 1.2, 0.6, d + 1.2), iron, 0, hT + 0.3, 0), dome, mesh(new THREE.CylinderGeometry(0.2, 0.3, 7, 8), iron, 0, hT + 6, 0));
    const prop = new THREE.Group(); prop.position.set(0, hT + 9.6, 0.6); for (const s of [-1, 1]) prop.add(mesh(new THREE.BoxGeometry(0.4, 3.4, 0.12), std('#8a6a44'), 0, s * 1.7, 0, false)); prop.add(mesh(new THREE.SphereGeometry(0.4, 8, 6), copper, 0, 0, 0.1, false)); g.add(prop); out.spinners.push({ obj: prop, axis: 'z', speed: 5 });
    const bp = new THREE.Group(); bp.position.set(w / 2 - 6, hT + 2.2, 0); const cloth = std('#f0e6c8', { roughness: 0.9 }); bp.add(mesh(new THREE.BoxGeometry(5, 0.8, 0.8), std('#a8302a'), 0, 0, 0), mesh(new THREE.BoxGeometry(1.5, 0.12, 6.6), cloth, 0.3, 0.9, 0), mesh(new THREE.BoxGeometry(1.5, 0.12, 6.6), cloth, 0.3, -0.5, 0), mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), iron, 0.3, 0.2, 2.4, false), mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), iron, 0.3, 0.2, -2.4, false), mesh(new THREE.BoxGeometry(0.9, 1.4, 0.1), cloth, -2.2, 0.8, 0)); g.add(bp);
    for (const yy of [hG + 1, hT - 1.4]) g.add(mesh(new THREE.BoxGeometry(w + 0.4, 0.7, d + 0.4), new THREE.MeshStandardMaterial({ map: T.rep(T.platesTex('#46403a'), 8, 1), metalness: 0.4, roughness: 0.6 }), 0, yy, 0, false));
    return { signY: hT + 12.5 };
  }
  return null;
}

// ---------------------------------------------------------------- Rutmor's Taverne (Außendekor: dunkles Fachwerk, hängendes Schild, Fässer, Schornstein mit Rauch)
export function tavernDecor(world, g, w, d, h, out, x, y, z, rot) {
  const wood = std('#2a1c12', { map: A.tex.planks('#2a1c12') });
  for (let k = 0; k <= 6; k++) g.add(mesh(new THREE.BoxGeometry(0.22, h, 0.18), wood, -w / 2 + k * w / 6, h / 2, d / 2 + 0.1, false));
  for (const yy of [0.2, h * 0.5, h - 0.1]) g.add(mesh(new THREE.BoxGeometry(w + 0.3, 0.24, 0.2), wood, 0, yy, d / 2 + 0.12, false));
  for (let k = 0; k < 6; k++) { const dg = mesh(new THREE.BoxGeometry(0.16, h * 0.62, 0.16), wood, -w / 2 + 1.2 + k * (w - 2.4) / 5, h * 0.75, d / 2 + 0.13, false); dg.rotation.z = k % 2 ? 0.8 : -0.8; g.add(dg); }
  const arm = mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16), wood, w / 2 - 1.6, h - 0.8, d / 2 + 1.0, false), board = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.3), new THREE.MeshBasicMaterial({ map: signTexture("Rutmor's Taverne", '#3a2410', '#ffd890', 'seit Urzeiten') })); board.position.set(w / 2 - 1.6, h - 1.9, d / 2 + 1.0); g.add(arm, board);
  for (let k = 0; k < 4; k++) g.add(mesh(new THREE.CylinderGeometry(0.5, 0.45, 0.95, 10), std('#6a4a2a'), -w / 2 + 1.0 + k * 1.1, 0.48, d / 2 + 1.4));
  const ch = mesh(new THREE.BoxGeometry(1.3, 4.2, 1.3), std('#7a756c', { map: A.tex.stone() }), -w * 0.3, h + 1.9, -d * 0.25); g.add(ch);
  const c = Math.cos(rot), s = Math.sin(rot); out.smoke.push({ x: x + (-w * 0.3) * c + (-d * 0.25) * s, y: y + h + 4.3, z: z - (-w * 0.3) * s + (-d * 0.25) * c, kind: 'smoke' });
  out.lights.push({ x: x + (w / 2 - 1.6) * c + (d / 2 + 1.4) * s, y: y + 3.2, z: z - (w / 2 - 1.6) * s + (d / 2 + 1.4) * c, color: 0xff9a40, int: 5, range: 12, flicker: 0.35 });
}

export function buildWorldExtras2(world) { chinaExtras(world); fantasyExtras(world); } // rideFacades(world) läuft früher (direkt nach placePOIs), damit die großen Fassaden freie Plätze bekommen
