// ============================================================================
//  pl_houses.js – Gebäude-Generatoren der Themenwelten (stilisiert, begehbares Erdgeschoss über A.hollow):
//  Berlin (1920er-Stadthaus), Rookburgh (Steampunk-Werkhalle), Mexico (bunte Fassaden mit Laube), China Town (geschwungene Dächer),
//  Fantasy (Pilz-/Zipfelhäuser), Wuze Town (runde Neon-Bauten), Mystery (verwitterte Fachwerk-/Steinhäuser).
//  Signatur wie A.nordicHouse: (rng, x, y, z, rot, env, out, opts) – Vorderseite (Tür) zeigt nach +z der Gruppe.
// ============================================================================
import * as THREE from 'three';
import * as A from './pl_assets.js';
import { signTexture, textures } from './textures.js';
import { gableGeometry } from './park.js';
import * as T from './pl_tex.js';

const TAU = T.TAU;
const std = (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...e });
const mesh = (geo, mat, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; };
const wpos = (x, z, rot, lx, lz) => { const c = Math.cos(rot), s = Math.sin(rot); return [x + lx * c + lz * s, z - lx * s + lz * c]; };
const glow = (out, x, y, z, rot, lx, ly, lz, rgb, size) => { const [wx, wz] = wpos(x, z, rot, lx, lz); out.glow.push([wx, y + ly, wz, rgb[0], rgb[1], rgb[2], size]); };
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const lampMat = (env, key, color, emissive) => A.M(key, () => { const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0, roughness: 0.5 }); env.registerLamp(m); return m; });
const iron = (len = 2.7) => { const n = Math.max(1, Math.round(len / 1.3)); return A.M('iron-alpha' + n, () => new THREE.MeshStandardMaterial({ map: T.ironRep(n), alphaTest: 0.4, side: THREE.DoubleSide, color: 0x2a2a30, roughness: 0.6, metalness: 0.5 })); };
const place = (g, out) => { out.world.add(g); return g; };

// ---------------------------------------------------------------- Berlin: Stadthaus der 1920er (Stuck, Fenstergiebel, Balkone mit Eisengeländer, Markisen, Mansarddach)
const BPAL = [['#e6dcc2', '#f4efe2'], ['#d9bd84', '#f0e6c8'], ['#bccaa6', '#f0efe2'], ['#dcb3a4', '#f4ede6'], ['#a9b9c9', '#eef0f2'], ['#ece7da', '#d8d0c0'], ['#c9b28a', '#f2ead8']];
const SHOPS = ['Konditorei', 'Hutmacher', 'Apotheke', 'Café', 'Buchhandlung', 'Uhren & Schmuck', 'Delikatessen', 'Schneiderei', 'Blumen', 'Lichtspiele', 'Tabakwaren', 'Spielwaren', 'Friseur', 'Bäckerei'];
const AWN = [['#b02a2a', '#f4ecd8'], ['#2a6a3a', '#f4ecd8'], ['#1f3a7a', '#f4ecd8'], ['#c88a1a', '#f4ecd8']];
export function berlinHouse(rng, x, y, z, rot, env, out, o = {}) {
  const bays = o.bays || 3 + Math.floor(rng() * 3), bd = o.bd || 3, w = bays * 3.4, d = bd * 3.4;
  const floors = o.floors || 3 + Math.floor(rng() * 3), hG = 4.4, fh = 3.3, Hu = floors * fh, H = hG + Hu;
  const [pal, trim] = pick(rng, BPAL), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const base = new THREE.MeshStandardMaterial({ map: T.rep(A.tex.stone(), w / 3.5, 1.2), color: T.shade(pal, 0.9), roughness: 0.95 });
  A.hollow(g, x, y, z, rot, w, d, hG, base, { kind: 'shop', floor: '#7a5a3a', rug: 0x6a1a2a, lamp: 0xffc880 }, env, out);
  const fm = nb => A.M(`bfac:${pal}:${nb}:${floors}`, () => { const m = new THREE.MeshStandardMaterial({ map: T.rep(T.facadeTile(pal, trim, nb), 1, floors), emissiveMap: T.rep(T.facadeTile(pal, trim, nb, true), 1, floors), emissive: 0xffc070, emissiveIntensity: 0, roughness: 0.92 }); env.registerLamp(m); return m; });
  const top = A.M('btop', () => std('#4a4a52'));
  const upper = mesh(new THREE.BoxGeometry(w, Hu, d), [fm(bd), fm(bd), top, top, fm(bays), fm(bays)], 0, hG + Hu / 2, 0); g.add(upper);
  const corn = A.M('bcorn' + trim, () => std(trim, { roughness: 0.9 }));
  g.add(mesh(new THREE.BoxGeometry(w + 0.5, 0.45, d + 0.5), corn, 0, H + 0.1, 0), mesh(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3), corn, 0, hG + 0.05, 0));
  // Schaufenster, Markisen, Ladenschild
  const glass = A.M('bshopglass', () => { const m = new THREE.MeshStandardMaterial({ color: 0x2a3a48, emissive: 0xffc070, emissiveIntensity: 0.0, roughness: 0.2, metalness: 0.3 }); env.registerLamp(m); return m; });
  const [a1, a2] = pick(rng, AWN), awm = new THREE.MeshStandardMaterial({ map: T.rep(T.awningTex(a1, a2), 3, 1), roughness: 0.9, side: THREE.DoubleSide });
  for (let b = 0; b < bays; b++) {
    const cx = -w / 2 + (b + 0.5) * 3.4; if (Math.abs(cx) < 1.9) continue;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.1), glass); win.position.set(cx, 2.35, d / 2 + 0.04); g.add(win);
    g.add(mesh(new THREE.BoxGeometry(2.5, 0.12, 0.12), corn, cx, 1.25, d / 2 + 0.07, false), mesh(new THREE.BoxGeometry(2.5, 0.1, 0.1), corn, cx, 3.5, d / 2 + 0.06, false));
    const aw = mesh(new THREE.BoxGeometry(2.9, 0.06, 1.35), awm, cx, 3.62, d / 2 + 0.62); aw.rotation.x = 0.42; g.add(aw);
  }
  const nm = pick(rng, SHOPS), sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(5, w * 0.6), 0.62), new THREE.MeshBasicMaterial({ map: signTexture(nm, '#' + T.shade(pal, 0.55).getHexString()) })); sg.position.set(0, hG - 0.45, d / 2 + 0.2); g.add(sg);
  // Balkone mit Eisengeländer auf Höhe des 2. Geschosses
  if (floors >= 2) { const nbal = Math.min(bays - 1, 1 + Math.floor(rng() * 2)), start = Math.floor((bays - nbal) / 2); for (let k = 0; k < nbal; k++) {
    const cx = -w / 2 + (start + k + 0.5) * 3.4, by = hG + fh + 0.12;
    g.add(mesh(new THREE.BoxGeometry(2.7, 0.16, 1.05), corn, cx, by, d / 2 + 0.52));
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.95), iron(2.7)); fr.position.set(cx, by + 0.58, d / 2 + 1.03); g.add(fr);
    for (const sx of [-1, 1]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.95), iron(1.05)); sd.rotation.y = Math.PI / 2; sd.position.set(cx + sx * 1.35, by + 0.58, d / 2 + 0.52); g.add(sd); g.add(mesh(new THREE.BoxGeometry(0.16, 0.5, 0.7), corn, cx + sx * 1.0, by - 0.33, d / 2 + 0.4, false)); }
  } }
  // Mansarddach mit Gauben und Schornsteinen
  const rh = 1.8 + Math.min(w, d) * 0.16, rm = A.M('bslate', () => new THREE.MeshStandardMaterial({ map: A.tex.slate(), roughness: 0.8, side: THREE.DoubleSide, color: 0x9a9aa4 }));
  g.add(mesh(gableGeometry(w + 0.3, d + 0.3, rh), rm, 0, H + 0.45, 0));
  const nd = Math.max(1, Math.floor(bays / 2)), dm = lampMat(env, 'bdormer', 0x2a3a48, 0xffc070);
  for (let k = 0; k < nd; k++) for (const sz of [1, -1]) {
    const px = -w / 2 + (k + 0.5) * w / nd, pz = sz * d / 4, py = H + 0.45 + rh * (1 - Math.abs(pz) / (d / 2 + 0.5));
    g.add(mesh(new THREE.BoxGeometry(1.5, 1.4, 1.2), corn, px, py + 0.35, pz));
    const cone = mesh(new THREE.ConeGeometry(1.25, 0.9, 4), rm, px, py + 1.5, pz); cone.rotation.y = Math.PI / 4; g.add(cone);
    const wd = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.85), dm); wd.position.set(px, py + 0.4, pz + sz * 0.62); if (sz < 0) wd.rotation.y = Math.PI; g.add(wd);
  }
  const brick = A.M('bbrick', () => new THREE.MeshStandardMaterial({ map: A.tex.brick([140, 70, 52]), roughness: 1 }));
  for (const sx of [-0.28, 0.28]) g.add(mesh(new THREE.BoxGeometry(0.85, 2.3, 0.85), brick, sx * w, H + rh + 0.9, 0));
  place(g, out);
  for (let k = 0; k < 3; k++) glow(out, x, y, z, rot, (k - 1) * w * 0.28, hG + fh * (0.6 + (k % 2) * 1.2), d / 2 + 0.5, [1, 0.74, 0.4], 15);
  return { w, d, h: H };
}

// ---------------------------------------------------------------- Rookburgh: Steampunk-Werkhalle (Nieten-Platten/Ziegel, Kupferkuppel, Rohre, Zahnrad, Schornsteine mit Dampf)
export function steamHouse(rng, x, y, z, rot, env, out, o = {}) {
  const w = o.w || 11 + rng() * 8, d = o.d || 9 + rng() * 5, h = 7.5 + rng() * 5, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const brickWall = rng() < 0.35, wallM = brickWall ? new THREE.MeshStandardMaterial({ map: T.rep(A.tex.brick([142, 64, 46]), w / 5, h / 5), roughness: 0.95 }) : new THREE.MeshStandardMaterial({ map: T.rep(T.platesTex(rng() < 0.5 ? '#3c3f46' : '#46403a'), w / 6, h / 6), roughness: 0.7, metalness: 0.35 });
  A.hollow(g, x, y, z, rot, w, d, h, wallM, { kind: 'hall', floor: '#3e3a36', ceil: false, lamp: 0xff9040 }, env, out);
  const copper = A.M('copper', () => new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.38, metalness: 0.85 })), dark = A.M('steamiron', () => new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.55, metalness: 0.7 })), brass = A.M('brass', () => new THREE.MeshStandardMaterial({ color: 0xd4a84a, roughness: 0.35, metalness: 0.8 }));
  g.add(mesh(new THREE.BoxGeometry(w + 0.5, 0.45, d + 0.5), dark, 0, h + 0.2, 0));
  const kind = rng(), r = Math.min(w, d) * 0.44;
  if (kind < 0.4) { // Kupferkuppel auf Trommel
    g.add(mesh(new THREE.CylinderGeometry(r, r * 1.04, 1.4, 22), dark, 0, h + 1.1, 0));
    g.add(mesh(new THREE.SphereGeometry(r, 26, 12, 0, TAU, 0, Math.PI / 2), copper, 0, h + 1.8, 0));
    const ring = mesh(new THREE.TorusGeometry(r * 1.01, 0.12, 6, 32), brass, 0, h + 1.8, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.3, 1.8, 8), brass, 0, h + 1.8 + r + 0.8, 0), mesh(new THREE.SphereGeometry(0.34, 10, 8), brass, 0, h + 1.8 + r + 1.8, 0));
  } else if (kind < 0.75) { // Sheddach (Eisen)
    const teeth = Math.max(2, Math.floor(w / 5)); for (let k = 0; k < teeth; k++) { const tri = mesh(gableGeometry(w / teeth - 0.2, d + 0.6, 2.4), dark, -w / 2 + (k + 0.5) * w / teeth, h + 0.4, 0); tri.rotation.y = Math.PI / 2; g.add(tri); }
  } else { // Flachdach mit Wassertanks und Geländer
    for (const sx of [-0.25, 0.25]) { const tank = mesh(new THREE.CylinderGeometry(1.5, 1.5, 3, 14), copper, sx * w, h + 2.4, -d * 0.1); g.add(tank); for (const q of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 5), dark, sx * w + q[0] * 1.1, h + 0.9, -d * 0.1 + q[1] * 1.1, false)); g.add(mesh(new THREE.ConeGeometry(1.6, 0.9, 14), dark, sx * w, h + 4.3, -d * 0.1)); }
  }
  // Schornsteine mit Kupferringen und Dampf
  const nch = 1 + Math.floor(rng() * 2.4);
  for (let k = 0; k < nch; k++) {
    const cx = -w / 2 + 2 + rng() * (w - 4), cz = -d / 2 + 1.6 + rng() * 2, ch = 9 + rng() * 9;
    g.add(mesh(new THREE.CylinderGeometry(0.75, 1.1, ch, 12), brickWall ? A.M('chimbrick', () => new THREE.MeshStandardMaterial({ map: A.tex.brick([120, 56, 42]), roughness: 1 })) : dark, cx, h + ch / 2, cz));
    for (const yy of [0.3, 0.62]) { const rg = mesh(new THREE.TorusGeometry(0.92, 0.1, 6, 14), copper, cx, h + ch * yy, cz); rg.rotation.x = Math.PI / 2; g.add(rg); }
    const [wx, wz] = wpos(x, z, rot, cx, cz); out.smoke.push({ x: wx, y: y + h + ch + 0.4, z: wz, kind: 'steam' });
  }
  // senkrechte Rohre an den Ecken mit Ventilrad
  for (const sx of [-1, 1]) { const px = sx * (w / 2 + 0.35); g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, h + 1.2, 8), copper, px, (h + 1.2) / 2, d / 2 - 0.3)); const e1 = mesh(new THREE.SphereGeometry(0.3, 8, 6), brass, px, h + 0.7, d / 2 - 0.3); g.add(e1); const vw = mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 12), brass, px + sx * 0.3, 1.4, d / 2 - 0.3); vw.rotation.y = Math.PI / 2; g.add(vw); }
  // Zahnrad an der Fassade (dreht sich)
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshStandardMaterial({ map: T.gearTex(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.7 }));
  gr.position.set((rng() - 0.5) * w * 0.4, h * 0.62, d / 2 + 0.1); g.add(gr); (out.spinners || (out.spinners = [])).push({ obj: gr, axis: 'z', speed: 0.45 * (rng() < 0.5 ? 1 : -1) });
  // Ofenfenster (glühen), Laufsteg mit Eisengitter
  const fw = lampMat(env, 'steamwin', 0x20120a, 0xff7a20);
  const nw = Math.max(2, Math.floor(w / 4)); for (let k = 0; k < nw; k++) { const wd = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), fw); wd.position.set(-w / 2 + (k + 0.5) * w / nw + (k === Math.floor(nw / 2) && nw % 2 ? 2.4 : 0), 3.4, d / 2 + 0.03); if (Math.abs(wd.position.x) > 1.3) g.add(wd); }
  const cat = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.9), iron(w * 0.8)); cat.position.set(0, 5.4, d / 2 + 1.05); g.add(cat); g.add(mesh(new THREE.BoxGeometry(w * 0.8, 0.1, 1.1), dark, 0, 4.9, d / 2 + 0.55, false));
  place(g, out);
  out.lights.push({ x: wpos(x, z, rot, 0, d / 2 + 2)[0], y: y + 4, z: wpos(x, z, rot, 0, d / 2 + 2)[1], color: 0xff8a30, int: 7, range: 18, flicker: 0.15 });
  for (let k = 0; k < 2; k++) glow(out, x, y, z, rot, (k - 0.5) * w * 0.5, 3.4, d / 2 + 0.6, [1, 0.5, 0.15], 22);
  return { w, d, h };
}

// ---------------------------------------------------------------- Mexico: bunte Fassade mit Laube (Rundbögen), Flachdach mit Zinnen oder Ziegeldach, Vigas
const MEXPAL = ['#e8b830', '#e07a28', '#c83a30', '#2aa8a0', '#d85a90', '#f0d8a0', '#7ac860', '#3a78c8'];
export function mexicoHouse(rng, x, y, z, rot, env, out, o = {}) {
  const w = o.w || 8.5 + rng() * 5, d = o.d || 6.5 + rng() * 3, h = 3.7 + rng() * 1.6, c = o.color || pick(rng, MEXPAL), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const wallM = new THREE.MeshStandardMaterial({ map: T.rep(T.plasterTex(c), w / 5, h / 4), roughness: 0.95 });
  A.hollow(g, x, y, z, rot, w, d, h, wallM, { kind: 'home', floor: '#a8602a', rug: 0xc84a2a, lamp: 0xffb050 }, env, out);
  const cream = A.M('mcream', () => std('#f2ead4', { roughness: 0.9 })), terra = A.M('mterra', () => std('#a8552e', { roughness: 0.9 }));
  if (rng() < 0.55) { // Flachdach mit Zinnen/Attika
    g.add(mesh(new THREE.BoxGeometry(w + 0.5, 0.35, d + 0.5), wallM, 0, h + 0.17, 0));
    for (const [sx, sz, bw, bd] of [[0, d / 2 + 0.12, w + 0.5, 0.25], [0, -d / 2 - 0.12, w + 0.5, 0.25], [w / 2 + 0.12, 0, 0.25, d + 0.5], [-w / 2 - 0.12, 0, 0.25, d + 0.5]]) g.add(mesh(new THREE.BoxGeometry(bw, 0.7, bd), cream, sx, h + 0.7, sz));
    if (rng() < 0.6) { const bell = mesh(new THREE.BoxGeometry(1.6, 2.2, 0.5), cream, (rng() - 0.5) * w * 0.4, h + 1.4, -d * 0.2); g.add(bell); const ar = mesh(T.archGeo(0.7, 0.8, 0.6, 0.2), terra, bell.position.x, h + 1.0, -d * 0.2); g.add(ar); g.add(mesh(new THREE.ConeGeometry(0.5, 0.6, 4), terra, bell.position.x, h + 2.9, -d * 0.2)); }
  } else { const rm = A.M('mtile', () => new THREE.MeshStandardMaterial({ map: textures.roofTile(), color: 0xc0623a, roughness: 0.8, side: THREE.DoubleSide })); g.add(mesh(gableGeometry(w + 0.2, d + 0.2, Math.min(w, d) * 0.3), rm, 0, h, 0)); }
  for (let k = 0; k < 5; k++) { const b = mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.6, 6), A.M('beam', () => std('#5a3a20')), -w / 2 + 0.8 + k * (w - 1.6) / 4, h - 0.5, d / 2 + 0.6, false); b.rotation.x = Math.PI / 2; g.add(b); }
  // Laube mit Rundbögen vor dem Eingang
  const n = Math.max(1, Math.min(3, Math.floor(w / 3.2))), bw = 2.1, step = 3.0, bh = 2.6, zf = d / 2 + 1.1;
  for (let k = 0; k < n; k++) { const ax = (k - (n - 1) / 2) * step; g.add(mesh(T.archGeo(bw, bh, 0.5, 0.3), cream, ax, 0, zf)); }
  g.add(mesh(new THREE.BoxGeometry(n * step + 0.2, 0.25, 2.0), cream, 0, bh + 1.0, d / 2 + 1.0));
  const sh = pick(rng, ['#2a8a9a', '#3a78c8', '#2a8a4a', '#8a2a8a']), win = A.M('awin', () => { const m = new THREE.MeshStandardMaterial({ color: 0x221510, emissive: 0xffa040, emissiveIntensity: 0.3 }); env.registerLamp(m); return m; });
  for (const sx of [-1, 1]) { const wx = sx * (w / 2 - 1.5); if (Math.abs(wx) < 2.2) continue; const wd = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.2), win); wd.position.set(wx, 1.9, d / 2 + 0.03); g.add(wd); for (const q of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.5, 1.25, 0.06), std(sh), wx + q * 0.72, 1.9, d / 2 + 0.07, false)); }
  A.flowerBoxes(g, w, d, 2, 1.0);
  place(g, out); glow(out, x, y, z, rot, 0, 2.2, d / 2 + 1.4, [1, 0.7, 0.3], 18);
  return { w, d, h };
}

// ---------------------------------------------------------------- China Town: Haus mit roten Säulen, Gittern und zweistufigem geschwungenem Dach (grün/gold)
export function chinaHouse(rng, x, y, z, rot, env, out, o = {}) {
  const w = o.w || 8.5 + rng() * 4, d = o.d || 7 + rng() * 3, h = 3.7, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const red = A.M('chred', () => new THREE.MeshStandardMaterial({ map: T.rep(T.plasterTex('#a8302a'), w / 5, 1), roughness: 0.9 })), gold = A.M('chgold', () => new THREE.MeshStandardMaterial({ color: 0xd8a82a, metalness: 0.75, roughness: 0.35 }));
  const pillar = A.M('chpillar', () => new THREE.MeshStandardMaterial({ color: 0x9a2418, roughness: 0.6 })), roof = A.M('chroof', () => new THREE.MeshStandardMaterial({ map: T.rep(T.glazedTex(), 3, 3), roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide }));
  A.hollow(g, x, y, z, rot, w, d, h, red, { kind: 'home', floor: '#6a4a2a', rug: 0x2a5a3a, lamp: 0xffa050 }, env, out);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { g.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, h + 0.2, 10), pillar, sx * (w / 2 + 0.15), (h + 0.2) / 2, sz * (d / 2 + 0.15))); g.add(mesh(new THREE.CylinderGeometry(0.4, 0.28, 0.3, 10), gold, sx * (w / 2 + 0.15), h + 0.15, sz * (d / 2 + 0.15), false)); }
  const lat = new THREE.MeshStandardMaterial({ map: T.latticeTex(), transparent: false, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xb02a20, roughness: 0.7 }), back = lampMat(env, 'chwin', 0x30180c, 0xff9a40);
  for (const [sx, sz, ry] of [[-1, 1, 0], [1, 1, 0], [-1, -1, Math.PI], [1, -1, Math.PI]]) { const px = sx * (w / 2 - 1.6); if (sz > 0 && Math.abs(px) < 2) continue; const bk = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), back); bk.position.set(px, 2.0, sz * (d / 2 + 0.02)); bk.rotation.y = ry; g.add(bk); const lt = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), lat); lt.position.set(px, 2.0, sz * (d / 2 + 0.06)); lt.rotation.y = ry; g.add(lt); }
  const r1 = mesh(T.curvedRoofGeo(w + 3.4, d + 3.4, 2.3, 1.1), roof, 0, h + 0.3, 0); g.add(r1);
  g.add(mesh(new THREE.BoxGeometry(w * 0.5, 1.7, d * 0.5), red, 0, h + 1.5, 0));
  const r2 = mesh(T.curvedRoofGeo(w * 0.5 + 2.4, d * 0.5 + 2.4, 1.9, 0.9), roof, 0, h + 2.2, 0); g.add(r2);
  g.add(mesh(new THREE.ConeGeometry(0.22, 1.8, 6), gold, 0, h + 2.2 + 1.9 + 0.6, 0), mesh(new THREE.SphereGeometry(0.3, 8, 6), gold, 0, h + 2.2 + 1.9 + 1.5, 0));
  g.add(mesh(new THREE.BoxGeometry(w + 3.2, 0.12, 0.2), gold, 0, h + 0.38, (d + 3.4) / 2 - 0.1, false));
  const lan = lampMat(env, 'chlantern', 0xd02a1a, 0xff3a1a);
  for (const sx of [-1, 1]) for (const sz of [1]) { const lm = mesh(new THREE.SphereGeometry(0.4, 10, 8), lan, sx * (w / 2 + 0.6), h - 0.2, sz * (d / 2 + 0.6), false); lm.scale.y = 1.25; g.add(lm); glow(out, x, y, z, rot, sx * (w / 2 + 0.6), h - 0.2, sz * (d / 2 + 0.6), [1, 0.3, 0.15], 16); }
  place(g, out); return { w, d, h };
}

// ---------------------------------------------------------------- Fantasy: Pilzhaus / Zipfelhaus in Pastell mit runden Fenstern, Zuckerschornstein
const FPAL = ['#f08aa8', '#8ad8f0', '#f0e07a', '#b8e88a', '#c8a0f0', '#f0b080', '#8ae8c8'];
export function toyHouse(rng, x, y, z, rot, env, out, o = {}) {
  const w = o.w || 6.5 + rng() * 2.5, d = o.d || 6 + rng() * 2, h = 3.8 + rng() * 1.6, c = pick(rng, FPAL), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  A.hollow(g, x, y, z, rot, w, d, h, std(c, { roughness: 0.7 }), { kind: 'home', floor: '#c0955a', rug: 0x7a3aa0, lamp: 0xffd080 }, env, out);
  const r = Math.max(w, d) * 0.72, tilt = (rng() - 0.5) * 0.12;
  if (rng() < 0.5) { // Pilzdach
    const capC = pick(rng, ['#d8405a', '#e8a020', '#8a50c8', '#3aa8c8']), cap = mesh(new THREE.SphereGeometry(r * 1.05, 24, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: T.spotsTex(capC), roughness: 0.6 }), 0, h - 0.1, 0); cap.scale.y = 0.85; cap.rotation.z = tilt; g.add(cap);
  } else { // Zipfeldach (gedrehter Kegel)
    const cone = mesh(new THREE.ConeGeometry(r, h * 1.2, 10, 6), new THREE.MeshStandardMaterial({ map: T.rep(T.candyTex(pick(rng, ['#e8407a', '#3a78c8', '#8a50c8']), '#fff4f0'), 4, 1), roughness: 0.55 }), 0, h + h * 0.6, 0); cone.rotation.z = tilt * 1.5; g.add(cone);
    const tip = mesh(new THREE.SphereGeometry(0.35, 10, 8), std('#ffd040', { emissive: 0xffb020, emissiveIntensity: 0.2 }), Math.sin(tilt * 1.5) * -h * 0.6, h + h * 1.2 + 0.1, 0); g.add(tip);
  }
  const win = lampMat(env, 'toywin', 0x30204a, 0xffd080), door = A.M('toydoor', () => std('#8a4a2a'));
  for (const sx of [-1, 1]) { const px = sx * (w / 2 - 1.5); if (Math.abs(px) < 1.6) continue; const wd = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), win); wd.position.set(px, 2.3, d / 2 + 0.03); g.add(wd); const ring = mesh(new THREE.TorusGeometry(0.57, 0.07, 6, 16), door, px, 2.3, d / 2 + 0.05, false); g.add(ring); }
  const ch = mesh(new THREE.CylinderGeometry(0.35, 0.4, 2.2, 10), new THREE.MeshStandardMaterial({ map: T.rep(T.candyTex('#e8407a', '#fff4f0'), 1, 2), roughness: 0.6 }), w * 0.3, h + 0.9, -d * 0.1); g.add(ch);
  A.flowerBoxes(g, w, d, 2, 1.3);
  place(g, out); glow(out, x, y, z, rot, 0, 2.4, d / 2 + 0.5, [1, 0.85, 0.5], 18); return { w, d, h };
}

// ---------------------------------------------------------------- Wuze Town: runde, futuristische Märchenbauten mit Neonringen
const NEON = [0x40e8ff, 0xff50d0, 0xffe040, 0x70ff70, 0xa070ff];
export function wuzeHouse(rng, x, y, z, rot, env, out, o = {}) {
  const w = o.w || 6.5 + rng() * 2, d = w, h = 3.4, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const pastel = pick(rng, ['#f48ac4', '#6ad8f0', '#f8e060', '#a888f8', '#70e8a8', '#ff9a6a']), neon = pick(rng, NEON), kind = Math.floor(rng() * 3);
  A.hollow(g, x, y, z, rot, w, d, h, std(pastel, { roughness: 0.4, metalness: 0.1 }), { kind: 'home', floor: '#e8e0f0', rug: 0x50a0c8, ceil: false, lamp: 0xc0e8ff }, env, out);
  const nm = A.M('wuzeneon' + neon, () => { const m = new THREE.MeshStandardMaterial({ color: neon, emissive: neon, emissiveIntensity: 0.9, roughness: 0.3 }); return m; }), body = A.M('wuzebody' + pastel, () => std(pastel, { roughness: 0.35, metalness: 0.15 }));
  if (kind === 0) { // Kuppel mit Neonring
    g.add(mesh(new THREE.SphereGeometry(w * 0.62, 26, 14, 0, TAU, 0, Math.PI / 2), body, 0, h, 0));
    const ring = mesh(new THREE.TorusGeometry(w * 0.62, 0.14, 8, 36), nm, 0, h + 0.1, 0, false); ring.rotation.x = Math.PI / 2; g.add(ring); g.add(mesh(new THREE.SphereGeometry(0.4, 10, 8), nm, 0, h + w * 0.62 + 0.3, 0, false));
  } else if (kind === 1) { // Kapselturm, leicht geneigt
    const cap = mesh(new THREE.CapsuleGeometry(w * 0.34, w * 1.2, 6, 14), body, 0, h + w * 0.8, 0); cap.rotation.z = 0.1; g.add(cap);
    for (const yy of [0.5, 1.1]) { const ring = mesh(new THREE.TorusGeometry(w * 0.36, 0.1, 6, 24), nm, Math.sin(0.1) * -(yy * 1.2), h + w * 0.8 + (yy - 0.8) * w * 0.6, 0, false); ring.rotation.x = Math.PI / 2; ring.rotation.z = 0.1; g.add(ring); }
  } else { // gestapelte Scheiben
    for (let k = 0; k < 3; k++) { const r = w * (0.62 - k * 0.14); g.add(mesh(new THREE.CylinderGeometry(r, r * 1.06, 0.7, 24), body, 0, h + 0.35 + k * 0.95, 0)); const ring = mesh(new THREE.TorusGeometry(r * 1.03, 0.08, 6, 28), nm, 0, h + 0.7 + k * 0.95, 0, false); ring.rotation.x = Math.PI / 2; g.add(ring); }
    g.add(mesh(new THREE.ConeGeometry(0.3, 1.6, 8), nm, 0, h + 3.4, 0, false));
  }
  const wl = A.M('wuzewin' + neon, () => { const m = new THREE.MeshStandardMaterial({ color: 0x203048, emissive: neon, emissiveIntensity: 0.5 }); return m; });
  for (const sx of [-1, 1]) { const px = sx * (w / 2 - 1.4); if (Math.abs(px) < 1.5) continue; const wd = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), wl); wd.position.set(px, 2.2, d / 2 + 0.03); g.add(wd); }
  place(g, out); const c = new THREE.Color(neon); glow(out, x, y, z, rot, 0, 2.2, d / 2 + 0.6, [c.r, c.g, c.b], 22);
  out.lights.push({ x: wpos(x, z, rot, 0, d / 2 + 1.5)[0], y: y + 2.5, z: wpos(x, z, rot, 0, d / 2 + 1.5)[1], color: neon, int: 4, range: 12, flicker: 0.05 });
  return { w, d, h };
}

// ---------------------------------------------------------------- Mystery: verwittertes Haus (Steinsockel, überkragendes Fachwerk-Obergeschoss, dunkles Dach, Runentafel)
export function mysteryHouse(rng, x, y, z, rot, env, out, o = {}) {
  const w = o.w || 8 + rng() * 4, d = o.d || 6.5 + rng() * 3, h = 3.5, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const stone = new THREE.MeshStandardMaterial({ map: T.rep(T.stoneTintTex('#58585e'), w / 4, 1), roughness: 1 }), wood = A.M('mwood', () => new THREE.MeshStandardMaterial({ map: A.tex.planks('#2e2218'), roughness: 1 })), plaster = A.M('mplaster', () => std('#6a655c', { roughness: 1 }));
  A.hollow(g, x, y, z, rot, w, d, h, stone, { kind: 'home', floor: '#3a2e22', rug: 0x2a2a50, lamp: 0x9ac0ff }, env, out);
  const up = mesh(new THREE.BoxGeometry(w + 1.2, 3.0, d + 1.0), plaster, 0, h + 1.5, 0.1); g.add(up);
  for (let k = 0; k <= 4; k++) g.add(mesh(new THREE.BoxGeometry(0.22, 3.0, 0.2), wood, -w / 2 - 0.5 + k * (w + 1) / 4, h + 1.5, d / 2 + 0.65, false));
  g.add(mesh(new THREE.BoxGeometry(w + 1.3, 0.22, 0.24), wood, 0, h + 0.1, d / 2 + 0.65, false), mesh(new THREE.BoxGeometry(w + 1.3, 0.22, 0.24), wood, 0, h + 2.95, d / 2 + 0.65, false));
  for (let k = 0; k < 4; k++) { const dg = mesh(new THREE.BoxGeometry(0.16, 3.4, 0.16), wood, -w / 2 + 0.4 + k * (w - 0.8) / 3.0, h + 1.5, d / 2 + 0.66, false); dg.rotation.z = k % 2 ? 0.7 : -0.7; dg.scale.y = 0.62; g.add(dg); }
  const rm = A.M('mslate', () => new THREE.MeshStandardMaterial({ map: A.tex.slate(), color: 0x6a6a74, roughness: 0.85, side: THREE.DoubleSide })), rh = Math.min(w, d) * 0.62;
  const roof = mesh(gableGeometry(w + 1.2, d + 1.0, rh), rm, 0, h + 3.0, 0.1); roof.rotation.z = (rng() - 0.5) * 0.04; g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), stone, w * 0.25, h + 3 + rh * 0.7, -d * 0.1));
  const rt = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), new THREE.MeshStandardMaterial({ map: T.runeTex(), emissiveMap: T.runeGlowTex(), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8 })); env.registerLamp(rt.material); rt.position.set(-w / 2 + 1.2, 2.2, d / 2 + 0.05); g.add(rt);
  const win = lampMat(env, 'mysterywin', 0x10141c, 0x7aa8ff); for (const sx of [-1, 1]) { const wd = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), win); wd.position.set(sx * (w / 2 - 1.5), h + 1.5, d / 2 + 0.78); g.add(wd); }
  place(g, out); glow(out, x, y, z, rot, 0, 2.6, d / 2 + 0.5, [0.4, 0.6, 1], 16);
  out.lights.push({ x: wpos(x, z, rot, 1.5, d / 2 + 1.2)[0], y: y + 2.4, z: wpos(x, z, rot, 1.5, d / 2 + 1.2)[1], color: 0x7aa8ff, int: 3.5, range: 10, flicker: 0.35 });
  return { w, d, h };
}
