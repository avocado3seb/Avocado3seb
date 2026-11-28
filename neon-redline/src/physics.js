/* NEON REDLINE – physics.js : Fahrzeugdynamik (3D-Starrkörper, Federbeine, Reifen, Antrieb) + Kollisionen */
(function (G) {
'use strict';
const U = G.U, W = G.World, CD = G.CD; const { clamp, lerp, sstep } = U;
const V3 = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4;
const GRAV = 9.81, RHO = 1.2;
const _v = new V3(), _v2 = new V3(), _v3 = new V3(), _q = new Q(), _m = new M4();

/* Reifenkennlinie: normierter Schlupf -> Kraftanteil */
function tireCurve(r) { return Math.sin(1.5 * Math.atan(1.9 * r)); }

const _gq = { r: null };
function sampleGround(x, z, y, out) {
  const h = W.groundAt(x, z, y), hx = W.groundAt(x + 0.7, z, y), hz = W.groundAt(x, z + 0.7, y);
  let nx = -(hx - h) / 0.7, nz = -(hz - h) / 0.7; const l = Math.hypot(nx, 1, nz); out.h = h; out.nx = nx / l; out.ny = 1 / l; out.nz = nz / l; return out;
}

class Vehicle {
  constructor(spec, cfg) { this.setSpec(spec, cfg); this.reset(); }
  setSpec(spec, cfg) {
    this.spec = spec; this.cfg = cfg || CD.defaultCfg(spec); const e = this.e = CD.effective(spec, this.cfg);
    this.m = e.mass; const L = e.L, Wd = e.W, H = e.H; this.cgY = 0.40 * H + 0.02;
    const zfa = L / 2 - e.fo, zra = zfa - e.wb; this.zcg = zfa - e.wb * (1 - e.fw); this.zfa = zfa; this.zra = zra;
    this.Iyaw = this.m * (L * L + Wd * Wd) / 12 * 0.85; this.Ipitch = this.m * (L * L + H * H) / 12 * 0.8; this.Iroll = this.m * (Wd * Wd + H * H) / 12 * 0.8;
    this.invI = [1 / this.Ipitch, 1 / this.Iyaw, 1 / this.Iroll]; // x (links), y (oben), z (vor)
    const wr = e.wr; this.R = wr; this.xRest = 0.2; this.xMin = 0.05; this.xMax = this.xRest + 0.17; const track = e.track * (e.trackMul || 1);
    this.wheels = []; const Fz0 = [e.fw * this.m * GRAV / 2, e.fw * this.m * GRAV / 2, (1 - e.fw) * this.m * GRAV / 2, (1 - e.fw) * this.m * GRAV / 2];
    const f = e.fHz; for (let i = 0; i < 4; i++) { const left = i % 2 === 0, front = i < 2; const mc = this.m / 4; const k = mc * Math.pow(2 * Math.PI * f * (front ? 1.0 : 1.05), 2) * 1.0; const sag = Fz0[i] / k;
      const c = 2 * Math.sqrt(k * mc) * 0.42; this.wheels.push({ i, left, front, k, c, cRebound: c * 1.5, xFree: this.xRest + sag, x: this.xRest, xPrev: this.xRest, comp: 0, ay: wr + this.xRest - this.cgY, ax: (left ? 1 : -1) * track / 2, az: (front ? zfa : zra) - this.zcg, omega: 0, contact: false, load: 0, slipRatio: 0, slipAngle: 0, slide: 0, ground: { h: 0, nx: 0, ny: 1, nz: 0 }, cp: new V3(), grip: 1, surf: 'asphalt', Fz: 0, lockBrake: false, hot: 0 }); }
    this.arb = 0.55; this.Iw = 0.9 + wr * 2; this.drive = e.drive; this.fwFrac = e.drive === 'AWD' ? 0.42 : e.drive === 'FWD' ? 1 : 0;
    const gb = CD.gearbox(e); this.gearRatios = gb.ratios; this.finalDrive = gb.final; this.nGears = gb.n; this.tqScale = CD.torqueScale(e); this.isEV = e.layout === 'EV';
    this.body = [[0.8, 0.14, 0.42], [-0.8, 0.14, 0.42], [0.8, 0.14, -0.42], [-0.8, 0.14, -0.42]].map(([a, b, c]) => new V3(a * Wd / 2, b - this.cgY + 0.04, c * L - this.zcg)).concat([[0.7, 0, 0.2], [-0.7, 0, 0.2], [0.7, 0, -0.25], [-0.7, 0, -0.25]].map(([a, b, c]) => new V3(a * Wd / 2, H - this.cgY, c * L - this.zcg)));
    this.hpMax = e.hp; this.nitroMax = e.nitroTank; this.nitro = this.nitroMax;
    this.circles = [[0.34 * L - this.zcg + 0.0, Wd * 0.47], [0, Wd * 0.5], [-0.34 * L - this.zcg, Wd * 0.47]].map(([z, r]) => ({ z, r }));
    this.circles[0].z = L * 0.5 - this.zcg - Wd * 0.47; this.circles[2].z = -L * 0.5 - this.zcg + Wd * 0.47; this.circles[1].z = (this.circles[0].z + this.circles[2].z) / 2;
  }
  reset(x, y, z, yaw) {
    this.pos = new V3(x || 0, y || 2, z || 0); this.quat = new Q().setFromAxisAngle(new V3(0, 1, 0), yaw || 0); this.vel = new V3(); this.w = new V3();
    this.rpm = this.e.idle || 900; this.gear = 1; this.shiftT = 0; this.shiftCool = 0; this.boost = 0; this.thr = 0; this.brk = 0; this.steer = 0; this.steerIn = 0; this.hb = 0; this.nitroOn = false; this.clutch = 1; this.reverse = false; this.limiter = 0;
    for (const w of this.wheels) { w.omega = 0; w.x = w.xRest || this.xRest; w.xPrev = w.x; w.contact = false; }
    this.input = { throttle: 0, brake: 0, steer: 0, hb: 0, nitro: false, up: false, down: false }; this.auto = true; this.speed = 0; this.fwdSpeed = 0; this.gForce = new V3(); this.prevVel = new V3(); this.onGround = 0; this.airTime = 0; this.crashImpulse = 0; this.flipTimer = 0; this.dmg = { front: 0, rear: 0, left: 0, right: 0, top: 0 }; this.health = 1; this.inWater = false; this.slipSum = 0; this.tcs = 1; this.stableAssist = 0.5; this.ems = []; this.tirePop = [0, 0, 0, 0]; this.driftTime = 0; this.driftScore = 0; this.surfaceType = 'asphalt'; this.exhaustPop = 0; this.blowoff = 0; this.backfire = 0;
  }
  get yaw() { _v.set(0, 0, 1).applyQuaternion(this.quat); return Math.atan2(_v.x, _v.z); }
  forward(out) { return (out || _v).set(0, 0, 1).applyQuaternion(this.quat); }
  up(out) { return (out || _v).set(0, 1, 0).applyQuaternion(this.quat); }
  left(out) { return (out || _v).set(1, 0, 0).applyQuaternion(this.quat); }
  localToWorld(p, out) { return (out || new V3()).copy(p).applyQuaternion(this.quat).add(this.pos); }
  addImpulse(pointW, J) { // J (Ns) am Punkt pointW (Welt)
    this.vel.addScaledVector(J, 1 / this.m); _v.copy(pointW).sub(this.pos); _v2.crossVectors(_v, J); this.w.add(this._invIWorld(_v2));
  }
  _invIWorld(t) { // I^-1_world * t
    _q.copy(this.quat).invert(); _v3.copy(t).applyQuaternion(_q); _v3.set(_v3.x * this.invI[0], _v3.y * this.invI[1], _v3.z * this.invI[2]); return _v3.applyQuaternion(this.quat);
  }
  /* Steuer-Eingaben (-1..1 / 0..1) */
  setInput(inp) { Object.assign(this.input, inp); }

  step(dt, wet, env) {
    const e = this.e, m = this.m; const inp = this.input; const up = this.up(new V3()), fwd = this.forward(new V3()), lft = this.left(new V3());
    const vF = this.vel.dot(fwd); this.fwdSpeed = vF; this.speed = this.vel.length();
    // --- Eingabe glätten
    this.thr += (inp.throttle - this.thr) * Math.min(1, dt * 14); this.brk += (inp.brake - this.brk) * Math.min(1, dt * 16);
    const dmgPow = 1 - 0.38 * this.dmg.front - 0.1 * this.dmg.top; // Schaden mindert Leistung
    // Automatik / Rückwärts
    if (this.auto) {
      if (this.gear < 0) { if (inp.throttle > 0.1 && vF > -1.0 && inp.brake < 0.1) this.gear = 1; }
      else if (inp.brake > 0.2 && inp.throttle < 0.05 && vF < 1.2) this.gear = -1;
    }
    const reverse = this.gear < 0; const drvIn = reverse ? inp.brake : inp.throttle; const brkIn = reverse ? inp.throttle : inp.brake; const thr = reverse ? this.brk * 0 + this._smoothR(drvIn, dt) : this.thr;
    this.rThr = thr;
    // --- Lenkung
    const v = Math.abs(vF); const maxSteer = 0.56 / (1 + Math.pow(v / 9.5, 1.45)); let sIn = inp.steer;
    const rate = inp.analog ? 12 : (Math.abs(sIn) > Math.abs(this.steerIn) ? 5.5 : 9); this.steerIn += clamp(sIn - this.steerIn, -rate * dt, rate * dt);
    let steerCmd = this.steerIn * maxSteer;
    // Gegenlenk-Assistent
    const vy = this.vel.dot(lft); if (v > 7 && this.stableAssist > 0) { const slipA = Math.atan2(vy, Math.max(Math.abs(vF), 3)) * Math.sign(vF || 1); steerCmd += clamp(slipA * 0.85 * this.stableAssist, -0.25, 0.25); steerCmd = clamp(steerCmd, -0.7, 0.7); }
    // Lenkradversatz durch Schaden
    steerCmd += (this.dmg.left - this.dmg.right) * 0.012; this.steer = steerCmd;
    // --- Motor / Getriebe
    const idle = e.idle || 900, red = e.red; const Gt = this.gearRatios[Math.max(0, Math.abs(this.gear) - 1)] * this.finalDrive * (this.gear < 0 ? -0.95 : 1) * (this.isEV ? 1 : 1);
    let drvOmega = 0, nd = 0; for (const w of this.wheels) if ((this.fwFrac >= 0.99 && w.front) || (this.fwFrac <= 0.01 && !w.front) || (this.fwFrac > 0.01 && this.fwFrac < 0.99)) { drvOmega += Math.abs(w.omega); nd++; } drvOmega /= Math.max(1, nd);
    let rpmW = drvOmega * Math.abs(Gt) * 30 / Math.PI; let rpmTarget; const rpmG = Math.abs(vF) / this.R * Math.abs(Gt) * 30 / Math.PI; const rpmS = Math.min(rpmW, rpmG * 1.2 + 400);
    if (this.isEV) { rpmTarget = rpmW; this.rpm += (rpmTarget - this.rpm) * Math.min(1, dt * 20); }
    else { const launch = idle + thr * (red * 0.42 - idle); rpmTarget = this.shiftT > 0 ? Math.max(idle, this.rpm - 1800 * dt * (thr > 0.2 ? 0.3 : 1)) : Math.max(rpmW, thr > 0.05 && rpmW < red * 0.4 ? launch : idle); this.rpm += (rpmTarget - this.rpm) * Math.min(1, dt * (rpmTarget > this.rpm ? 16 : 10)); }
    if (this.shiftT > 0) this.shiftT -= dt; if (this.shiftCool > 0) this.shiftCool -= dt;
    // Automatikschaltung
    if (this.auto && this.gear > 0 && !this.isEV) {
      const upRpm = red * (0.90 + 0.06 * this.thr); if (rpmS > upRpm && this.gear < this.nGears && this.shiftCool <= 0 && this.input.brake < 0.3) { this.gear++; this.shiftT = e.shiftTime; this.shiftCool = 0.5; this.shifted = 1; }
      else if (this.gear > 1 && this.shiftCool <= 0) { const rpmDown = rpmS * (this.gearRatios[this.gear - 2] / this.gearRatios[this.gear - 1]); if (rpmS < red * (this.thr > 0.85 ? 0.46 : 0.30) && rpmDown < red * 0.88) { this.gear--; this.shiftT = e.shiftTime * 0.7; this.shiftCool = 0.4; this.shifted = -1; } }
    } else if (!this.auto && !this.isEV) { if (inp.up && this.shiftCool <= 0 && this.gear < this.nGears && this.gear > 0) { this.gear++; this.shiftT = e.shiftTime; this.shiftCool = 0.25; this.shifted = 1; inp.up = false; } else if (inp.down && this.shiftCool <= 0 && this.gear > 1) { this.gear--; this.shiftT = e.shiftTime * 0.7; this.shiftCool = 0.25; this.shifted = -1; inp.down = false; } }
    // Turbo
    const boostTarget = e.turboLevel > 0 ? thr * sstep(0.22 * red, 0.5 * red, this.rpm) : 0; const tau = 0.9 / (0.6 + e.turboLevel * 0.5); this.boost += (boostTarget - this.boost) * Math.min(1, dt / tau * (boostTarget > this.boost ? 1 : 2.4));
    if (e.turboLevel > 0 && this.boostPrev > 0.5 && this.thr < 0.2 && this.boost > 0.4) this.blowoff = 1; this.boostPrev = this.boost > 0.5 && this.thr > 0.8 ? 1 : (this.thr < 0.2 ? this.boostPrev : 0);
    // Drehmoment
    if (!(this.limiter > 0)) this.limiter = 0; let tq = 0; if (this.shiftT <= 0 && Math.abs(this.gear) > 0 && this.limiter <= 0) { const base = CD.engineTorque(e, clamp(this.rpm, idle * 0.7, red), this.tqScale); const turboMul = e.turboLevel > 0 ? lerp(0.62, 1.0, this.boost) : 1; tq = base * turboMul * thr * dmgPow * (this.isEV ? 1 : 1); }
    if (this.rpm > red - 50 || (this.isEV && rpmW > red)) { this.limiter = 0.06; } if (this.limiter > 0) this.limiter = Math.max(0, this.limiter - dt);
    // Lachgas
    this.nitroOn = inp.nitro && this.nitro > 0 && thr > 0.3 && !reverse; if (this.nitroOn) { this.nitro = Math.max(0, this.nitro - dt); tq *= e.nitroBoost; }
    else if (!inp.nitro && this.nitro < this.nitroMax) this.nitro = Math.min(this.nitroMax, this.nitro + dt * 0.08);
    // Auspuffknallen: beim Gaswegnehmen bei hoher Drehzahl
    if (this.prevThr > 0.6 && this.thr < 0.2 && this.rpm > red * 0.55 && !this.isEV) { this.exhaustPop = 1 + e.popLevel; } this.prevThr = this.thr;
    let dk = 0; for (const w of this.wheels) if ((this.fwFrac > 0.99 ? w.front : this.fwFrac < 0.01 ? !w.front : true) && w.contact) dk = Math.max(dk, w.slipRatio); const tcsT = clamp((dk - 0.24) / 0.12, 0, 1) * this.tcs * (inp.hb > 0 ? 0 : 1); this.tcsCut = (this.tcsCut || 0) + (tcsT - (this.tcsCut || 0)) * Math.min(1, dt * 30); tq *= (1 - this.tcsCut);
    const wheelTq = tq * Gt * 0.9; this.wheelTq = wheelTq; this.engTq = tq;
    // --- Radkräfte
    let totFx = 0; const net = new V3(), torque = new V3(); const grav = _v.set(0, -GRAV * m, 0); net.add(grav);
    const brakeCap = m * GRAV * 1.35 * e.brake; const axleB = [0.62, 0.38]; const slipA = []; this.onGround = 0; let slipSum = 0;
    const wetK = 1 - 0.30 * (wet || 0);
    // Differential: Moment auf Antriebsräder
    this._sh = null; const drv = this.wheels.filter(w => this.fwFrac > 0.99 ? w.front : this.fwFrac < 0.01 ? !w.front : true); const sh = new Array(4).fill(0);
    if (wheelTq !== 0) { const fShare = this.fwFrac > 0.01 && this.fwFrac < 0.99 ? this.fwFrac : (this.fwFrac > 0.99 ? 1 : 0); const rShare = 1 - fShare; for (let ax = 0; ax < 2; ax++) { const share = ax === 0 ? fShare : rShare; if (share <= 0) continue; const a = this.wheels[ax * 2], b = this.wheels[ax * 2 + 1]; const diff = clamp(((Math.abs(a.slipRatio) - Math.abs(b.slipRatio)) / 0.25), -1, 1); const T = wheelTq * share; sh[ax * 2] = T / 2 * (1 - 0.35 * diff); sh[ax * 2 + 1] = T - sh[ax * 2]; } }
    this._sh = sh;
    for (const w of this.wheels) {
      // Aufhängungspunkt (Welt)
      const A = _v.set(w.ax, w.ay, w.az).applyQuaternion(this.quat).add(this.pos).clone(); const gr = w.ground; sampleGround(A.x - up.x * 0.0, A.z, A.y, gr);
      const upY = up.y; const dist = upY > 0.2 ? (A.y - gr.h) / (upY * 1.0) : 99; const xNew = dist - this.R; let contact = xNew < this.xMax && upY > 0.05;
      w.contact = contact; if (!contact) { w.x = Math.min(this.xMax, w.x + dt * 1.4); w.load = 0; w.Fz = 0; w.slipRatio *= 0.9; w.omega += (sh[w.i] * 0.6 / this.Iw) * dt; w.omega -= w.omega * Math.min(1, dt * 0.3); if (brkIn > 0) w.omega *= Math.max(0, 1 - dt * 6 * brkIn); continue; }
      this.onGround++; w.xPrev = w.x; const x = Math.max(this.xMin * 0.5, xNew); w.x = x; const comp = this.xFreeOf(w) - x; const rate = (w.xPrev - x) / dt; // Einfedern positiv
      let Fs = w.k * comp + (rate > 0 ? w.c : w.cRebound) * rate; if (x <= this.xMin) Fs += 140000 * (this.xMin - x) + 600 * Math.max(0, rate) * 10; if (Fs < 0) Fs = 0; w.comp = comp;
      // Stabilisator
      const other = this.wheels[w.i ^ 1]; if (other.contact) { const dd = (this.xFreeOf(w) - x) - (this.xFreeOf(other) - other.x); Fs += this.arb * w.k * dd * 0.5; if (Fs < 0) Fs = 0; }
      // Kontaktgeometrie
      const n = _v2.set(gr.nx, gr.ny, gr.nz); const Wc = A.clone().addScaledVector(up, -x); const Pc = Wc.clone().addScaledVector(n, -this.R); w.cp.copy(Pc);
      const Fz = Fs * Math.max(0.2, n.dot(up)); w.Fz = Fz; w.load = Fz; const rVec = Pc.clone().sub(this.pos); const vc = this.vel.clone().add(_v3.crossVectors(this.w, rVec));
      // Radrichtung
      let fW = fwd.clone(); if (w.front) fW.applyAxisAngle(up, this.steer); fW.addScaledVector(n, -fW.dot(n)).normalize(); const lW = new V3().crossVectors(n, fW);
      const vx = vc.dot(fW), vyy = vc.dot(lW); const surf = G.Gen && (w.i === (this._surfIdx = (this._surfIdx || 0))) ? null : null;
      const gripSurf = w.surfGrip === undefined ? 1 : w.surfGrip; const mu = e.grip * gripSurf * wetK * (w.front ? 1 : 1) * (1 - 0.5 * (this.tirePop[w.i] > 0 ? 1 : 0)) * (1 - 0.2 * Math.min(1, w.hot));
      // Bremsmoment & Handbremse
      let Tb = brkIn * brakeCap * (w.front ? axleB[0] : axleB[1]) / 2 * this.R; let locked = false; if (inp.hb > 0 && !w.front) { Tb = Math.max(Tb, 99999 * inp.hb); locked = true; }
      // ABS
      const kappa0 = (w.omega * this.R - vx) / Math.max(Math.abs(vx), 1.5); if (brkIn > 0.05 && !locked && this.assistABS !== false && kappa0 < -0.17 && Math.abs(vx) > 4) Tb *= 0.35;
      // Schlupf & Raddynamik (implizit: Rad wird zuerst integriert, Kraft mit neuer Drehzahl)
      const vden = Math.max(Math.abs(vx), 1.6); const sa = Math.atan2(vyy, vden); w.slipAngle = sa; const syN = Math.tan(sa) / 0.16 * (locked ? 1.3 : 1); const latScale = locked ? 0.5 : 1;
      const tireF = (om) => { const kap = clamp((om * this.R - vx) / vden, -3, 3); const sxn = kap / 0.11; const rh = Math.hypot(sxn, syN) + 1e-6; const Fm = mu * Fz * tireCurve(rh); return [Fm * sxn / rh, Fm * syN / rh * latScale, rh, kap]; };
      const r0 = tireF(w.omega); const kslope = mu * Fz * 26 * this.R / vden / (1 + r0[2] * r0[2]); let omega = w.omega + (sh[w.i] - r0[0] * this.R) / (this.Iw + dt * this.R * kslope) * dt;
      const dec = Tb / this.Iw * dt; if (Math.abs(omega) <= dec) omega = 0; else omega -= Math.sign(omega) * dec; if (locked && !this.input.hbRelease) omega *= 0.2;
      const r1 = tireF(omega); let Fx = r1[0], Fy = r1[1]; const rho = r1[2], kappa = r1[3]; w.slipRatio = kappa;
      const mC = m / 4; const maxFy = mC * Math.abs(vyy) / dt * 0.7; if (Math.abs(Fy) > maxFy) Fy = Math.sign(Fy) * maxFy; const maxFx = mC * Math.abs(vx) / dt * 0.7 + 0.001; if (this.speed < 1.2 && Math.abs(kappa) < 0.3 && Math.abs(Fx) > maxFx) Fx = Math.sign(Fx) * maxFx;
      const Ftot = fW.clone().multiplyScalar(Fx).addScaledVector(lW, -Fy); Ftot.addScaledVector(n, Fz);
      Ftot.addScaledVector(fW, -Math.sign(vx) * Math.min(Math.abs(vx) * 200, 0.012 * Fz * (gripSurf < 0.7 ? 3 : 1)));
      net.add(Ftot); torque.add(_v3.crossVectors(rVec, Ftot)); slipSum += Math.min(2, rho) * Fz; w.omega = omega;
      w.Fx = Fx; w.Fy = Fy; w.slide = rho; if (rho > 1.15 && Math.abs(vx) + Math.abs(vyy) > 3) w.hot = Math.min(1, w.hot + dt * 0.3); else w.hot = Math.max(0, w.hot - dt * 0.1);
    }
    // --- Aerodynamik & Luftwiderstand
    const vv = this.speed; if (vv > 0.1) { const drag = 0.5 * RHO * e.cd * e.area * vv; net.addScaledVector(this.vel, -drag * (1 + 0.5 * this.dmg.front + (this.dmg.top > 0.5 ? 0.3 : 0))); const dfm = 0.5 * RHO * e.cl * e.area * vv * vv; if (dfm > 0) { net.addScaledVector(up, -dfm); const arm = _v.set(0, 0, this.zra - this.zcg + e.wb * 0.45).applyQuaternion(this.quat); torque.add(_v3.crossVectors(arm, _v2.copy(up).multiplyScalar(-dfm))); } }
    // Schaden: Reibung / Ziehen
    // --- Karosserie-Bodenkontakt
    let bodyHit = 0; for (let i = 0; i < this.body.length; i++) { const P = this.localToWorld(this.body[i], new V3()); const gh = W.groundAt(P.x, P.z, P.y); const pen = gh - P.y; if (pen > 0) { const rV = P.clone().sub(this.pos); const pv = this.vel.clone().add(_v3.crossVectors(this.w, rV)); const Fn = 90000 * pen - 2500 * Math.min(0, pv.y) * 4 + 0; const f = new V3(0, Math.max(0, Fn), 0); const fr = new V3(pv.x, 0, pv.z); const fl = fr.length(); if (fl > 0.1) f.addScaledVector(fr, -Math.min(m * 0.6 * 9.81 / 8 / fl, 800 / fl) * 1.0); net.add(f); torque.add(_v3.crossVectors(rV, f)); bodyHit = Math.max(bodyHit, pen); if (i >= 4) this.flipTimer += dt; } }
    this.bodyScrape = bodyHit; if (bodyHit > 0.03) this.scrapeSpeed = this.speed;
    // Ausreißer-Dämpfung & Stabilitäts-Assist (Gierdämpfung bei Übersteuern)
    if (this.stableAssist > 0 && this.onGround >= 3) { const wy = this.w.dot(up); const yawDes = vF * Math.tan(this.steer) / (e.wb) * 0.9; const err = wy - yawDes; if (Math.abs(vF) > 12 && Math.abs(err) > 0.35) torque.addScaledVector(up, -err * m * 55 * this.stableAssist * (1 - this.input.hb)); }
    // Integration
    const acc = net.multiplyScalar(1 / m); this.gForce.copy(acc).addScaledVector(_v.set(0, GRAV, 0), 0); this.vel.addScaledVector(acc, dt);
    const alpha = this._invIWorld(torque); this.w.addScaledVector(alpha, dt); this.w.multiplyScalar(1 - Math.min(0.5, dt * (this.onGround ? 0.25 : 0.05)));
    this.pos.addScaledVector(this.vel, dt); const wl = this.w.length(); if (wl > 1e-5) { _q.setFromAxisAngle(_v.copy(this.w).divideScalar(wl), wl * dt); this.quat.premultiply(_q).normalize(); }
    this.slipSum = slipSum / Math.max(1, m * GRAV);
    // Wasser
    const wh = W.terrainH(this.pos.x, this.pos.z); this.inWater = wh < -0.6 && this.pos.y - this.cgY < 0.2 && !(W.groundAt(this.pos.x, this.pos.z, this.pos.y) > wh + 0.5);
    if (this.inWater) { this.vel.multiplyScalar(1 - dt * 1.6); }
  }
  xFreeOf(w) { return w.xFree; }
  _smoothR(v, dt) { this._rt = (this._rt || 0) + (v - (this._rt || 0)) * Math.min(1, dt * 14); return this._rt; }
  /* Kommandos pro Frame (nach Substeps): Abgleich Boden-Untergrund */
  updateSurfaces(wet) {
    for (const w of this.wheels) { if (!w.contact) continue; const s = G.Gen.surfaceAt(w.cp.x, w.cp.z, this._sf || (this._sf = {})); w.surf = s.type; w.surfGrip = s.type === 'asphalt' ? (1 - 0.2 * (wet || 0)) : s.grip * (s.type === 'concrete' ? 1 - 0.15 * (wet || 0) : 1); }
    this.surfaceType = this.wheels[2].surf;
  }
  /* Radlast, Federweg, Raddrehung für Modell */
  wheelState() { return this.wheels; }
  /* Fahrzeug aufrichten */
  recover() { const f = this.forward(new V3()); const yaw = Math.atan2(f.x, f.z); const gh = W.groundAt(this.pos.x, this.pos.z); this.pos.y = gh + this.cgY + 0.5; this.quat.setFromAxisAngle(new V3(0, 1, 0), yaw); this.vel.set(0, 0, 0); this.w.set(0, 0, 0); for (const w of this.wheels) w.omega = 0; this.flipTimer = 0; }
  /* Schaden-Zonen: lokale Aufprallrichtung (Welt) -> Zone */
  applyDamage(localDir, energy) { const k = energy; const ax = Math.abs(localDir.x), az = Math.abs(localDir.z), ay = Math.abs(localDir.y); if (ay > ax && ay > az) this.dmg.top = clamp(this.dmg.top + k, 0, 1); else if (az >= ax) { if (localDir.z > 0) this.dmg.front = clamp(this.dmg.front + k, 0, 1); else this.dmg.rear = clamp(this.dmg.rear + k, 0, 1); } else { if (localDir.x > 0) this.dmg.left = clamp(this.dmg.left + k, 0, 1); else this.dmg.right = clamp(this.dmg.right + k, 0, 1); }
    this.health = clamp(1 - (this.dmg.front + this.dmg.rear + this.dmg.left + this.dmg.right + this.dmg.top * 0.6) / 2.2, 0, 1); }
}

/* ------------------------------------------------------------------ Kollisionen mit der Welt */
const Collide = {};
const _cols = [];
/* Kreis (Welt x,z, r) gegen alle statischen Objekte. liefert besten Treffer {nx,nz,depth,col} */
Collide.circleVsWorld = function (cx, cz, r, y, out) {
  let best = null; Gen_().colliders(cx, cz, r + 2, _cols);
  for (let i = 0; i < _cols.length; i++) { const c = _cols[i]; if (y !== undefined && c.top !== undefined && y > c.top + 1 && c.base === undefined) { /* über dem Hindernis */ }
    let nx, nz, depth; if (c.t === 1) { const dx = cx - c.x, dz = cz - c.z; const d = Math.hypot(dx, dz); const pen = c.r + r - d; if (pen <= 0) continue; nx = d > 1e-5 ? dx / d : 1; nz = d > 1e-5 ? dz / d : 0; depth = pen; }
    else { const dx = cx - c.x, dz = cz - c.z; const lx = dx * c.cs - dz * c.sn, lz = dx * c.sn + dz * c.cs; const qx = clamp(lx, -c.hx, c.hx), qz = clamp(lz, -c.hz, c.hz); let ddx = lx - qx, ddz = lz - qz; const d = Math.hypot(ddx, ddz);
      if (d > 1e-5) { const pen = r - d; if (pen <= 0) continue; const lnx = ddx / d, lnz = ddz / d; nx = lnx * c.cs + lnz * c.sn; nz = -lnx * c.sn + lnz * c.cs; depth = pen; }
      else { const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz); let lnx = 0, lnz = 0; if (px < pz) { lnx = Math.sign(lx) || 1; depth = px + r; } else { lnz = Math.sign(lz) || 1; depth = pz + r; } nx = lnx * c.cs + lnz * c.sn; nz = -lnx * c.sn + lnz * c.cs; } }
    if (!best || depth > best.depth) { best = best || {}; best.nx = nx; best.nz = nz; best.depth = depth; best.col = c; } }
  return best;
};
function Gen_() { return G.Gen; }
const _bq = { r: null };
/* Straßenbegrenzungen: Tunnel, Brücke, Leitplanken, Mittelleitplanke */
Collide.roadBarrier = function (x, z, r, out) {
  const q = W.queryRoad(x, z, 22, _bq); if (!q.r) return null; const T = q.r.T; const fl = q.flags; const side = q.side; const ax = Math.abs(side);
  // rechts = +side
  let wall = 0, nxs = 0;
  if ((fl & 2) || (fl & 1)) { const lim = T.half + (fl & 1 ? 1.4 : 0.35); if (ax + r > lim && ax < lim + 3) { wall = lim; } }
  else { const bitR = fl & 8, bitL = fl & 4; const lim = T.half + 0.95; if (ax + r > lim && ax < lim + 1.6 && ((side > 0 && bitR) || (side < 0 && bitL))) wall = lim; }
  if (!wall && q.r.type === 'hw' && !(fl & 1) && ax < 0.6 + r && ax < 1.6) { /* Mittelleitplanke */ const pen = 0.7 + r - ax; const sgn = side >= 0 ? 1 : -1; const nxr = -q.tz * sgn, nzr = q.tx * sgn; out = out || {}; out.nx = nxr; out.nz = nzr; out.depth = pen; out.col = null; return out; }
  if (!wall) return null; const lim = wall; const pen = ax + r - lim; const sgn = side >= 0 ? -1 : 1; const nrx = -q.tz, nrz = q.tx; out = out || {}; out.nx = nrx * sgn; out.nz = nrz * sgn; out.depth = pen; out.col = null; return out;
};

/* Fahrzeug gegen Welt: gibt Gesamtaufprall (Energie) zurück */
const _hit = {}, _bhit = {};
Collide.vehicleVsWorld = function (veh, onHit) {
  let total = 0; const f = veh.forward(new V3()); const lft = veh.left(new V3()); const fy = Math.atan2(f.x, f.z);
  for (let it = 0; it < 2; it++) for (const ci of veh.circles) {
    const cx = veh.pos.x + f.x * ci.z + (0) , cz = veh.pos.z + f.z * ci.z; const y = veh.pos.y - veh.cgY + 0.5;
    for (let k = 0; k < 2; k++) { const h = k === 0 ? Collide.circleVsWorld(cx, cz, ci.r, y, _hit) : Collide.roadBarrier(cx, cz, ci.r, _bhit); if (!h) continue; const rel = h.depth;
      // Höhe: auf Rampen/Sprüngen über Hindernis ignorieren
      if (h.col && h.col.top < veh.pos.y - veh.cgY - 0.3) continue;
      const px = cx - h.nx * ci.r, pz = cz - h.nz * ci.r; const P = new V3(px, veh.pos.y - veh.cgY * 0.4, pz); const r = P.clone().sub(veh.pos); const vc = veh.vel.clone().add(new V3().crossVectors(veh.w, r)); const n = new V3(h.nx, 0, h.nz); const vn = vc.dot(n);
      veh.pos.x += h.nx * h.depth * 0.9; veh.pos.z += h.nz * h.depth * 0.9;
      if (vn < 0) { const soft = h.col && h.col.soft; const eRest = soft ? 0.05 : 0.22; const rn = new V3().crossVectors(r, n); const iw = veh._invIWorld(rn); const denom = 1 / veh.m + rn.dot(iw) * 0.7; let J = -(1 + eRest) * vn / denom; if (soft) J *= 0.6; const Jv = n.clone().multiplyScalar(J); // Reibung tangential
        veh.vel.addScaledVector(Jv, 1 / veh.m); veh.w.add(veh._invIWorld(new V3().crossVectors(r, Jv)).multiplyScalar(0.7)); const vt = vc.clone().addScaledVector(n, -vn); const vtl = vt.length(); if (vtl > 0.1) { const Jt = Math.min(vtl * veh.m * 0.12, 0.25 * Math.abs(J)); veh.vel.addScaledVector(vt, -Jt / vtl / veh.m); }
        const energy = 0.5 * veh.m * vn * vn; total += energy; if (onHit) onHit(P, n, -vn, energy, h.col, soft); } }
  }
  return total;
};

G.Vehicle = Vehicle; G.Collide = Collide; G.sampleGround = sampleGround;
})(window.G = window.G || {});
