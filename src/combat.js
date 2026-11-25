// Kampfsystem: Schüsse, Nahkampf, Explosionen
import * as THREE from 'three';
import { WEAPONS } from './data.js';
import { clamp } from './util.js';

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz; if (tca < 0) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca; if (d2 > r * r) return null;
  return tca - Math.sqrt(r * r - d2);
}

export class Combat {
  constructor(G) { this.G = G; }
  // Strahl gegen alle Ziele
  cast(ox, oy, oz, dx, dy, dz, maxT, ignore = null) {
    const G = this.G; let best = { t: maxT, kind: 'none' };
    const tw = G.world.rayHit(ox, oy, oz, dx, dy, dz, maxT);
    if (tw !== null && tw < best.t) best = { t: tw, kind: 'world' };
    for (const p of G.peds?.list || []) {
      if (!p.alive || p === ignore) continue;
      const b = p.pos;
      let t = raySphere(ox, oy, oz, dx, dy, dz, b.x, b.y + 1.68, b.z, 0.15);
      let head = t !== null;
      if (t === null) t = raySphere(ox, oy, oz, dx, dy, dz, b.x, b.y + 1.15, b.z, 0.3);
      if (t === null) t = raySphere(ox, oy, oz, dx, dy, dz, b.x, b.y + 0.5, b.z, 0.3);
      if (t !== null && t < best.t && t > 0) best = { t, kind: 'ped', obj: p, head };
    }
    if (G.player && ignore !== G.player && !G.player.vehicle && G.player.alive) {
      const b = G.player.pos;
      let t = raySphere(ox, oy, oz, dx, dy, dz, b.x, b.y + 1.68, b.z, 0.15), head = t !== null;
      if (t === null) t = raySphere(ox, oy, oz, dx, dy, dz, b.x, b.y + 1.0, b.z, 0.35);
      if (t === null) t = raySphere(ox, oy, oz, dx, dy, dz, b.x, b.y + 0.4, b.z, 0.3);
      if (t !== null && t < best.t && t > 0) best = { t, kind: 'player', obj: G.player, head };
    }
    for (const v of G.vehicles?.list || []) {
      if (v === ignore?.vehicle) continue;
      const rx = v.pos.x - ox, rz = v.pos.z - oz; if (rx * rx + rz * rz > (maxT + 15) ** 2) continue;
      const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
      for (const c of v.circles) {
        const cx = v.pos.x + sy * c.z, cz = v.pos.z + cy * c.z, H = v.spec.hgt;
        const t = raySphere(ox, oy, oz, dx, dy, dz, cx, v.pos.y + Math.max(H * 0.5, c.r), cz, Math.max(c.r * 1.05, H * 0.5));
        if (t !== null && t < best.t && t > 0) best = { t, kind: 'vehicle', obj: v };
      }
    }
    return best;
  }
  fire(shooter, origin, dir, wk, opts = {}) {
    const G = this.G, w = WEAPONS[wk], isP = shooter === G.player;
    const n = w.pellets || 1;
    const dm = opts.dmgMul ?? 1;
    G.fx?.muzzle(origin.x + dir.x * 0.4, origin.y + dir.y * 0.4, origin.z + dir.z * 0.4);
    G.audio?.gun(wk, origin);
    G.emit('gunshot', { x: origin.x, z: origin.z, by: shooter, loud: wk !== 'pistol' ? 1 : 0.7 });
    for (let i = 0; i < n; i++) {
      const sp = w.spread * (opts.spreadMul ?? 1);
      const d = new THREE.Vector3(dir.x + (Math.random() - 0.5) * sp * 2, dir.y + (Math.random() - 0.5) * sp * 2, dir.z + (Math.random() - 0.5) * sp * 2).normalize();
      const hit = this.cast(origin.x, origin.y, origin.z, d.x, d.y, d.z, w.range, shooter);
      const px = origin.x + d.x * hit.t, py = origin.y + d.y * hit.t, pz = origin.z + d.z * hit.t;
      G.fx?.tracer(origin.x + d.x * 1.2, origin.y + d.y * 1.2 - 0.05, origin.z + d.z * 1.2, px, py, pz);
      if (hit.kind === 'ped') { hit.obj.hurt(w.dmg * dm * (hit.head ? 2.4 : 1), shooter, hit.head); G.fx?.puff(px, py, pz, 0x8a1010, 2); }
      else if (hit.kind === 'player') { hit.obj.hurt(w.dmg * dm * (hit.head ? 1.8 : 1) * 0.55, shooter); }
      else if (hit.kind === 'vehicle') { hit.obj.wake(); hit.obj.damage(w.dmg * dm * 2.2, 'bullet', shooter); G.fx?.sparks(px, py, pz, 0.4); G.audio?.ricochet?.(px, py, pz); G.emit('vehicleShot', { v: hit.obj, by: shooter }); }
      else if (hit.kind === 'world') { G.fx?.puff(px, py, pz, 0xb8b0a0, 3); G.fx?.sparks(px, py, pz, 0.2); }
    }
    return true;
  }
  // Nahkampf
  melee(shooter, pos, yaw, dmg = 14) {
    const G = this.G; let hitAny = false;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const list = [...(G.peds?.list || [])];
    for (const p of list) {
      if (!p.alive || p === shooter) continue;
      const dx = p.pos.x - pos.x, dz = p.pos.z - pos.z, d = Math.hypot(dx, dz);
      if (d < 1.9 && (dx * fx + dz * fz) / (d || 1) > 0.35) { p.hurt(dmg, shooter, false, true); hitAny = true; G.fx?.puff(p.pos.x, p.pos.y + 1.3, p.pos.z, 0xaaaaaa, 2); G.audio?.punch?.(); }
    }
    if (shooter !== G.player && G.player.alive && !G.player.vehicle) {
      const dx = G.player.pos.x - pos.x, dz = G.player.pos.z - pos.z, d = Math.hypot(dx, dz);
      if (d < 1.9 && (dx * fx + dz * fz) / (d || 1) > 0.35) { G.player.hurt(dmg, shooter); hitAny = true; }
    }
    return hitAny;
  }
  explode(x, y, z, radius, power, source, silent = false) {
    const G = this.G;
    if (!silent) { G.fx?.explosion(x, y, z, radius / 9); G.audio?.explosion({ x, y, z }); }
    G.emit('explosion', { x, y, z, r: radius, power, source });
    for (const p of G.peds?.list || []) {
      if (!p.alive) continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z); if (d < radius) { p.hurt(power * 220 * (1 - d / radius) + 20, source, false); p.knock?.(p.pos.x - x, p.pos.z - z, 8 * (1 - d / radius)); }
    }
    if (G.player.alive) { const d = Math.hypot(G.player.pos.x - x, G.player.pos.z - z); if (d < radius) G.player.hurt(power * 150 * (1 - d / radius), source); }
    for (const v of G.vehicles.list) {
      const d = Math.hypot(v.pos.x - x, v.pos.z - z); if (d < radius + v.spec.len / 2 && !v.exploded) { v.wake(); v.damage(power * 600 * (1 - d / (radius + 4)), 'explosion', source); const a = Math.atan2(v.pos.x - x, v.pos.z - z); v.setWorldVel(v.vx + Math.sin(a) * 8 * (1 - d / radius), v.vz + Math.cos(a) * 8 * (1 - d / radius)); }
    }
  }
}
