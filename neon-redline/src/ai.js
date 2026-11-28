/* NEON REDLINE – ai.js : Verkehr, Ampeln, Fußgänger, Polizei, Straßensperren, Hubschrauber, Rennfahrer */
(function (G) {
'use strict';
const U = G.U, W = G.World, CD = G.CD, CM = G.CM; const { clamp, lerp, sstep } = U; const V3 = THREE.Vector3;
const AI = { cars: [], scene: null, heat: 0, heatPts: 0, cops: [], blocks: [], trail: [], peds: null, lights: null, time: 0, density: 1, copDensity: 1, enabled: true, heli: null };
const GRAV = 9.81;

/* ------------------------------------------------------------------ AI-Fahrzeug (vereinfachte 2D-Dynamik) */
class AICar {
  constructor(spec, kind, opt) {
    opt = opt || {}; this.spec = spec; this.kind = kind; this.e = CD.effective(spec, opt.cfg || CD.defaultCfg(spec)); this.cfg = opt.cfg || CD.defaultCfg(spec); this.model = CM.build(spec, this.cfg, { lod: opt.lod === undefined ? 1 : opt.lod, noShadow: true }); this.group = this.model.group; this.lod = opt.lod === undefined ? 1 : opt.lod;
    this.x = 0; this.z = 0; this.y = 0; this.yaw = 0; this.vx = 0; this.vz = 0; this.yawRate = 0; this.steer = 0; this.thr = 0; this.brk = 0; this.mass = this.e.mass; this.L = spec.L; this.Wd = spec.W; this.wb = spec.wb;
    this.state = 'drive'; this.hp = 100; this.age = 0; this.stuck = 0; this.dead = false; this.pitch = 0; this.roll = 0; this.wheelSpin = 0; this.lights = false; this.brakeLight = false; this.wreckT = 0; this.vy = 0; this.airborne = false;
    this.maxV = CD.topSpeed(this.e) * (opt.vmul || 1); this.accel = clamp(this.e.hp * 745.7 * 0.85 / (this.mass * 9), 2.5, 13) * (opt.amul || 1); this.grip = this.e.grip * 9 * 0.9; this.circles = [[spec.L * 0.5 - spec.W * 0.5, spec.W * 0.5], [-(spec.L * 0.5 - spec.W * 0.5), spec.W * 0.5]]; this.roadH = null; this.sirenPhase = Math.random(); this.pos = new V3();
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwdSpeed() { return this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw); }
  place(x, z, yaw, speed) { this.x = x; this.z = z; this.yaw = yaw; this.y = W.groundAt(x, z) + 0.0; const s = speed || 0; this.vx = Math.sin(yaw) * s; this.vz = Math.cos(yaw) * s; this.syncModel(); }
  /* Dynamik */
  step(dt) {
    const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw); let vF = this.vx * sn + this.vz * cs, vL = this.vx * cs - this.vz * sn;
    if (this.state === 'wreck') { this.thr = 0; this.brk = 1; this.steer = 0; }
    // Längs
    const drag = 0.5 * 1.2 * this.e.cd * this.e.area / this.mass * vF * Math.abs(vF); let a = 0; if (this.thr > 0) a = this.thr * Math.min(this.accel, this.accel * 14 / Math.max(vF, 6) + 2.5) * (vF > this.maxV ? 0 : 1); if (this.brk > 0) a -= Math.sign(vF || 1) * this.brk * 9.5 * Math.min(1, this.grip / 8) * (Math.abs(vF) > 0.3 ? 1 : 0);
    if (this.reverse) a = -this.thr * 3; vF += (a - drag - Math.sign(vF) * 0.12) * dt; if (this.brk > 0.9 && Math.abs(vF) < 0.4) vF = 0;
    // Quer: Haftung
    const gr = this.surfaceGrip === undefined ? 1 : this.surfaceGrip; vL *= Math.exp(-this.grip * gr * dt * (this.state === 'hit' ? 0.35 : 1));
    // Gieren
    const L = this.wb; const maxYaw = (this.grip * gr * 0.9) / Math.max(Math.abs(vF), 3); const target = clamp(vF / L * Math.tan(this.steer), -maxYaw, maxYaw) * (Math.abs(vF) > 0.3 ? 1 : 0);
    this.yawRate += (target - this.yawRate) * Math.min(1, dt * 7); this.yaw += this.yawRate * dt; const sn2 = Math.sin(this.yaw), cs2 = Math.cos(this.yaw);
    // Impulsanteil (nach Kollision) bleibt erhalten, weil Geschwindigkeit in Weltkoordinaten gehalten wird
    const dvx = this.vx - (vF0(this) * sn + vL0(this) * cs), dvz = this.vz - (vF0(this) * cs - vL0(this) * sn); // ungenutzt; Stabilität
    this.vx = vF * sn2 + vL * cs2; this.vz = vF * cs2 - vL * sn2;
    this.x += this.vx * dt; this.z += this.vz * dt; this.wheelSpin += vF / (this.spec.wr || 0.33) * dt;
    // Boden
    const g = W.groundAt(this.x, this.z, this.y); if (this.airborne) { this.vy -= GRAV * dt; this.y += this.vy * dt; if (this.y <= g) { this.y = g; this.airborne = false; this.vy = 0; } } else { const dy = g - this.y; if (dy < -0.5 && Math.abs(vF) > 12) { this.airborne = true; this.vy = (g - this.y) / Math.max(dt, 0.016); this.vy = Math.min(0, this.vy); } else this.y += clamp(dy, -9 * dt * 4, 9 * dt * 6) * 1; if (!this.airborne && Math.abs(dy) > 1.2) this.y = g; }
    this.age += dt;
  }
  syncModel(dt, camDist) {
    const g = this.group; g.position.set(this.x, this.y, this.z); const near = camDist === undefined || camDist < 110;
    if (near) { const e = 1.6, h0 = W.groundAt(this.x, this.z, this.y), hf = W.groundAt(this.x + Math.sin(this.yaw) * e, this.z + Math.cos(this.yaw) * e, this.y), hl = W.groundAt(this.x + Math.cos(this.yaw) * 0.9, this.z - Math.sin(this.yaw) * 0.9, this.y); const tp = Math.atan2(hf - h0, e), tr = Math.atan2(hl - h0, 0.9); this.pitch += (tp - this.pitch) * 0.35; this.roll += (tr - this.roll) * 0.35; }
    g.rotation.set(0, 0, 0); g.rotation.order = 'YXZ'; g.rotation.y = this.yaw; g.rotation.x = -this.pitch; g.rotation.z = this.roll * 0.0 + (-this.roll) * 1 + clamp(-this.yawRate * this.fwdSpeed * 0.004, -0.06, 0.06);
    const m = this.model; for (let i = 0; i < 4; i++) { m.wheels[i].spin.rotation.x = this.wheelSpin; if (i < 2) m.wheels[i].pivot.rotation.y = this.steer * 0.8; }
  }
  setLights(on, brake) { if (on === this.lights && brake === this.brakeLight) return; this.lights = on; this.brakeLight = brake; CM.setLights(this.model, on, brake, false, 0); }
  /* Aufprall: Impuls (Ns) in Welt (x,z) */
  hit(jx, jz, energy) { this.vx += jx / this.mass; this.vz += jz / this.mass; if (this.state === 'drive' || this.state === 'patrol') { if (this.kind === 'traffic' && energy > 6000) this.state = 'hit'; }
    this.hp -= energy / 6000; if (this.hp <= 0 && this.state !== 'wreck') { this.state = 'wreck'; this.wreckT = 0; } if (energy > 20000 && CM.deform) { const w = new V3(jx, 0, jz).normalize(); const lp = new V3(0, 0.5, 0); const q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), this.yaw); const loc = w.clone().applyQuaternion(q.invert()); lp.set(-loc.x * this.Wd * 0.5, 0.5, -loc.z * this.L * 0.5); CM.deform(this.model, lp, loc, 0.9, Math.min(0.28, energy / 450000)); } }
  dispose() { CM.dispose(this.model); this.dead = true; }
}
function vF0(c) { return c.vx * Math.sin(c.yaw) + c.vz * Math.cos(c.yaw); } function vL0(c) { return c.vx * Math.cos(c.yaw) - c.vz * Math.sin(c.yaw); }
AI.AICar = AICar;

/* ------------------------------------------------------------------ Ampeln */
const CYCLE = 22;
AI.lightState = function (nd, road, t) { // 'g','y','r'
  const ns = road.def.grid === 'ns' ? 1 : 0; const tt = ((t + (nd.phase ? CYCLE / 2 : 0)) % CYCLE + CYCLE) % CYCLE; const a = ns ? 0 : 11; const u = ((tt - a) + CYCLE) % CYCLE; if (u < 8) return 'g'; if (u < 10) return 'y'; return 'r';
};
AI.initSignals = function (scene) {
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 5.6, 6), new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.6, metalness: 0.5 }), 160); poles.count = 0; poles.frustumCulled = false; scene.add(poles);
  const g = new THREE.BufferGeometry(); const N = 160; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N).fill(1.6), 1)); g.setAttribute('phase', new THREE.BufferAttribute(new Float32Array(N), 1)); g.setDrawRange(0, 0);
  const pts = new THREE.Points(g, G.Mats.glowPoints); pts.frustumCulled = false; scene.add(pts); AI.lights = { poles, pts, g, list: [], lastX: 1e9, lastZ: 1e9 };
};
const _m4 = new THREE.Matrix4();
AI.updateSignals = function (px, pz) {
  const L = AI.lights; if (!L) return; if (Math.hypot(px - L.lastX, pz - L.lastZ) > 40) { L.lastX = px; L.lastZ = pz; L.list.length = 0; for (const nd of W.nodes) if (nd.light && Math.hypot(nd.x - px, nd.z - pz) < 260) L.list.push(nd); L.list.length = Math.min(L.list.length, 36);
    let i = 0; for (const nd of L.list) for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { if (i >= 160) break; _m4.makeTranslation(nd.x + sx * 10.5, nd.h + 2.8 + 0.18, nd.z + sz * 10.5); L.poles.setMatrixAt(i++, _m4); } L.poles.count = i; L.poles.instanceMatrix.needsUpdate = true; }
  const P = L.g.attributes.position, C = L.g.attributes.color; let k = 0; const t = AI.time;
  for (const nd of L.list) { const rn = nd.links.find(l => l.road.def.grid === 'ns'), re = nd.links.find(l => l.road.def.grid === 'ew'); if (!rn || !re) continue; const sN = AI.lightState(nd, rn.road, t), sE = AI.lightState(nd, re.road, t);
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { if (k >= 160) break; const st = sx * sz > 0 ? sN : sE; P.setXYZ(k, nd.x + sx * 10.5, nd.h + 5.7 + 0.18, nd.z + sz * 10.5); if (st === 'g') C.setXYZ(k, 0.1, 1.2, 0.35); else if (st === 'y') C.setXYZ(k, 1.4, 0.9, 0.1); else C.setXYZ(k, 1.4, 0.1, 0.08); k++; } }
  P.needsUpdate = true; C.needsUpdate = true; L.g.setDrawRange(0, k);
};

/* ------------------------------------------------------------------ Verkehr */
const rng = Math.random;
function laneOffset(r, k, dirSign) { const T = r.T; return (T.median / 2 + T.lane * (k + 0.5)); }
function pickCivil() { const l = CD.CIVIL; const w = [3, 3, 2.4, 1.3, 1.2, 1.2]; let s = 0; for (const x of w) s += x; let r = rng() * s; for (let i = 0; i < l.length; i++) { r -= w[i]; if (r <= 0) return l[i]; } return l[0]; }
const COLORS = ['#cfcfd2', '#2b2f36', '#7d8fa0', '#b0302a', '#1f4a8a', '#e6e2d6', '#3c5a3a', '#6b6b70', '#c9a24a', '#e8e8ea', '#101114'];
AI.spawnTraffic = function (px, pz, hx, hz) {
  // zufällige Straße in der Nähe, außerhalb der Sichtweite
  for (let tries = 0; tries < 14; tries++) { const ang = rng() * U.TAU, d = 170 + rng() * 380; const x = px + Math.cos(ang) * d, z = pz + Math.sin(ang) * d; if (Math.abs(x) > 2950 || Math.abs(z) > 2950) continue; const sn = W.snapToRoad(x, z, 40); if (!sn) continue; const r = sn.road; if (r.type === 'mt' && rng() < 0.7) continue; const p = W.posAtS(r, sn.s, {}); if (p.flags & 1 && rng() < 0.4) continue;
    const dx = p.x - px, dz = p.z - pz; if (dx * hx + dz * hz > 0 && Math.hypot(dx, dz) < 230) continue; const dir = rng() < 0.5 ? 1 : -1; const k = Math.floor(rng() * r.T.lanes); const spec = rng() < 0.04 ? CD.PLAYER[Math.floor(rng() * 8)] : pickCivil(); const cfg = CD.defaultCfg(spec); cfg.paint.color = COLORS[Math.floor(rng() * COLORS.length)]; cfg.paint.finish = rng() < 0.5 ? 'metal' : 'gloss'; if (spec.taxi) cfg.paint.color = '#f2c200';
    const c = new AICar(spec, 'traffic', { cfg, lod: 1 }); c.road = r; c.s = sn.s; c.dir = dir; c.lane = k; c.laneOff = laneOffset(r, k); c.limit = r.T.spd * (0.8 + rng() * 0.3) * (r.type === 'hw' ? 1.1 : 1); c.targetSpeed = c.limit; c.turnCooldown = 0;
    const tx = p.tx * dir, tz = p.tz * dir; const rx = -tz, rz = tx; c.place(p.x + rx * c.laneOff, p.z + rz * c.laneOff, Math.atan2(tx, tz), c.limit * 0.8); c.state = 'drive'; AI.cars.push(c); AI.scene.add(c.group); return c; }
  return null;
};
const _pp = {};
function trafficControl(c, dt, player) {
  const r = c.road; const sn = Math.sin(c.yaw), cs = Math.cos(c.yaw); const vF = c.fwdSpeed; const Ld = 7 + Math.max(vF, 0) * 0.7;
  // Fortschritt auf der Straße (Projektion)
  const q = W.snapToRoad(c.x, c.z, 25); if (q && q.road === r) { let ds = q.s - c.s; if (r.closed) { if (ds > r.len / 2) ds -= r.len; if (ds < -r.len / 2) ds += r.len; } if (Math.abs(ds) < 60) { c.s = q.s; } }
  let sT = c.s + c.dir * Ld; if (r.closed) sT = ((sT % r.len) + r.len) % r.len; else if (sT < 0 || sT > r.len) { sT = clamp(sT, 0, r.len); }
  const p = W.posAtS(r, sT, _pp); const tx = p.tx * c.dir, tz = p.tz * c.dir; const tgx = p.x + (-tz) * c.laneOff, tgz = p.z + tx * c.laneOff; const dx = tgx - c.x, dz = tgz - c.z; const ca = Math.atan2(dx, dz); const al = U.wrapAngle(ca - c.yaw); c.steer = clamp(Math.atan2(2 * c.wb * Math.sin(al), Math.max(Ld, 4)), -0.55, 0.55);
  // Zielgeschwindigkeit
  let tv = c.limit; const kappa = Math.abs(2 * Math.sin(al)) / Math.max(Ld, 4); if (kappa > 0.004) tv = Math.min(tv, Math.sqrt(5.5 / kappa)); tv = Math.max(tv, 5);
  // Ampeln & Kreuzungen voraus
  const st = W.roadStops[r.id]; let blocked = false; if (st) for (const e of st) { const d = (e.s - c.s) * c.dir; if (r.closed) { /* ignorieren */ } if (d > 3 && d < 55 && e.node.light) { const sig = AI.lightState(e.node, r, AI.time); if (sig === 'r' || (sig === 'y' && d > 14)) { const stop = d - 10; tv = Math.min(tv, Math.max(0, stop) * 0.5); if (stop < 1.5) tv = 0; } } if (d > -1.2 && d <= 0.6 && c.turnCooldown <= 0 && e.node.links.length > 1) { c.turnCooldown = 2.2; if (rng() < (e.node.light ? 0.34 : 0.22)) { const opts = e.node.links.filter(l => l.road !== r && l.road.type !== 'mt'); if (opts.length) { const l = opts[Math.floor(rng() * opts.length)]; const pt = W.posAtS(l.road, l.s, {}); const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); let d2 = 1; const dot = pt.tx * fx + pt.tz * fz; if (Math.abs(dot) > 0.95) d2 = dot > 0 ? 1 : -1; else d2 = rng() < 0.5 ? 1 : -1; c.road = l.road; c.s = l.s; c.dir = d2; c.lane = Math.min(c.lane, l.road.T.lanes - 1); c.laneOff = laneOffset(l.road, c.lane); c.limit = l.road.T.spd * (0.8 + rng() * 0.3); } } } }
  // Hindernis voraus (Fahrzeuge)
  const ahead = nearestAhead(c, 42); if (ahead) { const gap = ahead.d - (c.L + ahead.car.L) * 0.5; const rel = vF - ahead.car.fwdSpeed; tv = Math.min(tv, ahead.car.fwdSpeed + (gap - 6) * 0.5); if (gap < 4 + vF * 0.4 && rel > 0) tv = Math.min(tv, 0.5 * ahead.car.fwdSpeed); if (gap < 1.5) tv = 0; }
  const pd = playerAhead(c, player, 38); if (pd !== null) { tv = Math.min(tv, Math.max(0, pd - 9) * 0.5 + player.fwdSpeed * 0.3); }
  if (r.closed === false && (c.s <= 2 && c.dir < 0 || c.s >= r.len - 2 && c.dir > 0)) { c.dir *= -1; c.lane = 0; c.laneOff = laneOffset(r, 0); }
  const dv = tv - vF; c.thr = dv > 0.5 ? clamp(dv * 0.35, 0, 1) : 0; c.brk = dv < -0.6 ? clamp(-dv * 0.18, 0, 1) : 0; if (tv === 0 && vF < 1) { c.brk = 1; c.thr = 0; }
  c.turnCooldown -= dt;
}
function nearestAhead(c, maxD) { const sn = Math.sin(c.yaw), cs = Math.cos(c.yaw); let best = null; const cx = Math.floor(c.x / 40), cz = Math.floor(c.z / 40); for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) { const L = AI.hash.get(ix * 10007 + iz); if (!L) continue; for (const o of L) { if (o === c || o.dead) continue; const dx = o.x - c.x, dz = o.z - c.z; const f = dx * sn + dz * cs; if (f < 0.5 || f > maxD) continue; const l = Math.abs(dx * cs - dz * sn); if (l > 2.1) continue; if (!best || f < best.d) best = { car: o, d: f }; } } return best; }
function playerAhead(c, pl, maxD) { if (!pl) return null; const sn = Math.sin(c.yaw), cs = Math.cos(c.yaw); const dx = pl.pos.x - c.x, dz = pl.pos.z - c.z; const f = dx * sn + dz * cs; if (f < 0.5 || f > maxD) return null; if (Math.abs(dx * cs - dz * sn) > 2.2) return null; return f; }

/* ------------------------------------------------------------------ Polizei */
const HEAT_PTS = [0, 20, 60, 130, 230, 380];
AI.addHeat = function (pts, why) { if (!AI.enabled || AI.heatLocked) return; AI.heatPts += pts * (AI.copDensity > 0 ? 1 : 0); AI.lastHeatReason = why; if (AI.heat === 0 && AI.heatPts >= HEAT_PTS[1]) { AI.heat = 1; if (AI.onHeat) AI.onHeat(1, true); } let h = 0; for (let i = 1; i < HEAT_PTS.length; i++) if (AI.heatPts >= HEAT_PTS[i]) h = i; if (h > AI.heat) { AI.heat = h; if (AI.onHeat) AI.onHeat(h, true); } };
AI.clearHeat = function () { AI.heat = 0; AI.heatPts = 0; for (const c of AI.cars) if (c.kind === 'cop') { c.kind = 'copLeave'; } AI.cool = 0; };
const COPSPEC = () => ({ patrol: CD.byId.streifenwagen, interceptor: CD.byId.interceptor, suv: CD.byId.polizei_suv });
function copCfg(kind) { const s = COPSPEC()[kind]; const c = CD.defaultCfg(s); if (kind === 'patrol') { c.paint = { color: '#f2f4f7', finish: 'gloss', color2: '#16346e' }; c.livery = 3; } else if (kind === 'interceptor') { c.paint = { color: '#15171c', finish: 'gloss', color2: '#f4f4f4' }; c.livery = 3; } else { c.paint = { color: '#14161a', finish: 'gloss', color2: '#e8e8e8' }; c.livery = 2; } c.tint = 2; return c; }
AI.spawnCop = function (kind, x, z, yaw, speed, state) { const spec = COPSPEC()[kind]; const c = new AICar(spec, 'cop', { cfg: copCfg(kind), lod: 0, vmul: kind === 'interceptor' ? 1.0 : 0.95, amul: 1.0 }); c.copKind = kind; c.state = state || 'chase'; c.place(x, z, yaw, speed || 0); c.setLights(true, false); AI.cars.push(c); AI.scene.add(c.group); c.flash = Math.random() * 6; return c; };
AI.copsWanted = function () { const h = AI.heat; const n = [0, 2, 3, 5, 7, 9][h] * AI.copDensity; return Math.round(n); };
function copControl(c, dt, pl) {
  const dx = pl.pos.x - c.x, dz = pl.pos.z - c.z; const dist = Math.hypot(dx, dz); const sn = Math.sin(c.yaw), cs = Math.cos(c.yaw); const vF = c.fwdSpeed;
  if (c.state === 'block') { c.thr = 0; c.brk = 1; c.steer = 0; return; }
  // Sicht & Ziel
  const los = lineClear(c.x, c.z, pl.pos.x, pl.pos.z); c.los = los && dist < 380; if (c.los) { c.lastSeen = AI.time; AI.lastSeenT = AI.time; AI.lastSeenPos = { x: pl.pos.x, z: pl.pos.z }; }
  let tx = pl.pos.x + pl.vel.x * 0.55, tz = pl.pos.z + pl.vel.z * 0.55; if (c.copKind === 'suv' && dist < 26) { tx = pl.pos.x + pl.vel.x * 0.15; tz = pl.pos.z + pl.vel.z * 0.15; }
  if (!los && dist > 25) { // Spur folgen
    let best = null; for (let i = AI.trail.length - 1; i >= 0; i--) { const t = AI.trail[i]; const d = Math.hypot(t.x - c.x, t.z - c.z); if (d > 18 && (!best || d < best.d - 1e-6 || i > best.i)) { if (!best || (Math.hypot(t.x - pl.pos.x, t.z - pl.pos.z) < Math.hypot(best.x - pl.pos.x, best.z - pl.pos.z) && d < 120)) best = { x: t.x, z: t.z, d, i }; } } if (best) { tx = best.x; tz = best.z; } else if (AI.lastSeenPos) { tx = AI.lastSeenPos.x; tz = AI.lastSeenPos.z; } }
  let ang = Math.atan2(tx - c.x, tz - c.z); let al = U.wrapAngle(ang - c.yaw);
  // Hindernisse (3 Fühler)
  const probeD = 10 + Math.max(vF, 0) * 0.7; let avoid = 0; for (const off of [0, 0.5, -0.5]) { const a = c.yaw + off; const px = c.x + Math.sin(a) * probeD, pz = c.z + Math.cos(a) * probeD; if (blocked(px, pz, 1.6)) { avoid += off === 0 ? (al >= 0 ? -0.9 : 0.9) * 0 + (off === 0 ? 1.1 * (Math.sign(al) || 1) * -1 : -Math.sign(off) * -1.2) : -Math.sign(off) * 1.0; } }
  if (avoid !== 0) al = clamp(al + avoid, -1.4, 1.4) * 1.0;
  c.steer = clamp(Math.atan2(2 * c.wb * Math.sin(al), Math.max(7 + Math.max(vF, 0) * 0.5, 5)) * 1.3, -0.6, 0.6);
  // Geschwindigkeit
  const aggr = [0, 0.78, 0.85, 0.92, 1.0, 1.05][AI.heat] * (AI.copAggr || 1); let tv = c.maxV * aggr; const kap = Math.abs(Math.sin(al)) * 2 / 9; tv = Math.min(tv, Math.max(11, Math.sqrt(8 / Math.max(kap, 0.002)))); if (Math.abs(al) > 1.5) tv = Math.min(tv, 9);
  if (dist < 14) tv = Math.max(tv, pl.speed * 1.08 + 3) * (c.copKind === 'suv' ? 1.05 : 0.95); if (dist < 5 && pl.speed < 6) tv = 0;
  if (avoid !== 0) tv = Math.min(tv, 16); const dv = tv - vF; c.thr = dv > 1 ? clamp(dv * 0.3, 0.3, 1) : 0; c.brk = dv < -1.5 ? clamp(-dv * 0.15, 0, 1) : 0;
  // Festgefahren?
  if (vF < 1.5 && c.thr > 0.5) c.stuck += dt; else c.stuck = Math.max(0, c.stuck - dt); c.reverse = false; if (c.stuck > 1.4) { c.reverse = true; c.thr = 1; c.steer = -c.steer; if (c.stuck > 3.2) c.stuck = 0; } if (c.stuck > 7) c.teleport = true;
}
function blocked(x, z, r) { const L = G.Gen.colliders(x, z, r + 1, _cl); for (const c of L) { if (c.t === 1) { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true; } else { const dx = x - c.x, dz = z - c.z; const lx = dx * c.cs - dz * c.sn, lz = dx * c.sn + dz * c.cs; if (Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r) return true; } } if (W.terrainH(x, z) < -0.5 && W.groundAt(x, z) < -0.5) return true; return false; }
const _cl = [];
function lineClear(x0, z0, x1, z1) { const d = Math.hypot(x1 - x0, z1 - z0); const n = Math.min(14, Math.floor(d / 14)); for (let i = 1; i < n; i++) { const t = i / n; const x = lerp(x0, x1, t), z = lerp(z0, z1, t); const L = G.Gen.colliders(x, z, 3, _cl); for (const c of L) { if (c.t === 1) continue; if (c.top < 6) continue; const dx = x - c.x, dz = z - c.z; const lx = dx * c.cs - dz * c.sn, lz = dx * c.sn + dz * c.cs; if (Math.abs(lx) < c.hx && Math.abs(lz) < c.hz) return false; } } return true; }
/* Aufstellen: hinter/vor dem Spieler auf einer Straße */
AI.spawnCopNear = function (pl, ahead) {
  for (let tries = 0; tries < 12; tries++) { const f = pl.forward(new V3()); const sign = ahead ? 1 : -1; const d = ahead ? 260 + rng() * 140 : 150 + rng() * 120; const x = pl.pos.x + f.x * d * sign + (rng() - 0.5) * 120, z = pl.pos.z + f.z * d * sign + (rng() - 0.5) * 120; const sn = W.snapToRoad(x, z, 50); if (!sn) continue; const p = W.posAtS(sn.road, sn.s, {}); const kind = AI.heat >= 3 && rng() < 0.4 ? 'suv' : AI.heat >= 2 && rng() < 0.55 ? 'interceptor' : 'patrol'; const dir = ((p.tx * f.x + p.tz * f.z) * sign * -1) >= 0 ? 1 : -1; const c = AI.spawnCop(kind, p.x, p.z, Math.atan2(p.tx * dir, p.tz * dir), 8, 'chase'); return c; }
  return null;
};
AI.makeRoadblock = function (pl) {
  const f = pl.forward(new V3()); for (let tries = 0; tries < 10; tries++) { const d = 330 + rng() * 150; const sn = W.snapToRoad(pl.pos.x + f.x * d, pl.pos.z + f.z * d, 60); if (!sn) continue; const r = sn.road; if (r.flags[W.idxAtS(r, sn.s)] & 3) continue; if (r.type === 'mt' && rng() < 0.5) continue; const p = W.posAtS(r, sn.s, {}); const rx = -p.tz, rz = p.tx; const ry = Math.atan2(p.tx, p.tz); const half = r.T.half; const cars = [];
    const n = Math.max(2, Math.floor(half * 2 / 4.2)); for (let i = 0; i < n; i++) { if (i === Math.floor(n / 2) && AI.heat < 5 && rng() < 0.6) continue; const off = (i - (n - 1) / 2) * 4.4; const c = AI.spawnCop(i % 2 ? 'patrol' : 'interceptor', p.x + rx * off, p.z + rz * off, ry + Math.PI / 2 + (rng() - 0.5) * 0.5, 0, 'block'); c.blockPos = true; cars.push(c); }
    const spike = AI.heat >= 3 ? { x: p.x - p.tx * 24, z: p.z - p.tz * 24, h: p.h, ry, half } : null; AI.blocks.push({ x: p.x, z: p.z, cars, spike, t: 0, ry }); if (spike) addSpikeMesh(spike); return true; }
  return false;
};
function addSpikeMesh(s) { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(s.half * 2, 0.04, 0.9), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.7 })); g.add(m); for (let i = 0; i < 18; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), new THREE.MeshStandardMaterial({ color: 0xcfcfcf, metalness: 1, roughness: 0.3 })); sp.position.set((i / 17 - 0.5) * (s.half * 2 - 1), 0.08, (i % 2 - 0.5) * 0.4); g.add(sp); } g.position.set(s.x, s.h + 0.06, s.z); g.rotation.y = s.ry + Math.PI / 2; AI.scene.add(g); s.mesh = g; }

/* Hubschrauber */
AI.makeHeli = function () {
  const g = new THREE.Group(); const body = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.4, metalness: 0.6 }); const fus = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), body); fus.scale.set(1.4, 1.5, 3.4); g.add(fus); const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 6), body); tail.position.set(0, 0.3, -5.5); g.add(tail); const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.9), body); fin.position.set(0, 1.0, -8); g.add(fin);
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.03, 20), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.18, depthWrite: false })); rotor.position.y = 1.9; g.add(rotor); const blade = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.04, 0.3), body); blade.position.y = 1.95; g.add(blade);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); lamp.position.set(0, -1.3, 2.2); g.add(lamp); const rl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); rl.position.set(0, 1.2, -8); g.add(rl);
  const spot = new THREE.SpotLight(0xdde8ff, 0, 400, 0.12, 0.35, 0.6); spot.position.set(0, -1.2, 1.5); g.add(spot); g.add(spot.target); const h = { group: g, rotor, blade, spot, pos: new V3(), vel: new V3(), t: 0 }; AI.scene.add(g); g.visible = false; return h;
};

/* ------------------------------------------------------------------ Rennfahrer */
AI.spawnRacer = function (spec, cfg, route, startS, lateral, persona) { const c = new AICar(spec, 'racer', { cfg, lod: 0, vmul: 1, amul: 1 }); c.route = route; c.persona = persona || { skill: 0.9, aggr: 0.3, drift: 0 }; c.ri = Math.max(0, Math.floor(startS)); c.progress = startS; c.lap = 0; c.finished = false; c.cp = 0; const p = route.pts[Math.max(0, c.ri)], q = route.pts[Math.min(route.pts.length - 1, c.ri + 2)]; const yaw = Math.atan2(q.x - p.x, q.z - p.z); c.place(p.x + Math.cos(yaw) * lateral, p.z - Math.sin(yaw) * lateral, yaw, 0); c.state = 'race'; c.setLights(true, false); AI.cars.push(c); AI.scene.add(c.group); return c; };
function racerControl(c, dt, pl, rubber) {
  const R = c.route.pts; const n = R.length; let bi = c.ri, bd = 1e9; for (let i = Math.max(0, c.ri - 4); i < Math.min(n, c.ri + 40); i++) { const d = (R[i].x - c.x) ** 2 + (R[i].z - c.z) ** 2; if (d < bd) { bd = d; bi = i; } } c.ri = bi; c.progress = bi + 0; const vF = c.fwdSpeed;
  const Ld = 9 + Math.max(vF, 0) * 0.55; let j = bi; let acc = 0; while (j < n - 1 && acc < Ld) { acc += Math.hypot(R[j + 1].x - R[j].x, R[j + 1].z - R[j].z); j++; } const t = R[j]; const latOff = (c.lateral || 0); const ang = Math.atan2(t.x - c.x, t.z - c.z); const al = U.wrapAngle(ang - c.yaw);
  c.steer = clamp(Math.atan2(2 * c.wb * Math.sin(al), Math.max(Ld, 5)) * 1.15, -0.6, 0.6);
  // Geschwindigkeitsprofil nach Krümmung vorausschauend
  let vlim = c.maxV; let dist = 0; for (let k = bi; k < Math.min(n - 2, bi + 36); k++) { const a = R[k], b = R[k + 1], d = R[k + 2]; const a1 = Math.atan2(b.x - a.x, b.z - a.z), a2 = Math.atan2(d.x - b.x, d.z - b.z); const dth = Math.abs(U.wrapAngle(a2 - a1)); const seg = Math.hypot(b.x - a.x, b.z - a.z) + 0.1; const kap = dth / seg; dist += seg; const vc = Math.sqrt(c.grip * 0.95 * (c.persona.skill) / Math.max(kap, 0.0008)); const vAllow = Math.sqrt(vc * vc + 2 * 11 * Math.max(0, dist - 4)); vlim = Math.min(vlim, vAllow); }
  vlim *= 0.94 * (c.persona.skill * 0.12 + 0.88) * rubber; const dv = vlim - vF; c.thr = dv > 0.5 ? clamp(dv * 0.4, 0, 1) : 0; c.brk = dv < -1.0 ? clamp(-dv * 0.2, 0, 1) : 0; if (bi >= n - 4) { c.finished = true; }
  if (vF < 1.5 && c.thr > 0.5) c.stuck += dt; else c.stuck = 0; if (c.stuck > 4) { const p = R[bi]; c.place(p.x, p.z, Math.atan2(R[Math.min(n - 1, bi + 2)].x - p.x, R[Math.min(n - 1, bi + 2)].z - p.z), 3); c.stuck = 0; }
}

/* ------------------------------------------------------------------ Fußgänger */
AI.initPeds = function (scene) {
  const N = 70; const gb = new U.GeoBuilder(); const skin = [0.8, 0.6, 0.5]; gb.box(0, 1.05, 0, 0.42, 0.62, 0.24, 0, [1, 1, 1]); gb.cyl(0, 1.5, 0, 0.12, 0.12, 0.22, 8, skin, { base: true }); gb.box(-0.12, 0.38, 0, 0.16, 0.76, 0.18, 0, [0.12, 0.13, 0.18]); gb.box(0.12, 0.38, 0, 0.16, 0.76, 0.18, 0, [0.12, 0.13, 0.18]); gb.box(-0.29, 1.05, 0, 0.1, 0.56, 0.12, 0, [0.7, 0.55, 0.45]); gb.box(0.29, 1.05, 0, 0.1, 0.56, 0.12, 0, [0.7, 0.55, 0.45]);
  const geo = gb.build(); const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), N); mesh.frustumCulled = false; mesh.count = 0; const col = new THREE.Color(); for (let i = 0; i < N; i++) { col.setHSL(Math.random(), 0.45, 0.45); mesh.setColorAt(i, col); } scene.add(mesh); AI.peds = { mesh, list: [], N };
};
const _po = new THREE.Object3D();
function blockCorners(i, j) { const hw = k => (k === 0 || Math.abs(k) === 6) ? 11 : 8; return [120 * i + hw(i) + 2.4, 120 * j + hw(j) + 2.4, 120 * (i + 1) - hw(i + 1) - 2.4, 120 * (j + 1) - hw(j + 1) - 2.4]; }
AI.updatePeds = function (dt, px, pz, pl) {
  const P = AI.peds; if (!P) return; const list = P.list; const night = G.FX ? G.FX.night : 0; const want = Math.round((1 - night * 0.55) * 52 * AI.density) * (Math.abs(px) < 900 && Math.abs(pz) < 900 ? 1 : 0.2);
  while (list.length < want) { const ang = rng() * U.TAU, d = 20 + rng() * 150; const x = px + Math.cos(ang) * d, z = pz + Math.sin(ang) * d; if (Math.abs(x) > 700 || Math.abs(z) > 700) break; const i = Math.floor(x / 120), j = Math.floor(z / 120); if (i < -6 || i > 5 || j < -6 || j > 5) break; const b = blockCorners(i, j); const side = Math.floor(rng() * 4); let sx, sz; if (side === 0) { sx = lerp(b[0], b[2], rng()); sz = b[1]; } else if (side === 1) { sx = b[2]; sz = lerp(b[1], b[3], rng()); } else if (side === 2) { sx = lerp(b[0], b[2], rng()); sz = b[3]; } else { sx = b[0]; sz = lerp(b[1], b[3], rng()); } list.push({ x: sx, z: sz, i, j, dir: rng() < 0.5 ? 1 : -1, speed: 1.1 + rng() * 0.7, ph: rng() * 6, state: 'walk', t: 0, vy: 0, y: 14.18, fx: 0, fz: 0, ci: i }); }
  let k = 0; for (let n = list.length - 1; n >= 0; n--) { const p = list[n]; const dd = Math.hypot(p.x - px, p.z - pz); if (dd > 230 || (list.length > want + 4 && dd > 120)) { list.splice(n, 1); continue; }
    p.t += dt; if (p.state === 'walk') { const b = blockCorners(p.i, p.j); // um den Block laufen
      let tx = p.x, tz = p.z; const left = Math.abs(p.x - b[0]) < 0.6, right = Math.abs(p.x - b[2]) < 0.6, top = Math.abs(p.z - b[1]) < 0.6, bot = Math.abs(p.z - b[3]) < 0.6; let dx = 0, dz = 0; if (top && !right) dx = 1; else if (right && !bot) dz = 1; else if (bot && !left) dx = -1; else if (left && !top) dz = -1; else { dx = top ? 1 : 0; } p.x = clamp(p.x + dx * p.dir * p.speed * dt, b[0], b[2]); p.z = clamp(p.z + dz * p.dir * p.speed * dt, b[1], b[3]); p.fx = dx * p.dir; p.fz = dz * p.dir; if (p.x <= b[0] + 0.01 && p.z <= b[1] + 0.01 && p.dir < 0 && false) p.dir = 1;
      // Ausweichen
      if (pl) { const sx = pl.pos.x - p.x, sz = pl.pos.z - p.z; const d2 = Math.hypot(sx, sz); if (d2 < 14 && pl.speed > 9) { const inward = Math.sign(sx * pl.vel.x + sz * pl.vel.z); p.x -= (sx / d2) * 3 * dt * 1.2; p.z -= (sz / d2) * 3 * dt * 1.2; } if (d2 < 2.1 && pl.speed > 3.5) { p.state = 'hit'; p.t = 0; p.vy = 3 + pl.speed * 0.1; p.fx = pl.vel.x * 0.5; p.fz = pl.vel.z * 0.5; AI.addHeat(18, 'Fußgänger'); if (AI.onPedHit) AI.onPedHit(p); } } }
    else if (p.state === 'hit') { p.x += p.fx * dt; p.z += p.fz * dt; p.vy -= 12 * dt; p.y += p.vy * dt; p.fx *= 0.98; p.fz *= 0.98; if (p.y <= 14.18) { p.y = 14.18; p.vy = 0; p.fx *= 0.8; p.fz *= 0.8; } if (p.t > 5) { list.splice(n, 1); continue; } }
    const sway = Math.sin(p.t * 7 * p.speed + p.ph) * 0.05; const yaw = Math.atan2(p.fx, p.fz); const bob = p.state === 'walk' ? Math.abs(Math.sin(p.t * 6 * p.speed + p.ph)) * 0.04 : 0; _po.position.set(p.x, (p.state === 'walk' ? 14.18 : p.y) + bob, p.z); _po.rotation.set(p.state === 'hit' ? Math.min(1.5, p.t * 4) : 0, yaw, sway); _po.updateMatrix(); if (k < P.N) P.mesh.setMatrixAt(k++, _po.matrix); }
  P.mesh.count = k; P.mesh.instanceMatrix.needsUpdate = true;
};

/* ------------------------------------------------------------------ Hauptupdate */
AI.hash = new Map();
function rebuildHash() { AI.hash.clear(); for (const c of AI.cars) { if (c.dead) continue; const k = Math.floor(c.x / 40) * 10007 + Math.floor(c.z / 40); let a = AI.hash.get(k); if (!a) { a = []; AI.hash.set(k, a); } a.push(c); } }
function circlesOf(c) { const sn = Math.sin(c.yaw), cs = Math.cos(c.yaw); const o = []; for (const [z, r] of c.circles) o.push([c.x + sn * z, c.z + cs * z, r]); return o; }
const _hit = {};
/* Kollision AI <-> Spieler und AI <-> AI */
AI.collide = function (pl, dt) {
  if (!pl) return; const pf = pl.forward(new V3()); const pcirc = []; for (const ci of pl.circles) pcirc.push([pl.pos.x + pf.x * ci.z, pl.pos.z + pf.z * ci.z, ci.r]);
  for (const c of AI.cars) { if (c.dead) continue; const dx0 = c.x - pl.pos.x, dz0 = c.z - pl.pos.z; if (dx0 * dx0 + dz0 * dz0 > 100) continue; if (Math.abs(c.y - (pl.pos.y - pl.cgY)) > 2.5) continue; const cc = circlesOf(c);
    for (const a of pcirc) for (const b of cc) { const dx = b[0] - a[0], dz = b[1] - a[1]; const d = Math.hypot(dx, dz); const pen = a[2] + b[2] - d; if (pen <= 0) continue; const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
      const vrx = c.vx - pl.vel.x, vrz = c.vz - pl.vel.z; const vn = vrx * nx + vrz * nz; const mA = pl.m, mB = c.mass * (c.state === 'block' ? 6 : 1); c.x += nx * pen * (mA / (mA + mB)); c.z += nz * pen * (mA / (mA + mB)); pl.pos.x -= nx * pen * (mB / (mA + mB)); pl.pos.z -= nz * pen * (mB / (mA + mB));
      if (vn < 0) { const j = -(1 + 0.25) * vn / (1 / mA + 1 / mB); const P = new V3(a[0] + nx * a[2], pl.pos.y - pl.cgY * 0.4, a[1] + nz * a[2]); pl.addImpulse(P, new V3(-nx * j, 0, -nz * j) .multiplyScalar(0.9)); c.hit(nx * j, nz * j, 0.5 * (mA * mB / (mA + mB)) * vn * vn); if (AI.onPlayerHit) AI.onPlayerHit(P, new V3(-nx, 0, -nz), -vn, 0.5 * (mA * mB / (mA + mB)) * vn * vn, c); if (c.kind === 'traffic' && Math.abs(vn) > 4) AI.addHeat(Math.abs(vn) * 1.4, 'Unfall'); if (c.kind === 'cop' && Math.abs(vn) > 3) AI.addHeat(Math.abs(vn) * 0.7, 'Polizei gerammt'); } } }
  // AI <-> AI (nur nahe Paare)
  for (const [k, L] of AI.hash) { for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (a.state === 'block' && b.state === 'block') continue; if (a.kind === 'traffic' && b.kind === 'traffic' && a.state === 'drive' && b.state === 'drive') continue; const dx = b.x - a.x, dz = b.z - a.z; const d2 = dx * dx + dz * dz; if (d2 > 36) continue; const ca = circlesOf(a), cb = circlesOf(b);
      for (const p of ca) for (const q of cb) { const ddx = q[0] - p[0], ddz = q[1] - p[1]; const d = Math.hypot(ddx, ddz), pen = p[2] + q[2] - d; if (pen <= 0) continue; const nx = d > 1e-4 ? ddx / d : 1, nz = d > 1e-4 ? ddz / d : 0; const mA = a.mass * (a.state === 'block' ? 8 : 1), mB = b.mass * (b.state === 'block' ? 8 : 1); a.x -= nx * pen * mB / (mA + mB); a.z -= nz * pen * mB / (mA + mB); b.x += nx * pen * mA / (mA + mB); b.z += nz * pen * mA / (mA + mB); const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (vn < 0) { const j2 = -(1.2) * vn / (1 / mA + 1 / mB); a.hit(-nx * j2, -nz * j2, 0.5 * mA * vn * vn * 0.5); b.hit(nx * j2, nz * j2, 0.5 * mB * vn * vn * 0.5); } } } }
};
function carWorld(c) { // statische Hindernisse für dynamische Fahrzeuge
  const L = c.circles; const sn = Math.sin(c.yaw), cs = Math.cos(c.yaw); for (const [z, r] of L) { const cx = c.x + sn * z, cz = c.z + cs * z; const h = G.Collide.circleVsWorld(cx, cz, r, undefined, _hit) || G.Collide.roadBarrier(cx, cz, r, _hit); if (!h) continue; c.x += h.nx * h.depth * 0.9; c.z += h.nz * h.depth * 0.9; const vn = c.vx * h.nx + c.vz * h.nz; if (vn < 0) { c.vx -= (1.25) * vn * h.nx; c.vz -= (1.25) * vn * h.nz; c.vx *= 0.8; c.vz *= 0.8; c.hp -= vn * vn * 0.03; if (h.col && h.col.soft && !h.col.dead && Math.abs(vn) > 5) { h.col.dead = true; if (h.col.lampPole) G.Gen.breakLamp(h.col); } } }
}
AI.update = function (dt, pl, cam, opt) {
  opt = opt || {}; AI.time += dt; if (!AI.scene) return; const px = pl.pos.x, pz = pl.pos.z; const f = pl.forward(new V3()); rebuildHash();
  // Spur des Spielers (Brotkrumen)
  const lt = AI.trail[AI.trail.length - 1]; if (!lt || Math.hypot(lt.x - px, lt.z - pz) > 14) { AI.trail.push({ x: px, z: pz }); if (AI.trail.length > 60) AI.trail.shift(); }
  // Verkehr: Anzahl nach Zone/Tageszeit
  const zone = W.zoneAt(px, pz); const base = zone === 'city' ? 26 : zone === 'suburb' || zone === 'industrial' ? 16 : zone === 'harbor' ? 8 : 9; const night = G.FX ? G.FX.night : 0; const want = Math.round(base * (1 - night * 0.45) * AI.density * (opt.freeze ? 0 : 1)); let traffic = 0, cops = 0; for (const c of AI.cars) { if (c.kind === 'traffic') traffic++; if (c.kind === 'cop') cops++; }
  AI.spawnT = (AI.spawnT || 0) - dt; if (traffic < want && AI.spawnT <= 0 && !opt.freeze) { AI.spawnTraffic(px, pz, f.x, f.z); AI.spawnT = 0.35; }
  // Polizeipräsenz
  if (AI.heat > 0 && AI.enabled) { const want2 = AI.copsWanted(); AI.copT = (AI.copT || 0) - dt; if (cops < want2 && AI.copT <= 0) { AI.spawnCopNear(pl, rng() < 0.3 && AI.heat >= 2); AI.copT = 1.6 - AI.heat * 0.15; } if (AI.heat >= 2) { AI.blockT = (AI.blockT || 8) - dt; if (AI.blockT <= 0 && AI.blocks.length < 2) { AI.makeRoadblock(pl); AI.blockT = 26 - AI.heat * 3; } } }
  // Hubschrauber
  if (AI.heat >= 4 && !opt.noHeli) { if (!AI.heli) AI.heli = AI.makeHeli(); const h = AI.heli; h.group.visible = true; h.t += dt; const tgt = new V3(px + Math.cos(h.t * 0.25) * 28 - pl.vel.x * -0.4, pl.pos.y + 70, pz + Math.sin(h.t * 0.25) * 28 - pl.vel.z * -0.4); if (h.pos.lengthSq() === 0) h.pos.set(px + 200, pl.pos.y + 90, pz + 200); h.pos.lerp(tgt, Math.min(1, dt * 0.8)); h.group.position.copy(h.pos); h.group.rotation.y = Math.atan2(pl.pos.x - h.pos.x, pl.pos.z - h.pos.z); h.blade.rotation.y += dt * 40; h.rotor.rotation.y = h.blade.rotation.y; h.spot.intensity = G.FX && G.FX.night > 0.3 ? 8 : 0; h.spot.target.position.set(0, -80, 160).applyMatrix4(new THREE.Matrix4().identity()); h.spot.target.position.copy(pl.pos).sub(h.pos); h.spot.target.position.applyAxisAngle(new V3(0, 1, 0), -h.group.rotation.y); }
  else if (AI.heli) AI.heli.group.visible = false;
  // Fahrzeuge
  for (let i = AI.cars.length - 1; i >= 0; i--) { const c = AI.cars[i]; const dx = c.x - px, dz = c.z - pz; const dist = Math.hypot(dx, dz);
    if (c.kind === 'traffic') { if (dist > 560 || (c.state === 'wreck' && c.wreckT > 25 && dist > 40)) { c.dispose(); AI.group_remove(c); AI.cars.splice(i, 1); continue; } if (c.state === 'drive') trafficControl(c, dt, pl); else if (c.state === 'hit') { c.hitT = (c.hitT || 0) + dt; c.thr = 0; c.brk = 0.7; if (c.speed < 1.5 || c.hitT > 6) { c.state = 'wreck'; c.wreckT = 0; } } else if (c.state === 'wreck') { c.wreckT += dt; c.brk = 1; } }
    else if (c.kind === 'cop' || c.kind === 'copLeave') { if (c.kind === 'copLeave') { c.state = 'chase'; c.thr = 0.5; c.brk = 0; const cl = W.snapToRoad(c.x, c.z, 30); c.steer = 0; if (dist > 300) { c.dispose(); AI.group_remove(c); AI.cars.splice(i, 1); continue; } c.setLights(false, false); } else if (c.state === 'chase' || c.state === 'block') { if (c.state === 'chase') copControl(c, dt, pl); else { c.thr = 0; c.brk = 1; } if (c.teleport) { AI.cars.splice(i, 1); c.dispose(); AI.group_remove(c); continue; } if (dist > 700 && c.state !== 'block') { c.dispose(); AI.group_remove(c); AI.cars.splice(i, 1); continue; } } else if (c.state === 'wreck') { c.wreckT += dt; if (c.wreckT > 14 && dist > 60) { c.dispose(); AI.group_remove(c); AI.cars.splice(i, 1); continue; } } }
    else if (c.kind === 'racer') { if (c.state === 'race') racerControl(c, dt, pl, c.rubber || 1); }
    // Dynamik
    if (c.state === 'block') { /* steht */ } c.step(dt); if (c.kind !== 'traffic' || c.state !== 'drive') carWorld(c);
    // Boden / Wasser
    if (c.y < -2 && c.state !== 'block') { c.state = 'wreck'; }
    // Licht & Modell
    const nightLights = night > 0.35 || (G.FX && G.FX.w.rain > 0.3); const braking = c.brk > 0.1 || c.state === 'wreck'; if (dist < 260) c.setLights(c.kind === 'cop' ? true : nightLights, braking); c.group.visible = dist < 600; if (c.group.visible) { c.syncModel(dt, dist); if (c.model.lightRed) { const ph = ((AI.time * 4 + c.flash) % 2) < 1; c.model.lightRed.color.setRGB(ph ? 2.5 : 0.1, 0.04, 0.04); c.model.lightBlue.color.setRGB(0.04, 0.1 + (ph ? 0 : 0), ph ? 0.1 : 2.8); } c.group.children.forEach(ch => { if (ch.castShadow !== undefined && dist < 80 && c.lod === 0) ch.castShadow = true; }); }
    if (c.state === 'wreck' && c.hp < 0 && c.wreckT < 18 && dist < 120 && Math.random() < dt * 8) G.FX.smoke(new V3(c.x, c.y + 1.0, c.z), new V3(0, 0, 0), 1, true);
  }
  AI.collide(pl, dt);
  // Straßensperren-Bereinigung
  for (let i = AI.blocks.length - 1; i >= 0; i--) { const b = AI.blocks[i]; b.t += dt; if (Math.hypot(b.x - px, b.z - pz) > 650 || AI.heat === 0 && b.t > 6) { if (b.spike && b.spike.mesh) { AI.scene.remove(b.spike.mesh); } for (const c of b.cars) { if (!c.dead) { c.kind = 'copLeave'; c.state = 'chase'; } } AI.blocks.splice(i, 1); } }
  // Reifenplatzer durch Nagelbänder
  for (const b of AI.blocks) if (b.spike && !b.spike.used) { const s = b.spike; const dx = px - s.x, dz = pz - s.z; const lat = Math.abs(dx * Math.cos(s.ry + Math.PI / 2) - dz * Math.sin(s.ry + Math.PI / 2)); const lon = Math.abs(dx * Math.sin(s.ry + Math.PI / 2) + dz * Math.cos(s.ry + Math.PI / 2)); if (lon < 2.2 && lat < s.half && pl.speed > 2) { s.used = true; for (let i = 0; i < 4; i++) if (Math.random() < 0.7) pl.tirePop[i] = 1; if (AI.onSpike) AI.onSpike(); } }
  // Abklingen der Fahndung
  AI.updateHeat(dt, pl);
  AI.updateSignals(px, pz);
};
AI.group_remove = function (c) { if (c.group.parent) c.group.parent.remove(c.group); };
AI.updateHeat = function (dt, pl) {
  if (AI.heat === 0) { AI.heatPts = Math.max(0, AI.heatPts - dt * 1.5); return; }
  let seen = false, nearest = 1e9; for (const c of AI.cars) if (c.kind === 'cop' && c.state !== 'wreck') { const d = Math.hypot(c.x - pl.pos.x, c.z - pl.pos.z); nearest = Math.min(nearest, d); if (c.los || d < 60) seen = true; }
  AI.nearestCop = nearest; AI.visible = seen;
  if (!seen && nearest > 90) { AI.cool = (AI.cool || 0) + dt / (7 + AI.heat * 1.5) * (pl.speed < 12 ? 1.4 : 1); } else AI.cool = Math.max(0, (AI.cool || 0) - dt * 0.35);
  if (AI.cool >= 1) { const reward = AI.heat; AI.escaped = true; AI.clearHeat(); if (AI.onEscape) AI.onEscape(reward); }
  // Gefasst
  let near = 0; for (const c of AI.cars) if (c.kind === 'cop' && c.state !== 'wreck' && c.state !== 'block') { const d = Math.hypot(c.x - pl.pos.x, c.z - pl.pos.z); if (d < 9) near++; } for (const b of AI.blocks) for (const c of b.cars) if (Math.hypot(c.x - pl.pos.x, c.z - pl.pos.z) < 6 && pl.speed < 5) near += 1;
  if (near >= 1 && pl.speed < 9) AI.bust = (AI.bust || 0) + dt * (near > 1 ? 1.3 : 0.8) / 3.2; else AI.bust = Math.max(0, (AI.bust || 0) - dt * 0.4);
  if (AI.bust >= 1 && AI.onBusted) { AI.bust = 0; AI.onBusted(); }
};
AI.reset = function () { for (const c of AI.cars) { c.dispose(); AI.group_remove(c); } AI.cars.length = 0; AI.heat = 0; AI.heatPts = 0; AI.cool = 0; AI.bust = 0; for (const b of AI.blocks) if (b.spike && b.spike.mesh) AI.scene.remove(b.spike.mesh); AI.blocks.length = 0; AI.trail.length = 0; if (AI.heli) AI.heli.group.visible = false; if (AI.peds) { AI.peds.list.length = 0; } };
AI.init = function (scene) { AI.scene = scene; AI.initSignals(scene); AI.initPeds(scene); };
/* Sirenen-/Verkehrs-Liste für Audio */
AI.audioLists = function (pl, camPos, right) {
  const sir = [], tr = []; const pv = pl.vel; for (const c of AI.cars) { const dx = c.x - camPos.x, dz = c.z - camPos.z; const d = Math.hypot(dx, dz); if (d > 440) continue; const px = (dx * right.x + dz * right.z) / Math.max(d, 1); const dop = clamp(-((c.vx - pv.x) * dx + (c.vz - pv.z) * dz) / Math.max(d, 1) / 340, -0.12, 0.12); if (c.kind === 'cop' && c.state !== 'wreck') sir.push({ dist: d, px, dop, style: c.copKind === 'interceptor' ? 1 : 0, phase: c.sirenPhase }); else if (d < 150 && (c.kind === 'traffic' || c.kind === 'racer') && c.state !== 'wreck') tr.push({ dist: d, px, dop, rpm: 1400 + c.speed * 70, cyl: c.spec.cyl || 4, thr: c.thr }); }
  sir.sort((a, b) => a.dist - b.dist); tr.sort((a, b) => a.dist - b.dist); return [sir, tr];
};
G.AI = AI;
})(window.G = window.G || {});
