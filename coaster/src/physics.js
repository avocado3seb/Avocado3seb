// ============================================================================
//  physics.js – Fahrphysik: Schwerkraft, Reibung, Luftwiderstand, Lift, Launch, Bremsen
//  Der Zug wird als Punktmasse entlang der Strecke simuliert; die Schwerkraft wird über
//  alle Wagen gemittelt (dadurch realistisches Verhalten über Kuppen und im Looping).
// ============================================================================
import { ZONE, poseAt, newPose, G } from './track.js';

export class Sim {
  constructor(track, cfg = {}) {
    this.tr = track;
    this.cars = cfg.cars || 6;
    this.spacing = cfg.spacing || 3.0;
    this.trainLen = this.cars * this.spacing;
    this.crr = cfg.crr ?? 0.012;       // Rollreibung
    this.drag = cfg.drag ?? 0.00022;   // Luftwiderstand pro Masse
    this.dispatch = cfg.dispatch ?? 7; // Wartezeit in der Station (s)
    this.minCrawl = 0.9;               // Mindest-Kriechgeschwindigkeit (Hilfsantrieb)
    this._p = newPose(); this._q = newPose();
    this.reset(cfg.delay || 0);
  }

  reset(delay = 0) {
    this.s = this.tr.sStop; this.v = 0; this.a = 0;
    this.state = 'station'; this.timer = this.dispatch + delay;
    this.arriving = false; this.lap = 0; this.rideTime = 0;
    this.stats = { maxV: 0, maxG: 0, minG: 9, maxLat: 0, maxY: 0, assist: 0, time: 0 };
    this.g = { vert: 1, lat: 0, lon: 0 };
    this.lastLapStats = null;
  }

  zoneAt(s) {
    const tr = this.tr;
    let i = Math.floor((((s / tr.ds) % tr.N) + tr.N) % tr.N);
    return i;
  }

  carS(k) { return this.s - this.spacing * (k + 0.5); }

  step(dt) {
    const tr = this.tr, L = tr.L;
    if (this.state === 'station') {
      this.v = 0; this.a = 0; this.timer -= dt;
      if (this.timer <= 0) { this.state = 'run'; this.v = 0.5; this.rideTime = 0; this.stats = { maxV: 0, maxG: 0, minG: 9, maxLat: 0, maxY: 0, assist: 0, time: 0 }; }
      return;
    }
    this.rideTime += dt;
    const n = Math.max(1, Math.ceil(dt / (1 / 90)));
    const h = dt / n;
    for (let it = 0; it < n; it++) this.sub(h);

    // Fahrwerte & G-Kräfte (mittlerer Wagen)
    const st = this.stats;
    st.time = this.rideTime;
    if (this.v > st.maxV) st.maxV = this.v;
    const mid = this._q;
    poseAt(tr, this.carS((this.cars - 1) / 2), mid);
    if (mid.p[1] > st.maxY) st.maxY = mid.p[1];
    const v2 = this.v * this.v;
    const ax = v2 * mid.k[0] + this.a * mid.t[0], ay = v2 * mid.k[1] + this.a * mid.t[1] + G, az = v2 * mid.k[2] + this.a * mid.t[2];
    let gv = (ax * mid.u[0] + ay * mid.u[1] + az * mid.u[2]) / G;
    let gl = (ax * mid.r[0] + ay * mid.r[1] + az * mid.r[2]) / G;
    let gn = (ax * mid.t[0] + ay * mid.t[1] + az * mid.t[2]) / G;
    // sanft glätten
    const k = Math.min(1, dt * 10);
    this.g.vert += (gv - this.g.vert) * k; this.g.lat += (gl - this.g.lat) * k; this.g.lon += (gn - this.g.lon) * k;
    if (this.g.vert > st.maxG) st.maxG = this.g.vert;
    if (this.g.vert < st.minG) st.minG = this.g.vert;
    if (Math.abs(this.g.lat) > st.maxLat) st.maxLat = Math.abs(this.g.lat);
  }

  sub(dt) {
    const tr = this.tr, L = tr.L, p = this._p;
    let sy = 0, onLift = false;
    for (let k = 0; k < this.cars; k++) {
      const sk = this.carS(k);
      poseAt(tr, sk, p);
      sy += p.t[1];
      if (tr.zone[p.i] === ZONE.LIFT) onLift = true;
    }
    sy /= this.cars;
    let v = this.v;
    let a = -G * sy;
    a -= this.crr * G * Math.min(1, v / 0.3) + this.drag * v * v;

    const hi = this.zoneAt(this.s);
    const zone = tr.zone[hi], zv = tr.zv[hi], za = tr.za[hi];
    v += a * dt;
    let acc = a;

    if (!this.arriving && this.s >= L) this.arriving = true;

    if (this.arriving) {
      const dist = L + tr.sStop - this.s;
      const vmax = Math.sqrt(2 * 1.6 * Math.max(0, dist)) + 0.15;
      if (v > vmax) v = Math.max(vmax, v - 5 * dt);
      if (v < 1.4 && dist > 1.5) v = Math.min(1.4, v + 2 * dt);
      if (dist <= 0.04 || (v < 0.25 && dist < 0.6)) {
        this.s = tr.sStop; this.v = 0; this.a = 0; this.arriving = false; this.state = 'station';
        this.timer = this.dispatch; this.lap++;
        this.lastLapStats = this.stats;
        return;
      }
    } else {
      if (zone === ZONE.STATION || zone === ZONE.DRIVE) {
        if (v < zv) v = Math.min(zv, v + 2.2 * dt); else if (v > zv) v = Math.max(zv, v - 3 * dt);
      } else if (zone === ZONE.LAUNCH) {
        if (v < zv) v = Math.min(zv, v + za * dt);
      } else if (zone === ZONE.BRAKE) {
        if (v > zv) v = Math.max(zv, v - 8 * dt);
      }
      if (onLift) {
        const lz = tr.zv[this.zoneAt(this.s - this.spacing * 0.5 * this.cars)] || 3.2;
        let zl = 3.2;
        for (let k = 0; k < this.cars; k++) { const i = this.zoneAt(this.carS(k)); if (tr.zone[i] === ZONE.LIFT) { zl = tr.zv[i]; break; } }
        if (v < zl) v = Math.min(zl, v + 10 * dt);
      }
      // Hilfsantrieb – der Zug bleibt nie stehen (z. B. bei benutzerdefinierten Strecken)
      if (v < this.minCrawl && zone !== ZONE.STATION) { v = this.minCrawl; this.stats.assist += dt; }
    }
    this.a = (v - this.v) / dt;
    this.v = v;
    this.s += v * dt;
  }

  carPose(k, out) { return poseAt(this.tr, this.carS(k), out); }
  get progress() { return Math.max(0, Math.min(1, (this.s - this.tr.sStop) / this.tr.L)); }
}
