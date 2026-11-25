// Spieler: Bewegung zu Fuß, Schwimmen, Fahrzeuge, Waffen, Kamera
import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, angDiff, smoothstep, wrapPI } from './util.js';
import { Character, DEFAULT_OUTFIT, weaponColorMat } from './character.js';
import { WEAPONS } from './data.js';
import { SEA } from './world.js';

const GRAV = 22;
const EARN = new Set(['Mission', 'Taxi', 'Kurier', 'Bürgerwehr', 'Rennen', 'Stunt', 'Paket', 'Alle Pakete', 'Schatz', 'VIP', 'Dieb gestellt', 'Anhalter', 'Bargeld', 'Raub', 'Einnahmen', 'Job', 'YouTube', 'Verkauf Flohmarkt']);

export class Player {
  constructor(G) {
    this.G = G;
    this.pos = new THREE.Vector3(900, 0, 100); this.vel = new THREE.Vector3(); this.yaw = 0; this.vy = 0;
    this.health = 100; this.armor = 0; this.hunger = 85; this.money = 5000; this.alive = true;
    this.onGround = true; this.swimming = false; this.vehicle = null; this.enterT = 0; this.exitT = 0;
    this.weapon = 'pistol'; this.weapons = { fist: { owned: true }, pistol: { owned: true, ammo: 48, loaded: 12 } };
    this.skins = {}; this.skinSel = 'default';
    this.outfit = { ...DEFAULT_OUTFIT, topColor: 0x1e88e5, bottomColor: 0x2d3a4a };
    this.owned = { tops: [0], bottoms: [0], shoes: [0], hats: [0], glasses: [0], watches: [0], skins: ['default'], hair: [1] };
    this.inv = { medkit: 1, armorkit: 0 };
    this.cd = 0; this.reloadT = 0; this.hurtT = 0; this.lastHurt = -99; this.aim = false;
    this.stun = 0; this.chute = false; this.chuteMesh = null; this.fall = 0; this.buff = {}; this.dead = false;
    this.stats = { distFoot: 0, distCar: 0, kills: 0, cars: 0, stunts: 0, money: 0, timePlayed: 0, wasted: 0, busted: 0, top: 0, packages: 0, missions: 0, races: 0, flights: 0 };
    this.prestige = 0; this.maxHealth = 100; this.fly = false;
    this.skills = { drive: 0, shoot: 0, cook: 0, it: 0, fit: 0 };
  }
  init() {
    const G = this.G;
    this.char = new Character(this.outfit);
    G.scene.add(this.char.root);
    this.char.setHeld('pistol');
    this.rig = new CameraRig(G, G.camera);
    this.refreshOutfit();
  }
  refreshOutfit() {
    const o = this.outfit;
    o.watch = this.watch || 0;
    this.char.setOutfit(o);
    this.refreshWeaponModel();
  }
  refreshWeaponModel() {
    const w = this.weapon;
    if (w === 'fist') { this.char.setHeld(null); return; }
    this.char.setHeld(w);
    const sk = this.skinSel;
    if (this.skinSelColor && w !== 'grenade') weaponColorMat(this.char.held.obj, this.skinSelColor);
  }
  get inVehicle() { return !!this.vehicle; }
  get position() { return this.vehicle ? this.vehicle.pos : this.pos; }
  teleport(x, z, y = null) {
    if (this.vehicle) { this.vehicle.place(x, z, this.vehicle.yaw); this.vehicle.wake(); this.vehicle.sleeping = false; }
    this.pos.set(x, y ?? this.G.world.groundY(x, z), z); this.vel.set(0, 0, 0); this.vy = 0;
  }
  addMoney(n, reason = '') {
    if (n > 0 && EARN.has(reason)) n = Math.round(n * (this.G.cfg?.reward ?? 1));
    this.money = Math.max(0, this.money + n);
    if (n > 0) this.stats.money += n;
    this.G.emit('money', { n, reason });
  }
  hurt(dmg, src = null) {
    if (!this.alive || this.G.cheat?.god) return;
    if (this.vehicle && src && src !== this) dmg *= 0.5;
    if (this.armor > 0) { const a = Math.min(this.armor, dmg * 0.7); this.armor -= a; dmg -= a; }
    this.health -= dmg; this.lastHurt = this.G.time; this.hurtT = 0.4;
    this.G.emit('playerHurt', { dmg, src });
    if (this.health <= 0 && this.alive) this.die(src);
  }
  die(src) {
    if (!this.alive) return;
    this.alive = false; this.health = 0; this.stats.wasted++;
    if (this.vehicle) this.exitVehicle(true);
    this.G.emit('playerDied', { src });
  }
  respawn(x, z, yaw = 0) {
    this.alive = true; this.health = 100; this.armor = 0; this.pos.set(x, this.G.world.groundY(x, z), z); this.vel.set(0, 0, 0);
    this.yaw = yaw; this.char.state.dead = false; this.stun = 0; this.hunger = Math.max(this.hunger, 40);
    this.G.camera?.position && this.rig.snap(this);
  }
  // ---------- Waffen ----------
  selectWeapon(w) {
    if (this.G.prison?.active && w !== 'fist') return;
    if (!this.weapons[w]?.owned || this.weapon === w) return;
    this.weapon = w; this.reloadT = 0; this.cd = 0.25; this.refreshWeaponModel(); this.G.emit('weaponChanged', w);
  }
  cycleWeapon(dir) {
    const list = Object.keys(this.weapons).filter((k) => this.weapons[k].owned);
    const i = list.indexOf(this.weapon); this.selectWeapon(list[(i + dir + list.length) % list.length]);
  }
  addWeapon(w, ammo = 0) {
    const d = WEAPONS[w]; let e = this.weapons[w];
    if (!e) e = this.weapons[w] = { owned: true, ammo: 0, loaded: d.mag };
    e.owned = true; e.ammo = (e.ammo || 0) + ammo;
    if (e.loaded === undefined) e.loaded = d.mag;
  }
  reload() {
    const w = WEAPONS[this.weapon], e = this.weapons[this.weapon];
    if (!e || w.melee || w.throw || this.reloadT > 0 || e.loaded >= w.mag || e.ammo <= 0) return;
    this.reloadT = 1.3; this.G.audio?.reload?.();
  }
  get muzzle() {
    const c = this.char, v = new THREE.Vector3(0, 0.05, 0.3);
    return c.held ? c.held.obj.localToWorld(v) : this.pos.clone().add(new THREE.Vector3(0, 1.3, 0));
  }

  update(dt) {
    const G = this.G, I = G.input, W = G.world;
    this.stats.timePlayed += dt;
    // Hunger / Regeneration
    this.hunger = Math.max(0, this.hunger - dt * 0.028);
    if (this.alive) {
      if (this.hunger <= 0) this.health -= dt * 0.4;
      else if (this.health < this.maxHealth && G.time - this.lastHurt > 6 && this.hunger > 20) this.health = Math.min(this.maxHealth, this.health + dt * (this.buff.regen ? 4 : 0.7) * (1 + this.skills.fit * 0.15));
      if (this.health <= 0) this.die(null);
    }
    for (const k of Object.keys(this.buff)) { this.buff[k] -= dt; if (this.buff[k] <= 0) delete this.buff[k]; }
    this.cd = Math.max(0, this.cd - dt);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { const e = this.weapons[this.weapon], w = WEAPONS[this.weapon]; const need = w.mag - e.loaded, take = Math.min(need, e.ammo); e.loaded += take; e.ammo -= take; } }
    this.hurtT = Math.max(0, this.hurtT - dt);
    const inputOK = G.mode === 'play' && this.alive && this.enterT <= 0;
    if (this.vehicle) this.updateInVehicle(dt, inputOK);
    else if (this.fly) this.updateFly(dt, inputOK);
    else this.updateOnFoot(dt, inputOK);
    // Charakter anzeigen
    this.updateCharacter(dt);
    // Kamera
    this.rig.update(dt, this, inputOK);
    // Interaktionen
    if (inputOK) {
      if (I.hit('KeyF')) { if (this.vehicle) this.exitVehicle(); else this.tryEnter(); }
      if (I.hit('KeyR') && !this.vehicle) this.reload();
      if (I.hit('KeyV')) this.rig.cycleMode(this);
      for (let i = 1; i <= 6; i++) if (I.hit('Digit' + i)) { const list = ['fist', 'pistol', 'smg', 'shotgun', 'rifle', 'grenade']; this.selectWeapon(list[i - 1]); }
      if (!this.vehicle && I.wheel) this.cycleWeapon(I.wheel > 0 ? 1 : -1);
    }
  }

  // ---------- Admin: Flugmodus ----------
  updateFly(dt, inputOK) {
    const G = this.G, I = G.input, rig = this.rig, st = this.char.state;
    const sp = (I.down('ShiftLeft') ? 120 : 40);
    let f = inputOK ? clamp(I.axis('KeyS', 'KeyW') + I.ay, -1, 1) : 0, r = inputOK ? clamp(I.axis('KeyA', 'KeyD') + I.ax, -1, 1) : 0, u = inputOK ? ((I.down('Space') ? 1 : 0) - (I.down('ControlLeft') ? 1 : 0)) : 0;
    const cp = Math.cos(rig.pitch), sp2 = Math.sin(rig.pitch);
    const fx = Math.sin(rig.yaw) * cp, fy = -sp2, fz = Math.cos(rig.yaw) * cp, rx = -Math.cos(rig.yaw), rz = Math.sin(rig.yaw);
    const tx = (fx * f + rx * r) * sp, ty = (fy * f + u * 0.9) * sp, tz = (fz * f + rz * r) * sp;
    this.vel.x = damp(this.vel.x, tx, 6, dt); this.vy = damp(this.vy, ty, 6, dt); this.vel.z = damp(this.vel.z, tz, 6, dt);
    this.pos.x += this.vel.x * dt; this.pos.y += this.vy * dt; this.pos.z += this.vel.z * dt;
    const gy = G.world.groundY(this.pos.x, this.pos.z); if (this.pos.y < gy + 0.1) this.pos.y = gy + 0.1;
    if (Math.hypot(this.vel.x, this.vel.z) > 1) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 8, dt);
    this.onGround = false; this.swimming = false; this.aim = false;
    st.speed = 0; st.jump = true; st.sit = false; st.swim = false; st.dead = false; st.weapon = this.weapon; st.aiming = false;
  }
  // ---------- zu Fuß ----------
  updateOnFoot(dt, inputOK) {
    const G = this.G, I = G.input, W = G.world, rig = this.rig;
    const st = this.char.state;
    let mx = 0, mz = 0;
    if (inputOK && this.stun <= 0) { mx = clamp(I.axis('KeyA', 'KeyD') + I.ax, -1, 1); mz = clamp(I.axis('KeyS', 'KeyW') + I.ay, -1, 1); }
    this.stun = Math.max(0, this.stun - dt);
    const sprint = inputOK && (I.down('ShiftLeft') || (I.touch && Math.hypot(I.ax, I.ay) > 0.93)) && mz >= 0 && !this.aim;
    this.aim = inputOK && I.mdown(2) && this.weapon !== 'fist' && !this.swimming;
    // Bewegungsrichtung relativ zur Kamera
    const sy = Math.sin(rig.yaw), cy = Math.cos(rig.yaw);
    // Kamera schaut entlang +(sin yaw, cos yaw) von hinten → vorne = (sy,cy), rechts = (-cy, sy)
    let dx = sy * mz + -cy * mx, dz = cy * mz + sy * mx;
    const len = Math.hypot(dx, dz); if (len > 1) { dx /= len; dz /= len; }
    const gy = W.groundY(this.pos.x, this.pos.z);
    const water = gy < SEA - 0.95;
    this.swimming = water && this.pos.y <= SEA + 0.1 && !this.chute;
    let speed = this.swimming ? 2.6 : this.aim ? 2.2 : sprint ? (this.buff.speed ? 8.2 : 6.6) : (this.buff.speed ? 4.6 : 3.7);
    if (mz < 0) speed *= 0.7;
    let acc = this.onGround || this.swimming ? 11 : 2.5;
    const onSki = this.skiT > 0 && this.onGround && W.snowAt?.(this.pos.x, this.pos.z);
    if (this.skiT > 0) this.skiT -= dt;
    if (onSki) {
      speed = sprint ? 13 : 9; acc = 1.6;
      const e = 1.5, gx = (W.groundY(this.pos.x + e, this.pos.z) - W.groundY(this.pos.x - e, this.pos.z)) / (2 * e), gz = (W.groundY(this.pos.x, this.pos.z + e) - W.groundY(this.pos.x, this.pos.z - e)) / (2 * e);
      this.vel.x -= gx * 22 * dt; this.vel.z -= gz * 22 * dt;
    }
    const tvx = dx * speed, tvz = dz * speed;
    this.vel.x = damp(this.vel.x, tvx, acc, dt); this.vel.z = damp(this.vel.z, tvz, acc, dt);
    if (this.stun > 0) { this.vel.x *= Math.exp(-3 * dt); this.vel.z *= Math.exp(-3 * dt); }
    // Springen
    if (inputOK && I.hit('Space') && this.onGround && !this.swimming && this.stun <= 0) { this.vy = 7.2; this.onGround = false; G.audio?.jump?.(); }
    // Fallschirm
    const agl = this.pos.y - gy;
    if (!this.onGround && !this.swimming && this.vy < -13 && agl > 25 && !this.chute) { this.chute = true; this.mkChute(); }
    if (this.chute && (this.onGround || this.swimming || agl < 0.3)) { this.chute = false; this.chuteMesh && (this.chuteMesh.visible = false); }
    if (!this.onGround && !this.swimming) { this.vy -= GRAV * dt; if (this.chute) this.vy = Math.max(this.vy, -5.5); }
    else if (this.swimming) { this.vy = 0; }
    // Bewegung + Kollisionen
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    this.stats.distFoot += Math.hypot(nx - this.pos.x, nz - this.pos.z);
    this.pos.x = nx; this.pos.z = nz; this.pos.y += this.vy * dt;
    const p = W.pushCircle(this.pos.x, this.pos.z, 0.38, this.pos.y + 0.3);
    if (p.hit) { this.pos.x += p.x; this.pos.z += p.z; const vn = this.vel.x * p.nx + this.vel.z * p.nz; if (vn < 0) { this.vel.x -= vn * p.nx; this.vel.z -= vn * p.nz; } }
    G.backrooms?.collide?.(this);
    // Fahrzeuge schieben
    this.collideVehicles(dt);
    // Boden
    const g2 = W.groundY(this.pos.x, this.pos.z);
    const wave = this.swimming ? G.env.waveAt(this.pos.x, this.pos.z, G.time) * 0.5 : 0;
    if (this.swimming || (g2 < SEA - 0.95 && this.pos.y < SEA + 0.15)) {
      this.pos.y = SEA - 0.75 + wave + 0.2; this.swimming = true; this.onGround = false; this.vy = 0;
    } else if (this.pos.y <= g2) {
      if (!this.onGround && this.vy < -13 && !this.chute) { const dmg = (-this.vy - 13) * 8; this.hurt(dmg); G.audio?.crash?.(0.5, this.pos); }
      this.pos.y = g2; this.vy = 0; this.onGround = true; this.swimming = false;
    } else if (this.onGround && this.pos.y - g2 < 0.35) { this.pos.y = g2; this.vy = 0; }
    else this.onGround = false;
    // Drehung
    if (this.aim || (inputOK && (I.mdown(0) && this.weapon !== 'fist'))) this.yaw = dampAngle(this.yaw, rig.yaw, 18, dt);
    else if (len > 0.1) this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 12, dt);
    // Fußschritte
    const spd = Math.hypot(this.vel.x, this.vel.z);
    st.speed = spd; st.sprint = sprint; st.aiming = this.aim || (st.aiming && false); st.weapon = this.weapon; st.swim = this.swimming; st.sit = false; st.jump = !this.onGround && !this.swimming && !this.chute; st.dead = !this.alive || this.stun > 0.5 && this.knocked;
    st.hands = false;
    this.stepT = (this.stepT || 0) + spd * dt;
    if (this.stepT > 2.2 && this.onGround) { this.stepT = 0; G.audio?.footstep?.(spd > 5, this.pos); }
    // Waffe / Schlag
    if (inputOK && this.stun <= 0) this.handleAttack(dt);
    // Fallschirm-Mesh
    if (this.chuteMesh) { this.chuteMesh.visible = this.chute; this.chuteMesh.position.copy(this.pos).add(new THREE.Vector3(0, 2.4, 0)); }
    st.chute = this.chute;
    this.G.stats = this.stats;
    if (this.G.world.isWater(this.pos.x, this.pos.z) && !this.swimming && this.pos.y > g2) { /* fliegend */ }
  }
  mkChute() {
    if (this.chuteMesh) { this.chuteMesh.visible = true; return; }
    const m = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff5252, side: THREE.DoubleSide, roughness: 0.8 }));
    m.castShadow = true; this.G.scene.add(m); this.chuteMesh = m;
  }
  collideVehicles(dt) {
    const G = this.G;
    for (const v of G.vehicles.list) {
      const dx = this.pos.x - v.pos.x, dz = this.pos.z - v.pos.z; if (dx * dx + dz * dz > (v.size + 2) ** 2) continue;
      if (v.kind === 'plane' && v.air || v.kind === 'heli' && v.pos.y - v.gnd > 2) continue;
      const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
      for (const c of v.circles) {
        const cx = v.pos.x + sy * c.z, cz = v.pos.z + cy * c.z;
        const ddx = this.pos.x - cx, ddz = this.pos.z - cz, d = Math.hypot(ddx, ddz), rr = c.r + 0.36;
        if (d < rr && this.pos.y < v.pos.y + v.spec.hgt) {
          const nx = d > 1e-4 ? ddx / d : 1, nz = d > 1e-4 ? ddz / d : 0;
          this.pos.x += nx * (rr - d); this.pos.z += nz * (rr - d);
          const rel = (v.vx - this.vel.x) * -nx + (v.vz - this.vel.z) * -nz; // Annäherung des Fahrzeugs
          if (v.speed > 3.5 && v.driver && this.stun <= 0 && rel > 3) {
            this.hurt(Math.min(60, v.speed * 3.2), v.driver === 'player' ? null : v); this.stun = 1.6; this.knocked = true; this.vel.x += nx * v.speed * 0.5; this.vel.z += nz * v.speed * 0.5; this.vy = 3; this.onGround = false;
            G.audio?.crash?.(0.5, this.pos);
          }
        }
      }
    }
    if (this.stun <= 0) this.knocked = false;
  }
  handleAttack(dt) {
    const G = this.G, I = G.input, w = WEAPONS[this.weapon], e = this.weapons[this.weapon];
    const want = w.auto ? I.mdown(0) : I.mhit(0);
    if (!want || this.cd > 0 || this.swimming) return;
    if (G.ui?.blocking) return;
    if (w.melee) { this.cd = 1 / w.rate; this.char.punch(); setTimeout(() => G.combat.melee(this, this.pos, this.yaw, w.dmg * (this.buff.strong ? 2 : 1)), 120); G.audio?.swing?.(); return; }
    if (w.throw) {
      if (e.ammo <= 0 && e.loaded <= 0) return;
      if (e.ammo > 0) e.ammo--; this.cd = 1 / w.rate;
      this.throwGrenade();
      if (e.ammo <= 0) { this.weapons.grenade.owned = e.ammo > 0 || false; this.selectWeapon('pistol'); }
      return;
    }
    if (this.reloadT > 0) return;
    if (e.loaded <= 0) { if (e.ammo > 0) this.reload(); else if (I.mhit(0)) G.audio?.empty?.(); return; }
    e.loaded--; this.cd = 1 / w.rate;
    this.shoot(w);
  }
  aimRay() {
    const G = this.G, cam = G.camera;
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const org = cam.position.clone();
    // Zielpunkt über Kamera-Fadenkreuz
    const far = 140;
    const hit = G.combat.cast(org.x + dir.x * 1.5, org.y + dir.y * 1.5, org.z + dir.z * 1.5, dir.x, dir.y, dir.z, far, this);
    const tp = org.clone().addScaledVector(dir, hit.t + 1.5);
    // Auto-Aim: nächste feindliche Zielperson nahe dem Fadenkreuz
    let best = null, bd = 0.09;
    for (const p of G.peds.list) {
      if (!p.alive || !(p.hostile || p.isCop)) continue;
      const c = new THREE.Vector3(p.pos.x, p.pos.y + 1.25, p.pos.z).sub(org); const dist = c.length(); if (dist > 70) continue; c.normalize();
      const ang = Math.acos(clamp(c.dot(dir), -1, 1)); if (ang < bd) { bd = ang; best = p; }
    }
    if (best) { tp.set(best.pos.x, best.pos.y + 1.3, best.pos.z); }
    return tp;
  }
  shoot(w) {
    const G = this.G;
    const target = this.aimRay();
    const m = this.muzzle; const dir = target.clone().sub(m).normalize();
    // Schutz gegen Schießen nach hinten
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (dir.dot(fwd) < 0.1) dir.copy(fwd);
    G.combat.fire(this, m, dir, this.weapon, { spreadMul: this.aim ? 0.5 : 1.4, dmgMul: this.buff.strong ? 1.5 : 1 });
    this.rig.kick(0.5);
    G.police?.crime('shoot', 0.5, this.pos);
  }
  throwGrenade() {
    const G = this.G, dir = new THREE.Vector3(Math.sin(this.rig.yaw) * Math.cos(this.rig.pitch * 0.4 + 0.2), 0.5, Math.cos(this.rig.yaw) * Math.cos(this.rig.pitch * 0.4 + 0.2)).normalize();
    const pos = this.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshStandardMaterial({ color: 0x3d4f2a }));
    G.scene.add(mesh);
    G.projectiles.push({ mesh, pos, vel: dir.multiplyScalar(15).add(new THREE.Vector3(this.vel.x, 0, this.vel.z)), t: 2.4, src: this });
    this.char.punch(); G.police?.crime('shoot', 0.6, this.pos);
  }

  // ---------- Fahrzeug ----------
  tryEnter() {
    if (this.G.prison?.active) return false;
    const G = this.G;
    const v = G.vehicles.nearest(this.pos.x, this.pos.z, 3.6, (q) => !q.remote);
    if (!v || this.swimming && v.kind !== 'boat') return false;
    if (v.exploded) return false;
    if (v.kind === 'plane' || v.kind === 'heli') { if (v.pos.y - v.gnd > 3) return false; }
    if (v.kind === 'boat' && Math.hypot(v.pos.x - this.pos.x, v.pos.z - this.pos.z) > v.spec.len * 0.7 + 3) return false;
    if (v.driver && v.driver !== 'player') { G.traffic?.carjack(v, this); }
    else if (v.driver === 'player') return false;
    this.enterVehicle(v);
    return true;
  }
  enterVehicle(v) {
    const G = this.G;
    if (this.chute) { this.chute = false; if (this.chuteMesh) this.chuteMesh.visible = false; }
    this.vehicle = v; v.driver = 'player'; v.player = true; v.ai = null; v.ctrl = null; v.sleeping = false; v.wake();
    v.engineOn = true; v.locked = false; this.enterT = 0.35;
    const c = this.char;
    v.group.add(c.root);
    const s = v.model.seat;
    c.root.position.set(s.x, s.y - 0.5 - (v.kind === 'bike' ? 0.05 : 0), s.z); c.root.rotation.set(0, 0, 0);
    c.root.scale.setScalar(v.kind === 'plane' || v.kind === 'heli' ? 1 : 1);
    c.setHeld(null);
    c.state.sit = true; c.state.aiming = false;
    this.rig.onEnter(v);
    G.audio?.doorClose?.();
    G.emit('enterVehicle', v);
    if (!v.owned && !v.stolenMarked) { v.stolenMarked = true; this.stats.cars++; if (!v.missionVehicle && !v.carjackFlag) G.police?.crime('theft', 0.5, v.pos); }
    G.police?.crime(v.carjackFlag ? 'carjack' : 'none', v.carjackFlag ? 0.8 : 0, v.pos);
    v.carjackFlag = false;
  }
  exitVehicle(force = false) {
    const G = this.G, v = this.vehicle; if (!v) return;
    const spd = v.speed;
    // Ausstiegsposition links neben dem Fahrzeug
    const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    let side = v.model.doorX + 0.3;
    let x = v.pos.x + cy * side, z = v.pos.z - sy * side;
    let ok = !G.world.pushCircle(x, z, 0.4, v.pos.y + 0.3).hit;
    if (!ok) { x = v.pos.x - cy * side; z = v.pos.z + sy * side; ok = !G.world.pushCircle(x, z, 0.4, v.pos.y + 0.3).hit; }
    if (!ok) { x = v.pos.x - sy * (v.spec.len / 2 + 1); z = v.pos.z - cy * (v.spec.len / 2 + 1); }
    if (v.kind === 'boat') { x = v.pos.x + cy * side; z = v.pos.z - sy * side; }
    const c = this.char; G.scene.add(c.root); c.root.position.set(0, 0, 0);
    this.pos.set(x, v.kind === 'boat' ? SEA - 0.5 : (v.kind === 'plane' || v.kind === 'heli') ? v.pos.y + 1.5 : G.world.groundY(x, z), z);
    this.vel.set(v.vx * 0.7, 0, v.vz * 0.7); this.vy = v.kind === 'plane' || v.kind === 'heli' ? 0 : 0; this.onGround = v.pos.y - v.gnd < 3;
    if (spd > 9 && !force) { this.hurt(Math.min(30, spd * 0.8)); this.stun = 1.2; this.knocked = true; }
    c.state.sit = false;
    v.driver = null; v.player = false; v.in.throttle = v.in.steer = v.in.pitch = v.in.roll = v.in.yaw = v.in.collective = v.in.thr = 0; v.in.brake = spd > 2 ? 0.3 : 0.6; v.in.hand = spd < 2;
    v.sleeping = false; v.wake();
    this.vehicle = null; this.enterT = 0.2;
    this.yaw = v.yaw; this.refreshWeaponModel();
    this.rig.onExit(this);
    G.audio?.doorClose?.(); G.emit('exitVehicle', v);
    G.audio?.stopEngine?.();
    if (v.kind === 'heli') v.rotorOff = true;
  }
  updateInVehicle(dt, inputOK) {
    const G = this.G, I = G.input, v = this.vehicle, c = v.in;
    this.pos.copy(v.pos); this.yaw = v.yaw;
    this.stats.distCar += v.speed * dt; this.stats.top = Math.max(this.stats.top, v.speedKmh || 0);
    if (inputOK) {
      const k = (n) => (I.down(n) ? 1 : 0);
      if (v.kind === 'plane') {
        c.pitch = clamp(k('KeyS') - k('KeyW') - I.ay, -1, 1); c.roll = clamp(k('KeyD') - k('KeyA') + I.ax, -1, 1); c.yaw = k('KeyQ') - k('KeyE'); c.thr = k('ShiftLeft') - k('ControlLeft'); c.brake = k('Space'); c.throttle = 0;
      } else if (v.kind === 'heli') {
        c.pitch = clamp(k('KeyW') - k('KeyS') + I.ay, -1, 1); c.roll = clamp(k('KeyD') - k('KeyA') + I.ax, -1, 1); c.yaw = k('KeyQ') - k('KeyE'); c.collective = k('Space') - k('ControlLeft'); c.throttle = 0;
      } else {
        c.throttle = clamp(k('KeyW') - k('KeyS') + I.ay, -1, 1); c.steer = clamp(k('KeyA') - k('KeyD') - I.ax, -1, 1); c.hand = I.down('Space'); c.brake = 0;
        if (I.hit('KeyQ')) G.audio?.radioPrev(); if (I.hit('KeyE')) G.audio?.radioNext();
      }
      v.horn = I.down('KeyH');
      if (I.hit('KeyG')) v.lights = !v.lights;
      if (I.hit('KeyN') && v.spec.cop) v.sirenOn = !v.sirenOn;
    } else { c.throttle = 0; c.brake = 0.5; c.hand = false; v.horn = false; }
    // Charakter-Pose
    const st = this.char.state; st.sit = true; st.speed = 0; st.aiming = false; st.hands = false; st.dead = false; st.swim = false;
    // Lenkbewegung der Hände ist nicht animiert; Fahrer neigt sich leicht
    this.char.torso.rotation.z = -c.steer * 0.08;
    if (this.enterT > 0) this.enterT -= dt;
    // Aus Fahrzeug fliegen bei Totalschaden
    if (v.exploded && this.alive) { this.hurt(70, v); this.exitVehicle(true); this.vy = 6; this.pos.y += 1; }
    if (v.kind === 'plane' && v.air) this.stats.flights += dt * 0.0;
    // Fahrzeug im Wasser
    if (v.inWater && v.drown > 5 && v.kind === 'car') { this.hurt(dt * 18); }
  }
  updateCharacter(dt) {
    const c = this.char;
    if (!this.vehicle) { c.root.position.copy(this.pos); c.root.rotation.y = this.yaw; }
    else { c.root.rotation.y = 0; }
    c.root.visible = !(this.rig.mode === 2 && this.vehicle) || this.G.mode === 'cutscene';
    if (this.vehicle && this.rig.mode === 2) c.root.visible = false;
    const st = c.state;
    st.dead = !this.alive || (this.stun > 0.4 && !!this.knocked);
    c.update(dt, st);
    if (this.hurtT > 0 && this.G.fx && Math.random() < 0.3) { /* Treffer-Effekte optional */ }
  }
}

// ======================================================================
export class CameraRig {
  constructor(G, camera) {
    this.G = G; this.cam = camera;
    this.yaw = 0; this.pitch = 0.22; this.mode = 0; this.dist = 4; this.smooth = new THREE.Vector3();
    this.idleT = 0; this.trauma = 0; this.fov = 70; this.override = null; this.kickV = 0;
    this.cine = { t: 0, shot: 0, pos: new THREE.Vector3() };
    this.target = new THREE.Vector3(); this.look = new THREE.Vector3();
    G.on('shake', (e) => { const p = G.player?.position; if (!p || !G.settings.shake) return; const d = Math.hypot(e.x - p.x, e.z - p.z); this.trauma = Math.min(1, this.trauma + e.power * clamp(1 - d / 90, 0, 1)); });
  }
  kick(a) { this.kickV += a * 0.012; }
  snap(player) { this.smooth.copy(player.position); }
  cycleMode(player) { if (player.vehicle) { this.mode = (this.mode + 1) % 4; this.G.ui?.toast?.(['Verfolgerkamera', 'Weite Kamera', 'Cockpit-Ansicht', 'Kino-Kamera'][this.mode]); } else { this.G.ui?.toast?.('Kamera wechseln: nur im Fahrzeug'); } }
  onEnter(v) { this.yaw = v.yaw; this.pitch = 0.2; this.idleT = 10; this.smooth.copy(v.pos); }
  onExit(p) { this.yaw = p.yaw; }
  update(dt, player, inputOK) {
    const G = this.G, I = G.input, W = G.world, cam = this.cam, v = player.vehicle;
    const sens = 0.0022 * (G.settings.sens || 1);
    if (this.override) { this.applyOverride(dt); return; }
    if (inputOK || G.mode === 'play') {
      const mdx = I.mx * sens, mdy = I.my * sens * (G.settings.invertY ? -1 : 1);
      this.yaw -= mdx; this.pitch = clamp(this.pitch + mdy, -0.5, 1.2);
      if (Math.abs(I.mx) + Math.abs(I.my) > 0.5) this.idleT = 0;
    }
    this.idleT += dt;
    const aim = player.aim && !v;
    // Zielpunkt
    let tx, ty, tz, dist, shoulder = 0, height = 0;
    const pp = player.position;
    if (!v) {
      tx = pp.x; tz = pp.z; ty = pp.y + (player.swimming ? 0.8 : 1.55);
      dist = aim ? 1.9 : 3.6; shoulder = aim ? 0.65 : 0.35; height = 0;
      if (player.swimming) dist = 4.5;
      if (player.chute) dist = 7;
    } else {
      const sp = v.spec;
      tx = pp.x; tz = pp.z; ty = pp.y + Math.min(sp.hgt * 0.9, 2.2);
      const big = sp.len;
      dist = v.kind === 'plane' ? 18 + sp.len : v.kind === 'heli' ? 15 + sp.len * 0.6 : v.kind === 'boat' ? 8 + sp.len * 0.9 : 3.8 + big * 0.9;
      if (this.mode === 1) dist *= 1.9;
      // automatisches Nachführen hinter Fahrzeug
      const vy = v.kind === 'plane' || v.kind === 'heli' ? (Math.hypot(v.vx, v.vz) > 3 ? Math.atan2(v.vx, v.vz) : v.yaw) : (v.u >= -1 ? v.yaw : v.yaw + Math.PI);
      const autoRate = I.down('KeyC') ? 0 : clamp((v.speed - 2) * 0.12, 0, 1.6) + (this.idleT > 1.5 ? 0.6 : 0);
      if (this.idleT > 0.8 || v.speed > 18) this.yaw = dampAngle(this.yaw, v.kind === 'car' || v.kind === 'bike' ? v.yaw - (v.v * 0.02) : vy, autoRate * (v.kind === 'plane' ? 2.5 : 1), dt);
      if (this.idleT > 1.5) this.pitch = damp(this.pitch, v.kind === 'plane' ? 0.18 - v.pitch * 0.6 : v.kind === 'heli' ? 0.3 : 0.2, 1.5, dt);
      if (I.down('KeyC') && G.mode === 'play') this.yaw = v.yaw + Math.PI;
    }
    this.smooth.x = damp(this.smooth.x, tx, v ? 14 : 22, dt); this.smooth.z = damp(this.smooth.z, tz, v ? 14 : 22, dt); this.smooth.y = damp(this.smooth.y, ty, 10, dt);
    if (!v) { this.smooth.x = tx; this.smooth.z = tz; }
    let fovT = G.settings.fov;
    if (aim) fovT = 52;
    if (v) fovT += clamp(v.speed / 50, 0, 1) * 14;
    this.fov = damp(this.fov, fovT, 6, dt);
    // Ansichtsmodi
    if (v && this.mode === 2 && v.kind !== 'plane') {
      // Cockpit/Hood
      const s = v.model.seat, sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
      const wx = v.pos.x + sy * (s.z + 0.35) + cy * s.x * 0.0, wz = v.pos.z + cy * (s.z + 0.35) - sy * s.x * 0.0;
      cam.position.set(wx + cy * s.x, v.pos.y + s.y + 0.65, wz - sy * s.x);
      const yaw = v.yaw + (this.yaw - v.yaw) * 0.0 + wrapPI(this.yaw - v.yaw) * 0.9;
      cam.rotation.set(0, 0, 0); cam.lookAt(cam.position.x + Math.sin(yaw) * 10, cam.position.y - this.pitch * 5 + 0.4 * 0, cam.position.z + Math.cos(yaw) * 10);
      cam.fov = this.fov + 5; cam.updateProjectionMatrix(); return;
    }
    if (v && this.mode === 3) { this.cinematic(dt, v); return; }
    // Orbit-Kamera
    const cp = Math.cos(this.pitch), sp2 = Math.sin(this.pitch);
    const fx = Math.sin(this.yaw) * cp, fy = -sp2, fz = Math.cos(this.yaw) * cp; // Blickrichtung (von Kamera zum Ziel)
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    let dx = this.smooth.x - fx * dist + rx * shoulder, dy = this.smooth.y - fy * dist + 0.25 + height, dz = this.smooth.z - fz * dist + rz * shoulder;
    // Kollision Kamera
    const ox = this.smooth.x, oy = this.smooth.y, oz = this.smooth.z;
    let vx = dx - ox, vy = dy - oy, vz = dz - oz; const vl = Math.hypot(vx, vy, vz);
    const hit = W.rayHit(ox, oy, oz, vx / vl, vy / vl, vz / vl, vl + 0.3);
    let k = 1; if (hit !== null && hit < vl + 0.3) k = Math.max(0.08, (hit - 0.35) / vl);
    this.kd = damp(this.kd ?? k, k, k < (this.kd ?? 1) ? 30 : 4, dt);
    dx = ox + vx * this.kd; dy = oy + vy * this.kd; dz = oz + vz * this.kd;
    const gmin = Math.max(W.groundY(dx, dz), -0.3) + 0.35; if (dy < gmin) dy = gmin;
    cam.position.set(dx, dy, dz);
    // Wackeln
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const sh = this.trauma * this.trauma;
    const t = G.time;
    cam.position.x += Math.sin(t * 47) * sh * 0.25; cam.position.y += Math.sin(t * 53) * sh * 0.25 + this.kickV; cam.position.z += Math.cos(t * 41) * sh * 0.25;
    this.kickV *= Math.exp(-12 * dt);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.smooth.x + rx * shoulder * 0.6, this.smooth.y + 0.0 - (aim ? 0.0 : 0), this.smooth.z + rz * shoulder * 0.6);
    if (sh > 0.001) cam.rotateZ(Math.sin(t * 38) * sh * 0.05);
    if (v && (v.kind === 'plane')) cam.rotateZ(-v.roll * 0.35);
    cam.fov = this.fov; cam.updateProjectionMatrix();
  }
  cinematic(dt, v) {
    const cam = this.cam, c = this.cine; c.t -= dt;
    if (c.t <= 0) { c.t = 3.2 + Math.random() * 2.5; c.shot = Math.floor(Math.random() * 4); c.side = Math.random() < 0.5 ? -1 : 1; c.d = 5 + Math.random() * 5; }
    const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    const fwd = [sy, cy], right = [-cy, sy];
    let px, py, pz;
    const sp = clamp(v.speed / 30, 0, 1);
    if (c.shot === 0) { px = v.pos.x + fwd[0] * (c.d + 4) + right[0] * c.side * 2; pz = v.pos.z + fwd[1] * (c.d + 4) + right[1] * c.side * 2; py = v.pos.y + 0.7; }
    else if (c.shot === 1) { px = v.pos.x + right[0] * c.side * (c.d + 2); pz = v.pos.z + right[1] * c.side * (c.d + 2); py = v.pos.y + 1.3; }
    else if (c.shot === 2) { px = v.pos.x - fwd[0] * (c.d + 5); pz = v.pos.z - fwd[1] * (c.d + 5); py = v.pos.y + 1.1; }
    else { px = v.pos.x - fwd[0] * 3 + right[0] * c.side * 5; pz = v.pos.z - fwd[1] * 3 + right[1] * c.side * 5; py = v.pos.y + 9; }
    const hit = this.G.world.rayHit(v.pos.x, v.pos.y + 1.2, v.pos.z, (px - v.pos.x), 0, (pz - v.pos.z), 1) ;
    c.pos.x = damp(c.pos.x || px, px + v.vx * 0.2, 4, dt); c.pos.y = damp(c.pos.y || py, py, 4, dt); c.pos.z = damp(c.pos.z || pz, pz + v.vz * 0.2, 4, dt);
    cam.position.copy(c.pos); cam.lookAt(v.pos.x + v.vx * 0.15, v.pos.y + 0.9, v.pos.z + v.vz * 0.15);
    cam.fov = damp(cam.fov, c.shot === 1 ? 38 : 55 + sp * 10, 4, dt); cam.updateProjectionMatrix();
  }
  applyOverride(dt) {
    const o = this.override, cam = this.cam;
    cam.position.copy(o.pos); cam.lookAt(o.look); cam.fov = o.fov ?? 45; cam.updateProjectionMatrix();
  }
}
