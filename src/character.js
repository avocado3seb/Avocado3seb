// Menschliche Figuren: prozedural gebaut, pro Knochen zu einem Mesh verschmolzen (Vertexfarben)
import * as THREE from 'three';
import { MB, colorOf } from './builder.js';
import { clamp, lerp, damp, dampAngle, TAU } from './util.js';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
const gcache = new Map();
const G_ = (k, f) => { let g = gcache.get(k); if (!g) { g = f(); gcache.set(k, g); } return g; };
const capG = (r, l) => G_(`cap${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 3, 8));
const sphG = G_('sph', () => new THREE.SphereGeometry(1, 10, 8));
const boxG = G_('box', () => new THREE.BoxGeometry(1, 1, 1));
const cylG = G_('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 10));
const coneG = G_('cone', () => new THREE.ConeGeometry(1, 1, 10));

function add(mb, g, col, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  E.set(rx, ry, rz); Q.setFromEuler(E); V.set(x, y, z); S.set(sx, sy, sz);
  M4.compose(V, Q, S); mb.append(g, M4, colorOf(col));
}

export const DEFAULT_OUTFIT = { skin: 0xe0ac86, hairStyle: 1, hairColor: 0x3b2a1e, top: 0, topColor: 0x1e88e5, bottom: 0, bottomColor: 0x37474f, shoe: 0, shoeColor: 0xf5f5f5, hat: 0, hatColor: 0x222222, glasses: 0, watch: 0, build: 1, tint: 0xffffff };
export const outfitKey = (o) => [o.skin, o.hairStyle, o.hairColor, o.top, o.topColor, o.bottom, o.bottomColor, o.shoe, o.shoeColor, o.hat, o.hatColor, o.glasses, o.watch, o.build].join('_');

// Teile-Indizes: TOPS in data.js: tee shirt hawaii tank hoodie jacket blazer tux coat ...
const TOP_STYLE = ['tee', 'shirt', 'hawaii', 'tank', 'hoodie', 'jacket', 'blazer', 'tux', 'coat', 'jacket', 'blazer', 'jacket', 'hoodie'];
const BOT_STYLE = ['long', 'short', 'long', 'long', 'short', 'long'];

function buildGeos(o) {
  const skin = o.skin, hair = o.hairColor;
  const tstyle = TOP_STYLE[o.top] || 'tee', top = o.topColor;
  const long = tstyle !== 'tee' && tstyle !== 'tank' && tstyle !== 'hawaii' && tstyle !== 'shirt';
  const suit = tstyle === 'blazer' || tstyle === 'tux' || tstyle === 'coat';
  const bstyle = BOT_STYLE[o.bottom] || 'long', bot = o.bottomColor;
  const b = o.build || 1;
  const T = new MB(), P = new MB(), UA = new MB(), FA = new MB(), TH = new MB(), SH = new MB();
  const sc = new THREE.Color(top), shade = (c, k) => { const q = new THREE.Color(c); q.multiplyScalar(k); return [q.r, q.g, q.b]; };
  // Torso (Ursprung = Hüftgelenk)
  add(T, capG(0.15, 0.3), top, 0, 0.35, 0, 1.2 * b, 1, 0.78 * b);
  add(T, capG(0.13, 0.12), shade(top, 0.9), 0, 0.12, 0, 1.18 * b, 1, 0.82 * b);
  if (suit) { // Revers
    add(T, boxG, shade(top, 0.82), -0.07, 0.42, 0.125 * b, 0.05, 0.36, 0.02, 0, 0, 0.35); add(T, boxG, shade(top, 0.82), 0.07, 0.42, 0.125 * b, 0.05, 0.36, 0.02, 0, 0, -0.35);
    add(T, boxG, tstyle === 'tux' ? 0x111111 : 0xe8e8ee, 0, 0.42, 0.122 * b, 0.07, 0.34, 0.02);
    if (tstyle === 'tux') add(T, boxG, 0x111111, 0, 0.6, 0.13 * b, 0.1, 0.04, 0.03); else add(T, boxG, 0xb71c1c, 0, 0.38, 0.13 * b, 0.035, 0.25, 0.02);
  }
  if (tstyle === 'coat') add(T, boxG, shade(top, 0.9), 0, -0.1, 0, 0.4, 0.3, 0.26);
  if (tstyle === 'hoodie') { add(T, sphG, shade(top, 0.9), 0, 0.68, -0.1, 0.14, 0.09, 0.1); }
  if (tstyle === 'jacket') { add(T, boxG, [0.03, 0.03, 0.03], 0, 0.5, 0.135 * b, 0.03, 0.4, 0.01); }
  if (tstyle === 'hawaii') for (let i = 0; i < 6; i++) add(T, sphG, [1, 0.9, 0.3], (i % 3 - 1) * 0.1, 0.25 + Math.floor(i / 3) * 0.2, 0.125 * b, 0.025, 0.025, 0.01);
  if (tstyle === 'tank') { add(T, capG(0.04, 0.05), skin, -0.15, 0.62, 0, 1, 1, 1); add(T, capG(0.04, 0.05), skin, 0.15, 0.62, 0, 1, 1, 1); }
  add(T, boxG, [0.06, 0.06, 0.06], 0, 0.0, 0, 0.36 * b, 0.05, 0.2 * b); // Gürtel
  // Hals + Kopf
  add(T, cylG, skin, 0, 0.68, 0, 0.05, 0.09, 0.05);
  add(T, sphG, skin, 0, 0.8, 0, 0.098, 0.12, 0.105);
  add(T, boxG, skin, 0, 0.78, 0.108, 0.025, 0.04, 0.03); // Nase
  add(T, sphG, [0.15, 0.1, 0.08], -0.04, 0.82, 0.095, 0.012, 0.012, 0.01); add(T, sphG, [0.15, 0.1, 0.08], 0.04, 0.82, 0.095, 0.012, 0.012, 0.01);
  add(T, sphG, skin, -0.1, 0.8, 0, 0.02, 0.035, 0.025); add(T, sphG, skin, 0.1, 0.8, 0, 0.02, 0.035, 0.025);
  // Haare
  const hs = o.hairStyle;
  if (hs === 1 || hs === 2 || hs === 5 || hs === 6) { add(T, sphG, hair, 0, 0.835, -0.01, 0.108, 0.11, 0.115); }
  if (hs === 2) add(T, boxG, hair, -0.07, 0.9, 0.06, 0.05, 0.02, 0.1);
  if (hs === 3) for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; add(T, sphG, hair, Math.cos(a) * 0.08, 0.88 + (i % 2) * 0.02, Math.sin(a) * 0.08 - 0.01, 0.05, 0.05, 0.05); } 
  if (hs === 3) add(T, sphG, hair, 0, 0.9, 0, 0.09, 0.07, 0.09);
  if (hs === 4) add(T, boxG, hair, 0, 0.93, 0, 0.03, 0.07, 0.18);
  if (hs === 5) { add(T, boxG, hair, 0, 0.7, -0.08, 0.2, 0.28, 0.05); add(T, capG(0.03, 0.1), hair, -0.1, 0.72, -0.02, 1, 1, 1); add(T, capG(0.03, 0.1), hair, 0.1, 0.72, -0.02, 1, 1, 1); }
  if (hs === 6) add(T, capG(0.035, 0.2), hair, 0, 0.72, -0.13, 1, 1, 1, 0.25);
  if (hs === 7) add(T, sphG, hair, 0, 0.87, 0, 0.17, 0.15, 0.17);
  // Hüte
  const hat = o.hat, hc = o.hatColor;
  if (hat === 1 || hat === 5) { add(T, cylG, hc, 0, 0.9, 0, 0.11, 0.07, 0.115); add(T, boxG, hc, 0, 0.875, 0.11, 0.14, 0.015, 0.1); if (hat === 5) add(T, boxG, [1, 0.85, 0.2], 0, 0.91, 0.115, 0.03, 0.03, 0.01); }
  if (hat === 2) { add(T, sphG, hc, 0, 0.88, 0, 0.112, 0.09, 0.118); }
  if (hat === 3) { add(T, cylG, hc, 0, 0.93, 0, 0.1, 0.1, 0.1); add(T, cylG, hc, 0, 0.88, 0, 0.19, 0.012, 0.19); add(T, boxG, [0.1, 0.1, 0.1], 0, 0.92, 0, 0.206, 0.03, 0.206); }
  if (hat === 4) { add(T, cylG, [0.85, 0.72, 0.4], 0, 0.9, 0, 0.1, 0.07, 0.1); add(T, cylG, [0.85, 0.72, 0.4], 0, 0.875, 0, 0.26, 0.012, 0.26); }
  // Brille
  if (o.glasses === 1 || o.glasses === 3) add(T, boxG, [0.02, 0.02, 0.03], 0, 0.82, 0.098, 0.2, 0.04, 0.02);
  if (o.glasses === 2) { add(T, cylG, [0.15, 0.12, 0.05], -0.045, 0.815, 0.1, 0.05, 0.012, 0.045, Math.PI / 2); add(T, cylG, [0.15, 0.12, 0.05], 0.045, 0.815, 0.1, 0.05, 0.012, 0.045, Math.PI / 2); }
  if (o.glasses === 3) add(T, boxG, [0.8, 0.65, 0.2], 0, 0.84, 0.1, 0.21, 0.012, 0.02);
  // Becken
  add(P, capG(0.14, 0.04), bot, 0, 0.0, 0, 1.3 * b, 0.7, 0.8 * b);
  // Oberarm (Ursprung Schulter, nach unten)
  add(UA, capG(0.052, 0.19), skin, 0, -0.15, 0);
  const sleeve = long ? 0.95 : tstyle === 'tank' ? 0 : 0.5;
  if (sleeve > 0) add(UA, cylG, shade(top, 0.97), 0, -0.29 * sleeve / 2 + 0.02, 0, 0.062, 0.29 * sleeve, 0.062);
  add(UA, sphG, tstyle === 'tank' ? skin : top, 0, 0.0, 0, 0.065, 0.065, 0.065);
  // Unterarm (Ursprung Ellbogen)
  add(FA, capG(0.045, 0.2), long ? shade(top, 0.97) : skin, 0, -0.14, 0);
  add(FA, sphG, skin, 0, -0.29, 0, 0.05, 0.055, 0.045);
  if (long && suit) add(FA, cylG, [0.95, 0.95, 0.97], 0, -0.265, 0, 0.05, 0.03, 0.05);
  if (o.watch > 0) { const wc = [0, 0x90a4ae, 0x37474f, 0xffd54f, 0xe8f4ff, 0xd4af37][o.watch] || 0x90a4ae; add(FA, cylG, wc, 0, -0.24, 0, 0.055, 0.035, 0.055); add(FA, cylG, [0.05, 0.05, 0.08], 0.0, -0.24, 0.0, 0.058, 0.02, 0.058); }
  // Oberschenkel (Ursprung Hüfte)
  add(TH, capG(0.082, 0.3), skin, 0, -0.23, 0);
  add(TH, capG(0.092, bstyle === 'short' ? 0.22 : 0.3), bot, 0, bstyle === 'short' ? -0.18 : -0.23, 0);
  // Unterschenkel (Ursprung Knie)
  add(SH, capG(0.062, 0.3), skin, 0, -0.22, 0);
  if (bstyle === 'long') add(SH, capG(0.07, 0.3), bot, 0, -0.22, 0);
  // Schuhe
  const shc = o.shoeColor;
  add(SH, cylG, shc, 0, -0.4, 0.0, 0.075, 0.1, 0.075);
  add(SH, boxG, shc, 0, -0.45, 0.07, 0.11, 0.085, 0.27);
  add(SH, boxG, [0.92, 0.92, 0.92], 0, -0.495, 0.07, 0.115, 0.02, 0.28);
  if (o.shoe === 1) add(SH, cylG, shc, 0, -0.34, 0, 0.082, 0.16, 0.082);
  const out = {};
  for (const [k, mb] of Object.entries({ T, P, UA, FA, TH, SH })) out[k] = mb.build();
  return out;
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 });
const geoCache = new Map();
function getGeos(o) { const k = outfitKey(o); let g = geoCache.get(k); if (!g) { g = buildGeos(o); geoCache.set(k, g); } return g; }

export class Character {
  constructor(outfit = DEFAULT_OUTFIT) {
    this.outfit = { ...DEFAULT_OUTFIT, ...outfit };
    this.root = new THREE.Group();
    this.phase = Math.random() * 6; this.t = 0; this.blend = {};
    this.state = { speed: 0, sprint: false, aiming: false, weapon: 'fist', swim: false, sit: false, dead: false, punch: 0, jump: false, fear: 0, talk: false, hands: false, bike: false, umbrella: false, phone: false, drunk: false };
    this.deadT = 0; this.punchT = 0;
    this.build();
  }
  build() {
    // Alte Meshes entfernen (Geometrien sind gecacht)
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    const g = getGeos(this.outfit);
    const mk = (geo) => { const m = new THREE.Mesh(geo, MAT); m.castShadow = true; m.receiveShadow = false; return m; };
    this.body = new THREE.Group(); this.root.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = 0.95; this.body.add(this.hips);
    this.pelvis = mk(g.P); this.hips.add(this.pelvis);
    this.torso = new THREE.Group(); this.hips.add(this.torso); this.torso.add(mk(g.T));
    this.arms = []; this.legs = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.22 * (this.outfit.build || 1), 0.58, 0); this.torso.add(sh);
      const ua = mk(g.UA); sh.add(ua);
      const el = new THREE.Group(); el.position.y = -0.29; sh.add(el); el.add(mk(g.FA));
      this.arms.push({ sh, el });
      const hp = new THREE.Group(); hp.position.set(s * 0.1, -0.02, 0); this.hips.add(hp);
      hp.add(mk(g.TH));
      const kn = new THREE.Group(); kn.position.y = -0.43; hp.add(kn); kn.add(mk(g.SH));
      this.legs.push({ hp, kn });
    }
    // Waffen-/Objekt-Halter in der rechten Hand (arms[0] ist x=-1 = rechts?)
    // lokal +x = links, also s=-1 → rechte Seite.
    this.handR = new THREE.Group(); this.handR.position.set(0, -0.3, 0.03); this.arms[0].el.add(this.handR);
    this.handL = new THREE.Group(); this.handL.position.set(0, -0.3, 0.03); this.arms[1].el.add(this.handL);
    this.held = null;
  }
  setOutfit(o) { this.outfit = { ...this.outfit, ...o }; const h = this.held; this.build(); if (h) this.setHeld(h.name, h.obj); }
  setHeld(name, obj = null) {
    if (this.held) this.handR.remove(this.held.obj);
    this.held = null;
    if (!name) return;
    obj = obj || makeHeld(name);
    this.handR.add(obj); this.held = { name, obj };
  }
  get headWorld() { const v = new THREE.Vector3(0, 1.72, 0); return this.root.localToWorld(v); }

  update(dt, st = this.state) {
    this.t += dt;
    const s = st, sp = s.speed;
    const B = this.blend;
    const bd = (k, target, rate = 10) => (B[k] = damp(B[k] ?? target, target, rate, dt));
    // Ziel-Werte
    const walk = bd('walk', clamp(sp / 1.6, 0, 1) * (s.sit || s.swim || s.dead ? 0 : 1));
    const run = bd('run', clamp((sp - 2) / 4, 0, 1));
    const sit = bd('sit', s.sit ? 1 : 0, 12);
    const swim = bd('swim', s.swim ? 1 : 0, 6);
    const aim = bd('aim', s.aiming && !s.sit ? 1 : 0, 14);
    const dead = bd('dead', s.dead ? 1 : 0, 9);
    const fear = bd('fear', s.fear || 0, 8);
    const hands = bd('hands', s.hands ? 1 : 0, 10);
    const jump = bd('jump', s.jump ? 1 : 0, 14);
    this.phase += dt * (3.2 + sp * 1.5) * (sp > 0.2 ? 1 : 0);
    const ph = this.phase;
    const L = this.legs, A = this.arms;
    const amp = lerp(0.45, 1.05, run) * walk;
    const sw = Math.sin(ph) * amp;
    // Beine
    let tL = -sw, tR = sw;
    let kL = Math.max(0, Math.sin(ph + 1.1)) * 1.15 * amp * 0.9, kR = Math.max(0, Math.sin(ph + 1.1 + Math.PI)) * 1.15 * amp * 0.9;
    // sitzen
    tL = lerp(tL, -1.48, sit); tR = lerp(tR, -1.48, sit); kL = lerp(kL, 1.5, sit); kR = lerp(kR, 1.5, sit);
    // Schwimmen: Beinschlag
    const kick = Math.sin(this.t * 9) * 0.35 * swim;
    tL = lerp(tL, kick, swim); tR = lerp(tR, -kick, swim); kL = lerp(kL, 0.2, swim); kR = lerp(kR, 0.2, swim);
    // Sprung
    tL = lerp(tL, -0.7, jump); tR = lerp(tR, 0.2, jump); kL = lerp(kL, 1.1, jump); kR = lerp(kR, 0.4, jump);
    // Furcht/Hocken
    L[0].hp.rotation.x = tL; L[1].hp.rotation.x = tR; L[0].kn.rotation.x = kL; L[1].kn.rotation.x = kR;
    L[0].hp.rotation.z = -0.03; L[1].hp.rotation.z = 0.03;
    // Rumpf
    const bob = Math.abs(Math.sin(ph)) * 0.04 * walk * (1 + run);
    this.hips.position.y = 0.95 - 0.07 * run * walk - bob * 0.5 + bob * 0.3 - sit * 0.45 + jump * 0.0 - fear * 0.08;
    this.hips.position.y = lerp(this.hips.position.y, 0.95 - sit * 0.46, 0);
    this.torso.rotation.x = 0.12 * run * walk + 0.06 * Math.sin(this.t * 1.6) * (1 - walk) * 0.2 + fear * 0.25 + (s.drunk ? Math.sin(this.t * 1.7) * 0.12 : 0);
    this.torso.rotation.y = -Math.sin(ph) * 0.16 * walk * (1 + run) + (s.drunk ? Math.sin(this.t * 1.1) * 0.2 : 0);
    this.torso.rotation.z = (s.drunk ? Math.sin(this.t * 1.3) * 0.1 : 0);
    this.torso.scale.y = 1 + Math.sin(this.t * 2.2) * 0.008;
    // Arme (positives x = nach hinten; negativ = vorne)
    let aL = Math.sin(ph) * amp * 0.9, aR = -Math.sin(ph) * amp * 0.9;
    let eL = -0.3 - run * 0.9 * walk, eR = -0.3 - run * 0.9 * walk;
    let zL = 0, zR = 0;
    // Idle-Haltung
    aL = lerp(aL, 0, 0); 
    // sitzend: Hände am Lenkrad
    aL = lerp(aL, -0.95, sit); aR = lerp(aR, -0.95, sit); eL = lerp(eL, -0.5, sit); eR = lerp(eR, -0.5, sit);
    // Zielen (rechter Arm = arms[0])
    const wep = s.weapon;
    if (aim > 0.01) {
      aR = lerp(aR, -1.5, aim); eR = lerp(eR, -0.1, aim); zR = lerp(zR, 0.0, aim);
      if (wep !== 'pistol') { aL = lerp(aL, -1.35, aim); eL = lerp(eL, -0.45, aim); zL = lerp(zL, -0.45, aim); } else { aL = lerp(aL, -1.2, aim); eL = lerp(eL, -0.5, aim); zL = lerp(zL, -0.35, aim); }
    } else if (s.weapon && s.weapon !== 'fist' && !s.sit) { aR = lerp(aR, -0.5, 0.6); eR = lerp(eR, -1.0, 0.6); }
    if (s.umbrella) { aR = -0.55; eR = -1.55; }
    if (s.phone) { aR = -1.2; eR = -1.9; zR = 0.1; }
    // Schwimmen
    const stroke = Math.sin(this.t * 4.5) * swim;
    aL = lerp(aL, -2.4 + stroke * 1.1, swim); aR = lerp(aR, -2.4 - stroke * 1.1, swim); eL = lerp(eL, -0.2, swim); eR = lerp(eR, -0.2, swim);
    // Sprung
    aL = lerp(aL, -2.6, jump); aR = lerp(aR, -2.6, jump);
    // Hände hoch / Furcht / Reden
    aL = lerp(aL, -2.9, hands); aR = lerp(aR, -2.9, hands); eL = lerp(eL, -0.4, hands); eR = lerp(eR, -0.4, hands);
    aL = lerp(aL, -2.3 + Math.sin(this.t * 14) * 0.2, fear * 0.7); aR = lerp(aR, -2.3 + Math.sin(this.t * 15) * 0.2, fear * 0.7);
    if (s.talk) { const g1 = Math.sin(this.t * 2.3) * 0.5 + Math.sin(this.t * 5.1) * 0.2; aR = lerp(aR, -0.9 + g1 * 0.5, 0.8); eR = lerp(eR, -1.4 + g1 * 0.4, 0.8); aL = lerp(aL, -0.35 + Math.sin(this.t * 1.7) * 0.25, 0.7); eL = lerp(eL, -0.9, 0.7); }
    // Schlag
    if (this.punchT > 0) {
      this.punchT -= dt; const k = Math.sin((1 - this.punchT / 0.28) * Math.PI);
      aR = lerp(aR, -1.65, k); eR = lerp(eR, -0.05, k); this.torso.rotation.y += k * 0.5;
    }
    A[0].sh.rotation.x = aR; A[1].sh.rotation.x = aL; A[0].el.rotation.x = eR; A[1].el.rotation.x = eL;
    A[0].sh.rotation.z = zR - 0.08 - hands * 0.2; A[1].sh.rotation.z = zL + 0.08 + hands * 0.2;
    // Gesamt: Schwimmen / Tot
    this.body.rotation.x = swim * 1.35 + dead * -1.55;
    this.body.position.y = swim * 0.2 + dead * 0.2;
    this.body.position.z = swim * -0.1;
    if (dead > 0.01) { L[0].hp.rotation.x = lerp(L[0].hp.rotation.x, 0.2, dead); L[1].hp.rotation.x = lerp(L[1].hp.rotation.x, -0.15, dead); A[0].sh.rotation.z += 0.5 * dead; A[1].sh.rotation.z -= 0.5 * dead; }
    this.torso.rotation.x -= 0; 
  }
  punch() { this.punchT = 0.28; }
}

function makeHeld(name) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.35, metalness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.7 });
  const bx = (w, h, d, x, y, z, m = dark) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh; };
  if (name === 'pistol') { bx(0.035, 0.05, 0.2, 0, 0.03, 0.1); bx(0.032, 0.11, 0.045, 0, -0.03, 0.03); }
  else if (name === 'smg') { bx(0.045, 0.07, 0.34, 0, 0.03, 0.14); bx(0.03, 0.15, 0.05, 0, -0.07, 0.1); bx(0.03, 0.12, 0.04, 0, -0.02, 0.2); }
  else if (name === 'shotgun') { bx(0.04, 0.05, 0.75, 0, 0.04, 0.3); bx(0.05, 0.08, 0.25, 0, 0.0, 0.02, wood); }
  else if (name === 'rifle') { bx(0.045, 0.07, 0.8, 0, 0.04, 0.3); bx(0.05, 0.1, 0.22, 0, 0.0, -0.05, wood); bx(0.03, 0.12, 0.05, 0, -0.07, 0.2); }
  else if (name === 'grenade') { const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshStandardMaterial({ color: 0x3d4f2a })); m.position.set(0, 0.02, 0.04); g.add(m); }
  else if (name === 'umbrella') {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x8e24aa, roughness: 0.6, side: THREE.DoubleSide }));
    c.position.set(0, 0.55, 0.05); g.add(c); bx(0.015, 0.7, 0.015, 0, 0.25, 0.05);
  }
  g.rotation.x = Math.PI / 2 * 0; 
  return g;
}
export function weaponColorMat(obj, color) { obj.traverse((o) => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.setHex(color); } }); }
export { makeHeld };
