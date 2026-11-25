// Fahrzeuge: Instanziierung, Physik (Auto/Bike/Boot/Flugzeug/Heli), Schaden, Kollisionen
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep, wrapPI, RNG } from './util.js';
import { getModel, wheelGeometry } from './vehiclemodels.js';
import { CATALOG, byKey } from './vehicledata.js';
import { terrainH, SEA } from './world.js';

const G_ = 9.81;
const MAT = {};
function mats() {
  if (MAT.trim) return MAT;
  MAT.trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 });
  MAT.glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1118, roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.62, envMapIntensity: 1.4, clearcoat: 1, depthWrite: false });
  MAT.wheel = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 });
  MAT.paint = new Map();
  return MAT;
}
export function paintMat(hex, dmg = 0) {
  const M = mats();
  const k = hex + '_' + dmg;
  let m = M.paint.get(k);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.38, metalness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 1 });
    if (dmg > 0) m.color.lerp(new THREE.Color(0x151515), dmg * 0.7);
    M.paint.set(k, m);
  }
  return m;
}
const basic = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
let _uid = 1;

// Modell → THREE.Group
export function instantiate(spec, colorHex) {
  const M = mats(), model = getModel(spec);
  const g = new THREE.Group();
  const parts = { model, wheels: [], lights: {} };
  const add = (name, mat, cast = true) => {
    const geo = model.geos[name]; if (!geo) return null;
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m;
  };
  parts.paint = add('paint', paintMat(colorHex));
  add('trim', M.trim); 
  const gl = add('glass', M.glass, false); if (gl) gl.renderOrder = 3;
  parts.head = add('head', basic(0x887f70), false); parts.tail = add('tail', basic(0x550808), false);
  parts.barR = add('barR', basic(0xff2020), false); parts.barB = add('barB', basic(0x2050ff), false);
  parts.neon = add('neon', basic(0xff30d8), false); parts.sign = add('signLit', basic(0xffe9a0), false);
  if (parts.barR) parts.barR.visible = false; if (parts.barB) parts.barB.visible = false;
  for (const w of model.wheels) {
    const outer = new THREE.Group(); outer.position.set(w.x, w.y, w.z);
    const steer = new THREE.Group(); const flip = new THREE.Group(); if (w.side < 0) flip.rotation.y = Math.PI;
    const spin = new THREE.Mesh(wheelGeometry(w.r, w.w, model.wheelStyle), M.wheel); spin.castShadow = true;
    flip.add(spin); steer.add(flip); outer.add(steer); g.add(outer);
    parts.wheels.push({ outer, steer, spin, def: w, angle: 0, flipSign: w.side < 0 ? -1 : 1 });
  }
  parts.extra = [];
  for (const e of model.extra || []) {
    const grp = new THREE.Group(); grp.position.set(...e.pos);
    const bm = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.6 });
    const n = e.blades || 2;
    if (e.type === 'prop') { for (let b = 0; b < n; b++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, e.r * 2, 0.03), bm); blade.rotation.z = b * Math.PI / n; grp.add(blade); } const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd })); sp.rotation.x = Math.PI / 2; sp.position.z = 0.2; grp.add(sp); }
    else if (e.type === 'rotor') { for (let b = 0; b < n; b++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(e.r * 2, 0.04, 0.22), bm); blade.rotation.y = b * Math.PI / n; grp.add(blade); } }
    else if (e.type === 'tailrotor') { for (let b = 0; b < 2; b++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, e.r * 2, 0.12), bm); blade.rotation.x = b * Math.PI / 2; grp.add(blade); } }
    grp.userData.type = e.type; g.add(grp); parts.extra.push(grp);
  }
  return { group: g, parts };
}

const GEARS = [3.6, 2.4, 1.7, 1.25, 0.95, 0.75];

export class Vehicle {
  constructor(spec, colorHex, mgr) {
    this.mgr = mgr; this.spec = spec; this.model = getModel(spec); this.id = _uid++;
    this.color = colorHex ?? spec.color; this.kind = spec.kind;
    const inst = instantiate(spec, this.color); this.group = inst.group; this.parts = inst.parts;
    this.group.userData.vehicle = this;
    this.pos = this.group.position;
    this.yaw = 0; this.u = 0; this.v = 0; this.omega = 0; this.vy = 0; this.air = false; this.pitch = 0; this.roll = 0;
    this.steer = 0; this.steerAng = 0;
    this.in = { throttle: 0, steer: 0, brake: 0, hand: false, pitch: 0, roll: 0, yaw: 0, collective: 0, thr: 0 };
    this.health = 1000; this.fire = 0; this.burning = false; this.exploded = false; this.wreck = false; this.dmg = 0;
    this.driver = null; this.player = false; this.ai = null; this.ctrl = null; this.sleeping = true; this.sleepT = 0;
    this.rpm = 900; this.gear = 1; this.shiftT = 0; this.accel = 0;
    this.horn = false; this.lights = false; this.siren = false; this.engineOn = false; this.locked = false;
    this.skid = 0; this.slip = 0; this.speedKmh = 0;
    this.thr3 = 0;       // Flugzeug-Schub
    this.rotor = 0;      // Rotor-Drehzahl
    this.owned = false; this.tag = ''; this.passengers = [];
    this.gnd = 0; this.prevGnd = 0; this.lastHit = 0; this.inWater = false; this.drown = 0;
    this.flash = 0; this.carjackedBy = null;
    this.setupPhysics();
    this.circles = this.makeCircles();
  }
  setupPhysics() {
    const s = this.spec, m = this.mass = s.mass, L = s.wb || s.len * 0.6;
    const rearBias = s.cls === 'super' || s.cls === 'sport' ? 0.46 : s.cls === 'muscle' || s.cls === 'pickup' ? 0.52 : 0.5;
    this.a = L * (1 - rearBias); this.b = L - this.a;
    this.Iz = m * (s.len * s.len + s.wid * s.wid) / 12 * 0.95;
    const drive = s.cls === 'compact' || s.cls === 'sedan' || s.cls === 'taxi' || s.cls === 'van' ? 'f' : s.cls === 'super' || s.cls === 'suv' || s.cls === 'offroad' || s.cls === 'army' || s.cls === 'police' ? 'a' : 'r';
    this.drive = s.kind === 'bike' ? 'r' : drive;
    this.vtop = s.topMS;
    const a100 = 27.8 / Math.max(1.8, s.t100 || 8);
    this.F0 = m * a100 * 1.6; this.Pw = this.F0 * 13;
    this.mu = s.grip;
    this.k = 9;
    this.downforce = s.cls === 'super' ? 0.9 : s.cls === 'sport' ? 0.45 : 0;
    this.maxSteer = s.kind === 'bike' ? 0.5 : s.cls === 'bus' || s.cls === 'truck' ? 0.45 : 0.62;
    this.brakeF = m * G_ * Math.min(1.25, s.grip) * 1.05;
    this.size = Math.hypot(s.len, s.wid) / 2;
    if (s.kind === 'plane') { this.vlift = s.sub === 'jet' ? 75 : s.sub === 'cargo' ? 38 : s.sub === 'stunt' ? 28 : 26; this.pmax = s.topMS; }
    if (s.kind === 'heli') this.pmax = s.topMS;
    if (s.kind === 'boat') { this.thrustMax = m * (s.topMS / 5.5); }
    this.base = { F0: this.F0, Pw: this.Pw, vtop: this.vtop, mu: this.mu }; this.armorF = 1;
  }
  applyTune() {
    const t = this.tune || { e: 0, g: 0, a: 0, n: 0 }, b = this.base;
    this.F0 = b.F0 * (1 + 0.12 * t.e); this.Pw = b.Pw * (1 + 0.12 * t.e); this.vtop = b.vtop * (1 + 0.04 * t.e); this.mu = b.mu * (1 + 0.05 * t.g); this.armorF = 1 - 0.22 * t.a;
    if (t.n && !this.parts.neon) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(this.spec.wid * 0.95, this.spec.len * 0.9), new THREE.MeshBasicMaterial({ color: 0xff30d8, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      g.rotation.x = -Math.PI / 2; g.position.y = 0.08; this.group.add(g); this.parts.neon = g;
    }
  }
  makeCircles() {
    const s = this.spec, r = s.kind === 'plane' ? 1.1 : s.kind === 'heli' ? 1.2 : Math.max(0.4, s.wid / 2 * 0.92);
    const n = Math.max(1, Math.round(s.len / (r * 1.7)));
    const out = [];
    const half = s.len / 2 - r;
    for (let i = 0; i < n; i++) out.push({ z: n === 1 ? 0 : -half + (2 * half) * i / (n - 1), r });
    return out;
  }
  get speed() { return Math.hypot(this.u, this.v); }
  get vx() { return this.u * Math.sin(this.yaw) + this.v * Math.cos(this.yaw); }
  get vz() { return this.u * Math.cos(this.yaw) - this.v * Math.sin(this.yaw); }
  setWorldVel(vx, vz) { const s = Math.sin(this.yaw), c = Math.cos(this.yaw); this.u = vx * s + vz * c; this.v = vx * c - vz * s; }
  place(x, z, yaw, y = null) {
    this.pos.set(x, y ?? terrainH(x, z), z); this.yaw = yaw; this.u = this.v = this.omega = 0; this.vy = 0;
    if (this.kind === 'boat') this.pos.y = SEA;
    if (this.kind === 'plane') { this.pos.y = terrainH(x, z) + (this.model.groundY || 0.3); }
    if (this.kind === 'heli') { this.pos.y = terrainH(x, z) + 0.15; }
    this.group.rotation.set(0, yaw, 0, 'YXZ'); this.wake(); this.sleeping = true; this.sleepT = 99; this.gnd = this.prevGnd = this.pos.y;
  }
  wake() { this.sleeping = false; this.sleepT = 0; }
  get occupied() { return !!this.driver; }

  // ---- Schaden ----
  damage(amount, kind = 'crash', source = null) {
    if (this.remote) return;
    if (this.exploded || amount <= 0) return;
    amount *= this.armorF || 1;
    this.health -= amount;
    const dm = clamp(1 - this.health / 1000, 0, 1);
    if (Math.abs(dm - this.dmg) > 0.08) { this.dmg = Math.round(dm * 8) / 8; if (this.parts.paint && !this.exploded) this.parts.paint.material = paintMat(this.color, this.dmg); }
    if (this.health < 250 && !this.burning) { this.burning = true; this.fire = 0; }
    if (this.health <= 0) this.mgr.explode(this, source);
    if (this.health < 0) this.health = 0;
  }
  repair() { this.health = 1000; this.burning = false; this.fire = 0; this.dmg = 0; if (this.parts.paint && !this.wreck) this.parts.paint.material = paintMat(this.color, 0); }
  setColor(hex) { this.color = hex; if (this.parts.paint) this.parts.paint.material = paintMat(hex, this.dmg); }

  // ---- Update ----
  update(dt, W, env) {
    if (this.exploded) { this.updateVisual(dt); return; }
    if (this.kinematic) { this.updateVisual(dt); this.updateEffects(dt, env); return; }
    if (this.ctrl && this.driver && this.driver !== 'player') this.ctrl(dt);
    if (this.sleeping && !this.driver && !this.ctrl) { this.updateEffects(dt, env); return; }
    const sub = Math.max(1, Math.ceil(dt / 0.0085)); const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      if (this.kind === 'car' || this.kind === 'bike') this.stepCar(h, W);
      else if (this.kind === 'boat') this.stepBoat(h, W, env);
      else if (this.kind === 'plane') this.stepPlane(h, W);
      else this.stepHeli(h, W);
    }
    this.speedKmh = this.speed * 3.6;
    this.updateVisual(dt);
    this.updateEffects(dt, env);
    if (!this.driver && !this.ctrl && this.speed < 0.15 && !this.air && this.kind === 'car' || (!this.driver && this.kind !== 'car' && this.kind !== 'bike' && this.speed < 0.1)) { this.sleepT += dt; if (this.sleepT > 2.5) { this.sleeping = true; this.u = this.v = this.omega = 0; } } else this.sleepT = 0;
  }

  stepCar(dt, W) {
    const s = this.spec, I = this.in;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let u = this.u, v = this.v, w = this.omega;
    const living = this.health > 0 && !this.wreck;
    const hpF = 0.55 + 0.45 * smoothstep(0, 450, this.health);
    // Eingaben → Antrieb / Bremse
    let thr = living && this.driver ? I.throttle : 0, brake = I.brake, drv = 0;
    if (thr < 0 && u > 1.2) { brake = Math.max(brake, -thr); thr = 0; }
    else if (thr > 0 && u < -1.2) { brake = Math.max(brake, thr); thr = 0; }
    if (thr !== 0) {
      const vabs = Math.abs(u);
      const lim = thr > 0 ? this.vtop * 1.13 : this.vtop * 0.22;
      const f = Math.min(this.F0, this.Pw / Math.max(vabs, 2)) * (1 - Math.pow(Math.min(1, vabs / lim), 3));
      drv = thr * f * hpF * (thr < 0 ? 0.55 : 1);
    }
    // Lenkung
    const target = clamp(I.steer, -1, 1);
    const maxS = this.maxSteer / (1 + Math.pow(Math.abs(u) / (s.kind === 'bike' ? 11 : 8), 2.2));
    const rate = Math.abs(target) > Math.abs(this.steerAng / Math.max(maxS, 0.01)) ? 5 : 8;
    this.steerAng += (target * maxS - this.steerAng) * Math.min(1, rate * dt);
    const d = this.steerAng;
    // Achslasten
    const L = this.a + this.b;
    const N0 = this.mass * G_, ax = this.accel;
    const down = this.downforce * u * u * 0.5;
    let Nf = N0 * this.b / L - this.mass * ax * 0.5 / L + down * 0.4;
    let Nr = N0 * this.a / L + this.mass * ax * 0.5 / L + down * 0.6;
    Nf = Math.max(Nf, N0 * 0.15); Nr = Math.max(Nr, N0 * 0.15);
    const hand = I.hand;
    const surf = this.surfaceGrip(W) * (this.mgr.G.env ? 1 - this.mgr.G.env.wet * 0.28 : 1);
    const muF = this.mu * 0.97 * surf, muR = this.mu * (hand ? 0.68 : 1.0) * surf;
    // Fx pro Achse
    const sgn = Math.sign(u) || 1;
    let FxF = 0, FxR = 0;
    const share = this.drive === 'f' ? [1, 0] : this.drive === 'r' ? [0, 1] : [0.4, 0.6];
    FxF += drv * share[0]; FxR += drv * share[1];
    if (brake > 0) { const bf = this.brakeF * brake * Math.min(1, Math.abs(u) / 1.0 + 0.0); FxF -= sgn * bf * 0.6 * (Math.abs(u) > 0.3 ? 1 : 0); FxR -= sgn * bf * 0.4 * (Math.abs(u) > 0.3 ? 1 : 0); }
    if (hand) { FxR -= sgn * Math.min(Math.abs(u) * this.mass * 40, Nr * muR * 0.6) * (Math.abs(u) > 0.3 ? 1 : 0); }
    const capF = muF * Nf, capR = muR * Nr;
    FxF = clamp(FxF, -capF, capF); FxR = clamp(FxR, -capR, capR);
    const latF = Math.sqrt(Math.max(0, capF * capF - FxF * FxF)), latR = Math.sqrt(Math.max(0, capR * capR - FxR * FxR));
    const ua = Math.max(Math.abs(u), 1.6);
    const af = Math.atan2(v + this.a * w, ua) * 1 - d * (u >= 0 ? 1 : -1);
    const ar = Math.atan2(v - this.b * w, ua);
    const FyF = -latF * Math.tanh(this.k * af), FyR = -latR * Math.tanh(this.k * ar);
    // Widerstände
    const drag = 0.5 * 1.2 * 0.35 * u * Math.abs(u) + 0.013 * this.mass * G_ * Math.sign(u) * Math.min(1, Math.abs(u));
    // Hangabtrieb
    const gx = W.groundY(this.pos.x + sy * 1.5, this.pos.z + cy * 1.5) - W.groundY(this.pos.x - sy * 1.5, this.pos.z - cy * 1.5);
    const gl = W.groundY(this.pos.x + cy * 1.0, this.pos.z - sy * 1.0) - W.groundY(this.pos.x - cy * 1.0, this.pos.z + sy * 1.0);
    const slopeU = -G_ * gx / 3.0 * (this.air ? 0 : 1), slopeV = -G_ * gl / 2.0 * (this.air ? 0 : 1);
    const dU = (FxF * Math.cos(d) - FyF * Math.sin(d) + FxR - drag) / this.mass + w * v + slopeU;
    const dV = (FyF * Math.cos(d) + FxF * Math.sin(d) + FyR) / this.mass - w * u + slopeV;
    const dW = (this.a * (FyF * Math.cos(d) + FxF * Math.sin(d)) - this.b * FyR) / this.Iz;
    const uOld = u;
    u += dU * dt; v += dV * dt; w += dW * dt;
    if (this.air) { /* in der Luft kaum Reibung */ }
    // Stillstand-Dämpfung
    if (Math.abs(u) < 1.5 && thr === 0) { const k = Math.exp(-3 * dt); u *= Math.abs(u) < 0.25 && brake > 0 ? 0 : 1; w *= k; }
    if (Math.abs(u) < 0.08 && thr === 0 && brake > 0.1) u = 0;
    if (Math.abs(u) < 0.5 && thr === 0) { v *= Math.exp(-6 * dt); }
    // Bremsstillstand: nicht rückwärts rutschen
    if (brake > 0 && Math.sign(u) !== sgn && Math.abs(uOld) < 1) u = 0;
    this.accel = damp(this.accel, dU, 6, dt);
    this.u = u; this.v = v; this.omega = w;
    // Telemetrie
    this.slip = Math.abs(ar) + Math.abs(af) * 0.5; this.skid = (Math.abs(v) > 3.2 && Math.abs(u) > 3) || (hand && Math.abs(u) > 4) || (brake > 0.9 && Math.abs(u) > 18) || (drv > this.F0 * 0.8 && Math.abs(u) < 6 && this.drive !== 'f') ? Math.min(1, Math.abs(v) / 6 + (hand ? 0.5 : 0.2)) : 0;
    // Position
    this.yaw += w * dt;
    const nvx = u * Math.sin(this.yaw) + v * Math.cos(this.yaw), nvz = u * Math.cos(this.yaw) - v * Math.sin(this.yaw);
    this.pos.x += nvx * dt; this.pos.z += nvz * dt;
    // Boden / Wasser
    this.stepGround(dt, W);
    // Motor (Drehzahl / Gang)
    const sp = Math.abs(u);
    const gr = Math.min(GEARS.length - 1, Math.floor(sp / (this.vtop / (GEARS.length + 0.6))));
    if (gr !== this.gear) { this.gear = gr; this.shiftT = 0.15; }
    this.shiftT = Math.max(0, this.shiftT - dt);
    const lo = this.vtop / (GEARS.length + 0.6) * gr;
    const rpmT = 900 + ((sp - lo) / (this.vtop / (GEARS.length + 0.6))) * 5600;
    this.rpm = damp(this.rpm, this.shiftT > 0 ? 3500 : clamp(rpmT + Math.max(0, thr) * 700, 900, 7600), 12, dt);
  }
  surfaceGrip(W) {
    // Auf unbefestigtem Gelände (außerhalb der Stadt) weniger Haftung
    const x = this.pos.x, z = this.pos.z;
    if (x > -1450 && x < 1130 && z > -1050 && z < 1250) return 1;
    return W.onRoad?.(x, z) ? 1 : (this.spec.cls === 'offroad' || this.spec.cls === 'army' || this.spec.kind === 'bike' && this.spec.style === 'dirt' || this.spec.kind === 'bike' && this.spec.body === 'quad') ? 0.85 : 0.62;
  }
  stepGround(dt, W) {
    const sp = this.spec, hl = sp.len * 0.35, hw = sp.wid * 0.4;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const gf = W.groundY(this.pos.x + sy * hl, this.pos.z + cy * hl), gb = W.groundY(this.pos.x - sy * hl, this.pos.z - cy * hl);
    const gl = W.groundY(this.pos.x + cy * hw, this.pos.z - sy * hw), gr = W.groundY(this.pos.x - cy * hw, this.pos.z + sy * hw);
    const g = (gf + gb + gl + gr) / 4;
    this.gnd = g;
    const tp = Math.atan2(gf - gb, hl * 2), tr = Math.atan2(gl - gr, hw * 2);
    if (g < SEA - 0.45 && !this.air) {
      this.inWater = true; this.drown += dt;
      this.u *= Math.exp(-1.2 * dt); this.v *= Math.exp(-1.5 * dt);
      this.pos.y = Math.max(g, SEA - 0.7) + 0.2; this.pitch = damp(this.pitch, 0.1, 3, dt);
      if (this.drown > 4 && !this.exploded) { this.engineOff = true; this.health = Math.min(this.health, 200); this.driver && this.driver !== 'player' ? 0 : 0; }
      return;
    }
    this.inWater = false; this.drown = Math.max(0, this.drown - dt);
    if (!this.air) {
      const drop = this.prevGnd - g;
      if (drop > 0.35 && this.speed > 7) { this.air = true; this.vy = clamp((g - this.prevGnd) / dt * -0 + this.vy, 0, 12); this.vy = Math.max(this.vy, 0.5); }
      else { this.vy = clamp((g - this.prevGnd) / dt, -12, 14); this.pos.y = g; }
    }
    if (this.air) {
      this.vy -= G_ * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= g) { const imp = -this.vy; this.pos.y = g; this.air = false; if (imp > 6) this.impact(imp * 55 * this.mass / 1500, 0, 1); this.vy = 0; this.mgr.G.audio?.crash(Math.min(1, imp / 14), this.pos); }
    }
    this.prevGnd = g;
    this.pitch = damp(this.pitch, this.air ? clamp(-this.vy * 0.03, -0.35, 0.35) : -tp, 10, dt);
    const lean = this.kind === 'bike' ? clamp(-this.steerAng * this.u * 0.06, -0.8, 0.8) : 0;
    this.roll = damp(this.roll, this.air ? 0 : (this.kind === 'bike' ? lean : tr + clamp(this.steerAng * this.u * 0.0035, -0.1, 0.1)), 8, dt);
  }
  impact(power, nx, nz) {
    // Schadensberechnung aus Impuls
    this.damage(power * 0.18 * (this.player ? 0.85 : 1), 'crash');
    this.lastHit = this.mgr.G.time;
  }
  stepBoat(dt, W, env) {
    const I = this.in, sp = this.spec;
    let u = this.u, v = this.v, w = this.omega;
    const thr = this.driver && this.health > 0 ? I.throttle : 0;
    const Fx = (thr > 0 ? thr * this.thrustMax * (1 - Math.pow(Math.min(1, Math.abs(u) / (this.vtop)), 2)) : thr * this.thrustMax * 0.3) * (u < 0 && thr < 0 ? 0.6 : 1);
    const stern = 1 - sp.len * 0 ;
    u += (Fx / this.mass - 0.18 * u * Math.abs(u) / Math.max(5, sp.len) * 0.7 - 0.2 * u) * dt;
    if (I.brake > 0) u *= Math.exp(-1.6 * I.brake * dt);
    v *= Math.exp(-3.5 * dt);
    const steerEff = clamp(Math.abs(u) / 4, 0, 1) * (u >= 0 ? 1 : -1) + (thr > 0 ? 0.25 : 0) * (1 - clamp(Math.abs(u) / 4, 0, 1));
    const tw = -I.steer * steerEff * (0.55 + 0.45 / (1 + Math.abs(u) / 16)) * (sp.len > 20 ? 0.45 : 1);
    w += (tw * 1.1 - w) * Math.min(1, 3 * dt);
    this.u = u; this.v = v; this.omega = w; this.yaw += w * dt;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vx * dt; this.pos.z += this.vz * dt;
    const g = W.groundY(this.pos.x, this.pos.z);
    this.gnd = g;
    if (g > SEA - 0.8) { // Strand: Boot blockiert
      this.pos.x = ox; this.pos.z = oz; this.u *= 0.7; this.v *= 0.7;
      if (Math.abs(u) > 4) this.damage(Math.abs(u) * 4, 'crash');
      // abdrängen
      this.u = Math.min(this.u, 1.5);
    }
    const t = this.mgr.G.time;
    const wave = env ? env.waveAt(this.pos.x, this.pos.z, t) : 0;
    const planing = clamp(Math.abs(u) / (this.vtop * 0.6), 0, 1);
    this.pos.y = SEA + wave * (1 - planing * 0.6) + planing * 0.15;
    const wl = env ? env.waveAt(this.pos.x + Math.cos(this.yaw) * 1.2, this.pos.z - Math.sin(this.yaw) * 1.2, t) - env.waveAt(this.pos.x - Math.cos(this.yaw) * 1.2, this.pos.z + Math.sin(this.yaw) * 1.2, t) : 0;
    const wf = env ? env.waveAt(this.pos.x + Math.sin(this.yaw) * 2, this.pos.z + Math.cos(this.yaw) * 2, t) - env.waveAt(this.pos.x - Math.sin(this.yaw) * 2, this.pos.z - Math.cos(this.yaw) * 2, t) : 0;
    this.pitch = damp(this.pitch, -wf * 0.15 - planing * 0.1 * Math.min(1, this.spec.len / 6) + (thr > 0 ? 0.03 : 0), 4, dt);
    this.roll = damp(this.roll, -wl * 0.15 + this.omega * this.u * 0.012 * -1, 4, dt);
    this.rpm = damp(this.rpm, 800 + Math.abs(thr) * 3500 + Math.abs(u) * 40, 5, dt);
  }
  stepPlane(dt, W) {
    const I = this.in, sp = this.spec;
    // Zustand in 3D: wir nutzen yaw, pitch (Nase hoch +), roll (Rechtskurve +)
    if (!this._vel) { this._vel = new THREE.Vector3(); this._q = new THREE.Euler(0, 0, 0, 'YXZ'); this.thr3 = 0; this.onGround = true; }
    const vel = this._vel;
    const living = this.health > 0 && !!this.driver;
    this.thr3 = clamp(this.thr3 + (living ? I.thr : 0) * dt * 0.6, 0, 1);
    if (!living) this.thr3 = Math.max(0, this.thr3 - dt * 0.2);
    const fwd = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const eul = new THREE.Euler(-this.pitch, this.yaw, this.roll, 'YXZ');
    const up = new THREE.Vector3(0, 1, 0).applyEuler(eul);
    const Vf = vel.dot(fwd);
    const gy = W.groundY(this.pos.x, this.pos.z);
    const hg = this.model.groundY || 0.3;
    const agl = this.pos.y - gy - hg;
    this.onGround = agl < 0.12 && !(this.sea && false);
    const auth = smoothstep(sp.topMS * 0.04, this.vlift * 0.9, Math.abs(Vf));
    // Steuerung
    const pr = I.pitch * 0.62 * auth, rr = I.roll * 1.9 * auth, yr = I.yaw * 0.6 * auth;
    if (!this.onGround || Vf > this.vlift * 0.7) {
      this.pitch = clamp(this.pitch + pr * dt, -1.35, 1.35);
      this.roll += rr * dt;
      this.roll += (-this.roll) * Math.min(1, 0.5 * dt) * (I.roll === 0 ? 1 : 0);
      this.roll = clamp(this.roll, -1.4, 1.4);
      this.yaw += (yr - Math.sin(this.roll) * G_ * 0.6 / Math.max(25, Math.abs(Vf)) * 0.9 * Math.cos(this.pitch)) * dt * 1.0 * (Math.abs(Vf) > 8 ? 1 : 0);
    }
    // Kräfte
    const T = this.thr3 * this.mass * (sp.topMS / 11) * (1 - Math.pow(clamp(Vf / (sp.topMS * 1.1), 0, 1), 2)) * (this.health > 300 ? 1 : 0.5);
    const lift = G_ * Math.pow(clamp(Vf / this.vlift, 0, 1.8), 2);
    const acc = new THREE.Vector3().copy(fwd).multiplyScalar(T / this.mass).addScaledVector(up, lift).add(new THREE.Vector3(0, -G_, 0));
    // Luftwiderstand
    const spd = vel.length();
    acc.addScaledVector(vel, -0.0009 * spd * (sp.sub === 'jet' ? 0.6 : 1) - 0.012);
    vel.addScaledVector(acc, dt);
    // Geschwindigkeit an Nase ausrichten
    const al = 1 - Math.exp(-dt * 1.1 * clamp(Vf / this.vlift, 0, 1.2));
    const sp2 = vel.length();
    if (sp2 > 0.5) vel.lerp(new THREE.Vector3().copy(fwd).multiplyScalar(sp2), al);
    // Stall: Nase fällt
    if (!this.onGround && Vf < this.vlift * 0.55 && agl > 3) { this.pitch = damp(this.pitch, -0.5, 0.6 * (1 - Vf / (this.vlift * 0.55)), dt); }
    this.pos.addScaledVector(vel, dt);
    // Bodenkontakt
    const gy2 = W.groundY(this.pos.x, this.pos.z);
    const water = gy2 < SEA - 0.5;
    const baseY = (water && sp.sub === 'sea' ? SEA + 0.3 : water ? gy2 : gy2) + hg;
    if (this.pos.y <= baseY) {
      const vs = -vel.y;
      const nose = this.pitch, bank = Math.abs(this.roll);
      if (water && sp.sub !== 'sea') { this.damage(1000, 'crash'); }
      else if (vs > 7 || bank > 0.6 || nose < -0.35 || (Math.abs(Vf) > 40 && this.pitch < -0.2)) { this.mgr.G.audio?.crash(1, this.pos); this.damage(vs * 90 + bank * 400 + 100, 'crash'); this.pos.y = baseY; vel.y = Math.max(0, vel.y) * 0; vel.multiplyScalar(0.6); this.pitch = Math.max(this.pitch, 0); }
      else { this.pos.y = baseY; if (vel.y < 0) vel.y = 0; this.pitch = damp(this.pitch, Math.max(this.pitch, 0.04), 6, dt); this.roll = damp(this.roll, 0, 6, dt); }
      // Rollreibung & Spurführung
      const rightV = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const lat = vel.dot(rightV);
      vel.addScaledVector(rightV, -lat * Math.min(1, 6 * dt));
      const brk = I.brake > 0 ? 1 : 0;
      const fr = (0.02 + brk * 0.4) * G_;
      const hv = new THREE.Vector3(vel.x, 0, vel.z); const hs = hv.length();
      if (hs > 0.01) { const d = Math.min(hs, fr * dt); vel.x -= hv.x / hs * d; vel.z -= hv.z / hs * d; }
      if (hs > 1.5) this.yaw += (I.yaw * 0.5 - I.roll * 0.45) * Math.min(1, hs / 12) * dt;
      this.onGround = true;
    }
    // Kollision mit Welt (3D)
    const push = W.pushCircle(this.pos.x, this.pos.z, 2.2, this.pos.y - hg - 0.3);
    if (push.hit) { const sp3 = vel.length(); this.pos.x += push.x; this.pos.z += push.z; if (sp3 > 14) { this.damage(sp3 * 40, 'crash'); this.mgr.G.audio?.crash(1, this.pos); } vel.x *= 0.3; vel.z *= 0.3; }
    this.u = vel.dot(fwd); this.v = 0;
    this.vy = vel.y;
    this.speedKmh = vel.length() * 3.6;
    this.rpm = 800 + this.thr3 * 5000;
    this.air = !this.onGround;
    this.gnd = gy2;
  }
  stepHeli(dt, W) {
    const I = this.in, sp = this.spec;
    if (!this._vel) { this._vel = new THREE.Vector3(); }
    const vel = this._vel;
    const living = this.health > 0 && !!this.driver;
    this.rotor = damp(this.rotor, living ? 1 : 0, living ? 0.5 : 0.25, dt);
    const pw = this.rotor > 0.8 ? 1 : 0;
    // Gieren
    this.yaw += I.yaw * 1.5 * dt * (0.4 + this.rotor * 0.6);
    // Neigung
    const tp = I.pitch * 0.35 * pw, tr = I.roll * 0.3 * pw;
    this.pitch = damp(this.pitch, tp, 2.2, dt); this.roll = damp(this.roll, tr, 2.2, dt);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const ax = (Math.tan(this.pitch) * sy - Math.tan(this.roll) * cy) * G_ * (this.rotor > 0.8 ? 1 : 0);
    const az = (Math.tan(this.pitch) * cy + Math.tan(this.roll) * sy) * G_ * (this.rotor > 0.8 ? 1 : 0);
    vel.x += ax * dt; vel.z += az * dt;
    vel.x -= vel.x * 0.35 * dt; vel.z -= vel.z * 0.35 * dt;
    const maxH = sp.topMS * 0.8; const hs = Math.hypot(vel.x, vel.z); if (hs > maxH) { vel.x *= maxH / hs; vel.z *= maxH / hs; }
    // vertikal
    const gy = W.groundY(this.pos.x, this.pos.z);
    const lift = pw ? I.collective * 9 : 0;
    const gravityNet = pw ? 0 : -G_ * (this.rotor < 0.8 ? 1 : 0);
    vel.y += (lift + gravityNet) * dt;
    vel.y -= vel.y * 0.9 * dt;
    if (!pw && this.pos.y > gy + 0.3) vel.y -= G_ * dt * 0.0;
    this.pos.addScaledVector(vel, dt);
    const floor = (gy < SEA ? SEA : gy) + 0.15;
    if (this.pos.y < floor) { if (vel.y < -5) { this.damage(-vel.y * 80, 'crash'); this.mgr.G.audio?.crash(0.8, this.pos); } this.pos.y = floor; vel.y = Math.max(0, vel.y); vel.x *= 1 - 3 * dt; vel.z *= 1 - 3 * dt; this.air = false; }
    else this.air = true;
    const push = W.pushCircle(this.pos.x, this.pos.z, 2.0, this.pos.y - 0.5);
    if (push.hit) { this.pos.x += push.x; this.pos.z += push.z; const s2 = Math.hypot(vel.x, vel.z); if (s2 > 8) { this.damage(s2 * 55, 'crash'); this.mgr.G.audio?.crash(0.9, this.pos); } vel.x *= 0.3; vel.z *= 0.3; }
    if (this.health <= 0 || (this.health < 150 && Math.random() < dt * 0.3)) { vel.y -= 14 * dt; }
    this.u = vel.x * sy + vel.z * cy; this.v = vel.x * cy - vel.z * sy; this.vy = vel.y; this.speedKmh = hs * 3.6;
    this.gnd = gy; this.rpm = 1000 + this.rotor * 3000;
  }

  // ---- Visuals ----
  updateVisual(dt) {
    const g = this.group, P = this.parts;
    if (this.kind === 'plane') g.rotation.set(-this.pitch, this.yaw, this.roll, 'YXZ');
    else if (this.kind === 'heli') g.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    else g.rotation.set(-this.pitch, this.yaw, this.roll, 'YXZ');
    if (this.kind === 'bike' && this.kind) { /* Seitenlage: Rotation um Längsachse – YXZ erlaubt dies nach Gieren */ }
    // Räder
    const rot = this.u;
    for (const w of P.wheels) {
      w.angle += (this.kind === 'plane' ? this.u : rot) / w.def.r * dt;
      w.spin.rotation.x = w.angle * w.flipSign * -1;
      if (w.def.steer) w.steer.rotation.y = this.kind === 'plane' ? 0 : this.steerAng * 0.9;
    }
    // Rotoren
    for (const e of P.extra) {
      const sp = this.kind === 'heli' ? this.rotor : clamp(this.thr3, 0.0, 1) * 0.9 + (this.driver ? 0.08 : 0);
      const ang = dt * 60 * sp * (e.userData.type === 'prop' ? 1 : 1);
      if (e.userData.type === 'prop') e.rotation.z += ang; else if (e.userData.type === 'rotor') e.rotation.y += ang; else e.rotation.x += ang * 1.6;
    }
    // Lichter
    const night = this.mgr.G.env?.night ?? 0;
    const braking = this.in.brake > 0.1 || (this.in.throttle < 0 && this.u > 0.5) ;
    if (P.tail) P.tail.material.color.setScalar(this.lightsOn(night) ? (braking ? 3 : 1) : braking ? 3 : 0.35).multiply(new THREE.Color(1, 0.08, 0.08));
    if (P.head) P.head.material.color.setScalar(this.lightsOn(night) ? 1.6 : 0.5).multiply(new THREE.Color(1, 0.96, 0.82));
    if (this.siren || (this.spec.cop && this.sirenOn)) {
      const f = Math.floor(this.mgr.G.time * 6) % 2;
      if (P.barR) { P.barR.visible = f === 0; P.barB.visible = f === 1; }
    } else if (P.barR) { P.barR.visible = false; P.barB.visible = false; }
  }
  lightsOn(night) { return this.driver && (night > 0.3 || this.lights); }

  updateEffects(dt, env) {
    const fx = this.mgr.G.fx; if (!fx) return;
    const p = this.pos, t = this.mgr.G.time;
    if (this.exploded) { if (Math.random() < dt * 10) fx.smoke(p.x + (Math.random() - 0.5) * 2, p.y + 1, p.z + (Math.random() - 0.5) * 2, 0, 3, 0, 5, 4, 0x222222); if (Math.random() < dt * 6) fx.fire(p.x, p.y + 0.6, p.z, 1.2); return; }
    const dm = this.health / 1000;
    if (dm < 0.4 && this.health > 0 && Math.random() < dt * (14 * (0.4 - dm) + 4)) {
      const fwd = this.spec.len * 0.38, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      fx.smoke(p.x + sy * fwd, p.y + 1, p.z + cy * fwd, (Math.random() - 0.5) * 0.5, 1.6 + Math.random(), (Math.random() - 0.5) * 0.5, 1.5, 1.8, dm < 0.25 ? 0x111111 : 0x888888);
    }
    if (this.burning && this.health > 0) {
      this.fire += dt; const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      if (Math.random() < dt * 20) fx.fire(p.x + sy * this.spec.len * 0.3, p.y + 0.7, p.z + cy * this.spec.len * 0.3, 0.9);
      this.health -= dt * 22;
      if (this.health <= 0) this.mgr.explode(this);
    }
    // Reifenspuren / Rauch
    if (this.skid > 0.15 && !this.air && (this.kind === 'car' || this.kind === 'bike') && this.health > 0) {
      const wh = this.parts.wheels.filter((w) => !w.def.steer);
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      for (const w of wh) {
        const wx = p.x + (w.def.x * cy + w.def.z * sy), wz = p.z + (-w.def.x * sy + w.def.z * cy);
        fx.skid(this, w, wx, p.y + 0.02, wz, this.yaw, this.skid);
        if (Math.random() < dt * 22 * this.skid) fx.smoke(wx, p.y + 0.2, wz, -this.vx * 0.1, 0.6, -this.vz * 0.1, 0.9, 1.1, 0xcccccc, 0.5);
      }
    } else fx.skidBreak?.(this);
    // Boot: Gischt / Kielwasser
    if (this.kind === 'boat' && this.speed > 3 && Math.random() < dt * 40) {
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      fx.spray(p.x - sy * this.spec.len * 0.45 + (Math.random() - 0.5) * this.spec.wid * 0.5, SEA + 0.1, p.z - cy * this.spec.len * 0.45, this.speed);
      if (Math.random() < 0.5) fx.spray(p.x + sy * this.spec.len * 0.4 + (Math.random() - 0.5) * 0.8, SEA + 0.1, p.z + cy * this.spec.len * 0.4, this.speed * 0.6);
    }
    // Auspuff bei Vollgas
    if (this.driver && this.in.throttle > 0.9 && this.kind === 'car' && Math.random() < dt * 12 && this.speed < 25) { const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), L = this.spec.len / 2; fx.smoke(p.x - sy * L, p.y + 0.3, p.z - cy * L, -sy * 0.8, 0.2, -cy * 0.8, 0.45, 0.7, 0x999999, 0.35); }
    // Rotorwind über Wasser/Sand
  }
}

// --------------------------------------------------------------------
export class VehicleManager {
  constructor(G) {
    this.G = G; this.list = []; this.group = new THREE.Group(); this.group.name = 'vehicles';
    this.hash = new Map(); this._tmp = [];
  }
  spawn(specOrKey, x, z, yaw = 0, o = {}) {
    const spec = typeof specOrKey === 'string' ? byKey.get(specOrKey) : typeof specOrKey === 'number' ? CATALOG[specOrKey] : specOrKey;
    if (!spec) return null;
    const v = new Vehicle(spec, o.color ?? spec.color, this);
    v.place(x, z, yaw, o.y);
    if (o.health !== undefined) v.health = o.health;
    if (o.dmg) { v.dmg = o.dmg; v.parts.paint && (v.parts.paint.material = paintMat(v.color, o.dmg)); }
    v.tag = o.tag || ''; v.owned = !!o.owned;
    this.group.add(v.group); this.list.push(v);
    if (o.sleep === false) v.wake();
    return v;
  }
  despawn(v) {
    const i = this.list.indexOf(v); if (i >= 0) this.list.splice(i, 1);
    this.group.remove(v.group);
    v.parts.head?.material.dispose(); v.parts.tail?.material.dispose(); v.parts.barR?.material.dispose(); v.parts.barB?.material.dispose(); v.parts.neon?.material.dispose(); v.parts.sign?.material.dispose();
    v.dead = true;
  }
  nearest(x, z, r = 4, filter = null) {
    let best = null, bd = r;
    for (const v of this.list) {
      if (v.exploded || (filter && !filter(v))) continue;
      const d = Math.hypot(v.pos.x - x, v.pos.z - z) - v.spec.len * 0.3;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  explode(v, source = null) {
    if (v.exploded) return;
    const G = this.G;
    v.exploded = true; v.health = 0; v.burning = false; v.wreck = true; v.sleeping = false;
    G.fx?.explosion(v.pos.x, v.pos.y + 0.8, v.pos.z, 1 + v.spec.len / 8);
    G.audio?.explosion(v.pos);
    // Wrack einfärben
    if (v.parts.paint) v.parts.paint.material = paintMat(0x1a1a1a, 0);
    for (const k of ['head', 'tail']) if (v.parts[k]) v.parts[k].visible = false;
    if (v.parts.glass) v.parts.glass.visible = false;
    G.emit('explosion', { x: v.pos.x, y: v.pos.y, z: v.pos.z, r: 11, power: 1, source, vehicle: v });
    // Insassen
    if (v.driver) G.emit('vehicleExploded', v);
    // Stoß auf Umgebung
    for (const o of this.list) if (o !== v && !o.exploded) {
      const d = Math.hypot(o.pos.x - v.pos.x, o.pos.z - v.pos.z);
      if (d < 12) { o.wake(); const k = (1 - d / 12); o.damage(k * 600, 'explosion', source); const a = Math.atan2(o.pos.x - v.pos.x, o.pos.z - v.pos.z); o.setWorldVel(o.vx + Math.sin(a) * k * 14, o.vz + Math.cos(a) * k * 14); o.vy = 4 * k; }
    }
    v.u *= 0.2; v.v *= 0.2; v.vy = 7; v.air = true; v.omega += (Math.random() - 0.5) * 4;
    setTimeout(() => { v.wreckFade = true; }, 100);
  }

  update(dt, W, env) {
    const G = this.G;
    for (const v of this.list) v.update(dt, W, env);
    this.collide(dt, W);
    // Wracks entfernen
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      if (v.exploded) { v.wreckT = (v.wreckT || 0) + dt; v.update(dt, W, env); if (v.wreckT > 90 && !v.player) this.despawn(v); }
    }
  }
  collide(dt, W) {
    const act = this.list;
    this.hash.clear();
    const cs = 10;
    const cells = (v) => { const r = v.size + 1; return [Math.floor((v.pos.x - r) / cs), Math.floor((v.pos.x + r) / cs), Math.floor((v.pos.z - r) / cs), Math.floor((v.pos.z + r) / cs)]; };
    for (const v of act) {
      if (v.exploded && v.speed < 0.3) { /* Wracks bleiben Hindernisse */ }
      const [a, b, c, d] = cells(v);
      for (let x = a; x <= b; x++) for (let z = c; z <= d; z++) { const k = x * 100003 + z; let arr = this.hash.get(k); if (!arr) this.hash.set(k, arr = []); arr.push(v); }
    }
    // Welt
    for (const v of act) {
      if (v.sleeping && !v.exploded) continue;
      if (v.kind === 'plane' || v.kind === 'heli') continue;
      const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
      for (const c of v.circles) {
        const cx = v.pos.x + sy * c.z, cz = v.pos.z + cy * c.z;
        const p = W.pushCircle(cx, cz, c.r, v.pos.y + 0.3);
        if (p.hit) {
          v.pos.x += p.x; v.pos.z += p.z;
          const nx = p.nx, nz = p.nz;
          const vx = v.vx, vz = v.vz, vn = vx * nx + vz * nz;
          if (vn < 0) {
            const e = 0.18;
            v.setWorldVel(vx - (1 + e) * vn * nx, vz - (1 + e) * vn * nz);
            const power = -vn * v.mass;
            const hard = -vn;
            if (hard > 2.5) { v.impact(power / 55, nx, nz); this.G.audio?.crash(Math.min(1, hard / 14), v.pos); this.G.fx?.sparks(cx - nx * c.r, v.pos.y + 0.5, cz - nz * c.r, Math.min(1, hard / 12)); this.G.emit('vehicleCrash', { v, hard, wall: true }); }
            // Drehmoment aus Kontaktpunkt
            const rx = -nx * c.r + sy * c.z, rz = -nz * c.r + cy * c.z;
            v.omega += (rz * (-vn * nx * v.mass * 0.15) - rx * (-vn * nz * v.mass * 0.15)) / v.Iz * 0.5 * -1;
            v.omega *= 0.97;
          }
        }
      }
    }
    // Fahrzeug-Fahrzeug
    const done = new Set();
    for (const arr of this.hash.values()) {
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const A = arr[i], B = arr[j];
        const key = A.id < B.id ? A.id * 100000 + B.id : B.id * 100000 + A.id;
        if (done.has(key)) continue; done.add(key);
        if (A.sleeping && B.sleeping) continue;
        if ((A.kind === 'plane' && A.air) || (B.kind === 'plane' && B.air) || (A.kind === 'heli' && A.pos.y - A.gnd > 3) || (B.kind === 'heli' && B.pos.y - B.gnd > 3)) continue;
        if ((A.kind === 'boat') !== (B.kind === 'boat')) { if (Math.abs(A.pos.y - B.pos.y) > 3) continue; }
        this.pair(A, B);
      }
    }
  }
  pair(A, B) {
    const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z;
    const R = A.size + B.size; if (dx * dx + dz * dz > R * R) return;
    const sa = Math.sin(A.yaw), ca = Math.cos(A.yaw), sb = Math.sin(B.yaw), cb = Math.cos(B.yaw);
    let best = null;
    for (const ca_ of A.circles) for (const cb_ of B.circles) {
      const ax = A.pos.x + sa * ca_.z, az = A.pos.z + ca * ca_.z, bx = B.pos.x + sb * cb_.z, bz = B.pos.z + cb * cb_.z;
      const ddx = bx - ax, ddz = bz - az, d = Math.hypot(ddx, ddz), rr = ca_.r + cb_.r;
      if (d < rr) { const pen = rr - d; if (!best || pen > best.pen) best = { pen, nx: d > 1e-4 ? ddx / d : 1, nz: d > 1e-4 ? ddz / d : 0, ax, az, bx, bz, ra: ca_, rb: cb_ }; }
    }
    if (!best) return;
    A.wake(); B.wake();
    const mA = A.mass, mB = B.mass, tot = mA + mB;
    const wA = mB / tot, wB = mA / tot;
    A.pos.x -= best.nx * best.pen * wA; A.pos.z -= best.nz * best.pen * wA; B.pos.x += best.nx * best.pen * wB; B.pos.z += best.nz * best.pen * wB;
    const rvx = B.vx - A.vx, rvz = B.vz - A.vz, vn = rvx * best.nx + rvz * best.nz;
    if (vn < 0) {
      const e = 0.28, j = -(1 + e) * vn / (1 / mA + 1 / mB);
      A.setWorldVel(A.vx - j * best.nx / mA, A.vz - j * best.nz / mA); B.setWorldVel(B.vx + j * best.nx / mB, B.vz + j * best.nz / mB);
      const hard = -vn;
      // Kontaktpunkt-Drehung
      const px = (best.ax + best.bx) / 2, pz = (best.az + best.bz) / 2;
      A.omega += ((pz - A.pos.z) * (-j * best.nx) - (px - A.pos.x) * (-j * best.nz)) / A.Iz * 0.6;
      B.omega += ((pz - B.pos.z) * (j * best.nx) - (px - B.pos.x) * (j * best.nz)) / B.Iz * 0.6;
      if (hard > 1.5) {
        const dmgA = j / 55 * (mB / tot) * 1.4, dmgB = j / 55 * (mA / tot) * 1.4;
        A.impact(dmgA * 2, best.nx, best.nz); B.impact(dmgB * 2, -best.nx, -best.nz);
        this.G.audio?.crash(Math.min(1, hard / 12), A.pos);
        this.G.fx?.sparks(px, A.pos.y + 0.5, pz, Math.min(1, hard / 10));
        this.G.emit('vehicleCrash', { v: A, other: B, hard });
      }
    }
  }
}
