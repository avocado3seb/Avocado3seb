// KI-Fahrer: Pfadverfolgung, Hindernisvermeidung, Ampeln
import { clamp, lerp, damp, wrapPI, angDiff, RNG } from './util.js';

export const laneOff = (edge) => edge.kind === 'avenue' ? 5.6 : edge.kind === 'highway' ? 3.7 : edge.kind === 'promenade' ? 3.8 : 3.5;
const crossHalf = (n, horizEdge) => (horizEdge ? n.hwV : n.hwH) || 0;

// Punkte für Übergang a→b→c (Fahrspur rechts)
export function legPoints(a, b, c, W, speedMul = 1) {
  const eIn = a.out.find((o) => o.to === b), eOut = c ? b.out.find((o) => o.to === c) : null;
  const out = [];
  const offIn = laneOff(eIn.edge), speedIn = eIn.edge.speed * speedMul;
  const din = [eIn.dx, eIn.dz], rin = [-din[1], din[0]];
  const hin = crossHalf(b, eIn.edge.horiz) + 1.4;
  const P1 = [b.x - din[0] * hin + rin[0] * offIn, b.z - din[1] * hin + rin[1] * offIn];
  // gerader Teil vom Start der Kante bis P1 (Zwischenpunkte)
  const sx = a.x + din[0] * ((crossHalf(a, eIn.edge.horiz) || 0) + 1.4) + rin[0] * offIn, sz = a.z + din[1] * ((crossHalf(a, eIn.edge.horiz) || 0) + 1.4) + rin[1] * offIn;
  const L = Math.hypot(P1[0] - sx, P1[1] - sz);
  const n = Math.max(1, Math.floor(L / 30));
  for (let i = 1; i < n; i++) out.push({ x: sx + (P1[0] - sx) * i / n, z: sz + (P1[1] - sz) * i / n, lim: speedIn });
  const sig = b.signal ? { node: b, axis: eIn.edge.horiz ? 'x' : 'z' } : null;
  out.push({ x: P1[0], z: P1[1], lim: speedIn, sig });
  if (!eOut) return out;
  const dout = [eOut.dx, eOut.dz], rout = [-dout[1], dout[0]], offOut = laneOff(eOut.edge);
  const hout = crossHalf(b, eOut.edge.horiz) + 1.4;
  const P2 = [b.x + dout[0] * hout + rout[0] * offOut, b.z + dout[1] * hout + rout[1] * offOut];
  const C = [b.x + rin[0] * offIn + rout[0] * offOut, b.z + rin[1] * offIn + rout[1] * offOut];
  const cr = din[0] * dout[1] - din[1] * dout[0], dot = din[0] * dout[0] + din[1] * dout[1];
  const uturn = dot < -0.5;
  const turnLim = uturn ? 4.5 : cr > 0.5 ? 6.5 : cr < -0.5 ? 8 : 99;
  const lim = Math.min(turnLim, Math.min(speedIn, eOut.edge.speed * speedMul) * 1.0);
  const segs = uturn ? 8 : Math.abs(cr) > 0.5 ? 7 : 2;
  for (let i = 1; i <= segs; i++) {
    const t = i / (segs + 1), u = 1 - t;
    out.push({ x: u * u * P1[0] + 2 * u * t * C[0] + t * t * P2[0], z: u * u * P1[1] + 2 * u * t * C[1] + t * t * P2[1], lim: Math.min(lim, speedIn), turn: true });
  }
  out.push({ x: P2[0], z: P2[1], lim: Math.min(lim * 1.3, eOut.edge.speed * speedMul), turn: false });
  return out;
}

export class RouteDriver {
  constructor(G, v, o = {}) {
    this.G = G; this.v = v; this.pts = []; this.i = 0; this.pers = o.pers ?? (0.82 + Math.random() * 0.3);
    this.panic = 0; this.stuckT = 0; this.reverseT = 0; this.waitT = 0; this.yieldT = 0;
    this.vt = 0; this.dead = false; this.maxSpeedMul = o.speedMul ?? 1; this.sirenYield = 0;
    this.lastTurnLim = 99;
  }
  setPath(pts) { this.pts = pts; this.i = 0; }
  remaining() { let d = 0; for (let k = this.i; k < this.pts.length - 1; k++) d += Math.hypot(this.pts[k + 1].x - this.pts[k].x, this.pts[k + 1].z - this.pts[k].z); return d; }
  // Pure-Pursuit
  follow(dt, speedLimit, opts = {}) {
    const v = this.v, p = v.pos, pts = this.pts;
    if (pts.length < 2) return;
    // nächster Index
    let best = this.i, bd = 1e12;
    for (let k = Math.max(0, this.i - 1); k < Math.min(pts.length, this.i + 6); k++) { const d = (pts[k].x - p.x) ** 2 + (pts[k].z - p.z) ** 2; if (d < bd) { bd = d; best = k; } }
    this.i = best;
    const ld = clamp(4 + v.speed * 0.55, 5, 26);
    let k = this.i, acc = 0, tx = pts[k].x, tz = pts[k].z;
    // vorwärts bis Lookahead-Distanz
    let cx = p.x, cz = p.z;
    for (; k < pts.length; k++) { const d = Math.hypot(pts[k].x - cx, pts[k].z - cz); if (acc + d >= ld) { const t = (ld - acc) / d; tx = cx + (pts[k].x - cx) * t; tz = cz + (pts[k].z - cz) * t; break; } acc += d; cx = pts[k].x; cz = pts[k].z; tx = cx; tz = cz; }
    if (opts.offsetRight) { /* seitlicher Versatz zum Platzmachen */ const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz) || 1; tx += -dz / l * opts.offsetRight; tz += dx / l * opts.offsetRight; }
    this.steerTo(tx, tz);
    // Kurvengeschwindigkeit: Limits der nächsten Punkte
    let lim = speedLimit;
    let ahead = 0, ccx = p.x, ccz = p.z;
    for (let q = this.i; q < Math.min(pts.length, this.i + 14); q++) {
      ahead += Math.hypot(pts[q].x - ccx, pts[q].z - ccz); ccx = pts[q].x; ccz = pts[q].z;
      const L2 = pts[q].lim; if (L2 < lim) { const vmax = Math.sqrt(L2 * L2 + 2 * 5 * Math.max(0, ahead - 2)); lim = Math.min(lim, vmax); }
    }
    return lim;
  }
  steerTo(tx, tz) {
    const v = this.v, dx = tx - v.pos.x, dz = tz - v.pos.z;
    const desired = Math.atan2(dx, dz);
    const a = angDiff(v.yaw, desired);
    const Ld = Math.max(3, Math.hypot(dx, dz));
    const L = v.a + v.b;
    const delta = Math.atan2(2 * L * Math.sin(a), Ld);
    const maxS = v.maxSteer / (1 + Math.pow(Math.abs(v.u) / (v.kind === 'bike' ? 11 : 8), 2.2));
    v.in.steer = clamp(delta / Math.max(0.03, maxS), -1, 1);
    return a;
  }
  speedControl(dt, target) {
    const v = this.v, u = v.u;
    const err = target - u;
    if (target < 0.3 && Math.abs(u) < 0.6) { v.in.throttle = 0; v.in.brake = 1; v.in.hand = true; return; }
    v.in.hand = false;
    if (err > 0.5) { v.in.throttle = clamp(err * 0.5, 0.1, 1); v.in.brake = 0; }
    else if (err < -0.8) { v.in.throttle = 0; v.in.brake = clamp(-err * 0.18, 0.1, 1); }
    else { v.in.throttle = clamp(err * 0.3 + 0.1, 0, 0.35); v.in.brake = 0; }
  }
  // Hindernis voraus (Fahrzeuge, Fußgänger): liefert max. erlaubte Geschwindigkeit
  obstacle(range) {
    const G = this.G, v = this.v, sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    let lim = 99;
    const check = (ox, oz, ospeed, rad, isPed) => {
      const dx = ox - v.pos.x, dz = oz - v.pos.z;
      const fwd = dx * sy + dz * cy, lat = Math.abs(dx * cy - dz * sy);
      if (fwd <= 0.5 || fwd > range) return;
      const lw = v.spec.wid / 2 + rad + (isPed ? 0.6 : 0.3) + Math.min(1.5, fwd * 0.04);
      if (lat > lw) return;
      const gap = fwd - v.spec.len / 2 - rad;
      const allow = isPed ? Math.max(0, gap - 3) * 1.0 : Math.max(0, ospeed + (gap - 4.5) * 0.7);
      lim = Math.min(lim, gap < 2.5 ? 0 : allow);
    };
    for (const o of G.vehicles.list) {
      if (o === v || o.exploded && false) continue;
      const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z; if (dx * dx + dz * dz > range * range * 1.6) continue;
      if (o.kind === 'plane' && o.air) continue;
      check(o.pos.x, o.pos.z, Math.max(0, o.u * Math.cos(o.yaw - v.yaw) ), o.spec.wid / 2 + o.spec.len / 2 * 0.5, false);
      if (o.spec.len > 5.5) check(o.pos.x + Math.sin(o.yaw) * o.spec.len * 0.3, o.pos.z + Math.cos(o.yaw) * o.spec.len * 0.3, Math.max(0, o.u * Math.cos(o.yaw - v.yaw)), o.spec.wid / 2, false);
    }
    for (const p of G.peds?.list || []) { if (!p.alive || p.state === 'inside') continue; const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z; if (dx * dx + dz * dz > range * range) continue; check(p.pos.x, p.pos.z, 0, 0.35, true); }
    const pl = G.player; if (!pl.vehicle) check(pl.pos.x, pl.pos.z, 0, 0.35, true);
    return lim;
  }
  signalLimit() {
    // nächster Punkt mit Ampel vor uns
    const v = this.v, pts = this.pts, W = this.G.world, t = this.G.time;
    let d = 0, cx = v.pos.x, cz = v.pos.z;
    for (let q = this.i; q < Math.min(pts.length, this.i + 8); q++) {
      d += Math.hypot(pts[q].x - cx, pts[q].z - cz); cx = pts[q].x; cz = pts[q].z;
      const s = pts[q].sig;
      if (s) {
        const st = W.signalState(s.node, s.axis, t);
        const stopDist = d - 1.0;
        if (stopDist < -4) return 99;
        const brakeDist = v.u * v.u / (2 * 6.0);
        if (st === 0 || (st === 1 && stopDist > brakeDist * 0.9)) {
          if (st === 0 && stopDist < 1.5 && stopDist > -4) return 0;
          return Math.sqrt(2 * 5.5 * Math.max(0, stopDist - 0.5));
        }
        return 99;
      }
      if (d > 70) break;
    }
    return 99;
  }
}
