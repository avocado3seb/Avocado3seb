// Fußgänger und Verkehr
import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, angDiff, RNG, smoothstep, hash2 } from './util.js';
import { Character, DEFAULT_OUTFIT } from './character.js';
import { SKINS, PALETTE, HAIRCOL } from './data.js';
import { RouteDriver, legPoints } from './ai.js';
import { TRAFFIC_MODELS, CATALOG, byKey, PALETTE_CARS } from './vehicledata.js';
import { terrainH, PITCH } from './world.js';

const rnd = new RNG(4242);
const BARKS = {
  idle: ['Schönes Wetter heute.', 'Hast du Feuer?', 'Ich warte auf den Bus ...', 'Vice City, die Stadt der Träume!', 'Mein Chef nervt mich ständig.', 'Hast du das Rennen gestern gesehen?', 'Ich brauche einen Kaffee.', 'Die Mieten sind ein Witz.', 'Pass auf dich auf, Fremder.'],
  rain: ['So ein Mistwetter!', 'Mein Regenschirm ist kaputt!', 'Alles nass ...', 'Ich hasse Regen!'],
  storm: ['Das Gewitter ist heftig!', 'Rein ins Haus!', 'Wow, dieser Blitz!'],
  night: ['Die Nacht gehört uns.', 'Ich such den nächsten Club.', 'Gefährliche Gegend nachts ...'],
  fear: ['Hilfe!', 'Bitte nicht schießen!', 'Polizei!', 'Weg hier!', 'Oh mein Gott!', 'Er ist verrückt!'],
  hit: ['Hey! Pass doch auf!', 'Spinnst du?!', 'Was soll das?!', 'Das tut weh!'],
  car: ['Wow, was für ein Auto!', 'Schicker Wagen!', 'Das muss ein Vermögen kosten!'],
  honk: ['Hupe woanders!', 'Ja ja, ich geh schon!', 'Idiot!'],
};

let PED_ID = 1;
export class Ped {
  constructor(G, outfit, type = 'civ') {
    this.G = G; this.id = PED_ID++; this.type = type; this.char = new Character(outfit);
    this.pos = this.char.root.position; this.yaw = 0; this.health = 55 + Math.random() * 20; this.alive = true;
    this.state = 'idle'; this.t = 0; this.target = null; this.speed = 0; this.vel = new THREE.Vector3(); this.vy = 0;
    this.umbrella = false; this.fearT = 0; this.hostile = false; this.isCop = false; this.weapon = null; this.cooldown = 0;
    this.node = null; this.walkSpeed = 1.2 + Math.random() * 0.5; this.deadT = 0; this.talkT = 0; this.knockT = 0; this.hands = false;
    this.brain = null; this.cash = 5 + Math.floor(Math.random() * 60); this.robbed = false; this.sayCd = 0; this.leaveT = 0;
    this.sit = false; this.ragVel = null; this.opacity = 1;
  }
  get radius() { return 0.35; }
  hurt(dmg, src = null, head = false, melee = false) {
    if (!this.alive) return;
    this.health -= dmg;
    this.G.emit('pedHurt', { ped: this, src, dmg });
    if (this.health <= 0) { this.die(src, head); return; }
    if (this.type === 'civ') { this.scare(src, melee ? 4 : 10); if (src === this.G.player && melee && Math.random() < 0.25) { this.state = 'fight'; this.hostile = true; this.t = 12; } }
    if (melee) { this.state = this.state === 'fight' ? 'fight' : 'staggered'; this.t = 0.5; }
    this.G.ui?.say(this, rnd.pick(BARKS.hit), 1.6);
  }
  die(src, head) {
    this.alive = false; this.state = 'dead'; this.deadT = 0; this.char.state.dead = true; this.char.state.hands = false; this.char.setHeld(null); this.char.state.umbrella = false; this.char.state.speed = 0;
    this.G.emit('pedKilled', { ped: this, src, head });
    if (this.cash > 0 && !this.noDrop && this.type !== 'cop') this.G.pickups?.dropCash(this.pos.x, this.pos.z, this.cash);
  }
  scare(src, time = 8) {
    if (!this.alive) return;
    if (this.isCop || this.hostile && this.type !== 'civ') return;
    this.fearT = Math.max(this.fearT, time);
    if (this.state !== 'flee') { this.state = 'flee'; this.t = time; this.threat = src && src.pos ? src.pos : this.G.player.pos; this.char.state.umbrella = false; this.char.setHeld(null); if (this.sayCd <= 0) { this.G.ui?.say(this, rnd.pick(BARKS.fear), 1.8); this.sayCd = 4; } }
  }
  knock(dx, dz, power) {
    const l = Math.hypot(dx, dz) || 1;
    this.ragVel = new THREE.Vector3(dx / l * power, 3 + power * 0.5, dz / l * power); this.knockT = 1.4; this.state = 'ragdoll'; this.vy = this.ragVel.y;
  }
  update(dt) {
    const G = this.G, W = G.world, c = this.char, st = c.state;
    this.sayCd -= dt; this.t -= dt;
    if (!this.alive) {
      this.deadT += dt; st.dead = true; st.speed = 0;
      if (this.ragVel) { this.pos.x += this.ragVel.x * dt; this.pos.z += this.ragVel.z * dt; this.vy -= 22 * dt; this.pos.y += this.vy * dt; const g = W.groundY(this.pos.x, this.pos.z); if (this.pos.y < g) { this.pos.y = g; this.vy = 0; this.ragVel.multiplyScalar(Math.exp(-6 * dt)); if (this.ragVel.length() < 0.2) this.ragVel = null; } }
      c.update(dt, st);
      return;
    }
    if (this.state === 'ragdoll') {
      this.knockT -= dt; this.pos.x += this.ragVel.x * dt; this.pos.z += this.ragVel.z * dt; this.vy -= 22 * dt; this.pos.y += this.vy * dt;
      const g = W.groundY(this.pos.x, this.pos.z); if (this.pos.y <= g) { this.pos.y = g; this.vy = 0; this.ragVel.multiplyScalar(Math.exp(-5 * dt)); }
      st.dead = true; c.update(dt, st); c.root.rotation.y = this.yaw;
      if (this.knockT <= 0) { st.dead = false; this.state = 'flee'; this.t = 6; this.threat = G.player.pos; }
      return;
    }
    this.cooldown -= dt;
    let tvx = 0, tvz = 0, spd = 0;
    st.dead = false; st.hands = false; st.fear = 0; st.talk = false; st.phone = false;
    st.umbrella = this.umbrella && this.state !== 'flee';
    switch (this.state) {
      case 'walk': case 'cross': {
        spd = this.walkSpeed * (this.jog ? 2.3 : 1) * (this.drunk ? 0.6 : 1);
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.7) { this.arrive(); break; }
        tvx = dx / d * spd; tvz = dz / d * spd;
        break;
      }
      case 'wait': {
        spd = 0; this.t -= 0; this.waitT -= dt;
        if (this.canCross()) { this.state = 'cross'; }
        st.phone = this.phoneUser;
        break;
      }
      case 'idle': {
        st.talk = this.talkT > 0; st.phone = !!this.phoneUser; this.talkT -= dt;
        if (this.t <= 0) { this.pickNext(); }
        break;
      }
      case 'flee': {
        spd = 5.4; st.fear = 0.6;
        const th = this.threat; let dx = this.pos.x - th.x, dz = this.pos.z - th.z; const d = Math.hypot(dx, dz) || 1;
        // seitlich ausweichen, wenn Gebäude im Weg
        tvx = dx / d * spd; tvz = dz / d * spd;
        const hit = W.pushCircle(this.pos.x + tvx * 0.4, this.pos.z + tvz * 0.4, 0.4, this.pos.y + 0.3);
        if (hit.hit) { const nx = hit.nx, nz = hit.nz; const px = -nz, pz = nx; const s = (tvx * px + tvz * pz) >= 0 ? 1 : -1; tvx = px * s * spd + nx * 1.5; tvz = pz * s * spd + nz * 1.5; }
        if (this.t <= 0 || d > 90) { this.state = 'idle'; this.t = 1; this.pickNext(true); }
        break;
      }
      case 'cower': { st.fear = 1; spd = 0; if (this.t <= 0) { this.state = 'idle'; this.t = 1; } break; }
      case 'hands': { st.hands = true; spd = 0; if (this.t <= 0 || !G.player.aim || Math.hypot(G.player.pos.x - this.pos.x, G.player.pos.z - this.pos.z) > 14) { this.state = 'idle'; this.t = 1; } break; }
      case 'staggered': { spd = 0; if (this.t <= 0) { this.state = this.hostile ? 'fight' : 'flee'; this.t = 8; this.threat = G.player.pos; } break; }
      case 'fight': {
        const p = G.player; const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz);
        if (this.t <= 0 || !p.alive || d > 40) { this.state = 'idle'; this.t = 1; this.hostile = false; break; }
        spd = 3.6; if (d > 1.3) { tvx = dx / d * spd; tvz = dz / d * spd; } else { spd = 0; if (this.cooldown <= 0) { this.cooldown = 0.9; c.punch(); setTimeout(() => G.combat.melee(this, this.pos, this.yaw, 8), 140); } }
        this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 12, dt);
        break;
      }
      case 'shelter': {
        spd = 4.6; const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 1.2) { this.state = 'inside'; this.t = 6 + Math.random() * 10; this.char.root.visible = false; break; }
        tvx = dx / d * spd; tvz = dz / d * spd; break;
      }
      case 'inside': { this.char.root.visible = false; if (this.t <= 0 && G.env.w.rain < 0.1) { this.char.root.visible = true; this.state = 'idle'; this.t = 1; } return; }
      case 'brain': break;
    }
    if (this.brain) { const r = this.brain(dt, this); if (r) { tvx = r.vx; tvz = r.vz; spd = r.spd; } }
    // Bewegung
    this.vel.x = damp(this.vel.x, tvx, 9, dt); this.vel.z = damp(this.vel.z, tvz, 9, dt);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const p = W.pushCircle(this.pos.x, this.pos.z, 0.33, this.pos.y + 0.3);
    if (p.hit) { this.pos.x += p.x; this.pos.z += p.z; }
    const g = W.groundY(this.pos.x, this.pos.z);
    this.pos.y = g;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.25 && this.state !== 'fight' && !(this.brain && this.faceTarget)) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 9, dt);
    else if (this.lookAt) this.yaw = dampAngle(this.yaw, Math.atan2(this.lookAt.x - this.pos.x, this.lookAt.z - this.pos.z), 6, dt);
    c.root.rotation.y = this.yaw;
    st.speed = sp; st.sprint = sp > 4;
    if (this.weapon && !this.holding) { c.setHeld(this.weapon); this.holding = true; }
    st.weapon = this.weapon || 'fist';
    c.update(dt, st);
    if (this.type === 'civ') this.civReactions(dt);
  }
  civReactions(dt) {
    const G = this.G, p = G.player;
    if (this.state === 'flee' || this.state === 'hands' || this.state === 'inside' || this.state === 'fight') return;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    // Waffe auf Passanten gerichtet
    if (!p.vehicle && p.aim && d < 12 && p.weapon !== 'fist') {
      const f = [Math.sin(p.yaw), Math.cos(p.yaw)]; if ((-dx * f[0] - dz * f[1]) / (d || 1) > 0.6 || d < 5) { this.state = 'hands'; this.t = 4; this.robbable = true; this.lookAt = p.pos; return; }
    }
    // Hupe / schnelles Fahrzeug
    if (p.vehicle && d < 13) {
      const v = p.vehicle;
      if (v.horn && d < 10 && this.sayCd <= 0) { this.G.ui?.say(this, rnd.pick(BARKS.honk), 1.5); this.sayCd = 5; this.state = 'idle'; this.t = 1.5; }
      if (v.speed > 11 && d < 9) { const fwd = (this.pos.x - v.pos.x) * Math.sin(v.yaw) + (this.pos.z - v.pos.z) * Math.cos(v.yaw); if (fwd > 0 && fwd < 12) { this.scare(v, 4); } }
      if (v.spec.price > 300000 && d < 9 && this.sayCd <= 0 && v.speed < 6 && Math.random() < 0.01) { this.G.ui?.say(this, rnd.pick(BARKS.car), 2); this.sayCd = 10; this.lookAt = p.pos; this.t = Math.max(this.t, 2.5); if (this.state === 'walk') { this.state = 'idle'; this.talkT = 0; } }
    }
  }
  // ---- Navigation ----
  cornerPos(c) { const n = c.node; return { x: n.x + c.sx * (n.hwV + 2.4) + (Math.random() - 0.5) * 1.6, z: n.z + c.sz * (n.hwH + 2.4) + (Math.random() - 0.5) * 1.6 }; }
  arrive() {
    if (this.state === 'cross') { /* Kreuzung beendet */ }
    this.corner = this.next; this.pickNext();
  }
  pickNext(first = false) {
    const G = this.G, W = G.world;
    if (!this.corner) return;
    const c = this.corner, n = c.node;
    const opts = [];
    // entlang x
    const mx = W.nodes.get((n.x + c.sx * 100) + '|' + n.z);
    if (mx && n.out.some((o) => o.to === mx) && mx.city) { const bj = c.sz < 0 ? n.z / 100 - 1 : n.z / 100, bi = c.sx > 0 ? n.x / 100 : n.x / 100 - 1; if (W.blockAt.has(bi + ',' + bj)) opts.push({ node: mx, sx: -c.sx, sz: c.sz, kind: 'walk', w: 3 }); }
    const mz = W.nodes.get(n.x + '|' + (n.z + c.sz * 100));
    if (mz && n.out.some((o) => o.to === mz) && mz.city) { const bi = c.sx > 0 ? n.x / 100 : n.x / 100 - 1, bj = c.sz > 0 ? n.z / 100 : n.z / 100 - 1; if (W.blockAt.has(bi + ',' + bj)) opts.push({ node: mz, sx: c.sx, sz: -c.sz, kind: 'walk', w: 3 }); }
    // queren
    if (n.hwV > 0 && n.out.some((o) => !o.edge.horiz)) opts.push({ node: n, sx: -c.sx, sz: c.sz, kind: 'cross', axis: 'x', w: 1.4 });
    if (n.hwH > 0 && n.out.some((o) => o.edge.horiz)) opts.push({ node: n, sx: c.sx, sz: -c.sz, kind: 'cross', axis: 'z', w: 1.4 });
    if (!opts.length) { this.state = 'idle'; this.t = 5; return; }
    // nicht direkt zurück
    let tot = 0; for (const o of opts) tot += o.w; let r = Math.random() * tot, pick = opts[0];
    for (const o of opts) { r -= o.w; if (r <= 0) { pick = o; break; } }
    // gelegentlich stehenbleiben
    if (!first && Math.random() < 0.12 && pick.kind === 'walk' && this.G.env.w.rain < 0.1) { this.state = 'idle'; this.t = 4 + Math.random() * 12; this.talkT = Math.random() < 0.5 ? this.t : 0; this.phoneUser = Math.random() < 0.3; this.next = pick; return; }
    this.next = { node: pick.node, sx: pick.sx, sz: pick.sz };
    this.target = this.cornerPos(this.next); this.nextKind = pick.kind; this.nextAxis = pick.axis;
    this.phoneUser = false;
    if (pick.kind === 'cross') { this.state = 'wait'; this.waitT = 40; this.crossNode = n; this.crossAxis = pick.axis; this.jog = false; }
    else { this.state = 'walk'; }
  }
  canCross() {
    const G = this.G, W = G.world, n = this.crossNode;
    if (this.waitT <= 0) return true;
    // Bewegung entlang x quert die Straße entlang z → sicher, wenn Verkehr in z-Richtung rot hat
    const axisTraffic = this.crossAxis === 'x' ? 'z' : 'x';
    if (n.signal) return W.signalState(n, axisTraffic, G.time) === 0;
    // ohne Ampel: freie Fahrbahn?
    for (const v of G.vehicles.list) { const d = Math.hypot(v.pos.x - n.x, v.pos.z - n.z); if (d < 28 && v.speed > 2.5) return false; }
    return true;
  }
}

export class PedManager {
  constructor(G) {
    this.G = G; this.list = []; this.group = new THREE.Group(); this.target = 36; this.cd = 0; this.hash = new Map();
    G.on('gunshot', (e) => this.onGunshot(e));
    G.on('explosion', (e) => this.onExplosion(e));
    G.on('lightning', (e) => this.onLightning(e));
  }
  randomOutfit(rng = Math) {
    const r = () => rng.random();
    const pickA = (a) => a[Math.floor(r() * a.length)];
    return {
      skin: pickA(SKINS), hairStyle: Math.floor(r() * 8), hairColor: pickA(HAIRCOL), top: pickA([0, 0, 1, 1, 2, 3, 4, 5, 6, 0]), topColor: pickA(PALETTE),
      bottom: pickA([0, 0, 1, 2, 3, 4]), bottomColor: pickA([0x37474f, 0x1a237e, 0x4e342e, 0x263238, 0x607d8b, 0x6d4c41, 0x1b1b1f, 0xb0bec5, 0x283593]), shoe: pickA([0, 0, 1, 2]), shoeColor: pickA([0xf5f5f5, 0x212121, 0x6d4c41, 0xc62828]),
      hat: r() < 0.14 ? 1 + Math.floor(r() * 4) : 0, hatColor: pickA(PALETTE), glasses: r() < 0.18 ? 1 + Math.floor(r() * 2) : 0, watch: r() < 0.2 ? 1 : 0, build: 0.9 + r() * 0.2,
    };
  }
  spawnAt(x, z, type = 'civ', outfit = null) {
    const p = new Ped(this.G, outfit || this.randomOutfit(), type);
    p.pos.set(x, this.G.world.groundY(x, z), z);
    this.G.scene.add(p.char.root); this.list.push(p);
    return p;
  }
  remove(p) {
    const i = this.list.indexOf(p); if (i >= 0) this.list.splice(i, 1);
    this.G.scene.remove(p.char.root);
  }
  spawnCivilian() {
    const G = this.G, W = G.world, cam = G.camera.position, pp = G.player.position;
    const rain = G.env.w.rain;
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2, d = 38 + Math.random() * 85;
      const x = pp.x + Math.cos(a) * d, z = pp.z + Math.sin(a) * d;
      const n = W.nearestNode(x, z, 60);
      if (!n || !n.city || n.hwV <= 0 || n.hwH <= 0) continue;
      const sx = Math.random() < 0.5 ? 1 : -1, sz = Math.random() < 0.5 ? 1 : -1;
      const p = new Ped(G, this.randomOutfit(), 'civ');
      const c = { node: n, sx, sz }; p.corner = c;
      const cp = p.cornerPos(c);
      // nicht im Sichtfeld spawnen
      const dx = cp.x - cam.x, dz = cp.z - cam.z, dist = Math.hypot(dx, dz);
      if (dist < 35) continue;
      const dir = new THREE.Vector3(); G.camera.getWorldDirection(dir);
      if (dist < 70 && (dx * dir.x + dz * dir.z) / dist > 0.45) continue;
      if (!W.blockAt.has((sx > 0 ? n.x / 100 : n.x / 100 - 1) + ',' + (sz > 0 ? n.z / 100 : n.z / 100 - 1))) continue;
      p.pos.set(cp.x, W.groundY(cp.x, cp.z), cp.z);
      if (rain > 0.25 && Math.random() < 0.55) p.umbrella = true;
      if (G.env.night > 0.5 && Math.random() < 0.18) p.drunk = true;
      if (Math.random() < 0.08) p.jog = true;
      if (p.umbrella) p.char.setHeld('umbrella');
      G.scene.add(p.char.root); this.list.push(p); p.pickNext(true);
      return p;
    }
    return null;
  }
  onGunshot(e) {
    for (const p of this.list) {
      if (!p.alive || p.type !== 'civ' || e.by === p) continue;
      const d = Math.hypot(p.pos.x - e.x, p.pos.z - e.z);
      if (d < 38 * e.loud + 12) { p.scare({ pos: { x: e.x, z: e.z } }, 9); p.threat = { x: e.x, z: e.z }; }
    }
  }
  onExplosion(e) {
    for (const p of this.list) { if (!p.alive || p.type !== 'civ') continue; const d = Math.hypot(p.pos.x - e.x, p.pos.z - e.z); if (d < 70) { p.scare({ pos: { x: e.x, z: e.z } }, 12); p.threat = { x: e.x, z: e.z }; } }
  }
  onLightning(e) {
    const p0 = this.G.player.position;
    for (const p of this.list) { if (!p.alive || p.type !== 'civ' || p.state === 'inside') continue; if (Math.hypot(p.pos.x - p0.x, p.pos.z - p0.z) < 60 && Math.random() < 0.35 && e.dist < 600) { p.state = 'cower'; p.t = 1.5; this.G.ui?.say(p, rnd.pick(BARKS.storm), 1.5); } }
  }
  update(dt) {
    const G = this.G, pp = G.player.position, rain = G.env.w.rain;
    const day = clamp(1 - G.env.night * 0.65, 0.3, 1);
    this.target = Math.round((G.env.q?.peds ?? 40) * (G.settings.peds ?? 1) * day * (1 - rain * 0.35));
    this.cd -= dt;
    // Spawnen / Entfernen
    if (this.cd <= 0) {
      this.cd = 0.18;
      const civs = this.list.filter((p) => p.type === 'civ').length;
      if (civs < this.target && this.list.length < 240) this.spawnCivilian();
    }
    // Regen: Unterschlupf suchen
    this.shelterT = (this.shelterT || 0) - dt;
    if (rain > 0.25 && this.shelterT <= 0) {
      this.shelterT = 1.2;
      for (const p of this.list) {
        if (!p.alive || p.type !== 'civ' || p.umbrella || (p.state !== 'walk' && p.state !== 'idle')) continue;
        if (Math.random() < 0.18) { // zum nächsten Gebäudeeingang (Blockrand) laufen
          const b = this.G.world.blockAt.get(Math.floor(p.pos.x / 100) + ',' + Math.floor(p.pos.z / 100)) ;
          const tx = p.pos.x + (Math.random() - 0.5) * 20, tz = p.pos.z + (Math.random() - 0.5) * 20;
          p.target = { x: tx, z: tz }; p.state = 'shelter'; p.t = 12; p.jog = true;
          if (p.sayCd <= 0) { this.G.ui?.say(p, rnd.pick(BARKS.rain), 1.8); p.sayCd = 8; }
        }
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      const d = Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z);
      if (!p.alive) { if (p.deadT > 25 || d > 150) { this.remove(p); continue; } }
      else if (p.persist) { /* bleibt */ }
      else if (d > 165 || (d > 115 && !this.G.cameraSees(p.pos))) { this.remove(p); continue; }
      if (d < 140) p.update(dt);
      else p.char.root.visible = false;
      if (p.state !== 'inside') p.char.root.visible = d < 130;
    }
    // Fahrzeugkollisionen mit Peds
    for (const v of G.vehicles.list) {
      if (v.speed < 1.8 || (v.kind === 'plane' && v.air) || v.kind === 'boat') continue;
      const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
      for (const p of this.list) {
        if (!p.alive || p.state === 'ragdoll' || p.state === 'inside') continue;
        const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z; if (dx * dx + dz * dz > (v.size + 1) ** 2) continue;
        const fwd = dx * sy + dz * cy, lat = dx * cy - dz * sy;
        if (Math.abs(fwd) < v.spec.len / 2 + 0.3 && Math.abs(lat) < v.spec.wid / 2 + 0.35 && p.pos.y < v.pos.y + v.spec.hgt) {
          const sp = v.speed, byPlayer = v.driver === 'player';
          const vx = v.vx, vz = v.vz;
          p.hurt(sp * 5.5, byPlayer ? G.player : v, false, false);
          if (p.state !== 'dead') p.knock(vx, vz, Math.min(14, sp * 0.8));
          if (byPlayer) G.police?.crime(p.alive ? 'hitped' : 'killped', p.alive ? 0.4 : 0.8, p.pos, p);
          G.audio?.thud?.(); G.fx?.puff(p.pos.x, p.pos.y + 1, p.pos.z, 0xaaaaaa, 3);
          v.setWorldVel(v.vx * 0.94, v.vz * 0.94);
        }
      }
    }
  }
  nearestTo(x, z, r, filter = null) { let b = null, bd = r; for (const p of this.list) { if (!p.alive || (filter && !filter(p))) continue; const d = Math.hypot(p.pos.x - x, p.pos.z - z); if (d < bd) { bd = d; b = p; } } return b; }
}

// ====================== Verkehr ======================
const TRAFFIC_WEIGHTS = { compact: 18, sedan: 22, coupe: 6, sport: 3, muscle: 5, classic: 3, suv: 14, pickup: 7, van: 6, truck: 2, bus: 2, taxi: 7, moto: 4 };
export class TrafficManager {
  constructor(G) {
    this.G = G; this.cd = 0; this.parked = new Map(); this.target = 30; this.drivers = new Set();
    G.on('vehicleCrash', (e) => this.onCrash(e)); G.on('vehicleShot', (e) => { if (e.v.driver && e.v.driver !== 'player') this.panic(e.v, e.by?.pos || e.by?.position || G.player.pos); });
    G.on('explosion', (e) => { for (const v of G.vehicles.list) if (v.ai && Math.hypot(v.pos.x - e.x, v.pos.z - e.z) < 60) this.panic(v, { x: e.x, z: e.z }); });
    this.models = TRAFFIC_MODELS;
    this.weighted = [];
    for (const m of this.models) { const w = TRAFFIC_WEIGHTS[m.cls] || 1; for (let i = 0; i < w; i++) this.weighted.push(m); }
  }
  onCrash(e) {
    const { v, other } = e;
    for (const q of [v, other]) if (q && q.ai && q.driver !== 'player') { if (e.hard > 3) q.ai.panic = Math.max(q.ai.panic, 3.5); }
  }
  panic(v, from) { if (!v.ai) return; v.ai.panic = 8; v.ai.threat = { x: from.x, z: from.z }; }
  pickModel(avenue) {
    for (let i = 0; i < 6; i++) { const m = this.weighted[Math.floor(Math.random() * this.weighted.length)]; if (m.cls === 'bus' && !avenue) continue; return m; }
    return this.weighted[0];
  }
  pickNext(from, to) {
    const cand = to.out.filter((o) => o.to !== from);
    if (!cand.length) return from;
    // Gerade bevorzugen
    const din = [to.x - from.x, to.z - from.z];
    let tot = 0; const ws = cand.map((o) => { const dot = (o.dx * din[0] + o.dz * din[1]) / 100; const w = dot > 0.5 ? 5 : 2; tot += w; return w; });
    let r = Math.random() * tot; for (let i = 0; i < cand.length; i++) { r -= ws[i]; if (r <= 0) return cand[i].to; }
    return cand[0].to;
  }
  makeDriver(v, a, b) {
    const G = this.G, W = G.world;
    const drv = new RouteDriver(G, v, { pers: 0.8 + Math.random() * 0.35 });
    drv.a = a; drv.b = b; drv.c = this.pickNext(a, b);
    drv.pts = legPoints(a, b, drv.c, W);
    // Startposition: nächster Punkt
    let bi = 0, bd = 1e12; for (let k = 0; k < drv.pts.length; k++) { const d = (drv.pts[k].x - v.pos.x) ** 2 + (drv.pts[k].z - v.pos.z) ** 2; if (d < bd) { bd = d; bi = k; } }
    drv.i = Math.max(0, bi - 1);
    drv.cls = v.spec.cls;
    v.ai = drv; v.driver = drv; v.ctrl = (dt) => this.drive(drv, dt);
    return drv;
  }
  extend(drv) {
    const W = this.G.world;
    drv.a = drv.b; drv.b = drv.c; drv.c = this.pickNext(drv.a, drv.b);
    const np = legPoints(drv.a, drv.b, drv.c, W);
    // alte Punkte verwerfen
    drv.pts = drv.pts.slice(Math.max(0, drv.i - 2)).concat(np); drv.i = Math.min(drv.i, 2);
  }
  replan(drv) {
    const G = this.G, v = drv.v, W = G.world;
    const n = W.nearestNode(v.pos.x, v.pos.z, 300); if (!n || !n.out.length) return false;
    // Kante in Fahrtrichtung bevorzugen
    let best = null, bs = -9;
    for (const o of n.out) { const s = o.dx * Math.sin(v.yaw) + o.dz * Math.cos(v.yaw); if (s > bs) { bs = s; best = o; } }
    const b = bs > -0.2 ? best.to : n; const a = bs > -0.2 ? n : best.to;
    const nn = (b === n) ? best.to : b;
    drv.a = n; drv.b = best.to; drv.c = this.pickNext(n, best.to);
    drv.pts = legPoints(drv.a, drv.b, drv.c, W); drv.i = 0;
    drv.pts.unshift({ x: v.pos.x + Math.sin(v.yaw) * 4, z: v.pos.z + Math.cos(v.yaw) * 4, lim: 6 });
    drv.panic = 0; return true;
  }
  drive(drv, dt) {
    const G = this.G, v = drv.v, W = G.world;
    if (v.exploded || v.health <= 0) { v.in.throttle = 0; v.in.brake = 1; v.ctrl = null; v.driver = null; v.ai = null; return; }
    if (drv.dead) return;
    if (drv.panic > 0) {
      drv.panic -= dt;
      // Panikflucht: weg von der Bedrohung, dabei Straße folgen (zufällige Weiterfahrt)
      const th = drv.threat || G.player.position;
      const dx = v.pos.x - th.x, dz = v.pos.z - th.z, l = Math.hypot(dx, dz) || 1;
      let tx = v.pos.x + dx / l * 25, tz = v.pos.z + dz / l * 25;
      const ob = drv.obstacle(18); const w = W.pushCircle(v.pos.x + Math.sin(v.yaw) * 7, v.pos.z + Math.cos(v.yaw) * 7, 1.5, v.pos.y + 0.3);
      if (w.hit) { tx = v.pos.x + w.nx * 20 + Math.sin(v.yaw) * 2; tz = v.pos.z + w.nz * 20 + Math.cos(v.yaw) * 2; }
      drv.steerTo(tx, tz); drv.speedControl(dt, Math.min(Math.max(14, v.vtop * 0.35), ob > 90 ? 99 : ob));
      v.siren = false;
      if (drv.panic <= 0) this.replan(drv);
      return;
    }
    // Pfad verlängern
    if (drv.pts.length - drv.i < 12 || drv.remaining() < 55) this.extend(drv);
    let lim = drv.follow(dt, drv.pts[Math.min(drv.pts.length - 1, drv.i)].lim * drv.pers * (v.spec.cls === 'bus' || v.spec.cls === 'truck' ? 0.8 : 1));
    // Hindernisse und Ampeln
    const range = 12 + v.speed * 1.5;
    const ob = drv.obstacle(range); const sg = drv.signalLimit();
    // Sirene hinter uns → Platz machen
    let off = 0;
    for (const o of G.vehicles.list) { if (o !== v && (o.siren || o.sirenOn) && o.driver && o.speed > 5) { const dx = v.pos.x - o.pos.x, dz = v.pos.z - o.pos.z, d = Math.hypot(dx, dz); const ahead = (dx * Math.sin(o.yaw) + dz * Math.cos(o.yaw)); if (d < 40 && ahead > 0) { off = -2.2; lim = Math.min(lim, 5); } } }
    const target = Math.min(lim, ob, sg);
    drv.speedControl(dt, Math.max(0, target));
    // Festhängen
    if (v.speed < 0.4 && target > 2) { drv.stuckT += dt; } else drv.stuckT = Math.max(0, drv.stuckT - dt);
    if (drv.stuckT > 7) { drv.stuckT = 0; drv.reverseT = 1.5; }
    if (drv.reverseT > 0) { drv.reverseT -= dt; v.in.throttle = -0.8; v.in.brake = 0; v.in.steer = -v.in.steer; if (drv.reverseT <= 0) this.replan(drv); }
    // Rückwärtsfahrer (nach Crash) umsetzen
    v.horn = false;
    // Hupen bei Blockade
    if (ob < 1 && target < 0.5 && sg > 5 && Math.random() < dt * 0.15) v.horn = true;
  }
  spawnDriven() {
    const G = this.G, W = G.world, pp = G.player.position, cam = G.camera.position;
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 190;
      const x = pp.x + Math.cos(a) * d, z = pp.z + Math.sin(a) * d;
      const n = W.nearestNode(x, z, 150); if (!n || !n.out.length) continue;
      const o = n.out[Math.floor(Math.random() * n.out.length)];
      const t = 0.15 + Math.random() * 0.7;
      const model = this.pickModel(o.edge.kind === 'avenue' || o.edge.kind === 'highway');
      const off = (o.edge.kind === 'avenue' ? 5.6 : o.edge.kind === 'highway' ? 3.7 : 3.5);
      const rx = -o.dz, rz = o.dx;
      const px = n.x + o.dx * 100 * t + rx * off, pz = n.z + o.dz * 100 * t + rz * off;
      const dist = Math.hypot(px - cam.x, pz - cam.z); if (dist < 70) continue;
      if (dist < 140) { const dir = new THREE.Vector3(); G.camera.getWorldDirection(dir); if (((px - cam.x) * dir.x + (pz - cam.z) * dir.z) / dist > 0.5) continue; }
      let free = true; for (const q of G.vehicles.list) if (Math.hypot(q.pos.x - px, q.pos.z - pz) < 12) { free = false; break; }
      if (!free) continue;
      const yaw = Math.atan2(o.dx, o.dz);
      const v = G.vehicles.spawn(model, px, pz, yaw, { color: PALETTE_CARS[Math.floor(Math.random() * PALETTE_CARS.length)], sleep: false });
      if (model.taxi) v.setColor(0xffc107);
      v.tag = 'traffic'; v.setWorldVel(o.dx * 6, o.dz * 6); v.in.throttle = 0.3;
      this.makeDriver(v, n, o.to);
      return v;
    }
    return null;
  }
  spawnParked() {
    const G = this.G, W = G.world, pp = G.player.position, spots = W.parkSpots;
    if (!spots.length) return;
    for (let k = 0; k < 6; k++) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      if (s.v || this.parked.has(s)) continue;
      const d = Math.hypot(s.x - pp.x, s.z - pp.z); if (d > 150 || d < 20) continue;
      if (!s.model) { s.model = this.pickModel(false); s.color = PALETTE_CARS[Math.floor(Math.random() * PALETTE_CARS.length)]; s.dmg = Math.random() < 0.1 ? 0.4 : 0; }
      if (s.model.cls === 'bus' || s.model.cls === 'truck' || Math.random() < 0.5) { s.model = this.pickModel(false); if (s.model.cls === 'bus') continue; }
      const v = G.vehicles.spawn(s.model, s.x, s.z, s.yaw + (Math.random() < 0.5 ? 0 : 0), { color: s.color, dmg: s.dmg });
      if (s.model.taxi) v.setColor(0xffc107);
      v.tag = 'parked'; v.spot = s; this.parked.set(s, v);
      return;
    }
  }
  update(dt) {
    const G = this.G, pp = G.player.position, rain = G.env.w.rain;
    const day = clamp(1 - G.env.night * 0.45, 0.4, 1);
    const n = G.vehicles.list.filter((v) => v.tag === 'traffic' && v.ai).length;
    this.target = Math.round((G.env.q?.cars ?? 32) * (G.settings.traffic ?? 1) * day * (1 - rain * 0.2));
    this.cd -= dt;
    if (this.cd <= 0) {
      this.cd = 0.25;
      if (n < this.target) this.spawnDriven();
      if (this.parked.size < 38 * (G.settings.traffic ?? 1)) this.spawnParked();
    }
    // Entfernen
    this.rm = (this.rm || 0) - dt;
    if (this.rm <= 0) {
      this.rm = 0.8;
      for (const v of [...G.vehicles.list]) {
        if (v.player || v.owned || v.missionVehicle || v.keep) continue;
        const d = Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z);
        if (v.tag === 'traffic') { if (d > 360 || (d > 220 && !G.cameraSees(v.pos)) ) { G.vehicles.despawn(v); } }
        else if (v.tag === 'parked') { if (d > 210 && !v.driver) { this.parked.delete(v.spot); G.vehicles.despawn(v); } else if (v.exploded && v.wreckT > 60) { this.parked.delete(v.spot); } }
        else if (v.tag === 'abandoned' && d > 300) G.vehicles.despawn(v);
      }
      // verwaiste geparkte, die gefahren wurden → in Abandoned umwandeln
      for (const [s, v] of this.parked) { if (v.dead) this.parked.delete(s); else if (v.driver || v.speed > 1) { if (v.sleeping === false && v.speed > 2) { v.tag = 'abandoned'; this.parked.delete(s); } } }
    }
  }
  // Fahrer aus Fahrzeug ziehen
  carjack(v, player) {
    const G = this.G;
    const drv = v.driver; v.driver = null; v.ai = null; v.ctrl = null; v.carjackFlag = true; v.tag = 'abandoned';
    const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw), side = v.model.doorX;
    const ped = G.peds.spawnAt(v.pos.x + cy * side, v.pos.z - sy * side);
    ped.scare(player, 10); ped.threat = player.pos;
    if (Math.random() < 0.25) { ped.state = 'fight'; ped.hostile = true; ped.t = 12; }
    G.ui?.say(ped, ['Hey, mein Auto!', 'Du Dieb!', 'Hilfe, Überfall!'][Math.floor(Math.random() * 3)], 2.2);
    v.in.brake = 1; v.in.throttle = 0;
    return ped;
  }
}
