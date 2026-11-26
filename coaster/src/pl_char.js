// ============================================================================
//  pl_char.js – Menschen im Stil von „Vice City“: nutzt die Character-Klasse des Hauptspiels
//  (/src/character.js) für Spieler, Mitspieler und nahe Besucher. Dazu Zubehör (Umhang, Helm,
//  Krone, Flügel …), Look-Verwaltung, 3D-Vorschau und ein LOD-Pool für Besucher.
// ============================================================================
import * as THREE from 'three';
import { Character, DEFAULT_OUTFIT } from '../../src/character.js';
const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export { Character, DEFAULT_OUTFIT };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------------ Zubehör
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const metal = c => mat(c, { roughness: 0.3, metalness: 0.85 });
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const HEAD_Y = 0.8;
const rot = (o, x = 0, y = 0, z = 0) => { o.rotation.set(x, y, z); return o; };

// Jeder Baustein: { slot: 'torso' | 'hips', make(color) -> { group, update?(dt, speed, t) } }
export const EXTRAS = {
  cape: { label: 'Umhang', slot: 'torso', color: 0xb71c1c, make(c) {
    const g = new THREE.Group(); g.position.set(0, 0.64, -0.135);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.92, 4, 6), mat(c, { side: THREE.DoubleSide, roughness: 0.85 })); cl.geometry.translate(0, -0.46, 0); cl.castShadow = true; g.add(cl);
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), metal(0xd4af37), 0, 0.01, 0.02));
    return { group: g, update(dt, sp, t) { g.rotation.x = 0.1 + Math.min(1, sp / 4) * 0.35 + Math.sin(t * 6) * 0.04 * Math.min(1, sp / 3); } };
  } },
  helmet: { label: 'Ritterhelm', slot: 'torso', color: 0xaab4bc, make(c) {
    const g = new THREE.Group(); g.position.set(0, HEAD_Y + 0.045, 0);
    g.add(mesh(new THREE.SphereGeometry(0.127, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.66), metal(c)));
    g.add(mesh(new THREE.BoxGeometry(0.028, 0.15, 0.02), metal(c), 0, -0.04, 0.12)); // Nasenschutz
    g.add(mesh(new THREE.BoxGeometry(0.02, 0.06, 0.2), mat(0xb71c1c), 0, 0.14, 0)); // Kamm
    return { group: g };
  } },
  crown: { label: 'Krone', slot: 'torso', color: 0xffd54f, make(c) {
    const g = new THREE.Group(); g.position.set(0, HEAD_Y + 0.12, 0);
    g.add(mesh(new THREE.CylinderGeometry(0.098, 0.092, 0.045, 14, 1, true), metal(c)));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(mesh(new THREE.ConeGeometry(0.02, 0.06, 5), metal(c), Math.cos(a) * 0.092, 0.05, Math.sin(a) * 0.092)); }
    g.add(mesh(new THREE.SphereGeometry(0.014, 6, 5), mat(0xe53935, { emissive: 0x802020 }), 0, 0.0, 0.098));
    return { group: g };
  } },
  goggles: { label: 'Fliegerbrille', slot: 'torso', color: 0x6a4a2a, make(c) {
    const g = new THREE.Group(); g.position.set(0, HEAD_Y + 0.085, 0.0);
    g.add(rot(mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 16), mat(c, { roughness: 0.9 }), 0, 0, 0), Math.PI / 2));
    for (const s of [-1, 1]) { const l = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 12), mat(0x9ad8ff, { roughness: 0.1, metalness: 0.4, emissive: 0x204060 }), s * 0.05, 0.005, 0.098); l.rotation.x = Math.PI / 2; g.add(l); g.add(mesh(new THREE.TorusGeometry(0.037, 0.008, 6, 12), metal(0xb08a3a), s * 0.05, 0.005, 0.1)); }
    return { group: g };
  } },
  scarf: { label: 'Schal', slot: 'torso', color: 0xf5f5f5, make(c) {
    const g = new THREE.Group(); g.position.set(0, 0.66, 0);
    const t = mesh(new THREE.TorusGeometry(0.078, 0.032, 8, 14), mat(c, { roughness: 0.95 })); t.rotation.x = Math.PI / 2; g.add(t);
    const tail = mesh(new THREE.BoxGeometry(0.07, 0.34, 0.016), mat(c, { roughness: 0.95 }), 0.05, -0.17, -0.09); g.add(tail);
    return { group: g, update(dt, sp, t2) { tail.rotation.x = 0.1 + Math.min(1, sp / 4) * 0.7 + Math.sin(t2 * 7) * 0.06 * Math.min(1, sp / 3); } };
  } },
  backpack: { label: 'Rucksack', slot: 'torso', color: 0x8a7a50, make(c) {
    const g = new THREE.Group(); g.position.set(0, 0.36, -0.175);
    g.add(mesh(new THREE.BoxGeometry(0.26, 0.34, 0.13), mat(c, { roughness: 0.9 })));
    g.add(rot(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), mat(0x4a5a3a), 0, 0.2, 0.0), 0, 0, Math.PI / 2));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.1, 0.03), mat(0x5a4a30), 0, -0.06, -0.075));
    return { group: g };
  } },
  pith: { label: 'Tropenhelm', slot: 'torso', color: 0xe8d8b0, make(c) {
    const g = new THREE.Group(); g.position.set(0, HEAD_Y + 0.05, 0);
    g.add(mesh(new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(c, { roughness: 0.95 })));
    g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 16), mat(c, { roughness: 0.95 }), 0, -0.03, 0));
    g.add(mesh(new THREE.TorusGeometry(0.118, 0.012, 6, 16), mat(0x6a4a2a)).rotateX(Math.PI / 2));
    return { group: g };
  } },
  sombrero: { label: 'Sombrero', slot: 'torso', color: 0xd9b45a, make(c) {
    const g = new THREE.Group(); g.position.set(0, HEAD_Y + 0.09, 0);
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.014, 20), mat(c, { roughness: 0.95 }), 0, -0.01, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.11, 0.12, 14), mat(c, { roughness: 0.95 }), 0, 0.06, 0));
    g.add(rot(mesh(new THREE.TorusGeometry(0.098, 0.012, 6, 16), metal(0xd4af37), 0, 0.012, 0), Math.PI / 2));
    return { group: g };
  } },
  horns: { label: 'Drachenhörner', slot: 'torso', color: 0xe8e0c8, make(c) {
    const g = new THREE.Group(); g.position.set(0, HEAD_Y + 0.07, 0.01);
    for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.026, 0.14, 7), mat(c, { roughness: 0.5 }), s * 0.07, 0.05, 0); h.rotation.z = -s * 0.45; g.add(h); }
    return { group: g };
  } },
  tail: { label: 'Drachenschwanz', slot: 'hips', color: 0x2e7d32, make(c) {
    const g = new THREE.Group(); g.position.set(0, 0.02, -0.12); const seg = [];
    for (let i = 0; i < 7; i++) { const r = 0.06 - i * 0.007, s = mesh(new THREE.SphereGeometry(Math.max(0.012, r), 8, 6), mat(c, { roughness: 0.55 }), 0, -i * 0.012, -0.09 - i * 0.09); seg.push(s); g.add(s); }
    g.add(rot(mesh(new THREE.ConeGeometry(0.03, 0.09, 6), mat(0xffd54f), 0, -0.1, -0.78), -Math.PI / 2));
    return { group: g, update(dt, sp, t) { seg.forEach((s, i) => { s.position.x = Math.sin(t * 3 + i * 0.7) * 0.025 * (i + 1) * (0.4 + Math.min(1, sp / 3)); }); } };
  } },
  wizardhat: { label: 'Zauberhut', slot: 'torso', color: 0x4a2a8a, make(c) {
    const g = new THREE.Group(); g.position.set(0, HEAD_Y + 0.07, 0);
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 18), mat(c), 0, -0.02, 0));
    const cone = mesh(new THREE.ConeGeometry(0.115, 0.34, 14), mat(c), 0, 0.16, -0.02); cone.rotation.x = -0.18; g.add(cone);
    g.add(rot(mesh(new THREE.TorusGeometry(0.112, 0.012, 6, 16), metal(0xd4af37), 0, 0.0, 0), Math.PI / 2));
    return { group: g };
  } },
  santahat: { label: 'Zipfelmütze', slot: 'torso', color: 0xd32f2f, make(c) {
    const g = new THREE.Group(); g.position.set(0, HEAD_Y + 0.07, 0);
    const cone = mesh(new THREE.ConeGeometry(0.105, 0.26, 12), mat(c, { roughness: 0.95 }), 0, 0.12, -0.03); cone.rotation.x = -0.4; g.add(cone);
    g.add(mesh(new THREE.TorusGeometry(0.108, 0.025, 8, 16), mat(0xffffff, { roughness: 1 })).rotateX(Math.PI / 2));
    g.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xffffff, { roughness: 1 }), 0, 0.2, -0.13));
    return { group: g };
  } },
  beard: { label: 'Bart', slot: 'torso', color: 0xf5f5f5, make(c) {
    const g = new THREE.Group(); g.position.set(0, HEAD_Y - 0.045, 0.075);
    const b = mesh(new THREE.SphereGeometry(0.075, 10, 8), mat(c, { roughness: 1 })); b.scale.set(1.15, 1.2, 0.8); b.position.y = -0.04; g.add(b);
    g.add(rot(mesh(new THREE.CapsuleGeometry(0.018, 0.07, 3, 6), mat(c, { roughness: 1 }), 0, 0.03, 0.045), 0, 0, Math.PI / 2));
    return { group: g };
  } },
  wings: { label: 'Feenflügel', slot: 'torso', color: 0xbfe8ff, make(c) {
    const g = new THREE.Group(); g.position.set(0, 0.46, -0.13); const wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(s * 0.04, 0, 0);
      for (const [r, ox, oy, sc] of [[0.2, 0.17, 0.12, 1], [0.13, 0.12, -0.12, 0.8]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 14), mat(c, { transparent: true, opacity: 0.62, side: THREE.DoubleSide, emissive: 0x6aa0c0, emissiveIntensity: 0.5, roughness: 0.2 })); m.scale.set(1, 1.5 * sc, 1); m.position.set(s * ox, oy, 0); w.add(m); }
      g.add(w); wings.push([w, s]);
    }
    return { group: g, update(dt, sp, t) { wings.forEach(([w, s]) => { w.rotation.y = s * (0.5 + Math.sin(t * (4 + sp)) * 0.22); }); } };
  } },
  halo: { label: 'Heiligenschein', slot: 'torso', color: 0xfff3a0, make(c) {
    const g = new THREE.Group(); g.position.set(0, HEAD_Y + 0.2, 0);
    const t = mesh(new THREE.TorusGeometry(0.09, 0.011, 8, 20), mat(c, { emissive: c, emissiveIntensity: 1.4 })); t.rotation.x = Math.PI / 2; g.add(t);
    return { group: g, update(dt, sp, tt) { g.position.y = HEAD_Y + 0.2 + Math.sin(tt * 2) * 0.01; } };
  } },
};

// ------------------------------------------------------------------ Look = { outfit, extras:[[name, colorHex|null]] }
export const defaultLook = () => ({ outfit: { ...DEFAULT_OUTFIT, topColor: 0x1e88e5 }, extras: [] });
export function cloneLook(l) { return JSON.parse(JSON.stringify(l)); }

// Figur (Character) + Zubehör + Animationszustand
export class CharView {
  constructor(look = defaultLook()) {
    this.char = new Character(look.outfit); this.root = this.char.root; this.extras = []; this.t = Math.random() * 10; this.look = cloneLook(look);
    this.setLook(look);
  }
  get group() { return this.root; }
  setLook(look) {
    this.look = cloneLook(look); this.char.setOutfit(look.outfit);
    this.extras = [];
    for (const [name, color] of look.extras || []) {
      const def = EXTRAS[name]; if (!def) continue;
      const e = def.make(color ?? def.color); const parent = def.slot === 'hips' ? this.char.hips : this.char.torso;
      parent.add(e.group); this.extras.push(e);
    }
  }
  // st: { speed, sit, jump, talk, hands, ... }
  update(dt, st) {
    this.t += dt; const s = this.char.state;
    s.speed = st.speed || 0; s.sit = !!st.sit; s.jump = !!st.jump; s.talk = !!st.talk; s.hands = !!st.hands; s.fear = st.fear || 0;
    this.char.update(dt, s);
    for (const e of this.extras) if (e.update) e.update(dt, s.speed, this.t);
  }
  show(v) { this.root.visible = v; }
}

// ------------------------------------------------------------------ Fahrgäste in Zügen: Vice-City-Figur als feste Pose in die Zug-Geometrie einbacken
let scratch = null, riderPool = null;
export function bakeRider(batch, st, spec, rng, up) {
  if (!scratch) { scratch = new Character(DEFAULT_OUTFIT); riderPool = visitorLooks(mulberry32(97), 28); }
  const look = riderPool[Math.floor(rng() * riderPool.length)], c = scratch;
  c.setOutfit(look.outfit); c.root.rotation.set(0, 0, 0); c.root.position.set(0, 0, 0); c.root.scale.set(1, 1, 1);
  const fly = spec.rider === 'fly', dangle = spec.rider === 'inv' || spec.rider === 'floor' || spec.rider === 'wing';
  const s = c.state; for (const k of Object.keys(s)) s[k] = typeof s[k] === 'number' ? 0 : false; s.weapon = 'fist';
  if (fly) s.swim = true; else { s.sit = true; s.hands = !!up; }
  c.blend = {}; c.update(0.016, s);
  if (!fly && dangle) for (const l of c.legs) { l.hp.rotation.x = -0.28; l.kn.rotation.x = 0.4; }
  if (fly) { c.body.position.y = 0.05; }
  const seat = new THREE.Matrix4().makeRotationY(Math.PI / 2); // Figur schaut nach +z → Zug fährt nach +x
  seat.setPosition(fly ? st.x - 0.85 : st.x - 0.02, fly ? 0.12 : -0.36, st.z);
  c.root.updateMatrixWorld(true); const M = new THREE.Matrix4();
  c.root.traverse(o => { if (o.isMesh) { M.multiplyMatrices(seat, o.matrixWorld); batch.addGeometry(o.geometry, M); } });
}

// ------------------------------------------------------------------ Vorschau (Offscreen-Rendering ins 2D-Canvas)
export class Preview {
  constructor(app, w = 260, h = 360) {
    this.app = app; this.w = w; this.h = h; this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(26, w / h, 0.1, 50);
    this.scene.add(new THREE.HemisphereLight(0xdfeaff, 0x4a4036, 1.15));
    const d = new THREE.DirectionalLight(0xfff0dd, 3.0); d.position.set(3, 5, 6); this.scene.add(d);
    const d2 = new THREE.DirectionalLight(0x88aaff, 1.0); d2.position.set(-5, 2, -3); this.scene.add(d2);
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.9 })); this.floor.rotation.x = -Math.PI / 2; this.scene.add(this.floor);
    this.view = new CharView(defaultLook()); this.scene.add(this.view.root);
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, samples: 4 });
    this.buf = new Uint8Array(w * h * 4); this.ang = 0.5; this.cam.position.set(0, 1.25, 4.4); this.cam.lookAt(0, 0.9, 0);
    this.lut = Array.from({ length: 256 }, (_, i) => Math.min(255, Math.round(255 * Math.pow(i / 255, 1 / 2.2) * 1.05)));
    this.cv = null; this.timer = 0;
  }
  setLook(look) { this.view.setLook(look); }
  attach(canvas) { this.cv = canvas; canvas.width = this.w; canvas.height = this.h; this.start(); }
  start() { this.stop(); this.timer = setInterval(() => this.draw(0.07), 70); this.draw(0); }
  stop() { clearInterval(this.timer); this.timer = 0; }
  draw(dt) {
    const cv = this.cv; if (!cv || !cv.isConnected) { this.stop(); return; }
    const r = this.app.renderer; this.ang += dt * 0.9 * (this.spin === false ? 0 : 1); this.view.root.rotation.y = this.ang; this.view.update(dt, { speed: 0 });
    this.scene.environment = this.app.scene.environment; this.scene.environmentIntensity = Math.max(0.4, this.app.scene.environmentIntensity || 0.8);
    const old = r.getRenderTarget(), shadow = r.shadowMap.enabled, oc = new THREE.Color(); r.getClearColor(oc); const oa = r.getClearAlpha();
    r.shadowMap.enabled = false; r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.clear(); r.render(this.scene, this.cam);
    r.readRenderTargetPixels(this.rt, 0, 0, this.w, this.h, this.buf);
    r.setRenderTarget(old); r.setClearColor(oc, oa); r.shadowMap.enabled = shadow;
    const g = cv.getContext('2d'), img = g.createImageData(this.w, this.h), lut = this.lut;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) { const s = ((this.h - 1 - j) * this.w + i) * 4, o = (j * this.w + i) * 4; img.data[o] = lut[this.buf[s]]; img.data[o + 1] = lut[this.buf[s + 1]]; img.data[o + 2] = lut[this.buf[s + 2]]; img.data[o + 3] = this.buf[s + 3]; }
    g.putImageData(img, 0, 0);
  }
  dispose() { this.stop(); this.rt.dispose(); }
}

// ------------------------------------------------------------------ LOD-Pool: nahe Besucher/Personal als echte Figuren
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export class CharPool {
  constructor(scene, size = 40, radius = 46) {
    this.scene = scene; this.size = size; this.radius = radius; this.slots = []; this.t = 0; this.pickT = 0; this.assigned = new Map();
    for (let i = 0; i < size; i++) { const v = new CharView(defaultLook()); v.show(false); scene.add(v.root); this.slots.push({ view: v, who: null, key: '' }); }
  }
  setSize(n) { n = Math.max(0, Math.min(this.slots.length, n)); this.size = n; for (let i = n; i < this.slots.length; i++) { this.slots[i].who = null; this.slots[i].view.show(false); } }
  // people: Array von { x, z, y, yaw, walking, speed, sit, kid, talk, hands, look, hidden(mesh-Callback) }
  update(dt, cam, people, hide) {
    this.t += dt; this.pickT -= dt;
    if (this.pickT <= 0) { // alle 0,25 s: die nächsten Personen den Figuren zuweisen (mit Trägheit)
      this.pickT = 0.25; const R2 = this.radius * this.radius, near = [];
      for (let i = 0; i < people.length; i++) { const p = people[i], dx = p.x - cam.x, dz = p.z - cam.z, d = dx * dx + dz * dz; if (d < R2) near.push([d, i]); }
      near.sort((a, b) => a[0] - b[0]); const want = new Set(near.slice(0, this.size).map(n => n[1]));
      for (const s of this.slots) if (s.who !== null && !want.has(s.who)) { s.who = null; s.view.show(false); }
      const have = new Set(this.slots.filter(s => s.who !== null).map(s => s.who));
      for (const idx of want) { if (have.has(idx)) continue; const s = this.slots.find((q, k) => k < this.size && q.who === null); if (!s) break; s.who = idx; const p = people[idx]; const key = JSON.stringify(p.look); if (s.key !== key) { s.view.setLook(p.look); s.key = key; } s.view.show(true); }
    }
    for (const s of this.slots) {
      if (s.who === null) continue; const p = people[s.who]; if (!p) { s.who = null; s.view.show(false); continue; }
      const r = s.view.root; r.position.set(p.x, p.y, p.z); r.rotation.y = p.yaw; const k = p.kid ? 0.74 : 1; r.scale.set(k, k, k);
      s.view.update(dt, { speed: p.walking ? Math.min(2.4, p.speed * 1.35) : 0, sit: p.sit, talk: p.talk, hands: p.hands });
      hide(s.who);
    }
  }
}

// Zufällige, stimmige Besucher-Outfits (kleines Set, damit die Geometrie gecacht bleibt)
export function visitorLooks(rng, n = 40) {
  const pick = a => a[Math.floor(rng() * a.length)];
  const SKIN = [0xf1c9a5, 0xe0ac86, 0xc68642, 0x8d5524, 0x5c3a21, 0xffdbac], HAIR = [0x15110e, 0x3b2a1e, 0x6b4a2b, 0xb98b4a, 0xe8d28c, 0xa0361e, 0xcfcfd4];
  const PAL = [0xf5f5f5, 0x1b1b1f, 0x1e88e5, 0xe53935, 0x43a047, 0xfdd835, 0xff7043, 0x8e24aa, 0x00acc1, 0x6d4c41, 0x607d8b, 0xf48fb1];
  const BOT = [0x37474f, 0x1a237e, 0x4e342e, 0x263238, 0x607d8b, 0x6d4c41, 0x1b1b1f, 0xb0bec5];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ outfit: { ...DEFAULT_OUTFIT, skin: pick(SKIN), hairStyle: Math.floor(rng() * 8), hairColor: pick(HAIR), top: pick([0, 0, 1, 1, 2, 3, 4, 5, 6]), topColor: pick(PAL), bottom: pick([0, 0, 1, 2, 4]), bottomColor: pick(BOT), shoe: pick([0, 0, 1, 2]), shoeColor: pick([0xf5f5f5, 0x212121, 0x6d4c41, 0xc62828]), hat: rng() < 0.16 ? 1 + Math.floor(rng() * 4) : 0, hatColor: pick(PAL), glasses: rng() < 0.2 ? 1 + Math.floor(rng() * 2) : 0, watch: rng() < 0.2 ? 1 : 0, build: 0.9 + rng() * 0.22 }, extras: rng() < 0.08 ? [['backpack', pick([0x8a7a50, 0x2a4a8a, 0xa02a2a])]] : [] });
  }
  return out;
}
export const staffLook = () => ({ outfit: { ...DEFAULT_OUTFIT, skin: 0xe0ac86, top: 5, topColor: 0xe8a010, bottom: 0, bottomColor: 0x20242c, shoe: 1, shoeColor: 0x1a1a1c, hat: 1, hatColor: 0xe8a010, build: 1 }, extras: [] });
