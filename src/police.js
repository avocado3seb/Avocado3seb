// Fahndungssystem: Polizei, Streifenwagen, SWAT, Helikopter, Straßensperren
import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, angDiff, smoothstep } from './util.js';
import { byKey } from './vehicledata.js';
import { RouteDriver } from './ai.js';
import { PedManager } from './npc.js';

const COP_OUTFIT = { skin: 0xe0ac86, hairStyle: 1, hairColor: 0x2a1e14, top: 1, topColor: 0x1a2a4a, bottom: 0, bottomColor: 0x141c30, shoe: 0, shoeColor: 0x111111, hat: 1, hatColor: 0x14203a, glasses: 1, watch: 0, build: 1 };
const SWAT_OUTFIT = { ...COP_OUTFIT, top: 4, topColor: 0x15181c, bottomColor: 0x15181c, hat: 2, hatColor: 0x111111, build: 1.12 };
const ARMY_OUTFIT = { ...COP_OUTFIT, top: 4, topColor: 0x4b5d3a, bottomColor: 0x3d4f2a, hat: 2, hatColor: 0x3d4f2a, glasses: 0, build: 1.1 };

export class Police {
  constructor(G) {
    this.G = G; this.heat = 0; this.stars = 0; this.seenT = 0; this.sinceCrime = 0;
    this.units = []; this.footCops = []; this.helis = []; this.blocks = []; this.queue = []; this.searching = false;
    this.cd = 0; this.bustT = 0; this.maxStars = 5; this.suppress = false; this.cooldownT = 0; this.sirenOn = false;
    this.lastSeen = null; this.respawnCd = 0;
    G.on('pedKilled', (e) => { if (e.src === G.player) { G.player.stats.kills++; if (e.ped.type === 'cop') this.crime('killcop', 1.6, e.ped.pos); else if (e.ped.type === 'civ') this.crime('killped', 0.5, e.ped.pos, e.ped); } });
    G.on('explosion', (e) => { if (e.source === G.player) this.crime('explosion', 0.8, { x: e.x, z: e.z }); });
    G.on('vehicleShot', (e) => { if (e.by === G.player && e.v.spec.cop) this.crime('hitcop', 0.4, e.v.pos); });
    G.on('vehicleCrash', (e) => { const pv = G.player.vehicle; if (pv && (e.v === pv || e.other === pv)) { const o = e.v === pv ? e.other : e.v; if (o && o.spec.cop && e.hard > 3) this.crime('hitcop', 0.3, o.pos); } });
  }
  get wanted() { return this.stars; }
  setWanted(n) { this.heat = n >= 1 ? n + 0.01 : 0; this.stars = n; this.seenT = 0; if (n > 0) this.G.emit('wanted', n); }
  clear(silent = false) { const had = this.stars > 0; this.heat = 0; this.stars = 0; this.searching = false; this.seenT = 0; if (had && !silent) { this.G.ui?.toast('Fahndung beendet – du bist entkommen!'); this.G.emit('wantedCleared'); } }
  // Verbrechen melden
  crime(type, amount, pos, victim = null) {
    if (this.suppress || amount <= 0 || type === 'none') return;
    const G = this.G;
    if (this.copsSee(pos, 100) || this.stars > 0) { this.addHeat(amount, type); return; }
    // Zivile Zeugen
    for (const p of G.peds.list) {
      if (!p.alive || p === victim || p.type !== 'civ' || p.state === 'inside') continue;
      if (Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < 26) { this.queue.push({ t: 2.5, amount, type, w: p }); return; }
    }
  }
  addHeat(a, type = '') {
    const old = this.stars;
    this.heat = clamp(this.heat + a, 0, 5.99);
    this.stars = Math.min(this.maxStars, Math.floor(this.heat));
    if (this.heat > 0 && this.stars === 0 && a > 0 && this.heat >= 0.99) this.stars = 1;
    this.seenT = 0; this.sinceCrime = 0;
    if (this.stars > old) { this.G.ui?.toast(`Fahndungsstufe ${'★'.repeat(this.stars)}`); this.G.emit('wanted', this.stars); this.G.audio?.wantedUp?.(); }
  }
  copsSee(pos, range = 90) {
    const G = this.G, W = G.world;
    const check = (p, r) => { const d = Math.hypot(p.x - pos.x, p.z - pos.z); if (d > r) return false; const ox = p.x, oy = (p.y || 0) + 1.5, oz = p.z; const dx = pos.x - ox, dz = pos.z - oz, l = Math.hypot(dx, dz) || 1; const t = W.rayHit(ox, oy, oz, dx / l, ((pos.y || 0) + 1.0 - oy) / l, dz / l, l); return t === null; };
    for (const u of this.units) if (!u.v.exploded && check(u.v.pos, range)) return true;
    for (const c of this.footCops) if (c.alive && check(c.pos, range * 0.7)) return true;
    for (const h of this.helis) if (!h.exploded && check(h.pos, 230)) return true;
    for (const v of G.vehicles.list) if (v.spec.cop && !v.units && v.driver && v.ai && !v.exploded && check(v.pos, range)) return true;   // Streife
    return false;
  }
  spawnFootCop(x, z, kind = 'cop') {
    const G = this.G;
    const ped = G.peds.spawnAt(x, z, 'cop', kind === 'army' ? ARMY_OUTFIT : kind === 'swat' ? SWAT_OUTFIT : COP_OUTFIT);
    ped.isCop = true; ped.persist = true; ped.noDrop = true; ped.kind = kind; ped.health = kind === 'cop' ? 90 : 140; ped.weapon = kind === 'cop' ? 'pistol' : kind === 'swat' ? 'smg' : 'rifle';
    ped.holding = false; ped.cash = 0;
    ped.brain = (dt, p) => this.footBrain(dt, p);
    this.footCops.push(ped);
    return ped;
  }
  footBrain(dt, p) {
    const G = this.G, pl = G.player, W = G.world;
    p.state = 'brain';
    if (this.stars === 0) { p.t -= 0; if (!p.leaveT) p.leaveT = 6; p.leaveT -= dt; if (p.leaveT <= 0) { p.persist = false; p.leaveT = 0; p.state = 'idle'; p.brain = null; p.isCop = false; this.footCops = this.footCops.filter((c) => c !== p); } return { vx: 0, vz: 0, spd: 0 }; }
    const tx = pl.vehicle ? pl.vehicle.pos.x : pl.pos.x, tz = pl.vehicle ? pl.vehicle.pos.z : pl.pos.z;
    const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
    const ox = p.pos.x, oy = p.pos.y + 1.5, oz = p.pos.z;
    const los = d < 60 && W.rayHit(ox, oy, oz, dx / (d || 1), ((pl.pos.y + 1) - oy) / (d || 1), dz / (d || 1), d) === null;
    p.faceTarget = los && d < 40; p.lookAt = { x: tx, z: tz };
    p.char.state.aiming = los && d < 40 && d > 2.5;
    p.hostile = true;
    // Schießen
    p.cooldown -= 0;
    if (los && d < 42 && d > 2 && p.cooldown <= 0 && !G.cheat?.noShoot) {
      const rate = p.weapon === 'pistol' ? 1.1 : p.weapon === 'smg' ? 0.18 : 0.22;
      p.cooldown = rate * (0.8 + Math.random() * 0.6);
      const m = new THREE.Vector3(p.pos.x + Math.sin(p.yaw) * 0.4, p.pos.y + 1.4, p.pos.z + Math.cos(p.yaw) * 0.4);
      const tgt = new THREE.Vector3(tx, (pl.vehicle ? pl.vehicle.pos.y + 0.9 : pl.pos.y + 1.1), tz);
      const dir = tgt.sub(m).normalize();
      const acc = clamp(1 - d / 55, 0.1, 0.8);
      G.combat.fire(p, m, dir, p.weapon, { spreadMul: 3.5 - acc * 2.6, dmgMul: 0.38 });
    }
    // Bewegung
    const want = d > (p.weapon === 'pistol' ? 9 : 14) ? 4.4 : 0;
    if (d < 1.5) { return { vx: 0, vz: 0, spd: 0 }; }
    if (want > 0 || !los) {
      const sp = 4.6; return { vx: dx / d * sp, vz: dz / d * sp, spd: sp };
    }
    return { vx: 0, vz: 0, spd: 0 };
  }
  spawnUnit(kind = 'patrol', near = null) {
    const G = this.G, W = G.world, pl = G.player.position, cam = G.camera.position;
    const key = kind === 'swat' ? 'swat_enforcer' : kind === 'army' ? 'army_jeep' : kind === 'interceptor' ? 'interceptor' : kind === 'suv' ? 'police_suv' : 'patrol_cruiser';
    const spec = byKey.get(key);
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 130;
      let x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
      const n = W.nearestNode(x, z, 200); if (!n) continue;
      const o = n.out[Math.floor(Math.random() * n.out.length)]; if (!o) continue;
      const px = n.x + o.dx * 30, pz = n.z + o.dz * 30;
      const dist = Math.hypot(px - cam.x, pz - cam.z); if (dist < 90) continue;
      if (dist < 160) { const dir = new THREE.Vector3(); G.camera.getWorldDirection(dir); if (((px - cam.x) * dir.x + (pz - cam.z) * dir.z) / dist > 0.5) continue; }
      if (G.vehicles.list.some((q) => Math.hypot(q.pos.x - px, q.pos.z - pz) < 8)) continue;
      const v = G.vehicles.spawn(spec, px, pz, Math.atan2(o.dx, o.dz), { sleep: false });
      v.tag = 'police'; v.keep = true; v.siren = true; v.sirenOn = true; v.units = true;
      const drv = new RouteDriver(G, v, { pers: 1.2 });
      v.driver = drv; v.ai = drv; v.ctrl = (dt) => this.driveUnit(u, dt);
      const u = { v, drv, mode: 'pursuit', kind, repath: 0, path: null, stuck: 0, peds: [], deployed: false, rev: 0 };
      this.units.push(u); return u;
    }
    return null;
  }
  convertPatrol(v) {
    // vorhandene Streifenwagen (Ambient) in Verfolgung versetzen
    const drv = v.ai; if (!drv) return;
    v.keep = true; v.sirenOn = true; v.siren = true; v.units = true; v.tag = 'police';
    const u = { v, drv, mode: 'pursuit', kind: 'patrol', repath: 0, path: null, stuck: 0, peds: [], deployed: false, rev: 0 };
    v.ctrl = (dt) => this.driveUnit(u, dt); this.units.push(u);
  }
  driveUnit(u, dt) {
    const G = this.G, v = u.v, W = G.world, pl = G.player, drv = u.drv;
    if (v.exploded || v.health <= 0) { v.ctrl = null; v.driver = null; return; }
    const pp = pl.vehicle ? pl.vehicle.pos : pl.pos, pv = pl.vehicle;
    const d = Math.hypot(pp.x - v.pos.x, pp.z - v.pos.z);
    if (this.stars === 0) { // abziehen
      drv.pers = 0.9; u.mode = 'leave';
    }
    if (u.mode === 'deployed') { v.in.throttle = 0; v.in.brake = 1; v.in.hand = true; return; }
    if (u.mode === 'leave') {
      // normal weiterfahren: zurück zum Verkehr
      G.traffic.makeDriver(v, W.nearestNode(v.pos.x, v.pos.z, 300) || W.nodeList[0], (W.nearestNode(v.pos.x, v.pos.z, 300) || W.nodeList[0]).out[0].to);
      v.sirenOn = false; v.siren = false; v.units = false; v.tag = 'traffic'; v.keep = false; this.units = this.units.filter((q) => q !== u); return;
    }
    // Aussteigen, wenn Spieler zu Fuß und nah, oder wenn stehend
    if ((!pv && d < 22) || (pv && pv.speed < 2.5 && d < 14)) {
      if (!u.deployed) { u.deployed = true; u.mode = 'deployed'; this.deploy(u); }
      return;
    }
    // Pfad
    u.repath -= dt;
    const los = d < 70 && W.rayHit(v.pos.x, v.pos.y + 1, v.pos.z, (pp.x - v.pos.x) / d, 0, (pp.z - v.pos.z) / d, d) === null;
    let lim = v.vtop * 0.95;
    if (los && d < 90) {
      // Direktes Verfolgen (mit Vorhalt)
      const lead = clamp(d / 25, 0, 2.5);
      const tx = pp.x + (pv ? pv.vx : 0) * lead * 0.5, tz = pp.z + (pv ? pv.vz : 0) * lead * 0.5;
      drv.steerTo(tx, tz);
      const ob = drv.obstacle(10 + v.speed);
      const near = d < 12;
      const ts = near ? Math.max(6, (pv ? pv.speed : 0) + 4) : Math.min(lim, 38 + this.stars * 3);
      drv.speedControl(dt, Math.min(ts, ob < 3 ? 0 : 99));
      u.path = null; v.horn = false;
    } else {
      if (u.repath <= 0 || !u.path) {
        u.repath = 1.4;
        const a = W.nearestNode(v.pos.x, v.pos.z, 300), b = W.nearestNode(pp.x, pp.z, 300);
        const nodes = a && b ? W.findPath(a, b, 1500) : null;
        if (nodes && nodes.length) {
          const pts = [];
          for (let k = 0; k < nodes.length; k++) pts.push({ x: nodes[k].x, z: nodes[k].z, lim: nodes[k].out[0]?.edge.speed * 1.6 || 20 });
          // erste Punkte entfernen, die hinter uns liegen
          drv.pts = pts; drv.i = 0;
          while (drv.i < pts.length - 1 && ((pts[drv.i].x - v.pos.x) * Math.sin(v.yaw) + (pts[drv.i].z - v.pos.z) * Math.cos(v.yaw)) < 0 && Math.hypot(pts[drv.i].x - v.pos.x, pts[drv.i].z - v.pos.z) < 40) drv.i++;
          u.path = pts;
        }
      }
      if (u.path) {
        let l2 = drv.follow(dt, 34 + this.stars * 2);
        for (const p of drv.pts) p.lim = Math.max(p.lim, 18);
        const ob = drv.obstacle(12 + v.speed); drv.speedControl(dt, Math.min(l2 ?? 20, ob < 3 ? 0 : 99, 32));
      } else { drv.steerTo(pp.x, pp.z); drv.speedControl(dt, 14); }
    }
    // Festhängen
    if (v.speed < 0.6) { u.stuck += dt; } else u.stuck = Math.max(0, u.stuck - dt);
    if (u.stuck > 3.5) { u.rev = 1.6; u.stuck = 0; }
    if (u.rev > 0) { u.rev -= dt; v.in.throttle = -1; v.in.brake = 0; v.in.steer *= -1; }
  }
  deploy(u) {
    const G = this.G, v = u.v; const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    const n = u.kind === 'swat' ? 3 : u.kind === 'army' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const side = (i % 2 ? -1 : 1) * (v.model.doorX + 0.4);
      const p = this.spawnFootCop(v.pos.x + cy * side - sy * i * 0.5, v.pos.z - sy * side - cy * i * 0.5, u.kind === 'swat' ? 'swat' : u.kind === 'army' ? 'army' : 'cop');
      u.peds.push(p);
    }
    v.in.throttle = 0; v.in.brake = 1;
  }
  spawnHeli() {
    const G = this.G, pl = G.player.position;
    const spec = byKey.get('police_hawk');
    const a = Math.random() * 6.28;
    const h = G.vehicles.spawn(spec, pl.x + Math.cos(a) * 260, pl.z + Math.sin(a) * 260, 0, { sleep: false });
    h.pos.y = G.world.groundY(h.pos.x, h.pos.z) + 55; h.kinematic = true; h.driver = { ai: true }; h.keep = true; h.tag = 'police'; h.rotor = 1; h.sirenOn = true; h.siren = true; h.units = true;
    h.heliAng = Math.random() * 6.28; h.heliR = 30; h.heliCd = 1;
    // Suchscheinwerfer
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 55, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.geometry.translate(0, -27.5, 0); cone.rotation.x = 0; this.G.scene.add(cone); h.cone = cone;
    const spot = new THREE.SpotLight(0xfff0d0, 0, 140, 0.16, 0.4, 1.2); this.G.scene.add(spot); this.G.scene.add(spot.target); h.spot = spot;
    this.helis.push(h); return h;
  }
  updateHeli(h, dt) {
    const G = this.G, pl = G.player, pp = pl.vehicle ? pl.vehicle.pos : pl.pos;
    if (h.exploded) { return; }
    h.heliAng += dt * 0.22;
    const tx = pp.x + Math.cos(h.heliAng) * h.heliR, tz = pp.z + Math.sin(h.heliAng) * h.heliR;
    const ty = G.world.groundY(pp.x, pp.z) + (this.stars >= 4 ? 38 : 52);
    h.pos.x = damp(h.pos.x, tx, 0.6, dt); h.pos.z = damp(h.pos.z, tz, 0.6, dt); h.pos.y = damp(h.pos.y, ty, 0.8, dt);
    const dx = pp.x - h.pos.x, dz = pp.z - h.pos.z;
    h.yaw = dampAngle(h.yaw, Math.atan2(dx, dz), 1.2, dt);
    h.pitch = damp(h.pitch, 0.1, 2, dt); h.roll = damp(h.roll, 0.1, 2, dt);
    h.rotor = 1; h._vel = h._vel || new THREE.Vector3();
    // Scheinwerfer
    const night = G.env.night;
    if (h.cone) { h.cone.position.set(h.pos.x, h.pos.y - 1.5, h.pos.z); h.cone.lookAt(pp.x, pp.y, pp.z); h.cone.rotateX(Math.PI / 2); h.cone.visible = night > 0.15 || true; h.cone.material.opacity = 0.05 + night * 0.12; }
    if (h.spot) { h.spot.position.set(h.pos.x, h.pos.y - 1.5, h.pos.z); h.spot.target.position.set(pp.x, pp.y, pp.z); h.spot.intensity = night > 0.15 ? 4000 : 0; }
    // Feuer (ab 5 Sterne)
    if (this.stars >= 5) { h.heliCd -= dt; if (h.heliCd <= 0) { h.heliCd = 0.5; const m = new THREE.Vector3(h.pos.x, h.pos.y - 1, h.pos.z); const dir = new THREE.Vector3(pp.x - m.x, pp.y + 1 - m.y, pp.z - m.z).normalize(); G.combat.fire(h, m, dir, 'rifle', { spreadMul: 5, dmgMul: 0.3 }); } }
  }
  roadblock() {
    const G = this.G, W = G.world, pl = G.player, v = pl.vehicle;
    if (!v || this.blocks.length >= 2) return;
    // Knoten ca. 220 m voraus in Fahrtrichtung
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const n = W.nearestNode(v.pos.x + fx * 230, v.pos.z + fz * 230, 80); if (!n) return;
    if (this.blocks.some((b) => b.n === n)) return;
    // Straße quer zur Fahrtrichtung sperren
    const horiz = Math.abs(fx) > Math.abs(fz);
    const group = new THREE.Group();
    const spec = byKey.get('patrol_cruiser');
    const cars = [];
    for (let k = -1; k <= 1; k += 2) {
      const x = n.x + (horiz ? 0 : k * 5), z = n.z + (horiz ? k * 5 : 0);
      const c = G.vehicles.spawn(spec, x, z, horiz ? Math.PI / 2 * (fx > 0 ? 1 : -1) + Math.PI / 2 : Math.PI / 2 + (fz > 0 ? 0 : 0), { sleep: true });
      c.tag = 'block'; c.keep = true; c.siren = true; c.sirenOn = true; c.units = true; c.locked = true; c.yaw = horiz ? 0 : Math.PI / 2;
      cars.push(c);
    }
    const peds = [];
    for (let k = 0; k < 2; k++) { const p = this.spawnFootCop(n.x + (horiz ? -fx * 4 : k * 2 - 1), n.z + (horiz ? k * 2 - 1 : -fz * 4), this.stars >= 5 ? 'swat' : 'cop'); peds.push(p); }
    this.blocks.push({ n, cars, peds });
  }
  update(dt) {
    const G = this.G, pl = G.player;
    // verzögerte Zeugen
    for (let i = this.queue.length - 1; i >= 0; i--) { const q = this.queue[i]; q.t -= dt; if (q.t <= 0) { this.queue.splice(i, 1); if (q.w.alive) this.addHeat(q.amount, q.type); } }
    this.sinceCrime += dt;
    const pos = pl.vehicle ? pl.vehicle.pos : pl.pos;
    // Ambient-Streifen schalten auf Verfolgung, wenn Fahndung
    // Sichtprüfung
    if (this.stars > 0 && pl.alive) {
      const seen = this.copsSee({ x: pos.x, y: pos.y, z: pos.z }, 95);
      if (seen) { this.seenT = 0; this.searching = false; this.lastSeen = { x: pos.x, z: pos.z }; }
      else { this.seenT += dt; if (this.seenT > 6) this.searching = true; }
      // Abkühlen
      if (this.seenT > 22 + this.stars * 2) { this.heat = Math.max(0, Math.floor(this.heat) - 1 + 0.5); if (this.heat < 1) this.clear(); else { this.stars = Math.floor(this.heat); this.seenT = 8; this.G.ui?.toast(`Fahndungsstufe gesenkt: ${'★'.repeat(this.stars)}`); } }
    } else if (this.stars === 0 && this.heat > 0) { this.heat = Math.max(0, this.heat - dt * 0.02); }
    // Sollstärke
    const s = this.stars;
    const wantCars = [0, 2, 3, 4, 5, 6][s], wantHeli = s >= 3 ? (s >= 5 ? 2 : 1) : 0;
    this.cd -= dt;
    if (s > 0 && this.cd <= 0) {
      this.cd = 1.4;
      this.units = this.units.filter((u) => !u.v.dead);
      const active = this.units.filter((u) => !u.v.exploded && u.mode !== 'leave').length;
      if (active < wantCars) {
        const kind = s >= 5 && Math.random() < 0.5 ? 'army' : s >= 4 && Math.random() < 0.45 ? 'swat' : s >= 3 && Math.random() < 0.5 ? 'interceptor' : s >= 2 && Math.random() < 0.4 ? 'suv' : 'patrol';
        this.spawnUnit(kind);
      }
      // Streifen konvertieren
      for (const v of G.vehicles.list) if (v.spec.cop === 1 && v.tag === 'traffic' && v.ai && !v.units && Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) < 250) this.convertPatrol(v);
      this.helis = this.helis.filter((h) => !h.dead);
      if (this.helis.filter((h) => !h.exploded).length < wantHeli) this.spawnHeli();
      if (s >= 4 && Math.random() < 0.2) this.roadblock();
    }
    // Aufräumen bei 0 Sternen
    if (s === 0) {
      this.respawnCd -= dt;
      for (const u of this.units) { if (u.mode !== 'deployed') u.mode = 'leave'; else if (u.peds.every((p) => !p.alive || p.leaveT)) u.mode = 'leave'; }
      for (const h of this.helis) { if (h.dead) continue; h.pos.y += dt * 10; h.pos.x += dt * 20; if (Math.hypot(h.pos.x - pos.x, h.pos.z - pos.z) > 450) { this.killHeli(h); } }
      for (const b of this.blocks) { b.t = (b.t || 0) + dt; if (b.t > 12) { for (const c of b.cars) G.vehicles.despawn(c); for (const p of b.peds) { p.persist = false; } b.dead = true; } }
      this.blocks = this.blocks.filter((b) => !b.dead);
    }
    for (const h of this.helis) if (!h.dead) this.updateHeli(h, dt);
    // Entfernung zu weit
    for (const u of this.units) { if (Math.hypot(u.v.pos.x - pos.x, u.v.pos.z - pos.z) > 520 && !u.v.dead) { u.v.keep = false; G.vehicles.despawn(u.v); } }
    this.units = this.units.filter((u) => !u.v.dead);
    this.footCops = this.footCops.filter((c) => G.peds.list.includes(c));
    // Festnahme
    if (this.stars > 0 && pl.alive && !G.cheat?.god) this.updateBust(dt);
    else this.bustT = 0;
    if (this.stars > 0 && !pl.vehicle) { /* zu Fuß */ }
    G.hudWanted = { stars: this.stars, searching: this.searching };
  }
  killHeli(h) { if (h.cone) this.G.scene.remove(h.cone); if (h.spot) { this.G.scene.remove(h.spot); this.G.scene.remove(h.spot.target); } h.keep = false; this.G.vehicles.despawn(h); }
  updateBust(dt) {
    const G = this.G, pl = G.player, v = pl.vehicle;
    let close = false;
    for (const c of this.footCops) { if (!c.alive) continue; const d = Math.hypot(c.pos.x - pl.position.x, c.pos.z - pl.position.z); if (d < (v ? 3.2 : 1.7)) close = true; }
    const slow = v ? v.speed < 2.5 : Math.hypot(pl.vel.x, pl.vel.z) < 2.2;
    if (close && slow && !pl.aim) this.bustT += dt; else this.bustT = Math.max(0, this.bustT - dt * 1.5);
    if (this.bustT > (v ? 2.2 : 1.4)) { this.bustT = 0; G.emit('busted'); }
  }
  reset() {
    const G = this.G;
    this.clear(true); this.queue.length = 0;
    for (const u of this.units) { u.v.keep = false; G.vehicles.despawn(u.v); } this.units = [];
    for (const h of this.helis) this.killHeli(h); this.helis = [];
    for (const b of this.blocks) for (const c of b.cars) G.vehicles.despawn(c); this.blocks = [];
    for (const c of this.footCops) G.peds.remove(c); this.footCops = [];
  }
}
